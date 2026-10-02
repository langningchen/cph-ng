use std::{path::Path, sync::Arc};

use crate::{
    application::tasks::{Cancellation, TaskFailure},
    domain::GlobalConfig,
    ports::executor::CommandSpec,
};

#[derive(Debug, Clone, Copy, Default, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CompilationMode {
    #[default]
    Auto,
    Skip,
    Force,
}

#[derive(Debug, Clone, Copy, Default, serde::Serialize, serde::Deserialize)]
pub struct CompilationStats {
    pub hits: usize,
    pub builds: usize,
}

#[async_trait::async_trait]
pub trait Compiler: Send + Sync + std::fmt::Debug {
    fn configured(&self, config: GlobalConfig, mode: CompilationMode) -> Arc<dyn Compiler>;
    fn cache_stats(&self) -> CompilationStats;
    async fn compile(
        &self,
        path: &Path,
        workdir: &Path,
        memory_mb: u64,
        cancel: &Cancellation,
    ) -> Result<CommandSpec, TaskFailure>;
    async fn compile_snapshot(
        &self,
        path: &Path,
        workdir: &Path,
        memory_mb: u64,
        cancel: &Cancellation,
        source: &[u8],
    ) -> Result<CommandSpec, TaskFailure>;
}
