use serde::{Deserialize, Serialize};
use crate::commands::ssh::SshState;
use russh_sftp::client::SftpSession;
use tauri::State;

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

/// Open an SFTP session from an existing SSH session.
async fn open_sftp(
    ssh_state: &SshState,
    session_id: &str,
) -> Result<SftpSession, String> {
    let service = ssh_state.0.lock().await;
    let stream = service.open_sftp_channel(session_id).await?;
    SftpSession::new(stream)
        .await
        .map_err(|e| format!("Failed to initialise SFTP session: {}", e))
}

/// Format a unix timestamp (seconds) as an ISO 8601 string.
fn format_unix_time(secs: u64) -> String {
    if let Some(dt) = chrono::DateTime::from_timestamp(secs as i64, 0) {
        dt.format("%Y-%m-%dT%H:%M:%S").to_string()
    } else {
        String::new()
    }
}

/// Convert a SystemTime to a unix timestamp (seconds).
fn system_time_to_unix(t: std::time::SystemTime) -> u64 {
    t.duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// List files in a remote directory via SFTP
#[tauri::command]
pub async fn sftp_list_files(
    ssh_state: State<'_, SshState>,
    session_id: String,
    remote_path: String,
) -> Result<Vec<SftpFileEntry>, String> {
    let sftp = open_sftp(&ssh_state, &session_id).await?;

    let entries = sftp
        .read_dir(&remote_path)
        .await
        .map_err(|e| format!("SFTP read_dir failed: {}", e))?;

    let mut result = Vec::new();
    for entry in entries {
        let name = entry.file_name();
        let file_path = if remote_path == "/" {
            format!("/{}", name)
        } else {
            format!("{}/{}", remote_path.trim_end_matches('/'), name)
        };

        let metadata = entry.metadata();
        let is_dir = metadata.is_dir();
        let perms = metadata.permissions();

        result.push(SftpFileEntry {
            name: name.to_string(),
            path: file_path,
            is_directory: is_dir,
            is_symlink: metadata.is_symlink(),
            size: metadata.len(),
            modified: metadata
                .modified()
                .ok()
                .map(|t| format_unix_time(system_time_to_unix(t)))
                .unwrap_or_default(),
            permissions: if is_dir {
                format!("d{}", perms)
            } else {
                format!("-{}", perms)
            },
            owner: metadata.user.clone(),
            group: metadata.group.clone(),
        });
    }

    Ok(result)
}

/// Upload a file from local to remote via SFTP
#[tauri::command]
pub async fn sftp_upload_file(
    ssh_state: State<'_, SshState>,
    session_id: String,
    local_path: String,
    remote_path: String,
) -> Result<String, String> {
    let task_id = uuid::Uuid::new_v4().to_string();
    let sftp = open_sftp(&ssh_state, &session_id).await?;

    let data = tokio::fs::read(&local_path)
        .await
        .map_err(|e| format!("Failed to read local file: {}", e))?;

    sftp
        .write(&remote_path, &data)
        .await
        .map_err(|e| format!("SFTP upload failed: {}", e))?;

    Ok(task_id)
}

/// Download a file from remote to local via SFTP
#[tauri::command]
pub async fn sftp_download_file(
    ssh_state: State<'_, SshState>,
    session_id: String,
    remote_path: String,
    local_path: String,
) -> Result<String, String> {
    let task_id = uuid::Uuid::new_v4().to_string();
    let sftp = open_sftp(&ssh_state, &session_id).await?;

    let data = sftp
        .read(&remote_path)
        .await
        .map_err(|e| format!("SFTP download failed: {}", e))?;

    tokio::fs::write(&local_path, &data)
        .await
        .map_err(|e| format!("Failed to write local file: {}", e))?;

    Ok(task_id)
}

/// Create a directory on remote server via SFTP
#[tauri::command]
pub async fn sftp_create_directory(
    ssh_state: State<'_, SshState>,
    session_id: String,
    remote_path: String,
) -> Result<(), String> {
    let sftp = open_sftp(&ssh_state, &session_id).await?;

    sftp
        .create_dir(&remote_path)
        .await
        .map_err(|e| format!("SFTP mkdir failed: {}", e))?;

    Ok(())
}

/// Delete a file or empty directory on remote server via SFTP
#[tauri::command]
pub async fn sftp_delete_file(
    ssh_state: State<'_, SshState>,
    session_id: String,
    remote_path: String,
) -> Result<(), String> {
    let sftp = open_sftp(&ssh_state, &session_id).await?;

    // Try removing as file first, then as directory
    if let Err(e) = sftp.remove_file(&remote_path).await {
        sftp
            .remove_dir(&remote_path)
            .await
            .map_err(|_| format!("SFTP delete failed: {}", e))?;
    }

    Ok(())
}

/// Rename/move a file or directory on remote server via SFTP
#[tauri::command]
pub async fn sftp_rename_file(
    ssh_state: State<'_, SshState>,
    session_id: String,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    let sftp = open_sftp(&ssh_state, &session_id).await?;

    sftp
        .rename(&old_path, &new_path)
        .await
        .map_err(|e| format!("SFTP rename failed: {}", e))?;

    Ok(())
}