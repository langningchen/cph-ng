use std::{
    collections::HashMap,
    fs,
    io::Read,
    path::{Path, PathBuf},
};

use flate2::read::GzDecoder;

use crate::{
    domain::{
        IoPath, Memory, Problem, ProblemId, ProblemJudgingStatus, SourcePath, StressTestConfig,
        Testcase, TestcaseId, TestcaseJudgingStatus, Time,
    },
    infrastructure::repo::workspace::WorkspacePaths,
    ports::{ExchangeError, ImportedData, checked_import_value, exchange::ProblemImporter},
};

mod config;
mod model;
use model as legacy_bin_problem;

#[derive(Debug)]
pub struct LegacyBin {
    store_root: PathBuf,
    paths: Option<crate::application::paths::PathPolicy>,
}

impl LegacyBin {
    #[must_use]
    pub fn new(store_root: PathBuf) -> Self {
        Self {
            store_root,
            paths: None,
        }
    }

    #[must_use]
    pub fn with_path_policy(mut self, paths: crate::application::paths::PathPolicy) -> Self {
        self.paths = Some(paths);
        self
    }
    fn load_problem(path: &Path) -> Result<legacy_bin_problem::Problem, ExchangeError> {
        let file = fs::File::open(path)?;
        let mut decoder = GzDecoder::new(file).take(16 * 1024 * 1024 + 1);
        let mut json_str = String::new();
        decoder.read_to_string(&mut json_str)?;
        if json_str.len() > 16 * 1024 * 1024 {
            return Err(std::io::Error::other("Import exceeds decompressed size limit").into());
        }
        let problem: legacy_bin_problem::Problem = serde_json::from_str(&json_str)?;
        Ok(problem)
    }

    fn read_io_to_string(
        &self,
        io: legacy_bin_problem::TestcaseIo,
        base: &Path,
    ) -> Result<String, ExchangeError> {
        if let Some(data) = io.data {
            return Ok(data);
        }
        let Some(path) = io.path else {
            return Ok(String::new());
        };
        let path = PathBuf::from(path);
        let path = fs::canonicalize(if path.is_absolute() {
            path
        } else {
            base.join(path)
        })?;
        if self
            .paths
            .as_ref()
            .is_some_and(|paths| !paths.permits(&path))
        {
            return Err(std::io::Error::other(
                "Imported IO path is outside configured workspace roots",
            )
            .into());
        }
        if !fs::metadata(&path)?.is_file() {
            return Err(std::io::Error::other("Imported IO must be a regular file").into());
        }
        let mut content = String::new();
        fs::File::open(path)?
            .take(16 * 1024 * 1024 + 1)
            .read_to_string(&mut content)?;
        if content.len() > 16 * 1024 * 1024 {
            return Err(std::io::Error::other("Imported IO exceeds size limit").into());
        }
        Ok(content)
    }
}

#[async_trait::async_trait]
impl ProblemImporter for LegacyBin {
    fn can_import(&self, path: &Path) -> bool {
        path.extension().is_some_and(|ext| ext == "bin")
    }

    fn import(&self, path: &Path) -> Result<ImportedData, ExchangeError> {
        let mut legacy_problem = Self::load_problem(path)?;

        let src_path = PathBuf::from(&legacy_problem.src.path);
        let problem_id = ProblemId(uuid::Uuid::new_v4());
        let workspace = WorkspacePaths::for_id(&self.store_root, problem_id);

        let ImportedTestcases {
            testcases,
            testcase_payloads,
        } = self.testcases(&mut legacy_problem, &workspace, &src_path)?;

        let time_limit: Time = {
            let raw = legacy_problem.overrides.time_limit_ms.unwrap_or(1000);
            checked_import_value("time_limit_ms", raw, 300_000_u32)?
        };
        let memory_limit: Memory = {
            let raw = legacy_problem.overrides.memory_limit_mb.unwrap_or(256);
            checked_import_value("memory_limit_mb", raw, u16::MAX)?
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
            id: problem_id,
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

        let language_env = config::language_env(&problem.src.0, legacy_problem.overrides);

        Ok(ImportedData {
            problem,
            language_env,
            testcase_payloads,
        })
    }
}

impl LegacyBin {
    fn testcases(
        &self,
        legacy_problem: &mut legacy_bin_problem::Problem,
        workspace: &WorkspacePaths,
        source: &Path,
    ) -> Result<ImportedTestcases, ExchangeError> {
        let mut testcases = Vec::new();
        let mut testcase_payloads = HashMap::new();
        let order = legacy_problem.testcase_order.clone();
        let mut total_bytes = 0;
        let mut seen = std::collections::HashSet::new();

        for uuid in order {
            if !seen.insert(uuid) {
                return Err(std::io::Error::other("Duplicate testcase in import order").into());
            }
            if let Some(legacy_tc) = legacy_problem.testcases.remove(&uuid) {
                let stdin_str = self.read_io_to_string(
                    legacy_tc.stdin,
                    source.parent().unwrap_or_else(|| Path::new(".")),
                )?;
                let answer_str = self.read_io_to_string(
                    legacy_tc.answer,
                    source.parent().unwrap_or_else(|| Path::new(".")),
                )?;
                total_bytes += stdin_str.len() + answer_str.len();
                if total_bytes > 16 * 1024 * 1024 {
                    return Err(std::io::Error::other(
                        "Total imported testcase content exceeds 16 MiB",
                    )
                    .into());
                }

                let tc_id = TestcaseId(uuid);
                let (stdin_path, ans_path) = workspace.get_testcase_paths(&tc_id);

                testcases.push(Testcase {
                    id: tc_id,
                    stdin: IoPath(stdin_path),
                    answer: IoPath(ans_path),
                    status: TestcaseJudgingStatus::Waiting,
                });

                testcase_payloads.insert(tc_id, (stdin_str, answer_str));
            } else {
                return Err(
                    std::io::Error::other("Import order references a missing testcase").into(),
                );
            }
        }
        if !legacy_problem.testcases.is_empty() {
            return Err(std::io::Error::other("Import order omits testcases").into());
        }

        Ok(ImportedTestcases {
            testcases,
            testcase_payloads,
        })
    }
}

struct ImportedTestcases {
    testcases: Vec<Testcase>,
    testcase_payloads: HashMap<TestcaseId, (String, String)>,
}
