use crate::application::error::ErrorCode;
use crate::domain::JudgeVerdict;
use crate::ports::judge::CheckData;
use std::{
    path::Path,
    sync::{
        Arc,
        atomic::{AtomicU64, AtomicUsize},
    },
    time::{Duration, Instant},
};

use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

use super::executor::{ProcessExecutor, ProcessGuard, capture, monitor, sampled_memory};
pub use crate::domain::checker::{CheckerMode, compare};
use crate::{
    application::{
        judge::execution_verdict,
        tasks::{Cancellation, TaskFailure},
    },
    ports::executor::{CommandSpec, ExecutionLimits, ExecutionResult, ExecutorPort, ExitReason},
};

/// # Errors
/// Returns storage/execution errors, cancellation, or `CheckerFailed` when the checker
/// fails or exceeds its limits.
pub async fn special_check(
    repo: &dyn crate::ports::ProblemRepository,
    checker: &CommandSpec,
    directory: &Path,
    data: CheckData<'_>,
    limits: &ExecutionLimits,
    cancel: &Cancellation,
) -> Result<(JudgeVerdict, String), TaskFailure> {
    let paths = [
        directory.join("input.txt"),
        directory.join("output.txt"),
        directory.join("answer.txt"),
    ];
    for (path, content) in paths.iter().zip([data.input, data.actual, data.expected]) {
        repo.write_owned(path, content.as_bytes())
            .await
            .map_err(TaskFailure::internal)?;
    }
    let mut command = checker.clone();
    command
        .args
        .extend(paths.iter().map(|path| path.to_string_lossy().into_owned()));
    let result = ProcessExecutor.run(&command, &[], limits, cancel).await?;
    if result.reason == ExitReason::Canceled {
        return Err(TaskFailure::canceled());
    }
    if result.reason != ExitReason::Exited {
        return Err(TaskFailure {
            code: ErrorCode::CheckerFailed,
            message: "Special checker exceeded its resource limit".into(),
            data: Some(serde_json::to_value(result).map_err(TaskFailure::internal)?),
        });
    }
    let verdict = match result.exit_code {
        Some(0) => JudgeVerdict::Accepted,
        Some(1) => JudgeVerdict::WrongAnswer,
        Some(2) => JudgeVerdict::PresentationError,
        Some(7) => JudgeVerdict::PartiallyCorrect,
        _ => {
            return Err(TaskFailure {
                code: ErrorCode::CheckerFailed,
                message: "Special checker failed".into(),
                data: Some(serde_json::to_value(result).map_err(TaskFailure::internal)?),
            });
        }
    };
    Ok((verdict, result.stderr))
}

async fn relay<R: AsyncRead + Unpin, W: AsyncWrite + Unpin>(
    mut reader: R,
    mut writer: W,
    total: Arc<AtomicUsize>,
    limit: usize,
    exceeded: Cancellation,
) -> std::io::Result<Vec<u8>> {
    use std::sync::atomic::Ordering;
    let mut transcript = Vec::new();
    let mut buffer = vec![0_u8; 8192];
    let mut closed = false;
    loop {
        let count = reader.read(&mut buffer).await?;
        if count == 0 {
            break;
        }
        let used = total.fetch_add(count, Ordering::Relaxed);
        let accepted = count.min(limit.saturating_sub(used));
        if let Some(chunk) = buffer.get(..accepted) {
            transcript.extend_from_slice(chunk);
            if !closed && writer.write_all(chunk).await.is_err() {
                closed = true;
            }
        }
        if used.saturating_add(count) > limit {
            exceeded.cancel();
            break;
        }
    }
    let _ = writer.shutdown().await;
    Ok(transcript)
}

/// # Errors
/// Returns process-start or pipe errors, cancellation-related I/O errors, or
/// `CheckerFailed` when the interactor fails or exceeds its limits.
pub async fn interactive(
    solution: &CommandSpec,
    interactor: &CommandSpec,
    limits: &ExecutionLimits,
    cancel: &Cancellation,
) -> Result<(ExecutionResult, JudgeVerdict), TaskFailure> {
    let started = Instant::now();
    let mut solution = ProcessGuard::spawn(solution, limits)?;
    let mut interactor = ProcessGuard::spawn(interactor, limits)?;
    let missing = || TaskFailure::new(ErrorCode::InternalError, "Missing interactive pipe");
    let exceeded = Cancellation::new();
    let to_solution = relay(
        interactor.child.stdout.take().ok_or_else(missing)?,
        solution.child.stdin.take().ok_or_else(missing)?,
        Arc::new(AtomicUsize::new(0)),
        limits.output_bytes,
        exceeded.clone(),
    );
    let total = Arc::new(AtomicUsize::new(0));
    let from_solution = relay(
        solution.child.stdout.take().ok_or_else(missing)?,
        interactor.child.stdin.take().ok_or_else(missing)?,
        total.clone(),
        limits.output_bytes,
        exceeded.clone(),
    );
    let errors = capture(
        solution.child.stderr.take().ok_or_else(missing)?,
        total.clone(),
        limits.output_bytes,
        exceeded.clone(),
    );
    let checker_errors = capture(
        interactor.child.stderr.take().ok_or_else(missing)?,
        total,
        limits.output_bytes,
        exceeded.clone(),
    );
    let io = async { tokio::join!(from_solution, errors, checker_errors, to_solution) };
    tokio::pin!(io);
    let mut buffers = None;
    let mut solution_status = None;
    let mut interactor_status = None;
    let timeout = tokio::time::sleep(Duration::from_millis(limits.time_ms));
    tokio::pin!(timeout);
    let peak = Arc::new(AtomicU64::new(0));
    let solution_monitor = monitor(solution.pid(), limits, peak.clone());
    let interactor_monitor = monitor(interactor.pid(), limits, Arc::new(AtomicU64::new(0)));
    tokio::pin!(solution_monitor, interactor_monitor);
    let (reason, memory) = loop {
        if solution_status.is_some() && interactor_status.is_some() {
            break (ExitReason::Exited, 0);
        }
        tokio::select! {
            biased;
            () = cancel.cancelled() => break (ExitReason::Canceled, 0),
            () = exceeded.cancelled() => break (ExitReason::OutputLimit, 0),
            () = &mut timeout => break (ExitReason::TimeLimit, 0),
            usage = &mut solution_monitor => break usage,
            _ = &mut interactor_monitor => return Err(TaskFailure::new(ErrorCode::CheckerFailed, "Interactor exceeded its resource limit")),
            output = &mut io, if buffers.is_none() => { buffers = Some(output); },
            status = solution.child.wait(), if solution_status.is_none() => {
                let status = status.map_err(TaskFailure::internal)?;
                if !status.success() { interactor.kill_tree(); }
                solution_status = Some(status);
            },
            status = interactor.child.wait(), if interactor_status.is_none() => {
                let status = status.map_err(TaskFailure::internal)?;
                if !status.success() { solution.kill_tree(); }
                interactor_status = Some(status);
            },
        }
    };
    solution.kill_tree();
    interactor.kill_tree();
    if solution_status.is_none() {
        let _ = solution.child.wait().await;
    }
    if interactor_status.is_none() {
        let _ = interactor.child.wait().await;
    }
    if buffers.is_none() {
        buffers = tokio::time::timeout(Duration::from_secs(1), &mut io)
            .await
            .ok();
    }
    let (output, errors, checker_errors, _) =
        buffers.unwrap_or_else(|| (Ok(vec![]), Ok(vec![]), Ok(vec![]), Ok(vec![])));
    let checker_errors =
        String::from_utf8_lossy(&checker_errors.map_err(TaskFailure::internal)?).into_owned();
    let result = ExecutionResult {
        exit_code: solution_status.and_then(|status| status.code()),
        reason,
        stdout: String::from_utf8_lossy(&output.map_err(TaskFailure::internal)?).into_owned(),
        stderr: String::from_utf8_lossy(&errors.map_err(TaskFailure::internal)?).into_owned(),
        time_ms: u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX),
        memory_mb: sampled_memory(memory.max(peak.load(std::sync::atomic::Ordering::Relaxed))),
    };
    let verdict = interactor_verdict(
        &result,
        interactor_status.and_then(|status| status.code()),
        &checker_errors,
    )?;
    Ok((result, verdict))
}
fn interactor_verdict(
    result: &ExecutionResult,
    code: Option<i32>,
    checker_errors: &str,
) -> Result<JudgeVerdict, TaskFailure> {
    let verdict = match code {
        Some(1) => JudgeVerdict::WrongAnswer,
        Some(2) => JudgeVerdict::PresentationError,
        Some(0) => execution_verdict(result),
        Some(code) if code != 0 => {
            return Err(TaskFailure {
                code: ErrorCode::CheckerFailed,
                message: "Interactor failed".into(),
                data: Some(serde_json::json!({"exit_code": code, "stderr": checker_errors})),
            });
        }
        _ if result.reason != ExitReason::Exited || result.exit_code != Some(0) => {
            execution_verdict(result)
        }
        _ => {
            return Err(TaskFailure {
                code: ErrorCode::CheckerFailed,
                message: "Interactor failed".into(),
                data: Some(serde_json::json!({"stderr": checker_errors})),
            });
        }
    };
    Ok(verdict)
}

#[derive(Debug, Default)]
pub struct BuiltinChecker;
#[async_trait::async_trait]
impl crate::ports::judge::CheckerPort for BuiltinChecker {
    async fn interactive(
        &self,
        solution: &CommandSpec,
        interactor: &CommandSpec,
        limits: &ExecutionLimits,
        cancel: &Cancellation,
    ) -> Result<(ExecutionResult, JudgeVerdict), TaskFailure> {
        interactive(solution, interactor, limits, cancel).await
    }
    async fn special_check(
        &self,
        repo: &dyn crate::ports::ProblemRepository,
        checker: &CommandSpec,
        directory: &Path,
        data: CheckData<'_>,
        limits: &ExecutionLimits,
        cancel: &Cancellation,
    ) -> Result<(JudgeVerdict, String), TaskFailure> {
        special_check(repo, checker, directory, data, limits, cancel).await
    }
}
