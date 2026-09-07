use super::CommandService;
use super::index_error;
use super::params;
use super::repo_error;
use super::value;
use crate::application::error::CommandError;
use crate::application::method::Method;
use crate::application::models::ProblemRef;
use crate::application::models::ReindexParams;
use crate::application::tasks::TaskFailure;
use crate::application::tasks::TaskProgress;
use crate::application::tasks::TaskSpec;
use crate::domain::ProblemId;
use crate::ports::index::IndexError;
use serde_json::{Value, json};

pub(super) async fn index_resolve(
    p: Value,
    context: &CommandService,
) -> Result<Value, CommandError> {
    let p: ProblemRef = params(&p)?;
    let path = context
        .paths
        .read(
            &p.source_path
                .ok_or_else(|| CommandError::invalid("source_path is required"))?,
        )
        .await?;
    value(context.index.source(&path).await.map_err(index_error)?)
}

pub(super) async fn index_reindex_file(
    p: Value,
    context: &CommandService,
) -> Result<Value, CommandError> {
    let p: ReindexParams = params(&p)?;
    let path = context.paths.read(&p.source_path).await?;
    let mut problem = context
        .repo
        .load_by_id(ProblemId(p.problem_id))
        .await
        .map_err(repo_error)?;
    let lock = context.tasks.locks.get(&problem.id.0.to_string()).await;
    let _guard = lock.lock().await;
    context
        .index
        .rebuild(&path, problem.id)
        .await
        .map_err(index_error)?;
    problem.src.0 = path;
    context
        .repo
        .update_problem(&problem)
        .await
        .map_err(repo_error)?;
    value(
        context
            .index
            .source(&problem.src.0)
            .await
            .map_err(index_error)?,
    )
}

pub(super) async fn index_rebuild(
    method: Method,
    p: Value,
    context: &CommandService,
) -> Result<Value, CommandError> {
    let entries = if p.get("source_path").is_some() {
        let data: ReindexParams = params(&p)?;
        context
            .repo
            .load_by_id(ProblemId(data.problem_id))
            .await
            .map_err(repo_error)?;
        vec![(
            context.paths.read(&data.source_path).await?,
            ProblemId(data.problem_id),
        )]
    } else {
        context
            .index
            .sources(None)
            .await
            .map_err(index_error)?
            .into_iter()
            .map(|source| (source.source_path, ProblemId(source.problem_id)))
            .collect()
    };
    let task_context = context.clone();
    let spec = TaskSpec {
        effective_config: None,
        kind: method,
        problem_id: None,
        code_id: None,
        client_request_id: p
            .get("client_request_id")
            .and_then(Value::as_str)
            .map(str::to_owned),
        fingerprint: p.to_string(),
    };
    value(context.tasks.spawn(spec, move |task| async move {
                let mut rebuilt = 0; let mut conflicts = Vec::new(); let mut failures = Vec::new();
                for (path, id) in entries {
                    if task.cancel.is_canceled() { return Err(TaskFailure::canceled()); }
                    let lock = task_context.tasks.locks.get(&id.0.to_string()).await; let _guard = lock.lock().await;
                    if task_context.paths.read(&path).await.is_err() { failures.push(json!({"source_path": path, "error": "Source is unavailable"})); continue; }
                    match task_context.index.rebuild(&path, id).await {
                        Ok(()) => rebuilt += 1,
                        Err(IndexError::Conflict(ids)) => conflicts.push(json!({"source_path": path, "problem_ids": ids})),
                        Err(_) => failures.push(json!({"source_path": path, "error": "Index rebuild failed"})),
                    }
                    task.progress(TaskProgress::IndexRebuild { rebuilt }).await?;
                }
                Ok(json!({"schema_version": 1, "rebuilt": rebuilt, "conflicts": conflicts, "failures": failures}))
            }).await?)
}
