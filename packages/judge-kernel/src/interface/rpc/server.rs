use std::{path::PathBuf, time::Duration};

use super::{
    dispatcher::RpcContext,
    transport::{self, TransportLimits},
};
use crate::application::tasks::{Cancellation, TaskLimits};

#[derive(Debug, Clone, Copy, clap::ValueEnum)]
pub enum Transport {
    Stdio,
    Unix,
    Pipe,
}
#[derive(Debug, Clone)]
pub struct RpcServerConfig {
    pub store_root: PathBuf,
    pub workspace_roots: Vec<PathBuf>,
    pub transport: Transport,
    pub socket: Option<PathBuf>,
    pub pipe: Option<String>,
    pub tasks: TaskLimits,
    pub transport_limits: TransportLimits,
    pub shutdown_grace: Duration,
}
impl RpcServerConfig {
    #[must_use]
    pub fn stdio(store_root: PathBuf) -> Self {
        Self {
            store_root,
            workspace_roots: vec![],
            transport: Transport::Stdio,
            socket: None,
            pipe: None,
            tasks: TaskLimits::default(),
            transport_limits: TransportLimits::default(),
            shutdown_grace: Duration::from_secs(5),
        }
    }
}
async fn signal() {
    #[cfg(unix)]
    {
        if let Ok(mut terminate) =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        {
            tokio::select! { _ = tokio::signal::ctrl_c() => {}, _ = terminate.recv() => {} }
            return;
        }
    }
    let _ = tokio::signal::ctrl_c().await;
}

/// # Errors
/// Returns invalid limits, initialization, transport or shutdown failures.
pub async fn run(config: RpcServerConfig) -> Result<(), Box<dyn std::error::Error>> {
    if config.transport_limits.message_bytes == 0 || config.transport_limits.requests == 0 {
        return Err("Transport limits must be positive".into());
    }
    let context = RpcContext::open(
        &config.store_root,
        &config.workspace_roots,
        config.tasks.clone(),
    )
    .await?;
    let stopped = Cancellation::new();
    let shutdown_context = context.clone();
    let shutdown_stopped = stopped.clone();
    let grace = config.shutdown_grace;
    let lifecycle = tokio::spawn(async move {
        tokio::select! { () = signal() => shutdown_context.shutdown.cancel(), () = shutdown_context.shutdown.cancelled() => {} }
        let result = shutdown_context.tasks.shutdown(grace).await;
        shutdown_stopped.cancel();
        result
    });
    let result = match config.transport {
        Transport::Stdio => {
            transport::connection(
                tokio::io::stdin(),
                tokio::io::stdout(),
                context.clone(),
                stopped.clone(),
                config.transport_limits.clone(),
                true,
            )
            .await
        }
        Transport::Unix => {
            #[cfg(unix)]
            {
                unix(&config, context.clone(), stopped.clone()).await
            }
            #[cfg(not(unix))]
            {
                Err(std::io::Error::other(
                    "Unix sockets are unavailable on this platform",
                ))
            }
        }
        Transport::Pipe => {
            #[cfg(windows)]
            {
                pipe(&config, context.clone(), stopped.clone()).await
            }
            #[cfg(not(windows))]
            {
                Err(std::io::Error::other(
                    "Named pipes are available on Windows",
                ))
            }
        }
    };
    context.shutdown.cancel();
    lifecycle.await??;
    context.pool.close().await;
    result?;
    Ok(())
}
#[cfg(unix)]
async fn unix(
    config: &RpcServerConfig,
    context: RpcContext,
    stopped: Cancellation,
) -> std::io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let path = config
        .socket
        .as_ref()
        .ok_or_else(|| std::io::Error::other("--socket is required for unix transport"))?;
    // The context holds this store's ownership lock. Only a refused socket is stale;
    // a live endpoint, regular file or symlink must never be removed.
    remove_stale_socket(path).await?;
    let listener = tokio::net::UnixListener::bind(path)?;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))?;
    let mut connections = tokio::task::JoinSet::new();
    let result = loop {
        tokio::select! {
            () = context.shutdown.cancelled() => break Ok(()),
            connection = listener.accept(), if connections.len() < 32 => {
                let (stream, _) = match connection { Ok(stream) => stream, Err(error) => break Err(error) };
                let (reader, writer) = stream.into_split(); let context = context.clone(); let stopped = stopped.clone(); let limits = config.transport_limits.clone();
                connections.spawn(async move { transport::connection(reader, writer, context, stopped, limits, false).await });
            }
            _ = connections.join_next(), if !connections.is_empty() => {},
        }
    };
    context.shutdown.cancel();
    stopped.cancelled().await;
    while connections.join_next().await.is_some() {}
    drop(listener);
    let _ = tokio::fs::remove_file(path).await;
    result
}
#[cfg(unix)]
async fn remove_stale_socket(path: &std::path::Path) -> std::io::Result<()> {
    use std::os::unix::fs::FileTypeExt;
    let metadata = match tokio::fs::symlink_metadata(path).await {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(error),
    };
    if !metadata.file_type().is_socket() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::AlreadyExists,
            "RPC endpoint exists and is not a socket",
        ));
    }
    match tokio::net::UnixStream::connect(path).await {
        Ok(_) => Err(std::io::Error::new(
            std::io::ErrorKind::AddrInUse,
            "RPC endpoint already accepts connections",
        )),
        Err(error) if error.kind() == std::io::ErrorKind::ConnectionRefused => {
            tokio::fs::remove_file(path).await
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error),
    }
}
#[cfg(windows)]
async fn pipe(
    config: &RpcServerConfig,
    context: RpcContext,
    stopped: Cancellation,
) -> std::io::Result<()> {
    use tokio::net::windows::named_pipe::ServerOptions;
    let path = config
        .pipe
        .as_ref()
        .ok_or_else(|| std::io::Error::other("--pipe is required for pipe transport"))?;
    if !path.starts_with(r"\\.\pipe\") {
        return Err(std::io::Error::other(
            "Pipe must use a local \\\\.\\pipe\\ name",
        ));
    }
    let mut server = ServerOptions::new()
        .first_pipe_instance(true)
        .reject_remote_clients(true)
        .create(path)?;
    let mut connections = tokio::task::JoinSet::new();
    loop {
        tokio::select! {
            () = context.shutdown.cancelled() => break,
            result = server.connect(), if connections.len() < 32 => {
                result?;
                let next = ServerOptions::new().reject_remote_clients(true).create(path)?;
                let connected = std::mem::replace(&mut server, next);
                let (reader, writer) = tokio::io::split(connected);
                let context = context.clone(); let stopped = stopped.clone(); let limits = config.transport_limits.clone();
                connections.spawn(async move { transport::connection(reader, writer, context, stopped, limits, false).await });
            }
            _ = connections.join_next(), if !connections.is_empty() => {},
        }
    }
    context.shutdown.cancel();
    stopped.cancelled().await;
    while connections.join_next().await.is_some() {}
    Ok(())
}
