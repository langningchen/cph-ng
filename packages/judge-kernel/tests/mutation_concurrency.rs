use anyhow::Context;
use cph_ng_judge::{
    application::{method::Method, tasks::TaskLimits},
    domain::{IoPath, ProblemId, Testcase, TestcaseId, TestcaseJudgingStatus},
    infrastructure::kernel::Kernel,
};
use serde_json::json;
use std::time::Duration;
use uuid::Uuid;

#[tokio::test]
async fn move_and_reindex_keep_changes_committed_while_waiting_for_the_problem_lock()
-> anyhow::Result<()> {
    for method in [Method::ProblemMove, Method::IndexReindexFile] {
        let root = tempfile::tempdir()?;
        let source = root.path().join("main.py");
        let destination = root.path().join("moved.py");
        tokio::fs::write(&source, "print(1)").await?;
        tokio::fs::write(&destination, "print(1)").await?;
        let kernel = Kernel::open(
            &root.path().join("store"),
            &[root.path().to_path_buf()],
            TaskLimits::default(),
        )
        .await?;
        let created = kernel
            .execute(Method::ProblemCreate, json!({"source_path":source}))
            .await?;
        let id = created
            .get("id")
            .and_then(serde_json::Value::as_str)
            .context("problem ID")?;
        let lock = kernel.tasks.locks.get(id).await;
        let guard = lock.lock().await;
        let operation = kernel.execute(
            method,
            json!({"problem_id":id,"source_path":source,"destination":destination}),
        );
        tokio::pin!(operation);
        assert!(
            tokio::time::timeout(Duration::from_millis(200), &mut operation)
                .await
                .is_err()
        );
        // Simulate the task holding this lock committing a counterexample.
        let mut problem = kernel
            .repo
            .load_by_id(ProblemId(Uuid::parse_str(id)?))
            .await?;
        problem.name = "new metadata".into();
        let case = TestcaseId(Uuid::new_v4());
        let (input, answer) = kernel
            .repo
            .paths_for_id(problem.id)
            .get_testcase_paths(&case);
        problem.testcases.push(Testcase {
            id: case,
            stdin: IoPath(input),
            answer: IoPath(answer),
            status: TestcaseJudgingStatus::Waiting,
        });
        kernel
            .repo
            .save_problem_with_testcases(
                &problem,
                &[(case, ("new input".into(), "new answer".into()))].into(),
            )
            .await?;
        drop(guard);
        operation.await?;
        let saved = kernel.repo.load_by_id(problem.id).await?;
        assert_eq!(saved.name, "new metadata");
        assert_eq!(saved.testcases.len(), 1);
        assert_eq!(
            kernel.repo.testcase_data(&saved, case).await?,
            ("new input".into(), "new answer".into())
        );
        kernel.close().await?;
    }
    Ok(())
}
