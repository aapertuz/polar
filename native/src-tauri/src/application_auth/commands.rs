use super::{store, types::*};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;
use tokio_util::sync::CancellationToken;

const DESKTOP_LABEL: &str = "This Polar desktop";

pub(crate) struct InternalSession {
    pub access_token: String,
    pub device_id: String,
    pub polar_user_id: String,
}

pub(crate) async fn internal_session(state: &ApplicationAuthState) -> Result<InternalSession> {
    let (guard, cancel) = state.begin_serialized().await?;
    let (_guard, vault) = store::load(guard, &cancel, &state.credential_scope).await?;
    let session = vault.session.ok_or_else(|| {
        AuthError::new(
            "not_signed_in",
            "Sign in to Polar before creating a mission.",
        )
    })?;
    Ok(InternalSession {
        access_token: session.access_token,
        device_id: vault.device_id,
        polar_user_id: session.polar_user_id,
    })
}

#[derive(Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    verification_uri_complete: Option<String>,
    expires_in: u64,
    interval: Option<u64>,
}

#[derive(Deserialize)]
struct DeviceTokenResponse {
    access_token: String,
    expires_in: Option<u64>,
}

#[derive(Deserialize)]
struct DeviceTokenError {
    error: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BootstrapResponse {
    user: BootstrapUser,
    workspaces: Vec<WorkspaceSummary>,
    default_workspace_id: Option<String>,
}

#[derive(Clone, Deserialize)]
struct BootstrapUser {
    id: String,
    email: String,
    name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeviceRegistrationResponse {
    id: String,
    label: String,
    created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DeviceRegistrationRequest<'a> {
    device_id: &'a str,
    label: &'a str,
}

fn handle_device_error(error: &str, interval: &mut Duration) -> Result<()> {
    match error {
        "authorization_pending" => Ok(()),
        "slow_down" => {
            *interval = (*interval + Duration::from_secs(5)).min(Duration::from_secs(60));
            Ok(())
        }
        "access_denied" => Err(AuthError::new(
            "denied",
            "You denied Polar desktop sign-in.",
        )),
        "expired_token" => Err(AuthError::new(
            "expired",
            "Polar sign-in expired. Start again to receive a new code.",
        )),
        _ => Err(AuthError::new(
            "sign_in_failed",
            "Polar could not complete sign-in. Start again and retry.",
        )),
    }
}

async fn revoke_remote_session(state: &ApplicationAuthState, token: &str) -> bool {
    let Ok(url) = endpoint(state, "api/auth/sign-out") else {
        return false;
    };
    state
        .client
        .post(url)
        .bearer_auth(token)
        .send()
        .await
        .map(|response| response.status().is_success())
        .unwrap_or(false)
}

fn clear_session(vault: &mut AuthVault) {
    vault.session = None;
}

fn endpoint(state: &ApplicationAuthState, path: &str) -> Result<url::Url> {
    state
        .api_url
        .join(path)
        .map_err(|_| AuthError::new("configuration", "Polar server URL is invalid."))
}

fn checked_verification_url(
    state: &ApplicationAuthState,
    code: &DeviceCodeResponse,
) -> Result<url::Url> {
    let raw = code
        .verification_uri_complete
        .as_deref()
        .unwrap_or(&code.verification_uri);
    let mut url = url::Url::parse(raw)
        .or_else(|_| state.api_url.join(raw))
        .map_err(|_| {
            AuthError::new(
                "invalid_response",
                "Polar returned an invalid sign-in link.",
            )
        })?;
    if url.scheme() != state.api_url.scheme()
        || url.host_str() != state.api_url.host_str()
        || url.port_or_known_default() != state.api_url.port_or_known_default()
        || url.username() != ""
        || url.password().is_some()
        || url.path() != "/device"
    {
        return Err(AuthError::new(
            "invalid_response",
            "Polar returned an unsafe sign-in link.",
        ));
    }
    let query_code = url
        .query_pairs()
        .find(|(key, _)| key == "user_code")
        .map(|(_, value)| value.into_owned());
    if query_code
        .as_deref()
        .is_some_and(|value| value != code.user_code)
    {
        return Err(AuthError::new(
            "invalid_response",
            "Polar returned an invalid sign-in code.",
        ));
    }
    if query_code.is_none() {
        url.query_pairs_mut()
            .append_pair("user_code", &code.user_code);
    }
    Ok(url)
}

async fn get_bootstrap(
    state: &ApplicationAuthState,
    token: &str,
    cancel: &CancellationToken,
) -> Result<BootstrapResponse> {
    let url = endpoint(state, "api/app/bootstrap")?;
    let request = state.client.get(url).bearer_auth(token).send();
    let response = tokio::select! {
        biased;
        _ = cancel.cancelled() => return Err(AuthError::cancelled()),
        response = request => response.map_err(|_| AuthError::network())?,
    };
    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err(AuthError::new(
            "session_invalid",
            "Your Polar sign-in expired or was revoked. Sign in again.",
        ));
    }
    if response.status() == reqwest::StatusCode::FORBIDDEN {
        return Err(AuthError::new(
            "membership_required",
            "Your Polar account no longer has access to this workspace.",
        ));
    }
    if !response.status().is_success() {
        return Err(AuthError::new(
            "server_unavailable",
            "Polar could not load your account. Retry shortly.",
        ));
    }
    let account: BootstrapResponse = response.json().await.map_err(|_| {
        AuthError::new(
            "invalid_response",
            "Polar returned an invalid account response.",
        )
    })?;
    if uuid::Uuid::parse_str(&account.user.id).is_err()
        || account.user.email.chars().count() > 320
        || !account.user.email.contains('@')
        || account.user.name.trim().is_empty()
        || account.user.name.chars().count() > 120
        || account.workspaces.len() > 500
        || account.workspaces.iter().any(|workspace| {
            uuid::Uuid::parse_str(&workspace.id).is_err()
                || workspace.name.trim().is_empty()
                || workspace.name.chars().count() > 120
                || !matches!(workspace.privacy.as_str(), "private" | "shared")
                || !matches!(workspace.role.as_str(), "owner" | "member")
                || workspace.created_at.is_empty()
                || workspace.created_at.len() > 64
        })
        || account
            .default_workspace_id
            .as_ref()
            .is_some_and(|default_id| {
                !account
                    .workspaces
                    .iter()
                    .any(|workspace| &workspace.id == default_id)
            })
    {
        return Err(AuthError::new(
            "invalid_response",
            "Polar returned an invalid account response.",
        ));
    }
    Ok(account)
}

fn update_session_from_bootstrap(
    session: &mut SessionCredential,
    account: &BootstrapResponse,
    requested_selection: Option<&str>,
) {
    let selected = requested_selection
        .and_then(|id| {
            account
                .workspaces
                .iter()
                .find(|workspace| workspace.id == id)
        })
        .or_else(|| {
            account.default_workspace_id.as_ref().and_then(|id| {
                account
                    .workspaces
                    .iter()
                    .find(|workspace| &workspace.id == id)
            })
        })
        .or_else(|| account.workspaces.first());
    session.email = account.user.email.clone();
    session.polar_user_id = account.user.id.clone();
    session.workspace_id = selected.map(|workspace| workspace.id.clone());
    session.workspace_name = selected.map(|workspace| workspace.name.clone());
    session.workspace_privacy = selected.map(|workspace| workspace.privacy.clone());
    session.workspaces = account.workspaces.clone();
    session.default_workspace_id = account.default_workspace_id.clone();
}

async fn register_device(
    state: &ApplicationAuthState,
    token: &str,
    device_id: &str,
    cancel: &CancellationToken,
) -> Result<()> {
    let url = endpoint(state, "api/app/devices")?;
    let request = state
        .client
        .post(url)
        .bearer_auth(token)
        .json(&DeviceRegistrationRequest {
            device_id,
            label: DESKTOP_LABEL,
        })
        .send();
    let response = tokio::select! {
        biased;
        _ = cancel.cancelled() => return Err(AuthError::cancelled()),
        response = request => response.map_err(|_| AuthError::network())?,
    };
    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err(AuthError::new(
            "session_invalid",
            "Your Polar sign-in expired or was revoked. Sign in again.",
        ));
    }
    if response.status() == reqwest::StatusCode::FORBIDDEN {
        return Err(AuthError::new(
            "membership_required",
            "Your Polar account no longer has access to this workspace.",
        ));
    }
    if !response.status().is_success() {
        return Err(AuthError::new(
            "device_registration",
            "Polar could not register this desktop. Retry shortly.",
        ));
    }
    let registered: DeviceRegistrationResponse = response.json().await.map_err(|_| {
        AuthError::new(
            "invalid_response",
            "Polar returned an invalid device registration response.",
        )
    })?;
    if uuid::Uuid::parse_str(&registered.id).is_err()
        || registered.label.is_empty()
        || registered.label.len() > 80
        || !registered.created_at.ends_with('Z')
    {
        return Err(AuthError::new(
            "invalid_response",
            "Polar returned an invalid device registration response.",
        ));
    }
    Ok(())
}

async fn poll_for_token(
    state: &ApplicationAuthState,
    device: &DeviceCodeResponse,
    cancel: &CancellationToken,
) -> Result<DeviceTokenResponse> {
    let url = endpoint(state, "api/auth/device/token")?;
    let expires = Duration::from_secs(device.expires_in.clamp(1, 1800));
    let deadline = tokio::time::Instant::now() + expires;
    let mut interval = Duration::from_secs(device.interval.unwrap_or(5).clamp(1, 30));
    loop {
        tokio::select! {
            biased;
            _ = cancel.cancelled() => return Err(AuthError::cancelled()),
            _ = tokio::time::sleep_until(deadline) => return Err(AuthError::new("expired", "Polar sign-in expired. Start again to receive a new code.")),
            _ = tokio::time::sleep(interval) => {}
        }
        let request = state
            .client
            .post(url.clone())
            .json(&serde_json::json!({
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": device.device_code,
                "client_id": state.client_id,
            }))
            .send();
        let response = tokio::select! {
            biased;
            _ = cancel.cancelled() => return Err(AuthError::cancelled()),
            response = request => response.map_err(|_| AuthError::network())?,
        };
        if response.status().is_success() {
            let token: DeviceTokenResponse = response.json().await.map_err(|_| {
                AuthError::new(
                    "invalid_response",
                    "Polar returned an invalid session response.",
                )
            })?;
            if token.access_token.is_empty() || token.access_token.len() > 4096 {
                return Err(AuthError::new(
                    "invalid_response",
                    "Polar returned an invalid session response.",
                ));
            }
            return Ok(token);
        }
        let failure: DeviceTokenError = response.json().await.map_err(|_| {
            AuthError::new(
                "invalid_response",
                "Polar returned an invalid sign-in response.",
            )
        })?;
        handle_device_error(&failure.error, &mut interval)?;
    }
}

fn set_progress(state: &ApplicationAuthState, status: AuthStatus) {
    if let Ok(mut progress) = state.progress.lock() {
        *progress = status;
    }
}

#[tauri::command]
pub async fn polar_auth_status(state: State<'_, ApplicationAuthState>) -> Result<AuthStatus> {
    let active_operation = {
        let progress = state.progress.lock().map_err(|_| AuthError::network())?;
        progress.operation.is_some().then(|| progress.clone())
    };
    if let Some(progress) = active_operation {
        return Ok(progress);
    }
    let (guard, cancel) = state.begin()?;
    let (_guard, mut vault) = store::load(guard, &cancel, &state.credential_scope).await?;
    let Some(saved) = vault.session.as_ref().cloned() else {
        return Ok(AuthStatus::empty());
    };
    let restored: Result<BootstrapResponse> = async {
        let account = get_bootstrap(&state, &saved.access_token, &cancel).await?;
        register_device(&state, &saved.access_token, &vault.device_id, &cancel).await?;
        Ok(account)
    }
    .await;
    match restored {
        Ok(account) => {
            if let Some(credential) = vault.session.as_mut() {
                let previous_selection = credential.workspace_id.clone();
                update_session_from_bootstrap(credential, &account, previous_selection.as_deref());
            }
            state.commit_if_active(&cancel, || store::save(&state.credential_scope, &vault))?;
            Ok(AuthStatus::from_session(
                vault.session.as_ref().ok_or_else(AuthError::storage)?,
            ))
        }
        Err(error) if error.code == "session_invalid" => {
            clear_session(&mut vault);
            state.commit_if_active(&cancel, || store::save(&state.credential_scope, &vault))?;
            Ok(AuthStatus {
                message: Some(error.message),
                ..AuthStatus::empty()
            })
        }
        Err(error) => {
            let mut status = AuthStatus::from_session(&saved);
            status.message = Some(error.message);
            Ok(status)
        }
    }
}

#[tauri::command]
pub async fn polar_auth_connect(
    app: AppHandle,
    state: State<'_, ApplicationAuthState>,
) -> Result<AuthStatus> {
    let (operation_guard, cancel) = state.begin()?;
    set_progress(
        &state,
        AuthStatus {
            operation: Some("connecting".into()),
            message: Some("Requesting a secure Polar sign-in code…".into()),
            ..AuthStatus::empty()
        },
    );
    let result = async {
        let (_operation_guard, mut vault) = store::load(operation_guard, &cancel, &state.credential_scope).await?;
        let url = endpoint(&state, "api/auth/device/code")?;
        let response = tokio::select! {
            biased;
            _ = cancel.cancelled() => return Err(AuthError::cancelled()),
            response = state.client.post(url).json(&serde_json::json!({
                "client_id": state.client_id,
            })).send() => response.map_err(|_| AuthError::network())?,
        };
        if !response.status().is_success() {
            return Err(AuthError::new("sign_in_failed", "Polar could not start sign-in. Check the server configuration and retry."));
        }
        let device: DeviceCodeResponse = response.json().await
            .map_err(|_| AuthError::new("invalid_response", "Polar returned an invalid sign-in code."))?;
        if device.device_code.is_empty() || device.device_code.len() > 191 || device.user_code.is_empty() || device.user_code.len() > 191 {
            return Err(AuthError::new("invalid_response", "Polar returned an invalid sign-in code."));
        }
        if cancel.is_cancelled() {
            return Err(AuthError::cancelled());
        }
        let verification_url = checked_verification_url(&state, &device)?;
        set_progress(&state, AuthStatus {
            operation: Some("connecting".into()),
            user_code: Some(device.user_code.clone()),
            verification_url: Some(verification_url.to_string()),
            message: Some("Finish signing in through your browser. Confirm the same code there.".into()),
            ..AuthStatus::empty()
        });
        if app.opener().open_url(verification_url.as_str(), None::<&str>).is_err() {
            set_progress(&state, AuthStatus {
                operation: Some("connecting".into()),
                user_code: Some(device.user_code.clone()),
                verification_url: Some(verification_url.to_string()),
                message: Some("Could not open your browser. Use the verification link below, then approve the matching code.".into()),
                ..AuthStatus::empty()
            });
        }

        let token = poll_for_token(&state, &device, &cancel).await?;
        if cancel.is_cancelled() { return Err(AuthError::cancelled()); }
        let account = get_bootstrap(&state, &token.access_token, &cancel).await?;
        register_device(&state, &token.access_token, &vault.device_id, &cancel).await?;
        if cancel.is_cancelled() { return Err(AuthError::cancelled()); }
        let mut session = SessionCredential {
            access_token: token.access_token,
            email: account.user.email.clone(),
            polar_user_id: account.user.id.clone(),
            workspace_id: None,
            workspace_name: None,
            workspace_privacy: None,
            workspaces: Vec::new(),
            default_workspace_id: None,
            expires_at: now() + token.expires_in.unwrap_or(60 * 60 * 24 * 30),
        };
        update_session_from_bootstrap(&mut session, &account, None);
        vault.session = Some(session);
        state.commit_if_active(&cancel, || store::save(&state.credential_scope, &vault))?;
        Ok(AuthStatus::from_session(vault.session.as_ref().ok_or_else(AuthError::storage)?))
    }.await;
    set_progress(&state, AuthStatus::empty());
    result
}

#[tauri::command]
pub fn polar_auth_cancel(state: State<'_, ApplicationAuthState>) -> Result<()> {
    state.cancel()?;
    set_progress(&state, AuthStatus::empty());
    Ok(())
}

#[tauri::command]
pub async fn polar_auth_sign_out(state: State<'_, ApplicationAuthState>) -> Result<SignOutResult> {
    let (guard, cancel) = state.begin_disconnect().await?;
    let (_guard, mut vault) = store::load(guard, &cancel, &state.credential_scope).await?;
    let session = vault.session.take();
    store::save(&state.credential_scope, &vault)?;
    set_progress(&state, AuthStatus::empty());
    let remote_revocation_confirmed = if let Some(session) = session {
        revoke_remote_session(&state, &session.access_token).await
    } else {
        true
    };
    Ok(SignOutResult {
        remote_revocation_confirmed,
        status: AuthStatus::empty(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{http::StatusCode, routing::get, Json, Router};
    use serde_json::{json, Value};

    async fn mock_server(
        status: StatusCode,
        body: Value,
    ) -> (url::Url, tokio::task::JoinHandle<()>) {
        let route = Router::new().route(
            "/api/app/bootstrap",
            get(move || async move { (status, Json(body)) }),
        );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let task = tokio::spawn(async move {
            axum::serve(listener, route).await.unwrap();
        });
        (url::Url::parse(&format!("http://{address}")).unwrap(), task)
    }

    #[test]
    fn device_registration_decodes_the_shared_camel_case_contract() {
        let response: DeviceRegistrationResponse = serde_json::from_value(json!({
            "id": uuid::Uuid::new_v4().to_string(),
            "label": "This Polar desktop",
            "createdAt": "2026-10-08T00:00:00.000Z"
        }))
        .unwrap();
        assert_eq!(response.created_at, "2026-10-08T00:00:00.000Z");
    }

    #[test]
    fn bootstrap_restoration_preserves_selection_then_uses_default_then_oldest() {
        let owner = WorkspaceSummary {
            id: uuid::Uuid::new_v4().to_string(),
            name: "First".into(),
            privacy: "private".into(),
            role: "owner".into(),
            created_at: "2026-10-10T00:00:00.000Z".into(),
        };
        let shared = WorkspaceSummary {
            id: uuid::Uuid::new_v4().to_string(),
            name: "Second".into(),
            privacy: "shared".into(),
            role: "member".into(),
            created_at: "2026-10-11T00:00:00.000Z".into(),
        };
        let account = BootstrapResponse {
            user: BootstrapUser {
                id: uuid::Uuid::new_v4().to_string(),
                email: "person@example.test".into(),
                name: "Person".into(),
            },
            workspaces: vec![owner.clone(), shared.clone()],
            default_workspace_id: Some(owner.id.clone()),
        };
        let mut session = SessionCredential {
            access_token: "private-token".into(),
            email: "old@example.test".into(),
            polar_user_id: account.user.id.clone(),
            workspace_id: Some(shared.id.clone()),
            workspace_name: Some(shared.name.clone()),
            workspace_privacy: Some(shared.privacy.clone()),
            workspaces: Vec::new(),
            default_workspace_id: None,
            expires_at: now() + 3600,
        };

        update_session_from_bootstrap(&mut session, &account, Some(&shared.id));
        assert_eq!(session.workspace_id.as_deref(), Some(shared.id.as_str()));
        update_session_from_bootstrap(&mut session, &account, Some("revoked-membership"));
        assert_eq!(session.workspace_id.as_deref(), Some(owner.id.as_str()));
        let empty = BootstrapResponse {
            workspaces: Vec::new(),
            default_workspace_id: None,
            ..account
        };
        update_session_from_bootstrap(&mut session, &empty, Some(&owner.id));
        assert_eq!(session.workspace_id, None);
        assert_eq!(session.workspace_name, None);
    }

    #[test]
    fn polling_errors_preserve_backoff_and_surface_denial_or_expiry() {
        let mut interval = Duration::from_secs(5);
        assert!(handle_device_error("authorization_pending", &mut interval).is_ok());
        assert_eq!(interval, Duration::from_secs(5));
        assert!(handle_device_error("slow_down", &mut interval).is_ok());
        assert_eq!(interval, Duration::from_secs(10));
        assert_eq!(
            handle_device_error("access_denied", &mut interval)
                .unwrap_err()
                .code,
            "denied"
        );
        assert_eq!(
            handle_device_error("expired_token", &mut interval)
                .unwrap_err()
                .code,
            "expired"
        );
        assert_eq!(
            handle_device_error("invalid_grant", &mut interval)
                .unwrap_err()
                .code,
            "sign_in_failed"
        );
    }

    #[tokio::test]
    async fn bootstrap_rejects_revoked_sessions_and_keeps_transient_failures_distinct() {
        let (mut state, cancel) = test_state();
        let (base, server) =
            mock_server(StatusCode::UNAUTHORIZED, json!({"error":"UNAUTHENTICATED"})).await;
        state.api_url = base;
        assert_eq!(
            get_bootstrap(&state, "opaque-token", &cancel)
                .await
                .err()
                .unwrap()
                .code,
            "session_invalid"
        );
        server.abort();

        let (base, server) = mock_server(
            StatusCode::FORBIDDEN,
            json!({"error":"WORKSPACE_ACCESS_REQUIRED"}),
        )
        .await;
        state.api_url = base;
        assert_eq!(
            get_bootstrap(&state, "opaque-token", &cancel)
                .await
                .err()
                .unwrap()
                .code,
            "membership_required"
        );
        server.abort();

        let (base, server) = mock_server(
            StatusCode::SERVICE_UNAVAILABLE,
            json!({"error":"unavailable"}),
        )
        .await;
        state.api_url = base;
        assert_eq!(
            get_bootstrap(&state, "opaque-token", &cancel)
                .await
                .err()
                .unwrap()
                .code,
            "server_unavailable"
        );
        server.abort();

        let (base, server) = mock_server(StatusCode::OK, json!({
            "user":{"id":uuid::Uuid::new_v4().to_string(),"email":"person@example.test","name":"Person"},
            "workspaces":[],
            "defaultWorkspaceId":null
        })).await;
        state.api_url = base;
        let account = get_bootstrap(&state, "opaque-token", &cancel)
            .await
            .unwrap();
        assert_eq!(account.user.email, "person@example.test");
        assert!(account.workspaces.is_empty());
        assert_eq!(account.default_workspace_id, None);
        server.abort();
    }

    #[tokio::test]
    async fn device_poll_honors_cancellation_and_code_expiry() {
        let (state, cancel) = test_state();
        let device = DeviceCodeResponse {
            device_code: "private-device-code".into(),
            user_code: "PUBLIC42".into(),
            verification_uri: "http://127.0.0.1:3000/device".into(),
            verification_uri_complete: None,
            expires_in: 30,
            interval: Some(30),
        };
        {
            let cancel_poll = poll_for_token(&state, &device, &cancel);
            tokio::pin!(cancel_poll);
            let signal = cancel.clone();
            tokio::spawn(async move {
                tokio::time::sleep(Duration::from_millis(10)).await;
                signal.cancel();
            });
            assert_eq!(cancel_poll.as_mut().await.err().unwrap().code, "cancelled");
        }

        let (_state, cancel) = test_state();
        let expired = DeviceCodeResponse {
            expires_in: 1,
            ..device
        };
        assert_eq!(
            poll_for_token(&_state, &expired, &cancel)
                .await
                .err()
                .unwrap()
                .code,
            "expired"
        );
    }

    #[tokio::test]
    async fn cancellation_and_process_lock_serialize_account_operations() {
        let directory = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        std::fs::create_dir_all(&directory).unwrap();
        let first = ApplicationAuthState::new(directory.clone()).unwrap();
        let second = ApplicationAuthState::new(directory.clone()).unwrap();
        let shared_lock = directory.join("shared.lock");
        let first = ApplicationAuthState {
            lock_path: shared_lock.clone(),
            ..first
        };
        let second = ApplicationAuthState {
            lock_path: shared_lock,
            ..second
        };
        let (guard, cancel) = first.begin().unwrap();
        assert_eq!(second.begin().err().unwrap().code, "busy");
        first.cancel().unwrap();
        assert!(cancel.is_cancelled());
        drop(guard);
        let (guard, fresh) = second.begin().unwrap();
        assert!(!fresh.is_cancelled());
        drop(guard);
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn sign_out_clears_local_session_even_without_remote_confirmation() {
        let mut vault = AuthVault {
            version: 1,
            device_id: uuid::Uuid::new_v4().to_string(),
            session: Some(SessionCredential {
                access_token: "opaque-private-token".into(),
                email: "person@example.test".into(),
                polar_user_id: uuid::Uuid::new_v4().to_string(),
                workspace_id: None,
                workspace_name: None,
                workspace_privacy: None,
                workspaces: Vec::new(),
                default_workspace_id: None,
                expires_at: now() + 60,
            }),
        };
        clear_session(&mut vault);
        assert!(vault.session.is_none());
        assert!(!serde_json::to_string(&AuthStatus::empty())
            .unwrap()
            .contains("opaque-private-token"));
    }

    #[test]
    fn cancellation_after_browser_approval_cannot_commit_a_new_session() {
        let (state, _) = test_state();
        let (_guard, cancel) = state.begin().unwrap();
        let previous = SessionCredential {
            access_token: "existing-session".into(),
            email: "old@example.test".into(),
            polar_user_id: uuid::Uuid::new_v4().to_string(),
            workspace_id: Some(uuid::Uuid::new_v4().to_string()),
            workspace_name: Some("Old workspace".into()),
            workspace_privacy: Some("private".into()),
            workspaces: Vec::new(),
            default_workspace_id: None,
            expires_at: now() + 3600,
        };
        let proposed = SessionCredential {
            access_token: "late-approved-session".into(),
            email: "new@example.test".into(),
            polar_user_id: uuid::Uuid::new_v4().to_string(),
            workspace_id: Some(uuid::Uuid::new_v4().to_string()),
            workspace_name: Some("New workspace".into()),
            workspace_privacy: Some("private".into()),
            workspaces: Vec::new(),
            default_workspace_id: None,
            expires_at: now() + 3600,
        };
        let mut vault = AuthVault {
            version: 1,
            device_id: uuid::Uuid::new_v4().to_string(),
            session: Some(previous),
        };
        state.cancel().unwrap();
        let result = state.commit_if_active(&cancel, || {
            vault.session = Some(proposed);
            Ok(())
        });
        assert_eq!(result.err().unwrap().code, "cancelled");
        assert_eq!(vault.session.as_ref().unwrap().email, "old@example.test");
    }

    #[test]
    fn verification_links_must_remain_on_the_configured_polar_origin() {
        let (state, _) = test_state();
        let valid = DeviceCodeResponse {
            device_code: "private-device-code".into(),
            user_code: "PUBLIC42".into(),
            verification_uri: "http://127.0.0.1:3000/device".into(),
            verification_uri_complete: None,
            expires_in: 600,
            interval: Some(5),
        };
        let checked = checked_verification_url(&state, &valid).unwrap();
        assert_eq!(
            checked
                .query_pairs()
                .find(|(key, _)| key == "user_code")
                .unwrap()
                .1,
            "PUBLIC42"
        );
        let invalid = DeviceCodeResponse {
            verification_uri: "https://phishing.example/device".into(),
            ..valid
        };
        assert_eq!(
            checked_verification_url(&state, &invalid)
                .err()
                .unwrap()
                .code,
            "invalid_response"
        );
    }

    fn test_state() -> (ApplicationAuthState, CancellationToken) {
        let directory = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        std::fs::create_dir_all(&directory).unwrap();
        let state = ApplicationAuthState::new(directory).unwrap();
        (state, CancellationToken::new())
    }
}
