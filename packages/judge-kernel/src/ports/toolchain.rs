use crate::{application::tasks::TaskFailure, domain::LanguageId};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, clap::ValueEnum)]
#[serde(rename_all = "lowercase")]
pub enum ToolchainKind {
    Compiler,
    Interpreter,
}
#[derive(Debug, Deserialize)]
pub struct ToolchainQuery {
    pub language: Option<LanguageId>,
    pub kind: Option<ToolchainKind>,
    pub path: Option<PathBuf>,
}
#[derive(Debug, Serialize)]
pub struct ToolchainItem {
    pub language: LanguageId,
    pub kind: ToolchainKind,
    pub path: PathBuf,
    pub name: String,
    pub version: String,
    pub description: String,
    pub group: String,
}
#[async_trait::async_trait]
pub trait ToolchainDiscovery: Send + Sync + std::fmt::Debug {
    async fn detect(&self, language: Option<LanguageId>)
    -> Result<Vec<ToolchainItem>, TaskFailure>;
    async fn check(&self, query: ToolchainQuery) -> Result<Option<ToolchainItem>, TaskFailure>;
}
