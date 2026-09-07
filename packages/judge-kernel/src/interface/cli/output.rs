use super::args::{Commands, OutputFormat};
use crate::application::tasks::{TaskEvent, TaskFailure};
use serde_json::{Value, json};
use std::{
    cell::{Cell, RefCell},
    io::{self, IsTerminal, Write},
};
mod plain;
mod preferences;
mod terminal;
pub(super) use super::exit::{error_exit, task_exit};
pub(crate) use preferences::{Color, Preferences};
pub(super) use terminal::layout::terminal_width;

#[derive(Debug)]
pub(super) struct Output {
    pub format: OutputFormat,
    pub quiet: bool,
    preferences: Preferences,
    sequence: Cell<u64>,
    label: &'static str,
    command_prefix: String,
    cancel_request: bool,
    live: RefCell<terminal::Live>,
}
impl Output {
    pub fn new(format: OutputFormat, quiet: bool, command: &Commands) -> Self {
        Self {
            format,
            quiet,
            preferences: Preferences::default(),
            sequence: Cell::new(0),
            label: terminal::label(command),
            command_prefix: "cph-ng-judge".into(),
            cancel_request: matches!(
                command,
                Commands::Task {
                    action: super::args::TaskAction::Cancel(_)
                } | Commands::Judge {
                    action: super::args::JudgeAction::Cancel(_)
                } | Commands::Stress {
                    action: super::args::StressAction::Stop(_)
                }
            ),
            live: RefCell::new(terminal::Live::default()),
        }
    }
    pub fn with_preferences(mut self, preferences: Preferences) -> Self {
        self.preferences = preferences;
        self.live.get_mut().color = preferences.color_choice(io::stderr().is_terminal());
        self
    }
    pub fn with_store_root(mut self, root: &std::path::Path) -> Self {
        let root = std::path::absolute(root).unwrap_or_else(|_| root.to_path_buf());
        let path = root.to_string_lossy();
        let path = if cfg!(windows) {
            path.replace('\'', "''")
        } else {
            path.replace('\'', "'\\''")
        };
        self.command_prefix = format!("cph-ng-judge --store-root '{path}'");
        self
    }
    pub fn sequence(&self) -> u64 {
        self.sequence.get()
    }
    pub fn result(&self, value: &Value) -> io::Result<()> {
        self.clear_progress()?;
        match self.format {
            OutputFormat::Json => write_stdout(&pretty(value)?),
            OutputFormat::Jsonl => {
                write_stdout(&json!({"type":"result", "result":value}).to_string())
            }
            OutputFormat::Human => {
                let mut value = value.clone();
                let target = if value.get("task").is_some() {
                    value.get_mut("task")
                } else {
                    Some(&mut value)
                };
                if let Some(target) = target.and_then(Value::as_object_mut).filter(|object| {
                    object.contains_key("task_id")
                        || (self.label == "Source linked" && object.contains_key("code_id"))
                }) {
                    target.insert("cli_command_prefix".into(), json!(self.command_prefix));
                    if self.cancel_request {
                        target.insert("cli_cancel_requested".into(), json!(true));
                    }
                }
                let (rendered, color) = if io::stdout().is_terminal()
                    && !self.preferences.plain
                    && std::env::var_os("TERM").is_none_or(|term| term != "dumb")
                {
                    (
                        terminal::render_width(&value, self.label, terminal_width()),
                        self.preferences.color_choice(true),
                    )
                } else {
                    (
                        plain::human(&value, self.label),
                        anstream::ColorChoice::Never,
                    )
                };
                let mut out = anstream::AutoStream::new(io::stdout().lock(), color);
                writeln!(out, "{rendered}")?;
                out.flush()
            }
        }
    }
    pub fn event(&self, event: &TaskEvent) -> Result<(), TaskFailure> {
        if self.format == OutputFormat::Jsonl {
            write_stdout(&json!({"type":"event", "event":event}).to_string())
                .map_err(TaskFailure::internal)?;
        } else if self.format == OutputFormat::Human && !self.quiet && self.preferences.progress() {
            self.live
                .borrow_mut()
                .event(event)
                .map_err(TaskFailure::internal)?;
        }
        self.sequence.set(event.sequence);
        Ok(())
    }
    pub fn refresh(&self) -> Result<(), TaskFailure> {
        self.live
            .borrow_mut()
            .refresh()
            .map_err(TaskFailure::internal)
    }
    fn clear_progress(&self) -> io::Result<()> {
        self.live.borrow_mut().clear()
    }
    pub fn service_error(&self, error: &TaskFailure) -> io::Result<()> {
        // A running stdio server owns stdout for JSON-RPC frames, even when a
        // caller passed CLI output flags. Diagnostics always use stderr here.
        let text = match self.format {
            OutputFormat::Json => pretty(&json!({"error":error}))?,
            OutputFormat::Jsonl => json!({"type":"error","error":error}).to_string(),
            OutputFormat::Human => return self.error(error),
        };
        writeln!(io::stderr().lock(), "{text}")
    }
    pub fn error(&self, error: &TaskFailure) -> io::Result<()> {
        self.clear_progress()?;
        match self.format {
            OutputFormat::Json => write_stdout(&pretty(&json!({"error":error}))?),
            OutputFormat::Jsonl => {
                write_stdout(&json!({"type":"error", "error":error}).to_string())
            }
            OutputFormat::Human => writeln!(
                anstream::AutoStream::new(
                    io::stderr().lock(),
                    self.preferences.color_choice(io::stderr().is_terminal())
                ),
                "{}",
                terminal::layout::scoped(
                    (io::stderr().is_terminal() && !self.preferences.plain).then(terminal_width),
                    || {
                        let message = terminal::error(error);
                        if io::stderr().is_terminal() && !self.preferences.plain {
                            terminal::layout::wrap(&message, terminal_width())
                        } else {
                            message
                        }
                    }
                )
            ),
        }
    }
    pub fn help(&self, error: &clap::Error) -> io::Result<()> {
        let message = error.render().ansi().to_string();
        let message = if io::stdout().is_terminal() {
            terminal::layout::wrap(&message, terminal_width())
        } else {
            message
        };
        write!(
            anstream::AutoStream::new(
                io::stdout().lock(),
                self.preferences.color_choice(io::stdout().is_terminal())
            ),
            "{message}"
        )
    }
    pub fn usage(&self, error: &clap::Error) -> io::Result<()> {
        let message = terminal::clean(&error.to_string());
        let message = message.strip_prefix("error: ").map_or_else(
            || message.clone(),
            |body| {
                format!(
                    "{} {body}",
                    terminal::paint("error:", terminal::Tone::Failure)
                )
            },
        );
        let message = if io::stderr().is_terminal() && !self.preferences.plain {
            terminal::layout::wrap(&message, terminal_width())
        } else {
            message
        };
        write!(
            anstream::AutoStream::new(
                io::stderr().lock(),
                self.preferences.color_choice(io::stderr().is_terminal())
            ),
            "{message}"
        )
    }
}
fn pretty(value: &Value) -> io::Result<String> {
    serde_json::to_string_pretty(value).map_err(io::Error::other)
}
fn write_stdout(value: &str) -> io::Result<()> {
    let mut out = io::stdout().lock();
    writeln!(out, "{value}")?;
    out.flush()
}
