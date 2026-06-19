use serde::{Deserialize, Serialize};

/// Authentication method for SSH connections
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AuthMethod {
    Password,
    KeyFile,
    KeyFileWithPassphrase,
}

/// SSH connection state
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Error(String),
}

impl Default for ConnectionState {
    fn default() -> Self {
        Self::Disconnected
    }
}

/// Server connection configuration (persisted to database)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub id: String,
    pub name: String,
    pub group_id: Option<String>,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: AuthMethod,
    /// Path to private key file (only for KeyFile / KeyFileWithPassphrase)
    pub private_key_path: Option<String>,
    /// Reference ID in system keyring for passphrase/password
    pub keyring_id: Option<String>,
    /// Terminal encoding, default UTF-8
    pub encoding: String,
    /// Keep-alive interval in seconds, 0 = disabled
    pub keep_alive_interval: u32,
    /// Connection timeout in seconds
    pub connection_timeout: u32,
    /// Sort order in the connection list
    pub sort_order: u32,
    pub created_at: String,
    pub updated_at: String,
}

impl Default for ConnectionConfig {
    fn default() -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name: String::new(),
            group_id: None,
            host: String::new(),
            port: 22,
            username: String::new(),
            auth_method: AuthMethod::Password,
            private_key_path: None,
            keyring_id: None,
            encoding: "UTF-8".to_string(),
            keep_alive_interval: 30,
            connection_timeout: 30,
            sort_order: 0,
            created_at: now.clone(),
            updated_at: now,
        }
    }
}

/// SSH connection creation payload (from frontend)
#[derive(Debug, Clone, Deserialize)]
pub struct CreateConnectionPayload {
    pub name: String,
    pub group_id: Option<String>,
    pub host: String,
    pub port: Option<u16>,
    pub username: String,
    pub auth_method: AuthMethod,
    pub private_key_path: Option<String>,
    pub passphrase: Option<String>,
    pub password: Option<String>,
    pub encoding: Option<String>,
    pub keep_alive_interval: Option<u32>,
    pub connection_timeout: Option<u32>,
}

/// SSH connection update payload
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateConnectionPayload {
    pub id: String,
    pub name: Option<String>,
    pub group_id: Option<String>,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub username: Option<String>,
    pub auth_method: Option<AuthMethod>,
    pub private_key_path: Option<String>,
    pub passphrase: Option<String>,
    pub password: Option<String>,
    pub encoding: Option<String>,
    pub keep_alive_interval: Option<u32>,
    pub connection_timeout: Option<u32>,
}

/// Active SSH session (in-memory, not persisted)
#[derive(Debug, Clone, Serialize)]
pub struct SshSession {
    pub id: String,
    pub connection_id: String,
    pub name: String,
    pub host: String,
    pub state: ConnectionState,
    pub connected_at: Option<String>,
}

/// Host key info for verification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HostKeyInfo {
    pub host: String,
    pub port: u16,
    pub key_type: String,
    pub fingerprint: String,
    pub verified: bool,
    pub created_at: String,
}
