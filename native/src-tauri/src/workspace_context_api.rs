use crate::application_auth::{internal_session, ApplicationAuthState};
use serde_json::{json, Value};
use tauri::State;

async fn request(
    state: &ApplicationAuthState,
    method: reqwest::Method,
    path: &str,
    body: Option<Value>,
    revision: Option<u32>,
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
    if let Some(revision) = revision {
        builder = builder.header("if-match", revision);
    }
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
    Err(value
        .get("message")
        .and_then(Value::as_str)
        .unwrap_or("Polar could not update workspace context. Retry shortly.")
        .to_string())
}

#[tauri::command]
pub async fn polar_workspace_context_get(
    state: State<'_, ApplicationAuthState>,
) -> Result<Value, String> {
    request(
        &state,
        reqwest::Method::GET,
        "api/app/workspace-context",
        None,
        None,
    )
    .await
}

#[tauri::command]
pub async fn polar_workspace_context_save_brief(
    state: State<'_, ApplicationAuthState>,
    brief: String,
    expected_revision: u32,
) -> Result<Value, String> {
    if brief.len() > 8000 || expected_revision == 0 {
        return Err("Workspace brief must be 8,000 characters or fewer. Refresh and retry.".into());
    }
    request(
        &state,
        reqwest::Method::PUT,
        "api/app/workspace-context/brief",
        Some(json!({"brief": brief, "expectedRevision": expected_revision})),
        None,
    )
    .await
}

#[tauri::command]
pub async fn polar_workspace_context_source_add(
    state: State<'_, ApplicationAuthState>,
    source: Value,
) -> Result<Value, String> {
    validate_source(&source)?;
    request(
        &state,
        reqwest::Method::POST,
        "api/app/workspace-context/sources",
        Some(json!({"source": source})),
        None,
    )
    .await
}

#[tauri::command]
pub async fn polar_workspace_context_source_replace(
    state: State<'_, ApplicationAuthState>,
    source_id: String,
    source: Value,
    expected_revision: u32,
) -> Result<Value, String> {
    validate_id(&source_id)?;
    validate_source(&source)?;
    if source.get("id").and_then(Value::as_str) != Some(source_id.as_str())
        || expected_revision == 0
    {
        return Err("Refresh the workspace source before replacing it.".into());
    }
    request(
        &state,
        reqwest::Method::PUT,
        &format!("api/app/workspace-context/sources/{source_id}"),
        Some(json!({"source": source, "expectedRevision": expected_revision})),
        None,
    )
    .await
}

#[tauri::command]
pub async fn polar_workspace_context_source_archive(
    state: State<'_, ApplicationAuthState>,
    source_id: String,
    expected_revision: u32,
) -> Result<Value, String> {
    validate_id(&source_id)?;
    if expected_revision == 0 {
        return Err("Refresh the workspace source before removing it.".into());
    }
    request(
        &state,
        reqwest::Method::DELETE,
        &format!("api/app/workspace-context/sources/{source_id}"),
        None,
        Some(expected_revision),
    )
    .await
}

fn validate_source(source: &Value) -> Result<(), String> {
    let kind = source
        .get("kind")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let title = source
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let text = source
        .get("extractedText")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let id = source.get("id").and_then(Value::as_str).unwrap_or_default();
    if uuid::Uuid::parse_str(id).is_err()
        || !matches!(kind, "document" | "note")
        || title.trim().is_empty()
        || title.len() > 255
        || text.trim().is_empty()
        || text.len() > 1_000_000
    {
        return Err("Workspace source is invalid or too large.".into());
    }
    if kind == "note" && text.len() > 100_000 {
        return Err("Workspace notes must be 100,000 characters or fewer.".into());
    }
    Ok(())
}

fn validate_id(value: &str) -> Result<(), String> {
    if uuid::Uuid::parse_str(value).is_ok() {
        Ok(())
    } else {
        Err("This workspace source is invalid.".into())
    }
}
