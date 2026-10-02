use super::CommandService;
use super::params;
use super::repo_error;
use super::value;
use crate::application::error::CommandError;
use crate::application::error::ErrorCode;
use crate::application::method::Method;
use crate::application::models::TestcaseDto;
use crate::application::models::TestcaseParams;
use crate::domain::IoPath;
use crate::domain::TestcaseId;
use crate::domain::TestcaseJudgingStatus;
use crate::domain::{Problem, Testcase};
use serde_json::{Value, json};
use std::collections::HashSet;

pub(super) async fn execute(
    method: Method,
    p: &Value,
    context: &CommandService,
) -> Result<Value, CommandError> {
    let p: TestcaseParams = params(p)?;
    let problem = context.load(&p.reference).await?;
    let lock = context.tasks.locks.get(&problem.id.0.to_string()).await;
    let _guard = lock.lock().await;
    let problem = context.load(&p.reference).await?;
    if method == Method::TestcaseList {
        return value(context.testcase_dtos(&problem).await?);
    }
    if p.stdin
        .as_ref()
        .is_some_and(|data| data.len() > 16 * 1024 * 1024)
        || p.answer
            .as_ref()
            .is_some_and(|data| data.len() > 16 * 1024 * 1024)
    {
        return Err(CommandError::invalid("Testcase data exceeds size limit"));
    }
    match method {
        Method::TestcaseAdd | Method::TestcaseUpdate => save(method, p, problem, context).await,
        Method::TestcaseDelete => delete(p, problem, context).await,
        Method::TestcaseReorder => reorder(p, problem, context).await,
        _ => Err(CommandError::new(
            ErrorCode::MethodNotFound,
            "Method not found",
        )),
    }
}
async fn save(
    method: Method,
    p: TestcaseParams,
    mut problem: Problem,
    context: &CommandService,
) -> Result<Value, CommandError> {
    let id = if method == Method::TestcaseAdd {
        TestcaseId(p.testcase_id.unwrap_or_else(uuid::Uuid::new_v4))
    } else {
        TestcaseId(
            p.testcase_id
                .ok_or_else(|| CommandError::invalid("testcase_id is required"))?,
        )
    };
    let previous = problem.testcases.iter().any(|testcase| testcase.id == id);
    if method == Method::TestcaseUpdate && !previous {
        return Err(CommandError::new(ErrorCode::NotFound, "Testcase not found"));
    }
    if method == Method::TestcaseAdd && previous {
        return Err(CommandError::new(
            ErrorCode::Conflict,
            "Testcase already exists",
        ));
    }
    let (input, answer) = if previous {
        context
            .repo
            .testcase_data(&problem, id)
            .await
            .map_err(repo_error)?
    } else {
        (String::new(), String::new())
    };
    let input = p.stdin.unwrap_or(input);
    let answer = p.answer.unwrap_or(answer);
    if !previous {
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
    }
    context
        .repo
        .save_problem_with_testcases(&problem, &[(id, (input.clone(), answer.clone()))].into())
        .await
        .map_err(repo_error)?;
    value(TestcaseDto {
        id: id.0,
        stdin: input,
        answer,
    })
}
async fn delete(
    p: TestcaseParams,
    mut problem: Problem,
    context: &CommandService,
) -> Result<Value, CommandError> {
    let id = p
        .testcase_id
        .ok_or_else(|| CommandError::invalid("testcase_id is required"))?;
    if !problem.testcases.iter().any(|testcase| testcase.id.0 == id) {
        return Err(CommandError::new(ErrorCode::NotFound, "Testcase not found"));
    }
    problem.testcases.retain(|testcase| testcase.id.0 != id);
    context
        .repo
        .update_problem(&problem)
        .await
        .map_err(repo_error)?;
    Ok(json!({"deleted": true}))
}
async fn reorder(
    p: TestcaseParams,
    mut problem: Problem,
    context: &CommandService,
) -> Result<Value, CommandError> {
    let order = p
        .testcase_ids
        .ok_or_else(|| CommandError::invalid("testcase_ids is required"))?;
    let unique: HashSet<_> = order.iter().copied().collect();
    if unique.len() != order.len()
        || order.len() != problem.testcases.len()
        || problem
            .testcases
            .iter()
            .any(|testcase| !unique.contains(&testcase.id.0))
    {
        return Err(CommandError::invalid(
            "testcase_ids must contain every testcase exactly once",
        ));
    }
    problem
        .testcases
        .sort_by_key(|testcase| order.iter().position(|id| *id == testcase.id.0));
    context
        .repo
        .update_problem(&problem)
        .await
        .map_err(repo_error)?;
    value(context.testcase_dtos(&problem).await?)
}
