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
    let first = diagnostic_run(&ws, &run).await?;
    assert_eq!(first.required("/result/compilation/builds")?, 1);
    let cached = diagnostic_run(&ws, &run).await?;
    assert_eq!(
        cached.required("/result/compilation/hits")?,
        1,
        "{cached:#}\n{}",
        cache_diagnostics(&ws)?
    );
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
    ws.file("value.txt", "one")?;
    ws.file(
        "helper.rs",
        "pub fn value() -> &'static str { include_str!(\"value.txt\") }",
    )?;
    ws.file(
        "cached.rs",
        "mod helper; fn main() { print!(\"{}\", helper::value()); }",
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

fn cache_diagnostics(ws: &Workspace) -> anyhow::Result<String> {
    let mut output = String::new();
    let mut directories = vec![ws.store.clone()];
    while let Some(dir) = directories.pop() {
        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            if entry.file_type()?.is_dir() {
                directories.push(entry.path());
            } else if entry.file_name() == "manifest.json" || entry.file_name() == "dependencies.d"
            {
                use std::fmt::Write;
                writeln!(
                    output,
                    "{}: {}",
                    entry.path().display(),
                    std::fs::read_to_string(entry.path())?
                )?;
            }
        }
    }
    Ok(output)
}

async fn diagnostic_run(ws: &Workspace, args: &[&str]) -> anyhow::Result<serde_json::Value> {
    let output = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        ws.command(args)
            .arg("--json")
            .env("CPH_NG_CACHE_DIAGNOSTICS", "1")
            .output(),
    )
    .await??;
    // Rust's test harness only prints this captured output if the test fails.
    eprintln!("{}", String::from_utf8_lossy(&output.stderr));
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stdout)
    );
    Ok(serde_json::from_slice(&output.stdout)?)
}

#[cfg(unix)]
#[tokio::test]
async fn failed_version_probes_never_publish_or_reuse_compilation_caches() -> anyhow::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let ws = Workspace::new()?;
    let compiler = ws.file("compiler", "#!/bin/sh\nif [ \"$1\" = --version ]; then echo unavailable >&2; exit 1; fi\nexec python3 \"$@\"\n")?;
    std::fs::set_permissions(&compiler, std::fs::Permissions::from_mode(0o700))?;
    std::fs::create_dir_all(&ws.store)?;
    std::fs::write(
        ws.store.join("config.toml"),
        format!(
            "[languages.python]\ncompiler={}\n",
            serde_json::to_string(&compiler)?
        ),
    )?;
    ws.file("probe.py", "print(1)\n")?;
    let run = ["run", "probe.py", "--stdin", "", "--answer", "1"];
    for _ in 0..2 {
        assert_eq!(
            ws.ok(&run).await?.required("/result/compilation/builds")?,
            1
        );
    }
    assert!(!ws.store.join("cache/compilation").exists());
    ws.json(&[&run[..], &["--skip-compile"]].concat(), 3)
        .await?;
    ws.file("compiler", "#!/bin/sh\nif [ \"$1\" = --version ]; then echo fixture-python; exit 0; fi\nexec python3 \"$@\"\n")?;
    ws.ok(&run).await?;
    assert_eq!(
        ws.ok(&[&run[..], &["--skip-compile"]].concat())
            .await?
            .required("/result/compilation/hits")?,
        1
    );
    Ok(())
}

#[tokio::test]
async fn newly_shadowing_headers_invalidate_compilation_cache() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    let first = ws.dir.path().join("first");
    let second = ws.dir.path().join("second");
    std::fs::create_dir_all(&first)?;
    std::fs::create_dir_all(&second)?;
    std::fs::create_dir_all(&ws.store)?;
    std::fs::write(second.join("config.h"), "#define VALUE 1\n")?;
    ws.file(
        "main.cpp",
        "#include <cstdio>\n#include <config.h>\nint main(){printf(\"%d\",VALUE);}",
    )?;
    let args = vec![
        format!("-I{}", first.display()),
        format!("-I{}", second.display()),
    ];
    std::fs::write(
        ws.store.join("config.toml"),
        format!(
            "[languages.cpp]\ncompiler='g++'\ncompiler_args={}\n",
            serde_json::to_string(&args)?
        ),
    )?;
    let run = ["run", "main.cpp", "--stdin", "", "--answer", "1"];
    ws.ok(&run).await?;
    ws.ok(&[&run[..], &["--skip-compile"]].concat()).await?;
    std::fs::write(first.join("config.h"), "#define VALUE 2\n")?;
    ws.json(&[&run[..], &["--skip-compile"]].concat(), 3)
        .await?;
    let changed = ws
        .ok(&["run", "main.cpp", "--stdin", "", "--answer", "2"])
        .await?;
    assert_eq!(changed.required("/result/compilation/builds")?, 1);
    assert_eq!(
        ws.ok(&[
            "run",
            "main.cpp",
            "--stdin",
            "",
            "--answer",
            "2",
            "--skip-compile"
        ])
        .await?
        .required("/result/compilation/hits")?,
        1
    );
    Ok(())
}
