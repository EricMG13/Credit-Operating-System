"""markitdown extraction spike — proves the out-of-process wiring and the
fallback without needing real markitdown (which requires Python 3.10+).

A stub CLI stands in for `markitdown <file>`: it ignores the input and emits a
known Markdown table, so we can assert the extractor shells out and uses its
stdout. With no command configured (or a broken one), extraction falls back to
the built-in pypdf/openpyxl path — so a misconfiguration never blocks an upload.
"""

import io
import stat

import ingest

# A stand-in for the markitdown CLI: consumes the file arg, emits a fixed
# structure-preserving Markdown table (what real markitdown would produce, and
# what pypdf/openpyxl would not).
_STUB = """#!/bin/sh
cat "$1" > /dev/null 2>&1
echo "# Financials"
echo "| Metric | FY25 |"
echo "| --- | --- |"
echo "| EBITDA | 421 |"
"""


def _stub_cmd(tmp_path) -> str:
    script = tmp_path / "fake-markitdown.sh"
    script.write_text(_STUB)
    script.chmod(script.stat().st_mode | stat.S_IEXEC)
    return str(script)


def test_falls_back_when_unconfigured(monkeypatch):
    monkeypatch.setattr(ingest.get_settings(), "markitdown_cmd", "")
    # junk bytes → pypdf fails → graceful "" (current behavior preserved)
    assert ingest.extract_pdf_text(b"not a real pdf", "x.pdf") == ("", False)


def test_uses_markitdown_when_configured(tmp_path, monkeypatch):
    monkeypatch.setattr(ingest.get_settings(), "markitdown_cmd", _stub_cmd(tmp_path))
    out, used_ocr = ingest.extract_pdf_text(b"%PDF-1.7", "om.pdf")
    # table structure comes through the CLI — the whole point of the integration
    assert "| Metric | FY25 |" in out
    assert "| EBITDA | 421 |" in out
    assert used_ocr is False  # markitdown text, never OCR (D1 provenance signal)
    # The xlsx path routes through the same helper only after the shared OOXML
    # safety gate accepts a real package.
    from openpyxl import Workbook

    workbook = Workbook()
    workbook.active.append(["Metric", "FY25"])
    buffer = io.BytesIO()
    workbook.save(buffer)
    out_xlsx = ingest.extract_xlsx_text(buffer.getvalue(), "pricing.xlsx")
    assert "| EBITDA | 421 |" in out_xlsx


def test_falls_back_when_command_missing(monkeypatch):
    monkeypatch.setattr(ingest.get_settings(), "markitdown_cmd", "/nonexistent/markitdown-xyz")
    # OSError on exec → fallback, no crash
    assert ingest.extract_pdf_text(b"not a real pdf", "x.pdf") == ("", False)


# Stand-in for `ocrmypdf --force-ocr --sidecar <txt> <src> <out>`: writes known
# text to the sidecar path (argv $3). Proves the last-resort OCR lane shells out
# AND reads the sidecar file (not stdout) — the read must happen before the temp
# dir is torn down.
_OCR_STUB = """#!/bin/sh
echo "OCR RECOVERED TEXT" > "$3"
"""


def _ocr_stub_cmd(tmp_path) -> str:
    script = tmp_path / "fake-ocrmypdf.sh"
    script.write_text(_OCR_STUB)
    script.chmod(script.stat().st_mode | stat.S_IEXEC)
    return str(script)


def test_ocr_recovers_scanned_pdf(tmp_path, monkeypatch):
    # No markitdown, pypdf finds no text layer (junk) → OCR is the last resort.
    monkeypatch.setattr(ingest.get_settings(), "markitdown_cmd", "")
    monkeypatch.setattr(ingest.get_settings(), "ocrmypdf_cmd", _ocr_stub_cmd(tmp_path))
    out, used_ocr = ingest.extract_pdf_text(b"scanned-image-pdf", "scan.pdf")
    assert out == "OCR RECOVERED TEXT"
    # D1: the provenance signal callers tag document_chunks.prov="ocr" from.
    assert used_ocr is True


def test_ocr_skipped_when_text_layer_present(tmp_path, monkeypatch):
    # markitdown yields text → OCR must NOT run (it would overwrite with its sentinel).
    monkeypatch.setattr(ingest.get_settings(), "markitdown_cmd", _stub_cmd(tmp_path))
    monkeypatch.setattr(ingest.get_settings(), "ocrmypdf_cmd", _ocr_stub_cmd(tmp_path))
    out, used_ocr = ingest.extract_pdf_text(b"%PDF-1.7", "om.pdf")
    assert "| EBITDA | 421 |" in out
    assert "OCR RECOVERED TEXT" not in out
    assert used_ocr is False


def test_ocr_disabled_returns_empty(monkeypatch):
    monkeypatch.setattr(ingest.get_settings(), "markitdown_cmd", "")
    monkeypatch.setattr(ingest.get_settings(), "ocrmypdf_cmd", "")
    assert ingest.extract_pdf_text(b"not a real pdf", "x.pdf") == ("", False)
