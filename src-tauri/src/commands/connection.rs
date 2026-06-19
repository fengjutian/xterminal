use crate::models::connection::{
    ConnectionConfig, CreateConnectionPayload, UpdateConnectionPayload,
};
use crate::store::database;
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct DatabaseState(pub Arc<Mutex<rusqlite::Connection>>);

#[tauri::command]
pub async fn list_connections(
    db: State<'_, DatabaseState>,
) -> Result<Vec<ConnectionConfig>, String> {
    let conn = db.0.lock().await;
    database::connections::list_all(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_connection(
    db: State<'_, DatabaseState>,
    payload: CreateConnectionPayload,
) -> Result<ConnectionConfig, String> {
    let mut conn = db.0.lock().await;
    database::connections::create(&mut conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_connection(
    db: State<'_, DatabaseState>,
    payload: UpdateConnectionPayload,
) -> Result<ConnectionConfig, String> {
    let mut conn = db.0.lock().await;
    database::connections::update(&mut conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_connection(
    db: State<'_, DatabaseState>,
    id: String,
) -> Result<(), String> {
    let mut conn = db.0.lock().await;
    database::connections::delete(&mut conn, &id).map_err(|e| e.to_string())
}
