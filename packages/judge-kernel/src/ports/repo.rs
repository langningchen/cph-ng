use std::{collections::HashMap, path::Path};

use thiserror::Error;
use toml_edit::DocumentMut;

use crate::domain::{GlobalConfig, HistoryEntry, Problem, RunId, TestcaseId};

#[derive(Error, Debug)]
pub enum RepoError {
    #[error("IO Error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON Error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("TOML Error: {0}")]
    Toml(#[from] toml::ser::Error),
    #[error("TOML Parse Error: {0}")]
    TomlDe(#[from] toml::de::Error),
}

#[async_trait::async_trait]
pub trait ProblemRepository: Send + Sync {
    async fn save_problem(&self, problem: &Problem) -> Result<(), RepoError>;
    async fn load_problem(&self, source_path: &Path) -> Result<Problem, RepoError>;

    async fn save_testcases(
        &self,
        source_path: &Path,
        payloads: &HashMap<TestcaseId, (String, String)>,
    ) -> Result<(), RepoError>;

    async fn save_config(&self, source_path: &Path, configs: &DocumentMut)
    -> Result<(), RepoError>;

    async fn save_history_run(
        &self,
        source_path: &Path,
        run_id: RunId,
        source_code: &str,
        history_detail: &HistoryEntry,
    ) -> Result<(), RepoError>;
}
