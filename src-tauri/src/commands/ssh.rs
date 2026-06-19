use crate::services::ssh_service::SshService;
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct SshState(pub Arc<Mutex<SshService>>);

impl SshState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(SshService::new())))
    }
}

/// Connect to remote server via SSH
#[tauri::command]
pub async fn ssh_connect(
    state: State<'_, SshState>,
    app_handle: tauri::AppHandle,
    host: String,
    port: u16,
    username: String,
    password: Option<String>,
    private_key_path: Option<String>,
    passphrase: Option<String>,
    timeout_secs: u32,
    keep_alive_secs: u32,
) -> Result<String, String> {
    let service = state.0.lock().await;
    service
        .connect(
            &host,
            port,
            &username,
            password.as_deref(),
            private_key_path.as_deref(),
            passphrase.as_deref(),
            timeout_secs,
            keep_alive_secs,
            app_handle,
        )
        .await
}

/// Disconnect an SSH session
#[tauri::command]
pub async fn ssh_disconnect(
    state: State<'_, SshState>,
    session_id: String,
) -> Result<(), String> {
    let service = state.0.lock().await;
    service.disconnect(&session_id).await
}

/// Write input to SSH terminal
#[tauri::command]
pub async fn ssh_write(
    state: State<'_, SshState>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    let service = state.0.lock().await;
    service.write(&session_id, &data).await
}

/// Resize SSH PTY
#[tauri::command]
pub async fn ssh_resize(
    state: State<'_, SshState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let service = state.0.lock().await;
    service.resize(&session_id, cols, rows).await
}
