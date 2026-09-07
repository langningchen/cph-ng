use super::{finish, spec};
use anyhow::Context;
use cph_ng_judge::application::{error::ErrorCode, method::Method};
use std::{
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
    time::Duration,
};

use cph_ng_judge::{
    application::tasks::{TaskInfo, TaskLimits, TaskManager, TaskState},
    infrastructure::repo::{index::ProblemIndex, tasks::SqliteTaskStore},
    ports::tasks::TaskStore,
};
use serde_json::json;
use tempfile::TempDir;
use uuid::Uuid;

#[tokio::test]
async fn queue_concurrency_idempotency_and_cancel_are_durable() -> anyhow::Result<()> {
    let root = TempDir::new().context("required test fixture or kernel response")?;
    let index = ProblemIndex::open(root.path())
        .await
        .context("required test fixture or kernel response")?;
    let manager = TaskManager::open(
        Arc::new(SqliteTaskStore(index.pool().clone())),
        TaskLimits {
            workers: 1,
            queued: 2,
            ..TaskLimits::default()
        },
    )
    .await
    .context("required test fixture or kernel response")?;
    let started = Arc::new(AtomicUsize::new(0));
    let counter = started.clone();
    let first = manager
        .spawn(spec("first"), move |_| async move {
            counter.fetch_add(1, Ordering::SeqCst);
            std::future::pending().await
        })
        .await
        .context("required test fixture or kernel response")?;
    let second = manager
        .spawn(spec("second"), |_| async { Ok(json!({"done": true})) })
        .await
        .context("required test fixture or kernel response")?;
    let duplicate = manager
        .spawn(spec("first"), |_| async { unreachable!() })
        .await
        .context("required test fixture or kernel response")?;
    assert_eq!(duplicate.task_id, first.task_id);
    assert_eq!(
        manager
            .spawn(spec("third"), |_| async { Ok(json!({})) })
            .await
            .err()
            .context("expected operation to fail")?
            .code,
        ErrorCode::Busy
    );
    manager
        .cancel(&second.task_id)
        .await
        .context("required test fixture or kernel response")?;
    assert_eq!(
        finish(&manager, &second.task_id).await?.state,
        TaskState::Canceled
    );
    manager
        .cancel(&first.task_id)
        .await
        .context("required test fixture or kernel response")?;
    assert_eq!(
        finish(&manager, &first.task_id).await?.state,
        TaskState::Canceled
    );
    tokio::time::sleep(Duration::from_millis(20)).await;
    assert_eq!(
        manager
            .get(&second.task_id)
            .await
            .context("required test fixture or kernel response")?
            .state,
        TaskState::Canceled
    );
    let events = manager
        .events_since(0, Some(&second.task_id), 100)
        .await
        .context("required test fixture or kernel response")?;
    assert_eq!(
        events
            .iter()
            .filter(
                |event| event.kind() == cph_ng_judge::application::tasks::TaskEventKind::Finished
            )
            .count(),
        1
    );
    assert_eq!(
        manager
            .history_load(&first.task_id)
            .await
            .context("required test fixture or kernel response")?
            .state,
        TaskState::Canceled
    );
    manager
        .shutdown(Duration::from_secs(1))
        .await
        .context("required test fixture or kernel response")?;

    Ok(())
}

#[tokio::test]
async fn panic_and_total_timeout_produce_final_events() -> anyhow::Result<()> {
    let root = TempDir::new().context("required test fixture or kernel response")?;
    let index = ProblemIndex::open(root.path())
        .await
        .context("required test fixture or kernel response")?;
    let manager = TaskManager::open(
        Arc::new(SqliteTaskStore(index.pool().clone())),
        TaskLimits {
            timeout: Duration::from_millis(100),
            ..TaskLimits::default()
        },
    )
    .await
    .context("required test fixture or kernel response")?;
    let task = manager
        .spawn(spec("panic"), |_| async {
            std::panic::resume_unwind(Box::new("intentional task panic"))
        })
        .await
        .context("required test fixture or kernel response")?;
    assert_eq!(
        finish(&manager, &task.task_id).await?.state,
        TaskState::Failed
    );
    let task = manager
        .spawn(spec("timeout"), |_| async { std::future::pending().await })
        .await
        .context("required test fixture or kernel response")?;
    let task = finish(&manager, &task.task_id).await?;
    assert_eq!(task.state, TaskState::Failed);
    assert_eq!(
        task.error
            .context("required test fixture or kernel response")?
            .code,
        ErrorCode::ExecutionFailed
    );
    manager
        .shutdown(Duration::from_secs(1))
        .await
        .context("required test fixture or kernel response")?;

    Ok(())
}

#[tokio::test]
async fn interrupted_task_recovery_preserves_global_event_sequence() -> anyhow::Result<()> {
    let root = TempDir::new().context("required test fixture or kernel response")?;
    let index = ProblemIndex::open(root.path())
        .await
        .context("required test fixture or kernel response")?;
    let store = Arc::new(SqliteTaskStore(index.pool().clone()));
    let info = TaskInfo {
        effective_config: None,
        schema_version: 1,
        task_id: Uuid::new_v4().to_string(),
        kind: Method::JudgeRun,
        problem_id: None,
        code_id: None,
        state: TaskState::Running,
        created_at: 1,
        started_at: Some(1),
        finished_at: None,
        source_code: None,
        source_hash: None,
        result: None,
        error: None,
    };
    let before = store
        .create(&info, None, "")
        .await
        .context("required test fixture or kernel response")?;
    let manager = TaskManager::open(store, TaskLimits::default())
        .await
        .context("required test fixture or kernel response")?;
    assert_eq!(
        manager
            .get(&info.task_id)
            .await
            .context("required test fixture or kernel response")?
            .state,
        TaskState::Canceled
    );
    let events = manager
        .events_since(before.sequence, None, 10)
        .await
        .context("required test fixture or kernel response")?;
    assert_eq!(events.len(), 1);
    assert_eq!(
        (events)
            .first()
            .context("missing required response field or entry")?
            .state,
        TaskState::Canceled
    );
    assert!(
        (events)
            .first()
            .context("missing required response field or entry")?
            .sequence
            > before.sequence
    );
    assert_eq!(
        manager
            .history_load(&info.task_id)
            .await
            .context("required test fixture or kernel response")?
            .state,
        TaskState::Canceled
    );

    Ok(())
}
