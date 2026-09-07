use std::{path::Path, time::Duration};

use sqlx::{
    SqlitePool,
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions},
};

/// # Errors
/// Returns a database error when the store cannot be opened, configured or migrated.
pub async fn open(root: &Path) -> Result<SqlitePool, sqlx::Error> {
    tokio::fs::create_dir_all(root).await?;
    let pool = SqlitePoolOptions::new()
        .max_connections(4)
        .connect_with(
            SqliteConnectOptions::new()
                .filename(root.join("index.sqlite3"))
                .create_if_missing(true)
                .foreign_keys(true)
                .journal_mode(SqliteJournalMode::Wal)
                .busy_timeout(Duration::from_secs(10)),
        )
        .await?;
    let mut tx = pool.begin().await?;
    for statement in [
        "CREATE TABLE IF NOT EXISTS problem_index (problem_id TEXT PRIMARY KEY, marker TEXT, device INTEGER, inode INTEGER, content_hash TEXT NOT NULL)",
        "CREATE INDEX IF NOT EXISTS idx_marker ON problem_index(marker)",
        "CREATE INDEX IF NOT EXISTS idx_file_identity ON problem_index(device, inode)",
        "CREATE INDEX IF NOT EXISTS idx_content_hash ON problem_index(content_hash)",
        "CREATE TABLE IF NOT EXISTS problems (id TEXT PRIMARY KEY, data TEXT NOT NULL)",
        "CREATE TABLE IF NOT EXISTS testcase_data (id TEXT NOT NULL, problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE, stdin TEXT NOT NULL, answer TEXT NOT NULL, PRIMARY KEY(problem_id, id))",
        "CREATE TABLE IF NOT EXISTS tasks (task_id TEXT PRIMARY KEY, state TEXT NOT NULL, kind TEXT NOT NULL, problem_id TEXT, client_request_id TEXT UNIQUE, fingerprint TEXT NOT NULL, data TEXT NOT NULL)",
        "CREATE TABLE IF NOT EXISTS task_events (sequence INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL REFERENCES tasks(task_id), data TEXT NOT NULL)",
        "CREATE INDEX IF NOT EXISTS idx_task_events ON task_events(task_id, sequence)",
        "CREATE TABLE IF NOT EXISTS task_cancellations (task_id TEXT PRIMARY KEY REFERENCES tasks(task_id) ON DELETE CASCADE)",
        "CREATE TABLE IF NOT EXISTS history (run_id TEXT PRIMARY KEY REFERENCES tasks(task_id), problem_id TEXT, created_at INTEGER NOT NULL, data TEXT NOT NULL)",
        "CREATE INDEX IF NOT EXISTS idx_history ON history(problem_id, created_at)",
    ] {
        sqlx::query(statement).execute(&mut *tx).await?;
    }
    let columns: Vec<String> =
        sqlx::query_scalar("SELECT name FROM pragma_table_info('problem_index')")
            .fetch_all(&mut *tx)
            .await?;
    for (name, definition) in [
        ("current_path", "TEXT"),
        ("first_seen", "INTEGER NOT NULL DEFAULT 0"),
        ("last_seen", "INTEGER NOT NULL DEFAULT 0"),
        ("conflict", "INTEGER NOT NULL DEFAULT 0"),
    ] {
        if !columns.iter().any(|column| column == name) {
            sqlx::query(&format!(
                "ALTER TABLE problem_index ADD COLUMN {name} {definition}"
            ))
            .execute(&mut *tx)
            .await?;
        }
    }
    let version: i64 = sqlx::query_scalar("PRAGMA user_version")
        .fetch_one(&mut *tx)
        .await?;
    for statement in [
        "CREATE TABLE IF NOT EXISTS source_index (code_id TEXT PRIMARY KEY, problem_id TEXT NOT NULL, marker TEXT, device INTEGER, inode INTEGER, content_hash TEXT NOT NULL, current_path TEXT UNIQUE, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL)",
        "CREATE INDEX IF NOT EXISTS idx_source_problem ON source_index(problem_id)",
        "CREATE INDEX IF NOT EXISTS idx_source_marker ON source_index(marker)",
        "CREATE INDEX IF NOT EXISTS idx_source_identity ON source_index(device, inode)",
        "CREATE INDEX IF NOT EXISTS idx_source_hash ON source_index(content_hash)",
    ] {
        sqlx::query(statement).execute(&mut *tx).await?;
    }
    if version < 2 {
        sqlx::query("INSERT OR IGNORE INTO source_index SELECT problem_id, problem_id, marker, device, inode, content_hash, CASE WHEN current_path IN (SELECT current_path FROM problem_index GROUP BY current_path HAVING COUNT(*)>1) THEN NULL ELSE current_path END, first_seen, last_seen FROM problem_index").execute(&mut *tx).await?;
        for table in ["tasks", "history"] {
            sqlx::query(&format!("UPDATE {table} SET data=json_set(data, '$.code_id', problem_id) WHERE problem_id IS NOT NULL AND json_extract(data, '$.code_id') IS NULL")).execute(&mut *tx).await?;
        }
    }
    sqlx::query("PRAGMA user_version = 2")
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(pool)
}
