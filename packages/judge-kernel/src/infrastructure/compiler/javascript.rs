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
