use super::{Tone, paint, table, text};
use serde_json::Value;

pub(super) fn excerpt(value: &str, limit: usize) -> String {
    let value = table::inline(value);
    super::layout::width().map_or_else(|| value.clone(), |_| super::layout::truncate(&value, limit))
}

pub(super) fn render(value: &Value) -> String {
    let case = value.get("case_index").unwrap_or(&Value::Null);
    let mut lines = vec![paint(
        &format!("Case {case}: Answer (-), Output (+)"),
        Tone::Info,
    )];
    let diff = text(value, "comparison_diff");
    if diff.is_empty() {
        lines.push("Output and answer are identical; the verdict may depend on the checker or diagnostics.".into());
    } else {
        lines.extend(diff.lines().map(|line| {
            let tone = if line.starts_with('+') {
                Tone::Failure
            } else if line.starts_with('-') {
                Tone::Success
            } else if line.starts_with('@') {
                Tone::Info
            } else {
                Tone::Muted
            };
            paint(line, tone)
        }));
    }
    for key in ["message", "stderr"] {
        if !text(value, key).is_empty() {
            lines.push(paint(
                if key == "stderr" {
                    "Diagnostics:"
                } else {
                    "Checker:"
                },
                Tone::Info,
            ));
            lines.push(super::clean(text(value, key)));
        }
    }
    lines.join("\n")
}
