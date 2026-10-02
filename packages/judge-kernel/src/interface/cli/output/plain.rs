use serde_json::Value;

pub(super) fn human(value: &Value, label: &str) -> String {
    // Preserve the CLI's pipe-friendly configuration path and TOML output.
    if let Some(toml) = value.get("toml").and_then(Value::as_str) {
        let path = value.get("path").and_then(Value::as_str).unwrap_or("");
        return format!("# {path}\n{toml}");
    }
    if let Some(path) = value.get("path").and_then(Value::as_str)
        && value.get("config").is_none()
        && value.get("language").is_none()
    {
        return path.into();
    }
    super::terminal::render(value, label)
}
