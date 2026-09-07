use super::{JsonExt, Workspace, task_id};
use anyhow::Context;
use cph_ng_judge::application::error::ErrorCode;
use std::process::Stdio;

use serde_json::json;
use tokio::io::AsyncWriteExt;

#[tokio::test]
async fn stdin_piping_and_argument_validation() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    ws.file(
        "echo.py",
        "import sys\nsys.stdout.buffer.write((input()+'\\n').encode())\n",
    )?;
    let mut child = ws
        .command(&[
            "run",
            "echo.py",
            "--input",
            "-",
            "--answer",
            "hello\n",
            "--checker-mode",
            "exact",
            "--json",
        ])
        .stdin(Stdio::piped())
        .spawn()
        .context("test fixture or response")?;
    child
        .stdin
        .take()
        .context("test fixture or response")?
        .write_all(b"hello\n")
        .await
        .context("test fixture or response")?;
    let output = child
        .wait_with_output()
        .await
        .context("test fixture or response")?;
    assert_eq!(
        output.status.code(),
        Some(0),
        "stdout: {}\nstderr: {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    ws.json(&["run", "echo.py", "--input", "-", "--answer-file", "-"], 2)
        .await?;
    ws.json(
        &[
            "run",
            "echo.py",
            "--stdin",
            "1",
            "--answer",
            "1",
            "--tolerance",
            "NaN",
        ],
        2,
    )
    .await?;
    ws.json(
        &[
            "run",
            "echo.py",
            "--stdin",
            "1",
            "--answer",
            "1",
            "--strict-stderr",
        ],
        2,
    )
    .await?;
    Ok(())
}

#[tokio::test]
async fn comparison_options_are_applied() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    ws.file("echo.py", "print(input())\n")?;
    assert_eq!(
        (ws.json(
            &[
                "run",
                "echo.py",
                "--stdin",
                "one two",
                "--answer",
                "onetwo",
                "--checker-mode",
                "legacy"
            ],
            1
        )
        .await?)
            .required("/result/verdict")?,
        "presentation_error"
    );
    ws.ok(&[
        "run",
        "echo.py",
        "--stdin",
        "one two",
        "--answer",
        "onetwo",
        "--checker-mode",
        "legacy",
        "--regard-pe-as-ac",
    ])
    .await?;
    ws.ok(&[
        "run",
        "echo.py",
        "--stdin",
        "1.00001",
        "--answer",
        "1",
        "--checker-mode",
        "float",
        "--tolerance",
        "0.001",
    ])
    .await?;
    Ok(())
}

#[tokio::test]
async fn judging_failures_have_distinct_exit_codes() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    ws.file("bad.py", "this is not valid python !!!\n")?;
    let failed = ws.json(&["run", "bad.py", "--stdin", ""], 3).await?;
    assert_eq!(
        failed.required("/error/code")?,
        &json!(ErrorCode::CompilationFailed)
    );
    assert!(!failed.text("/error/data/stderr")?.is_empty());
    assert_eq!(
        (ws.ok(&["task", "get", task_id(&failed)?]).await?).required("/state")?,
        "failed"
    );
    ws.json(&["task", "wait", task_id(&failed)?], 3).await?;
    ws.file("slow.py", "import time\ntime.sleep(30)\n")?;
    assert_eq!(
        (ws.json(
            &["run", "slow.py", "--stdin", "", "--time-limit-ms", "100"],
            1
        )
        .await?)
            .required("/result/verdict")?,
        "time_limit_exceeded"
    );
    assert_eq!(
        (ws.json(
            &[
                "run",
                "slow.py",
                "--stdin",
                "",
                "--task-timeout-ms",
                "100",
                "--time-limit-ms",
                "30000"
            ],
            4
        )
        .await?)
            .required("/state")?,
        "failed"
    );
    ws.file("loud.py", "print('x'*100000)\n")?;
    assert_eq!(
        (ws.json(
            &[
                "run",
                "loud.py",
                "--stdin",
                "",
                "--output-limit-bytes",
                "32"
            ],
            1
        )
        .await?)
            .required("/result/verdict")?,
        "output_limit_exceeded"
    );
    let invalid = ws
        .raw(&["run", "--problem-id", "invalid", "--json"])
        .await?;
    assert_eq!(invalid.status.code(), Some(2));

    Ok(())
}
