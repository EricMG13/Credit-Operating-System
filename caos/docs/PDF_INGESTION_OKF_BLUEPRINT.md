# PDF → OKF Ingestion Pipeline — Architectural Blueprint (for Opus 4.8)

> **Deliverable status:** design blueprint. Opus 4.8 executes it top-to-bottom.
> **Author:** Lead Data Architect (Fable 5). **Date grounded:** 2026-07-08 against
> `caos/server/` at branch `feat/command-center-layout-and-sector-rv-cleanup`.
> Companion working notes: [.pdf-ingestion-notes.md](.pdf-ingestion-notes.md).
> Red-team record: [.agent-reviews/redteam.md](../../.agent-reviews/redteam.md)
> rows `RT-2026-07-08-01..12`.

---

## Outcome

**Build an inbound pipeline that turns an unstructured PDF credit report into (a)
`document_chunks` rows on the *existing* retrieval lane and (b) one Obsidian
"Source note" per document — a structured, machine-queryable projection of that
PDF into the Open Knowledge Format (OKF).** After this ships, an analyst (or the
CAOS multi-agent engine) can drop a rating-agency report, offering memorandum,
sponsor deck, or lender update into CAOS and have every financial fact in it be
**retrievable the moment it is written** — lexically on commit (Postgres `tsv`
GIN / SQLite Okapi), semantically once the background embed lands — filterable by
issuer, document type, and period *before* any semantic scan, and citable back to
a `document_chunk_id` — with the source **page anchor carried on the OKF note**
(keyed by `document_id`), since the legacy `document_chunks` table has no page
column and §5 forbids altering it. Retrieval latency and query fidelity
improve for one concrete reason: the pipeline lands chunks exactly where
`retrieval.retrieve()` / `retrieve_corpus()` already read, with clean
section-aligned boundaries so an embedding maps to one coherent financial idea,
and it adds **zero** new retrieval infrastructure to fork or keep in sync.

**Why this shape.** Two hard facts of the existing code force the architecture and
you must not fight them:

1. **The retrieval stack hard-filters on one embedding model.** Every vector query
   in `retrieval.py` joins `document_chunk_embeddings` on `chunk_hash` and filters
   `DocumentChunkEmbedding.model == settings.embedding_model`
   (`"text-embedding-004"`, `SafeVector(768)`). A chunk written under any other
   model — or with no embedding row — is **vector-invisible** (BM25 still finds
   it). So the *only* zero-fork way to be semantically retrievable is to embed on
   the existing engine lane. We reuse `engine.embeddings.embed_chunks_for_document`
   verbatim; we do **not** stand up a second embedder on the machine-RAG corpus.
2. **The canonical facts live in the engine DB, and the vault is a one-way
   projection.** `vault_export.py` already treats the Obsidian vault as a
   *derived, write-only mirror* (`OBSIDIAN_DATABANK.md`). OKF extends that posture
   inbound: the OKF note is regenerable from the stored source blob, keyed to its
   `document_id`, and never hand-edited into a second source of truth.

**Scope guardrails (from the brief §5, restated so every stage inherits them).**
No file under `caos/frontend/` is touched. No column, index, or migration of a
legacy table (`documents`, `document_chunks`, `document_chunk_embeddings`,
`evidence_items`, `metric_facts`, run tables) is altered — the pipeline is
*additive*: it inserts (and, on supersede, deletes) rows in `document_chunks`
through existing code paths, never altering their schema. The
vault-file embedding lane stays local (no Pinecone/Neo4j/LangChain/hosted vector
DB; the engine's pre-existing Gemini lane is a separate, already-shipped path we
reuse, not a new vault egress). No two-way sync. This document writes no
implementation code; Appendix B tells Opus how to build it.

---

## The seam contracts at a glance

Typed payloads cross the pipeline; each is the *only* contract between its
modules. Defined in full in `okf_schema.py` (Stage 0) and reproduced at the stage
that emits them. The pipeline is a linear chain until Stage 2, then a small DAG:
`StructuredReport` **fans out** to both Stage 3 (render the note) and Stage 4
(chunk the sections) — both consume `StructuredReport`, and both run inside the
Stage 5 transaction (render needs the `document_id` the Stage 5 insert mints):

```
PDF bytes
  │  Stage 1 (okf_ingest.extract)          — reuses ingest.extract_pdf_text/store; adds extract_pdf_pages
  ▼
ExtractedDocument  { storage_key, file_name, content_sha256, full_text, pages[], method, has_page_map, page_count, extraction_status, warnings }
  │  Stage 2 (okf_structure.structure)     — deterministic classify + segment + extract
  ▼
StructuredReport   { issuer_id, doc_type, source?, report_date?, fiscal_period?, title, sections[], key_facts[], method, page_count, extraction_status, warnings }
  ├─────────────────────────────┬──────────────────────────────────────────────
  │  Stage 3 (render_okf_note)   │  Stage 4 (chunk_report)   — reuses ingest.chunk_text
  ▼  reuses _yaml_block/_title   ▼
OKFNote { note_title, note_rel_path, frontmatter{}, body, wikilinks[], contains_source_text }
                                  OKFChunk[] { seq, text, chunk_hash, section_title, page_start?, page_end? }
  └─────────────────────────────┴──────────────────────────────────────────────
  │  Stage 5 (okf_ingest.persist)          — Document + DocumentChunk + LineageEdge + okf_notes; background note-write + embed
  ▼                                          (render_okf_note runs HERE, after db.flush() yields document_id)
document_chunks (retrievable on commit)  +  {vault}/Sources/<note>.md  +  okf_notes registry row
  │  Stage 6
  ▼
retrieval.retrieve / retrieve_corpus / nlquery / lineage  — unchanged, reads OKF chunks natively
```

---

## Stage 0 — Module map & new file layout

- **Goal (1 sentence):** name every new file, its single responsibility, and
  whether it reuses or adds code — so Opus builds in dependency order with no
  legacy edit beyond three surgical additive touches.
- **New modules / interfaces (all under `caos/server/`, flat imports):**

| File | New/Edit | Responsibility | Imports / reuses |
|---|---|---|---|
| `okf_schema.py` | **new** | The 7 pydantic seam models + `DocType` enum + `OKF_VERSION`. Pure data; no I/O. | `pydantic` |
| `okf_structure.py` | **new** | Deterministic `classify()`, `segment()`, `extract_key_facts()` → `StructuredReport`. No DB, no PDF-lib. | `okf_schema` |
| `okf_notes.py` | **new** | `render_okf_note()`, `okf_note_title()`, `write_okf_note()`. OKF↔Obsidian mapping only. | `okf_schema`, `vault_export` (`_yaml_block`, `_title`, `autolink_issuers`) |
| `okf_ingest.py` | **new** | Orchestrator: `extract()`, `chunk_report()`, `persist()`, `ingest_pdf()`. Owns the seam + the supersede transaction. | `ingest`, `okf_structure`, `okf_notes`, `database`, `engine.embeddings` |
| `routes/okf.py` | **new** | `POST /api/okf/ingest`, `GET /api/okf/documents`. Security ladder + dispatch only. | `ingest`, `avscan`, `rate_limit`, `identity`, `database`, `okf_ingest` |
| `migrations/versions/0034_okf_notes.py` | **new** | Additive `okf_notes` table. Chains `down_revision="0033"`. | `alembic`, `sqlalchemy` |
| `database.py` | **edit (additive)** | Add the `OkfNote` ORM model + include it in `erase_analyst_data`'s scope **only if** it stamped `caller.email` (it does not — see Stage 5). | — |
| `engine/readiness.py` | **edit (1 line)** | Extend `_CATEGORIES["offering"]` doc_type tuple with `"offering"` so `offering-memo` counts toward CP-0 coverage. | — |
| `vault_export.py` | **edit (1 line)** | Add `"Sources"` to the `_scan_memo_files` prune set so OKF notes are not swept into `AnalystLink`. | — |
| `main.py` | **edit (2 lines)** | `from routes import ..., okf`; `app.include_router(okf.router, prefix="/api/okf", tags=["okf"])`. | — |
| `docs/OBSIDIAN_DATABANK.md` | **edit (additive)** | Document the inbound `Sources/` family + the redaction-posture change (Stage 3). | — |
| `tests/server/test_okf_*.py` | **new** | Per-stage unit + one round-trip integration test. | `pytest` |

- **Reuse-vs-invent ledger (call, do not reimplement):** extraction
  (`ingest.read_capped`, `ingest.sniff_pdf`, `ingest.extract_pdf_text`,
  `ingest.store`), chunking (`ingest.chunk_text`), embedding
  (`engine.embeddings.embed_chunks_for_document`), AV
  (`avscan.scan`), auth (`identity.get_identity` → `CallerIdentity`), rate limiting
  (`rate_limit.hit`), YAML/link rendering (`vault_export._yaml_block`,
  `_title`, `autolink_issuers`), lineage rows (`database.LineageEdge`). The only
  genuinely new logic is **structuring** (`okf_structure.py`) and the **OKF
  mapping + supersede transaction** (`okf_notes.py`, `okf_ingest.py`).
- **Low-latency-RAG payoff:** one place to see that the pipeline adds a thin
  structuring/mapping layer on top of the proven ingest+retrieval lanes — nothing
  in the hot path is reinvented, so there is nothing new to fork, cache, or keep
  in sync.

> Checkpoint (Stage 0): 19 pass, 0 revised — all 5 new files + migration 0034 confirmed absent, all reused functions/paths verified against real code; `okf_schema` model inventory corrected (nine seam/support + two result models).

---

## Stage 1 — Extraction  (PDF bytes → `ExtractedDocument`)

- **Goal (1 sentence):** turn validated PDF bytes into a fully-materialized
  `ExtractedDocument` (per-page text + concatenated full text + an honest
  extraction-status) **before** any DB transaction opens, so a slow or failing
  parser never holds a write open.
- **New module / interface:** `okf_ingest.py` → `async def extract(content: bytes,
  file_name: str) -> ExtractedDocument`. Reuses `ingest.extract_pdf_text`
  (markitdown → pypdf → `ocrmypdf` sidecar), `ingest.store`, and a thin new
  `ingest.extract_pdf_pages` (Stage-1 addition, below). Never imports `database`.
- **Input schema → Output schema:** `bytes` → `ExtractedDocument`.

```python
# okf_schema.py
from pydantic import BaseModel, Field
from typing import Optional

class PageText(BaseModel):
    page: int                       # 1-based; the physical PDF page
    text: str                       # per-page extracted text ("" if a page yields none)

class ExtractedDocument(BaseModel):
    storage_key: str                # ingest.store() return; "{uuid4hex}/{safe_name}" under CAOS_STORAGE_DIR
    file_name: str
    content_sha256: str             # sha256(raw bytes) — supersede identity + dedup; computed at intake
    full_text: str                  # the canonical text extract_pdf_text returns (markitdown|pypdf|ocr)
    pages: list[PageText] = Field(default_factory=list)  # from extract_pdf_pages (pypdf, UNCONDITIONAL); [] only if pypdf fails
    method: str                     # best-effort label ("markitdown"|"pypdf"|"ocr"|"none") — NOT load-bearing (see below)
    has_page_map: bool              # == (len(pages) > 0); independent of `method`
    page_count: int                 # len(pages), else 0
    extraction_status: str          # "full" | "partial" | "empty"
    warnings: list[str] = Field(default_factory=list)
```

- **Boundary & routing:** the *only* thing that crosses into Stage 2 is
  `ExtractedDocument`. Two independent extractions run, so a reflowing text
  extractor never invalidates the page map:
  - **`full_text`** is the canonical text from `ingest.extract_pdf_text`
    (markitdown → pypdf → `ocrmypdf`, in that existing order). It drives
    classification and the note body.
  - **`pages`** is a *separate*, unconditional `ingest.extract_pdf_pages(content)`
    call (always pypdf) whose only job is to supply a physical page map for
    best-effort citation anchors. `has_page_map = len(pages) > 0`.
  - `method` is a **best-effort provenance label only** — it is *not* used to
    decide `has_page_map` (that is purely `len(pages) > 0`), which removes the
    "markitdown blob vs pypdf pages disagree" desync: anchoring in Stage 2 locates
    a section's text within `pages` by substring and degrades to `None` when it
    can't, so a markitdown `full_text` and a pypdf page map coexist safely.
  - **Degradation:** `extraction_status = "empty"` when `full_text.strip()` is
    empty (scanned/encrypted; append `ingest.NO_CHUNKS_WARNING`); `"partial"` when
    there is text but `not has_page_map` (page anchors unavailable, e.g. pypdf
    failed while markitdown/ocr yielded text); `"full"` otherwise. **The note is
    always written** (never a silent drop).
- **Opus instruction (technical):**
  1. In `ingest.py` add `def extract_pdf_pages(content: bytes) -> list[tuple[int,
     str]]`: build a `pypdf` reader the same way `extract_pdf_text` does
     (`PdfReader(io.BytesIO(content))`), return `[(i+1, page.extract_text() or "")
     for i, page in enumerate(reader.pages)]`; on any exception return `[]`.
     Additive, same lib, no signature change to existing functions.
  2. In `okf_ingest.extract`, off-thread both extractions (CPU-bound; `to_thread`
     is the house convention): `full_text = await
     asyncio.to_thread(ingest.extract_pdf_text, content, file_name)` and `pages =
     await asyncio.to_thread(ingest.extract_pdf_pages, content)`. Set
     `has_page_map = len(pages) > 0` and `page_count = len(pages)`. (When markitdown
     is the text method — the realdoc-pilot deploy wires it — pypdf still runs
     *once*, inside `extract_pdf_pages`; when markitdown is off, pypdf runs in both
     — an accepted, bounded, off-thread double-pass. Do not micro-optimize it away
     by coupling the two.)
  3. `storage_key = await asyncio.to_thread(ingest.store, content, file_name)`;
     `content_sha256 = hashlib.sha256(content).hexdigest()`.
  4. Derive `method` (best-effort: markitdown-configured-and-text → "markitdown";
     else text-and-pages → "pypdf"; else text-only → "ocr"; else "none") and
     `extraction_status` per the ladder above. **Import nothing from `database`**
     in this function.
- **Low-latency-RAG payoff:** extraction is fully materialized off-thread before
  any **write** is issued, so a 300-second OCR never holds a write transaction open
  (the seam that would otherwise couple a slow parser to a transactional write);
  the page map it produces is what lets a later citation resolve to an exact page
  via the OKF note.

> Checkpoint (Stage 1): pass with 1 MED + 2 LOW revised — `method`/`has_page_map` no longer derived from the bare-str `extract_pdf_text` return: `pages` now comes from an unconditional `extract_pdf_pages` (pypdf), `has_page_map = len(pages) > 0`, `method` downgraded to a non-load-bearing label; `content_sha256` added; payoff reworded to "never holds a *write* open"; the double pypdf pass is documented as accepted.

---

## Stage 2 — Structuring  (`ExtractedDocument` → `StructuredReport`)

- **Goal (1 sentence):** deterministically classify the document, segment it into
  page-anchored sections, and pull typed key facts — turning opaque text into the
  structured record the OKF note and the section-aware chunker consume.
- **New module / interface:** `okf_structure.py` → `def structure(doc:
  ExtractedDocument, issuer_id: str, overrides: StructuringOverrides) ->
  StructuredReport`, composed of `classify()`, `segment()`,
  `extract_key_facts()`. Pure functions; no DB, no PDF library; deterministic
  (no LLM in v1).
- **Input schema → Output schema:** `ExtractedDocument` → `StructuredReport`.

```python
# okf_schema.py
from enum import Enum

class DocType(str, Enum):
    RATING_REPORT   = "rating-report"
    OFFERING_MEMO   = "offering-memo"
    SPONSOR_DECK    = "sponsor-deck"
    LENDER_UPDATE   = "lender-update"
    SOURCE_DOCUMENT = "source-document"   # fallback when classification is uncertain

class KeyFact(BaseModel):
    label: str                      # e.g. "Corporate Family Rating", "1L Term Loan", "Net leverage"
    value: str                      # verbatim as extracted; never re-formatted (grounding-safe)
    unit: Optional[str] = None      # "x", "%", "$mm", "Moody's", ...
    kind: str                       # "rating" | "tranche" | "maturity" | "leverage" | "other"
    page: Optional[int] = None      # source page when has_page_map, else None
    source_span: Optional[str] = None  # the sentence/line it came from (for audit; not chunk text)

class DocSection(BaseModel):
    title: str                      # heading text; source-derived (never synthetic)
    level: int                      # 1..3
    text: str                       # section body prose; NO synthetic page/breadcrumb numerals
    page_start: Optional[int] = None
    page_end: Optional[int] = None

class StructuredReport(BaseModel):
    issuer_id: str                  # bound at intake; mirrors Document.issuer_id (FK to issuers.id)
    doc_type: DocType
    source: Optional[str] = None    # issuing entity: "Moody's", "S&P", "Barclays", sponsor name
    report_date: Optional[str] = None    # ISO "YYYY-MM-DD" if found on the document
    fiscal_period: Optional[str] = None  # "FY2025" | "Q3-2025"; canonical home is Document.fiscal_period
    title: str                      # human title for the note H1 (built by structure(); see instruction)
    sections: list[DocSection] = Field(default_factory=list)
    key_facts: list[KeyFact] = Field(default_factory=list)
    rating_moody: Optional[str] = None   # populated only for rating-report; mirrors Issuer.rating_moody
    rating_sp: Optional[str] = None
    method: str                     # carried through from ExtractedDocument (for the note "Extraction notes")
    page_count: int                 # carried through from ExtractedDocument (for frontmatter page_count)
    extraction_status: str          # carried through from ExtractedDocument
    warnings: list[str] = Field(default_factory=list)

class StructuringOverrides(BaseModel):
    doc_type: Optional[DocType] = None      # analyst may force the type at intake
    source: Optional[str] = None
    report_date: Optional[str] = None
    fiscal_period: Optional[str] = None
```

- **Boundary & routing (classification is the router):** `classify()` inspects
  the first ~2 pages of `full_text` for deterministic markers and returns a
  `DocType`:
  - `rating-report` ← agency mastheads ("Moody's", "S&P Global Ratings", "Fitch
    Ratings", "Corporate Family Rating", "Issuer Credit Rating").
  - `offering-memo` ← "OFFERING MEMORANDUM" / "OFFERING CIRCULAR" / "CONFIDENTIAL
    INFORMATION MEMORANDUM".
  - `sponsor-deck` ← "Lender Presentation" / "Management Presentation" +
    sponsor markers.
  - `lender-update` ← "Quarterly Lender Update" / "Lender Call" / "Compliance
    Certificate".
  - none match → `source-document` (fallback; never crashes).
  An `overrides.doc_type` supplied at intake wins over the heuristic. The chosen
  `DocType` selects which `extract_key_facts` extractors run (ratings extractor
  for `rating-report`, tranche/maturity for `offering-memo`, etc.); all extractors
  are best-effort and additive — an extractor that finds nothing contributes an
  empty list, never an error. **Degradation:** if `extraction_status == "empty"`,
  `structure()` returns a well-formed `StructuredReport` with one synthetic
  section (`title="Document"`, `text=""`) and `key_facts=[]` — the note is still
  renderable.
- **Opus instruction (technical):**
  1. **Segment on `full_text`** (the canonical text) by splitting on heading-shaped
     lines (ALL-CAPS lines, numbered headings `^\d+(\.\d+)*\s+\w`, or markdown
     `^#{1,3}\s`); cap section count; if no heading is found emit a single section
     holding the whole text. Then assign **best-effort page anchors**: when
     `doc.has_page_map`, for each section locate its opening ~60 chars as a
     substring within `doc.pages` (normalize whitespace) → set
     `page_start`/`page_end` to the matching page span; on no match leave both
     `None`. This keeps `full_text` canonical even when it came from markitdown and
     the page map from pypdf — the anchor is advisory, never fabricated.
  2. `extract_key_facts()`: deterministic regex/keyword extractors per `kind`.
     Store `value` **verbatim** (never normalize "4.25x"→"4.3x"; the grounding
     gate compares formatting-tolerantly downstream, and re-formatting here would
     desync it). Populate `page` by the same best-effort location (else `None`).
  3. Populate `rating_moody`/`rating_sp` from the ratings extractor when
     `doc_type == rating-report`; leave `None` otherwise. These mirror the
     `Issuer.rating_moody`/`rating_sp` columns the pricing-sheet lane already
     writes — the OKF note **surfaces** them, it does **not** write them back to
     the `issuers` table (no two-way sync).
  4. **Carry through + title:** copy `method`, `page_count`, `extraction_status`,
     and `warnings` from the input `ExtractedDocument` onto the `StructuredReport`
     (exactly as `extraction_status` already is). Set `title` to the note's H1
     text — `f"{issuer.name} — {_DOCTYPE_LABEL[doc_type]} ({report_date or
     fiscal_period or 'undated'})"`, where `_DOCTYPE_LABEL` maps each enum value to
     a human label (`rating-report → "Rating report"`, etc.). Stage 3 renders the
     H1 from `report.title`, so the field is load-bearing (no ad-hoc H1).
  5. **Deferred LLM lane (do not build now, name it):** an optional enrichment
     that re-segments or types low-confidence documents belongs behind one of the
     three house fault-isolation patterns (Blocked-gate / `return_exceptions` /
     deterministic fallback). Its fallback is exactly this deterministic
     `structure()`. Leave a single documented extension point; ship deterministic.
- **Low-latency-RAG payoff:** the `DocType`, `report_date`, and `fiscal_period`
  produced here become metadata an agent filters on *before* paying for a semantic
  scan; section boundaries produced here are what make each later chunk one
  coherent idea instead of a window straddling two.

> Checkpoint (Stage 2): pass with 1 MED (shared with Stage 3) + 1 LOW revised — `method`/`page_count` now carried through `StructuredReport` (so Stage 3 can render them); `title` made load-bearing via a `_DOCTYPE_LABEL` map; segmentation now runs on canonical `full_text` with best-effort substring page-anchoring into `pages` (never fabricated).

---

## Stage 3 — OKF mapping  (`StructuredReport` → `OKFNote`)

- **Goal (1 sentence):** map the structured record into a valid Obsidian note — a
  fourth note family, `type: "source-document"` — whose flat-scalar YAML
  frontmatter is a machine-queryable metadata layer and whose body carries the
  full source text under page-anchored headings with `[[wikilink]]` graph edges.
- **New module / interface:** `okf_notes.py` → `def render_okf_note(report:
  StructuredReport, issuer: IssuerRef, document_id: str, storage_key: str) ->
  OKFNote`, `def okf_note_title(report, issuer) -> str`, `async def
  write_okf_note(vault_dir: str, note: OKFNote) -> str`. Imports
  `vault_export._yaml_block`, `vault_export._title`, `vault_export.autolink_issuers`.
- **Input schema → Output schema:** `StructuredReport` (+ issuer name/ticker +
  the `document_id` assigned in Stage 5) → `OKFNote`. **Note the ordering
  subtlety:** `document_id` is a canonical `Document.id` that only exists after the
  Stage-5 insert, so `render_okf_note` is invoked *inside* Stage 5 after
  `db.flush()`, not between Stage 2 and Stage 5. The schema and mapping logic are
  specified here because they are OKF-mapping concerns.

```python
# okf_schema.py
OKF_VERSION = "okf/1.0"

class IssuerRef(BaseModel):
    id: str
    name: str
    ticker: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None

class OKFNote(BaseModel):
    note_title: str                 # _title()-sanitized; == the Sources/ filename stem
    note_rel_path: str              # "Sources/<note_title>.md" (vault-relative, UNIQUE)
    frontmatter: dict               # flat scalars only (str/int/float/bool); Appendix A is authoritative
    body: str                       # H1 + link line + ## Key facts + per-section text + ## Extraction notes
    wikilinks: list[str]            # ["Issuer Name", "Industry", "Country", "Moody's"] — graph edges
    contains_source_text: bool      # True for this family (drives the sync-exclusion frontmatter flag)
```

- **Boundary & routing:** `render_okf_note` is pure (no I/O); `write_okf_note`
  does the disk write and is scheduled as a post-commit background task (Stage 5).
  Placement is fixed: **only** `{vault_export_dir}/Sources/`. The inbound pipeline
  never writes `Runs/`, `Issuers/`, or `Analyst-Memos/`. The `[[Issuer]]` backlink
  supplies the graph edge to the issuer hub **even if the hub note doesn't exist
  yet** — exactly the memo precedent; we do not create or edit hub notes.
- **Frontmatter (authoritative table in Appendix A).** Built via
  `vault_export._yaml_block`, which emits `key: <json.dumps(value)>` and **drops
  any key whose value is `None` or `""`**. Consequence you must respect:
  **`extraction_status`, `contains_source_text`, `okf_version`, and `type` must
  never be empty** — they are required signals; an empty string would silently
  vanish from the frontmatter. `contains_source_text` is a real `bool` → renders
  as unquoted YAML `true` (valid Obsidian/Dataview). **Caution:** the key name
  `contains_source_text` contains the substring `source_text`, which is a
  `vault_export._RAW_CONTENT_MARKER` — so an OKF note's frontmatter must be
  rendered **only** through `_yaml_block`, **never** through `_output_md`/`_redact`
  (which would blank the flag's value). `render_okf_note` uses `_yaml_block`
  directly, so this holds; do not route OKF notes through the outbound redaction
  path.
- **Body layout** (mirrors `render_run_spoke`'s link-line idiom for shared
  vocabulary; the H1 is `report.title`, the link targets are `_title()`-sanitized
  so they resolve to the same hub/sector/country nodes the existing families use):

```markdown
---
type: "source-document"
issuer: "Acme Bidco"
...frontmatter (Appendix A)...
---
# Acme Bidco — Rating report (2025-11-03)

Issuer: [[Acme Bidco]] · Industry: [[Software]] · Country: [[US]] · Source: [[Moody's]]

## Key facts
- **Corporate Family Rating:** B2 (Moody's)
- **1L Term Loan:** $650mm  (p. 4)
- **Net leverage:** 5.8x  (p. 7)

## Rating Rationale (p. 3–5)
<full section text — no synthetic numerals injected>

## Extraction notes
- status: full        (report.extraction_status)
- method: pypdf       (report.method)
- pages: 12           (report.page_count)
- document_id: 6f2a…  (canonical; also in frontmatter)
```

  The `(p. 4)` anchors appear **only in the note body for human/agent reading**;
  they are *not* propagated into the chunk text (Stage 4) — see the grounding-pool
  rule there. `status`/`method`/`pages` read from `report.extraction_status` /
  `report.method` / `report.page_count` (carried through in Stage 2).
- **Redaction posture (stated, per brief §2).** The three *outbound* note families
  (`credit-run`, `issuer`, `analyst-memo`) keep `vault_export._redact` untouched —
  engine output must never leak raw source text off-machine. The **inbound
  `source-document` family carries extracted source text by design** (it *is* the
  document): `contains_source_text: true` in frontmatter flags every such note so
  sync tooling / local-embed plugins can select or exclude the `Sources/` tree.
  This is a deliberate posture change from "the vault is safe to sync
  unconditionally" to "the `Sources/` subtree holds source text and is a
  data-handling decision" — and it is written into `OBSIDIAN_DATABANK.md` as part
  of this work (Stage 0 edit).
- **Opus instruction (technical):** build the H1 from `report.title`. Build
  `frontmatter` as an ordered dict exactly per Appendix A (skip optional keys that
  are `None`); render the link line with **`_title()`-sanitized** targets —
  `Issuer: [[{_title(issuer.name)}]] · Industry: [[{_title(industry)}]] · …` —
  matching `render_run_spoke`/`render_issuer_hub` so an issuer/sector/country with
  an illegal char still resolves to its hub node (the frontmatter `issuer:` value
  stays the raw name, consistent with the other families). Compute `wikilinks` as
  `[issuer.name] + [industry, country if present] + ([source] if source]` (raw
  names — the graph list, not link targets). Set `contains_source_text=True`. Set
  the filename via a **single shared identity slug** used by both this function and
  the Stage-5 supersede lookup:
  `okf_note_title(report, issuer) = _title(f"{issuer.name} - {report.doc_type.value}
  - {report.source or 'na'} - {report.report_date or report.fiscal_period or
  'undated'}")` — the `report_date or fiscal_period or 'undated'` fallback is
  **identical to the Stage-5 identity key**, so two distinct-period documents never
  collide on one `note_path` (RT fix). `note_rel_path = f"Sources/{note_title}.md"`.
  Keep `_yaml_block`'s flat-scalar rule: any list/dict value must be a JSON-encoded
  string, never a nested map.
- **Low-latency-RAG payoff:** the frontmatter is the pre-scan filter surface
  (issuer, doc_type, report_date, ratings all resolve without touching an index),
  and the `[[wikilinks]]` give the graph the sector/geography/agency edges an
  analyst navigates — both without a vector op.

> Checkpoint (Stage 3): pass with 2 MED + 2 LOW revised — flat-scalar frontmatter, shared vocabulary, redaction posture, and no-two-way-sync all confirmed against `vault_export`; `okf_note_title` fallback aligned to the Stage-5 identity key (`report_date or fiscal_period or 'undated'`) so distinct-period docs never collide; `_redact`-marker caution added for the `contains_source_text` key; wikilink targets `_title()`-sanitized; H1 built from `report.title`.

---

## Stage 4 — Chunk & embed  (`StructuredReport` → `OKFChunk[]` + vectors)

- **Goal (1 sentence):** cut the structured report into section-aligned chunks
  whose text contains **no synthetic numerals**, hash them the house way, and hand
  them to the existing embedding lane — so each chunk is one coherent idea, is
  BM25-retrievable on write, and is vector-retrievable once the background embed
  lands.
- **New module / interface:** `okf_ingest.py` → `def chunk_report(report:
  StructuredReport, issuer: IssuerRef) -> list[OKFChunk]`. Reuses
  `ingest.chunk_text` (token-based, `tiktoken cl100k_base`, `max_tokens=512`,
  `overlap_tokens=64`, paragraph-aware). Embedding executes via
  `engine.embeddings.embed_chunks_for_document` as a **post-commit background
  task** scheduled in Stage 5 (embeddings key on committed `chunk_hash` rows, so
  they cannot run before the write commits — the two are one pipeline concept but
  two execution moments, described together here per the §6 stage naming).
- **Input schema → Output schema:** `StructuredReport.sections` → `list[OKFChunk]`.

```python
# okf_schema.py
import hashlib

class OKFChunk(BaseModel):
    seq: int                        # 0-based order across the whole document
    text: str                       # breadcrumb(word-only) + section prose; lands in DocumentChunk.text
    chunk_hash: str                 # hashlib.sha256(text.encode("utf-8")).hexdigest()  — matches the house recipe
    section_title: str              # provenance (metadata; NOT re-injected into text)
    page_start: Optional[int] = None  # metadata + note file only; NOT in text (grounding-pool rule)
    page_end: Optional[int] = None
```

- **Chunking algorithm:** for each `DocSection` in order, build a **numeral-lean
  breadcrumb** `f"{issuer.name} — {report.doc_type.value} — {section.title}"`
  (words only: issuer, doc-type, section title — **no page integers, no year, no
  report_date**), then run `ingest.chunk_text(breadcrumb + "\n\n" + section.text)`
  and emit an `OKFChunk` per returned piece, carrying the section's
  `page_start/page_end` as **metadata**. Skip sections whose `text.strip()` is
  empty (a zero-text PDF yields **zero** chunks, never a breadcrumb-only chunk).
  Tables stay contiguous inside their section (no table-parser dependency in v1).
- **The grounding-pool rule (load-bearing — do not violate).**
  `engine.grounding.all_grounded` builds its allowed numeric pool by scanning
  cited-chunk *text* with `_NUM_RE` (matches bare integers and 4-digit years), and
  the RAG answer lane (`engine/queryanswer.py`) passes raw `DocumentChunk.text`
  into that pool. Therefore **no synthetic numeral may enter `OKFChunk.text`**:
  the breadcrumb is word-only and page anchors live *only* in `OKFChunk.page_*`
  metadata and in the rendered note file — never in the chunk text. (Section
  titles and issuer names are source-derived, same risk profile as today's raw
  chunks — not a regression.) This turns a would-be grounding-gate weakening into
  a non-issue; `engine/queryinsights.py` grounds only against a curated closed
  `numbers` set and is immune regardless.
- **Embedding backend & compliance (the §4.1/§5.4 fork, resolved).** Inbound OKF
  chunks embed on the **existing engine lane**:
  `embed_chunks_for_document(session, document_id)` batches through
  `get_embeddings` — Gemini `text-embedding-004` (768-dim) when `gemini_api_key`
  is set, deterministic `get_mock_embedding` when it is not. This is mandatory,
  not chosen: the retrieval vector filter is `DocumentChunkEmbedding.model ==
  settings.embedding_model`, so any other model is vector-invisible, and flipping
  `settings.embedding_model` would force `warmup_embeddings_task` to re-embed the
  whole corpus (a cost spike). Inbound chunks ride the exact lane every uploaded
  PDF already rides — **no new egress path is introduced.** The **vault-file lane
  ships no CAOS embedder**: vault-side semantic search stays analyst-side and local
  (Smart Connections / Ollama, per `OBSIDIAN_DATABANK.md`); the OKF spec restates
  the local-only mandate for any vault-file embedding. No paid service is added to
  the vault lane by construction (§5.4 satisfied).
- **Degradation:** `extraction_status == "empty"` → `chunk_report` returns `[]`;
  Stage 5 writes the Document with `chunk_count=0` and surfaces
  `NO_CHUNKS_WARNING` (mirrors the existing uploader). A note with zero chunks is
  a valid, flagged artifact — not success dressed as failure.
- **Opus instruction (technical):** implement `chunk_report` exactly as above;
  compute `chunk_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()` (the
  same recipe `_vault_document` uses, so identical text dedups against existing
  embeddings via the unique `(model, chunk_hash)` index). Do **not** embed inline
  in `chunk_report`; return `OKFChunk[]` and let Stage 5 schedule the background
  embed after commit.
- **Low-latency-RAG payoff:** section-aligned, ≤512-token, numeral-clean chunks
  mean one embedding ≈ one financial idea and no synthetic numeral pollutes the
  grounding gate; reusing the existing embed lane means vectors land in the exact
  table+model the HNSW/`retrieve()` path already queries — zero re-index, zero
  fork.

> Checkpoint (Stage 4): 7 pass, 0 revised — retrieval model+chunk_hash hard-filter, `sha256` recipe parity, and the grounding-pool immunity (`no synthetic numerals in OKFChunk.text`; `queryinsights` curated-numbers immune) all verified against `retrieval.py`/`grounding.py`/`queryanswer.py`; stage title corrected to `StructuredReport → OKFChunk[]`.

---

## Stage 5 — Write & index  (chunks/vectors → DB + vault files, retrieval-ready)

- **Goal (1 sentence):** persist the document, its chunks, its lineage, and its
  registry row in one transaction with an evidence-aware supersede, then — after
  commit — write the note file and embed, so the corpus is BM25-retrievable the
  instant the commit lands and the vault/vectors follow without ever blocking or
  corrupting the write.
- **New module / interface:** `okf_ingest.py` → `async def persist(db, report:
  StructuredReport, extracted: ExtractedDocument, chunks: list[OKFChunk], issuer:
  IssuerRef, caller_email: str, background_tasks) -> OkfIngestResult`. Reuses
  `database.Document`, `database.DocumentChunk`, `database.LineageEdge`, the new
  `database.OkfNote`, and `engine.embeddings.embed_chunks_for_document`. The
  content hash comes in on `extracted.content_sha256` (computed in Stage 1) — so
  `persist` never sees raw bytes.
- **Input → Output:** `OKFChunk[]` (+ report/extracted/issuer) → committed rows +
  `OkfIngestResult` (defined below).

```python
# okf_schema.py  — the orchestrator's return + the route's response model
class OkfIngestResult(BaseModel):
    document_id: str
    note_rel_path: str
    chunk_count: int
    extraction_status: str              # full | partial | empty
    superseded_document_id: Optional[str] = None   # set when a prior doc was replaced/shadowed
    warning: Optional[str] = None       # e.g. ingest.NO_CHUNKS_WARNING on an empty PDF

class OkfIngestResponse(OkfIngestResult):    # route response_model; identical shape today
    pass
```

- **Supersede identity & the transaction order (the RT-2026-07-08-01/02/03 fix).**
  - **Identity key** = `(issuer_id, doc_type, source, report_date-or-fiscal_period)`
    — *not* filename. It is materialized as the **same slug** `okf_note_title`
    builds (Stage 3), so the `note_path` lookup below *is* the identity lookup. A
    monthly re-issue under an identical filename but a new `report_date` versions
    **alongside** (history preserved); the same content re-uploaded is caught by
    `content_sha256`.
  - **Content dedup:** using `extracted.content_sha256`, if an `okf_notes` row for
    this issuer already has that hash → **no-op**, return the existing
    `document_id` (kills the renamed-duplicate double-ingest).
  - **Registry has NO FK** (decision below), so the transaction can repoint it
    freely. Order, all before commit:
    1. resolve identity → look up the existing `okf_notes` row by `note_path` (the
       shared identity slug → the filename is the identity, so this lookup and the
       identity key cannot drift);
    2. `content_sha256` no-op check (against `extracted.content_sha256`);
    3. insert the new `Document` (`db.add`, `await db.flush()`, `await
       db.refresh(doc)` to get `doc.id`), then `render_okf_note(...)` with the
       fresh `doc.id`, then bulk-insert `DocumentChunk` rows from `OKFChunk[]` with
       explicit `chunk_hash`, and one `LineageEdge` per chunk
       (`artifact_id=f"chunk:{cid}"`, `parent_id=f"doc:{doc.id}"`,
       `transform="okf-ingest"`, `transform_version=OKF_VERSION`);
    4. **UPSERT the `okf_notes` row**: if the identity row exists, `UPDATE` it in
       place (repoint `document_id`, `note_path`, `content_sha256`,
       `extraction_status="pending_note"`, `updated_at`); else `INSERT`. Because
       `document_id` is a soft ref (no FK), repointing to the new doc never raises;
    5. **evidence-aware cleanup of the prior document** (below);
    6. `await db.commit()` (or rely on the `get_db` teardown commit; `persist` may
       also be called from a background context with its own session — commit
       explicitly there).
  - Post-commit (both via `background_tasks.add_task`, each opening its **own**
    `AsyncSessionLocal()` — never the request `db`): (7) `write_okf_note` → on
    success set `okf_notes.extraction_status = extracted.extraction_status`
    (`full`/`partial`/`empty`), on `OSError` set `"note_failed"`; (8)
    `embed_chunks_for_document(session, document_id)` + `session.commit()`.
- **Evidence-aware supersede (the RT-2026-07-08-01 fix).** The prior document's
  chunks may be cited: `EvidenceItem.document_chunk_id` is a real FK to
  `document_chunks.id` with **no `ondelete`**. So:
  - If **no** `EvidenceItem` (and no `MetricFact`) references any prior chunk →
    hard-delete in the house dependency order (there is no cascade):
    `LineageEdge` by `chunk:{id}` → `LineageEdge` by `doc:{id}` → `DocumentChunk`
    by `document_id` → `Document` by `id` (verbatim from
    `memochunks._delete_prior_memo_docs`).
  - If **cited** → **keep** the prior `Document` + chunks intact as a *shadow*
    (citations stay openable; the registry already repointed to the new doc).
    **Storage blobs are retained** in either case (audit + regeneration source).
  - **Known limitation (documented, accepted):** a shadow document's chunks remain
    in the issuer BM25/vector corpus, so a same-dated corrected re-upload *after* a
    citing run leaves both versions retrievable until a future
    registry-aware retrieval filter (the named upgrade path) demotes shadows. This
    requires the rare conjunction of identical identity key + changed content +
    prior citation; it never drops or corrupts data.
  - **PG/SQLite asymmetry (must be tested):** SQLite (dev/CI) never issues `PRAGMA
    foreign_keys=ON`, so an un-evidence-aware delete would *pass* CI and *fail* in
    Postgres. The supersede test **must assert Postgres semantics** (see Appendix
    B) — a green SQLite test is not sufficient evidence here.
- **The `okf_notes` table (additive; no legacy alter).** New migration
  `0034_okf_notes.py`, `revision="0034"`, `down_revision="0033"` (current head is
  `0033_issuer_research_report`). **`document_id` is a soft reference — no
  ForeignKey** — matching the three deliberate precedents `DocumentChunkEmbedding`
  (keyed by `chunk_hash`), `LineageEdge` (string ids), and `AnalystQaFlag` ("so
  the flag survives its subject"). Rationale: the registry is a durable audit row
  that must outlive a superseded `Document`; there is zero `ondelete` anywhere in
  33 migrations; and a FK would only ever be enforced in Postgres (SQLite CI can't
  test it). `issuer_id` is likewise plain-indexed (no FK) to keep the table a pure
  soft-ref audit artifact. **No `caller.email` column** — attribution lives on
  `Document.uploaded_by`, which `erase_analyst_data` already scrubs; keeping email
  off `okf_notes` avoids creating an un-scrubbable PII sink (a real GDPR-erase gap
  otherwise). DDL and matching ORM model in Appendix B.
- **Opus instruction (technical):** implement `persist` in the order above. Stamp
  `Document(issuer_id=issuer.id, doc_type=report.doc_type.value,
  run_mode=None, file_name=extracted.file_name,
  storage_key=extracted.storage_key, fiscal_period=report.fiscal_period,
  chunk_count=len(chunks), uploaded_by=caller_email)` — `fiscal_period` is
  **canonical on `Document`**; the `okf_notes.fiscal_period` copy is a denormalized
  audit value written from the same source in the same transaction. Bulk-insert
  chunks with `insert(DocumentChunk)` dicts and **set `chunk_hash` explicitly in
  each dict — this is required, not optional**: the ORM `before_insert` listener
  that recomputes `chunk_hash` fires only on an ORM unit-of-work flush, **not** on a
  Core `insert()`, so a Core bulk insert that omitted `chunk_hash` would land it
  `NULL` and break the `(model, chunk_hash)` retrieval join. This matches
  `_vault_document` (which sets it explicitly on the same Core path). Schedule the
  two background tasks last.
- **Low-latency-RAG payoff:** chunks are `INSERT`ed and committed synchronously, so
  they are BM25-retrievable the instant the request returns (Postgres `tsv` is a
  `Computed` generated column — no offline re-index); the note file and vectors
  land post-commit off the request path, so write latency is the DB insert, not the
  disk or the embedder.

> Checkpoint (Stage 5): pass with 1 LOW revised — no-`ondelete` FK topology, SQLite `PRAGMA foreign_keys` gap, `memochunks` deletion order, 0033 head + additive migration idiom, `alembic check` parity, and post-commit background ordering all verified against `database.py`/migrations; the false "ORM `before_insert` listener also recomputes on the Core path" parenthetical corrected (explicit `chunk_hash` is required, not redundant); `OkfIngestResult`/`OkfIngestResponse` defined; `persist` reads `extracted.content_sha256`; strictly additive — no legacy schema alter.

---

## Stage 6 — Retrieval contract  (how the existing stack reads OKF; what must not fork)

- **Goal (1 sentence):** guarantee that OKF chunks are read by the existing
  retrieval/citation stack with zero new code, and state exactly what must stay
  unforked.
- **What reads OKF, unchanged:**
  - `retrieval.retrieve(db, issuer_id, query, k)` and `retrieve_corpus(...)` — OKF
    chunks are ordinary `document_chunks` rows scoped by the `Document.issuer_id`
    FK join, so they enter BM25 immediately and vector search once embedded. No
    new retrieval function.
  - `retrieval.build_issuer_index` filters `Document.doc_type != "analyst-memo"`;
    **all five OKF doc types are `!= "analyst-memo"` → included** as external
    source truth, which is correct (they are documents *about* the issuer, unlike
    the analyst's own memo commentary). *If* `sponsor-deck` is later judged too
    promotional to cite, the one-line upgrade is to add it to that exclusion — no
    other change.
  - `nlquery` (`Filter`/`IssuerFilter` → `retrieve_corpus(issuer_ids=...)`) — the
    house metadata-prefilter-then-semantic-scan pattern already narrows by issuer
    before the scan; OKF's `doc_type`/`fiscal_period` on `Document` extend that
    prefilter surface for free.
  - `engine/lineage.py` (CP-5B) + `EvidenceItem.document_chunk_id` +
    `GET /api/query/chunk/{chunk_id}` — an OKF chunk is cited exactly like any
    other; `resolved_chunk_id` is filled by BM25, so a numeral-clean, section-clean
    chunk is a clean, openable citation.
- **What must NOT fork:** the embedding model (`text-embedding-004`, 768-dim), the
  `(model, chunk_hash)` embedding key, the `chunk_hash = sha256(text)` recipe, and
  the `document_chunks`/`document_chunk_embeddings` schemas. Reuse
  `embed_chunks_for_document` and `chunk_text`; do not introduce a second embedder,
  a second vector table, or a parallel retriever.
- **CP-0 readiness (the RT-2026-07-08-10 fix).** `engine/readiness._categorize`
  matches `doc_type` against `_CATEGORIES`; `offering-memo` does **not** contain
  `"prospectus"`, so extend the `"offering"` doc_type tuple to include
  `"offering"` (additive one-liner) so an uploaded OM counts toward coverage. The
  other four types are supplementary and intentionally don't map to the four core
  coverage categories (financials/agreement/offering/covenant) — that is correct,
  not a gap.
- **Latency reasoning (from index structure, no invented numbers).** BM25 is a
  Postgres GIN index on the `tsv` generated column (populated on `INSERT`, no
  offline step) or SQLite Okapi over a ≤5000-row issuer fetch; the vector path is
  an HNSW index on `document_chunk_embeddings.vector` with an issuer + model
  prefilter via the `Document`/`chunk_hash` joins. Because metadata (issuer,
  doc_type, period) is resolved by B-tree/attribute filters before the semantic
  scan, and because chunks index on write, an OKF fact is retrievable at commit
  time and semantically retrievable at embed-completion time — no re-index barrier
  the agents wait on. No latency figure is claimed; the property is structural.
- **Low-latency-RAG payoff:** the entire stage is "nothing new to build" — the
  proof that the design lands chunks where the fast path already reads.

> Checkpoint (Stage 6 + Appendix A/B): pass with 1 MED + 2 LOW revised (+ a whole-document coherence pass: 5 MED + 2 LOW) — `build_issuer_index != "analyst-memo"` filter, the `_CATEGORIES` "offering" gap, `erase_analyst_data` GDPR scrub, flat-scalar frontmatter, and migration conventions all verified; the `test_okf_extract_pages` contradiction resolved (markitdown-independent); the Appendix-B route block given full imports + `okf_ingest` alias + issuer-check-after-extraction; the glance-diagram invariant redrawn as a `StructuredReport` fan-out DAG; `IssuerRef` construction stated; Outcome page-anchor claim reworded to resolve via the OKF note (no legacy chunk column).

---

## Appendix A — The OKF frontmatter specification (authoritative)

**OKF is a fourth Obsidian note family, `type: "source-document"`, written only
under `{vault_export_dir}/Sources/`.** It obeys `vault_export._yaml_block`: flat
scalars only (a nested value must be a JSON-encoded string), and any key whose
value is `None`/`""` is dropped — so required signals must always carry a value.

### Field table

| Key | YAML type | Required | Source | Consumer / query it enables |
|---|---|---|---|---|
| `type` | string (literal `"source-document"`) | ✅ | constant | family discriminator; Dataview `WHERE type` (mirrors `credit-run`/`issuer`/`analyst-memo`) |
| `okf_version` | string | ✅ | `OKF_VERSION` | schema-evolution gate for programmatic readers |
| `issuer` | string | ✅ | `IssuerRef.name` | `[[Issuer]]` autolink + graph clustering; shared vocab with all 3 families |
| `document_id` | string | ✅ | `Document.id` | lineage join to `document_chunks`; supersede identity; **not** in the filename |
| `doc_type` | string (one of the 5) | ✅ | `Document.doc_type` | agent/query filter; mirrors the DB column; CP-0 categorization |
| `extraction_status` | string (`full`/`partial`/`empty`) | ✅ | `ExtractedDocument` | degradation signal; a reader must not treat `empty` as success |
| `contains_source_text` | bool | ✅ | constant `true` | sync-exclusion / local-embed selector for the `Sources/` subtree |
| `ticker` | string | ⬜ | `IssuerRef.ticker` | shared with `credit-run`/`issuer`; ticker filter |
| `industry` | string | ⬜ | `IssuerRef.industry` | `[[Industry]]` edge; sector filter |
| `country` | string | ⬜ | `IssuerRef.country` | `[[Country]]` edge; geography filter |
| `source` | string | ⬜ | `StructuredReport.source` | provenance; `[[Source]]` agency/bank cluster |
| `report_date` | string (ISO) | ⬜ | `StructuredReport.report_date` | period prefilter; supersede identity |
| `fiscal_period` | string | ⬜ | `Document.fiscal_period` (canonical) | period filter without touching a legacy schema |
| `rating_moody` | string | ⬜ | rating extractor (rating-report only) | ratings filter; reconciles with `Issuer.rating_moody` |
| `rating_sp` | string | ⬜ | rating extractor | ratings filter; reconciles with `Issuer.rating_sp` |
| `storage_key` | string | ⬜ | `ingest.store` | regeneration source (the raw blob) |
| `page_count` | int | ⬜ | `ExtractedDocument.page_count` | provenance/completeness readout |

Deliberately **absent**: any `uploaded_by`/analyst email (attribution lives on
`Document.uploaded_by`, the single GDPR-scrubbable home); any nested map; any raw
`chunk_text`/`excerpt` key (those trip `_redact` markers and are not how this
family carries text — the body does, flagged by `contains_source_text`).

### Reconciliation with the existing families

| Field | `credit-run` (spoke) | `issuer` (hub) | `analyst-memo` | **`source-document` (OKF)** |
|---|---|---|---|---|
| `type` | ✅ | ✅ | ✅ | ✅ |
| `issuer` | ✅ | ✅ | — (via links) | ✅ |
| `ticker`/`industry`/`country` | ✅ | ✅ | — | ✅ (shared vocab) |
| period field | `as_of` | — | `date` | `report_date` + `fiscal_period` |
| provenance | `run_id` | — | `source_file`/`uploaded_by` | `document_id` + `source` + `storage_key` |
| status | `qa_status`/`committee_status` | — | — | `extraction_status` |

OKF adds only what an *inbound source document* needs (`document_id`, `doc_type`,
`report_date`, `extraction_status`, `contains_source_text`, ratings) and reuses the
issuer-identity vocabulary verbatim, so a Dataview/graph query spanning families
keys on the same `issuer`/`industry`/`country` names.

### Worked example (complete note)

```markdown
---
type: "source-document"
okf_version: "okf/1.0"
issuer: "Acme Bidco"
document_id: "6f2a1c9e-3b7d-4a12-9f0e-2c5b8d4e1a77"
doc_type: "rating-report"
extraction_status: "full"
contains_source_text: true
ticker: "ACME"
industry: "Software"
country: "US"
source: "Moody's"
report_date: "2025-11-03"
fiscal_period: "FY2025"
rating_moody: "B2"
storage_key: "9c1f…/acme_moodys_2025-11.pdf"
page_count: 12
---
# Acme Bidco — Rating report (2025-11-03)

Issuer: [[Acme Bidco]] · Industry: [[Software]] · Country: [[US]] · Source: [[Moody's]]

## Key facts
- **Corporate Family Rating:** B2 (Moody's)
- **1L Term Loan:** $650mm  (p. 4)
- **Net leverage:** 5.8x  (p. 7)

## Rating Rationale (p. 3–5)
Moody's assigns a B2 CFR reflecting Acme's elevated opening leverage of 5.8x and
adequate liquidity … <full section text; no synthetic numerals injected into the
chunked text — the page anchors above live only in this note file and in OKFChunk
metadata>

## Liquidity (p. 6–7)
The company's liquidity is supported by a $75mm undrawn RCF …

## Extraction notes
- status: full
- method: pypdf
- pages: 12
- document_id: 6f2a1c9e-3b7d-4a12-9f0e-2c5b8d4e1a77
```

---

## Appendix B — Instruction to Opus 4.8 (self-contained; build without re-reading the brief)

You are implementing the pipeline above. Everything you need is in this blueprint.
Do not write UI code, do not alter a legacy table's columns/indexes, do not add a
paid vault embedder, do not build two-way sync.

### Environment & conventions

- **venv:** run the server suite with
  `caos/server/.venv/bin/python` (py3.9) or the prod-parity
  `caos/server/.venv311/bin/python` (py3.11, `fastapi==0.138.*` — **never
  downgrade the pin**). Clear `ANTHROPIC_API_KEY`/`GEMINI_API_KEY` for offline QA
  (embeddings fall back to the deterministic mock).
- **Flat imports** (`import ingest`, `from database import ...`).
- **GitNexus:** before editing any existing symbol
  (`ingest.extract_pdf_text`, `readiness._categorize`,
  `vault_export._scan_memo_files`, `main.py` router block) run
  `impact({target, direction:"upstream"})` and report blast radius; before
  committing run `detect_changes({scope:"compare", base_ref:"main"})`.
- **Parallel-WIP staging:** stage only the files you create/edit (explicit paths,
  never `git add -A`); the user edits the same tree in parallel. Commit only on
  request, with the Co-Authored-By trailer.

### Build order (each step compiles/tests before the next)

1. **`okf_schema.py`** — the nine seam/support models (`PageText`,
   `ExtractedDocument`, `KeyFact`, `DocSection`, `StructuredReport`,
   `StructuringOverrides`, `IssuerRef`, `OKFNote`, `OKFChunk`) **plus the two
   result models** (`OkfIngestResult`, `OkfIngestResponse`), the `DocType` enum,
   `_DOCTYPE_LABEL` map, and `OKF_VERSION`. Verbatim from the fenced blocks in
   Stages 1–5.
2. **`ingest.extract_pdf_pages`** — the additive per-page helper (Stage 1). Confirm
   the existing pypdf reader object it should reuse; return `[]` on any exception.
3. **`okf_structure.py`** — `classify`, `segment`, `extract_key_facts`, `structure`
   (Stage 2). Deterministic only. Store extracted values verbatim.
4. **`okf_notes.py`** — `render_okf_note`, `okf_note_title`, `write_okf_note`
   (Stage 3). Import `_yaml_block`, `_title`, `autolink_issuers` from
   `vault_export`. Enforce the "required keys never empty" rule.
5. **`database.OkfNote`** ORM model + **`migrations/versions/0034_okf_notes.py`**
   (Stage 5 / DDL below). Run the migration guard (below) before proceeding.
6. **`okf_ingest.py`** — `extract`, `chunk_report`, `persist`, and the top-level
   `async def ingest_pdf(db, content, file_name, issuer_id, overrides,
   caller_email, background_tasks) -> OkfIngestResult` that wires Stages 1→5 in
   order: `extract()` off-thread (no DB) → `db.get(Issuer, issuer_id)` (404 if
   missing) → build `IssuerRef` from the ORM row → `structure()` → `chunk_report()`
   → `persist()`. Confirm the callee signature `embed_chunks_for_document(session,
   document_id)` in `engine/embeddings.py` before wiring (read it; the call site
   shows `(session, doc.id)`).
7. **`routes/okf.py`** — the two endpoints, security ladder verbatim (below).
8. **Edits:** `readiness._CATEGORIES["offering"]` doc_type tuple += `"offering"`;
   `vault_export._scan_memo_files` prune set += `"Sources"`; `main.py` import +
   `include_router`; `OBSIDIAN_DATABANK.md` inbound-`Sources/` + redaction-posture
   section.
9. **Tests** (below).

### Reuse-vs-write (do not reimplement the left column)

| Reuse (call) | Write (new) |
|---|---|
| `ingest.read_capped/sniff_pdf/extract_pdf_text/store/chunk_text` | `okf_structure.*`, `okf_notes.render_okf_note`, `okf_ingest.*` |
| `engine.embeddings.embed_chunks_for_document` | the supersede transaction + `okf_notes` upsert |
| `avscan.scan`, `rate_limit.hit`, `identity.get_identity` | `routes/okf.py` dispatch |
| `vault_export._yaml_block/_title/autolink_issuers` | `ingest.extract_pdf_pages` (additive) |
| `database.Document/DocumentChunk/LineageEdge` | `database.OkfNote` + migration `0034` |

### The route security ladder (the ladder ORDER is verbatim; imports shown in full)

```python
# routes/okf.py
from typing import Optional
from fastapi import (APIRouter, BackgroundTasks, Depends, File, Form,
                     HTTPException, UploadFile, status)
from sqlalchemy.ext.asyncio import AsyncSession

import avscan, ingest, okf_ingest, rate_limit
from database import Issuer, get_db
from identity import CallerIdentity, get_identity
from okf_schema import OkfIngestResponse, StructuringOverrides

router = APIRouter()
_OKF_MAX_PER_MINUTE = 20

def _okf_rate_guard(caller: CallerIdentity) -> None:
    if not rate_limit.hit(f"okf:{caller.id}", max_attempts=_OKF_MAX_PER_MINUTE, window_seconds=60):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Upload rate limit reached — try again in a minute.")

@router.post("/ingest", response_model=OkfIngestResponse)
async def okf_ingest_route(
    background_tasks: BackgroundTasks,          # first — no default; FastAPI injects
    issuer_id: str = Form(...),
    doc_type: Optional[str] = Form(None),        # analyst override; else classifier decides
    report_date: Optional[str] = Form(None),
    fiscal_period: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    caller: CallerIdentity = Depends(get_identity),
):
    _okf_rate_guard(caller)
    content = await ingest.read_capped(file)     # 413 over cap / 400 empty
    ingest.sniff_pdf(content)                     # 400 if not %PDF-
    await avscan.scan(content)                    # no-op unless CLAMAV_HOST; 422 hit / 503 fail-closed
    # ingest_pdf extracts OFF-THREAD first, THEN opens the DB session (issuer 404 +
    # writes) — mirroring upload_document, so no read txn is held idle during OCR:
    result = await okf_ingest.ingest_pdf(
        db, content, file.filename or "upload.pdf", issuer_id,
        StructuringOverrides(doc_type=doc_type, report_date=report_date, fiscal_period=fiscal_period),
        caller.email, background_tasks,
    )
    return OkfIngestResponse(**result.model_dump())
```

`okf_ingest.ingest_pdf(db, content, file_name, issuer_id, overrides, caller_email,
background_tasks)` performs, in order: (1) `extract()` off-thread (no DB touch);
(2) `issuer = await db.get(Issuer, issuer_id)` → `HTTPException(404)` if missing
(this is where the first DB read happens — after extraction, so the request session
is never held idle-in-transaction across a multi-minute OCR, exactly like
`upload_document`); (3) build an `IssuerRef` from the ORM `Issuer`
(`IssuerRef(id=issuer.id, name=issuer.name, ticker=issuer.ticker,
industry=issuer.industry, country=issuer.country)`); (4) `structure()`,
`chunk_report()`, `persist()`. Notes: the edge-origin middleware already enforces
`X-Edge-Authorization` on every `/api/*` path except health, so
`Depends(get_identity)` is the whole authentication story (401 in any deployed
context, `local-dev` stub otherwise). `avscan.scan` is a genuine no-op unless
`CLAMAV_HOST` is configured — a deployment fact, not a code gap.

### The migration + ORM (additive; `alembic check` must stay green)

```python
# migrations/versions/0034_okf_notes.py
revision = "0034"; down_revision = "0033"

def upgrade() -> None:
    op.create_table(
        "okf_notes",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("document_id", sa.String(length=36), nullable=False),   # SOFT ref — no FK
        sa.Column("issuer_id", sa.String(length=36), nullable=False),
        sa.Column("note_path", sa.String(length=1024), nullable=False),
        sa.Column("note_title", sa.String(length=512), nullable=True),
        sa.Column("doc_type", sa.String(length=64), nullable=True),
        sa.Column("source", sa.String(length=64), nullable=True),
        sa.Column("report_date", sa.String(length=32), nullable=True),
        sa.Column("fiscal_period", sa.String(length=64), nullable=True),
        sa.Column("extraction_status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("contains_source_text", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("content_sha256", sa.String(length=64), nullable=True),
        sa.Column("okf_version", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("document_id", name="uq_okf_notes_document_id"),
        sa.UniqueConstraint("note_path", name="uq_okf_notes_note_path"),
    )
    op.create_index("ix_okf_notes_issuer_id", "okf_notes", ["issuer_id"])

def downgrade() -> None:
    op.drop_index("ix_okf_notes_issuer_id", table_name="okf_notes")
    op.drop_table("okf_notes")
```

The `OkfNote` ORM class in `database.py` must declare **exactly** these columns,
nullability, the two unique constraints, and the `issuer_id` index (`alembic check`
compares presence/nullability/indexes/uniques/FKs — not types or server defaults),
using the module's existing uuid/utcnow default helpers for `id`/`created_at`/
`updated_at`. No `ForeignKey`; no `caller.email` column.

### Per-stage isolated tests (`tests/server/test_okf_*.py`)

- `test_okf_extract_pages`: a 2-page text PDF fixture → `ExtractedDocument` with
  `has_page_map is True`, `len(pages)==2`, `extraction_status=="full"`. This holds
  **regardless of whether markitdown is wired**, because `pages` comes from the
  unconditional `extract_pdf_pages` (pypdf) call, not from `full_text`'s method —
  the test does not need to disable markitdown.
- `test_okf_structure_classifies`: a fixture whose first page says "OFFERING
  MEMORANDUM" → `doc_type == OFFERING_MEMO`; an unmarked fixture →
  `SOURCE_DOCUMENT`.
- `test_okf_note_shape`: `render_okf_note` → frontmatter starts `---\n`, contains
  `type: "source-document"`, `contains_source_text: true`, `document_id`; body has
  `# ` H1 + `[[Issuer]]` link; **no `(p.` anchor appears in any `OKFChunk.text`**
  from `chunk_report` (grounding-pool assertion).
- `test_okf_chunk_retrievable`: ingest a fixture → assert a `document_chunks` row
  exists and `await retrieval.retrieve(db, issuer_id, <phrase from the doc>, k=5)`
  returns it (BM25 path, no embedding needed).
- `test_okf_supersede_idempotent`: ingest the same bytes twice → one logical
  document (`content_sha256` no-op), registry row count stable; ingest a changed
  version with the same identity but **an EvidenceItem citing the first** →
  the first Document + chunks survive (shadow), the registry repoints, **assert
  under Postgres semantics** (enable FK enforcement in the test DB, or run the
  supersede path against a Postgres test container — a green SQLite run is not
  sufficient because SQLite does not enforce FKs).
- `test_okf_sources_excluded_from_memo_sync`: write a `Sources/…md` note → run
  `vault_export.sync_analyst_memos` → assert it produces **no** `AnalystLink` row
  for it (the prune-set edit works).
- `test_okf_empty_pdf`: a scanned/empty fixture → note written,
  `extraction_status=="empty"`, `chunk_count==0`, `NO_CHUNKS_WARNING` surfaced, no
  crash.

### Negative constraints (restated — a step that violates one does not ship)

1. No `caos/frontend/` edit. 2. No column/index/migration change to `documents`,
`document_chunks`, `document_chunk_embeddings`, `evidence_items`, `metric_facts`,
or run tables — `okf_notes` is a new additive table. You may touch
`document_chunks`/`document_chunk_embeddings` only as **row DML through existing
code paths** — insert new chunks, and on supersede delete a prior document's chunks
via the `memochunks` dependency order — but **never** alter a column, index, or
migration of a legacy table. 3.
Vault-file embedding stays local — reuse the existing engine lane for the
machine-RAG corpus; ship no embedder for the `Sources/` files. 4. No two-way sync
— the OKF note is derived from the stored blob and keyed to `document_id`; it never
writes back to canonical DB state. 5. Every seam degrades (partial/empty →
well-formed flagged note, never a silent drop).

---

> **Self-check ledger (Stage §7).** Six fresh-context verifier subagents audited
> the stage groups + a whole-document coherence pass + a §5-boundary pass against:
> (1) paths/classes/functions exist or are clearly new; (2) the seam schemas chain
> and mirror the real DB columns; (3) the stage serves low-latency RAG; (4)
> frontmatter obeys flat-scalar `_yaml_block`; (5) no §5 boundary is crossed. The
> hard core (Stage 4–5 supersede/embedding/grounding) and the §5 boundaries passed
> **clean**; the remaining 20 REVISE findings (13 distinct defects, all
> coherence/grounding precision — no architectural change) are reconciled inline
> above and re-verified in a second adversarial round. Checkpoint verdicts are
> recorded per stage.
