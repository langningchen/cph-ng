use serde::{Deserialize, Serialize};

use crate::domain::testcase::RunResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProblemJudgingStatus {
    /// Judging has not started yet
    NotStarted,
    /// Compiling the solution and checker/interactor (if any)
    Compiling,
    /// Running the solution on testcases and judging the results
    Judging,
    /// All testcases have been judged and the final verdict is ready
    Finished(ProblemVerdict),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TestcaseJudgingStatus {
    /// Waiting for judging to start
    Waiting,
    /// Preparing the environment (e.g., generating testcases)
    Preparing,
    /// Running the solution on testcases
    Running(RunResult),
    /// Judging the results (e.g., comparing output, running checker)
    Judging(RunResult),
    /// Judging finished, verdict is ready
    Finished(RunResult, ProblemVerdict),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProblemVerdict {
    /// The solution is correct and meets all requirements
    Accepted,
    /// The solution's output is incorrect for this testcase
    WrongAnswer,
    /// The solution exceeded the time limit for this testcase
    TimeLimitExceeded,
    /// The solution exceeded the memory limit for this testcase
    MemoryLimitExceeded,
    /// The solution encountered a runtime error (e.g., segmentation fault, division by zero)
    RuntimeError,
    /// The solution failed to compile, with the compiler error message
    CompilationError(String),
    /// An error occurred in the judging system (e.g., checker crashed, interactor error), with an error message
    SystemError(String),
    /// The solution was rejected (e.g., due to an invalid configuration)
    Rejected,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TestcaseVerdict {
    /// The solution is correct and meets all requirements
    Accepted,
    /// The solution is partially correct (only used in checker)
    PartiallyCorrect,
    /// The solution's output format is incorrect (e.g., extra whitespace, missing newline)
    PresentationError,
    /// The solution's output is incorrect for this testcase
    WrongAnswer,
    /// The solution exceeded the time limit for this testcase
    TimeLimitExceeded,
    /// The solution exceeded the memory limit for this testcase
    MemoryLimitExceeded,
    /// The solution exceeded the output limit for this testcase
    OutputLimitExceeded,
    /// The solution encountered a runtime error (e.g., segmentation fault, division by zero)
    RuntimeError(String),
    /// The solution failed to compile, with the compiler error message
    SystemError(String),
    /// The testcase was skipped (e.g.,  due to a failed dependency or a failed generator), with an error message
    Skipped,
    /// The solution was rejected (e.g., due to an invalid configuration)
    Rejected,
}
