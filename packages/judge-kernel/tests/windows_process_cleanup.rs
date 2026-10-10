#![cfg(windows)]
use cph_ng_judge::{
    application::tasks::Cancellation,
    infrastructure::executor::ProcessExecutor,
    ports::executor::{CommandSpec, ExecutionLimits, ExecutorPort, ExitReason},
};
use std::time::Duration;

#[tokio::test]
async fn descendants_are_cleaned_on_exit_timeout_and_cancellation() -> anyhow::Result<()> {
    for reason in [
        ExitReason::Exited,
        ExitReason::TimeLimit,
        ExitReason::Canceled,
    ] {
        let root = tempfile::tempdir()?;
        let pid_path = root.path().join("child.pid");
        let source = root.path().join("parent.py");
        tokio::fs::write(&source, format!(
            "import subprocess, sys, time\ntime.sleep(0.2)\nchild = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(30)'])\nwith open('child.pid', 'w') as f: f.write(str(child.pid))\n{}\n",
            if reason == ExitReason::Exited { "print('finished')" } else { "time.sleep(30)" }
        )).await?;
        let command = CommandSpec {
            program: "python".into(),
            args: vec![source.to_string_lossy().into_owned()],
            cwd: root.path().into(),
        };
        let limits = ExecutionLimits {
            time_ms: if reason == ExitReason::TimeLimit {
                2000
            } else {
                5000
            },
            ..ExecutionLimits::default()
        };
        let cancel = Cancellation::new();
        let run = ProcessExecutor.run(&command, &[], &limits, &cancel);
        let cancel_when_started = async {
            if reason == ExitReason::Canceled {
                tokio::time::timeout(Duration::from_secs(4), async {
                    while !pid_path.is_file() {
                        tokio::time::sleep(Duration::from_millis(10)).await;
                    }
                })
                .await?;
                cancel.cancel();
            }
            anyhow::Ok(())
        };
        let (result, canceled) = tokio::join!(run, cancel_when_started);
        canceled?;
        let result = result?;
        assert_eq!(result.reason, reason);
        let pid = tokio::fs::read_to_string(&pid_path).await?.parse::<u32>()?;
        tokio::time::timeout(Duration::from_secs(3), async {
            loop {
                let mut system = sysinfo::System::new();
                let pid = sysinfo::Pid::from_u32(pid);
                system.refresh_processes(sysinfo::ProcessesToUpdate::Some(&[pid]), true);
                if system.process(pid).is_none() {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        })
        .await?;
        if reason == ExitReason::Exited {
            assert_eq!(result.exit_code, Some(0));
            assert_eq!(result.stdout.trim(), "finished");
        }
    }
    Ok(())
}

#[tokio::test]
async fn quick_children_keep_their_successful_exit_status() -> anyhow::Result<()> {
    let root = tempfile::tempdir()?;
    let command = CommandSpec {
        program: "cmd".into(),
        args: vec!["/C".into(), "exit 0".into()],
        cwd: root.path().into(),
    };
    for _ in 0..30 {
        let result = ProcessExecutor
            .run(
                &command,
                &[],
                &ExecutionLimits::default(),
                &Cancellation::new(),
            )
            .await?;
        assert_eq!(result.exit_code, Some(0));
        assert_eq!(result.reason, ExitReason::Exited);
    }
    Ok(())
}
