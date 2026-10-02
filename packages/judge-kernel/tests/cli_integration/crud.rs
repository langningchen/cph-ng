use super::{JsonExt, Workspace, id, task_id};
use anyhow::Context;

use serde_json::{Value, json};

#[tokio::test]
async fn problem_testcase_crud_and_stable_moves() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    let problem = ws
        .ok(&[
            "problem",
            "create",
            "sum.py",
            "--source-code",
            "print(sum(map(int,input().split())))\n",
            "--name",
            "Sum",
            "--url",
            "https://example.com",
        ])
        .await?;
    let pid = id(&problem)?;
    assert_eq!(
        (ws.ok(&["index", "resolve", "sum.py"]).await?).required("/problem_id")?,
        pid
    );
    let (first, selected) = exercise_testcases(&ws, pid).await?;
    exercise_moves(&ws, pid, &first).await?;
    ws.ok(&["problem", "delete", "--problem-id", pid]).await?;
    assert_eq!(ws.ok(&["problem", "list"]).await?, json!([]));
    assert_eq!(
        (ws.ok(&["history", "load", task_id(&selected)?]).await?).required("/result/verdict")?,
        "accepted"
    );

    Ok(())
}

async fn exercise_testcases(ws: &Workspace, pid: &str) -> anyhow::Result<(Value, Value)> {
    let first = ws
        .ok(&[
            "testcase",
            "add",
            "--problem-id",
            pid,
            "--stdin",
            "1 2",
            "--answer",
            "3",
        ])
        .await?;
    let second = ws
        .ok(&[
            "testcase", "add", "sum.py", "--stdin", "3 4", "--answer", "7",
        ])
        .await?;
    let updated = ws
        .ok(&[
            "testcase",
            "update",
            "sum.py",
            "--testcase-id",
            id(&second)?,
            "--answer",
            "8",
        ])
        .await?;
    assert_eq!(updated.required("/stdin")?, "3 4");
    let order = format!("{},{}", id(&second)?, id(&first)?);
    assert_eq!(
        (ws.ok(&["testcase", "reorder", "sum.py", "--testcase-id", &order])
            .await?)
            .required("/0/id")?,
        second.required("/id")?
    );
    let selected = ws
        .ok(&["testcase", "run", "sum.py", "--testcase-id", id(&first)?])
        .await?;
    assert_eq!(selected.required("/result/verdict")?, "accepted");
    assert_eq!(
        selected
            .required("/result/testcases")?
            .as_array()
            .context("test fixture or response")?
            .len(),
        1
    );
    assert_eq!(
        (ws.json(&["testcase", "run-all", "sum.py"], 1).await?).required("/result/verdict")?,
        "wrong_answer"
    );
    ws.ok(&[
        "testcase",
        "delete",
        "sum.py",
        "--testcase-id",
        id(&second)?,
    ])
    .await?;
    Ok((first, selected))
}

async fn exercise_moves(ws: &Workspace, pid: &str, first: &Value) -> anyhow::Result<()> {
    let update = ws
        .ok(&[
            "problem",
            "update",
            "sum.py",
            "--name",
            "Renamed",
            "--time-limit-ms",
            "2000",
            "--memory-limit-mb",
            "192",
            "--clear-url",
        ])
        .await?;
    assert_eq!(update.required("/name")?, "Renamed");
    assert!(update.required("/url")?.is_null());
    ws.file("occupied.py", "print('do not replace')")?;
    ws.json(
        &["problem", "move", "sum.py", "--destination", "occupied.py"],
        2,
    )
    .await?;
    assert_eq!(
        std::fs::read_to_string(ws.dir.path().join("occupied.py"))
            .context("test fixture or response")?,
        "print('do not replace')"
    );
    let moved = ws
        .ok(&["problem", "move", "sum.py", "--destination", "moved.py"])
        .await?;
    assert_eq!(moved.required("/id")?, pid);
    assert!(!ws.dir.path().join("sum.py").exists());
    assert_eq!(
        (ws.ok(&["problem", "load", "moved.py"]).await?).required("/testcases/0/id")?,
        first.required("/id")?
    );
    std::fs::rename(
        ws.dir.path().join("moved.py"),
        ws.dir.path().join("external.py"),
    )
    .context("test fixture or response")?;
    ws.ok(&[
        "problem",
        "move",
        "--problem-id",
        pid,
        "--destination",
        "external.py",
        "--rebind-only",
    ])
    .await?;
    ws.ok(&["index", "rebuild", "external.py", "--problem-id", pid])
        .await?;
    ws.ok(&["index", "reindex", "external.py", "--problem-id", pid])
        .await?;
    assert_eq!(
        (ws.ok(&["index", "rebuild"]).await?).required("/result/rebuilt")?,
        1
    );
    std::fs::remove_file(ws.dir.path().join("external.py")).context("test fixture or response")?;
    assert_eq!(
        (ws.json(&["index", "rebuild"], 1).await?)
            .required("/result/failures")?
            .as_array()
            .context("test fixture or response")?
            .len(),
        1
    );
    Ok(())
}
