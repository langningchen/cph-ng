use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::application::tasks::{Cancellation, TaskFailure};

#[derive(Debug, Clone)]
pub struct CommandSpec {
    pub program: PathBuf,
    pub args: Vec<String>,
    pub cwd: PathBuf,
}
#[derive(Debug, Clone)]
pub struct ExecutionLimits {
    pub time_ms: u64,
    pub memory_mb: u64,
    pub output_bytes: usize,
    /// Maximum size of each file created by the process, separate from captured output.
    pub file_bytes: u64,
    pub processes: usize,
}
impl Default for ExecutionLimits {
    fn default() -> Self {
        Self {
            time_ms: 1000,
            memory_mb: 256,
            output_bytes: 1024 * 1024,
            file_bytes: 1024 * 1024,
            processes: 64,
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ExitReason {
    Exited,
    TimeLimit,
    MemoryLimit,
    OutputLimit,
    ProcessLimit,
    Canceled,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub exit_code: Option<i32>,
    pub reason: ExitReason,
    pub stdout: String,
    pub stderr: String,
    pub time_ms: u64,
    /// Peak sampled resident memory in MiB; None when no usable sample was obtained.
    pub memory_mb: Option<u64>,
}
#[async_trait::async_trait]
pub trait ExecutorPort: Send + Sync + std::fmt::Debug {
    async fn run(
        &self,
        command: &CommandSpec,
        input: &[u8],
        limits: &ExecutionLimits,
        cancel: &Cancellation,
    ) -> Result<ExecutionResult, TaskFailure>;
}
