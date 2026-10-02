use super::{JsonExt, Workspace};
use anyhow::Context;

#[tokio::test]
async fn missing_primary_uses_linked_source_without_changing_identity() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    let primary = ws.file("old.py", "print(1)")?;
    let problem = ws.ok(&["problem", "create", "old.py"]).await?;
    let id = problem.text("/id")?;
    ws.ok(&["tc", "add", "old.py", "--answer-text", "1"])
        .await?;
    // A different live inode and content prevent automatic moved-file recovery.
    let replacement = ws.file("main.py", "print(1) # another solution")?;
    std::fs::remove_file(&primary)?;
    let missing = ws.raw(&["run", "main.py"]).await?;
    assert_eq!(missing.status.code(), Some(2));
    let error = String::from_utf8(missing.stderr)?;
    for hint in [
        "problem create",
        "problem link --help",
        "problem move --help",
    ] {
        assert!(error.contains(hint), "{error}");
    }
    let linked = ws
        .raw(&[
            "problem",
            "link",
            "--problem-id",
            id,
            "--destination",
            "main.py",
        ])
        .await?;
    assert!(linked.status.success());
    let text = String::from_utf8(linked.stdout)?;
    for marker in [
        "Source linked",
        "primary source",
        "falls back",
        "--store-root",
        "problem sources --problem-id",
    ] {
        assert!(text.contains(marker), "{text}");
    }
    let listed = ws.raw(&["problem", "list"]).await?;
    let text = String::from_utf8(listed.stdout)?;
    for marker in [
        "Problems (1)",
        "Sources",
        "Primary source",
        "main.py",
        "problem sources",
    ] {
        assert!(text.contains(marker), "{text}");
    }
    let json = ws.ok(&["problem", "list"]).await?;
    assert_eq!(
        json.text("/0/source_path")?,
        replacement.canonicalize()?.to_str().context("path")?
    );
    assert_eq!(
        json.required("/0/sources")?
            .as_array()
            .context("bindings")?
            .len(),
        2
    );
    assert!(json.pointer("/0/cli_command_prefix").is_none());
    let sources = ws.raw(&["problem", "sources", "main.py"]).await?;
    let text = String::from_utf8(sources.stdout)?;
    for marker in ["Primary", "Linked", "old.py", "main.py"] {
        assert!(text.contains(marker), "{text}");
    }
    assert_eq!(
        ws.ok(&["run", "main.py"]).await?.text("/result/verdict")?,
        "accepted"
    );
    let bindings = ws.ok(&["problem", "sources", "--problem-id", id]).await?;
    let sources = bindings.as_array().context("sources")?;
    let selected = sources
        .iter()
        .find(|source| source.get("role").and_then(serde_json::Value::as_str) == Some("primary"))
        .context("primary binding")?;
    let linked_id = selected.text("/code_id")?;
    assert_ne!(linked_id, id);
    assert_eq!(json.text("/0/code_id")?, linked_id);
    let run = ws.ok(&["run", "--problem-id", id]).await?;
    assert_eq!(run.text("/code_id")?, linked_id);
    assert_eq!(run.text("/result/verdict")?, "accepted");
    assert_eq!(
        ws.raw(&["run", "--code-id", id]).await?.status.code(),
        Some(2)
    );
    // Restoring the preferred file restores its role without rewriting either identity.
    std::fs::write(&primary, "print(1)")?;
    let restored = ws.ok(&["problem", "load", "--problem-id", id]).await?;
    assert_eq!(restored.text("/code_id")?, id);
    std::fs::remove_file(&replacement)?;
    std::fs::remove_file(&primary)?;
    let missing = ws.ok(&["problem", "load", "--problem-id", id]).await?;
    assert_eq!(missing.text("/code_id")?, id);
    assert_eq!(
        ws.raw(&["run", "--problem-id", id]).await?.status.code(),
        Some(2)
    );
    Ok(())
}

#[tokio::test]
async fn rebuild_receipts_distinguish_empty_success_partial_and_failed_results()
-> anyhow::Result<()> {
    let ws = Workspace::new()?;
    let empty = ws.raw(&["index", "rebuild"]).await?;
    assert!(empty.status.success());
    assert!(String::from_utf8(empty.stdout)?.contains("No sources to rebuild"));
    let first = ws.file("first.py", "print(1)")?;
    ws.ok(&["problem", "create", "first.py"]).await?;
    let second = ws.file("second.py", "print(2)")?;
    ws.ok(&["problem", "create", "second.py"]).await?;
    for (removed, title, summary, code) in [
        (None, "Index rebuilt", "2 rebuilt  0 conflicts  0 failed", 0),
        (
            Some(first),
            "Index rebuilt with errors",
            "1 rebuilt  0 conflicts  1 failed",
            1,
        ),
        (
            Some(second),
            "Index rebuild failed",
            "0 rebuilt  0 conflicts  2 failed",
            1,
        ),
    ] {
        if let Some(path) = removed {
            std::fs::remove_file(path)?;
        }
        let output = ws.raw(&["index", "rebuild"]).await?;
        assert_eq!(output.status.code(), Some(code));
        assert!(output.stderr.is_empty());
        let text = String::from_utf8(output.stdout)?;
        assert!(text.starts_with(title) && text.contains(summary), "{text}");
        for stale in [
            "Task completed",
            "schema version",
            "conflicts:",
            "failures:",
        ] {
            assert!(!text.contains(stale), "{text}");
        }
        assert!(
            text.contains("does not scan the current directory"),
            "{text}"
        );
        if code == 1 {
            assert!(
                text.contains("first.py") && text.contains("Source is unavailable"),
                "{text}"
            );
            assert!(
                text.contains("--store-root") && text.contains("--rebind-only"),
                "{text}"
            );
        }
    }
    let history = String::from_utf8(ws.raw(&["history", "list"]).await?.stdout)?;
    assert!(history.contains("Completed with errors"), "{history}");
    assert!(history.contains("Failed"), "{history}");
    let json = ws.json(&["index", "rebuild"], 1).await?;
    assert_eq!(json.text("/state")?, "succeeded");
    assert_eq!(
        json.required("/result/failures")?
            .as_array()
            .context("failures")?
            .len(),
        2
    );
    assert_eq!(json.required("/result/schema_version")?, 1);
    Ok(())
}

#[tokio::test]
async fn binding_help_explains_selectors_destinations_and_rebuild_scope() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    for (args, markers) in [
        (
            ["problem", "link", "--help"],
            vec![
                "exactly one",
                "--destination",
                "primary source",
                "problem move --rebind-only",
                "Examples:",
            ],
        ),
        (
            ["problem", "move", "--help"],
            vec![
                "identity and history",
                "already moved",
                "--rebind-only",
                "Examples:",
            ],
        ),
        (
            ["index", "rebuild", "--help"],
            vec!["does not scan", "registered", "exit code 1", "Examples:"],
        ),
    ] {
        let result = ws.raw(&args).await?;
        assert!(result.status.success());
        let text = String::from_utf8(result.stdout)?
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
        for marker in markers {
            assert!(text.contains(marker), "{text}");
        }
    }
    assert!(!ws.store.exists(), "help must not initialize the store");
    Ok(())
}
