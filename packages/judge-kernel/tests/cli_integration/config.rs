use super::{JsonExt, Workspace};
use anyhow::Context;
use std::process::Stdio;

use serde_json::Value;
use tokio::io::AsyncWriteExt;

#[tokio::test]
async fn config_commands_validate_replace_and_never_start_an_editor() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    let first = ws
        .command(&["config", "init", "--json"])
        .env("VISUAL", "editor-must-never-run")
        .env("EDITOR", "editor-must-never-run")
        .output()
        .await
        .context("test fixture or response")?;
    assert!(
        first.status.success(),
        "{}",
        String::from_utf8_lossy(&first.stderr)
    );
    assert_eq!(
        (serde_json::from_slice::<Value>(&first.stdout).context("test fixture or response")?)
            .required("/created")?,
        true
    );
    let original = std::fs::read_to_string(ws.store.join("config.toml"))
        .context("test fixture or response")?;
    assert_eq!(
        (ws.ok(&["config", "init"]).await?).required("/created")?,
        false
    );
    assert_eq!(
        std::fs::read_to_string(ws.store.join("config.toml"))
            .context("test fixture or response")?,
        original
    );
    ws.file(
        "new.toml",
        "compilation_timeout_ms = 12345\n[problem]\ntime_limit = 2000\nmemory_limit = 128\n",
    )?;
    assert_eq!(
        (ws.ok(&["config", "set", "--input", "new.toml"]).await?).required("/updated")?,
        true
    );
    assert_eq!(
        (ws.ok(&["config", "show"]).await?).required("/config/compilation_timeout_ms")?,
        12345
    );
    let good = std::fs::read_to_string(ws.store.join("config.toml"))
        .context("test fixture or response")?;
    for invalid in [
        "[broken",
        "compilation_timeout_ms = 0",
        "[problem]\nmemory_limit = 0",
    ] {
        ws.file("invalid.toml", invalid)?;
        ws.json(&["config", "set", "--input", "invalid.toml"], 2)
            .await?;
        assert_eq!(
            std::fs::read_to_string(ws.store.join("config.toml"))
                .context("test fixture or response")?,
            good
        );
    }
    ws.file("large.toml", &"#".repeat(1024 * 1024 + 1))?;
    ws.json(&["config", "set", "--input", "large.toml"], 2)
        .await?;
    std::fs::write(ws.store.join("config.toml"), "broken !").context("test fixture or response")?;
    let mut child = ws
        .command(&["config", "set", "--input", "-", "--json"])
        .stdin(Stdio::piped())
        .spawn()
        .context("test fixture or response")?;
    child
        .stdin
        .take()
        .context("test fixture or response")?
        .write_all(b"compilation_timeout_ms = 4000\n")
        .await
        .context("test fixture or response")?;
    assert!(
        child
            .wait_with_output()
            .await
            .context("test fixture or response")?
            .status
            .success()
    );
    assert_eq!(
        (ws.ok(&["config", "show"]).await?).required("/config/compilation_timeout_ms")?,
        4000
    );
    ws.file("main.py", "print(1)\n")?;
    ws.ok(&["problem", "create", "main.py"]).await?;
    ws.ok(&["config", "main.py", "init"]).await?;
    ws.ok(&["config", "main.py", "set", "--input", "new.toml"])
        .await?;
    assert_eq!(
        (ws.ok(&["config", "main.py", "show"]).await?)
            .required("/config/compilation_timeout_ms")?,
        12345
    );
    Ok(())
}

#[tokio::test]
async fn removed_interactive_options_are_rejected() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    for args in [
        vec!["--ci", "problem", "list"],
        vec!["--yes", "problem", "list"],
        vec!["config", "edit"],
    ] {
        let output = ws.raw(&args).await?;
        assert_eq!(output.status.code(), Some(2));
    }

    Ok(())
}
