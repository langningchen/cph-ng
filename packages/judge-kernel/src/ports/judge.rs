use crate::domain::JudgeVerdict;
use std::path::Path;

use crate::{
    application::tasks::{Cancellation, TaskFailure},
    ports::{
        ProblemRepository,
        executor::{CommandSpec, ExecutionLimits, ExecutionResult},
    },
};

#[derive(Debug, Clone, Copy)]
pub struct CheckData<'a> {
    pub input: &'a str,
    pub actual: &'a str,
    pub expected: &'a str,
}

#[async_trait::async_trait]
pub trait CheckerPort: Send + Sync + std::fmt::Debug {
    async fn interactive(
        &self,
        solution: &CommandSpec,
        interactor: &CommandSpec,
        limits: &ExecutionLimits,
        cancel: &Cancellation,
    ) -> Result<(ExecutionResult, JudgeVerdict), TaskFailure>;
    async fn special_check(
        &self,
        repo: &dyn ProblemRepository,
        checker: &CommandSpec,
        directory: &Path,
        data: CheckData<'_>,
        limits: &ExecutionLimits,
        cancel: &Cancellation,
    ) -> Result<(JudgeVerdict, String), TaskFailure>;
}
