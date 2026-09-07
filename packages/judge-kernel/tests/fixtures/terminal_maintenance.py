"""Replay missing primary + newly linked source through real narrow/wide terminals."""
import json
import os
from pathlib import Path
from terminal_screen import reset_styles, visible_text
from terminal_responsive import cells


def verify(terminal, source):
    primary = Path(source).with_name("old-main.py")
    primary.write_text("print(3)", encoding="utf-8")
    problem = json.loads(terminal(["problem", "create", str(primary), "--json"]))
    primary.unlink()
    transcripts = {}
    for width in (40, 80, 140):
        for label, args, code in [
            ("link", ["problem", "link", "--problem-id", problem["id"], "-d", source], 0),
            ("problems", ["problem", "list"], 0),
            ("sources", ["problem", "sources", source], 0),
            ("rebuild", ["index", "rebuild", "--quiet"], 1),
            ("link-help", ["problem", "link", "--help"], 0),
            ("move-help", ["problem", "move", "--help"], 0),
            ("rebuild-help", ["index", "rebuild", "--help"], 0),
        ]:
            output = terminal(args, width=width, code=code)
            transcripts[f"{width}-{label}"] = output
            reset_styles(output, composite=label.endswith("help"))
            text = visible_text(output)
            assert all(cells(line) <= width for line in text.splitlines()), (width, label, text)
            if label == "problems":
                assert "Primary source" in text and "Sources" in text, text
                assert "[Missing]" not in text, text
            if label == "sources":
                assert text.count("Problem ID") == 1, text
                assert "[Missing]" in text and "Primary" in text and "Linked" in text, text
            if label == "rebuild":
                assert text.startswith("Index rebuilt with errors"), text
                assert "Task completed" not in text and "schema version" not in text, text
    path = os.environ.get("CPH_MAINTENANCE_CAPTURE")
    if path:
        Path(path).write_text(json.dumps(transcripts, ensure_ascii=False, indent=2))
