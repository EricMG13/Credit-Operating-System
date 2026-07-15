"""Vendored prompt modules are byte-locked by checked SHA-256 manifests."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[3]
MODULES = ("CP-2G", "CP-4D")


def _manifest_files(module_dir: Path) -> set[str]:
    return {
        path.name
        for path in module_dir.iterdir()
        if path.is_file()
        and (
            "ACTIVE_PROMPT" in path.name
            or path.name.startswith("REF_")
            or path.name in {"SCHEMA_REFERENCE.md", "SYSTEM_REFERENCE.md"}
        )
    }


@pytest.mark.parametrize("module", MODULES)
def test_vendored_module_manifest_matches_bytes(module: str) -> None:
    module_dir = REPO_ROOT / "Modular OS" / module
    manifest = json.loads((module_dir / "SHA256SUMS.json").read_text(encoding="utf-8"))

    assert manifest["algorithm"] == "sha256"
    assert set(manifest["files"]) == _manifest_files(module_dir)
    for filename, expected in manifest["files"].items():
        actual = hashlib.sha256((module_dir / filename).read_bytes()).hexdigest()
        assert actual == expected, filename
