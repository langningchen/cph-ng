use cph_ng_judge::{
    application::{method::Method, tasks::TaskLimits},
    domain::{Problem, SourcePath},
    infrastructure::kernel::Kernel,
    ports::{ExchangeError, ImportedData, ProblemImporter},
};
use serde_json::json;
use std::{path::Path, sync::Arc};

#[derive(Debug)]
struct FixedImporter(Problem);
impl ProblemImporter for FixedImporter {
    fn can_import(&self, _path: &Path) -> bool {
        true
    }
    fn import(&self, _path: &Path) -> Result<ImportedData, ExchangeError> {
        Ok(ImportedData {
            problem: self.0.clone(),
            language_env: toml_edit::DocumentMut::new(),
            testcase_payloads: std::collections::HashMap::new(),
        })
    }
}

#[tokio::test]
async fn failed_configuration_does_not_publish_an_import_or_reserve_its_source()
-> anyhow::Result<()> {
    let root = tempfile::tempdir()?;
    let source = root.path().join("main.py");
    let input = root.path().join("import.prob");
    tokio::fs::write(&source, "print(1)").await?;
    tokio::fs::write(&input, "{}").await?;
    let kernel = Kernel::open(
        &root.path().join("store"),
        &[root.path().to_path_buf()],
        TaskLimits::default(),
    )
    .await?;
    let problem = Problem::new("import".into(), SourcePath(source.clone()));
    let config_path = kernel.repo.paths_for_id(problem.id).config_path;
    let mut commands = (*kernel).clone();
    commands.importers = vec![Arc::new(FixedImporter(problem.clone()))];
    tokio::fs::create_dir_all(&config_path).await?;
    let params = json!({"input":input,"format":"prob","source_path":source});
    assert!(
        commands
            .execute(Method::ProblemImport, params.clone())
            .await
            .is_err()
    );
    assert_eq!(
        kernel.execute(Method::ProblemList, json!({})).await?,
        json!([])
    );
    assert!(kernel.index.sources(Some(problem.id)).await?.is_empty());
    tokio::fs::remove_dir(&config_path).await?;
    commands
        .execute(Method::ProblemImport, params.clone())
        .await?;
    assert!(config_path.is_file());
    tokio::fs::write(&config_path, "# user configuration").await?;
    assert!(
        commands
            .execute(Method::ProblemImport, params)
            .await
            .is_err()
    );
    assert_eq!(
        tokio::fs::read_to_string(&config_path).await?,
        "# user configuration"
    );
    assert_eq!(kernel.repo.load_by_id(problem.id).await?.name, "import");
    kernel.close().await?;
    Ok(())
}
