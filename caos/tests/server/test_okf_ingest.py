"""OKF ingestion pipeline — per-stage units + one round-trip integration test.

Covers the blueprint's Appendix-B test list: page extraction, classification, note
shape (including the grounding-pool rule), BM25 retrievability, supersede
idempotency with evidence-aware shadowing, the Sources/ memo-sync exclusion, and
the empty-PDF degradation path.

Fixtures are **real PDFs** built with reportlab rather than the byte-stub
``b"%PDF-1.4..."`` used elsewhere in the suite: the page map, the classifier, and
the section anchors all read actual extracted text, so a stub would assert
nothing.
"""

from __future__ import annotations

import io
import sqlite3
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
sys.path.insert(0, str(SERVER_DIR))


# ── fixtures ─────────────────────────────────────────────────────────────────


def text_pdf(pages: list[str]) -> bytes:
    """A real, text-layer PDF with one rendered page per entry."""
    from reportlab.lib.pagesizes import LETTER
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    pdf = canvas.Canvas(buf, pagesize=LETTER)
    for page in pages:
        y = 720
        for line in page.splitlines():
            pdf.drawString(72, y, line)
            y -= 14
        pdf.showPage()
    pdf.save()
    return buf.getvalue()


RATING_PDF_PAGES = [
    "\n".join([
        "Moody's Investors Service",
        "Credit Opinion",
        "Atlas Forge Industrials",
        "November 3, 2025",
        "Corporate Family Rating: B2",
    ]),
    "\n".join([
        "RATING RATIONALE",
        "The B2 CFR reflects elevated opening net leverage of 5.8x and",
        "adequate liquidity supported by an undrawn revolving credit facility.",
        "Zephyr distribution contracts underpin the revenue base.",
    ]),
]

OFFERING_PDF_PAGES = [
    "\n".join([
        "OFFERING MEMORANDUM",
        "Atlas Forge Industrials",
        "1L Term Loan $650mm",
        "The notes mature 2031.",
    ]),
]


@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def issuer_id(client):
    r = client.post("/api/issuers", json={"name": "OKF Ingest Test Co", "ticker": "OKFT"})
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


@pytest.fixture()
def vault(tmp_path, monkeypatch):
    """Point the OKF lane's vault at a temp dir.

    Patches ``okf_ingest.get_settings`` specifically: the module did
    ``from config import get_settings``, so it holds a direct reference and
    patching ``config.get_settings`` alone would not reach it.
    """
    import config
    import okf_ingest

    patched = config.get_settings().model_copy(
        update={"vault_export_dir": str(tmp_path)}
    )
    monkeypatch.setattr(okf_ingest, "get_settings", lambda: patched)
    return tmp_path


def _insert_row(con, table: str, values: dict) -> None:
    """Insert only the columns this table actually has, so the helper survives an
    additive schema change."""
    cols = {r[1] for r in con.execute(f"PRAGMA table_info({table})")}
    usable = {k: v for k, v in values.items() if k in cols}
    placeholders = ",".join("?" * len(usable))
    con.execute(
        f"INSERT INTO {table} ({','.join(usable)}) VALUES ({placeholders})",
        tuple(usable.values()),
    )


def _ingest(client, issuer_id, pdf: bytes, name="doc.pdf", **form):
    data = {"issuer_id": issuer_id, **form}
    return client.post(
        "/api/okf/ingest",
        data=data,
        files={"file": (name, pdf, "application/pdf")},
    )


# ── Stage 1: extraction ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_okf_extract_pages_builds_a_page_map():
    """The page map comes from the unconditional pypdf pass, so this holds whether
    or not markitdown is wired."""
    import okf_ingest

    extracted = await okf_ingest.extract(text_pdf(RATING_PDF_PAGES), "rating.pdf")

    assert extracted.has_page_map is True
    assert extracted.page_count == 2
    assert len(extracted.pages) == 2
    assert extracted.extraction_status == "full"
    assert extracted.content_sha256 and len(extracted.content_sha256) == 64
    assert "Corporate Family Rating" in extracted.full_text


@pytest.mark.asyncio
async def test_okf_extract_empty_pdf_degrades_without_raising():
    """A PDF with no text layer still vaults; it is flagged empty and carries the
    house no-chunks warning rather than failing the upload."""
    import ingest
    import okf_ingest

    extracted = await okf_ingest.extract(b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF", "x.pdf")

    assert extracted.extraction_status == "empty"
    assert ingest.NO_CHUNKS_WARNING in extracted.warnings
    assert extracted.storage_key  # still vaulted


# ── Stage 2: structuring ─────────────────────────────────────────────────────


def test_okf_structure_classifies():
    from okf_schema import DocType
    from okf_structure import classify

    assert classify("OFFERING MEMORANDUM\nAcme") is DocType.OFFERING_MEMO
    assert classify("Moody's Investors Service\nCorporate Family Rating: B2") is DocType.RATING_REPORT
    assert classify("Lender Presentation\nQ3") is DocType.SPONSOR_DECK
    assert classify("Compliance Certificate") is DocType.LENDER_UPDATE
    # Unmarked → the fallback, never a crash.
    assert classify("Some routine correspondence about nothing in particular.") is DocType.SOURCE_DOCUMENT


def test_okf_classifier_prefers_the_document_title_over_a_quoted_agency():
    """An offering memo quotes Moody's throughout; it must still classify as an
    offering memo, not a rating report."""
    from okf_schema import DocType
    from okf_structure import classify

    text = "OFFERING MEMORANDUM\nThe notes are rated B2 by Moody's Investors Service."
    assert classify(text) is DocType.OFFERING_MEMO


def test_okf_classifier_honours_the_analyst_override():
    from okf_schema import DocType
    from okf_structure import classify

    assert classify("OFFERING MEMORANDUM", override=DocType.SPONSOR_DECK) is DocType.SPONSOR_DECK


@pytest.mark.asyncio
async def test_okf_structure_extracts_verbatim_facts_and_anchors_pages():
    import okf_ingest
    from okf_schema import DocType, IssuerRef, StructuringOverrides
    from okf_structure import structure

    extracted = await okf_ingest.extract(text_pdf(RATING_PDF_PAGES), "rating.pdf")
    issuer = IssuerRef(id="i-1", name="Atlas Forge Industrials", industry="Industrials")
    report = structure(extracted, issuer, StructuringOverrides())

    assert report.doc_type is DocType.RATING_REPORT
    assert report.source == "Moody's"
    assert report.report_date == "2025-11-03"
    # Verbatim: 5.8x is never rounded or reformatted.
    leverage = [f for f in report.key_facts if f.kind == "leverage"]
    assert leverage and leverage[0].value == "5.8x"
    # The rating is attributed to the publishing agency only.
    assert report.rating_moody == "B2"
    assert report.rating_sp is None
    # Page anchors resolve into the real page map.
    anchored = [s for s in report.sections if s.page_start is not None]
    assert anchored, "expected at least one section anchored to a page"
    assert all(1 <= s.page_start <= 2 for s in anchored)


@pytest.mark.asyncio
async def test_okf_structure_of_empty_pdf_is_still_renderable():
    import okf_ingest
    from okf_schema import IssuerRef, StructuringOverrides
    from okf_structure import structure

    extracted = await okf_ingest.extract(b"%PDF-1.4\ntrailer\n<<>>\n%%EOF", "x.pdf")
    report = structure(
        extracted, IssuerRef(id="i-1", name="Atlas Forge Industrials"), StructuringOverrides()
    )

    assert report.extraction_status == "empty"
    assert report.sections and report.sections[0].text == ""
    assert report.key_facts == []
    assert report.title.startswith("Atlas Forge Industrials — ")


# ── Stage 3/4: note shape + the grounding-pool rule ──────────────────────────


@pytest.mark.asyncio
async def test_okf_note_shape_and_no_page_anchor_in_chunk_text():
    import okf_ingest
    from okf_notes import render_note_file, render_okf_note
    from okf_schema import IssuerRef, StructuringOverrides
    from okf_structure import structure

    extracted = await okf_ingest.extract(text_pdf(RATING_PDF_PAGES), "rating.pdf")
    issuer = IssuerRef(
        id="i-1", name="Atlas Forge Industrials", ticker="ATLF",
        industry="Industrials", country="US",
    )
    report = structure(extracted, issuer, StructuringOverrides())
    note = render_okf_note(report, issuer, "doc-123", extracted.storage_key)
    rendered = render_note_file(note)

    # Frontmatter: required keys present and non-empty.
    assert rendered.startswith("---\n")
    assert 'type: "source-document"' in rendered
    assert "contains_source_text: true" in rendered  # real bool, unquoted
    assert 'document_id: "doc-123"' in rendered
    assert 'okf_version: "okf/1.0"' in rendered
    assert 'extraction_status: "full"' in rendered
    # Body: H1 + issuer wikilink.
    assert "\n# Atlas Forge Industrials — Rating report" in rendered
    assert "[[Atlas Forge Industrials]]" in rendered
    assert note.note_rel_path.startswith("Sources/")

    # The grounding-pool rule: page anchors live in the note and in chunk
    # METADATA, never inside chunk text.
    chunks = okf_ingest.chunk_report(report, issuer)
    assert chunks, "expected chunks from a text PDF"
    assert any("(p." in rendered for _ in [0]), "note body should carry page anchors"
    for chunk in chunks:
        assert "(p." not in chunk.text
    assert any(c.page_start is not None for c in chunks), "anchors belong in metadata"


def test_okf_note_title_is_the_supersede_identity_slug():
    """The filename stem and the identity key are one function, so they cannot
    drift — two periods must not collide on one path."""
    from okf_notes import okf_note_title
    from okf_schema import DocType, IssuerRef, StructuredReport

    issuer = IssuerRef(id="i-1", name="Atlas Forge Industrials")

    def report_for(date):
        return StructuredReport(
            issuer_id="i-1", doc_type=DocType.RATING_REPORT, source="Moody's",
            report_date=date, title="t", method="pypdf", page_count=1,
            extraction_status="full",
        )

    assert okf_note_title(report_for("2025-11-03"), issuer) != okf_note_title(
        report_for("2026-02-01"), issuer
    )
    # Same identity → same slug (this is what makes supersede in-place work).
    assert okf_note_title(report_for("2025-11-03"), issuer) == okf_note_title(
        report_for("2025-11-03"), issuer
    )


def test_okf_chunk_text_carries_a_word_only_breadcrumb():
    import okf_ingest
    from okf_schema import DocSection, DocType, IssuerRef, StructuredReport

    issuer = IssuerRef(id="i-1", name="Atlas Forge Industrials")
    report = StructuredReport(
        issuer_id="i-1", doc_type=DocType.RATING_REPORT, title="t",
        method="pypdf", page_count=9, extraction_status="full",
        report_date="2025-11-03",
        sections=[DocSection(title="Liquidity", level=1, text="Cash on hand is adequate.",
                             page_start=7, page_end=9)],
    )
    chunks = okf_ingest.chunk_report(report, issuer)

    assert len(chunks) == 1
    text = chunks[0].text
    assert text.startswith("Atlas Forge Industrials — rating-report — Liquidity")
    # No page integer, no report date, no year injected by us.
    assert "2025-11-03" not in text
    assert "(p." not in text
    # The anchors survive as metadata.
    assert (chunks[0].page_start, chunks[0].page_end) == (7, 9)


def test_okf_chunk_report_skips_empty_sections():
    import okf_ingest
    from okf_schema import DocSection, DocType, IssuerRef, StructuredReport

    report = StructuredReport(
        issuer_id="i-1", doc_type=DocType.SOURCE_DOCUMENT, title="t",
        method="none", page_count=0, extraction_status="empty",
        sections=[DocSection(title="Document", level=1, text="")],
    )
    assert okf_ingest.chunk_report(report, IssuerRef(id="i-1", name="Acme")) == []


# ── Stage 5/6: round trip through the route ─────────────────────────────────


def test_okf_ingest_route_chunks_are_retrievable(client, issuer_id, vault):
    """The whole chain: route → extract → structure → chunk → commit, and the
    chunks are BM25-retrievable immediately (no embedding needed)."""
    import asyncio

    # Unique body text so this test never collides with another test's identical
    # bytes and get short-circuited by the content-dedup no-op.
    pages = list(RATING_PDF_PAGES)
    pages[1] += "\nRetrieval probe marker for this test only."
    r = _ingest(client, issuer_id, text_pdf(pages), "rating.pdf")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["chunk_count"] > 0
    assert body["extraction_status"] == "full"
    assert body["note_rel_path"].startswith("Sources/")
    assert body["warning"] is None

    async def _retrieve():
        from database import AsyncSessionLocal
        import retrieval

        async with AsyncSessionLocal() as session:
            return await retrieval.retrieve(session, issuer_id, "Zephyr distribution contracts", k=5)

    hits = asyncio.run(_retrieve())
    assert hits, "OKF chunks must be BM25-retrievable on commit"
    assert any("Zephyr" in h.text for h in hits)


def test_okf_ingest_writes_the_source_note(client, issuer_id, vault):
    r = _ingest(client, issuer_id, text_pdf(OFFERING_PDF_PAGES), "om.pdf")
    assert r.status_code == 200, r.text
    body = r.json()

    note_path = vault / body["note_rel_path"]
    assert note_path.is_file(), f"note not written to {note_path}"
    content = note_path.read_text()
    assert 'type: "source-document"' in content
    assert "contains_source_text: true" in content
    assert body["note_rel_path"].startswith("Sources/")
    # Classified off the cover page, and the doc_type reached the DB column.
    assert "offering-memo" in content


def test_okf_ingest_rejects_an_unknown_doc_type_override(client, issuer_id, vault):
    r = _ingest(client, issuer_id, text_pdf(OFFERING_PDF_PAGES), "om.pdf", doc_type="not-a-type")
    assert r.status_code == 400
    assert "doc_type must be one of" in r.text


def test_okf_ingest_404s_an_unknown_issuer(client, vault):
    """Extraction vaults the bytes before the issuer is resolved, so a rejected
    issuer must not leave the blob behind — otherwise probing ids grows the vault."""
    from config import get_settings

    storage = Path(get_settings().caos_storage_dir)
    before = len(list(storage.glob("*/*")))

    r = _ingest(client, "00000000-0000-0000-0000-000000000000", text_pdf(OFFERING_PDF_PAGES))

    assert r.status_code == 404
    assert len(list(storage.glob("*/*"))) == before, "orphaned blob left after a 404"


def test_okf_ingest_rejects_a_non_pdf(client, issuer_id, vault):
    r = client.post(
        "/api/okf/ingest",
        data={"issuer_id": issuer_id},
        files={"file": ("x.pdf", b"not a pdf at all", "application/pdf")},
    )
    assert r.status_code == 400


def test_okf_identical_bytes_are_a_no_op(client, issuer_id, vault):
    """A renamed re-upload of identical content must not double-ingest."""
    from config import get_settings

    pdf = text_pdf(RATING_PDF_PAGES)
    first = _ingest(client, issuer_id, pdf, "rating.pdf")
    assert first.status_code == 200, first.text

    storage = Path(get_settings().caos_storage_dir)
    before = len(list(storage.glob("*/*")))
    second = _ingest(client, issuer_id, pdf, "rating-renamed.pdf")
    assert second.status_code == 200, second.text
    assert second.json()["document_id"] == first.json()["document_id"]
    assert second.json()["chunk_count"] == 0  # nothing new was written
    # The duplicate's freshly-vaulted blob is cleaned up, not leaked.
    assert len(list(storage.glob("*/*"))) == before

    listed = client.get(f"/api/okf/documents?issuer_id={issuer_id}").json()
    matching = [row for row in listed if row["document_id"] == first.json()["document_id"]]
    assert len(matching) == 1, "content dedup must not create a second registry row"


def test_okf_supersede_replaces_an_uncited_prior_document(client, issuer_id, vault):
    """Same identity (issuer + type + source + date), changed content → the prior
    uncited document is replaced, and the single registry row repoints."""
    first = _ingest(client, issuer_id, text_pdf(RATING_PDF_PAGES), "r1.pdf")
    assert first.status_code == 200, first.text
    first_doc = first.json()["document_id"]

    revised = list(RATING_PDF_PAGES)
    revised[1] = revised[1] + "\nCorrected: liquidity is now constrained."
    second = _ingest(client, issuer_id, text_pdf(revised), "r2.pdf")
    assert second.status_code == 200, second.text
    body = second.json()

    assert body["document_id"] != first_doc
    assert body["superseded_document_id"] == first_doc
    assert body["note_rel_path"] == first.json()["note_rel_path"]  # same identity slug

    from conftest import _DB_PATH

    con = sqlite3.connect(_DB_PATH, timeout=30)
    try:
        rows = con.execute(
            "SELECT COUNT(*) FROM okf_notes WHERE note_path = ?", (body["note_rel_path"],)
        ).fetchone()[0]
        prior = con.execute(
            "SELECT COUNT(*) FROM documents WHERE id = ?", (first_doc,)
        ).fetchone()[0]
    finally:
        con.close()
    assert rows == 1, "supersede updates the registry row in place"
    assert prior == 0, "an uncited prior document is hard-deleted"


def test_okf_supersede_keeps_a_cited_prior_document_as_a_shadow(client, issuer_id, vault):
    """Evidence-aware: a cited prior document survives so the citation stays
    openable. EvidenceItem.document_chunk_id is a real FK with no ondelete, so
    deleting it would raise under Postgres even though SQLite would allow it."""
    from conftest import _DB_PATH

    first = _ingest(client, issuer_id, text_pdf(RATING_PDF_PAGES), "r1.pdf")
    assert first.status_code == 200, first.text
    first_doc = first.json()["document_id"]

    con = sqlite3.connect(_DB_PATH, timeout=30)
    try:
        chunk_id = con.execute(
            "SELECT id FROM document_chunks WHERE document_id = ? LIMIT 1", (first_doc,)
        ).fetchone()[0]
        # A citation is claim → evidence. The parent claim's own FKs are left
        # dangling deliberately: raw sqlite3 does not enforce foreign keys, and
        # this test only needs the evidence row that makes the chunk "cited".
        _insert_row(con, "claims", {
            "id": "okf-claim-1",
            "module_output_id": "okf-module-output-1",
            "claim_id": "C-OKF-1",
            "claim_text": "Leverage is 5.8x.",
        })
        _insert_row(con, "evidence_items", {
            "id": "okf-evidence-1",
            "claim_pk": "okf-claim-1",
            "evidence_id": "E-OKF-1",
            "document_chunk_id": chunk_id,
            "extraction_type": "sourced_fact",
            "lineage_class": "L1",
            "confidence": "High",
        })
        con.commit()
    finally:
        con.close()

    revised = list(RATING_PDF_PAGES)
    revised[1] = revised[1] + "\nCorrected figures follow."
    second = _ingest(client, issuer_id, text_pdf(revised), "r2.pdf")
    assert second.status_code == 200, second.text
    assert second.json()["superseded_document_id"] == first_doc

    con = sqlite3.connect(_DB_PATH, timeout=30)
    try:
        survives = con.execute(
            "SELECT COUNT(*) FROM documents WHERE id = ?", (first_doc,)
        ).fetchone()[0]
        chunk_survives = con.execute(
            "SELECT COUNT(*) FROM document_chunks WHERE id = ?", (chunk_id,)
        ).fetchone()[0]
        con.execute("DELETE FROM evidence_items WHERE id = 'okf-evidence-1'")
        con.execute("DELETE FROM claims WHERE id = 'okf-claim-1'")
        con.commit()
    finally:
        con.close()
    assert survives == 1, "a cited prior document must be retained as a shadow"
    assert chunk_survives == 1, "the cited chunk must remain resolvable"


def test_okf_empty_pdf_still_vaults_and_warns(client, issuer_id, vault):
    r = _ingest(
        client, issuer_id,
        b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF",
        "scanned.pdf",
    )
    assert r.status_code == 200, r.text
    body = r.json()

    import ingest

    assert body["extraction_status"] == "empty"
    assert body["chunk_count"] == 0
    assert body["warning"] == ingest.NO_CHUNKS_WARNING
    # The note is still written — a flagged artifact, not a silent drop.
    assert (vault / body["note_rel_path"]).is_file()


# ── Stage 6: the Sources/ exclusion ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_okf_sources_tree_is_excluded_from_the_memo_scan(tmp_path):
    """An OKF note under Sources/ must never be swept in as an analyst memo."""
    import vault_export

    (tmp_path / "Sources").mkdir()
    (tmp_path / "Sources" / "Atlas - rating-report - Moodys - 2025-11-03.md").write_text(
        "---\ntype: \"source-document\"\n---\n# Atlas\n", encoding="utf-8"
    )
    (tmp_path / "Analyst Memo.md").write_text("# A real memo\n", encoding="utf-8")

    found, _, count = await __import__("asyncio").to_thread(
        vault_export._scan_memo_files, tmp_path
    )
    names = {p.name for p in found}

    assert "Analyst Memo.md" in names
    assert not any(n.startswith("Atlas - rating-report") for n in names)
    assert count == 1


def test_okf_offering_memo_counts_toward_cp0_coverage():
    """readiness._categorize must map the OKF `offering-memo` doc_type onto the
    offering coverage category (its doc_type contains no 'prospectus')."""
    from database import Document
    from engine.readiness import _categorize

    doc = Document(doc_type="offering-memo", file_name="deal.pdf", storage_key="k")
    assert "offering" in _categorize(doc)
