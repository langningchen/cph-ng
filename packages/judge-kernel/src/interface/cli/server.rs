use std::{path::PathBuf, time::Duration};

use crate::{
    application::tasks::TaskLimits,
    interface::rpc::{
        server::{RpcServerConfig, Transport},
        transport::TransportLimits,
    },
};

#[derive(Debug, Clone, clap::Args)]
pub struct ServeArgs {
    #[arg(long, value_enum, default_value = "stdio")]
    pub transport: Transport,
    #[arg(long)]
    pub socket: Option<PathBuf>,
    #[arg(long)]
    pub pipe: Option<String>,
    #[arg(long, default_value_t = 2)]
    pub workers: usize,
    #[arg(long, default_value_t = 1)]
    pub stress_workers: usize,
    #[arg(long, default_value_t = 128)]
    pub max_tasks: usize,
    #[arg(long, default_value_t = 4 * 1024 * 1024)]
    pub max_message_bytes: usize,
    #[arg(long, default_value_t = 32)]
    pub max_requests: usize,
    #[arg(long, default_value_t = 5000)]
    pub shutdown_grace_ms: u64,
}
pub async fn run(
    store_root: PathBuf,
    workspace_roots: Vec<PathBuf>,
    task_timeout_ms: u64,
    args: ServeArgs,
) -> Result<(), Box<dyn std::error::Error>> {
    crate::interface::rpc::server::run(RpcServerConfig {
        store_root,
        workspace_roots,
        transport: args.transport,
        socket: args.socket,
        pipe: args.pipe,
        tasks: TaskLimits {
            workers: args.workers,
            stress_workers: args.stress_workers,
            queued: args.max_tasks,
            timeout: Duration::from_millis(task_timeout_ms),
        },
        transport_limits: TransportLimits {
            message_bytes: args.max_message_bytes,
            requests: args.max_requests,
            ..TransportLimits::default()
        },
        shutdown_grace: Duration::from_millis(args.shutdown_grace_ms),
    })
    .await
}

impl ServeArgs {
    pub(super) fn validate(&self) -> Result<(), crate::application::tasks::TaskFailure> {
        use crate::application::tasks::TaskFailure;
        if self.workers == 0
            || self.stress_workers == 0
            || self.max_tasks == 0
            || self.max_message_bytes == 0
            || self.max_requests == 0
        {
            return Err(TaskFailure::invalid(
                "Worker, queue and transport limits must be positive",
            ));
        }
        match self.transport {
            Transport::Stdio if self.socket.is_some() || self.pipe.is_some() => Err(
                TaskFailure::invalid("stdio transport does not accept --socket or --pipe"),
            ),
            Transport::Unix if !cfg!(unix) || self.socket.is_none() || self.pipe.is_some() => Err(
                TaskFailure::invalid("unix transport requires Unix, --socket and no --pipe"),
            ),
            Transport::Pipe if !cfg!(windows) || self.pipe.is_none() || self.socket.is_some() => {
                Err(TaskFailure::invalid(
                    "pipe transport requires Windows, --pipe and no --socket",
                ))
            }
            Transport::Pipe
                if self
                    .pipe
                    .as_ref()
                    .is_some_and(|p| !p.starts_with(r"\\.\pipe\")) =>
            {
                Err(TaskFailure::invalid(
                    r"Pipe must use a local \\.\pipe\ name",
                ))
            }
            _ => Ok(()),
        }
    }
}
