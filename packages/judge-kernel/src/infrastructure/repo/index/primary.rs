use super::{IndexError, ProblemId, ProblemIndex, SourceBinding, SourceIndex, SourceRole};
use std::collections::HashMap;

/// Sources arrive in stable preference order: original, then oldest linked binding.
/// Selection observes files without rewriting IDs, history, or the source index.
pub(super) async fn assign(sources: &mut [SourceBinding]) {
    let mut preferred = HashMap::new();
    let mut available = HashMap::new();
    for source in sources.iter() {
        preferred.entry(source.problem_id).or_insert(source.code_id);
        if !available.contains_key(&source.problem_id)
            && tokio::fs::metadata(&source.source_path)
                .await
                .is_ok_and(|meta| meta.is_file())
            && tokio::fs::File::open(&source.source_path).await.is_ok()
        {
            available.insert(source.problem_id, source.code_id);
        }
    }
    for source in sources {
        let primary = available
            .get(&source.problem_id)
            .or_else(|| preferred.get(&source.problem_id));
        source.role = if primary == Some(&source.code_id) {
            SourceRole::Primary
        } else {
            SourceRole::Linked
        };
    }
}

impl ProblemIndex {
    pub(super) async fn with_role(
        &self,
        mut source: SourceBinding,
    ) -> Result<SourceBinding, IndexError> {
        if let Some(binding) = self
            .sources(Some(ProblemId(source.problem_id)))
            .await?
            .iter()
            .find(|binding| binding.code_id == source.code_id)
        {
            source.role = binding.role;
        }
        Ok(source)
    }
}
