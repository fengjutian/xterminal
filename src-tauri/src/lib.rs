pub mod commands;
pub mod models;
pub mod services;
pub mod store;
pub mod security;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            log::info!("X-Terminal starting up...");
            // Initialize database and store connection in state
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match store::database::init_database(&app_handle).await {
                    Ok(conn) => {
                        let db_state = app_handle.state::<commands::connection::DatabaseState>();
                        *db_state.0.lock().await = Some(conn);
                    }
                    Err(e) => {
                        log::error!("Failed to initialize database: {}", e);
                    }
                }
            });
            Ok(())
        })
        .manage(commands::connection::DatabaseState::default())
        .manage(commands::local_shell::LocalShellState::new())
        .manage(commands::ssh::SshState::new())
        .invoke_handler(tauri::generate_handler![
            commands::connection::list_connections,
            commands::connection::create_connection,
            commands::connection::update_connection,
            commands::connection::delete_connection,
            commands::ssh::ssh_connect,
            commands::ssh::ssh_disconnect,
            commands::ssh::ssh_write,
            commands::ssh::ssh_resize,
            commands::sftp::sftp_list_files,
            commands::sftp::sftp_upload_file,
            commands::sftp::sftp_download_file,
            commands::sftp::sftp_create_directory,
            commands::sftp::sftp_delete_file,
            commands::sftp::sftp_rename_file,
            commands::ftp::ftp_connect,
            commands::ftp::ftp_disconnect,
            commands::ftp::ftp_list_files,
            commands::ftp::ftp_upload_file,
            commands::ftp::ftp_download_file,
            commands::local_shell::local_shell_spawn,
            commands::local_shell::local_shell_write,
            commands::local_shell::local_shell_resize,
            commands::local_shell::local_shell_kill,
            commands::config::get_app_settings,
            commands::config::update_app_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
