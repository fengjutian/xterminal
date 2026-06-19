use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::models::connection::SshSession;

/// In-memory session registry: session_id -> SshSession
pub struct SessionRegistry {
    pub sessions: Arc<Mutex<Vec<SshSession>>>,
}

impl SessionRegistry {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

/// Connect to remote server via SSH
/// Returns session ID on success
#[tauri::command]
pub async fn ssh_connect(
    _registry: State<'_, SessionRegistry>,
    connection_id: String,
    host: String,
    port: u16,
    username: String,
    _password: Option<String>,
    _private_key_path: Option<String>,
    _passphrase: Option<String>,
    _timeout_secs: u32,
    _keep_alive_secs: u32,
) -> Result<String, String> {
    // TODO: Implement SSH connection via russh
    let session_id = uuid::Uuid::new_v4().to_string();

    let session = SshSession {
        id: session_id.clone(),
        connection_id,
        name: format!("{}@{}", username, host),
        host: format!("{}:{}", host, port),
        state: crate::models::connection::ConnectionState::Connecting,
        connected_at: None,
    };

    let mut sessions = _registry.sessions.lock().await;
    sessions.push(session);

    // Placeholder: real implementation in ssh_service.rs
    Err("SSH connection not yet implemented".to_string())
}

/// Disconnect an SSH session
#[tauri::command]
pub async fn ssh_disconnect(
    _registry: State<'_, SessionRegistry>,
    session_id: String,
) -> Result<(), String> {
    let mut sessions = _registry.sessions.lock().await;
    sessions.retain(|s| s.id != session_id);
    Ok(())
}

/// Write input to terminal (send keystrokes to SSH channel)
#[tauri::command]
pub async fn ssh_write(
    session_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    // TODO: Forward data to SSH channel
    let _ = (session_id, data);
    Err("SSH write not yet implemented".to_string())
}

/// Resize PTY terminal dimensions
#[tauri::command]
pub async fn ssh_resize(
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    // TODO: Resize PTY on SSH channel
    let _ = (session_id, cols, rows);
    Ok(())
}
