use std::{error::Error, io::Cursor, path::Path};

use syntect::{
    easy::HighlightLines,
    highlighting::ThemeSet,
    parsing::{SyntaxDefinition, SyntaxSetBuilder},
    util::{LinesWithEndings, as_24_bit_terminal_escaped},
};

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
    let global_config_path = store_root.join("config.toml");
    let workspace_config_path =
        input.map(|input| WorkspacePaths::new(store_root, input).config_path);
    let target = workspace_config_path.clone().unwrap_or(global_config_path);
    let adapter = TomlFileConfigAdapter::new(store_root.to_path_buf());

    match action {
        ConfigAction::Path => {
            println!("{}", target.display());
        }
        ConfigAction::Edit => {
            let editor = get_editor();
            std::process::Command::new(editor).arg(&target).status()?;
        }
        ConfigAction::Show => {
            let sources = adapter.get_config_sources(workspace_config_path.as_deref());
            let toml_str = adapter.format_config(workspace_config_path.as_deref())?;
            let output = format!(
                "# Config file: {}\n# Sources:    [{}]\n\n{toml_str}",
                target.display(),
                sources.join(", "),
            );

            let mut builder = SyntaxSetBuilder::new();
            let syntax_def = SyntaxDefinition::load_from_str(
                include_str!("../../../assets/TOML.sublime-syntax"),
                true,
                Some("toml"),
            )?;
            builder.add(syntax_def);
            let syntax_set = builder.build();
            let syntax = syntax_set
                .find_syntax_by_token("toml")
                .ok_or("Failed to find TOML syntax definition")?;

            let mut cursor = Cursor::new(include_str!("../../../assets/Oceanic Next.tmTheme"));
            let theme =
                ThemeSet::load_from_reader(&mut cursor).map_err(|_| "Failed to load theme")?;

            let mut highlighter = HighlightLines::new(syntax, &theme);
            for line in LinesWithEndings::from(&output) {
                let regions = highlighter.highlight_line(line, &syntax_set)?;
                let escaped = as_24_bit_terminal_escaped(&regions, false);
                print!("{escaped}");
            }
            print!("\x1b[0m");
        }
    }
    Ok(())
}
