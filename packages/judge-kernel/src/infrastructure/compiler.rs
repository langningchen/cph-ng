mod cache;
mod command;
use crate::application::error::ErrorCode;
use crate::ports::language::{CompilationMode, CompilationStats};
use std::{
    path::Path,
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
};

use super::{executor::ProcessExecutor, repo::workspace::WorkspaceProblemRepository};
use crate::{
    application::tasks::{Cancellation, TaskFailure},
    domain::{GlobalConfig, LanguageId},
    ports::executor::{CommandSpec, ExecutionLimits, ExecutorPort, ExitReason},
};

#[derive(Debug, Clone)]
pub struct CompilerRegistry {
    config: GlobalConfig,
    repo: WorkspaceProblemRepository,
    mode: CompilationMode,
    hits: Arc<AtomicUsize>,
    builds: Arc<AtomicUsize>,
}
impl CompilerRegistry {
    #[must_use]
    pub fn new(config: GlobalConfig, repo: WorkspaceProblemRepository) -> Self {
        Self {
            config,
            repo,
            mode: CompilationMode::Auto,
            hits: Arc::default(),
            builds: Arc::default(),
        }
    }

    /// # Errors
    /// Returns `UnsupportedLanguage` if no compiler/interpreter is registered for the
    /// extension.
    pub fn detect(path: &Path) -> Result<LanguageId, TaskFailure> {
        LanguageId::from_path(path).ok_or_else(|| {
            TaskFailure::new(
                ErrorCode::UnsupportedLanguage,
                "Unsupported source language",
            )
        })
    }

    /// # Errors
    /// Returns source-read, configuration, compilation or cancellation errors.
    pub async fn compile(
        &self,
        path: &Path,
        workdir: &Path,
        memory_mb: u64,
        cancel: &Cancellation,
    ) -> Result<CommandSpec, TaskFailure> {
        let source = crate::application::paths::read_source(path).await?;
        self.compile_snapshot(path, workdir, memory_mb, cancel, source.as_bytes())
            .await
    }

    /// # Errors
    /// Returns path/size/configuration errors, compilation failure with diagnostics, or
    /// cancellation.
    pub async fn compile_snapshot(
        &self,
        path: &Path,
        workdir: &Path,
        memory_mb: u64,
        cancel: &Cancellation,
        source: &[u8],
    ) -> Result<CommandSpec, TaskFailure> {
        let language = Self::detect(path)?;
        self.repo
            .owned_dir(workdir)
            .await
            .map_err(TaskFailure::internal)?;
        if source.len() > 16 * 1024 * 1024 {
            return Err(TaskFailure::new(
                ErrorCode::InvalidParams,
                "Source file exceeds size limit",
            ));
        }
        let source_path = workdir
            .join(path.file_name().ok_or_else(|| {
                TaskFailure::new(ErrorCode::InvalidParams, "Invalid source path")
            })?);
        self.repo
            .write_owned(&source_path, source)
            .await
            .map_err(TaskFailure::internal)?;
        let artifact = workdir.join(if cfg!(windows) {
            "solution.exe"
        } else {
            "solution"
        });
        let paths = command::CompilationPaths {
            original: path,
            snapshot: source_path,
            artifact,
            workdir,
        };
        self.prepare_cached(language, &paths, source, cancel)
            .await?;
        self.runtime_command(language, &paths, memory_mb)
    }
    async fn run_compiler(
        &self,
        command: &CommandSpec,
        input: &[u8],
        cancel: &Cancellation,
    ) -> Result<(), TaskFailure> {
        let time_ms = self.config.compilation_timeout_ms.unwrap_or(30_000);
        if !(1..=300_000).contains(&time_ms) {
            return Err(TaskFailure::new(
                ErrorCode::InvalidParams,
                "Invalid compilation timeout",
            ));
        }
        let limits = ExecutionLimits {
            time_ms,
            memory_mb: 2048,
            output_bytes: 1024 * 1024,
            file_bytes: 128 * 1024 * 1024,
            processes: 128,
        };
        let result = ProcessExecutor.run(command, input, &limits, cancel).await?;
        if result.reason == ExitReason::Canceled {
            return Err(TaskFailure::canceled());
        }
        if result.reason != ExitReason::Exited || result.exit_code != Some(0) {
            return Err(TaskFailure {
                code: ErrorCode::CompilationFailed,
                message: "Compilation failed".into(),
                data: Some(serde_json::to_value(result).map_err(TaskFailure::internal)?),
            });
        }
        Ok(())
    }
}

#[async_trait::async_trait]
impl crate::ports::language::Compiler for CompilerRegistry {
    fn configured(
        &self,
        config: GlobalConfig,
        mode: CompilationMode,
    ) -> Arc<dyn crate::ports::language::Compiler> {
        let mut compiler = Self::new(config, self.repo.clone());
        compiler.mode = mode;
        Arc::new(compiler)
    }
    fn cache_stats(&self) -> CompilationStats {
        CompilationStats {
            hits: self.hits.load(Ordering::Relaxed),
            builds: self.builds.load(Ordering::Relaxed),
        }
    }
    async fn compile(
        &self,
        path: &Path,
        workdir: &Path,
        memory_mb: u64,
        cancel: &Cancellation,
    ) -> Result<CommandSpec, TaskFailure> {
        Self::compile(self, path, workdir, memory_mb, cancel).await
    }
    async fn compile_snapshot(
        &self,
        path: &Path,
        workdir: &Path,
        memory_mb: u64,
        cancel: &Cancellation,
        source: &[u8],
    ) -> Result<CommandSpec, TaskFailure> {
        Self::compile_snapshot(self, path, workdir, memory_mb, cancel, source).await
    }
}
