use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

use tokio::fs;
use toml_edit::DocumentMut;

pub use crate::ports::repo::WorkspacePaths;
use crate::{
    domain::{HistoryEntry, Problem, RunId, TestcaseId},
    infrastructure::repo::index::ProblemIndex,
    ports::{ProblemRepository, RepoError},
};

mod primary;
mod save;

#[derive(Debug, Clone)]
pub struct WorkspaceProblemRepository {
    store_root: PathBuf,
    index: ProblemIndex,
}

impl WorkspaceProblemRepository {
    /// # Errors
    /// Returns filesystem or database errors while initializing the workspace repository.
    pub async fn new(store_root: PathBuf) -> Result<Self, RepoError> {
        let index = ProblemIndex::open(&store_root).await?;
        Self::from_index(store_root, index).await
    }

    /// # Errors
    /// Returns filesystem errors if the store cannot be canonicalized or its problem
    /// directory cannot be initialized.
    pub async fn from_index(store_root: PathBuf, index: ProblemIndex) -> Result<Self, RepoError> {
        fs::create_dir_all(&store_root).await?;
        let store_root = fs::canonicalize(store_root).await?;
        let repo = Self { store_root, index };
        repo.owned_dir(&repo.store_root.join("problems")).await?;
        // One-time compatibility import. Existing SQLite records always take precedence.
        let mut entries = fs::read_dir(repo.store_root.join("problems")).await?;
        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_symlink() {
                continue;
            }
            let path = entry.path().join("problem.json");
            if let Ok(data) = fs::read_to_string(path).await
                && let Ok(problem) = serde_json::from_str::<Problem>(&data)
            {
                sqlx::query("INSERT OR IGNORE INTO problems(id, data) VALUES (?, ?)")
                    .bind(problem.id.0.to_string())
                    .bind(data)
                    .execute(repo.index.pool())
                    .await?;
            }
        }
        Ok(repo)
    }
    #[must_use]
    pub fn root(&self) -> &Path {
        &self.store_root
    }
    #[must_use]
    pub fn paths_for_id(&self, id: crate::domain::ProblemId) -> WorkspacePaths {
        WorkspacePaths::for_id(&self.store_root, id)
    }

    /// # Errors
    /// Returns an index error when the source is missing, ambiguous, unreadable or cannot be
    /// resolved.
    pub async fn id_for(&self, source: &Path) -> Result<crate::domain::ProblemId, RepoError> {
        Ok(self.index.resolve(source).await?)
    }

    /// # Errors
    /// Returns an error for paths outside the store, symlink traversal, or directory creation
    /// failures.
    pub async fn owned_dir(&self, path: &Path) -> Result<(), RepoError> {
        let relative = path
            .strip_prefix(&self.store_root)
            .map_err(|_| RepoError::InvalidData("path escapes store root".into()))?;
        let mut current = self.store_root.clone();
        for component in relative.components() {
            if !matches!(component, std::path::Component::Normal(_)) {
                return Err(RepoError::InvalidData("invalid store path".into()));
            }
            current.push(component);
            match fs::symlink_metadata(&current).await {
                Ok(metadata) if metadata.is_symlink() || !metadata.is_dir() => {
                    return Err(RepoError::InvalidData(
                        "store path is not an owned directory".into(),
                    ));
                }
                Ok(_) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    fs::create_dir(&current).await?;
                }
                Err(error) => return Err(error.into()),
            }
        }
        Ok(())
    }
    async fn init_dirs(&self, paths: &WorkspacePaths) -> Result<(), RepoError> {
        self.owned_dir(&paths.history_dir).await?;
        self.owned_dir(&paths.testcases_dir).await
    }

    /// # Errors
    /// Returns a missing-problem, database or metadata-deserialization error.
    pub async fn load_by_id(&self, id: crate::domain::ProblemId) -> Result<Problem, RepoError> {
        let data: Option<String> = sqlx::query_scalar("SELECT data FROM problems WHERE id = ?")
            .bind(id.0.to_string())
            .fetch_optional(self.index.pool())
            .await?;
        let data = data.ok_or(RepoError::NotIndexed)?;
        let mut problem: Problem = serde_json::from_str(&data)?;
        self.select_primary(&mut problem).await?;
        Ok(problem)
    }

    /// # Errors
    /// Returns database or filesystem errors while deleting stored problem data.
    pub async fn delete_by_id(&self, id: crate::domain::ProblemId) -> Result<(), RepoError> {
        self.load_by_id(id).await?;
        let root = self.store_root.join("problems").join(id.0.to_string());
        self.owned_dir(&root).await?;
        let mut tx = self.index.pool().begin().await?;
        sqlx::query("DELETE FROM problems WHERE id = ?")
            .bind(id.0.to_string())
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM source_index WHERE problem_id = ?")
            .bind(id.0.to_string())
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        fs::remove_dir_all(root).await?;
        Ok(())
    }

    /// # Errors
    /// Returns database, missing-testcase or invalid stored-content errors.
    pub async fn testcase_data(
        &self,
        problem: &Problem,
        id: TestcaseId,
    ) -> Result<(String, String), RepoError> {
        if !problem.testcases.iter().any(|testcase| testcase.id == id) {
            return Err(RepoError::InvalidData("testcase not found".into()));
        }
        let data = sqlx::query_as(
            "SELECT stdin, answer FROM testcase_data WHERE problem_id = ? AND id = ?",
        )
        .bind(problem.id.0.to_string())
        .bind(id.0.to_string())
        .fetch_optional(self.index.pool())
        .await?;
        if let Some(data) = data {
            return Ok(data);
        }
        let testcase = problem
            .testcases
            .iter()
            .find(|testcase| testcase.id == id)
            .ok_or(RepoError::NotIndexed)?;
        let input = self.read_owned_text(&testcase.stdin.0).await?;
        let answer = self.read_owned_text(&testcase.answer.0).await?;
        Ok((input, answer))
    }
    async fn read_owned_text(&self, path: &Path) -> Result<String, RepoError> {
        let path = fs::canonicalize(path).await?;
        if !path.starts_with(&self.store_root) {
            return Err(RepoError::InvalidData(
                "testcase file escapes store root; import its content first".into(),
            ));
        }
        if fs::metadata(&path).await?.len() > 16 * 1024 * 1024 {
            return Err(RepoError::InvalidData(
                "testcase exceeds input limit".into(),
            ));
        }
        Ok(fs::read_to_string(path).await?)
    }

    /// # Errors
    /// Returns path ownership, symlink, I/O or atomic-rename errors; an unsuccessful
    /// replacement leaves the existing file intact.
    pub async fn write_owned(&self, path: &Path, bytes: &[u8]) -> Result<(), RepoError> {
        let parent = path
            .parent()
            .ok_or_else(|| RepoError::InvalidData("invalid file path".into()))?;
        self.owned_dir(parent).await?;
        // Atomic rename replaces a destination symlink without following it.
        let temp = parent.join(format!(".{}.tmp", uuid::Uuid::new_v4()));
        fs::write(&temp, bytes).await?;
        if let Err(error) = fs::rename(&temp, path).await {
            let _ = fs::remove_file(temp).await;
            return Err(error.into());
        }
        Ok(())
    }
}

#[async_trait::async_trait]
impl ProblemRepository for WorkspaceProblemRepository {
    async fn load_by_id(&self, id: crate::domain::ProblemId) -> Result<Problem, RepoError> {
        Self::load_by_id(self, id).await
    }
    async fn delete_by_id(&self, id: crate::domain::ProblemId) -> Result<(), RepoError> {
        Self::delete_by_id(self, id).await
    }
    async fn read_owned_text(&self, path: &Path) -> Result<String, RepoError> {
        Self::read_owned_text(self, path).await
    }
    fn root(&self) -> &Path {
        Self::root(self)
    }
    fn paths_for_id(&self, id: crate::domain::ProblemId) -> WorkspacePaths {
        Self::paths_for_id(self, id)
    }
    async fn owned_dir(&self, path: &Path) -> Result<(), RepoError> {
        Self::owned_dir(self, path).await
    }
    async fn write_owned(&self, path: &Path, bytes: &[u8]) -> Result<(), RepoError> {
        Self::write_owned(self, path, bytes).await
    }
    async fn testcase_data(
        &self,
        problem: &Problem,
        id: TestcaseId,
    ) -> Result<(String, String), RepoError> {
        Self::testcase_data(self, problem, id).await
    }

    async fn list_problems(&self) -> Result<Vec<Problem>, RepoError> {
        let data: Vec<String> = sqlx::query_scalar("SELECT data FROM problems ORDER BY id")
            .fetch_all(self.index.pool())
            .await?;
        let mut problems = Vec::new();
        for data in data {
            let mut problem: Problem = serde_json::from_str(&data)?;
            self.select_primary(&mut problem).await?;
            problems.push(problem);
        }
        Ok(problems)
    }

    async fn create_problem(&self, problem: &Problem) -> Result<(), RepoError> {
        let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM problems WHERE id = ?)")
            .bind(problem.id.0.to_string())
            .fetch_one(self.index.pool())
            .await?;
        if exists {
            return Err(RepoError::AlreadyExists);
        }
        self.save_problem(problem).await
    }
    async fn update_problem(&self, problem: &Problem) -> Result<(), RepoError> {
        self.load_by_id(problem.id).await?;
        self.save_problem(problem).await
    }
    async fn delete_problem(&self, source_path: &Path) -> Result<(), RepoError> {
        self.delete_by_id(self.id_for(source_path).await?).await
    }
    async fn move_problem(
        &self,
        source_path: &Path,
        destination: &Path,
    ) -> Result<Problem, RepoError> {
        let mut problem = self.load_problem(source_path).await?;
        // The editor owns the source file move. Rebind only after the new file exists.
        problem.src.0 = fs::canonicalize(destination).await?;
        self.save_problem(&problem).await?;
        Ok(problem)
    }
    async fn save_problem(&self, problem: &Problem) -> Result<(), RepoError> {
        self.save_problem_with_testcases(problem, &HashMap::new())
            .await
    }
    async fn save_problem_with_testcases(
        &self,
        problem: &Problem,
        payloads: &HashMap<TestcaseId, (String, String)>,
    ) -> Result<(), RepoError> {
        self.save_with_testcases(problem, payloads).await
    }
    async fn load_problem(&self, source_path: &Path) -> Result<Problem, RepoError> {
        let mut problem = self.load_by_id(self.id_for(source_path).await?).await?;
        problem.src.0 = fs::canonicalize(source_path).await?;
        Ok(problem)
    }
    async fn save_testcases(
        &self,
        source_path: &Path,
        payloads: &HashMap<TestcaseId, (String, String)>,
    ) -> Result<(), RepoError> {
        let problem = self.load_problem(source_path).await?;
        self.save_problem_with_testcases(&problem, payloads).await
    }
    async fn save_config(
        &self,
        source_path: &Path,
        configs: &DocumentMut,
    ) -> Result<(), RepoError> {
        let paths = self.paths_for_id(self.id_for(source_path).await?);
        self.write_owned(&paths.config_path, configs.to_string().as_bytes())
            .await
    }
    async fn save_history_run(
        &self,
        source_path: &Path,
        run_id: RunId,
        source_code: &str,
        detail: &HistoryEntry,
    ) -> Result<(), RepoError> {
        let paths = self.paths_for_id(self.id_for(source_path).await?);
        let ext = source_path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("txt");
        let (source, result) = paths.get_history_run_paths(&run_id, ext);
        self.write_owned(&source, source_code.as_bytes()).await?;
        self.write_owned(&result, &serde_json::to_vec(detail)?)
            .await
    }
}
