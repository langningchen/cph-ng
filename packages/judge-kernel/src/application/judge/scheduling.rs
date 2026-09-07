use crate::application::tasks::{Cancellation, TaskFailure};
use std::sync::OnceLock;
use tokio::sync::{Semaphore, SemaphorePermit};

static SLOTS: OnceLock<(usize, Semaphore)> = OnceLock::new();

fn capacity_for(cpus: usize) -> usize {
    (cpus / 2).clamp(1, 4)
}

pub(super) fn capacity() -> usize {
    capacity_for(std::thread::available_parallelism().map_or(1, std::num::NonZero::get))
}

pub(super) async fn reserve(
    requested: usize,
    cancel: &Cancellation,
) -> Result<(usize, SemaphorePermit<'static>), TaskFailure> {
    let (capacity, slots) = SLOTS.get_or_init(|| {
        let capacity = capacity();
        (capacity, Semaphore::new(capacity))
    });
    let capacity = *capacity;
    let jobs = requested.clamp(1, capacity);
    // Serial evaluation excludes other evaluations/compilers in this process.
    // Parallel evaluations share the same bounded pool, including resident RPC tasks.
    let permits = if jobs == 1 { capacity } else { jobs };
    let permits = u32::try_from(permits).map_err(TaskFailure::internal)?;
    tokio::select! {
        biased;
        () = cancel.cancelled() => Err(TaskFailure::canceled()),
        permit = slots.acquire_many(permits) => Ok((jobs, permit.map_err(TaskFailure::internal)?)),
    }
}

#[cfg(test)]
mod tests {
    use super::{capacity_for, reserve};
    use crate::application::tasks::Cancellation;

    #[test]
    fn reserves_cpu_headroom_and_caps_parallel_cases() {
        for (cpus, jobs) in [(1, 1), (2, 1), (4, 2), (6, 3), (8, 4), (128, 4)] {
            assert_eq!(capacity_for(cpus), jobs);
        }
    }
    #[tokio::test]
    async fn serial_run_excludes_other_runs_and_waiting_is_cancelable() -> anyhow::Result<()> {
        let cancel = Cancellation::new();
        let (_jobs, _permit) = reserve(1, &cancel).await?;
        let waiting = Cancellation::new();
        assert!(
            tokio::time::timeout(std::time::Duration::from_millis(20), reserve(4, &waiting))
                .await
                .is_err()
        );
        waiting.cancel();
        assert!(reserve(4, &waiting).await.is_err());
        Ok(())
    }
}
