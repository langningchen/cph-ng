use super::{CommandService, index_error, params, value};
use crate::application::{
    error::CommandError,
    method::Method,
    models::{LinkSource, ProblemRef},
};
use serde_json::Value;
pub(super) async fn execute(
    method: Method,
    p: &Value,
    context: &CommandService,
) -> Result<Value, CommandError> {
    let reference: ProblemRef = params(p)?;
    let problem = context.load(&reference).await?;
    if method == Method::ProblemSources {
        return value(
            context
                .index
                .sources(Some(problem.id))
                .await
                .map_err(index_error)?,
        );
    }
    let data: LinkSource = params(p)?;
    let path = context.paths.read(&data.destination).await?;
    let lock = context.tasks.locks.get(&problem.id.0.to_string()).await;
    let _guard = lock.lock().await;
    if context
        .index
        .sources(Some(problem.id))
        .await
        .map_err(index_error)?
        .len()
        >= 256
    {
        return Err(CommandError::invalid(
            "A problem may have at most 256 source bindings",
        ));
    }
    value(
        context
            .index
            .link(&path, problem.id)
            .await
            .map_err(index_error)?,
    )
}
