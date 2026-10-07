use super::types::*;

fn entry() -> Result<keyring::Entry> {
    keyring::Entry::new("com.antoniopertuz.polar.chatgpt", "provider-v1")
        .map_err(|_| storage_error())
}

fn storage_error() -> ProviderError {
    ProviderError::new(
        "credential_store",
        "Could not access secure credential storage. Unlock your keychain and try again.",
    )
}

pub async fn load(
    guard: OperationGuard,
    cancel: &tokio_util::sync::CancellationToken,
) -> Result<(OperationGuard, Vault)> {
    load_with(guard, cancel, || load_from(&entry()?)).await
}

async fn load_with(
    guard: OperationGuard,
    cancel: &tokio_util::sync::CancellationToken,
    read: impl FnOnce() -> Result<Vault> + Send + 'static,
) -> Result<(OperationGuard, Vault)> {
    // OS credential APIs can wait on an unlock/access prompt. Keep their blocking
    // work off the async executor and retain the operation lock until it finishes,
    // even when the caller cancels or times out.
    let task = tokio::task::spawn_blocking(move || read().map(|vault| (guard, vault)));
    tokio::select! {
        biased;
        _ = cancel.cancelled() => Err(ProviderError::cancelled()),
        result = tokio::time::timeout(std::time::Duration::from_secs(30), task) => {
            result.map_err(|_| ProviderError::new("credential_store", "Secure storage is waiting for macOS or your credential service. Check for an unlock or access prompt, then reload."))?
                .map_err(|_| storage_error())?
        }
    }
}

fn load_from(entry: &keyring::Entry) -> Result<Vault> {
    match entry.get_password() {
        Ok(value) => {
            let vault: Vault = serde_json::from_str(&value).map_err(|_| storage_error())?;
            if vault.version != 1
                || vault
                    .host_id
                    .strip_prefix("urn:uuid:")
                    .and_then(|id| uuid::Uuid::parse_str(id).ok())
                    .is_none()
            {
                return Err(storage_error());
            }
            Ok(vault)
        }
        Err(keyring::Error::NoEntry) => {
            let vault = Vault {
                version: 1,
                plan_notice_seen: false,
                host_id: format!("urn:uuid:{}", uuid::Uuid::new_v4()),
                active_id: None,
                registrations: vec![],
            };
            save_to(entry, &vault)?;
            Ok(vault)
        }
        Err(_) => Err(storage_error()),
    }
}

pub fn save(vault: &Vault) -> Result<()> {
    save_to(&entry()?, vault)
}

fn save_to(entry: &keyring::Entry, vault: &Vault) -> Result<()> {
    let value = serde_json::to_string(vault).map_err(|_| storage_error())?;
    entry.set_password(&value).map_err(|_| storage_error())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn mock_entry() -> keyring::Entry {
        keyring::Entry::new_with_credential(Box::new(keyring::mock::MockCredential::default()))
    }
    #[tokio::test]
    async fn cancelling_blocked_store_read_keeps_rotation_lock_until_reader_finishes() {
        let state = ProviderState::default();
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
    }
    #[test]
    fn host_and_disconnected_registration_survive_reload() {
        let entry = mock_entry();
        let mut vault = load_from(&entry).unwrap();
        assert_eq!(vault.host_id, load_from(&entry).unwrap().host_id);
        let id = uuid::Uuid::new_v4().to_string();
        vault.active_id = Some(id.clone());
        vault.plan_notice_seen = true;
        vault.registrations.push(Registration {
            id: id.clone(),
            client_id: "issued-client".into(),
            subject: "subject".into(),
            email: "user@example.test".into(),
            label: "Account 1".into(),
            model: None,
            credentials: None,
        });
        save_to(&entry, &vault).unwrap();
        let restored = load_from(&entry).unwrap();
        assert_eq!(restored.host_id, vault.host_id);
        assert_eq!(restored.active_id, Some(id));
        assert!(restored.plan_notice_seen);
        assert_eq!(restored.registrations[0].client_id, "issued-client");
        assert!(restored.registrations[0].credentials.is_none());
    }
    #[test]
    fn corrupt_or_unavailable_storage_fails_without_overwriting() {
        let entry = mock_entry();
        entry.set_password("corrupt-value").unwrap();
        assert_eq!(load_from(&entry).err().unwrap().code, "credential_store");
        assert_eq!(entry.get_password().unwrap(), "corrupt-value");
        let mock: &keyring::mock::MockCredential = entry.get_credential().downcast_ref().unwrap();
        mock.set_error(keyring::Error::Invalid("store".into(), "locked".into()));
        assert_eq!(load_from(&entry).err().unwrap().code, "credential_store");
    }
}
