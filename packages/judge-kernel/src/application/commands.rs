//! Transport-independent command dispatch over a closed method vocabulary.
use super::{
    error::{CommandError, ErrorCode},
    judge::JudgeService,
    method::Method,
    paths::PathPolicy,
    tasks::{TaskFailure, TaskManager},
};
use crate::ports::{ProblemImporter, ProblemRepository, index::SourceIndex};
use serde_json::{Value, json};
use std::sync::Arc;

mod config;
mod convert;
mod export;
mod import;
mod index;
mod judge;
mod problem;
mod sharing;
mod task;
mod testcase;
pub use convert::index_error;
use convert::{params, repo_error, value};

#[derive(Clone)]
pub struct CommandService {
    pub tasks: TaskManager,
    pub index: Arc<dyn SourceIndex>,
    pub repo: Arc<dyn ProblemRepository>,
    pub judge: JudgeService,
    pub paths: PathPolicy,
    pub config: Arc<super::config::ConfigService>,
    pub toolchains: Arc<dyn crate::ports::toolchain::ToolchainDiscovery>,
    pub importers: Vec<Arc<dyn ProblemImporter>>,
    pub shutdown: super::tasks::Cancellation,
}
impl std::fmt::Debug for CommandService {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CommandService")
            .field("tasks", &self.tasks)
            .field("repo", &self.repo)
            .finish_non_exhaustive()
    }
}
impl CommandService {
    /// Execute a validated application method without depending on a transport.
    ///
    /// # Errors
    /// Returns invalid parameters, missing resources, task admission failures or
    /// repository/compiler errors from the selected command.
    pub async fn execute(&self, method: Method, params: Value) -> Result<Value, TaskFailure> {
        execute(method, params, self).await
    }
}
async fn execute(
    method: Method,
    p: Value,
    context: &CommandService,
) -> Result<Value, CommandError> {
    if !p.is_object() {
        return Err(CommandError::invalid("Methods require named parameters"));
    }
    match method {
        Method::ConfigGet
        | Method::ConfigSet
        | Method::ConfigInit
        | Method::ToolchainDetect
        | Method::ToolchainCheck => config::execute(method, p, context).await,
        Method::TaskList => task::task_list(p, context).await,
        Method::TaskCreate => task::task_create(p, context).await,
        Method::TaskGet => task::task_get(p, context).await,
        Method::TaskCancel | Method::JudgeCancel | Method::StressStop => {
            task::task_cancel(p, context).await
        }
        Method::TaskEventsSince => task::task_events_since(p, context).await,
        Method::HistoryList => task::history_list(p, context).await,
        Method::HistoryLoad => task::history_load(p, context).await,
        Method::ProblemList => problem::problem_list(p, context).await,
        Method::ProblemLoad => problem::problem_load(p, context).await,
        Method::ProblemCreate => problem::problem_create(p, context).await,
        Method::ProblemUpdate => problem::problem_update(p, context).await,
        Method::ProblemDelete => problem::problem_delete(p, context).await,
        Method::ProblemMove => problem::problem_move(p, context).await,
        Method::ProblemExport => export::execute(&p, context).await,
        Method::ProblemLink | Method::ProblemSources => sharing::execute(method, &p, context).await,
        Method::ProblemImport => import::execute(&p, context).await,
        Method::TestcaseList
        | Method::TestcaseAdd
        | Method::TestcaseUpdate
        | Method::TestcaseDelete
        | Method::TestcaseReorder => testcase::execute(method, &p, context).await,
        Method::IndexResolve => index::index_resolve(p, context).await,
        Method::IndexReindexFile => index::index_reindex_file(p, context).await,
        Method::IndexRebuild => index::index_rebuild(method, p, context).await,
        Method::JudgeRun | Method::TestcaseRun | Method::TestcaseRunAll | Method::StressStart => {
            judge::judge_run(method, p, context).await
        }
        Method::SystemAttach
        | Method::SystemHello
        | Method::SystemPing
        | Method::SystemCapabilities
        | Method::SystemShutdown => Err(CommandError::new(
            ErrorCode::MethodNotFound,
            "System methods require an RPC session",
        )),
    }
}
#[must_use]
pub fn capabilities() -> Value {
    let mut transports = vec!["stdio"];
    if cfg!(unix) {
        transports.push("unix");
    }
    if cfg!(windows) {
        transports.push("pipe");
    }
    json!({"transports": transports, "languages": ["cpp", "c", "python", "rust", "javascript", "java"], "checkers": ["tokens", "exact", "float", "legacy", "spj", "interactive"], "event_replay": true, "history": true,
        "resource_limits": {"time": true, "output": true, "process_tree_cancellation": true, "memory": cfg!(any(target_os = "linux", target_os = "macos", windows)), "process_count": cfg!(any(target_os = "linux", target_os = "macos", windows))},
        "exchange_formats":["native","companion","prob","bin"], "shared_sources":true, "methods": Method::ALL})
}
