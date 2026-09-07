use super::{JsonExt, Workspace, id, task_id};
use serde_json::json;

#[tokio::test]
async fn inline_differences_and_diff_use_the_original_answer_snapshot() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    ws.file("answer.py", "print('1.0001 wrong')\n")?;
    ws.ok(&["problem", "create", "answer.py"]).await?;
    let case = ws
        .ok(&[
            "testcase",
            "add",
            "answer.py",
            "--stdin",
            "",
            "--answer",
            "1 right\n",
        ])
        .await?;
    let result = ws
        .json(
            &[
                "run",
                "answer.py",
                "--checker-mode",
                "float",
                "--tolerance",
                "0.001",
            ],
            1,
        )
        .await?;
    assert_eq!(
        result.text("/result/testcases/0/comparison")?,
        "Token 2: output \"wrong\", answer \"right\""
    );
    ws.ok(&[
        "testcase",
        "update",
        "answer.py",
        "--testcase-id",
        id(&case)?,
        "--answer",
        "changed",
    ])
    .await?;
    let diff = ws.ok(&["diff", task_id(&result)?]).await?;
    assert_eq!(diff.text("/answer")?, "1 right\n");
    assert_eq!(diff.text("/stdout")?, "1.0001 wrong\n");
    assert!(
        diff.text("/comparison_diff")?
            .contains("-1 right\n+1.0001 wrong")
    );
    let human = ws
        .raw(&["diff", task_id(&result)?, "--case", "1", "-C", "0"])
        .await?;
    assert!(human.status.success() && human.stderr.is_empty());
    assert!(!human.stdout.contains(&27));
    assert!(String::from_utf8_lossy(&human.stdout).contains("Answer (-), Output (+)"));
    ws.json(&["diff", task_id(&result)?, "--case", "2"], 2)
        .await?;
    ws.json(&["diff", task_id(&result)?, "--case", "0"], 2)
        .await?;
    // Historical/ad-hoc answers remain usable after deleting the mutable problem.
    ws.ok(&["problem", "delete", "answer.py"]).await?;
    assert_eq!(
        ws.ok(&["diff", task_id(&result)?])
            .await?
            .required("/answer")?,
        "1 right\n"
    );
    Ok(())
}

#[tokio::test]
async fn diff_handles_temporary_input_missing_snapshots_and_long_inline_output()
-> anyhow::Result<()> {
    let mut ws = Workspace::new()?;
    ws.store = ws.dir.path().join("store 'quoted'");
    ws.file("echo.py", "print(input())")?;
    let result = ws
        .json(
            &[
                "run", "echo.py", "--stdin", "actual", "--answer", "expected",
            ],
            1,
        )
        .await?;
    let run = task_id(&result)?;
    assert_eq!(ws.ok(&["testcase", "list", "echo.py"]).await?, json!([]));
    assert_eq!(ws.ok(&["diff", run]).await?.text("/answer")?, "expected");
    std::fs::remove_file(ws.store.join("runs").join(run).join("cases/1/answer.txt"))?;
    let missing = ws.json(&["diff", run], 2).await?;
    assert!(
        missing
            .text("/error/message")?
            .contains("snapshot is unavailable")
    );
    let long = "a".repeat(200);
    let human = ws
        .raw(&["run", "echo.py", "--stdin", &long, "--answer", "other"])
        .await?;
    assert_eq!(human.status.code(), Some(1));
    let text = String::from_utf8(human.stdout)?;
    assert!(
        text.contains("...")
            && text.contains("Compare: cph-ng-judge --store-root")
            && text.contains(" diff ")
    );
    assert!(!text.contains(&long));
    #[cfg(unix)]
    {
        use anyhow::Context;
        let hint = text
            .lines()
            .find_map(|line| line.strip_prefix("Compare: cph-ng-judge"))
            .context("copyable comparison command")?;
        let command = format!("'{}'{hint}", env!("CARGO_BIN_EXE_cph-ng-judge"));
        let compared = tokio::process::Command::new("sh")
            .args(["-c", &command])
            .output()
            .await?;
        assert!(
            compared.status.success(),
            "{}",
            String::from_utf8_lossy(&compared.stderr)
        );
        assert!(String::from_utf8_lossy(&compared.stdout).contains("-other"));
    }
    Ok(())
}
