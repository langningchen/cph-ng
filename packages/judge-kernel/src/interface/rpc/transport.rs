use super::protocol::EventMethod;
use crate::application::error::ErrorCode;
use crate::application::method::Method;
use crate::application::tasks::TaskEventKind;
use std::{io, sync::Arc, time::Duration};

use serde_json::{Value, json};
use tokio::{
    io::{AsyncBufRead, AsyncBufReadExt, AsyncRead, AsyncWrite, AsyncWriteExt, BufReader},
    sync::{Semaphore, mpsc},
    task::JoinSet,
};

use super::{
    dispatcher::{RpcContext, capabilities, dispatch},
    protocol::{PROTOCOL_VERSION, RpcError, RpcResponse, parse_value},
};
use crate::application::tasks::{Cancellation, TaskEvent};

#[derive(Debug, Clone)]
pub struct TransportLimits {
    pub message_bytes: usize,
    pub requests: usize,
    pub write_timeout: Duration,
}
impl Default for TransportLimits {
    fn default() -> Self {
        Self {
            message_bytes: 4 * 1024 * 1024,
            requests: 32,
            write_timeout: Duration::from_secs(5),
        }
    }
}

/// # Errors
/// Returns an I/O error on a failed read. An oversized frame is returned as an inner RPC
/// error after draining that frame.
pub async fn read_frame<R: AsyncBufRead + Unpin>(
    reader: &mut R,
    limit: usize,
) -> io::Result<Option<Result<Vec<u8>, RpcError>>> {
    let mut frame = Vec::new();
    let mut oversized = false;
    loop {
        let bytes = reader.fill_buf().await?;
        if bytes.is_empty() {
            return if frame.is_empty() && !oversized {
                Ok(None)
            } else if oversized {
                Ok(Some(Err(RpcError::new(
                    ErrorCode::InvalidRequest,
                    "Message exceeds size limit",
                ))))
            } else {
                Ok(Some(Ok(frame)))
            };
        }
        let newline = bytes.iter().position(|byte| *byte == b'\n');
        let count = newline.map_or(bytes.len(), |position| position + 1);
        if !oversized {
            if frame.len().saturating_add(count) > limit {
                oversized = true;
                frame.clear();
            } else if let Some(bytes) = bytes.get(..count) {
                frame.extend_from_slice(bytes);
            }
        }
        reader.consume(count);
        if newline.is_some() {
            return Ok(Some(if oversized {
                Err(RpcError::new(
                    ErrorCode::InvalidRequest,
                    "Message exceeds size limit",
                ))
            } else {
                Ok(frame)
            }));
        }
    }
}
fn notification(method: EventMethod, params: &Value) -> Value {
    json!({"jsonrpc": "2.0", "method": method, "params": params})
}
fn task_event(event: &TaskEvent) -> Value {
    let method = match event.kind() {
        TaskEventKind::Finished => EventMethod::TaskFinished,
        TaskEventKind::Progress => EventMethod::TaskProgress,
        TaskEventKind::Running => EventMethod::TaskStarted,
        TaskEventKind::Queued => EventMethod::TaskQueued,
    };
    notification(method, &json!(event))
}
async fn one(value: Value, context: &RpcContext) -> (Option<Value>, bool) {
    let id = value
        .get("id")
        .and_then(|id| serde_json::from_value(id.clone()).ok());
    let request = match parse_value(value) {
        Ok(request) => request,
        Err(error) => return (Some(json!(RpcResponse::error(id, error))), false),
    };
    let notification = request.notification;
    let id = request.id.clone();
    let (response, shutdown) =
        tokio::time::timeout(Duration::from_secs(30), dispatch(request, context))
            .await
            .unwrap_or_else(|_| {
                (
                    RpcResponse::error(
                        id,
                        RpcError::new(ErrorCode::ExecutionFailed, "Request timed out"),
                    ),
                    false,
                )
            });
    (
        if notification {
            None
        } else {
            Some(json!(response))
        },
        shutdown,
    )
}
async fn handle(frame: Result<Vec<u8>, RpcError>, context: &RpcContext) -> (Option<Value>, bool) {
    let data = frame.and_then(|frame| {
        serde_json::from_slice::<Value>(&frame)
            .map_err(|_| RpcError::new(ErrorCode::ParseError, "Parse error"))
    });
    let value = match data {
        Ok(value) => value,
        Err(error) => return (Some(json!(RpcResponse::error(None, error))), false),
    };
    if let Value::Array(values) = value {
        if values.is_empty() || values.len() > 128 {
            return (
                Some(json!(RpcResponse::error(
                    None,
                    RpcError::new(ErrorCode::InvalidRequest, "Invalid batch size")
                ))),
                false,
            );
        }
        let mut responses = Vec::new();
        let mut shutdown = false;
        for value in values {
            let (response, stop) = one(value, context).await;
            if let Some(response) = response {
                responses.push(response);
            }
            shutdown |= stop;
        }
        (
            if responses.is_empty() {
                None
            } else {
                Some(json!(responses))
            },
            shutdown,
        )
    } else {
        one(value, context).await
    }
}

/// # Errors
/// Returns transport read/write, timeout or spawned-writer errors.
pub async fn connection<R, W>(
    reader: R,
    writer: W,
    context: RpcContext,
    stopped: Cancellation,
    limits: TransportLimits,
    stdio: bool,
) -> io::Result<()>
where
    R: AsyncRead + Send + Unpin + 'static,
    W: AsyncWrite + Send + Unpin + 'static,
{
    let mut events = context.tasks.subscribe();
    let (output, mut outgoing) = mpsc::channel::<Value>(64);
    let write_timeout = limits.write_timeout;
    let writer_task = tokio::spawn(async move {
        let mut writer = writer;
        while let Some(value) = outgoing.recv().await {
            let mut bytes = serde_json::to_vec(&value).map_err(io::Error::other)?;
            bytes.push(b'\n');
            tokio::time::timeout(write_timeout, async {
                writer.write_all(&bytes).await?;
                writer.flush().await
            })
            .await
            .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "RPC writer timed out"))??;
        }
        Ok::<_, io::Error>(())
    });
    let ready = notification(
        EventMethod::ServerReady,
        &json!({"protocol_version": PROTOCOL_VERSION, "server_version": env!("CARGO_PKG_VERSION"), "capabilities": capabilities()}),
    );
    output.send(ready).await.map_err(io::Error::other)?;
    let (input, mut incoming) = mpsc::channel(1);
    let reader_task = tokio::spawn(async move {
        let mut reader = BufReader::new(reader);
        while let Ok(Some(frame)) = read_frame(&mut reader, limits.message_bytes).await {
            if input.send(frame).await.is_err() {
                break;
            }
        }
    });
    let permits = Arc::new(Semaphore::new(limits.requests));
    let mut requests = JoinSet::new();
    let mut closing = false;
    let mut disconnected = false;
    loop {
        tokio::select! {
            biased;
            () = stopped.cancelled() => {
                if !closing { let _ = output.send(notification(EventMethod::ServerShuttingDown, &json!({"reason": "shutdown"}))).await; }
                while let Ok(event) = events.try_recv() { if output.send(task_event(&event)).await.is_err() { break; } }
                break;
            }
            () = context.shutdown.cancelled(), if !closing => {
                closing = true; reader_task.abort();
                if output.send(notification(EventMethod::ServerShuttingDown, &json!({"reason": "shutdown"}))).await.is_err() { break; }
            }
            event = events.recv() => {
                let value = match event {
                    Ok(event) => task_event(&event),
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(count)) => notification(EventMethod::ServerEventsLost, &json!({"count": count, "recover_with": Method::TaskEventsSince})),
                    Err(_) => break,
                };
                if output.send(value).await.is_err() { break; }
            }
            frame = incoming.recv(), if !closing && !disconnected && requests.len() < limits.requests => {
                let Some(frame) = frame else {
                    disconnected = true;
                    if stdio {
                        // EOF ends the owning stdio session. Socket disconnection leaves tasks running.
                        context.shutdown.cancel();
                    } else { break; }
                    continue;
                };
                let permit = permits.clone().acquire_owned().await.map_err(io::Error::other)?;
                let context = context.clone(); let output = output.clone();
                requests.spawn(async move {
                    let _permit = permit;
                    let (response, shutdown) = handle(frame, &context).await;
                    if let Some(response) = response { let _ = output.send(response).await; }
                    if shutdown { context.shutdown.cancel(); }
                });
            }
            _ = requests.join_next(), if !requests.is_empty() => {},
        }
    }
    reader_task.abort();
    requests.abort_all();
    while requests.join_next().await.is_some() {}
    drop(output);
    tokio::time::timeout(write_timeout, writer_task)
        .await
        .map_err(|_| io::Error::new(io::ErrorKind::TimedOut, "Writer did not stop"))?
        .map_err(io::Error::other)?
}
