use anyhow::Context;
use cph_ng_judge::application::method::Method;
use std::time::Duration;

use cph_ng_judge::application::tasks::{TaskInfo, TaskManager, TaskSpec};

fn spec(key: &str) -> TaskSpec {
    TaskSpec {
        effective_config: None,
        kind: Method::JudgeRun,
        problem_id: None,
        code_id: None,
        client_request_id: Some(key.into()),
        fingerprint: key.into(),
    }
}
async fn finish(manager: &TaskManager, id: &str) -> anyhow::Result<TaskInfo> {
    tokio::time::timeout(Duration::from_secs(5), async {
        loop {
            let task = manager
                .get(id)
                .await
                .context("required test fixture or kernel response")?;
            if task.state.is_final() {
                return Ok::<_, anyhow::Error>(task);
            }
            tokio::time::sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .context("required test fixture or kernel response")?
}

#[path = "tasks_and_index/checker.rs"]
mod checker;
#[path = "tasks_and_index/index.rs"]
mod index;
#[path = "tasks_and_index/lifecycle.rs"]
mod lifecycle;
#[path = "tasks_and_index/persistence.rs"]
mod persistence;
