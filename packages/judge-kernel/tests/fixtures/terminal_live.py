"""Check every redraw, not only the final screen, at real terminal widths."""
import json
import os
from pathlib import Path
import re
from terminal_screen import reset_styles, visible_text
from terminal_responsive import cells


def verify(terminal, source):
    program = Path(source).with_name("live-summary.py")
    program.write_text("import time; time.sleep(0.2); print(3)", encoding="utf-8")
    terminal(["problem", "create", str(program)])
    for _ in range(2):
        terminal(["tc", "add", str(program), "--answer-text", "3"])
    captures = {}
    for width in (32, 40, 80, 140):
        output = terminal(["run", str(program), "--jobs", "1"], width=width)
        reset_styles(output)
        frames = [visible_text(frame) for frame in re.split(r"\r\x1b\[\d+A\x1b\[J", output) if frame]
        assert len(frames) >= 3, output
        assert frames[0].startswith(("Queued", "Running")), frames
        tables = [frame for frame in frames if "Testcase" in frame]
        assert len(tables) >= 2, frames
        for frame in frames:
            assert all(cells(line) <= width for line in frame.splitlines()), (width, frame)
            assert not re.search(r"^Judge\s", frame, re.M), frame
        for frame in tables:
            lines = frame.splitlines()
            # Long phases such as Waiting for CPU may truncate their suffix at 32 columns.
            assert re.search(r"[0-2]/2", lines[0]), (width, frame)
            assert lines[1].startswith("Testcase"), (width, frame)
        assert frames[-1].startswith("Accepted  2/2 testcases passed\n"), frames[-1]
        captures[f"{width}-live"] = output
    if path := os.environ.get("CPH_LIVE_CAPTURE"):
        Path(path).write_text(json.dumps(captures, ensure_ascii=False, indent=2))
