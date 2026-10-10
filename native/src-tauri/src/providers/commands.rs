use super::{oauth, openai, store, types::*};
use crate::application_auth::{internal_session, ApplicationAuthState};
use serde::Serialize;
use tauri::State;

fn mission_result_error(status: reqwest::StatusCode, body: &[u8]) -> &'static str {
    if status == reqwest::StatusCode::PAYLOAD_TOO_LARGE {
        return "The generated plan exceeded Polar's result size limit. Retry to generate it again.";
    }
    if status.is_server_error() {
        return "Polar's server could not save the ChatGPT result. Retry when the server is available.";
    }
    let code = mission_result_error_code(body);
    match code {
        Some("INVALID_SCHEDULE") => {
            "Polar rejected the schedule because its dates conflict with checkpoint deadlines or action prerequisites. Retry to generate a new schedule."
        }
        Some("INVALID_DEPENDENCIES") => {
            "Polar rejected the plan because its action dependencies are inconsistent. Retry to generate it again."
        }
        Some("INVALID_PLAN") => {
            "Polar rejected the plan structure. Retry to generate it again."
        }
        Some("INVALID_REQUEST") => {
            "Polar could not submit the ChatGPT result. Restart the desktop app and retry."
        }
        Some("WORKSPACE_CONTEXT_CHANGED") => {
            "Workspace context changed while ChatGPT was working. Refresh the plan and retry."
        }
        Some("INVALID_CITATION") => {
            "ChatGPT cited a source excerpt that was not supplied. Retry to generate it again."
        }
        Some("LEASE_EXPIRED") => {
            "This request expired before its result could be saved. Retry to run it again."
        }
        Some("DEVICE_REQUIRED") => {
            "This device is no longer registered to your Polar account. Reconnect and retry."
        }
        Some("REQUEST_CHANGED") if status == reqwest::StatusCode::CONFLICT => {
            "This request changed while ChatGPT was working. Review the latest conversation and retry."
        }
        _ => "Polar could not validate the ChatGPT result. Retry to generate it again.",
    }
}

fn mission_result_error_code(body: &[u8]) -> Option<&'static str> {
    let code = serde_json::from_slice::<serde_json::Value>(body)
        .ok()
        .and_then(|value| {
            value
                .get("error")
                .and_then(serde_json::Value::as_str)
                .map(str::to_owned)
        });
    match code.as_deref() {
        Some("INVALID_SCHEDULE") => Some("INVALID_SCHEDULE"),
        Some("INVALID_DEPENDENCIES") => Some("INVALID_DEPENDENCIES"),
        Some("INVALID_PLAN") => Some("INVALID_PLAN"),
        Some("INVALID_REQUEST") => Some("INVALID_REQUEST"),
        Some("WORKSPACE_CONTEXT_CHANGED") => Some("WORKSPACE_CONTEXT_CHANGED"),
        Some("INVALID_CITATION") => Some("INVALID_CITATION"),
        Some("LEASE_EXPIRED") => Some("LEASE_EXPIRED"),
        Some("DEVICE_REQUIRED") => Some("DEVICE_REQUIRED"),
        Some("REQUEST_CHANGED") => Some("REQUEST_CHANGED"),
        _ => None,
    }
}

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

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReasoningClaim {
    job: Option<ReasoningJob>,
}

#[derive(serde::Deserialize)]
struct ReasoningJob {
    id: String,
    payload: serde_json::Value,
    #[serde(rename = "leaseToken")]
    lease_token: String,
}

#[tauri::command]
pub async fn polar_ai_work_once(
    provider: State<'_, ProviderState>,
    auth: State<'_, ApplicationAuthState>,
    workspace_id: String,
) -> std::result::Result<String, String> {
    if uuid::Uuid::parse_str(&workspace_id).is_err() {
        return Err("Workspace ID is invalid.".into());
    }
    let account = internal_session(&auth)
        .await
        .map_err(|error| error.message)?;
    let (guard, cancel) = provider
        .begin()
        .map_err(|error| error.message.to_string())?;
    let (_guard, mut vault) = store::load(guard, &cancel)
        .await
        .map_err(|error| error.message.to_string())?;
    let model = vault
        .active()
        .map_err(|error| error.message.to_string())?
        .model
        .clone()
        .ok_or_else(|| {
            "Choose an available ChatGPT model in Settings before creating a mission.".to_string()
        })?;
    let access_token = openai::access(&provider.client, &mut vault)
        .await
        .map_err(|error| error.message.to_string())?;

    let claim_url = auth
        .api_url
        .join("api/app/reasoning/claim")
        .map_err(|_| "Polar server URL is invalid.".to_string())?;
    let claim = tokio::select! {
        biased;
        _ = cancel.cancelled() => return Err(ProviderError::cancelled().message.into()),
        response = provider.client.get(claim_url).bearer_auth(&account.access_token)
            .header("x-polar-workspace-id", &workspace_id)
            .header("x-polar-device-id", &account.device_id).send() => response.map_err(|_| ProviderError::network().message.to_string())?,
    };
    if !claim.status().is_success() {
        return Err("Polar could not check for mission work. Retry when connected.".into());
    }
    let claim: ReasoningClaim = claim
        .json()
        .await
        .map_err(|_| "Polar returned an invalid mission request.".to_string())?;
    let Some(job) = claim.job else {
        return Ok("idle".into());
    };

    let inference = tokio::select! {
        biased;
        _ = cancel.cancelled() => Err(ProviderError::cancelled()),
        result = openai::mission_reasoning(&provider.client, &access_token, &model, &job.payload) => result,
    };
    match inference {
        Ok(output) => {
            let result_url = auth
                .api_url
                .join(&format!("api/app/reasoning/{}/result", job.id))
                .map_err(|_| "Polar server URL is invalid.".to_string())?;
            let response = provider.client.post(result_url).bearer_auth(&account.access_token)
                .header("x-polar-workspace-id", &workspace_id)
                .json(&serde_json::json!({ "deviceId": account.device_id, "leaseToken": job.lease_token, "output": output, "provider": "chatgpt", "model": model }))
                .send().await.map_err(|_| "Polar could not save the result. It will be safe to retry after the worker lease expires.".to_string())?;
            if response.status().is_success() {
                Ok("completed".into())
            } else {
                let status = response.status();
                let body = openai::bytes(response).await.unwrap_or_default();
                let message = mission_result_error(status, &body);
                let error_code = if status == reqwest::StatusCode::PAYLOAD_TOO_LARGE {
                    Some("RESULT_TOO_LARGE")
                } else {
                    mission_result_error_code(&body)
                };
                eprintln!(
                    "polar reasoning failed request_id={} stage=submission status={} code={}",
                    job.id,
                    status.as_u16(),
                    error_code.unwrap_or("unknown")
                );
                if status == reqwest::StatusCode::BAD_REQUEST
                    || status == reqwest::StatusCode::PAYLOAD_TOO_LARGE
                {
                    if let Ok(failure_url) = auth
                        .api_url
                        .join(&format!("api/app/reasoning/{}/failure", job.id))
                    {
                        let _ = provider
                            .client
                            .post(failure_url)
                            .bearer_auth(&account.access_token)
                            .header("x-polar-workspace-id", &workspace_id)
                            .header("x-polar-device-id", &account.device_id)
                            .json(&serde_json::json!({ "leaseToken": job.lease_token, "errorCode": error_code }))
                            .send()
                            .await;
                    }
                }
                Err(message.into())
            }
        }
        Err(error) => {
            // Only locally defined codes and correlation IDs enter diagnostics.
            // Never log provider bodies, source text, or credentials.
            eprintln!(
                "polar reasoning failed request_id={} stage=inference code={}",
                job.id, error.code
            );
            if let Ok(failure_url) = auth
                .api_url
                .join(&format!("api/app/reasoning/{}/failure", job.id))
            {
                let _ = provider
                    .client
                    .post(failure_url)
                    .bearer_auth(&account.access_token)
                    .header("x-polar-workspace-id", &workspace_id)
                    .header("x-polar-device-id", &account.device_id)
                    .json(&serde_json::json!({ "leaseToken": job.lease_token }))
                    .send()
                    .await;
            }
            Err(error.message.to_string())
        }
    }
}

#[tauri::command]
pub fn polar_ai_cancel(provider: State<'_, ProviderState>) -> Result<()> {
    provider.cancel()
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

#[cfg(test)]
mod mission_result_error_tests {
    use super::mission_result_error;

    #[test]
    fn validation_errors_explain_the_rejected_plan_part() {
        assert!(mission_result_error(
            reqwest::StatusCode::BAD_REQUEST,
            br#"{"error":"INVALID_SCHEDULE"}"#,
        )
        .contains("checkpoint deadlines"));
        assert!(mission_result_error(
            reqwest::StatusCode::BAD_REQUEST,
            br#"{"error":"INVALID_DEPENDENCIES"}"#,
        )
        .contains("dependencies"));
        assert!(mission_result_error(
            reqwest::StatusCode::BAD_REQUEST,
            br#"{"error":"INVALID_PLAN"}"#,
        )
        .contains("structure"));
    }

    #[test]
    fn unknown_error_bodies_do_not_leak_server_text() {
        assert_eq!(
            mission_result_error(
                reqwest::StatusCode::BAD_REQUEST,
                br#"{"error":"SECRET","message":"sensitive details"}"#,
            ),
            "Polar could not validate the ChatGPT result. Retry to generate it again."
        );
    }

    #[test]
    fn transport_and_submission_failures_are_not_plan_validation_errors() {
        assert!(
            mission_result_error(reqwest::StatusCode::PAYLOAD_TOO_LARGE, b"private")
                .contains("size limit")
        );
        assert!(
            mission_result_error(reqwest::StatusCode::INTERNAL_SERVER_ERROR, b"private")
                .contains("server could not save")
        );
        assert!(mission_result_error(
            reqwest::StatusCode::BAD_REQUEST,
            br#"{"error":"INVALID_REQUEST"}"#
        )
        .contains("submit"));
    }
}
