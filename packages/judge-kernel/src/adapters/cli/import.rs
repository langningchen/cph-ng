use std::path::{Path, PathBuf};

use crate::{
    adapters::{
        exchange::{legacy_bin::LegacyBin, legacy_cph::LegacyCphProb},
        repo::workspace::WorkspaceProblemRepository,
    },
    application::import::import_file,
    ports::{Inquire, ProblemImporter},
};

pub(super) async fn handle(
    input: PathBuf,
    store_root: &Path,
    inquire: &dyn Inquire,
) -> Result<(), Box<dyn std::error::Error>> {
    let repo = WorkspaceProblemRepository::new(store_root.to_path_buf());
    let importers_box: Vec<Box<dyn ProblemImporter>> = vec![
        Box::new(LegacyBin::new(store_root.to_path_buf())),
        Box::new(LegacyCphProb::new(store_root.to_path_buf())),
    ];
    let importers_refs: Vec<&dyn ProblemImporter> =
        importers_box.iter().map(AsRef::as_ref).collect();
    import_file(input, &importers_refs, &repo, inquire).await?;
    Ok(())
}
