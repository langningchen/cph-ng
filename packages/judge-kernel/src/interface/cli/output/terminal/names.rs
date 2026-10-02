//! Human labels for protocol identifiers. Never apply these to user data or command syntax.
use crate::application::method::Method;

#[cfg(test)]
mod tests;

pub(super) fn language(id: &str) -> String {
    match id {
        "c" => "C".into(),
        "cpp" => "C++".into(),
        "python" => "Python".into(),
        "rust" => "Rust".into(),
        "javascript" => "JavaScript".into(),
        "java" => "Java".into(),
        _ => label(id),
    }
}

pub(super) fn label(id: &str) -> String {
    id.split(['_', '.'])
        .filter(|word| !word.is_empty())
        .enumerate()
        .map(|(index, word)| match word {
            "id" => "ID".into(),
            "ids" => "IDs".into(),
            "uuid" => "UUID".into(),
            "url" => "URL".into(),
            "cpu" => "CPU".into(),
            "io" => "I/O".into(),
            "json" => "JSON".into(),
            "jsonl" => "JSONL".into(),
            "rpc" => "RPC".into(),
            "toml" => "TOML".into(),
            "mb" => "MiB".into(),
            "ms" => "ms".into(),
            _ if index == 0 => {
                let mut chars = word.chars();
                chars.next().map_or_else(String::new, |first| {
                    format!("{}{}", first.to_uppercase(), chars.as_str())
                })
            }
            _ => word.into(),
        })
        .collect::<Vec<_>>()
        .join(" ")
}

pub(super) fn value(key: &str, id: &str) -> String {
    match key {
        "language" | "languages" => language(id),
        "kind" | "method" | "methods" => method(id),
        "phase" | "state" | "status" | "reason" | "verdict" => match id {
            "succeeded" => "Completed".into(),
            "preparing" => "Waiting for CPU".into(),
            "testcase_finished" => "Testcase completed".into(),
            "stress_iteration" => "Stress iteration".into(),
            _ => label(id),
        },
        "checker_mode" | "checkers" => match id {
            "tokens" => "Token comparison".into(),
            "exact" => "Exact comparison".into(),
            "float" => "Floating-point comparison".into(),
            "legacy" => "Legacy comparison".into(),
            "spj" => "Special judge".into(),
            "interactive" => "Interactive judge".into(),
            _ => label(id),
        },
        "transport" | "transports" => match id {
            "stdio" => "Standard I/O".into(),
            "unix" => "Unix socket".into(),
            "pipe" => "Named pipe".into(),
            _ => label(id),
        },
        "format" | "import_format" | "export_format" | "exchange_formats" => match id {
            "native" => "Native package".into(),
            "companion" => "Companion JSON".into(),
            "prob" => "Legacy PROB".into(),
            "bin" => "Legacy BIN".into(),
            "json" => "JSON".into(),
            "jsonl" => "JSONL".into(),
            _ => label(id),
        },
        "scope" | "mode" | "cache_mode" | "compilation_mode" | "role" => label(id),
        _ => id.into(),
    }
}

fn method(id: &str) -> String {
    let Ok(method) = id.parse::<Method>() else {
        return label(id);
    };
    match method {
        Method::SystemAttach => "Attach workspace",
        Method::SystemHello => "Connect to server",
        Method::SystemPing => "Check server connection",
        Method::SystemCapabilities => "List capabilities",
        Method::SystemShutdown => "Shut down server",
        Method::ConfigGet => "Show configuration",
        Method::ConfigSet => "Save configuration",
        Method::ConfigInit => "Initialize configuration",
        Method::ToolchainDetect => "Detect toolchains",
        Method::ToolchainCheck => "Check toolchain",
        Method::TaskCreate => "Create task",
        Method::TaskList => "List tasks",
        Method::TaskGet => "Show task",
        Method::TaskCancel => "Cancel task",
        Method::TaskEventsSince => "Replay task events",
        Method::HistoryList => "List run history",
        Method::HistoryLoad => "Show historical run",
        Method::ProblemList => "List problems",
        Method::ProblemLoad => "Show problem",
        Method::ProblemCreate => "Create problem",
        Method::ProblemExport => "Export problem",
        Method::ProblemLink => "Link source",
        Method::ProblemSources => "List source bindings",
        Method::ProblemImport => "Import problem",
        Method::ProblemUpdate => "Update problem",
        Method::ProblemDelete => "Delete problem",
        Method::ProblemMove => "Move source",
        Method::IndexResolve => "Resolve source",
        Method::IndexReindexFile => "Reindex source",
        Method::IndexRebuild => "Rebuild index",
        Method::TestcaseList => "List testcases",
        Method::TestcaseAdd => "Add testcase",
        Method::TestcaseUpdate => "Update testcase",
        Method::TestcaseDelete => "Delete testcase",
        Method::TestcaseReorder => "Reorder testcases",
        Method::TestcaseRun => "Judge testcase",
        Method::TestcaseRunAll => "Judge all testcases",
        Method::JudgeRun => "Judge solution",
        Method::JudgeCancel => "Cancel judging",
        Method::StressStart => "Stress test",
        Method::StressStop => "Stop stress test",
    }
    .into()
}
