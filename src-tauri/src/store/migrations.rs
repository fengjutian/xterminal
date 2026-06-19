/// Database migration definitions

use rusqlite::Connection;

pub fn run_migrations(conn: &mut Connection) -> Result<(), rusqlite::Error> {
    let tx = conn.transaction()?;

    tx.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );"
    )?;

    let current_version: i32 = tx
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM _migrations",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if current_version < 1 {
        tx.execute_batch(
            "CREATE TABLE IF NOT EXISTS connections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                group_id TEXT,
                host TEXT NOT NULL,
                port INTEGER NOT NULL DEFAULT 22,
                username TEXT NOT NULL,
                auth_method TEXT NOT NULL DEFAULT 'password',
                private_key_path TEXT,
                keyring_id TEXT,
                encoding TEXT NOT NULL DEFAULT 'UTF-8',
                keep_alive_interval INTEGER NOT NULL DEFAULT 30,
                connection_timeout INTEGER NOT NULL DEFAULT 30,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS host_keys (
                id TEXT PRIMARY KEY,
                host TEXT NOT NULL,
                port INTEGER NOT NULL,
                key_type TEXT NOT NULL,
                fingerprint TEXT NOT NULL,
                verified INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                UNIQUE(host, port)
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                settings_json TEXT NOT NULL DEFAULT '{}'
            );

            INSERT INTO _migrations (version) VALUES (1);"
        )?;
    }

    if current_version < 2 {
        tx.execute_batch(
            "CREATE TABLE IF NOT EXISTS transfer_tasks (
                id TEXT PRIMARY KEY,
                connection_id TEXT NOT NULL,
                protocol TEXT NOT NULL,
                direction TEXT NOT NULL,
                local_path TEXT NOT NULL,
                remote_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL DEFAULT 0,
                transferred_bytes INTEGER NOT NULL DEFAULT 0,
                state TEXT NOT NULL DEFAULT 'queued',
                speed_bytes_per_sec REAL NOT NULL DEFAULT 0.0,
                created_at TEXT NOT NULL,
                started_at TEXT,
                completed_at TEXT
            );

            INSERT INTO _migrations (version) VALUES (2);"
        )?;
    }

    if current_version < 3 {
        // Fix app_settings schema: old version had (id INTEGER, settings_json TEXT)
        // but the CRUD code queries (key, value). Migrate to proper key-value format.
        let has_old_schema: bool = tx
            .prepare("SELECT name FROM pragma_table_info('app_settings') WHERE name='settings_json'")
            .and_then(|mut s| s.exists([]))
            .unwrap_or(false);

        if has_old_schema {
            // Migrate from old JSON-blob schema to key-value schema
            let old_json: String = tx
                .query_row(
                    "SELECT COALESCE(settings_json, '{}') FROM app_settings WHERE id = 1",
                    [],
                    |row| row.get(0),
                )
                .unwrap_or_else(|_| "{}".to_string());

            tx.execute("DROP TABLE IF EXISTS app_settings", [])?;
            tx.execute_batch(
                "CREATE TABLE app_settings (
                    key    TEXT PRIMARY KEY,
                    value  TEXT NOT NULL
                );"
            )?;

            // Parse old JSON blob and insert as key-value pairs
            if let Ok(parsed) = serde_json::from_str::<std::collections::HashMap<String, serde_json::Value>>(&old_json) {
                for (k, v) in &parsed {
                    let val_str = match v {
                        serde_json::Value::String(s) => s.clone(),
                        other => other.to_string(),
                    };
                    let _ = tx.execute(
                        "INSERT OR IGNORE INTO app_settings (key, value) VALUES (?1, ?2)",
                        rusqlite::params![k, val_str],
                    );
                }
            }
        } else {
            // Table might already have key-value schema from a manual fix, or doesn't exist yet
            let table_exists: bool = tx
                .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'")
                .and_then(|mut s| s.exists([]))
                .unwrap_or(false);
            if !table_exists {
                tx.execute_batch(
                    "CREATE TABLE app_settings (
                        key    TEXT PRIMARY KEY,
                        value  TEXT NOT NULL
                    );"
                )?;
            }
        }

        tx.execute("INSERT INTO _migrations (version) VALUES (3)", [])?;
    }

    tx.commit()?;
    log::info!("Database migrations completed successfully");
    Ok(())
}
