use cph_ng_judge::{
    application::tasks::Cancellation,
    infrastructure::executor::ProcessExecutor,
    ports::executor::{CommandSpec, ExecutionLimits, ExecutorPort, ExitReason},
};

#[tokio::test]
async fn memory_measurements_report_samples_without_claiming_zero_usage() -> anyhow::Result<()> {
    let dir = tempfile::tempdir()?;
    let limits = ExecutionLimits {
        time_ms: 3000,
        ..ExecutionLimits::default()
    };
    let measured = ProcessExecutor
        .run(
            &CommandSpec {
                program: if cfg!(windows) { "python" } else { "python3" }.into(),
                args: vec![
                    "-c".into(),
                    "import time; a=bytearray(32*1024*1024); time.sleep(0.2)".into(),
                ],
                cwd: dir.path().into(),
            },
            &[],
            &limits,
            &Cancellation::new(),
        )
        .await?;
    assert_eq!(measured.reason, ExitReason::Exited);
    assert_eq!(measured.exit_code, Some(0));
    assert!(
        measured.memory_mb.is_some_and(|memory| memory >= 32),
        "{measured:?}"
    );
    let quick = ProcessExecutor
        .run(
            &CommandSpec {
                program: if cfg!(windows) { "cmd" } else { "true" }.into(),
                args: if cfg!(windows) {
                    vec!["/C".into(), "exit 0".into()]
                } else {
                    vec![]
                },
                cwd: dir.path().into(),
            },
            &[],
            &limits,
            &Cancellation::new(),
        )
        .await?;
    assert_eq!(quick.exit_code, Some(0));
    assert_ne!(quick.memory_mb, Some(0));
    Ok(())
}
