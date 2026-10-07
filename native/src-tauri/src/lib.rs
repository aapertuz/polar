mod providers;
use providers::*;
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            std::fs::create_dir_all(&directory)?;
            app.manage(ProviderState::with_lock_path(
                directory.join("chatgpt.lock"),
            ));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            chatgpt_status,
            chatgpt_acknowledge_plan,
            chatgpt_connect,
            chatgpt_cancel,
            chatgpt_select_account,
            chatgpt_models,
            chatgpt_select_model,
            chatgpt_test,
            chatgpt_disconnect
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
