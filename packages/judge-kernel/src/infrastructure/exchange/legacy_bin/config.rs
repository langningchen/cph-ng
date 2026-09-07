use super::model::Overrides;
use std::path::Path;
use toml_edit::{Array, DocumentMut, Item, Table, value};

pub(super) fn language_env(source: &Path, overrides: Overrides) -> DocumentMut {
    let mut language_env = DocumentMut::new();
    if let Some(language) = crate::domain::LanguageId::from_path(source) {
        let mut settings = Table::new();
        let defaults = match language {
            crate::domain::LanguageId::Cpp => "g++",
            crate::domain::LanguageId::C => "gcc",
            crate::domain::LanguageId::Rust => "rustc",
            crate::domain::LanguageId::Java => "javac",
            crate::domain::LanguageId::Python => {
                if cfg!(windows) {
                    "python"
                } else {
                    "python3"
                }
            }
            crate::domain::LanguageId::Javascript => "node",
        };
        if overrides.compiler.is_some() || overrides.compiler_args.is_some() {
            settings.insert(
                "compiler",
                value(overrides.compiler.unwrap_or_else(|| defaults.into())),
            );
            let mut args = Array::new();
            for arg in overrides
                .compiler_args
                .unwrap_or_default()
                .split_whitespace()
            {
                args.push(arg);
            }
            settings.insert("compiler_args", value(args));
        }
        if overrides.interpreter.is_some() || overrides.interpreter_args.is_some() {
            let default = match language {
                crate::domain::LanguageId::Java => "java",
                crate::domain::LanguageId::Javascript => "node",
                _ => {
                    if cfg!(windows) {
                        "python"
                    } else {
                        "python3"
                    }
                }
            };
            settings.insert(
                "interpreter",
                value(overrides.interpreter.unwrap_or_else(|| default.into())),
            );
            let mut args = Array::new();
            for arg in overrides
                .interpreter_args
                .unwrap_or_default()
                .split_whitespace()
            {
                args.push(arg);
            }
            settings.insert("interpreter_args", value(args));
        }
        if !settings.is_empty() {
            let mut languages = Table::new();
            languages.insert(&language.to_string(), Item::Table(settings));
            language_env.insert("languages", Item::Table(languages));
        }
    }

    language_env
}
