use super::super::args::ProblemRef;
use super::data::{absolute, read_text, reference};
use crate::{
    application::{method::Method, tasks::TaskFailure},
    infrastructure::kernel::Kernel,
};
use serde_json::{Map, Value, json};
use std::path::Path;

pub(super) async fn move_problem(
    value: &ProblemRef,
    destination: &Path,
    rebind_only: bool,
    kernel: &Kernel,
) -> Result<Value, TaskFailure> {
    let problem = kernel
        .execute(Method::ProblemLoad, reference(value)?.into())
        .await?;
    let id = problem
        .get("id")
        .ok_or_else(|| TaskFailure::internal("Missing problem ID"))?;
    let mut params = Map::from_iter([
        ("problem_id".into(), id.clone()),
        ("destination".into(), json!(absolute(destination)?)),
    ]);
    if let Some(code_id) = problem.get("code_id") {
        params.insert("code_id".into(), code_id.clone());
    }
    if rebind_only {
        return kernel.execute(Method::ProblemMove, params.into()).await;
    }
    if let Some(source) = &value.source
        && tokio::fs::symlink_metadata(source)
            .await
            .map_err(TaskFailure::internal)?
            .is_symlink()
    {
        return Err(TaskFailure::invalid(
            "Move the actual source path or use --rebind-only after moving the symlink externally",
        ));
    }
    let source = problem
        .get("source_path")
        .and_then(Value::as_str)
        .ok_or_else(|| TaskFailure::internal("Missing source path"))?;
    let source = kernel.paths.read(Path::new(source)).await?;
    let code = read_text(&source, kernel).await?;
    let permissions = tokio::fs::metadata(&source)
        .await
        .map_err(TaskFailure::internal)?
        .permissions();
    let destination = kernel.paths.create(&absolute(destination)?, &code).await?;
    if let Err(error) = tokio::fs::set_permissions(&destination, permissions).await {
        let _ = tokio::fs::remove_file(&destination).await;
        return Err(TaskFailure::invalid(format!(
            "Cannot preserve source permissions: {error}"
        )));
    }
    let moved = kernel
        .execute(Method::ProblemMove, params.clone().into())
        .await;
    let result = match moved {
        Ok(result) => result,
        Err(error) => {
            let _ = tokio::fs::remove_file(&destination).await;
            return Err(error);
        }
    };
    if let Err(error) = tokio::fs::remove_file(&source).await {
        params.insert("destination".into(), json!(source));
        if kernel
            .execute(Method::ProblemMove, params.into())
            .await
            .is_ok()
        {
            let _ = tokio::fs::remove_file(&destination).await;
        }
        return Err(TaskFailure::invalid(format!(
            "Could not remove original source: {error}"
        )));
    }
    Ok(result)
}
