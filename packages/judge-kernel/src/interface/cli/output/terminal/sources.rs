use super::{Tone, paint, table, text};
use serde_json::Value;

pub(super) fn shared_problem(values: &[Value]) -> Option<&str> {
    let id = text(values.first()?, "problem_id");
    (!id.is_empty()
        && values.iter().all(|value| {
            value.get("code_id").is_some()
                && value.get("source_path").is_some()
                && text(value, "problem_id") == id
        }))
    .then_some(id)
}

pub(super) fn render(values: &[Value]) -> String {
    let shared = shared_problem(values).is_some();
    let mut headers = vec!["Code ID", "Role", "Source"];
    if !shared {
        headers.insert(1, "Problem ID");
    }
    let rows = values
        .iter()
        .map(|value| {
            let mut row = vec![
                table::cell(text(value, "code_id"), Tone::Muted),
                table::cell(
                    if text(value, "role") == "primary"
                        || (value.get("role").is_none()
                            && text(value, "code_id") == text(value, "problem_id"))
                    {
                        "Primary"
                    } else {
                        "Linked"
                    },
                    Tone::Muted,
                ),
                path_cell(text(value, "source_path")),
            ];
            if !shared {
                row.insert(1, table::cell(text(value, "problem_id"), Tone::Muted));
            }
            row
        })
        .collect();
    table::render(&headers, rows)
}

pub(super) fn path_cell(path: &str) -> table::Cell {
    let content = table::inline(path);
    if path.is_empty() {
        return table::Cell::new(content);
    }
    // A best-effort snapshot for local human output only; serialized bindings stay intact.
    let status = match std::fs::metadata(path) {
        Ok(metadata) if metadata.is_file() => return table::Cell::new(content),
        Ok(_) => "Not a file",
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => "Missing",
        Err(_) => "Unavailable",
    };
    table::Cell::new(format!(
        "{} {content}",
        paint(&format!("[{status}]"), Tone::Failure)
    ))
}
