use super::CommandService;
use super::params;
use super::repo_error;
use super::value;
use crate::application::error::CommandError;
use crate::application::error::ErrorCode;
use crate::application::models::CreateProblem;
use crate::application::models::MoveProblem;
use crate::application::models::ProblemDetails;
use crate::application::models::ProblemDto;
use crate::application::models::ProblemRef;
use crate::application::models::TestcaseDto;
use crate::application::models::UpdateProblem;
use crate::domain::Problem;
use crate::domain::ProblemId;
use crate::domain::SourcePath;
use crate::domain::StressTestConfig;
use serde_json::{Value, json};

impl CommandService {
    pub(crate) async fn load(&self, reference: &ProblemRef) -> Result<Problem, CommandError> {
        let problem = if let Some(code_id) = reference.code_id {
            let sources = self
                .index
                .sources(reference.problem_id.map(ProblemId))
                .await
                .map_err(super::index_error)?;
            let source = sources
                .into_iter()
                .find(|s| s.code_id == code_id)
                .ok_or_else(|| {
                    CommandError::new(ErrorCode::NotFound, "Source identity not found")
                })?;
            if let Some(path) = &reference.source_path
                && self.paths.read(path).await? != source.source_path
            {
                return Err(CommandError::new(
                    ErrorCode::Conflict,
                    "Source path and code_id disagree",
                ));
            }
            let mut problem = self
                .repo
                .load_by_id(ProblemId(source.problem_id))
                .await
                .map_err(repo_error)?;
            problem.src.0 = source.source_path;
            problem
        } else if let Some(path) = &reference.source_path {
            let path = self.paths.read(path).await?;
            let problem = self.repo.load_problem(&path).await.map_err(repo_error)?;
            if reference.problem_id.is_some_and(|id| id != problem.id.0) {
                return Err(CommandError::new(
                    ErrorCode::Conflict,
                    "Source and problem_id refer to different problems",
                ));
            }
            problem
        } else if let Some(id) = reference.problem_id {
            self.repo
                .load_by_id(ProblemId(id))
                .await
                .map_err(repo_error)?
        } else {
            return Err(CommandError::invalid(
                "source_path or problem_id is required",
            ));
        };
        Ok(problem)
    }
    pub(crate) async fn testcase_dtos(
        &self,
        problem: &Problem,
    ) -> Result<Vec<TestcaseDto>, CommandError> {
        let mut testcases = Vec::new();
        for testcase in &problem.testcases {
            let (stdin, answer) = self
                .repo
                .testcase_data(problem, testcase.id)
                .await
                .map_err(repo_error)?;
            testcases.push(TestcaseDto {
                id: testcase.id.0,
                stdin,
                answer,
            });
        }
        Ok(testcases)
    }
    pub(crate) async fn problem_dto(&self, problem: Problem) -> Result<Value, CommandError> {
        let testcases = self.testcase_dtos(&problem).await?;
        let sources = self
            .index
            .sources(Some(problem.id))
            .await
            .map_err(super::index_error)?;
        let code_id = sources
            .iter()
            .find(|source| source.source_path == problem.src.0)
            .map_or(problem.id.0, |source| source.code_id);
        let mut dto = ProblemDto::from_problem(problem, testcases);
        dto.code_id = code_id;
        dto.sources = sources;
        value(dto)
    }
    pub(super) async fn details(
        &self,
        problem: &mut Problem,
        details: ProblemDetails,
        raw: &Value,
    ) -> Result<(), CommandError> {
        if let Some(time) = details.time_limit_ms {
            if time == 0 || time > 300_000 {
                return Err(CommandError::invalid(
                    "time_limit_ms must be between 1 and 300000",
                ));
            }
            problem.time_limit = time;
        }
        if let Some(memory) = details.memory_limit_mb {
            if memory == 0 {
                return Err(CommandError::invalid("memory_limit_mb must be positive"));
            }
            problem.memory_limit = memory;
        }
        if raw.get("url").is_some_and(Value::is_null) {
            problem.url = None;
        } else if let Some(url) = details.url {
            problem.url = url;
        }
        for (name, path, target) in [
            ("checker", details.checker, &mut problem.checker),
            ("interactor", details.interactor, &mut problem.interactor),
        ] {
            if raw.get(name).is_some_and(Value::is_null) {
                *target = None;
            } else if let Some(path) = path {
                *target = match path {
                    Some(path) => Some(SourcePath(self.paths.read(&path).await?)),
                    None => None,
                };
            }
        }
        if raw.get("generator").is_some_and(Value::is_null)
            || raw.get("brute_force").is_some_and(Value::is_null)
        {
            problem.stress_test = None;
        } else if details.generator.is_some() || details.brute_force.is_some() {
            let generator = details
                .generator
                .or_else(|| {
                    problem
                        .stress_test
                        .as_ref()
                        .map(|config| config.generator.0.clone())
                })
                .ok_or_else(|| CommandError::invalid("generator is required"))?;
            let brute_force = details
                .brute_force
                .or_else(|| {
                    problem
                        .stress_test
                        .as_ref()
                        .map(|config| config.brute_force.0.clone())
                })
                .ok_or_else(|| CommandError::invalid("brute_force is required"))?;
            problem.stress_test = Some(StressTestConfig {
                generator: SourcePath(self.paths.read(&generator).await?),
                brute_force: SourcePath(self.paths.read(&brute_force).await?),
            });
        }
        Ok(())
    }
}

pub(super) async fn problem_list(
    _p: Value,
    context: &CommandService,
) -> Result<Value, CommandError> {
    let problems = context.repo.list_problems().await.map_err(repo_error)?;
    let mut result = Vec::new();
    for problem in problems {
        let mut dto = ProblemDto::from_problem(problem, vec![]);
        dto.sources = context
            .index
            .sources(Some(ProblemId(dto.id)))
            .await
            .map_err(super::index_error)?;
        dto.code_id = dto
            .sources
            .iter()
            .find(|source| source.source_path == dto.source_path)
            .map_or(dto.id, |source| source.code_id);
        result.push(dto);
    }
    value(result)
}

pub(super) async fn problem_load(
    p: Value,
    context: &CommandService,
) -> Result<Value, CommandError> {
    context.problem_dto(context.load(&params(&p)?).await?).await
}

pub(super) async fn problem_create(
    p: Value,
    context: &CommandService,
) -> Result<Value, CommandError> {
    let data: CreateProblem = params(&p)?;
    let source = if let Some(code) = &data.source_code {
        context.paths.create(&data.source_path, code).await?
    } else {
        context.paths.read(&data.source_path).await?
    };
    let lock = context
        .tasks
        .locks
        .get(&format!("path:{}", source.display()))
        .await;
    let _guard = lock.lock().await;
    let mut problem = Problem::new(data.name, SourcePath(source));
    let defaults = context.config.effective(None)?.problem;
    problem.time_limit = defaults.time_limit;
    problem.memory_limit = defaults.memory_limit;
    context.details(&mut problem, data.details, &p).await?;
    context
        .repo
        .create_problem(&problem)
        .await
        .map_err(repo_error)?;
    context.problem_dto(problem).await
}

pub(super) async fn problem_update(
    p: Value,
    context: &CommandService,
) -> Result<Value, CommandError> {
    let data: UpdateProblem = params(&p)?;
    let problem = context.load(&data.reference).await?;
    let lock = context.tasks.locks.get(&problem.id.0.to_string()).await;
    let _guard = lock.lock().await;
    let mut problem = context.load(&data.reference).await?;
    if let Some(name) = data.name {
        problem.name = name;
    }
    context.details(&mut problem, data.details, &p).await?;
    context
        .repo
        .update_problem(&problem)
        .await
        .map_err(repo_error)?;
    context.problem_dto(problem).await
}

pub(super) async fn problem_delete(
    p: Value,
    context: &CommandService,
) -> Result<Value, CommandError> {
    let problem = context.load(&params(&p)?).await?;
    let lock = context.tasks.locks.get(&problem.id.0.to_string()).await;
    let _guard = lock.lock().await;
    context
        .repo
        .delete_by_id(problem.id)
        .await
        .map_err(repo_error)?;
    Ok(json!({"deleted": true}))
}

pub(super) async fn problem_move(
    p: Value,
    context: &CommandService,
) -> Result<Value, CommandError> {
    let p: MoveProblem = params(&p)?;
    let problem = context.load(&p.reference).await?;
    let destination = context.paths.read(&p.destination).await?;
    let lock = context.tasks.locks.get(&problem.id.0.to_string()).await;
    let _guard = lock.lock().await;
    let problem = context.load(&p.reference).await?;
    let sources = context
        .index
        .sources(Some(problem.id))
        .await
        .map_err(super::index_error)?;
    let code_id = sources
        .iter()
        .find(|s| s.source_path == problem.src.0)
        .map(|s| s.code_id)
        .ok_or_else(|| CommandError::new(ErrorCode::NotFound, "Source identity not found"))?;
    context
        .index
        .rebind(code_id, &destination)
        .await
        .map_err(super::index_error)?;
    let mut problem = problem;
    problem.src.0 = destination;
    context
        .repo
        .update_problem(&problem)
        .await
        .map_err(repo_error)?;
    context.problem_dto(problem).await
}
