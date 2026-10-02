use super::{JsonExt, Workspace, id};
use anyhow::Context;
use cph_ng_judge::application::{error::ErrorCode, method::Method};
use std::{process::Stdio, time::Duration};

use serde_json::{Value, json};
use tokio::io::AsyncWriteExt;

#[tokio::test]
async fn imports_configuration_and_explicit_workspace_roots() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    let source = ws.file("echo.py", "print(input())\n")?;
    ws.file(
        "companion.json",
        &json!({"name":"Echo", "timeLimit":2000, "tests":[{"input":"7", "output":"7"}]})
            .to_string(),
    )?;
    let problem = ws
        .ok(&["import", "companion.json", "--source", "echo.py"])
        .await?;
    assert_eq!(problem.required("/name")?, "Echo");
    ws.ok(&["judge", "run", "echo.py"]).await?;
    let path = ws.ok(&["config", "echo.py", "path"]).await?;
    assert!(path.text("/path")?.contains(id(&problem)?));
    let shown = ws.ok(&["config", "--source", "echo.py", "show"]).await?;
    assert!(shown.required("/config")?.is_object());
    assert!(!shown.to_string().contains("\\u001b"));
    ws.file("unregistered.py", "print('different')\n")?;
    assert_eq!(
        (ws.json(&["config", "unregistered.py", "path"], 2).await?).required("/error/code")?,
        &json!(ErrorCode::NotIndexed)
    );
    ws.ok(&["problem", "delete", "echo.py"]).await?;
    ws.file("old.prob", &json!({"name":"Old", "url":"", "tests":[{"id":1,"input":"8","output":"8"}], "interactive":false,"memoryLimit":128,"timeLimit":1000,"srcPath":source,"group":"tests","local":true}).to_string())?;
    assert_eq!(
        (ws.ok(&["import", "--input", "old.prob"]).await?).required("/name")?,
        "Old"
    );
    ws.ok(&["problem", "delete", "echo.py"]).await?;
    let mut child = ws
        .command(&["problem", "import", "-", "--source", "echo.py", "--json"])
        .stdin(Stdio::piped())
        .spawn()
        .context("test fixture or response")?;
    child
        .stdin
        .take()
        .context("test fixture or response")?
        .write_all(b"{\"name\":\"From stdin\",\"tests\":[]}")
        .await
        .context("test fixture or response")?;
    let output = child
        .wait_with_output()
        .await
        .context("test fixture or response")?;
    assert!(output.status.success());
    assert_eq!(
        (serde_json::from_slice::<Value>(&output.stdout).context("test fixture or response")?)
            .required("/name")?,
        "From stdin"
    );
    std::fs::create_dir(ws.dir.path().join("allowed")).context("test fixture or response")?;
    ws.json(
        &["problem", "load", "echo.py", "--workspace-root", "allowed"],
        2,
    )
    .await?;
    // A malformed config remains inspectable/editable by its path command.
    std::fs::write(ws.store.join("config.toml"), "this is invalid TOML !")
        .context("test fixture or response")?;
    ws.ok(&["config", "path"]).await?;
    ws.json(&["config", "show"], 2).await?;
    assert!(
        (ws.ok(&["capabilities"]).await?)
            .required("/methods")?
            .as_array()
            .context("test fixture or response")?
            .contains(&json!(Method::TaskList))
    );

    Ok(())
}

#[tokio::test]
async fn invalid_legacy_import_is_rejected_without_clamping_or_reading_stdin() -> anyhow::Result<()>
{
    let ws = Workspace::new()?;
    let source = ws.file("main.py", "print(1)\n")?;
    let mut data = json!({"name":"Overflow", "url":"", "tests":[], "interactive":false,
        "memoryLimit":65536, "timeLimit":1000, "srcPath":source, "group":"tests", "local":true});
    ws.file("overflow.prob", &data.to_string())?;
    let mut child = ws
        .command(&["import", "overflow.prob", "--json"])
        .stdin(Stdio::piped())
        .spawn()
        .context("test fixture or response")?;
    let _stdin = child.stdin.take().context("test fixture or response")?;
    let output = tokio::time::timeout(Duration::from_secs(5), child.wait_with_output())
        .await
        .context("test fixture or response")?
        .context("test fixture or response")?;
    assert_eq!(output.status.code(), Some(2));
    let result: Value =
        serde_json::from_slice(&output.stdout).context("test fixture or response")?;
    assert!(result.text("/error/message")?.contains("memory_limit_mb"));
    assert!(!String::from_utf8_lossy(&output.stderr).contains("Proceed"));
    (*(data)
        .get_mut("memoryLimit")
        .context("missing response field")?) = json!(128);
    (*(data)
        .get_mut("timeLimit")
        .context("missing response field")?) = json!(300_001);
    ws.file("overflow.prob", &data.to_string())?;
    assert!(
        (ws.json(&["import", "overflow.prob"], 2).await?)
            .text("/error/message")?
            .contains("time_limit_ms")
    );
    assert_eq!(ws.ok(&["problem", "list"]).await?, json!([]));

    Ok(())
}
