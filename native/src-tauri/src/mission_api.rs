use crate::application_auth::{internal_session, ApplicationAuthState};
use serde::Serialize;
use serde_json::Value;
use tauri::State;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CreateDraft<'a> {
    goal: &'a str,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Message<'a> {
    content: &'a str,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Activate<'a> {
    proposal_id: &'a str,
    revision_hash: &'a str,
}

async fn request(
    state: &ApplicationAuthState,
    method: reqwest::Method,
    path: &str,
    body: Option<Value>,
) -> Result<Value, String> {
    let account = internal_session(state)
        .await
        .map_err(|error| error.message)?;
    let url = state
        .api_url
        .join(path)
        .map_err(|_| "Polar server URL is invalid.".to_string())?;
    let mut builder = state
        .client
        .request(method, url)
        .bearer_auth(account.access_token)
        .header("x-polar-workspace-id", account.workspace_id);
    if let Some(body) = body {
        builder = builder.json(&body);
    }
    let response = builder
        .send()
        .await
        .map_err(|_| "Could not reach Polar. Check your connection and retry.".to_string())?;
    let status = response.status();
    let value: Value = response.json().await.unwrap_or(Value::Null);
    if status.is_success() {
        return Ok(value);
    }
    let message = value
        .get("message")
        .and_then(Value::as_str)
        .unwrap_or("Polar could not complete this mission request. Retry shortly.");
    Err(message.to_string())
}

#[tauri::command]
pub async fn polar_mission_drafts(state: State<'_, ApplicationAuthState>) -> Result<Value, String> {
    request(&state, reqwest::Method::GET, "api/app/mission-drafts", None).await
}

#[tauri::command]
pub async fn polar_mission_draft_get(
    state: State<'_, ApplicationAuthState>,
    draft_id: String,
) -> Result<Value, String> {
    validate_id(&draft_id)?;
    request(
        &state,
        reqwest::Method::GET,
        &format!("api/app/mission-drafts/{draft_id}"),
        None,
    )
    .await
}

#[tauri::command]
pub async fn polar_mission_draft_create(
    state: State<'_, ApplicationAuthState>,
    goal: String,
) -> Result<Value, String> {
    let goal = goal.trim();
    if goal.len() > 4000 {
        return Err("Describe a goal up to 4,000 characters.".into());
    }
    let body = serde_json::to_value(CreateDraft { goal })
        .map_err(|_| "Mission draft is invalid.".to_string())?;
    request(
        &state,
        reqwest::Method::POST,
        "api/app/mission-drafts",
        Some(body),
    )
    .await
}

#[tauri::command]
pub async fn polar_mission_draft_send_message(
    state: State<'_, ApplicationAuthState>,
    draft_id: String,
    content: String,
) -> Result<Value, String> {
    validate_id(&draft_id)?;
    let content = content.trim();
    if content.is_empty() || content.len() > 8000 {
        return Err("Enter a message up to 8,000 characters.".into());
    }
    let body = serde_json::to_value(Message { content })
        .map_err(|_| "Mission message is invalid.".to_string())?;
    request(
        &state,
        reqwest::Method::POST,
        &format!("api/app/mission-drafts/{draft_id}/messages"),
        Some(body),
    )
    .await
}

#[tauri::command]
pub async fn polar_mission_source_add(
    state: State<'_, ApplicationAuthState>,
    draft_id: String,
    source: Value,
) -> Result<Value, String> {
    validate_id(&draft_id)?;
    request(
        &state,
        reqwest::Method::POST,
        &format!("api/app/mission-drafts/{draft_id}/sources"),
        Some(source),
    )
    .await
}

#[tauri::command]
pub async fn polar_mission_source_remove(
    state: State<'_, ApplicationAuthState>,
    draft_id: String,
    source_id: String,
) -> Result<Value, String> {
    validate_id(&draft_id)?;
    validate_id(&source_id)?;
    request(
        &state,
        reqwest::Method::DELETE,
        &format!("api/app/mission-drafts/{draft_id}/sources/{source_id}"),
        None,
    )
    .await
}

#[tauri::command]
pub async fn polar_mission_activate(
    state: State<'_, ApplicationAuthState>,
    draft_id: String,
    proposal_id: String,
    revision_hash: String,
) -> Result<Value, String> {
    validate_id(&draft_id)?;
    validate_id(&proposal_id)?;
    if revision_hash.len() != 64 || !revision_hash.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("Review the current plan before activating it.".into());
    }
    let body = serde_json::to_value(Activate {
        proposal_id: &proposal_id,
        revision_hash: &revision_hash,
    })
    .map_err(|_| "Mission approval is invalid.".to_string())?;
    request(
        &state,
        reqwest::Method::POST,
        &format!("api/app/mission-drafts/{draft_id}/activate"),
        Some(body),
    )
    .await
}

#[tauri::command]
pub async fn polar_missions(state: State<'_, ApplicationAuthState>) -> Result<Value, String> {
    request(&state, reqwest::Method::GET, "api/app/missions", None).await
}

#[tauri::command]
pub async fn polar_mission_regenerate(
    state: State<'_, ApplicationAuthState>,
    mission_id: String,
) -> Result<Value, String> {
    validate_id(&mission_id)?;
    request(
        &state,
        reqwest::Method::POST,
        &format!("api/app/missions/{mission_id}/regenerate"),
        None,
    )
    .await
}

#[tauri::command]
pub async fn polar_mission_reasoning_cancel(
    state: State<'_, ApplicationAuthState>,
    request_id: String,
) -> Result<Value, String> {
    validate_id(&request_id)?;
    request(
        &state,
        reqwest::Method::POST,
        &format!("api/app/reasoning/{request_id}/cancel"),
        Some(Value::Null),
    )
    .await
}

#[tauri::command]
pub async fn polar_mission_reasoning_retry(
    state: State<'_, ApplicationAuthState>,
    request_id: String,
) -> Result<Value, String> {
    validate_id(&request_id)?;
    request(
        &state,
        reqwest::Method::POST,
        &format!("api/app/reasoning/{request_id}/retry"),
        Some(Value::Null),
    )
    .await
}

fn validate_id(value: &str) -> Result<(), String> {
    if uuid::Uuid::parse_str(value).is_ok() {
        Ok(())
    } else {
        Err("This mission request is invalid.".into())
    }
}
