use crate::application_auth::{internal_session, ApplicationAuthState};
use serde::{Deserialize, Deserializer, Serialize};
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

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MissionActionUpdate {
    #[serde(
        default,
        deserialize_with = "deserialize_nullable_field",
        skip_serializing_if = "Option::is_none"
    )]
    due_on: Option<Option<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    priority: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    assignee_ids: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    context_source_ids: Option<Vec<String>>,
}

fn deserialize_nullable_field<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}

fn validate_action_update(value: Value) -> Result<Value, String> {
    let update: MissionActionUpdate = serde_json::from_value(value).map_err(|_| {
        "Choose valid action members, context, deadline, priority, or completion state.".to_string()
    })?;
    if update.due_on.is_none()
        && update.priority.is_none()
        && update.status.is_none()
        && update.assignee_ids.is_none()
        && update.context_source_ids.is_none()
    {
        return Err("Choose at least one action field to update.".into());
    }
    if let Some(Some(due_on)) = &update.due_on {
        if chrono::NaiveDate::parse_from_str(due_on, "%Y-%m-%d").is_err() {
            return Err("Choose a valid action deadline.".into());
        }
    }
    if update
        .priority
        .as_deref()
        .is_some_and(|value| !matches!(value, "High" | "Medium" | "Low"))
    {
        return Err("Choose High, Medium, or Low priority.".into());
    }
    if update
        .status
        .as_deref()
        .is_some_and(|value| !matches!(value, "upcoming" | "completed"))
    {
        return Err("Choose an available action completion state.".into());
    }
    if update
        .assignee_ids
        .as_ref()
        .is_some_and(|ids| !valid_reference_ids(ids, 50))
        || update
            .context_source_ids
            .as_ref()
            .is_some_and(|ids| !valid_reference_ids(ids, 80))
    {
        return Err("Action member or context references are invalid.".into());
    }
    serde_json::to_value(update).map_err(|_| "Action details are invalid.".to_string())
}

fn valid_reference_ids(ids: &[String], limit: usize) -> bool {
    ids.len() <= limit
        && ids.iter().all(|id| uuid::Uuid::parse_str(id).is_ok())
        && ids.iter().collect::<std::collections::HashSet<_>>().len() == ids.len()
}

async fn request(
    state: &ApplicationAuthState,
    workspace_id: &str,
    method: reqwest::Method,
    path: &str,
    body: Option<Value>,
) -> Result<Value, String> {
    validate_id(workspace_id)?;
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
        .header("x-polar-workspace-id", workspace_id);
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
pub async fn polar_mission_drafts(
    state: State<'_, ApplicationAuthState>,
    workspace_id: String,
) -> Result<Value, String> {
    request(
        &state,
        &workspace_id,
        reqwest::Method::GET,
        "api/app/mission-drafts",
        None,
    )
    .await
}

#[tauri::command]
pub async fn polar_mission_draft_get(
    state: State<'_, ApplicationAuthState>,
    workspace_id: String,
    draft_id: String,
) -> Result<Value, String> {
    validate_id(&workspace_id)?;
    validate_id(&draft_id)?;
    request(
        &state,
        &workspace_id,
        reqwest::Method::GET,
        &format!("api/app/mission-drafts/{draft_id}"),
        None,
    )
    .await
}

#[tauri::command]
pub async fn polar_mission_draft_create(
    state: State<'_, ApplicationAuthState>,
    workspace_id: String,
    goal: String,
) -> Result<Value, String> {
    validate_id(&workspace_id)?;
    let goal = goal.trim();
    if goal.len() > 4000 {
        return Err("Describe a goal up to 4,000 characters.".into());
    }
    let body = serde_json::to_value(CreateDraft { goal })
        .map_err(|_| "Mission draft is invalid.".to_string())?;
    request(
        &state,
        &workspace_id,
        reqwest::Method::POST,
        "api/app/mission-drafts",
        Some(body),
    )
    .await
}

#[tauri::command]
pub async fn polar_mission_draft_send_message(
    state: State<'_, ApplicationAuthState>,
    workspace_id: String,
    draft_id: String,
    content: String,
) -> Result<Value, String> {
    validate_id(&workspace_id)?;
    validate_id(&draft_id)?;
    let content = content.trim();
    if content.is_empty() || content.len() > 8000 {
        return Err("Enter a message up to 8,000 characters.".into());
    }
    let body = serde_json::to_value(Message { content })
        .map_err(|_| "Mission message is invalid.".to_string())?;
    request(
        &state,
        &workspace_id,
        reqwest::Method::POST,
        &format!("api/app/mission-drafts/{draft_id}/messages"),
        Some(body),
    )
    .await
}

#[tauri::command]
pub async fn polar_mission_source_add(
    state: State<'_, ApplicationAuthState>,
    workspace_id: String,
    draft_id: String,
    source: Value,
) -> Result<Value, String> {
    validate_id(&workspace_id)?;
    validate_id(&draft_id)?;
    request(
        &state,
        &workspace_id,
        reqwest::Method::POST,
        &format!("api/app/mission-drafts/{draft_id}/sources"),
        Some(source),
    )
    .await
}

#[tauri::command]
pub async fn polar_mission_source_remove(
    state: State<'_, ApplicationAuthState>,
    workspace_id: String,
    draft_id: String,
    source_id: String,
) -> Result<Value, String> {
    validate_id(&workspace_id)?;
    validate_id(&draft_id)?;
    validate_id(&source_id)?;
    request(
        &state,
        &workspace_id,
        reqwest::Method::DELETE,
        &format!("api/app/mission-drafts/{draft_id}/sources/{source_id}"),
        None,
    )
    .await
}

#[tauri::command]
pub async fn polar_mission_activate(
    state: State<'_, ApplicationAuthState>,
    workspace_id: String,
    draft_id: String,
    proposal_id: String,
    revision_hash: String,
) -> Result<Value, String> {
    validate_id(&workspace_id)?;
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
        &workspace_id,
        reqwest::Method::POST,
        &format!("api/app/mission-drafts/{draft_id}/activate"),
        Some(body),
    )
    .await
}

#[tauri::command]
pub async fn polar_missions(
    state: State<'_, ApplicationAuthState>,
    workspace_id: String,
) -> Result<Value, String> {
    request(
        &state,
        &workspace_id,
        reqwest::Method::GET,
        "api/app/missions",
        None,
    )
    .await
}

#[tauri::command]
pub async fn polar_mission_action_update(
    state: State<'_, ApplicationAuthState>,
    workspace_id: String,
    mission_id: String,
    action_id: String,
    updates: Value,
) -> Result<Value, String> {
    validate_id(&workspace_id)?;
    validate_id(&mission_id)?;
    validate_id(&action_id)?;
    let updates = validate_action_update(updates)?;
    request(
        &state,
        &workspace_id,
        reqwest::Method::PATCH,
        &format!("api/app/missions/{mission_id}/actions/{action_id}"),
        Some(updates),
    )
    .await
}

#[tauri::command]
pub async fn polar_mission_regenerate(
    state: State<'_, ApplicationAuthState>,
    workspace_id: String,
    mission_id: String,
) -> Result<Value, String> {
    validate_id(&workspace_id)?;
    validate_id(&mission_id)?;
    request(
        &state,
        &workspace_id,
        reqwest::Method::POST,
        &format!("api/app/missions/{mission_id}/regenerate"),
        None,
    )
    .await
}

#[tauri::command]
pub async fn polar_mission_reasoning_cancel(
    state: State<'_, ApplicationAuthState>,
    workspace_id: String,
    request_id: String,
) -> Result<Value, String> {
    validate_id(&workspace_id)?;
    validate_id(&request_id)?;
    request(
        &state,
        &workspace_id,
        reqwest::Method::POST,
        &format!("api/app/reasoning/{request_id}/cancel"),
        Some(Value::Null),
    )
    .await
}

#[tauri::command]
pub async fn polar_mission_reasoning_retry(
    state: State<'_, ApplicationAuthState>,
    workspace_id: String,
    request_id: String,
) -> Result<Value, String> {
    validate_id(&workspace_id)?;
    validate_id(&request_id)?;
    request(
        &state,
        &workspace_id,
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

#[cfg(test)]
mod action_update_tests {
    use super::validate_action_update;
    use serde_json::json;

    #[test]
    fn validates_action_update_fields_and_preserves_a_cleared_deadline() {
        let result = validate_action_update(json!({
            "dueOn": null,
            "priority": "Low",
            "assigneeIds": ["11111111-1111-4111-8111-111111111111"],
            "contextSourceIds": []
        }))
        .expect("valid updates should be accepted");
        assert!(result["dueOn"].is_null());
        assert_eq!(result["priority"], "Low");
        assert_eq!(result["contextSourceIds"], json!([]));
    }

    #[test]
    fn rejects_invalid_dates_statuses_ids_and_unknown_fields() {
        for value in [
            json!({"dueOn": "2026-02-30"}),
            json!({"status": "blocked"}),
            json!({"assigneeIds": ["invalid"]}),
            json!({"title": "unscoped"}),
            json!({}),
        ] {
            assert!(validate_action_update(value).is_err());
        }
    }
}
