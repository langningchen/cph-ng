use super::context::Context;
use clap_complete::engine::CompletionCandidate;
use sqlx::{Connection, SqliteConnection, sqlite::SqliteConnectOptions};
use std::{
    collections::{HashMap, HashSet},
    ffi::OsStr,
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};

#[derive(Debug, Default)]
pub(super) struct Candidates {
    pub requested: AtomicBool,
    values: HashMap<&'static str, Vec<(String, String)>>,
    selected: HashSet<String>,
}
impl Candidates {
    pub fn complete(&self, name: &str, current: &OsStr) -> Vec<CompletionCandidate> {
        self.requested.store(true, Ordering::Relaxed);
        let name = if name == "testcase_ids" {
            "testcase_id"
        } else {
            name
        };
        let prefix = current.to_string_lossy();
        self.values
            .get(name)
            .into_iter()
            .flatten()
            .filter(|(id, _)| {
                id.starts_with(prefix.as_ref())
                    && (name != "testcase_id" || !self.selected.contains(id))
            })
            .map(|(id, help)| {
                CompletionCandidate::new(id).help(Some(
                    help.chars()
                        .filter(|c| !c.is_control())
                        .take(160)
                        .collect::<String>()
                        .into(),
                ))
            })
            .collect()
    }
}

pub(super) async fn load(context: &Context) -> Result<Candidates, sqlx::Error> {
    let path = context.store.join("index.sqlite3");
    // Never initialize/migrate the database, acquire the kernel lock, resolve an
    // xattr/hash, or start a daemon in response to pressing TAB.
    if !path.is_file() {
        return Ok(Candidates::default());
    }
    let mut connection = SqliteConnection::connect_with(
        &SqliteConnectOptions::new()
            .filename(path)
            .read_only(true)
            .create_if_missing(false)
            .busy_timeout(Duration::from_millis(30)),
    )
    .await?;
    let result = query(&mut connection, context).await;
    connection.close().await?;
    result
}

async fn query(
    connection: &mut SqliteConnection,
    context: &Context,
) -> Result<Candidates, sqlx::Error> {
    let mut result = Candidates {
        selected: context.selected.clone(),
        ..Candidates::default()
    };
    // IDs only contain hex digits and hyphens. Do not interpret SQL wildcards.
    if !context
        .prefix
        .chars()
        .all(|c| c.is_ascii_hexdigit() || c == '-')
    {
        return Ok(result);
    }
    let prefix = format!("{}%", context.prefix);
    for (name, query) in [
        (
            "problem_id",
            "SELECT id, COALESCE(json_extract(data,'$.name'),'Problem') FROM problems WHERE id LIKE ? ORDER BY id LIMIT 200",
        ),
        (
            "code_id",
            "SELECT code_id, COALESCE(current_path,'Source') FROM source_index WHERE code_id LIKE ? ORDER BY last_seen DESC, code_id LIMIT 200",
        ),
        (
            "task_id",
            "SELECT task_id, kind || ' · ' || state FROM tasks WHERE task_id LIKE ? ORDER BY state IN ('queued','running') DESC, rowid DESC LIMIT 200",
        ),
        (
            "run_id",
            "SELECT run_id, COALESCE(json_extract(data,'$.kind'),'Run') || ' · ' || COALESCE(json_extract(data,'$.state'),'') FROM history WHERE run_id LIKE ? ORDER BY created_at DESC, run_id LIMIT 200",
        ),
    ] {
        let values = sqlx::query_as(query)
            .bind(&prefix)
            .fetch_all(&mut *connection)
            .await?;
        result.values.insert(name, values);
    }
    if let Some(problem) = problem(connection, context).await? {
        let cases = sqlx::query_as("SELECT json_extract(j.value,'$.id'), 'Testcase ' || (CAST(j.key AS INTEGER)+1) || ' · ' || json_extract(p.data,'$.name') FROM problems p, json_each(p.data,'$.testcases') j WHERE p.id=? AND json_extract(j.value,'$.id') LIKE ? ORDER BY CAST(j.key AS INTEGER) LIMIT 200")
            .bind(problem).bind(prefix).fetch_all(&mut *connection).await?;
        result.values.insert("testcase_id", cases);
    }
    Ok(result)
}
async fn problem(
    connection: &mut SqliteConnection,
    context: &Context,
) -> Result<Option<String>, sqlx::Error> {
    if let Some(id) = &context.problem {
        return Ok(Some(id.clone()));
    }
    if let Some(code) = &context.code {
        return sqlx::query_scalar("SELECT problem_id FROM source_index WHERE code_id=?")
            .bind(code)
            .fetch_optional(connection)
            .await;
    }
    if let Some(source) = &context.source {
        let source = tokio::fs::canonicalize(source)
            .await
            .or_else(|_| std::path::absolute(source));
        if let Ok(source) = source {
            return sqlx::query_scalar("SELECT problem_id FROM source_index WHERE current_path=?")
                .bind(source.to_string_lossy().as_ref())
                .fetch_optional(connection)
                .await;
        }
    }
    Ok(None)
}
