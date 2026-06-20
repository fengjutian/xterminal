/// Local shell service — spawns native shells through a real PTY/ConPTY.
///
/// Uses `portable-pty` which provides ConPTY on Windows and Unix PTY on
/// macOS/Linux, enabling interactive programs (vim, top, backspace, etc.)
/// to work correctly.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;
use portable_pty::{Child, CommandBuilder, MasterPty, NativePtySystem, PtyPair, PtySize, PtySystem};
use tauri::Emitter;
use tokio::sync::Mutex;
use encoding_rs::UTF_8;

/// Detect the Windows system code page encoding.
/// On non-Windows, always returns UTF-8.
#[cfg(windows)]
fn system_encoding() -> &'static encoding_rs::Encoding {
    let cp = windows_get_acp();
    match cp {
        936 | 54936 => encoding_rs::GBK,
        950 => encoding_rs::BIG5,
        932 => encoding_rs::SHIFT_JIS,
        949 => encoding_rs::EUC_KR,
        65001 => encoding_rs::UTF_8,
        _ => encoding_rs::GBK,
    }
}

#[cfg(windows)]
extern "system" {
    fn GetACP() -> u32;
}

#[cfg(windows)]
fn windows_get_acp() -> u32 {
    unsafe { GetACP() }
}

#[cfg(not(windows))]
fn system_encoding() -> &'static encoding_rs::Encoding {
    encoding_rs::UTF_8
}

/// Convert bytes from the system encoding to UTF-8.
fn decode_from_system(data: &[u8]) -> Vec<u8> {
    let (result, _, _) = system_encoding().decode(data);
    result.as_bytes().to_vec()
}

/// Convert UTF-8 bytes to the system encoding.
fn encode_to_system(data: &[u8]) -> Vec<u8> {
    let (result, _, _) = UTF_8.decode(data);
    let (encoded, _, _) = system_encoding().encode(&result);
    encoded.into()
}

struct LocalShellProcess {
    // The child handle is kept alive for the session lifetime
    _child: Box<dyn Child + Send>,
    // The master side of the PTY — used for resize
    _master: Box<dyn MasterPty + Send>,
    // Writer to the PTY master (input to the shell)
    writer: Box<dyn Write + Send>,
}

pub struct LocalShellService {
    sessions: Arc<Mutex<HashMap<String, LocalShellProcess>>>,
}

impl LocalShellService {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Determine a sensible starting directory for the shell.
    fn starting_directory() -> std::path::PathBuf {
        #[cfg(target_os = "windows")]
        let home = std::env::var("USERPROFILE")
            .map(std::path::PathBuf::from)
            .ok();
        #[cfg(not(target_os = "windows"))]
        let home = std::env::var("HOME")
            .map(std::path::PathBuf::from)
            .ok();

        if let Some(p) = home {
            if p.exists() {
                return p;
            }
        }
        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                let mut dir = parent.to_path_buf();
                for _ in 0..4 {
                    if dir.join("package.json").exists() || dir.join(".git").exists() {
                        return dir;
                    }
                    if let Some(p) = dir.parent() {
                        dir = p.to_path_buf();
                    } else {
                        break;
                    }
                }
                return parent.to_path_buf();
            }
        }
        std::path::PathBuf::from("/")
    }

    pub async fn spawn_shell(
        &self,
        cols: u16,
        rows: u16,
        app_handle: tauri::AppHandle,
    ) -> Result<String, String> {
        let session_id = uuid::Uuid::new_v4().to_string();

        #[cfg(target_os = "windows")]
        let (shell, args): (&str, &[&str]) = ("powershell.exe", &["-NoLogo", "-NoExit"]);
        #[cfg(not(target_os = "windows"))]
        let (shell, args): (&str, &[&str]) = {
            let sh = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
            (Box::leak(sh.into_boxed_str()), &[][..])
        };

        let starting_dir = Self::starting_directory();

        // Create a PTY pair via portable-pty (ConPTY on Windows, Unix PTY elsewhere)
        let pty_system = NativePtySystem::default();
        let pair: PtyPair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open PTY: {}", e))?;

        // Build the command to spawn through the PTY slave
        let mut cmd = CommandBuilder::new(shell);
        cmd.cwd(starting_dir);
        for arg in args {
            cmd.arg(arg);
        }

        // Spawn the shell through the PTY slave side
        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell in PTY: {}", e))?;

        // Clone the PTY master reader and take the writer for background I/O
        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone PTY reader: {}", e))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to take PTY writer: {}", e))?;

        let sid = session_id.clone();
        let ah = app_handle.clone();

        // Read output from the PTY master on a background thread
        tokio::task::spawn_blocking(move || {
            let mut buf = [0u8; 65536];
            let mut reader = reader;
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        // PTY output is in system encoding — convert to UTF-8 for the frontend
                        let data = decode_from_system(&buf[..n]);
                        let _ = ah.emit(
                            "local-terminal-output",
                            serde_json::json!({
                                "session_id": sid,
                                "data": data,
                            }),
                        );
                    }
                    Err(_) => break,
                }
            }
        });

        let proc = LocalShellProcess {
            _child: child,
            _master: pair.master,
            writer,
        };

        self.sessions.lock().await.insert(session_id.clone(), proc);
        Ok(session_id)
    }

    pub async fn write_to_shell(
        &self,
        session_id: &str,
        data: &[u8],
    ) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        if let Some(proc) = sessions.get_mut(session_id) {
            // Convert input from UTF-8 to the system encoding
            // (ConPTY expects the child process's code page, e.g. GBK on Chinese Windows)
            let encoded = encode_to_system(data);
            proc.writer
                .write_all(&encoded)
                .and_then(|_| proc.writer.flush())
                .map_err(|e| format!("Failed to write to PTY: {}", e))?;
        }
        Ok(())
    }

    pub async fn resize_shell(
        &self,
        session_id: &str,
        cols: u16,
        rows: u16,
    ) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        if let Some(proc) = sessions.get_mut(session_id) {
            proc._master
                .resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| format!("Failed to resize PTY: {}", e))?;
        }
        Ok(())
    }

    pub async fn kill_shell(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        if let Some(mut proc) = sessions.remove(session_id) {
            let _ = proc._child.kill();
        }
        Ok(())
    }
}
