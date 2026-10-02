use super::{
    args::{
        Commands, IndexAction, JudgeAction, ProblemAction, StressAction, TaskAction, TestcaseAction,
    },
    output::{Output, task_exit},
};
use crate::interface::cli::ExitStatus;
use crate::{
    application::{method::Method, tasks::TaskFailure},
    infrastructure::kernel::Kernel,
};
use serde_json::{Value, json};
use std::time::Duration;
mod data;
mod imports;
mod moving;
mod prepare;
mod run;
mod task;
mod wait;
pub(super) use data::absolute;
use imports::import_params;
use moving::move_problem;
use run::run_params;
use wait::wait;
#[derive(Debug, Default)]
pub(super) struct ActiveTask {
    pub owned_id: Option<String>,
}

pub(super) fn observes(command: &Commands) -> bool {
    matches!(
        command,
        Commands::Diff(_)
            | Commands::Task {
                action: TaskAction::List
                    | TaskAction::Get { .. }
                    | TaskAction::Wait { .. }
                    | TaskAction::Cancel(_)
                    | TaskAction::Events { .. }
            }
            | Commands::Judge {
                action: JudgeAction::Cancel(_)
            }
            | Commands::Stress {
                action: StressAction::Stop(_)
            }
            | Commands::History { .. }
            | Commands::Problem {
                action: ProblemAction::List | ProblemAction::Load(_)
            }
            | Commands::Testcase {
                action: TestcaseAction::List(_)
            }
            | Commands::Index {
                action: IndexAction::Resolve { .. }
            }
    )
}

pub(super) async fn execute(
    command: &Commands,
    kernel: &Kernel,
    output: &Output,
    active: &mut ActiveTask,
    wait_timeout: Duration,
) -> Result<(Value, ExitStatus), TaskFailure> {
    let (method, params) = match command {
        Commands::Diff(args) => {
            return super::diff::execute(args, kernel)
                .await
                .map(|value| (value, ExitStatus::Success));
        }
        Commands::Run(args)
        | Commands::Judge {
            action: JudgeAction::Run(args),
        } => (
            Method::JudgeRun,
            run_params(args, Method::JudgeRun, kernel).await?.into(),
        ),
        Commands::Testcase {
            action: TestcaseAction::Run(args),
        } => (
            Method::TestcaseRun,
            run_params(args, Method::TestcaseRun, kernel).await?.into(),
        ),
        Commands::Testcase {
            action: TestcaseAction::RunAll(args),
        } => (
            Method::TestcaseRunAll,
            run_params(args, Method::TestcaseRunAll, kernel)
                .await?
                .into(),
        ),
        Commands::Stress {
            action:
                StressAction::Start {
                    run,
                    iterations,
                    seed,
                },
        } => {
            let mut params = run_params(run, Method::StressStart, kernel).await?;
            if let Some(iterations) = iterations {
                params.insert("iterations".into(), json!(iterations));
            }
            params.insert("seed".into(), json!(seed));
            (Method::StressStart, params.into())
        }
        Commands::Judge {
            action: JudgeAction::Cancel(args),
        }
        | Commands::Stress {
            action: StressAction::Stop(args),
        } => return task::cancel(args, kernel, output, wait_timeout).await,
        Commands::Task { action } => {
            return task::execute(action, kernel, output, active, wait_timeout).await;
        }
        Commands::Problem {
            action:
                ProblemAction::Move {
                    reference,
                    destination,
                    rebind_only,
                },
        } => {
            return move_problem(reference, destination, *rebind_only, kernel)
                .await
                .map(|value| (value, ExitStatus::Success));
        }
        Commands::Problem {
            action: ProblemAction::Import(args),
        }
        | Commands::Import(args) => (Method::ProblemImport, import_params(args, kernel).await?),
        Commands::Export(args) => prepare::export(args)?,
        Commands::Problem { action } => prepare::problem(action)?,
        Commands::Testcase { action } => prepare::testcase(action, kernel).await?,
        Commands::Index { action } => prepare::index(action)?,
        Commands::History { action } => prepare::history(action)?,
        Commands::Completions { .. }
        | Commands::Config { .. }
        | Commands::Capabilities
        | Commands::Serve(_)
        | Commands::Router(_)
        | Commands::Toolchain { .. } => {
            return Err(TaskFailure::invalid("Unsupported command"));
        }
    };
    dispatch(method, params, kernel, output, active).await
}

async fn dispatch(
    method: Method,
    params: Value,
    kernel: &Kernel,
    output: &Output,
    active: &mut ActiveTask,
) -> Result<(Value, ExitStatus), TaskFailure> {
    if kernel.shutdown.is_canceled() {
        return Err(TaskFailure::canceled());
    }
    let value = kernel.execute(method, params).await?;
    if matches!(
        method,
        Method::JudgeRun
            | Method::TestcaseRun
            | Method::TestcaseRunAll
            | Method::StressStart
            | Method::IndexRebuild
            | Method::TaskCreate
    ) {
        let id = value
            .get("task_id")
            .and_then(Value::as_str)
            .ok_or_else(|| TaskFailure::internal("Task admission did not return an ID"))?;
        active.owned_id = Some(id.into());
        let (task, _) = wait(kernel, id, output, 0, None, 1000).await?;
        let code = task_exit(&task);
        Ok((task, code))
    } else {
        Ok((value, ExitStatus::Success))
    }
}
