"""Scores OKF extraction against the labelled corpus.

Criteria and thresholds: `caos/docs/OKF_EXTRACTION_ASSESSMENT.md`.
Corpus and ground truth: `corpus/okf_corpus.py`.

Recall metrics are floors; precision and safety metrics are contracts. Lowering a
contract to make this file pass is a defect, not a tuning decision — the criteria
doc says so explicitly, and so does this comment, because that is exactly the
shortcut a future failing run invites.

The corpus is constructed, not real filings (no financial PDFs are checked into
this repo and EDGAR is unreachable from the sandbox). A green run is a regression
net and a floor, never an accuracy claim about production documents.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
sys.path.insert(0, str(SERVER_DIR))
sys.path.insert(0, str(Path(__file__).resolve().parent / "corpus"))

from okf_corpus import CORPUS, build, source_text  # noqa: E402


# ── run the pipeline once over the whole corpus ─────────────────────────────


def _digits(text: str) -> set[str]:
    import re

    return {re.sub(r"[^0-9]", "", t) for t in re.findall(r"[\d][\d,.]*", text)} - {""}


@pytest.fixture(scope="module")
def extracted():
    """(doc, ExtractedDocument, StructuredReport, chunks) for every corpus entry.

    Built once — the whole scorecard reads from this, so a criterion can never
    silently score a different run than its neighbour.
    """
    import asyncio

    import okf_ingest
    from okf_schema import IssuerRef, StructuringOverrides
    from okf_structure import structure

    async def _run():
        rows = []
        for doc in CORPUS:
            content = build(doc)
            ex = await okf_ingest.extract(content, f"{doc.key}.pdf")
            issuer = IssuerRef(id=f"i-{doc.key}", name=doc.issuer, industry="Industrials")
            report = structure(ex, issuer, StructuringOverrides())
            chunks = okf_ingest.chunk_report(report, issuer)
            rows.append((doc, ex, report, chunks))
        return rows

    return asyncio.run(_run())


def _rate(hits: int, total: int) -> float:
    return 1.0 if total == 0 else hits / total


# ── A. routing ──────────────────────────────────────────────────────────────


def test_A1_doc_type_classification_accuracy(extracted):
    correct = [d.key for d, _e, r, _c in extracted if r.doc_type.value == d.doc_type]
    wrong = [(d.key, d.doc_type, r.doc_type.value)
             for d, _e, r, _c in extracted if r.doc_type.value != d.doc_type]
    rate = _rate(len(correct), len(extracted))
    assert rate >= 0.90, f"A1 classification {rate:.2f} < 0.90; misrouted={wrong}"


def test_A2_title_markers_beat_a_quoted_agency_name(extracted):
    """An offering memo quoting Moody's on its cover is still an offering memo.
    Absolute: mis-routing changes which extractors run."""
    offering = [(d, r) for d, _e, r, _c in extracted if d.doc_type == "offering-memo"]
    assert offering, "corpus must exercise this"
    bad = [d.key for d, r in offering if r.doc_type.value != "offering-memo"]
    assert not bad, f"A2 offering memo misrouted: {bad}"


def test_A3_unclassifiable_documents_fall_back_without_raising(extracted):
    fallbacks = [(d, r) for d, _e, r, _c in extracted if d.doc_type == "source-document"]
    assert fallbacks, "corpus must exercise the fallback"
    bad = [d.key for d, r in fallbacks if r.doc_type.value != "source-document"]
    assert not bad, f"A3 fallback failed: {bad}"


# ── B. structure ────────────────────────────────────────────────────────────


def test_B1_sections_are_found_in_text_bearing_documents(extracted):
    bearing = [(d, r) for d, _e, r, _c in extracted if d.text_bearing]
    ok = [d.key for d, r in bearing if any(s.text.strip() for s in r.sections)]
    rate = _rate(len(ok), len(bearing))
    assert rate >= 0.95, f"B1 section discovery {rate:.2f} < 0.95"


def test_B2_page_anchor_rate(extracted):
    total = anchored = 0
    for d, ex, r, _c in extracted:
        if not (d.text_bearing and ex.has_page_map):
            continue
        for section in r.sections:
            if not section.text.strip():
                continue
            total += 1
            anchored += section.page_start is not None
    rate = _rate(anchored, total)
    assert rate >= 0.70, f"B2 page-anchor rate {rate:.2f} < 0.70 ({anchored}/{total})"


def test_B3_anchors_are_never_fabricated(extracted):
    """A wrong anchor is worse than none — it sends an analyst to the wrong page
    while looking authoritative."""
    bad = []
    for d, ex, r, _c in extracted:
        for section in r.sections:
            for anchor in (section.page_start, section.page_end):
                if anchor is not None and not (1 <= anchor <= max(ex.page_count, 0)):
                    bad.append((d.key, section.title, anchor, ex.page_count))
    assert not bad, f"B3 out-of-range page anchors: {bad}"


def test_B4_text_bearing_documents_produce_chunks(extracted):
    bearing = [(d, c) for d, _e, _r, c in extracted if d.text_bearing]
    ok = [d.key for d, c in bearing if c]
    rate = _rate(len(ok), len(bearing))
    assert rate >= 0.95, f"B4 chunk production {rate:.2f} < 0.95"


# ── C. facts ────────────────────────────────────────────────────────────────


def test_C1_key_fact_recall(extracted):
    expected = found = 0
    missing = []
    for d, _e, r, _c in extracted:
        values = {f.value for f in r.key_facts}
        for want in d.expect_facts:
            expected += 1
            if want in values:
                found += 1
            else:
                missing.append((d.key, want, sorted(values)))
    rate = _rate(found, expected)
    assert rate >= 0.80, f"C1 fact recall {rate:.2f} < 0.80; missing={missing}"


def test_C2_extracted_values_are_never_invented(extracted):
    """Precision is a contract: every digit run in an extracted value must occur
    in the source document."""
    invented = []
    for d, _e, r, _c in extracted:
        available = _digits(source_text(d))
        for fact in r.key_facts:
            wanted = _digits(fact.value)
            if wanted and not wanted.issubset(available):
                invented.append((d.key, fact.label, fact.value))
    assert not invented, f"C2 invented values: {invented}"


def test_C3_values_are_stored_verbatim(extracted):
    """4.25x must not become 4.3x — the downstream grounding gate compares
    formatting-tolerantly and desyncs if extraction normalises."""
    row = next((r for d, _e, r, _c in extracted if d.key == "verbatim-avtr"), None)
    assert row is not None
    values = {f.value for f in row.key_facts}
    assert "4.25x" in values, f"C3 verbatim lost: {sorted(values)}"
    assert "4.3x" not in values, "C3 value was rounded"


def test_C4_a_rating_is_attributed_only_to_its_publishing_agency(extracted):
    by_key = {d.key: r for d, _e, r, _c in extracted}

    moodys = by_key["rating-ssnc-moodys"]
    assert moodys.rating_moody == "B2"
    assert moodys.rating_sp is None, "C4 Moody's rating leaked into the S&P column"

    sp = by_key["rating-thc-sp"]
    assert sp.rating_sp == "BB-"
    assert sp.rating_moody is None, "C4 S&P rating leaked into the Moody's column"


# ── D. degradation ──────────────────────────────────────────────────────────


def test_D1_D2_D3_unreadable_documents_degrade_honestly(extracted):
    import ingest

    for d, ex, r, chunks in extracted:
        if d.text_bearing:
            continue
        assert ex.extraction_status == "empty", f"D1 {d.key}: {ex.extraction_status}"
        assert ingest.NO_CHUNKS_WARNING in ex.warnings, f"D1 {d.key} lost the warning"
        assert chunks == [], f"D2 {d.key} produced chunks from an empty document"
        assert r.sections, "D2 the note must still be renderable"


def test_D3_status_is_honest_about_what_was_read(extracted):
    for d, ex, _r, _c in extracted:
        if ex.extraction_status == "full":
            assert ex.full_text.strip(), f"D3 {d.key}: 'full' with no text"
            assert ex.has_page_map, f"D3 {d.key}: 'full' with no page map"
        if ex.extraction_status == "partial":
            assert ex.full_text.strip() and not ex.has_page_map, f"D3 {d.key} mislabelled"


def test_D4_the_whole_corpus_runs_without_raising(extracted):
    """The fixture itself is the assertion — it would have raised during setup."""
    assert len(extracted) == len(CORPUS)


# ── E. safety ───────────────────────────────────────────────────────────────


def test_E1_no_synthetic_numerals_reach_chunk_text(extracted):
    """Page anchors must stay in metadata and the note file; a numeral in chunk
    text widens grounding.all_grounded's allowed pool."""
    offenders = [(d.key, c.text[:60]) for d, _e, _r, chunks in extracted
                 for c in chunks if "(p." in c.text]
    assert not offenders, f"E1 page anchors leaked into chunk text: {offenders}"


def test_E1b_chunk_anchors_survive_as_metadata(extracted):
    """The complement: banishing anchors from text must not lose them entirely."""
    anchored = [c for _d, _e, _r, chunks in extracted for c in chunks
                if c.page_start is not None]
    assert anchored, "E1b anchors vanished from chunk metadata too"


def test_E3_every_basis_is_from_the_closed_set(extracted):
    from okf_schema import FACT_BASES

    bad = [(d.key, f.label, f.basis) for d, _e, r, _c in extracted
           for f in r.key_facts if f.basis is not None and f.basis not in FACT_BASES]
    assert not bad, f"E3 out-of-vocabulary basis: {bad}"


def test_E2_marketed_figures_cannot_reach_reported_cp1(extracted):
    """RT-2026-07-24-01 scored corpus-wide: feed each deck's marketed leverage
    through the CP-4C bridge against a reported CP-1 and assert the reported
    financials are untouched every time."""
    import asyncio
    import copy
    from types import SimpleNamespace

    from engine.marketed import marketed_vs_reported
    from engine.schemas import ModulePayload

    class _Session:
        def __init__(self, rows):
            self._rows = rows

        async def execute(self, _stmt):
            rows = self._rows

            class _R:
                @staticmethod
                def scalars():
                    return SimpleNamespace(all=lambda: rows)
            return _R()

    decks = [(d, r) for d, _e, r, _c in extracted if d.doc_type == "sponsor-deck"]
    assert decks, "corpus must exercise the marketed path"

    for doc, report in decks:
        facts = [{"label": f.label, "value": f.value, "kind": f.kind,
                  "basis": "sponsor-adjusted", "page": f.page or 1}
                 for f in report.key_facts if f.kind == "leverage"]
        if not facts:
            continue
        cp1 = ModulePayload(
            module_id="CP-1", module_name="Reported", owned_object="ReportedFinancials",
            runtime_output={
                "basis": "reported_gaap_xbrl",
                "normalized_financials": {
                    "net_leverage_adj_ltm": 6.8, "net_debt_ltm": 680.0,
                    "adj_ebitda": {"2025": 100.0},
                },
            },
        )
        before = copy.deepcopy(cp1.runtime_output["normalized_financials"])
        rows = [SimpleNamespace(key_facts_json=facts, source="Deck", doc_type="sponsor-deck")]

        result = asyncio.run(marketed_vs_reported(_Session(rows), "i-1", cp1))

        after = cp1.runtime_output["normalized_financials"]
        assert after == before, f"E2 {doc.key}: reported financials were mutated"
        if result is not None:
            bridge, _claim = result
            assert bridge["marketed_leverage"] not in after.values(), (
                f"E2 {doc.key}: marketed figure entered the reported foundation"
            )


# ── scorecard ───────────────────────────────────────────────────────────────


def test_print_scorecard(extracted, capsys):
    """Not a gate — prints the measured rates so a run is readable at a glance.
    Thresholds are enforced by the tests above."""
    classified = sum(r.doc_type.value == d.doc_type for d, _e, r, _c in extracted)
    bearing = [(d, e, r, c) for d, e, r, c in extracted if d.text_bearing]
    sectioned = sum(any(s.text.strip() for s in r.sections) for _d, _e, r, _c in bearing)
    chunked = sum(bool(c) for _d, _e, _r, c in bearing)

    anchor_total = anchor_hit = 0
    for _d, ex, r, _c in bearing:
        if not ex.has_page_map:
            continue
        for s in r.sections:
            if s.text.strip():
                anchor_total += 1
                anchor_hit += s.page_start is not None

    expected = sum(len(d.expect_facts) for d, _e, _r, _c in extracted)
    found = sum(1 for d, _e, r, _c in extracted
                for w in d.expect_facts if w in {f.value for f in r.key_facts})

    with capsys.disabled():
        print("\n  OKF extraction scorecard "
              f"({len(CORPUS)} labelled documents, constructed — not real filings)")
        print(f"    A1 classification   {_rate(classified, len(extracted)):.2f}  (>= 0.90)")
        print(f"    B1 sections found   {_rate(sectioned, len(bearing)):.2f}  (>= 0.95)")
        print(f"    B2 page anchors     {_rate(anchor_hit, anchor_total):.2f}  "
              f"(>= 0.70)  {anchor_hit}/{anchor_total}")
        print(f"    B4 chunks produced  {_rate(chunked, len(bearing)):.2f}  (>= 0.95)")
        print(f"    C1 fact recall      {_rate(found, expected):.2f}  "
              f"(>= 0.80)  {found}/{expected}")
        print("    C2/C3/C4, D*, E*    contracts — asserted above")
