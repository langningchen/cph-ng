use crate::application::error::ErrorCode;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::application::method::Method;

pub const PROTOCOL_VERSION: &str = "1.0";
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(untagged)]
pub enum RequestId {
    String(String),
    Number(i64),
    Unsigned(u64),
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcRequest {
    pub jsonrpc: String,
    #[serde(default)]
    pub id: Option<RequestId>,
    pub method: RequestedMethod,
    #[serde(default)]
    pub params: Option<Value>,
    #[serde(skip)]
    pub notification: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcResponse {
    pub jsonrpc: String,
    pub id: Option<RequestId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<RpcError>,
}
pub use crate::application::error::CommandError as RpcError;

impl RpcResponse {
    #[must_use]
    pub fn success(id: Option<RequestId>, result: Value) -> Self {
        Self {
            jsonrpc: "2.0".into(),
            id,
            result: Some(result),
            error: None,
        }
    }
    #[must_use]
    pub fn error(id: Option<RequestId>, error: RpcError) -> Self {
        Self {
            jsonrpc: "2.0".into(),
            id,
            result: None,
            error: Some(error),
        }
    }
}

/// # Errors
/// Returns `InvalidRequest` for a malformed envelope, request ID, empty method or invalid
/// parameter shape. Unknown nonempty methods remain available for dispatch to reject.
pub fn parse_value(value: Value) -> Result<RpcRequest, RpcError> {
    let notification = value
        .as_object()
        .is_some_and(|value| !value.contains_key("id"));
    let mut request: RpcRequest = serde_json::from_value(value)
        .map_err(|_| RpcError::new(ErrorCode::InvalidRequest, "Invalid Request"))?;
    if request.jsonrpc != "2.0"
        || request.method.as_str().is_empty()
        || request
            .params
            .as_ref()
            .is_some_and(|value| !value.is_object() && !value.is_array())
    {
        return Err(RpcError::new(ErrorCode::InvalidRequest, "Invalid Request"));
    }
    request.notification = notification;
    Ok(request)
}

/// # Errors
/// Returns `ParseError` for invalid JSON, or `InvalidRequest` for a malformed request
/// envelope.
pub fn parse_request(line: &str) -> Result<RpcRequest, RpcError> {
    let value = serde_json::from_str(line)
        .map_err(|_| RpcError::new(ErrorCode::ParseError, "Parse error"))?;
    parse_value(value)
}

/// Unknown wire names survive parsing so dispatch returns `MethodNotFound` with the original ID.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum RequestedMethod {
    Known(Method),
    Unknown(String),
}
impl RequestedMethod {
    #[must_use]
    pub fn as_str(&self) -> &str {
        match self {
            Self::Known(method) => method.as_str(),
            Self::Unknown(name) => name,
        }
    }
    #[must_use]
    pub const fn known(&self) -> Option<Method> {
        match self {
            Self::Known(method) => Some(*method),
            Self::Unknown(_) => None,
        }
    }
}

/// Notifications emitted by the resident server.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum EventMethod {
    #[serde(rename = "event.task.finished")]
    TaskFinished,
    #[serde(rename = "event.task.progress")]
    TaskProgress,
    #[serde(rename = "event.task.started")]
    TaskStarted,
    #[serde(rename = "event.task.queued")]
    TaskQueued,
    #[serde(rename = "event.server.ready")]
    ServerReady,
    #[serde(rename = "event.server.shutting_down")]
    ServerShuttingDown,
    #[serde(rename = "event.server.events_lost")]
    ServerEventsLost,
}
