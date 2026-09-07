//! Stable numeric errors shared by the application, CLI, persisted tasks and RPC.
use serde::{Deserialize, Serialize};
use serde_json::Value;

macro_rules! error_codes {
    ($($variant:ident = $number:literal),+ $(,)?) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
        #[serde(into = "i32", try_from = "i32")]
        #[repr(i32)]
        pub enum ErrorCode { $($variant = $number),+ }

        impl ErrorCode {
            pub const ALL: &'static [Self] = &[$(Self::$variant),+];
        }

        impl TryFrom<i32> for ErrorCode {
            type Error = UnknownErrorCode;
            fn try_from(value: i32) -> Result<Self, Self::Error> {
                match value {
                    $($number => Ok(Self::$variant),)+
                    _ => Err(UnknownErrorCode(value)),
                }
            }
        }
    };
}

error_codes! {
    ParseError = -32700,
    InvalidRequest = -32600,
    MethodNotFound = -32601,
    InvalidParams = -32602,
    InternalRpc = -32603,
    NotIndexed = -32001,
    Conflict = -32002,
    NotFound = -32003,
    TaskState = -32004,
    UnsupportedLanguage = -32005,
    Busy = -32006,
    CompilationFailed = -32010,
    ExecutionFailed = -32011,
    CheckerFailed = -32012,
    InternalError = -32099,
}

impl From<ErrorCode> for i32 {
    fn from(value: ErrorCode) -> Self {
        value as Self
    }
}

impl std::fmt::Display for ErrorCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        i32::from(*self).fmt(f)
    }
}

#[derive(Debug, Clone, thiserror::Error)]
#[error("Unknown error code: {0}")]
pub struct UnknownErrorCode(pub i32);

#[derive(Debug, Clone, Serialize, Deserialize, thiserror::Error)]
#[error("{message}")]
pub struct CommandError {
    pub code: ErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

impl CommandError {
    #[must_use]
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            data: None,
        }
    }

    #[must_use]
    pub fn invalid(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::InvalidParams, message)
    }

    #[must_use]
    pub fn internal(error: impl std::fmt::Display) -> Self {
        eprintln!("kernel operation failed: {error}");
        Self::new(ErrorCode::InternalError, "Internal operation failed")
    }

    /// Classify expected filesystem failures without turning missing or conflicting
    /// user paths into internal errors. Keep the underlying OS reason visible.
    #[must_use]
    pub fn filesystem(action: &str, error: &std::io::Error) -> Self {
        let code = match error.kind() {
            std::io::ErrorKind::NotFound => ErrorCode::NotFound,
            std::io::ErrorKind::AlreadyExists => ErrorCode::Conflict,
            std::io::ErrorKind::PermissionDenied
            | std::io::ErrorKind::InvalidInput
            | std::io::ErrorKind::InvalidData => ErrorCode::InvalidParams,
            _ => ErrorCode::ExecutionFailed,
        };
        Self::new(code, format!("{action}: {error}"))
    }

    #[must_use]
    pub fn canceled() -> Self {
        Self::new(ErrorCode::TaskState, "Task canceled")
    }
}
