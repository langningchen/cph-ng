use super::{JsonExt, Workspace};
use anyhow::Context;
use cph_ng_judge::application::error::ErrorCode;
#[cfg(unix)]
use std::process::Stdio;
use std::time::Duration;

use serde_json::{Value, json};
use tokio::{
    io::{AsyncBufReadExt, BufReader},
    process::Child,
};

async fn start_slow(
    ws: &Workspace,
) -> anyhow::Result<(
    Child,
    tokio::io::Lines<BufReader<tokio::process::ChildStdout>>,
    String,
)> {
    ws.file("slow.py", "import time\ntime.sleep(60)\n")?;
    let mut child = ws
        .command(&[
            "run",
            "slow.py",
            "--stdin",
            "",
            "--time-limit-ms",
            "60000",
            "--output",
            "jsonl",
        ])
        .spawn()
        .context("test fixture or response")?;
    let mut lines =
        BufReader::new(child.stdout.take().context("test fixture or response")?).lines();
    let id = tokio::time::timeout(Duration::from_secs(10), async {
        loop {
            let line = lines
                .next_line()
                .await
                .context("test fixture or response")?
                .context("judge exited before starting")?;
            let value: Value = serde_json::from_str(&line).context("test fixture or response")?;
            if value.pointer("/event/result/phase").and_then(Value::as_str) == Some("running") {
                return Ok::<_, anyhow::Error>(value.text("/event/task_id")?.to_owned());
            }
        }
    })
    .await
    .context("test fixture or response")??;
    Ok((child, lines, id))
}

#[tokio::test]
async fn observers_can_query_replay_wait_and_cancel_another_cli_without_recovery()
-> anyhow::Result<()> {
    let ws = Workspace::new()?;
    let (mut child, mut output, tid) = start_slow(&ws).await?;
    assert_eq!(
        (ws.ok(&["task", "get", &tid]).await?).required("/state")?,
        "running"
    );
    assert_eq!(
        (ws.ok(&["task", "list"]).await?).required("/0/task_id")?,
        tid.as_str()
    );
    assert_eq!(
        (ws.json(&["task", "wait", &tid, "--wait-timeout-ms", "20"], 4)
            .await?)
            .required("/error/code")?,
        &json!(ErrorCode::ExecutionFailed)
    );
    assert_eq!(
        (ws.ok(&["task", "get", &tid]).await?).required("/state")?,
        "running"
    );
    assert_eq!(
        (ws.json(&["problem", "create", "slow.py"], 2).await?).required("/error/code")?,
        &json!(ErrorCode::Busy)
    );
    assert!(
        ws.ok(&["task", "events", "--task-id", &tid])
            .await?
            .as_array()
            .context("test fixture or response")?
            .iter()
            .all(|event| event.get("kind").and_then(Value::as_str) != Some("finished"))
    );
    std::fs::write(ws.store.join("config.toml"), "broken TOML !")
        .context("test fixture or response")?;
    // Observer commands do not need to load compilation settings.
    assert_eq!(
        ws.ok(&["problem", "list"])
            .await?
            .as_array()
            .context("test fixture or response")?
            .len(),
        1
    );
    let canceled = ws.ok(&["judge", "cancel", &tid, "--wait"]).await?;
    assert_eq!(canceled.required("/state")?, "canceled");
    let status = tokio::time::timeout(Duration::from_secs(10), child.wait())
        .await
        .context("test fixture or response")?
        .context("test fixture or response")?;
    assert_eq!(status.code(), Some(130));
    let mut final_count = 0;
    while let Some(line) = output
        .next_line()
        .await
        .context("test fixture or response")?
    {
        let value: Value = serde_json::from_str(&line).context("test fixture or response")?;
        if value.required("/type")? == "result" {
            assert_eq!(value.required("/result/state")?, "canceled");
            final_count += 1;
        }
    }
    assert_eq!(final_count, 1);
    assert_eq!(
        (ws.ok(&["history", "load", &tid]).await?).required("/state")?,
        "canceled"
    );
    assert_eq!(ws.ok(&["task", "list"]).await?, json!([]));
    std::fs::remove_file(ws.store.join("config.toml")).context("test fixture or response")?;
    assert_eq!(
        (ws.ok(&["task", "create"]).await?).required("/state")?,
        "succeeded"
    );

    Ok(())
}

#[cfg(unix)]
#[tokio::test]
async fn signals_cancel_owned_tasks_but_leave_observed_tasks_running() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    let (mut owner, mut output, tid) = start_slow(&ws).await?;
    let observer = ws
        .command(&["task", "wait", &tid, "--json"])
        .spawn()
        .context("test fixture or response")?;
    #[cfg(target_os = "linux")]
    wait_for_sigint_handler(observer.id().context("observer PID")?).await?;
    #[cfg(not(target_os = "linux"))]
    tokio::time::sleep(Duration::from_millis(250)).await;
    rustix::process::kill_process(
        rustix::process::Pid::from_raw(
            i32::try_from(observer.id().context("test fixture or response")?)
                .context("test fixture or response")?,
        )
        .context("test fixture or response")?,
        rustix::process::Signal::INT,
    )
    .context("test fixture or response")?;
    let observer_output =
        tokio::time::timeout(Duration::from_secs(10), observer.wait_with_output())
            .await
            .context("test fixture or response")?
            .context("test fixture or response")?;
    assert_eq!(observer_output.status.code(), Some(130));
    assert_eq!(
        (ws.ok(&["task", "get", &tid]).await?).required("/state")?,
        "running"
    );
    rustix::process::kill_process(
        rustix::process::Pid::from_raw(
            i32::try_from(owner.id().context("test fixture or response")?)
                .context("test fixture or response")?,
        )
        .context("test fixture or response")?,
        rustix::process::Signal::TERM,
    )
    .context("test fixture or response")?;
    assert_eq!(
        tokio::time::timeout(Duration::from_secs(10), owner.wait())
            .await
            .context("test fixture or response")?
            .context("test fixture or response")?
            .code(),
        Some(130)
    );
    let mut finished = 0;
    while let Some(line) = output
        .next_line()
        .await
        .context("test fixture or response")?
    {
        let event: Value = serde_json::from_str(&line).context("test fixture or response")?;
        if event.pointer("/event/kind").and_then(Value::as_str) == Some("finished") {
            finished += 1;
            assert_eq!(event.required("/event/state")?, "canceled");
        }
    }
    assert_eq!(
        finished, 1,
        "signal cancellation must flush the final JSONL event"
    );
    assert_eq!(
        (ws.ok(&["history", "load", &tid]).await?).required("/state")?,
        "canceled"
    );
    let events = ws.ok(&["task", "events", "--task-id", &tid]).await?;
    assert_eq!(
        events
            .as_array()
            .context("test fixture or response")?
            .iter()
            .filter(|event| event.get("kind").and_then(Value::as_str) == Some("finished"))
            .count(),
        1
    );

    Ok(())
}

#[cfg(unix)]
#[tokio::test]
async fn ctrl_c_interrupts_piped_input_before_admission() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    ws.file("input.py", "print(input())\n")?;
    let mut child = ws
        .command(&["run", "input.py", "--input", "-", "--json"])
        .stdin(Stdio::piped())
        .spawn()
        .context("test fixture or response")?;
    let _stdin = child.stdin.take().context("test fixture or response")?;
    #[cfg(target_os = "linux")]
    wait_for_sigint_handler(child.id().context("child PID")?).await?;
    #[cfg(not(target_os = "linux"))]
    tokio::time::sleep(Duration::from_millis(250)).await;
    rustix::process::kill_process(
        rustix::process::Pid::from_raw(
            i32::try_from(child.id().context("test fixture or response")?)
                .context("test fixture or response")?,
        )
        .context("test fixture or response")?,
        rustix::process::Signal::INT,
    )
    .context("test fixture or response")?;
    let output = tokio::time::timeout(Duration::from_secs(10), child.wait_with_output())
        .await
        .context("test fixture or response")?
        .context("test fixture or response")?;
    assert_eq!(output.status.code(), Some(130));
    assert_eq!(
        (serde_json::from_slice::<Value>(&output.stdout).context("test fixture or response")?)
            .required("/error/code")?,
        &json!(ErrorCode::TaskState)
    );
    assert_eq!(ws.ok(&["task", "list"]).await?, json!([]));
    assert_eq!(ws.ok(&["problem", "list"]).await?, json!([]));

    Ok(())
}

#[cfg(unix)]
#[tokio::test]
async fn suspended_owner_reports_pending_cancellation_and_releases_lock_after_resume()
-> anyhow::Result<()> {
    use rustix::process::{Pid, Signal, kill_process};
    let ws = Workspace::new()?;
    let (mut owner, _lines, tid) = start_slow(&ws).await?;
    let pid = Pid::from_raw(i32::try_from(owner.id().context("owner pid")?)?).context("pid")?;
    kill_process(pid, Signal::STOP)?;
    // STOP is uncatchable; the owner cannot process the request until resumed.
    tokio::time::sleep(Duration::from_millis(100)).await;
    let canceled = ws.raw(&["task", "cancel", &tid]).await?;
    assert!(canceled.status.success());
    let text = String::from_utf8_lossy(&canceled.stdout);
    assert!(text.contains("Cancellation requested"), "{text}");
    assert!(text.contains("fg"), "{text}");
    assert_eq!(
        ws.ok(&["task", "get", &tid]).await?.required("/state")?,
        "running"
    );
    ws.json(&["task", "create"], 2).await?;
    kill_process(pid, Signal::CONT)?;
    assert_eq!(
        tokio::time::timeout(Duration::from_secs(10), owner.wait())
            .await??
            .code(),
        Some(130)
    );
    assert_eq!(
        ws.ok(&["task", "get", &tid]).await?.required("/state")?,
        "canceled"
    );
    assert_eq!(
        ws.ok(&["task", "create"]).await?.required("/state")?,
        "succeeded"
    );
    Ok(())
}

#[cfg(target_os = "linux")]
async fn wait_for_sigint_handler(pid: u32) -> anyhow::Result<()> {
    // SIGINT is signal 2: wait for its caught bit instead of assuming startup
    // finishes within a fixed delay on a loaded CI runner.
    tokio::time::timeout(Duration::from_secs(10), async {
        loop {
            let status = tokio::fs::read_to_string(format!("/proc/{pid}/status")).await?;
            let caught = status
                .lines()
                .find_map(|line| line.strip_prefix("SigCgt:"))
                .context("caught signal mask")?;
            let mask = u64::from_str_radix(caught.trim(), 16)?;
            if mask & 2 != 0 {
                return Ok::<_, anyhow::Error>(());
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .context("SIGINT handler did not become ready")??;
    Ok(())
}
