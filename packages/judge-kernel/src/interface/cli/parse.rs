//! Validate CLI-only combinations before opening the store, with structured usage errors.
use super::{
    Cli, ExitStatus,
    args::{Commands, ConfigAction, ConfigScope, OutputFormat},
    output::{Color, Output, Preferences},
};
use crate::application::{error::ErrorCode, tasks::TaskFailure};
use clap::{CommandFactory, FromArgMatches};
use std::ffi::OsString;

pub(super) fn parse() -> Result<Cli, ExitStatus> {
    let args: Vec<_> = std::env::args_os().collect();
    let (format, preferences) = options(&args);
    let cli = super::help::command(preferences)
        .try_get_matches_from(&args)
        .and_then(|matches| Cli::from_arg_matches(&matches))
        .map_err(|error| {
            if !error.use_stderr() {
                let _ = Output::new(OutputFormat::Human, false, &Commands::Capabilities)
                    .with_preferences(preferences)
                    .help(&error);
                return ExitStatus::Success;
            }
            let output =
                Output::new(format, false, &Commands::Capabilities).with_preferences(preferences);
            if format == OutputFormat::Human {
                let _ = output.usage(&error);
            } else {
                let _ = output.error(&TaskFailure::invalid(error.to_string()));
            }
            ExitStatus::InvalidUsage
        })?;
    validate(&cli).map_err(|error| {
        let output = Output::new(
            if cli.json {
                OutputFormat::Json
            } else {
                cli.output
            },
            cli.quiet,
            &cli.command,
        )
        .with_preferences(cli.presentation);
        let _ = output.error(&error);
        super::output::error_exit(&error)
    })?;
    Ok(cli)
}

fn validate(cli: &Cli) -> Result<(), TaskFailure> {
    if let Commands::Config {
        src,
        source,
        scope,
        action,
    } = &cli.command
    {
        let has_source = src.is_some() || source.is_some();
        if has_source && matches!(scope, Some(ConfigScope::Global | ConfigScope::Router)) {
            return Err(TaskFailure::invalid(
                "A source file requires --scope problem",
            ));
        }
        if !has_source && *scope == Some(ConfigScope::Problem) {
            return Err(TaskFailure::invalid(
                "--scope problem requires a source file",
            ));
        }
        if matches!(action, ConfigAction::Set { port: Some(_), .. })
            && *scope != Some(ConfigScope::Router)
        {
            return Err(TaskFailure::invalid(
                "--port requires config --scope router",
            ));
        }
    }
    if let Commands::Serve(args) = &cli.command {
        args.validate()?;
    }
    Ok(())
}

// Skip option values using the command metadata, so literal testcase text such as
// `--answer-text --json` cannot select the diagnostic format.
fn options(args: &[OsString]) -> (OutputFormat, Preferences) {
    let mut command = Cli::command();
    command.build();
    let mut result = OutputFormat::Human;
    let mut preferences = Preferences::default();
    let mut tokens = args.iter().skip(1);
    while let Some(token) = tokens.next() {
        let token = token.to_string_lossy();
        if token == "--" {
            break;
        }
        if let Some(next) = command.find_subcommand(token.as_ref()) {
            command = next.clone();
            continue;
        }
        let (name, attached) = token
            .split_once('=')
            .map_or((token.as_ref(), None), |(k, v)| (k, Some(v)));
        let arg = command.get_arguments().find(|arg| {
            name.strip_prefix("--").is_some_and(|long| {
                arg.get_long() == Some(long)
                    || arg.get_all_aliases().is_some_and(|v| v.contains(&long))
            }) || name.strip_prefix('-').is_some_and(|short| {
                short.len() == 1 && arg.get_short().is_some_and(|c| short.starts_with(c))
            })
        });
        let takes_value = arg.is_some_and(|arg| arg.get_action().takes_values());
        let value = if takes_value && attached.is_none() {
            tokens.next().map(|v| v.to_string_lossy())
        } else {
            attached.map(Into::into)
        };
        match name {
            "--no-color" => preferences.no_color = true,
            "--plain" => preferences.plain = true,
            "--color" => {
                preferences.color = match value.as_deref() {
                    Some("always") => Color::Always,
                    Some("never") => Color::Never,
                    _ => Color::Auto,
                }
            }
            "--json" => result = OutputFormat::Json,
            "--output" | "--format" => match value.as_deref() {
                Some("json") => result = OutputFormat::Json,
                Some("jsonl") => result = OutputFormat::Jsonl,
                Some("human") => result = OutputFormat::Human,
                _ => {}
            },
            _ => {}
        }
    }
    (result, preferences)
}

pub(super) fn service_error(error: &(dyn std::error::Error + 'static)) -> TaskFailure {
    if let Some(error) = error.downcast_ref::<TaskFailure>() {
        return error.clone();
    }
    if let Some(error) = error.downcast_ref::<std::io::Error>() {
        let code = match error.kind() {
            std::io::ErrorKind::AddrInUse | std::io::ErrorKind::AlreadyExists => {
                ErrorCode::Conflict
            }
            std::io::ErrorKind::NotFound => ErrorCode::NotFound,
            std::io::ErrorKind::InvalidInput => ErrorCode::InvalidParams,
            _ => ErrorCode::ExecutionFailed,
        };
        return TaskFailure::new(code, error.to_string());
    }
    TaskFailure::new(ErrorCode::ExecutionFailed, error.to_string())
}
