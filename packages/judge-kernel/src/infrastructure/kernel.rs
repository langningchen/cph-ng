//! Compose the same application services for a resident server or a standalone CLI.
use crate::application::error::ErrorCode;
use std::{
    fs::File,
    ops::Deref,
    path::{Path, PathBuf},
    sync::Arc,
};

use super::{
    compiler::CompilerRegistry,
    exchange::{legacy_bin::LegacyBin, legacy_cph::LegacyCphProb},
    executor::ProcessExecutor,
    judge::BuiltinChecker,
    repo::{index::ProblemIndex, tasks::SqliteTaskStore, workspace::WorkspaceProblemRepository},
};
use crate::{
    application::{
        commands::CommandService,
        judge::JudgeService,
        paths::PathPolicy,
        tasks::{Cancellation, TaskFailure, TaskLimits, TaskManager},
    },
    ports::ProblemImporter,
};

#[derive(Debug, Clone)]
pub struct Kernel {
    commands: CommandService,
    pub pool: sqlx::SqlitePool,
    _lock: Option<Arc<File>>,
}
impl Deref for Kernel {
    type Target = CommandService;
    fn deref(&self) -> &Self::Target {
        &self.commands
    }
}
impl Kernel {
    /// # Errors
    /// Returns an occupied-store, configuration, filesystem, index or scheduler
    /// initialization error.
    pub async fn open(
        root: &Path,
        workspaces: &[PathBuf],
        limits: TaskLimits,
    ) -> Result<Self, TaskFailure> {
        Self::initialize(root, workspaces, limits, false, false).await
    }

    /// # Errors
    /// Returns ownership, configuration, filesystem, index or scheduler errors; observers do
    /// not recover tasks owned by another process.
    pub async fn standalone(
        root: &Path,
        workspaces: &[PathBuf],
        limits: TaskLimits,
        observe: bool,
    ) -> Result<Self, TaskFailure> {
        Self::initialize(root, workspaces, limits, observe, workspaces.is_empty()).await
    }
    async fn initialize(
        root: &Path,
        workspaces: &[PathBuf],
        limits: TaskLimits,
        observe: bool,
        unrestricted: bool,
    ) -> Result<Self, TaskFailure> {
        tokio::fs::create_dir_all(root)
            .await
            .map_err(TaskFailure::internal)?;
        let lock = if observe {
            None
        } else {
            Some(Arc::new(lock_store(root)?))
        };
        let index = ProblemIndex::open(root)
            .await
            .map_err(TaskFailure::internal)?;
        let repo = WorkspaceProblemRepository::from_index(root.to_path_buf(), index.clone())
            .await
            .map_err(TaskFailure::internal)?;
        let config = Arc::new(crate::application::config::ConfigService::new(
            Arc::new(super::config::toml::TomlFileConfigAdapter::new(
                root.to_path_buf(),
            )),
            Arc::new(repo.clone()),
        ));
        let judge = JudgeService {
            compiler: Arc::new(CompilerRegistry::new(
                crate::domain::GlobalConfig::default(),
                repo.clone(),
            )),
            repo: Arc::new(repo.clone()),
            executor: Arc::new(ProcessExecutor),
            checker: Arc::new(BuiltinChecker),
        };
        let tasks = TaskManager::open_mode(
            Arc::new(SqliteTaskStore(index.pool().clone())),
            limits,
            !observe,
        )
        .await?;
        let paths = if unrestricted {
            PathPolicy::unrestricted()
        } else {
            PathPolicy::new(root, workspaces)
                .await
                .map_err(TaskFailure::internal)?
        };
        let bin = LegacyBin::new(root.to_path_buf());
        let bin = if unrestricted {
            bin
        } else {
            bin.with_path_policy(paths.clone())
        };
        let importers: Vec<Arc<dyn ProblemImporter>> = vec![
            Arc::new(LegacyCphProb::new(root.to_path_buf())),
            Arc::new(bin),
        ];
        let pool = index.pool().clone();
        Ok(Self {
            commands: CommandService {
                tasks,
                index: Arc::new(index),
                repo: Arc::new(repo),
                judge,
                paths,
                config,
                toolchains: Arc::new(super::toolchain::LocalToolchains),
                importers,
                shutdown: Cancellation::new(),
            },
            pool,
            _lock: lock,
        })
    }

    /// # Errors
    /// Returns a task-finalization error; the database pool is closed even when finalization
    /// fails.
    pub async fn close(&self) -> Result<(), TaskFailure> {
        let result = self.tasks.shutdown(std::time::Duration::from_secs(5)).await;
        self.pool.close().await;
        result
    }
}

/// # Errors
/// Returns an I/O error opening the lock file or `Busy` when another kernel owns the
/// store.
pub fn lock_store(root: &Path) -> Result<File, TaskFailure> {
    let file = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(root.join("server.lock"))
        .map_err(TaskFailure::internal)?;
    file.try_lock().map_err(|_| TaskFailure::new(ErrorCode::Busy, "This store is busy with another judge process; queries and task cancellation remain available"))?;
    Ok(file)
}
