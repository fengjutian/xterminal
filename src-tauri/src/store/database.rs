/// Database initialization and module orchestrator

use rusqlite::Connection;
use tauri::AppHandle;
use std::path::PathBuf;

use super::migrations;

/// Get the database file path in the app data directory
fn get_db_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or_else(|| "Failed to resolve app data directory".to_string())?;

    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    Ok(app_dir.join("x-terminal.db"))
}

/// Initialize the database: create tables and run migrations
pub async fn init_database(app_handle: AppHandle) -> Result<(), String> {
    let db_path = {
        let app_handle = &app_handle;
        let app_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;

        std::fs::create_dir_all(&app_dir)
            .map_err(|e| format!("Failed to create app data dir: {}", e))?;

        app_dir.join("x-terminal.db")
    };

    log::info!("Database path: {:?}", db_path);

    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    // Enable WAL mode for better concurrent read performance
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("Failed to set pragmas: {}", e))?;

    // Run all migrations
    migrations::run_migrations(&conn)?;

    log::info!("Database initialized successfully");
    Ok(())
}

/// Module for connection config CRUD
pub mod connections {
    use rusqlite::{params, Connection};
    use crate::models::connection::{
        ConnectionConfig, CreateConnectionPayload, UpdateConnectionPayload, AuthMethod,
    };
    use crate::security::keyring;

    pub fn list_all(conn: &Connection) -> Result<Vec<ConnectionConfig>, String> {
        let mut stmt = conn
            .prepare(
                "SELECT id, name, group_id, host, port, username, auth_method,
                        private_key_path, keyring_id, encoding, keep_alive_interval,
                        connection_timeout, sort_order, created_at, updated_at
                 FROM connections ORDER BY sort_order, name",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                Ok(ConnectionConfig {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    group_id: row.get(2)?,
                    host: row.get(3)?,
                    port: row.get(4)?,
                    username: row.get(5)?,
                    auth_method: {
                        let s: String = row.get(6)?;
                        match s.as_str() {
                            "password" => AuthMethod::Password,
                            "key" => AuthMethod::KeyFile,
                            "key_with_passphrase" => AuthMethod::KeyFileWithPassphrase,
                            _ => AuthMethod::Password,
                        }
                    },
                    private_key_path: row.get(7)?,
                    keyring_id: row.get(8)?,
                    encoding: row.get(9)?,
                    keep_alive_interval: row.get(10)?,
                    connection_timeout: row.get(11)?,
                    sort_order: row.get(12)?,
                    created_at: row.get(13)?,
                    updated_at: row.get(14)?,
                })
            })
            .map_err(|e| e.to_string())?;

        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn create(
        conn: &mut Connection,
        payload: CreateConnectionPayload,
    ) -> Result<ConnectionConfig, String> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        let port = payload.port.unwrap_or(22);
        let auth_method = payload.auth_method.clone();
        let keyring_id = if auth_method != AuthMethod::Password {
            let secret = payload.passphrase.as_deref().unwrap_or(
                payload.password.as_deref().unwrap_or(""),
            );
            if !secret.is_empty() {
                Some(keyring::store_secret(&format!("x-terminal-{}", id), secret)?)
            } else {
                None
            }
        } else {
            let secret = payload.password.as_deref().unwrap_or("");
            if !secret.is_empty() {
                Some(keyring::store_secret(&format!("x-terminal-{}", id), secret)?)
            } else {
                None
            }
        };

        let auth_method_str = match auth_method {
            AuthMethod::Password => "password",
            AuthMethod::KeyFile => "key",
            AuthMethod::KeyFileWithPassphrase => "key_with_passphrase",
        };

        conn.execute(
            "INSERT INTO connections (id, name, group_id, host, port, username, auth_method,
             private_key_path, keyring_id, encoding, keep_alive_interval, connection_timeout,
             sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                id,
                payload.name,
                payload.group_id,
                payload.host,
                port,
                payload.username,
                auth_method_str,
                payload.private_key_path,
                keyring_id,
                payload.encoding.unwrap_or_else(|| "UTF-8".to_string()),
                payload.keep_alive_interval.unwrap_or(30),
                payload.connection_timeout.unwrap_or(30),
                0,
                now,
                now,
            ],
        )
        .map_err(|e| e.to_string())?;

        Ok(ConnectionConfig {
            id,
            name: payload.name,
            group_id: payload.group_id,
            host: payload.host,
            port,
            username: payload.username,
            auth_method,
            private_key_path: payload.private_key_path,
            keyring_id,
            encoding: payload.encoding.unwrap_or_else(|| "UTF-8".to_string()),
            keep_alive_interval: payload.keep_alive_interval.unwrap_or(30),
            connection_timeout: payload.connection_timeout.unwrap_or(30),
            sort_order: 0,
            created_at: now.clone(),
            updated_at: now,
        })
    }

    pub fn update(
        conn: &mut Connection,
        payload: UpdateConnectionPayload,
    ) -> Result<ConnectionConfig, String> {
        // Fetch existing config first
        let mut stmt = conn
            .prepare(
                "SELECT id, name, group_id, host, port, username, auth_method,
                        private_key_path, keyring_id, encoding, keep_alive_interval,
                        connection_timeout, sort_order, created_at, updated_at
                 FROM connections WHERE id = ?1",
            )
            .map_err(|e| e.to_string())?;

        let existing = stmt
            .query_row(params![payload.id], |row| {
                Ok(ConnectionConfig {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    group_id: row.get(2)?,
                    host: row.get(3)?,
                    port: row.get(4)?,
                    username: row.get(5)?,
                    auth_method: {
                        let s: String = row.get(6)?;
                        match s.as_str() {
                            "password" => AuthMethod::Password,
                            "key" => AuthMethod::KeyFile,
                            "key_with_passphrase" => AuthMethod::KeyFileWithPassphrase,
                            _ => AuthMethod::Password,
                        }
                    },
                    private_key_path: row.get(7)?,
                    keyring_id: row.get(8)?,
                    encoding: row.get(9)?,
                    keep_alive_interval: row.get(10)?,
                    connection_timeout: row.get(11)?,
                    sort_order: row.get(12)?,
                    created_at: row.get(13)?,
                    updated_at: row.get(14)?,
                })
            })
            .map_err(|e| format!("Connection not found: {}", e))?;

        let name = payload.name.unwrap_or(existing.name);
        let group_id = payload.group_id.or(existing.group_id);
        let host = payload.host.unwrap_or(existing.host);
        let port = payload.port.unwrap_or(existing.port);
        let username = payload.username.unwrap_or(existing.username);
        let auth_method = payload.auth_method.unwrap_or(existing.auth_method.clone());
        let private_key_path = payload.private_key_path.or(existing.private_key_path);
        let encoding = payload.encoding.unwrap_or(existing.encoding);
        let keep_alive = payload.keep_alive_interval.unwrap_or(existing.keep_alive_interval);
        let timeout = payload.connection_timeout.unwrap_or(existing.connection_timeout);

        let auth_method_str = match auth_method {
            AuthMethod::Password => "password",
            AuthMethod::KeyFile => "key",
            AuthMethod::KeyFileWithPassphrase => "key_with_passphrase",
        };

        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE connections SET name=?1, group_id=?2, host=?3, port=?4, username=?5,
             auth_method=?6, private_key_path=?7, encoding=?8, keep_alive_interval=?9,
             connection_timeout=?10, updated_at=?11
             WHERE id=?12",
            params![
                name,
                group_id,
                host,
                port,
                username,
                auth_method_str,
                private_key_path,
                encoding,
                keep_alive,
                timeout,
                now,
                payload.id,
            ],
        )
        .map_err(|e| e.to_string())?;

        Ok(ConnectionConfig {
            id: payload.id,
            name,
            group_id,
            host,
            port,
            username,
            auth_method,
            private_key_path,
            keyring_id: existing.keyring_id,
            encoding,
            keep_alive_interval: keep_alive,
            connection_timeout: timeout,
            sort_order: existing.sort_order,
            created_at: existing.created_at,
            updated_at: now,
        })
    }

    pub fn delete(conn: &mut Connection, id: &str) -> Result<(), String> {
        // Delete keyring entry if exists
        let mut stmt = conn
            .prepare("SELECT keyring_id FROM connections WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        let keyring_id: Option<String> = stmt
            .query_row(params![id], |row| row.get(0))
            .ok();

        if let Some(kid) = keyring_id {
            let _ = keyring::delete_secret(&kid);
        }

        conn.execute("DELETE FROM connections WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

/// Module for application settings CRUD
pub mod settings {
    use rusqlite::{params, Connection};
    use crate::models::config::AppSettings;

    pub fn get(conn: &Connection) -> Result<AppSettings, String> {
        let mut stmt = conn
            .prepare("SELECT key, value FROM app_settings")
            .map_err(|e| e.to_string())?;

        let mut settings = AppSettings::default();
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?;

        for row in rows {
            let (key, value): (String, String) = row.map_err(|e| e.to_string())?;
            match key.as_str() {
                "theme" => settings.theme = value,
                "font_family" => settings.font_family = value,
                "font_size" => settings.font_size = value.parse().unwrap_or(14),
                "cursor_style" => settings.cursor_style = value,
                "default_download_path" => settings.default_download_path = value,
                "default_upload_path" => settings.default_upload_path = value,
                "log_level" => settings.log_level = value,
                "max_concurrent_transfers" => {
                    settings.max_concurrent_transfers = value.parse().unwrap_or(3)
                }
                "auto_copy_selection" => {
                    settings.auto_copy_selection = value.parse().unwrap_or(false)
                }
                "scrollback_lines" => {
                    settings.scrollback_lines = value.parse().unwrap_or(5000)
                }
                _ => {}
            }
        }

        Ok(settings)
    }

    pub fn save(conn: &mut Connection, settings: &AppSettings) -> Result<(), String> {
        let pairs = [
            ("theme", settings.theme.clone()),
            ("font_family", settings.font_family.clone()),
            ("font_size", settings.font_size.to_string()),
            ("cursor_style", settings.cursor_style.clone()),
            ("default_download_path", settings.default_download_path.clone()),
            ("default_upload_path", settings.default_upload_path.clone()),
            ("log_level", settings.log_level.clone()),
            ("max_concurrent_transfers", settings.max_concurrent_transfers.to_string()),
            ("auto_copy_selection", settings.auto_copy_selection.to_string()),
            ("scrollback_lines", settings.scrollback_lines.to_string()),
        ];

        for (key, value) in pairs.iter() {
            conn.execute(
                "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![key, value],
            )
            .map_err(|e| e.to_string())?;
        }

        Ok(())
    }
}
