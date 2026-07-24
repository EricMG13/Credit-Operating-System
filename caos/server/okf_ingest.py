"""OKF orchestrator: PDF bytes → committed chunks + registry row + Obsidian note.

Wires Stages 1→5 and owns the two things that are genuinely new — the seam
sequencing and the evidence-aware supersede transaction. Everything else is
called, not reimplemented (``ingest`` for extraction/storage/chunking,
``engine.embeddings`` for vectors, ``vault_export`` helpers via ``okf_notes``).

Ordering is the design, not an accident:

  - **Extraction completes before the DB session is touched.** A 300-second OCR
    must never hold a transaction open, so ``extract()`` runs entirely off-thread
    and only the typed ``ExtractedDocument`` crosses into the write stage. This
    mirrors ``routes/ingestion.upload_document``.
  - **The note is rendered inside the transaction, written after it.**
    ``render_okf_note`` needs the ``document_id`` the insert mints (so it runs
    after ``flush()``), but the disk write and the embed are post-commit
    background tasks on their own sessions — a slow disk or a failing embedder can
    never block or corrupt the write.
  - **Chunks are committed synchronously**, so they are BM25-retrievable the
    instant the request returns; vectors follow when the background embed lands.

Every seam degrades rather than failing the upload: an unreadable PDF still
vaults, still gets a note, and is flagged ``extraction_status="empty"`` with
``ingest.NO_CHUNKS_WARNING`` surfaced.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import uuid

from fastapi import HTTPException
from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

import ingest
import okf_notes
import okf_structure
from config import get_settings
from identity import CallerIdentity
from tenancy import require_issuer
from database import (
    AsyncSessionLocal,
    Document,
    DocumentChunk,
    EvidenceItem,
    Issuer,
    LineageEdge,
    MetricFact,
    OkfNote,
)
from okf_schema import (
    OKF_VERSION,
    ExtractedDocument,
    IssuerRef,
    OKFChunk,
    OKFNote,
    OkfIngestResult,
    PageText,
    StructuredReport,
    StructuringOverrides,
)

logger = logging.getLogger("caos.okf")

_TRANSFORM = "okf-ingest"


# ── Stage 1: extraction ──────────────────────────────────────────────────────


async def extract(content: bytes, file_name: str) -> ExtractedDocument:
    """Materialize the document off-thread, before any DB work.

    Two independent extractions run so a reflowing text extractor never
    invalidates the page map: ``full_text`` is canonical (markitdown → pypdf → OCR),
    while ``pages`` always comes from pypdf purely to supply citation anchors.
    """
    # parse_bounded, not a bare to_thread: these parsers read attacker-controlled
    # bytes, so they run in a killable spawned process under the configured
    # deadline — the same boundary routes/ingestion.upload_document uses. A hostile
    # PDF can therefore never pin a worker thread indefinitely.
    full_text, used_ocr = await ingest.parse_bounded(
        ingest.extract_pdf_text, content, file_name
    )
    raw_pages = await ingest.parse_bounded(ingest.extract_pdf_pages, content)
    # store() is disk I/O, not parsing — off-thread is the right boundary here
    # (matching _vault_document).
    storage_key = await asyncio.to_thread(ingest.store, content, file_name)
    content_sha256 = hashlib.sha256(content).hexdigest()

    pages = [PageText(page=number, text=text) for number, text in raw_pages]
    has_page_map = len(pages) > 0
    has_text = bool(full_text.strip())

    if not has_text:
        method = "none"
    elif used_ocr:
        method = "ocr"
    elif get_settings().markitdown_cmd:
        method = "markitdown"
    else:
        method = "pypdf"

    warnings: list[str] = []
    if not has_text:
        extraction_status = "empty"
        warnings.append(ingest.NO_CHUNKS_WARNING)
    elif not has_page_map:
        extraction_status = "partial"
        warnings.append(
            "No page map available — citations for this document carry no page anchor."
        )
    else:
        extraction_status = "full"

    return ExtractedDocument(
        storage_key=storage_key,
        file_name=file_name,
        content_sha256=content_sha256,
        full_text=full_text,
        pages=pages,
        method=method,
        used_ocr=used_ocr,
        has_page_map=has_page_map,
        page_count=len(pages),
        extraction_status=extraction_status,
        warnings=warnings,
    )


# ── Stage 4: chunking ────────────────────────────────────────────────────────


def chunk_report(report: StructuredReport, issuer: IssuerRef) -> list[OKFChunk]:
    """Section-aligned chunks carrying a **word-only** breadcrumb.

    No page integer, year, or report date may enter the chunk text:
    ``engine.grounding.all_grounded`` builds its allowed numeric pool by scanning
    cited-chunk text, so a synthetic numeral here would widen that pool. Page
    anchors live only in ``page_start``/``page_end`` metadata and the note file.
    """
    chunks: list[OKFChunk] = []
    for section in report.sections:
        if not section.text.strip():
            continue  # a zero-text PDF yields zero chunks, never a breadcrumb-only one
        breadcrumb = f"{issuer.name} — {report.doc_type.value} — {section.title}"
        for piece in ingest.chunk_text(f"{breadcrumb}\n\n{section.text}"):
            chunks.append(OKFChunk(
                seq=len(chunks),
                text=piece,
                chunk_hash=hashlib.sha256(piece.encode("utf-8")).hexdigest(),
                section_title=section.title,
                page_start=section.page_start,
                page_end=section.page_end,
            ))
    return chunks


# ── Stage 5: write & index ───────────────────────────────────────────────────


async def _prior_chunks_are_cited(db: AsyncSession, chunk_ids: list[str]) -> bool:
    """True when any evidence item or metric fact still points at these chunks.

    Both carry a real FK to ``document_chunks.id`` with **no ondelete**, so
    deleting a cited chunk raises under Postgres. SQLite (dev/CI) does not enforce
    FKs, so an un-evidence-aware delete would pass CI and fail in production — this
    check is what makes the two behave the same.
    """
    if not chunk_ids:
        return False
    cited = (await db.execute(
        select(EvidenceItem.id).where(EvidenceItem.document_chunk_id.in_(chunk_ids)).limit(1)
    )).first()
    if cited is not None:
        return True
    metric = (await db.execute(
        select(MetricFact.id).where(MetricFact.document_chunk_id.in_(chunk_ids)).limit(1)
    )).first()
    return metric is not None


async def _supersede_prior(db: AsyncSession, prior_document_id: str) -> None:
    """Retire the prior document for this identity.

    Uncited → hard-delete in the house dependency order (there is no cascade),
    verbatim from ``memochunks._delete_prior_memo_docs``. Cited → keep the
    Document and its chunks intact as a **shadow** so existing citations stay
    openable; the registry has already been repointed to the new document.

    The stored blob is retained either way (audit + regeneration source).
    """
    prior_chunk_ids = list((await db.execute(
        select(DocumentChunk.id).where(DocumentChunk.document_id == prior_document_id)
    )).scalars().all())

    if await _prior_chunks_are_cited(db, prior_chunk_ids):
        logger.info(
            "OKF supersede: prior document %s is cited — retained as a shadow.",
            prior_document_id,
        )
        return

    if prior_chunk_ids:
        await db.execute(delete(LineageEdge).where(
            LineageEdge.artifact_id.in_([f"chunk:{cid}" for cid in prior_chunk_ids])
        ))
    await db.execute(delete(LineageEdge).where(
        LineageEdge.parent_id == f"doc:{prior_document_id}"
    ))
    await db.execute(delete(DocumentChunk).where(
        DocumentChunk.document_id == prior_document_id
    ))
    await db.execute(delete(Document).where(Document.id == prior_document_id))
    logger.info("OKF supersede: replaced prior document %s.", prior_document_id)


async def _write_note_task(vault_dir: str, note: OKFNote, registry_id: str, status: str) -> None:
    """Post-commit note write on its own session — never the request's."""
    try:
        await okf_notes.write_okf_note(vault_dir, note)
        final_status = status
    except OSError as exc:
        logger.warning("OKF note write failed for %s: %s", note.note_rel_path, exc)
        final_status = "note_failed"
    try:
        async with AsyncSessionLocal() as session:
            row = await session.get(OkfNote, registry_id)
            if row is not None:
                row.extraction_status = final_status
                await session.commit()
    except Exception:  # noqa: BLE001 — a status stamp must never surface to the caller
        logger.exception("OKF registry status update failed for %s", registry_id)


async def _embed_task(document_id: str) -> None:
    """Post-commit embed on its own session. Keyed on committed chunk_hash rows,
    so it cannot run before the write commits."""
    try:
        from engine.embeddings import embed_chunks_for_document

        async with AsyncSessionLocal() as session:
            await embed_chunks_for_document(session, document_id)
            await session.commit()
    except Exception:  # noqa: BLE001 — vectors are best-effort; BM25 already works
        logger.exception("OKF background embed failed for document %s", document_id)


async def persist(
    db: AsyncSession,
    report: StructuredReport,
    extracted: ExtractedDocument,
    chunks: list[OKFChunk],
    issuer: IssuerRef,
    caller_email: str,
    background_tasks,
) -> OkfIngestResult:
    """One transaction: Document + chunks + lineage + registry, with an
    evidence-aware supersede. Note write and embed are scheduled post-commit."""
    note_title = okf_notes.okf_note_title(report, issuer)
    note_rel_path = f"{okf_notes.SOURCES_DIRNAME}/{note_title}.md"

    # (1) Content dedup — a renamed re-upload of identical bytes is a no-op.
    duplicate = (await db.execute(
        select(OkfNote).where(
            OkfNote.issuer_id == issuer.id,
            OkfNote.content_sha256 == extracted.content_sha256,
        )
    )).scalars().first()
    if duplicate is not None:
        logger.info(
            "OKF ingest: identical content already registered for issuer %s (document %s).",
            issuer.id, duplicate.document_id,
        )
        # extract() already vaulted a fresh copy of these bytes. Nothing will ever
        # reference it (the existing Document keeps its own storage_key), so drop
        # it rather than leaking a duplicate blob on every re-upload.
        try:
            ingest.remove_uncommitted(extracted.storage_key)
        except (ValueError, OSError):  # never fail a successful no-op over cleanup
            logger.warning("OKF dedup: could not remove orphaned blob %s", extracted.storage_key)
        return OkfIngestResult(
            document_id=duplicate.document_id,
            note_rel_path=duplicate.note_path,
            chunk_count=0,
            extraction_status=duplicate.extraction_status,
            warning="Identical document already ingested — returning the existing record.",
        )

    # (2) Resolve identity. note_path IS the identity key (same slug, by construction).
    existing = (await db.execute(
        select(OkfNote).where(OkfNote.note_path == note_rel_path)
    )).scalars().first()
    prior_document_id = existing.document_id if existing is not None else None

    # (3) Insert the Document, then render the note with the id it mints.
    document = Document(
        issuer_id=issuer.id,
        doc_type=report.doc_type.value,
        run_mode=None,
        file_name=extracted.file_name,
        storage_key=extracted.storage_key,
        fiscal_period=report.fiscal_period,
        chunk_count=len(chunks),
        uploaded_by=caller_email,
    )
    db.add(document)
    await db.flush()
    await db.refresh(document)
    document_id = document.id

    note = okf_notes.render_okf_note(report, issuer, document_id, extracted.storage_key)

    if chunks:
        # Mint chunk ids here (the house pattern in _vault_document) so each
        # lineage edge can name its chunk without a round-trip read.
        #
        # chunk_hash MUST be set explicitly: the ORM before_insert listener that
        # recomputes it fires only on a unit-of-work flush, never on a Core
        # insert(), so omitting it would land NULL and break the
        # (model, chunk_hash) join every vector query depends on.
        chunk_prov = "ocr" if extracted.used_ocr else None
        chunk_dicts = []
        lineage_dicts = []
        for chunk in chunks:
            chunk_id = str(uuid.uuid4())
            chunk_dicts.append({
                "id": chunk_id,
                "document_id": document_id,
                "seq": chunk.seq,
                "text": chunk.text,
                "chunk_hash": chunk.chunk_hash,
                "prov": chunk_prov,
            })
            lineage_dicts.append({
                "id": str(uuid.uuid4()),
                "artifact_id": f"chunk:{chunk_id}",
                "parent_id": f"doc:{document_id}",
                "transform": _TRANSFORM,
                "transform_version": OKF_VERSION,
            })
        await db.execute(insert(DocumentChunk), chunk_dicts)
        await db.execute(insert(LineageEdge), lineage_dicts)

    # (4) UPSERT the registry. document_id is a soft ref, so repointing never raises.
    #
    # The note write is a post-commit background task, so the row starts at
    # "pending_note" and is stamped with the real extraction status once the file
    # lands. With no vault configured there is no note to wait for, so the row is
    # marked "note_skipped" up front rather than being left pending forever — the
    # chunks and registry are still fully valid without Obsidian.
    settings = get_settings()
    vault_dir = settings.vault_export_dir
    initial_status = "pending_note" if vault_dir else "note_skipped"
    if existing is not None:
        existing.document_id = document_id
        existing.note_title = note_title
        existing.doc_type = report.doc_type.value
        existing.source = report.source
        existing.report_date = report.report_date
        existing.fiscal_period = report.fiscal_period
        existing.extraction_status = initial_status
        existing.contains_source_text = True
        existing.content_sha256 = extracted.content_sha256
        existing.okf_version = OKF_VERSION
        registry_row = existing
    else:
        registry_row = OkfNote(
            document_id=document_id,
            issuer_id=issuer.id,
            note_path=note_rel_path,
            note_title=note_title,
            doc_type=report.doc_type.value,
            source=report.source,
            report_date=report.report_date,
            fiscal_period=report.fiscal_period,
            extraction_status=initial_status,
            contains_source_text=True,
            content_sha256=extracted.content_sha256,
            okf_version=OKF_VERSION,
        )
        db.add(registry_row)
    await db.flush()
    registry_id = registry_row.id

    # (5) Retire the prior document only after the registry points at the new one.
    if prior_document_id and prior_document_id != document_id:
        await _supersede_prior(db, prior_document_id)

    await db.commit()

    # (6) Post-commit, off the request path.
    if vault_dir:
        background_tasks.add_task(
            _write_note_task, vault_dir, note, registry_id,
            extracted.extraction_status,
        )
    background_tasks.add_task(_embed_task, document_id)

    return OkfIngestResult(
        document_id=document_id,
        note_rel_path=note_rel_path,
        chunk_count=len(chunks),
        extraction_status=extracted.extraction_status,
        superseded_document_id=prior_document_id,
        warning=ingest.NO_CHUNKS_WARNING if not chunks else None,
    )


# ── Top-level orchestration ──────────────────────────────────────────────────


async def ingest_pdf(
    db: AsyncSession,
    content: bytes,
    file_name: str,
    issuer_id: str,
    overrides: StructuringOverrides,
    caller: CallerIdentity,
    background_tasks,
) -> OkfIngestResult:
    """Stages 1→5. Extraction happens first and off-thread, so the request session
    is never held idle-in-transaction across a multi-minute parse.

    Takes the full ``CallerIdentity`` rather than a bare email so the issuer read
    can go through ``require_issuer`` — the same tenancy gate ``_vault_document``
    applies. Without it an analyst could ingest into another team's issuer.
    """
    extracted = await extract(content, file_name)

    # First DB touch — deliberately after extraction. require_issuer covers both
    # the missing-issuer 404 and the cross-team case (never leaking existence).
    #
    # extract() has already vaulted the bytes (it must, to stay off the DB), so an
    # authorization failure here would strand that blob. Drop it before the 404
    # propagates — otherwise probing unknown issuer ids would grow the vault.
    try:
        issuer_row = require_issuer(caller, await db.get(Issuer, issuer_id))
    except HTTPException:
        try:
            ingest.remove_uncommitted(extracted.storage_key)
        except (ValueError, OSError):
            logger.warning(
                "OKF: could not remove orphaned blob %s after issuer rejection",
                extracted.storage_key,
            )
        raise
    issuer = IssuerRef(
        id=issuer_row.id,
        name=issuer_row.name,
        ticker=issuer_row.ticker,
        industry=issuer_row.industry,
        country=issuer_row.country,
    )

    report = okf_structure.structure(extracted, issuer, overrides)
    chunks = chunk_report(report, issuer)
    return await persist(
        db, report, extracted, chunks, issuer, caller.email, background_tasks
    )
