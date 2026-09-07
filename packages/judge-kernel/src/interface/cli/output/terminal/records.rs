use super::{Tone, clean, detail, layout, names, paint, table::inline, text};
use serde_json::Value;

pub(super) fn list(values: &[Value], label: &str) -> String {
    if values.is_empty() {
        return format!("{}: no entries.", paint(label, Tone::Info));
    }
    let mut lines = vec![paint(&format!("{label} ({})", values.len()), Tone::Info)];
    if let Some(problem_id) = super::sources::shared_problem(values) {
        lines.push(layout::field("Problem ID", &inline(problem_id)));
    }
    if let Some(table) = super::lists::render(values) {
        lines.push(table);
    } else {
        for (index, value) in values.iter().enumerate() {
            lines.push(super::render(value, &format!("Entry {}", index + 1)));
        }
    }
    if values.iter().any(|value| {
        value.get("name").is_some()
            && value
                .get("sources")
                .and_then(Value::as_array)
                .is_some_and(|sources| sources.len() > 1)
    }) {
        lines.push(paint(
            "Use `problem sources` to list every binding.",
            Tone::Hint,
        ));
    }
    lines.join("\n")
}
pub(super) fn problem(value: &Value, label: &str) -> String {
    let mut lines = vec![
        paint(
            &format!("{label}: {}", inline(text(value, "name"))),
            Tone::Info,
        ),
        layout::field("Source", &inline(text(value, "source_path"))),
    ];
    if let (Some(time), Some(memory)) = (value.get("time_limit_ms"), value.get("memory_limit_mb")) {
        lines.push(layout::field("Limits", &format!("{time} ms  {memory} MiB")));
    }
    lines.push(layout::field("ID", &inline(text(value, "id"))));
    if !text(value, "url").is_empty() {
        lines.push(layout::field(
            "URL",
            &paint(&inline(text(value, "url")), Tone::Link),
        ));
    }
    if let Some(cases) = value.get("testcases").and_then(Value::as_array) {
        lines.push(layout::field("Testcases", &cases.len().to_string()));
        if let Some(table) = super::lists::render(cases) {
            lines.push(table);
        }
    }
    lines.join("\n")
}
pub(super) fn testcase(value: &Value, label: &str) -> String {
    let mut lines = vec![format!(
        "  {}  {}",
        paint(label, Tone::Info),
        paint(&clean(text(value, "id")), Tone::Muted)
    )];
    for (key, label) in [("stdin", "Input"), ("answer", "Answer")] {
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
    lines.join("\n")
}

pub(super) fn fields(value: &Value, depth: usize) -> String {
    fields_for(value, depth, "")
}
fn fields_for(value: &Value, depth: usize, context: &str) -> String {
    let indent = "  ".repeat(depth);
    match value {
        Value::Object(values) => values
            .iter()
            .map(|(key, value)| {
                let label = if context == "languages" {
                    names::language(key)
                } else {
                    names::label(key)
                };
                if value.is_object()
                    || value.as_array().is_some_and(|items| {
                        items.iter().any(|item| item.is_object() || item.is_array())
                    })
                {
                    format!(
                        "{indent}{}:\n{}",
                        paint(&label, Tone::Muted),
                        fields_for(value, depth + 1, key)
                    )
                } else {
                    format!(
                        "{indent}{}: {}",
                        paint(&label, Tone::Muted),
                        scalar(value, key)
                    )
                }
            })
            .collect::<Vec<_>>()
            .join("\n"),
        Value::Array(values) => values
            .iter()
            .map(|value| {
                if value.is_object()
                    || value.as_array().is_some_and(|items| {
                        items.iter().any(|item| item.is_object() || item.is_array())
                    })
                {
                    fields_for(value, depth, context)
                } else {
                    format!("{indent}{}", scalar(value, context))
                }
            })
            .collect::<Vec<_>>()
            .join("\n"),
        value => format!("{indent}{}", scalar(value, context)),
    }
}
fn scalar(value: &Value, context: &str) -> String {
    match value {
        Value::String(value) => clean(&names::value(context, value)),
        Value::Bool(true) => paint("Yes", Tone::Success),
        Value::Bool(false) => paint("No", Tone::Pending),
        Value::Null => "-".into(),
        Value::Array(items) => items
            .iter()
            .map(|item| scalar(item, context))
            .collect::<Vec<_>>()
            .join(", "),
        Value::Number(number) => paint(&number.to_string(), Tone::Metric),
        value => value.to_string(),
    }
}

pub(super) fn export(value: &Value) -> String {
    let written = value.get("written").and_then(Value::as_bool) == Some(true);
    let format = names::value("format", text(value, "format"));
    let title = if written {
        format!(
            "Exported {format}  {} bytes",
            value.get("bytes").and_then(Value::as_u64).unwrap_or(0)
        )
    } else {
        format!("Export preview  {format}")
    };
    let mut lines = vec![
        paint(&title, if written { Tone::Success } else { Tone::Info }),
        format!("  {}", inline(text(value, "destination"))),
    ];
    if let Some(losses) = value.get("losses").and_then(Value::as_array)
        && !losses.is_empty()
    {
        lines.push(format!(
            "  {}",
            if written {
                "Accepted data loss:"
            } else {
                "Data loss (requires --force):"
            }
        ));
        for loss in losses {
            if let Some(loss) = loss.as_str() {
                lines.push(format!("    - {}", inline(loss)));
            }
        }
    }
    lines.join("\n")
}

pub(super) fn source_link(value: &Value) -> String {
    let command = match text(value, "cli_command_prefix") {
        "" => "cph-ng-judge",
        command => command,
    };
    let mut lines = vec![paint("Source linked", Tone::Success)];
    for (key, label) in [
        ("source_path", "Source"),
        ("problem_id", "Problem ID"),
        ("code_id", "Code ID"),
    ] {
        lines.push(layout::field(label, &inline(text(value, key))));
    }
    lines.push(paint(
        "Shares tests and settings; history belongs to this source identity.",
        Tone::Muted,
    ));
    lines.push(paint(
        "The primary source falls back to an available binding when unavailable.",
        Tone::Muted,
    ));
    if let Ok(id) = uuid::Uuid::parse_str(text(value, "problem_id")) {
        lines.push(paint(
            &format!("All bindings: {command} problem sources --problem-id {id}"),
            Tone::Hint,
        ));
    }
    lines.join("\n")
}
