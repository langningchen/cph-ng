use super::super::args::{Commands, ConfigAction, ProblemAction, TestcaseAction};
use crate::application::{error::ErrorCode, tasks::TaskFailure};
use serde_json::Value;
mod comparison;
mod index;
mod judging;
pub(super) mod layout;
mod lists;
mod live;
mod names;
pub(super) use live::Live;
mod records;
mod sources;
mod table;

#[derive(Clone, Copy)]
pub(super) enum Tone {
    Heading,
    Hint,
    Link,
    Success,
    Failure,
    Pending,
    Info,
    Muted,
    Metric,
    Runtime,
    Presentation,
    Memory,
    OutputLimit,
    Compile,
    Partial,
}
pub(super) fn paint(text: &str, tone: Tone) -> String {
    let code = match tone {
        Tone::Heading => "1;4",
        Tone::Hint => "2;3",
        Tone::Link => {
            if std::env::var("TERM").is_ok_and(|term| term.contains("256color")) {
                "4;38;5;81"
            } else {
                "4;36"
            }
        }
        Tone::Success => "1;32",
        Tone::Failure => "1;31",
        Tone::Pending => "1;33",
        Tone::Info => "1",
        Tone::Presentation => "1;36",
        Tone::Muted => "2",
        Tone::Metric => "34",
        Tone::Runtime => "1;35",
        Tone::Memory => "1;34",
        Tone::OutputLimit => "1;93",
        Tone::Compile => "1;91",
        Tone::Partial => "1;94",
    };
    format!("\x1b[{code}m{}\x1b[0m", clean(text))
}
fn text<'a>(value: &'a Value, key: &str) -> &'a str {
    value.get(key).and_then(Value::as_str).unwrap_or("")
}
pub(super) fn clean(value: &str) -> String {
    let mut cleaned = String::with_capacity(value.len());
    for character in value.chars() {
        if (character.is_control() && !matches!(character, '\n' | '\t'))
            || matches!(character, '\u{202a}'..='\u{202e}' | '\u{2066}'..='\u{2069}')
        {
            cleaned.extend(character.escape_default());
        } else {
            cleaned.push(character);
        }
    }
    cleaned
}
fn detail(label: &str, value: &str) -> String {
    if value.is_empty() {
        return String::new();
    }
    let value = clean(value).replace('\t', "    ");
    let limit = layout::width().map_or(usize::MAX, |width| width.saturating_sub(6));
    let excerpt = value
        .lines()
        .take(if layout::width().is_some() {
            24
        } else {
            usize::MAX
        })
        .map(|line| layout::truncate(line, limit))
        .collect::<Vec<_>>()
        .join("\n      ");
    let more = layout::width().is_some()
        && (value.lines().count() > 24 || value.lines().any(|line| layout::measure(line) > limit));
    let label = paint(&format!("{label}:"), Tone::Muted);
    let body = if value.lines().count() <= 1 && !more {
        format!("    {label} {excerpt}")
    } else {
        format!("    {label}\n      {excerpt}")
    };
    if more {
        format!(
            "{body}\n      {}",
            paint("Full output: --json or --plain", Tone::Hint)
        )
    } else {
        body
    }
}

pub(super) fn label(command: &Commands) -> &'static str {
    match command {
        Commands::Problem {
            action: ProblemAction::Create { .. },
        } => "Problem created",
        Commands::Problem {
            action: ProblemAction::Update { .. },
        } => "Problem updated",
        Commands::Problem {
            action: ProblemAction::Move { .. },
        } => "Problem moved",
        Commands::Problem {
            action: ProblemAction::Delete(_),
        } => "Problem deleted",
        Commands::Problem {
            action: ProblemAction::Import(_),
        }
        | Commands::Import(_) => "Problem imported",
        Commands::Problem {
            action: ProblemAction::Load(_),
        } => "Problem",
        Commands::Problem {
            action: ProblemAction::Export(_),
        }
        | Commands::Export(_) => "Problem exported",
        Commands::Problem {
            action: ProblemAction::Link { .. },
        } => "Source linked",
        Commands::Problem {
            action: ProblemAction::Sources(_),
        } => "Sources",
        Commands::Problem { .. } => "Problems",
        Commands::Testcase {
            action: TestcaseAction::Add(_),
        } => "Testcase added",
        Commands::Testcase {
            action: TestcaseAction::Update(_),
        } => "Testcase updated",
        Commands::Testcase {
            action: TestcaseAction::Delete { .. },
        } => "Testcase deleted",
        Commands::Testcase { .. } => "Testcases",
        Commands::Config {
            action: ConfigAction::Init,
            ..
        } => "Configuration initialized",
        Commands::Config {
            action: ConfigAction::Set { .. },
            ..
        } => "Configuration saved",
        Commands::Config { .. } => "Configuration",
        Commands::Diff(_) => "Comparison",
        Commands::History { .. } => "Run history",
        Commands::Task { .. } => "Tasks",
        Commands::Index { .. } => "Source index",
        Commands::Completions { .. } => "Shell completions",
        Commands::Capabilities => "Available features",
        Commands::Toolchain { .. } => "Toolchains",
        Commands::Router(_) => "Companion gateway",
        Commands::Run(_)
        | Commands::Judge { .. }
        | Commands::Stress { .. }
        | Commands::Serve(_) => "Result",
    }
}
pub(super) fn render_width(value: &Value, label: &str, width: usize) -> String {
    layout::scoped(Some(width), || layout::wrap(&render(value, label), width))
}
pub(super) fn render(value: &Value, label: &str) -> String {
    if index::status(value).is_some() {
        return index::render(value, "cph-ng-judge");
    }
    if label == "Source linked" && value.get("code_id").is_some() {
        return records::source_link(value);
    }
    if value.get("comparison_diff").is_some() {
        return comparison::render(value);
    }
    if let Some(task) = value.get("task") {
        return judging::task(task);
    }
    if let Some(items) = value.get("toolchains").and_then(Value::as_array) {
        return records::list(items, label);
    }
    if value.get("written").is_some() && value.get("destination").is_some() {
        return records::export(value);
    }
    if let Some(values) = value.as_array() {
        return records::list(values, label);
    }
    if value.get("task_id").is_some() && value.get("state").is_some() {
        return judging::task(value);
    }
    if value.get("verdict").is_some() {
        return judging::result(value);
    }
    if value.get("source_path").is_some() && value.get("name").is_some() {
        return records::problem(value, label);
    }
    if let Some(toml) = value.get("toml").and_then(Value::as_str) {
        return format!(
            "{}\n  {}\n\n{}",
            paint(label, Tone::Info),
            clean(text(value, "path")),
            clean(toml)
        );
    }
    if value.get("language").is_some() && value.get("version").is_some() {
        return records::list(std::slice::from_ref(value), label);
    }
    if value.get("path").is_some() {
        let title = if value.get("created").and_then(Value::as_bool) == Some(false) {
            "Configuration already exists"
        } else {
            label
        };
        return format!(
            "{}\n  {}",
            paint(title, Tone::Success),
            clean(text(value, "path"))
        );
    }
    if value.get("deleted").and_then(Value::as_bool) == Some(true) {
        return paint(label, Tone::Success);
    }
    if value.get("stdin").is_some() && value.get("answer").is_some() {
        return records::testcase(value, label);
    }
    format!(
        "{}\n{}",
        paint(label, Tone::Info),
        records::fields(value, 1)
    )
}
pub(super) fn error(error: &TaskFailure) -> String {
    let mut lines = vec![paint(
        &format!("Error: {}", clean(&error.message)),
        Tone::Failure,
    )];
    if let Some(data) = &error.data {
        for (key, label) in [("stdout", "Compiler output"), ("stderr", "Diagnostics")] {
            let value = text(data, key);
            if !value.is_empty() {
                lines.push(detail(label, value));
            }
        }
        if data.get("stdout").is_none() && data.get("stderr").is_none() {
            lines.push(records::fields(data, 1));
        }
    }
    let hint = match error.code {
        ErrorCode::NotIndexed => Some(
            "New problem: cph-ng-judge problem create SOURCE\n  Existing problem, another solution: see `cph-ng-judge problem link --help`.\n  Moved source: see `cph-ng-judge problem move --help` for --rebind-only.",
        ),
        ErrorCode::UnsupportedLanguage => {
            Some("Use `cph-ng-judge capabilities` to see supported languages.")
        }
        ErrorCode::CompilationFailed => {
            Some("Check the compiler diagnostics above and your language configuration.")
        }
        ErrorCode::Busy => Some("Use `cph-ng-judge task list` to inspect active tasks."),
        ErrorCode::InvalidParams => Some("Use the command's --help to check its arguments."),
        _ => None,
    };
    if let Some(hint) = hint {
        lines.push(format!("  {}", paint(hint, Tone::Muted)));
    }
    lines.join("\n")
}
