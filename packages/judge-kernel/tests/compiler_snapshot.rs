use anyhow::Context;
use cph_ng_judge::{
    application::tasks::Cancellation,
    domain::GlobalConfig,
    infrastructure::{
        compiler::CompilerRegistry, executor::ProcessExecutor,
        repo::workspace::WorkspaceProblemRepository,
    },
    ports::executor::{ExecutionLimits, ExecutorPort},
};

#[tokio::test]
async fn rust_snapshot_keeps_captured_entry_and_source_relative_dependencies() -> anyhow::Result<()>
{
    let root = tempfile::TempDir::new()?;
    let source = root.path().join("main.rs");
    tokio::fs::write(&source, "compile_error!(\"entry changed after capture\");").await?;
    tokio::fs::write(
        root.path().join("helper.rs"),
        "pub fn value() -> &'static str { include_str!(\"value.txt\") }",
    )
    .await?;
    tokio::fs::write(
        root.path().join("value.txt"),
        "captured entry with live dependencies",
    )
    .await?;
    let repo = WorkspaceProblemRepository::new(root.path().join("store")).await?;
    let workdir = repo.root().join("snapshot");
    let compiler = CompilerRegistry::new(GlobalConfig::default(), repo);
    let cancel = Cancellation::new();
    let command = compiler
        .compile_snapshot(
            &source,
            &workdir,
            256,
            &cancel,
            b"mod helper; fn main(){print!(\"{}\",helper::value());}",
        )
        .await
        .context("compile captured entry")?;
    let result = ProcessExecutor
        .run(
            &command,
            &[],
            &ExecutionLimits {
                time_ms: 5000,
                ..ExecutionLimits::default()
            },
            &cancel,
        )
        .await?;
    assert_eq!(result.exit_code, Some(0));
    assert_eq!(result.stdout, "captured entry with live dependencies");
    Ok(())
}

#[tokio::test]
async fn javascript_snapshots_preserve_commonjs_and_esm_resolution() -> anyhow::Result<()> {
    for (extension, captured) in [
        (
            "cjs",
            "console.log(require('./helper.cjs') + require('local-package'))",
        ),
        (
            "mjs",
            "import helper from './helper.mjs'; import local from 'local-package'; console.log(helper + local)",
        ),
    ] {
        let root = tempfile::TempDir::new()?;
        let source = root.path().join(format!("main.{extension}"));
        tokio::fs::write(&source, "throw new Error('entry changed after capture')").await?;
        tokio::fs::write(root.path().join("helper.cjs"), "module.exports = 20").await?;
        tokio::fs::write(root.path().join("helper.mjs"), "export default 20").await?;
        let dependency = root.path().join("node_modules/local-package");
        tokio::fs::create_dir_all(&dependency).await?;
        tokio::fs::write(dependency.join("index.js"), "module.exports = 22").await?;
        let repo = WorkspaceProblemRepository::new(root.path().join("store")).await?;
        let workdir = repo.root().join("snapshot");
        let compiler = CompilerRegistry::new(GlobalConfig::default(), repo);
        let cancel = Cancellation::new();
        let command = compiler
            .compile_snapshot(&source, &workdir, 256, &cancel, captured.as_bytes())
            .await?;
        let result = ProcessExecutor
            .run(
                &command,
                &[],
                &ExecutionLimits {
                    time_ms: 5000,
                    ..ExecutionLimits::default()
                },
                &cancel,
            )
            .await?;
        assert_eq!(result.exit_code, Some(0), "{result:?}");
        assert_eq!(result.stdout.trim(), "42");
    }
    Ok(())
}
