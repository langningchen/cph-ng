use super::CommandService;
use super::params;
use super::repo_error;
use crate::application::error::CommandError;
use crate::application::error::ErrorCode;
use crate::application::models::ImportParams;
use crate::application::tasks::TaskFailure;
use crate::domain::IoPath;
use crate::domain::Problem;
use crate::domain::SourcePath;
use crate::domain::Testcase;
use crate::domain::TestcaseId;
use crate::domain::TestcaseJudgingStatus;
use crate::ports::ImportedData;
use serde_json::Value;

pub(super) async fn execute(p: &Value, context: &CommandService) -> Result<Value, CommandError> {
    let mut data: ImportParams = params(p)?;
    let count = usize::from(data.problem.is_some())
        + usize::from(data.input.is_some())
        + usize::from(data.document.is_some());
    if count != 1 {
        return Err(CommandError::invalid(
            "Supply exactly one of input, document or problem",
        ));
    }
    let mut format = data.format.clone().unwrap_or_else(|| "auto".into());
    if !["auto", "legacy", "native", "companion", "prob", "bin"].contains(&format.as_str()) {
        return Err(CommandError::invalid("Unsupported import format"));
    }
    if let Some(input) = &data.input {
        let input = context.paths.read(input).await?;
        let extension = input
            .extension()
            .and_then(|v| v.to_str())
            .unwrap_or_default();
        if format == "auto" || format == "legacy" {
            format = match extension {
                "prob" => "prob",
                "bin" => "bin",
                _ => "auto",
            }
            .into();
        }
        if !["prob", "bin"].contains(&format.as_str()) {
            data.document = Some(read_document(&input).await?);
            data.input = None;
        }
    }
    if let Some(document) = data.document.take() {
        if format == "auto" {
            format = if document.get("format").is_some() {
                "native"
            } else {
                "companion"
            }
            .into();
        }
        if format == "native" {
            if data.source_path.is_some() {
                return Err(CommandError::invalid(
                    "Native import uses --destination, not --source",
                ));
            }
            let package = serde_json::from_value(document)
                .map_err(|e| CommandError::invalid(format!("Invalid native package: {e}")))?;
            let destination = data.destination.ok_or_else(|| {
                CommandError::invalid("Native import requires --destination (a new directory)")
            })?;
            return crate::application::exchange::restore(package, &destination, context).await;
        }
        if format != "companion" {
            return Err(CommandError::invalid(
                "JSON document does not match the requested format",
            ));
        }
        data.problem = Some(
            serde_json::from_value(document)
                .map_err(|e| CommandError::invalid(format!("Invalid Companion JSON: {e}")))?,
        );
    }
    if data.destination.is_some() {
        return Err(CommandError::invalid(
            "--destination is only used for native import",
        ));
    }
    if format == "auto" && data.problem.is_some() {
        format = "companion".into();
    }
    data.format = Some(format);
    let imported = if let Some(companion) = data.problem.take() {
        from_companion(data, companion, context).await?
    } else {
        from_file(data, context).await?
    };
    persist(imported, context).await
}
async fn persist(imported: ImportedData, context: &CommandService) -> Result<Value, CommandError> {
    let ImportedData {
        mut problem,
        testcase_payloads: payloads,
        language_env: config,
    } = imported;
    problem.src.0 = context.paths.read(&problem.src.0).await?;
    if problem.time_limit == 0 || problem.time_limit > 300_000 || problem.memory_limit == 0 {
        return Err(CommandError::invalid("Invalid imported resource limits"));
    }
    for path in problem
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
        context.paths.read(&path.0).await?;
    }
    let lock = context
        .tasks
        .locks
        .get(&format!("path:{}", problem.src.0.display()))
        .await;
    let _guard = lock.lock().await;
    context
        .repo
        .save_problem_with_testcases(&problem, &payloads)
        .await
        .map_err(repo_error)?;
    context
        .repo
        .save_config(&problem.src.0, &config)
        .await
        .map_err(repo_error)?;
    context.problem_dto(problem).await
}

async fn from_companion(
    data: ImportParams,
    companion: crate::application::models::CompanionProblem,
    context: &CommandService,
) -> Result<ImportedData, CommandError> {
    if data
        .format
        .as_deref()
        .is_some_and(|format| format != "companion")
    {
        return Err(CommandError::invalid("Unsupported inline import format"));
    }
    let source = context
        .paths
        .read(
            &data
                .source_path
                .ok_or_else(|| CommandError::invalid("source_path is required"))?,
        )
        .await?;
    let mut problem = Problem::new(companion.name, SourcePath(source));
    problem.url = companion.url;
    let defaults = context.config.effective(None)?.problem;
    problem.time_limit = companion.time_limit.unwrap_or(defaults.time_limit);
    problem.memory_limit = companion.memory_limit.unwrap_or(defaults.memory_limit);
    let mut payloads = std::collections::HashMap::new();
    for test in companion.tests {
        let id = TestcaseId(test.id.unwrap_or_else(uuid::Uuid::new_v4));
        let (stdin, answer) = context
            .repo
            .paths_for_id(problem.id)
            .get_testcase_paths(&id);
        problem.testcases.push(Testcase {
            id,
            stdin: IoPath(stdin),
            answer: IoPath(answer),
            status: TestcaseJudgingStatus::Waiting,
        });
        payloads.insert(id, (test.input, test.output));
    }
    Ok(ImportedData {
        problem,
        testcase_payloads: payloads,
        language_env: toml_edit::DocumentMut::new(),
    })
}

async fn from_file(
    data: ImportParams,
    context: &CommandService,
) -> Result<ImportedData, CommandError> {
    let input = context
        .paths
        .read(
            &data
                .input
                .ok_or_else(|| CommandError::invalid("input or problem is required"))?,
        )
        .await?;
    if tokio::fs::metadata(&input)
        .await
        .map_err(TaskFailure::internal)?
        .len()
        > 16 * 1024 * 1024
    {
        return Err(CommandError::invalid("Import file exceeds size limit"));
    }
    let format = data.format.unwrap_or_default();
    if !["prob", "bin"].contains(&format.as_str()) {
        return Err(CommandError::invalid("Unsupported legacy import format"));
    }
    let requested = std::path::PathBuf::from(format!("import.{format}"));
    let source = data.source_path;
    let importers = context.importers.clone();
    let import_job = tokio::task::spawn_blocking(move || {
        let importer = importers
            .iter()
            .find(|importer| importer.can_import(&requested))
            .ok_or_else(|| {
                TaskFailure::new(ErrorCode::InvalidParams, "Unsupported import format")
            })?;
        importer
            .import(&input)
            .map_err(|error| TaskFailure::invalid(format!("Invalid import file: {error}")))
    });
    let mut imported = tokio::select! {
        result = import_job => result.map_err(TaskFailure::internal)??,
        () = context.shutdown.cancelled() => return Err(TaskFailure::canceled()),
    };
    if let Some(source) = source {
        imported.problem.src.0 = context.paths.read(&source).await?;
    }
    Ok(imported)
}

async fn read_document(path: &std::path::Path) -> Result<Value, CommandError> {
    use tokio::io::AsyncReadExt;
    let limit = crate::application::exchange::MAX_PACKAGE_BYTES;
    let mut bytes = Vec::new();
    tokio::fs::File::open(path)
        .await
        .map_err(CommandError::internal)?
        .take((limit + 1) as u64)
        .read_to_end(&mut bytes)
        .await
        .map_err(CommandError::internal)?;
    if bytes.len() > limit {
        return Err(CommandError::invalid("Import exceeds 128 MiB"));
    }
    serde_json::from_slice(&bytes)
        .map_err(|e| CommandError::invalid(format!("Invalid import JSON: {e}")))
}
