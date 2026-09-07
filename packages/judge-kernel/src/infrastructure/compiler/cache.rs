mod dependencies;
mod fingerprint;
mod manifest;
use super::{
    CompilerRegistry,
    command::{CompilationPaths, path_argument},
};
use crate::{
    application::{
        error::ErrorCode,
        tasks::{Cancellation, TaskFailure},
    },
    domain::LanguageId,
    ports::language::CompilationMode,
};
use std::sync::atomic::Ordering;
use tokio::sync::Mutex;

static CACHE_LOCK: Mutex<()> = Mutex::const_new(());

impl CompilerRegistry {
    pub(super) async fn prepare_cached(
        &self,
        language: LanguageId,
        paths: &CompilationPaths<'_>,
        source: &[u8],
        cancel: &Cancellation,
    ) -> Result<(), TaskFailure> {
        let _guard = tokio::select! {
            biased;
            () = cancel.cancelled() => return Err(TaskFailure::canceled()),
            guard = CACHE_LOCK.lock() => guard,
        };
        let key = fingerprint::key(self, language, paths, source, cancel).await?;
        let cache = self.repo.root().join("cache/compilation").join(key);
        if self.mode != CompilationMode::Force
            && manifest::Manifest::restore(&self.repo, &cache, paths.workdir).await
        {
            self.hits.fetch_add(1, Ordering::Relaxed);
            return Ok(());
        }
        if self.mode == CompilationMode::Skip {
            return Err(TaskFailure::new(
                ErrorCode::CompilationFailed,
                format!(
                    "No valid compilation cache for {}; run without --skip-compile or use --force-compile",
                    paths.original.display()
                ),
            ));
        }
        let mut command = self.compilation_command(language, paths);
        let depfile = path_argument(&paths.workdir.join("dependencies.d"));
        match language {
            LanguageId::C | LanguageId::Cpp => command.args.extend([
                "-MD".into(),
                "-MF".into(),
                depfile,
                "-MT".into(),
                "cph-cache".into(),
            ]),
            LanguageId::Rust => command.args.push(format!("--emit=link,dep-info={depfile}")),
            _ => {}
        }
        self.builds.fetch_add(1, Ordering::Relaxed);
        self.run_compiler(&command, cancel).await?;
        if cancel.is_canceled() {
            return Err(TaskFailure::canceled());
        }
        if let Ok(dependencies) = dependencies::collect(language, paths.workdir).await {
            // A cache write failure cannot invalidate an otherwise successful compilation.
            let _ = manifest::Manifest::save(&self.repo, &cache, paths.workdir, dependencies).await;
        }
        Ok(())
    }
}
