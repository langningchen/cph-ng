"""Exercise actual terminal detection, ANSI stripping and noninteractive output."""
import errno
import fcntl
import struct
import termios
import json
import os
from pathlib import Path
import pty
import re
import select
import signal
import subprocess
import sys
import time

from terminal_screen import reset_styles, visible_text

binary, store, source, scenario = sys.argv[1:]


def terminal(args, *, env=None, code=0, interrupt=False, width=120):
    environment = os.environ.copy()
    for key in ["NO_COLOR", "CLICOLOR", "CLICOLOR_FORCE", "FORCE_COLOR"]:
        environment.pop(key, None)
    environment.pop("COLUMNS", None)
    environment.pop("CI", None)
    environment.update(TERM="xterm-256color")
    environment.update(env or {})
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 24, width, 0, 0))
    process = subprocess.Popen(
        [binary, "--store-root", store, *args],
        stdin=slave, stdout=slave, stderr=slave, env=environment,
    )
    os.close(slave)
    output = bytearray()
    deadline = time.monotonic() + 15
    try:
        while time.monotonic() < deadline:
            if not select.select([master], [], [], 0.1)[0]:
                continue
            try:
                chunk = os.read(master, 65536)
            except OSError as error:
                if error.errno == errno.EIO:
                    break
                raise
            if not chunk:
                break
            output.extend(chunk)
            if interrupt and b"Running" in output and b"Case 1" in output:
                process.send_signal(signal.SIGINT)
                interrupt = False
        else:
            raise AssertionError(f"CLI waited for interaction: {bytes(output)!r}")
        assert process.wait(timeout=2) == code, bytes(output)
        return bytes(output).decode("utf-8").replace("\r\n", "\n")
    finally:
        process.kill() if process.poll() is None else None
        process.wait()
        os.close(master)


run = ["run", source, "--stdin", "1 2", "--answer", "3"]
if scenario == "human":
    accepted = terminal(run)
    assert "\x1b[1;32m" in accepted, accepted
    for marker in ["Accepted", "1/1 testcases passed", "Case 1", "ms", "Task:"]:
        assert marker in accepted, accepted
    wrong = terminal([*run[:-1], "4"], code=1)
    assert "\x1b[1;31m" in wrong and "Wrong answer" in wrong, wrong
    for env in [{"NO_COLOR": "1"}, {"TERM": "dumb"},
                {"NO_COLOR": "1", "CLICOLOR_FORCE": "1"},
                {"TERM": "dumb", "CLICOLOR_FORCE": "1"}]:
        plain = terminal(run, env=env)
        assert not re.search(r"\x1b\[[0-9;]*m", plain) and "Accepted" in plain, plain
    unregistered = Path(source).with_name("unregistered.py")
    unregistered.write_text("print(1)", encoding="utf-8")
    missing = terminal(["problem", "load", str(unregistered)], code=2)
    assert "\x1b[1;31m" in missing and "problem create SOURCE" in missing, missing
    broken = Path(source).with_name("broken.py")
    broken.write_text("this is not python !!!", encoding="utf-8")
    failure = terminal(["run", str(broken), "--stdin", ""], code=3)
    assert "Diagnostics" in failure and "SyntaxError" in failure, failure
    generator = Path(source).with_name("generator.py")
    generator.write_text("import sys; print(sys.argv[1], 2)", encoding="utf-8")
    brute = Path(source).with_name("brute.py")
    brute.write_text("a,b=map(int,input().split()); print(a-b)", encoding="utf-8")
    stress = terminal(["stress", "start", source, "--generator", str(generator),
                       "--brute-force", str(brute), "--iterations", "1", "--seed", "25"], code=1)
    for marker in ["Counterexample found and saved", "Failing seed: 25", "Saved testcase:",
                   "Input", "25 2", "Answer", "23", "WA", "output", "27"]:
        assert marker in stress, stress
elif scenario == "formats":
    machine = terminal([*run, "--json"])
    assert "\x1b" not in machine, machine
    assert json.loads(machine)["result"]["verdict"] == "accepted", machine
    stream = terminal([*run, "--output", "jsonl"])
    assert "\x1b" not in stream, stream
    rows = [json.loads(line) for line in stream.splitlines()]
    assert rows[-1]["type"] == "result", stream
    assert rows[-1]["result"]["result"]["verdict"] == "accepted", stream
    assert any(row["type"] == "event" for row in rows), stream
    for args in [run, [*run, "--json"], [*run, "--output", "jsonl"]]:
        piped = subprocess.run([binary, "--store-root", store, *args],
                               stdin=subprocess.DEVNULL, capture_output=True, timeout=15)
        assert piped.returncode == 0, piped.stderr
        assert b"\x1b" not in piped.stdout + piped.stderr, piped
elif scenario == "compact":
    accepted = terminal([*run, "--quiet"], env={"NO_COLOR": "1"})
    assert accepted.startswith("Accepted  1/1 testcases passed\n"), accepted
    assert "Output: 3" in accepted, accepted
    assert len(accepted.splitlines()) == 4, accepted
    assert all(line.strip() for line in accepted.splitlines()), accepted
    piped = subprocess.run([binary, "--store-root", store, *run, "--quiet"],
                           stdin=subprocess.DEVNULL, capture_output=True, timeout=15)
    plain = piped.stdout.decode("utf-8")
    assert piped.returncode == 0 and not piped.stderr, piped
    assert plain.startswith("Accepted  1/1 testcases passed\n"), plain
    assert len(plain.splitlines()) == 4 and "\x1b" not in plain, plain
    listing = terminal(["problem", "list"], env={"NO_COLOR": "1"},
                       width=max(120, len(str(Path(source).resolve())) + 80))
    assert listing.startswith("Problems (1)\n"), listing
    assert len(listing.splitlines()) == 3 and str(Path(source).resolve()) in listing, listing
    history = terminal(["history", "list", source], env={"NO_COLOR": "1"})
    assert history.startswith("Run history (2)\n"), history
    assert len(history.splitlines()) == 4 and history.count("Accepted") == 2, history
    empty = terminal(["task", "list"], env={"NO_COLOR": "1"})
    assert empty == "Tasks: no entries.\n", empty
    terminal(["testcase", "add", source, "--stdin", "first\n\nthird\n", "--answer", ""],
             env={"NO_COLOR": "1"})
    cases = terminal(["testcase", "list", source], env={"NO_COLOR": "1"})
    assert r"first\n\nthird\n" in cases, cases
    assert "Answer" in cases and "(empty)" in cases, cases
    assert "\n\n" not in cases, cases
elif scenario == "regressions":
    normal = terminal(run)
    reset_styles(normal)
    assert visible_text(normal).count("Accepted") == 1 and visible_text(normal).count("Case 1") == 1, normal
    assert all(symbol not in normal for symbol in "✓✗›•·…—"), normal
    assert "\r" in normal and "\x1b[34m" in normal, normal
    visible = visible_text(normal)
    assert visible.startswith("Accepted  1/1 testcases passed\n"), visible
    assert len(visible.splitlines()) == 4 and "Running" not in visible, visible
    wrong = terminal([*run[:-1], "4"], code=1)
    reset_styles(wrong)
    assert visible_text(wrong).count("Wrong answer") == 1 and visible_text(wrong).count("Case 1") == 1, wrong
    for args in [run, [*run[:-1], "4"]]:
        piped = subprocess.run([binary, "--store-root", store, *args],
            capture_output=True, timeout=15, env={**os.environ, "CLICOLOR_FORCE": "1"})
        assert piped.returncode == (0 if args == run else 1), piped
        assert not piped.stderr and b"\x1b" not in piped.stdout, piped
    for input_text, answer in [("1 2", "3"), ("2 3", "5")]:
        terminal(["testcase", "add", source, "--stdin", input_text, "--answer", answer])
    multiple = terminal(["judge", "run", source])
    reset_styles(multiple)
    multiple = visible_text(multiple)
    assert multiple.count("Accepted") == 1, multiple
    assert multiple.count("Case 1") == 1 and multiple.count("Case 2") == 1, multiple
    assert "Output:" not in multiple and "2/2 testcases passed" in multiple, multiple
    terminal(["testcase", "add", source, "--stdin", "10 20", "--answer", "0"])
    mixed = terminal(["judge", "run", source], code=1)
    reset_styles(mixed)
    mixed = visible_text(mixed)
    assert "2/3 testcases passed" in mixed and "Case 3" in mixed, mixed
    assert mixed.count("Token 1:") == 1 and 'output "30", answer "0"' in mixed, mixed
    slow = Path(source).with_name("slow.py")
    slow.write_text("import time; time.sleep(60)", encoding="utf-8")
    canceled = terminal(["run", str(slow), "--stdin", "", "--time-limit-ms", "60000"],
                        code=130, interrupt=True)
    reset_styles(canceled)
    assert "Running" not in visible_text(canceled), canceled
    assert "\x1b[1;33m" in canceled or "\x1b[1;31m" in canceled, canceled
    broken = Path(source).with_name("broken.py")
    broken.write_text("this is not python !!!", encoding="utf-8")
    failure = terminal(["run", str(broken), "--stdin", ""], code=3)
    reset_styles(failure)
    assert "CE" in visible_text(failure) and "SyntaxError" in visible_text(failure), failure
    for args in [["problem", "list"], ["testcase", "list", source],
                 ["history", "list", source], ["capabilities"]]:
        reset_styles(terminal(args))
    name = "中文 é \x1b[31mred"
    terminal(["problem", "update", source, "--name", name])
    listing = terminal(["problem", "list"])
    reset_styles(listing)
    assert r"\u{1b}[31mred" in listing and "中文 é" in listing, listing
    unsafe = Path(source).with_name("unsafe.py")
    unsafe.write_text("print('\\x1b[31munsafe')", encoding="utf-8")
    output = terminal(["run", str(unsafe), "--stdin", ""], code=1)
    reset_styles(output)
    assert r"\u{1b}[31munsafe" in output or r"\u{1b}" in output, output
    for suffix, program, extra, color, verdict, code in [
        ("tle", "while True: pass", ["--time-limit-ms", "100"], "1;33", "TLE", 1),
        ("re", "raise ValueError('bad')", [], "1;35", "RE", 1),
        ("pe", "print('a  b')", ["--answer", "a b", "--checker-mode", "legacy"], "1;36", "PE", 1),
        ("ce", "invalid syntax !!!", [], "1;91", "CE", 3),
    ]:
        path = Path(source).with_name("verdict_" + suffix + ".py")
        path.write_text(program, encoding="utf-8")
        result = terminal(["run", str(path), "--stdin", "", *extra], code=code)
        reset_styles(result)
        assert f"\x1b[{color}m{verdict}\x1b[0m" in result, result
    narrow = terminal(run, width=40)
    reset_styles(narrow)
    assert "Accepted" in visible_text(narrow), narrow
    unregistered = Path(source).with_name("missing.py")
    unregistered.write_text("print(1)", encoding="utf-8")
    error = terminal(["problem", "load", str(unregistered)], code=2)
    reset_styles(error)
    assert "Error:" in error, error
    piped_error = subprocess.run([binary, "--store-root", store, "problem", "load", str(unregistered)],
        capture_output=True, timeout=15, env={**os.environ, "CLICOLOR_FORCE": "1"})
    assert piped_error.returncode == 2 and not piped_error.stdout, piped_error
    assert b"\x1b" not in piped_error.stderr, piped_error
elif scenario == "live":
    from terminal_live import verify
    verify(terminal, source)
elif scenario == "maintenance":
    from terminal_maintenance import verify
    verify(terminal, source)
elif scenario == "responsive":
    from terminal_responsive import verify
    verify(terminal, binary, store, source, run)
else:
    raise AssertionError(f"unknown test scenario: {scenario}")
