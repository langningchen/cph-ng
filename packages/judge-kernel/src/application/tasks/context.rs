use super::{Cancellation, TaskEventKind, TaskFailure, TaskManager, TaskProgress};

#[derive(Debug, Clone)]
pub struct TaskContext {
    pub task_id: String,
    pub cancel: Cancellation,
    pub(super) manager: TaskManager,
}
impl TaskContext {
    /// Create a cancellation scope for one testcase without canceling sibling cases.
    ///
    /// # Errors
    /// Returns cancellation if the owning task is no longer active.
    pub async fn for_testcase(&self, id: uuid::Uuid) -> Result<Self, TaskFailure> {
        let mut state = self.manager.state.lock().await;
        let task = state
            .active
            .get_mut(&self.task_id)
            .ok_or_else(TaskFailure::canceled)?;
        let cancel = task.testcases.entry(id).or_default().clone();
        Ok(Self {
            cancel,
            ..self.clone()
        })
    }

    /// # Errors
    /// Returns cancellation if this task is no longer active, or a storage error while
    /// recording the snapshot and event.
    pub async fn capture_source(&self, source: &str) -> Result<(), TaskFailure> {
        use sha2::{Digest, Sha256};
        let mut state = self.manager.state.lock().await;
        let task = state
            .active
            .get_mut(&self.task_id)
            .ok_or_else(TaskFailure::canceled)?;
        if task.cancel.is_canceled() {
            return Err(TaskFailure::canceled());
        }
        task.info.source_code = Some(source.to_owned());
        task.info.source_hash = Some(format!("{:x}", Sha256::digest(source.as_bytes())));
        let event = self
            .manager
            .store
            .record(
                &task.info,
                TaskEventKind::Progress,
                Some(TaskProgress::SourceSaved),
            )
            .await?;
        let _ = self.manager.events.send(event);
        Ok(())
    }

    /// # Errors
    /// Returns cancellation if the task is no longer active, or a storage error before
    /// broadcasting the event.
    pub async fn progress(&self, value: TaskProgress) -> Result<(), TaskFailure> {
        let state = self.manager.state.lock().await;
        let task = state
            .active
            .get(&self.task_id)
            .ok_or_else(TaskFailure::canceled)?;
        if task.cancel.is_canceled() {
            return Err(TaskFailure::canceled());
        }
        let event = self
            .manager
            .store
            .record(&task.info, TaskEventKind::Progress, Some(value))
            .await?;
        let _ = self.manager.events.send(event);
        Ok(())
    }
}
