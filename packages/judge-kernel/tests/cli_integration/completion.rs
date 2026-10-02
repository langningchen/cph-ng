use super::{Workspace, id, task_id};
use anyhow::Context;

async fn complete(ws: &Workspace, args: &[&str]) -> anyhow::Result<String> {
    let output = ws
        .command(&[&["--"], args].concat())
        .env("CPH_COMPLETE", "fish")
        .env("CPH_STORE_ROOT", &ws.store)
        .output()
        .await?;
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());
    Ok(String::from_utf8(output.stdout)?)
}

#[tokio::test]
async fn completion_reads_contextual_ids_without_mutating_the_store() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    let empty = complete(&ws, &["cph-ng-judge", "tc", "list", "--problem-id", ""]).await?;
    assert!(empty.is_empty());
    assert!(!ws.store.exists());
    ws.file("space name.py", "print(1)")?;
    let problem = ws
        .ok(&["problem", "create", "space name.py", "--name", "First"])
        .await?;
    let first = ws
        .ok(&["tc", "add", "space name.py", "--answer-text", "1"])
        .await?;
    let second = ws
        .ok(&["tc", "add", "space name.py", "--answer-text", "1"])
        .await?;
    ws.file("other.py", "print(2)")?;
    ws.ok(&["problem", "create", "other.py"]).await?;
    let other = ws
        .ok(&["tc", "add", "other.py", "--answer-text", "2"])
        .await?;
    let run = ws.ok(&["r", "space name.py"]).await?;
    let database = std::fs::read(ws.store.join("index.sqlite3"))?;
    let by_source = complete(&ws, &["cph-ng-judge", "tc", "r", "space name.py", "-t", ""]).await?;
    assert!(by_source.contains(id(&first)?), "{by_source}");
    assert!(by_source.contains("Testcase 1 · First"));
    assert!(by_source.contains(id(&second)?));
    assert!(!by_source.contains(id(&other)?));
    for key in ["--problem-id", "--code-id"] {
        let output = complete(
            &ws,
            &["cph-ng-judge", "r", key, id(&problem)?, "--testcase-id", ""],
        )
        .await?;
        assert!(output.contains(id(&first)?), "{key}: {output}");
    }
    let prefix = id(&first)?.get(..8).context("UUID prefix")?;
    let equal = format!("--testcase-id={prefix}");
    let output = complete(&ws, &["cph-ng-judge", "r", "space name.py", &equal]).await?;
    assert!(output.contains(id(&first)?), "{output}");
    assert!(!output.contains(id(&second)?));
    let comma = format!("{},", id(&first)?);
    let output = complete(&ws, &["cph-ng-judge", "r", "space name.py", "-t", &comma]).await?;
    assert!(output.contains(id(&second)?), "{output}");
    assert!(!output.contains(&format!("{0},{0}", id(&first)?)));
    let repeated = complete(
        &ws,
        &[
            "cph-ng-judge",
            "r",
            "space name.py",
            "-t",
            id(&first)?,
            "-t",
            "",
        ],
    )
    .await?;
    assert!(!repeated.contains(id(&first)?));
    assert!(repeated.contains(id(&second)?));
    for args in [
        vec!["cph-ng-judge", "task", "get", ""],
        vec!["cph-ng-judge", "history", "load", ""],
    ] {
        assert!(complete(&ws, &args).await?.contains(task_id(&run)?));
    }
    let explicit_store = format!("--store-root={}", ws.store.display());
    assert!(
        complete(
            &ws,
            &[
                "cph-ng-judge",
                &explicit_store,
                "r",
                "space name.py",
                "-t",
                ""
            ]
        )
        .await?
        .contains(id(&first)?)
    );
    assert_eq!(std::fs::read(ws.store.join("index.sqlite3"))?, database);
    Ok(())
}

#[tokio::test]
async fn fish_keeps_commands_aliases_files_flags_and_enum_completion() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    ws.file("main.py", "print(1)")?;
    let output = ws.raw(&["completions", "fish"]).await?;
    let script = ws.file("completion file.fish", &String::from_utf8(output.stdout)?)?;
    if tokio::process::Command::new("fish")
        .arg("--version")
        .output()
        .await
        .is_err()
    {
        return Ok(());
    }
    for (command, expected) in [
        ("cph-ng-judge ", "tc"),
        ("cph-ng-judge ", "r"),
        ("cph-ng-judge tc ", "reorder"),
        ("cph-ng-judge export main.py --export-format ", "native"),
        ("cph-ng-judge r ma", "main.py"),
        ("cph-ng-judge r main.py --answer-", "--answer-file"),
        ("cph-ng-judge config --scope ", "router"),
    ] {
        let output = tokio::process::Command::new("fish")
            .args([
                "--no-config",
                "-c",
                "source $argv[1]; complete -C $argv[2]",
                "--",
            ])
            .arg(&script)
            .arg(command)
            .current_dir(ws.dir.path())
            .env("CPH_STORE_ROOT", &ws.store)
            .output()
            .await?;
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let result = String::from_utf8(output.stdout)?;
        assert!(
            result
                .lines()
                .any(|line| line.split('\t').next() == Some(expected)),
            "{command}: {result}"
        );
    }
    assert!(!ws.store.exists());
    Ok(())
}

#[tokio::test]
async fn completion_silently_handles_busy_and_invalid_stores() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    ws.file("main.py", "print(1)")?;
    let problem = ws.ok(&["problem", "create", "main.py"]).await?;
    let lock = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(ws.store.join("server.lock"))?;
    lock.try_lock()?;
    assert!(
        complete(&ws, &["cph-ng-judge", "r", "--problem-id", ""])
            .await?
            .contains(id(&problem)?)
    );
    drop(lock);
    // A separate store has no surviving WAL that could restore a valid database.
    let ws = Workspace::new()?;
    std::fs::create_dir_all(&ws.store)?;
    std::fs::write(ws.store.join("index.sqlite3"), "invalid sqlite")?;
    assert!(
        complete(&ws, &["cph-ng-judge", "r", "--problem-id", ""])
            .await?
            .is_empty()
    );
    assert!(
        complete(&ws, &["cph-ng-judge", "tc", ""])
            .await?
            .contains("reorder")
    );
    assert_eq!(
        std::fs::read_to_string(ws.store.join("index.sqlite3"))?,
        "invalid sqlite"
    );
    Ok(())
}
