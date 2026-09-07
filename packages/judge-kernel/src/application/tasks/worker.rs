use super::{
    ActiveTask, Cancellation, TaskContext, TaskFailure, TaskInfo, TaskManager, TaskSpec, TaskState,
    now_ms,
};
use crate::application::{error::ErrorCode, method::Method};
use serde_json::Value;
use std::future::Future;
use uuid::Uuid;

impl TaskManager {
    /// # Errors
    /// Returns invalid idempotency parameters, a closed/full queue error, or a storage error
    /// before the task is admitted.
    pub async fn spawn<F, Fut>(&self, spec: TaskSpec, job: F) -> Result<TaskInfo, TaskFailure>
    where
        F: FnOnce(TaskContext) -> Fut + Send + 'static,
        Fut: Future<Output = Result<Value, TaskFailure>> + Send + 'static,
    {
        let mut state = self.state.lock().await;
        if state.closing {
            return Err(TaskFailure::new(
                ErrorCode::TaskState,
                "Server is shutting down",
            ));
        }
        if let Some(key) = &spec.client_request_id
            && let Some((info, fingerprint)) = self.store.find_request(key).await?
        {
            if fingerprint != spec.fingerprint {
                return Err(TaskFailure::new(
                    ErrorCode::InvalidParams,
                    "client_request_id was already used for different parameters",
                ));
            }
            return Ok(info);
        }
        if state.active.len() >= self.limits.queued {
            return Err(TaskFailure::new(ErrorCode::Busy, "Task queue is full"));
        }
        let info = TaskInfo {
            schema_version: 1,
            task_id: Uuid::new_v4().to_string(),
            kind: spec.kind,
            problem_id: spec.problem_id,
            code_id: spec.code_id,
            state: TaskState::Queued,
            created_at: now_ms(),
            started_at: None,
            finished_at: None,
            source_code: None,
            source_hash: None,
            effective_config: spec.effective_config,
            result: None,
            error: None,
        };
        let event = self
            .store
            .create(&info, spec.client_request_id.as_deref(), &spec.fingerprint)
            .await?;
        let cancel = Cancellation::new();
        state.active.insert(
            info.task_id.clone(),
            ActiveTask {
                info: info.clone(),
                cancel: cancel.clone(),
                testcases: std::collections::HashMap::new(),
            },
        );
        let _ = self.events.send(event);
        self.start_worker(&info, spec.kind, cancel, job);
        Ok(info)
    }
    fn start_worker<F, Fut>(&self, info: &TaskInfo, kind: Method, cancel: Cancellation, job: F)
    where
        F: FnOnce(TaskContext) -> Fut + Send + 'static,
        Fut: Future<Output = Result<Value, TaskFailure>> + Send + 'static,
    {
        let manager = self.clone();
        let id = info.task_id.clone();
        let problem_id = info.problem_id.clone();
        tokio::spawn(async move {
            let context = TaskContext {
                task_id: id.clone(),
                cancel: cancel.clone(),
                manager: manager.clone(),
            };
            let worker_manager = manager.clone();
            let worker_id = id.clone();
            let work = async move {
                let manager = worker_manager;
                let id = worker_id;
                // Waiting for a busy problem does not consume a worker permit.
                let lock = manager
                    .locks
                    .get(problem_id.as_deref().unwrap_or(&id))
                    .await;
                let _problem = lock.lock().await;
                let _stress = if kind == Method::StressStart {
                    Some(
                        manager
                            .stress_workers
                            .acquire()
                            .await
                            .map_err(TaskFailure::internal)?,
                    )
                } else {
                    None
                };
                let _worker = manager
                    .workers
                    .acquire()
                    .await
                    .map_err(TaskFailure::internal)?;
                manager.start(&id).await?;
                job(context).await
            };
            let mut running = tokio::spawn(work);
            let outcome = tokio::select! {
                biased;
                () = cancel.cancelled() => Err(TaskFailure::canceled()),
                result = manager.wait_for_external_cancel(&id) => match result {
                    Ok(()) => { cancel.cancel(); Err(TaskFailure::canceled()) },
                    Err(error) => Err(error),
                },
                outcome = tokio::time::timeout(manager.limits.timeout, &mut running) => match outcome {
                    Ok(Ok(outcome)) => outcome,
                    Ok(Err(error)) => Err(TaskFailure::internal(error)),
                    Err(_) => Err(TaskFailure::new(ErrorCode::ExecutionFailed, "Task time limit exceeded")),
                },
            };
            if !running.is_finished() {
                running.abort();
                let _ = running.await;
            }
            if let Err(error) = manager.finish(&id, outcome).await {
                eprintln!("Failed to persist final task state: {error}");
            }
        });
    }
}
