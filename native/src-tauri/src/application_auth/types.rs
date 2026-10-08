use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::{Arc, Mutex};
use tokio::sync::{Mutex as AsyncMutex, OwnedMutexGuard};
use tokio_util::sync::CancellationToken;

pub type Result<T> = std::result::Result<T, AuthError>;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthError {
    pub code: String,
    pub message: String,
}

impl AuthError {
    pub fn new(code: &str, message: &str) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
    pub fn cancelled() -> Self {
        Self::new("cancelled", "Polar account sign-in was cancelled.")
    }
    pub fn storage() -> Self {
        Self::new("credential_store", "Could not access secure storage for your Polar account. Unlock your keychain or credential service, then retry.")
    }
    pub fn network() -> Self {
        Self::new(
            "network",
            "Could not reach Polar. Check your connection and retry.",
        )
    }
}

impl std::fmt::Display for AuthError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}: {}", self.code, self.message)
    }
}
impl std::error::Error for AuthError {}

#[derive(Serialize, Deserialize)]
pub struct AuthVault {
    pub version: u32,
    pub device_id: String,
    pub session: Option<SessionCredential>,
}

#[derive(Serialize, Deserialize)]
pub struct SessionCredential {
    pub access_token: String,
    pub email: String,
    pub polar_user_id: String,
    pub workspace_id: String,
    pub workspace_name: String,
    pub expires_at: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
    pub authenticated: bool,
    pub email: Option<String>,
    pub workspace_name: Option<String>,
    pub operation: Option<String>,
    pub user_code: Option<String>,
    pub verification_url: Option<String>,
    pub message: Option<String>,
}

impl AuthStatus {
    pub fn empty() -> Self {
        Self {
            authenticated: false,
            email: None,
            workspace_name: None,
            operation: None,
            user_code: None,
            verification_url: None,
            message: None,
        }
    }
    pub fn from_session(session: &SessionCredential) -> Self {
        Self {
            authenticated: true,
            email: Some(session.email.clone()),
            workspace_name: Some(session.workspace_name.clone()),
            operation: None,
            user_code: None,
            verification_url: None,
            message: None,
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignOutResult {
    pub remote_revocation_confirmed: bool,
    pub status: AuthStatus,
}

pub struct OperationGuard {
    pub _local: OwnedMutexGuard<()>,
    pub _process: Option<std::fs::File>,
}

pub struct ApplicationAuthState {
    pub gate: Arc<AsyncMutex<()>>,
    pub cancellation: Mutex<Option<CancellationToken>>,
    pub progress: Mutex<AuthStatus>,
    pub lock_path: std::path::PathBuf,
    pub api_url: url::Url,
    pub client_id: String,
    pub client: reqwest::Client,
    pub credential_scope: String,
}

impl ApplicationAuthState {
    pub fn new(app_data: std::path::PathBuf) -> Result<Self> {
        let environment = option_env!("POLAR_ENV").unwrap_or(if cfg!(debug_assertions) {
            "development"
        } else {
            "production"
        });
        Self::configured(app_data, environment, option_env!("POLAR_API_BASE_URL"))
    }

    fn configured(
        app_data: std::path::PathBuf,
        environment: &str,
        api_url: Option<&str>,
    ) -> Result<Self> {
        if !matches!(environment, "development" | "production") {
            return Err(AuthError::new(
                "configuration",
                "POLAR_ENV must be development or production.",
            ));
        }
        let api_url = match (api_url, environment) {
            (Some(value), _) => value,
            (None, "development") => "http://127.0.0.1:3000",
            _ => {
                return Err(AuthError::new(
                    "configuration",
                    "Production requires POLAR_API_BASE_URL.",
                ))
            }
        };
        let api_url = url::Url::parse(api_url)
            .map_err(|_| AuthError::new("configuration", "Polar server URL is invalid."))?;
        if !matches!(api_url.scheme(), "http" | "https")
            || api_url.host_str().is_none()
            || api_url.path() != "/"
            || !api_url.username().is_empty()
            || api_url.password().is_some()
            || api_url.query().is_some()
            || api_url.fragment().is_some()
        {
            return Err(AuthError::new(
                "configuration",
                "Polar server URL must use HTTP or HTTPS.",
            ));
        }
        if api_url.scheme() == "http"
            && (environment == "production"
                || !matches!(api_url.host_str(), Some("localhost" | "127.0.0.1" | "::1")))
        {
            return Err(AuthError::new(
                "configuration",
                "Polar account sign-in requires HTTPS outside local development.",
            ));
        }
        let client_id = option_env!("POLAR_DESKTOP_CLIENT_ID")
            .unwrap_or(if environment == "development" {
                "com.antoniopertuz.polar.desktop.development"
            } else {
                "com.antoniopertuz.polar.desktop"
            })
            .to_string();
        let credential_scope = credential_scope(environment, &api_url, &client_id);
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            "x-polar-environment",
            reqwest::header::HeaderValue::from_str(environment)
                .map_err(|_| AuthError::new("configuration", "Polar environment is invalid."))?,
        );
        Ok(Self {
            gate: Arc::new(AsyncMutex::new(())),
            cancellation: Mutex::new(None),
            progress: Mutex::new(AuthStatus::empty()),
            lock_path: app_data.join(format!("application-auth-{credential_scope}.lock")),
            api_url,
            client_id,
            credential_scope,
            client: reqwest::Client::builder()
                .default_headers(headers)
                .redirect(reqwest::redirect::Policy::none())
                .connect_timeout(std::time::Duration::from_secs(10))
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .map_err(|_| AuthError::network())?,
        })
    }

    fn finish_begin(
        &self,
        local: OwnedMutexGuard<()>,
    ) -> Result<(OperationGuard, CancellationToken)> {
        use std::fs::OpenOptions;
        let process = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(&self.lock_path)
            .map_err(|_| {
                AuthError::new(
                    "credential_lock",
                    "Could not lock Polar account credentials. Check app data permissions.",
                )
            })?;
        process.try_lock().map_err(|_| {
            AuthError::new(
                "busy",
                "Polar account credentials are in use by another app window. Try again shortly.",
            )
        })?;
        let cancel = CancellationToken::new();
        *self.cancellation.lock().map_err(|_| AuthError::network())? = Some(cancel.clone());
        Ok((
            OperationGuard {
                _local: local,
                _process: Some(process),
            },
            cancel,
        ))
    }

    pub fn begin(&self) -> Result<(OperationGuard, CancellationToken)> {
        let local = self.gate.clone().try_lock_owned().map_err(|_| {
            AuthError::new(
                "busy",
                "Wait for the current Polar account operation or cancel it.",
            )
        })?;
        self.finish_begin(local)
    }

    pub async fn begin_disconnect(&self) -> Result<(OperationGuard, CancellationToken)> {
        self.cancel()?;
        let local = self.gate.clone().lock_owned().await;
        self.finish_begin(local)
    }

    pub fn cancel(&self) -> Result<()> {
        if let Some(cancel) = self
            .cancellation
            .lock()
            .map_err(|_| AuthError::network())?
            .as_ref()
        {
            cancel.cancel();
        }
        Ok(())
    }

    pub fn commit_if_active<T>(
        &self,
        cancel: &CancellationToken,
        commit: impl FnOnce() -> Result<T>,
    ) -> Result<T> {
        let _cancellation_lock = self.cancellation.lock().map_err(|_| {
            AuthError::new(
                "credential_store",
                "Polar account operation state is unavailable.",
            )
        })?;
        if cancel.is_cancelled() {
            return Err(AuthError::cancelled());
        }
        commit()
    }
}

fn credential_scope(environment: &str, api_url: &url::Url, client_id: &str) -> String {
    let hash = Sha256::digest(format!("{environment}\n{api_url}\n{client_id}"));
    format!("polar-account-v2-{environment}-{hash:x}")
}

#[cfg(test)]
mod environment_tests {
    use super::*;

    #[test]
    fn credentials_and_device_locks_are_scoped_to_environment_origin_and_client() {
        let directory = std::path::PathBuf::from("/tmp/polar-environment-test");
        let dev = ApplicationAuthState::configured(directory.clone(), "development", None).unwrap();
        let prod = ApplicationAuthState::configured(
            directory.clone(),
            "production",
            Some("https://polar.example.test"),
        )
        .unwrap();
        let other = ApplicationAuthState::configured(
            directory,
            "development",
            Some("http://127.0.0.1:3001"),
        )
        .unwrap();
        assert_ne!(dev.credential_scope, prod.credential_scope);
        assert_ne!(dev.lock_path, prod.lock_path);
        assert_ne!(dev.credential_scope, other.credential_scope);
        assert_ne!(dev.credential_scope, "polar-account-v1");
        assert_eq!(
            dev.credential_scope,
            credential_scope("development", &dev.api_url, &dev.client_id)
        );
        assert_ne!(
            dev.credential_scope,
            credential_scope("development", &dev.api_url, "other-client")
        );
    }

    #[test]
    fn production_requires_an_explicit_https_origin() {
        for url in [
            None,
            Some("http://127.0.0.1:3000"),
            Some("http://polar.example.test"),
        ] {
            assert!(
                ApplicationAuthState::configured(std::path::PathBuf::new(), "production", url)
                    .is_err()
            );
        }
        assert!(
            ApplicationAuthState::configured(std::path::PathBuf::new(), "staging", None).is_err()
        );
    }

    #[tokio::test]
    async fn native_transport_sends_the_environment_header() {
        use axum::{http::HeaderMap, routing::get, Json, Router};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let origin = format!("http://{}", listener.local_addr().unwrap());
        let router = Router::new().route(
            "/",
            get(|headers: HeaderMap| async move {
                Json(
                    headers
                        .get("x-polar-environment")
                        .and_then(|value| value.to_str().ok())
                        .unwrap_or("")
                        .to_string(),
                )
            }),
        );
        let server = tokio::spawn(async move {
            axum::serve(listener, router).await.unwrap();
        });
        let state = ApplicationAuthState::configured(
            std::path::PathBuf::new(),
            "development",
            Some(&origin),
        )
        .unwrap();
        let response = state
            .client
            .get(state.api_url.clone())
            .send()
            .await
            .unwrap();
        let environment: String = response.json().await.unwrap();
        server.abort();
        assert_eq!(environment, "development");
    }
}

pub fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
