#!/usr/bin/env python3
"""Validate and materialize the packaged CP workbook template asset."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
import zipfile
from io import BytesIO
from pathlib import Path
from typing import Sequence
from xml.etree import ElementTree as ET


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
PACKAGED_TEMPLATE = (
    SCRIPT_DIR.parent / "assets" / "REF_CP_MODEL_SNAPSHOT_TEMPLATE.xlsx"
)
CANONICAL_TEMPLATE = (
    ROOT
    / "Co-Pilot Agents"
    / "KNOWLEDGE SOURCES"
    / "06_WORKBOOK_TEMPLATES"
    / "REF_CP_MODEL_SNAPSHOT_TEMPLATE.xlsx"
)
TEMPLATE = PACKAGED_TEMPLATE if PACKAGED_TEMPLATE.is_file() else CANONICAL_TEMPLATE
EXPECTED_TEMPLATE_SHA256 = (
    "a0f5e3877ee284f674d78d3f303a22e2dd155a036aad35f8cf0fc8131777568f"
)
EXPECTED_SHEETS = (
    ("Model", "visible"),
    ("Credit Snapshot", "visible"),
    ("_RBOT_INPUTS", "hidden"),
    ("_RBOT_MAP", "hidden"),
    ("_RBOT_CHECKS", "hidden"),
)
SHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"


class WorkbookAssetError(ValueError):
    """Raised when the packaged workbook asset is absent or incompatible."""


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def validate_template(path: Path = TEMPLATE) -> bytes:
    if not path.is_file():
        raise WorkbookAssetError(f"workbook asset is missing: {path}")
    data = path.read_bytes()
    digest = sha256_bytes(data)
    if digest != EXPECTED_TEMPLATE_SHA256:
        raise WorkbookAssetError(f"workbook asset signature mismatch: {digest}")
    try:
        with zipfile.ZipFile(BytesIO(data)) as archive:
            names = archive.namelist()
            if len(names) != len(set(names)):
                raise WorkbookAssetError("workbook asset has duplicate ZIP members")
            prohibited = [
                name
                for name in names
                if name.endswith("vbaProject.bin")
                or "externalLinks/" in name
                or name.endswith("connections.xml")
            ]
            if prohibited:
                raise WorkbookAssetError(
                    f"workbook asset has prohibited members: {prohibited}"
                )
            workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    except (
        OSError,
        KeyError,
        zipfile.BadZipFile,
        ET.ParseError,
    ) as exc:
        raise WorkbookAssetError(f"workbook asset is not valid OOXML: {exc}") from exc

    sheets = tuple(
        (sheet.attrib["name"], sheet.attrib.get("state", "visible"))
        for sheet in workbook.findall(f".//{{{SHEET_NS}}}sheet")
    )
    if sheets != EXPECTED_SHEETS:
        raise WorkbookAssetError(f"workbook sheet registry mismatch: {sheets}")
    return data


def materialize(output: Path, template: Path = TEMPLATE) -> dict[str, object]:
    requested_output = Path(output)
    if requested_output.suffix.lower() != ".xlsx":
        raise WorkbookAssetError("output must end in .xlsx")
    if requested_output.is_symlink() or requested_output.exists():
        raise WorkbookAssetError(f"output already exists: {requested_output}")
    if requested_output.resolve() == template.resolve():
        raise WorkbookAssetError("reference workbook overwrite is prohibited")

    data = validate_template(template)
    requested_output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(
        prefix=f".{requested_output.name}.",
        dir=requested_output.parent,
    ) as temporary:
        candidate = Path(temporary) / "candidate.xlsx"
        candidate.write_bytes(data)
        try:
            os.link(candidate, requested_output)
        except FileExistsError as exc:
            raise WorkbookAssetError(
                f"output already exists: {requested_output}"
            ) from exc
    return {
        "output": str(requested_output.resolve()),
        "bytes": len(data),
        "sha256": sha256_bytes(data),
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="new .xlsx working-copy path; existing files are never overwritten",
    )
    args = parser.parse_args(argv)
    try:
        result = materialize(args.output)
    except (OSError, WorkbookAssetError) as exc:
        print(json.dumps({"status": "blocked", "error": str(exc)}, sort_keys=True))
        return 2
    print(json.dumps({"status": "complete", **result}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
