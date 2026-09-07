use super::{Client, JsonExt};
use anyhow::Context;
use cph_ng_judge::application::{error::ErrorCode, method::Method};
use std::time::Duration;

use serde_json::json;
use tempfile::TempDir;
use tokio::io::AsyncWriteExt;

#[tokio::test]
async fn protocol_lifecycle_and_validation() -> anyhow::Result<()> {
    let root = TempDir::new().context("test fixture or response")?;
    let mut client = Client::start(root.path(), &["--max-message-bytes", "256"]).await?;
    tokio::time::sleep(Duration::from_millis(50)).await;
    assert!(
        client
            .child
            .try_wait()
            .context("test fixture or response")?
            .is_none()
    );
    assert_eq!(client.ok(Method::ProblemList, json!({})).await?, json!([]));
    client
        .input
        .write_all(b"{broken\n")
        .await
        .context("test fixture or response")?;
    assert_eq!(
        (client.read().await?).required("/error/code")?,
        &json!(ErrorCode::ParseError)
    );
    client
        .input
        .write_all(b"{\"jsonrpc\":\"1.0\",\"id\":\"bad\",\"method\":\"x\"}\n")
        .await
        .context("test fixture or response")?;
    let invalid = client.read().await?;
    assert_eq!(
        invalid.required("/error/code")?,
        &json!(ErrorCode::InvalidRequest)
    );
    assert_eq!(invalid.required("/id")?, "bad");
    client
        .input
        .write_all(format!("{}\n", "x".repeat(300)).as_bytes())
        .await
        .context("test fixture or response")?;
    assert_eq!(
        (client.read().await?).required("/error/code")?,
        &json!(ErrorCode::InvalidRequest)
    );
    client
        .input
        .write_all(b"{\"jsonrpc\":\"2.0\",\"method\":\"system.ping\"}\n")
        .await
        .context("test fixture or response")?;
    assert_eq!(
        (client.ok(Method::SystemPing, json!({})).await?).required("/ok")?,
        true
    );
    let unknown = client
        .send(json!({"method":"unknown", "params":{}}))
        .await?;
    assert_eq!(
        (client.response(unknown).await?).required("/error/code")?,
        &json!(ErrorCode::MethodNotFound)
    );
    assert_eq!(
        (client
            .call(Method::SystemHello, json ! ({ "protocol_version" : "2.0" }))
            .await?)
            .required("/error/code")?,
        &json!(ErrorCode::InvalidParams)
    );
    client.input.write_all(b"[{\"jsonrpc\":\"2.0\",\"id\":\"a\",\"method\":\"system.ping\"},{\"jsonrpc\":\"2.0\",\"method\":\"system.ping\"}]\n").await.context("test fixture or response")?;
    assert_eq!(
        client
            .read()
            .await?
            .as_array()
            .context("test fixture or response")?
            .len(),
        1
    );
    client.shutdown().await?;

    Ok(())
}

#[test]
fn typed_commands_decode_existing_wire_values_and_reject_typos() -> anyhow::Result<()> {
    use cph_ng_judge::{
        application::error::CommandError,
        interface::rpc::protocol::{RequestedMethod, parse_request},
    };

    let request = parse_request(r#"{"jsonrpc":"2.0","id":"client-1","method":"task.list"}"#)?;
    assert!(matches!(
        request.method,
        RequestedMethod::Known(Method::TaskList)
    ));
    assert!(serde_json::from_str::<Method>(r#""task.lsit""#).is_err());
    let legacy_error = json!({"code": -32010, "message": "Compilation failed", "data": {"stderr": "syntax error"}});
    let error: CommandError = serde_json::from_value(legacy_error.clone())?;
    assert_eq!(error.code, ErrorCode::CompilationFailed);
    assert_eq!(serde_json::to_value(error)?, legacy_error);
    Ok(())
}

#[tokio::test]
async fn capabilities_cover_typed_methods_and_unknown_names_keep_request_ids() -> anyhow::Result<()>
{
    let root = TempDir::new()?;
    let mut client = Client::start(root.path(), &[]).await?;
    let capabilities = client.ok(Method::SystemCapabilities, json!({})).await?;
    let methods: Vec<Method> = serde_json::from_value(capabilities.required("/methods")?.clone())?;
    assert_eq!(methods, Method::ALL);
    let id = client.send(json!({"method": "task.lsit"})).await?;
    let response = client.response(id).await?;
    assert_eq!(response.required("/id")?, id);
    assert_eq!(
        response.required("/error/code")?,
        &json!(ErrorCode::MethodNotFound)
    );
    client.shutdown().await
}
