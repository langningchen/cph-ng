use super::{JsonExt, Workspace, lines, task_id};
use anyhow::Context;

use serde_json::{Value, json};

#[tokio::test]
async fn ad_hoc_judging_jsonl_and_history_do_not_modify_saved_cases_or_limits() -> anyhow::Result<()>
{
    let ws = Workspace::new()?;
    ws.file("sum.py", "print(sum(map(int,input().split())))\n")?;
    ws.file("sample.in", "1 2\n")?;
    ws.file("sample.ans", "3\n")?;
    let result = ws
        .raw(&[
            "run",
            "sum.py",
            "--input",
            "sample.in",
            "--answer-file",
            "sample.ans",
            "--time-limit-ms",
            "2500",
            "--output",
            "jsonl",
            "--client-request-id",
            "one",
        ])
        .await?;
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    let output = lines(&result.stdout)?;
    let events = jsonl_events(&output)?;
    let final_task = &(output.last().context("test fixture or response")?).required("/result")?;
    assert_eq!(final_task.required("/result/verdict")?, "accepted");
    let problem = ws.ok(&["problem", "load", "sum.py"]).await?;
    assert_eq!(problem.required("/time_limit_ms")?, 1000);
    assert_eq!(problem.required("/testcases")?, &json!([]));
    ws.json(&["judge", "run", "sum.py"], 2).await?; // empty suites cannot pass vacuously
    let retry = ws
        .ok(&[
            "run",
            "sum.py",
            "--input",
            "sample.in",
            "--answer-file",
            "sample.ans",
            "--time-limit-ms",
            "2500",
            "--client-request-id",
            "one",
        ])
        .await?;
    assert_eq!(
        retry.required("/task_id")?,
        final_task.required("/task_id")?
    );
    assert_history(&ws, final_task, &events).await?;
    let human = ws
        .raw(&[
            "judge", "run", "sum.py", "--stdin", "1 2", "--answer", "4", "--quiet",
        ])
        .await?;
    assert_eq!(human.status.code(), Some(1));
    assert!(human.stderr.is_empty());
    assert!(String::from_utf8_lossy(&human.stdout).contains("Wrong answer"));
    assert!(!human.stdout.contains(&27));

    Ok(())
}

fn jsonl_events(output: &[Value]) -> anyhow::Result<Vec<&Value>> {
    assert!(output.iter().all(|v| v.get("jsonrpc").is_none()));
    let events: Vec<_> = output
        .iter()
        .filter(|v| v.get("type").and_then(Value::as_str) == Some("event"))
        .map(|v| v.required("/event"))
        .collect::<anyhow::Result<_>>()?;
    assert_eq!(
        (events.first().context("test fixture or response")?).required("/kind")?,
        "queued"
    );
    assert_eq!(
        (events.last().context("test fixture or response")?).required("/kind")?,
        "finished"
    );
    assert_eq!(
        events
            .iter()
            .filter(|v| v.get("kind").and_then(Value::as_str) == Some("finished"))
            .count(),
        1
    );
    for (before, after) in events.iter().zip(events.iter().skip(1)) {
        assert!(
            before
                .get("sequence")
                .and_then(Value::as_u64)
                .context("event sequence")?
                < after
                    .get("sequence")
                    .and_then(Value::as_u64)
                    .context("event sequence")?
        );
    }
    Ok(events)
}

async fn assert_history(
    ws: &Workspace,
    final_task: &Value,
    events: &[&Value],
) -> anyhow::Result<()> {
    let history = ws
        .ok(&["history", "list", "sum.py", "--limit", "1"])
        .await?;
    assert_eq!(
        history
            .as_array()
            .context("test fixture or response")?
            .len(),
        1
    );
    let saved = ws.ok(&["history", "show", task_id(final_task)?]).await?;
    assert_eq!(
        saved.required("/source_code")?,
        "print(sum(map(int,input().split())))\n"
    );
    let after = (events.last().context("test fixture or response")?)
        .required("/sequence")?
        .to_string();
    assert_eq!(
        ws.ok(&[
            "task",
            "events",
            "--task-id",
            task_id(final_task)?,
            "--since",
            &after
        ])
        .await?,
        json!([])
    );
    assert_eq!(
        (ws.ok(&["task", "wait", task_id(final_task)?]).await?).required("/state")?,
        "succeeded"
    );
    let follow = ws
        .raw(&[
            "task",
            "events",
            "--task-id",
            task_id(final_task)?,
            "--follow",
            "--output",
            "jsonl",
        ])
        .await?;
    assert!(follow.status.success());
    assert_eq!(
        (lines(&follow.stdout)?
            .last()
            .context("test fixture or response")?)
        .required("/result/task/state")?,
        "succeeded"
    );
    Ok(())
}
