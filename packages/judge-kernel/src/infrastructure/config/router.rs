use std::{io::Write, path::Path};

use crate::application::{error::ErrorCode, tasks::TaskFailure};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Config {
    pub port: u16,
    pub token: String,
}

pub(crate) fn load(root: &Path) -> Result<Config, TaskFailure> {
    std::fs::create_dir_all(root).map_err(TaskFailure::internal)?;
    let _lock = config_lock(root).map_err(TaskFailure::internal)?;
    let path = root.join("config.toml");
    if !path.exists() {
        let config = Config {
            port: 27121,
            token: format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple()),
        };
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        match options.open(&path) {
            Ok(mut file) => {
                file.write_all(
                    toml::to_string(&config)
                        .map_err(TaskFailure::internal)?
                        .as_bytes(),
                )
                .map_err(TaskFailure::internal)?;
                file.sync_all().map_err(TaskFailure::internal)?;
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
            Err(error) => return Err(TaskFailure::internal(error)),
        }
    }
    parse(&std::fs::read_to_string(path).map_err(TaskFailure::internal)?)
}

pub(crate) fn save(root: &Path, config: &Config) -> Result<(), TaskFailure> {
    let _lock = config_lock(root).map_err(TaskFailure::internal)?;
    let target = root.join("config.toml");
    let temporary = root.join(format!(".config-{}.tmp", Uuid::new_v4()));
    let result = (|| {
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options.open(&temporary).map_err(TaskFailure::internal)?;
        file.write_all(
            toml::to_string(config)
                .map_err(TaskFailure::internal)?
                .as_bytes(),
        )
        .map_err(TaskFailure::internal)?;
        file.sync_all().map_err(TaskFailure::internal)?;
        drop(file);
        std::fs::rename(&temporary, target).map_err(TaskFailure::internal)?;
        Ok(())
    })();
    let _ = std::fs::remove_file(temporary);
    result
}
fn config_lock(root: &Path) -> std::io::Result<std::fs::File> {
    let file = std::fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(root.join("config.lock"))?;
    file.lock()?;
    Ok(file)
}

pub(crate) fn parse(content: &str) -> Result<Config, TaskFailure> {
    let config: Config = toml::from_str(content)
        .map_err(|error| TaskFailure::invalid(format!("Invalid router TOML: {error}")))?;
    if config.port == 0
        || !(32..=256).contains(&config.token.len())
        || !config
            .token
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    {
        return Err(TaskFailure::invalid("Invalid router port or pairing token"));
    }
    Ok(config)
}

pub(crate) fn lock(root: &Path) -> Result<std::fs::File, TaskFailure> {
    crate::infrastructure::kernel::lock_store(root).map_err(|error| {
        if error.code == ErrorCode::Busy {
            TaskFailure::new(
                ErrorCode::Busy,
                "The router is already running; stop it before restarting or changing configuration",
            )
        } else {
            error
        }
    })
}

pub(crate) fn set_port(root: &Path, port: u16) -> Result<Config, TaskFailure> {
    std::fs::create_dir_all(root).map_err(TaskFailure::internal)?;
    let _lock = lock(root)?;
    let config = Config {
        port,
        ..load(root)?
    };
    save(root, &config)?;
    Ok(config)
}
