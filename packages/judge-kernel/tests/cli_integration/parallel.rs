use super::{JsonExt, Workspace, id, task_id};
use anyhow::Context;
use serde_json::Value;

#[tokio::test]
async fn parallel_cases_are_bounded_isolated_and_returned_in_source_order() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    let trace = ws.dir.path().join("trace");
    std::fs::create_dir(&trace)?;
    let trace_path = serde_json::to_string(&trace)?;
    ws.file(
        "parallel.py",
        &format!(
            r"
import json, pathlib, time
n = int(input())
start = time.monotonic_ns()
with open('local.txt', 'x') as local: local.write(str(n))
time.sleep(0.5 if n == 1 else 0.1)
print(n)
end = time.monotonic_ns()
(pathlib.Path({trace_path}) / str(n)).write_text(json.dumps([start, end]))
"
        ),
    )?;
    ws.ok(&[
        "problem",
        "create",
        "parallel.py",
        "--time-limit-ms",
        "5000",
    ])
    .await?;
    let mut ids = Vec::new();
    for index in 1..=4 {
        let value = index.to_string();
        let case = ws
            .ok(&[
                "testcase",
                "add",
                "parallel.py",
                "--stdin",
                &value,
                "--answer",
                &value,
            ])
            .await?;
        ids.push(id(&case)?.to_owned());
    }
    let result = ws.ok(&["run", "parallel.py", "--jobs", "256"]).await?;
    let jobs = result.required("/result/jobs")?.as_u64().context("jobs")?;
    let cap = (std::thread::available_parallelism()?.get() / 2).clamp(1, 4);
    assert_eq!(jobs, u64::try_from(cap)?);
    let cases = result
        .required("/result/testcases")?
        .as_array()
        .context("cases")?;
    for (case, id) in cases.iter().zip(&ids) {
        assert_eq!(case.text("/testcase_id")?, id);
        assert_eq!(case.text("/verdict")?, "accepted");
    }
    assert_concurrency(&trace, cap)?;
    let events = ws
        .ok(&["task", "events", "--task-id", task_id(&result)?])
        .await?;
    let finished: Vec<_> = events
        .as_array()
        .context("events")?
        .iter()
        .filter(|event| {
            event.pointer("/result/phase").and_then(Value::as_str) == Some("testcase_finished")
        })
        .map(|event| {
            event
                .pointer("/result/case_index")
                .and_then(Value::as_u64)
                .unwrap_or(0)
        })
        .collect();
    assert_eq!(finished.len(), 4);
    if cap > 1 {
        assert_ne!(finished.first(), Some(&1));
    }
    let serial = ws.ok(&["run", "parallel.py", "--jobs", "1"]).await?;
    assert_eq!(serial.required("/result/jobs")?, 1);
    for value in ["0", "257"] {
        ws.json(&["run", "parallel.py", "--jobs", value], 2).await?;
    }
    Ok(())
}

fn assert_concurrency(trace: &std::path::Path, cap: usize) -> anyhow::Result<()> {
    // Separate trace files avoid concurrent append races on Windows.
    let mut timeline = Vec::new();
    for index in 1..=4 {
        let [start, end]: [u64; 2] =
            serde_json::from_slice(&std::fs::read(trace.join(index.to_string()))?)?;
        assert!(end > start);
        timeline.extend([(start, 1_i32), (end, -1)]);
    }
    timeline.sort_unstable();
    let mut running = 0_i32;
    let mut peak = 0;
    for (_, delta) in timeline {
        running += delta;
        peak = peak.max(running);
        assert!(running >= 0);
    }
    assert_eq!(running, 0);
    assert!(peak <= i32::try_from(cap)?);
    if cap > 1 {
        assert!(peak > 1, "testcases must actually overlap");
    }
    Ok(())
}

#[cfg(target_os = "linux")]
#[tokio::test]
async fn canceling_a_parallel_run_terminates_every_active_case() -> anyhow::Result<()> {
    use std::time::Duration;
    use tokio::io::{AsyncBufReadExt, BufReader};
    let ws = Workspace::new()?;
    let pid_file = ws.file("pids.txt", "")?;
    ws.file("slow_parallel.py", &format!(
        "import os,time\nwith open({}, 'a') as p: p.write(str(os.getpid()) + '\\n')\ntime.sleep(60)\n",
        serde_json::to_string(&pid_file)?))?;
    ws.ok(&[
        "problem",
        "create",
        "slow_parallel.py",
        "--time-limit-ms",
        "60000",
    ])
    .await?;
    for _ in 0..4 {
        ws.ok(&["testcase", "add", "slow_parallel.py", "--stdin", ""])
            .await?;
    }
    let mut owner = ws
        .command(&["run", "slow_parallel.py", "-j", "4", "--output", "jsonl"])
        .spawn()?;
    let mut lines = BufReader::new(owner.stdout.take().context("stdout")?).lines();
    let (task, jobs) = tokio::time::timeout(Duration::from_secs(10), async {
        loop {
            let line = lines
                .next_line()
                .await?
                .context("owner exited before scheduling")?;
            let row: Value = serde_json::from_str(&line)?;
            if row.pointer("/event/result/phase").and_then(Value::as_str) == Some("scheduled") {
                return Ok::<_, anyhow::Error>((
                    row.text("/event/task_id")?.to_owned(),
                    usize::try_from(
                        row.required("/event/result/jobs")?
                            .as_u64()
                            .context("jobs")?,
                    )?,
                ));
            }
        }
    })
    .await??;
    let pids = tokio::time::timeout(Duration::from_secs(10), async {
        loop {
            let pids: Vec<_> = std::fs::read_to_string(&pid_file)?
                .lines()
                .map(str::to_owned)
                .collect();
            if pids.len() == jobs {
                return Ok::<_, anyhow::Error>(pids);
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    })
    .await??;
    ws.ok(&["task", "cancel", &task, "--wait"]).await?;
    assert_eq!(
        tokio::time::timeout(Duration::from_secs(5), owner.wait())
            .await??
            .code(),
        Some(130)
    );
    tokio::time::timeout(Duration::from_secs(5), async {
        loop {
            if pids
                .iter()
                .all(|pid| !std::path::Path::new("/proc").join(pid).exists())
            {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    })
    .await?;
    Ok(())
}

#[tokio::test]
async fn fast_parallel_cases_do_not_deadlock_while_committing_progress() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    ws.file("fast.cpp", "#include <cstdio>\nint main(){puts(\"1\");}\n")?;
    ws.ok(&["problem", "create", "fast.cpp"]).await?;
    for _ in 0..8 {
        ws.ok(&[
            "testcase", "add", "fast.cpp", "--stdin", "", "--answer", "1",
        ])
        .await?;
    }
    for _ in 0..20 {
        let result = ws
            .ok(&["run", "fast.cpp", "-j", "2", "--task-timeout-ms", "4000"])
            .await?;
        assert_eq!(result.text("/result/verdict")?, "accepted");
        assert_eq!(
            result
                .required("/result/testcases")?
                .as_array()
                .context("cases")?
                .len(),
            8
        );
    }
    Ok(())
}
