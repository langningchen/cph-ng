use super::{JsonExt, Workspace};
use anyhow::Context;

#[tokio::test]
async fn compilation_cache_modes_validate_source_dependencies_and_artifacts() -> anyhow::Result<()>
{
    let ws = Workspace::new()?;
    ws.file("answer value.h", "#define VALUE 1\n")?;
    ws.file(
        "cached.cpp",
        "#include <cstdio>\n#include \"answer value.h\"\nint main(){printf(\"%d\\n\", VALUE);}\n",
    )?;
    let run = ["run", "cached.cpp", "--stdin", "", "--answer", "1"];
    let missing = ws
        .json(&[&run[..], &["--skip-compile"]].concat(), 3)
        .await?;
    assert!(
        missing
            .text("/error/message")?
            .contains("No valid compilation cache")
    );
    let first = ws.ok(&run).await?;
    assert_eq!(first.required("/result/compilation/builds")?, 1);
    let cached = ws.ok(&run).await?;
    assert_eq!(cached.required("/result/compilation/hits")?, 1);
    assert_eq!(cached.required("/result/compilation/builds")?, 0);
    ws.ok(&[&run[..], &["--skip-compile", "--time-limit-ms", "5000"]].concat())
        .await?;
    let forced = ws.ok(&[&run[..], &["--force-compile"]].concat()).await?;
    assert_eq!(forced.required("/result/compilation/builds")?, 1);
    ws.json(
        &[&run[..], &["--skip-compile", "--force-compile"]].concat(),
        2,
    )
    .await?;
    let key = std::fs::read_dir(ws.store.join("cache/compilation"))?
        .next()
        .context("cache entry")??
        .path();
    std::fs::write(
        key.join("files").join(if cfg!(windows) {
            "solution.exe"
        } else {
            "solution"
        }),
        b"broken artifact",
    )?;
    ws.json(&[&run[..], &["--skip-compile"]].concat(), 3)
        .await?;
    assert_eq!(
        ws.ok(&run).await?.required("/result/compilation/builds")?,
        1
    );
    ws.file("answer value.h", "#define VALUE 2\n")?;
    ws.json(&[&run[..], &["--skip-compile"]].concat(), 3)
        .await?;
    let changed = ws
        .ok(&["run", "cached.cpp", "--stdin", "", "--answer", "2"])
        .await?;
    assert_eq!(changed.required("/result/compilation/builds")?, 1);
    ws.ok(&[
        "run",
        "cached.cpp",
        "--stdin",
        "",
        "--answer",
        "2",
        "--skip-compile",
    ])
    .await?;
    ws.file("cached.cpp", "#error broken source\n")?;
    ws.json(&[&run[..], &["--skip-compile"]].concat(), 3)
        .await?;
    ws.json(&run, 3).await?;
    Ok(())
}

#[tokio::test]
async fn compiler_flags_invalidate_cache_without_changing_judge_defaults() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    ws.file("flags.cpp", "#include <cstdio>\n#ifndef VALUE\n#define VALUE 1\n#endif\nint main(){printf(\"%d\",VALUE);}\n")?;
    ws.ok(&["run", "flags.cpp", "--stdin", "", "--answer", "1"])
        .await?;
    std::fs::write(
        ws.store.join("config.toml"),
        "[languages.cpp]\ncompiler='g++'\ncompiler_args=['-DVALUE=2']\n",
    )?;
    let result = ws
        .ok(&["run", "flags.cpp", "--stdin", "", "--answer", "2"])
        .await?;
    assert_eq!(result.required("/result/compilation/builds")?, 1);
    assert_eq!(
        ws.ok(&["run", "flags.cpp", "--stdin", "", "--answer", "2"])
            .await?
            .required("/result/compilation/hits")?,
        1
    );
    Ok(())
}

#[tokio::test]
async fn rust_cache_tracks_included_files() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    let include = ws.file("value.txt", "one")?;
    ws.file(
        "cached.rs",
        &format!(
            "fn main() {{ print!(\"{{}}\", include_str!({})); }}",
            serde_json::to_string(&include)?
        ),
    )?;
    let run = ["run", "cached.rs", "--stdin", "", "--answer", "one"];
    assert_eq!(
        ws.ok(&run).await?.required("/result/compilation/builds")?,
        1
    );
    assert_eq!(
        ws.ok(&[&run[..], &["--skip-compile"]].concat())
            .await?
            .required("/result/compilation/hits")?,
        1
    );
    ws.file("value.txt", "two")?;
    ws.json(&[&run[..], &["--skip-compile"]].concat(), 3)
        .await?;
    ws.ok(&["run", "cached.rs", "--stdin", "", "--answer", "two"])
        .await?;
    Ok(())
}

#[tokio::test]
async fn syntax_checks_are_cached_and_reported_in_human_output() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    ws.file("cached.py", "print(1)\n")?;
    let run = ["run", "cached.py", "--stdin", "", "--answer", "1"];
    ws.ok(&run).await?;
    let cached = ws.raw(&[&run[..], &["--skip-compile"]].concat()).await?;
    assert!(cached.status.success());
    assert!(String::from_utf8_lossy(&cached.stdout).contains("Build: Cached"));
    let forced = ws.ok(&[&run[..], &["--recompile"]].concat()).await?;
    assert_eq!(forced.required("/result/compilation/builds")?, 1);
    ws.file("cached.py", "print(\n")?;
    ws.json(&[&run[..], &["--skip-compile"]].concat(), 3)
        .await?;
    ws.json(&run, 3).await?;
    Ok(())
}
