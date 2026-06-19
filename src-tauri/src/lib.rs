pub mod commands;
pub mod models;
pub mod services;
pub mod store;
pub mod security;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            log::info!("X-Terminal starting up...");
            // Initialize database
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = store::database::init_database(app_handle).await {
                    log::error!("Failed to initialize database: {}", e);
                }
            });
            Ok(())
        })
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
            commands::config::get_app_settings,
            commands::config::update_app_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
