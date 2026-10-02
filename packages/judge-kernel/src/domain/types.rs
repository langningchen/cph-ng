use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Time in milliseconds
pub type Time = u32;
/// Memory in MB
pub type Memory = u16;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SourcePath(pub PathBuf);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
pub struct ExecutablePath(pub PathBuf);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct IoPath(pub PathBuf);

//////////////////////////////////////////////////////////////////////////

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ProblemId(pub Uuid);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TestcaseId(pub Uuid);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct RunId(pub Uuid);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct BatchId(pub Uuid);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LanguageId {
    Cpp,
    C,
    Python,
    Rust,
    Javascript,
    Java,
}

impl std::fmt::Display for LanguageId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            Self::Cpp => "cpp",
            Self::C => "c",
            Self::Python => "python",
            Self::Rust => "rust",
            Self::Javascript => "javascript",
            Self::Java => "java",
        };
        write!(f, "{s}")
    }
}

impl LanguageId {
    #[must_use]
    pub fn from_path(path: &std::path::Path) -> Option<Self> {
        match path.extension()?.to_str()?.to_ascii_lowercase().as_str() {
            "c" => Some(Self::C),
            "cpp" | "cc" | "cxx" | "c++" => Some(Self::Cpp),
            "py" => Some(Self::Python),
            "rs" => Some(Self::Rust),
            "js" | "cjs" | "mjs" => Some(Self::Javascript),
            "java" => Some(Self::Java),
            _ => None,
        }
    }
}
