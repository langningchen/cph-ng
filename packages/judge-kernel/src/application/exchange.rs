//! Versioned, self-contained problem exchange shared by CLI and RPC.
pub mod encode;
mod restore;
mod snapshot;
use crate::{
    application::{models::TestcaseDto, tasks::TaskInfo},
    domain::{GlobalConfig, Problem},
};
pub use restore::restore;
use serde::{Deserialize, Serialize};
pub use snapshot::snapshot;
use std::path::PathBuf;
use uuid::Uuid;

pub const MAX_PACKAGE_BYTES: usize = 128 * 1024 * 1024;
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Package {
    pub format: String,
    pub version: u32,
    pub problem: Problem,
    pub testcases: Vec<TestcaseDto>,
    pub sources: Vec<Source>,
    pub auxiliary: Vec<File>,
    pub config_toml: String,
    pub effective_config: GlobalConfig,
    pub imported_config_toml: Option<String>,
    pub history: Vec<TaskInfo>,
    #[serde(default)]
    pub origins: Vec<IdentityMap>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct File {
    pub path: PathBuf,
    pub content: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Source {
    pub code_id: Uuid,
    #[serde(flatten)]
    pub file: File,
}
#[derive(Debug, Deserialize)]
pub struct ExportParams {
    #[serde(flatten)]
    pub reference: super::models::ProblemRef,
    pub destination: PathBuf,
    #[serde(default = "native")]
    pub format: String,
    #[serde(default)]
    pub force: bool,
    #[serde(default)]
    pub dry_run: bool,
}
fn native() -> String {
    "native".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct IdentityMap {
    pub original_problem_id: Uuid,
    pub imported_problem_id: Uuid,
    pub source_ids: std::collections::HashMap<String, String>,
    pub run_ids: std::collections::HashMap<String, String>,
}
