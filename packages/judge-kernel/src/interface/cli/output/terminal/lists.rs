use super::table::Cell;
use super::{Tone, judging, names, table, text};
use serde_json::Value;

pub(super) fn render(values: &[Value]) -> Option<String> {
    let first = values.first()?;
    let (headers, rows) = if first.get("source_path").is_some() && first.get("name").is_some() {
        (
            vec!["ID", "Name", "Sources", "Primary source"],
            values
                .iter()
                .map(|value| {
                    vec![
                        table::cell(text(value, "id"), Tone::Muted),
                        table::cell(text(value, "name"), Tone::Info),
                        table::number(
                            &value
                                .get("sources")
                                .and_then(Value::as_array)
                                .map_or_else(|| "-".into(), |sources| sources.len().to_string()),
                        ),
                        super::sources::path_cell(text(value, "source_path")),
                    ]
                })
                .collect(),
        )
    } else if first.get("task_id").is_some() && first.get("state").is_some() {
        let events = first.get("sequence").is_some();
        let mut headers = vec!["Task", "Kind", "Status"];
        if events {
            headers.insert(0, "Seq");
            headers.push("Phase");
        }
        (
            headers,
            values.iter().map(|value| task_row(value, events)).collect(),
        )
    } else if first.get("stdin").is_some() && first.get("answer").is_some() {
        (
            vec!["Testcase", "ID", "Input", "Answer"],
            values
                .iter()
                .enumerate()
                .map(|(index, value)| {
                    vec![
                        table::cell(&format!("Case {}", index + 1), Tone::Muted),
                        table::cell(text(value, "id"), Tone::Muted),
                        Cell::new(preview(text(value, "stdin"))),
                        Cell::new(preview(text(value, "answer"))),
                    ]
                })
                .collect(),
        )
    } else if first.get("language").is_some() && first.get("version").is_some() {
        (
            vec!["Language", "Kind", "Name", "Version", "Path"],
            values
                .iter()
                .map(|value| {
                    vec![
                        table::cell(&names::language(text(value, "language")), Tone::Info),
                        table::cell(
                            &if text(value, "kind") == "compiler"
                                && matches!(text(value, "language"), "python" | "javascript")
                            {
                                "Syntax check".into()
                            } else {
                                names::value("kind", text(value, "kind"))
                            },
                            Tone::Muted,
                        ),
                        Cell::new(table::inline(text(value, "name"))),
                        Cell::new(table::inline(text(value, "version"))),
                        Cell::new(table::inline(text(value, "path"))),
                    ]
                })
                .collect(),
        )
    } else if first.get("source_path").is_some() && first.get("code_id").is_some() {
        return Some(super::sources::render(values));
    } else {
        return None;
    };
    Some(table::render(&headers, rows))
}

fn preview(value: &str) -> String {
    if value.is_empty() {
        return "(empty)".into();
    }
    super::comparison::excerpt(value, 48)
}

fn task_row(value: &Value, events: bool) -> Vec<Cell> {
    let outcome = value.get("result").unwrap_or(&Value::Null);
    let (status, tone) = if !text(outcome, "verdict").is_empty() {
        judging::verdict(text(outcome, "verdict"))
    } else if let Some(case) = outcome.get("testcase") {
        judging::verdict(text(case, "verdict"))
    } else if outcome.get("found_difference").and_then(Value::as_bool) == Some(true) {
        ("Counterexample found", Tone::Pending)
    } else if let Some(status) = super::index::status(outcome) {
        status
    } else {
        match text(value, "state") {
            "succeeded" => ("Completed", Tone::Success),
            "failed" => ("Failed", Tone::Failure),
            "canceled" => ("Canceled", Tone::Pending),
            "queued" => ("Queued", Tone::Pending),
            _ => ("Running", Tone::Info),
        }
    };
    let mut row = vec![
        table::cell(text(value, "task_id"), Tone::Muted),
        table::cell(&names::value("kind", text(value, "kind")), Tone::Info),
        table::cell(status, tone),
    ];
    if events {
        row.insert(
            0,
            table::number(
                &value
                    .get("sequence")
                    .map_or_else(String::new, Value::to_string),
            ),
        );
        row.push(table::cell(
            &names::value("phase", text(outcome, "phase")),
            Tone::Muted,
        ));
    }
    row
}
