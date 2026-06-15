"""The module runner — executes the analytical slice and enforces the gate.

Per module: input gate -> retrieve -> synthesize -> validate -> persist, then a
QA phase runs CP-5B (lineage) over the produced outputs and CP-5 (the
deterministic gate) rolls the findings up into per-module and run-level status.

The slice is CP-0 -> CP-1 (analytical) followed by CP-5B -> CP-5 (QA). CP-X's
full DAG routing is a later tier; here the order and dependencies are explicit.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import (
    Claim, Document, DocumentChunk, EvidenceItem, Issuer, MetricFact,
    ModuleOutput, QAFinding, Run,
)
from engine import budget, edgar_cp1
from engine.adjusted import reconciliation_finding, synthesize_adjusted
from engine.covenants import covlite_finding, synthesize_covenants
from engine.coststructure import synthesize_cost_structure
from engine.metrics import extract_cost_facts, extract_facts
from engine.gate import (
    Finding,
    committee_status_from,
    qa_status_from,
    roll_up_qa_status,
    worst_confidence,
)
from engine.lineage import validate_lineage
from engine.schemas import ModulePayload, validate_payload
from engine.synth import SynthesisError, get_synthesizer
from retrieval import retrieve as bm25_retrieve

logger = logging.getLogger("caos.engine")

ANALYTICAL_SLICE = ["CP-0", "CP-1", "CP-1A", "CP-2", "CP-4C"]
DEPENDENCIES: Dict[str, List[str]] = {
    "CP-0": [], "CP-1": ["CP-0"], "CP-1A": ["CP-1"], "CP-2": ["CP-1"], "CP-4C": ["CP-1"],
}
PROMPT_VERSION = "v2.0"


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def execute_run(session: AsyncSession, run: Run) -> None:
    """Execute the slice for ``run`` in place; sets status and gate roll-up.

    Synchronous for the slice (deterministic and easy to test); a queue/worker
    is a later concern. The caller's session commits the result.
    """
    run.status = "running"
    settings = get_settings()
    run_budget = budget.RunBudget(limit=settings.run_token_budget)
    budget.set_budget(run_budget)  # consulted by every LLM module this run
    synthesizer = get_synthesizer()
    run.model_id = settings.anthropic_model if synthesizer.name == "live" else "fixture"
    run.prompt_version = PROMPT_VERSION

    issuer = await session.get(Issuer, run.issuer_id)
    issuer_name = issuer.name if issuer else run.issuer_id

    async def retrieve(query: str, k: int = 5):
        return await bm25_retrieve(session, run.issuer_id, query, k)

    upstream: Dict[str, ModulePayload] = {}
    module_status: Dict[str, str] = {}
    output_rows: Dict[str, ModuleOutput] = {}

    try:
        # ── Analytical modules ───────────────────────────────────────────
        for module_id in ANALYTICAL_SLICE:
            blocked_dep = next(
                (d for d in DEPENDENCIES.get(module_id, [])
                 if module_status.get(d) in (None, "Blocked")),
                None,
            )
            if blocked_dep is not None:
                output_rows[module_id] = _persist_blocked(
                    session, run.id, module_id,
                    f"Input gate: required upstream {blocked_dep} is missing or Blocked.",
                )
                module_status[module_id] = "Blocked"
                continue

            try:
                # CP-2 is a deterministic, document-grounded module (no fixture /
                # LLM) so it derives from the issuer's own sources for any issuer.
                if module_id == "CP-2":
                    payload = await synthesize_cost_structure(issuer_name, retrieve)
                # CP-1 prefers a deterministic EDGAR reported foundation for any
                # public filer, falling back to the LLM/fixture synthesizer.
                elif module_id == "CP-1":
                    payload = await _synthesize_cp1(
                        session, issuer, issuer_name, synthesizer, upstream, retrieve
                    )
                # CP-1A reconciles CP-1's reported leverage against the disclosed
                # add-backs (deterministic / LLM over the issuer's documents).
                elif module_id == "CP-1A":
                    payload = await synthesize_adjusted(upstream["CP-1"], retrieve)
                # CP-4C computes covenant capacity / headroom against CP-1's
                # leverage from the issuer's governing documents.
                elif module_id == "CP-4C":
                    payload = await synthesize_covenants(upstream["CP-1"], retrieve)
                else:
                    payload = await synthesizer.synthesize(
                        module_id, issuer_name=issuer_name, upstream=upstream, retrieve=retrieve
                    )
            except SynthesisError as e:
                logger.warning("synthesis failed for %s: %s", module_id, e)
                output_rows[module_id] = _persist_blocked(
                    session, run.id, module_id, f"Synthesis failed: {e}"
                )
                module_status[module_id] = "Blocked"
                continue

            errors = validate_payload(payload)
            if errors:
                logger.warning("payload validation failed for %s: %s", module_id, errors)
                row = _persist_blocked(
                    session, run.id, module_id,
                    "Payload failed schema validation: " + "; ".join(errors),
                    validation_status="Blocked",
                )
                output_rows[module_id] = row
                module_status[module_id] = "Blocked"
                continue

            await _resolve_evidence(payload, retrieve)
            output_rows[module_id] = await _persist_output(
                session, run.id, payload, validation_status="Passed"
            )
            upstream[module_id] = payload
            module_status[module_id] = "Pending"

        produced = [upstream[m] for m in ANALYTICAL_SLICE if m in upstream]

        # ── CP-5B: evidence lineage validation ───────────────────────────
        findings = validate_lineage(produced)
        # CP-1A reported-vs-adjusted reconciliation → an informational finding
        # the deterministic CP-5 gate consumes alongside the lineage findings.
        recon = reconciliation_finding(upstream.get("CP-1A"))
        if recon is not None:
            findings.append(recon)
        covlite = covlite_finding(upstream.get("CP-4C"))
        if covlite is not None:
            findings.append(covlite)
        for f in findings:
            session.add(QAFinding(
                run_id=run.id, module_id=f.module_id, finding_id=f.finding_id,
                severity=f.severity, lane=f.lane, description=f.description,
                affected_claim_id=f.affected_claim_id, required_remediation=f.required_remediation,
            ))
        await _persist_cp5b(session, run.id, produced, findings)

        # ── CP-5: the deterministic gate ──────────────────────────────────
        for mid in ANALYTICAL_SLICE:
            if module_status.get(mid) == "Blocked":
                continue  # already gated by a structural failure
            mod_findings = [f for f in findings if f.module_id == mid]
            status = qa_status_from(mod_findings)
            row = output_rows[mid]
            row.qa_status = status
            row.committee_status = committee_status_from(status, row.confidence)
            module_status[mid] = status

        await _persist_cp5(session, run.id, findings, module_status)

        # ── Project structured metric facts (run-derived, for cross-issuer NL query) ──
        cp1 = upstream.get("CP-1")
        if cp1 is not None:
            for fact in extract_facts(run.id, cp1, output_rows["CP-1"].qa_status):
                session.add(MetricFact(issuer_id=run.issuer_id, **fact))
        cp2 = upstream.get("CP-2")
        if cp2 is not None:
            for fact in extract_cost_facts(run.id, cp2, output_rows["CP-2"].qa_status):
                session.add(MetricFact(issuer_id=run.issuer_id, **fact))

        # Retention (DATA-1): the cross-issuer query only uses the latest run's
        # facts per issuer, so supersede older run-derived rows for this issuer
        # rather than letting them accumulate unbounded. Seed facts are untouched.
        if cp1 is not None or cp2 is not None:
            await session.execute(
                delete(MetricFact).where(
                    MetricFact.issuer_id == run.issuer_id,
                    MetricFact.provenance == "run",
                    MetricFact.run_id != run.id,
                )
            )

        # ── Run-level roll-up ─────────────────────────────────────────────
        statuses = [module_status[m] for m in ANALYTICAL_SLICE if m in module_status]
        run.qa_status = roll_up_qa_status(statuses)
        run.committee_status = committee_status_from(
            run.qa_status, worst_confidence([p.confidence for p in produced])
        )
        run.tokens_used = run_budget.used
        run.status = "complete"
        run.completed_at = _now()
    except Exception:
        logger.exception("run %s failed", run.id)
        run.status = "failed"
        run.tokens_used = run_budget.used
        raise


def _persist_blocked(
    session: AsyncSession, run_id: str, module_id: str, reason: str,
    *, validation_status: str = "Not Executed",
) -> ModuleOutput:
    """Record a module that could not run, plus a CRITICAL structural finding."""
    row = ModuleOutput(
        run_id=run_id, module_id=module_id, module_name=module_id,
        owned_object="", runtime_output={"blocked_reason": reason},
        confidence="Insufficient Information", qa_status="Blocked",
        committee_status="Blocked", validation_status=validation_status,
        limitation_flags=[reason],
    )
    session.add(row)
    session.add(QAFinding(
        run_id=run_id, module_id=module_id, finding_id=f"{module_id}-GATE",
        severity="CRITICAL", lane=7, description=reason,
        required_remediation="Resolve the upstream or schema failure and re-run the module.",
    ))
    return row


async def _persist_output(
    session: AsyncSession, run_id: str, payload: ModulePayload, *, validation_status: str
) -> ModuleOutput:
    row = ModuleOutput(
        run_id=run_id, module_id=payload.module_id, module_name=payload.module_name,
        owned_object=payload.owned_object, schema_family=payload.schema_family,
        runtime_output=payload.runtime_output, confidence=payload.confidence,
        validation_status=validation_status, limitation_flags=payload.limitation_flags,
        downstream_consumers=payload.downstream_consumers,
    )
    session.add(row)
    await session.flush()  # assign row.id for claim FK
    for c in payload.claims:
        claim = Claim(module_output_id=row.id, claim_id=c.claim_id, claim_text=c.claim_text)
        session.add(claim)
        await session.flush()
        for e in c.evidence:
            session.add(EvidenceItem(
                claim_pk=claim.id, evidence_id=e.evidence_id,
                extraction_type=e.extraction_type, lineage_class=e.lineage_class,
                source_locator=e.source_locator, document_chunk_id=e.resolved_chunk_id,
                confidence=e.confidence,
            ))
    return row


async def _synthesize_cp1(
    session: AsyncSession, issuer: Optional[Issuer], issuer_name: str,
    synthesizer, upstream: Dict[str, ModulePayload], retrieve,
) -> ModulePayload:
    """CP-1 precedence: a deterministic EDGAR reported foundation for a public
    filer (cited to XBRL, no key) when EDGAR is configured and the issuer has a
    ticker; otherwise the LLM/fixture synthesizer. The EDGAR figures are vaulted
    as a chunk and the payload's evidence resolved to it, so CP-5B passes cleanly
    and click-to-source has a real source. The adjusted/covenant-EBITDA read is a
    separate layer (CP-4C) — EDGAR is the reported basis only."""
    settings = get_settings()
    if settings.edgar_user_agent.strip() and issuer is not None and issuer.ticker:
        build = await asyncio.to_thread(edgar_cp1.fetch_cp1, issuer.ticker, issuer_name)
        if build is not None:
            chunk_id = await _vault_edgar_facts(session, issuer, build.facts_text)
            for c in build.payload.claims:
                for e in c.evidence:
                    e.resolved_chunk_id = chunk_id
            logger.info("CP-1 grounded in EDGAR for %s (CIK %s)", issuer_name, build.cik)
            return build.payload
    return await synthesizer.synthesize(
        "CP-1", issuer_name=issuer_name, upstream=upstream, retrieve=retrieve
    )


async def _vault_edgar_facts(session: AsyncSession, issuer: Issuer, facts_text: str) -> str:
    """Idempotently vault the EDGAR XBRL extract as a single-chunk document for the
    issuer, returning the chunk id to anchor CP-1 evidence to. Re-runs refresh the
    chunk text in place rather than accumulating duplicates."""
    storage_key = f"edgar/{issuer.id}/xbrl_facts"
    doc = (await session.execute(
        select(Document).where(
            Document.issuer_id == issuer.id, Document.storage_key == storage_key
        )
    )).scalar_one_or_none()
    if doc is not None:
        chunk = (await session.execute(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == doc.id)
            .order_by(DocumentChunk.seq)
        )).scalars().first()
        if chunk is not None:
            chunk.text = facts_text
            await session.flush()
            return chunk.id
    else:
        doc = Document(
            issuer_id=issuer.id, doc_type="EDGAR-XBRL",
            file_name="sec_edgar_xbrl_facts.txt", storage_key=storage_key,
            chunk_count=1, uploaded_by="edgar-lane",
        )
        session.add(doc)
        await session.flush()
    chunk = DocumentChunk(document_id=doc.id, seq=0, text=facts_text)
    session.add(chunk)
    await session.flush()
    return chunk.id


async def _resolve_evidence(payload: ModulePayload, retrieve) -> None:
    """Link each claim's evidence to the best-matching ingested chunk via BM25."""
    for c in payload.claims:
        hits = await retrieve(c.claim_text, 3)
        if not hits:
            continue
        top = hits[0].chunk_id
        for e in c.evidence:
            if e.resolved_chunk_id is None:
                e.resolved_chunk_id = top


async def _persist_cp5b(
    session: AsyncSession, run_id: str, produced: List[ModulePayload], findings: List[Finding]
) -> None:
    total_claims = sum(len(p.claims) for p in produced)
    weak = sum(1 for f in findings if f.lane == 6)
    session.add(ModuleOutput(
        run_id=run_id, module_id="CP-5B", module_name="EvidenceTraceValidator",
        owned_object="evidence_trace_validation", confidence="High",
        qa_status="Passed", committee_status="Committee Ready", validation_status="Passed",
        runtime_output={
            "claims_traced": total_claims,
            "weak_lineage_flags": weak,
            "orphan_claims": sum(1 for f in findings if f.lane == 1),
            "auditability": "STRONG" if weak == 0 else "QUALIFIED",
        },
        downstream_consumers=["CP-5"],
    ))


async def _persist_cp5(
    session: AsyncSession, run_id: str, findings: List[Finding], module_status: Dict[str, str]
) -> None:
    counts = {"CRITICAL": 0, "MATERIAL": 0, "MINOR": 0}
    for f in findings:
        counts[f.severity] = counts.get(f.severity, 0) + 1
    clearance = "PASSED"
    if counts["CRITICAL"]:
        clearance = "BLOCKED"
    elif counts["MATERIAL"]:
        clearance = "CONDITIONAL"
    session.add(ModuleOutput(
        run_id=run_id, module_id="CP-5", module_name="ResearchIntegrityQA",
        owned_object="qa_clearance", confidence="High",
        qa_status="Passed", committee_status="Committee Ready", validation_status="Passed",
        runtime_output={
            "modules_audited": len([m for m in module_status]),
            "findings_by_severity": counts,
            "clearance": clearance,
            "issue_log": [
                {"id": f.finding_id, "severity": f.severity, "module": f.module_id,
                 "finding": f.description}
                for f in findings
            ],
        },
        downstream_consumers=["CP-RENDER", "CP-EXTRACT"],
    ))
