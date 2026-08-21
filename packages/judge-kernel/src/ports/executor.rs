use std::{io::Error, path::Path, process::ExitStatus};

use thiserror::Error;

use crate::domain::{ExecutablePath, IoPath, Memory, Time};

#[derive(Debug)]
pub enum InputSource {
    Data(String),
    File(IoPath),
}

#[derive(Debug)]
pub struct ExecutionContext<'a> {
    pub exec: &'a ExecutablePath,
    pub args: Option<Vec<String>>,
    pub input: Option<InputSource>,
    pub time_limit: Option<Time>,
    pub memory_limit: Option<Memory>,
    pub cwd: Option<&'a Path>,
}

#[derive(Debug)]
pub struct ExecutionResult {
    pub status: ExitStatus,
    pub stdout: String,
    pub stderr: String,
    pub time_used: Time,
    pub memory_used: Memory,
}

#[derive(Error, Debug)]
pub enum ExecutorError {
    #[error("Process launch failed: {0}")]
    LaunchFailed(Error),
    #[error("Timeout occurred")]
    Timeout,
}

#[async_trait::async_trait]
pub trait ExecutorPort: Send + Sync {
    async fn run(&self, ctx: ExecutionContext<'_>) -> Result<ExecutionResult, ExecutorError>;
}
