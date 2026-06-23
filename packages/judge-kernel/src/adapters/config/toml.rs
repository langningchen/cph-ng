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
    #[allow(clippy::missing_const_for_fn)]
    pub fn new(store_root: PathBuf) -> Self {
        Self { store_root }
    }

    fn global_config_path(&self) -> PathBuf {
        self.store_root.join("config.toml")
    }

    pub fn template_toml() -> &'static str {
        r#"# CPH-NG Global Configuration Template

[judge]
# 默认编译器路径 (例如: "g++", "clang++")
# compiler = "g++"

# 默认编译参数
# compiler_args = ["-O3", "-Wall"]

# 默认运行限制
time_limit_ms = 1000
memory_limit_mb = 256

[system]
# 系统级逻辑配置
"#
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
            .merge(Toml::file(self.global_config_path()))
            .merge(Env::prefixed("CPH_").split("__"));

        if let Some(path) = path {
            figment = figment.merge(Toml::file(path));
        }

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
            std::fs::write(&global_path, Self::template_toml())?;
        }

        let figment = self.get_figment(path)?;
        figment.extract::<GlobalConfig>().map_err(ConfigError::from)
    }
}
