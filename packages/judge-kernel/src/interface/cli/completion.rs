//! Shell adapters share clap's parser and command tree; only ID values read the store.
mod context;
mod ids;
use super::{Cli, ExitStatus};
use clap::{Command, CommandFactory};
use clap_complete::{Shell, engine::ArgValueCompleter, env::Shells};
use std::{
    ffi::{OsStr, OsString},
    io::Write,
    sync::{Arc, atomic::Ordering},
    time::Duration,
};

const VARIABLE: &str = "CPH_COMPLETE";
const NAME: &str = "cph-ng-judge";

pub(super) fn generate(shell: Shell, static_only: bool) -> ExitStatus {
    if static_only {
        clap_complete::generate(shell, &mut Cli::command(), NAME, &mut std::io::stdout());
        return ExitStatus::Success;
    }
    let shells = Shells::builtins();
    let Some(adapter) = shells.completer(&shell.to_string()) else {
        return ExitStatus::InvalidUsage;
    };
    // Keep registration portable when invoked through PATH, but respect an explicit
    // executable path (including spaces) during development and packaged installations.
    let executable = std::env::args_os().next().unwrap_or_else(|| NAME.into());
    let executable = std::path::Path::new(&executable);
    let executable = if executable.components().count() > 1 {
        std::path::absolute(executable).unwrap_or_else(|_| executable.to_path_buf())
    } else {
        executable.to_path_buf()
    };
    match adapter.write_registration(
        VARIABLE,
        NAME,
        NAME,
        &executable.to_string_lossy(),
        &mut std::io::stdout(),
    ) {
        Ok(()) => ExitStatus::Success,
        Err(error) => {
            eprintln!("Cannot write shell completions: {error}");
            ExitStatus::ExecutionFailed
        }
    }
}

pub(super) async fn complete() -> Option<ExitStatus> {
    let shell = std::env::var(VARIABLE).ok()?;
    if shell.is_empty() || shell == "0" {
        return None;
    }
    let shells = Shells::builtins();
    let Some(adapter) = shells.completer(&shell) else {
        return Some(ExitStatus::InvalidUsage);
    };
    let args: Vec<OsString> = std::env::args_os()
        .skip_while(|v| v != "--")
        .skip(1)
        .collect();
    if args.is_empty() {
        return Some(ExitStatus::Success);
    }
    let empty = Arc::new(ids::Candidates::default());
    let cwd = std::env::current_dir().ok();
    let mut probe = attach(Cli::command(), &empty);
    let mut buffer = Vec::new();
    if adapter
        .write_complete(&mut probe, args.clone(), cwd.as_deref(), &mut buffer)
        .is_err()
    {
        return Some(ExitStatus::ExecutionFailed);
    }
    if !empty.requested.load(Ordering::Relaxed) {
        return Some(if std::io::stdout().write_all(&buffer).is_ok() {
            ExitStatus::Success
        } else {
            ExitStatus::ExecutionFailed
        });
    }
    let context = context::Context::parse(&args, &shell);
    let ids = tokio::time::timeout(Duration::from_millis(200), ids::load(&context))
        .await
        .ok()
        .and_then(Result::ok)
        .unwrap_or_default();
    let mut command = attach(Cli::command(), &Arc::new(ids));
    let result = adapter.write_complete(&mut command, args, cwd.as_deref(), &mut std::io::stdout());
    // Completion failure is deliberately silent: missing/busy/old stores must not
    // interrupt shell editing, and normal commands/flags/paths still complete.
    Some(if result.is_ok() {
        ExitStatus::Success
    } else {
        ExitStatus::ExecutionFailed
    })
}

fn attach(command: Command, ids: &Arc<ids::Candidates>) -> Command {
    command
        .mut_args(|arg| {
            let name = arg.get_id().as_str().to_owned();
            if matches!(
                name.as_str(),
                "testcase_id" | "testcase_ids" | "problem_id" | "code_id" | "task_id" | "run_id"
            ) {
                let ids = Arc::clone(ids);
                arg.add(ArgValueCompleter::new(move |current: &OsStr| {
                    ids.complete(&name, current)
                }))
            } else {
                arg
            }
        })
        .mut_subcommands(|child| attach(child, ids))
}
