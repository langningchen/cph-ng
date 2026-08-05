use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

use tokio::fs;
use toml_edit::DocumentMut;
use xxhash_rust::xxh3::xxh3_64;

use crate::{
    domain::{HistoryEntry, Problem, RunId, TestcaseId},
    ports::{ProblemRepository, RepoError},
};

/// Resolve filesystem paths for a problem workspace.
#[derive(Debug, Clone)]
pub struct WorkspacePaths {
    pub problem_path: PathBuf,
    pub config_path: PathBuf,
    pub history_dir: PathBuf,
    pub testcases_dir: PathBuf,
}

impl WorkspacePaths {
    pub fn new(store_root: &Path, source_path: &Path) -> Self {
        let abs_path =
            std::fs::canonicalize(source_path).unwrap_or_else(|_| source_path.to_path_buf());
        let hash_val = xxh3_64(abs_path.to_string_lossy().as_bytes());
        let full_hash = format!("{hash_val:016x}");
        let (p1, p2) = full_hash.split_at(2);
        let root_dir = store_root.join(p1).join(p2);

        Self {
            problem_path: root_dir.join("problem.json"),
            config_path: root_dir.join("config.toml"),
            history_dir: root_dir.join("history"),
            testcases_dir: root_dir.join("testcases"),
        }
    }

    /// Get the paths for the input and output files of a testcase.
    pub fn get_testcase_paths(&self, id: &TestcaseId) -> (PathBuf, PathBuf) {
        let in_filename = format!("{}_in.txt", id.0);
        let out_filename = format!("{}_out.txt", id.0);
        (
            self.testcases_dir.join(in_filename),
            self.testcases_dir.join(out_filename),
        )
    }

    /// Get the paths for the source code and result of a history run.
    pub fn get_history_run_paths(&self, run_id: &RunId, ext: &str) -> (PathBuf, PathBuf) {
        let run_dir = self.history_dir.join(run_id.0.to_string());
        (
            run_dir.join(format!("source.{ext}")),
            run_dir.join("result.json"),
        )
    }
}

pub struct WorkspaceProblemRepository {
    store_root: PathBuf,
}

impl WorkspaceProblemRepository {
    pub fn new(store_root: PathBuf) -> Self {
        Self { store_root }
    }

    fn paths_for(&self, source_path: &Path) -> WorkspacePaths {
        WorkspacePaths::new(&self.store_root, source_path)
    }

    async fn init_dirs(&self, paths: &WorkspacePaths) -> Result<(), RepoError> {
        fs::create_dir_all(&paths.history_dir).await?;
        fs::create_dir_all(&paths.testcases_dir).await?;
        Ok(())
    }
}

#[async_trait::async_trait]
impl ProblemRepository for WorkspaceProblemRepository {
    async fn save_problem(&self, problem: &Problem) -> Result<(), RepoError> {
        let paths = self.paths_for(&problem.src.0);
        self.init_dirs(&paths).await?;

        let json = serde_json::to_string_pretty(problem)?;
        fs::write(&paths.problem_path, json).await?;
        Ok(())
    }

    async fn load_problem(&self, source_path: &Path) -> Result<Problem, RepoError> {
        let paths = self.paths_for(source_path);
        let json_str = fs::read_to_string(&paths.problem_path).await?;
        let problem = serde_json::from_str(&json_str)?;
        Ok(problem)
    }

    async fn save_testcases(
        &self,
        source_path: &Path,
        payloads: &HashMap<TestcaseId, (String, String)>,
    ) -> Result<(), RepoError> {
        let paths = self.paths_for(source_path);
        self.init_dirs(&paths).await?;

        for (id, (stdin_data, answer_data)) in payloads {
            let (in_path, out_path) = paths.get_testcase_paths(id);
            fs::write(in_path, stdin_data).await?;
            fs::write(out_path, answer_data).await?;
        }
        Ok(())
    }

    async fn save_config(
        &self,
        source_path: &Path,
        configs: &DocumentMut,
    ) -> Result<(), RepoError> {
        let paths = self.paths_for(source_path);
        self.init_dirs(&paths).await?;

        let toml_str = configs.to_string();
        fs::write(&paths.config_path, toml_str).await?;
        Ok(())
    }

    async fn save_history_run(
        &self,
        source_path: &Path,
        run_id: RunId,
        source_code: &str,
        history_detail: &HistoryEntry,
    ) -> Result<(), RepoError> {
        let paths = self.paths_for(source_path);
        self.init_dirs(&paths).await?;

        let run_dir = paths.history_dir.join(run_id.0.to_string());
        fs::create_dir_all(&run_dir).await?;

        let ext = source_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("txt");
        let (source_path, result_path) = paths.get_history_run_paths(&run_id, ext);
        fs::write(source_path, source_code).await?;
        let detail_json = serde_json::to_string_pretty(history_detail)?;
        fs::write(result_path, detail_json).await?;
        Ok(())
    }
}
