use crate::models::connection::ConnectionConfig;
use crate::services::ssh_service::SshService;
use crate::services::ssh_service::PendingKeyMap;
use crate::store::database;
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct SshState(pub Arc<Mutex<SshService>>);

impl SshState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(SshService::new())))
    }
}

/// Shared pending key confirmations — separate from SshState to avoid deadlocks.
/// `ssh_confirm_host_key` reads this to resolve while `ssh_connect` is blocked
/// inside `check_server_key` waiting for user input.
pub struct PendingKeyState(pub PendingKeyMap);

impl PendingKeyState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(std::collections::HashMap::new())))
    }
}

/// Connect to remote server via SSH (quick connect)
///
/// IMPORTANT: The `SshState` lock is NOT held across the SSH handshake.
/// We clone the sessions Arc, drop the lock, then call the static
/// `SshService::connect()` function. This prevents deadlocks when the
/// handshake blocks on host key confirmation (up to 120s timeout).
#[tauri::command]
pub async fn ssh_connect(
    state: State<'_, SshState>,
    db: State<'_, crate::commands::connection::DatabaseState>,
    pending: State<'_, PendingKeyState>,
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
    // Look up known host key from DB
    let known_fingerprint = {
        let conn_opt = db.0.lock().await;
        if let Some(conn) = conn_opt.as_ref() {
            database::host_keys::get_host_key(conn, &host, port)
                .ok()
                .flatten()
                .map(|info| info.fingerprint)
        } else {
            None
        }
    };

    // Clone the sessions Arc and drop the SshState lock immediately.
    // The connect call (which may block on host key confirmation for 120s)
    // must NOT hold the SshState lock.
    let sessions = state.0.lock().await.sessions.clone();
    // lock released — sessions Arc is independent

    SshService::connect(
        &sessions,
        &host,
        port,
        &username,
        password.as_deref(),
        private_key_path.as_deref(),
        passphrase.as_deref(),
        timeout_secs.unwrap_or(30),
        keep_alive_secs.unwrap_or(60),
        encoding.as_deref().unwrap_or("UTF-8"),
        known_fingerprint,
        pending.0.clone(),
        app_handle,
    )
    .await
}

/// Connect using a saved connection config
#[tauri::command]
pub async fn ssh_connect_from_config(
    state: State<'_, SshState>,
    db: State<'_, crate::commands::connection::DatabaseState>,
    pending: State<'_, PendingKeyState>,
    app_handle: tauri::AppHandle,
    config_id: String,
) -> Result<String, String> {
    // Fetch the connection config and known host key from the database
    let (config, known_fingerprint) = {
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

        // Look up known host key
        let known_fp = database::host_keys::get_host_key(conn, &config.host, config.port)
            .ok()
            .flatten()
            .map(|info| info.fingerprint);

        (config, known_fp)
    };

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

    // Clone sessions Arc and drop SshState lock before the potentially
    // blocking connect call (host key confirmation can take up to 120s).
    let sessions = state.0.lock().await.sessions.clone();

    SshService::connect(
        &sessions,
        &config.host,
        config.port,
        &config.username,
        password.as_deref(),
        config.private_key_path.as_deref(),
        passphrase.as_deref(),
        config.connection_timeout,
        config.keep_alive_interval,
        &config.encoding,
        known_fingerprint,
        pending.0.clone(),
        app_handle,
    )
    .await
}

/// Confirm or reject a pending SSH host key verification.
#[tauri::command]
pub async fn ssh_confirm_host_key(
    pending: State<'_, PendingKeyState>,
    db: State<'_, crate::commands::connection::DatabaseState>,
    session_id: String,
    accept: bool,
    host: String,
    port: u16,
    key_type: String,
    fingerprint: String,
) -> Result<(), String> {
    // Resolve the pending key confirmation from the shared map
    {
        let mut map = pending.0.lock().await;
        match map.remove(&session_id) {
            Some(sender) => {
                sender.send(accept).map_err(|_| {
                    "Failed to send key confirmation — connection may have timed out".to_string()
                })?;
            }
            None => {
                // This can happen if the user clicks "Accept Anyway" or "Cancel"
                // twice, or if the handshake already timed out. Not an error —
                // just log and continue.
                log::warn!(
                    "No pending key confirmation for session {} (already resolved or timed out)",
                    session_id
                );
                return Ok(());
            }
        }
    }

    // If accepted, save the host key to the database
    if accept {
        let mut conn_opt = db.0.lock().await;
        if let Some(conn) = conn_opt.as_mut() {
            database::host_keys::save_host_key(conn, &host, port, &key_type, &fingerprint)?;
            log::info!("Saved host key for {}:{} — fingerprint={}", host, port, fingerprint);
        } else {
            log::warn!("Cannot save host key: database not initialized");
        }
    }

    Ok(())
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
