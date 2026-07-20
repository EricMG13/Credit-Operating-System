"""Shared XLSX package limits across generic, portfolio, ratings, and market paths."""

from __future__ import annotations

import io
import zipfile

import pytest
from fastapi import HTTPException
from openpyxl import Workbook

import ingest
import portfolio_ingest
import ratings
import xlsx_safety
from market_xlsx import MarketWorkbookError, preview_workbook
from xlsx_safety import XlsxPackageError, validate_xlsx_package


def _holdings_workbook() -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Holdings"
    sheet.append(["Borrower Name", "Ratings", "Holdings"])
    sheet.append(["Safe Co", "B2 / B", 1_000_000])
    output = io.BytesIO()
    workbook.save(output)
    return output.getvalue()


def _rewrite_package(content: bytes, replacements: dict[str, bytes]) -> bytes:
    output = io.BytesIO()
    with (
        zipfile.ZipFile(io.BytesIO(content)) as source,
        zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as target,
    ):
        for member in source.infolist():
            target.writestr(member, replacements.get(member.filename, source.read(member)))
        for name, payload in replacements.items():
            if name not in source.namelist():
                target.writestr(name, payload)
    return output.getvalue()


def _dimension_bomb() -> bytes:
    content = _holdings_workbook()
    with zipfile.ZipFile(io.BytesIO(content)) as package:
        sheet = package.read("xl/worksheets/sheet1.xml")
    sheet = sheet.replace(b'ref="A1:C2"', b'ref="A1:XFD1048576"')
    return _rewrite_package(content, {"xl/worksheets/sheet1.xml": sheet})


def _compression_bomb() -> bytes:
    return _rewrite_package(
        _holdings_workbook(), {"xl/media/oversized.bin": b"0" * 2_000_000}
    )


@pytest.mark.parametrize(
    ("factory", "code"),
    [
        (_dimension_bomb, "worksheet_dimension_limit"),
        (_compression_bomb, "compression_ratio_limit"),
    ],
)
def test_every_workbook_parser_rejects_shared_resource_bombs(factory, code):
    hostile = factory()

    with pytest.raises(XlsxPackageError) as package_error:
        validate_xlsx_package(hostile)
    assert package_error.value.code == code

    with pytest.raises(HTTPException) as ingest_error:
        ingest.sniff_xlsx(hostile)
    assert ingest_error.value.status_code == 413

    with pytest.raises(XlsxPackageError) as portfolio_error:
        portfolio_ingest.parse_holdings_xlsx(hostile)
    assert portfolio_error.value.code == code

    with pytest.raises(XlsxPackageError) as ratings_error:
        ratings.extract_ratings_from_workbook(hostile)
    assert ratings_error.value.code == code

    with pytest.raises(MarketWorkbookError) as market_error:
        preview_workbook(hostile, filename="hostile.xlsx")
    assert market_error.value.code == code


def test_nominal_workbook_still_crosses_every_shared_parser():
    content = _holdings_workbook()
    validate_xlsx_package(content)
    ingest.sniff_xlsx(content)
    assert "Safe Co" in ingest.extract_xlsx_text(content)
    assert portfolio_ingest.parse_holdings_xlsx(content)[0]["borrower_name"] == "Safe Co"
    assert ratings.extract_ratings_from_workbook(content)[0]["moody"] == "B2"


def test_declared_dimension_absent_and_malformed():
    assert xlsx_safety._declared_dimension(b"<worksheet />") is None
    with pytest.raises(XlsxPackageError) as malformed:
        xlsx_safety._declared_dimension(b'<dimension ref="not-a-cell"/>')
    assert malformed.value.code == "invalid_worksheet_dimension"


def test_pk_prefixed_invalid_zip_is_rejected():
    with pytest.raises(XlsxPackageError) as invalid:
        validate_xlsx_package(b"PK\x03\x04not-a-zip")
    assert invalid.value.code == "invalid_ooxml"


@pytest.mark.parametrize(
    ("constant", "value", "code"),
    [
        ("MAX_PACKAGE_MEMBERS", 0, "package_member_limit"),
        ("MAX_PACKAGE_MEMBER_BYTES", 0, "package_member_size_limit"),
        ("MAX_PACKAGE_UNCOMPRESSED_BYTES", 0, "package_size_limit"),
        ("MAX_WORKSHEETS", 0, "worksheet_count_limit"),
        ("MAX_DECLARED_DIMENSION_CELLS", 0, "workbook_dimension_limit"),
        ("MAX_XML_CELL_RECORDS", 0, "cell_limit"),
    ],
)
def test_each_package_resource_limit_fails_closed(monkeypatch, constant, value, code):
    monkeypatch.setattr(xlsx_safety, constant, value)
    with pytest.raises(XlsxPackageError) as limited:
        validate_xlsx_package(_holdings_workbook())
    assert limited.value.code == code


def test_duplicate_and_unsafe_package_members_are_rejected():
    content = _holdings_workbook()
    duplicate = io.BytesIO(content)
    with zipfile.ZipFile(duplicate, "a") as package:
        package.writestr("xl/workbook.xml", b"duplicate")
    with pytest.raises(XlsxPackageError) as duplicate_error:
        validate_xlsx_package(duplicate.getvalue())
    assert duplicate_error.value.code == "duplicate_package_member"

    unsafe = _rewrite_package(content, {"../outside.xml": b"unsafe"})
    with pytest.raises(XlsxPackageError) as unsafe_error:
        validate_xlsx_package(unsafe)
    assert unsafe_error.value.code == "unsafe_package_path"


@pytest.mark.parametrize(
    ("relationship", "code"),
    [
        (b"<!DOCTYPE root><Relationships />", "invalid_relationships"),
        (
            '<?xml version="1.0" encoding="UTF-16"?>'
            '<!DOCTYPE root [<!ENTITY injected "expanded">]>'
            '<Relationships>&injected;</Relationships>'.encode("utf-16"),
            "invalid_relationships",
        ),
        (b"<Relationships>", "invalid_relationships"),
    ],
)
def test_relationship_document_type_and_parse_errors_are_rejected(relationship, code):
    content = _rewrite_package(
        _holdings_workbook(), {"xl/_rels/coverage.rels": relationship},
    )
    with pytest.raises(XlsxPackageError) as invalid:
        validate_xlsx_package(content)
    assert invalid.value.code == code


def test_encrypted_member_metadata_is_rejected(monkeypatch):
    class Member:
        def __init__(self, filename, flag_bits=0):
            self.filename = filename
            self.flag_bits = flag_bits
            self.file_size = 0
            self.compress_size = 0

    class Package:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def infolist(self):
            return [Member("[Content_Types].xml"), Member("xl/workbook.xml", 1)]

    monkeypatch.setattr(xlsx_safety.zipfile, "ZipFile", lambda _content: Package())
    with pytest.raises(XlsxPackageError) as encrypted:
        validate_xlsx_package(b"PK\x03\x04stub")
    assert encrypted.value.code == "encrypted_package"


def test_worksheet_without_declared_dimension_is_counted_by_cell_records():
    content = _holdings_workbook()
    with zipfile.ZipFile(io.BytesIO(content)) as package:
        sheet = package.read("xl/worksheets/sheet1.xml")
    sheet = xlsx_safety._DIMENSION_RE.sub(b"", sheet)
    validate_xlsx_package(_rewrite_package(
        content, {"xl/worksheets/sheet1.xml": sheet},
    ))
