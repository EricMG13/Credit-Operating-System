"""markitdown extraction spike — proves the out-of-process wiring and the
fallback without needing real markitdown (which requires Python 3.10+).

A stub CLI stands in for `markitdown <file>`: it ignores the input and emits a
known Markdown table, so we can assert the extractor shells out and uses its
stdout. With no command configured (or a broken one), extraction falls back to
the built-in pypdf/openpyxl path — so a misconfiguration never blocks an upload.
"""

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
    monkeypatch.setattr(ingest.settings, "markitdown_cmd", "")
    # junk bytes → pypdf fails → graceful "" (current behavior preserved)
    assert ingest.extract_pdf_text(b"not a real pdf", "x.pdf") == ""


def test_uses_markitdown_when_configured(tmp_path, monkeypatch):
    monkeypatch.setattr(ingest.settings, "markitdown_cmd", _stub_cmd(tmp_path))
    out = ingest.extract_pdf_text(b"%PDF-1.7", "om.pdf")
    # table structure comes through the CLI — the whole point of the integration
    assert "| Metric | FY25 |" in out
    assert "| EBITDA | 421 |" in out
    # the xlsx path routes through the same helper
    out_xlsx = ingest.extract_xlsx_text(b"PK\x03\x04", "pricing.xlsx")
    assert "| EBITDA | 421 |" in out_xlsx


def test_falls_back_when_command_missing(monkeypatch):
    monkeypatch.setattr(ingest.settings, "markitdown_cmd", "/nonexistent/markitdown-xyz")
    # OSError on exec → fallback, no crash
    assert ingest.extract_pdf_text(b"not a real pdf", "x.pdf") == ""
