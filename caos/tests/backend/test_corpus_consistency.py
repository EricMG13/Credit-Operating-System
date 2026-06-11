"""
Modular OS corpus consistency (Audit F-21 / TAXONOMY_RECONCILIATION §5.3).

Guards the Taxonomy A reconciliation so it can never silently drift again:

1. Every per-module copy of REF_CP-EMAIL_SourceRoutingMatrix.md is
   byte-identical to the canonical at `Modular OS/References/` (the
   dedup manifest's rule — Audit M-5).
2. The canonical matrix's §4 section headers use the Taxonomy A
   module names, asserted against the `const module_name` values in
   the payload schemas (the enforced contract).
3. CP-COMMON_PREAMBLE's module_manifest rows carry the same names.

Stdlib-only; runnable directly:

    python3 tests/backend/test_corpus_consistency.py
"""

from __future__ import annotations

import re
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2].parent  # repo root
_CORPUS = _ROOT / "Modular OS"
_CANONICAL = _CORPUS / "References" / "REF_CP-EMAIL_SourceRoutingMatrix.md"
_PREAMBLE = _CORPUS / "KNOWLEDGE SOURCES" / "00_GOVERNANCE" / "CP-COMMON_PREAMBLE.md"
_PAYLOADS = _CORPUS / "KNOWLEDGE SOURCES" / "02_SCHEMA" / "MODULE_PAYLOADS"


def _schema_names() -> dict[str, str]:
    """module_id -> canonical module_name from the payload schemas.

    Prefer the inline `"module_name": {"const": …}`; schemas that inherit
    the field from the base envelope encode the canonical name in their
    filename (`CP-1__CanonicalDataFoundation__payload.schema.txt`). When
    both exist they must agree.
    """
    names: dict[str, str] = {}
    for f in _PAYLOADS.glob("CP-*__*__payload.schema.txt"):
        mid, from_filename = f.name.split("__")[0], f.name.split("__")[1]
        m = re.search(r'"module_name":\s*\{\s*"const":\s*"([^"]+)"', f.read_text())
        if m:
            assert m.group(1) == from_filename, (
                f"{f.name}: const {m.group(1)!r} disagrees with filename"
            )
        names[mid] = m.group(1) if m else from_filename
    return names


def test_email_matrix_copies_match_canonical():
    assert _CANONICAL.is_file(), f"canonical missing: {_CANONICAL}"
    canonical = _CANONICAL.read_bytes()
    copies = [p for p in _CORPUS.rglob("REF_CP-EMAIL_SourceRoutingMatrix.md")
              if p != _CANONICAL]
    assert len(copies) >= 24, f"expected >=24 per-module copies, found {len(copies)}"
    drifted = [str(p.relative_to(_CORPUS)) for p in copies
               if p.read_bytes() != canonical]
    assert not drifted, f"copies drifted from canonical: {drifted}"


def test_email_matrix_headers_use_taxonomy_a_names():
    names = _schema_names()
    assert len(names) >= 24, f"payload schemas not found/parsed ({len(names)})"
    text = _CANONICAL.read_text()
    failures = []
    for mid, expected in names.items():
        # §4 headers look like: "### 4.6 CP-3 — RelativeValueSecuritySelection ..."
        m = re.search(rf"^###\s+4\.\d+\s+{re.escape(mid)}\s+—\s+(\w+)", text, re.M)
        if m and m.group(1) != expected:
            failures.append((mid, m.group(1), "expected " + expected))
    assert not failures, f"matrix headers off-taxonomy: {failures}"


def test_preamble_manifest_uses_taxonomy_a_names():
    names = _schema_names()
    text = _PREAMBLE.read_text()
    assert 'version="v3.3"' in text or "v3.3" in text.splitlines()[0], "preamble not v3.3+"
    failures = []
    for mid, expected in names.items():
        m = re.search(rf"^\|\s*{re.escape(mid)}\s*\|\s*\w+\s*\|\s*(\w+)\s*\|", text, re.M)
        if m and m.group(1) != expected:
            failures.append((mid, m.group(1), "expected " + expected))
    assert not failures, f"preamble manifest off-taxonomy: {failures}"


if __name__ == "__main__":
    test_email_matrix_copies_match_canonical()
    test_email_matrix_headers_use_taxonomy_a_names()
    test_preamble_manifest_uses_taxonomy_a_names()
    print("ok — corpus consistent: 24+ matrix copies identical to canonical; "
          "Taxonomy A names verified against payload-schema consts")
