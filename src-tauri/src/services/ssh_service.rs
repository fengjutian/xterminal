/// SSH service — manages SSH connections via russh 0.44.
///
/// Provides connect, disconnect, write, and resize operations.
/// Terminal output is forwarded to the frontend via Tauri events ("ssh-terminal-output").
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::Emitter;

use russh::client::{self, Handler, Msg};
use russh::Channel;
use russh::ChannelId;
use russh_keys::load_secret_key;
use async_trait::async_trait;

// ---------------------------------------------------------------------------
// Session handle stored in the service map
// ---------------------------------------------------------------------------
struct SshSession {
    handle: client::Handle<SshClientHandler>,
    channel: Channel<Msg>,
    read_task: tokio::task::JoinHandle<()>,
}

// ---------------------------------------------------------------------------
// russh client Handler — bridges russh callbacks into our event system
// ---------------------------------------------------------------------------
#[derive(Clone)]
struct SshClientHandler {
    app_handle: tauri::AppHandle,
    session_id: String,
}

#[async_trait]
impl Handler for SshClientHandler {
    type Error = anyhow::Error;

    /// Server key verification — accept all keys for now (TODO: known_hosts)
    async fn check_server_key(
        &mut self,
        _server_public_key: &russh_keys::key::PublicKey,
    ) -> Result<bool, Self::Error> {
        log::info!(
            "[ssh {}] Accepting server key (verification skipped)",
            self.session_id
        );
        Ok(true)
    }

    /// Called when the server sends data on a channel
    async fn data(
        &mut self,
        _channel: ChannelId,
        data: &[u8],
        _session: &mut russh::client::Session,
    ) -> Result<(), Self::Error> {
        let _ = self.app_handle.emit(
            "ssh-terminal-output",
            serde_json::json!({
                "session_id": self.session_id,
                "data": data,
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
    sessions: Arc<Mutex<HashMap<String, SshSession>>>,
}

impl SshService {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Connect to a remote host via SSH.
    ///
    /// Supports password and private-key authentication.
    /// A PTY is allocated and a shell is started.
    /// Terminal output is emitted as "ssh-terminal-output" events.
    pub async fn connect(
        &self,
        host: &str,
        port: u16,
        username: &str,
        password: Option<&str>,
        private_key_path: Option<&str>,
        passphrase: Option<&str>,
        _timeout_secs: u32,
        _keep_alive_secs: u32,
        app_handle: tauri::AppHandle,
    ) -> Result<String, String> {
        let session_id = uuid::Uuid::new_v4().to_string();

        let addr = format!("{}:{}", host, port);

        // Build client config
        let config = client::Config::default();
        let config = Arc::new(config);

        // Create handler
        let handler = SshClientHandler {
            app_handle: app_handle.clone(),
            session_id: session_id.clone(),
        };

        log::info!("[ssh {}] Connecting to {}...", session_id, addr);

        // Connect
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
        };

        self.sessions
            .lock()
            .await
            .insert(session_id.clone(), session);

        Ok(session_id)
    }

    /// Write data to a connected SSH session (stdin).
    pub async fn write(&self, session_id: &str, data: &[u8]) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("SSH session {} not found", session_id))?;

        session
            .channel
            .data(data)
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
