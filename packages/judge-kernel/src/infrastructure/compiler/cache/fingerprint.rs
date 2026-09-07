use super::super::{CompilerRegistry, command::CompilationPaths};
use crate::{
    application::tasks::{Cancellation, TaskFailure},
    domain::LanguageId,
    ports::executor::{CommandSpec, ExecutionLimits, ExecutorPort},
};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::path::Path;

pub(super) fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

pub(super) async fn key(
    registry: &CompilerRegistry,
    language: LanguageId,
    paths: &CompilationPaths<'_>,
    source: &[u8],
    cancel: &Cancellation,
) -> Result<String, TaskFailure> {
    let command = registry.compilation_command(language, paths);
    let resolved = crate::infrastructure::toolchain::resolve(&command.program)
        .await
        .unwrap_or_else(|| command.program.clone());
    let metadata = tokio::fs::metadata(&resolved).await.ok();
    let modified = metadata.as_ref().and_then(|data| data.modified().ok());
    let version = crate::infrastructure::executor::ProcessExecutor
        .run(
            &CommandSpec {
                program: resolved.clone(),
                args: vec!["--version".into()],
                cwd: paths.workdir.to_path_buf(),
            },
            &[],
            &ExecutionLimits {
                time_ms: 5000,
                output_bytes: 65536,
                ..ExecutionLimits::default()
            },
            cancel,
        )
        .await?;
    if cancel.is_canceled() {
        return Err(TaskFailure::canceled());
    }
    let environment: Vec<_> = [
        "PATH",
        "CPATH",
        "C_INCLUDE_PATH",
        "CPLUS_INCLUDE_PATH",
        "LIBRARY_PATH",
        "COMPILER_PATH",
        "GCC_EXEC_PREFIX",
        "LD_LIBRARY_PATH",
        "RUSTUP_TOOLCHAIN",
        "RUSTUP_HOME",
        "RUSTFLAGS",
        "JAVA_HOME",
        "CLASSPATH",
        "PYTHONPATH",
        "SOURCE_DATE_EPOCH",
    ]
    .into_iter()
    .map(|key| {
        (
            key,
            std::env::var_os(key).map(|value| value.to_string_lossy().into_owned()),
        )
    })
    .collect();
    let args: Vec<_> = command
        .args
        .iter()
        .map(|arg| arg.replace(paths.workdir.to_string_lossy().as_ref(), "<build>"))
        .collect();
    let signature = json!({"schema":1, "kernel":env!("CARGO_PKG_VERSION"), "os":std::env::consts::OS,
        "arch":std::env::consts::ARCH, "path":paths.original, "source":digest(source), "program":resolved,
        "modified":format!("{modified:?}"), "size":metadata.map(|data| data.len()), "args":args,
        "settings":registry.config.languages.get(&language), "environment":environment,
        "version":[version.stdout, version.stderr]});
    Ok(digest(
        &serde_json::to_vec(&signature).map_err(TaskFailure::internal)?,
    ))
}

pub(super) async fn file_hash(path: &Path) -> std::io::Result<String> {
    use tokio::io::AsyncReadExt;
    let mut file = tokio::fs::File::open(path).await?;
    let mut hash = Sha256::new();
    let mut buffer = vec![0; 65536];
    loop {
        let count = file.read(&mut buffer).await?;
        if count == 0 {
            break;
        }
        if let Some(bytes) = buffer.get(..count) {
            hash.update(bytes);
        }
    }
    Ok(format!("{:x}", hash.finalize()))
}
