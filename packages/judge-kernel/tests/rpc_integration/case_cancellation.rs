use super::{Client, JsonExt};
use anyhow::Context;
use cph_ng_judge::application::method::Method;
use serde_json::json;

#[tokio::test]
async fn canceling_one_case_preserves_completed_and_remaining_cases() -> anyhow::Result<()> {
    let root = tempfile::tempdir()?;
    let mut client = Client::start(root.path(), &[]).await?;
    let (problem, first) = client
        .problem(
            root.path(),
            "case.py",
            "import time\nn=int(input())\nif n == 2: time.sleep(30)\nprint(n)\n",
            "1",
            "1",
        )
        .await?;
    let mut ids = vec![first];
    for input in ["2", "3", "4"] {
        let case = client
            .ok(
                Method::TestcaseAdd,
                json!({"problem_id":problem,"stdin":input,"answer":input}),
            )
            .await?;
        ids.push(case.text("/id")?.to_owned());
    }
    client
        .ok(
            Method::ProblemUpdate,
            json!({"problem_id":problem,"time_limit_ms":60000}),
        )
        .await?;
    let task = client
        .ok(
            Method::TestcaseRunAll,
            json!({"problem_id":problem,"jobs":1}),
        )
        .await?;
    let id = task.text("/task_id")?;
    let slow = ids.get(1).context("slow case")?;
    let queued = ids.get(2).context("queued case")?;
    tokio::time::timeout(std::time::Duration::from_secs(10), async {
        loop {
            let events = client
                .ok(Method::TaskEventsSince, json!({"task_id":id}))
                .await?;
            if events.as_array().context("events")?.iter().any(|event| {
                event.pointer("/result/phase") == Some(&json!("running"))
                    && event.pointer("/result/testcase_id") == Some(&json!(slow))
            }) {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
        Ok::<_, anyhow::Error>(())
    })
    .await??;
    // Cancel a queued case before the running one, then let the batch finish.
    for case in [queued, slow] {
        client
            .ok(Method::TaskCancel, json!({"task_id":id,"testcase_id":case}))
            .await?;
    }
    let done = client.finished(id).await?;
    assert_eq!(done.text("/state")?, "succeeded");
    let cases = done
        .required("/result/testcases")?
        .as_array()
        .context("cases")?;
    for (case, expected) in cases
        .iter()
        .zip(["accepted", "rejected", "rejected", "accepted"])
    {
        assert_eq!(case.text("/verdict")?, expected);
    }
    assert_eq!(cases.len(), 4);
    client.shutdown().await?;
    Ok(())
}
