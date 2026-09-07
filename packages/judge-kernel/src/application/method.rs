//! Closed command vocabulary. Wire names are declared exactly once here.
use std::{fmt, str::FromStr};

use serde::{Deserialize, Serialize};

macro_rules! methods {
    ($($variant:ident => $wire:literal),+ $(,)?) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
        pub enum Method {
            $(#[serde(rename = $wire)] $variant),+
        }

        impl Method {
            pub const ALL: &'static [Self] = &[$(Self::$variant),+];

            #[must_use]
            pub const fn as_str(self) -> &'static str {
                match self { $(Self::$variant => $wire),+ }
            }
        }

        impl FromStr for Method {
            type Err = UnknownMethod;

            fn from_str(value: &str) -> Result<Self, Self::Err> {
                match value {
                    $($wire => Ok(Self::$variant),)+
                    _ => Err(UnknownMethod(value.to_owned())),
                }
            }
        }
    };
}

methods! {
    SystemAttach => "system.attach",
    SystemHello => "system.hello",
    SystemPing => "system.ping",
    SystemCapabilities => "system.capabilities",
    SystemShutdown => "system.shutdown",
    ConfigGet => "config.get",
    ConfigSet => "config.set",
    ConfigInit => "config.init",
    ToolchainDetect => "toolchain.detect",
    ToolchainCheck => "toolchain.check",
    TaskCreate => "task.create",
    TaskList => "task.list",
    TaskGet => "task.get",
    TaskCancel => "task.cancel",
    TaskEventsSince => "task.events_since",
    HistoryList => "history.list",
    HistoryLoad => "history.load",
    ProblemList => "problem.list",
    ProblemLoad => "problem.load",
    ProblemCreate => "problem.create",
    ProblemExport => "problem.export",
    ProblemLink => "problem.link",
    ProblemSources => "problem.sources",
    ProblemImport => "problem.import",
    ProblemUpdate => "problem.update",
    ProblemDelete => "problem.delete",
    ProblemMove => "problem.move",
    IndexResolve => "index.resolve",
    IndexReindexFile => "index.reindex_file",
    IndexRebuild => "index.rebuild",
    TestcaseList => "testcase.list",
    TestcaseAdd => "testcase.add",
    TestcaseUpdate => "testcase.update",
    TestcaseDelete => "testcase.delete",
    TestcaseReorder => "testcase.reorder",
    TestcaseRun => "testcase.run",
    TestcaseRunAll => "testcase.run_all",
    JudgeRun => "judge.run",
    JudgeCancel => "judge.cancel",
    StressStart => "stress.start",
    StressStop => "stress.stop",
}

#[derive(Debug, Clone, thiserror::Error)]
#[error("Unknown method: {0}")]
pub struct UnknownMethod(pub String);

impl fmt::Display for Method {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}
