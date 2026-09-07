use super::{JsonExt, Workspace, id};
use anyhow::Context;
use serde_json::{Value, json};

#[tokio::test]
async fn native_package_restores_shared_sources_standards_and_separate_history()
-> anyhow::Result<()> {
    let ws = Workspace::new()?;
    ws.file("first.py", "print(input())\n")?;
    ws.file("second.py", "print(int(input())+1)\n")?;
    ws.file("checker.py", "import sys\nsys.exit(0)\n")?;
    let original = ws
        .ok(&[
            "problem",
            "create",
            "first.py",
            "--name",
            "Shared",
            "--time-limit-ms",
            "2300",
            "--checker",
            "checker.py",
        ])
        .await?;
    ws.ok(&[
        "testcase", "add", "first.py", "--stdin", "7\n", "--answer", "7\n",
    ])
    .await?;
    let linked = ws
        .ok(&["problem", "link", "first.py", "--destination", "second.py"])
        .await?;
    assert_ne!(linked.required("/code_id")?, original.required("/code_id")?);
    ws.file("rules.toml", "[judge]\nchecker_mode = 'exact'\n")?;
    ws.ok(&["config", "first.py", "set", "--input", "rules.toml"])
        .await?;
    let a = ws.ok(&["run", "first.py"]).await?;
    let b = ws.ok(&["run", "second.py"]).await?;
    let ah = ws.ok(&["history", "list", "first.py"]).await?;
    let bh = ws.ok(&["history", "list", "second.py"]).await?;
    assert_eq!(ah.required("/0/task_id")?, a.required("/task_id")?);
    assert_eq!(bh.required("/0/task_id")?, b.required("/task_id")?);
    assert_eq!(ah.as_array().context("history")?.len(), 1);
    assert_eq!(bh.as_array().context("history")?.len(), 1);
    ws.ok(&["export", "first.py", "--destination", "shared.cph"])
        .await?;
    let archive: Value = serde_json::from_slice(&std::fs::read(ws.dir.path().join("shared.cph"))?)?;
    assert_eq!(archive.required("/format")?, "cph-ng");
    assert_eq!(
        archive.required("/config_toml")?,
        "[judge]\nchecker_mode = 'exact'\n"
    );
    let restored = ws
        .ok(&["import", "shared.cph", "--destination", "restored"])
        .await?;
    assert_ne!(id(&restored)?, id(&original)?);
    assert_eq!(restored.required("/history_imported")?, 2);
    assert_eq!(restored.required("/time_limit_ms")?, 2300);
    check_restored_sources(&ws, &restored).await?;
    ws.ok(&["run", restored.text("/source_path")?]).await?;
    ws.ok(&[
        "export",
        restored.text("/source_path")?,
        "--destination",
        "again.cph",
    ])
    .await?;
    let again: Value = serde_json::from_slice(&std::fs::read(ws.dir.path().join("again.cph"))?)?;
    assert_eq!(
        again.required("/origins/0/original_problem_id")?,
        original.required("/id")?
    );
    assert_eq!(
        again.required("/origins/0/imported_problem_id")?,
        restored.required("/id")?
    );
    // Existing destinations are protected, even with explicit loss acceptance.
    ws.json(
        &[
            "export",
            "first.py",
            "--destination",
            "shared.cph",
            "--force",
        ],
        2,
    )
    .await?;
    ws.json(&["import", "shared.cph", "--destination", "restored"], 2)
        .await?;
    Ok(())
}

#[tokio::test]
async fn compatibility_exports_require_force_and_all_have_matching_imports() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    ws.file("source.py", "print(42)\n")?;
    ws.ok(&["problem", "create", "source.py", "--name", "Portable"])
        .await?;
    ws.ok(&[
        "testcase",
        "add",
        "source.py",
        "--stdin",
        "in\n\n",
        "--answer",
        "out\n\n",
    ])
    .await?;
    for (format, ext) in [("companion", "json"), ("prob", "prob"), ("bin", "bin")] {
        let file = format!("problem.{ext}");
        let args = [
            "problem",
            "export",
            "source.py",
            "--destination",
            &file,
            "--export-format",
            format,
        ];
        let preview = ws.ok(&[args.as_slice(), &["--dry-run"]].concat()).await?;
        assert_eq!(preview.required("/requires_force")?, true);
        assert!(!ws.dir.path().join(&file).exists());
        let rejected = ws.json(&args, 2).await?;
        assert!(
            !rejected
                .required("/error/data/losses")?
                .as_array()
                .context("losses")?
                .is_empty()
        );
        assert!(!ws.dir.path().join(&file).exists());
        ws.ok(&[args.as_slice(), &["--force"]].concat()).await?;
        let source = format!("{format}.py");
        ws.file(&source, "print(42)\n")?;
        let imported = ws
            .ok(&[
                "import",
                &file,
                "--source",
                &source,
                "--import-format",
                format,
            ])
            .await?;
        assert_eq!(imported.required("/name")?, "Portable");
        assert_eq!(imported.required("/testcases/0/stdin")?, "in\n\n");
        assert_eq!(imported.required("/testcases/0/answer")?, "out\n\n");
    }
    Ok(())
}

#[tokio::test]
async fn malformed_native_import_leaves_no_partial_problem_or_directory() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    ws.file("source.py", "print(42)")?;
    ws.ok(&["problem", "create", "source.py"]).await?;
    ws.ok(&["export", "source.py", "--destination", "valid.cph"])
        .await?;
    let mut archive: Value =
        serde_json::from_slice(&std::fs::read(ws.dir.path().join("valid.cph"))?)?;
    archive
        .as_object_mut()
        .context("archive")?
        .insert("version".into(), json!(999));
    ws.file("invalid.cph", &archive.to_string())?;
    ws.json(&["import", "invalid.cph", "--destination", "invalid"], 2)
        .await?;
    assert!(!ws.dir.path().join("invalid").exists());
    archive
        .as_object_mut()
        .context("archive")?
        .insert("version".into(), json!(1));
    archive
        .pointer_mut("/sources/0/content")
        .context("content")?
        .clone_from(&json!(null));
    ws.file("invalid.cph", &archive.to_string())?;
    ws.json(&["import", "invalid.cph", "--destination", "invalid"], 2)
        .await?;
    assert_eq!(
        ws.ok(&["problem", "list"])
            .await?
            .as_array()
            .context("problems")?
            .len(),
        1
    );
    assert!(!ws.dir.path().join("invalid").exists());
    Ok(())
}

async fn check_restored_sources(ws: &Workspace, restored: &Value) -> anyhow::Result<()> {
    let sources = restored
        .required("/sources")?
        .as_array()
        .context("sources")?;
    assert_eq!(sources.len(), 2);
    for source in sources {
        let path = source.text("/source_path")?;
        let history = ws.ok(&["history", "list", path]).await?;
        assert_eq!(history.as_array().context("history")?.len(), 1);
        assert_eq!(
            history.required("/0/code_id")?,
            source.required("/code_id")?
        );
        let detail = ws
            .ok(&["history", "load", history.text("/0/task_id")?])
            .await?;
        assert_eq!(detail.text("/source_code")?, std::fs::read_to_string(path)?);

        assert_eq!(
            ws.ok(&["config", path, "show"])
                .await?
                .required("/config/judge/checker_mode")?,
            "exact"
        );
        assert_eq!(
            ws.ok(&["testcase", "list", path])
                .await?
                .required("/0/stdin")?,
            "7\n"
        );
    }
    Ok(())
}

#[tokio::test]
async fn native_import_preserves_filenames_from_other_operating_systems() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    ws.file("Main.java", "public class Main {}\n")?;
    ws.file("checker.py", "import sys; sys.exit(0)\n")?;
    ws.ok(&["problem", "create", "Main.java", "--checker", "checker.py"])
        .await?;
    ws.ok(&["export", "Main.java", "--destination", "portable.cph"])
        .await?;
    let original: Value =
        serde_json::from_slice(&std::fs::read(ws.dir.path().join("portable.cph"))?)?;
    for (i, directory) in [r"C:\work", r"\\?\C:\work", r"\\server\share", "/work"]
        .iter()
        .enumerate()
    {
        let mut archive = original.clone();
        let separator = if directory.starts_with('/') {
            '/'
        } else {
            '\\'
        };
        let source = format!("{directory}{separator}Main.java");
        let checker = format!("{directory}{separator}checker.py");
        for (pointer, path) in [
            ("/problem/src", &source),
            ("/sources/0/path", &source),
            ("/problem/checker", &checker),
            ("/auxiliary/0/path", &checker),
        ] {
            *archive.pointer_mut(pointer).context("packaged file path")? = json!(path);
        }
        let file = format!("portable-{i}.cph");
        ws.file(&file, &archive.to_string())?;
        let restored = ws
            .ok(&["import", &file, "--destination", &format!("restored-{i}")])
            .await?;
        for (field, name, content) in [
            ("/source_path", "Main.java", "public class Main {}\n"),
            ("/checker", "checker.py", "import sys; sys.exit(0)\n"),
        ] {
            let path = std::path::Path::new(restored.text(field)?);
            assert_eq!(path.file_name().context("restored filename")?, name);
            assert_eq!(std::fs::read_to_string(path)?, content);
        }
    }
    Ok(())
}
