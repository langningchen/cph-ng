use super::{Client, JsonExt};
use anyhow::Context;
use cph_ng_judge::application::{error::ErrorCode, method::Method};
use std::path::Path;

use serde_json::{Value, json};
use tempfile::TempDir;

#[tokio::test]
async fn legacy_imports_preserve_data_and_reject_duplicate_ids_and_external_io()
-> anyhow::Result<()> {
    use std::io::Write;
    let root = TempDir::new().context("test fixture or response")?;
    let mut client = Client::start(root.path(), &[]).await?;
    let source = root.path().join("legacy.py");
    tokio::fs::write(&source, "print(input())")
        .await
        .context("test fixture or response")?;
    import_legacy_cph(&mut client, root.path(), &source).await?;
    let id = uuid::Uuid::new_v4().to_string();
    tokio::fs::write(root.path().join("input.txt"), "52\n")
        .await
        .context("test fixture or response")?;
    let mut legacy = json!({
        "version":"1.0.0", "name":"Legacy BIN", "src":{"path":source},
        "testcases":{id.clone():{"stdin":{"path":"input.txt"},"answer":{"data":"52\n"},"isExpand":true,"isDisabled":false}},
        "testcaseOrder":[id], "stressTest":{"cnt":0,"state":"inactive"}, "timeElapsedMs":0,
        "overrides":{"timeLimitMs":1000,"memoryLimitMb":128,"interpreterArgs":"-u"},
    });
    let bin = root.path().join("legacy.bin");
    let write_bin = |data: &Value| -> anyhow::Result<()> {
        let mut encoder = flate2::write::GzEncoder::new(
            std::fs::File::create(&bin).context("test fixture or response")?,
            flate2::Compression::default(),
        );
        encoder
            .write_all(data.to_string().as_bytes())
            .context("test fixture or response")?;
        encoder.finish().context("test fixture or response")?;
        Ok(())
    };
    write_bin(&legacy)?;
    let imported = client
        .ok(Method::ProblemImport, json!({"input":bin}))
        .await?;
    assert_eq!(imported.required("/testcases/0/id")?, id.as_str());
    assert_eq!(imported.required("/testcases/0/stdin")?, "52\n");
    let config = tokio::fs::read_to_string(
        root.path()
            .join("problems")
            .join(imported.text("/id")?)
            .join("config.toml"),
    )
    .await
    .context("test fixture or response")?;
    assert!(config.contains("[languages.python]"));
    assert!(config.contains("\"-u\""));
    client
        .ok(
            Method::ProblemDelete,
            json!({"problem_id":imported.required("/id")?}),
        )
        .await?;
    let outside = TempDir::new().context("test fixture or response")?;
    let external = outside.path().join("secret.txt");
    tokio::fs::write(&external, "outside")
        .await
        .context("test fixture or response")?;
    legacy
        .pointer_mut(&format!("/testcases/{id}/stdin"))
        .and_then(Value::as_object_mut)
        .context("legacy stdin object")?
        .insert("path".into(), json!(external));
    write_bin(&legacy)?;
    assert_eq!(
        (client
            .call(Method::ProblemImport, json ! ({ "input" : bin }))
            .await?)
            .required("/error/code")?,
        &json!(ErrorCode::InvalidParams)
    );
    assert_eq!(client.ok(Method::ProblemList, json!({})).await?, json!([]));
    let duplicate = client
        .call(
            Method::ProblemImport,
            json!({"source_path":source,"problem":{"name":"duplicate", "tests":[
                {"id":id,"input":"a","output":"a"},{"id":id,"input":"b","output":"b"}
            ]}}),
        )
        .await?;
    assert_eq!(
        duplicate.required("/error/code")?,
        &json!(ErrorCode::InvalidParams)
    );
    assert_eq!(client.ok(Method::ProblemList, json!({})).await?, json!([]));
    client.shutdown().await?;

    Ok(())
}

async fn import_legacy_cph(client: &mut Client, root: &Path, source: &Path) -> anyhow::Result<()> {
    let prob = root.join("legacy.prob");
    tokio::fs::write(&prob, json!({
        "name":"Legacy CPH", "url":"https://example.com/problem", "tests":[{"id":1,"input":"41\n","output":"41\n"}],
        "interactive":false,"memoryLimit":128,"timeLimit":500,"srcPath":source,"group":"tests","local":true,
    }).to_string()).await.context("test fixture or response")?;
    let imported = client
        .ok(Method::ProblemImport, json!({"input":prob}))
        .await?;
    assert_eq!(imported.required("/testcases/0/stdin")?, "41\n");
    assert_eq!(imported.required("/time_limit_ms")?, 500);
    let task = client
        .ok(
            Method::JudgeRun,
            json!({"problem_id":imported.required("/id")?}),
        )
        .await?;
    assert_eq!(
        (client.finished(task.text("/task_id")?).await?).required("/result/verdict")?,
        "accepted"
    );
    client
        .ok(
            Method::ProblemDelete,
            json!({"problem_id":imported.required("/id")?}),
        )
        .await?;
    Ok(())
}
