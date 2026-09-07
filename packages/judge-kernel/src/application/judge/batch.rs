use super::{Artifacts, JudgeOptions, JudgeService, case::CaseResult, scheduling};
use crate::application::tasks::{ScheduledCase, TaskProgress};
use crate::domain::JudgeVerdict;
use crate::{
    application::{
        error::ErrorCode,
        tasks::{TaskContext, TaskFailure},
    },
    domain::{Problem, TestcaseId},
};
use futures_util::{StreamExt, stream};
use serde_json::{Value, json};

impl JudgeService {
    pub(super) async fn run_batch(
        &self,
        problem: &Problem,
        options: &JudgeOptions,
        ctx: &TaskContext,
        source: &str,
    ) -> Result<Value, TaskFailure> {
        let ids: Vec<_> = problem
            .testcases
            .iter()
            .filter(|case| {
                options
                    .testcase_ids
                    .as_ref()
                    .is_none_or(|ids| ids.contains(&case.id))
            })
            .map(|case| case.id)
            .collect();
        ctx.progress(TaskProgress::Preparing {
            testcases: ids
                .iter()
                .enumerate()
                .map(|(index, id)| ScheduledCase {
                    case_index: index + 1,
                    testcase_id: id.0,
                })
                .collect(),
        })
        .await?;
        let (jobs, _permit) =
            scheduling::reserve(options.jobs.min(ids.len()).max(1), &ctx.cancel).await?;
        ctx.progress(TaskProgress::Scheduled {
            jobs,
            total: ids.len(),
        })
        .await?;
        let artifacts = self.compile(problem, ctx, source).await?;
        // Prepare shared parent directories before concurrent workers start.
        for index in 1..=ids.len() {
            self.repo
                .owned_dir(
                    &artifacts
                        .dir
                        .join("cases")
                        .join(index.to_string())
                        .join("work"),
                )
                .await
                .map_err(TaskFailure::internal)?;
        }
        let mut pending = stream::iter(ids.iter().copied().enumerate().map(|(index, id)| {
            let artifacts = &artifacts;
            async move {
                let result = self
                    .evaluate_case(problem, options, ctx, artifacts, (index, id))
                    .await?;
                // Keep every state-lock await inside the polled testcase futures.
                // Awaiting progress in the collector can deadlock on a sibling future
                // holding the task lock while buffer_unordered is no longer polled.
                ctx.progress(TaskProgress::TestcaseFinished {
                    case_index: index + 1,
                    testcase: result.clone(),
                })
                .await?;
                Ok::<_, TaskFailure>((index, result))
            }
        }))
        .buffer_unordered(jobs);
        let mut results = Vec::new();
        let mut output_bytes = 0;
        while let Some(result) = pending.next().await {
            let (index, result) = result?;
            output_bytes += serde_json::to_vec(&result)
                .map_err(TaskFailure::internal)?
                .len();
            if output_bytes > 8 * 1024 * 1024 {
                return Err(TaskFailure::new(
                    ErrorCode::ExecutionFailed,
                    "Total task output limit exceeded",
                ));
            }
            results.push((index, result));
        }
        results.sort_by_key(|(index, _)| *index);
        let results: Vec<_> = results.into_iter().map(|(_, result)| result).collect();
        let verdict = results
            .iter()
            .map(|result| result.verdict)
            .find(|verdict| *verdict != JudgeVerdict::Accepted)
            .unwrap_or(JudgeVerdict::Accepted);
        Ok(
            json!({"schema_version":1, "problem_id":problem.id.0, "verdict":verdict, "testcases":results, "jobs":jobs, "compilation":self.compiler.cache_stats()}),
        )
    }

    async fn evaluate_case(
        &self,
        problem: &Problem,
        options: &JudgeOptions,
        ctx: &TaskContext,
        artifacts: &Artifacts,
        (index, id): (usize, TestcaseId),
    ) -> Result<CaseResult, TaskFailure> {
        let (input, answer) = if let Some(input) = &options.input {
            input.clone()
        } else {
            self.repo
                .testcase_data(problem, id)
                .await
                .map_err(TaskFailure::internal)?
        };
        let mut artifacts = artifacts.clone();
        artifacts.dir = artifacts.dir.join("cases").join((index + 1).to_string());
        let cwd = artifacts.dir.join("work");
        self.repo
            .owned_dir(&cwd)
            .await
            .map_err(TaskFailure::internal)?;
        artifacts.solution.cwd.clone_from(&cwd);
        for command in [&mut artifacts.checker, &mut artifacts.interactor]
            .into_iter()
            .flatten()
        {
            command.cwd.clone_from(&cwd);
        }
        ctx.progress(TaskProgress::Running {
            testcase_id: id.0,
            case_index: index + 1,
            completed: index,
        })
        .await?;
        let case_context = ctx.for_testcase(id.0).await?;
        let outcome = self
            .run_case(problem, &artifacts, &input, &answer, options, &case_context)
            .await;
        let mut result = match outcome {
            Err(error)
                if error.code == ErrorCode::TaskState && case_context.cancel.is_canceled() =>
            {
                CaseResult {
                    testcase_id: Some(id.0),
                    verdict: JudgeVerdict::Rejected,
                    message: "Testcase canceled".into(),
                    time_ms: 0,
                    memory_mb: None,
                    stdout: String::new(),
                    stderr: String::new(),
                    exit_code: None,
                    comparison: None,
                }
            }
            result => result?,
        };
        result.testcase_id = Some(id.0);
        // Keep the original answer independently of mutable testcases and JSON output limits.
        self.repo
            .write_owned(&artifacts.dir.join("answer.txt"), answer.as_bytes())
            .await
            .map_err(TaskFailure::internal)?;
        Ok(result)
    }
}
