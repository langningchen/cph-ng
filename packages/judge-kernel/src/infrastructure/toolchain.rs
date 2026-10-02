//! Bounded discovery in the kernel's execution environment. Detection never changes config.
use super::executor::ProcessExecutor;
use crate::{
    application::tasks::{Cancellation, TaskFailure},
    domain::LanguageId,
    ports::{
        executor::{CommandSpec, ExecutionLimits, ExecutorPort, ExitReason},
        toolchain::{ToolchainDiscovery, ToolchainItem, ToolchainKind, ToolchainQuery},
    },
};
use std::{
    collections::HashSet,
    path::{Path, PathBuf},
};

mod version;

#[derive(Debug)]
pub struct LocalToolchains;
const LANGUAGES: [LanguageId; 6] = [
    LanguageId::C,
    LanguageId::Cpp,
    LanguageId::Rust,
    LanguageId::Python,
    LanguageId::Javascript,
    LanguageId::Java,
];
const MAX_CANDIDATES: usize = 64;
fn names(language: LanguageId, kind: ToolchainKind) -> &'static [&'static str] {
    match (language, kind) {
        (LanguageId::C, ToolchainKind::Compiler) => &["gcc", "clang", "cc"],
        (LanguageId::Cpp, ToolchainKind::Compiler) => &["g++", "clang++", "c++"],
        (LanguageId::Rust, ToolchainKind::Compiler) => &["rustc"],
        (LanguageId::Python, _) => &["python3", "python", "pypy3", "pypy"],
        (LanguageId::Javascript, _) => &["node", "nodejs"],
        (LanguageId::Java, ToolchainKind::Compiler) => &["javac"],
        (LanguageId::Java, ToolchainKind::Interpreter) => &["java"],
        _ => &[],
    }
}
fn directories() -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    std::env::var_os("PATH").map_or_else(Vec::new, |value| {
        std::env::split_paths(&value)
            .filter(|path| path.is_absolute())
            .take(64)
            // Deduplicate directory aliases while preserving PATH precedence and argv[0].
            .filter(|path| {
                seen.insert(std::fs::canonicalize(path).unwrap_or_else(|_| path.clone()))
            })
            .collect()
    })
}
pub(super) async fn resolve(path: &Path) -> Option<PathBuf> {
    let choices = if path.components().count() > 1 || path.is_absolute() {
        vec![path.to_path_buf()]
    } else {
        directories()
            .iter()
            .flat_map(|directory| {
                let candidate = directory.join(path);
                if cfg!(windows) && candidate.extension().is_none() {
                    vec![candidate.with_extension("exe"), candidate]
                } else {
                    vec![candidate]
                }
            })
            .collect()
    };
    for path in choices {
        if tokio::fs::metadata(&path)
            .await
            .is_ok_and(|metadata| metadata.is_file())
        {
            // Keep symlink names: rustup and similar multicall tools dispatch on argv[0].
            return Some(path);
        }
    }
    None
}
async fn candidates(language: Option<LanguageId>) -> Vec<(LanguageId, ToolchainKind, PathBuf)> {
    let mut result = Vec::new();
    let mut seen = HashSet::new();
    for language in LANGUAGES
        .into_iter()
        .filter(|item| language.is_none_or(|v| v == *item))
    {
        for kind in [ToolchainKind::Compiler, ToolchainKind::Interpreter] {
            for name in names(language, kind) {
                if let Some(path) = resolve(Path::new(name)).await {
                    let key = format!("{language}:{kind:?}:{}", path.display());
                    if seen.insert(key) {
                        result.push((language, kind, path));
                    }
                }
            }
        }
    }
    for directory in directories() {
        let Ok(mut entries) = tokio::fs::read_dir(directory).await else {
            continue;
        };
        for _ in 0..1024 {
            if result.len() >= MAX_CANDIDATES {
                return result;
            }
            let Ok(Some(entry)) = entries.next_entry().await else {
                break;
            };
            let filename = entry.file_name().to_string_lossy().into_owned();
            let filename = filename.strip_suffix(".exe").unwrap_or(&filename);
            for lang in LANGUAGES
                .into_iter()
                .filter(|item| language.is_none_or(|v| v == *item))
            {
                for kind in [ToolchainKind::Compiler, ToolchainKind::Interpreter] {
                    if names(lang, kind).iter().any(|name| {
                        filename == *name
                            || filename.strip_prefix(name).is_some_and(|suffix| {
                                !suffix.is_empty()
                                    && suffix
                                        .chars()
                                        .all(|ch| ch.is_ascii_digit() || ch == '.' || ch == '-')
                            })
                    }) {
                        let path = entry.path();
                        let key = format!("{lang}:{kind:?}:{}", path.display());
                        if seen.insert(key) {
                            result.push((lang, kind, path));
                        }
                    }
                }
            }
        }
    }
    result.truncate(MAX_CANDIDATES);
    result
}
fn identifies(language: LanguageId, kind: ToolchainKind, output: &str) -> bool {
    let lower = output.to_lowercase();
    match language {
        LanguageId::C | LanguageId::Cpp => ["gcc", "g++", "clang", "free software foundation"]
            .iter()
            .any(|name| lower.contains(name)),
        LanguageId::Rust => lower.starts_with("rustc "),
        LanguageId::Python => lower.contains("python") || lower.contains("pypy"),
        LanguageId::Javascript => {
            output.trim().starts_with('v')
                && output
                    .trim()
                    .chars()
                    .nth(1)
                    .is_some_and(|ch| ch.is_ascii_digit())
        }
        LanguageId::Java if kind == ToolchainKind::Compiler => lower.starts_with("javac "),
        LanguageId::Java => lower.contains("java") || lower.contains("openjdk"),
    }
}
async fn inspect(
    language: LanguageId,
    kind: ToolchainKind,
    path: PathBuf,
) -> Option<ToolchainItem> {
    if names(language, kind).is_empty() {
        return None;
    }
    let limits = ExecutionLimits {
        time_ms: 1500,
        memory_mb: 512,
        output_bytes: 16 * 1024,
        file_bytes: 1024 * 1024,
        processes: 16,
    };
    let command = CommandSpec {
        program: path.clone(),
        args: vec![if language == LanguageId::Java {
            "-version".into()
        } else {
            "--version".into()
        }],
        cwd: std::env::temp_dir(),
    };
    let result = ProcessExecutor
        .run(&command, &[], &limits, &Cancellation::new())
        .await
        .ok()?;
    if result.reason != ExitReason::Exited || result.exit_code != Some(0) {
        return None;
    }
    let output = format!("{}\n{}", result.stdout, result.stderr);
    if !identifies(language, kind, output.trim()) {
        return None;
    }
    let description = output
        .lines()
        .find(|line| !line.trim().is_empty())?
        .trim()
        .to_owned();
    let version = version::parse(&description);
    let lower = output.to_lowercase();
    let group = if lower.contains("clang") {
        "Clang"
    } else if matches!(language, LanguageId::C | LanguageId::Cpp) {
        "GCC"
    } else {
        match language {
            LanguageId::Rust => "Rust",
            LanguageId::Python => "Python",
            LanguageId::Java => "Java",
            _ => "Node.js",
        }
    };
    Some(ToolchainItem {
        language,
        kind,
        name: path.file_name()?.to_string_lossy().into_owned(),
        path,
        version,
        description,
        group: group.into(),
    })
}
#[async_trait::async_trait]
impl ToolchainDiscovery for LocalToolchains {
    async fn detect(
        &self,
        language: Option<LanguageId>,
    ) -> Result<Vec<ToolchainItem>, TaskFailure> {
        let mut pending = candidates(language).await.into_iter();
        let mut running = tokio::task::JoinSet::new();
        let mut result = Vec::new();
        loop {
            while running.len() < 4 {
                let Some((language, kind, path)) = pending.next() else {
                    break;
                };
                running.spawn(inspect(language, kind, path));
            }
            match running.join_next().await {
                Some(Ok(Some(item))) => result.push(item),
                Some(_) => {}
                None => break,
            }
        }
        result.sort_by_cached_key(|item| {
            format!("{}:{:?}:{}", item.language, item.kind, item.path.display())
        });
        Ok(result)
    }
    async fn check(&self, query: ToolchainQuery) -> Result<Option<ToolchainItem>, TaskFailure> {
        let language = query
            .language
            .ok_or_else(|| TaskFailure::invalid("language is required"))?;
        let kind = query
            .kind
            .ok_or_else(|| TaskFailure::invalid("kind is required"))?;
        let path = query
            .path
            .ok_or_else(|| TaskFailure::invalid("path is required"))?;
        let Some(path) = resolve(&path).await else {
            return Ok(None);
        };
        Ok(inspect(language, kind, path).await)
    }
}
