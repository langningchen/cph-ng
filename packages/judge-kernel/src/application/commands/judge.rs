use serde_json::Value;

use super::{CommandService, params, value};
use crate::{
    application::{
        error::CommandError, judge::JudgeOptions, method::Method, models::RunParams,
        tasks::TaskSpec,
    },
    domain::{IoPath, Problem, Testcase, TestcaseId, TestcaseJudgingStatus},
};

pub(super) async fn judge_run(
    method: Method,
    p: Value,
    context: &CommandService,
) -> Result<Value, CommandError> {
    let reference: crate::application::models::ProblemRef = params(&p)?;
    let mut problem = context.load(&reference).await?;
    let path = context.repo.paths_for_id(problem.id).config_path;
    let mut config = context.config.effective(Some(&path))?;
    let mut merged = serde_json::to_value(&config.judge).map_err(CommandError::internal)?;
    overlay(&mut merged, &p);
    let mut data: RunParams = params(&merged)?;
    config.judge = serde_json::from_value(merged).map_err(CommandError::internal)?;
    validate_limits(&data)?;
    if !matches!(
        data.checker_mode,
        crate::domain::checker::CheckerMode::Legacy
    ) && p
        .get("legacy_comparison")
        .and_then(Value::as_object)
        .is_some_and(|options| !options.is_empty())
    {
        return Err(CommandError::invalid(
            "Legacy comparison options require checker_mode legacy",
        ));
    }
    let input = temporary_input(method, &mut data, &mut problem, context)?;
    let ids = selected_testcases(method, &data, &problem)?;
    context.details(&mut problem, data.overrides, &p).await?;
    config.problem.time_limit = problem.time_limit;
    config.problem.memory_limit = problem.memory_limit;
    validate_sources(context, &problem).await?;
    if method == Method::StressStart && problem.stress_test.is_none() {
        return Err(CommandError::invalid(
            "Configure generator and brute_force first",
        ));
    }
    if method != Method::StressStart && problem.testcases.is_empty() {
        return Err(CommandError::invalid(
            "No testcases; add a testcase or supply input and answer",
        ));
    }
    if method == Method::StressStart && data.jobs != 1 {
        return Err(CommandError::invalid(
            "Stress testing requires jobs=1 to preserve seed order",
        ));
    }
    let options = JudgeOptions {
        jobs: data.jobs,
        input,
        testcase_ids: ids,
        checker: data.checker_mode,
        legacy_comparison: data.legacy_comparison,
        tolerance: data.tolerance,
        output_bytes: data.output_limit_bytes,
    };
    let mut service = context.judge.clone();
    service.compiler = service
        .compiler
        .configured(config.clone(), data.compilation);
    let source = context
        .index
        .source(&problem.src.0)
        .await
        .map_err(super::index_error)?;
    let spec = TaskSpec {
        code_id: Some(source.code_id.to_string()),
        kind: method,
        effective_config: Some(config),
        problem_id: Some(problem.id.0.to_string()),
        client_request_id: data.client_request_id,
        fingerprint: format!("{method}:{p}"),
    };
    value(
        context
            .tasks
            .spawn(spec, move |task| async move {
                if method == Method::StressStart {
                    service
                        .stress(problem, data.iterations, data.seed, options, task)
                        .await
                } else {
                    service.run(problem, options, task).await
                }
            })
            .await?,
    )
}

fn overlay(value: &mut Value, overrides: &Value) {
    if let (Some(target), Some(fields)) = (value.as_object_mut(), overrides.as_object()) {
        for (key, item) in fields {
            overlay(target.entry(key.clone()).or_insert(Value::Null), item);
        }
    } else {
        *value = overrides.clone();
    }
}

fn validate_limits(data: &RunParams) -> Result<(), CommandError> {
    if !(1..=256).contains(&data.jobs)
        || !data.tolerance.is_finite()
        || !(0.0..=1.0).contains(&data.tolerance)
        || !(1..=16 * 1024 * 1024).contains(&data.output_limit_bytes)
        || !(1..=1_000_000).contains(&data.iterations)
        || data
            .legacy_comparison
            .output_ratio_limit
            .is_some_and(|ratio| !ratio.is_finite() || !(0.0..=1_000_000.0).contains(&ratio))
    {
        return Err(CommandError::invalid("Invalid judge limits"));
    }
    Ok(())
}

fn temporary_input(
    method: Method,
    data: &mut RunParams,
    problem: &mut Problem,
    context: &CommandService,
) -> Result<Option<(String, String)>, CommandError> {
    if data.stdin.is_none() && data.answer.is_none() {
        return Ok(None);
    }
    if method == Method::StressStart || data.testcase_id.is_some() || data.testcase_ids.is_some() {
        return Err(CommandError::invalid(
            "Inline input cannot be combined with stored testcase selection or stress testing",
        ));
    }
    let input = (
        data.stdin.take().unwrap_or_default(),
        data.answer.take().unwrap_or_default(),
    );
    if input.0.len() + input.1.len() > 16 * 1024 * 1024 {
        return Err(CommandError::invalid(
            "Inline testcase content exceeds 16 MiB",
        ));
    }
    let id = TestcaseId(uuid::Uuid::new_v4());
    let (stdin, answer) = context
        .repo
        .paths_for_id(problem.id)
        .get_testcase_paths(&id);
    problem.testcases = vec![Testcase {
        id,
        stdin: IoPath(stdin),
        answer: IoPath(answer),
        status: TestcaseJudgingStatus::Waiting,
    }];
    Ok(Some(input))
}

fn selected_testcases(
    method: Method,
    data: &RunParams,
    problem: &Problem,
) -> Result<Option<Vec<TestcaseId>>, CommandError> {
    if data.testcase_id.is_some() && (method != Method::TestcaseRun || data.testcase_ids.is_some())
    {
        return Err(CommandError::invalid(
            "Use testcase_id only for testcase.run; use testcase_ids for judge.run or testcase.run-all",
        ));
    }
    if method == Method::StressStart && data.testcase_ids.is_some() {
        return Err(CommandError::invalid(
            "Stress testing generates its own testcases; stored testcase selection is not supported",
        ));
    }
    let ids = if method == Method::TestcaseRun {
        Some(vec![TestcaseId(data.testcase_id.ok_or_else(|| {
            CommandError::invalid("testcase_id is required")
        })?)])
    } else {
        data.testcase_ids
            .as_ref()
            .map(|ids| ids.iter().copied().map(TestcaseId).collect::<Vec<_>>())
    };
    if let Some(ids) = &ids {
        let unique: std::collections::HashSet<_> = ids.iter().collect();
        if ids.is_empty() || unique.len() != ids.len() {
            return Err(CommandError::invalid(
                "Testcase selection must be nonempty and contain no duplicate IDs",
            ));
        }
        if ids
            .iter()
            .any(|id| !problem.testcases.iter().any(|testcase| testcase.id == *id))
        {
            return Err(CommandError::new(
                crate::application::error::ErrorCode::NotFound,
                "Testcase not found",
            ));
        }
    }
    Ok(ids)
}

async fn validate_sources(context: &CommandService, problem: &Problem) -> Result<(), CommandError> {
    let sources = std::iter::once(&problem.src)
        .chain(problem.checker.iter())
        .chain(problem.interactor.iter())
        .chain(
            problem
                .stress_test
                .iter()
                .flat_map(|config| [&config.generator, &config.brute_force]),
        );
    for source in sources {
        context.paths.read(&source.0).await?;
        crate::application::judge::supported_source(&source.0)?;
    }
    Ok(())
}
