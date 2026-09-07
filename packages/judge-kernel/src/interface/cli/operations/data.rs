use super::super::args::{Details, ProblemRef, TestData};
use crate::{application::tasks::TaskFailure, infrastructure::kernel::Kernel};
use serde_json::{Map, Value, json};
use std::path::{Path, PathBuf};
use tokio::io::AsyncReadExt;

pub(in crate::interface::cli) fn absolute(path: &Path) -> Result<PathBuf, TaskFailure> {
    std::path::absolute(path)
        .map_err(|error| TaskFailure::invalid(format!("Invalid path {}: {error}", path.display())))
}
pub(super) fn reference(reference: &ProblemRef) -> Result<Map<String, Value>, TaskFailure> {
    let mut params = Map::new();
    if let Some(path) = &reference.source {
        params.insert("source_path".into(), json!(absolute(path)?));
    }
    if let Some(id) = reference.problem_id {
        params.insert("problem_id".into(), json!(id));
    }
    if let Some(id) = reference.code_id {
        params.insert("code_id".into(), json!(id));
    }
    Ok(params)
}
pub(super) fn details(
    params: &mut Map<String, Value>,
    details: &Details,
) -> Result<(), TaskFailure> {
    if let Some(value) = details.time_limit_ms {
        params.insert("time_limit_ms".into(), json!(value));
    }
    if let Some(value) = details.memory_limit_mb {
        params.insert("memory_limit_mb".into(), json!(value));
    }
    for (key, path, clear) in [
        ("checker", &details.checker, details.clear_checker),
        ("interactor", &details.interactor, details.clear_interactor),
        ("generator", &details.generator, details.clear_stress),
        ("brute_force", &details.brute_force, details.clear_stress),
    ] {
        if clear {
            params.insert(key.into(), Value::Null);
        } else if let Some(path) = path {
            params.insert(key.into(), json!(absolute(path)?));
        }
    }
    Ok(())
}
pub(super) fn has_data(data: &TestData) -> bool {
    data.stdin.is_some()
        || data.input.is_some()
        || data.answer.is_some()
        || data.answer_file.is_some()
}
pub(super) async fn read_text(path: &Path, kernel: &Kernel) -> Result<String, TaskFailure> {
    read_text_limit(path, kernel, 16 * 1024 * 1024).await
}
pub(super) async fn read_text_limit(
    path: &Path,
    kernel: &Kernel,
    limit: usize,
) -> Result<String, TaskFailure> {
    let mut result = String::new();
    let read = async {
        if path == Path::new("-") {
            tokio::io::stdin()
                .take((limit + 1) as u64)
                .read_to_string(&mut result)
                .await
        } else {
            let path = kernel.paths.read(path).await?;
            tokio::fs::File::open(path)
                .await
                .map_err(|error| TaskFailure::invalid(format!("Cannot open input: {error}")))?
                .take((limit + 1) as u64)
                .read_to_string(&mut result)
                .await
        }
        .map_err(|error| TaskFailure::invalid(format!("Cannot read UTF-8 text: {error}")))
    };
    tokio::select! {
        () = kernel.shutdown.cancelled() => return Err(TaskFailure::canceled()),
        read = read => { read?; },
    }
    if result.len() > limit {
        return Err(TaskFailure::invalid(format!(
            "Input exceeds {} MiB",
            limit / 1024 / 1024
        )));
    }
    Ok(result)
}
pub(super) async fn test_data(
    params: &mut Map<String, Value>,
    data: &TestData,
    kernel: &Kernel,
) -> Result<(), TaskFailure> {
    if data.input.as_deref() == Some(Path::new("-"))
        && data.answer_file.as_deref() == Some(Path::new("-"))
    {
        return Err(TaskFailure::invalid(
            "Only one input file may read standard input (-)",
        ));
    }
    for (key, literal, path) in [
        ("stdin", &data.stdin, &data.input),
        ("answer", &data.answer, &data.answer_file),
    ] {
        if let Some(literal) = literal {
            params.insert(key.into(), json!(literal));
        } else if let Some(path) = path {
            params.insert(key.into(), json!(read_text(path, kernel).await?));
        }
    }
    Ok(())
}
