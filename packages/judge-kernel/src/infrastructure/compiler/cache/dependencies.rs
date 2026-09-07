use super::{fingerprint::file_hash, manifest::Dependency};
use crate::domain::LanguageId;
use std::{
    collections::BTreeSet,
    path::{Path, PathBuf},
};

pub(super) async fn collect(
    language: LanguageId,
    workdir: &Path,
) -> std::io::Result<Vec<Dependency>> {
    if !matches!(language, LanguageId::Cpp | LanguageId::C | LanguageId::Rust) {
        return Ok(Vec::new());
    }
    let depfile = tokio::fs::read_to_string(workdir.join("dependencies.d")).await?;
    let mut entries = Vec::new();
    for path in parse(&depfile) {
        let path = if path.is_absolute() {
            path
        } else {
            workdir.join(path)
        };
        // Keep the spelling used by the compiler: retargeting a symlink must
        // invalidate the cache even if the previous target still exists.
        if tokio::fs::canonicalize(&path).await?.starts_with(workdir) {
            continue;
        }
        entries.push(Dependency {
            hash: file_hash(&path).await?,
            path,
        });
    }
    if entries.len() > 4096 {
        return Err(std::io::Error::other("Too many compilation dependencies"));
    }
    Ok(entries)
}

fn parse(value: &str) -> BTreeSet<PathBuf> {
    let value = value.replace("\\\r\n", "").replace("\\\n", "");
    let rule = value.lines().next().unwrap_or("");
    let rule = rule
        .split_once(": ")
        .map_or("", |(_, dependencies)| dependencies);
    let mut result = BTreeSet::new();
    let mut word = String::new();
    let mut chars = rule.chars().peekable();
    while let Some(character) = chars.next() {
        match character {
            '\\' if chars
                .peek()
                .is_some_and(|next| next.is_whitespace() || matches!(next, '#' | '\\')) =>
            {
                if let Some(next) = chars.next() {
                    word.push(next);
                }
            }
            '$' if chars.peek() == Some(&'$') => {
                chars.next();
                word.push('$');
            }
            value if value.is_whitespace() => {
                if !word.is_empty() {
                    result.insert(PathBuf::from(std::mem::take(&mut word)));
                }
            }
            value => word.push(value),
        }
    }
    if !word.is_empty() {
        result.insert(word.into());
    }
    result
}

#[cfg(test)]
mod tests {
    use super::parse;
    use std::path::PathBuf;
    #[test]
    fn make_dependencies_keep_escaped_paths_and_continuations() {
        let paths =
            parse("target: /tmp/main.cpp \\\n /tmp/a\\ b.h /tmp/price$$.h\n/tmp/a\\ b.h:\n");
        assert_eq!(
            paths,
            ["/tmp/main.cpp", "/tmp/a b.h", "/tmp/price$.h"]
                .into_iter()
                .map(PathBuf::from)
                .collect()
        );
    }
}
