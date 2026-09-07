//! Standalone commands and the optional resident RPC transport.
mod args;
mod config;
mod diff;
mod exchange;
mod exit;
pub use exit::ExitStatus;
mod completion;
mod help;
mod operations;
mod output;
mod parse;
mod server;
mod settings_args;

use std::{path::PathBuf, time::Duration};

use args::{Commands, OutputFormat};
use clap::Parser;
use serde_json::Value;

use crate::{
    application::tasks::{TaskFailure, TaskLimits},
    infrastructure::kernel::Kernel,
};

fn default_store_path() -> PathBuf {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_or_else(
            |_| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
            PathBuf::from,
        )
        .join(".cph-ng")
}

#[derive(Debug, Parser)]
#[command(
    name = "cph-ng-judge",
    version,
    about = "CPH-NG standalone judge and JSON-RPC kernel",
    after_help = "Examples:\n  cph-ng-judge run main.cpp --input-file input.txt --answer-file answer.txt\n  cph-ng-judge judge run main.cpp --output json\n  cph-ng-judge testcase add main.cpp --input-text '1 2' --answer-text '3'\n  cph-ng-judge stress start main.cpp --generator gen.cpp --brute-force brute.cpp\n  cph-ng-judge serve --workspace-root ."
)]
pub struct Cli {
    #[command(flatten)]
    presentation: output::Preferences,
    /// Directory containing configuration, problems, and run history
    #[arg(long, help_heading = "Storage and limits", env = "CPH_STORE_ROOT", value_name = "DIR", default_value_os_t = default_store_path(), global = true)]
    pub store_root: PathBuf,
    /// CLI output format; serve always uses its JSON-RPC protocol.
    #[arg(long, visible_alias = "format", value_name = "FORMAT", help_heading = "Output", value_enum, default_value_t = OutputFormat::Human, global = true)]
    pub output: OutputFormat,
    /// Shortcut for --output json.
    #[arg(
        long,
        global = true,
        help_heading = "Output",
        conflicts_with = "output"
    )]
    pub json: bool,
    /// Suppress human progress on stderr; final results are still printed.
    #[arg(long, short = 'q', global = true, help_heading = "Output")]
    pub quiet: bool,
    /// Restrict file access to these roots and the store. Repeat for multiple roots.
    #[arg(
        long = "workspace-root",
        global = true,
        value_name = "DIR",
        help_heading = "Storage and limits"
    )]
    pub workspace_roots: Vec<PathBuf>,
    /// Maximum lifetime of an admitted task, including compilation and queueing.
    #[arg(long, help_heading = "Storage and limits", value_name = "MS", default_value_t = 300_000, value_parser=clap::value_parser!(u64).range(1..), global = true)]
    pub task_timeout_ms: u64,
    /// Maximum wait for a task owned by another process (does not cancel it).
    #[arg(long, help_heading = "Storage and limits", value_name = "MS", default_value_t = 300_000, value_parser=clap::value_parser!(u64).range(1..), global = true)]
    pub wait_timeout_ms: u64,
    #[command(subcommand)]
    command: Commands,
}

/// Execute one standalone operation, draining owned tasks before returning an exit code.
pub async fn run() -> ExitStatus {
    if let Some(status) = completion::complete().await {
        return status;
    }
    let cli = match parse::parse() {
        Ok(cli) => cli,
        Err(status) => return status,
    };
    if let Commands::Completions { shell, r#static } = cli.command {
        return completion::generate(shell, r#static);
    }
    let format = if cli.json {
        OutputFormat::Json
    } else {
        cli.output
    };
    let output =
        output::Output::new(format, cli.quiet, &cli.command).with_preferences(cli.presentation);
    let output = if cli.store_root == default_store_path() {
        output
    } else {
        output.with_store_root(&cli.store_root)
    };
    if let Commands::Router(args) = cli.command {
        // Keep the legacy discovery command's default JSON for existing editors.
        let legacy_info = matches!(args.action, crate::interface::router::RouterAction::Info);
        let result = crate::interface::router::run(cli.store_root, args, cli.quiet).await;
        let output = if legacy_info && format == OutputFormat::Human {
            output::Output::new(OutputFormat::Json, cli.quiet, &Commands::Capabilities)
        } else {
            output
        };
        return match result {
            Ok(Some(value)) => output
                .result(&value)
                .map_or(ExitStatus::ExecutionFailed, |()| ExitStatus::Success),
            Ok(None) => ExitStatus::Success,
            Err(error) => {
                let _ = output.error(&error);
                output::error_exit(&error)
            }
        };
    }
    if let Commands::Serve(args) = cli.command {
        return match server::run(
            cli.store_root,
            cli.workspace_roots,
            cli.task_timeout_ms,
            args,
        )
        .await
        {
            Ok(()) => ExitStatus::Success,
            Err(error) => {
                let error = parse::service_error(error.as_ref());
                let _ = output.service_error(&error);
                output::error_exit(&error)
            }
        };
    }
    let result = standalone(&cli, &output).await;
    match result {
        Ok((value, code)) => match output.result(&value) {
            Ok(()) => code,
            Err(error) if error.kind() == std::io::ErrorKind::BrokenPipe => code,
            Err(error) => {
                eprintln!("Cannot write result: {error}");
                ExitStatus::ExecutionFailed
            }
        },
        Err(error) => {
            let _ = output.error(&error);
            output::error_exit(&error)
        }
    }
}

async fn standalone(
    cli: &Cli,
    output: &output::Output,
) -> Result<(Value, ExitStatus), TaskFailure> {
    let root = operations::absolute(&cli.store_root)?;
    if let Commands::Toolchain { action } = &cli.command {
        return toolchain(action)
            .await
            .map(|value| (value, ExitStatus::Success));
    }
    if let Commands::Capabilities = cli.command {
        return Ok((
            crate::application::commands::capabilities(),
            ExitStatus::Success,
        ));
    }
    if let Commands::Config {
        src,
        source,
        action,
        scope,
    } = &cli.command
    {
        return config::handle(
            src.as_deref().or(source.as_deref()),
            action,
            *scope,
            &root,
            &cli.workspace_roots,
        )
        .await
        .map(|value| (value, ExitStatus::Success));
    }
    let kernel = Kernel::standalone(
        &root,
        &cli.workspace_roots,
        TaskLimits {
            timeout: Duration::from_millis(cli.task_timeout_ms),
            ..TaskLimits::default()
        },
        operations::observes(&cli.command),
    )
    .await?;
    let mut active = operations::ActiveTask::default();
    // Interrupt reads/waits cooperatively, so a signal cannot drop a metadata
    // transaction or a task admission halfway through its commit.
    let canceled = kernel.shutdown.clone();
    let signal_listener = tokio::spawn(async move {
        signal().await;
        canceled.cancel();
    });
    let result = operations::execute(
        &cli.command,
        &kernel,
        output,
        &mut active,
        Duration::from_millis(cli.wait_timeout_ms),
    )
    .await;
    let drained = kernel.tasks.shutdown(Duration::from_secs(5)).await;
    let result = if kernel.shutdown.is_canceled() {
        if let Some(id) = active.owned_id {
            async {
                let task = kernel.tasks.get(&id).await?;
                loop {
                    let events = kernel
                        .tasks
                        .events_since(output.sequence(), Some(&id), 1000)
                        .await?;
                    let more = events.len() == 1000;
                    for event in events {
                        output.event(&event)?;
                    }
                    if !more {
                        break;
                    }
                }
                serde_json::to_value(task)
                    .map(|value| (value, ExitStatus::Canceled))
                    .map_err(TaskFailure::internal)
            }
            .await
        } else {
            Err(TaskFailure::canceled())
        }
    } else {
        result
    };
    kernel.pool.close().await;
    signal_listener.abort();
    match (result, drained) {
        (Ok(result), Ok(())) => Ok(result),
        (Err(error), _) | (_, Err(error)) => Err(error),
    }
}

async fn signal() {
    #[cfg(unix)]
    if let Ok(mut terminate) =
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
    {
        tokio::select! { _ = tokio::signal::ctrl_c() => {}, _ = terminate.recv() => {} }
        return;
    }
    let _ = tokio::signal::ctrl_c().await;
}

async fn toolchain(action: &args::ToolchainAction) -> Result<Value, TaskFailure> {
    use crate::ports::toolchain::{ToolchainDiscovery, ToolchainQuery};
    use serde_json::json;
    let discovery = crate::infrastructure::toolchain::LocalToolchains;
    match action {
        args::ToolchainAction::Detect { language } => {
            let language = language
                .as_ref()
                .map(|name| serde_json::from_value(json!(name)))
                .transpose()
                .map_err(TaskFailure::internal)?;
            Ok(json!({"toolchains":discovery.detect(language).await?}))
        }
        args::ToolchainAction::Check {
            language,
            kind,
            path,
        } => {
            let query: ToolchainQuery =
                serde_json::from_value(json!({"language":language,"kind":kind,"path":path}))
                    .map_err(TaskFailure::internal)?;
            Ok(json!(discovery.check(query).await?))
        }
    }
}
