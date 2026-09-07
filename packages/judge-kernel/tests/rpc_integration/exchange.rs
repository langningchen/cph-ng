use super::{Client, JsonExt};
use anyhow::Context;
use cph_ng_judge::application::{error::ErrorCode, method::Method};
use serde_json::json;
use tempfile::TempDir;

#[tokio::test]
async fn package_rpc_respects_roots_force_and_source_references() -> anyhow::Result<()> {
    let root = TempDir::new()?;
    let outside = TempDir::new()?;
    let mut client = Client::start(root.path(), &[]).await?;
    let source = root.path().join("first.py");
    let second = root.path().join("second.py");
    tokio::fs::write(&source, "print(1)").await?;
    tokio::fs::write(&second, "print(2)").await?;
    let problem = client
        .ok(Method::ProblemCreate, json!({"source_path":source}))
        .await?;
    client
        .ok(
            Method::TestcaseAdd,
            json!({"source_path":source,"answer":"1"}),
        )
        .await?;
    let linked = client
        .ok(
            Method::ProblemLink,
            json!({"problem_id":problem.required("/id")?,"destination":second}),
        )
        .await?;
    let run = client
        .ok(
            Method::JudgeRun,
            json!({"code_id":linked.required("/code_id")?}),
        )
        .await?;
    let finished = client.finished(run.text("/task_id")?).await?;
    assert_eq!(
        finished.text("/result/testcases/0/stdout")?,
        if cfg!(windows) { "2\r\n" } else { "2\n" }
    );
    assert_eq!(finished.required("/code_id")?, linked.required("/code_id")?);
    let first_history = client
        .ok(
            Method::HistoryList,
            json!({"source_path":source,"problem_id":problem.required("/id")?}),
        )
        .await?;
    assert!(first_history.as_array().context("history")?.is_empty());
    let denied = client
        .call(
            Method::ProblemExport,
            json!({"source_path":source,"destination":outside.path().join("package.cph")}),
        )
        .await?;
    assert_eq!(
        denied.required("/error/code")?,
        &json!(ErrorCode::InvalidParams)
    );
    let destination = root.path().join("package.cph");
    client
        .ok(
            Method::ProblemExport,
            json!({"source_path":source,"destination":destination}),
        )
        .await?;
    let denied=client.call(Method::ProblemExport,json!({"source_path":source,"format":"companion","destination":root.path().join("lossy.json")})).await?;
    assert_eq!(denied.required("/error/code")?, &json!(ErrorCode::Conflict));
    assert!(!root.path().join("lossy.json").exists());
    let restored = client
        .ok(
            Method::ProblemImport,
            json!({"input":destination,"destination":root.path().join("restored")}),
        )
        .await?;
    assert_eq!(
        restored
            .required("/sources")?
            .as_array()
            .context("sources")?
            .len(),
        2
    );
    assert_eq!(restored.required("/history_imported")?, 1);
    client.shutdown().await?;
    Ok(())
}
