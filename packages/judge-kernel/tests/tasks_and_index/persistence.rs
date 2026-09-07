use anyhow::Context;

use tempfile::TempDir;
use uuid::Uuid;

#[tokio::test]
async fn testcase_write_failure_and_size_limit_roll_back_metadata_and_content() -> anyhow::Result<()>
{
    use cph_ng_judge::{
        domain::{IoPath, Problem, SourcePath, Testcase, TestcaseId, TestcaseJudgingStatus},
        infrastructure::repo::workspace::WorkspaceProblemRepository,
        ports::ProblemRepository,
    };
    let root = TempDir::new().context("required test fixture or kernel response")?;
    let source = root.path().join("solution.py");
    tokio::fs::write(&source, "print(1)")
        .await
        .context("required test fixture or kernel response")?;
    let repo = WorkspaceProblemRepository::new(root.path().to_path_buf())
        .await
        .context("required test fixture or kernel response")?;
    let mut problem = Problem::new("original".into(), SourcePath(source.clone()));
    let id = TestcaseId(Uuid::new_v4());
    let (input, answer) = repo.paths_for_id(problem.id).get_testcase_paths(&id);
    problem.testcases.push(Testcase {
        id,
        stdin: IoPath(input),
        answer: IoPath(answer.clone()),
        status: TestcaseJudgingStatus::Waiting,
    });
    repo.save_problem_with_testcases(
        &problem,
        &[(id, ("old input".into(), "old answer".into()))].into(),
    )
    .await
    .context("required test fixture or kernel response")?;
    tokio::fs::remove_file(&answer)
        .await
        .context("required test fixture or kernel response")?;
    tokio::fs::create_dir(&answer)
        .await
        .context("required test fixture or kernel response")?;
    problem.name = "must roll back".into();
    assert!(
        repo.save_problem_with_testcases(
            &problem,
            &[(id, ("new input".into(), "new answer".into()))].into()
        )
        .await
        .is_err()
    );
    assert_eq!(
        repo.load_problem(&source)
            .await
            .context("required test fixture or kernel response")?
            .name,
        "original"
    );
    assert_eq!(
        repo.testcase_data(&problem, id)
            .await
            .context("required test fixture or kernel response")?,
        ("old input".into(), "old answer".into())
    );
    tokio::fs::remove_dir(&answer)
        .await
        .context("required test fixture or kernel response")?;
    assert!(
        repo.save_problem_with_testcases(
            &problem,
            &[(id, ("x".repeat(16 * 1024 * 1024), "overflow".into()))].into()
        )
        .await
        .is_err()
    );
    assert_eq!(
        repo.load_problem(&source)
            .await
            .context("required test fixture or kernel response")?
            .name,
        "original"
    );
    assert_eq!(
        repo.testcase_data(&problem, id)
            .await
            .context("required test fixture or kernel response")?
            .0,
        "old input"
    );
    problem.testcases.push(
        (*(problem.testcases)
            .first()
            .context("missing required response field or entry")?)
        .clone(),
    );
    assert!(repo.save_problem(&problem).await.is_err());

    Ok(())
}
