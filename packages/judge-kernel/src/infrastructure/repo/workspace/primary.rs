use super::WorkspaceProblemRepository;
use crate::{
    domain::Problem,
    ports::{
        RepoError,
        index::{SourceIndex, SourceRole},
    },
};

impl WorkspaceProblemRepository {
    pub(super) async fn select_primary(&self, problem: &mut Problem) -> Result<(), RepoError> {
        if let Some(source) = self
            .index
            .sources(Some(problem.id))
            .await?
            .into_iter()
            .find(|source| source.role == SourceRole::Primary)
        {
            problem.src.0 = source.source_path;
        }
        Ok(())
    }
}
