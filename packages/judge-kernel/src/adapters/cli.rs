mod config;
mod import;
use std::path::PathBuf;

use clap::{Parser, Subcommand};

use crate::{
    adapters::inquire::{AutoInquire, CliInquire},
    ports::Inquire,
};

/// Get the default store path, which is "$HOME/.cph-ng" or the current directory if HOME is not set.
fn default_store_path() -> PathBuf {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_or_else(
            |_| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
            PathBuf::from,
        )
        .join(".cph-ng")
}

#[derive(Parser)]
#[command(
    name = "cph-ng-kernel",
    version = "0.7.8",
    about = "CPH-NG high performance judge kernel"
)]
pub struct Cli {
    #[arg(long, env = "CPH_STORE_ROOT", value_name = "DIR",
        default_value_os_t = default_store_path())]
    pub store_root: PathBuf,

    #[arg(long, value_name = "BOOL", default_value_t = false)]
    pub ci: bool,

    #[arg(long, value_name = "BOOL", default_value_t = false)]
    pub yes: bool,

    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Import a problem
    Import {
        #[arg(short, long)]
        input: PathBuf,
    },
    /// Manage configuration
    Config {
        src: Option<PathBuf>,
        #[command(subcommand)]
        action: ConfigAction,
    },
}

#[derive(Subcommand)]
pub enum ConfigAction {
    /// Print the config file path
    Path,
    /// Open the config file in your editor
    Edit,
    /// Show the current merged configuration
    List,
}

/// Parse CLI args and execute the matching command.
pub async fn run() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    let store_root = cli.store_root;
    let inquire: Box<dyn Inquire> = if cli.ci {
        Box::new(AutoInquire::new(false))
    } else if cli.yes {
        Box::new(AutoInquire::new(true))
    } else {
        Box::new(CliInquire)
    };

    match cli.command {
        Commands::Import { input } => {
            import::handle(input, &store_root, &*inquire).await?;
        }
        Commands::Config { src, action } => {
            config::handle(src.as_deref(), &action, &store_root)?;
        }
    }
    Ok(())
}
