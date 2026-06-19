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

        let mut child = Command::new(shell)
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn shell: {}", e))?;

        let stdin_writer: Box<dyn Write + Send> =
            Box::new(child.stdin.take().ok_or("Failed to take stdin")?);

        let mut stdout = child.stdout.take().ok_or("Failed to take stdout")?;

        let sid = session_id.clone();
        tokio::task::spawn_blocking(move || {
            let mut buf = [0u8; 4096];
            loop {
                match stdout.read(&mut buf) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let data = buf[..n].to_vec();
                        let _ = app_handle.emit("local-terminal-output", serde_json::json!({
                            "session_id": sid,
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
            proc.stdin_writer
                .write_all(data)
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
