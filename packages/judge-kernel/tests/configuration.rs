#[path = "support/json.rs"]
mod response;
use anyhow::Context;
use cph_ng_judge::{
    application::{method::Method, tasks::TaskLimits},
    infrastructure::kernel::Kernel,
};
use response::JsonExt;
use serde_json::json;

#[tokio::test]
async fn configuration_is_shared_validated_and_refreshes_without_restarting() -> anyhow::Result<()>
{
    let dir = tempfile::tempdir()?;
    let root = dir.path().join("store");
    let source = dir.path().join("main.py");
    tokio::fs::write(&source, "print(1)\n").await?;
    let kernel = Kernel::open(&root, &[dir.path().to_path_buf()], TaskLimits::default()).await?;
    let first = kernel.execute(Method::ConfigGet, json!({})).await?;
    assert_eq!(first.text("/raw_toml")?, "");
    assert_eq!(first.required("/config/languages/cpp/compiler")?, "g++");
    let updated = kernel
        .execute(
            Method::ConfigSet,
            json!({"patch": {
                "problem":{"time_limit":2345}, "judge":{"checker_mode":"legacy","iterations":42},
                "languages":{"cpp":{"compiler":"clang++","compiler_args":["-O1"]}},
                "future_feature":{"preserved":true}
            }}),
        )
        .await?;
    assert_eq!(updated.required("/updated")?, true);
    let problem = kernel
        .execute(Method::ProblemCreate, json!({"source_path":source}))
        .await?;
    assert_eq!(problem.required("/time_limit_ms")?, 2345);
    let id = problem.required("/id")?;
    assert!(
        kernel
            .execute(
                Method::JudgeRun,
                json!({"problem_id":id,"stdin":"","answer":"","tolerance":null})
            )
            .await
            .is_err()
    );
    let local = kernel
        .execute(
            Method::ConfigSet,
            json!({"problem_id":id,"patch":{
                "languages":{"cpp":{"compiler_args":["-g"]}}
            }}),
        )
        .await?;
    assert_eq!(local.required("/config/languages/cpp/compiler")?, "clang++");
    assert_eq!(
        local.required("/config/languages/cpp/compiler_args")?,
        &json!(["-g"])
    );
    assert_eq!(local.required("/config/judge/iterations")?, 42);
    assert!(
        local
            .pointer("/local_config/languages/cpp/compiler")
            .is_none()
    );
    kernel
        .execute(
            Method::ConfigSet,
            json!({"patch":{"languages":{"cpp":{"compiler":"g++"}}}}),
        )
        .await?;
    let live = kernel
        .execute(Method::ConfigGet, json!({"problem_id":id}))
        .await?;
    assert_eq!(live.required("/config/languages/cpp/compiler")?, "g++");
    let cleared = kernel
        .execute(
            Method::ConfigSet,
            json!({"problem_id":id,"patch":{"languages":{"cpp":{"compiler_args":null}}}}),
        )
        .await?;
    assert_eq!(
        cleared.required("/config/languages/cpp/compiler_args")?,
        &json!(["-O1"])
    );
    let before = tokio::fs::read(root.join("config.toml")).await?;
    for value in [
        json!({"toml":"[bad"}),
        json!({"patch":{"judge":{"iterations":0}}}),
        json!({"patch":{"compilation_timeout_ms":0}}),
    ] {
        assert!(kernel.execute(Method::ConfigSet, value).await.is_err());
        assert_eq!(tokio::fs::read(root.join("config.toml")).await?, before);
    }
    assert_eq!(
        kernel
            .execute(Method::ConfigGet, json!({}))
            .await?
            .required("/local_config/future_feature/preserved")?,
        true
    );
    // Manual TOML edits must invalidate neither a daemon nor a global Figment cache.
    tokio::fs::write(root.join("config.toml"), "[problem]\ntime_limit = 3210\n").await?;
    assert_eq!(
        kernel
            .execute(Method::ConfigGet, json!({}))
            .await?
            .required("/config/problem/time_limit")?,
        3210
    );
    kernel.close().await?;
    Ok(())
}

#[cfg(unix)]
async fn executable(path: &std::path::Path, body: &str) -> anyhow::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    tokio::fs::write(path, format!("#!/bin/sh\n{body}\n")).await?;
    tokio::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700)).await?;
    Ok(())
}

#[cfg(unix)]
#[tokio::test]
async fn queued_runs_keep_the_admitted_compiler_and_judge_configuration() -> anyhow::Result<()> {
    use cph_ng_judge::application::tasks::TaskSpec;
    use std::{sync::Arc, time::Duration};
    let dir = tempfile::tempdir()?;
    let source = dir.path().join("main.py");
    let old = dir.path().join("python-old");
    let new = dir.path().join("python-new");
    tokio::fs::write(&source, "print(1)\n").await?;
    executable(
        &old,
        "if [ \"$1\" = '-m' ]; then exit 0; fi\nprintf 'old\\n'",
    )
    .await?;
    executable(
        &new,
        "if [ \"$1\" = '-m' ]; then exit 0; fi\nprintf 'new\\n'",
    )
    .await?;
    let kernel = Kernel::open(
        &dir.path().join("store"),
        &[dir.path().to_path_buf()],
        TaskLimits {
            workers: 1,
            ..TaskLimits::default()
        },
    )
    .await?;
    let gate = Arc::new(tokio::sync::Notify::new());
    let release = gate.clone();
    let blocker = kernel
        .tasks
        .spawn(
            TaskSpec {
                kind: Method::TaskCreate,
                problem_id: None,
                code_id: None,
                client_request_id: None,
                fingerprint: "blocker".into(),
                effective_config: None,
            },
            move |_| async move {
                release.notified().await;
                Ok(json!({}))
            },
        )
        .await?;
    while kernel.tasks.get(&blocker.task_id).await?.state.as_str() != "running" {
        tokio::task::yield_now().await;
    }
    let problem = kernel
        .execute(Method::ProblemCreate, json!({"source_path":source}))
        .await?;
    let id = problem.required("/id")?;
    kernel.execute(Method::ConfigSet,json!({"patch":{"languages":{"python":{"interpreter":old}},"judge":{"checker_mode":"exact"}}})).await?;
    let first = kernel
        .execute(
            Method::JudgeRun,
            json!({"problem_id":id,"stdin":"","answer":"old\n"}),
        )
        .await?;
    kernel.execute(Method::ConfigSet,json!({"patch":{"languages":{"python":{"interpreter":new}},"judge":{"checker_mode":"tokens"}}})).await?;
    gate.notify_one();
    let tasks = &kernel.tasks;
    let wait = |id: String| async move {
        tokio::time::timeout(Duration::from_secs(10), async {
            loop {
                let task = tasks.get(&id).await?;
                if task.state.is_final() {
                    return Ok::<_, anyhow::Error>(task);
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .context("judge finished")?
    };
    let task = wait(first.text("/task_id")?.into()).await?;
    assert_eq!(
        task.result.context("first result")?.required("/verdict")?,
        "accepted"
    );
    assert_eq!(
        serde_json::to_value(task.effective_config)?.required("/judge/checker_mode")?,
        "exact"
    );
    let second = kernel
        .execute(
            Method::JudgeRun,
            json!({"problem_id":id,"stdin":"","answer":"new"}),
        )
        .await?;
    let task = wait(second.text("/task_id")?.into()).await?;
    assert_eq!(
        task.result.context("second result")?.required("/verdict")?,
        "accepted"
    );
    kernel.close().await?;
    Ok(())
}

#[cfg(unix)]
#[tokio::test]
async fn toolchain_probes_are_validated_bounded_and_do_not_save_configuration() -> anyhow::Result<()>
{
    use std::time::{Duration, Instant};
    let dir = tempfile::tempdir()?;
    let root = dir.path().join("store");
    let compiler = dir.path().join("fake-rustc");
    executable(&compiler, "printf 'rustc 1.99.0 (test)\\n'").await?;
    let kernel = Kernel::open(&root, &[dir.path().to_path_buf()], TaskLimits::default()).await?;
    let item = kernel
        .execute(
            Method::ToolchainCheck,
            json!({"language":"rust","kind":"compiler","path":compiler}),
        )
        .await?;
    assert_eq!(item.required("/version")?, "1.99.0");
    assert_eq!(item.required("/group")?, "Rust");
    tokio::fs::copy(&compiler, dir.path().join("rustc")).await?;
    let detected = tokio::process::Command::new(env!("CARGO_BIN_EXE_cph-ng-judge"))
        .args(["toolchain", "detect", "--language", "rust", "--json"])
        .env("PATH", dir.path())
        .output()
        .await?;
    assert!(
        detected.status.success(),
        "{}",
        String::from_utf8_lossy(&detected.stderr)
    );
    let detected: serde_json::Value = serde_json::from_slice(&detected.stdout)?;
    assert_eq!(detected.required("/toolchains/0/version")?, "1.99.0");
    assert!(!root.join("config.toml").exists());
    assert!(
        kernel
            .execute(
                Method::ToolchainCheck,
                json!({"language":"python","kind":"interpreter","path":compiler})
            )
            .await?
            .is_null()
    );
    executable(&compiler, "sleep 10\nprintf 'rustc 1.99.0\\n'").await?;
    let start = Instant::now();
    assert!(
        kernel
            .execute(
                Method::ToolchainCheck,
                json!({"language":"rust","kind":"compiler","path":compiler})
            )
            .await?
            .is_null()
    );
    assert!(start.elapsed() < Duration::from_secs(5));
    executable(&compiler, "yes rustc").await?;
    assert!(
        kernel
            .execute(
                Method::ToolchainCheck,
                json!({"language":"rust","kind":"compiler","path":compiler})
            )
            .await?
            .is_null()
    );
    kernel.close().await?;
    Ok(())
}

#[tokio::test]
async fn stale_editor_saves_and_malformed_language_fields_cannot_replace_config()
-> anyhow::Result<()> {
    use cph_ng_judge::application::error::ErrorCode;
    let dir = tempfile::tempdir()?;
    let kernel = Kernel::open(dir.path(), &[], TaskLimits::default()).await?;
    let saved = kernel
        .execute(
            Method::ConfigSet,
            json!({"toml":"# First editor\n", "expected_raw_toml":""}),
        )
        .await?;
    let error = kernel
        .execute(
            Method::ConfigSet,
            json!({"toml":"# Stale editor\n", "expected_raw_toml":""}),
        )
        .await
        .err()
        .context("stale save must fail")?;
    assert_eq!(error.code, ErrorCode::Conflict);
    for invalid in [
        json!({"languages":{"cpp":{"compiler_args":"-g"}}}),
        json!({"languages":{"cpp":{"compiler":123}}}),
        json!({"languages":{"python":{"interpreter_args":[1]}}}),
    ] {
        assert!(
            kernel
                .execute(Method::ConfigSet, json!({"patch":invalid}))
                .await
                .is_err()
        );
    }
    assert_eq!(
        kernel
            .execute(Method::ConfigGet, json!({}))
            .await?
            .required("/raw_toml")?,
        saved.required("/raw_toml")?
    );
    kernel.close().await?;
    Ok(())
}

#[tokio::test]
async fn argument_overrides_require_a_resolved_executable() -> anyhow::Result<()> {
    let dir = tempfile::tempdir()?;
    let kernel = Kernel::open(dir.path(), &[], TaskLimits::default()).await?;
    for patch in [
        json!({"languages":{"python":{"compiler_args":["-X","utf8"]}}}),
        json!({"languages":{"javascript":{"compiler_args":["--trace-warnings"]}}}),
        json!({"languages":{"cpp":{"interpreter_args":["--trace"]}}}),
    ] {
        let error = kernel
            .execute(Method::ConfigSet, json!({"patch":patch}))
            .await
            .err()
            .context("orphan arguments must fail")?;
        assert!(
            error.message.contains("requires a configured or inherited"),
            "{error:?}"
        );
        assert!(!dir.path().join("config.toml").exists());
    }
    let cpp = kernel
        .execute(
            Method::ConfigSet,
            json!({"patch":{"languages":{"cpp":{"compiler_args":["-g"]}}}}),
        )
        .await?;
    assert_eq!(cpp.required("/config/languages/cpp/compiler")?, "g++");
    assert_eq!(
        cpp.required("/config/languages/cpp/compiler_args")?,
        &json!(["-g"])
    );
    let python = kernel.execute(Method::ConfigSet,json!({"patch":{"languages":{"python":{"compiler":"python3","compiler_args":["-X","utf8"]}}}})).await?;
    assert_eq!(
        python.required("/config/languages/python/compiler_args")?,
        &json!(["-X", "utf8"])
    );
    assert_eq!(
        python.required("/config/languages/python/interpreter_args")?,
        &json!([])
    );
    kernel.close().await?;
    Ok(())
}
