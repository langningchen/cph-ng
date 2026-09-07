//! Child process supervision. No shell is involved in compilation or execution.
use crate::application::error::ErrorCode;
use std::{
    process::Stdio,
    sync::{
        Arc,
        atomic::{AtomicU64, AtomicUsize, Ordering},
    },
    time::{Duration, Instant},
};

use tokio::{
    io::{AsyncRead, AsyncReadExt, AsyncWriteExt},
    process::{Child, Command},
};

use crate::{
    application::tasks::{Cancellation, TaskFailure},
    ports::executor::{CommandSpec, ExecutionLimits, ExecutionResult, ExecutorPort, ExitReason},
};

#[derive(Debug, Clone, Default)]
pub struct ProcessExecutor;

#[derive(Debug)]
pub struct ProcessGuard {
    pub child: Child,
    pid: u32,
}
impl ProcessGuard {
    /// # Errors
    /// Returns execution failure if the configured process cannot start or exits before its
    /// identifier can be captured.
    pub fn spawn(spec: &CommandSpec, limits: &ExecutionLimits) -> Result<Self, TaskFailure> {
        let mut command = Command::new(&spec.program);
        // prlimit applies hard file/core limits before exec without unsafe pre_exec hooks.
        if cfg!(target_os = "linux") && std::path::Path::new("/usr/bin/prlimit").is_file() {
            command = Command::new("/usr/bin/prlimit");
            command
                .args([
                    format!("--fsize={}", limits.file_bytes),
                    "--core=0".into(),
                    "--".into(),
                ])
                .arg(&spec.program);
        }
        command
            .args(&spec.args)
            .current_dir(&spec.cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        #[cfg(unix)]
        command.process_group(0);
        let child = command.spawn().map_err(|error| {
            eprintln!(
                "Could not start configured program {}: {error}",
                spec.program.display()
            );
            TaskFailure::new(
                ErrorCode::ExecutionFailed,
                "Could not start configured compiler or runtime",
            )
        })?;
        let pid = child.id().ok_or_else(|| {
            TaskFailure::new(ErrorCode::ExecutionFailed, "Child exited during startup")
        })?;
        Ok(Self { child, pid })
    }
    #[must_use]
    pub fn pid(&self) -> u32 {
        self.pid
    }
    pub fn kill_tree(&mut self) {
        #[cfg(unix)]
        if let Some(pid) =
            rustix::process::Pid::from_raw(i32::try_from(self.pid).unwrap_or(i32::MAX))
        {
            let _ = rustix::process::kill_process_group(pid, rustix::process::Signal::KILL);
        }
        #[cfg(windows)]
        {
            let _ = std::process::Command::new("taskkill")
                .args(["/PID", &self.pid.to_string(), "/T", "/F"])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
        }
        let _ = self.child.start_kill();
    }
}
impl Drop for ProcessGuard {
    fn drop(&mut self) {
        self.kill_tree();
    }
}

/// # Errors
/// Returns an I/O error if reading the process stream fails; exceeding the output limit
/// signals cancellation and retains only the allowed prefix.
pub async fn capture<R: AsyncRead + Unpin>(
    mut reader: R,
    total: Arc<AtomicUsize>,
    limit: usize,
    exceeded: Cancellation,
) -> std::io::Result<Vec<u8>> {
    let mut output = Vec::new();
    let mut chunk = vec![0_u8; 8192];
    loop {
        let count = reader.read(&mut chunk).await?;
        if count == 0 {
            break;
        }
        let used = total.fetch_add(count, Ordering::Relaxed);
        let accepted = count.min(limit.saturating_sub(used));
        if let Some(bytes) = chunk.get(..accepted) {
            output.extend_from_slice(bytes);
        }
        if used.saturating_add(count) > limit {
            exceeded.cancel();
            break;
        }
    }
    Ok(output)
}

pub async fn monitor(
    pid: u32,
    limits: &ExecutionLimits,
    peak: Arc<AtomicU64>,
) -> (ExitReason, u64) {
    loop {
        let (memory_kb, processes) = process_usage(pid).await;
        peak.fetch_max(memory_kb.div_ceil(1024), Ordering::Relaxed);
        if memory_kb > limits.memory_mb.saturating_mul(1024) {
            return (ExitReason::MemoryLimit, memory_kb.div_ceil(1024));
        }
        if processes > limits.processes {
            return (ExitReason::ProcessLimit, memory_kb.div_ceil(1024));
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
}

#[cfg(target_os = "linux")]
pub async fn process_usage(pid: u32) -> (u64, usize) {
    let Ok(mut entries) = tokio::fs::read_dir("/proc").await else {
        return (0, 0);
    };
    let mut memory = 0;
    let mut processes = 0;
    while let Ok(Some(entry)) = entries.next_entry().await {
        if entry.file_name().to_string_lossy().parse::<u32>().is_err() {
            continue;
        }
        let Ok(stat) = tokio::fs::read_to_string(entry.path().join("stat")).await else {
            continue;
        };
        let group = stat
            .rsplit_once(") ")
            .and_then(|(_, fields)| fields.split_whitespace().nth(2))
            .and_then(|value| value.parse::<u32>().ok());
        if group != Some(pid) {
            continue;
        }
        processes += 1;
        if let Ok(status) = tokio::fs::read_to_string(entry.path().join("status")).await {
            memory += status
                .lines()
                .find(|line| line.starts_with("VmHWM:"))
                .and_then(|line| line.split_whitespace().nth(1))
                .and_then(|value| value.parse::<u64>().ok())
                .unwrap_or(0);
        }
    }
    (memory, processes)
}
/// Portable process-tree accounting used on macOS and Windows.
pub async fn process_tree_usage(pid: u32) -> (u64, usize) {
    tokio::task::spawn_blocking(move || {
        let mut system = sysinfo::System::new();
        system.refresh_processes_specifics(
            sysinfo::ProcessesToUpdate::All,
            true,
            sysinfo::ProcessRefreshKind::nothing().with_memory(),
        );
        let mut descendants = std::collections::HashSet::from([sysinfo::Pid::from_u32(pid)]);
        loop {
            let before = descendants.len();
            for (id, process) in system.processes() {
                if process
                    .parent()
                    .is_some_and(|parent| descendants.contains(&parent))
                {
                    descendants.insert(*id);
                }
            }
            if descendants.len() == before {
                break;
            }
        }
        let processes: Vec<_> = descendants
            .iter()
            .filter_map(|id| system.process(*id))
            .collect();
        let memory = processes
            .iter()
            .map(|process| process.memory())
            .sum::<u64>()
            .div_ceil(1024);
        (memory, processes.len())
    })
    .await
    .unwrap_or((0, 0))
}
#[cfg(not(target_os = "linux"))]
pub async fn process_usage(pid: u32) -> (u64, usize) {
    process_tree_usage(pid).await
}

#[async_trait::async_trait]
impl ExecutorPort for ProcessExecutor {
    async fn run(
        &self,
        spec: &CommandSpec,
        input: &[u8],
        limits: &ExecutionLimits,
        cancel: &Cancellation,
    ) -> Result<ExecutionResult, TaskFailure> {
        if cancel.is_canceled() {
            return Err(TaskFailure::canceled());
        }
        let start = Instant::now();
        let mut process = ProcessGuard::spawn(spec, limits)?;
        let mut stdin = process
            .child
            .stdin
            .take()
            .ok_or_else(|| TaskFailure::new(ErrorCode::InternalError, "Missing child stdin"))?;
        let stdout =
            process.child.stdout.take().ok_or_else(|| {
                TaskFailure::new(ErrorCode::InternalError, "Missing child stdout")
            })?;
        let stderr =
            process.child.stderr.take().ok_or_else(|| {
                TaskFailure::new(ErrorCode::InternalError, "Missing child stderr")
            })?;
        let exceeded = Cancellation::new();
        let total = Arc::new(AtomicUsize::new(0));
        let output = capture(stdout, total.clone(), limits.output_bytes, exceeded.clone());
        let errors = capture(stderr, total, limits.output_bytes, exceeded.clone());
        let write = async {
            let _ = stdin.write_all(input).await;
            drop(stdin);
        };
        let io = async { tokio::join!(output, errors, write) };
        tokio::pin!(io);
        let mut buffers = None;
        let pid = process.pid;
        let peak_memory = Arc::new(AtomicU64::new(0));
        let memory = monitor(pid, limits, peak_memory.clone());
        tokio::pin!(memory);
        let timeout = tokio::time::sleep(Duration::from_millis(limits.time_ms));
        tokio::pin!(timeout);
        let (status, reason, peak) = loop {
            tokio::select! {
                biased;
                () = cancel.cancelled() => break (None, ExitReason::Canceled, 0),
                () = exceeded.cancelled() => break (None, ExitReason::OutputLimit, 0),
                () = &mut timeout => break (None, ExitReason::TimeLimit, 0),
                (reason, peak) = &mut memory => break (None, reason, peak),
                result = &mut io, if buffers.is_none() => { buffers = Some(result); },
                status = process.child.wait() => {
                    let status = status.map_err(TaskFailure::internal)?;
                    break (Some(status), ExitReason::Exited, 0);
                }
            }
        };
        process.kill_tree();
        if status.is_none() {
            let _ = process.child.wait().await;
        }
        if buffers.is_none() {
            buffers = tokio::time::timeout(Duration::from_secs(1), &mut io)
                .await
                .ok();
        }
        let (stdout, stderr, ()) = buffers.unwrap_or_else(|| (Ok(Vec::new()), Ok(Vec::new()), ()));
        let stdout = stdout.map_err(TaskFailure::internal)?;
        let stderr = stderr.map_err(TaskFailure::internal)?;
        let mut reason = reason;
        if exceeded.is_canceled() && reason == ExitReason::Exited {
            reason = ExitReason::OutputLimit;
        }
        #[cfg(unix)]
        if status.as_ref().is_some_and(|status| {
            use std::os::unix::process::ExitStatusExt;
            status.signal() == Some(rustix::process::Signal::XFSZ.as_raw())
        }) {
            reason = ExitReason::OutputLimit;
        }
        Ok(ExecutionResult {
            exit_code: status.and_then(|status| status.code()),
            reason,
            stdout: String::from_utf8_lossy(&stdout).into_owned(),
            stderr: String::from_utf8_lossy(&stderr).into_owned(),
            time_ms: u64::try_from(start.elapsed().as_millis()).unwrap_or(u64::MAX),
            memory_mb: sampled_memory(peak.max(peak_memory.load(Ordering::Relaxed))),
        })
    }
}

// Zero is the accumulator sentinel: no usable resident-memory sample was obtained.
pub(super) fn sampled_memory(peak_mb: u64) -> Option<u64> {
    (cfg!(any(target_os = "linux", target_os = "macos", windows)) && peak_mb > 0).then_some(peak_mb)
}
