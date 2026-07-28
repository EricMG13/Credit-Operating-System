#!/usr/bin/env python3
"""Create a validated CP-SNAP workbook from the packaged binary asset."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import tempfile
import zipfile
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date
from html import escape
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
EXPECTED_OWNERS = {"CP-1A", "CP-1B", "CP-2", "CP-2B"}
EXPECTED_TEMPLATE_SHA256 = (
    "a0f5e3877ee284f674d78d3f303a22e2dd155a036aad35f8cf0fc8131777568f"
)
ISSUER_FILE_TOKEN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
A1_RANGE = re.compile(
    r"^\$?[A-Z]{1,3}\$?[1-9]\d*"
    r"(?::\$?[A-Z]{1,3}\$?[1-9]\d*)?$"
)
SHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
DOC_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"

SAMPLE_PAYLOADS = {
    "CP-1A": {
        "company": "Example Issuer",
        "sector": "Business Services",
        "shareholders": "Sponsor-owned; management minority stake",
        "country": "United Kingdom",
        "transaction_summary": "Illustrative refinancing with no change of control.",
        "business_description": "Provider of recurring outsourced services to diversified customers.",
    },
    "CP-1B": {
        "historical_performance": "Revenue was stable while cash conversion improved year on year.",
    },
    "CP-2": {
        "strengths": "Recurring revenue, diversified customers and positive free cash flow.",
        "weaknesses": "Sponsor ownership, acquisition integration and refinancing exposure.",
    },
    "CP-2B": {
        "catalysts_near_term_events": "Quarterly results and the planned refinancing are the next dated events.",
    },
}


class CpSnapRuntimeError(ValueError):
    """Raised when CP-SNAP would violate a workbook hard gate."""


@dataclass(frozen=True)
class SnapField:
    field_id: str
    source_owner: str
    target_sheet: str
    target_range: str
    required: bool

    @property
    def anchor(self) -> str:
        return self.target_range.split(":", 1)[0].replace("$", "")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return [
        "".join(node.text or "" for node in item.findall(f".//{{{SHEET_NS}}}t"))
        for item in root.findall(f"{{{SHEET_NS}}}si")
    ]


def _column_number(address: str) -> int:
    match = re.match(r"^\$?([A-Z]{1,3})", address)
    if match is None:
        raise CpSnapRuntimeError(f"invalid cell address in _RBOT_MAP: {address!r}")
    number = 0
    for character in match.group(1):
        number = number * 26 + ord(character) - ord("A") + 1
    return number


def _cell_text(cell: ET.Element, strings: Sequence[str]) -> str:
    kind = cell.attrib.get("t")
    if kind == "inlineStr":
        inline = cell.find(f"{{{SHEET_NS}}}is")
        return (
            ""
            if inline is None
            else "".join(
                node.text or ""
                for node in inline.findall(f".//{{{SHEET_NS}}}t")
            )
        )
    value = cell.find(f"{{{SHEET_NS}}}v")
    if value is None or value.text is None:
        return ""
    if kind == "s":
        try:
            return strings[int(value.text)]
        except (IndexError, ValueError) as exc:
            raise CpSnapRuntimeError(
                "_RBOT_MAP contains an invalid shared-string reference"
            ) from exc
    return value.text


def _map_rows(template: Path) -> list[dict[str, str]]:
    with zipfile.ZipFile(template) as archive:
        member = _worksheet_member(archive, "_RBOT_MAP")
        root = ET.fromstring(archive.read(member))
        strings = _shared_strings(archive)
    parsed_rows: list[dict[int, str]] = []
    for row in root.findall(f".//{{{SHEET_NS}}}row"):
        parsed_rows.append(
            {
                _column_number(cell.attrib["r"]): _cell_text(cell, strings)
                for cell in row.findall(f"{{{SHEET_NS}}}c")
                if "r" in cell.attrib
            }
        )
    if not parsed_rows:
        raise CpSnapRuntimeError("_RBOT_MAP is empty")
    header_by_column = {
        column: value
        for column, value in parsed_rows[0].items()
        if value
    }
    if not header_by_column or len(set(header_by_column.values())) != len(
        header_by_column
    ):
        raise CpSnapRuntimeError("_RBOT_MAP has an invalid header row")
    return [
        {
            header: values.get(column, "")
            for column, header in header_by_column.items()
        }
        for values in parsed_rows[1:]
        if any(values.values())
    ]


def load_snap_fields(template: Path) -> tuple[SnapField, ...]:
    """Read the active CP-SNAP write allowlist from the workbook map."""
    fields: list[SnapField] = []
    seen: set[str] = set()
    for row in _map_rows(template):
        if row.get("write_class") != "SNAP_SUPPORTED":
            continue
        field_id = str(row.get("field_id") or "")
        owner = str(row.get("source_owner") or "")
        target_sheet = str(row.get("target_sheet") or "")
        target_range = str(row.get("target_cell") or "")
        if not field_id or field_id in seen:
            raise CpSnapRuntimeError(f"duplicate or empty SNAP_SUPPORTED field_id {field_id!r}")
        seen.add(field_id)
        if owner not in EXPECTED_OWNERS:
            raise CpSnapRuntimeError(f"{field_id}: unexpected source owner {owner!r}")
        if target_sheet != "Credit Snapshot":
            raise CpSnapRuntimeError(f"{field_id}: target must be Credit Snapshot")
        if A1_RANGE.fullmatch(target_range) is None:
            raise CpSnapRuntimeError(
                f"{field_id}: invalid target range {target_range!r}"
            )
        fields.append(
            SnapField(
                field_id=field_id,
                source_owner=owner,
                target_sheet=target_sheet,
                target_range=target_range,
                required=str(row.get("required") or "").upper() == "TRUE",
            )
        )
    if not fields:
        raise CpSnapRuntimeError("_RBOT_MAP has no SNAP_SUPPORTED fields")
    if {field.source_owner for field in fields} != EXPECTED_OWNERS:
        raise CpSnapRuntimeError("SNAP_SUPPORTED owner registry is incomplete")
    return tuple(fields)


def _resolve_values(
    fields: Sequence[SnapField],
    owner_payloads: Mapping[str, Mapping[str, str]],
) -> dict[tuple[str, str], str]:
    actual_owners = set(owner_payloads)
    missing_owners = sorted(EXPECTED_OWNERS - actual_owners)
    unexpected_owners = sorted(actual_owners - EXPECTED_OWNERS)
    if missing_owners or unexpected_owners:
        details: list[str] = []
        if missing_owners:
            details.append(f"missing required owners: {missing_owners}")
        if unexpected_owners:
            details.append(f"unexpected owners: {unexpected_owners}")
        raise CpSnapRuntimeError("; ".join(details))
    for owner in sorted(EXPECTED_OWNERS):
        if not isinstance(owner_payloads[owner], Mapping):
            raise CpSnapRuntimeError(f"{owner}: payload must be a mapping")

    values: dict[tuple[str, str], str] = {}
    for field in fields:
        value = owner_payloads[field.source_owner].get(field.field_id)
        if field.required and (not isinstance(value, str) or not value.strip()):
            raise CpSnapRuntimeError(
                f"{field.field_id}: required value missing from {field.source_owner}"
            )
        if value is None:
            continue
        if not isinstance(value, str):
            raise CpSnapRuntimeError(f"{field.field_id}: qualitative value must be text")
        values[(field.target_sheet, field.anchor)] = value.strip()
    return values


def _load_snap_fields(template: Path) -> tuple[SnapField, ...]:
    return load_snap_fields(template)


def _worksheet_member(archive: zipfile.ZipFile, sheet_name: str) -> str:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {
        relationship.attrib["Id"]: relationship.attrib["Target"]
        for relationship in relationships.findall(f"{{{PKG_REL_NS}}}Relationship")
    }
    for sheet in workbook.findall(f".//{{{SHEET_NS}}}sheet"):
        if sheet.attrib.get("name") != sheet_name:
            continue
        relationship_id = sheet.attrib[f"{{{DOC_REL_NS}}}id"]
        target = targets[relationship_id].lstrip("/")
        return target if target.startswith("xl/") else f"xl/{target}"
    raise CpSnapRuntimeError(f"worksheet is missing: {sheet_name}")


def _cell_pattern(address: str) -> re.Pattern[str]:
    return re.compile(
        rf'<x:c\b(?P<attributes>[^>]*\br="{re.escape(address)}"[^>]*)'
        rf'(?:\s*/>|>(?P<body>.*?)</x:c>)',
        re.DOTALL,
    )


def _write_inline_text(sheet_xml: str, address: str, value: str) -> str:
    pattern = _cell_pattern(address)
    matches = list(pattern.finditer(sheet_xml))
    if len(matches) != 1:
        raise CpSnapRuntimeError(
            f"expected one writable cell node for {address}, found {len(matches)}"
        )
    attributes = re.sub(
        r'\s+t="[^"]*"',
        "",
        matches[0].group("attributes"),
    ).rstrip(" /")
    replacement = (
        f'<x:c{attributes} t="inlineStr"><x:is><x:t xml:space="preserve">'
        f"{escape(value, quote=False)}</x:t></x:is></x:c>"
    )
    return pattern.sub(replacement, sheet_xml, count=1)


def _masked_sheet_xml(sheet_xml: str, addresses: set[str]) -> str:
    masked = sheet_xml
    for address in sorted(addresses):
        pattern = _cell_pattern(address)
        if len(pattern.findall(masked)) != 1:
            raise CpSnapRuntimeError(f"cannot mask unique writable cell {address}")
        masked = pattern.sub(f'<CP_SNAP_WRITABLE address="{address}"/>', masked, count=1)
    return masked


def _write_workbook_copy(
    template: Path,
    output: Path,
    target_member: str,
    target_bytes: bytes,
) -> None:
    with zipfile.ZipFile(template) as source, zipfile.ZipFile(
        output,
        "w",
        allowZip64=True,
    ) as destination:
        for info in source.infolist():
            payload = target_bytes if info.filename == target_member else source.read(info.filename)
            destination.writestr(info, payload)


def _inline_text(sheet_xml: bytes, address: str) -> str | None:
    root = ET.fromstring(sheet_xml)
    for cell in root.findall(f".//{{{SHEET_NS}}}c"):
        if cell.attrib.get("r") != address:
            continue
        inline = cell.find(f"{{{SHEET_NS}}}is")
        if inline is None:
            return None
        return "".join(
            node.text or ""
            for node in inline.findall(f".//{{{SHEET_NS}}}t")
        )
    return None


def _verify_workbook_copy(
    candidate: Path,
    member_names: list[str],
    original_members: Mapping[str, bytes],
    target_member: str,
    original_xml: str,
    xml_codec: str,
    addresses: set[str],
    writes: Mapping[tuple[str, str], str],
) -> None:
    with zipfile.ZipFile(candidate) as exported:
        if exported.namelist() != member_names:
            raise CpSnapRuntimeError("workbook member registry changed after export")
        for member in member_names:
            current = exported.read(member)
            if member != target_member and current != original_members[member]:
                raise CpSnapRuntimeError(f"protected workbook member changed: {member}")
        exported_xml = exported.read(target_member)

    exported_text = exported_xml.decode(xml_codec)
    if _masked_sheet_xml(original_xml, addresses) != _masked_sheet_xml(
        exported_text,
        addresses,
    ):
        raise CpSnapRuntimeError("protected worksheet XML changed after export")
    for (_, address), value in writes.items():
        if _inline_text(exported_xml, address) != value:
            raise CpSnapRuntimeError(
                f"round-trip value mismatch at Credit Snapshot!{address}"
            )


def export_cp_snap(
    template: Path,
    output: Path,
    owner_payloads: Mapping[str, Mapping[str, str]],
    *,
    extra_writes: Sequence[tuple[str, str, str]] = (),
) -> dict[str, object]:
    """Create one CP-SNAP export and publish it only after full verification."""
    template = template.resolve()
    requested_output = Path(output)
    output = requested_output.resolve()
    if template == output:
        raise CpSnapRuntimeError("reference workbook overwrite is prohibited")
    if not template.is_file():
        raise CpSnapRuntimeError(f"reference workbook is missing: {template}")
    if requested_output.is_symlink() or requested_output.exists():
        raise CpSnapRuntimeError(f"output already exists: {requested_output}")
    template_bytes = template.read_bytes()
    template_hash = hashlib.sha256(template_bytes).hexdigest()
    if template_hash != EXPECTED_TEMPLATE_SHA256:
        raise CpSnapRuntimeError(
            f"reference workbook signature mismatch: {template_hash}"
        )

    with tempfile.TemporaryDirectory(prefix="cp-snap-source-") as source_directory:
        snapshot = Path(source_directory) / "template.xlsx"
        snapshot.write_bytes(template_bytes)
        return _export_verified_snapshot(
            snapshot,
            output,
            owner_payloads,
            extra_writes=extra_writes,
            template_hash=template_hash,
        )


def _export_verified_snapshot(
    template: Path,
    output: Path,
    owner_payloads: Mapping[str, Mapping[str, str]],
    *,
    extra_writes: Sequence[tuple[str, str, str]],
    template_hash: str,
) -> dict[str, object]:
    """Populate only from the immutable template bytes that passed hashing."""
    fields = _load_snap_fields(template)
    values = _resolve_values(fields, owner_payloads)
    allowed = {
        (field.target_sheet, field.anchor)
        for field in fields
    }
    writes = dict(values)
    for sheet_name, address, value in extra_writes:
        if (sheet_name, address) not in allowed:
            raise CpSnapRuntimeError(
                f"protected write rejected: {sheet_name}!{address}"
            )
        if not isinstance(value, str):
            raise CpSnapRuntimeError(
                f"{sheet_name}!{address}: qualitative value must be text"
            )
        writes[(sheet_name, address)] = value

    for sheet_name, address in writes:
        if sheet_name != "Credit Snapshot":
            raise CpSnapRuntimeError(f"protected write rejected: {sheet_name}!{address}")

    with zipfile.ZipFile(template) as source:
        target_member = _worksheet_member(source, "Credit Snapshot")
        infos = source.infolist()
        member_names = [info.filename for info in infos]
        if len(set(member_names)) != len(member_names):
            raise CpSnapRuntimeError("reference workbook contains duplicate ZIP members")
        original_members = {
            info.filename: source.read(info)
            for info in infos
        }

    original_bytes = original_members[target_member]
    xml_codec = "utf-8-sig" if original_bytes.startswith(b"\xef\xbb\xbf") else "utf-8"
    original_xml = original_bytes.decode(xml_codec)
    modified_xml = original_xml
    addresses = {address for _, address in writes}
    for (_, address), value in writes.items():
        modified_xml = _write_inline_text(modified_xml, address, value)
    if _masked_sheet_xml(original_xml, addresses) != _masked_sheet_xml(
        modified_xml,
        addresses,
    ):
        raise CpSnapRuntimeError("protected worksheet XML changed before export")

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(
        prefix=f".{output.name}.",
        dir=output.parent,
    ) as temporary:
        candidate = Path(temporary) / "candidate.xlsx"
        _write_workbook_copy(
            template,
            candidate,
            target_member,
            modified_xml.encode(xml_codec),
        )
        _verify_workbook_copy(
            candidate,
            member_names,
            original_members,
            target_member,
            original_xml,
            xml_codec,
            addresses,
            writes,
        )
        result = {
            "output": output,
            "populated_fields": len(values),
            "owners": tuple(sorted(EXPECTED_OWNERS)),
            "template_sha256": template_hash,
            "output_sha256": sha256(candidate),
        }
        try:
            os.link(candidate, output)
        except FileExistsError as exc:
            raise CpSnapRuntimeError(f"output already exists: {output}") from exc
    return result


def _expect_block(callable_, label: str) -> None:
    try:
        callable_()
    except CpSnapRuntimeError:
        return
    raise AssertionError(f"negative runtime case did not block: {label}")


def self_test() -> None:
    """Exercise the positive path and all release-criteria negative paths."""
    reference_hash = sha256(TEMPLATE)
    with tempfile.TemporaryDirectory(prefix="cp-snap-runtime-") as temporary:
        temporary_path = Path(temporary)
        positive = temporary_path / "positive.xlsx"
        result = export_cp_snap(TEMPLATE, positive, SAMPLE_PAYLOADS)
        if result["populated_fields"] != 10 or not positive.is_file():
            raise AssertionError("positive CP-SNAP runtime case did not export ten fields")
        if sha256(TEMPLATE) != reference_hash:
            raise AssertionError("CP-SNAP positive case changed the reference workbook")

        missing_owner = {owner: dict(values) for owner, values in SAMPLE_PAYLOADS.items()}
        missing_owner.pop("CP-2B")
        _expect_block(
            lambda: export_cp_snap(
                TEMPLATE,
                temporary_path / "missing-owner.xlsx",
                missing_owner,
            ),
            "missing owner",
        )
        _expect_block(
            lambda: export_cp_snap(
                TEMPLATE,
                temporary_path / "model-write.xlsx",
                SAMPLE_PAYLOADS,
                extra_writes=(("Model", "D18", "forbidden"),),
            ),
            "Model-sheet write",
        )
        _expect_block(
            lambda: export_cp_snap(
                TEMPLATE,
                temporary_path / "vendor-write.xlsx",
                SAMPLE_PAYLOADS,
                extra_writes=(("Credit Snapshot", "B7", "forbidden"),),
            ),
            "vendor/manual write",
        )
        _expect_block(
            lambda: export_cp_snap(TEMPLATE, TEMPLATE, SAMPLE_PAYLOADS),
            "reference overwrite",
        )
    print("CP-SNAP runtime positive/negative tests passed")


def _load_run_request(path: Path) -> tuple[str, date, Mapping[str, Mapping[str, str]]]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise CpSnapRuntimeError(f"cannot read payload JSON: {exc}") from exc
    if not isinstance(payload, Mapping):
        raise CpSnapRuntimeError("payload root must be an object")
    required = {"issuer_file_token", "export_date", "owner_payloads"}
    missing = sorted(required - set(payload))
    unexpected = sorted(set(payload) - required)
    if missing or unexpected:
        details: list[str] = []
        if missing:
            details.append(f"missing keys: {missing}")
        if unexpected:
            details.append(f"unexpected keys: {unexpected}")
        raise CpSnapRuntimeError("; ".join(details))

    issuer = payload["issuer_file_token"]
    if not isinstance(issuer, str) or not ISSUER_FILE_TOKEN.fullmatch(issuer):
        raise CpSnapRuntimeError(
            "issuer_file_token must match "
            "[A-Za-z0-9][A-Za-z0-9._-]*"
        )
    raw_date = payload["export_date"]
    if not isinstance(raw_date, str):
        raise CpSnapRuntimeError("export_date must be an ISO date string")
    try:
        export_date = date.fromisoformat(raw_date)
    except ValueError as exc:
        raise CpSnapRuntimeError("export_date must use YYYY-MM-DD") from exc
    owner_payloads = payload["owner_payloads"]
    if not isinstance(owner_payloads, Mapping):
        raise CpSnapRuntimeError("owner_payloads must be an object")
    return issuer, export_date, owner_payloads


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--payload",
        type=Path,
        help=(
            "JSON object with issuer_file_token, export_date and owner_payloads"
        ),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path.cwd(),
        help="destination directory; the canonical filename is derived",
    )
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)
    if args.self_test:
        self_test()
        return 0
    if args.payload is None:
        parser.error("--payload is required unless --self-test is used")
    try:
        issuer, export_date, owner_payloads = _load_run_request(args.payload)
        output = (
            args.output_dir
            / f"{issuer}_CP-SNAP_{export_date.strftime('%Y%m%d')}.xlsx"
        )
        result = export_cp_snap(TEMPLATE, output, owner_payloads)
    except (CpSnapRuntimeError, OSError, UnicodeError) as exc:
        print(json.dumps({"status": "blocked", "error": str(exc)}, sort_keys=True))
        return 2
    print(
        json.dumps(
            {
                "status": "complete",
                "output": str(result["output"]),
                "populated_fields": result["populated_fields"],
                "owners": result["owners"],
                "template_sha256": result["template_sha256"],
                "output_sha256": result["output_sha256"],
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
