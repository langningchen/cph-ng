use super::{JsonExt, Workspace, id};
use anyhow::Context;
use serde_json::Value;

#[tokio::test]
async fn symmetric_data_flags_aliases_and_usage_errors() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    let missing = ws
        .json(&["tc", "update", "main.py", "--input-text", "1"], 2)
        .await?;
    assert_eq!(missing.required("/error/code")?, -32602);
    assert!(!ws.store.exists());
    ws.file("main.py", "print(input())")?;
    ws.ok(&["problem", "create", "main.py"]).await?;
    let case = ws
        .ok(&[
            "tc",
            "add",
            "main.py",
            "--input-text",
            "1",
            "--answer-text",
            "1",
        ])
        .await?;
    ws.ok(&["tc", "r", "main.py", "-t", id(&case)?]).await?;
    ws.file("sample.in", "2")?;
    ws.file("sample.ans", "2")?;
    ws.ok(&[
        "r",
        "main.py",
        "--input-file",
        "sample.in",
        "--answer-file",
        "sample.ans",
    ])
    .await?;
    ws.ok(&["judge", "r", "main.py", "--stdin", "3", "--answer", "3"])
        .await?;
    ws.ok(&["run", "main.py", "--input", "sample.in", "--answer", "2"])
        .await?;
    ws.ok(&[
        "r",
        "main.py",
        "--input-text",
        "-1 2",
        "--answer-text",
        "-1 2",
    ])
    .await?;
    let literal = ws
        .raw(&[
            "tc",
            "add",
            "main.py",
            "--answer-text",
            "--json",
            "--unknown",
        ])
        .await?;
    assert_eq!(literal.status.code(), Some(2));
    assert!(literal.stdout.is_empty());
    assert!(!literal.stderr.is_empty());
    for args in [
        vec!["tc", "list", "--problem-id", "invalid"],
        vec![
            "tc",
            "add",
            "main.py",
            "--input-text",
            "1",
            "--input-file",
            "sample.in",
        ],
        vec!["router", "set", "--port", "0"],
        vec!["config", "set", "--port", "27122"],
        vec!["config", "--scope", "router", "main.py", "show"],
        vec!["serve", "--transport", "unix"],
        vec!["serve", "--workers", "0"],
    ] {
        assert_eq!(ws.json(&args, 2).await?.required("/error/code")?, -32602);
    }
    let output = ws
        .raw(&["--output", "jsonl", "tc", "list", "--code-id", "invalid"])
        .await?;
    let error: Value = serde_json::from_slice(&output.stdout)?;
    assert_eq!(error.required("/type")?, "error");
    assert!(output.stderr.is_empty());
    Ok(())
}

#[tokio::test]
async fn missing_records_duplicate_ids_and_selection_have_distinct_errors() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    ws.file("main.py", "print(1)")?;
    ws.ok(&["problem", "create", "main.py"]).await?;
    let case = ws
        .ok(&["tc", "add", "main.py", "--answer-text", "1"])
        .await?;
    let absent = uuid::Uuid::new_v4().to_string();
    for action in ["update", "delete", "run"] {
        assert_eq!(
            ws.json(&["tc", action, "main.py", "-t", &absent], 2)
                .await?
                .required("/error/code")?,
            -32003
        );
    }
    assert_eq!(
        ws.json(&["tc", "add", "main.py", "-t", id(&case)?], 2)
            .await?
            .required("/error/code")?,
        -32002
    );
    let repeated = format!("{0},{0}", id(&case)?);
    assert_eq!(
        ws.json(&["r", "main.py", "-t", &repeated], 2)
            .await?
            .required("/error/code")?,
        -32602
    );
    let cases = ws.ok(&["tc", "list", "main.py"]).await?;
    assert_eq!(cases.as_array().context("cases")?.len(), 1);
    assert_eq!(
        ws.json(&["r", "main.py", "--input-file", "absent"], 2)
            .await?
            .required("/error/code")?,
        -32003
    );
    Ok(())
}

#[tokio::test]
async fn router_configuration_uses_config_and_preserves_pairing_and_errors() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    let first = ws.ok(&["config", "--scope", "router", "show"]).await?;
    assert!(!ws.store.join("index.sqlite3").exists());
    ws.ok(&["config", "--scope", "router", "set", "--port", "27122"])
        .await?;
    let changed = ws.ok(&["config", "--scope", "router", "show"]).await?;
    assert_eq!(changed.required("/port")?, 27122);
    assert_eq!(changed.required("/token")?, first.required("/token")?);
    let legacy: Value = serde_json::from_slice(&ws.raw(&["router", "info"]).await?.stdout)?;
    assert_eq!(legacy, changed);
    ws.file("bad-router.toml", "port = 0\ntoken = 'short'")?;
    ws.json(
        &[
            "config",
            "--scope",
            "router",
            "set",
            "--input",
            "bad-router.toml",
        ],
        2,
    )
    .await?;
    assert_eq!(
        ws.ok(&["config", "--scope", "router", "show"]).await?,
        changed
    );
    let lock = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(ws.store.join("router/server.lock"))?;
    lock.try_lock()?;
    let busy = ws
        .json(
            &["config", "--scope", "router", "set", "--port", "27123"],
            2,
        )
        .await?;
    assert_eq!(busy.required("/error/code")?, -32006);
    drop(lock);
    std::fs::write(ws.store.join("router/config.toml"), "broken !")?;
    assert_eq!(
        ws.json(&["router", "info"], 2)
            .await?
            .required("/error/code")?,
        -32602
    );
    assert!(
        ws.ok(&["config", "--scope", "router", "path"])
            .await?
            .get("path")
            .is_some()
    );
    Ok(())
}

#[tokio::test]
async fn service_failures_keep_stdout_available_for_rpc() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    ws.ok(&["config", "init"]).await?;
    let lock = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(ws.store.join("server.lock"))?;
    lock.try_lock()?;
    let output = ws.raw(&["serve", "--json"]).await?;
    assert_eq!(output.status.code(), Some(2));
    assert!(output.stdout.is_empty());
    let error: Value = serde_json::from_slice(&output.stderr)?;
    assert_eq!(error.required("/error/code")?, -32006);
    Ok(())
}
