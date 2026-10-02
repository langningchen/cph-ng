use std::{
    collections::HashMap,
    io::Read,
    path::{Path, PathBuf},
};

use toml_edit::DocumentMut;

use crate::{
    domain::{
        Memory, Problem, ProblemId, ProblemJudgingStatus, SourcePath, Testcase, TestcaseId, Time,
        types::IoPath, verdict::TestcaseJudgingStatus,
    },
    infrastructure::repo::workspace::WorkspacePaths,
    ports::{ExchangeError, ImportedData, checked_import_value, exchange::ProblemImporter},
};

mod legacy_cph_problem {
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct Test {
        pub id: i32,
        pub input: String,
        pub output: String,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct Problem {
        pub name: String,
        pub url: String,
        pub tests: Vec<Test>,
        pub interactive: bool,
        pub memory_limit: u64,
        pub time_limit: u64,
        pub src_path: String,
        pub group: String,
        pub local: bool,
    }
}

#[derive(Debug)]
pub struct LegacyCphProb {
    store_root: PathBuf,
}

impl LegacyCphProb {
    #[must_use]
    pub fn new(store_root: PathBuf) -> Self {
        Self { store_root }
    }
}

#[async_trait::async_trait]
impl ProblemImporter for LegacyCphProb {
    fn can_import(&self, path: &Path) -> bool {
        path.extension().is_some_and(|ext| ext == "prob")
    }

    fn import(&self, path: &Path) -> Result<ImportedData, ExchangeError> {
        let file = std::fs::File::open(path)?;
        let mut json = String::new();
        file.take(16 * 1024 * 1024 + 1).read_to_string(&mut json)?;
        if json.len() > 16 * 1024 * 1024 {
            return Err(std::io::Error::other("Import exceeds size limit").into());
        }
        let cph_problem: legacy_cph_problem::Problem = serde_json::from_str(&json)?;

        let problem_id = ProblemId(uuid::Uuid::new_v4());
        let workspace = WorkspacePaths::for_id(&self.store_root, problem_id);

        let mut testcases = Vec::new();
        let mut testcase_payloads = HashMap::new();

        for test in cph_problem.tests {
            let tc_id = TestcaseId(uuid::Uuid::new_v4());
            let (stdin_path, ans_path) = workspace.get_testcase_paths(&tc_id);

            testcases.push(Testcase {
                id: tc_id,
                stdin: IoPath(stdin_path),
                answer: IoPath(ans_path),
                status: TestcaseJudgingStatus::Waiting,
            });
            testcase_payloads.insert(tc_id, (test.input, test.output));
        }

        let time_limit: Time = {
            let raw = cph_problem.time_limit;
            checked_import_value("time_limit_ms", raw, 300_000_u32)?
        };
        let memory_limit: Memory = {
            let raw = cph_problem.memory_limit;
            checked_import_value("memory_limit_mb", raw, u16::MAX)?
        };

        let problem = Problem {
            version: 1,
            id: problem_id,
            src: SourcePath(PathBuf::from(cph_problem.src_path)),
            name: cph_problem.name,
            status: ProblemJudgingStatus::NotStarted,
            time_limit,
            memory_limit,
            testcases,
            url: Some(cph_problem.url),
            checker: None,
            interactor: None,
            stress_test: None,
            history: Vec::new(),
        };

        Ok(ImportedData {
            problem,
            language_env: DocumentMut::new(),
            testcase_payloads,
        })
    }
}
