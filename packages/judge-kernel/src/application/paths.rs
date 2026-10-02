use crate::application::error::ErrorCode;
use std::{
    path::{Path, PathBuf},
    sync::{Arc, RwLock},
};
use tokio::io::AsyncWriteExt;

use crate::application::tasks::TaskFailure;

#[derive(Debug, Clone)]
pub struct PathPolicy {
    roots: Arc<RwLock<Vec<PathBuf>>>,
}
impl PathPolicy {
    /// Direct CLI callers select their own files; store writes remain repository-owned.
    #[must_use]
    pub fn unrestricted() -> Self {
        Self {
            roots: Arc::default(),
        }
    }
    #[must_use]
    pub fn roots(&self) -> Vec<PathBuf> {
        self.roots
            .read()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .clone()
    }

    /// Check an already canonicalized path against the shared workspace roots.
    #[must_use]
    pub fn permits(&self, path: &Path) -> bool {
        let roots = self
            .roots
            .read()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        roots.is_empty() || roots.iter().any(|root| path.starts_with(root))
    }

    /// Attach roots supplied by a trusted local RPC client. All paths are validated
    /// before extending the shared policy, including importers and active sessions.
    ///
    /// # Errors
    /// Rejects relative, missing or non-directory paths and excessive root counts.
    pub async fn attach(&self, workspaces: &[PathBuf]) -> Result<(), TaskFailure> {
        if workspaces.len() > 64 {
            return Err(TaskFailure::invalid(
                "At most 64 workspace roots may be attached at once",
            ));
        }
        let mut attached = Vec::new();
        for path in workspaces {
            if !path.is_absolute() {
                return Err(TaskFailure::invalid(
                    "Workspace roots must be absolute directories",
                ));
            }
            let path = tokio::fs::canonicalize(path)
                .await
                .map_err(|_| TaskFailure::invalid("Workspace root does not exist"))?;
            if !tokio::fs::metadata(&path)
                .await
                .map_err(|error| TaskFailure::filesystem("Cannot access file", &error))?
                .is_dir()
            {
                return Err(TaskFailure::invalid("Workspace roots must be directories"));
            }
            if !attached.contains(&path) {
                attached.push(path);
            }
        }
        let mut roots = self
            .roots
            .write()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        attached.retain(|path| !roots.contains(path));
        if roots.len() + attached.len() > 256 {
            return Err(TaskFailure::invalid(
                "At most 256 workspace roots may be attached to a kernel",
            ));
        }
        roots.extend(attached);
        Ok(())
    }

    /// # Errors
    /// Returns an I/O error if the store or any allowed workspace root cannot be
    /// canonicalized.
    pub async fn new(store: &Path, workspaces: &[PathBuf]) -> Result<Self, std::io::Error> {
        let mut roots = vec![tokio::fs::canonicalize(store).await?];
        for path in workspaces {
            roots.push(tokio::fs::canonicalize(path).await?);
        }
        Ok(Self {
            roots: Arc::new(RwLock::new(roots)),
        })
    }

    /// # Errors
    /// Returns invalid parameters for missing, non-file or disallowed paths, and reports
    /// filesystem failures.
    pub async fn read(&self, path: &Path) -> Result<PathBuf, TaskFailure> {
        let path = tokio::fs::canonicalize(path)
            .await
            .map_err(|error| TaskFailure::filesystem("Cannot read path", &error))?;
        if !self.permits(&path) {
            return Err(TaskFailure::new(
                ErrorCode::InvalidParams,
                "Path is outside configured workspace roots",
            ));
        }
        if !tokio::fs::metadata(&path)
            .await
            .map_err(|error| TaskFailure::filesystem("Cannot access file", &error))?
            .is_file()
        {
            return Err(TaskFailure::new(
                ErrorCode::InvalidParams,
                "Path must refer to a regular file",
            ));
        }
        Ok(path)
    }

    /// # Errors
    /// Creates a new directory inside permitted roots, without following a destination symlink.
    pub async fn create_directory(&self, path: &Path) -> Result<PathBuf, TaskFailure> {
        let parent = path
            .parent()
            .ok_or_else(|| TaskFailure::invalid("Invalid directory path"))?;
        let parent = tokio::fs::canonicalize(parent).await.map_err(|error| {
            TaskFailure::filesystem("Cannot read destination directory", &error)
        })?;
        if !self.permits(&parent) {
            return Err(TaskFailure::invalid(
                "Path is outside configured workspace roots",
            ));
        }
        let path = parent.join(
            path.file_name()
                .ok_or_else(|| TaskFailure::invalid("Invalid directory name"))?,
        );
        tokio::fs::create_dir(&path).await.map_err(|error| {
            TaskFailure::filesystem("Cannot create destination directory", &error)
        })?;
        Ok(path)
    }

    /// # Errors
    /// Returns invalid parameters for oversized source, a disallowed path, an existing
    /// destination or a failed write.
    pub async fn create(&self, path: &Path, content: &str) -> Result<PathBuf, TaskFailure> {
        if content.len() > 16 * 1024 * 1024 {
            return Err(TaskFailure::new(
                ErrorCode::InvalidParams,
                "Source exceeds size limit",
            ));
        }
        self.write_new(path, content.as_bytes()).await
    }
    /// # Errors
    /// Writes an export atomically without replacing existing files or following symlinks.
    pub async fn write_new(&self, path: &Path, content: &[u8]) -> Result<PathBuf, TaskFailure> {
        let parent = path
            .parent()
            .ok_or_else(|| TaskFailure::new(ErrorCode::InvalidParams, "Invalid source path"))?;
        let parent = tokio::fs::canonicalize(parent).await.map_err(|error| {
            TaskFailure::filesystem("Cannot read destination directory", &error)
        })?;
        if !self.permits(&parent) {
            return Err(TaskFailure::new(
                ErrorCode::InvalidParams,
                "Path is outside configured workspace roots",
            ));
        }
        let file = parent.join(
            path.file_name()
                .ok_or_else(|| TaskFailure::new(ErrorCode::InvalidParams, "Invalid file name"))?,
        );
        let temporary = parent.join(format!(".cph-write-{}.tmp", uuid::Uuid::new_v4()));
        let mut output = tokio::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .await
            .map_err(|error| TaskFailure::filesystem("Cannot access file", &error))?;
        let result = async {
            output
                .write_all(content)
                .await
                .map_err(|error| TaskFailure::filesystem("Cannot access file", &error))?;
            output
                .sync_all()
                .await
                .map_err(|error| TaskFailure::filesystem("Cannot access file", &error))?;
            drop(output);
            // A hard link publishes the complete file atomically and cannot replace an
            // existing destination, including a symlink created during the write.
            tokio::fs::hard_link(&temporary, &file)
                .await
                .map_err(|error| TaskFailure::filesystem("Cannot create destination file", &error))
        }
        .await;
        let _ = tokio::fs::remove_file(&temporary).await;
        result?;
        Ok(file)
    }
}

/// Read source snapshots without trusting a racy metadata size check.
///
/// # Errors
/// Returns an error if the source cannot be read as UTF-8 or exceeds the source-size
/// limit.
pub async fn read_source(path: &Path) -> Result<String, TaskFailure> {
    use tokio::io::AsyncReadExt;
    let file = tokio::fs::File::open(path)
        .await
        .map_err(|error| TaskFailure::filesystem("Cannot access file", &error))?;
    let mut data = String::new();
    file.take(16 * 1024 * 1024 + 1)
        .read_to_string(&mut data)
        .await
        .map_err(|error| TaskFailure::filesystem("Cannot access file", &error))?;
    if data.len() > 16 * 1024 * 1024 {
        return Err(TaskFailure::new(
            ErrorCode::InvalidParams,
            "Source exceeds size limit",
        ));
    }
    Ok(data)
}
