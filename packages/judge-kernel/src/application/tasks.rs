//! Durable task scheduling. Events are committed before they are broadcast.
use crate::{application::error::ErrorCode, ports::tasks::TaskStore};
use std::{
    collections::HashMap,
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tokio::sync::{Mutex, Semaphore, broadcast};
mod context;
mod control;
mod lifecycle;
mod progress;
mod types;
pub use progress::{ScheduledCase, TaskProgress};
mod worker;
pub use super::error::CommandError as TaskFailure;
pub use context::TaskContext;
pub use control::{Cancellation, ProblemLocks};
pub use types::{
    TaskEvent, TaskEventKind, TaskEventPayload, TaskInfo, TaskLimits, TaskSpec, TaskState,
};
#[derive(Debug)]
struct ActiveTask {
    info: TaskInfo,
    cancel: Cancellation,
    testcases: HashMap<uuid::Uuid, Cancellation>,
}
#[derive(Debug, Default)]
struct ManagerState {
    active: HashMap<String, ActiveTask>,
    closing: bool,
}

#[derive(Clone)]
pub struct TaskManager {
    store: Arc<dyn TaskStore>,
    state: Arc<Mutex<ManagerState>>,
    events: broadcast::Sender<TaskEvent>,
    workers: Arc<Semaphore>,
    stress_workers: Arc<Semaphore>,
    pub locks: ProblemLocks,
    limits: TaskLimits,
}
impl std::fmt::Debug for TaskManager {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TaskManager")
            .field("limits", &self.limits)
            .finish_non_exhaustive()
    }
}
impl TaskManager {
    /// # Errors
    /// Returns invalid limits or storage errors while recovering unfinished tasks.
    pub async fn open(store: Arc<dyn TaskStore>, limits: TaskLimits) -> Result<Self, TaskFailure> {
        Self::open_mode(store, limits, true).await
    }
    /// Observers may read and request cancellation without recovering another process's tasks.
    ///
    /// # Errors
    /// Returns invalid limits or storage errors while loading and, for owners, recovering
    /// unfinished tasks.
    pub async fn open_mode(
        store: Arc<dyn TaskStore>,
        limits: TaskLimits,
        recover: bool,
    ) -> Result<Self, TaskFailure> {
        if limits.workers == 0
            || limits.stress_workers == 0
            || limits.queued == 0
            || limits.timeout.is_zero()
        {
            return Err(TaskFailure::new(
                ErrorCode::InvalidParams,
                "Task limits must be positive",
            ));
        }
        let (events, _) = broadcast::channel(256);
        let manager = Self {
            store,
            state: Arc::new(Mutex::new(ManagerState {
                active: HashMap::new(),
                closing: !recover,
            })),
            events,
            workers: Arc::new(Semaphore::new(limits.workers)),
            stress_workers: Arc::new(Semaphore::new(limits.stress_workers)),
            locks: ProblemLocks::default(),
            limits,
        };
        for mut info in if recover {
            manager.store.unfinished().await?
        } else {
            vec![]
        } {
            info.state = TaskState::Canceled;
            info.finished_at = Some(now_ms());
            info.error = Some(TaskFailure::new(
                ErrorCode::TaskState,
                "Server stopped before task completion",
            ));
            manager
                .store
                .record(&info, TaskEventKind::Finished, None)
                .await?;
        }
        Ok(manager)
    }
    #[must_use]
    pub fn subscribe(&self) -> broadcast::Receiver<TaskEvent> {
        self.events.subscribe()
    }

    /// # Errors
    /// Returns a storage error when unfinished task records cannot be loaded.
    pub async fn list_active(&self) -> Result<Vec<TaskInfo>, TaskFailure> {
        self.store.unfinished().await
    }
    async fn wait_for_external_cancel(&self, id: &str) -> Result<(), TaskFailure> {
        loop {
            if self.store.cancel_requested(id).await? {
                return Ok(());
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    }

    /// # Errors
    /// Returns `NotFound` for an unknown task, or a storage/deserialization error.
    pub async fn get(&self, id: &str) -> Result<TaskInfo, TaskFailure> {
        self.store
            .get(id)
            .await?
            .ok_or_else(|| TaskFailure::new(ErrorCode::NotFound, "Task not found"))
    }

    /// # Errors
    /// Returns a storage/deserialization error when the requested event page cannot be read.
    pub async fn events_since(
        &self,
        sequence: u64,
        task_id: Option<&str>,
        limit: u32,
    ) -> Result<Vec<TaskEvent>, TaskFailure> {
        self.store
            .events_since(sequence, task_id, limit.min(1000))
            .await
    }

    /// # Errors
    /// Returns a storage/deserialization error when the history page cannot be read.
    pub async fn history_list(
        &self,
        problem_id: Option<&str>,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<TaskInfo>, TaskFailure> {
        self.store
            .history_list(problem_id, limit.min(100), offset)
            .await
    }

    /// # Errors
    /// Returns a storage error.
    pub async fn history_for_source(
        &self,
        code_id: &str,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<TaskInfo>, TaskFailure> {
        self.store
            .history_for_source(code_id, limit.min(100), offset)
            .await
    }
    /// # Errors
    /// Restores final imported records; existing run IDs are never overwritten.
    pub async fn restore_history(&self, entries: &[TaskInfo]) -> Result<(), TaskFailure> {
        self.store.restore_history(entries).await
    }
    /// # Errors
    /// Returns `NotFound` for an unknown history entry, or a storage/deserialization error.
    pub async fn history_load(&self, id: &str) -> Result<TaskInfo, TaskFailure> {
        self.store
            .history_load(id)
            .await?
            .ok_or_else(|| TaskFailure::new(ErrorCode::NotFound, "History entry not found"))
    }
}
#[must_use]
pub fn now_ms() -> u64 {
    u64::try_from(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis(),
    )
    .unwrap_or(u64::MAX)
}
