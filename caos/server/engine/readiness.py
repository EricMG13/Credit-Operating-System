"""CP-0 SourceReadiness — assess the issuer's *actual* vaulted documents.

Deterministic and issuer-grounded (replaces the canned ATLF fixture): it reads
the issuer's own ``documents``, classifies them against the credit-review source
categories (financials, credit agreement/indenture, offering memo, covenant/
compliance), scores coverage, logs the gaps, and notes EDGAR XBRL availability.
So a fresh issuer reports "0 documents vaulted; EDGAR available for <ticker>" —
not another issuer's source pack.

It is an assessment, not a gate: it raises no blocking findings (gaps are
limitation flags), and its confidence reflects coverage so a thin pack reads as
Insufficient rather than Committee Ready.
"""

from __future__ import annotations

from typing import Optional, Set

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import Document, DocumentChunk, Issuer
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload

# category -> (doc_type substrings, file-name substrings). Best-effort, broadened
# by file name so EDGAR-pulled and uploaded docs both classify.
_CATEGORIES = {
    "financials": (("audit", "edgar-xbrl"), ("financ", "10-k", "10k", "annual", "audited", "xbrl")),
    "agreement": (("sfa", "indenture"), ("agreement", "indenture", "facilit")),
    "offering": (("prospectus",), ("offering", "prospectus", "memorandum")),
    "covenant": (("covenant",), ("covenant", "compliance", "certificate")),
}
_LABEL = {
    "financials": "financial statements",
    "agreement": "credit agreement / indenture",
    "offering": "offering memorandum / prospectus",
    "covenant": "covenant / compliance documents",
}

# Content markers found in the document *head*, so a real SEC filing / exhibit
# classifies by what it IS — not its (accession-number) file name. Real filings are
# named e.g. "0000950170-25-077138.pdf" / "EX-10.1.pdf", which match no name cue.
_CONTENT_MARKERS = {
    "financials": ("form 10-k", "form 10-q", "annual report pursuant to section 13",
                   "quarterly report pursuant to section 13", "consolidated balance sheet",
                   "consolidated statements of operations",
                   "consolidated financial statements", "condensed consolidated",
                   "statement of financial position", "statement of profit or loss",
                   "income statement", "annual report", "quarterly report"),
    "agreement": ("credit agreement", "indenture", "facility agreement",
                  "senior facilities agreement", "loan agreement", "exhibit 10.",
                  "exhibit 10", "ex-10", "ex10"),
    "offering": ("offering memorandum", "preliminary prospectus", "prospectus supplement",
                 "information memorandum"),
    "covenant": ("compliance certificate", "financial covenant", "covenant compliance"),
}


def _categorize(doc: Document, head: str = "") -> Set[str]:
    """Classify a document by doc_type / file name (cheap) and, crucially, by the
    content of its head — so SEC filings named by accession number still classify.

    Analyst memos (``doc_type == 'analyst-memo'``) short-circuit to no category:
    they are analyst commentary, never a source filing, regardless of what terms
    the commentary mentions (a memo discussing "credit agreement" / "10-K" must
    not count toward source-coverage readiness). See ``engine/memochunks.py`` and
    RT-2026-07-07-15."""
    if (doc.doc_type or "").lower() == "analyst-memo":
        return set()
    dt, fn, ct = (doc.doc_type or "").lower(), (doc.file_name or "").lower(), head.lower()
    return {
        cat for cat, (types, names) in _CATEGORIES.items()
        if any(t in dt for t in types) or any(n in fn for n in names)
        or any(mk in ct for mk in _CONTENT_MARKERS.get(cat, ()))
    }


async def synthesize_source_readiness(session: AsyncSession, issuer: Issuer) -> ModulePayload:
    docs = (await session.execute(
        select(Document).where(Document.issuer_id == issuer.id)
    )).scalars().all()

    # ponytail: fetch every doc's head chunk in ONE query instead of a per-document
    # SELECT in the loop (was an N+1 = issuer doc count). First row per document_id
    # in (document_id, seq) order is its lowest-seq head chunk.
    heads: dict = {}
    if docs:
        rows = (await session.execute(
            select(DocumentChunk.document_id, DocumentChunk.text)
            .where(
                DocumentChunk.document_id.in_([d.id for d in docs]),
                DocumentChunk.seq < 3
            )
            .order_by(DocumentChunk.document_id, DocumentChunk.seq)
        )).all()
        heads_list: dict[str, list[str]] = {}
        for did, text in rows:
            if did not in heads_list:
                heads_list[did] = []
            heads_list[did].append(text)
        heads = {did: "\n".join(texts) for did, texts in heads_list.items()}

    present: Set[str] = set()
    doc_map: list = []
    for d in docs:
        head = heads.get(d.id, "")
        cats = _categorize(d, head)
        present |= cats
        doc_map.append({
            "doc": d.id[:8], "name": d.file_name, "type": d.doc_type,
            "categories": sorted(_LABEL[c] for c in cats) or ["unclassified"],
        })
    n = len(docs)
    missing = [c for c in _CATEGORIES if c not in present]
    coverage = round(len(present) / len(_CATEGORIES), 2)
    # Mirror CP-1's executable EDGAR predicate. A ticker alone is only a possible
    # mapping; without the configured SEC fair-access user agent the source lane
    # is deliberately disabled and CP-0 must not promise XBRL grounding.
    edgar = bool((issuer.ticker or "").strip() and get_settings().edgar_user_agent.strip())

    if n == 0:
        confidence = "Insufficient Information"
    elif len(present) >= 3:
        confidence = "High"
    else:
        confidence = "Medium"

    gap_log = [{"id": f"G-{i + 1:02d}", "severity": "warning", "text": f"No {_LABEL[c]} vaulted."}
               for i, c in enumerate(missing)]
    if n == 0 and edgar:
        gap_log.append({
            "id": "G-EDGAR", "severity": "low",
            "text": (f"No documents vaulted; SEC EDGAR XBRL is available for ticker "
                     f"{issuer.ticker} — CP-1 can ground on reported financials.")})

    runtime = {
        "readiness_score": coverage,
        "files_classified": n,
        "categories_present": sorted(present),
        "categories_missing": missing,
        "edgar_available": edgar,
        "document_map": doc_map[:12],
        "gap_log": gap_log,
    }

    claims = []
    if n:
        chunk: Optional[str] = (await session.execute(
            select(DocumentChunk.id)
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(Document.issuer_id == issuer.id).limit(1)
        )).scalar_one_or_none()
        summary = (f"{n} source document{'s' if n != 1 else ''} vaulted covering "
                   f"{', '.join(_LABEL[c] for c in sorted(present)) or 'no key credit category'}; "
                   + ("all key credit categories present." if not missing
                      else f"missing: {', '.join(_LABEL[c] for c in missing)}."))
        claims = [ClaimSpec(
            claim_id="C-RDY1", claim_text=summary,
            evidence=[EvidenceSpec("E-RDY1", "documentary_fact", "Directly Sourced",
                                   "Issuer document vault (CP-0 intake)", "High",
                                   resolved_chunk_id=chunk)],
        )]

    return ModulePayload(
        module_id="CP-0", module_name="SourceReadiness",
        owned_object="source_readiness_assessment",
        runtime_output=runtime, confidence=confidence,
        limitation_flags=[g["text"] for g in gap_log],
        downstream_consumers=["CP-X", "CP-1"], claims=claims,
    )
