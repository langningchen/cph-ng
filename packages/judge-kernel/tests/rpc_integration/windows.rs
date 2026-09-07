use super::JsonExt;
use anyhow::Context;
use serde_json::Value;
use std::{process::Stdio, time::Duration};
use tempfile::TempDir;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::Command,
};

#[cfg(windows)]
#[tokio::test]
async fn windows_named_pipe_uses_the_shared_dispatcher() -> anyhow::Result<()> {
    let root = TempDir::new().context("test fixture or response")?;
    let pipe = format!(r"\\.\pipe\cph-ng-test-{}", uuid::Uuid::new_v4());
    let mut child = Command::new(env!("CARGO_BIN_EXE_cph-ng-judge"))
        .args([
            "serve",
            "--transport",
            "pipe",
            "--pipe",
            &pipe,
            "--store-root",
        ])
        .arg(root.path())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::inherit())
        .kill_on_drop(true)
        .spawn()
        .context("test fixture or response")?;
    let stream = tokio::time::timeout(Duration::from_secs(5), async {
        loop {
            if let Ok(stream) = tokio::net::windows::named_pipe::ClientOptions::new().open(&pipe) {
                break stream;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .context("test fixture or response")?;
    let (reader, mut writer) = tokio::io::split(stream);
    let mut reader = BufReader::new(reader).lines();
    let ready: Value = serde_json::from_str(
        &reader
            .next_line()
            .await
            .context("test fixture or response")?
            .context("test fixture or response")?,
    )
    .context("test fixture or response")?;
    assert_eq!(ready.required("/method")?, "event.server.ready");
    writer
        .write_all(b"{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"system.shutdown\"}\n")
        .await
        .context("test fixture or response")?;
    let response: Value = serde_json::from_str(
        &reader
            .next_line()
            .await
            .context("test fixture or response")?
            .context("test fixture or response")?,
    )
    .context("test fixture or response")?;
    assert_eq!(response.required("/result/accepted")?, true);
    assert!(
        tokio::time::timeout(Duration::from_secs(5), child.wait())
            .await
            .context("test fixture or response")?
            .context("test fixture or response")?
            .success()
    );

    Ok(())
}
