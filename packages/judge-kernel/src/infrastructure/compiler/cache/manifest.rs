use super::fingerprint::{digest, file_hash};
use crate::infrastructure::repo::workspace::WorkspaceProblemRepository;
use serde::{Deserialize, Serialize};
use std::path::{Component, Path, PathBuf};
use tokio::fs;

#[derive(Debug, Serialize, Deserialize)]
pub(super) struct Dependency {
    pub path: PathBuf,
    pub hash: String,
}
#[derive(Debug, Serialize, Deserialize)]
struct Artifact {
    path: PathBuf,
    hash: String,
    executable: bool,
}
#[derive(Debug, Serialize, Deserialize)]
struct EnvironmentDependency {
    name: String,
    value: Option<String>,
}
#[derive(Debug, Serialize, Deserialize)]
pub(super) struct Manifest {
    dependencies: Vec<Dependency>,
    artifacts: Vec<Artifact>,
    environment: Vec<EnvironmentDependency>,
}

impl Manifest {
    pub async fn restore(repo: &WorkspaceProblemRepository, cache: &Path, workdir: &Path) -> bool {
        Self::try_restore(repo, cache, workdir)
            .await
            .unwrap_or(false)
    }
    async fn try_restore(
        repo: &WorkspaceProblemRepository,
        cache: &Path,
        workdir: &Path,
    ) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        let file = fs::canonicalize(cache.join("manifest.json")).await?;
        if !file.starts_with(repo.root()) || fs::metadata(&file).await?.len() > 4 * 1024 * 1024 {
            return Ok(false);
        }
        let manifest: Self = serde_json::from_slice(&fs::read(file).await?)?;
        if manifest
            .environment
            .iter()
            .any(|entry| std::env::var(&entry.name).ok() != entry.value)
        {
            return Ok(false);
        }
        for dependency in &manifest.dependencies {
            if file_hash(&dependency.path).await? != dependency.hash {
                return Ok(false);
            }
        }
        if manifest.artifacts.is_empty() || manifest.artifacts.len() > 512 {
            return Ok(false);
        }
        let mut total = 0;
        for artifact in &manifest.artifacts {
            if !relative(&artifact.path) {
                return Ok(false);
            }
            let path = fs::canonicalize(cache.join("files").join(&artifact.path)).await?;
            total += fs::metadata(&path).await?.len();
            if total > 128 * 1024 * 1024
                || !path.starts_with(cache)
                || file_hash(&path).await? != artifact.hash
            {
                return Ok(false);
            }
        }
        for artifact in manifest.artifacts {
            let source = cache.join("files").join(&artifact.path);
            let destination = workdir.join(&artifact.path);
            repo.write_owned(&destination, &fs::read(source).await?)
                .await?;
            #[cfg(unix)]
            executable(&destination, artifact.executable).await?;
        }
        Ok(true)
    }

    pub async fn save(
        repo: &WorkspaceProblemRepository,
        cache: &Path,
        workdir: &Path,
        dependencies: Vec<Dependency>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut directories = vec![workdir.to_path_buf()];
        let mut artifacts = Vec::new();
        let mut total = 0;
        while let Some(directory) = directories.pop() {
            let mut entries = fs::read_dir(directory).await?;
            while let Some(entry) = entries.next_entry().await? {
                let kind = entry.file_type().await?;
                if kind.is_symlink() {
                    return Err("Cache cannot contain symlinks".into());
                }
                if kind.is_dir() {
                    directories.push(entry.path());
                    continue;
                }
                if !kind.is_file() {
                    return Err("Cache requires regular files".into());
                }
                let size = entry.metadata().await?.len();
                total += size;
                if total > 128 * 1024 * 1024 || artifacts.len() >= 512 {
                    return Err("Compilation cache size limit exceeded".into());
                }
                let path = entry.path().strip_prefix(workdir)?.to_path_buf();
                if path == Path::new("dependencies.d") {
                    continue;
                }
                let bytes = fs::read(entry.path()).await?;
                repo.write_owned(&cache.join("files").join(&path), &bytes)
                    .await?;
                #[cfg(unix)]
                let is_executable = {
                    use std::os::unix::fs::PermissionsExt;
                    entry.metadata().await?.permissions().mode() & 0o111 != 0
                };
                #[cfg(not(unix))]
                let is_executable = false;
                artifacts.push(Artifact {
                    path,
                    hash: digest(&bytes),
                    executable: is_executable,
                });
            }
        }
        let manifest = Self {
            dependencies,
            artifacts,
            environment: environment_dependencies(workdir).await,
        };
        // Publish last: interrupted/failed builds never become valid cache entries.
        repo.write_owned(
            &cache.join("manifest.json"),
            &serde_json::to_vec(&manifest)?,
        )
        .await?;
        Ok(())
    }
}

async fn environment_dependencies(workdir: &Path) -> Vec<EnvironmentDependency> {
    // rustc records env!/option_env! values alongside file dependencies.
    fs::read_to_string(workdir.join("dependencies.d"))
        .await
        .unwrap_or_default()
        .lines()
        .filter_map(|line| line.strip_prefix("# env-dep:"))
        .map(|line| {
            let (name, value) = line
                .split_once('=')
                .map_or((line, None), |(name, value)| (name, Some(value.to_owned())));
            EnvironmentDependency {
                name: name.to_owned(),
                value,
            }
        })
        .collect()
}

fn relative(path: &Path) -> bool {
    !path.as_os_str().is_empty()
        && path
            .components()
            .all(|part| matches!(part, Component::Normal(_)))
}
#[cfg(unix)]
async fn executable(path: &Path, value: bool) -> std::io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(
        path,
        std::fs::Permissions::from_mode(if value { 0o700 } else { 0o600 }),
    )
    .await
}
