pub use crate::ports::index::IndexError;
use crate::{
    domain::ProblemId,
    ports::index::{SourceBinding, SourceIndex, SourceRole},
};
use sqlx::{FromRow, SqlitePool};
use std::path::Path;
use uuid::Uuid;
mod file;
mod primary;
pub use file::file_hash;

#[derive(Debug, Clone)]
pub struct ProblemIndex {
    pool: SqlitePool,
}
#[derive(Debug, FromRow)]
struct Row {
    code_id: String,
    problem_id: String,
    current_path: Option<String>,
}
impl Row {
    fn binding(&self) -> Result<SourceBinding, IndexError> {
        Ok(SourceBinding {
            role: SourceRole::Linked,
            code_id: Uuid::parse_str(&self.code_id).map_err(|_| sqlx::Error::RowNotFound)?,
            problem_id: Uuid::parse_str(&self.problem_id).map_err(|_| sqlx::Error::RowNotFound)?,
            source_path: self.current_path.as_deref().unwrap_or_default().into(),
        })
    }
}
impl ProblemIndex {
    /// # Errors
    /// Returns database migration errors.
    pub async fn open(root: &Path) -> Result<Self, IndexError> {
        Ok(Self::from_pool(super::database::open(root).await?))
    }
    #[must_use]
    pub fn from_pool(pool: SqlitePool) -> Self {
        Self { pool }
    }
    #[must_use]
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }
    /// # Errors
    /// Rejects unindexed files and ambiguous copies; only confirmed moves preserve identity.
    pub async fn resolve(&self, path: &Path) -> Result<ProblemId, IndexError> {
        Ok(ProblemId(self.source(path).await?.problem_id))
    }
    async fn candidates(&self, field: &str, value: &str) -> Result<Vec<Row>, IndexError> {
        Ok(sqlx::query_as(&format!(
            "SELECT code_id, problem_id, current_path FROM source_index WHERE {field} = ?"
        ))
        .bind(value)
        .fetch_all(&self.pool)
        .await?)
    }
    async fn identify(&self, path: &Path) -> Result<Option<Row>, IndexError> {
        // A registered path survives an editor's atomic file replacement.
        let rows = self
            .candidates("current_path", &path.to_string_lossy())
            .await?;
        if let Some(row) = rows.into_iter().next() {
            return Ok(Some(row));
        }
        let meta = tokio::fs::metadata(path).await?;
        if let Some((device, inode)) = file_identity(path, &meta) {
            let rows = sqlx::query_as("SELECT code_id, problem_id, current_path FROM source_index WHERE device=? AND inode=?")
                .bind(device).bind(inode).fetch_all(&self.pool).await?;
            if let Some(row) = moved(rows).await? {
                return Ok(Some(row));
            }
        }
        let owned = path.to_owned();
        if let Some(marker) = tokio::task::spawn_blocking(move || file::read_marker(&owned))
            .await
            .map_err(std::io::Error::other)?
        {
            let rows = self.candidates("marker", &marker).await?;
            if let Some(row) = moved(rows).await? {
                return Ok(Some(row));
            }
        }
        moved(
            self.candidates("content_hash", &file_hash(path).await?)
                .await?,
        )
        .await
    }
    /// # Errors
    /// Rejects a source already owned by a different problem or an unconfirmed copy.
    pub async fn upsert(&self, path: &Path, id: ProblemId) -> Result<(), IndexError> {
        let path = regular(path).await?;
        // Creating an independent problem is an explicit choice; matching content/xattr
        // does not give a different file ownership over an existing code ID.
        let rows = self
            .candidates("current_path", &path.to_string_lossy())
            .await?;
        if let Some(row) = rows.into_iter().next() {
            if row.problem_id != id.0.to_string() {
                return Err(IndexError::Conflict(vec![row.problem_id]));
            }
            return self.persist(&path, row.binding()?).await;
        }
        let sources = self.sources(Some(id)).await?;
        if sources.is_empty() {
            return self
                .persist(
                    &path,
                    SourceBinding {
                        role: SourceRole::Primary,
                        code_id: id.0,
                        problem_id: id.0,
                        source_path: path.clone(),
                    },
                )
                .await;
        }
        self.rebuild(&path, id).await
    }
    /// # Errors
    /// Rebinds a missing sole source or refreshes a registered source; live copies require link.
    pub async fn rebuild(&self, path: &Path, id: ProblemId) -> Result<(), IndexError> {
        let path = regular(path).await?;
        match self.identify(&path).await? {
            Some(row) if row.problem_id == id.0.to_string() => {
                self.persist(&path, row.binding()?).await
            }
            Some(row) => Err(IndexError::Conflict(vec![row.problem_id])),
            None => {
                let sources = self.sources(Some(id)).await?;
                match sources.as_slice() {
                    [source] if !tokio::fs::try_exists(&source.source_path).await? => {
                        self.persist(&path, source.clone()).await
                    }
                    [] => {
                        self.persist(
                            &path,
                            SourceBinding {
                                role: SourceRole::Primary,
                                code_id: id.0,
                                problem_id: id.0,
                                source_path: path.clone(),
                            },
                        )
                        .await
                    }
                    _ => Err(IndexError::Conflict(
                        sources.iter().map(|s| s.problem_id.to_string()).collect(),
                    )),
                }
            }
        }
    }
    async fn persist(&self, path: &Path, source: SourceBinding) -> Result<(), IndexError> {
        if let Some(row) = self
            .candidates("current_path", &path.to_string_lossy())
            .await?
            .into_iter()
            .next()
            && row.code_id != source.code_id.to_string()
        {
            return Err(IndexError::Conflict(vec![row.problem_id]));
        }
        let meta = tokio::fs::metadata(path).await?;
        let identity = file_identity(path, &meta);
        if let Some((device, inode)) = identity {
            let rows: Vec<String> = sqlx::query_scalar(
                "SELECT problem_id FROM source_index WHERE device=? AND inode=? AND code_id!=?",
            )
            .bind(device)
            .bind(inode)
            .bind(source.code_id.to_string())
            .fetch_all(&self.pool)
            .await?;
            if !rows.is_empty() {
                return Err(IndexError::Conflict(rows));
            }
        }
        let hash = file_hash(path).await?;
        let after = tokio::fs::metadata(path).await?;
        if meta.len() != after.len()
            || meta.modified()? != after.modified()?
            || identity != file_identity(path, &after)
        {
            return Err(IndexError::Changed);
        }
        let owned = path.to_owned();
        let marker =
            tokio::task::spawn_blocking(move || file::write_marker(&owned, source.code_id))
                .await
                .map_err(std::io::Error::other)?;
        sqlx::query("INSERT INTO source_index(code_id,problem_id,marker,device,inode,content_hash,current_path,first_seen,last_seen) VALUES (?,?,?,?,?,?,?,unixepoch(),unixepoch()) ON CONFLICT(code_id) DO UPDATE SET marker=excluded.marker,device=excluded.device,inode=excluded.inode,content_hash=excluded.content_hash,current_path=excluded.current_path,last_seen=excluded.last_seen")
            .bind(source.code_id.to_string()).bind(source.problem_id.to_string()).bind(marker).bind(identity.map(|v| v.0)).bind(identity.map(|v| v.1)).bind(hash).bind(path.to_string_lossy().as_ref()).execute(&self.pool).await?;
        Ok(())
    }
    /// # Errors
    /// Returns a database error.
    pub async fn remove(&self, id: ProblemId) -> Result<(), IndexError> {
        sqlx::query("DELETE FROM source_index WHERE problem_id=?")
            .bind(id.0.to_string())
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
async fn regular(path: &Path) -> Result<std::path::PathBuf, IndexError> {
    let path = tokio::fs::canonicalize(path).await?;
    if !tokio::fs::metadata(&path).await?.is_file() {
        return Err(std::io::Error::other("source must be a regular file").into());
    }
    Ok(path)
}
fn file_identity(path: &Path, meta: &std::fs::Metadata) -> Option<(i64, i64)> {
    if !meta.is_file() {
        return None;
    }
    #[cfg(unix)]
    {
        let _ = path;
        Some(file::identity(meta))
    }
    #[cfg(not(unix))]
    {
        file::identity(path, meta)
    }
}
async fn moved(rows: Vec<Row>) -> Result<Option<Row>, IndexError> {
    if rows.is_empty() {
        return Ok(None);
    }
    if let [row] = rows.as_slice() {
        if let Some(path) = &row.current_path {
            if !tokio::fs::try_exists(path).await? {
                return Ok(rows.into_iter().next());
            }
        } else {
            return Ok(rows.into_iter().next());
        }
    }
    Err(IndexError::Conflict(
        rows.into_iter().map(|row| row.problem_id).collect(),
    ))
}
#[async_trait::async_trait]
impl SourceIndex for ProblemIndex {
    async fn resolve(&self, path: &Path) -> Result<ProblemId, IndexError> {
        Self::resolve(self, path).await
    }
    async fn rebuild(&self, path: &Path, id: ProblemId) -> Result<(), IndexError> {
        Self::rebuild(self, path, id).await
    }
    async fn source(&self, path: &Path) -> Result<SourceBinding, IndexError> {
        let path = regular(path).await?;
        let row = self
            .identify(&path)
            .await?
            .ok_or_else(|| IndexError::NotFound(path.clone()))?;
        let mut source = row.binding()?;
        self.persist(&path, source.clone()).await?;
        source.source_path = path;
        self.with_role(source).await
    }
    async fn sources(&self, id: Option<ProblemId>) -> Result<Vec<SourceBinding>, IndexError> {
        let id = id.map(|id| id.0.to_string());
        let rows:Vec<Row>=sqlx::query_as("SELECT code_id,problem_id,current_path FROM source_index WHERE (? IS NULL OR problem_id=?) ORDER BY problem_id,code_id!=problem_id,first_seen,code_id")
            .bind(&id).bind(&id).fetch_all(&self.pool).await?;
        let mut sources = rows
            .iter()
            .map(Row::binding)
            .collect::<Result<Vec<_>, _>>()?;
        primary::assign(&mut sources).await;
        Ok(sources)
    }
    async fn link(&self, path: &Path, id: ProblemId) -> Result<SourceBinding, IndexError> {
        let path = regular(path).await?;
        if let Some(row) = self
            .candidates("current_path", &path.to_string_lossy())
            .await?
            .into_iter()
            .next()
        {
            if row.problem_id == id.0.to_string() {
                return self.with_role(row.binding()?).await;
            }
            return Err(IndexError::Conflict(vec![row.problem_id]));
        }
        let source = SourceBinding {
            role: SourceRole::Linked,
            code_id: Uuid::new_v4(),
            problem_id: id.0,
            source_path: path.clone(),
        };
        self.persist(&path, source.clone()).await?;
        self.with_role(source).await
    }
    async fn rebind(&self, code_id: Uuid, path: &Path) -> Result<(), IndexError> {
        let path = regular(path).await?;
        let row = self
            .candidates("code_id", &code_id.to_string())
            .await?
            .into_iter()
            .next()
            .ok_or_else(|| IndexError::NotFound(path.clone()))?;
        self.persist(&path, row.binding()?).await
    }
}
