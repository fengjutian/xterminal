/// SFTP file transfer service (via Russh SFTP subsystem)
/// 
/// Provides file listing, upload and download on an existing SSH session.

pub struct SftpService;

impl SftpService {
    pub fn new() -> Self {
        Self
    }

    /// List files in a remote directory
    pub async fn list_files(
        &self,
        _session_id: &str,
        _remote_path: &str,
    ) -> Result<Vec<crate::commands::sftp::SftpFileEntry>, String> {
        Err("Not yet implemented".to_string())
    }

    /// Upload a local file to remote
    pub async fn upload(
        &self,
        _session_id: &str,
        _local_path: &str,
        _remote_path: &str,
    ) -> Result<String, String> {
        Err("Not yet implemented".to_string())
    }

    /// Download a remote file to local
    pub async fn download(
        &self,
        _session_id: &str,
        _remote_path: &str,
        _local_path: &str,
    ) -> Result<String, String> {
        Err("Not yet implemented".to_string())
    }

    /// Create directory on remote
    pub async fn mkdir(
        &self,
        _session_id: &str,
        _remote_path: &str,
    ) -> Result<(), String> {
        Err("Not yet implemented".to_string())
    }

    /// Delete file or empty directory on remote
    pub async fn delete(
        &self,
        _session_id: &str,
        _remote_path: &str,
    ) -> Result<(), String> {
        Err("Not yet implemented".to_string())
    }

    /// Rename / move remote file
    pub async fn rename(
        &self,
        _session_id: &str,
        _old_path: &str,
        _new_path: &str,
    ) -> Result<(), String> {
        Err("Not yet implemented".to_string())
    }
}
