use super::{File, MAX_PACKAGE_BYTES, Package, Source};
use crate::application::{
    commands::CommandService, models::ProblemRef, paths::read_source, tasks::TaskFailure,
};
use crate::ports::RepoError;

/// # Errors
/// Rejects unavailable files, invalid configuration and packages exceeding the size limit.
pub async fn snapshot(
    reference: &ProblemRef,
    context: &CommandService,
) -> Result<Package, TaskFailure> {
    let problem = context.load(reference).await?;
    let lock = context.tasks.locks.get(&problem.id.0.to_string()).await;
    let _guard = lock.lock().await;
    let problem = context.load(reference).await?;
    let bindings = context
        .index
        .sources(Some(problem.id))
        .await
        .map_err(TaskFailure::internal)?;
    let mut sources = Vec::new();
    let mut bytes = 0;
    for binding in bindings {
        let path = context.paths.read(&binding.source_path).await?;
        let text = read_source(&path).await?;
        bytes += text.len();
        budget(bytes)?;
        sources.push(Source {
            code_id: binding.code_id,
            file: File {
                path,
                content: text,
            },
        });
    }
    let mut auxiliary = Vec::new();
    for source in problem
        .checker
        .iter()
        .chain(problem.interactor.iter())
        .chain(
            problem
                .stress_test
                .iter()
                .flat_map(|config| [&config.generator, &config.brute_force]),
        )
    {
        if auxiliary.iter().any(|file: &File| file.path == source.0) {
            continue;
        }
        let path = context.paths.read(&source.0).await?;
        let text = read_source(&path).await?;
        bytes += text.len();
        budget(bytes)?;
        auxiliary.push(File {
            path,
            content: text,
        });
    }
    let history = history(problem.id, context, &mut bytes).await?;
    let path = context.repo.paths_for_id(problem.id).config_path;
    let config = context.config.get(Some(&path)).await?;
    let imported_config_toml = match context
        .repo
        .read_owned_text(&path.with_file_name("imported-config.toml"))
        .await
    {
        Ok(value) => Some(value),
        Err(RepoError::Io(error)) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(TaskFailure::internal(error)),
    };
    let origins = match context
        .repo
        .read_owned_text(&path.with_file_name("import-origins.json"))
        .await
    {
        Ok(value) => serde_json::from_str(&value).map_err(TaskFailure::internal)?,
        Err(RepoError::Io(error)) if error.kind() == std::io::ErrorKind::NotFound => Vec::new(),
        Err(error) => return Err(TaskFailure::internal(error)),
    };
    Ok(Package {
        origins,
        format: "cph-ng".into(),
        version: 1,
        testcases: context.testcase_dtos(&problem).await?,
        problem,
        sources,
        auxiliary,
        history,
        config_toml: config
            .get("raw_toml")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default()
            .into(),
        effective_config: context.config.effective(Some(&path))?,
        imported_config_toml,
    })
}
fn budget(bytes: usize) -> Result<(), TaskFailure> {
    if bytes > MAX_PACKAGE_BYTES {
        return Err(TaskFailure::invalid(
            "Problem package exceeds 128 MiB; no partial export was written",
        ));
    }
    Ok(())
}

async fn history(
    id: crate::domain::ProblemId,
    context: &CommandService,
    bytes: &mut usize,
) -> Result<Vec<crate::application::tasks::TaskInfo>, TaskFailure> {
    let mut history = Vec::new();
    let mut offset = 0;
    loop {
        let page = context
            .tasks
            .history_list(Some(&id.0.to_string()), 100, offset)
            .await?;
        let done = page.len() < 100;
        for entry in page {
            let detail = context.tasks.history_load(&entry.task_id).await?;
            *bytes += serde_json::to_vec(&detail)
                .map_err(TaskFailure::internal)?
                .len();
            budget(*bytes)?;
            history.push(detail);
        }
        if done {
            break;
        }
        offset += 100;
    }
    Ok(history)
}
