use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StressTestState {
    Inactive,
    Compiling,
    CompilationError,
    Generating,
    RunningBruteForce,
    RunningSolution,
    FoundDifference,
    InternalError,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestcaseIo {
    pub data: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestcaseResult {
    pub verdict: String,
    pub time_ms: Option<f64>,
    pub memory_mb: Option<f64>,
    pub stdout: Option<TestcaseIo>,
    pub stderr: Option<TestcaseIo>,
    pub msg: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Testcase {
    pub stdin: TestcaseIo,
    pub answer: TestcaseIo,
    pub is_expand: bool,
    pub is_disabled: bool,
    pub result: Option<TestcaseResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileWithHash {
    pub path: String,
    pub hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StressTest {
    pub generator: Option<FileWithHash>,
    pub brute_force: Option<FileWithHash>,
    pub cnt: u64,
    pub state: StressTestState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Overrides {
    pub time_limit_ms: Option<u64>,
    pub memory_limit_mb: Option<u64>,
    pub compiler: Option<String>,
    pub compiler_args: Option<String>,
    pub interpreter: Option<String>,
    pub interpreter_args: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Problem {
    pub version: String,
    pub name: String,
    pub url: Option<String>,
    pub testcases: HashMap<Uuid, Testcase>,
    pub testcase_order: Vec<Uuid>,
    pub src: FileWithHash,
    pub checker: Option<FileWithHash>,
    pub interactor: Option<FileWithHash>,
    pub stress_test: StressTest,
    pub time_elapsed_ms: u64,
    pub overrides: Overrides,
}
