use crate::{
    application::judge::CaseResult, domain::JudgeVerdict, ports::language::CompilationStats,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledCase {
    pub case_index: usize,
    pub testcase_id: Uuid,
}

/// Closed progress protocol. Existing phase names and payload fields stay unchanged.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "phase", rename_all = "snake_case", deny_unknown_fields)]
pub enum TaskProgress {
    SourceSaved,
    Preparing {
        testcases: Vec<ScheduledCase>,
    },
    Scheduled {
        jobs: usize,
        total: usize,
    },
    Compiling,
    Compiled {
        compilation: CompilationStats,
    },
    Running {
        testcase_id: Uuid,
        case_index: usize,
        completed: usize,
    },
    TestcaseFinished {
        case_index: usize,
        testcase: CaseResult,
    },
    StressIteration {
        iteration: u32,
        seed: u64,
        verdict: JudgeVerdict,
    },
    // Index rebuild events predate the phase field; retain that wire representation.
    #[serde(untagged)]
    IndexRebuild {
        rebuilt: usize,
    },
}
