use crate::models::config::AppSettings;
use crate::store::database;
use tauri::State;
use crate::commands::connection::DatabaseState;

/// Get application settings
#[tauri::command]
pub async fn get_app_settings(
    db: State<'_, DatabaseState>,
) -> Result<AppSettings, String> {
    let conn = db.0.lock().await;
    database::settings::get(&conn).map_err(|e| e.to_string())
}

/// Update application settings
#[tauri::command]
pub async fn update_app_settings(
    db: State<'_, DatabaseState>,
    settings: AppSettings,
) -> Result<(), String> {
    let mut conn = db.0.lock().await;
    database::settings::save(&mut conn, &settings).map_err(|e| e.to_string())
}
