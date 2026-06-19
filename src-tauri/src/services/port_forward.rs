/// Port forwarding service — SSH tunneling (local, remote, dynamic).
///
/// Termius-style feature: forward local ports to remote hosts,
/// remote ports to local services, or act as a SOCKS proxy.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
pub enum ForwardType {
    /// Local: local_port → remote_host:remote_port (via SSH server)
    Local,
    /// Remote: remote_port → local_host:local_port (via SSH server)
    Remote,
    /// Dynamic: SOCKS5 proxy on local_port
    Dynamic,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PortForward {
    pub id: String,
    pub session_id: String,
    pub forward_type: ForwardType,
    pub name: String,
    pub local_port: u16,
    pub remote_host: String,
    pub remote_port: u16,
    pub enabled: bool,
    pub created_at: String,
}

pub struct PortForwardService {
    forwards: Arc<Mutex<HashMap<String, PortForward>>>,
}

impl PortForwardService {
    pub fn new() -> Self {
        Self {
            forwards: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn create(
        &self,
        session_id: &str,
        name: &str,
        forward_type: ForwardType,
        local_port: u16,
        remote_host: &str,
        remote_port: u16,
    ) -> Result<PortForward, String> {
        let id = uuid::Uuid::new_v4().to_string();
        let pf = PortForward {
            id: id.clone(),
            session_id: session_id.to_string(),
            forward_type,
            name: name.to_string(),
            local_port,
            remote_host: remote_host.to_string(),
            remote_port,
            enabled: false,
            created_at: chrono::Utc::now().to_rfc3339(),
        };
        self.forwards.lock().await.insert(id, pf.clone());
        Ok(pf)
    }

    pub async fn start(&self, _id: &str) -> Result<(), String> {
        // TODO: Start SSH tunnel using russh channel
        Err("Port forwarding not yet implemented — waiting for russh SSH integration".to_string())
    }

    pub async fn stop(&self, id: &str) -> Result<(), String> {
        if let Some(pf) = self.forwards.lock().await.get_mut(id) {
            pf.enabled = false;
        }
        Ok(())
    }

    pub async fn list(&self) -> Vec<PortForward> {
        self.forwards.lock().await.values().cloned().collect()
    }

    pub async fn delete(&self, id: &str) -> Result<(), String> {
        self.forwards.lock().await.remove(id);
        Ok(())
    }
}
