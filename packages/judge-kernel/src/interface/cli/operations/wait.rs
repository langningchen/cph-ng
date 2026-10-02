use super::super::output::Output;
use crate::{
    application::{error::ErrorCode, tasks::TaskFailure},
    infrastructure::kernel::Kernel,
};
use serde_json::Value;
use std::time::Duration;

pub(super) async fn wait(
    kernel: &Kernel,
    id: &str,
    output: &Output,
    mut sequence: u64,
    timeout: Option<Duration>,
    page_size: u32,
) -> Result<(Value, u64), TaskFailure> {
    let poll = async {
        loop {
            if kernel.shutdown.is_canceled() {
                return Err(TaskFailure::canceled());
            }
            // Read the state first: when it is final, the final event is already
            // committed and will be included while draining these pages.
            let task = kernel.tasks.get(id).await?;
            loop {
                let events = kernel
                    .tasks
                    .events_since(sequence, Some(id), page_size)
                    .await?;
                let more = events.len() == page_size as usize;
                for event in events {
                    sequence = event.sequence;
                    output.event(&event)?;
                }
                if !more {
                    break;
                }
            }
            output.refresh()?;
            if task.state.is_final() {
                return Ok((
                    serde_json::to_value(task).map_err(TaskFailure::internal)?,
                    sequence,
                ));
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
    };
    // Reads are safe to interrupt even when an in-process task owns the state lock.
    let poll = async {
        tokio::select! {
            biased;
            () = kernel.shutdown.cancelled() => Err(TaskFailure::canceled()),
            result = poll => result,
        }
    };
    if let Some(timeout) = timeout {
        tokio::time::timeout(timeout, poll).await.map_err(|_| {
            TaskFailure::new(
                ErrorCode::ExecutionFailed,
                "Wait timed out; the task continues in its owning process",
            )
        })?
    } else {
        poll.await
    }
}
