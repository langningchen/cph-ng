use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{OnceLock, RwLock},
};

use figment::{
    Figment,
    providers::{Env, Format, Serialized, Toml},
};

use crate::{
    domain::config::GlobalConfig,
    ports::config::{ConfigError, ConfigRepository},
};

pub struct TomlFileConfigAdapter {
    store_root: PathBuf,
}

/// Cache key type for figment instances.
type FigmentCacheKey = (PathBuf, Option<PathBuf>);

/// `Figment` cache keyed by `(store_root, local_config_path)`.
static FIGMENT_CACHE: OnceLock<RwLock<HashMap<FigmentCacheKey, Figment>>> = OnceLock::new();

impl TomlFileConfigAdapter {
    pub fn new(store_root: PathBuf) -> Self {
        Self { store_root }
    }

    fn global_config_path(&self) -> PathBuf {
        self.store_root.join("config.toml")
    }

    fn get_figment(&self, path: Option<&Path>) -> Result<Figment, ConfigError> {
        let path_buf = path.map(Path::to_path_buf);
        let cache_key: FigmentCacheKey = (self.store_root.clone(), path_buf);

        let cache_lock = FIGMENT_CACHE.get_or_init(|| RwLock::new(HashMap::new()));
        {
            let read_map = cache_lock
                .read()
                .map_err(|e| ConfigError::Lock(e.to_string()))?;
            if let Some(cached) = read_map.get(&cache_key) {
                return Ok(cached.clone());
            }
        }

        let mut figment = Figment::new()
            .merge(Serialized::defaults(GlobalConfig::default()))
            .merge(Toml::file(self.global_config_path()));
        figment = if let Some(path) = path {
            figment.merge(Toml::file(path))
        } else {
            figment
        };
        figment = figment.merge(Env::prefixed("CPH_").split("__"));

        cache_lock
            .write()
            .map_err(|e| ConfigError::Lock(e.to_string()))?
            .insert(cache_key, figment.clone());
        Ok(figment)
    }
}

impl ConfigRepository for TomlFileConfigAdapter {
    fn get_config(&self, path: Option<&Path>) -> Result<GlobalConfig, ConfigError> {
        let global_path = self.global_config_path();
        if !global_path.exists() {
            if let Some(parent) = global_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(
                &global_path,
                include_str!("../../../assets/default_config.toml"),
            )?;
        }

        let figment = self.get_figment(path)?;
        figment.extract::<GlobalConfig>().map_err(ConfigError::from)
    }

    fn format_config(&self, path: Option<&Path>) -> Result<String, ConfigError> {
        let config = self.get_config(path)?;
        toml::to_string_pretty(&config).map_err(|e| ConfigError::Format(e.to_string()))
    }

    fn get_config_sources(&self, path: Option<&Path>) -> Vec<&'static str> {
        let mut sources = vec!["defaults"];
        if self.global_config_path().exists() {
            sources.push("global");
        }
        if path.is_some_and(Path::exists) {
            sources.push("workspace");
        }
        if std::env::vars().any(|(k, _)| k.starts_with("CPH_")) {
            sources.push("env");
        }
        sources
    }
}
