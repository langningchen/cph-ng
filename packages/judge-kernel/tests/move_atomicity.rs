use anyhow::Context;
use cph_ng_judge::{
    application::{method::Method, tasks::TaskLimits},
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
async fn shared_moves_return_current_roles_even_when_the_original_source_was_missing()
-> anyhow::Result<()> {
    let (root, kernel, initial) = fixture().await?;
    let id = field(&initial, "id")?;
    let linked_path = root.path().join("linked.py");
    tokio::fs::write(&linked_path, "print(2)").await?;
    let linked = kernel
        .execute(
            Method::ProblemLink,
            json!({"problem_id":id,"destination":linked_path}),
        )
        .await?;
    let linked_destination = root.path().join("linked-moved.py");
    tokio::fs::write(&linked_destination, "print(2)").await?;
    let moved = kernel
        .execute(
            Method::ProblemMove,
            json!({"code_id":linked.get("code_id"),"destination":linked_destination}),
        )
        .await?;
    assert_eq!(
        kernel
            .execute(
                Method::ProblemLoad,
                json!({"source_path":linked_destination})
            )
            .await?,
        moved
    );
    tokio::fs::remove_file(root.path().join("main.py")).await?;
    let original_destination = root.path().join("original-moved.py");
    tokio::fs::write(&original_destination, "print(1)").await?;
    let moved = kernel
        .execute(
            Method::ProblemMove,
            json!({"code_id":initial.get("code_id"),"destination":original_destination}),
        )
        .await?;
    assert_eq!(
        kernel
            .execute(
                Method::ProblemLoad,
                json!({"source_path":original_destination})
            )
            .await?,
        moved
    );
    assert_eq!(
        kernel
            .execute(Method::ProblemLoad, json!({"problem_id":id}))
            .await?,
        moved
    );
    kernel.close().await?;
    Ok(())
}

#[tokio::test]
async fn move_does_not_rewrite_testcase_cache_after_committing_the_binding() -> anyhow::Result<()> {
    let (root, kernel, initial) = fixture().await?;
    let id = field(&initial, "id")?;
    let case = kernel
        .execute(
            Method::TestcaseAdd,
            json!({"problem_id":id,"stdin":"original","answer":"answer"}),
        )
        .await?;
    let case_id = cph_ng_judge::domain::TestcaseId(Uuid::parse_str(field(&case, "id")?)?);
    let problem_id = cph_ng_judge::domain::ProblemId(Uuid::parse_str(id)?);
    let (_, output) = kernel
        .repo
        .paths_for_id(problem_id)
        .get_testcase_paths(&case_id);
    tokio::fs::remove_file(&output).await?;
    tokio::fs::create_dir(&output).await?;
    let destination = root.path().join("moved.py");
    tokio::fs::write(&destination, "print(1)").await?;
    let moved = kernel
        .execute(
            Method::ProblemMove,
            json!({"problem_id":id,"destination":destination}),
        )
        .await?;
    assert_eq!(
        kernel
            .execute(Method::ProblemLoad, json!({"source_path":destination}))
            .await?,
        moved
    );
    kernel.close().await?;
    Ok(())
}
