#!/usr/bin/env python3
"""Noninteractive release metadata, archives and SHA-256 manifests (Python 3.11+)."""

import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import stat
import subprocess
import tarfile
import tomllib
import zipfile

PACKAGE = Path(__file__).resolve().parents[1]
REPOSITORY = PACKAGE.parents[1]
MATRIX = json.loads((PACKAGE / "scripts/release-targets.json").read_text(encoding="utf-8"))
TARGETS = {entry["target"]: entry for entry in MATRIX["include"]}


def package_version(manifest=PACKAGE / "Cargo.toml"):
    version = tomllib.loads(manifest.read_text(encoding="utf-8"))["package"]["version"]
    if not re.fullmatch(r"\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?", version):
        raise ValueError("Cargo.toml must contain an explicit semantic package version")
    return version


def metadata(tag=None):
    version = package_version()
    if tag is not None and tag != f"judge-kernel-v{version}":
        raise ValueError(f"Tag {tag!r} must match Cargo.toml: judge-kernel-v{version}")
    return {"version": version, "prerelease": "-" in version.split("+")[0], "matrix": MATRIX}


def archive_name(version, target):
    extension = "zip" if "windows" in target else "tar.gz"
    return f"cph-ng-judge-{version}-{target}.{extension}"


def sha256(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def build_info():
    def run(*args):
        return subprocess.check_output(args, cwd=PACKAGE, text=True).strip()
    dirty = bool(run("git", "status", "--porcelain", "--untracked-files=normal"))
    return {"source_commit": run("git", "rev-parse", "HEAD"), "source_dirty": dirty,
            "rustc": run("rustc", "--version"), "cargo": run("cargo", "--version")}


def package(binary, target, output_dir, build=None):
    binary = Path(binary)
    target_info = TARGETS[target]
    if binary.name != target_info["binary"] or not binary.is_file():
        raise ValueError(f"Expected an existing {target_info['binary']} built for {target}")
    version = package_version()
    base = f"cph-ng-judge-{version}-{target}"
    manifest = {"schema_version": 1, "version": version, "target": target,
                "binary": binary.name, "binary_sha256": sha256(binary),
                "build": build if build is not None else build_info()}
    readme = f"""# CPH-NG judge kernel {version}

Target: `{target}`. Extract the directory and put `{binary.name}` on PATH.

```sh
cph-ng-judge --help
cph-ng-judge run main.cpp --input sample.in --answer-file sample.out
cph-ng-judge config init
cph-ng-judge config set --input config.example.toml
```

All commands run without confirmation prompts or an editor. Input is read from
stdin only for the RPC transport or an explicit `-` data source, such as
`--input -`, `--answer-file -` or `import -`.
Install the compiler/interpreter for the language you want to judge separately.
See [the CLI guide](docs/cli.md) and [the release guide](docs/releasing.md).
`build-info.json` records the source commit, toolchain, target and binary hash.
"""
    example = (PACKAGE / "assets/default_config.toml").read_text(encoding="utf-8")
    if "windows" in target:
        example = example.replace('interpreter = "python3"', 'interpreter = "python"')
    entries = {
        binary.name: (binary.read_bytes(), 0o755),
        "README.md": (readme.encode(), 0o644),
        "LICENSE": ((REPOSITORY / "LICENSE").read_bytes(), 0o644),
        "config.example.toml": (example.encode(), 0o644),
        "scripts/release-targets.json": ((PACKAGE / "scripts/release-targets.json").read_bytes(), 0o644),
        "build-info.json": ((json.dumps(manifest, indent=2) + "\n").encode(), 0o644),
    }
    for name in ["cli.md", "rpc-protocol.md", "releasing.md", "quality.md"]:
        entries[f"docs/{name}"] = ((PACKAGE / "docs" / name).read_bytes(), 0o644)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    archive = output_dir / archive_name(version, target)
    # Stable archive metadata makes packaging identical bytes repeatable.
    if archive.suffix == ".zip":
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
            for name, (data, mode) in sorted(entries.items()):
                info = zipfile.ZipInfo(f"{base}/{name}", date_time=(1980, 1, 1, 0, 0, 0))
                info.create_system = 3
                info.external_attr = (stat.S_IFREG | mode) << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                output.writestr(info, data)
    else:
        with archive.open("wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", filename="", mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode="w") as output:
                for name, (data, mode) in sorted(entries.items()):
                    info = tarfile.TarInfo(f"{base}/{name}")
                    info.size, info.mode = len(data), mode
                    output.addfile(info, io.BytesIO(data))
    digest = sha256(archive)
    archive.with_name(archive.name + ".sha256").write_text(f"{digest}  {archive.name}\n", encoding="utf-8")
    return archive


def checksums(output_dir, require_all=False):
    output_dir = Path(output_dir)
    expected = {archive_name(package_version(), target) for target in TARGETS}
    archives = sorted(path for path in output_dir.iterdir()
                      if path.name.endswith((".zip", ".tar.gz")))
    found = {path.name for path in archives}
    if not found or not found <= expected or (require_all and found != expected):
        raise ValueError(f"Unexpected or incomplete release assets; missing={sorted(expected - found)}, extra={sorted(found - expected)}")
    lines = []
    for archive in archives:
        line = f"{sha256(archive)}  {archive.name}\n"
        saved = archive.with_name(archive.name + ".sha256").read_text(encoding="utf-8")
        if saved != line:
            raise ValueError(f"SHA-256 mismatch: {archive.name}")
        lines.append(line)
    result = output_dir / "SHA256SUMS"
    result.write_text("".join(lines), encoding="utf-8")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    actions = parser.add_subparsers(dest="action", required=True)
    meta = actions.add_parser("metadata")
    meta.add_argument("--tag", help="Require this tag to match the Cargo package version")
    meta.add_argument("--github-output", type=Path)
    pack = actions.add_parser("package")
    pack.add_argument("--target", choices=sorted(TARGETS), required=True)
    pack.add_argument("--binary", type=Path, required=True)
    pack.add_argument("--output-dir", type=Path, default=PACKAGE / "dist")
    sums = actions.add_parser("checksums")
    sums.add_argument("--output-dir", type=Path, default=PACKAGE / "dist")
    sums.add_argument("--require-all", action="store_true")
    args = parser.parse_args()
    try:
        if args.action == "metadata":
            result = metadata(args.tag)
            if args.github_output:
                with args.github_output.open("a", encoding="utf-8") as output:
                    output.write(f"version={result['version']}\nprerelease={str(result['prerelease']).lower()}\n")
                    output.write(f"matrix={json.dumps(result['matrix'], separators=(',', ':'))}\n")
            print(json.dumps(result))
        elif args.action == "package":
            print(package(args.binary, args.target, args.output_dir))
        else:
            print(checksums(args.output_dir, args.require_all))
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        parser.exit(2, f"error: {error}\n")


if __name__ == "__main__":
    main()
