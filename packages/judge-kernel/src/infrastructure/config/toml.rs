use std::path::{Path, PathBuf};

use crate::{
    domain::GlobalConfig,
    ports::config::{ConfigError, ConfigRepository},
};
use figment::{
    Figment,
    providers::{Env, Format, Serialized, Toml},
};

#[derive(Debug)]
pub struct TomlFileConfigAdapter {
    store_root: PathBuf,
}
impl TomlFileConfigAdapter {
    #[must_use]
    pub fn new(store_root: PathBuf) -> Self {
        Self { store_root }
    }
    fn global_config_path(&self) -> PathBuf {
        self.store_root.join("config.toml")
    }
    fn read_layer(&self, path: &Path) -> Result<String, ConfigError> {
        use std::io::Read;
        let path = match std::fs::canonicalize(path) {
            Ok(path) => path,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(String::new()),
            Err(error) => return Err(error.into()),
        };
        if !path.starts_with(std::fs::canonicalize(&self.store_root)?) {
            return Err(ConfigError::Format(
                "Configuration escapes the store root".into(),
            ));
        }
        let mut content = String::new();
        std::fs::File::open(path)?
            .take(1024 * 1024 + 1)
            .read_to_string(&mut content)?;
        if content.len() > 1024 * 1024 {
            return Err(ConfigError::Format("Configuration exceeds 1 MiB".into()));
        }
        Ok(content)
    }
    fn figment(
        &self,
        path: Option<&Path>,
        replacement: Option<&str>,
    ) -> Result<Figment, ConfigError> {
        let defaults = include_str!("../../../assets/default_config.toml").replace(
            "interpreter = \"python3\"",
            if cfg!(windows) {
                "interpreter = \"python\""
            } else {
                "interpreter = \"python3\""
            },
        );
        let mut figment = Figment::new()
            .merge(Serialized::defaults(GlobalConfig::default()))
            .merge(Toml::string(&defaults));
        figment = if path.is_none() && replacement.is_some() {
            figment.merge(Toml::string(replacement.unwrap_or_default()))
        } else {
            figment.merge(Toml::string(&self.read_layer(&self.global_config_path())?))
        };
        if let Some(path) = path {
            figment = match replacement {
                Some(content) => figment.merge(Toml::string(content)),
                None => figment.merge(Toml::string(&self.read_layer(path)?)),
            };
        }
        Ok(figment.merge(Env::prefixed("CPH_").split("__")))
    }
}
fn extract(figment: &Figment) -> Result<GlobalConfig, ConfigError> {
    let value: serde_json::Value = figment.extract().map_err(ConfigError::from)?;
    if let Some(languages) = value
        .get("languages")
        .and_then(serde_json::Value::as_object)
    {
        for (language, settings) in languages {
            for executable in ["compiler", "interpreter"] {
                let arguments = format!("{executable}_args");
                if settings
                    .get(&arguments)
                    .and_then(serde_json::Value::as_array)
                    .is_some_and(|args| !args.is_empty())
                    && settings
                        .get(executable)
                        .is_none_or(serde_json::Value::is_null)
                {
                    return Err(ConfigError::Format(format!(
                        "languages.{language}.{arguments} requires a configured or inherited {executable}"
                    )));
                }
            }
        }
    }
    figment.extract().map_err(ConfigError::from)
}

impl ConfigRepository for TomlFileConfigAdapter {
    fn get_config(&self, path: Option<&Path>) -> Result<GlobalConfig, ConfigError> {
        extract(&self.figment(path, None)?)
    }
    fn validate_content(
        &self,
        path: Option<&Path>,
        content: &str,
    ) -> Result<GlobalConfig, ConfigError> {
        extract(&self.figment(path, Some(content))?)
    }
    fn format_config(&self, path: Option<&Path>) -> Result<String, ConfigError> {
        toml::to_string_pretty(&self.get_config(path)?)
            .map_err(|e| ConfigError::Format(e.to_string()))
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
