//! Stable process exit statuses; conversion to numbers happens at the executable boundary.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(i32)]
pub enum ExitStatus {
    Success = 0,
    JudgingFailed = 1,
    InvalidUsage = 2,
    CompilationFailed = 3,
    ExecutionFailed = 4,
    Canceled = 130,
}
impl From<ExitStatus> for i32 {
    fn from(value: ExitStatus) -> Self {
        value as Self
    }
}

use crate::application::{error::ErrorCode, tasks::TaskFailure};
use serde_json::Value;
fn text<'a>(value: &'a Value, key: &str) -> &'a str {
    value.get(key).and_then(Value::as_str).unwrap_or("")
}
/// Task inspection is successful even if the inspected run failed. Only commands
/// that execute/wait for a task map its result to a process status.
pub(in crate::interface::cli) fn task_exit(value: &Value) -> ExitStatus {
    match text(value, "state") {
        "canceled" => ExitStatus::Canceled,
        "failed" => value
            .get("error")
            .and_then(|error| serde_json::from_value::<TaskFailure>(error.clone()).ok())
            .map_or(ExitStatus::ExecutionFailed, |error| error_exit(&error)),
        "succeeded" => {
            let result = value.get("result").unwrap_or(&Value::Null);
            let failed = result
                .get("verdict")
                .and_then(Value::as_str)
                .is_some_and(|verdict| verdict != "accepted")
                || result.get("found_difference").and_then(Value::as_bool) == Some(true)
                || ["conflicts", "failures"].iter().any(|field| {
                    result
                        .get(field)
                        .and_then(Value::as_array)
                        .is_some_and(|v| !v.is_empty())
                });
            if failed {
                ExitStatus::JudgingFailed
            } else {
                ExitStatus::Success
            }
        }
        _ => ExitStatus::Success,
    }
}
pub(in crate::interface::cli) fn error_exit(error: &TaskFailure) -> ExitStatus {
    match error.code {
        ErrorCode::CompilationFailed => ExitStatus::CompilationFailed,
        ErrorCode::TaskState if error.message == "Task canceled" => ExitStatus::Canceled,
        ErrorCode::InvalidParams
        | ErrorCode::MethodNotFound
        | ErrorCode::InvalidRequest
        | ErrorCode::Busy
        | ErrorCode::UnsupportedLanguage
        | ErrorCode::TaskState
        | ErrorCode::NotFound
        | ErrorCode::Conflict
        | ErrorCode::NotIndexed => ExitStatus::InvalidUsage,
        _ => ExitStatus::ExecutionFailed,
    }
}
