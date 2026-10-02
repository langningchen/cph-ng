#![cfg(unix)]

use anyhow::Context;
use serde_json::Value;
use std::{
    os::unix::fs::{PermissionsExt, symlink},
    path::Path,
};
use tokio::process::Command;

fn executable(path: &Path, body: &str) -> anyhow::Result<()> {
    std::fs::write(path, format!("#!/bin/sh\n{body}\n"))?;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755))?;
    Ok(())
}

#[tokio::test]
async fn discovery_deduplicates_directory_aliases_without_rewriting_invocation_names()
-> anyhow::Result<()> {
    let dir = tempfile::tempdir()?;
    let bin = dir.path().join("bin");
    let alias = dir.path().join("alias");
    let other = dir.path().join("other");
    std::fs::create_dir(&bin)?;
    std::fs::create_dir(&other)?;
    symlink(&bin, &alias)?;
    executable(
        &bin.join("gcc"),
        "printf 'gcc (Ubuntu 15.2.0-16ubuntu1) 15.2.0\\n'",
    )?;
    symlink(bin.join("gcc"), bin.join("cc"))?;
    executable(&other.join("gcc"), "printf 'gcc (GCC) 14.2.0\\n'")?;
    let output = Command::new(env!("CARGO_BIN_EXE_cph-ng-judge"))
        .arg("--store-root")
        .arg(dir.path().join("store"))
        .args(["toolchain", "detect", "--language", "c", "--json"])
        .env("PATH", std::env::join_paths([&alias, &bin, &other])?)
        .output()
        .await?;
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let response: Value = serde_json::from_slice(&output.stdout)?;
    let items = response
        .get("toolchains")
        .and_then(Value::as_array)
        .context("toolchains")?;
    assert_eq!(items.len(), 3);
    for item in items {
        let path = Path::new(item.get("path").and_then(Value::as_str).context("path")?);
        let version = item
            .get("version")
            .and_then(Value::as_str)
            .context("version")?;
        assert_ne!(path.parent(), Some(bin.as_path()));
        if path.parent() == Some(alias.as_path()) {
            assert_eq!(version, "15.2.0");
            assert!(
                item.get("description")
                    .and_then(Value::as_str)
                    .context("description")?
                    .contains("16ubuntu1")
            );
        } else {
            assert_eq!(path, other.join("gcc"));
            assert_eq!(version, "14.2.0");
        }
    }
    assert!(
        items
            .iter()
            .any(|item| item.get("path") == Some(&serde_json::json!(alias.join("cc"))))
    );
    Ok(())
}
