use serde::{Deserialize, Serialize};

/// File entry returned by FTP list operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FtpFileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub size: u64,
    pub modified: String,
    pub permissions: String,
}

/// Connect to an FTP server (standalone, not via SSH)
/// Returns session ID
#[tauri::command]
pub async fn ftp_connect(
    host: String,
    port: u16,
    username: String,
    password: String,
    use_tls: bool,
    passive_mode: bool,
    timeout_secs: u32,
) -> Result<String, String> {
    // TODO: Implement via suppaftp
    let session_id = uuid::Uuid::new_v4().to_string();
    let _ = (host, port, username, password, use_tls, passive_mode, timeout_secs);
    Err("FTP connection not yet implemented".to_string())
}

/// Disconnect an FTP session
#[tauri::command]
pub async fn ftp_disconnect(
    session_id: String,
) -> Result<(), String> {
    let _ = session_id;
    Ok(())
}

/// List files in a remote directory via FTP
#[tauri::command]
pub async fn ftp_list_files(
    session_id: String,
    remote_path: String,
) -> Result<Vec<FtpFileEntry>, String> {
    let _ = (session_id, remote_path);
    Err("FTP list not yet implemented".to_string())
}

/// Upload a file from local to remote via FTP
#[tauri::command]
pub async fn ftp_upload_file(
    session_id: String,
    local_path: String,
    remote_path: String,
) -> Result<String, String> {
    let task_id = uuid::Uuid::new_v4().to_string();
    let _ = (session_id, local_path, remote_path);
    Ok(task_id)
}

/// Download a file from remote to local via FTP
#[tauri::command]
pub async fn ftp_download_file(
    session_id: String,
    remote_path: String,
    local_path: String,
) -> Result<String, String> {
    let task_id = uuid::Uuid::new_v4().to_string();
    let _ = (session_id, remote_path, local_path);
    Ok(task_id)
}
