use crate::application::{error::ErrorCode, method::Method};
use serde_json::json;

use super::protocol::{PROTOCOL_VERSION, RpcError, RpcRequest, RpcResponse};
pub use crate::{
    application::commands::capabilities, infrastructure::kernel::Kernel as RpcContext,
};

pub async fn dispatch(request: RpcRequest, context: &RpcContext) -> (RpcResponse, bool) {
    let params = request.params.unwrap_or_else(|| json!({}));
    let result = if params.is_object() {
        match request.method.known() {
            Some(Method::SystemPing) => Ok(json!({"ok": true})),
            Some(Method::SystemHello) => {
                if params
                    .get("protocol_version")
                    .and_then(serde_json::Value::as_str)
                    .is_some_and(|version| version.split('.').next() != Some("1"))
                {
                    Err(RpcError::invalid("Unsupported protocol version"))
                } else {
                    Ok(
                        json!({"protocol_version": PROTOCOL_VERSION, "server_version": env!("CARGO_PKG_VERSION"), "capabilities": capabilities()}),
                    )
                }
            }
            Some(Method::SystemCapabilities) => Ok(capabilities()),
            Some(Method::SystemAttach) => attach(params, context).await,
            Some(Method::SystemShutdown) => Ok(json!({"accepted": true})),
            Some(method) => context.execute(method, params).await,
            None => Err(RpcError::new(ErrorCode::MethodNotFound, "Method not found")),
        }
    } else {
        Err(RpcError::invalid("Methods require named parameters"))
    };
    let shutdown = request.method.known() == Some(Method::SystemShutdown) && result.is_ok();
    let response = match result {
        Ok(result) => RpcResponse::success(request.id, result),
        Err(error) => RpcResponse::error(request.id, error),
    };
    (response, shutdown)
}

async fn attach(
    params: serde_json::Value,
    context: &RpcContext,
) -> Result<serde_json::Value, RpcError> {
    #[derive(serde::Deserialize)]
    #[serde(deny_unknown_fields)]
    struct Attach {
        workspace_roots: Vec<std::path::PathBuf>,
    }
    let params: Attach = serde_json::from_value(params).map_err(|_| {
        RpcError::invalid(
            "system.attach requires workspace_roots as an array of absolute directories",
        )
    })?;
    context.paths.attach(&params.workspace_roots).await?;
    Ok(json!({"workspace_roots": context.paths.roots()}))
}
