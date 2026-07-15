"""Shared fail-closed resource and active-content gate for OOXML workbooks."""

from __future__ import annotations

import io
import re
import zipfile
from pathlib import PurePosixPath
from xml.etree import ElementTree


MAX_PACKAGE_MEMBERS = 5_000
MAX_PACKAGE_UNCOMPRESSED_BYTES = 128 * 1024 * 1024
MAX_PACKAGE_MEMBER_BYTES = 64 * 1024 * 1024
MAX_COMPRESSION_RATIO = 100
MAX_WORKSHEETS = 64
MAX_DECLARED_ROWS_PER_SHEET = 50_000
MAX_DECLARED_COLUMNS_PER_SHEET = 256
MAX_DECLARED_DIMENSION_CELLS = 2_000_000
MAX_XML_CELL_RECORDS = 1_000_000

PACKAGE_LIMIT_CODES = {
    "package_member_limit",
    "package_member_size_limit",
    "package_size_limit",
    "compression_ratio_limit",
    "worksheet_count_limit",
    "worksheet_dimension_limit",
    "workbook_dimension_limit",
    "cell_limit",
}

_DIMENSION_RE = re.compile(rb"<dimension\b[^>]*\bref=[\"']([^\"']+)[\"']", re.I)
_END_CELL_RE = re.compile(rb"\$?([A-Z]{1,3})\$?([0-9]+)$", re.I)
_CELL_TAG_RE = re.compile(rb"<(?:[A-Za-z0-9_]+:)?c(?:\s|/|>)")


class XlsxPackageError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _column_number(letters: bytes) -> int:
    value = 0
    for char in letters.upper():
        value = value * 26 + char - ord("A") + 1
    return value


def _declared_dimension(xml: bytes) -> tuple[int, int] | None:
    match = _DIMENSION_RE.search(xml)
    if match is None:
        return None
    end = match.group(1).split(b":")[-1]
    cell = _END_CELL_RE.fullmatch(end)
    if cell is None:
        raise XlsxPackageError(
            "invalid_worksheet_dimension",
            "Workbook contains a malformed worksheet dimension.",
        )
    return int(cell.group(2)), _column_number(cell.group(1))


def validate_xlsx_package(content: bytes) -> None:
    """Reject unsafe, active, or resource-unbounded XLSX packages pre-parse."""
    if not content.startswith(b"PK\x03\x04"):
        raise XlsxPackageError(
            "invalid_ooxml", "Uploaded file is not an OOXML .xlsx workbook."
        )
    try:
        package = zipfile.ZipFile(io.BytesIO(content))
    except (zipfile.BadZipFile, OSError) as exc:
        raise XlsxPackageError(
            "invalid_ooxml", "Uploaded file is not a valid OOXML package."
        ) from exc

    with package:
        members = package.infolist()
        if len(members) > MAX_PACKAGE_MEMBERS:
            raise XlsxPackageError(
                "package_member_limit", "Workbook package contains too many members."
            )
        names = [member.filename for member in members]
        if len(set(names)) != len(names):
            raise XlsxPackageError(
                "duplicate_package_member",
                "Workbook package contains duplicate members.",
            )
        if "[Content_Types].xml" not in names or "xl/workbook.xml" not in names:
            raise XlsxPackageError(
                "invalid_ooxml", "Workbook package is missing required OOXML parts."
            )

        total_uncompressed = 0
        worksheet_members = []
        for member in members:
            path = PurePosixPath(member.filename)
            if path.is_absolute() or ".." in path.parts or "\\" in member.filename:
                raise XlsxPackageError(
                    "unsafe_package_path",
                    "Workbook package contains an unsafe member path.",
                )
            if member.flag_bits & 0x1:
                raise XlsxPackageError(
                    "encrypted_package", "Encrypted workbook packages are not supported."
                )
            if member.file_size > MAX_PACKAGE_MEMBER_BYTES:
                raise XlsxPackageError(
                    "package_member_size_limit", "Workbook package member is too large."
                )
            total_uncompressed += member.file_size
            if total_uncompressed > MAX_PACKAGE_UNCOMPRESSED_BYTES:
                raise XlsxPackageError(
                    "package_size_limit",
                    "Workbook expands beyond the safe processing limit.",
                )
            if member.file_size >= 1_000_000:
                ratio = member.file_size / max(1, member.compress_size)
                if ratio > MAX_COMPRESSION_RATIO:
                    raise XlsxPackageError(
                        "compression_ratio_limit",
                        "Workbook compression ratio exceeds the safe limit.",
                    )
            lowered = member.filename.lower()
            if lowered.startswith("xl/worksheets/") and lowered.endswith(".xml"):
                worksheet_members.append(member)
            if (
                "vbaproject" in lowered
                or lowered.startswith("xl/externallinks/")
                or lowered.startswith("xl/embeddings/")
                or lowered.startswith("xl/querytables/")
                or lowered == "xl/connections.xml"
            ):
                raise XlsxPackageError(
                    "active_or_external_content",
                    "Macros, embedded objects, queries, and external links are not supported.",
                )

        if len(worksheet_members) > MAX_WORKSHEETS:
            raise XlsxPackageError(
                "worksheet_count_limit", "Workbook contains too many worksheets."
            )

        content_types = package.read("[Content_Types].xml").lower()
        if b"macroenabled" in content_types or b"vbaproject" in content_types:
            raise XlsxPackageError(
                "active_or_external_content", "Macro-enabled workbooks are not supported."
            )

        for member in members:
            if not member.filename.lower().endswith(".rels"):
                continue
            try:
                relationship_xml = package.read(member)
                lowered_xml = relationship_xml.lower()
                if b"<!doctype" in lowered_xml or b"<!entity" in lowered_xml:
                    raise XlsxPackageError(
                        "invalid_relationships",
                        "Workbook relationships contain a forbidden document type.",
                    )
                root = ElementTree.fromstring(relationship_xml)
            except XlsxPackageError:
                raise
            except (ElementTree.ParseError, RuntimeError, KeyError) as exc:
                raise XlsxPackageError(
                    "invalid_relationships", "Workbook relationships are malformed."
                ) from exc
            for relationship in root.iter():
                if relationship.attrib.get("TargetMode", "").lower() == "external":
                    raise XlsxPackageError(
                        "external_relationship",
                        "External workbook relationships are not supported.",
                    )

        dimension_cells = 0
        xml_cell_records = 0
        for member in worksheet_members:
            worksheet_xml = package.read(member)
            declared = _declared_dimension(worksheet_xml)
            if declared is not None:
                rows, columns = declared
                if (
                    rows > MAX_DECLARED_ROWS_PER_SHEET
                    or columns > MAX_DECLARED_COLUMNS_PER_SHEET
                ):
                    raise XlsxPackageError(
                        "worksheet_dimension_limit",
                        "Worksheet declared dimensions exceed the safe processing limit.",
                    )
                dimension_cells += rows * columns
                if dimension_cells > MAX_DECLARED_DIMENSION_CELLS:
                    raise XlsxPackageError(
                        "workbook_dimension_limit",
                        "Workbook declared dimensions exceed the safe processing limit.",
                    )
            xml_cell_records += len(_CELL_TAG_RE.findall(worksheet_xml))
            if xml_cell_records > MAX_XML_CELL_RECORDS:
                raise XlsxPackageError(
                    "cell_limit", "Workbook contains too many worksheet cell records."
                )
