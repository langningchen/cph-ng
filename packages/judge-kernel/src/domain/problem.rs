use serde::{Deserialize, Serialize};

use crate::domain::{
    HistoryIndexEntry,
    Memory,
    ProblemId,
    ProblemJudgingStatus,
    SourcePath,
    StressTestConfig,
    Testcase,
    Time,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Problem {
    pub version: u16,
    pub id: ProblemId,
    pub name: String,
    pub src: SourcePath,
    pub status: ProblemJudgingStatus,
    pub time_limit: Time,
    pub memory_limit: Memory,
    pub url: Option<String>,
    pub checker: Option<SourcePath>,
    pub interactor: Option<SourcePath>,
    pub testcases: Vec<Testcase>,
    pub stress_test: Option<StressTestConfig>,
    pub history: Vec<HistoryIndexEntry>,
}

impl Problem {
    pub fn new(name: String, source_path: SourcePath) -> Self {
        Self {
            version: 1,
            id: ProblemId(uuid::Uuid::new_v4()),
            name,
            src: source_path,
            status: ProblemJudgingStatus::NotStarted,
            time_limit: 1000,
            memory_limit: 256,
            url: None,
            checker: None,
            interactor: None,
            testcases: Vec::new(),
            stress_test: None,
            history: Vec::new(),
        }
    }
}
