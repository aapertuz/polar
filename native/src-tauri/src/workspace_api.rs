use crate::application_auth::{
    internal_session, store, ApplicationAuthState, AuthError, AuthStatus, WorkspaceSummary,
};
use reqwest::Method;
use serde_json::{json, Value};
use tauri::State;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceList {
    workspaces: Vec<WorkspaceSummary>,
    default_workspace_id: Option<String>,
}

#[tauri::command]
pub async fn polar_workspace_select(
    state: State<'_, ApplicationAuthState>,
    workspace_id: String,
) -> Result<AuthStatus, String> {
    validate_id(&workspace_id)?;
    let account = internal_session(&state)
        .await
        .map_err(|error| error.message)?;
    let value = request(
        &state,
        Method::GET,
        "api/app/workspaces",
        None,
        Some(&account.access_token),
    )
    .await?;
    let list: WorkspaceList = serde_json::from_value(value)
        .map_err(|_| "Polar returned an invalid workspace list.".to_string())?;
    validate_list(&list)?;
    if !list
        .workspaces
        .iter()
        .any(|workspace| workspace.id == workspace_id)
    {
        return Err("This account no longer has access to that workspace.".into());
    }

    let (guard, cancel) = state.begin().map_err(|error| error.message)?;
    let (_guard, mut vault) = store::load(guard, &cancel, &state.credential_scope)
        .await
        .map_err(|error| error.message)?;
    let session = vault
        .session
        .as_mut()
        .ok_or_else(|| "Sign in to Polar before selecting a workspace.".to_string())?;
    if session.polar_user_id != account.polar_user_id {
        return Err(
            "Your Polar account changed while the workspace was loading. Try again.".into(),
        );
    }
    update_selection(session, &list, &workspace_id)?;
    state
        .commit_if_active(&cancel, || store::save(&state.credential_scope, &vault))
        .map_err(|error| error.message)?;
    Ok(AuthStatus::from_session(
        vault
            .session
            .as_ref()
            .ok_or_else(|| AuthError::storage().message)?,
    ))
}

#[tauri::command]
pub async fn polar_workspace_create(
    state: State<'_, ApplicationAuthState>,
    name: String,
    privacy: String,
) -> Result<WorkspaceSummary, String> {
    let name = validate_name(&name)?;
    validate_privacy(&privacy)?;
    let value = request(
        &state,
        Method::POST,
        "api/app/workspaces",
        Some(json!({ "name": name, "privacy": privacy })),
        None,
    )
    .await?;
    parse_workspace(value.get("workspace").cloned())
}

#[tauri::command]
pub async fn polar_workspace_update(
    state: State<'_, ApplicationAuthState>,
    workspace_id: String,
    updates: Value,
) -> Result<WorkspaceSummary, String> {
    validate_id(&workspace_id)?;
    let updates = validate_updates(updates)?;
    let value = request(
        &state,
        Method::PATCH,
        &format!("api/app/workspaces/{workspace_id}"),
        Some(updates),
        None,
    )
    .await?;
    parse_workspace(value.get("workspace").cloned())
}

#[tauri::command]
pub async fn polar_workspace_delete(
    state: State<'_, ApplicationAuthState>,
    workspace_id: String,
    confirmation_name: String,
) -> Result<Value, String> {
    validate_id(&workspace_id)?;
    let confirmation_name = validate_name(&confirmation_name)?;
    request(
        &state,
        Method::DELETE,
        &format!("api/app/workspaces/{workspace_id}"),
        Some(json!({ "confirmationName": confirmation_name })),
        None,
    )
    .await
}

#[tauri::command]
pub async fn polar_workspace_set_default(
    state: State<'_, ApplicationAuthState>,
    default_workspace_id: Option<String>,
) -> Result<Option<String>, String> {
    if let Some(id) = default_workspace_id.as_deref() {
        validate_id(id)?;
    }
    let account = internal_session(&state)
        .await
        .map_err(|error| error.message)?;
    let value = request(
        &state,
        Method::PUT,
        "api/app/workspace-preferences/default",
        Some(json!({ "defaultWorkspaceId": default_workspace_id })),
        Some(&account.access_token),
    )
    .await?;
    let id = value
        .get("defaultWorkspaceId")
        .and_then(Value::as_str)
        .map(str::to_owned);
    if id
        .as_deref()
        .is_some_and(|value| uuid::Uuid::parse_str(value).is_err())
    {
        return Err("Polar returned an invalid workspace preference.".into());
    }
    let (guard, cancel) = state.begin().map_err(|error| error.message)?;
    let (_guard, mut vault) = store::load(guard, &cancel, &state.credential_scope)
        .await
        .map_err(|error| error.message)?;
    let session = vault
        .session
        .as_mut()
        .ok_or_else(|| "Sign in to Polar before changing the default workspace.".to_string())?;
    if session.polar_user_id != account.polar_user_id {
        return Err(
            "Your Polar account changed while the preference was saving. Try again.".into(),
        );
    }
    session.default_workspace_id = id.clone();
    state
        .commit_if_active(&cancel, || store::save(&state.credential_scope, &vault))
        .map_err(|error| error.message)?;
    Ok(id)
}

async fn request(
    state: &ApplicationAuthState,
    method: Method,
    path: &str,
    body: Option<Value>,
    token: Option<&str>,
) -> Result<Value, String> {
    let owned_token;
    let token = match token {
        Some(token) => token,
        None => {
            let account = internal_session(state)
                .await
                .map_err(|error| error.message)?;
            owned_token = account.access_token;
            &owned_token
        }
    };
    let url = state
        .api_url
        .join(path)
        .map_err(|_| "Polar server URL is invalid.".to_string())?;
    let mut builder = state.client.request(method, url).bearer_auth(token);
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
        .unwrap_or("Polar could not update workspace settings. Retry shortly.")
        .to_string())
}

fn update_selection(
    session: &mut crate::application_auth::SessionCredential,
    list: &WorkspaceList,
    workspace_id: &str,
) -> Result<(), String> {
    let selected = list
        .workspaces
        .iter()
        .find(|workspace| workspace.id == workspace_id)
        .ok_or_else(|| "This account no longer has access to that workspace.".to_string())?;
    session.workspace_id = Some(selected.id.clone());
    session.workspace_name = Some(selected.name.clone());
    session.workspace_privacy = Some(selected.privacy.clone());
    session.workspaces = list.workspaces.clone();
    session.default_workspace_id = list.default_workspace_id.clone();
    Ok(())
}

fn validate_list(list: &WorkspaceList) -> Result<(), String> {
    if list.workspaces.len() > 500
        || list.workspaces.iter().any(|workspace| {
            uuid::Uuid::parse_str(&workspace.id).is_err()
                || workspace.name.trim().is_empty()
                || workspace.name.chars().count() > 120
                || !matches!(workspace.privacy.as_str(), "private" | "shared")
                || !matches!(workspace.role.as_str(), "owner" | "member")
                || workspace.created_at.is_empty()
                || workspace.created_at.len() > 64
        })
        || list
            .default_workspace_id
            .as_ref()
            .is_some_and(|id| !list.workspaces.iter().any(|workspace| &workspace.id == id))
    {
        return Err("Polar returned an invalid workspace list.".into());
    }
    Ok(())
}

fn parse_workspace(value: Option<Value>) -> Result<WorkspaceSummary, String> {
    let summary: WorkspaceSummary = serde_json::from_value(
        value.ok_or_else(|| "Polar returned an invalid workspace.".to_string())?,
    )
    .map_err(|_| "Polar returned an invalid workspace.".to_string())?;
    validate_summary(&summary)?;
    Ok(summary)
}

fn validate_summary(workspace: &WorkspaceSummary) -> Result<(), String> {
    if uuid::Uuid::parse_str(&workspace.id).is_err()
        || workspace.name.trim().is_empty()
        || workspace.name.chars().count() > 120
        || !matches!(workspace.privacy.as_str(), "private" | "shared")
        || !matches!(workspace.role.as_str(), "owner" | "member")
        || workspace.created_at.is_empty()
        || workspace.created_at.len() > 64
    {
        return Err("Polar returned an invalid workspace.".into());
    }
    Ok(())
}

fn validate_name(value: &str) -> Result<String, String> {
    let name = value.trim();
    if name.is_empty() || name.chars().count() > 120 {
        return Err("Workspace names must be between 1 and 120 characters.".into());
    }
    Ok(name.to_string())
}

fn validate_privacy(value: &str) -> Result<(), String> {
    if matches!(value, "private" | "shared") {
        Ok(())
    } else {
        Err("Choose Private or Shared workspace privacy.".into())
    }
}

fn validate_updates(mut updates: Value) -> Result<Value, String> {
    let object = updates
        .as_object_mut()
        .ok_or_else(|| "Workspace changes are invalid.".to_string())?;
    if object.is_empty()
        || object
            .keys()
            .any(|key| !matches!(key.as_str(), "name" | "privacy"))
    {
        return Err("Workspace changes are invalid.".into());
    }
    if let Some(name) = object.get("name").and_then(Value::as_str) {
        object.insert("name".into(), Value::String(validate_name(name)?));
    } else if object.contains_key("name") {
        return Err("Workspace name is invalid.".into());
    }
    if let Some(privacy) = object.get("privacy").and_then(Value::as_str) {
        validate_privacy(privacy)?;
    } else if object.contains_key("privacy") {
        return Err("Workspace privacy is invalid.".into());
    }
    Ok(updates)
}

fn validate_id(value: &str) -> Result<(), String> {
    if uuid::Uuid::parse_str(value).is_ok() {
        Ok(())
    } else {
        Err("Workspace ID is invalid.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::{validate_name, validate_privacy, validate_updates};
    use serde_json::json;

    #[test]
    fn workspace_commands_validate_names_privacy_and_update_fields() {
        assert_eq!(validate_name("  Team room  ").unwrap(), "Team room");
        assert!(validate_name("  ").is_err());
        assert!(validate_name(&"x".repeat(121)).is_err());
        assert!(validate_privacy("private").is_ok());
        assert!(validate_privacy("public").is_err());
        assert_eq!(
            validate_updates(json!({ "name": " New name " })).unwrap(),
            json!({ "name": "New name" })
        );
        assert!(validate_updates(json!({ "unknown": true })).is_err());
        assert!(validate_updates(json!({})).is_err());
    }
}
