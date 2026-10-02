pub use super::exchange::{ExportArgs, ImportArgs};
pub use super::settings_args::{ConfigAction, ConfigScope, ToolchainAction};
use std::path::PathBuf;

use clap::{Args, Subcommand, ValueEnum};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, Default, ValueEnum, PartialEq, Eq)]
pub enum OutputFormat {
    #[default]
    Human,
    Json,
    Jsonl,
}

#[derive(Debug, Subcommand)]
pub enum Commands {
    /// Generate shell completion scripts
    #[command(alias = "completion")]
    Completions {
        #[arg(value_enum)]
        shell: clap_complete::Shell,
        /// Generate a static script without live ID suggestions.
        #[arg(long)]
        r#static: bool,
    },
    /// Compare a saved run with its original answer
    Diff(super::diff::DiffArgs),
    /// Export a shareable problem package.
    Export(ExportArgs),
    /// Start the resident JSON-RPC server.
    Serve(super::server::ServeArgs),
    /// Run the local Companion browser and editor router.
    Router(crate::interface::router::RouterArgs),
    /// Discover or inspect local compilers and interpreters.
    Toolchain {
        #[command(subcommand)]
        action: ToolchainAction,
    },
    /// Compile and judge a source file
    #[command(visible_alias = "r")]
    Run(Box<RunArgs>),
    /// Run or cancel a judge task
    Judge {
        #[command(subcommand)]
        action: JudgeAction,
    },
    /// Manage problems and import existing problem data.
    Problem {
        #[command(subcommand)]
        action: ProblemAction,
    },
    /// Manage and run stored testcases
    #[command(visible_alias = "tc")]
    Testcase {
        #[command(subcommand)]
        action: TestcaseAction,
    },
    /// Find counterexamples with generated testcases
    Stress {
        #[command(subcommand)]
        action: StressAction,
    },
    /// Inspect, follow, wait for, or cancel tasks
    Task {
        #[command(subcommand)]
        action: TaskAction,
    },
    /// Query persisted judge runs and source snapshots.
    History {
        #[command(subcommand)]
        action: HistoryAction,
    },
    /// Resolve source identities and rebuild indexes.
    Index {
        #[command(subcommand)]
        action: IndexAction,
    },
    /// Import a problem package or Companion JSON
    Import(ImportArgs),
    /// Inspect and update configuration
    Config {
        /// Existing source file; also accepted as --source.
        src: Option<PathBuf>,
        #[arg(long, conflicts_with = "src")]
        source: Option<PathBuf>,
        #[command(subcommand)]
        action: ConfigAction,
        /// Defaults to problem when a source is given, otherwise global.
        #[arg(long, value_enum, global = true)]
        scope: Option<ConfigScope>,
    },
    /// List operations, languages, and supervision features
    Capabilities,
}
#[derive(Debug, Args, Clone)]
#[group(required = true, multiple = false)]
pub struct ProblemRef {
    /// Source file; paths are resolved from the current directory.
    pub source: Option<PathBuf>,
    /// Stable problem UUID; useful after the source file was removed.
    #[arg(long, value_name = "UUID")]
    pub problem_id: Option<Uuid>,
    /// Stable source UUID; selects one source within a shared problem.
    #[arg(long, value_name = "UUID")]
    pub code_id: Option<Uuid>,
}
#[derive(Debug, Args, Clone, Default)]
#[command(next_help_heading = "Limits and programs")]
pub struct Details {
    /// Maximum runtime per testcase in milliseconds (1–300000).
    #[arg(long, alias = "time-limit", value_name = "MS")]
    pub time_limit_ms: Option<u32>,
    /// Process-tree memory limit in MiB (1–65535).
    #[arg(long, alias = "memory-limit", value_name = "MIB")]
    pub memory_limit_mb: Option<u16>,
    /// Special checker source; receives input, output and answer file paths.
    #[arg(long, conflicts_with = "clear_checker", value_name = "FILE")]
    pub checker: Option<PathBuf>,
    /// Disable the configured special checker.
    #[arg(long)]
    pub clear_checker: bool,
    /// Interactor source; connects to the solution through stdin/stdout.
    #[arg(long, conflicts_with = "clear_interactor", value_name = "FILE")]
    pub interactor: Option<PathBuf>,
    /// Disable the configured interactor.
    #[arg(long)]
    pub clear_interactor: bool,
    /// Generator source; receives the current seed as its first argument
    #[arg(long, conflicts_with = "clear_stress", value_name = "FILE")]
    pub generator: Option<PathBuf>,
    /// Reference solution for stress testing
    #[arg(long, conflicts_with = "clear_stress", value_name = "FILE")]
    pub brute_force: Option<PathBuf>,
    /// Clear both generator and brute-force configuration.
    #[arg(long)]
    pub clear_stress: bool,
}
#[derive(Debug, Args, Clone, Default)]
#[command(next_help_heading = "Test input")]
pub struct TestData {
    /// Literal input text.
    #[arg(
        long = "input-text",
        alias = "stdin",
        conflicts_with = "input",
        value_name = "TEXT",
        allow_hyphen_values = true
    )]
    pub stdin: Option<String>,
    /// Input file, or - to read standard input.
    #[arg(short = 'i', long = "input-file", aliases = ["input", "stdin-file"], value_name = "FILE")]
    pub input: Option<PathBuf>,
    /// Literal answer text.
    #[arg(
        long = "answer-text",
        alias = "answer",
        conflicts_with = "answer_file",
        value_name = "TEXT",
        allow_hyphen_values = true
    )]
    pub answer: Option<String>,
    /// Answer file, or - to read standard input.
    #[arg(long, value_name = "FILE")]
    pub answer_file: Option<PathBuf>,
}
#[derive(Debug, Args)]
#[command(next_help_heading = "Build")]
pub struct CompilationArgs {
    /// Run only with a valid compilation cache; fail if compilation would be needed.
    #[arg(long, conflicts_with = "force_compile")]
    pub skip_compile: bool,
    /// Ignore cached artifacts and rebuild all solution/auxiliary programs.
    #[arg(long, alias = "recompile")]
    pub force_compile: bool,
}
#[derive(Debug, Args)]
pub struct RunArgs {
    #[command(flatten)]
    pub reference: ProblemRef,
    /// Stored testcase UUIDs. Repeat the flag or separate UUIDs with commas.
    #[arg(
        long = "testcase-id",
        short = 't',
        value_delimiter = ',',
        value_name = "UUID"
    )]
    pub testcase_ids: Vec<Uuid>,
    /// Parallel testcases (default 1); capped at half the available CPUs and at most 4.
    #[arg(short = 'j', long, value_parser = clap::value_parser!(u16).range(1..=256))]
    pub jobs: Option<u16>,
    #[command(flatten)]
    pub compilation: CompilationArgs,
    /// Input/answer overrides run a temporary testcase without changing stored tests.
    #[command(flatten)]
    pub data: TestData,
    /// Limits and auxiliary programs apply to this run only.
    #[command(flatten)]
    pub details: Details,
    /// Select the built-in answer comparison policy
    #[arg(long, help_heading = "Comparison", value_parser=["tokens","exact","float","legacy"])]
    pub checker_mode: Option<String>,
    /// Absolute/relative tolerance for float comparison (0–1).
    #[arg(long, help_heading = "Comparison")]
    pub tolerance: Option<f64>,
    /// Maximum combined stdout/stderr bytes (1–16777216)
    #[arg(long, help_heading = "Limits and programs", value_name = "BYTES")]
    pub output_limit_bytes: Option<usize>,
    /// Treat nonempty stderr as a runtime error in legacy comparison mode.
    #[arg(long, help_heading = "Comparison")]
    pub strict_stderr: bool,
    /// Accept presentation errors in legacy comparison mode
    #[arg(long, help_heading = "Comparison")]
    pub regard_pe_as_ac: bool,
    /// Maximum output-to-answer size ratio in legacy mode
    #[arg(long, help_heading = "Comparison", value_name = "RATIO")]
    pub output_ratio_limit: Option<f64>,
    /// Reuse an earlier task with identical arguments when this key is repeated.
    #[arg(long, help_heading = "Task", value_name = "KEY")]
    pub client_request_id: Option<String>,
}
mod actions;
pub use actions::*;
