use super::{Client, JsonExt};
use anyhow::Context;
use cph_ng_judge::application::method::Method;
use std::{path::Path, process::Stdio, time::Duration};

use serde_json::{Value, json};
use tempfile::TempDir;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader, Lines},
    process::Command,
};

#[cfg(unix)]
#[tokio::test]
async fn unix_socket_disconnect_and_signal_shutdown() -> anyhow::Result<()> {
    use std::os::unix::fs::PermissionsExt;

    let root = TempDir::new().context("socket workspace")?;
    let socket = root.path().join("rpc.sock");
    let mut child = Command::new(env!("CARGO_BIN_EXE_cph-ng-judge"))
        .args(["serve", "--transport", "unix", "--store-root"])
        .arg(root.path())
        .arg("--socket")
        .arg(&socket)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .kill_on_drop(true)
        .spawn()
        .context("start socket server")?;
    let mut client = SocketClient::connect(&socket).await?;
    assert_eq!(
        std::fs::metadata(&socket)?.permissions().mode() & 0o777,
        0o600
    );
    let source = root.path().join("sleep.py");
    tokio::fs::write(&source, "import time\ntime.sleep(.2)\nprint(7)\n").await?;
    client
        .call(Method::ProblemCreate, json!({"source_path": source}))
        .await?;
    client
        .call(
            Method::TestcaseAdd,
            json!({"source_path": source, "answer": "7"}),
        )
        .await?;
    let task = client
        .call(Method::JudgeRun, json!({"source_path": source}))
        .await?;
    drop(client);

    let mut client = SocketClient::connect(&socket).await?;
    let final_task = tokio::time::timeout(Duration::from_secs(10), async {
        loop {
            let response = client
                .call(
                    Method::TaskGet,
                    json!({"task_id": task.required("/task_id")?}),
                )
                .await?;
            if matches!(
                response.text("/state")?,
                "succeeded" | "failed" | "canceled"
            ) {
                break Ok::<_, anyhow::Error>(response);
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .context("disconnected task must finish")??;
    assert_eq!(final_task.text("/state")?, "succeeded");
    let pid = rustix::process::Pid::from_raw(i32::try_from(child.id().context("server PID")?)?)
        .context("valid server PID")?;
    rustix::process::kill_process(pid, rustix::process::Signal::TERM)?;
    assert!(
        tokio::time::timeout(Duration::from_secs(5), child.wait())
            .await??
            .success()
    );
    assert!(!socket.exists());
    Ok(())
}

#[cfg(unix)]
#[tokio::test]
async fn ctrl_c_exits_even_when_stdin_has_no_requests() -> anyhow::Result<()> {
    let root = TempDir::new().context("test fixture or response")?;
    let mut client = Client::start(root.path(), &[]).await?;
    let pid = rustix::process::Pid::from_raw(
        i32::try_from(client.child.id().context("test fixture or response")?)
            .context("test fixture or response")?,
    )
    .context("test fixture or response")?;
    rustix::process::kill_process(pid, rustix::process::Signal::INT)
        .context("test fixture or response")?;
    assert!(
        tokio::time::timeout(Duration::from_secs(5), client.child.wait())
            .await
            .context("test fixture or response")?
            .context("test fixture or response")?
            .success()
    );

    Ok(())
}

#[tokio::test]
async fn shared_socket_recovers_stale_endpoints_and_attaches_multiple_workspaces()
-> anyhow::Result<()> {
    let store = TempDir::new()?;
    let first_root = TempDir::new()?;
    let second_root = TempDir::new()?;
    let socket = store.path().join("rpc.sock");
    drop(std::os::unix::net::UnixListener::bind(&socket)?);
    let mut child = Command::new(env!("CARGO_BIN_EXE_cph-ng-judge"))
        .args(["serve", "--transport", "unix", "--store-root"])
        .arg(store.path())
        .arg("--socket")
        .arg(&socket)
        .stdin(Stdio::null())
        .stderr(Stdio::inherit())
        .kill_on_drop(true)
        .spawn()?;
    let mut first = SocketClient::connect(&socket).await?;
    let mut second = SocketClient::connect(&socket).await?;
    first
        .call(
            Method::SystemAttach,
            json!({"workspace_roots": [first_root.path()]}),
        )
        .await?;
    second
        .call(
            Method::SystemAttach,
            json!({"workspace_roots": [second_root.path()]}),
        )
        .await?;
    for root in [first_root.path(), second_root.path()] {
        let source = root.join("solution.py");
        tokio::fs::write(&source, "print(1)").await?;
        first
            .call(Method::ProblemCreate, json!({"source_path": source}))
            .await?;
    }
    drop(first);
    assert_eq!(
        second
            .call(Method::ProblemList, json!({}))
            .await?
            .as_array()
            .context("problem array")?
            .len(),
        2
    );
    second.call(Method::SystemShutdown, json!({})).await?;
    assert!(
        tokio::time::timeout(Duration::from_secs(5), child.wait())
            .await??
            .success()
    );
    assert!(!socket.exists());
    Ok(())
}

#[cfg(unix)]
struct SocketClient {
    reader: Lines<BufReader<tokio::net::unix::OwnedReadHalf>>,
    writer: tokio::net::unix::OwnedWriteHalf,
    id: u64,
}

#[cfg(unix)]
impl SocketClient {
    async fn connect(socket: &Path) -> anyhow::Result<Self> {
        let stream = tokio::time::timeout(Duration::from_secs(5), async {
            loop {
                if let Ok(stream) = tokio::net::UnixStream::connect(socket).await {
                    break stream;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .context("socket server did not become ready")?;
        let (reader, writer) = stream.into_split();
        let mut client = Self {
            reader: BufReader::new(reader).lines(),
            writer,
            id: 0,
        };
        assert_eq!(client.read().await?.text("/method")?, "event.server.ready");
        Ok(client)
    }

    async fn read(&mut self) -> anyhow::Result<Value> {
        let line = tokio::time::timeout(Duration::from_secs(10), self.reader.next_line())
            .await
            .context("socket response timeout")??
            .context("socket closed unexpectedly")?;
        serde_json::from_str(&line).context("socket response must be JSON")
    }

    async fn call(&mut self, method: Method, params: Value) -> anyhow::Result<Value> {
        self.id += 1;
        self.writer
            .write_all(
                format!(
                    "{}\n",
                    json!({"jsonrpc": "2.0", "id": self.id, "method": method, "params": params})
                )
                .as_bytes(),
            )
            .await?;
        loop {
            let response = self.read().await?;
            if response.get("id") == Some(&json!(self.id)) {
                assert!(response.get("error").is_none(), "{method}: {response}");
                return Ok(response.required("/result")?.clone());
            }
        }
    }
}
