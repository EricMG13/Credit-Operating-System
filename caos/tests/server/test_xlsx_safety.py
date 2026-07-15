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
