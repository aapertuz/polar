use super::types::*;
use keyring::Entry;

fn entry(scope: &str) -> Result<Entry> {
    Entry::new("com.antoniopertuz.polar.application-auth", scope).map_err(|_| AuthError::storage())
}

pub async fn load(
    guard: OperationGuard,
    cancel: &tokio_util::sync::CancellationToken,
    scope: &str,
) -> Result<(OperationGuard, AuthVault)> {
    let scope = scope.to_string();
    load_with(guard, cancel, move || load_from(&entry(&scope)?)).await
}

async fn load_with(
    guard: OperationGuard,
    cancel: &tokio_util::sync::CancellationToken,
    read: impl FnOnce() -> Result<AuthVault> + Send + 'static,
) -> Result<(OperationGuard, AuthVault)> {
    let task = tokio::task::spawn_blocking(move || read().map(|vault| (guard, vault)));
    tokio::select! {
        biased;
        _ = cancel.cancelled() => Err(AuthError::cancelled()),
        result = tokio::time::timeout(std::time::Duration::from_secs(30), task) => {
            result.map_err(|_| AuthError::new("credential_store", "Secure storage is waiting for the system keychain. Check for an unlock or access prompt, then reload."))?
                .map_err(|_| AuthError::storage())?
        }
    }
}

pub fn load_from(entry: &Entry) -> Result<AuthVault> {
    match entry.get_password() {
        Ok(value) => {
            let vault: AuthVault =
                serde_json::from_str(&value).map_err(|_| AuthError::storage())?;
            if vault.version != 1
                || uuid::Uuid::parse_str(&vault.device_id).is_err()
                || vault.session.as_ref().is_some_and(|session| {
                    session.access_token.is_empty()
                        || session.email.len() > 320
                        || uuid::Uuid::parse_str(&session.polar_user_id).is_err()
                        || session
                            .workspace_id
                            .as_ref()
                            .is_some_and(|id| uuid::Uuid::parse_str(id).is_err())
                        || session
                            .workspace_name
                            .as_ref()
                            .is_some_and(|name| name.chars().count() > 120)
                        || session
                            .default_workspace_id
                            .as_ref()
                            .is_some_and(|id| uuid::Uuid::parse_str(id).is_err())
                        || session.workspaces.len() > 500
                        || session.workspaces.iter().any(|workspace| {
                            uuid::Uuid::parse_str(&workspace.id).is_err()
                                || workspace.name.trim().is_empty()
                                || workspace.name.chars().count() > 120
                                || !matches!(workspace.privacy.as_str(), "private" | "shared")
                                || !matches!(workspace.role.as_str(), "owner" | "member")
                        })
                })
            {
                return Err(AuthError::storage());
            }
            Ok(vault)
        }
        Err(keyring::Error::NoEntry) => {
            let vault = AuthVault {
                version: 1,
                device_id: uuid::Uuid::new_v4().to_string(),
                session: None,
            };
            save_to(entry, &vault)?;
            Ok(vault)
        }
        Err(_) => Err(AuthError::storage()),
    }
}

pub fn save(scope: &str, vault: &AuthVault) -> Result<()> {
    save_to(&entry(scope)?, vault)
}

fn save_to(entry: &Entry, vault: &AuthVault) -> Result<()> {
    let serialized = serde_json::to_string(vault).map_err(|_| AuthError::storage())?;
    entry
        .set_password(&serialized)
        .map_err(|_| AuthError::storage())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mock_entry() -> Entry {
        Entry::new_with_credential(Box::new(keyring::mock::MockCredential::default()))
    }

    fn session() -> SessionCredential {
        SessionCredential {
            access_token: "private-session-token".into(),
            email: "user@example.test".into(),
            polar_user_id: uuid::Uuid::new_v4().to_string(),
            workspace_id: Some(uuid::Uuid::new_v4().to_string()),
            workspace_name: Some("My workspace".into()),
            workspace_privacy: Some("private".into()),
            workspaces: Vec::new(),
            default_workspace_id: None,
            expires_at: now() + 86400,
        }
    }

    #[test]
    fn secure_vault_restores_session_and_keeps_a_stable_device_id() {
        let entry = mock_entry();
        let mut vault = load_from(&entry).unwrap();
        let device_id = vault.device_id.clone();
        vault.session = Some(session());
        save_to(&entry, &vault).unwrap();
        let restored = load_from(&entry).unwrap();
        assert_eq!(restored.device_id, device_id);
        assert_eq!(
            restored.session.as_ref().unwrap().email,
            "user@example.test"
        );
    }

    #[test]
    fn legacy_workspace_credentials_deserialize_with_workspace_cache_defaults() {
        let entry = mock_entry();
        let device_id = uuid::Uuid::new_v4().to_string();
        let user_id = uuid::Uuid::new_v4().to_string();
        let workspace_id = uuid::Uuid::new_v4().to_string();
        let legacy = serde_json::json!({
            "version": 1,
            "device_id": device_id,
            "session": {
                "access_token": "legacy-token",
                "email": "person@example.test",
                "polar_user_id": user_id,
                "workspace_id": workspace_id,
                "workspace_name": "Old workspace",
                "expires_at": now() + 3600
            }
        });
        entry.set_password(&legacy.to_string()).unwrap();

        let restored = load_from(&entry).unwrap();
        let session = restored.session.unwrap();
        assert_eq!(session.workspace_id.as_deref(), Some(workspace_id.as_str()));
        assert_eq!(session.workspace_name.as_deref(), Some("Old workspace"));
        assert!(session.workspaces.is_empty());
        assert_eq!(session.workspace_privacy, None);
        assert_eq!(session.default_workspace_id, None);
    }

    #[test]
    fn status_does_not_serialize_the_bearer_credential() {
        let status = AuthStatus::from_session(&session());
        let value = serde_json::to_string(&status).unwrap();
        assert!(value.contains("user@example.test"));
        assert!(!value.contains("private-session-token"));
        assert!(!value.contains("access_token"));
    }

    #[test]
    fn corrupt_or_unavailable_storage_is_not_overwritten() {
        let entry = mock_entry();
        entry.set_password("corrupt-value").unwrap();
        assert_eq!(load_from(&entry).err().unwrap().code, "credential_store");
        assert_eq!(entry.get_password().unwrap(), "corrupt-value");
        let mock: &keyring::mock::MockCredential = entry.get_credential().downcast_ref().unwrap();
        mock.set_error(keyring::Error::Invalid("store".into(), "locked".into()));
        assert_eq!(load_from(&entry).err().unwrap().code, "credential_store");
    }

    #[tokio::test]
    async fn cancelling_a_blocked_secure_store_keeps_operation_lock_until_read_finishes() {
        let directory = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        std::fs::create_dir_all(&directory).unwrap();
        let state = ApplicationAuthState::new(directory.clone()).unwrap();
        let (guard, cancel) = state.begin().unwrap();
        let (release, blocked) = std::sync::mpsc::channel();
        let signal = cancel.clone();
        let result = load_with(guard, &cancel, move || {
            signal.cancel();
            blocked.recv().unwrap();
            load_from(&mock_entry())
        })
        .await;
        assert_eq!(result.err().unwrap().code, "cancelled");
        assert_eq!(state.begin().err().unwrap().code, "busy");
        release.send(()).unwrap();
        tokio::time::timeout(std::time::Duration::from_secs(1), async {
            loop {
                if state.begin().is_ok() {
                    break;
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();
        std::fs::remove_dir_all(directory).unwrap();
    }
}
