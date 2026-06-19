
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
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

pub struct SftpService;

impl SftpService {
    pub fn new() -> Self {
        Self
    }

    pub async fn list_files(
        &self,
        _session_id: &str,
        _remote_path: &str,
    ) -> Result<Vec<SftpFileEntry>, String> {
        Err("SFTP not yet implemented — waiting for russh SSH integration".to_string())
    }

    pub async fn upload(
        &self,
        _session_id: &str,
        _local_path: &str,
        _remote_path: &str,
    ) -> Result<String, String> {
        Err("SFTP upload not yet implemented".to_string())
    }

    pub async fn download(
        &self,
        _session_id: &str,
        _remote_path: &str,
        _local_path: &str,
    ) -> Result<String, String> {
        Err("SFTP download not yet implemented".to_string())
    }

    pub async fn mkdir(
        &self,
        _session_id: &str,
        _remote_path: &str,
    ) -> Result<(), String> {
        Err("SFTP mkdir not yet implemented".to_string())
    }

    pub async fn delete(
        &self,
        _session_id: &str,
        _remote_path: &str,
    ) -> Result<(), String> {
        Err("SFTP delete not yet implemented".to_string())
    }

    pub async fn rename(
        &self,
        _session_id: &str,
        _old_path: &str,
        _new_path: &str,
    ) -> Result<(), String> {
        Err("SFTP rename not yet implemented".to_string())
    }
}
