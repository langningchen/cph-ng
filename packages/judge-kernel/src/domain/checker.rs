use crate::domain::JudgeVerdict;
pub mod difference;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[derive(Default)]
pub enum CheckerMode {
    #[default]
    Tokens,
    Exact,
    Float,
    /// Compatibility with the VS Code extension's original whitespace comparison.
    Legacy,
}

#[must_use]
pub fn compare(actual: &str, expected: &str, mode: &CheckerMode, tolerance: f64) -> bool {
    match mode {
        CheckerMode::Exact => actual == expected,
        CheckerMode::Tokens => actual.split_whitespace().eq(expected.split_whitespace()),
        CheckerMode::Legacy => actual
            .chars()
            .filter(|value| !value.is_whitespace())
            .eq(expected.chars().filter(|value| !value.is_whitespace())),
        CheckerMode::Float => {
            let actual: Vec<_> = actual.split_whitespace().collect();
            let expected: Vec<_> = expected.split_whitespace().collect();
            actual.len() == expected.len()
                && actual.iter().zip(expected).all(|(actual, expected)| {
                    if *actual == expected {
                        return true;
                    }
                    match (actual.parse::<f64>(), expected.parse::<f64>()) {
                        (Ok(a), Ok(b)) if a.is_finite() && b.is_finite() => {
                            (a - b).abs() <= tolerance.max(tolerance * b.abs())
                        }
                        _ => false,
                    }
                })
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct LegacyComparison {
    pub ignore_stderr: bool,
    pub regard_pe_as_ac: bool,
    pub output_ratio_limit: Option<f64>,
}
impl Default for LegacyComparison {
    fn default() -> Self {
        Self {
            ignore_stderr: true,
            regard_pe_as_ac: false,
            output_ratio_limit: None,
        }
    }
}
#[must_use]
pub fn legacy_verdict(
    actual: &str,
    expected: &str,
    stderr: &str,
    options: &LegacyComparison,
) -> JudgeVerdict {
    if !options.ignore_stderr && !stderr.trim().is_empty() {
        return JudgeVerdict::RuntimeError;
    }
    let normalize = |value: &str| {
        value
            .trim_end()
            .split('\n')
            .map(str::trim_end)
            .collect::<Vec<_>>()
            .join("\n")
    };
    let actual_normalized = normalize(actual);
    let expected_normalized = normalize(expected);
    // Kernel inputs are bounded to 16 MiB. Reject oversized direct callers too,
    // so conversion to f64 is exact instead of silently rounding a usize.
    let (Ok(actual_units), Ok(expected_units)) = (
        u32::try_from(actual_normalized.encode_utf16().count()),
        u32::try_from(expected_normalized.encode_utf16().count()),
    ) else {
        return JudgeVerdict::OutputLimitExceeded;
    };
    if options.output_ratio_limit.is_some_and(|ratio| {
        ratio > 0.0 && f64::from(actual_units) > f64::from(expected_units) * ratio
    }) {
        return JudgeVerdict::OutputLimitExceeded;
    }
    if !compare(actual, expected, &CheckerMode::Legacy, 0.0) {
        return JudgeVerdict::WrongAnswer;
    }
    if !options.regard_pe_as_ac && actual_normalized != expected_normalized {
        return JudgeVerdict::PresentationError;
    }
    JudgeVerdict::Accepted
}
