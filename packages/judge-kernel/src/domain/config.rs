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
    #[serde(default)]
    pub compiler_args: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct InterpreterSettings {
    pub interpreter: ExecutablePath,
    #[serde(default)]
    pub interpreter_args: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct LanguageEnv {
    #[serde(flatten)]
    pub compiler_parts: Option<CompilerSettings>,
    #[serde(flatten)]
    pub interpreter_parts: Option<InterpreterSettings>,
}

// Deserializing flattened Option<Settings> silently discards malformed fields.
// Parse the individual optional fields first so invalid paths/argument types fail.
impl<'de> Deserialize<'de> for LanguageEnv {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        struct Fields {
            compiler: Option<ExecutablePath>,
            compiler_args: Option<Vec<String>>,
            interpreter: Option<ExecutablePath>,
            interpreter_args: Option<Vec<String>>,
        }
        let fields = Fields::deserialize(deserializer)?;
        Ok(Self {
            compiler_parts: fields.compiler.map(|compiler| CompilerSettings {
                compiler,
                compiler_args: fields.compiler_args.unwrap_or_default(),
            }),
            interpreter_parts: fields.interpreter.map(|interpreter| InterpreterSettings {
                interpreter,
                interpreter_args: fields.interpreter_args.unwrap_or_default(),
            }),
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GlobalConfig {
    #[serde(default)]
    pub judge: JudgeConfig,
    pub compilation_timeout_ms: Option<u64>,
    #[serde(default)]
    pub problem: ProblemConfig,
    #[serde(default)]
    pub languages: HashMap<LanguageId, LanguageEnv>,
}

/// Defaults for judge requests; explicit request fields take precedence.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct JudgeConfig {
    pub checker_mode: super::checker::CheckerMode,
    pub legacy_comparison: super::checker::LegacyComparison,
    pub tolerance: f64,
    pub output_limit_bytes: usize,
    pub iterations: u32,
}
impl Default for JudgeConfig {
    fn default() -> Self {
        Self {
            checker_mode: super::checker::CheckerMode::Tokens,
            legacy_comparison: super::checker::LegacyComparison::default(),
            tolerance: 1e-6,
            output_limit_bytes: 1024 * 1024,
            iterations: 1000,
        }
    }
}
