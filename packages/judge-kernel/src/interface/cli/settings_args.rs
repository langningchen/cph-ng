use clap::{Subcommand, ValueEnum};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, ValueEnum, PartialEq, Eq)]
pub enum ConfigScope {
    Global,
    Problem,
    Router,
}

#[derive(Debug, Subcommand)]
pub enum ConfigAction {
    /// Print the configuration path, even if the file is missing or invalid.
    Path,
    /// Write a default configuration if none exists; never replaces a file.
    Init,
    /// Validate and replace the entire configuration from a TOML file.
    Set {
        /// TOML file, or - to read TOML from standard input.
        #[arg(long, short = 'i', required_unless_present = "port")]
        input: Option<PathBuf>,
        /// Router listening port; requires --scope router.
        #[arg(long, conflicts_with = "input", required_unless_present = "input", value_parser=clap::value_parser!(u16).range(1..))]
        port: Option<u16>,
    },
    /// Show the merged configuration without opening an editor.
    Show,
}

#[derive(Debug, Subcommand)]
pub enum ToolchainAction {
    Detect {
        #[arg(long, value_parser=["c", "cpp", "rust", "python", "javascript", "java"])]
        language: Option<String>,
    },
    Check {
        #[arg(long, value_parser=["c", "cpp", "rust", "python", "javascript", "java"])]
        language: String,
        #[arg(long, value_enum)]
        kind: crate::ports::toolchain::ToolchainKind,
        path: PathBuf,
    },
}
