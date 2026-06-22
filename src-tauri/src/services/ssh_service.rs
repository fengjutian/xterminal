/// SSH service — manages SSH connections via russh 0.44.
///
/// Provides connect, disconnect, write, and resize operations.
/// Terminal output is forwarded to the frontend via Tauri events ("ssh-terminal-output").
///
/// Host key verification:
/// - Known keys (fingerprint matches) → accepted automatically
/// - Unknown keys → "host-key-confirm" event sent to frontend, user decides
/// - Key mismatch → "host-key-changed" event sent to frontend, user decides
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::sync::oneshot;
use tauri::Emitter;

use russh::client::{self, Handler, Msg};
use russh::Channel;
use russh::ChannelId;
use russh_keys::load_secret_key;
use async_trait::async_trait;
use encoding_rs::{UTF_8, GBK, BIG5, SHIFT_JIS, EUC_KR};

use crate::models::connection::HostKeyVerificationPayload;
use crate::models::connection::HostKeyChangedPayload;

/// Convert an encoding string (e.g. "UTF-8", "GBK") to the corresponding encoding_rs encoding.
fn encoding_from_str(name: &str) -> &'static encoding_rs::Encoding {
    match name.trim().to_uppercase().as_str() {
        "GBK" | "GB2312" | "GB18030" | "CP936" => GBK,
        "BIG5" | "BIG-5" => BIG5,
        "SHIFT_JIS" | "SHIFT-JIS" | "SJIS" | "CP932" => SHIFT_JIS,
        "EUC_KR" | "EUC-KR" | "CP949" => EUC_KR,
        "ISO_8859_1" | "ISO-8859-1" | "LATIN1" | "CP28591" => UTF_8,
        _ => UTF_8, // default to UTF-8
    }
}

/// Map a PublicKey enum variant to its standard SSH algorithm name.
fn key_algorithm_name(key: &russh_keys::key::PublicKey) -> &'static str {
    key.name()
}

// ---------------------------------------------------------------------------
// Shared pending key confirmations — resolved by ssh_confirm_host_key command
// ---------------------------------------------------------------------------
pub type PendingKeyMap = Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>;

/// Host key confirmation timeout (120 seconds).
/// If the user does not respond within this window the connection is rejected.
const HOST_KEY_TIMEOUT_SECS: u64 = 120;

// ---------------------------------------------------------------------------
// Session handle stored in the service map
// ---------------------------------------------------------------------------
pub struct SshSession {
    handle: client::Handle<SshClientHandler>,
    channel: Channel<Msg>,
    read_task: tokio::task::JoinHandle<()>,
    encoding: &'static encoding_rs::Encoding,
}

// ---------------------------------------------------------------------------
// russh client Handler — bridges russh callbacks into our event system
// ---------------------------------------------------------------------------
#[derive(Clone)]
struct SshClientHandler {
    app_handle: tauri::AppHandle,
    session_id: String,
    host: String,
    port: u16,
    encoding: &'static encoding_rs::Encoding,
    known_fingerprint: Option<String>,
    pending_keys: PendingKeyMap,
}

#[async_trait]
impl Handler for SshClientHandler {
    type Error = anyhow::Error;

    /// Server key verification with known_hosts support.
    ///
    /// 1. Compute SHA-256 fingerprint of the server's public key
    /// 2. If a known fingerprint exists:
    ///    - Match → accept (return true)
    ///    - Mismatch → emit "host-key-changed" event, wait for user decision
    /// 3. If no known fingerprint (first connection):
    ///    - Emit "host-key-confirm" event to frontend
    ///    - Wait for user decision via oneshot channel (with 120s timeout)
    async fn check_server_key(
        &mut self,
        server_public_key: &russh_keys::key::PublicKey,
    ) -> Result<bool, Self::Error> {
        let algorithm = key_algorithm_name(server_public_key);
        let fingerprint = server_public_key.fingerprint();

        log::info!(
            "[ssh {}] Server key: {} fingerprint={}",
            self.session_id, algorithm, fingerprint
        );

        // Check against known fingerprint
        if let Some(ref known) = self.known_fingerprint {
            if *known == fingerprint {
                log::info!(
                    "[ssh {}] Host key matches known fingerprint — accepted",
                    self.session_id
                );
                return Ok(true);
            }

            // Key mismatch — possible MITM, ask user to decide
            log::warn!(
                "[ssh {}] HOST KEY MISMATCH! known={} received={}",
                self.session_id, known, fingerprint
            );

            // Store a oneshot sender so ssh_confirm_host_key can resolve it
            let (tx, rx) = oneshot::channel();
            {
                let mut map = self.pending_keys.lock().await;
                map.insert(self.session_id.clone(), tx);
            }

            let _ = self.app_handle.emit(
                "host-key-changed",
                &HostKeyChangedPayload {
                    session_id: self.session_id.clone(),
                    host: self.host.clone(),
                    port: self.port,
                    key_type: algorithm.to_string(),
                    expected_fingerprint: known.clone(),
                    received_fingerprint: fingerprint,
                },
            );

            log::info!(
                "[ssh {}] Waiting for user to decide on host key mismatch...",
                self.session_id
            );

            // Wait for the user's decision (with timeout)
            return match tokio::time::timeout(Duration::from_secs(HOST_KEY_TIMEOUT_SECS), rx).await
            {
                Ok(Ok(true)) => {
                    log::info!(
                        "[ssh {}] User accepted new host key — connecting",
                        self.session_id
                    );
                    Ok(true)
                }
                Ok(Ok(false)) => {
                    log::info!(
                        "[ssh {}] User rejected host key — aborting",
                        self.session_id
                    );
                    Ok(false)
                }
                Ok(Err(_)) => {
                    log::warn!(
                        "[ssh {}] Host key confirmation channel closed — rejecting",
                        self.session_id
                    );
                    Ok(false)
                }
                Err(_) => {
                    log::warn!(
                        "[ssh {}] Host key confirmation timed out after {}s — rejecting",
                        self.session_id,
                        HOST_KEY_TIMEOUT_SECS
                    );
                    Ok(false)
                }
            };
        }

        // Unknown host key — ask user to confirm
        let (tx, rx) = oneshot::channel();
        {
            let mut map = self.pending_keys.lock().await;
            map.insert(self.session_id.clone(), tx);
        }

        let payload = HostKeyVerificationPayload {
            session_id: self.session_id.clone(),
            host: self.host.clone(),
            port: self.port,
            key_type: algorithm.to_string(),
            fingerprint,
        };

        let _ = self.app_handle.emit("host-key-confirm", &payload);

        log::info!(
            "[ssh {}] Waiting for user to confirm unknown host key...",
            self.session_id
        );

        // Wait for the user's decision (with timeout)
        match tokio::time::timeout(Duration::from_secs(HOST_KEY_TIMEOUT_SECS), rx).await {
            Ok(Ok(true)) => {
                log::info!(
                    "[ssh {}] User accepted host key — connecting",
                    self.session_id
                );
                Ok(true)
            }
            Ok(Ok(false)) => {
                log::info!(
                    "[ssh {}] User rejected host key — aborting",
                    self.session_id
                );
                Ok(false)
            }
            Ok(Err(_)) => {
                log::warn!(
                    "[ssh {}] Host key confirmation channel closed — rejecting",
                    self.session_id
                );
                Ok(false)
            }
            Err(_) => {
                log::warn!(
                    "[ssh {}] Host key confirmation timed out after {}s — rejecting",
                    self.session_id,
                    HOST_KEY_TIMEOUT_SECS
                );
                Ok(false)
            }
        }
    }

    /// Called when the server sends data on a channel
    async fn data(
        &mut self,
        _channel: ChannelId,
        data: &[u8],
        _session: &mut russh::client::Session,
    ) -> Result<(), Self::Error> {
        // Convert from the configured encoding (e.g. GBK) to UTF-8 for xterm.js
        let (decoded, _, _) = self.encoding.decode(data);
        let utf8_data = decoded.as_bytes().to_vec();
        let _ = self.app_handle.emit(
            "ssh-terminal-output",
            serde_json::json!({
                "session_id": self.session_id,
                "data": utf8_data,
            }),
        );
        Ok(())
    }

    /// Called when the server closes a channel
    async fn channel_eof(
        &mut self,
        _channel: ChannelId,
        _session: &mut russh::client::Session,
    ) -> Result<(), Self::Error> {
        log::info!("[ssh {}] Channel EOF received", self.session_id);
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// SSH Service
// ---------------------------------------------------------------------------
pub struct SshService {
    pub sessions: Arc<Mutex<HashMap<String, SshSession>>>,
}

impl SshService {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Connect to a remote host via SSH.
    ///
    /// This is an associated function (not a method) so callers can pass the
    /// `sessions` map directly without holding the SshState outer lock. This
    /// prevents the lock from being held across the entire SSH handshake (which
    /// can block for minutes during host key confirmation).
    ///
    /// Supports password and private-key authentication.
    /// A PTY is allocated and a shell is started.
    /// Terminal output is emitted as "ssh-terminal-output" events.
    /// The `encoding` parameter specifies the remote server's text encoding (e.g. "UTF-8", "GBK").
    ///
    /// `known_fingerprint` should be `Some(fp)` when a stored host key exists,
    /// or `None` for unknown hosts (triggers user confirmation dialog).
    ///
    /// `pending_keys` is the shared map used to resolve host key confirmations
    /// via the `ssh_confirm_host_key` Tauri command.
    pub async fn connect(
        sessions: &Arc<Mutex<HashMap<String, SshSession>>>,
        host: &str,
        port: u16,
        username: &str,
        password: Option<&str>,
        private_key_path: Option<&str>,
        passphrase: Option<&str>,
        _timeout_secs: u32,
        _keep_alive_secs: u32,
        encoding: &str,
        known_fingerprint: Option<String>,
        pending_keys: PendingKeyMap,
        app_handle: tauri::AppHandle,
    ) -> Result<String, String> {
        let session_id = uuid::Uuid::new_v4().to_string();
        let enc = encoding_from_str(encoding);

        let addr = format!("{}:{}", host, port);

        // Build client config
        let config = client::Config::default();
        let config = Arc::new(config);

        // Create handler with host key verification support
        let handler = SshClientHandler {
            app_handle: app_handle.clone(),
            session_id: session_id.clone(),
            host: host.to_string(),
            port,
            encoding: enc,
            known_fingerprint,
            pending_keys,
        };

        log::info!("[ssh {}] Connecting to {}...", session_id, addr);

        // Connect — this triggers check_server_key during key exchange
        let mut handle = russh::client::connect(config, &addr, handler)
            .await
            .map_err(|e| format!("SSH connection failed: {:#}", e))?;

        // Authenticate
        let authenticated = if let Some(key_path) = private_key_path {
            // Key-based authentication
            let key_pair = load_secret_key(key_path, passphrase)
                .map_err(|e| format!("Failed to load private key '{}': {}", key_path, e))?;
            handle
                .authenticate_publickey(username, Arc::new(key_pair))
                .await
                .map_err(|e| format!("SSH authentication failed (key): {:#}", e))?
        } else if let Some(pwd) = password {
            // Password authentication
            handle
                .authenticate_password(username, pwd)
                .await
                .map_err(|e| format!("SSH authentication failed (password): {:#}", e))?
        } else {
            return Err(
                "No authentication method provided (password or private key required)".to_string(),
            );
        };

        if !authenticated {
            return Err("SSH authentication rejected".to_string());
        }

        log::info!("[ssh {}] Authenticated as {}", session_id, username);

        // Open a session channel
        let channel = handle
            .channel_open_session()
            .await
            .map_err(|e| format!("Failed to open SSH channel: {:#}", e))?;

        // Request PTY
        channel
            .request_pty(
                false,
                std::env::var("TERM").as_deref().unwrap_or("xterm-256color"),
                80,
                24,
                0,
                0,
                &[],
            )
            .await
            .map_err(|e| format!("Failed to request PTY: {:#}", e))?;

        // Start shell
        channel
            .request_shell(false)
            .await
            .map_err(|e| format!("Failed to start shell: {:#}", e))?;

        log::info!("[ssh {}] Shell started on {}", session_id, host);

        let session = SshSession {
            handle,
            channel,
            read_task: tokio::spawn(async {}), // placeholder — russh drives reads internally
            encoding: enc,
        };

        sessions
            .lock()
            .await
            .insert(session_id.clone(), session);

        Ok(session_id)
    }

    /// Write data to a connected SSH session (stdin).
    /// Converts input from UTF-8 to the session's configured encoding.
    pub async fn write(&self, session_id: &str, data: &[u8]) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("SSH session {} not found", session_id))?;

        // Convert from UTF-8 to the remote server's encoding
        let (decoded, _, _) = UTF_8.decode(data);
        let (encoded, _, _) = session.encoding.encode(&decoded);
        let encoded: Vec<u8> = encoded.into_owned();

        session
            .channel
            .data(&encoded[..])
            .await
            .map_err(|e| format!("Failed to write to SSH channel: {:#}", e))?;

        Ok(())
    }

    /// Resize the PTY for a connected SSH session.
    pub async fn resize(
        &self,
        session_id: &str,
        cols: u16,
        rows: u16,
    ) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("SSH session {} not found", session_id))?;

        // In russh 0.44, resize is done via window_change
        session
            .channel
            .window_change(cols as u32, rows as u32, 0, 0)
            .await
            .map_err(|e| format!("Failed to resize PTY: {:#}", e))?;

        Ok(())
    }

    /// Disconnect and clean up an SSH session.
    pub async fn disconnect(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;

        if let Some(session) = sessions.remove(session_id) {
            log::info!("[ssh {}] Disconnecting", session_id);
            // Close the channel gracefully
            let _ = session.channel.eof().await;
            let _ = session
                .handle
                .disconnect(russh::Disconnect::ByApplication, "", "User disconnected");
            // Cancel the read task
            session.read_task.abort();
        }

        Ok(())
    }
}
