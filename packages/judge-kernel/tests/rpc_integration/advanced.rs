use super::{Client, JsonExt};
use anyhow::Context;
use cph_ng_judge::application::{error::ErrorCode, method::Method};

use serde_json::json;
use tempfile::TempDir;

#[tokio::test]
async fn imports_cpp_compilation_spj_interactive_and_stress() -> anyhow::Result<()> {
    let root = TempDir::new().context("test fixture or response")?;
    let mut client = Client::start(root.path(), &[]).await?;
    let source = root.path().join("solution.cpp");
    tokio::fs::write(
        &source,
        "#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b;}",
    )
    .await
    .context("test fixture or response")?;
    // Exercise functionality without assuming subsecond startup on loaded native runners.
    let problem = client.ok(Method::ProblemImport, json!({"source_path": source, "format": "companion", "problem": {"name": "Sum", "timeLimit": 5000, "memoryLimit": 256, "tests": [{"input": "1 2", "output": "3"}]}})).await?;
    let id = &problem.required("/id")?;
    let task = client
        .ok(Method::JudgeRun, json!({"problem_id": id}))
        .await?;
    assert_eq!(
        (client.finished(task.text("/task_id")?).await?).required("/result/verdict")?,
        "accepted"
    );
    let checker = root.path().join("checker.py");
    tokio::fs::write(
        &checker,
        "import sys\nassert len(sys.argv)==4\nsys.exit(1)\n",
    )
    .await
    .context("test fixture or response")?;
    client
        .ok(
            Method::ProblemUpdate,
            json!({"problem_id": id, "checker": checker}),
        )
        .await?;
    let task = client
        .ok(Method::JudgeRun, json!({"problem_id": id}))
        .await?;
    assert_eq!(
        (client.finished(task.text("/task_id")?).await?).required("/result/verdict")?,
        "wrong_answer"
    );
    let interactor = root.path().join("interactor.py");
    tokio::fs::write(&interactor, "import sys\nprint('1 2',flush=True)\nsys.exit(0 if sys.stdin.read().strip()=='3' else 1)\n").await.context("test fixture or response")?;
    client
        .ok(
            Method::ProblemUpdate,
            json!({"problem_id": id, "checker": null, "interactor": interactor}),
        )
        .await?;
    let task = client
        .ok(Method::JudgeRun, json!({"problem_id": id}))
        .await?;
    assert_eq!(
        (client.finished(task.text("/task_id")?).await?).required("/result/verdict")?,
        "accepted"
    );
    let generator = root.path().join("gen.py");
    tokio::fs::write(&generator, "import sys\nprint(sys.argv[1], 2)\n")
        .await
        .context("test fixture or response")?;
    let brute = root.path().join("brute.py");
    tokio::fs::write(&brute, "a,b=map(int,input().split()); print(a-b)\n")
        .await
        .context("test fixture or response")?;
    client.ok(Method::ProblemUpdate, json!({"problem_id": id, "interactor": null, "generator": generator, "brute_force": brute})).await?;
    let task = client
        .ok(
            Method::StressStart,
            json!({"problem_id": id, "iterations": 3, "seed": 5}),
        )
        .await?;
    let result = client.finished(task.text("/task_id")?).await?;
    assert_eq!(result.required("/state")?, "succeeded");
    assert_eq!(result.required("/result/found_difference")?, true);
    assert_eq!(
        client
            .ok(Method::TestcaseList, json!({"problem_id": id}))
            .await?
            .as_array()
            .context("test fixture or response")?
            .len(),
        2
    );
    tokio::fs::write(&source, "broken c++")
        .await
        .context("test fixture or response")?;
    let task = client
        .ok(Method::JudgeRun, json!({"problem_id": id}))
        .await?;
    let failed = client.finished(task.text("/task_id")?).await?;
    assert_eq!(failed.required("/state")?, "failed");
    assert_eq!(
        failed.required("/error/code")?,
        &json!(ErrorCode::CompilationFailed)
    );
    client.shutdown().await?;

    Ok(())
}

#[tokio::test]
async fn registered_c_rust_and_javascript_runtimes_execute_real_programs() -> anyhow::Result<()> {
    let root = TempDir::new().context("test fixture or response")?;
    let mut client = Client::start(root.path(), &[]).await?;
    for (name, code) in [
        (
            "main.c",
            "#include <stdio.h>\nint main(void) { puts(\"42\"); return 0; }",
        ),
        ("main.rs", "fn main() { println!(\"42\"); }"),
        ("main.js", "console.log(42);"),
    ] {
        let (id, _) = client.problem(root.path(), name, code, "", "42\n").await?;
        let task = client
            .ok(Method::JudgeRun, json!({"problem_id":id}))
            .await?;
        let final_task = client.finished(task.text("/task_id")?).await?;
        assert_eq!(
            final_task.required("/state")?,
            "succeeded",
            "{name}: {final_task}"
        );
        assert_eq!(
            final_task.required("/result/verdict")?,
            "accepted",
            "{name}: {final_task}"
        );
    }
    client.shutdown().await?;

    Ok(())
}
