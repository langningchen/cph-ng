use crate::application::tasks::TaskProgress;
use crate::domain::JudgeVerdict;
mod batch;
mod case;
pub use case::CaseResult;
mod scheduling;
mod stress;
use crate::application::error::ErrorCode;
use std::{
    path::{Path, PathBuf},
    sync::Arc,
};

use serde_json::Value;

use super::tasks::{TaskContext, TaskFailure};
use crate::{
    domain::{
        Problem, TestcaseId,
        checker::{self as checker, CheckerMode},
    },
    ports::{
        ProblemRepository,
        executor::{CommandSpec, ExecutorPort, ExitReason},
        judge::CheckerPort,
        language::Compiler,
    },
};

#[derive(Debug, Clone)]
pub struct JudgeOptions {
    pub jobs: usize,
    pub input: Option<(String, String)>,
    pub testcase_ids: Option<Vec<TestcaseId>>,
    pub checker: CheckerMode,
    pub legacy_comparison: checker::LegacyComparison,
    pub tolerance: f64,
    pub output_bytes: usize,
}
impl Default for JudgeOptions {
    fn default() -> Self {
        Self {
            jobs: 1,
            input: None,
            testcase_ids: None,
            checker: CheckerMode::Tokens,
            legacy_comparison: checker::LegacyComparison::default(),
            tolerance: 1e-6,
            output_bytes: 1024 * 1024,
        }
    }
}
#[derive(Debug, Clone)]
pub struct JudgeService {
    pub repo: Arc<dyn ProblemRepository>,
    pub compiler: Arc<dyn Compiler>,
    pub executor: Arc<dyn ExecutorPort>,
    pub checker: Arc<dyn CheckerPort>,
}
#[derive(Debug, Clone)]
struct Artifacts {
    solution: CommandSpec,
    checker: Option<CommandSpec>,
    interactor: Option<CommandSpec>,
    dir: PathBuf,
}
impl JudgeService {
    async fn compile(
        &self,
        problem: &Problem,
        ctx: &TaskContext,
        source: &str,
    ) -> Result<Artifacts, TaskFailure> {
        ctx.progress(TaskProgress::Compiling).await?;
        let dir = self.repo.root().join("runs").join(&ctx.task_id);
        let memory = u64::from(problem.memory_limit);
        let solution = self
            .compiler
            .compile_snapshot(
                &problem.src.0,
                &dir.join("solution"),
                memory,
                &ctx.cancel,
                source.as_bytes(),
            )
            .await?;
        let checker = if let Some(path) = &problem.checker {
            Some(
                self.compiler
                    .compile(&path.0, &dir.join("checker"), 256, &ctx.cancel)
                    .await?,
            )
        } else {
            None
        };
        let interactor = if let Some(path) = &problem.interactor {
            Some(
                self.compiler
                    .compile(&path.0, &dir.join("interactor"), 256, &ctx.cancel)
                    .await?,
            )
        } else {
            None
        };
        ctx.progress(TaskProgress::Compiled {
            compilation: self.compiler.cache_stats(),
        })
        .await?;
        Ok(Artifacts {
            solution,
            checker,
            interactor,
            dir,
        })
    }

    /// # Errors
    /// Returns source, compiler, executor, checker or persistence errors, cancellation, or a
    /// cumulative output-limit failure.
    pub async fn run(
        &self,
        problem: Problem,
        options: JudgeOptions,
        ctx: TaskContext,
    ) -> Result<Value, TaskFailure> {
        let source = super::paths::read_source(&problem.src.0).await?;
        ctx.capture_source(&source).await?;
        self.run_batch(&problem, &options, &ctx, &source).await
    }
}

/// # Errors
/// Returns `UnsupportedLanguage` when the source extension has no registered toolchain.
pub fn supported_source(path: &Path) -> Result<(), TaskFailure> {
    crate::domain::LanguageId::from_path(path)
        .map(|_| ())
        .ok_or_else(|| {
            TaskFailure::new(
                ErrorCode::UnsupportedLanguage,
                "Unsupported source language",
            )
        })
}

#[must_use]
pub fn execution_verdict(result: &crate::ports::executor::ExecutionResult) -> JudgeVerdict {
    match result.reason {
        ExitReason::Canceled => JudgeVerdict::Rejected,
        ExitReason::TimeLimit => JudgeVerdict::TimeLimitExceeded,
        ExitReason::MemoryLimit => JudgeVerdict::MemoryLimitExceeded,
        ExitReason::OutputLimit => JudgeVerdict::OutputLimitExceeded,
        ExitReason::Exited if result.exit_code == Some(0) => JudgeVerdict::Accepted,
        ExitReason::Exited | ExitReason::ProcessLimit => JudgeVerdict::RuntimeError,
    }
}
