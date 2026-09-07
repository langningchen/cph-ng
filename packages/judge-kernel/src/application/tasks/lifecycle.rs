use super::TaskEventKind;
use super::{TaskFailure, TaskInfo, TaskManager, TaskState, now_ms};
use crate::application::error::ErrorCode;
use serde_json::{Value, json};
use std::time::Duration;

impl TaskManager {
    pub(super) async fn start(&self, id: &str) -> Result<(), TaskFailure> {
        let mut state = self.state.lock().await;
        let task = state.active.get_mut(id).ok_or_else(TaskFailure::canceled)?;
        if task.cancel.is_canceled() {
            return Err(TaskFailure::canceled());
        }
        task.info.state = TaskState::Running;
        task.info.started_at = Some(now_ms());
        let event = self
            .store
            .record(&task.info, TaskEventKind::Running, None)
            .await?;
        let _ = self.events.send(event);
        Ok(())
    }
    pub(super) async fn finish(
        &self,
        id: &str,
        outcome: Result<Value, TaskFailure>,
    ) -> Result<(), TaskFailure> {
        let mut state = self.state.lock().await;
        if let Some(task) = state.active.get_mut(id) {
            let outcome = if task.cancel.is_canceled() {
                Err(TaskFailure::canceled())
            } else {
                outcome
            };
            match outcome {
                Ok(mut result) => {
                    if let Some(object) = result.as_object_mut() {
                        object.insert("schema_version".into(), json!(1));
                    }
                    task.info.state = TaskState::Succeeded;
                    task.info.result = Some(result);
                }
                Err(error) => {
                    task.info.state = if error.code == ErrorCode::TaskState {
                        TaskState::Canceled
                    } else {
                        TaskState::Failed
                    };
                    task.info.error = Some(error);
                }
            }
            task.info.finished_at = Some(now_ms());
            let event = self
                .store
                .record(&task.info, TaskEventKind::Finished, None)
                .await?;
            let _ = self.events.send(event);
            state.active.remove(id);
        }
        Ok(())
    }

    /// # Errors
    /// Returns a missing-task or invalid-state error, or a storage error while requesting
    /// external cancellation.
    pub async fn cancel(&self, id: &str) -> Result<TaskInfo, TaskFailure> {
        let state = self.state.lock().await;
        if let Some(task) = state.active.get(id) {
            task.cancel.cancel();
            return Ok(task.info.clone());
        }
        drop(state);
        let task = self.get(id).await?;
        if task.state == TaskState::Canceled {
            Ok(task)
        } else if !task.state.is_final() {
            self.store.request_cancel(id).await?;
            Ok(task)
        } else {
            Err(TaskFailure::new(
                ErrorCode::TaskState,
                "Task is not cancellable",
            ))
        }
    }

    /// # Errors
    /// Returns a storage error if a remaining task cannot be finalized after the grace
    /// period.
    pub async fn shutdown(&self, grace: Duration) -> Result<(), TaskFailure> {
        {
            let mut state = self.state.lock().await;
            state.closing = true;
            for task in state.active.values() {
                task.cancel.cancel();
            }
        }
        let wait = async {
            loop {
                if self.state.lock().await.active.is_empty() {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        };
        if tokio::time::timeout(grace, wait).await.is_err() {
            let ids: Vec<_> = self.state.lock().await.active.keys().cloned().collect();
            for id in ids {
                self.finish(&id, Err(TaskFailure::canceled())).await?;
            }
        }
        Ok(())
    }
}
