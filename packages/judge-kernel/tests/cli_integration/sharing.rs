use super::{JsonExt, Workspace};
use anyhow::Context;

#[tokio::test]
async fn copied_markers_do_not_steal_identity_and_moves_keep_source_history() -> anyhow::Result<()>
{
    let ws = Workspace::new()?;
    let original = ws.file("a.py", "print(1)\n")?;
    ws.ok(&["problem", "create", "a.py"]).await?;
    ws.ok(&["testcase", "add", "a.py", "--answer", "1"]).await?;
    let a = ws.ok(&["index", "resolve", "a.py"]).await?;
    let copy = ws.dir.path().join("b.py");
    std::fs::copy(&original, &copy)?;
    #[cfg(unix)]
    {
        let key = if cfg!(target_os = "macos") {
            "org.cph-ng.problem-id"
        } else {
            "user.cph-ng.problem-id"
        };
        let mut bytes = [0_u8; 64];
        if let Ok(size) = rustix::fs::getxattr(&original, key, &mut bytes[..]) {
            rustix::fs::setxattr(
                &copy,
                key,
                bytes.get(..size).context("marker")?,
                rustix::fs::XattrFlags::empty(),
            )?;
        }
    }
    ws.json(&["index", "resolve", "b.py"], 2).await?;
    assert_eq!(ws.ok(&["index", "resolve", "a.py"]).await?, a);
    let b = ws
        .ok(&["problem", "link", "a.py", "--destination", "b.py"])
        .await?;
    assert_eq!(b.required("/problem_id")?, a.required("/problem_id")?);
    assert_ne!(b.required("/code_id")?, a.required("/code_id")?);
    let run = ws.ok(&["run", "b.py"]).await?;
    assert_eq!(run.required("/code_id")?, b.required("/code_id")?);
    assert!(
        ws.ok(&["history", "list", "a.py"])
            .await?
            .as_array()
            .context("history")?
            .is_empty()
    );
    ws.ok(&["problem", "move", "b.py", "--destination", "moved.py"])
        .await?;
    assert_eq!(
        ws.ok(&["index", "resolve", "moved.py"])
            .await?
            .required("/code_id")?,
        b.required("/code_id")?
    );
    assert_eq!(
        ws.ok(&["history", "list", "moved.py"])
            .await?
            .required("/0/task_id")?,
        run.required("/task_id")?
    );
    ws.ok(&["problem", "update", "moved.py", "--name", "Renamed"])
        .await?;
    assert_eq!(
        ws.ok(&["problem", "load", "a.py"])
            .await?
            .required("/name")?,
        "Renamed"
    );
    assert_eq!(
        ws.ok(&["problem", "sources", "a.py"])
            .await?
            .as_array()
            .context("sources")?
            .len(),
        2
    );
    Ok(())
}

#[tokio::test]
async fn fish_completion_includes_nested_commands_and_values_without_opening_store()
-> anyhow::Result<()> {
    let ws = Workspace::new()?;
    let output = ws.raw(&["completions", "fish"]).await?;
    assert!(output.status.success());
    assert!(!ws.store.exists());
    let text = String::from_utf8(output.stdout)?;
    assert!(text.contains("CPH_COMPLETE=fish"));
    let static_output = ws.raw(&["completions", "fish", "--static"]).await?;
    assert!(String::from_utf8(static_output.stdout)?.contains("export-format"));
    let script = ws.file("cph-ng-judge.fish", &text)?;
    if let Ok(output) = tokio::process::Command::new("fish")
        .args([
            "--no-config",
            "-c",
            "source $argv[1]; complete -C 'cph-ng-judge problem '",
            "--",
        ])
        .arg(&script)
        .output()
        .await
    {
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let completions = String::from_utf8(output.stdout)?;
        for command in ["export", "import", "link", "sources"] {
            assert!(
                completions.lines().any(|line| line.starts_with(command)),
                "{completions}"
            );
        }
    }
    Ok(())
}

#[tokio::test]
async fn legacy_history_migration_preserves_the_original_source_identity() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    ws.file("original.py", "print(1)")?;
    let original = ws.ok(&["problem", "create", "original.py"]).await?;
    ws.ok(&["testcase", "add", "original.py", "--answer", "1"])
        .await?;
    let run = ws.ok(&["run", "original.py"]).await?;
    let pool = sqlx::SqlitePool::connect_with(
        sqlx::sqlite::SqliteConnectOptions::new().filename(ws.store.join("index.sqlite3")),
    )
    .await?;
    sqlx::query("INSERT OR REPLACE INTO problem_index(problem_id,marker,device,inode,content_hash,current_path,first_seen,last_seen) SELECT problem_id,marker,device,inode,content_hash,current_path,first_seen,last_seen FROM source_index").execute(&pool).await?;
    sqlx::query("DROP TABLE source_index")
        .execute(&pool)
        .await?;
    sqlx::query("UPDATE tasks SET data=json_remove(data,'$.code_id')")
        .execute(&pool)
        .await?;
    sqlx::query("UPDATE history SET data=json_remove(data,'$.code_id')")
        .execute(&pool)
        .await?;
    sqlx::query("PRAGMA user_version=1").execute(&pool).await?;
    pool.close().await;
    let history = ws.ok(&["history", "list", "original.py"]).await?;
    assert_eq!(history.required("/0/task_id")?, run.required("/task_id")?);
    assert_eq!(history.required("/0/code_id")?, original.required("/id")?);
    ws.file("copy.py", "print(2)")?;
    let linked = ws
        .ok(&["problem", "link", "original.py", "--destination", "copy.py"])
        .await?;
    assert!(
        ws.ok(&["history", "list", "--code-id", linked.text("/code_id")?])
            .await?
            .as_array()
            .context("history")?
            .is_empty()
    );
    ws.ok(&["problem", "delete", "original.py"]).await?;
    assert_eq!(
        ws.ok(&["history", "list", "--code-id", original.text("/id")?])
            .await?
            .required("/0/task_id")?,
        run.required("/task_id")?
    );
    Ok(())
}
