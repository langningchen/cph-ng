use crate::application::{exchange::Package, tasks::TaskFailure};
use serde_json::{Value, json};
use std::io::Write;

/// # Errors
/// Rejects unsupported exchange formats.
pub fn format(name: &str) -> Result<&'static str, TaskFailure> {
    match name {
        "native" | "cph-ng" => Ok("native"),
        "companion" => Ok("companion"),
        "prob" | "legacy-cph" => Ok("prob"),
        "bin" | "legacy-bin" => Ok("bin"),
        _ => Err(TaskFailure::invalid(
            "Unknown exchange format; use native, companion, prob or bin",
        )),
    }
}
#[must_use]
pub fn losses(package: &Package, format: &str) -> Vec<String> {
    if format == "native" {
        return vec![];
    }
    let mut losses = vec![
        "Stable problem and source identities".into(),
        "Source code contents and source associations".into(),
    ];
    if !package.history.is_empty() || !package.problem.history.is_empty() {
        losses.push("Run history, verdicts and source snapshots".into());
    }
    if !package.auxiliary.is_empty() {
        losses.push(
            if format == "bin" {
                "Auxiliary program contents (only local file paths survive)"
            } else {
                "Checker, interactor and stress-test programs"
            }
            .into(),
        );
    }
    losses.push("Kernel configuration and inherited judging standards".into());
    if format != "bin" {
        losses.push("Stable testcase identities".into());
    }
    losses
}
/// # Errors
/// Returns serialization errors or rejects oversized compatibility exports.
pub fn encode(package: &Package, format: &str) -> Result<Vec<u8>, TaskFailure> {
    if format == "native" {
        super::restore::validation::validate(package)?;
        return serde_json::to_vec_pretty(package).map_err(TaskFailure::internal);
    }
    let problem = &package.problem;
    let tests: Vec<Value> = package
        .testcases
        .iter()
        .enumerate()
        .map(|(i, case)| {
            if format == "prob" {
                json!({"id":i,"input":case.stdin,"output":case.answer})
            } else {
                json!({"input":case.stdin,"output":case.answer})
            }
        })
        .collect();
    let data = match format {
        "companion" => {
            json!({"name":problem.name,"url":problem.url,"group":"","interactive":problem.interactor.is_some(),"timeLimit":problem.time_limit,"memoryLimit":problem.memory_limit,"tests":tests,"testType":"single","input":{"type":"stdin"},"output":{"type":"stdout"},"languages":{},"batch":{"id":uuid::Uuid::new_v4(),"size":1}})
        }
        "prob" => {
            json!({"name":problem.name,"url":problem.url.as_deref().unwrap_or(""),"tests":tests,"interactive":problem.interactor.is_some(),"memoryLimit":problem.memory_limit,"timeLimit":problem.time_limit,"srcPath":problem.src.0,"group":"","local":problem.url.is_none()})
        }
        "bin" => legacy_bin(package),
        _ => return Err(TaskFailure::invalid("Unsupported export format")),
    };
    let bytes = serde_json::to_vec_pretty(&data).map_err(TaskFailure::internal)?;
    // All legacy importers accept at most 16 MiB decompressed. Never emit a file
    // that our matching importer cannot read, even when --force is supplied.
    if bytes.len() > 16 * 1024 * 1024 {
        return Err(TaskFailure::invalid(
            "Legacy export exceeds the matching importer's 16 MiB limit",
        ));
    }
    if format == "bin" {
        let mut gzip = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
        gzip.write_all(&bytes).map_err(TaskFailure::internal)?;
        gzip.finish().map_err(TaskFailure::internal)
    } else {
        Ok(bytes)
    }
}
fn legacy_bin(package: &Package) -> Value {
    let p = &package.problem;
    let tests:serde_json::Map<String,Value>=package.testcases.iter().map(|case| (case.id.to_string(),json!({"stdin":{"data":case.stdin},"answer":{"data":case.answer},"isExpand":true,"isDisabled":false,"result":null}))).collect();
    let file = |source: &crate::domain::SourcePath| json!({"path":source.0});
    json!({"version":"1.0.0","name":p.name,"url":p.url,"src":file(&p.src),"checker":p.checker.as_ref().map(file),"interactor":p.interactor.as_ref().map(file),"testcases":tests,"testcaseOrder":package.testcases.iter().map(|case|case.id).collect::<Vec<_>>(),"stressTest":{"generator":p.stress_test.as_ref().map(|s|file(&s.generator)),"bruteForce":p.stress_test.as_ref().map(|s|file(&s.brute_force)),"cnt":0,"state":"inactive"},"timeElapsedMs":0,"overrides":{"timeLimitMs":p.time_limit,"memoryLimitMb":p.memory_limit}})
}
