use std::path::PathBuf;

#[async_trait::async_trait]
pub trait SourceIndex: Send + Sync + std::fmt::Debug {
    async fn resolve(&self, path: &std::path::Path)
    -> Result<crate::domain::ProblemId, IndexError>;
    async fn source(&self, path: &std::path::Path) -> Result<SourceBinding, IndexError>;
    async fn sources(
        &self,
        problem_id: Option<crate::domain::ProblemId>,
    ) -> Result<Vec<SourceBinding>, IndexError>;
    async fn link(
        &self,
        path: &std::path::Path,
        id: crate::domain::ProblemId,
    ) -> Result<SourceBinding, IndexError>;
    async fn rebind(&self, code_id: uuid::Uuid, path: &std::path::Path) -> Result<(), IndexError>;
    async fn rebuild(
        &self,
        path: &std::path::Path,
        id: crate::domain::ProblemId,
    ) -> Result<(), IndexError>;
}

#[derive(Debug, thiserror::Error)]
pub enum IndexError {
    #[error("index database: {0}")]
    Database(#[from] sqlx::Error),
    #[error("file metadata: {0}")]
    Io(#[from] std::io::Error),
    #[error("problem source is not indexed: {0}")]
    NotFound(PathBuf),
    #[error("multiple index entries match the source")]
    Conflict(Vec<String>),
    #[error("source changed while being indexed")]
    Changed,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SourceBinding {
    pub code_id: uuid::Uuid,
    pub problem_id: uuid::Uuid,
    pub source_path: PathBuf,
    #[serde(default)]
    pub role: SourceRole,
}

/// Effective default source; identities and history do not change on fallback.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceRole {
    Primary,
    #[default]
    Linked,
}
