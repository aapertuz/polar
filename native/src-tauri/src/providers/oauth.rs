use super::{openai, types::*};
use axum::{
    extract::{RawQuery, State},
    http::StatusCode,
    routing::get,
    Router,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use jsonwebtoken::{decode, decode_header, jwk::JwkSet, Algorithm, DecodingKey, Validation};
use rand::RngCore;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Duration,
};
use tauri_plugin_opener::OpenerExt;
use tokio::sync::oneshot;
use tokio_util::sync::CancellationToken;

const AUTHORIZE: &str = "https://auth.openai.com/api/accounts/authorize";
const TOKEN: &str = "https://auth.openai.com/api/accounts/oauth/token";
const SCOPES: &str =
    "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";

#[derive(Deserialize)]
pub struct Discovery {
    issuer: String,
    pub jwks_uri: String,
    pub revocation_endpoint: String,
}

pub async fn discovery(client: &reqwest::Client) -> Result<Discovery> {
    let response = client
        .get(format!("{ISSUER}/.well-known/openid-configuration"))
        .send()
        .await
        .map_err(|_| ProviderError::network())?;
    let config: Discovery = openai::json(response).await?;
    if config.issuer != ISSUER
        || !trusted_auth_url(&config.jwks_uri)
        || !trusted_auth_url(&config.revocation_endpoint)
    {
        return Err(ProviderError::protocol());
    }
    Ok(config)
}

fn trusted_auth_url(value: &str) -> bool {
    url::Url::parse(value).is_ok_and(|url| {
        url.scheme() == "https"
            && url.host_str() == Some("auth.openai.com")
            && url.port_or_known_default() == Some(443)
            && url.username().is_empty()
            && url.password().is_none()
    })
}

#[derive(Deserialize)]
struct Claims {
    sub: String,
    email: Option<String>,
    nonce: String,
}

pub fn validate_identity(
    token: &str,
    keys: &JwkSet,
    client_id: &str,
    nonce: &str,
    expected_subject: Option<&str>,
) -> Result<(String, String)> {
    let header = decode_header(token).map_err(|_| identity_error())?;
    if header.alg != Algorithm::RS256 {
        return Err(identity_error());
    }
    let key = keys
        .find(header.kid.as_deref().ok_or_else(identity_error)?)
        .ok_or_else(identity_error)?;
    let key = DecodingKey::from_jwk(key).map_err(|_| identity_error())?;
    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_issuer(&[ISSUER]);
    validation.set_audience(&[client_id]);
    validation.set_required_spec_claims(&["exp", "iss", "aud", "sub"]);
    validation.validate_nbf = true;
    validation.leeway = 30;
    let claims = decode::<Claims>(token, &key, &validation)
        .map_err(|_| identity_error())?
        .claims;
    if claims.sub.is_empty()
        || claims.sub.len() > 512
        || claims.nonce != nonce
        || expected_subject.is_some_and(|expected| expected != claims.sub)
    {
        return Err(identity_error());
    }
    let email = claims.email.unwrap_or_default();
    if email.len() > 320 {
        return Err(identity_error());
    }
    Ok((claims.sub, email))
}

fn identity_error() -> ProviderError {
    ProviderError::new(
        "identity_mismatch",
        "Could not verify this ChatGPT account. Sign in again with the selected account.",
    )
}

fn random_secret() -> String {
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn challenge(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

pub struct Callback {
    code: String,
    client_id: String,
}

pub fn parse_callback(
    query: &str,
    expected_state: &str,
    returning_client: Option<&str>,
) -> Result<Callback> {
    if query.len() > 16_384 {
        return Err(ProviderError::protocol());
    }
    let mut fields = HashMap::new();
    for (key, value) in url::form_urlencoded::parse(query.as_bytes()) {
        if fields.insert(key.to_string(), value.to_string()).is_some() {
            return Err(ProviderError::protocol());
        }
    }
    if fields.get("state").map(String::as_str) != Some(expected_state) {
        return Err(ProviderError::new(
            "invalid_state",
            "The sign-in callback could not be verified.",
        ));
    }
    if let Some(error) = fields.get("error") {
        return Err(if error == "access_denied" {
            ProviderError::new(
                "access_denied",
                "ChatGPT access was not granted. Continue with ChatGPT to try again.",
            )
        } else {
            ProviderError::new("authorization_failed", "ChatGPT sign-in failed. Try again.")
        });
    }
    let supplied = fields.get("client_id").map(String::as_str);
    let client_id = match (returning_client, supplied) {
        (Some(expected), Some(actual)) if actual != expected => return Err(identity_error()),
        (Some(expected), _) => expected,
        (None, Some(actual)) if actual != "dynamic_agent_client" && !actual.is_empty() => actual,
        _ => return Err(ProviderError::protocol()),
    };
    if client_id.len() > 512 {
        return Err(ProviderError::protocol());
    }
    let code = fields
        .get("code")
        .filter(|code| !code.is_empty())
        .ok_or_else(ProviderError::protocol)?;
    Ok(Callback {
        code: code.clone(),
        client_id: client_id.to_string(),
    })
}

struct CallbackState {
    state: String,
    client_id: Option<String>,
    sender: Mutex<Option<oneshot::Sender<Result<Callback>>>>,
}

async fn callback(
    State(state): State<Arc<CallbackState>>,
    RawQuery(query): RawQuery,
) -> (StatusCode, &'static str) {
    let result = parse_callback(
        query.as_deref().unwrap_or_default(),
        &state.state,
        state.client_id.as_deref(),
    );
    // An unrelated or forged request must not consume a pending sign-in attempt.
    if result
        .as_ref()
        .is_err_and(|error| error.code == "invalid_state" || error.code == "invalid_response")
    {
        return (
            StatusCode::BAD_REQUEST,
            "Invalid sign-in callback. Return to Polar to try again.",
        );
    }
    let success = result.is_ok();
    if let Ok(mut sender) = state.sender.lock() {
        if let Some(sender) = sender.take() {
            let _ = sender.send(result);
        }
    }
    if success {
        (
            StatusCode::OK,
            "Sign-in received. Return to Polar to finish connecting.",
        )
    } else {
        (
            StatusCode::BAD_REQUEST,
            "Sign-in was not completed. Return to Polar.",
        )
    }
}

#[derive(Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub id_token: Option<String>,
    token_type: String,
    expires_in: u64,
    scope: String,
    earliest_refresh_at: Option<u64>,
}

impl TokenResponse {
    pub fn credentials(self, previous_id_token: Option<&str>) -> Result<Credentials> {
        let scopes: Vec<String> = self.scope.split_whitespace().map(str::to_string).collect();
        if !scopes.iter().any(|s| s == PLAN_SCOPE) || !scopes.iter().any(|s| s == "resource.invoke")
        {
            return Err(ProviderError::new(
                "plan_permission",
                "ChatGPT plan access is not enabled. Reconnect and grant plan usage.",
            ));
        }
        if !self.token_type.eq_ignore_ascii_case("bearer")
            || self.access_token.is_empty()
            || self.refresh_token.is_empty()
            || self.expires_in == 0
            || self.expires_in > 86_400
        {
            return Err(ProviderError::protocol());
        }
        let id_token = self
            .id_token
            .or_else(|| previous_id_token.map(str::to_string))
            .filter(|s| !s.is_empty())
            .ok_or_else(ProviderError::protocol)?;
        Ok(Credentials {
            access_token: self.access_token,
            refresh_token: self.refresh_token,
            id_token,
            expires_at: now().saturating_add(self.expires_in),
            earliest_refresh_at: self.earliest_refresh_at,
            scopes,
        })
    }
}

const SIGN_IN_WAIT: Duration = Duration::from_secs(30 * 60);

async fn wait_for_callback(
    receiver: oneshot::Receiver<Result<Callback>>,
    cancel: &CancellationToken,
) -> Result<Callback> {
    tokio::select! {
        biased;
        _ = cancel.cancelled() => Err(ProviderError::cancelled()),
        result = tokio::time::timeout(SIGN_IN_WAIT, receiver) => {
            result.map_err(|_| ProviderError::new("timeout", "Sign-in expired after 30 minutes. Start again with Continue with ChatGPT and keep Polar Settings open."))?
                .map_err(|_| ProviderError::protocol())?
        }
    }
}

pub async fn sign_in(
    app: &tauri::AppHandle,
    client: &reqwest::Client,
    host_id: &str,
    previous: Option<&Registration>,
    cancel: CancellationToken,
) -> Result<Registration> {
    let mut issued_client = previous.map(|r| r.client_id.clone());
    for attempt in 0..2 {
        let result = sign_in_attempt(
            app,
            client,
            host_id,
            previous,
            &mut issued_client,
            cancel.clone(),
        )
        .await;
        if attempt == 0
            && result
                .as_ref()
                .err()
                .is_some_and(|error| error.code == "reauth_required")
            && issued_client.is_some()
            && !cancel.is_cancelled()
        {
            // A spent/expired code needs a new authorization, while its issued
            // client registration must be retained instead of registering again.
            continue;
        }
        return result;
    }
    Err(ProviderError::protocol())
}

async fn sign_in_attempt(
    app: &tauri::AppHandle,
    client: &reqwest::Client,
    host_id: &str,
    previous: Option<&Registration>,
    issued_client: &mut Option<String>,
    cancel: CancellationToken,
) -> Result<Registration> {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|_| {
            ProviderError::new(
                "callback_unavailable",
                "Could not start the local sign-in listener. Try again.",
            )
        })?;
    let redirect_uri = format!(
        "http://127.0.0.1:{}/auth/callback",
        listener
            .local_addr()
            .map_err(|_| ProviderError::protocol())?
            .port()
    );
    let state = random_secret();
    let nonce = random_secret();
    let verifier = random_secret();
    let (sender, receiver) = oneshot::channel();
    let router = Router::new()
        .route("/auth/callback", get(callback))
        .with_state(Arc::new(CallbackState {
            state: state.clone(),
            client_id: issued_client.clone(),
            sender: Mutex::new(Some(sender)),
        }));
    let shutdown = CancellationToken::new();
    let shutdown_task = shutdown.clone();
    let server = tokio::spawn(async move {
        axum::serve(listener, router)
            .with_graceful_shutdown(shutdown_task.cancelled_owned())
            .await
    });
    let result = async {
        let mut url = url::Url::parse(AUTHORIZE).map_err(|_| ProviderError::protocol())?;
        {
            let mut query = url.query_pairs_mut();
            query.extend_pairs([
                ("client_id", issued_client.as_deref().unwrap_or("dynamic_agent_client")),
                ("ext_agent_host_id", host_id), ("response_type", "code"), ("redirect_uri", &redirect_uri),
                ("scope", SCOPES), ("resource", RESOURCE), ("state", &state), ("nonce", &nonce),
                ("code_challenge_method", "S256"), ("code_challenge", &challenge(&verifier)),
            ]);
            if let Some(previous) = previous {
                if let Some(credentials) = &previous.credentials { query.append_pair("id_token_hint", &credentials.id_token); }
                if !previous.email.is_empty() { query.append_pair("login_hint", &previous.email); }
            } else if issued_client.is_none() { query.append_pair("agent_name_hint", "Polar"); }
        }
        app.opener().open_url(url.as_str(), None::<&str>).map_err(|_|
            ProviderError::new("browser_unavailable", "Could not open your browser. Check your default browser and try again."))?;
        let callback = wait_for_callback(receiver, &cancel).await?;
        *issued_client = Some(callback.client_id.clone());
        let exchange = async {
            let response = client.post(TOKEN).form(&[
                ("grant_type", "authorization_code"), ("client_id", &callback.client_id),
                ("code", &callback.code), ("code_verifier", &verifier), ("redirect_uri", &redirect_uri), ("resource", RESOURCE),
            ]).send().await.map_err(|_| ProviderError::network())?;
            let token: TokenResponse = openai::json(response).await?;
            let config = discovery(client).await?;
            let keys: JwkSet = openai::json(client.get(config.jwks_uri).send().await.map_err(|_| ProviderError::network())?).await?;
            let (subject, email) = validate_identity(token.id_token.as_deref().ok_or_else(identity_error)?, &keys,
                &callback.client_id, &nonce, previous.map(|r| r.subject.as_str()))?;
            let credentials = token.credentials(None)?;
            Ok(Registration {
                id: previous.map_or_else(|| uuid::Uuid::new_v4().to_string(), |r| r.id.clone()),
                client_id: callback.client_id, subject, email, label: previous.map_or_else(String::new, |r| r.label.clone()),
                model: previous.and_then(|r| r.model.clone()), credentials: Some(credentials),
            })
        };
        tokio::select! { _ = cancel.cancelled() => Err(ProviderError::cancelled()), result = exchange => result }
    }.await;
    shutdown.cancel();
    // Abort after a short grace period so held-open browser connections cannot leak the listener.
    let mut server = server;
    if tokio::time::timeout(Duration::from_secs(1), &mut server)
        .await
        .is_err()
    {
        server.abort();
    }
    result
}

pub async fn refresh(client: &reqwest::Client, registration: &Registration) -> Result<Credentials> {
    let credentials = registration
        .credentials
        .as_ref()
        .ok_or_else(|| ProviderError::new("not_connected", "Reconnect this ChatGPT account."))?;
    let response = client
        .post(TOKEN)
        .form(&[
            ("grant_type", "refresh_token"),
            ("client_id", registration.client_id.as_str()),
            ("refresh_token", &credentials.refresh_token),
            ("resource", RESOURCE),
        ])
        .send()
        .await
        .map_err(|_| ProviderError::network())?;
    let tokens: TokenResponse = openai::json(response).await?;
    // The signed identity was established at authorization. Never replace it from refresh claims.
    tokens.credentials(Some(&credentials.id_token))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn forged_callbacks_leave_listener_ready_for_valid_callback() {
        let (sender, mut receiver) = oneshot::channel();
        let state = Arc::new(CallbackState {
            state: "pending-state".into(),
            client_id: None,
            sender: Mutex::new(Some(sender)),
        });
        let invalid = callback(
            State(state.clone()),
            RawQuery(Some(
                "state=forged&code=code&client_id=issued-client".into(),
            )),
        )
        .await;
        assert_eq!(invalid.0, StatusCode::BAD_REQUEST);
        assert!(matches!(
            receiver.try_recv(),
            Err(oneshot::error::TryRecvError::Empty)
        ));
        let valid = callback(
            State(state),
            RawQuery(Some(
                "state=pending-state&code=code&client_id=issued-client".into(),
            )),
        )
        .await;
        assert_eq!(valid.0, StatusCode::OK);
        let result = receiver.await.unwrap().unwrap();
        assert_eq!(result.client_id, "issued-client");
        assert_eq!(result.code, "code");
    }
    #[tokio::test(start_paused = true)]
    async fn callback_survives_slow_mfa_beyond_old_three_minute_timeout() {
        let (sender, receiver) = oneshot::channel();
        let cancel = CancellationToken::new();
        let waiting = tokio::spawn(async move { wait_for_callback(receiver, &cancel).await });
        tokio::task::yield_now().await;
        tokio::time::advance(Duration::from_secs(16 * 60)).await;
        assert!(!waiting.is_finished());
        assert!(sender
            .send(parse_callback(
                "state=s&code=test-code&client_id=issued-client",
                "s",
                None
            ))
            .is_ok());
        let result = waiting.await.unwrap().unwrap();
        assert_eq!(result.client_id, "issued-client");
    }
    #[tokio::test(start_paused = true)]
    async fn callback_wait_expires_at_limit_and_cancel_stops_it_immediately() {
        let (_sender, receiver) = oneshot::channel();
        let cancel = CancellationToken::new();
        let waiting = tokio::spawn(async move { wait_for_callback(receiver, &cancel).await });
        tokio::task::yield_now().await;
        tokio::time::advance(SIGN_IN_WAIT).await;
        assert_eq!(waiting.await.unwrap().err().unwrap().code, "timeout");
        let (_sender, receiver) = oneshot::channel();
        let cancel = CancellationToken::new();
        cancel.cancel();
        assert_eq!(
            wait_for_callback(receiver, &cancel)
                .await
                .err()
                .unwrap()
                .code,
            "cancelled"
        );
    }
    fn signed_token(mut claims: serde_json::Value) -> String {
        claims["iat"] = serde_json::json!(now());
        let mut header = jsonwebtoken::Header::new(Algorithm::RS256);
        header.kid = Some("polar-test".into());
        let key = jsonwebtoken::EncodingKey::from_rsa_pem(include_bytes!(
            "fixtures/test-rsa-private.pem"
        ))
        .unwrap();
        jsonwebtoken::encode(&header, &claims, &key).unwrap()
    }
    fn valid_claims() -> serde_json::Value {
        serde_json::json!({ "iss": ISSUER, "aud": "issued-client", "exp": now() + 300,
            "sub": "subject-a", "nonce": "pending-nonce", "email": "same@example.test" })
    }
    #[test]
    fn signed_identity_checks_signature_issuer_audience_expiry_nonce_and_subject() {
        let keys: JwkSet = serde_json::from_str(include_str!("fixtures/test-jwks.json")).unwrap();
        let token = signed_token(valid_claims());
        assert_eq!(
            validate_identity(
                &token,
                &keys,
                "issued-client",
                "pending-nonce",
                Some("subject-a")
            )
            .unwrap()
            .0,
            "subject-a"
        );
        for (field, value) in [
            ("iss", serde_json::json!("https://evil.example")),
            ("aud", serde_json::json!("another-client")),
            ("exp", serde_json::json!(now() - 120)),
            ("nonce", serde_json::json!("other-nonce")),
            ("sub", serde_json::json!("another-subject")),
        ] {
            let mut claims = valid_claims();
            claims[field] = value;
            assert!(
                validate_identity(
                    &signed_token(claims),
                    &keys,
                    "issued-client",
                    "pending-nonce",
                    Some("subject-a")
                )
                .is_err(),
                "{field}"
            );
        }
        let mut sections: Vec<String> = token.split('.').map(str::to_string).collect();
        sections[1] = URL_SAFE_NO_PAD
            .encode(serde_json::to_vec(&serde_json::json!({"sub":"attacker"})).unwrap());
        assert!(validate_identity(
            &sections.join("."),
            &keys,
            "issued-client",
            "pending-nonce",
            None
        )
        .is_err());
    }
    #[test]
    fn refresh_rotation_retains_identity_hint_and_replaces_secrets() {
        let token: TokenResponse = serde_json::from_value(serde_json::json!({"access_token":"new-access", "refresh_token":"new-refresh", "token_type":"Bearer", "expires_in":3600, "scope":"resource.invoke chatgpt.tokens.use.direct", "earliest_refresh_at": now() + 30})).unwrap();
        let credentials = token.credentials(Some("original-id-token")).unwrap();
        assert_eq!(credentials.refresh_token, "new-refresh");
        assert_eq!(credentials.id_token, "original-id-token");
        assert!(credentials.expires_at > now());
        assert!(credentials.earliest_refresh_at.is_some());
    }
    #[test]
    fn pkce_matches_rfc7636() {
        assert_eq!(
            challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }
    #[test]
    fn callback_requires_state_and_issued_client() {
        assert_eq!(
            parse_callback("state=wrong&code=c&client_id=oaiapp_a", "state", None)
                .err()
                .unwrap()
                .code,
            "invalid_state"
        );
        for query in [
            "state=s&code=c",
            "state=s&code=c&client_id=dynamic_agent_client",
            "state=s&state=s&code=c&client_id=a",
        ] {
            assert!(parse_callback(query, "s", None).is_err());
        }
        let callback =
            parse_callback("state=s&code=hello%2Bworld&client_id=oaiapp_a", "s", None).unwrap();
        assert_eq!(callback.code, "hello+world");
        assert_eq!(callback.client_id, "oaiapp_a");
    }
    #[test]
    fn returning_callback_cannot_switch_client_or_ignore_denial() {
        assert!(parse_callback("state=s&code=c&client_id=other", "s", Some("saved")).is_err());
        assert_eq!(
            parse_callback("state=s&code=c", "s", Some("saved"))
                .unwrap()
                .client_id,
            "saved"
        );
        assert_eq!(
            parse_callback("state=s&error=access_denied&code=c", "s", None)
                .err()
                .unwrap()
                .code,
            "access_denied"
        );
    }
    #[test]
    fn missing_plan_scope_is_not_connected() {
        let token: TokenResponse = serde_json::from_value(serde_json::json!({"access_token":"a", "refresh_token":"r", "id_token":"i", "token_type":"Bearer", "expires_in":3600, "scope":"openid profile email"})).unwrap();
        assert_eq!(
            token.credentials(None).err().unwrap().code,
            "plan_permission"
        );
    }
    #[test]
    fn discovery_urls_cannot_redirect_credentials() {
        assert!(trusted_auth_url("https://auth.openai.com/oauth/revoke"));
        for url in [
            "http://auth.openai.com/key",
            "https://auth.openai.com.evil.test/key",
            "https://user@auth.openai.com/key",
            "https://auth.openai.com:444/key",
        ] {
            assert!(!trusted_auth_url(url));
        }
    }
}
