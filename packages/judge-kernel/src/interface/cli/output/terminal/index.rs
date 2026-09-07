//! Human receipts for index maintenance; task state and JSON retain their wire contract.
use super::{Tone, layout, paint, table, text};
use serde_json::Value;

pub(super) fn status(value: &Value) -> Option<(&'static str, Tone)> {
    let rebuilt = value.get("rebuilt")?.as_u64()?;
    let conflicts = value.get("conflicts")?.as_array()?;
    let failures = value.get("failures")?.as_array()?;
    Some(if conflicts.is_empty() && failures.is_empty() {
        ("Completed", Tone::Success)
    } else if rebuilt > 0 {
        ("Completed with errors", Tone::Pending)
    } else {
        ("Failed", Tone::Failure)
    })
}

pub(super) fn render(value: &Value, command: &str) -> String {
    let rebuilt = value.get("rebuilt").and_then(Value::as_u64).unwrap_or(0);
    let conflicts = value
        .get("conflicts")
        .and_then(Value::as_array)
        .map_or(0, Vec::len);
    let failures = value
        .get("failures")
        .and_then(Value::as_array)
        .map_or(0, Vec::len);
    let (title, tone) = match status(value) {
        Some(("Failed", tone)) => ("Index rebuild failed", tone),
        Some(("Completed with errors", tone)) => ("Index rebuilt with errors", tone),
        _ if rebuilt == 0 => ("No sources to rebuild", Tone::Info),
        _ => ("Index rebuilt", Tone::Success),
    };
    let mut lines = vec![paint(title, tone)];
    if rebuilt > 0 || conflicts + failures > 0 {
        lines.push(format!(
            "{rebuilt} rebuilt  {conflicts} conflicts  {failures} failed"
        ));
    }
    for (key, label) in [("conflicts", "Conflict"), ("failures", "Failed")] {
        for item in value
            .get(key)
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            lines.push(layout::field(
                label,
                &table::inline(text(item, "source_path")),
            ));
            if key == "failures" {
                lines.push(layout::indent(&table::inline(text(item, "error")), 4));
            } else if let Some(ids) = item.get("problem_ids").and_then(Value::as_array) {
                let ids = ids
                    .iter()
                    .filter_map(Value::as_str)
                    .map(table::inline)
                    .collect::<Vec<_>>()
                    .join(", ");
                lines.push(layout::indent(&format!("Problem IDs: {ids}"), 4));
            }
        }
    }
    lines.push(paint(
        "Rebuild checks registered paths; it does not scan the current directory.",
        Tone::Hint,
    ));
    if conflicts + failures > 0 {
        lines.push(paint(
            &format!("Inspect bindings: {command} problem sources --problem-id <UUID>"),
            Tone::Hint,
        ));
        lines.push(paint(
            "For a moved source, use `problem move --help` for --rebind-only.",
            Tone::Hint,
        ));
    }
    lines.join("\n")
}
