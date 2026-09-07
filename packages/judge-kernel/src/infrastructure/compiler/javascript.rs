use super::{
    CompilerRegistry,
    command::{CompilationPaths, path_argument},
};
use crate::application::tasks::TaskFailure;

impl CompilerRegistry {
    pub(super) async fn javascript_args(
        &self,
        paths: &CompilationPaths<'_>,
        memory_mb: u64,
    ) -> Result<Vec<String>, TaskFailure> {
        let preload = paths.workdir.join(".cph-runtime/entry.cjs");
        let loader = paths.workdir.join(".cph-runtime/loader.mjs");
        let script = format!(
            "const snapshot = {}; const loader = {};\n{}",
            serde_json::to_string(&path_argument(&paths.snapshot))
                .map_err(TaskFailure::internal)?,
            serde_json::to_string(&path_argument(&loader)).map_err(TaskFailure::internal)?,
            include_str!("javascript/entry.cjs")
        );
        self.repo
            .write_owned(&preload, script.as_bytes())
            .await
            .map_err(TaskFailure::internal)?;
        self.repo
            .write_owned(&loader, include_bytes!("javascript/loader.mjs"))
            .await
            .map_err(TaskFailure::internal)?;
        Ok(vec![
            format!("--max-old-space-size={memory_mb}"),
            "--require".into(),
            path_argument(&preload),
            path_argument(paths.original),
        ])
    }
}

pub(super) async fn snapshot_path(
    original: &std::path::Path,
    snapshot: std::path::PathBuf,
) -> Result<std::path::PathBuf, TaskFailure> {
    if original.extension().and_then(|value| value.to_str()) != Some("js") {
        return Ok(snapshot);
    }
    let mut directory = original.parent();
    while let Some(parent) = directory {
        if parent.file_name().and_then(|value| value.to_str()) == Some("node_modules") {
            break;
        }
        match tokio::fs::read(parent.join("package.json")).await {
            Ok(bytes) => {
                let package: serde_json::Value =
                    serde_json::from_slice(&bytes).map_err(TaskFailure::internal)?;
                return Ok(
                    match package.get("type").and_then(serde_json::Value::as_str) {
                        Some("module") => snapshot.with_extension("mjs"),
                        Some("commonjs") => snapshot.with_extension("cjs"),
                        _ => snapshot,
                    },
                );
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(TaskFailure::internal(error)),
        }
        directory = parent.parent();
    }
    Ok(snapshot)
}
