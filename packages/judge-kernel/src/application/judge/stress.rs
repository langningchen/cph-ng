use super::{JudgeOptions, JudgeService};
use crate::application::tasks::TaskProgress;
use crate::domain::JudgeVerdict;
use crate::{
    application::{
        error::ErrorCode,
        tasks::{TaskContext, TaskFailure},
    },
    domain::{Problem, TestcaseId},
    ports::executor::{ExecutionLimits, ExitReason},
};
use serde_json::{Value, json};
impl JudgeService {
    /// # Errors
    /// Returns invalid stress configuration, compiler/executor/checker failures,
    /// cancellation, or failure to save a counterexample.
    pub async fn stress(
        &self,
        problem: Problem,
        iterations: u32,
        seed: u64,
        options: JudgeOptions,
        ctx: TaskContext,
    ) -> Result<Value, TaskFailure> {
        let config = problem.stress_test.clone().ok_or_else(|| {
            TaskFailure::new(
                ErrorCode::InvalidParams,
                "Generator and brute_force sources are required",
            )
        })?;
        let source = crate::application::paths::read_source(&problem.src.0).await?;
        ctx.capture_source(&source).await?;
        let (_jobs, _permit) = super::scheduling::reserve(1, &ctx.cancel).await?;
        let artifacts = self.compile(&problem, &ctx, &source).await?;
        let (generator, brute) = self
            .compile_stress_tools(&problem, &config, &artifacts, &ctx)
            .await?;
        let limits = ExecutionLimits {
            time_ms: 5000,
            output_bytes: options.output_bytes,
            file_bytes: u64::try_from(options.output_bytes).unwrap_or(u64::MAX),
            ..ExecutionLimits::default()
        };
        for iteration in 0..iterations {
            let current_seed = seed.wrapping_add(u64::from(iteration));
            let mut generator = generator.clone();
            generator.args.push(current_seed.to_string());
            let input = self
                .executor
                .run(&generator, &[], &limits, &ctx.cancel)
                .await?;
            if input.reason == ExitReason::Canceled {
                return Err(TaskFailure::canceled());
            }
            if input.reason != ExitReason::Exited || input.exit_code != Some(0) {
                return Err(TaskFailure::new(
                    ErrorCode::ExecutionFailed,
                    "Stress generator failed",
                ));
            }
            let answer = self
                .executor
                .run(&brute, input.stdout.as_bytes(), &limits, &ctx.cancel)
                .await?;
            if answer.reason == ExitReason::Canceled {
                return Err(TaskFailure::canceled());
            }
            if answer.reason != ExitReason::Exited || answer.exit_code != Some(0) {
                return Err(TaskFailure::new(
                    ErrorCode::ExecutionFailed,
                    "Brute-force solution failed",
                ));
            }
            self.repo
                .write_owned(
                    &artifacts.dir.join("cases/1/answer.txt"),
                    answer.stdout.as_bytes(),
                )
                .await
                .map_err(TaskFailure::internal)?;
            let result = self
                .run_case(
                    &problem,
                    &artifacts,
                    &input.stdout,
                    &answer.stdout,
                    &options,
                    &ctx,
                )
                .await?;
            ctx.progress(TaskProgress::StressIteration {
                iteration: iteration + 1,
                seed: current_seed,
                verdict: result.verdict,
            })
            .await?;
            if result.verdict != JudgeVerdict::Accepted {
                let id = self
                    .save_counterexample(&problem, &input.stdout, &answer.stdout)
                    .await?;
                return Ok(
                    json!({"schema_version": 1, "problem_id": problem.id.0, "iterations": iteration + 1, "seed": current_seed, "found_difference": true, "testcase_id": id.0, "input": input.stdout, "answer": answer.stdout, "result": result, "compilation":self.compiler.cache_stats()}),
                );
            }
        }
        Ok(
            json!({"schema_version": 1, "problem_id": problem.id.0, "iterations": iterations, "found_difference": false, "compilation":self.compiler.cache_stats()}),
        )
    }
    async fn compile_stress_tools(
        &self,
        problem: &Problem,
        config: &crate::domain::StressTestConfig,
        artifacts: &super::Artifacts,
        ctx: &TaskContext,
    ) -> Result<
        (
            crate::ports::executor::CommandSpec,
            crate::ports::executor::CommandSpec,
        ),
        TaskFailure,
    > {
        let generator = self
            .compiler
            .compile(
                &config.generator.0,
                &artifacts.dir.join("generator"),
                256,
                &ctx.cancel,
            )
            .await?;
        let brute = self
            .compiler
            .compile(
                &config.brute_force.0,
                &artifacts.dir.join("brute_force"),
                u64::from(problem.memory_limit),
                &ctx.cancel,
            )
            .await?;
        Ok((generator, brute))
    }
    async fn save_counterexample(
        &self,
        problem: &Problem,
        input: &str,
        answer: &str,
    ) -> Result<TestcaseId, TaskFailure> {
        let id = TestcaseId(uuid::Uuid::new_v4());
        let (stdin, answer_path) = self.repo.paths_for_id(problem.id).get_testcase_paths(&id);
        // A run may have transient limits/checker overrides. Persist only the
        // counterexample, keeping the stored problem configuration intact.
        let mut stored = self
            .repo
            .load_by_id(problem.id)
            .await
            .map_err(TaskFailure::internal)?;
        stored.testcases.push(crate::domain::Testcase {
            id,
            stdin: crate::domain::IoPath(stdin),
            answer: crate::domain::IoPath(answer_path),
            status: crate::domain::TestcaseJudgingStatus::Waiting,
        });
        self.repo
            .save_problem_with_testcases(&stored, &[(id, (input.into(), answer.into()))].into())
            .await
            .map_err(TaskFailure::internal)?;

        Ok(id)
    }
}
