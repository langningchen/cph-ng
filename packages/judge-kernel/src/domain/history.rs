use std::time::SystemTime;

use serde::{Deserialize, Serialize};

use crate::domain::{Memory, ProblemVerdict, RunId, Testcase, Time};

/// Represents a single entry in the history index, summarizing the results of a run without including detailed information about each test point.
/// This struct is designed to be stored in an index for quick retrieval and display in a history view.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryIndexEntry {
    /// The unique identifier for this run, used to link to the full details of the run in storage
    pub run_id: RunId,
    /// The timestamp of when the run was executed, represented as a Unix timestamp
    pub timestamp: SystemTime,
    /// The overall verdict of the run
    pub global_verdict: ProblemVerdict,
    /// The SHA256 hash of the source code that was executed
    pub source_code_hash: String,
    /// The counts of each verdict across all test points
    pub verdict_counts: Vec<(ProblemVerdict, u32)>,
    /// The longest execution time among all test points
    pub peak_time_ms: Time,
    /// The highest memory consumption among all test points
    pub peak_memory_mb: Option<Memory>,
}

/// Represents a detailed entry in the history, including both the summary information and the detailed results for each test point.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    /// The summary information for this run
    pub summary: HistoryIndexEntry,

    /// Detailed information for each testcases
    pub testcases: Vec<Testcase>,
}
