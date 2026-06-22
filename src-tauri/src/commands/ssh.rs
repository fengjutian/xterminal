use crate::models::connection::ConnectionConfig;
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

/// Connect to remote server via SSH (quick connect)
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
    timeout_secs: Option<u32>,
    keep_alive_secs: Option<u32>,
    encoding: Option<String>,
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
            timeout_secs.unwrap_or(30),
            keep_alive_secs.unwrap_or(60),
            encoding.as_deref().unwrap_or("UTF-8"),
            app_handle,
        )
        .await
}

/// Connect using a saved connection config
#[tauri::command]
pub async fn ssh_connect_from_config(
    state: State<'_, SshState>,
    db: State<'_, crate::commands::connection::DatabaseState>,
    app_handle: tauri::AppHandle,
    config_id: String,
) -> Result<String, String> {
    // Fetch the connection config from the database
    let conn_opt = db.0.lock().await;
    let conn = conn_opt.as_ref().ok_or("Database not initialized")?;

    let config: ConnectionConfig = {
        use rusqlite::params;
        let mut stmt = conn
            .prepare(
                "SELECT id, name, group_id, host, port, username, auth_method,
                        private_key_path, keyring_id, encoding, keep_alive_interval,
                        connection_timeout, sort_order, created_at, updated_at
                 FROM connections WHERE id = ?1",
            )
            .map_err(|e| e.to_string())?;

        stmt.query_row(params![config_id], |row| {
            Ok(ConnectionConfig {
                id: row.get(0)?,
                name: row.get(1)?,
                group_id: row.get(2)?,
                host: row.get(3)?,
                port: row.get(4)?,
                username: row.get(5)?,
                auth_method: {
                    let s: String = row.get(6)?;
                    match s.as_str() {
                        "password" => crate::models::connection::AuthMethod::Password,
                        "key" => crate::models::connection::AuthMethod::KeyFile,
                        "key_with_passphrase" => crate::models::connection::AuthMethod::KeyFileWithPassphrase,
                        _ => crate::models::connection::AuthMethod::Password,
                    }
                },
                private_key_path: row.get(7)?,
                keyring_id: row.get(8)?,
                encoding: row.get(9)?,
                keep_alive_interval: row.get(10)?,
                connection_timeout: row.get(11)?,
                sort_order: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })
        .map_err(|e| format!("Connection config not found: {}", e))?
    };

    drop(conn_opt);

    // Resolve password/key from keyring if available
    let (password, passphrase) = if let Some(ref kid) = config.keyring_id {
        match crate::security::keyring::get_credential(kid) {
            Ok(secret) => {
                match config.auth_method {
                    crate::models::connection::AuthMethod::Password => (Some(secret), None),
                    _ => (None, Some(secret)), // passphrase for key
                }
            }
            Err(e) => {
                log::warn!("Failed to retrieve keyring credential for '{}': {}", kid, e);
                return Err(format!("Failed to retrieve saved credential: {}. Please edit the connection and re-enter your password/passphrase.", e));
            }
        }
    } else {
        (None, None)
    };

    let service = state.0.lock().await;
    service
        .connect(
            &config.host,
            config.port,
            &config.username,
            password.as_deref(),
            config.private_key_path.as_deref(),
            passphrase.as_deref(),
            config.connection_timeout,
            config.keep_alive_interval,
            &config.encoding,
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
