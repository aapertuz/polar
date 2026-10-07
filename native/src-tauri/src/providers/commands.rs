use super::{oauth, openai, store, types::*};
use serde::Serialize;
use tauri::State;

#[tauri::command]
pub async fn chatgpt_status(state: State<'_, ProviderState>) -> Result<ConnectionStatus> {
    let (guard, cancel) = state.begin()?;
    let (_guard, vault) = store::load(guard, &cancel).await?;
    Ok(vault.status())
}

#[tauri::command]
pub async fn chatgpt_acknowledge_plan(state: State<'_, ProviderState>) -> Result<ConnectionStatus> {
    let (guard, cancel) = state.begin()?;
    let (_guard, mut vault) = store::load(guard, &cancel).await?;
    vault.plan_notice_seen = true;
    store::save(&vault)?;
    Ok(vault.status())
}

#[tauri::command]
pub async fn chatgpt_connect(
    app: tauri::AppHandle,
    state: State<'_, ProviderState>,
    account_id: Option<String>,
) -> Result<ConnectionStatus> {
    let (guard, cancel) = state.begin()?;
    let (_guard, mut vault) = store::load(guard, &cancel).await?;
    let previous = account_id
        .as_deref()
        .map(|id| vault.selected(id).cloned())
        .transpose()?;
    if previous.is_none() && vault.registrations.len() >= 20 {
        return Err(ProviderError::new(
            "account_limit",
            "Polar supports up to 20 saved ChatGPT registrations.",
        ));
    }
    let mut registration = oauth::sign_in(
        &app,
        &state.client,
        &vault.host_id,
        previous.as_ref(),
        cancel.clone(),
    )
    .await?;
    if cancel.is_cancelled() {
        return Err(ProviderError::cancelled());
    }
    // Preserve separate workspace/client registrations even when subjects/emails match.
    if previous.is_none() {
        if let Some(existing) = vault
            .registrations
            .iter()
            .find(|r| r.client_id == registration.client_id)
        {
            if existing.subject != registration.subject {
                return Err(ProviderError::protocol());
            }
            registration.id = existing.id.clone();
            registration.label = existing.label.clone();
            registration.model = existing.model.clone();
        } else {
            registration.label = format!("Account {}", vault.registrations.len() + 1);
        }
    }
    vault.active_id = Some(registration.id.clone());
    if let Some(index) = vault
        .registrations
        .iter()
        .position(|r| r.id == registration.id)
    {
        vault.registrations[index] = registration;
    } else {
        vault.registrations.push(registration);
    }
    store::save(&vault)?;
    Ok(vault.status())
}

#[tauri::command]
pub fn chatgpt_cancel(state: State<'_, ProviderState>) -> Result<()> {
    state.cancel()
}

#[tauri::command]
pub async fn chatgpt_select_account(
    state: State<'_, ProviderState>,
    account_id: String,
) -> Result<ConnectionStatus> {
    let (guard, cancel) = state.begin()?;
    let (_guard, mut vault) = store::load(guard, &cancel).await?;
    vault.selected(&account_id)?;
    vault.active_id = Some(account_id);
    store::save(&vault)?;
    Ok(vault.status())
}

#[tauri::command]
pub async fn chatgpt_models(state: State<'_, ProviderState>) -> Result<Vec<Model>> {
    let (guard, cancel) = state.begin()?;
    let (_guard, mut vault) = store::load(guard, &cancel).await?;
    // Once a refresh is sent, finish persisting its rotated tokens before honoring
    // cancellation. Dropping that request can invalidate the saved refresh token.
    let token = openai::access(&state.client, &mut vault).await?;
    let work = openai::models(&state.client, &token);
    tokio::select! { biased; _ = cancel.cancelled() => Err(ProviderError::cancelled()), result = work => result }
}

#[tauri::command]
pub async fn chatgpt_select_model(
    state: State<'_, ProviderState>,
    model: String,
) -> Result<ConnectionStatus> {
    if model.is_empty() || model.len() > 256 {
        return Err(ProviderError::new(
            "invalid_model",
            "Choose an available ChatGPT model.",
        ));
    }
    let (guard, cancel) = state.begin()?;
    let (_guard, mut vault) = store::load(guard, &cancel).await?;
    let token = openai::access(&state.client, &mut vault).await?;
    let work = async {
        let models = openai::models(&state.client, &token).await?;
        if !models.iter().any(|m| m.slug == model) {
            return Err(ProviderError::new(
                "invalid_model",
                "This model is no longer available. Reload the model list.",
            ));
        }
        let id = vault.active()?.id.clone();
        if cancel.is_cancelled() {
            return Err(ProviderError::cancelled());
        }
        vault
            .registrations
            .iter_mut()
            .find(|r| r.id == id)
            .ok_or_else(ProviderError::protocol)?
            .model = Some(model);
        store::save(&vault)?;
        Ok(vault.status())
    };
    tokio::select! { biased; _ = cancel.cancelled() => Err(ProviderError::cancelled()), result = work => result }
}

#[tauri::command]
pub async fn chatgpt_test(state: State<'_, ProviderState>) -> Result<String> {
    let (guard, cancel) = state.begin()?;
    let (_guard, mut vault) = store::load(guard, &cancel).await?;
    let model = vault.active()?.model.clone().ok_or_else(|| {
        ProviderError::new("invalid_model", "Choose a ChatGPT model before testing.")
    })?;
    let token = openai::access(&state.client, &mut vault).await?;
    let work = async {
        let catalog = openai::models(&state.client, &token).await?;
        if !catalog.iter().any(|m| m.slug == model) {
            return Err(ProviderError::new(
                "invalid_model",
                "This model is no longer available. Reload the model list.",
            ));
        }
        openai::test(&state.client, &token, &model).await
    };
    tokio::select! { biased; _ = cancel.cancelled() => Err(ProviderError::cancelled()), result = work => result }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisconnectResult {
    status: ConnectionStatus,
    revocation_confirmed: bool,
}

#[tauri::command]
pub async fn chatgpt_disconnect(
    state: State<'_, ProviderState>,
    account_id: String,
) -> Result<DisconnectResult> {
    if account_id.len() > 100 || uuid::Uuid::parse_str(&account_id).is_err() {
        return Err(ProviderError::new(
            "invalid_account",
            "Choose a saved ChatGPT account.",
        ));
    }
    let (guard, cancel) = state.begin_disconnect().await?;
    let (_guard, mut vault) = store::load(guard, &cancel).await?;
    let registration = vault.selected(&account_id)?.clone();
    // Clear locally before waiting on the network; failure must never leave a usable local session.
    let record = vault
        .registrations
        .iter_mut()
        .find(|r| r.id == account_id)
        .ok_or_else(ProviderError::protocol)?;
    record.credentials = None;
    record.model = None;
    store::save(&vault)?;
    let revoke = async {
        let Some(credentials) = registration.credentials else {
            return true;
        };
        let Ok(config) = oauth::discovery(&state.client).await else {
            return false;
        };
        for attempt in 0..2 {
            let result = state
                .client
                .post(&config.revocation_endpoint)
                .form(&[
                    ("token", credentials.refresh_token.as_str()),
                    ("token_type_hint", "refresh_token"),
                    ("client_id", &registration.client_id),
                ])
                .send()
                .await;
            match result {
                Ok(response) if response.status() == reqwest::StatusCode::OK => return true,
                Ok(response) if !response.status().is_server_error() => return false,
                _ => {}
            }
            if attempt == 0 {
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }
        }
        false
    };
    let confirmed = tokio::time::timeout(std::time::Duration::from_secs(12), revoke)
        .await
        .unwrap_or(false);
    Ok(DisconnectResult {
        status: vault.status(),
        revocation_confirmed: confirmed,
    })
}
