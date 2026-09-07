use super::{Details, ExportArgs, ImportArgs, ProblemRef, RunArgs, TestData};
use clap::{Args, Subcommand};
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Subcommand)]
pub enum JudgeAction {
    /// Compile and judge a source file
    #[command(visible_alias = "r")]
    Run(Box<RunArgs>),
    /// Request cancellation of a task
    Cancel(CancelArgs),
}
#[derive(Debug, Subcommand)]
pub enum ProblemAction {
    /// List problems with source counts and primary source paths
    List,
    /// Show a problem, its limits, and testcases
    #[command(alias = "show")]
    Load(ProblemRef),
    /// Register a source file and create its problem data
    Create {
        source: PathBuf,
        #[arg(long)]
        name: Option<String>,
        /// Create a new source file from literal code; existing files are never replaced.
        #[arg(long)]
        source_code: Option<String>,
        #[arg(long)]
        url: Option<String>,
        #[command(flatten)]
        details: Details,
    },
    /// Update saved problem details
    Update {
        #[command(flatten)]
        reference: ProblemRef,
        #[arg(long)]
        name: Option<String>,
        #[arg(long, conflicts_with = "clear_url")]
        url: Option<String>,
        #[arg(long)]
        clear_url: bool,
        #[command(flatten)]
        details: Details,
    },
    /// Delete stored problem data while retaining the source and run history.
    Delete(ProblemRef),
    /// Move a source while preserving its identity and history
    #[command(
        long_about = "Move a source while preserving its identity and history. If the file was already moved outside this CLI, select its old identity with --problem-id or --code-id and pass --rebind-only. To add another solution instead, use problem link.",
        after_help = "Examples:\n  cph-ng-judge problem move main.cpp --destination src/main.cpp\n  cph-ng-judge problem move --problem-id UUID --destination main.cpp --rebind-only"
    )]
    Move {
        #[command(flatten)]
        reference: ProblemRef,
        /// New path; must already exist when using --rebind-only
        #[arg(long, short = 'd', value_name = "FILE")]
        destination: PathBuf,
        /// Rebind a source file that has already been moved externally.
        #[arg(long)]
        rebind_only: bool,
    },
    /// Import a problem package or Companion data
    Import(ImportArgs),
    /// Export a shareable problem package
    Export(ExportArgs),
    /// Add another source sharing this problem's tests and settings
    #[command(
        long_about = "Add another existing source to a problem. Select the existing problem with SOURCE, --problem-id, or --code-id (exactly one). --destination is the file to add. The primary source falls back to an available binding when unavailable; each source keeps its identity and run history. For a moved file, use problem move --rebind-only instead.",
        after_help = "Examples:\n  cph-ng-judge problem link main.cpp --destination alternative.cpp\n  cph-ng-judge problem link --problem-id UUID --destination main.cpp\n  cph-ng-judge problem sources --problem-id UUID"
    )]
    Link {
        #[command(flatten)]
        reference: ProblemRef,
        /// Existing file to add as another source; may become primary if the original is unavailable
        #[arg(long, short = 'd', value_name = "FILE")]
        destination: PathBuf,
    },
    /// List all source files linked to this problem.
    Sources(ProblemRef),
}
#[derive(Debug, Args)]
pub struct CaseMutation {
    #[command(flatten)]
    pub reference: ProblemRef,
    #[arg(long, short = 't')]
    pub testcase_id: Option<Uuid>,
    #[command(flatten)]
    pub data: TestData,
}
#[derive(Debug, Subcommand)]
pub enum TestcaseAction {
    /// List stored testcase inputs and answers
    List(ProblemRef),
    /// Add a stored testcase
    Add(CaseMutation),
    /// Replace input or answer for a selected testcase
    #[command(mut_arg("testcase_id", |arg| arg.required(true)))]
    Update(CaseMutation),
    /// Delete the selected stored testcase
    Delete {
        #[command(flatten)]
        reference: ProblemRef,
        #[arg(long, short = 't')]
        testcase_id: Uuid,
    },
    /// Set testcase order using the complete ordered ID list
    Reorder {
        #[command(flatten)]
        reference: ProblemRef,
        #[arg(
            long = "testcase-id",
            short = 't',
            required = true,
            value_delimiter = ','
        )]
        testcase_ids: Vec<Uuid>,
    },
    /// Run exactly one stored testcase selected with --testcase-id.
    #[command(visible_alias = "r")]
    Run(Box<RunArgs>),
    /// Run all stored testcases, or the explicitly selected subset.
    RunAll(Box<RunArgs>),
}
#[derive(Debug, Subcommand)]
pub enum StressAction {
    /// Generate cases and compare against a reference solution
    Start {
        #[command(flatten)]
        run: Box<RunArgs>,
        #[arg(long)]
        iterations: Option<u32>,
        #[arg(long, default_value_t = 0)]
        seed: u64,
    },
    /// Request cancellation of a stress test
    Stop(CancelArgs),
}
#[derive(Debug, Args)]
pub struct CancelArgs {
    pub task_id: Uuid,
    /// Wait until process termination and the final state are persisted.
    #[arg(long)]
    pub wait: bool,
}
#[derive(Debug, Subcommand)]
pub enum TaskAction {
    /// List queued and running tasks, including tasks owned by another process.
    List,
    /// Submit and wait for an empty task to check scheduling
    Create,
    /// Show task state and any recorded result
    Get { task_id: Uuid },
    /// Wait for a task; Ctrl-C stops waiting without canceling it
    Wait { task_id: Uuid },
    /// Request cancellation of a task
    Cancel(CancelArgs),
    /// Replay recorded events, optionally following an active task
    #[command(alias = "events-since")]
    Events {
        #[arg(long)]
        task_id: Option<Uuid>,
        #[arg(long, default_value_t = 0)]
        since: u64,
        #[arg(long, default_value_t=1000, value_parser=clap::value_parser!(u32).range(1..=1000))]
        limit: u32,
        /// Keep reading until this task finishes; requires --task-id.
        #[arg(long, requires = "task_id")]
        follow: bool,
    },
}
#[derive(Debug, Subcommand)]
pub enum HistoryAction {
    /// List saved runs, newest first
    List {
        source: Option<PathBuf>,
        #[arg(long, conflicts_with_all = ["source", "code_id"])]
        problem_id: Option<Uuid>,
        #[arg(long, conflicts_with = "source")]
        code_id: Option<Uuid>,
        #[arg(long, default_value_t=50, value_parser=clap::value_parser!(u32).range(1..=100))]
        limit: u32,
        #[arg(long, default_value_t = 0)]
        offset: u32,
    },
    /// Show a saved run, diagnostics, and source snapshot
    #[command(alias = "show")]
    Load { run_id: Uuid },
}
#[derive(Debug, Subcommand)]
pub enum IndexAction {
    /// Resolve a source file to its stored identity
    Resolve { source: PathBuf },
    /// Bind a source file to an existing problem identity
    #[command(alias = "reindex-file")]
    Reindex {
        source: PathBuf,
        #[arg(long)]
        problem_id: Uuid,
    },
    /// Refresh registered source paths; does not scan the current directory
    #[command(
        long_about = "Refresh indexes for already registered source paths. This does not scan the current directory or discover where missing files moved. Missing paths and conflicting identities are reported; any failures cause exit code 1. With SOURCE and --problem-id, rebind or refresh that selected source instead.",
        after_help = "Examples:\n  cph-ng-judge index rebuild\n  cph-ng-judge index reindex main.cpp --problem-id UUID\n\nFor a moved source, see cph-ng-judge problem move --help.\nFor another solution sharing tests, see cph-ng-judge problem link --help."
    )]
    Rebuild {
        #[arg(requires = "problem_id")]
        source: Option<PathBuf>,
        #[arg(long, requires = "source")]
        problem_id: Option<Uuid>,
    },
}
