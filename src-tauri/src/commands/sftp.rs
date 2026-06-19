use serde::{Deserialize, Serialize};

/// File entry returned by SFTP list operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SftpFileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub is_symlink: bool,
    pub size: u64,
    pub modified: String,
    pub permissions: String,
    pub owner: Option<String>,
    pub group: Option<String>,
}

/// List files in a remote directory via SFTP
#[tauri::command]
pub async fn sftp_list_files(
    session_id: String,
    remote_path: String,
) -> Result<Vec<SftpFileEntry>, String> {
    // TODO: Implement via russh-sftp
    let _ = (session_id, remote_path);
    Err("SFTP list not yet implemented".to_string())
}

/// Upload a file from local to remote via SFTP
#[tauri::command]
pub async fn sftp_upload_file(
    session_id: String,
    local_path: String,
    remote_path: String,
) -> Result<String, String> {
    // TODO: Implement via russh-sftp
    let task_id = uuid::Uuid::new_v4().to_string();
    let _ = (session_id, local_path, remote_path);
    Ok(task_id)
}

/// Download a file from remote to local via SFTP
#[tauri::command]
pub async fn sftp_download_file(
    session_id: String,
    remote_path: String,
    local_path: String,
) -> Result<String, String> {
    // TODO: Implement via russh-sftp
    let task_id = uuid::Uuid::new_v4().to_string();
    let _ = (session_id, remote_path, local_path);
    Ok(task_id)
}

/// Create a directory on remote server via SFTP
#[tauri::command]
pub async fn sftp_create_directory(
    session_id: String,
    remote_path: String,
) -> Result<(), String> {
    let _ = (session_id, remote_path);
    Err("SFTP mkdir not yet implemented".to_string())
}

/// Delete a file or empty directory on remote server via SFTP
#[tauri::command]
pub async fn sftp_delete_file(
    session_id: String,
    remote_path: String,
) -> Result<(), String> {
    let _ = (session_id, remote_path);
    Err("SFTP delete not yet implemented".to_string())
}

/// Rename/move a file or directory on remote server via SFTP
#[tauri::command]
pub async fn sftp_rename_file(
    session_id: String,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    let _ = (session_id, old_path, new_path);
    Err("SFTP rename not yet implemented".to_string())
}
