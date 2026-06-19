/// Local shell service — spawns native shells with stdin/stdout pipes.
///
/// Note: Pipe-based shells don't provide a true PTY experience.
/// Interactive programs (vim, top, etc.) may not work correctly.
/// Upgrade to PTY for full terminal compatibility.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::Mutex;
use encoding_rs::UTF_8;

/// Detect the Windows system code page encoding.
/// On non-Windows, always returns UTF-8.
#[cfg(windows)]
fn system_encoding() -> &'static encoding_rs::Encoding {
    // GetACP() returns the active Windows code page
    // We use a minimal FFI call instead of pulling in the win32 crate
    let cp = windows_GetACP();
    match cp {
        936 | 54936 => encoding_rs::GBK,
        950 => encoding_rs::BIG5,
        932 => encoding_rs::SHIFT_JIS,
        949 => encoding_rs::EUC_KR,
        65001 => encoding_rs::UTF_8,
        _ => encoding_rs::GBK, // safe default for Chinese Windows
    }
}

#[cfg(windows)]
extern "system" {
    fn GetACP() -> u32;
}

#[cfg(windows)]
fn windows_GetACP() -> u32 {
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
    child: Child,
    stdin_writer: Box<dyn Write + Send>,
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
        // On Windows prefer USERPROFILE; on Unix HOME; fall back to the crate root or CWD.
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
        // Fall back to the parent of the executable (project root when run via `cargo tauri dev`)
        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                // On Windows the exe is in src-tauri/target/debug/; go up to the project root
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
        _cols: u16,
        _rows: u16,
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

        let mut child = Command::new(shell)
            .args(args)
            .current_dir(&starting_dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn shell: {}", e))?;

        let stdin_writer: Box<dyn Write + Send> =
            Box::new(child.stdin.take().ok_or("Failed to take stdin")?);

        let mut stdout = child.stdout.take().ok_or("Failed to take stdout")?;
        let mut stderr = child.stderr.take().ok_or("Failed to take stderr")?;

        let sid1 = session_id.clone();
        let sid2 = session_id.clone();
        let ah1 = app_handle.clone();
        let ah2 = app_handle.clone();

        // Read from stdout on a background thread
        let _sid1 = session_id.clone();
        let _ah1 = app_handle.clone();
        tokio::task::spawn_blocking(move || {
            let mut buf = [0u8; 4096];
            loop {
                match stdout.read(&mut buf) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let data = decode_from_system(&buf[..n]);
                        let _ = ah1.emit("local-terminal-output", serde_json::json!({
                            "session_id": sid1,
                            "data": data,
                        }));
                    }
                    Err(_) => break,
                }
            }
        });

        // Read from stderr on a background thread, emitting the same event
        let _sid2 = session_id.clone();
        let _ah2 = app_handle.clone();
        tokio::task::spawn_blocking(move || {
            let mut buf = [0u8; 4096];
            loop {
                match stderr.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = decode_from_system(&buf[..n]);
                        let _ = ah2.emit("local-terminal-output", serde_json::json!({
                            "session_id": sid2,
                            "data": data,
                        }));
                    }
                    Err(_) => break,
                }
            }
        });

        let proc = LocalShellProcess {
            child,
            stdin_writer,
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
            // Convert input from UTF-8 to the system encoding (e.g. GBK on Chinese Windows)
            let encoded = encode_to_system(data);
            proc.stdin_writer
                .write_all(&encoded)
                .and_then(|_| proc.stdin_writer.flush())
                .map_err(|e| format!("Failed to write to shell: {}", e))?;
        }
        Ok(())
    }

    pub async fn resize_shell(
        &self,
        _session_id: &str,
        _cols: u16,
        _rows: u16,
    ) -> Result<(), String> {
        Ok(())
    }

    pub async fn kill_shell(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        if let Some(mut proc) = sessions.remove(session_id) {
            let _ = proc.child.kill();
        }
        Ok(())
    }
}
