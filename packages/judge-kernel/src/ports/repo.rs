use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

use thiserror::Error;
use toml_edit::DocumentMut;

use crate::domain::{HistoryEntry, Problem, RunId, TestcaseId};

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
    #[error("index error: {0}")]
    Index(#[from] super::index::IndexError),
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("problem already exists")]
    AlreadyExists,
    #[error("invalid data: {0}")]
    InvalidData(String),
    #[error("problem source is not indexed; rebuild the index or create a new problem")]
    NotIndexed,
}

#[async_trait::async_trait]
pub trait ProblemRepository: Send + Sync + std::fmt::Debug {
    fn root(&self) -> &Path;
    fn paths_for_id(&self, id: crate::domain::ProblemId) -> WorkspacePaths;
    async fn read_owned_text(&self, path: &Path) -> Result<String, RepoError>;
    async fn owned_dir(&self, path: &Path) -> Result<(), RepoError>;
    async fn write_owned(&self, path: &Path, bytes: &[u8]) -> Result<(), RepoError>;
    async fn testcase_data(
        &self,
        problem: &Problem,
        id: TestcaseId,
    ) -> Result<(String, String), RepoError>;

    async fn list_problems(&self) -> Result<Vec<Problem>, RepoError>;
    async fn load_by_id(&self, id: crate::domain::ProblemId) -> Result<Problem, RepoError>;
    async fn delete_by_id(&self, id: crate::domain::ProblemId) -> Result<(), RepoError>;
    async fn create_problem(&self, problem: &Problem) -> Result<(), RepoError>;
    async fn update_problem(&self, problem: &Problem) -> Result<(), RepoError>;
    async fn delete_problem(&self, source_path: &Path) -> Result<(), RepoError>;
    async fn move_problem(
        &self,
        source_path: &Path,
        destination: &Path,
    ) -> Result<Problem, RepoError>;
    async fn save_problem(&self, problem: &Problem) -> Result<(), RepoError>;
    /// Commit testcase metadata and content together so failed writes leave the previous data intact.
    async fn save_problem_with_testcases(
        &self,
        problem: &Problem,
        payloads: &HashMap<TestcaseId, (String, String)>,
    ) -> Result<(), RepoError>;
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

/// Resolve filesystem paths for a problem workspace.
#[derive(Debug, Clone)]
pub struct WorkspacePaths {
    pub problem_path: PathBuf,
    pub config_path: PathBuf,
    pub history_dir: PathBuf,
    pub testcases_dir: PathBuf,
}

impl WorkspacePaths {
    #[must_use]
    pub fn for_id(store_root: &Path, id: crate::domain::ProblemId) -> Self {
        let root_dir = store_root.join("problems").join(id.0.to_string());

        Self {
            problem_path: root_dir.join("problem.json"),
            config_path: root_dir.join("config.toml"),
            history_dir: root_dir.join("history"),
            testcases_dir: root_dir.join("testcases"),
        }
    }

    /// Get the paths for the input and output files of a testcase.
    #[must_use]
    pub fn get_testcase_paths(&self, id: &TestcaseId) -> (PathBuf, PathBuf) {
        let in_filename = format!("{}_in.txt", id.0);
        let out_filename = format!("{}_out.txt", id.0);
        (
            self.testcases_dir.join(in_filename),
            self.testcases_dir.join(out_filename),
        )
    }

    /// Get the paths for the source code and result of a history run.
    #[must_use]
    pub fn get_history_run_paths(&self, run_id: &RunId, ext: &str) -> (PathBuf, PathBuf) {
        let run_dir = self.history_dir.join(run_id.0.to_string());
        (
            run_dir.join(format!("source.{ext}")),
            run_dir.join("result.json"),
        )
    }
}
