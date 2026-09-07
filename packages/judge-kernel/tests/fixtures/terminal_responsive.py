"""Width/mode regressions and optional real-PTY transcripts for visual review."""
import json
import os
from pathlib import Path
import pty
import re
import subprocess
import unicodedata
from terminal_screen import reset_styles, visible_text


def cells(line):
    # Fixtures use CJK and combining accents; emoji clusters are covered in Rust.
    return sum(0 if unicodedata.combining(c) else
               2 if unicodedata.east_asian_width(c) in ("W", "F") else 1 for c in line)


def verify(terminal, binary, store, source, run):
    terminal([*run, "--quiet"])
    name = "中文 é " + "long-problem-name-" * 4
    terminal(["problem", "update", source, "--name", name])
    terminal(["tc", "add", source, "--input-text", "1 2", "--answer-text", "3"])
    terminal(["tc", "add", source, "--input-text", "2 3", "--answer-text", "0"])
    transcripts = {}
    for width in (40, 80, 140):
        for label, args, code in [
            ("accepted", [*run, "--quiet"], 0),
            ("mixed", ["run", source, "--quiet"], 1),
            ("problems", ["problem", "list"], 0),
            ("testcases", ["tc", "list", source], 0),
            ("history", ["history", "list", source], 0),
            ("help", ["--help"], 0),
            ("run-help", ["run", "--help"], 0),
            ("usage-error", ["run", "--unknown"], 2),
        ]:
            output = terminal(args, width=width, code=code)
            transcripts[f"{width}-{label}"] = output
            reset_styles(output, composite=label.endswith("help"))
            text = visible_text(output)
            assert all(cells(line) <= width for line in text.splitlines()), (width, label, text)
        assert "error: error:" not in transcripts[f"{width}-usage-error"]
    for args in ([*run, "--no-color"], [*run, "--color=never"], [*run, "--plain"],
                 ["--no-color", "--help"], ["run", "--color", "never", "--help"]):
        output = terminal(args, env={"CLICOLOR_FORCE": "1"})
        assert not re.search(r"\x1b\[[0-9;]*m", output), output
    full = terminal(["problem", "list", "--plain"], width=40)
    assert name in full and source in full and "\x1b" not in full, full
    forced = terminal([*run, "--color=always"], env={"NO_COLOR": "1"})
    assert "\x1b[1;32m" in forced, forced
    for environment in ({"CI": "1"}, {"TERM": "dumb"}):
        output = terminal(run, env=environment)
        assert "\x1b[J" not in output and "\r" not in output, output
    override = terminal(["problem", "list"], width=140, env={"COLUMNS": "40"})
    assert all(cells(line) <= 40 for line in visible_text(override).splitlines()), override
    for format_args in (["--json"], ["--output", "jsonl"]):
        output = terminal([*run, *format_args, "--color=always"])
        assert "\x1b" not in output, output
        if format_args == ["--json"]:
            assert json.loads(output)["result"]["verdict"] == "accepted"
        else:
            assert json.loads(output.splitlines()[-1])["type"] == "result"
    # stdout pipe + stderr terminal must still suppress all progress.
    master, slave = pty.openpty()
    try:
        result = subprocess.run([binary, "--store-root", store, *run],
                                stdout=subprocess.PIPE, stderr=slave, timeout=15)
        assert result.returncode == 0, result
        os.close(slave)
        slave = None
        try:
            diagnostic = os.read(master, 65536)
        except OSError:
            diagnostic = b""
        assert not diagnostic, diagnostic
    finally:
        if slave is not None:
            os.close(slave)
        os.close(master)
    # A consumer may close immediately (for example `... | head -n 0`).
    reader, writer = os.pipe()
    os.close(reader)
    try:
        result = subprocess.run([binary, "capabilities", "--json"], stdout=writer,
                                stderr=subprocess.PIPE, timeout=15)
        assert result.returncode == 0 and not result.stderr, result
    finally:
        os.close(writer)
    capture = os.environ.get("CPH_UX_CAPTURE")
    if capture:
        Path(capture).write_text(json.dumps(transcripts, ensure_ascii=False, indent=2))
