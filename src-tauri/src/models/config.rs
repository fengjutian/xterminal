use serde::{Deserialize, Serialize};

/// Application-level settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    /// UI theme: "dark" or "light"
    pub theme: String,
    /// Terminal font family
    pub font_family: String,
    /// Terminal font size in pixels
    pub font_size: u32,
    /// Cursor style: "block", "underline", "bar"
    pub cursor_style: String,
    /// Default download directory path
    pub default_download_path: String,
    /// Default upload directory path
    pub default_upload_path: String,
    /// Log level: "trace", "debug", "info", "warn", "error"
    pub log_level: String,
    /// Maximum concurrent transfers
    pub max_concurrent_transfers: u32,
    /// Whether to auto-copy selected text to clipboard
    pub auto_copy_selection: bool,
    /// Scrollback buffer size (number of lines)
    pub scrollback_lines: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            font_family: "Consolas, 'Courier New', monospace".to_string(),
            font_size: 14,
            cursor_style: "block".to_string(),
            default_download_path: String::new(),
            default_upload_path: String::new(),
            log_level: "info".to_string(),
            max_concurrent_transfers: 3,
            auto_copy_selection: false,
            scrollback_lines: 5000,
        }
    }
}
