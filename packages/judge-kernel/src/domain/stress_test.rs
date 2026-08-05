use serde::{Deserialize, Serialize};

use crate::domain::SourcePath;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StressTestConfig {
    pub generator: SourcePath,
    pub brute_force: SourcePath,
}
