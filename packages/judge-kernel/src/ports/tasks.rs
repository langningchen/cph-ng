use crate::application::tasks::{TaskEvent, TaskEventKind, TaskFailure, TaskInfo, TaskProgress};

#[async_trait::async_trait]
pub trait TaskStore: Send + Sync {
    async fn request_cancel(&self, id: &str) -> Result<(), TaskFailure>;
    async fn cancel_requested(&self, id: &str) -> Result<bool, TaskFailure>;
    async fn create(
        &self,
        info: &TaskInfo,
        request_id: Option<&str>,
        fingerprint: &str,
    ) -> Result<TaskEvent, TaskFailure>;
    async fn record(
        &self,
        info: &TaskInfo,
        kind: TaskEventKind,
        progress: Option<TaskProgress>,
    ) -> Result<TaskEvent, TaskFailure>;
    async fn get(&self, id: &str) -> Result<Option<TaskInfo>, TaskFailure>;
    async fn find_request(&self, key: &str) -> Result<Option<(TaskInfo, String)>, TaskFailure>;
    async fn unfinished(&self) -> Result<Vec<TaskInfo>, TaskFailure>;
    async fn events_since(
        &self,
        sequence: u64,
        task_id: Option<&str>,
        limit: u32,
    ) -> Result<Vec<TaskEvent>, TaskFailure>;
    async fn history_for_source(
        &self,
        code_id: &str,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<TaskInfo>, TaskFailure>;
    async fn restore_history(&self, entries: &[TaskInfo]) -> Result<(), TaskFailure>;
    async fn history_list(
        &self,
        problem_id: Option<&str>,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<TaskInfo>, TaskFailure>;
    async fn history_load(&self, id: &str) -> Result<Option<TaskInfo>, TaskFailure>;
}
