use super::{Artifacts, JudgeOptions, JudgeService, execution_verdict};
use crate::domain::JudgeVerdict;
use crate::{
    application::{
        error::ErrorCode,
        tasks::{TaskContext, TaskFailure},
    },
    domain::{
        Problem,
        checker::{self, CheckerMode},
    },
    ports::{
        executor::{ExecutionLimits, ExitReason},
        judge::CheckData,
    },
};
use serde::{Deserialize, Serialize};
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub testcase_id: Option<uuid::Uuid>,
    pub verdict: JudgeVerdict,
    pub message: String,
    pub time_ms: u64,
    pub memory_mb: Option<u64>,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub comparison: Option<String>,
}
impl JudgeService {
    pub(super) async fn run_case(
        &self,
        problem: &Problem,
        artifacts: &Artifacts,
        input: &str,
        answer: &str,
        options: &JudgeOptions,
        ctx: &TaskContext,
    ) -> Result<CaseResult, TaskFailure> {
        let limits = ExecutionLimits {
            time_ms: u64::from(problem.time_limit),
            memory_mb: u64::from(problem.memory_limit),
            output_bytes: options.output_bytes,
            file_bytes: u64::try_from(options.output_bytes).unwrap_or(u64::MAX),
            ..ExecutionLimits::default()
        };
        let (result, mut verdict) = if let Some(interactor) = &artifacts.interactor {
            let interactor = self
                .interactor_command(interactor, artifacts, input, answer)
                .await?;
            self.checker
                .interactive(&artifacts.solution, &interactor, &limits, &ctx.cancel)
                .await?
        } else {
            let result = self
                .executor
                .run(&artifacts.solution, input.as_bytes(), &limits, &ctx.cancel)
                .await?;
            let verdict = execution_verdict(&result);
            (result, verdict)
        };
        if result.reason == ExitReason::Canceled {
            return Err(TaskFailure::canceled());
        }
        let mut message = String::new();
        if verdict == JudgeVerdict::Accepted {
            if let Some(checker) = &artifacts.checker {
                let actual = if artifacts.interactor.is_some() {
                    self.repo
                        .read_owned_text(&artifacts.dir.join("interaction.txt"))
                        .await
                        .map_err(|_| {
                            TaskFailure::new(
                                ErrorCode::CheckerFailed,
                                "Interactor did not produce a valid transcript file",
                            )
                        })?
                } else {
                    result.stdout.clone()
                };
                (verdict, message) = self
                    .checker
                    .special_check(
                        self.repo.as_ref(),
                        checker,
                        &artifacts.dir.join("check"),
                        CheckData {
                            input,
                            actual: &actual,
                            expected: answer,
                        },
                        &ExecutionLimits {
                            time_ms: 5000,
                            memory_mb: 256,
                            ..limits.clone()
                        },
                        &ctx.cancel,
                    )
                    .await?;
            } else if artifacts.interactor.is_none() {
                if matches!(options.checker, CheckerMode::Legacy) {
                    verdict = checker::legacy_verdict(
                        &result.stdout,
                        answer,
                        &result.stderr,
                        &options.legacy_comparison,
                    );
                } else if !checker::compare(
                    &result.stdout,
                    answer,
                    &options.checker,
                    options.tolerance,
                ) {
                    verdict = JudgeVerdict::WrongAnswer;
                }
            }
        }
        let comparison = comparison(artifacts, verdict, &result.stdout, answer, options);
        Ok(CaseResult {
            comparison,
            testcase_id: None,
            verdict,
            message,
            time_ms: result.time_ms,
            memory_mb: result.memory_mb,
            stdout: result.stdout,
            stderr: result.stderr,
            exit_code: result.exit_code,
        })
    }
    async fn interactor_command(
        &self,
        interactor: &crate::ports::executor::CommandSpec,
        artifacts: &Artifacts,
        input: &str,
        answer: &str,
    ) -> Result<crate::ports::executor::CommandSpec, TaskFailure> {
        let input_path = artifacts.dir.join("input.txt");
        let answer_path = artifacts.dir.join("answer.txt");
        self.repo
            .write_owned(&input_path, input.as_bytes())
            .await
            .map_err(TaskFailure::internal)?;
        self.repo
            .write_owned(&answer_path, answer.as_bytes())
            .await
            .map_err(TaskFailure::internal)?;
        let mut interactor = interactor.clone();
        interactor.args.extend(
            [
                input_path,
                artifacts.dir.join("interaction.txt"),
                answer_path,
            ]
            .iter()
            .map(|path| path.to_string_lossy().into_owned()),
        );
        Ok(interactor)
    }
}

fn comparison(
    artifacts: &Artifacts,
    verdict: JudgeVerdict,
    actual: &str,
    answer: &str,
    options: &JudgeOptions,
) -> Option<String> {
    if artifacts.checker.is_none()
        && artifacts.interactor.is_none()
        && matches!(
            verdict,
            JudgeVerdict::WrongAnswer | JudgeVerdict::PresentationError
        )
    {
        Some(checker::difference::summary(
            actual,
            answer,
            &options.checker,
            options.tolerance,
        ))
    } else {
        None
    }
}
