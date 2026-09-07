use super::{Client, JsonExt};
use anyhow::Context;
use cph_ng_judge::application::{error::ErrorCode, method::Method};

use serde_json::json;
use tempfile::TempDir;

#[tokio::test]
async fn source_paths_cannot_escape_configured_roots() -> anyhow::Result<()> {
    let root = TempDir::new().context("test fixture or response")?;
    let outside = TempDir::new().context("test fixture or response")?;
    let path = outside.path().join("private.py");
    tokio::fs::write(&path, "print(1)")
        .await
        .context("test fixture or response")?;
    let mut client = Client::start(root.path(), &[]).await?;
    assert_eq!(
        (client
            .call(Method::ProblemCreate, json ! ({ "source_path" : path }))
            .await?)
            .required("/error/code")?,
        &json!(ErrorCode::InvalidParams)
    );
    #[cfg(unix)]
    {
        let link = root.path().join("link.py");
        std::os::unix::fs::symlink(&path, &link).context("test fixture or response")?;
        assert_eq!(
            (client
                .call(Method::ProblemCreate, json ! ({ "source_path" : link }))
                .await?)
                .required("/error/code")?,
            &json!(ErrorCode::InvalidParams)
        );
    }
    client.shutdown().await?;

    Ok(())
}

#[tokio::test]
async fn attaching_workspace_roots_validates_the_whole_batch() -> anyhow::Result<()> {
    let store = TempDir::new()?;
    let workspace = TempDir::new()?;
    let source = workspace.path().join("solution.py");
    tokio::fs::write(&source, "print(1)").await?;
    let mut client = Client::start(store.path(), &[]).await?;
    for roots in [json!([workspace.path(), "."]), json!([source])] {
        let error = client
            .call(Method::SystemAttach, json!({"workspace_roots": roots}))
            .await?;
        assert_eq!(
            error.required("/error/code")?,
            &json!(ErrorCode::InvalidParams)
        );
    }
    let blocked = client
        .call(Method::ProblemCreate, json!({"source_path": source}))
        .await?;
    assert_eq!(
        blocked.required("/error/code")?,
        &json!(ErrorCode::InvalidParams)
    );
    client
        .ok(
            Method::SystemAttach,
            json!({"workspace_roots": [workspace.path()]}),
        )
        .await?;
    client
        .ok(Method::ProblemCreate, json!({"source_path": source}))
        .await?;
    client.shutdown().await
}

#[tokio::test]
async fn attached_roots_are_shared_with_legacy_file_imports() -> anyhow::Result<()> {
    use std::io::Write;
    let store = TempDir::new()?;
    let workspace = TempDir::new()?;
    let mut client = Client::start(store.path(), &[]).await?;
    let source = workspace.path().join("legacy.py");
    tokio::fs::write(&source, "print(input())").await?;
    tokio::fs::write(workspace.path().join("input.txt"), "52\n").await?;
    let id = uuid::Uuid::new_v4().to_string();
    let legacy = json!({
        "version":"1.0.0", "name":"Attached BIN", "src":{"path":source},
        "testcases":{id.clone():{"stdin":{"path":"input.txt"},"answer":{"data":"52\n"},"isExpand":true,"isDisabled":false}},
        "testcaseOrder":[id], "stressTest":{"cnt":0,"state":"inactive"}, "timeElapsedMs":0,
        "overrides":{"timeLimitMs":1000,"memoryLimitMb":128},
    });
    let bin = store.path().join("legacy.bin");
    let mut encoder =
        flate2::write::GzEncoder::new(std::fs::File::create(&bin)?, flate2::Compression::default());
    encoder.write_all(legacy.to_string().as_bytes())?;
    encoder.finish()?;
    client
        .ok(
            Method::SystemAttach,
            json!({"workspace_roots": [workspace.path()]}),
        )
        .await?;
    let imported = client
        .ok(Method::ProblemImport, json!({"input": bin}))
        .await?;
    assert_eq!(imported.required("/testcases/0/stdin")?, "52\n");
    client.shutdown().await
}
