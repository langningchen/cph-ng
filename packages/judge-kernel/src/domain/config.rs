use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::domain::{
    LanguageId,
    types::{ExecutablePath, Memory, Time},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProblemConfig {
    #[serde(default = "default_time")]
    pub time_limit: Time,
    #[serde(default = "default_memory")]
    pub memory_limit: Memory,
}

fn default_time() -> Time {
    1000
}
fn default_memory() -> Memory {
    256
}

impl Default for ProblemConfig {
    fn default() -> Self {
        Self {
            time_limit: default_time(),
            memory_limit: default_memory(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CompilerSettings {
    pub compiler: ExecutablePath,
    pub compiler_args: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct InterpreterSettings {
    pub interpreter: ExecutablePath,
    pub interpreter_args: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LanguageEnv {
    #[serde(flatten)]
    pub compiler_parts: Option<CompilerSettings>,
    #[serde(flatten)]
    pub interpreter_parts: Option<InterpreterSettings>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GlobalConfig {
    #[serde(default)]
    pub problem: ProblemConfig,
    #[serde(default)]
    pub languages: HashMap<LanguageId, LanguageEnv>,
}
