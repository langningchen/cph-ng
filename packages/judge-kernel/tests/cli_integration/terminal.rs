use super::Workspace;
use anyhow::Context;

use serde_json::json;
use tokio::process::Command;

#[cfg(unix)]
#[tokio::test]
async fn human_import_with_a_terminal_never_prompts() -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    let source = ws.file("main.py", "print(1)\n")?;
    let input = ws.file(
        "overflow.prob",
        &json!({"name":"Overflow", "url":"", "tests":[], "interactive":false,
        "memoryLimit":65536, "timeLimit":1000, "srcPath":source, "group":"tests", "local":true})
        .to_string(),
    )?;
    let script = r"
import os, pty, subprocess, sys
master, slave = pty.openpty()
try:
    result = subprocess.run([sys.argv[1], '--store-root', sys.argv[2], 'import', sys.argv[3]],
        stdin=slave, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5)
    assert result.returncode == 2, (result.stdout, result.stderr)
    assert b'memory_limit_mb' in result.stderr, result.stderr
    assert b'Proceed' not in result.stderr, result.stderr
finally:
    os.close(master)
    os.close(slave)
";
    let result = Command::new("python3")
        .args(["-c", script, env!("CARGO_BIN_EXE_cph-ng-judge")])
        .arg(&ws.store)
        .arg(&input)
        .output()
        .await
        .context("test fixture or response")?;
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );

    Ok(())
}

async fn terminal_scenario(scenario: &str) -> anyhow::Result<()> {
    let ws = Workspace::new()?;
    let source = ws.file("sum.py", "print(sum(map(int, input().split())))\n")?;
    let result = tokio::time::timeout(
        std::time::Duration::from_secs(90),
        Command::new("python3")
            .arg(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/tests/fixtures/terminal.py"
            ))
            .arg(env!("CARGO_BIN_EXE_cph-ng-judge"))
            .arg(&ws.store)
            .arg(source)
            .arg(scenario)
            .kill_on_drop(true)
            .output(),
    )
    .await
    .context("terminal scenario timed out")??;
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    Ok(())
}

#[tokio::test]
async fn terminal_results_are_readable_and_respect_color_preferences() -> anyhow::Result<()> {
    terminal_scenario("human").await
}

#[tokio::test]
async fn machine_formats_and_pipes_never_gain_terminal_formatting() -> anyhow::Result<()> {
    terminal_scenario("formats").await
}

#[tokio::test]
async fn human_results_and_lists_keep_a_compact_layout() -> anyhow::Result<()> {
    terminal_scenario("compact").await
}

#[tokio::test]
async fn human_judging_does_not_repeat_results_or_leak_styles() -> anyhow::Result<()> {
    terminal_scenario("regressions").await
}

#[tokio::test]
async fn responsive_layouts_and_explicit_output_controls() -> anyhow::Result<()> {
    terminal_scenario("responsive").await
}

#[tokio::test]
async fn maintenance_receipts_fit_narrow_normal_and_wide_terminals() -> anyhow::Result<()> {
    terminal_scenario("maintenance").await
}

#[tokio::test]
async fn judging_summary_stays_above_the_table_through_every_redraw() -> anyhow::Result<()> {
    terminal_scenario("live").await
}
