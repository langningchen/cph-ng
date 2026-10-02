use std::{collections::HashMap, sync::Arc};
use tokio::sync::{Mutex, watch};

#[derive(Debug, Clone, Default)]
pub struct Cancellation(watch::Sender<bool>);
impl Cancellation {
    #[must_use]
    pub fn new() -> Self {
        Self(watch::channel(false).0)
    }
    pub fn cancel(&self) {
        self.0.send_replace(true);
    }
    #[must_use]
    pub fn is_canceled(&self) -> bool {
        *self.0.borrow()
    }
    pub async fn cancelled(&self) {
        let mut receiver = self.0.subscribe();
        let _ = receiver.wait_for(|value| *value).await;
    }
}

#[derive(Debug, Clone, Default)]
pub struct ProblemLocks(Arc<Mutex<HashMap<String, std::sync::Weak<Mutex<()>>>>>);
impl ProblemLocks {
    pub async fn get(&self, id: &str) -> Arc<Mutex<()>> {
        let mut locks = self.0.lock().await;
        locks.retain(|_, lock| lock.strong_count() > 0);
        if let Some(lock) = locks.get(id).and_then(std::sync::Weak::upgrade) {
            return lock;
        }
        let lock = Arc::new(Mutex::new(()));
        locks.insert(id.to_owned(), Arc::downgrade(&lock));
        lock
    }
}
