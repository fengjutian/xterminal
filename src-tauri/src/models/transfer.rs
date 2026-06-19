use serde::{Deserialize, Serialize};

/// Transfer direction
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TransferDirection {
    Upload,
    Download,
}

/// Transfer type (SFTP or FTP)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TransferProtocol {
    Sftp,
    Ftp,
}

/// Transfer task state
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TransferState {
    Queued,
    Transferring,
    Paused,
    Completed,
    Failed(String),
    Cancelled,
}

/// A single transfer task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferTask {
    pub id: String,
    pub connection_id: String,
    pub protocol: TransferProtocol,
    pub direction: TransferDirection,
    pub local_path: String,
    pub remote_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub transferred_bytes: u64,
    pub state: TransferState,
    pub speed_bytes_per_sec: f64,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

/// Transfer progress event payload
#[derive(Debug, Clone, Serialize)]
pub struct TransferProgressPayload {
    pub task_id: String,
    pub file_name: String,
    pub total_bytes: u64,
    pub transferred_bytes: u64,
    pub speed_bytes_per_sec: f64,
    pub percent: f32,
    pub direction: TransferDirection,
}
