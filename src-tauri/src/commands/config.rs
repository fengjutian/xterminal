use crate::models::config::AppSettings;
use crate::store::database;
use tauri::State;
use crate::commands::connection::DatabaseState;

/// Get application settings
#[tauri::command]
pub async fn get_app_settings(
    db: State<'_, DatabaseState>,
) -> Result<AppSettings, String> {
    let conn_opt = db.0.lock().await;
    let conn = conn_opt.as_ref().ok_or("Database not initialized")?;
    database::settings::get(conn).map_err(|e| e.to_string())
}

/// Update application settings
#[tauri::command]
pub async fn update_app_settings(
    db: State<'_, DatabaseState>,
    settings: AppSettings,
) -> Result<(), String> {
    let mut conn_opt = db.0.lock().await;
    let conn = conn_opt.as_mut().ok_or("Database not initialized")?;
    database::settings::save(conn, &settings).map_err(|e| e.to_string())
}
