use std::path::Path;

use thiserror::Error;

use crate::domain::config::GlobalConfig;

#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("Lock Error: {0}")]
    Lock(String),
    #[error("Figment Error: {0}")]
    Figment(Box<figment::Error>),
    #[error("Format Error: {0}")]
    Format(String),
    #[error("IO Error: {0}")]
    Io(#[from] std::io::Error),
}

impl From<figment::Error> for ConfigError {
    fn from(e: figment::Error) -> Self {
        ConfigError::Figment(Box::new(e))
    }
}

pub trait ConfigRepository: Send + Sync {
    /// Get the fully merged configuration.
    fn get_config(&self, path: Option<&Path>) -> Result<GlobalConfig, ConfigError>;

    /// Return the configuration formatted as a display string.
    fn format_config(&self, path: Option<&Path>) -> Result<String, ConfigError>;

    /// List active config sources in priority order (defaults, global, workspace, env).
    fn get_config_sources(&self, path: Option<&Path>) -> Vec<&'static str>;
}
