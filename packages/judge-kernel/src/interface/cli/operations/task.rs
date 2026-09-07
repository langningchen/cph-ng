use super::super::{
    args::{CancelArgs, TaskAction},
    output::{Output, task_exit},
};
use super::{ActiveTask, dispatch, wait};
use crate::interface::cli::ExitStatus;
use crate::{
    application::{method::Method, tasks::TaskFailure},
    infrastructure::kernel::Kernel,
};
use serde_json::{Value, json};
use std::time::Duration;

pub(super) async fn cancel(
    args: &CancelArgs,
    kernel: &Kernel,
    output: &Output,
    timeout: Duration,
) -> Result<(Value, ExitStatus), TaskFailure> {
    let task = kernel
        .execute(Method::TaskCancel, json!({"task_id":args.task_id}))
        .await?;
    let result = if args.wait {
        wait(
            kernel,
            &args.task_id.to_string(),
            output,
            0,
            Some(timeout),
            1000,
        )
        .await?
        .0
    } else {
        task
    };
    Ok((result, ExitStatus::Success))
}

pub(super) async fn execute(
    action: &TaskAction,
    kernel: &Kernel,
    output: &Output,
    active: &mut ActiveTask,
    timeout: Duration,
) -> Result<(Value, ExitStatus), TaskFailure> {
    let (method, params) = match action {
        TaskAction::Cancel(args) => return cancel(args, kernel, output, timeout).await,
        TaskAction::List => (Method::TaskList, json!({})),
        TaskAction::Create => (Method::TaskCreate, json!({})),
        TaskAction::Get { task_id } => (Method::TaskGet, json!({"task_id":task_id})),
        TaskAction::Wait { task_id } => {
            let (task, _) =
                wait(kernel, &task_id.to_string(), output, 0, Some(timeout), 1000).await?;
            let code = task_exit(&task);
            return Ok((task, code));
        }
        TaskAction::Events {
            task_id,
            since,
            limit,
            follow,
        } => {
            if *follow {
                let id = task_id
                    .ok_or_else(|| TaskFailure::invalid("--task-id is required for --follow"))?;
                let (task, sequence) = wait(
                    kernel,
                    &id.to_string(),
                    output,
                    *since,
                    Some(timeout),
                    *limit,
                )
                .await?;
                return Ok((
                    json!({"task":task, "sequence":sequence}),
                    ExitStatus::Success,
                ));
            }
            (
                Method::TaskEventsSince,
                json!({"task_id":task_id, "sequence":since, "limit":limit}),
            )
        }
    };
    dispatch(method, params, kernel, output, active).await
}
