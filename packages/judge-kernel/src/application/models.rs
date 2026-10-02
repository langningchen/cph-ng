//! Application command inputs and result views shared by CLI and RPC.
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::{Problem, checker::CheckerMode};

#[derive(Debug, Clone, Default, Deserialize)]
pub struct ProblemRef {
    pub code_id: Option<Uuid>,
    pub source_path: Option<PathBuf>,
    pub problem_id: Option<Uuid>,
}
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TestcaseDto {
    pub id: Uuid,
    pub stdin: String,
    pub answer: String,
}
#[derive(Debug, Clone, Serialize)]
pub struct ProblemDto {
    pub sources: Vec<crate::ports::index::SourceBinding>,
    pub schema_version: u32,
    pub id: Uuid,
    pub code_id: Uuid,
    pub source_path: PathBuf,
    pub name: String,
    pub time_limit_ms: u32,
    pub memory_limit_mb: u16,
    pub url: Option<String>,
    pub checker: Option<PathBuf>,
    pub interactor: Option<PathBuf>,
    pub generator: Option<PathBuf>,
    pub brute_force: Option<PathBuf>,
    pub testcases: Vec<TestcaseDto>,
}
impl ProblemDto {
    #[must_use]
    pub fn from_problem(problem: Problem, testcases: Vec<TestcaseDto>) -> Self {
        Self {
            sources: vec![],
            schema_version: 1,
            id: problem.id.0,
            code_id: problem.id.0,
            source_path: problem.src.0,
            name: problem.name,
            time_limit_ms: problem.time_limit,
            memory_limit_mb: problem.memory_limit,
            url: problem.url,
            checker: problem.checker.map(|path| path.0),
            interactor: problem.interactor.map(|path| path.0),
            generator: problem
                .stress_test
                .as_ref()
                .map(|config| config.generator.0.clone()),
            brute_force: problem.stress_test.map(|config| config.brute_force.0),
            testcases,
        }
    }
}
#[derive(Debug, Deserialize)]
pub struct CreateProblem {
    pub source_path: PathBuf,
    #[serde(default = "unnamed")]
    pub name: String,
    #[serde(default)]
    pub source_code: Option<String>,
    #[serde(flatten)]
    pub details: ProblemDetails,
}
fn unnamed() -> String {
    "Unnamed".into()
}
#[derive(Debug, Default, Deserialize)]
pub struct ProblemDetails {
    #[serde(alias = "time_limit")]
    pub time_limit_ms: Option<u32>,
    #[serde(alias = "memory_limit")]
    pub memory_limit_mb: Option<u16>,
    pub url: Option<Option<String>>,
    pub checker: Option<Option<PathBuf>>,
    pub interactor: Option<Option<PathBuf>>,
    pub generator: Option<PathBuf>,
    pub brute_force: Option<PathBuf>,
}
#[derive(Debug, Deserialize)]
pub struct UpdateProblem {
    #[serde(flatten)]
    pub reference: ProblemRef,
    pub name: Option<String>,
    #[serde(flatten)]
    pub details: ProblemDetails,
}
#[derive(Debug, Deserialize)]
pub struct MoveProblem {
    #[serde(flatten)]
    pub reference: ProblemRef,
    pub destination: PathBuf,
}
#[derive(Debug, Deserialize)]
pub struct TestcaseParams {
    #[serde(flatten)]
    pub reference: ProblemRef,
    pub testcase_id: Option<Uuid>,
    pub stdin: Option<String>,
    #[serde(alias = "output")]
    pub answer: Option<String>,
    pub testcase_ids: Option<Vec<Uuid>>,
}
#[derive(Debug, Deserialize)]
pub struct RunParams {
    #[serde(default)]
    pub compilation: crate::ports::language::CompilationMode,
    #[serde(default = "serial_jobs")]
    pub jobs: usize,
    #[serde(flatten)]
    pub reference: ProblemRef,
    #[serde(flatten)]
    pub overrides: ProblemDetails,
    pub stdin: Option<String>,
    pub answer: Option<String>,
    pub testcase_id: Option<Uuid>,
    pub testcase_ids: Option<Vec<Uuid>>,
    pub client_request_id: Option<String>,
    #[serde(default)]
    pub checker_mode: CheckerMode,
    #[serde(default)]
    pub legacy_comparison: crate::domain::checker::LegacyComparison,
    #[serde(default = "tolerance")]
    pub tolerance: f64,
    #[serde(default = "output_limit")]
    pub output_limit_bytes: usize,
    #[serde(default = "iterations")]
    pub iterations: u32,
    #[serde(default)]
    pub seed: u64,
}
fn serial_jobs() -> usize {
    1
}
fn tolerance() -> f64 {
    1e-6
}
fn output_limit() -> usize {
    1024 * 1024
}
fn iterations() -> u32 {
    1000
}
#[derive(Debug, Deserialize)]
pub struct TaskParams {
    pub task_id: String,
}
#[derive(Debug, Default, Deserialize)]
pub struct EventParams {
    #[serde(default)]
    pub sequence: u64,
    pub task_id: Option<String>,
    pub limit: Option<u32>,
}
#[derive(Debug, Default, Deserialize)]
pub struct HistoryParams {
    #[serde(flatten)]
    pub reference: ProblemRef,
    pub limit: Option<u32>,
    #[serde(default)]
    pub offset: u32,
    pub run_id: Option<String>,
    pub task_id: Option<String>,
}
#[derive(Debug, Deserialize)]
pub struct ReindexParams {
    pub source_path: PathBuf,
    pub problem_id: Uuid,
    pub client_request_id: Option<String>,
}
#[derive(Debug, Deserialize)]
pub struct ImportParams {
    pub destination: Option<PathBuf>,
    pub document: Option<serde_json::Value>,
    pub source_path: Option<PathBuf>,
    pub input: Option<PathBuf>,
    pub format: Option<String>,
    pub problem: Option<CompanionProblem>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompanionProblem {
    pub name: String,
    pub url: Option<String>,
    pub time_limit: Option<u32>,
    pub memory_limit: Option<u16>,
    #[serde(default)]
    pub tests: Vec<CompanionTest>,
}
#[derive(Debug, Deserialize)]
pub struct CompanionTest {
    pub id: Option<Uuid>,
    pub input: String,
    pub output: String,
}

#[derive(Debug, Deserialize)]
pub struct LinkSource {
    #[serde(flatten)]
    pub reference: ProblemRef,
    pub destination: PathBuf,
}
