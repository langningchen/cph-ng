use super::CommandService;
use super::params;
use super::value;
use crate::application::error::CommandError;
use crate::application::method::Method;
use crate::application::models::EventParams;
use crate::application::models::HistoryParams;
use crate::application::models::TaskParams;
use crate::application::tasks::TaskSpec;
use serde_json::{Value, json};

pub(super) async fn task_list(_p: Value, context: &CommandService) -> Result<Value, CommandError> {
    value(context.tasks.list_active().await?)
}

pub(super) async fn task_create(
    _p: Value,
    context: &CommandService,
) -> Result<Value, CommandError> {
    value(
        context
            .tasks
            .spawn(
                TaskSpec {
                    effective_config: None,
                    kind: Method::TaskCreate,
                    problem_id: None,
                    code_id: None,
                    client_request_id: None,
                    fingerprint: String::new(),
                },
                |_| async { Ok(json!({"schema_version": 1})) },
            )
            .await?,
    )
}

pub(super) async fn task_get(p: Value, context: &CommandService) -> Result<Value, CommandError> {
    value(
        context
            .tasks
            .get(&params::<TaskParams>(&p)?.task_id)
            .await?,
    )
}

pub(super) async fn task_cancel(p: Value, context: &CommandService) -> Result<Value, CommandError> {
    #[derive(serde::Deserialize)]
    #[serde(deny_unknown_fields)]
    struct CancelParams {
        task_id: String,
        testcase_id: Option<uuid::Uuid>,
    }
    let p: CancelParams = params(&p)?;
    value(if let Some(testcase) = p.testcase_id {
        context.tasks.cancel_testcase(&p.task_id, testcase).await?
    } else {
        context.tasks.cancel(&p.task_id).await?
    })
}

pub(super) async fn task_events_since(
    p: Value,
    context: &CommandService,
) -> Result<Value, CommandError> {
    let p: EventParams = params(&p)?;
    value(
        context
            .tasks
            .events_since(p.sequence, p.task_id.as_deref(), p.limit.unwrap_or(1000))
            .await?,
    )
}

pub(super) async fn history_list(
    p: Value,
    context: &CommandService,
) -> Result<Value, CommandError> {
    let p: HistoryParams = params(&p)?;
    let code_id = if let Some(path) = &p.reference.source_path {
        context.load(&p.reference).await?;
        Some(
            context
                .index
                .source(&context.paths.read(path).await?)
                .await
                .map_err(super::index_error)?
                .code_id
                .to_string(),
        )
    } else {
        p.reference.code_id.map(|id| id.to_string())
    };
    if let Some(code_id) = code_id {
        return value(
            context
                .tasks
                .history_for_source(&code_id, p.limit.unwrap_or(50), p.offset)
                .await?,
        );
    }
    let id = p.reference.problem_id.map(|id| id.to_string());
    value(
        context
            .tasks
            .history_list(id.as_deref(), p.limit.unwrap_or(50), p.offset)
            .await?,
    )
}

pub(super) async fn history_load(
    p: Value,
    context: &CommandService,
) -> Result<Value, CommandError> {
    let p: HistoryParams = params(&p)?;
    value(
        context
            .tasks
            .history_load(
                &p.run_id
                    .or(p.task_id)
                    .ok_or_else(|| CommandError::invalid("run_id is required"))?,
            )
            .await?,
    )
}
