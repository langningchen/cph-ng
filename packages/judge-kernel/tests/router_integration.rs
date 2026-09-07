use anyhow::{Context, Result, bail};
use futures_util::{SinkExt, StreamExt};
use serde_json::{Value, json};
use std::{
    path::Path,
    process::{Child, Command, Stdio},
    time::Duration,
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpStream,
};
use tokio_tungstenite::{
    MaybeTlsStream, WebSocketStream, connect_async,
    tungstenite::{Message, client::IntoClientRequest},
};

type Socket = WebSocketStream<MaybeTlsStream<TcpStream>>;
struct Gateway {
    child: Child,
    port: u16,
    token: String,
    _root: tempfile::TempDir,
}
impl Drop for Gateway {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
fn command(root: &Path) -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_cph-ng-judge"));
    command.arg("--store-root").arg(root).arg("router");
    command
}
impl Gateway {
    async fn start() -> Result<Self> {
        let root = tempfile::tempdir()?;
        let listener = std::net::TcpListener::bind("127.0.0.1:0")?;
        let port = listener.local_addr()?.port();
        drop(listener);
        let output = command(root.path())
            .args(["set", "--port", &port.to_string()])
            .output()?;
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let info = command(root.path()).arg("info").output()?;
        let info: Value = serde_json::from_slice(&info.stdout)?;
        let token = info
            .get("token")
            .cloned()
            .unwrap_or_default()
            .as_str()
            .context("Missing token")?
            .to_owned();
        let child = command(root.path())
            .arg("serve")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()?;
        let mut gateway = Self {
            child,
            port,
            token,
            _root: root,
        };
        for _ in 0..100 {
            if TcpStream::connect(("127.0.0.1", port)).await.is_ok() {
                return Ok(gateway);
            }
            if let Some(status) = gateway.child.try_wait()? {
                bail!("Gateway exited: {status}");
            }
            tokio::time::sleep(Duration::from_millis(30)).await;
        }
        bail!("Gateway did not start")
    }
    async fn socket(&self, role: &str, token: &str, origin: Option<&str>) -> Result<Socket> {
        let mut request = format!("ws://127.0.0.1:{}/ws", self.port).into_client_request()?;
        if let Some(origin) = origin {
            request.headers_mut().insert("origin", origin.parse()?);
        }
        let (mut socket, _) = connect_async(request).await?;
        socket.send(Message::Text(json!({"jsonrpc":"2.0","id":1,"method":"router.hello","params":{"role":role,"token":token}}).to_string())).await?;
        Ok(socket)
    }
    async fn paired(&self, role: &str) -> Result<Socket> {
        let mut socket = self.socket(role, &self.token, None).await?;
        let hello = next(&mut socket).await?;
        assert_eq!(
            hello
                .pointer("/result/protocol_version")
                .cloned()
                .unwrap_or_default(),
            "1.0"
        );
        Ok(socket)
    }
    async fn http(&self, host: &str, origin: Option<&str>, body: Option<Value>) -> Result<String> {
        let mut socket = TcpStream::connect(("127.0.0.1", self.port)).await?;
        let method = if body.is_some() { "POST" } else { "GET" };
        let body = body.map_or_else(String::new, |value| value.to_string());
        let origin = origin.map_or_else(String::new, |origin| format!("Origin: {origin}\r\n"));
        let request = format!(
            "{method} / HTTP/1.1\r\nHost: {host}\r\n{origin}Content-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        socket.write_all(request.as_bytes()).await?;
        let mut output = String::new();
        tokio::time::timeout(Duration::from_secs(5), socket.read_to_string(&mut output)).await??;
        Ok(output)
    }
}
async fn next(socket: &mut Socket) -> Result<Value> {
    loop {
        let message = tokio::time::timeout(Duration::from_secs(5), socket.next())
            .await?
            .context("Socket closed")??;
        if let Message::Text(text) = message {
            return Ok(serde_json::from_str(&text)?);
        }
    }
}
async fn request(socket: &mut Socket, id: u64, method: &str, params: Value) -> Result<Value> {
    socket
        .send(Message::Text(
            json!({"jsonrpc":"2.0","id":id,"method":method,"params":params}).to_string(),
        ))
        .await?;
    loop {
        let value = next(socket).await?;
        if value.get("id").cloned().unwrap_or_default() == id {
            return Ok(value);
        }
    }
}
async fn notification(socket: &mut Socket, method: &str) -> Result<Value> {
    loop {
        let value = next(socket).await?;
        if value.get("method").cloned().unwrap_or_default() == method {
            return Ok(value.get("params").cloned().unwrap_or_default().clone());
        }
    }
}
fn problem() -> Value {
    json!({"name":"A + B","url":"https://example.com/problem","timeLimit":1000,"memoryLimit":256,"tests":[{"input":"1 2","output":"3"}],"batch":{"id":"batch-1","size":1}})
}

#[tokio::test]
async fn gateway_authentication_and_browser_boundary() -> Result<()> {
    let gateway = Gateway::start().await?;
    let mut invalid = gateway.socket("browser", "incorrect", None).await?;
    assert!(
        next(&mut invalid)
            .await?
            .get("error")
            .cloned()
            .unwrap_or_default()
            .is_object()
    );
    assert!(
        gateway
            .socket("browser", &gateway.token, Some("https://example.com"))
            .await
            .is_err()
    );
    let mut spoofed = gateway
        .socket("vscode", &gateway.token, Some("chrome-extension://test"))
        .await?;
    assert!(
        next(&mut spoofed)
            .await?
            .get("error")
            .cloned()
            .unwrap_or_default()
            .is_object()
    );
    let mut browser = gateway.paired("browser").await?;
    assert!(
        request(
            &mut browser,
            2,
            "judge.run",
            json!({"source_path":"/tmp/a.cpp"})
        )
        .await?
        .get("error")
        .cloned()
        .unwrap_or_default()
        .is_object()
    );
    assert!(
        gateway
            .http("evil.example", None, None)
            .await?
            .starts_with("HTTP/1.1 403")
    );
    assert!(
        gateway
            .http("localhost", Some("https://evil.example"), Some(problem()))
            .await?
            .starts_with("HTTP/1.1 403")
    );
    assert!(
        gateway
            .http(
                "localhost",
                Some("chrome-extension://companion"),
                Some(problem())
            )
            .await?
            .starts_with("HTTP/1.1 200")
    );
    Ok(())
}

#[tokio::test]
async fn gateway_claim_is_exclusive_and_submission_reaches_active_browser() -> Result<()> {
    let gateway = Gateway::start().await?;
    let mut first = gateway.paired("vscode").await?;
    let mut second = gateway.paired("vscode").await?;
    let mut browser = gateway.paired("browser").await?;
    assert!(
        gateway
            .http("localhost", None, Some(problem()))
            .await?
            .starts_with("HTTP/1.1 200")
    );
    assert_eq!(
        notification(&mut first, "event.router.batch_available")
            .await?
            .get("autoImport")
            .cloned()
            .unwrap_or_default(),
        false
    );
    notification(&mut second, "event.router.batch_available").await?;
    let params = json!({"batchId":"batch-1"});
    let (a, b) = tokio::join!(
        request(&mut first, 2, "router.claim_batch", params.clone()),
        request(&mut second, 2, "router.claim_batch", params.clone())
    );
    let (a, b) = (a?, b?);
    assert_ne!(
        a.pointer("/result/claimed")
            .cloned()
            .unwrap_or_default()
            .as_bool(),
        b.pointer("/result/claimed")
            .cloned()
            .unwrap_or_default()
            .as_bool()
    );
    let submission = json!({"url":"https://example.com/problem","sourceCode":"int main() {}"});
    assert_eq!(
        request(&mut first, 3, "router.submit", submission.clone())
            .await?
            .pointer("/result/forwarded")
            .cloned()
            .unwrap_or_default(),
        true
    );
    assert_eq!(
        notification(&mut browser, "event.router.submit_request").await?,
        submission
    );
    let winner = if a.pointer("/result/claimed").cloned().unwrap_or_default() == true {
        &mut first
    } else {
        &mut second
    };
    assert_eq!(
        request(winner, 4, "router.complete_batch", params)
            .await?
            .pointer("/result/removed")
            .cloned()
            .unwrap_or_default(),
        true
    );
    assert!(
        gateway
            .http("localhost", None, None)
            .await?
            .contains("\"batches\":0")
    );
    Ok(())
}

#[tokio::test]
async fn gateway_replays_unclaimed_batches_after_editor_reconnect() -> Result<()> {
    let gateway = Gateway::start().await?;
    let mut editor = gateway.paired("vscode").await?;
    gateway.http("localhost", None, Some(problem())).await?;
    notification(&mut editor, "event.router.batch_available").await?;
    request(
        &mut editor,
        2,
        "router.claim_batch",
        json!({"batchId":"batch-1"}),
    )
    .await?;
    editor.close(None).await?;
    let mut next_editor = gateway.paired("vscode").await?;
    let available = notification(&mut next_editor, "event.router.batch_available").await?;
    assert_eq!(
        available.get("batchId").cloned().unwrap_or_default(),
        "batch-1"
    );
    Ok(())
}

#[tokio::test]
async fn gateway_rejects_batches_larger_than_client_frame_budget() -> Result<()> {
    let gateway = Gateway::start().await?;
    let oversized = json!({"name":"large","tests":[{"input":"x".repeat(3 * 1024 * 1024),"output":""}],"batch":{"id":"too-large","size":1}});
    let response = gateway.http("localhost", None, Some(oversized)).await?;
    assert!(response.starts_with("HTTP/1.1 400"));
    assert!(response.contains("Batch exceeds 3 MiB"));
    Ok(())
}
