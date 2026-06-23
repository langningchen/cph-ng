use std::{error::Error, path::Path};

use super::ConfigAction;
use crate::{
    adapters::{config::toml::TomlFileConfigAdapter, repo::workspace::WorkspacePaths},
    ports::config::ConfigRepository,
};

fn get_editor() -> String {
    std::env::var("EDITOR").unwrap_or_else(|_| {
        if cfg!(windows) {
            "notepad".to_string()
        } else {
            "vim".to_string()
        }
    })
}

pub(super) fn handle(
    input: Option<&Path>,
    action: &ConfigAction,
    store_root: &Path,
) -> Result<(), Box<dyn Error>> {
    let target = input.map_or_else(
        || store_root.join("config.toml"),
        |src| WorkspacePaths::new(store_root, src).config_path,
    );

    match action {
        ConfigAction::Path => {
            println!("{}", target.display());
        }
        ConfigAction::Edit => {
            let editor = get_editor();
            std::process::Command::new(editor).arg(&target).status()?;
        }
        ConfigAction::List => {
            let config_repo = TomlFileConfigAdapter::new(store_root.to_path_buf());
            let final_config = config_repo.get_config(Some(&target))?;
            println!("{}", toml::to_string_pretty(&final_config)?);
        }
    }
    Ok(())
}
