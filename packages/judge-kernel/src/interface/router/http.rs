use super::{state::Shared, websocket};
use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State, WebSocketUpgrade},
    http::{HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
};
use serde_json::{Value, json};

pub(super) fn app(state: Shared) -> Router {
    Router::new()
        .route("/", get(status).post(import).options(preflight))
        .route("/ws", get(upgrade))
        .layer(DefaultBodyLimit::max(4 * 1024 * 1024))
        .with_state(state)
}
fn allowed(headers: &HeaderMap) -> bool {
    let host = headers.get("host").and_then(|value| value.to_str().ok());
    if !host.is_some_and(|host| {
        host == "127.0.0.1"
            || host.starts_with("127.0.0.1:")
            || host == "localhost"
            || host.starts_with("localhost:")
    }) {
        return false;
    }
    match headers.get("origin") {
        None => true,
        Some(origin) => origin.to_str().is_ok_and(|origin| {
            origin.starts_with("chrome-extension://") || origin.starts_with("moz-extension://")
        }),
    }
}
fn cors(headers: &HeaderMap, mut response: Response) -> Response {
    if let Some(origin) = headers.get("origin") {
        response
            .headers_mut()
            .insert("access-control-allow-origin", origin.clone());
        response
            .headers_mut()
            .insert("vary", HeaderValue::from_static("Origin"));
    }
    response
}
async fn preflight(headers: HeaderMap) -> Response {
    if !allowed(&headers) {
        return StatusCode::FORBIDDEN.into_response();
    }
    let mut response = StatusCode::NO_CONTENT.into_response();
    response.headers_mut().insert(
        "access-control-allow-methods",
        HeaderValue::from_static("POST, OPTIONS"),
    );
    response.headers_mut().insert(
        "access-control-allow-headers",
        HeaderValue::from_static("Content-Type"),
    );
    cors(&headers, response)
}
async fn status(State(state): State<Shared>, headers: HeaderMap) -> Response {
    if !allowed(&headers) {
        return StatusCode::FORBIDDEN.into_response();
    }
    let state = state.inner.lock().await;
    Json(json!({"name":"cph-ng-router","protocol_version":"1.0","editors":state.editor_count(),"browsers":state.clients.len()-state.editor_count(),"batches":state.batches.len()})).into_response()
}
async fn import(
    State(state): State<Shared>,
    headers: HeaderMap,
    Json(value): Json<Value>,
) -> Response {
    if !allowed(&headers) {
        return StatusCode::FORBIDDEN.into_response();
    }
    let result = state.inner.lock().await.import(value);
    let response = match result {
        Ok(()) => Json(json!({"status":"ok"})).into_response(),
        Err(message) => (StatusCode::BAD_REQUEST, Json(json!({"error":message}))).into_response(),
    };
    cors(&headers, response)
}
async fn upgrade(
    State(state): State<Shared>,
    headers: HeaderMap,
    ws: WebSocketUpgrade,
) -> Response {
    if !allowed(&headers) || state.inner.lock().await.clients.len() >= 64 {
        return StatusCode::FORBIDDEN.into_response();
    }
    let Ok(permit) = state.connections.clone().try_acquire_owned() else {
        return StatusCode::TOO_MANY_REQUESTS.into_response();
    };
    let browser_origin = headers.contains_key("origin");
    ws.max_message_size(4 * 1024 * 1024)
        .max_frame_size(4 * 1024 * 1024)
        .on_upgrade(move |socket| async move {
            let _permit = permit;
            websocket::session(socket, state, browser_origin).await;
        })
}
