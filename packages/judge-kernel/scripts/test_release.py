import hashlib
import json
from pathlib import Path
import stat
import tarfile
import tempfile
import unittest
import zipfile

import release


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="cph-release-test-")
        self.root = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)
        self.build = {"source_commit": "0" * 40, "source_dirty": False, "rustc": "test", "cargo": "test"}

    def package(self, target):
        source = self.root / target / release.TARGETS[target]["binary"]
        source.parent.mkdir(parents=True, exist_ok=True)
        source.write_bytes(b"test executable payload\x00\xff")
        return release.package(source, target, self.root / "dist", self.build)

    def test_tag_version_mismatch_fails_before_build(self):
        version = release.package_version()
        self.assertEqual(release.metadata(f"judge-kernel-v{version}")["version"], version)
        with self.assertRaisesRegex(ValueError, "must match Cargo.toml"):
            release.metadata("judge-kernel-v999.0.0")
        self.assertEqual(len(release.metadata()["matrix"]["include"]), 5)

    def test_unix_archive_retains_payload_modes_and_build_identity(self):
        archive = self.package("x86_64-unknown-linux-gnu")
        with tarfile.open(archive) as tar:
            base = archive.name.removesuffix(".tar.gz")
            binary = tar.getmember(base + "/cph-ng-judge")
            self.assertEqual(binary.mode, 0o755)
            payload = tar.extractfile(binary).read()
            self.assertEqual(payload, b"test executable payload\x00\xff")
            info = json.load(tar.extractfile(base + "/build-info.json"))
            self.assertEqual(info["binary_sha256"], hashlib.sha256(payload).hexdigest())
            self.assertEqual(info["target"], "x86_64-unknown-linux-gnu")
            self.assertEqual(info["build"], self.build)
            for name in ["README.md", "LICENSE", "config.example.toml", "docs/cli.md", "docs/releasing.md", "docs/quality.md"]:
                self.assertTrue(tar.getmember(base + "/" + name).isfile())
            self.assertTrue(all(not member.name.startswith("/") and ".." not in member.name.split("/") for member in tar.getmembers()))
        original = archive.read_bytes()
        self.assertEqual(self.package("x86_64-unknown-linux-gnu").read_bytes(), original)
        sums = release.checksums(archive.parent)
        self.assertIn(release.sha256(archive), sums.read_text())

    def test_windows_archive_has_exe_and_windows_configuration(self):
        archive = self.package("x86_64-pc-windows-msvc")
        with zipfile.ZipFile(archive) as zip_file:
            base = archive.stem
            entry = zip_file.getinfo(base + "/cph-ng-judge.exe")
            self.assertEqual(stat.S_IMODE(entry.external_attr >> 16), 0o755)
            self.assertEqual(zip_file.read(entry), b"test executable payload\x00\xff")
            self.assertIn(b'interpreter = "python"', zip_file.read(base + "/config.example.toml"))
            self.assertNotIn(b'interpreter = "python3"', zip_file.read(base + "/config.example.toml"))

    def test_incomplete_or_tampered_assets_cannot_be_released(self):
        archive = self.package("x86_64-unknown-linux-gnu")
        with self.assertRaisesRegex(ValueError, "incomplete"):
            release.checksums(archive.parent, require_all=True)
        for target in release.TARGETS:
            self.package(target)
        sums = release.checksums(archive.parent, require_all=True)
        self.assertEqual(len(sums.read_text().splitlines()), 5)
        with archive.open("ab") as file:
            file.write(b"changed")
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
            release.checksums(archive.parent, require_all=True)


if __name__ == "__main__":
    unittest.main()
