use super::args::{ConfigAction, ConfigScope};
use crate::{
    application::{
        commands::index_error,
        config::{CONFIG_BYTES, ConfigService},
        paths::PathPolicy,
        tasks::TaskFailure,
    },
    infrastructure::{
        config::toml::TomlFileConfigAdapter,
        kernel::lock_store,
        repo::{
            index::ProblemIndex,
            workspace::{WorkspacePaths, WorkspaceProblemRepository},
        },
    },
};
use serde_json::{Value, json};
use std::{
    path::{Path, PathBuf},
    sync::Arc,
};
use tokio::io::AsyncReadExt;

pub(super) async fn handle(
    input: Option<&Path>,
    action: &ConfigAction,
    scope: Option<ConfigScope>,
    store_root: &Path,
    roots: &[PathBuf],
) -> Result<Value, TaskFailure> {
    tokio::fs::create_dir_all(store_root)
        .await
        .map_err(TaskFailure::internal)?;
    let root = tokio::fs::canonicalize(store_root)
        .await
        .map_err(TaskFailure::internal)?;
    let _lock = if scope != Some(ConfigScope::Router)
        && matches!(action, ConfigAction::Init | ConfigAction::Set { .. })
    {
        Some(lock_store(&root)?)
    } else {
        None
    };
    let paths = if roots.is_empty() {
        PathPolicy::unrestricted()
    } else {
        PathPolicy::new(&root, roots)
            .await
            .map_err(TaskFailure::internal)?
    };
    if scope == Some(ConfigScope::Router) {
        return router(action, &root.join("router"), &paths).await;
    }
    let index = ProblemIndex::open(&root)
        .await
        .map_err(TaskFailure::internal)?;
    let result = async {
        let local = if let Some(input) = input {
            let source = paths.read(input).await?;
            Some(
                WorkspacePaths::for_id(&root, index.resolve(&source).await.map_err(index_error)?)
                    .config_path,
            )
        } else {
            None
        };
        let repository = WorkspaceProblemRepository::from_index(root.clone(), index.clone())
            .await
            .map_err(TaskFailure::internal)?;
        let config = ConfigService::new(
            Arc::new(TomlFileConfigAdapter::new(root)),
            Arc::new(repository),
        );
        match action {
            ConfigAction::Path => Ok(json!({"path":config.path(local.as_deref())})),
            ConfigAction::Show => config.get(local.as_deref()).await,
            ConfigAction::Init => config.init(local.as_deref()).await,
            ConfigAction::Set {
                input: Some(input), ..
            } => {
                config
                    .set(
                        local.as_deref(),
                        Some(&read_config(input, &paths).await?),
                        None,
                        None,
                    )
                    .await
            }
            ConfigAction::Set { .. } => Err(TaskFailure::invalid(
                "Use --input for global or problem configuration",
            )),
        }
    }
    .await;
    index.pool().close().await;
    result
}
async fn read_config(input: &Path, paths: &PathPolicy) -> Result<String, TaskFailure> {
    let mut content = String::new();
    let result = if input == Path::new("-") {
        tokio::io::stdin()
            .take(CONFIG_BYTES as u64 + 1)
            .read_to_string(&mut content)
            .await
    } else {
        tokio::fs::File::open(paths.read(input).await?)
            .await
            .map_err(|error| TaskFailure::filesystem("Cannot open configuration", &error))?
            .take(CONFIG_BYTES as u64 + 1)
            .read_to_string(&mut content)
            .await
    };
    result.map_err(|error| TaskFailure::invalid(format!("Cannot read UTF-8 TOML: {error}")))?;
    if content.len() > CONFIG_BYTES {
        return Err(TaskFailure::invalid("Configuration exceeds 1 MiB"));
    }
    Ok(content)
}

async fn router(
    action: &ConfigAction,
    root: &Path,
    paths: &PathPolicy,
) -> Result<Value, TaskFailure> {
    use crate::infrastructure::config::router as config;
    let path = root.join("config.toml");
    match action {
        ConfigAction::Path => Ok(json!({"path":path})),
        ConfigAction::Show => Ok(json!(config::load(root)?)),
        ConfigAction::Init => {
            let existed = path.exists();
            config::load(root)?;
            Ok(json!({"path":path,"created":!existed}))
        }
        ConfigAction::Set { input, port } => {
            let result = if let Some(port) = port {
                config::set_port(root, *port)?
            } else {
                let input = input
                    .as_ref()
                    .ok_or_else(|| TaskFailure::invalid("Use --input or --port"))?;
                let content = read_config(input, paths).await?;
                let parsed = config::parse(&content)?;
                tokio::fs::create_dir_all(root)
                    .await
                    .map_err(TaskFailure::internal)?;
                let _lock = config::lock(root)?;
                config::save(root, &parsed)?;
                parsed
            };
            Ok(json!({"port":result.port,"saved":true}))
        }
    }
}
