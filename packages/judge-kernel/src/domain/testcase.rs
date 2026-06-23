use serde::{Deserialize, Serialize};

use crate::domain::verdict::TestcaseJudgingStatus;
use crate::domain::{TestcaseId, types::IoPath};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunResult {
    pub time_ms: u64,
    pub memory_mb: Option<u64>,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Testcase {
    pub id: TestcaseId,
    pub stdin: IoPath,
    pub answer: IoPath,
    pub status: TestcaseJudgingStatus,
}
