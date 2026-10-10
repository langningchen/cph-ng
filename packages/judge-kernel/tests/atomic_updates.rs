use anyhow::Context;
use cph_ng_judge::{
    application::{error::ErrorCode, method::Method, tasks::TaskLimits},
    domain::ProblemId,
    infrastructure::kernel::Kernel,
};
use serde_json::{Value, json};
use uuid::Uuid;

async fn fixture() -> anyhow::Result<(tempfile::TempDir, Kernel, Value)> {
    let root = tempfile::tempdir()?;
    let source = root.path().join("main.py");
    tokio::fs::write(&source, "print(1)").await?;
    let kernel = Kernel::open(
        &root.path().join("store"),
        &[root.path().to_path_buf()],
        TaskLimits::default(),
    )
    .await?;
    let problem = kernel
        .execute(Method::ProblemCreate, json!({"source_path": source}))
        .await?;
    Ok((root, kernel, problem))
}

fn field<'a>(value: &'a Value, key: &str) -> anyhow::Result<&'a str> {
    value
        .get(key)
        .and_then(Value::as_str)
        .context(key.to_owned())
}

#[tokio::test]
async fn batch_updates_commit_details_content_deletions_and_order_together() -> anyhow::Result<()> {
    let (_root, kernel, initial) = fixture().await?;
    let id = field(&initial, "id")?;
    let first = Uuid::new_v4();
    let second = Uuid::new_v4();
    let saved = kernel
        .execute(
            Method::ProblemUpdate,
            json!({
                "problem_id": id, "expected_revision": field(&initial, "revision")?,
                "name": "batch", "testcases": [
                    {"id":first, "stdin":"1", "answer":"one"},
                    {"id":second, "stdin":"2", "answer":"two"}
                ]
            }),
        )
        .await?;
    assert_eq!(saved.get("name"), Some(&json!("batch")));
    assert_ne!(saved.get("revision"), initial.get("revision"));
    let third = Uuid::new_v4();
    let cases = json!([
        {"id":third, "stdin":"3", "answer":"three"},
        {"id":first, "stdin":"edited", "answer":"one"}
    ]);
    let updated = kernel
        .execute(
            Method::ProblemUpdate,
            json!({
                "problem_id": id, "expected_revision":field(&saved, "revision")?,
                "time_limit_ms": 2000, "testcases":cases
            }),
        )
        .await?;
    assert_eq!(updated.get("testcases"), Some(&cases));
    assert_eq!(updated.get("time_limit_ms"), Some(&json!(2000)));
    let loaded = kernel
        .execute(Method::ProblemLoad, json!({"problem_id":id}))
        .await?;
    assert_eq!(loaded, updated);
    kernel.close().await?;
    Ok(())
}

#[tokio::test]
async fn concurrent_saves_with_one_revision_have_exactly_one_winner() -> anyhow::Result<()> {
    let (_root, kernel, initial) = fixture().await?;
    let id = field(&initial, "id")?;
    let revision = field(&initial, "revision")?;
    let (left, right) = tokio::join!(
        kernel.execute(
            Method::ProblemUpdate,
            json!({
                "problem_id":id, "expected_revision":revision, "name":"left", "testcases":[]
            })
        ),
        kernel.execute(
            Method::ProblemUpdate,
            json!({
                "problem_id":id, "expected_revision":revision, "name":"right", "testcases":[]
            })
        )
    );
    let winner = match (left, right) {
        (Ok(saved), Err(error)) | (Err(error), Ok(saved)) => {
            assert_eq!(error.code, ErrorCode::Conflict);
            saved
        }
        other => anyhow::bail!("expected one success and one conflict: {other:?}"),
    };
    assert_eq!(
        kernel
            .execute(Method::ProblemLoad, json!({"problem_id":id}))
            .await?,
        winner
    );
    kernel.close().await?;
    Ok(())
}

#[tokio::test]
async fn invalid_batches_leave_metadata_and_content_intact() -> anyhow::Result<()> {
    let (_root, kernel, initial) = fixture().await?;
    let id = field(&initial, "id")?;
    let case = json!({"id":Uuid::new_v4(), "stdin":"original", "answer":"answer"});
    let saved = kernel
        .execute(
            Method::ProblemUpdate,
            json!({
                "problem_id":id, "testcases":[case]
            }),
        )
        .await?;
    let oversized = json!({"id":Uuid::new_v4(), "stdin":"x".repeat(16*1024*1024+1), "answer":""});
    for cases in [json!([case, case]), json!([oversized])] {
        let error = kernel
            .execute(
                Method::ProblemUpdate,
                json!({
                    "problem_id":id, "expected_revision":field(&saved,"revision")?,
                    "name":"must not commit", "testcases":cases
                }),
            )
            .await
            .err()
            .context("invalid batch accepted")?;
        assert_eq!(error.code, ErrorCode::InvalidParams);
        assert_eq!(
            kernel
                .execute(Method::ProblemLoad, json!({"problem_id":id}))
                .await?,
            saved
        );
    }
    kernel.close().await?;
    Ok(())
}

#[tokio::test]
async fn cache_write_failure_rolls_back_batch() -> anyhow::Result<()> {
    let (_root, kernel, initial) = fixture().await?;
    let id = field(&initial, "id")?;
    let case = Uuid::new_v4();
    let saved = kernel
        .execute(
            Method::ProblemUpdate,
            json!({
                "problem_id":id, "testcases":[{"id":case,"stdin":"original","answer":"answer"}]
            }),
        )
        .await?;
    let paths = kernel.repo.paths_for_id(ProblemId(Uuid::parse_str(id)?));
    let (_, output) = paths.get_testcase_paths(&cph_ng_judge::domain::TestcaseId(case));
    tokio::fs::remove_file(&output).await?;
    tokio::fs::create_dir(&output).await?;
    assert!(
        kernel
            .execute(
                Method::ProblemUpdate,
                json!({
                    "problem_id":id, "expected_revision":field(&saved,"revision")?, "name":"failed",
                    "testcases":[{"id":case,"stdin":"changed","answer":"changed"}]
                })
            )
            .await
            .is_err()
    );
    assert_eq!(
        kernel
            .execute(Method::ProblemLoad, json!({"problem_id":id}))
            .await?,
        saved
    );
    kernel.close().await?;
    Ok(())
}

#[tokio::test]
async fn testcase_files_are_validated_before_any_changes_are_saved() -> anyhow::Result<()> {
    let (root, kernel, initial) = fixture().await?;
    let outside = tempfile::tempdir()?;
    let cases_path = root.path().join("cases.json");
    let external_path = outside.path().join("cases.json");
    tokio::fs::write(&cases_path, "not JSON").await?;
    tokio::fs::write(&external_path, "[]").await?;
    let id = field(&initial, "id")?;
    for payload in [
        json!({"testcases_file":cases_path}),
        json!({"testcases_file":external_path}),
        json!({"testcases_file":cases_path,"testcases":[]}),
    ] {
        let mut params = payload.as_object().context("test payload")?.clone();
        params.insert("problem_id".into(), json!(id));
        params.insert("name".into(), json!("must not save"));
        assert!(
            kernel
                .execute(Method::ProblemUpdate, json!(params))
                .await
                .is_err()
        );
        assert_eq!(
            kernel
                .execute(Method::ProblemLoad, json!({"problem_id":id}))
                .await?,
            initial
        );
    }
    kernel.close().await?;
    Ok(())
}
