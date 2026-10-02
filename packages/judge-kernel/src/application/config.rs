//! Shared configuration operations for RPC and CLI.
use super::tasks::TaskFailure;
use crate::{
    domain::GlobalConfig,
    ports::{ConfigRepository, ProblemRepository, RepoError},
};
use serde_json::{Value, json};
use std::{
    path::{Path, PathBuf},
    sync::Arc,
};
use tokio::sync::Mutex;

pub const CONFIG_BYTES: usize = 1024 * 1024;
#[derive(Debug)]
pub struct ConfigService {
    repository: Arc<dyn ConfigRepository>,
    files: Arc<dyn ProblemRepository>,
    writes: Mutex<()>,
}
impl ConfigService {
    #[must_use]
    pub fn new(repository: Arc<dyn ConfigRepository>, files: Arc<dyn ProblemRepository>) -> Self {
        Self {
            repository,
            files,
            writes: Mutex::new(()),
        }
    }
    #[must_use]
    pub fn path(&self, local: Option<&Path>) -> PathBuf {
        local.map_or_else(|| self.files.root().join("config.toml"), Path::to_path_buf)
    }
    /// # Errors
    /// Returns configuration parsing or validation errors.
    pub fn effective(&self, local: Option<&Path>) -> Result<GlobalConfig, TaskFailure> {
        let config = self.repository.get_config(local).map_err(invalid)?;
        validate(&config)?;
        Ok(config)
    }
    /// # Errors
    /// Returns configuration parsing or filesystem errors.
    pub async fn get(&self, local: Option<&Path>) -> Result<Value, TaskFailure> {
        let _guard = self.writes.lock().await;
        self.view(local).await
    }
    async fn view(&self, local: Option<&Path>) -> Result<Value, TaskFailure> {
        let config = self.effective(local)?;
        let raw_toml = self.raw(local).await?;
        let local_config: toml::Value = toml::from_str(&raw_toml).map_err(invalid)?;
        Ok(
            json!({"path":self.path(local), "sources":self.repository.get_config_sources(local),
            "toml":toml::to_string_pretty(&config).map_err(TaskFailure::internal)?,
            "config":config, "raw_toml":raw_toml, "local_config":local_config}),
        )
    }
    async fn raw(&self, local: Option<&Path>) -> Result<String, TaskFailure> {
        match self.files.read_owned_text(&self.path(local)).await {
            Ok(value) if value.len() <= CONFIG_BYTES => Ok(value),
            Ok(_) => Err(TaskFailure::invalid("Configuration exceeds 1 MiB")),
            Err(RepoError::Io(error)) if error.kind() == std::io::ErrorKind::NotFound => {
                Ok(String::new())
            }
            Err(error) => Err(TaskFailure::internal(error)),
        }
    }
    /// # Errors
    /// Rejects malformed input before atomically replacing the selected layer.
    pub async fn set(
        &self,
        local: Option<&Path>,
        content: Option<&str>,
        patch: Option<&Value>,
        expected_raw: Option<&str>,
    ) -> Result<Value, TaskFailure> {
        let _guard = self.writes.lock().await;
        if let Some(expected) = expected_raw
            && self.raw(local).await? != expected
        {
            return Err(TaskFailure::new(
                super::error::ErrorCode::Conflict,
                "Configuration changed; reload before saving",
            ));
        }
        let content = match (content, patch) {
            (Some(content), None) => content.to_owned(),
            (None, Some(patch)) if patch.is_object() => {
                let raw: toml::Value = toml::from_str(&self.raw(local).await?).map_err(invalid)?;
                let mut value = serde_json::to_value(raw).map_err(TaskFailure::internal)?;
                merge_patch(&mut value, patch);
                let table: toml::Value = serde_json::from_value(value).map_err(invalid)?;
                toml::to_string_pretty(&table).map_err(invalid)?
            }
            _ => {
                return Err(TaskFailure::invalid(
                    "Supply exactly one of toml or an object patch",
                ));
            }
        };
        if content.len() > CONFIG_BYTES {
            return Err(TaskFailure::invalid("Configuration exceeds 1 MiB"));
        }
        let raw: GlobalConfig = toml::from_str(&content).map_err(invalid)?;
        validate(&raw)?;
        validate(
            &self
                .repository
                .validate_content(local, &content)
                .map_err(invalid)?,
        )?;
        self.files
            .write_owned(&self.path(local), content.as_bytes())
            .await
            .map_err(TaskFailure::internal)?;
        let mut result = self.view(local).await?;
        if let Some(object) = result.as_object_mut() {
            object.insert("updated".into(), json!(true));
        }
        Ok(result)
    }
    /// # Errors
    /// Returns filesystem errors; existing files are retained.
    pub async fn init(&self, local: Option<&Path>) -> Result<Value, TaskFailure> {
        let _guard = self.writes.lock().await;
        let path = self.path(local);
        let content = if local.is_some() {
            "# Per-problem overrides. Use problem update for stored judge limits.\n".to_owned()
        } else {
            include_str!("../../assets/default_config.toml").replace(
                "interpreter = \"python3\"",
                if cfg!(windows) {
                    "interpreter = \"python\""
                } else {
                    "interpreter = \"python3\""
                },
            )
        };
        match self.files.read_owned_text(&path).await {
            Ok(_) => return Ok(json!({"path":path,"created":false})),
            Err(RepoError::Io(error)) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(TaskFailure::internal(error)),
        }
        self.files
            .write_owned(&path, content.as_bytes())
            .await
            .map_err(TaskFailure::internal)?;
        Ok(json!({"path":path,"created":true}))
    }
}
fn invalid(error: impl std::fmt::Display) -> TaskFailure {
    TaskFailure::invalid(format!("Invalid configuration: {error}"))
}
pub fn merge_patch(value: &mut Value, patch: &Value) {
    let Some(fields) = patch.as_object() else {
        *value = patch.clone();
        return;
    };
    if !value.is_object() {
        *value = json!({});
    }
    if let Some(target) = value.as_object_mut() {
        for (key, item) in fields {
            if item.is_null() {
                target.remove(key);
            } else {
                merge_patch(target.entry(key.clone()).or_insert(Value::Null), item);
            }
        }
    }
}
/// # Errors
/// Returns invalid limits or empty executable paths.
pub fn validate(config: &GlobalConfig) -> Result<(), TaskFailure> {
    let judge = &config.judge;
    if config
        .compilation_timeout_ms
        .is_some_and(|v| !(1..=300_000).contains(&v))
        || !(1..=300_000).contains(&config.problem.time_limit)
        || config.problem.memory_limit == 0
        || !judge.tolerance.is_finite()
        || !(0.0..=1.0).contains(&judge.tolerance)
        || !(1..=16 * 1024 * 1024).contains(&judge.output_limit_bytes)
        || !(1..=1_000_000).contains(&judge.iterations)
        || judge
            .legacy_comparison
            .output_ratio_limit
            .is_some_and(|v| !v.is_finite() || !(0.0..=1_000_000.0).contains(&v))
    {
        return Err(TaskFailure::invalid("Invalid configuration limits"));
    }
    for language in config.languages.values() {
        if language
            .compiler_parts
            .as_ref()
            .is_some_and(|v| v.compiler.0.as_os_str().is_empty())
            || language
                .interpreter_parts
                .as_ref()
                .is_some_and(|v| v.interpreter.0.as_os_str().is_empty())
        {
            return Err(TaskFailure::invalid("Executable paths cannot be empty"));
        }
    }
    Ok(())
}
