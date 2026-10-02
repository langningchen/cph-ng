use sqlx::{Sqlite, SqlitePool, Transaction};

use crate::{
    application::tasks::{
        TaskEvent, TaskEventKind, TaskEventPayload, TaskFailure, TaskInfo, TaskProgress,
    },
    ports::tasks::TaskStore,
};

#[derive(Debug, Clone)]
pub struct SqliteTaskStore(pub SqlitePool);

async fn event(
    tx: &mut Transaction<'_, Sqlite>,
    info: &TaskInfo,
    kind: TaskEventKind,
    progress: Option<TaskProgress>,
) -> Result<TaskEvent, TaskFailure> {
    let mut event = TaskEvent {
        sequence: 0,
        task_id: info.task_id.clone(),
        state: info.state.clone(),
        payload: match (kind, progress) {
            (TaskEventKind::Queued, None) => TaskEventPayload::Queued { result: () },
            (TaskEventKind::Running, None) => TaskEventPayload::Running { result: () },
            (TaskEventKind::Progress, Some(result)) => TaskEventPayload::Progress { result },
            (TaskEventKind::Finished, None) => TaskEventPayload::Finished {
                result: info.result.clone(),
            },
            _ => {
                return Err(TaskFailure::invalid(
                    "Progress payload must match the event kind",
                ));
            }
        },
        error: info.error.clone(),
    };
    let data = serde_json::to_string(&event).map_err(TaskFailure::internal)?;
    let row = sqlx::query("INSERT INTO task_events(task_id, data) VALUES (?, ?)")
        .bind(&info.task_id)
        .bind(data)
        .execute(&mut **tx)
        .await
        .map_err(TaskFailure::internal)?;
    event.sequence = u64::try_from(row.last_insert_rowid()).map_err(TaskFailure::internal)?;
    Ok(event)
}
fn decode(data: &str) -> Result<TaskInfo, TaskFailure> {
    serde_json::from_str(data).map_err(TaskFailure::internal)
}

#[async_trait::async_trait]
impl TaskStore for SqliteTaskStore {
    async fn request_cancel(&self, id: &str) -> Result<(), TaskFailure> {
        sqlx::query("INSERT OR IGNORE INTO task_cancellations(task_id) SELECT task_id FROM tasks WHERE task_id = ? AND state IN ('queued', 'running')")
            .bind(id).execute(&self.0).await.map_err(TaskFailure::internal)?;
        Ok(())
    }
    async fn cancel_requested(&self, id: &str) -> Result<bool, TaskFailure> {
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM task_cancellations WHERE task_id = ?)")
            .bind(id)
            .fetch_one(&self.0)
            .await
            .map_err(TaskFailure::internal)
    }
    async fn create(
        &self,
        info: &TaskInfo,
        key: Option<&str>,
        fingerprint: &str,
    ) -> Result<TaskEvent, TaskFailure> {
        let mut tx = self.0.begin().await.map_err(TaskFailure::internal)?;
        sqlx::query("INSERT INTO tasks(task_id, state, kind, problem_id, client_request_id, fingerprint, data) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind(&info.task_id).bind(info.state.as_str()).bind(info.kind.as_str()).bind(&info.problem_id).bind(key).bind(fingerprint)
            .bind(serde_json::to_string(info).map_err(TaskFailure::internal)?).execute(&mut *tx).await.map_err(TaskFailure::internal)?;
        let event = event(&mut tx, info, TaskEventKind::Queued, None).await?;
        tx.commit().await.map_err(TaskFailure::internal)?;
        Ok(event)
    }
    async fn record(
        &self,
        info: &TaskInfo,
        kind: TaskEventKind,
        progress: Option<TaskProgress>,
    ) -> Result<TaskEvent, TaskFailure> {
        let mut tx = self.0.begin().await.map_err(TaskFailure::internal)?;
        let data = serde_json::to_string(info).map_err(TaskFailure::internal)?;
        sqlx::query("UPDATE tasks SET state = ?, data = ? WHERE task_id = ?")
            .bind(info.state.as_str())
            .bind(&data)
            .bind(&info.task_id)
            .execute(&mut *tx)
            .await
            .map_err(TaskFailure::internal)?;
        let event = event(&mut tx, info, kind, progress).await?;
        if info.state.is_final() {
            sqlx::query("DELETE FROM task_cancellations WHERE task_id = ?")
                .bind(&info.task_id)
                .execute(&mut *tx)
                .await
                .map_err(TaskFailure::internal)?;
            sqlx::query("INSERT INTO history(run_id, problem_id, created_at, data) VALUES (?, ?, ?, ?) ON CONFLICT(run_id) DO UPDATE SET data=excluded.data")
                .bind(&info.task_id).bind(&info.problem_id).bind(i64::try_from(info.created_at).unwrap_or(i64::MAX)).bind(data)
                .execute(&mut *tx).await.map_err(TaskFailure::internal)?;
        }
        tx.commit().await.map_err(TaskFailure::internal)?;
        Ok(event)
    }
    async fn get(&self, id: &str) -> Result<Option<TaskInfo>, TaskFailure> {
        let data: Option<String> = sqlx::query_scalar("SELECT data FROM tasks WHERE task_id = ?")
            .bind(id)
            .fetch_optional(&self.0)
            .await
            .map_err(TaskFailure::internal)?;
        data.as_deref().map(decode).transpose()
    }
    async fn find_request(&self, key: &str) -> Result<Option<(TaskInfo, String)>, TaskFailure> {
        let data: Option<(String, String)> =
            sqlx::query_as("SELECT data, fingerprint FROM tasks WHERE client_request_id = ?")
                .bind(key)
                .fetch_optional(&self.0)
                .await
                .map_err(TaskFailure::internal)?;
        data.map(|(data, fingerprint)| Ok((decode(&data)?, fingerprint)))
            .transpose()
    }
    async fn unfinished(&self) -> Result<Vec<TaskInfo>, TaskFailure> {
        let data: Vec<String> =
            sqlx::query_scalar("SELECT data FROM tasks WHERE state IN ('queued', 'running')")
                .fetch_all(&self.0)
                .await
                .map_err(TaskFailure::internal)?;
        data.iter().map(|data| decode(data)).collect()
    }
    async fn events_since(
        &self,
        sequence: u64,
        task_id: Option<&str>,
        limit: u32,
    ) -> Result<Vec<TaskEvent>, TaskFailure> {
        let data: Vec<(i64, String)> = sqlx::query_as("SELECT sequence, data FROM task_events WHERE sequence > ? AND (? IS NULL OR task_id = ?) ORDER BY sequence LIMIT ?")
            .bind(i64::try_from(sequence).unwrap_or(i64::MAX)).bind(task_id).bind(task_id).bind(limit).fetch_all(&self.0).await.map_err(TaskFailure::internal)?;
        data.into_iter()
            .map(|(sequence, data)| {
                let mut event: TaskEvent =
                    serde_json::from_str(&data).map_err(TaskFailure::internal)?;
                event.sequence = u64::try_from(sequence).map_err(TaskFailure::internal)?;
                Ok(event)
            })
            .collect()
    }
    async fn history_for_source(
        &self,
        code_id: &str,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<TaskInfo>, TaskFailure> {
        let data: Vec<String> = sqlx::query_scalar("SELECT json_remove(data, '$.source_code', '$.result.testcases', '$.result.source_code') FROM history WHERE json_extract(data, '$.code_id') = ? ORDER BY created_at DESC, run_id DESC LIMIT ? OFFSET ?")
            .bind(code_id).bind(limit).bind(offset).fetch_all(&self.0).await.map_err(TaskFailure::internal)?;
        data.iter().map(|data| decode(data)).collect()
    }
    async fn restore_history(&self, entries: &[TaskInfo]) -> Result<(), TaskFailure> {
        let mut tx = self.0.begin().await.map_err(TaskFailure::internal)?;
        for info in entries {
            if !info.state.is_final() {
                return Err(TaskFailure::invalid(
                    "Only finished history can be imported",
                ));
            }
            let data = serde_json::to_string(info).map_err(TaskFailure::internal)?;
            sqlx::query("INSERT INTO tasks(task_id,state,kind,problem_id,fingerprint,data) VALUES (?,?,?,?,?,?)")
                .bind(&info.task_id).bind(info.state.as_str()).bind(info.kind.as_str()).bind(&info.problem_id).bind("imported").bind(&data).execute(&mut *tx).await.map_err(TaskFailure::internal)?;
            sqlx::query("INSERT INTO history(run_id,problem_id,created_at,data) VALUES (?,?,?,?)")
                .bind(&info.task_id)
                .bind(&info.problem_id)
                .bind(i64::try_from(info.created_at).unwrap_or(i64::MAX))
                .bind(&data)
                .execute(&mut *tx)
                .await
                .map_err(TaskFailure::internal)?;
        }
        tx.commit().await.map_err(TaskFailure::internal)?;
        Ok(())
    }
    async fn history_list(
        &self,
        problem_id: Option<&str>,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<TaskInfo>, TaskFailure> {
        let data: Vec<String> = sqlx::query_scalar("SELECT json_remove(data, '$.source_code', '$.result.testcases', '$.result.source_code') FROM history WHERE (? IS NULL OR problem_id = ?) ORDER BY created_at DESC, run_id DESC LIMIT ? OFFSET ?")
            .bind(problem_id).bind(problem_id).bind(limit).bind(offset).fetch_all(&self.0).await.map_err(TaskFailure::internal)?;
        data.iter().map(|data| decode(data)).collect()
    }
    async fn history_load(&self, id: &str) -> Result<Option<TaskInfo>, TaskFailure> {
        let data: Option<String> = sqlx::query_scalar("SELECT data FROM history WHERE run_id = ?")
            .bind(id)
            .fetch_optional(&self.0)
            .await
            .map_err(TaskFailure::internal)?;
        data.as_deref().map(decode).transpose()
    }
}
