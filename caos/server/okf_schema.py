"""OKF seam models — the only contracts between the ingestion stages.

Pure data: no I/O, no DB, no PDF library. Each model is the sole payload crossing
one seam of the PDF → OKF pipeline (see docs/PDF_INGESTION_OKF_BLUEPRINT.md):

    PDF bytes → ExtractedDocument → StructuredReport → {OKFNote | OKFChunk[]}
             → OkfIngestResult

``StructuredReport`` fans out to both the note renderer (Stage 3) and the
section-aware chunker (Stage 4); both run inside the Stage-5 write transaction
because the note needs the ``document_id`` that the insert mints.

Two vocabularies are load-bearing and must not drift:

  - ``DocType`` — stored verbatim in BOTH ``Document.doc_type`` and the note's
    ``doc_type`` frontmatter, so a DB filter and a Dataview query agree.
  - ``extraction_status`` (``full`` | ``partial`` | ``empty``) — the degradation
    signal. A reader must never treat ``empty`` as success, so it is a required
    frontmatter key that can never render blank (``_yaml_block`` drops ``None``
    and ``""``).
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

# Schema-evolution gate for programmatic readers of the note frontmatter, and the
# ``transform_version`` stamped on every lineage edge this pipeline writes.
OKF_VERSION = "okf/1.0"


class DocType(str, Enum):
    """The five inbound source families. ``SOURCE_DOCUMENT`` is the fallback when
    classification is uncertain — classification never raises."""

    RATING_REPORT = "rating-report"
    OFFERING_MEMO = "offering-memo"
    SPONSOR_DECK = "sponsor-deck"
    LENDER_UPDATE = "lender-update"
    SOURCE_DOCUMENT = "source-document"


# Human labels for the note H1. Load-bearing: Stage 3 renders the H1 from
# ``StructuredReport.title``, which is built from this map — there is no ad-hoc H1.
_DOCTYPE_LABEL = {
    DocType.RATING_REPORT: "Rating report",
    DocType.OFFERING_MEMO: "Offering memorandum",
    DocType.SPONSOR_DECK: "Sponsor presentation",
    DocType.LENDER_UPDATE: "Lender update",
    DocType.SOURCE_DOCUMENT: "Source document",
}

# ── Stage 1: extraction ──────────────────────────────────────────────────────


class PageText(BaseModel):
    page: int  # 1-based; the physical PDF page
    text: str  # per-page extracted text ("" if a page yields none)


class ExtractedDocument(BaseModel):
    """Fully materialized before any DB transaction opens, so a slow parser (a
    300-second OCR) never holds a write open."""

    storage_key: str  # ingest.store() return: "{uuid4hex}/{safe_name}"
    file_name: str
    content_sha256: str  # sha256(raw bytes) — supersede identity + dedup
    full_text: str  # canonical text from ingest.extract_pdf_text
    # From the UNCONDITIONAL ingest.extract_pdf_pages (always pypdf); [] if pypdf
    # fails. Deliberately independent of full_text's method so a markitdown blob
    # and a pypdf page map can coexist without desyncing.
    pages: list[PageText] = Field(default_factory=list)
    method: str  # best-effort label only — NOT load-bearing
    # Authoritative OCR flag, straight from ingest.extract_pdf_text's second
    # return value. Unlike `method` this IS load-bearing: it sets DocumentChunk.prov
    # so a lower-fidelity OCR read stays discountable downstream and is never
    # silently indistinguishable from a native text-layer extraction.
    used_ocr: bool = False
    has_page_map: bool  # == (len(pages) > 0); never derived from `method`
    page_count: int  # len(pages), else 0
    extraction_status: str  # "full" | "partial" | "empty"
    warnings: list[str] = Field(default_factory=list)


# ── Stage 2: structuring ─────────────────────────────────────────────────────


# What accounting basis a figure is stated on. This is the single most
# consequential tag on a credit platform: a sponsor deck's "4.2x pro-forma" and a
# filing's reported "6.8x" are different claims about the same company, and the
# GAP between them is itself the credit signal. A marketed figure that silently
# entered the reported foundation would understate leverage — so marketed bases
# route to CP-1's adjusted layer + CP-4C and never to reported CP-1.
FACT_BASES = frozenset({"sponsor-adjusted", "management-pro-forma", "reported"})

# Which extractor produced a report. Load-bearing for provenance, not cosmetic.
EXTRACTORS = frozenset({"deterministic", "vision"})


class KeyFact(BaseModel):
    """One typed fact pulled from the source.

    ``value`` is stored **verbatim** — never re-formatted ("4.25x" must not become
    "4.3x"). The downstream grounding gate compares formatting-tolerantly, so
    normalizing here would desync it.
    """

    label: str  # "Corporate Family Rating", "1L Term Loan", "Net leverage"
    value: str  # verbatim as extracted
    unit: Optional[str] = None  # "x", "%", "$mm", "Moody's", ...
    kind: str  # "rating" | "tranche" | "maturity" | "leverage" | "other"
    page: Optional[int] = None  # source page when has_page_map, else None
    source_span: Optional[str] = None  # the line it came from (audit; not chunk text)
    # One of FACT_BASES. None on the deterministic lane (the basis is whatever the
    # document states); always set on the vision lane, where the document class is
    # promotional and the distinction decides downstream routing.
    basis: Optional[str] = None
    # One of engine.schemas.CONFIDENCE. None on the deterministic lane; a vision
    # read is capped at "Medium" — it is never committee-ready the way an XBRL
    # fact is, and must stay discountable.
    confidence: Optional[str] = None


class DocSection(BaseModel):
    title: str  # heading text; source-derived (never synthetic)
    level: int  # 1..3
    text: str  # section body prose; NO synthetic page/breadcrumb numerals
    page_start: Optional[int] = None
    page_end: Optional[int] = None


class StructuredReport(BaseModel):
    issuer_id: str  # bound at intake; mirrors Document.issuer_id
    doc_type: DocType
    source: Optional[str] = None  # issuing entity: "Moody's", "S&P", sponsor name
    report_date: Optional[str] = None  # ISO "YYYY-MM-DD" when found
    fiscal_period: Optional[str] = None  # canonical home is Document.fiscal_period
    title: str  # the note H1 (see _DOCTYPE_LABEL)
    sections: list[DocSection] = Field(default_factory=list)
    key_facts: list[KeyFact] = Field(default_factory=list)
    # Populated only for rating-report. These MIRROR Issuer.rating_moody/rating_sp
    # for display; the note surfaces them and never writes back (no two-way sync).
    rating_moody: Optional[str] = None
    rating_sp: Optional[str] = None
    method: str  # carried through from ExtractedDocument
    page_count: int  # carried through from ExtractedDocument
    extraction_status: str  # carried through from ExtractedDocument
    # One of EXTRACTORS. "vision" means a multimodal model read the pages; the
    # note and every fact stay tagged so the read is discountable downstream.
    extractor: str = "deterministic"
    warnings: list[str] = Field(default_factory=list)


class StructuringOverrides(BaseModel):
    """Analyst-supplied intake overrides; each wins over the heuristic."""

    doc_type: Optional[DocType] = None
    source: Optional[str] = None
    report_date: Optional[str] = None
    fiscal_period: Optional[str] = None


# ── Stage 3: OKF note mapping ────────────────────────────────────────────────


class IssuerRef(BaseModel):
    """The issuer fields the note needs, lifted off the ORM row so okf_notes never
    imports `database`."""

    id: str
    name: str
    ticker: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None


class OKFNote(BaseModel):
    note_title: str  # _title()-sanitized; == the Sources/ filename stem
    note_rel_path: str  # "Sources/<note_title>.md" (vault-relative, UNIQUE)
    frontmatter: dict  # flat scalars only; Appendix A is authoritative
    body: str  # H1 + link line + Key facts + sections + Extraction notes
    wikilinks: list[str]  # raw graph-edge names (not link targets)
    contains_source_text: bool  # True for this family


# ── Stage 4: chunking ────────────────────────────────────────────────────────


class OKFChunk(BaseModel):
    """One section-aligned chunk destined for ``document_chunks``.

    ``text`` carries a **word-only** breadcrumb: no page integers, no year, no
    report_date. ``engine.grounding.all_grounded`` builds its allowed numeric pool
    by scanning cited-chunk text, so any synthetic numeral here would widen that
    pool. Page anchors therefore live only in ``page_start``/``page_end`` metadata
    and in the rendered note file.
    """

    seq: int  # 0-based order across the whole document
    text: str  # breadcrumb(word-only) + section prose
    chunk_hash: str  # sha256(text) — the house recipe, matches _vault_document
    section_title: str  # provenance metadata; NOT re-injected into text
    page_start: Optional[int] = None  # metadata + note file only; NEVER in text
    page_end: Optional[int] = None


# ── Stage 5: orchestrator result / route response ────────────────────────────


class OkfIngestResult(BaseModel):
    document_id: str
    note_rel_path: str
    chunk_count: int
    extraction_status: str  # full | partial | empty
    superseded_document_id: Optional[str] = None  # set when a prior doc was replaced
    warning: Optional[str] = None  # e.g. ingest.NO_CHUNKS_WARNING on an empty PDF


class OkfIngestResponse(OkfIngestResult):
    """Route response model; identical shape today, separate so the HTTP contract
    can diverge from the orchestrator return without touching callers."""
