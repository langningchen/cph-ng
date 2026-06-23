use std::path::Path;

use thiserror::Error;

use crate::domain::config::GlobalConfig;

#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("Lock Error: {0}")]
    Lock(String),
    #[error("Serialization Error: {0}")]
    Figment(Box<figment::Error>),
    #[error("IO Error: {0}")]
    Io(#[from] std::io::Error),
}

impl From<figment::Error> for ConfigError {
    fn from(e: figment::Error) -> Self {
        ConfigError::Figment(Box::new(e))
    }
}

pub trait ConfigRepository: Send + Sync {
    fn get_config(&self, path: Option<&Path>) -> Result<GlobalConfig, ConfigError>;
}
