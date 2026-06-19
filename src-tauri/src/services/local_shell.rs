/// Local shell service — spawns native PTY shells (cmd/powershell/bash/zsh)

use portable_pty::{CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::Mutex;

pub struct LocalShell {
    pub session_id: String,
    pub master: Box<dyn MasterPty + Send>,
    pub child: Box<dyn portable_pty::Child + Send + Sync>,
    pub writer: Box<dyn Write + Send>,
}

pub struct LocalShellService {
    sessions: Arc<Mutex<HashMap<String, LocalShell>>>,
}

impl LocalShellService {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn spawn_shell(
        &self,
        cols: u16,
        rows: u16,
        app_handle: tauri::AppHandle,
    ) -> Result<String, String> {
        let session_id = uuid::Uuid::new_v4().to_string();

        #[cfg(target_os = "windows")]
        let shell_cmd = "powershell.exe";
        #[cfg(not(target_os = "windows"))]
        let shell_cmd = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());

        let pty_system = portable_pty::native_pty_system();
        let mut pty_pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open PTY: {}", e))?;

        let mut cmd = CommandBuilder::new(shell_cmd.as_ref());
        #[cfg(target_os = "windows")]
        {
            cmd.arg("-NoLogo");
            cmd.arg("-NoExit");
        }

        let child = pty_pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell: {}", e))?;

        drop(pty_pair.slave);

        let writer = pty_pair
            .master
            .try_clone_writer()
            .map_err(|e| format!("Failed to clone writer: {}", e))?;

        let mut reader = pty_pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone reader: {}", e))?;

        let sid = session_id.clone();
        tokio::task::spawn_blocking(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
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

        let shell = LocalShell {
            session_id: session_id.clone(),
            master: pty_pair.master,
            child,
            writer,
        };

        self.sessions.lock().await.insert(session_id.clone(), shell);
        Ok(session_id)
    }

    pub async fn write_to_shell(
        &self,
        session_id: &str,
        data: &[u8],
    ) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        if let Some(shell) = sessions.get_mut(session_id) {
            shell
                .writer
                .write_all(data)
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
        if let Some(shell) = sessions.get_mut(session_id) {
            shell
                .master
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
        if let Some(mut shell) = sessions.remove(session_id) {
            let _ = shell.child.kill();
        }
        Ok(())
    }
}
