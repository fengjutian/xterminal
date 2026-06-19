use crate::models::connection::{
    ConnectionConfig, CreateConnectionPayload, UpdateConnectionPayload,
};
use crate::store::database;
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct DatabaseState(pub Arc<Mutex<Option<rusqlite::Connection>>>);

impl Default for DatabaseState {
    fn default() -> Self {
        Self(Arc::new(Mutex::new(None)))
    }
}

#[tauri::command]
pub async fn list_connections(
    db: State<'_, DatabaseState>,
) -> Result<Vec<ConnectionConfig>, String> {
    let conn_opt = db.0.lock().await;
    let conn = conn_opt.as_ref().ok_or("Database not initialized")?;
    database::connections::list_all(conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_connection(
    db: State<'_, DatabaseState>,
    payload: CreateConnectionPayload,
) -> Result<ConnectionConfig, String> {
    let mut conn_opt = db.0.lock().await;
    let conn = conn_opt.as_mut().ok_or("Database not initialized")?;
    database::connections::create(conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_connection(
    db: State<'_, DatabaseState>,
    payload: UpdateConnectionPayload,
) -> Result<ConnectionConfig, String> {
    let mut conn_opt = db.0.lock().await;
    let conn = conn_opt.as_mut().ok_or("Database not initialized")?;
    database::connections::update(conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_connection(
    db: State<'_, DatabaseState>,
    id: String,
) -> Result<(), String> {
    let mut conn_opt = db.0.lock().await;
    let conn = conn_opt.as_mut().ok_or("Database not initialized")?;
    database::connections::delete(conn, &id).map_err(|e| e.to_string())
}
