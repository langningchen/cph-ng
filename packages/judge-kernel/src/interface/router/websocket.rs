use super::state::{Client, Role, Shared};
use crate::application::tasks::Cancellation;
use axum::extract::ws::{Message, WebSocket};
use serde_json::{Value, json};
use std::time::Duration;
use tokio::sync::mpsc;
use uuid::Uuid;

fn response(id: &Value, result: Result<Value, &str>) -> Value {
    match result {
        Ok(result) => json!({"jsonrpc":"2.0","id":id,"result":result}),
        Err(message) => json!({"jsonrpc":"2.0","id":id,"error":{"code":-32602,"message":message}}),
    }
}
async fn send(socket: &mut WebSocket, value: Value) -> bool {
    send_encoded(socket, &value.to_string()).await
}
async fn send_encoded(socket: &mut WebSocket, value: &str) -> bool {
    matches!(
        tokio::time::timeout(
            Duration::from_secs(5),
            socket.send(Message::Text(value.to_owned()))
        )
        .await,
        Ok(Ok(()))
    )
}
async fn hello(socket: &mut WebSocket, state: &Shared, browser_origin: bool) -> Option<Role> {
    let frame = tokio::time::timeout(Duration::from_secs(5), socket.recv())
        .await
        .ok()??
        .ok()?;
    let Message::Text(text) = frame else {
        return None;
    };
    let value: Value = serde_json::from_str(&text).ok()?;
    let role = match value.pointer("/params/role").and_then(Value::as_str) {
        Some("vscode") => Role::Editor,
        Some("browser") => Role::Browser,
        _ => return None,
    };
    let valid = (!browser_origin || role == Role::Browser)
        && value.get("jsonrpc") == Some(&json!("2.0"))
        && value.get("method") == Some(&json!("router.hello"))
        && value.pointer("/params/token").and_then(Value::as_str) == Some(state.token.as_str());
    let id = value.get("id").cloned().unwrap_or(Value::Null);
    if !valid {
        send(
            socket,
            response(&id, Err("Pair this client with the gateway token")),
        )
        .await;
        return None;
    }
    if !send(socket, response(&id, Ok(json!({"protocol_version":"1.0"})))).await {
        return None;
    }
    Some(role)
}
pub(super) async fn session(mut socket: WebSocket, state: Shared, browser_origin: bool) {
    let Some(role) = hello(&mut socket, &state, browser_origin).await else {
        return;
    };
    let id = Uuid::new_v4().to_string();
    let stopped = Cancellation::new();
    let (output, mut incoming) = mpsc::channel(64);
    {
        let mut inner = state.inner.lock().await;
        if inner.clients.len() >= 64 {
            return;
        }
        inner.clients.insert(
            id.clone(),
            Client {
                role,
                output,
                stopped: stopped.clone(),
            },
        );
        if role == Role::Browser && inner.active_browser.is_none() {
            inner.active_browser = Some(id.clone());
        }
        inner.statuses();
        if role == Role::Editor {
            for (batch_id, batch) in &inner.batches {
                if batch.owner.is_none()
                    && batch.problems.len() == batch.size
                    && let Some(client) = inner.clients.get(&id)
                {
                    client.send(&inner.available(batch_id, batch));
                }
            }
        }
    }
    loop {
        tokio::select! {
            () = state.stopped.cancelled() => break,
            () = stopped.cancelled() => break,
            item = incoming.recv() => {
                let Some(value) = item else { break; };
                if !send_encoded(&mut socket, &value).await { break; }
            }
            frame = socket.recv() => {
                let Some(Ok(frame)) = frame else { break; };
                match frame {
                    Message::Text(text) => {
                        let Ok(value) = serde_json::from_str::<Value>(&text) else { break; };
                        if value.get("jsonrpc") != Some(&json!("2.0")) || !value.get("params").is_none_or(Value::is_object) { break; }
                        let method = value.get("method").and_then(Value::as_str).unwrap_or("");
                        let result = state.inner.lock().await.request(&id, role, method, &value.get("params").cloned().unwrap_or(json!({})));
                        if let Some(request_id) = value.get("id")
                            && !send(&mut socket, response(request_id, result)).await { break; }
                    }
                    Message::Ping(bytes) => { if socket.send(Message::Pong(bytes)).await.is_err() { break; } }
                    Message::Close(_) | Message::Binary(_) => break,
                    Message::Pong(_) => {}
                }
            }
        }
    }
    state.inner.lock().await.disconnect(&id);
}
