#[path = "support/json.rs"]
mod response;
use response::JsonExt;

use anyhow::Context;
use cph_ng_judge::application::method::Method;
use std::{path::Path, process::Stdio, time::Duration};

use serde_json::{Value, json};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader, Lines},
    process::{Child, ChildStdin, ChildStdout, Command},
};

struct Client {
    child: Child,
    input: ChildStdin,
    output: Lines<BufReader<ChildStdout>>,
    id: u64,
    events: Vec<Value>,
}
impl Client {
    async fn start(root: &Path, extra: &[&str]) -> anyhow::Result<Self> {
        let mut child = Command::new(env!("CARGO_BIN_EXE_cph-ng-judge"))
            .arg("serve")
            .arg("--store-root")
            .arg(root)
            .args(extra)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .kill_on_drop(true)
            .spawn()
            .context("test fixture or response")?;
        let input = child.stdin.take().context("test fixture or response")?;
        let output =
            BufReader::new(child.stdout.take().context("test fixture or response")?).lines();
        let mut client = Self {
            child,
            input,
            output,
            id: 0,
            events: vec![],
        };
        assert_eq!(
            (client.read().await?).required("/method")?,
            "event.server.ready"
        );
        Ok(client)
    }
    async fn read(&mut self) -> anyhow::Result<Value> {
        let line = tokio::time::timeout(Duration::from_secs(20), self.output.next_line())
            .await
            .context("test fixture or response")?
            .context("test fixture or response")?
            .context("server ended unexpectedly")?;
        serde_json::from_str(&line).with_context(|| format!("stdout is not JSON: {line}"))
    }
    async fn send(&mut self, value: Value) -> anyhow::Result<u64> {
        self.id += 1;
        let id = self.id;
        let mut value = value;
        value
            .as_object_mut()
            .context("RPC request must be an object")?
            .insert("jsonrpc".into(), json!("2.0"));
        value
            .as_object_mut()
            .context("RPC request must be an object")?
            .insert("id".into(), json!(id));
        self.input
            .write_all(format!("{value}\n").as_bytes())
            .await
            .context("test fixture or response")?;
        Ok(id)
    }
    async fn response(&mut self, id: u64) -> anyhow::Result<Value> {
        loop {
            let value = self.read().await?;
            if value.get("id") == Some(&json!(id)) {
                return Ok::<_, anyhow::Error>(value);
            }
            self.events.push(value);
        }
    }
    async fn call(&mut self, method: Method, params: Value) -> anyhow::Result<Value> {
        let id = self
            .send(json!({"method": method, "params": params}))
            .await?;
        self.response(id).await
    }
    async fn ok(&mut self, method: Method, params: Value) -> anyhow::Result<Value> {
        let value = self.call(method, params).await?;
        assert!(value.get("error").is_none(), "{method}: {value}");
        Ok(value.required("/result")?.clone())
    }
    async fn finished(&mut self, id: &str) -> anyhow::Result<Value> {
        // Match the CLI harness: compilation phases can legitimately outlast 20 s
        // on loaded native runners. Resource-limit assertions use separate budgets.
        let mut latest = None;
        tokio::time::timeout(Duration::from_secs(120), async {
            loop {
                let task = self.ok(Method::TaskGet, json!({"task_id": id})).await?;
                if matches!(
                    task.required("/state")?.as_str(),
                    Some("succeeded" | "failed" | "canceled")
                ) {
                    return Ok::<_, anyhow::Error>(task);
                }
                latest = Some(task);
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .with_context(|| format!("Task {id} timed out; last state: {latest:?}"))?
    }
    async fn problem(
        &mut self,
        root: &Path,
        name: &str,
        code: &str,
        input: &str,
        answer: &str,
    ) -> anyhow::Result<(String, String)> {
        let source = root.join(name);
        tokio::fs::write(&source, code)
            .await
            .context("test fixture or response")?;
        let problem = self
            .ok(
                Method::ProblemCreate,
                json!({"source_path": source, "name": name}),
            )
            .await?;
        let testcase = self
            .ok(
                Method::TestcaseAdd,
                json!({"problem_id": problem.required("/id")?, "stdin": input, "answer": answer}),
            )
            .await?;
        Ok((problem.text("/id")?.into(), testcase.text("/id")?.into()))
    }
    async fn shutdown(mut self) -> anyhow::Result<()> {
        self.ok(Method::SystemShutdown, json!({})).await?;
        while let Some(line) =
            tokio::time::timeout(Duration::from_secs(10), self.output.next_line())
                .await
                .context("test fixture or response")?
                .context("test fixture or response")?
        {
            self.events
                .push(serde_json::from_str(&line).context("test fixture or response")?);
        }
        assert!(
            self.child
                .wait()
                .await
                .context("test fixture or response")?
                .success()
        );

        Ok(())
    }
}

#[path = "rpc_integration/advanced.rs"]
mod advanced;
#[path = "rpc_integration/exchange.rs"]
mod exchange;
#[path = "rpc_integration/imports.rs"]
mod imports;
#[path = "rpc_integration/judging.rs"]
mod judging;
#[path = "rpc_integration/paths.rs"]
mod paths;
#[path = "rpc_integration/protocol.rs"]
mod protocol;
#[path = "rpc_integration/tasks.rs"]
mod tasks;
#[cfg(unix)]
#[path = "rpc_integration/unix.rs"]
mod unix;
#[cfg(windows)]
#[path = "rpc_integration/windows.rs"]
mod windows;

#[path = "rpc_integration/case_cancellation.rs"]
mod case_cancellation;
