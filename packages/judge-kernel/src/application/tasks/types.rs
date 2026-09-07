use crate::application::method::Method;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TaskState {
    Queued,
    Running,
    Succeeded,
    Failed,
    Canceled,
}
impl TaskState {
    #[must_use]
    pub fn is_final(&self) -> bool {
        matches!(self, Self::Succeeded | Self::Failed | Self::Canceled)
    }
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Queued => "queued",
            Self::Running => "running",
            Self::Succeeded => "succeeded",
            Self::Failed => "failed",
            Self::Canceled => "canceled",
        }
    }
}

use super::TaskFailure;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskInfo {
    pub schema_version: u32,
    pub task_id: String,
    pub kind: Method,
    pub problem_id: Option<String>,
    #[serde(default)]
    pub code_id: Option<String>,
    pub state: TaskState,
    pub created_at: u64,
    pub started_at: Option<u64>,
    pub finished_at: Option<u64>,
    #[serde(default)]
    pub source_code: Option<String>,
    #[serde(default)]
    pub source_hash: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effective_config: Option<crate::domain::GlobalConfig>,
    pub result: Option<Value>,
    pub error: Option<TaskFailure>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskEvent {
    pub sequence: u64,
    pub task_id: String,
    pub state: TaskState,
    #[serde(flatten)]
    pub payload: TaskEventPayload,
    pub error: Option<TaskFailure>,
}
#[derive(Debug, Clone)]
pub struct TaskSpec {
    pub effective_config: Option<crate::domain::GlobalConfig>,
    pub kind: Method,
    pub problem_id: Option<String>,
    pub code_id: Option<String>,
    pub client_request_id: Option<String>,
    pub fingerprint: String,
}
#[derive(Debug, Clone)]
pub struct TaskLimits {
    pub workers: usize,
    pub stress_workers: usize,
    pub queued: usize,
    pub timeout: Duration,
}
impl Default for TaskLimits {
    fn default() -> Self {
        Self {
            workers: 2,
            stress_workers: 1,
            queued: 128,
            timeout: Duration::from_secs(300),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TaskEventKind {
    Queued,
    Running,
    Progress,
    Finished,
}

/// A progress event can only carry typed progress, including when reading stored events.
/// Flattening preserves the existing JSON `kind` and `result` fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum TaskEventPayload {
    Queued { result: () },
    Running { result: () },
    Progress { result: super::TaskProgress },
    Finished { result: Option<Value> },
}
impl TaskEvent {
    #[must_use]
    pub fn kind(&self) -> TaskEventKind {
        match self.payload {
            TaskEventPayload::Queued { .. } => TaskEventKind::Queued,
            TaskEventPayload::Running { .. } => TaskEventKind::Running,
            TaskEventPayload::Progress { .. } => TaskEventKind::Progress,
            TaskEventPayload::Finished { .. } => TaskEventKind::Finished,
        }
    }
}
