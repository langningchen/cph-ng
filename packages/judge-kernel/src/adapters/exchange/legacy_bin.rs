use std::{
    collections::HashMap,
    fs,
    io::Read,
    path::{Path, PathBuf},
};

use flate2::read::GzDecoder;
use toml_edit::{DocumentMut, value};

use crate::{
    adapters::repo::workspace::WorkspacePaths,
    domain::{
        IoPath,
        Memory,
        Problem,
        ProblemId,
        ProblemJudgingStatus,
        SourcePath,
        StressTestConfig,
        Testcase,
        TestcaseId,
        TestcaseJudgingStatus,
        Time,
    },
    ports::{
        ExchangeError,
        ImportedData,
        clamp_or_abort,
        exchange::ProblemImporter,
        inquire::Inquire,
    },
};

mod legacy_bin_problem {
    use std::collections::HashMap;

    use serde::{Deserialize, Serialize};
    use uuid::Uuid;

    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub enum StressTestState {
        Inactive,
        Compiling,
        CompilationError,
        Generating,
        RunningBruteForce,
        RunningSolution,
        FoundDifference,
        InternalError,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct TestcaseIo {
        pub data: Option<String>,
        pub path: Option<String>,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct TestcaseResult {
        pub verdict: String,
        pub time_ms: Option<f64>,
        pub memory_mb: Option<f64>,
        pub stdout: Option<TestcaseIo>,
        pub stderr: Option<TestcaseIo>,
        pub msg: Option<String>,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct Testcase {
        pub stdin: TestcaseIo,
        pub answer: TestcaseIo,
        pub is_expand: bool,
        pub is_disabled: bool,
        pub result: Option<TestcaseResult>,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct FileWithHash {
        pub path: String,
        pub hash: Option<String>,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct StressTest {
        pub generator: Option<FileWithHash>,
        pub brute_force: Option<FileWithHash>,
        pub cnt: u64,
        pub state: StressTestState,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct Overrides {
        pub time_limit_ms: Option<u64>,
        pub memory_limit_mb: Option<u64>,
        pub compiler: Option<String>,
        pub compiler_args: Option<String>,
        pub interpreter: Option<String>,
        pub interpreter_args: Option<String>,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct Problem {
        pub version: String,
        pub name: String,
        pub url: Option<String>,
        pub testcases: HashMap<Uuid, Testcase>,
        pub testcase_order: Vec<Uuid>,
        pub src: FileWithHash,
        pub checker: Option<FileWithHash>,
        pub interactor: Option<FileWithHash>,
        pub stress_test: StressTest,
        pub time_elapsed_ms: u64,
        pub overrides: Overrides,
    }
}

pub struct LegacyBin {
    store_root: PathBuf,
}

impl LegacyBin {
    pub fn new(store_root: PathBuf) -> Self {
        Self { store_root }
    }

    fn load_problem(path: &Path) -> Result<legacy_bin_problem::Problem, ExchangeError> {
        let file = fs::File::open(path)?;
        let mut decoder = GzDecoder::new(file);
        let mut json_str = String::new();
        decoder.read_to_string(&mut json_str)?;
        let problem: legacy_bin_problem::Problem = serde_json::from_str(&json_str)?;
        Ok(problem)
    }

    fn read_io_to_string(io: legacy_bin_problem::TestcaseIo) -> String {
        if let Some(data) = io.data {
            data
        } else if let Some(p_str) = io.path {
            let p = Path::new(&p_str);
            if !p.is_absolute() {
                return p_str;
            }
            fs::read_to_string(p).unwrap_or_default()
        } else {
            String::new()
        }
    }
}

#[async_trait::async_trait]
impl ProblemImporter for LegacyBin {
    fn can_import(&self, path: &Path) -> bool {
        path.extension().is_some_and(|ext| ext == "bin")
    }

    fn import(&self, path: &Path, inquire: &dyn Inquire) -> Result<ImportedData, ExchangeError> {
        let mut legacy_problem = Self::load_problem(path)?;

        let src_path = PathBuf::from(&legacy_problem.src.path);
        let workspace = WorkspacePaths::new(&self.store_root, &src_path);

        let mut testcases = Vec::new();
        let mut testcase_payloads = HashMap::new();
        let order = legacy_problem.testcase_order.clone();

        for uuid in order {
            if let Some(legacy_tc) = legacy_problem.testcases.remove(&uuid) {
                let stdin_str = Self::read_io_to_string(legacy_tc.stdin);
                let answer_str = Self::read_io_to_string(legacy_tc.answer);

                let tc_id = TestcaseId(uuid);
                let (stdin_path, ans_path) = workspace.get_testcase_paths(&tc_id);

                testcases.push(Testcase {
                    id: tc_id,
                    stdin: IoPath(stdin_path),
                    answer: IoPath(ans_path),
                    status: TestcaseJudgingStatus::Waiting,
                });

                testcase_payloads.insert(tc_id, (stdin_str, answer_str));
            }
        }

        let time_limit: Time = {
            let raw = legacy_problem.overrides.time_limit_ms.unwrap_or(1000);
            clamp_or_abort("time_limit_ms", raw, u32::MAX, inquire)?
        };
        let memory_limit: Memory = {
            let raw = legacy_problem.overrides.memory_limit_mb.unwrap_or(256);
            clamp_or_abort("memory_limit_mb", raw, u16::MAX, inquire)?
        };

        let generator = legacy_problem.stress_test.generator;
        let brute_force = legacy_problem.stress_test.brute_force;
        let stress_test_config =
            if let (Some(generator), Some(brute_force)) = (generator, brute_force) {
                Some(StressTestConfig {
                    generator: SourcePath(PathBuf::from(generator.path)),
                    brute_force: SourcePath(PathBuf::from(brute_force.path)),
                })
            } else {
                None
            };

        let checker = legacy_problem
            .checker
            .map(|c| SourcePath(PathBuf::from(c.path)));
        let interactor = legacy_problem
            .interactor
            .map(|i| SourcePath(PathBuf::from(i.path)));

        let problem = Problem {
            version: 1,
            id: ProblemId(uuid::Uuid::new_v4()),
            name: legacy_problem.name,
            src: SourcePath(src_path),
            status: ProblemJudgingStatus::NotStarted,
            time_limit,
            memory_limit,
            url: legacy_problem.url,
            checker,
            interactor,
            testcases,
            stress_test: stress_test_config,
            history: Vec::new(),
        };

        let mut language_env = DocumentMut::new();
        if let Some(compiler_path) = legacy_problem.overrides.compiler {
            language_env.insert("compiler", value(compiler_path));
        }
        if let Some(compiler_args) = legacy_problem.overrides.compiler_args {
            language_env.insert("compilerArgs", value(compiler_args));
        }
        if let Some(interpreter_path) = legacy_problem.overrides.interpreter {
            language_env.insert("interpreter", value(interpreter_path));
        }
        if let Some(interpreter_args) = legacy_problem.overrides.interpreter_args {
            language_env.insert("interpreterArgs", value(interpreter_args));
        }

        Ok(ImportedData {
            problem,
            language_env,
            testcase_payloads,
        })
    }
}
