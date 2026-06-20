use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri;

/// File entry returned by local filesystem operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalFileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub is_symlink: bool,
    pub size: u64,
    pub modified: String,
    pub permissions: String,
}

/// List files in a local directory
#[tauri::command]
pub fn list_local_files(path: String) -> Result<Vec<LocalFileEntry>, String> {
    let dir = Path::new(&path);
    if !dir.exists() {
        return Err(format!("Directory not found: {}", path));
    }
    if !dir.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    let mut entries = Vec::new();
    let mut read_dir = std::fs::read_dir(dir).map_err(|e| format!("Cannot read directory: {}", e))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Error reading entry: {}", e))?;
        let metadata = entry.metadata().map_err(|e| format!("Error reading metadata: {}", e))?;

        let file_name = entry.file_name().to_string_lossy().to_string();
        let file_path = entry.path().to_string_lossy().to_string();

        let modified = match metadata.modified() {
            Ok(time) => {
                let datetime: chrono::DateTime<chrono::Local> = time.into();
                datetime.format("%Y-%m-%dT%H:%M:%S%.f%:z").to_string()
            }
            Err(_) => String::new(),
        };

        let permissions = format_unix_permissions(&metadata);

        entries.push(LocalFileEntry {
            name: file_name,
            path: file_path.replace("\\", "/"),
            is_directory: metadata.is_dir(),
            is_symlink: metadata.is_symlink(),
            size: metadata.len(),
            modified,
            permissions,
        });
    }

    Ok(entries)
}

/// Create a local directory
#[tauri::command]
pub fn create_local_directory(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(|e| format!("Cannot create directory: {}", e))
}

/// Delete a local file or empty directory
#[tauri::command]
pub fn delete_local_file(path: String, is_directory: bool) -> Result<(), String> {
    if is_directory {
        std::fs::remove_dir(&path).map_err(|e| format!("Cannot remove directory: {}", e))
    } else {
        std::fs::remove_file(&path).map_err(|e| format!("Cannot remove file: {}", e))
    }
}

/// Rename/move a local file or directory
#[tauri::command]
pub fn rename_local_file(old_path: String, new_path: String) -> Result<(), String> {
    std::fs::rename(&old_path, &new_path).map_err(|e| format!("Cannot rename: {}", e))
}

/// Format file permissions like Unix `ls -l` (e.g. "drwxr-xr-x")
fn format_unix_permissions(metadata: &std::fs::Metadata) -> String {
    let mut perms = String::with_capacity(10);

    // File type
    if metadata.is_symlink() {
        perms.push('l');
    } else if metadata.is_dir() {
        perms.push('d');
    } else {
        perms.push('-');
    }

    // Owner permissions
    let mode = metadata.permissions().readonly();
    let owner_r = true; // readable by owner on most platforms
    let owner_w = !mode; // writable if not readonly
    let owner_x = metadata.is_dir(); // executable if directory (enterable)

    perms.push(if owner_r { 'r' } else { '-' });
    perms.push(if owner_w { 'w' } else { '-' });
    perms.push(if owner_x { 'x' } else { '-' });

    // Group/other — simplified; std::fs doesn't expose Unix perms on all platforms
    perms.push_str("r-xr-x"); // simplified assumptions

    perms
}
