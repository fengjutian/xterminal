use crate::services::local_shell::LocalShellService;
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct LocalShellState(pub Arc<Mutex<LocalShellService>>);

impl LocalShellState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(LocalShellService::new())))
    }
}

/// Spawn a new local terminal shell
#[tauri::command]
pub async fn local_shell_spawn(
    state: State<'_, LocalShellState>,
    app_handle: tauri::AppHandle,
    cols: u16,
    rows: u16,
) -> Result<String, String> {
    let service = state.0.lock().await;
    service.spawn_shell(cols, rows, app_handle).await
}

/// Write input to a local terminal
#[tauri::command]
pub async fn local_shell_write(
    state: State<'_, LocalShellState>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    let service = state.0.lock().await;
    service.write_to_shell(&session_id, &data).await
}

/// Resize a local terminal PTY
#[tauri::command]
pub async fn local_shell_resize(
    state: State<'_, LocalShellState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let service = state.0.lock().await;
    service.resize_shell(&session_id, cols, rows).await
}

/// Kill a local terminal shell
#[tauri::command]
pub async fn local_shell_kill(
    state: State<'_, LocalShellState>,
    session_id: String,
) -> Result<(), String> {
    let service = state.0.lock().await;
    service.kill_shell(&session_id).await
}
