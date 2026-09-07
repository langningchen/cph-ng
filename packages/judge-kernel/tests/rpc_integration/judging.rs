use super::{Client, JsonExt};
use anyhow::Context;
use cph_ng_judge::application::{error::ErrorCode, method::Method};

use serde_json::{Value, json};
use tempfile::TempDir;

#[tokio::test]
async fn judging_testcase_crud_history_and_restart() -> anyhow::Result<()> {
    let root = TempDir::new().context("test fixture or response")?;
    let mut client = Client::start(root.path(), &[]).await?;
    let (problem, testcase) = client
        .problem(
            root.path(),
            "sum.py",
            "a,b=map(int,input().split()); print(a+b)\n",
            "2 3\n",
            "5\n",
        )
        .await?;
    let task = client
        .ok(
            Method::TestcaseRun,
            json!({"problem_id": problem, "testcase_id": testcase, "client_request_id": "first"}),
        )
        .await?;
    let id = task.text("/task_id")?;
    let retried = client
        .ok(
            Method::TestcaseRun,
            json!({"problem_id": problem, "testcase_id": testcase, "client_request_id": "first"}),
        )
        .await?;
    assert_eq!(retried.required("/task_id")?, id);
    let task = client.finished(id).await?;
    assert_eq!(task.required("/state")?, "succeeded");
    assert_eq!(task.required("/result/verdict")?, "accepted");
    assert_task_events(&mut client, id).await?;
    client
        .ok(
            Method::TestcaseUpdate,
            json!({"problem_id": problem, "testcase_id": testcase, "answer": "6"}),
        )
        .await?;
    assert_eq!(
        (client
            .call(
                Method::TestcaseReorder,
                json ! ({ "problem_id" : problem , "testcase_ids" : [] })
            )
            .await?)
            .required("/error/code")?,
        &json!(ErrorCode::InvalidParams)
    );
    let wrong = client
        .ok(Method::JudgeRun, json!({"problem_id": problem}))
        .await?;
    assert_eq!(
        (client.finished(wrong.text("/task_id")?).await?).required("/result/verdict")?,
        "wrong_answer"
    );
    client.shutdown().await?;
    let mut client = Client::start(root.path(), &[]).await?;
    assert_eq!(
        (client
            .ok(Method::HistoryLoad, json ! ({ "run_id" : id }))
            .await?)
            .required("/result/verdict")?,
        "accepted"
    );
    assert_eq!(
        client
            .ok(Method::HistoryList, json!({"problem_id": problem}))
            .await?
            .as_array()
            .context("test fixture or response")?
            .len(),
        2
    );
    assert_eq!(
        (client
            .ok(Method::ProblemLoad, json ! ({ "problem_id" : problem }))
            .await?)
            .required("/testcases/0/answer")?,
        "6"
    );
    client
        .ok(
            Method::TestcaseDelete,
            json!({"problem_id": problem, "testcase_id": testcase}),
        )
        .await?;
    client
        .ok(Method::ProblemDelete, json!({"problem_id": problem}))
        .await?;
    assert_eq!(client.ok(Method::ProblemList, json!({})).await?, json!([]));
    client.shutdown().await?;

    Ok(())
}

async fn assert_task_events(client: &mut Client, id: &str) -> anyhow::Result<()> {
    let events = client
        .ok(Method::TaskEventsSince, json!({"task_id": id}))
        .await?;
    let events = events.as_array().context("test fixture or response")?;
    assert_eq!(
        (events.first().context("test fixture or response")?).required("/kind")?,
        "queued"
    );
    assert_eq!(
        (events.last().context("test fixture or response")?).required("/kind")?,
        "finished"
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
    assert!(
        client
            .events
            .iter()
            .any(|event| event.get("method").and_then(Value::as_str) == Some("event.task.finished"))
    );
    Ok(())
}

#[tokio::test]
async fn checker_failure_and_source_identity_survive_manual_moves() -> anyhow::Result<()> {
    let root = TempDir::new().context("test fixture or response")?;
    let mut client = Client::start(root.path(), &[]).await?;
    let (problem, _) = client
        .problem(root.path(), "source.py", "print(1)\n", "", "1")
        .await?;
    let checker = root.path().join("checker.py");
    tokio::fs::write(&checker, "import sys\nsys.exit(3)\n")
        .await
        .context("test fixture or response")?;
    client
        .ok(
            Method::ProblemUpdate,
            json!({"problem_id":problem,"checker":checker}),
        )
        .await?;
    let task = client
        .ok(Method::JudgeRun, json!({"problem_id":problem}))
        .await?;
    assert_eq!(
        (client.finished(task.text("/task_id")?).await?).required("/error/code")?,
        &json!(ErrorCode::CheckerFailed)
    );
    let moved = root.path().join("moved.py");
    tokio::fs::rename(root.path().join("source.py"), &moved)
        .await
        .context("test fixture or response")?;
    assert_eq!(
        (client
            .ok(Method::IndexResolve, json ! ({ "source_path" : moved }))
            .await?)
            .required("/problem_id")?,
        problem.as_str()
    );
    assert_eq!(
        (client
            .ok(Method::ProblemLoad, json ! ({ "problem_id" : problem }))
            .await?)
            .required("/source_path")?,
        &json!(moved)
    );
    assert_eq!(
        (client.ok(Method::ProblemList, json!({})).await?).required("/0/source_path")?,
        &json!(moved)
    );
    let rebuilt = client.ok(Method::IndexRebuild, json!({})).await?;
    assert_eq!(
        (client.finished(rebuilt.text("/task_id")?).await?).required("/result/rebuilt")?,
        1
    );
    tokio::fs::remove_file(&moved)
        .await
        .context("test fixture or response")?;
    client
        .ok(Method::ProblemDelete, json!({"problem_id":problem}))
        .await?;
    client.shutdown().await?;

    Ok(())
}

#[tokio::test]
async fn legacy_comparison_options_are_applied_by_the_kernel() -> anyhow::Result<()> {
    let root = TempDir::new().context("test fixture or response")?;
    let mut client = Client::start(root.path(), &[]).await?;
    let (id, _) = client
        .problem(
            root.path(),
            "format.py",
            "import sys\nprint('1 2')\nprint('diagnostic', file=sys.stderr)",
            "",
            "12",
        )
        .await?;
    for (mode, options, verdict) in [
        ("tokens", json!({}), "wrong_answer"),
        ("legacy", json!({}), "presentation_error"),
        ("legacy", json!({"regard_pe_as_ac":true}), "accepted"),
        ("legacy", json!({"ignore_stderr":false}), "runtime_error"),
    ] {
        let task = client
            .ok(
                Method::JudgeRun,
                json!({"problem_id":id,"checker_mode":mode,"legacy_comparison":options}),
            )
            .await?;
        let result = client.finished(task.text("/task_id")?).await?;
        assert_eq!(result.required("/result/verdict")?, verdict, "{result}");
    }
    client.shutdown().await?;

    Ok(())
}

#[tokio::test]
async fn interpreted_syntax_errors_are_compilation_failures_with_source_history()
-> anyhow::Result<()> {
    let root = TempDir::new().context("test fixture or response")?;
    let mut client = Client::start(root.path(), &[]).await?;
    for (name, code) in [
        ("syntax.py", "def invalid(:"),
        ("syntax.js", "function invalid( {"),
    ] {
        let (id, _) = client.problem(root.path(), name, code, "", "").await?;
        let task = client
            .ok(Method::JudgeRun, json!({"problem_id":id}))
            .await?;
        let final_task = client.finished(task.text("/task_id")?).await?;
        assert_eq!(
            final_task.required("/state")?,
            "failed",
            "{name}: {final_task}"
        );
        assert_eq!(
            final_task.required("/error/code")?,
            &json!(ErrorCode::CompilationFailed),
            "{name}: {final_task}"
        );
        assert_eq!(
            (client
                .ok(
                    Method::HistoryLoad,
                    json ! ({ "run_id" : task.required("/task_id")? })
                )
                .await?)
                .required("/source_code")?,
            code
        );
    }
    client.shutdown().await?;

    Ok(())
}
