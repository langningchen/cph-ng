#!/usr/bin/env python3
"""Enforce the Rust file-size budget alongside cargo fmt and strict Clippy."""

from pathlib import Path
import sys
import tomllib

PACKAGE = Path(__file__).resolve().parents[1]


def oversized_files(package=PACKAGE):
    manifest = tomllib.loads((package / "Cargo.toml").read_text(encoding="utf-8"))
    maximum = manifest["package"]["metadata"]["quality"]["max-rust-file-lines"]
    if type(maximum) is not int or maximum <= 0:
        raise ValueError("max-rust-file-lines must be a positive integer")
    paths = list(package.glob("*.rs"))
    for directory in ["src", "tests", "examples", "benches"]:
        paths.extend((package / directory).rglob("*.rs"))
    problems = []
    for path in sorted(paths):
        count = len(path.read_text(encoding="utf-8").splitlines())
        if count > maximum:
            problems.append(f"{path.relative_to(package)}: {count} lines exceeds {maximum}")
    return problems


def main():
    try:
        problems = oversized_files()
    except (OSError, ValueError, KeyError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    if problems:
        print("\n".join(problems), file=sys.stderr)
        return 1
    print("Rust file lengths satisfy the configured budget.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
