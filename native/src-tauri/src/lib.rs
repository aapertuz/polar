mod application_auth;
mod mission_api;
mod mission_context;
mod providers;
mod workspace_api;
mod workspace_context_api;
use application_auth::*;
use mission_api::*;
use mission_context::*;
use providers::*;
use tauri::Manager;
use workspace_api::*;
use workspace_context_api::*;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            std::fs::create_dir_all(&directory)?;
            app.manage(ApplicationAuthState::new(directory.clone())?);
            app.manage(ProviderState::with_lock_path(
                directory.join("chatgpt.lock"),
            ));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            polar_auth_status,
            polar_auth_connect,
            polar_auth_cancel,
            polar_auth_sign_out,
            chatgpt_status,
            chatgpt_acknowledge_plan,
            chatgpt_connect,
            chatgpt_cancel,
            chatgpt_select_account,
            chatgpt_models,
            chatgpt_select_model,
            chatgpt_test,
            polar_ai_work_once,
            polar_ai_cancel,
            polar_import_mission_context,
            polar_import_workspace_context,
            polar_workspace_context_get,
            polar_workspace_context_save_brief,
            polar_workspace_context_source_add,
            polar_workspace_context_source_replace,
            polar_workspace_context_source_archive,
            polar_workspace_select,
            polar_workspace_create,
            polar_workspace_update,
            polar_workspace_delete,
            polar_workspace_set_default,
            polar_mission_drafts,
            polar_mission_draft_get,
            polar_mission_draft_create,
            polar_mission_draft_send_message,
            polar_mission_source_add,
            polar_mission_source_remove,
            polar_mission_activate,
            polar_missions,
            polar_mission_action_update,
            polar_mission_regenerate,
            polar_mission_reasoning_cancel,
            polar_mission_reasoning_retry,
            chatgpt_disconnect
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if matches!(_event, tauri::RunEvent::Reopen { .. }) {
                if let Some(window) = _app.get_webview_window("main") {
                    // Launch Services reopening an already-running app must restore
                    // its window, including when it is minimized or the app is hidden.
                    let restored = _app
                        .show()
                        .and_then(|()| window.unminimize())
                        .and_then(|()| window.show())
                        .and_then(|()| window.set_focus());
                    if let Err(error) = restored {
                        eprintln!("Failed to restore Polar's main window on reopen: {error}");
                    }
                }
            }
        });
}
