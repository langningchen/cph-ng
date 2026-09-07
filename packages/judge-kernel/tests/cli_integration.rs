#[path = "support/json.rs"]
mod response;
use response::JsonExt;

use anyhow::Context;
use std::{path::PathBuf, process::Stdio, time::Duration};

use serde_json::Value;
use tempfile::TempDir;
use tokio::process::Command;

// Version probing, dependency validation and compilation each have a 30 s budget.
// The harness must allow them to finish before deciding the CLI is stuck.
const COMMAND_TIMEOUT: Duration = Duration::from_secs(120);

struct Workspace {
    dir: TempDir,
    store: PathBuf,
}
impl Workspace {
    fn new() -> anyhow::Result<Self> {
        let dir = TempDir::new().context("test fixture or response")?;
        let store = dir.path().join("store");
        Ok(Self { dir, store })
    }
    fn command(&self, args: &[&str]) -> Command {
        let mut command = Command::new(env!("CARGO_BIN_EXE_cph-ng-judge"));
        command
            .arg("--store-root")
            .arg(&self.store)
            .args(args)
            .current_dir(self.dir.path())
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        command
    }
    fn file(&self, name: &str, content: &str) -> anyhow::Result<PathBuf> {
        let path = self.dir.path().join(name);
        std::fs::write(&path, content).context("test fixture or response")?;
        Ok(path)
    }
    async fn raw(&self, args: &[&str]) -> anyhow::Result<std::process::Output> {
        tokio::time::timeout(COMMAND_TIMEOUT, self.command(args).output())
            .await
            .with_context(|| format!("CLI command timed out: {args:?}"))?
            .context("test fixture or response")
    }
    async fn json(&self, args: &[&str], code: i32) -> anyhow::Result<Value> {
        let mut command = self.command(args);
        command.arg("--json");
        let output = tokio::time::timeout(COMMAND_TIMEOUT, command.output())
            .await
            .with_context(|| format!("CLI command timed out: {args:?}"))?
            .context("test fixture or response")?;
        assert_eq!(
            output.status.code(),
            Some(code),
            "{args:?}\nstdout: {}\nstderr: {}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        serde_json::from_slice(&output.stdout).with_context(|| {
            format!(
                "{args:?} returned invalid JSON: {}",
                String::from_utf8_lossy(&output.stdout)
            )
        })
    }
    async fn ok(&self, args: &[&str]) -> anyhow::Result<Value> {
        self.json(args, 0).await
    }
}
fn id(value: &Value) -> anyhow::Result<&str> {
    value.text("/id")
}
fn task_id(value: &Value) -> anyhow::Result<&str> {
    value.text("/task_id")
}
fn lines(bytes: &[u8]) -> anyhow::Result<Vec<Value>> {
    String::from_utf8_lossy(bytes)
        .lines()
        .map(|line| serde_json::from_str(line).context("invalid JSONL event"))
        .collect()
}

#[test]
fn command_tree_is_valid() {
    use clap::CommandFactory;
    cph_ng_judge::interface::cli::Cli::command().debug_assert();
}

#[path = "cli_integration/advanced.rs"]
mod advanced;
#[path = "cli_integration/cache.rs"]
mod cache;
#[path = "cli_integration/completion.rs"]
mod completion;
#[path = "cli_integration/config.rs"]
mod config;
#[path = "cli_integration/conventions.rs"]
mod conventions;
#[path = "cli_integration/crud.rs"]
mod crud;
#[path = "cli_integration/diff.rs"]
mod diff;
#[path = "cli_integration/exchange.rs"]
mod exchange;
#[path = "cli_integration/imports.rs"]
mod imports;
#[path = "cli_integration/input.rs"]
mod input;
#[path = "cli_integration/judging.rs"]
mod judging;
#[path = "cli_integration/maintenance.rs"]
mod maintenance;
#[path = "cli_integration/observers.rs"]
mod observers;
#[path = "cli_integration/parallel.rs"]
mod parallel;
#[path = "cli_integration/sharing.rs"]
mod sharing;
#[cfg(unix)]
#[path = "cli_integration/terminal.rs"]
mod terminal;
