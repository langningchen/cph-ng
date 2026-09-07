use std::path::PathBuf;

use thiserror::Error;

use crate::ports::{ExchangeError, ProblemImporter, ProblemRepository, RepoError};

#[derive(Error, Debug)]
pub enum MigrateError {
    #[error("Unsupported format")]
    UnsupportedFormat,
    #[error("Import failed: {0}")]
    ImportFailed(ExchangeError),
    #[error("Repository error: {0}")]
    RepoError(RepoError),
}

/// # Errors
/// Returns an unsupported-format error, importer validation/I/O error, or repository
/// persistence error.
pub async fn import_file(
    input: PathBuf,
    importers: &[&dyn ProblemImporter],
    repo: &dyn ProblemRepository,
) -> Result<(), MigrateError> {
    let imported_data = importers
        .iter()
        .find(|importer| importer.can_import(&input))
        .ok_or(MigrateError::UnsupportedFormat)?
        .import(&input)
        .map_err(MigrateError::ImportFailed)?;

    let src_path = &imported_data.problem.src.0;
    repo.save_problem_with_testcases(&imported_data.problem, &imported_data.testcase_payloads)
        .await
        .map_err(MigrateError::RepoError)?;
    let configs = imported_data.language_env;
    repo.save_config(src_path, &configs)
        .await
        .map_err(MigrateError::RepoError)?;
    Ok(())
}
