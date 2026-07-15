"""Phase 2A hostile-input and no-write tests for market workbook preview."""

from __future__ import annotations

import io
import json
import sqlite3
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from openpyxl import Workbook

from config import get_settings
import ingest
from main import app
from market_xlsx import MarketWorkbookError, preview_workbook
from routes import market_import


NOW = datetime(2026, 7, 14, 12, tzinfo=timezone.utc)


def _workbook(
    *,
    sheets: int = 1,
    headers: list[str] | None = None,
    rows: list[list[object]] | None = None,
) -> bytes:
    headers = headers or [
        "FIGI", "Borrower", "Instrument", "Currency", "Price",
        "Discount Margin", "As Of",
    ]
    rows = rows or [["BBG000001", "Acme", "Acme TLB", "USD", 99.5, 425, "2026-07-13"]]
    workbook = Workbook()
    for index in range(sheets):
        worksheet = workbook.active if index == 0 else workbook.create_sheet()
        worksheet.title = f"Market {index + 1}"
        worksheet.append(headers)
        for row in rows:
            worksheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _rewrite_package(content: bytes, replacements: dict[str, bytes] | None = None, extras: dict[str, bytes] | None = None) -> bytes:
    replacements = replacements or {}
    extras = extras or {}
    output = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(content)) as source, zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as target:
        for item in source.infolist():
            target.writestr(item, replacements.get(item.filename, source.read(item.filename)))
        for name, payload in extras.items():
            target.writestr(name, payload)
    return output.getvalue()


def _formula_workbook(*, cached: bool) -> bytes:
    content = _workbook(rows=[["BBG000001", "Acme", "Acme TLB", "USD", "=99+0.5", 425, "2026-07-13"]])
    if not cached:
        return content
    with zipfile.ZipFile(io.BytesIO(content)) as package:
        sheet = package.read("xl/worksheets/sheet1.xml")
    sheet = sheet.replace(b"<f>99+0.5</f><v />", b"<f>99+0.5</f><v>99.5</v>")
    return _rewrite_package(content, {"xl/worksheets/sheet1.xml": sheet})


def _preview(content: bytes, mapping: dict | None = None):
    return preview_workbook(content, filename="market.xlsx", mapping=mapping or {}, now=NOW)


def test_valid_literal_workbook_previews_without_blockers():
    result = _preview(_workbook())
    assert result.blocking_count == 0
    assert result.accepted_count == 1
    assert result.rejected_count == 0
    assert result.as_of == datetime(2026, 7, 13, tzinfo=timezone.utc)
    assert result.rows[0]["instrument_key"] == "BBG000001"
    assert result.rows[0]["discount_margin"] == 425.0


def test_explicit_market_data_mapping_requires_real_as_of_constant():
    content = _workbook(
        headers=["Company", "FIGI", "Ask", "Mid 3Y DM"],
        rows=[["Acme", "BBG000001", 99.5, 425]],
    )
    mapping = {
        "sheet": "Market 1",
        "header_row": 1,
        "columns": {
            "borrower": "Company",
            "instrument": "FIGI",
            "price": "Ask",
        },
        "constants": {"currency": "USD", "as_of": "2026-07-13"},
    }
    result = _preview(content, mapping)
    assert result.blocking_count == 0
    assert result.accepted_count == 1
    assert result.mapping["columns"]["price"] == "Ask"


def test_ambiguous_sheets_block_until_explicit_selection():
    result = _preview(_workbook(sheets=2))
    assert result.blocking_count == 1
    assert result.issues[0].code == "ambiguous_sheet_or_header"
    mapped = _preview(_workbook(sheets=2), {"sheet": "Market 2", "header_row": 1})
    assert mapped.blocking_count == 0


@pytest.mark.parametrize(
    ("row", "code"),
    [
        (["BBG000001", "Acme", "Acme TLB", "USD", 99.5, 425, None], "invalid_as_of"),
        (["BBG000001", "Acme", "Acme TLB", "USD", 99.5, 425, "2026-07-15"], "future_as_of"),
        (["BBG000001", "Acme", "Acme TLB", "USD", float("nan"), 425, "2026-07-13"], "invalid_price"),
    ],
)
def test_missing_future_and_nonfinite_required_values_block(row, code):
    result = _preview(_workbook(rows=[row]))
    assert code in {issue.code for issue in result.issues}
    assert result.accepted_count == 0
    assert result.rejected_count == 1


def test_duplicate_instrument_keys_block_commit():
    row = ["BBG000001", "Acme", "Acme TLB", "USD", 99.5, 425, "2026-07-13"]
    result = _preview(_workbook(rows=[row, row]))
    assert "duplicate_instrument_key" in {issue.code for issue in result.issues}
    assert result.blocking_count >= 1


def test_invalid_rows_are_ledgered_without_blocking_valid_snapshot_rows():
    valid = ["BBG000001", "Acme", "Acme TLB", "USD", 99.5, 425, "2026-07-13"]
    rejected = ["BBG000002", "Beta", "Beta TLB", "USD", 98.0, "N/A", "2026-07-13"]
    result = _preview(_workbook(rows=[valid, rejected]))
    assert result.blocking_count == 0
    assert result.accepted_count == 1
    assert result.rejected_count == 1
    assert "invalid_discount_margin" in {issue.code for issue in result.issues}


def test_formula_requires_finite_cached_value_and_discloses_cache_use():
    missing = _preview(_formula_workbook(cached=False))
    assert "required_formula_cache" in {issue.code for issue in missing.issues}
    accepted = _preview(_formula_workbook(cached=True))
    assert accepted.blocking_count == 0
    assert "cached_formula_value" in {issue.code for issue in accepted.issues}
    assert accepted.formula_cell_count == 1
    assert accepted.rows[0]["formula_fields"] == ["price"]
    assert accepted.rows[0]["price"] == 99.5


def test_large_formula_sheet_uses_aggregated_audit_warning():
    rows = [
        [f"BBG{i:09d}", f"Borrower {i}", f"Loan {i}", "USD", "=99+0.5", 425, "2026-07-13"]
        for i in range(550)
    ]
    content = _workbook(rows=rows)
    with zipfile.ZipFile(io.BytesIO(content)) as package:
        sheet = package.read("xl/worksheets/sheet1.xml")
    sheet = sheet.replace(b"<f>99+0.5</f><v />", b"<f>99+0.5</f><v>99.5</v>")
    result = _preview(_rewrite_package(content, {"xl/worksheets/sheet1.xml": sheet}))
    assert result.blocking_count == 0
    assert result.formula_cell_count == 550
    assert sum(issue.code == "cached_formula_value" for issue in result.issues) == 1


@pytest.mark.parametrize(
    ("filename", "content", "code"),
    [
        ("market.xls", b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", "xlsx_required"),
        ("market.xlsx", b'{"renamed":true}', "invalid_ooxml"),
    ],
)
def test_extension_and_ooxml_content_are_both_enforced(filename, content, code):
    with pytest.raises(MarketWorkbookError) as caught:
        preview_workbook(content, filename=filename, now=NOW)
    assert caught.value.code == code


def test_generic_spreadsheet_sniffer_no_longer_claims_legacy_xls_support():
    with pytest.raises(HTTPException) as caught:
        ingest.sniff_xlsx(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1")
    assert caught.value.status_code == 400
    assert ".xlsx" in str(caught.value.detail)


@pytest.mark.parametrize(
    ("content_factory", "code"),
    [
        (lambda: _rewrite_package(_workbook(), extras={"xl/vbaProject.bin": b"macro"}), "active_or_external_content"),
        (lambda: _rewrite_package(_workbook(), extras={"xl/embeddings/oleObject1.bin": b"object"}), "active_or_external_content"),
        (lambda: _rewrite_package(_workbook(), extras={"xl/media/bomb.bin": b"0" * 2_000_000}), "compression_ratio_limit"),
    ],
)
def test_active_embedded_and_excessively_compressed_packages_fail_closed(content_factory, code):
    with pytest.raises(MarketWorkbookError) as caught:
        _preview(content_factory())
    assert caught.value.code == code


def test_external_relationship_fails_closed():
    content = _workbook()
    with zipfile.ZipFile(io.BytesIO(content)) as package:
        rels = package.read("xl/_rels/workbook.xml.rels")
    rels = rels.replace(
        b"</Relationships>",
        b'<Relationship Id="evil" Type="x" Target="https://example.invalid/feed" TargetMode="External"/></Relationships>',
    )
    hostile = _rewrite_package(content, {"xl/_rels/workbook.xml.rels": rels})
    with pytest.raises(MarketWorkbookError) as caught:
        _preview(hostile)
    assert caught.value.code == "external_relationship"


def test_macro_enabled_content_type_fails_closed_without_vba_member():
    content = _workbook()
    with zipfile.ZipFile(io.BytesIO(content)) as package:
        content_types = package.read("[Content_Types].xml")
    content_types = content_types.replace(
        b"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
        b"application/vnd.ms-excel.sheet.macroEnabled.main+xml",
    )
    hostile = _rewrite_package(content, {"[Content_Types].xml": content_types})
    with pytest.raises(MarketWorkbookError) as caught:
        _preview(hostile)
    assert caught.value.code == "active_or_external_content"


def test_flag_off_returns_404_before_malformed_body(monkeypatch):
    monkeypatch.setattr(
        market_import,
        "get_settings",
        lambda: SimpleNamespace(
            caos_market_xlsx_v2_enabled=False,
            caos_lineage_v2_enabled=False,
            session_secret="test-market-preview-secret",
        ),
    )
    with TestClient(app) as client:
        response = client.post("/api/rv/snapshots/import/preview", content=b"not multipart")
    assert response.status_code == 404


def test_market_flag_requires_lineage_gate(monkeypatch):
    monkeypatch.setattr(
        market_import,
        "get_settings",
        lambda: SimpleNamespace(
            caos_market_xlsx_v2_enabled=True,
            caos_lineage_v2_enabled=False,
            session_secret="test-market-preview-secret",
        ),
    )
    with TestClient(app) as client:
        response = client.post("/api/rv/snapshots/import/preview", content=b"not multipart")
    assert response.status_code == 503


def test_preview_route_is_stateless_and_returns_audit_hash(monkeypatch):
    monkeypatch.setattr(
        market_import,
        "get_settings",
        lambda: SimpleNamespace(
            caos_market_xlsx_v2_enabled=True,
            caos_lineage_v2_enabled=True,
            session_secret="test-market-preview-secret",
        ),
    )
    vault = Path(get_settings().caos_storage_dir)
    before_files = sorted(path.relative_to(vault) for path in vault.rglob("*") if path.is_file()) if vault.exists() else []
    database_path = Path(str(__import__("database").engine.url.database))
    with TestClient(app) as client:
        with sqlite3.connect(database_path) as connection:
            before_snapshots = connection.execute("SELECT COUNT(*) FROM market_snapshots").fetchone()[0]
        response = client.post(
            "/api/rv/snapshots/import/preview",
            files={"file": ("market.xlsx", _workbook(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"mapping": json.dumps({})},
        )
        with sqlite3.connect(database_path) as connection:
            after_snapshots = connection.execute("SELECT COUNT(*) FROM market_snapshots").fetchone()[0]
    after_files = sorted(path.relative_to(vault) for path in vault.rglob("*") if path.is_file()) if vault.exists() else []
    assert response.status_code == 200, response.text
    assert len(response.json()["workbook_sha256"]) == 64
    assert response.json()["preview_token"]
    assert before_snapshots == after_snapshots
    assert before_files == after_files
