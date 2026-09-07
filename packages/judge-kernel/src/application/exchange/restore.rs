use super::{File, Package};
use crate::{
    application::{commands::CommandService, tasks::TaskFailure},
    domain::{IoPath, ProblemId, SourcePath, TestcaseId},
};
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
};
use uuid::Uuid;
pub(super) mod validation;

/// # Errors
/// Validates the package and restores into a new directory; failed imports are rolled back.
pub async fn restore(
    mut package: Package,
    destination: &Path,
    context: &CommandService,
) -> Result<Value, TaskFailure> {
    validation::validate(&package)?;
    let root = context.paths.create_directory(destination).await?;
    let id = ProblemId(Uuid::new_v4());
    let result = restore_into(&mut package, &root, id, context).await;
    if result.is_err() {
        let _ = context.repo.delete_by_id(id).await;
        let _ = tokio::fs::remove_dir_all(&root).await;
    }
    result
}
async fn restore_into(
    package: &mut Package,
    root: &Path,
    id: ProblemId,
    context: &CommandService,
) -> Result<Value, TaskFailure> {
    let mut paths = HashMap::new();
    let mut ids = HashMap::new();
    let selected = package
        .sources
        .iter()
        .find(|source| source.file.path == package.problem.src.0)
        .ok_or_else(|| TaskFailure::invalid("Package has no selected source"))?
        .code_id;
    for source in &package.sources {
        let new_id = if source.code_id == selected {
            id.0
        } else {
            Uuid::new_v4()
        };
        ids.insert(source.code_id.to_string(), new_id.to_string());
        let path = write_file(root, &format!("source-{new_id}"), &source.file, context).await?;
        paths.insert(source.file.path.clone(), path);
    }
    for (i, file) in package.auxiliary.iter().enumerate() {
        if paths.contains_key(&file.path) {
            continue;
        }
        let path = write_file(root, &format!("auxiliary-{i}"), file, context).await?;
        paths.insert(file.path.clone(), path);
    }
    let old_id = package.problem.id;
    package.problem.id = id;
    remap_source(&mut package.problem.src, &paths)?;
    for source in package
        .problem
        .checker
        .iter_mut()
        .chain(package.problem.interactor.iter_mut())
        .chain(
            package
                .problem
                .stress_test
                .iter_mut()
                .flat_map(|s| [&mut s.generator, &mut s.brute_force]),
        )
    {
        remap_source(source, &paths)?;
    }
    let workspace = context.repo.paths_for_id(id);
    for case in &mut package.problem.testcases {
        let (input, answer) = workspace.get_testcase_paths(&case.id);
        case.stdin = IoPath(input);
        case.answer = IoPath(answer);
    }
    let payloads = package
        .testcases
        .iter()
        .map(|case| {
            (
                TestcaseId(case.id),
                (case.stdin.clone(), case.answer.clone()),
            )
        })
        .collect();
    context
        .repo
        .save_problem_with_testcases(&package.problem, &payloads)
        .await
        .map_err(TaskFailure::internal)?;
    for source in &package.sources {
        let path = paths
            .get(&source.file.path)
            .ok_or_else(|| TaskFailure::invalid("Missing packaged source"))?;
        let binding = if source.code_id == selected {
            context.index.source(path).await
        } else {
            context.index.link(path, id).await
        }
        .map_err(TaskFailure::internal)?;
        ids.insert(source.code_id.to_string(), binding.code_id.to_string());
    }
    restore_config(package, &workspace.config_path, context).await?;
    restore_runs(package, id, old_id, &ids, context).await?;
    let mut result = context.problem_dto(package.problem.clone()).await?;
    if let Some(object) = result.as_object_mut() {
        object.insert("import_directory".into(), serde_json::json!(root));
        object.insert(
            "history_imported".into(),
            serde_json::json!(package.history.len()),
        );
    }
    Ok(result)
}
async fn restore_config(
    package: &Package,
    path: &Path,
    context: &CommandService,
) -> Result<(), TaskFailure> {
    // Pin the exported effective standards on this problem; keep the original layer
    // verbatim for inspection and a subsequent native export.
    let config =
        toml::to_string_pretty(&package.effective_config).map_err(TaskFailure::internal)?;
    context
        .config
        .set(Some(path), Some(&config), None, None)
        .await?;
    context
        .repo
        .write_owned(
            &path.with_file_name("imported-config.toml"),
            package
                .imported_config_toml
                .as_deref()
                .unwrap_or(&package.config_toml)
                .as_bytes(),
        )
        .await
        .map_err(TaskFailure::internal)?;
    Ok(())
}
async fn write_file(
    root: &Path,
    folder: &str,
    file: &File,
    context: &CommandService,
) -> Result<PathBuf, TaskFailure> {
    let name = file
        .path
        .file_name()
        .ok_or_else(|| TaskFailure::invalid("Invalid package filename"))?;
    let dir = context.paths.create_directory(&root.join(folder)).await?;
    context.paths.create(&dir.join(name), &file.content).await
}
fn remap_source(
    source: &mut SourcePath,
    paths: &HashMap<PathBuf, PathBuf>,
) -> Result<(), TaskFailure> {
    source.0 = paths
        .get(&source.0)
        .ok_or_else(|| TaskFailure::invalid("Missing packaged auxiliary program"))?
        .clone();
    Ok(())
}
async fn restore_runs(
    package: &mut Package,
    id: ProblemId,
    old_id: ProblemId,
    ids: &HashMap<String, String>,
    context: &CommandService,
) -> Result<(), TaskFailure> {
    let mut run_ids = HashMap::new();
    for run in &mut package.history {
        let new_id = Uuid::new_v4().to_string();
        run_ids.insert(run.task_id.clone(), new_id.clone());
        run.task_id = new_id;
        run.problem_id = Some(id.0.to_string());
        run.code_id = run.code_id.as_ref().and_then(|code| ids.get(code)).cloned();
        if let Some(result) = run.result.as_mut().and_then(Value::as_object_mut)
            && result.get("problem_id") == Some(&serde_json::json!(old_id.0))
        {
            result.insert("problem_id".into(), serde_json::json!(id.0));
        }
    }
    for entry in &mut package.problem.history {
        if let Some(id) = run_ids.get(&entry.run_id.0.to_string()) {
            entry.run_id.0 = Uuid::parse_str(id).map_err(TaskFailure::internal)?;
        }
    }
    package.origins.push(super::IdentityMap {
        original_problem_id: old_id.0,
        imported_problem_id: id.0,
        source_ids: ids.clone(),
        run_ids,
    });
    let origins = serde_json::to_vec_pretty(&package.origins).map_err(TaskFailure::internal)?;
    if origins.len() > 16 * 1024 * 1024 {
        return Err(TaskFailure::invalid(
            "Import identity mappings exceed 16 MiB",
        ));
    }
    context
        .repo
        .write_owned(
            &context
                .repo
                .paths_for_id(id)
                .config_path
                .with_file_name("import-origins.json"),
            &origins,
        )
        .await
        .map_err(TaskFailure::internal)?;
    context
        .repo
        .update_problem(&package.problem)
        .await
        .map_err(TaskFailure::internal)?;
    context.tasks.restore_history(&package.history).await
}
