use serde::{Deserialize, Serialize};
use std::{
    fs::File,
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tokio::sync::{Mutex as AsyncMutex, OwnedMutexGuard};
use tokio_util::sync::CancellationToken;

pub const ISSUER: &str = "https://auth.openai.com";
pub const RESOURCE: &str = "https://api.openai.com/v1";
pub const PLAN_SCOPE: &str = "chatgpt.tokens.use.direct";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderError {
    pub code: &'static str,
    pub message: &'static str,
}

impl ProviderError {
    pub fn new(code: &'static str, message: &'static str) -> Self {
        Self { code, message }
    }
    pub fn cancelled() -> Self {
        Self::new("cancelled", "Connection operation cancelled.")
    }
    pub fn protocol() -> Self {
        Self::new(
            "invalid_response",
            "ChatGPT returned an invalid response. Try again.",
        )
    }
    pub fn network() -> Self {
        Self::new(
            "network",
            "Could not reach ChatGPT. Check your connection and try again.",
        )
    }
}
pub type Result<T> = std::result::Result<T, ProviderError>;

// Deliberately omit Debug: credentials must never enter diagnostics.
#[derive(Clone, Serialize, Deserialize)]
pub struct Credentials {
    pub access_token: String,
    pub refresh_token: String,
    pub id_token: String,
    pub expires_at: u64,
    pub earliest_refresh_at: Option<u64>,
    pub scopes: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Registration {
    pub id: String,
    pub client_id: String,
    pub subject: String,
    pub email: String,
    pub label: String,
    pub model: Option<String>,
    pub credentials: Option<Credentials>,
}

#[derive(Serialize, Deserialize)]
pub struct Vault {
    pub version: u32,
    #[serde(default)]
    pub plan_notice_seen: bool,
    pub host_id: String,
    pub active_id: Option<String>,
    pub registrations: Vec<Registration>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub email: String,
    pub label: String,
    pub connected: bool,
    pub model: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionStatus {
    pub accounts: Vec<Account>,
    pub active_id: Option<String>,
    pub plan_notice_seen: bool,
}

impl Vault {
    pub fn status(&self) -> ConnectionStatus {
        ConnectionStatus {
            plan_notice_seen: self.plan_notice_seen,
            active_id: self.active_id.clone(),
            accounts: self
                .registrations
                .iter()
                .map(|r| Account {
                    id: r.id.clone(),
                    email: r.email.clone(),
                    label: r.label.clone(),
                    connected: r.credentials.is_some(),
                    model: r.model.clone(),
                })
                .collect(),
        }
    }
    pub fn selected(&self, id: &str) -> Result<&Registration> {
        if id.len() > 100 || uuid::Uuid::parse_str(id).is_err() {
            return Err(ProviderError::new(
                "invalid_account",
                "Choose a saved ChatGPT account.",
            ));
        }
        self.registrations
            .iter()
            .find(|r| r.id == id)
            .ok_or_else(|| ProviderError::new("invalid_account", "Choose a saved ChatGPT account."))
    }
    pub fn active(&self) -> Result<&Registration> {
        self.selected(self.active_id.as_deref().ok_or_else(|| {
            ProviderError::new("not_connected", "Connect a ChatGPT account first.")
        })?)
    }
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Model {
    pub slug: String,
    pub display_name: String,
}

pub struct ProviderState {
    gate: Arc<AsyncMutex<()>>,
    cancellation: Mutex<Option<CancellationToken>>,
    lock_path: Option<PathBuf>,
    pub client: reqwest::Client,
}

impl Default for ProviderState {
    fn default() -> Self {
        Self {
            gate: Arc::new(AsyncMutex::new(())),
            cancellation: Mutex::new(None),
            lock_path: None,
            client: reqwest::Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .connect_timeout(std::time::Duration::from_secs(10))
                .timeout(std::time::Duration::from_secs(45))
                .build()
                .expect("HTTP client configuration is valid"),
        }
    }
}

pub struct OperationGuard {
    _local: OwnedMutexGuard<()>,
    _process: Option<File>,
}

impl ProviderState {
    pub fn with_lock_path(path: PathBuf) -> Self {
        Self {
            lock_path: Some(path),
            ..Self::default()
        }
    }
    fn finish_begin(
        &self,
        guard: OwnedMutexGuard<()>,
    ) -> Result<(OperationGuard, CancellationToken)> {
        // This file contains no account data. Its OS advisory lock also protects rotating
        // credentials when two Polar processes use the same native credential entry.
        let process_lock = self.lock_path.as_ref().map(|path| {
            let file = File::options().read(true).write(true).create(true).truncate(false).open(path)
                .map_err(|_| ProviderError::new("credential_lock", "Could not lock ChatGPT credentials. Check app data permissions."))?;
            file.try_lock().map_err(|_| ProviderError::new("busy", "ChatGPT credentials are in use by another Polar window. Try again shortly."))?;
            Ok::<_, ProviderError>(file)
        }).transpose()?;
        let cancel = CancellationToken::new();
        *self
            .cancellation
            .lock()
            .map_err(|_| ProviderError::protocol())? = Some(cancel.clone());
        Ok((
            OperationGuard {
                _local: guard,
                _process: process_lock,
            },
            cancel,
        ))
    }
    pub async fn begin_disconnect(&self) -> Result<(OperationGuard, CancellationToken)> {
        self.cancel()?;
        let guard = self.gate.clone().lock_owned().await;
        self.finish_begin(guard)
    }
    pub fn begin(&self) -> Result<(OperationGuard, CancellationToken)> {
        let guard = self.gate.clone().try_lock_owned().map_err(|_| {
            ProviderError::new(
                "busy",
                "Wait for the current connection operation or cancel it.",
            )
        })?;
        self.finish_begin(guard)
    }
    pub fn cancel(&self) -> Result<()> {
        if let Some(cancel) = self
            .cancellation
            .lock()
            .map_err(|_| ProviderError::protocol())?
            .as_ref()
        {
            cancel.cancel();
        }
        Ok(())
    }
}

pub fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn status_preserves_separate_registrations_without_exposing_secrets() {
        let records = (0..2)
            .map(|index| Registration {
                id: uuid::Uuid::new_v4().to_string(),
                client_id: format!("client-{index}"),
                subject: "private-subject".into(),
                email: "same@example.test".into(),
                label: format!("Account {index}"),
                model: None,
                credentials: Some(Credentials {
                    access_token: "SECRET-ACCESS".into(),
                    refresh_token: "SECRET-REFRESH".into(),
                    id_token: "SECRET-ID".into(),
                    expires_at: now() + 3600,
                    earliest_refresh_at: None,
                    scopes: vec![PLAN_SCOPE.into()],
                }),
            })
            .collect::<Vec<_>>();
        let vault = Vault {
            version: 1,
            plan_notice_seen: false,
            host_id: "urn:uuid:test".into(),
            active_id: Some(records[1].id.clone()),
            registrations: records,
        };
        let status = vault.status();
        assert_eq!(status.accounts.len(), 2);
        assert_ne!(status.accounts[0].id, status.accounts[1].id);
        let json = serde_json::to_string(&status).unwrap();
        for secret in [
            "SECRET-",
            "client-",
            "private-subject",
            "refresh_token",
            "access_token",
            "id_token",
            "host_id",
        ] {
            assert!(!json.contains(secret));
        }
        assert!(vault.selected("bad-id").is_err());
        assert!(vault.selected(&uuid::Uuid::new_v4().to_string()).is_err());
    }
    #[tokio::test]
    async fn separate_instances_cannot_rotate_the_same_credentials() {
        let path = std::env::temp_dir().join(format!("polar-lock-{}", uuid::Uuid::new_v4()));
        let first = ProviderState::with_lock_path(path.clone());
        let second = ProviderState::with_lock_path(path.clone());
        let (guard, _) = first.begin().unwrap();
        assert_eq!(second.begin().err().unwrap().code, "busy");
        drop(guard);
        let (guard, _) = second.begin().unwrap();
        drop(guard);
        std::fs::remove_file(path).unwrap();
    }
    #[tokio::test]
    async fn disconnect_cancels_then_waits_for_current_operation() {
        let state = ProviderState::default();
        let (guard, token) = state.begin().unwrap();
        let pending = state.begin_disconnect();
        tokio::pin!(pending);
        assert!(
            tokio::time::timeout(std::time::Duration::from_millis(10), &mut pending)
                .await
                .is_err()
        );
        assert!(token.is_cancelled());
        drop(guard);
        let (_guard, fresh) = pending.await.unwrap();
        assert!(!fresh.is_cancelled());
    }
    #[tokio::test]
    async fn operations_serialize_and_new_work_does_not_reuse_cancelled_token() {
        let state = ProviderState::default();
        let (guard, token) = state.begin().unwrap();
        assert_eq!(state.begin().err().unwrap().code, "busy");
        state.cancel().unwrap();
        assert!(token.is_cancelled());
        drop(guard);
        let (_guard, fresh) = state.begin().unwrap();
        assert!(!fresh.is_cancelled());
    }
}
