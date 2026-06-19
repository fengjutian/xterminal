/// SSH service — manages SSH connections via russh.
///
/// Real russh integration requires studying the russh 0.44 API.
/// This stub provides the interface that the commands layer expects.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct SshSessionHandle {
    #[allow(dead_code)]
    pub session_id: String,
}

pub struct SshService {
    #[allow(dead_code)]
    sessions: Arc<Mutex<HashMap<String, SshSessionHandle>>>,
}

impl SshService {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn connect(
        &self,
        _host: &str,
        _port: u16,
        _username: &str,
        _password: Option<&str>,
        _private_key_path: Option<&str>,
        _passphrase: Option<&str>,
        _timeout_secs: u32,
        _keep_alive_secs: u32,
        _app_handle: tauri::AppHandle,
    ) -> Result<String, String> {
        Err("SSH not yet implemented — russh API integration pending".to_string())
    }

    pub async fn write(
        &self,
        _session_id: &str,
        _data: &[u8],
    ) -> Result<(), String> {
        Ok(())
    }

    pub async fn resize(
        &self,
        _session_id: &str,
        _cols: u16,
        _rows: u16,
    ) -> Result<(), String> {
        Ok(())
    }

    pub async fn disconnect(&self, _session_id: &str) -> Result<(), String> {
        Ok(())
    }
}
