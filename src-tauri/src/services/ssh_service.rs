/// SSH service — manages SSH connections via russh.
///
/// Supports password and private key authentication, PTY channel creation,
/// and bidirectional I/O streaming for terminal sessions.

use russh::*;
use russh::client::{self, Handler, Msg};
use russh_keys::*;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::Mutex;

/// SSH session state
struct SshSession {
    handle: client::Handle<ClientHandler>,
    channel: Option<client::Channel<Msg>>,
}

/// Custom SSH client handler
#[derive(Clone)]
struct ClientHandler {
    app_handle: tauri::AppHandle,
    session_id: String,
}

impl client::Handler for ClientHandler {
    type Error = anyhow::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &ssh_key::PublicKey,
    ) -> Result<bool, Self::Error> {
        let fingerprint = server_public_key.fingerprint(ssh_key::HashAlg::Sha256);
        // Emit event for frontend to verify host key
        let _ = self.app_handle.emit("host-key-verify", serde_json::json!({
            "session_id": self.session_id,
            "fingerprint": fingerprint,
            "key_type": server_public_key.algorithm_name(),
        }));
        // Auto-accept for now (TODO: implement proper known_hosts)
        Ok(true)
    }

    async fn data(
        &mut self,
        _channel: client::ChannelId,
        data: &[u8],
        _session: &mut client::Session,
    ) -> Result<(), Self::Error> {
        let _ = self.app_handle.emit("ssh-terminal-output", serde_json::json!({
            "session_id": self.session_id,
            "data": data,
        }));
        Ok(())
    }
}

pub struct SshService {
    sessions: Arc<Mutex<HashMap<String, SshSession>>>,
}

impl SshService {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Connect to a remote host via SSH
    pub async fn connect(
        &self,
        host: &str,
        port: u16,
        username: &str,
        password: Option<&str>,
        private_key_path: Option<&str>,
        passphrase: Option<&str>,
        timeout_secs: u32,
        keep_alive_secs: u32,
        app_handle: tauri::AppHandle,
    ) -> Result<String, String> {
        let session_id = uuid::Uuid::new_v4().to_string();

        // Configure SSH client
        let config = client::Config {
            connection_timeout: Some(std::time::Duration::from_secs(timeout_secs as u64)),
            keepalive_interval: if keep_alive_secs > 0 {
                Some(std::time::Duration::from_secs(keep_alive_secs as u64))
            } else {
                None
            },
            ..Default::default()
        };

        let config = Arc::new(config);

        // Resolve host
        let addr = format!("{}:{}", host, port);
        let socket = tokio::net::TcpStream::connect(&addr)
            .await
            .map_err(|e| format!("Failed to connect to {}: {}", addr, e))?;

        // Build authentication key pair
        let key_pair = if let Some(key_path) = private_key_path {
            Some(
                russh_keys::load_secret_key(key_path, passphrase)
                    .map_err(|e| format!("Failed to load private key: {}", e))?,
            )
        } else {
            None
        };

        // Create handler
        let handler = ClientHandler {
            app_handle: app_handle.clone(),
            session_id: session_id.clone(),
        };

        // Connect
        let mut handle = client::connect(config, addr, handler)
            .await
            .map_err(|e| format!("SSH handshake failed: {}", e))?;

        // Authenticate
        let auth_result = if let Some(kp) = key_pair {
            handle
                .authenticate_publickey(username, Arc::new(kp))
                .await
        } else if let Some(pw) = password {
            handle
                .authenticate_password(username, pw)
                .await
        } else {
            return Err("No authentication method provided".to_string());
        };

        auth_result.map_err(|e| format!("Authentication failed: {}", e))?;

        // Open a PTY channel
        let pty_request = client::PtyRequest {
            term: "xterm-256color".to_string(),
            col_width: 80,
            row_height: 24,
            pix_width: 0,
            pix_height: 0,
            modes: vec![
                (pty::PtyMode::ECHO, 0),
                (pty::PtyMode::TTY_OP_ISPEED, 38400),
                (pty::PtyMode::TTY_OP_OSPEED, 38400),
            ],
        };

        let channel = handle
            .channel_open_session()
            .await
            .map_err(|e| format!("Failed to open session: {}", e))?;

        channel
            .request_pty(pty_request)
            .await
            .map_err(|e| format!("Failed to request PTY: {}", e))?;

        channel
            .request_shell()
            .await
            .map_err(|e| format!("Failed to request shell: {}", e))?;

        let session = SshSession {
            handle,
            channel: Some(channel),
        };

        self.sessions
            .lock()
            .await
            .insert(session_id.clone(), session);

        Ok(session_id)
    }

    /// Write data to the SSH channel
    pub async fn write(
        &self,
        session_id: &str,
        data: &[u8],
    ) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        if let Some(session) = sessions.get_mut(session_id) {
            if let Some(ref mut channel) = session.channel {
                channel
                    .data(data)
                    .await
                    .map_err(|e| format!("Failed to write: {}", e))?;
            }
        }
        Ok(())
    }

    /// Resize PTY
    pub async fn resize(
        &self,
        session_id: &str,
        cols: u16,
        rows: u16,
    ) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        if let Some(session) = sessions.get_mut(session_id) {
            if let Some(ref mut channel) = session.channel {
                channel
                    .window_change(cols as u32, rows as u32, 0, 0)
                    .await
                    .map_err(|e| format!("Failed to resize: {}", e))?;
            }
        }
        Ok(())
    }

    /// Disconnect a session
    pub async fn disconnect(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        if let Some(mut session) = sessions.remove(session_id) {
            if let Some(channel) = session.channel.take() {
                let _ = channel.eof().await;
            }
            let _ = session.handle.disconnect(client::DisconnectReason::ByApplication, "", "");
        }
        Ok(())
    }
}
