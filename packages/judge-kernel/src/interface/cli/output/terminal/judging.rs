use super::table::Cell;
use super::{Tone, clean, detail, paint, table, text};
use serde_json::Value;

pub(super) fn verdict(value: &str) -> (&str, Tone) {
    match value {
        "accepted" => ("Accepted", Tone::Success),
        "wrong_answer" => ("Wrong answer", Tone::Failure),
        "time_limit_exceeded" => ("Time limit exceeded", Tone::Pending),
        "memory_limit_exceeded" => ("Memory limit exceeded", Tone::Memory),
        "output_limit_exceeded" => ("Output limit exceeded", Tone::OutputLimit),
        "runtime_error" => ("Runtime error", Tone::Runtime),
        "compilation_error" => ("Compilation failed", Tone::Compile),
        "presentation_error" => ("Presentation error", Tone::Presentation),
        "partially_correct" => ("Partially correct", Tone::Partial),
        "rejected" => ("Rejected", Tone::Failure),
        "skipped" => ("Skipped", Tone::Pending),
        "queued" => ("Queued", Tone::Muted),
        "running" => ("Running", Tone::Info),
        "compiling" => ("Compiling", Tone::Info),
        "canceled" => ("Canceled", Tone::Pending),
        _ => ("Unknown verdict", Tone::Info),
    }
}
fn short_verdict(value: &str) -> &str {
    match value {
        "accepted" => "AC",
        "wrong_answer" => "WA",
        "time_limit_exceeded" => "TLE",
        "memory_limit_exceeded" => "MLE",
        "output_limit_exceeded" => "OLE",
        "runtime_error" => "RE",
        "compilation_error" => "CE",
        "presentation_error" => "PE",
        "partially_correct" => "PC",
        _ => verdict(value).0,
    }
}
pub(super) fn case_row(value: &Value, index: usize, show_output: bool) -> Vec<Cell> {
    let raw = text(value, "verdict");
    vec![
        table::cell(&format!("Case {index}"), Tone::Muted),
        table::cell(short_verdict(raw), verdict(raw).1),
        table::number(&metric(value, "time_ms", "ms")),
        table::number(&metric(value, "memory_mb", "MiB")),
        Cell::new(note(value, show_output)),
    ]
}
pub(super) fn note(value: &Value, show_output: bool) -> String {
    let message = ["comparison", "message", "stderr"]
        .into_iter()
        .map(|key| text(value, key))
        .find(|message| !message.is_empty());
    let message = message.map_or_else(
        || match text(value, "verdict") {
            "time_limit_exceeded" => "Exceeded time limit".into(),
            "memory_limit_exceeded" => "Exceeded memory limit".into(),
            "output_limit_exceeded" => "Exceeded output limit".into(),
            "runtime_error" => value
                .get("exit_code")
                .filter(|code| !code.is_null())
                .map_or_else(
                    || "Terminated by signal".into(),
                    |code| format!("Exit code {code}"),
                ),
            _ if show_output && !text(value, "stdout").is_empty() => {
                format!("Output: {}", text(value, "stdout").trim_end())
            }
            _ => String::new(),
        },
        str::to_owned,
    );
    super::comparison::excerpt(&message, 72)
}
fn metric(value: &Value, key: &str, unit: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_u64)
        .filter(|number| key != "memory_mb" || *number > 0)
        .map_or_else(
            || {
                if key == "memory_mb" {
                    "N/A".into()
                } else {
                    "-".into()
                }
            },
            |number| format!("{number} {unit}"),
        )
}
pub(super) fn case_columns(width: usize) -> usize {
    if width < 38 {
        2
    } else if width < 64 {
        4
    } else {
        5
    }
}
pub(super) fn cases_table(cases: &[Value]) -> String {
    let width = super::layout::width().unwrap_or(usize::MAX);
    let columns = case_columns(width);
    let headers: Vec<_> = ["Testcase", "Verdict", "Time", "Memory", "Details"]
        .into_iter()
        .take(columns)
        .collect();
    let rows = cases
        .iter()
        .enumerate()
        .map(|(index, case)| {
            let mut row = case_row(case, index + 1, cases.len() == 1);
            row.truncate(columns);
            row
        })
        .collect();
    let mut lines = vec![table::render(&headers, rows)];
    if columns < 5 {
        for (index, case) in cases.iter().enumerate() {
            let note = note(case, cases.len() == 1);
            if !note.is_empty() {
                lines.push(super::layout::indent(
                    &format!("Case {}: {note}", index + 1),
                    2,
                ));
            }
        }
    }
    lines.join("\n")
}
pub(super) fn result(value: &Value) -> String {
    let mut lines = Vec::new();
    let raw = text(value, "verdict");
    let (label, tone) = verdict(raw);
    if !raw.is_empty() {
        lines.push(paint(label, tone));
    }
    if let Some(cases) = value.get("testcases").and_then(Value::as_array) {
        let accepted = cases
            .iter()
            .filter(|case| text(case, "verdict") == "accepted")
            .count();
        let summary = format!("{accepted}/{} testcases passed", cases.len());
        if let Some(heading) = lines.last_mut() {
            heading.push_str("  ");
            heading.push_str(&summary);
        } else {
            lines.push(summary);
        }
        if !cases.is_empty() {
            lines.push(cases_table(cases));
        }
    } else {
        append_details(&mut lines, value, true);
    }
    if let Some(found) = value.get("found_difference").and_then(Value::as_bool) {
        append_stress(&mut lines, value, found);
    }
    lines.join("\n")
}
fn append_stress(lines: &mut Vec<String>, value: &Value, found: bool) {
    lines.push(paint(
        if found {
            "Counterexample found and saved"
        } else {
            "No differences found"
        },
        if found { Tone::Pending } else { Tone::Success },
    ));
    for (key, label) in [("iterations", "Iterations"), ("seed", "Failing seed")] {
        if let Some(value) = value.get(key) {
            lines.push(format!("  {label}: {value}"));
        }
    }
    if found {
        lines.push(format!(
            "  Saved testcase: {}",
            clean(text(value, "testcase_id"))
        ));
        for (key, label) in [("input", "Input"), ("answer", "Answer")] {
            let content = text(value, key);
            lines.push(detail(
                label,
                if content.is_empty() {
                    "(empty)"
                } else {
                    content
                },
            ));
        }
        if let Some(outcome) = value.get("result") {
            lines.push(cases_table(std::slice::from_ref(outcome)));
        }
    }
}
fn append_details(lines: &mut Vec<String>, value: &Value, show_output: bool) {
    for (key, label) in [
        ("message", "Details"),
        ("stdout", "Output"),
        ("stderr", "Diagnostics"),
    ] {
        let data = text(value, key);
        if !data.is_empty() && (key != "stdout" || show_output) {
            lines.push(detail(label, data));
        }
    }
}
pub(super) fn task(value: &Value) -> String {
    let mut lines = Vec::new();
    let command = match text(value, "cli_command_prefix") {
        "" => "cph-ng-judge",
        command => command,
    };
    if value.get("cli_cancel_requested").and_then(Value::as_bool) == Some(true)
        && matches!(text(value, "state"), "queued" | "running")
    {
        return cancellation_requested(value);
    }
    if let Some(error) = value.get("error").filter(|error| !error.is_null()) {
        match serde_json::from_value(error.clone()) {
            Ok(error) => lines.push(task_error(
                &error,
                text(value, "task_id"),
                text(value, "state"),
                command,
            )),
            Err(_) => lines.push(paint(&clean(text(error, "message")), Tone::Failure)),
        }
    } else if let Some(outcome) = value.get("result").filter(|result| !result.is_null()) {
        if outcome.get("verdict").is_some() || outcome.get("found_difference").is_some() {
            lines.push(result(outcome));
        } else if super::index::status(outcome).is_some() {
            lines.push(super::index::render(outcome, command));
        } else {
            lines.push(super::render(outcome, "Task completed"));
        }
    } else {
        let state = match text(value, "state") {
            "queued" => "Queued",
            "running" => "Running",
            "canceled" => "Canceled",
            "failed" => "Failed",
            _ => "Completed",
        };
        let tone = match text(value, "state") {
            "succeeded" => Tone::Success,
            "failed" => Tone::Failure,
            "running" => Tone::Info,
            _ => Tone::Pending,
        };
        lines.push(paint(state, tone));
    }
    if let Some(outcome) = value.get("result") {
        let cases = outcome.get("testcases").and_then(Value::as_array);
        let details = cases.map_or_else(
            || outcome.get("found_difference").and_then(Value::as_bool) == Some(true),
            |cases| {
                cases.iter().any(|case| {
                    text(case, "verdict") != "accepted" || text(case, "stdout").chars().count() > 64
                })
            },
        );
        if details {
            lines.push(paint(
                &format!("Compare: {command} diff {}", text(value, "task_id")),
                Tone::Muted,
            ));
        }
        if outcome
            .get("jobs")
            .and_then(Value::as_u64)
            .is_some_and(|jobs| jobs > 1)
        {
            lines.push(paint(
                &format!(
                    "Jobs: {} (shared CPU; use --jobs 1 for timing checks)",
                    outcome.get("jobs").unwrap_or(&Value::Null)
                ),
                Tone::Muted,
            ));
        }
    }
    lines.push(paint(
        &format!(
            "Task: {}{}",
            clean(text(value, "task_id")),
            if value
                .pointer("/result/compilation/builds")
                .and_then(Value::as_u64)
                == Some(0)
                && value
                    .pointer("/result/compilation/hits")
                    .and_then(Value::as_u64)
                    .is_some_and(|hits| hits > 0)
            {
                "  Build: Cached"
            } else {
                ""
            }
        ),
        Tone::Muted,
    ));
    lines.join("\n")
}

fn cancellation_requested(value: &Value) -> String {
    format!(
        "{}\n{}\n{}",
        paint(
            "Cancellation requested; waiting for the owning process",
            Tone::Pending
        ),
        paint(
            "If suspended with Ctrl+Z, resume it with fg so it can stop and release the store lock.",
            Tone::Muted
        ),
        paint(
            &format!("Task: {}", clean(text(value, "task_id"))),
            Tone::Muted
        )
    )
}

fn task_error(
    error: &crate::application::tasks::TaskFailure,
    task_id: &str,
    state: &str,
    command: &str,
) -> String {
    let compiling = error.code == crate::application::error::ErrorCode::CompilationFailed;
    let (status, tone) = if compiling {
        ("CE", Tone::Compile)
    } else if state == "canceled" {
        ("Canceled", Tone::Pending)
    } else {
        ("Failed", Tone::Failure)
    };
    let diagnostics = error
        .data
        .as_ref()
        .and_then(|data| data.get("stderr"))
        .and_then(Value::as_str)
        .unwrap_or("");
    let message = diagnostics
        .lines()
        .rfind(|line| !line.trim().is_empty())
        .unwrap_or(&error.message);
    format!(
        "{}\n{}\n{}",
        paint(&error.message, tone),
        table::render(
            &["Stage", "Verdict", "Details"],
            vec![vec![
                table::cell(if compiling { "Build" } else { "Judge" }, Tone::Muted),
                table::cell(status, tone),
                Cell::new(super::comparison::excerpt(message, 72)),
            ]]
        ),
        paint(
            &format!("Diagnostics: {command} history load {task_id} --json"),
            Tone::Muted
        )
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_verdicts_have_distinct_colors_and_reset_each_segment() {
        let mut colors = std::collections::HashSet::new();
        for code in [
            "wrong_answer",
            "time_limit_exceeded",
            "runtime_error",
            "presentation_error",
            "memory_limit_exceeded",
            "output_limit_exceeded",
            "compilation_error",
            "partially_correct",
        ] {
            let (label, tone) = verdict(code);
            let colored = paint(label, tone);
            assert!(colored.ends_with("\x1b[0m"));
            assert!(colors.insert(colored.split('m').next().unwrap_or("").to_owned()));
        }
    }
}
