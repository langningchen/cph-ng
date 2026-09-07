use super::{Client, JsonExt};
use anyhow::Context;
use cph_ng_judge::application::{error::ErrorCode, method::Method};
use std::process::Stdio;
#[cfg(target_os = "linux")]
use std::time::Duration;

use serde_json::{Value, json};
use tempfile::TempDir;
use tokio::process::Command;

#[tokio::test]
async fn cancellation_limits_and_final_shutdown_events() -> anyhow::Result<()> {
    let root = TempDir::new().context("test fixture or response")?;
    let mut client = Client::start(root.path(), &["--workers", "1"]).await?;
    let (problem, _) = client
        .problem(root.path(), "loop.py", "while True: pass\n", "", "")
        .await?;
    client
        .ok(
            Method::ProblemUpdate,
            json!({"problem_id": problem, "time_limit_ms": 100}),
        )
        .await?;
    let task = client
        .ok(Method::JudgeRun, json!({"problem_id": problem}))
        .await?;
    assert_eq!(
        (client.finished(task.text("/task_id")?).await?).required("/result/verdict")?,
        "time_limit_exceeded"
    );
    client
        .ok(
            Method::ProblemUpdate,
            json!({"problem_id": problem, "time_limit_ms": 10000}),
        )
        .await?;
    let task = client
        .ok(Method::JudgeRun, json!({"problem_id": problem}))
        .await?;
    let queued = client
        .ok(Method::JudgeRun, json!({"problem_id": problem}))
        .await?;
    assert_eq!(
        (client.ok(Method::SystemPing, json!({})).await?).required("/ok")?,
        true
    );
    client
        .ok(
            Method::JudgeCancel,
            json!({"task_id": task.required("/task_id")?}),
        )
        .await?;
    assert_eq!(
        (client.finished(task.text("/task_id")?).await?).required("/state")?,
        "canceled"
    );
    client
        .ok(
            Method::TaskCancel,
            json!({"task_id": queued.required("/task_id")?}),
        )
        .await?;
    assert_eq!(
        (client.finished(queued.text("/task_id")?).await?).required("/state")?,
        "canceled"
    );
    let (output_problem, _) = client
        .problem(
            root.path(),
            "output.py",
            "while True: print('x'*10000)\n",
            "",
            "",
        )
        .await?;
    let task = client
        .ok(
            Method::JudgeRun,
            json!({"problem_id": output_problem, "output_limit_bytes": 1024}),
        )
        .await?;
    assert_eq!(
        (client.finished(task.text("/task_id")?).await?).required("/result/verdict")?,
        "output_limit_exceeded"
    );
    let active = client
        .ok(Method::JudgeRun, json!({"problem_id": problem}))
        .await?;
    client.shutdown().await?;
    let mut client = Client::start(root.path(), &[]).await?;
    assert_eq!(
        (client
            .ok(
                Method::TaskGet,
                json ! ({ "task_id" : active.required("/task_id")? })
            )
            .await?)
            .required("/state")?,
        "canceled"
    );
    assert_eq!(
        (client
            .ok(
                Method::HistoryLoad,
                json ! ({ "run_id" : active.required("/task_id")? })
            )
            .await?)
            .required("/state")?,
        "canceled"
    );
    client.shutdown().await?;

    Ok(())
}

#[cfg(target_os = "linux")]
#[tokio::test]
async fn memory_limit_and_descendant_cancellation_are_enforced() -> anyhow::Result<()> {
    let root = TempDir::new().context("test fixture or response")?;
    let mut client = Client::start(root.path(), &[]).await?;
    let (problem, _) = client
        .problem(
            root.path(),
            "memory.py",
            "import time\na=bytearray(96*1024*1024)\ntime.sleep(10)\n",
            "",
            "",
        )
        .await?;
    client
        .ok(
            Method::ProblemUpdate,
            json!({"problem_id":problem,"memory_limit_mb":32}),
        )
        .await?;
    let task = client
        .ok(Method::JudgeRun, json!({"problem_id":problem}))
        .await?;
    assert_eq!(
        (client.finished(task.text("/task_id")?).await?).required("/result/verdict")?,
        "memory_limit_exceeded"
    );
    let pidfile = root.path().join("child.pid");
    let code = format!(
        "import subprocess,time\np=subprocess.Popen(['python3','-c','import time;time.sleep(60)'])\nopen({:?},'w').write(str(p.pid))\ntime.sleep(60)\n",
        pidfile.to_string_lossy()
    );
    let (problem, _) = client
        .problem(root.path(), "children.py", &code, "", "")
        .await?;
    client
        .ok(
            Method::ProblemUpdate,
            json!({"problem_id":problem,"time_limit_ms":30000}),
        )
        .await?;
    let task = client
        .ok(Method::JudgeRun, json!({"problem_id":problem}))
        .await?;
    let child = tokio::time::timeout(Duration::from_secs(5), async {
        loop {
            if let Ok(pid) = tokio::fs::read_to_string(&pidfile).await
                && let Ok(pid) = pid.parse::<u32>()
            {
                return Ok::<_, anyhow::Error>(pid);
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .context("test fixture or response")??;
    client
        .ok(
            Method::TaskCancel,
            json!({"task_id":task.required("/task_id")?}),
        )
        .await?;
    assert_eq!(
        (client.finished(task.text("/task_id")?).await?).required("/state")?,
        "canceled"
    );
    tokio::time::timeout(Duration::from_secs(5), async {
        loop {
            let status = tokio::fs::read_to_string(format!("/proc/{child}/stat")).await;
            if status.as_ref().is_err()
                || status.is_ok_and(|value| {
                    value
                        .rsplit_once(") ")
                        .is_some_and(|(_, fields)| fields.starts_with('Z'))
                })
            {
                break;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .context("test fixture or response")?;
    client.shutdown().await?;

    Ok(())
}

#[tokio::test]
async fn standalone_cli_observes_and_cancels_resident_tasks() -> anyhow::Result<()> {
    let root = TempDir::new().context("test fixture or response")?;
    let mut client = Client::start(root.path(), &[]).await?;
    let (problem, _) = client
        .problem(
            root.path(),
            "slow.py",
            "import time\ntime.sleep(60)\n",
            "",
            "",
        )
        .await?;
    let task = client
        .ok(
            Method::JudgeRun,
            json!({"problem_id":problem, "time_limit_ms":60000}),
        )
        .await?;
    let tid = task.text("/task_id")?;
    let cli = |args: Vec<String>| {
        let mut command = Command::new(env!("CARGO_BIN_EXE_cph-ng-judge"));
        command
            .arg("--store-root")
            .arg(root.path())
            .arg("--json")
            .args(args)
            .stdin(Stdio::null());
        command
    };
    let inspection = cli(vec!["task".into(), "get".into(), tid.into()])
        .output()
        .await
        .context("test fixture or response")?;
    assert!(
        inspection.status.success(),
        "{}",
        String::from_utf8_lossy(&inspection.stderr)
    );
    let inspection: Value =
        serde_json::from_slice(&inspection.stdout).context("test fixture or response")?;
    assert!(matches!(
        inspection.required("/state")?.as_str(),
        Some("queued" | "running")
    ));
    let denied = cli(vec![
        "judge".into(),
        "run".into(),
        "--problem-id".into(),
        problem,
    ])
    .output()
    .await
    .context("test fixture or response")?;
    assert_eq!(denied.status.code(), Some(2));
    assert_eq!(
        (serde_json::from_slice::<Value>(&denied.stdout).context("test fixture or response")?)
            .required("/error/code")?,
        &json!(ErrorCode::Busy)
    );
    let cancel = cli(vec![
        "task".into(),
        "cancel".into(),
        tid.into(),
        "--wait".into(),
    ])
    .output()
    .await
    .context("test fixture or response")?;
    assert!(
        cancel.status.success(),
        "{}",
        String::from_utf8_lossy(&cancel.stderr)
    );
    assert_eq!(
        (serde_json::from_slice::<Value>(&cancel.stdout).context("test fixture or response")?)
            .required("/state")?,
        "canceled"
    );
    assert_eq!(
        (client.finished(tid).await?).required("/state")?,
        "canceled"
    );
    let events = client
        .ok(Method::TaskEventsSince, json!({"task_id":tid}))
        .await?;
    assert_eq!(
        events
            .as_array()
            .context("test fixture or response")?
            .iter()
            .filter(|event| event.get("kind").and_then(Value::as_str) == Some("finished"))
            .count(),
        1
    );
    client.shutdown().await?;

    Ok(())
}
