//! Local Companion gateway. Browser clients never receive kernel file/execute methods.
use crate::{
    application::{error::ErrorCode, tasks::TaskFailure},
    infrastructure::config::router as config,
};
use serde_json::{Value, json};
mod http;
mod state;
mod websocket;

use std::{path::PathBuf, time::Duration};

use clap::{Args, Subcommand};
use tokio::net::TcpListener;

#[derive(Debug, Args)]
pub struct RouterArgs {
    #[command(subcommand)]
    pub action: RouterAction,
}
#[derive(Debug, Subcommand)]
pub enum RouterAction {
    /// Run the local HTTP/WebSocket gateway shared by editor windows.
    Serve,
    /// Print connection details, including the browser pairing token, as JSON.
    Info,
    /// Change the listening port while the gateway is stopped.
    #[command(hide = true)]
    Set {
        #[arg(long, value_parser = clap::value_parser!(u16).range(1..))]
        port: u16,
    },
}

/// # Errors
/// Reports invalid configuration, occupied ports or gateway I/O errors.
pub async fn run(
    root: PathBuf,
    args: RouterArgs,
    quiet: bool,
) -> Result<Option<Value>, TaskFailure> {
    let root = root.join("router");
    match args.action {
        RouterAction::Info => return Ok(Some(json!(config::load(&root)?))),
        RouterAction::Set { port } => return Ok(Some(json!(config::set_port(&root, port)?))),
        RouterAction::Serve => {
            std::fs::create_dir_all(&root).map_err(TaskFailure::internal)?;
            let _lock = config::lock(&root)?;
            let config = config::load(&root)?;
            let listener = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, config.port))
                .await
                .map_err(|error| {
                    TaskFailure::new(
                        if error.kind() == std::io::ErrorKind::AddrInUse {
                            ErrorCode::Busy
                        } else {
                            ErrorCode::ExecutionFailed
                        },
                        format!("Cannot listen on 127.0.0.1:{}: {error}", config.port),
                    )
                })?;
            let state = state::Shared::new(config.token);
            if !quiet {
                eprintln!("Companion gateway listening on 127.0.0.1:{}", config.port);
            }
            axum::serve(listener, http::app(state.clone()))
                .with_graceful_shutdown(shutdown(state))
                .await
                .map_err(TaskFailure::internal)?;
        }
    }
    Ok(None)
}

async fn shutdown(state: state::Shared) {
    let signal = async {
        #[cfg(unix)]
        if let Ok(mut terminate) =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        {
            tokio::select! { _ = tokio::signal::ctrl_c() => {}, _ = terminate.recv() => {} }
            return;
        }
        let _ = tokio::signal::ctrl_c().await;
    };
    let idle = async {
        let mut last_editor = tokio::time::Instant::now();
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            let mut inner = state.inner.lock().await;
            inner.expire();
            if inner.editor_count() > 0 {
                last_editor = tokio::time::Instant::now();
            }
            if last_editor.elapsed() >= Duration::from_secs(60) {
                return;
            }
        }
    };
    tokio::select! { () = signal => {}, () = idle => {} }
    state.stopped.cancel();
}
