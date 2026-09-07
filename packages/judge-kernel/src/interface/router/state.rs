use std::{
    collections::BTreeMap,
    sync::Arc,
    time::{Duration, Instant},
};

use serde_json::{Value, json};
use tokio::sync::{Mutex, Semaphore, mpsc};

use crate::application::tasks::Cancellation;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Role {
    Editor,
    Browser,
}
#[derive(Debug)]
pub(super) struct Client {
    pub role: Role,
    pub output: mpsc::Sender<Arc<str>>,
    pub stopped: Cancellation,
}
impl Client {
    pub fn send(&self, value: &Value) {
        self.send_encoded(Arc::from(value.to_string()));
    }
    fn send_encoded(&self, value: Arc<str>) {
        if self.output.try_send(value).is_err() {
            self.stopped.cancel();
        }
    }
}
#[derive(Debug)]
pub(super) struct Batch {
    pub size: usize,
    pub problems: Vec<Value>,
    pub owner: Option<String>,
    pub updated: Instant,
    pub bytes: usize,
}
#[derive(Debug, Default)]
pub(super) struct State {
    pub clients: BTreeMap<String, Client>,
    pub batches: BTreeMap<String, Batch>,
    pub active_browser: Option<String>,
}
#[derive(Debug, Clone)]
pub(super) struct Shared {
    pub inner: Arc<Mutex<State>>,
    pub token: Arc<String>,
    pub connections: Arc<Semaphore>,
    pub stopped: Cancellation,
}
impl Shared {
    pub fn new(token: String) -> Self {
        Self {
            inner: Arc::default(),
            token: Arc::new(token),
            connections: Arc::new(Semaphore::new(64)),
            stopped: Cancellation::new(),
        }
    }
}
pub(super) fn event(method: &str, params: &Value) -> Value {
    json!({"jsonrpc":"2.0", "method":method, "params":params})
}
impl State {
    pub fn editor_count(&self) -> usize {
        self.clients
            .values()
            .filter(|client| client.role == Role::Editor)
            .count()
    }
    pub fn broadcast(&self, role: Role, message: &Value) {
        let encoded: Arc<str> = Arc::from(message.to_string());
        for client in self.clients.values().filter(|client| client.role == role) {
            // All recipients share the encoded payload, including large batches.
            client.send_encoded(encoded.clone());
        }
    }
    pub fn statuses(&self) {
        self.broadcast(
            Role::Editor,
            &event(
                "event.router.browser_status",
                &json!({"connected":self.active_browser.is_some()}),
            ),
        );
        for (id, client) in &self.clients {
            if client.role == Role::Browser {
                client.send(&event(
                    "event.router.status",
                    &json!({"isActive":self.active_browser.as_ref() == Some(id)}),
                ));
            }
        }
    }
    pub fn available(&self, id: &str, batch: &Batch) -> Value {
        event(
            "event.router.batch_available",
            &json!({"batchId":id, "problems":batch.problems, "autoImport":self.editor_count() == 1}),
        )
    }
    pub fn expire(&mut self) {
        let expired: Vec<String> = self
            .batches
            .iter()
            .filter(|(_, batch)| batch.updated.elapsed() >= Duration::from_secs(600))
            .map(|(id, _)| id.clone())
            .collect();
        for id in expired {
            self.batches.remove(&id);
            self.broadcast(
                Role::Editor,
                &event("event.router.batch_claimed", &json!({"batchId":id})),
            );
        }
    }
    pub fn disconnect(&mut self, id: &str) {
        self.clients.remove(id);
        if self.active_browser.as_deref() == Some(id) {
            self.active_browser = self
                .clients
                .iter()
                .find(|(_, client)| client.role == Role::Browser)
                .map(|(id, _)| id.clone());
        }
        for batch in self.batches.values_mut() {
            if batch.owner.as_deref() == Some(id) {
                batch.owner = None;
            }
        }
        self.statuses();
        for (id, batch) in &self.batches {
            if batch.owner.is_none() && batch.problems.len() == batch.size {
                self.broadcast(Role::Editor, &self.available(id, batch));
            }
        }
    }
    pub fn import(&mut self, value: Value) -> Result<(), &'static str> {
        self.expire();
        let id = value
            .pointer("/batch/id")
            .and_then(Value::as_str)
            .filter(|id| !id.is_empty() && id.len() <= 128)
            .ok_or("Invalid batch ID")?
            .to_owned();
        let size = value
            .pointer("/batch/size")
            .and_then(Value::as_u64)
            .filter(|size| (1..=256).contains(size))
            .and_then(|size| usize::try_from(size).ok())
            .ok_or("Invalid batch size")?;
        if !value.get("name").is_some_and(Value::is_string)
            || !value.get("tests").is_some_and(Value::is_array)
        {
            return Err("Expected a Companion problem with name and tests");
        }
        if self.batches.len() >= 64 && !self.batches.contains_key(&id) {
            return Err("Too many pending batches");
        }
        let bytes = value.to_string().len();
        if self
            .batches
            .values()
            .map(|batch| batch.bytes)
            .sum::<usize>()
            + bytes
            > 32 * 1024 * 1024
        {
            return Err("Pending batches exceed size limit");
        }
        let batch = self.batches.entry(id.clone()).or_insert_with(|| Batch {
            size,
            problems: vec![],
            owner: None,
            updated: Instant::now(),
            bytes: 0,
        });
        if batch.size != size || batch.owner.is_some() {
            return Err("Batch size changed or batch already claimed");
        }
        if batch.problems.contains(&value) {
            return Ok(());
        }
        if batch.problems.len() >= size {
            return Err("Batch is already complete");
        }
        if batch.bytes + bytes > 3 * 1024 * 1024 {
            return Err("Batch exceeds 3 MiB; import a smaller batch");
        }
        batch.problems.push(value);
        batch.bytes += bytes;
        batch.updated = Instant::now();
        let count = batch.problems.len();
        self.broadcast(
            Role::Editor,
            &event(
                "event.router.reading_batch",
                &json!({"batchId":id,"count":count,"size":size}),
            ),
        );
        if count == size
            && let Some(batch) = self.batches.get(&id)
        {
            self.broadcast(Role::Editor, &self.available(&id, batch));
        }
        Ok(())
    }
    pub fn request(
        &mut self,
        id: &str,
        role: Role,
        method: &str,
        params: &Value,
    ) -> Result<Value, &'static str> {
        match (role, method) {
            (_, "system.ping") => Ok(json!({"ok":true})),
            (Role::Browser, "router.set_active") => {
                self.active_browser = Some(id.to_owned());
                self.statuses();
                Ok(json!({"active":true}))
            }
            (Role::Editor, "router.submit") => {
                let url = params
                    .get("url")
                    .and_then(Value::as_str)
                    .ok_or("Missing submission URL")?;
                if !(url.starts_with("https://") || url.starts_with("http://"))
                    || !params.get("sourceCode").is_some_and(Value::is_string)
                {
                    return Err("Invalid submission");
                }
                let browser = self
                    .active_browser
                    .as_ref()
                    .and_then(|id| self.clients.get(id))
                    .ok_or("No browser connected")?;
                browser
                    .output
                    .try_send(Arc::from(
                        event("event.router.submit_request", params).to_string(),
                    ))
                    .map_err(|_| "Browser is not accepting requests")?;
                Ok(json!({"forwarded":true}))
            }
            (
                Role::Editor,
                "router.claim_batch" | "router.complete_batch" | "router.cancel_batch",
            ) => self.batch_request(id, method, params),
            _ => Err("Method is unavailable for this client role"),
        }
    }
    fn batch_request(
        &mut self,
        id: &str,
        method: &str,
        params: &Value,
    ) -> Result<Value, &'static str> {
        let batch_id = params
            .get("batchId")
            .and_then(Value::as_str)
            .ok_or("Missing batch ID")?;
        let batch = self
            .batches
            .get_mut(batch_id)
            .ok_or("Batch is unavailable or expired")?;
        if batch.owner.as_deref().is_some_and(|owner| owner != id) {
            return Err("Batch is already claimed by another editor");
        }
        if method == "router.claim_batch" {
            if batch.problems.len() != batch.size {
                return Err("Batch is incomplete");
            }
            batch.owner = Some(id.to_owned());
            batch.updated = Instant::now();
            self.broadcast(
                Role::Editor,
                &event("event.router.batch_claimed", &json!({"batchId":batch_id})),
            );
            Ok(json!({"claimed":true}))
        } else {
            if method == "router.complete_batch" && batch.owner.as_deref() != Some(id) {
                return Err("Claim the batch before completing it");
            }
            self.batches.remove(batch_id);
            self.broadcast(
                Role::Editor,
                &event("event.router.batch_claimed", &json!({"batchId":batch_id})),
            );
            Ok(json!({"removed":true}))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use anyhow::{Context, Result};

    #[test]
    fn expiration_notifies_editors_to_clear_pending_imports() -> Result<()> {
        let mut state = State::default();
        let (output, mut incoming) = mpsc::channel(16);
        state.clients.insert(
            "editor".into(),
            Client {
                role: Role::Editor,
                output,
                stopped: Cancellation::new(),
            },
        );
        state
            .import(json!({"name":"A","tests":[],"batch":{"id":"expired","size":2}}))
            .map_err(anyhow::Error::msg)?;
        while incoming.try_recv().is_ok() {}
        state
            .batches
            .get_mut("expired")
            .context("Missing batch")?
            .updated = Instant::now()
            .checked_sub(Duration::from_secs(601))
            .context("Invalid clock")?;
        state.expire();
        assert!(state.batches.is_empty());
        let encoded = incoming.try_recv()?;
        let event: Value = serde_json::from_str(&encoded)?;
        assert_eq!(
            event.get("method"),
            Some(&json!("event.router.batch_claimed"))
        );
        assert_eq!(event.pointer("/params/batchId"), Some(&json!("expired")));
        Ok(())
    }
}
