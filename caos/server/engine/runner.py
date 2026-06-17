"""The module runner — routes via CP-X and enforces the gate.

Flow: run CP-0 (source readiness) first, then **CP-X** ([planner.py]) consumes it
with the module registry ([registry.py]) to build a route plan — a
dependency-ordered execution sequence, per-module readiness verdicts,
one-owner-per-object validation, and limitation propagation. The runner persists
the plan as the CP-X module output, then executes the routed modules in the
plan's order (input gate -> retrieve -> synthesize -> validate -> persist). A QA
phase runs CP-5B (lineage) and CP-5C (committee review) over the produced
outputs; CP-5 (the deterministic gate) rolls the findings up into per-module and
run-level status.

CP-X replaces the previously hardcoded slice/dependencies: which analytical
modules run, and in what order, is now derived from CP-0 + the registry. Modules
without a wired synthesizer are routed and shown as ``Not Implemented`` but never
executed.
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
from engine import budget, edgar_cp1, reported_cp1
from engine.fixtures import REFERENCE_ISSUER_ID
from engine.adjusted import reconciliation_finding, synthesize_adjusted
from engine.council import get_reviewer
from engine.covenants import covlite_finding, synthesize_covenants
from engine.capstructure import synthesize_capital_structure
from engine.catalysts import synthesize_catalysts
from engine.debate import synthesize_debate
from engine.downside import synthesize_downside
from engine.legal import synthesize_legal_review
from engine.liquidity import synthesize_liquidity
from engine.macro import synthesize_macro
from engine.portfoliofit import synthesize_portfolio_fit
from engine.refinancing import synthesize_refinancing
from engine.relval import synthesize_relative_value
from engine.sponsor import synthesize_sponsor_review
from engine.coststructure import synthesize_cost_structure
from engine.earnings import monitoring_finding, synthesize_earnings_delta
from engine.peers import peer_outlier_finding, synthesize_peer_benchmark
from engine.readiness import synthesize_source_readiness
from engine.metrics import extract_cost_facts, extract_facts
from engine.gate import (
    Finding,
    committee_status_from,
    qa_status_from,
    roll_up_qa_status,
    worst_confidence,
)
from engine.lineage import validate_lineage
from engine.planner import BLOCKED as ROUTE_BLOCKED, EXCLUDED as ROUTE_EXCLUDED, RoutePlan, build_route_plan
from engine.registry import REGISTRY
from engine.schemas import ModulePayload, validate_payload
from engine.synth import SynthesisError, get_synthesizer
from retrieval import build_issuer_index, rank_with_index

logger = logging.getLogger("caos.engine")

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

    # P4-2: build the issuer's BM25 index once, then score every retrieve() call
    # (per module + per claim) against it — the corpus is tokenized once, not
    # re-tokenized on every call.
    issuer_index = await build_issuer_index(session, run.issuer_id)

    async def retrieve(query: str, k: int = 5):
        return rank_with_index(issuer_index, query, k)

    upstream: Dict[str, ModulePayload] = {}
    module_status: Dict[str, str] = {}
    output_rows: Dict[str, ModuleOutput] = {}
    plan: Optional[RoutePlan] = None

    async def _synthesize_module(module_id: str) -> ModulePayload:
        """Dispatch one module to its wired synthesizer (the engine's slice)."""
        # CP-0 reads the issuer's own vaulted documents (no fixture), so a fresh
        # issuer reports its real source pack, not a canned one.
        if module_id == "CP-0" and issuer is not None:
            return await synthesize_source_readiness(session, issuer)
        # CP-2 is a deterministic, document-grounded module (no fixture / LLM) so
        # it derives from the issuer's own sources for any issuer.
        if module_id == "CP-2":
            return await synthesize_cost_structure(issuer_name, retrieve)
        # CP-1 prefers a deterministic EDGAR reported foundation for any public
        # filer, falling back to the LLM/fixture synthesizer.
        if module_id == "CP-1":
            return await _synthesize_cp1(
                session, issuer, issuer_name, synthesizer, upstream, retrieve
            )
        # CP-1A reconciles CP-1's reported leverage against the disclosed add-backs.
        if module_id == "CP-1A":
            return await synthesize_adjusted(upstream["CP-1"], retrieve)
        # CP-1B is a pure period-over-period delta off CP-1 (no docs/LLM).
        if module_id == "CP-1B":
            return synthesize_earnings_delta(upstream["CP-1"])
        # CP-1C benchmarks the issuer vs peers from the metric store.
        if module_id == "CP-1C" and issuer is not None:
            return await synthesize_peer_benchmark(session, issuer, upstream["CP-1"])
        # CP-4C computes covenant capacity / headroom against CP-1's leverage.
        if module_id == "CP-4C":
            return await synthesize_covenants(upstream["CP-1"], retrieve)
        # CP-2B stresses CP-1's leverage/coverage into downside pathways.
        if module_id == "CP-2B":
            return await synthesize_downside(upstream["CP-1"])
        # CP-2C registers forward catalysts from upstream monitoring signals.
        if module_id == "CP-2C":
            return await synthesize_catalysts(upstream)
        # CP-2D scans offering/governance text for sponsor red flags.
        if module_id == "CP-2D":
            return await synthesize_sponsor_review(retrieve)
        # CP-2E scans financial/agreement text for liquidity sources, and prices
        # the runway against CP-1's cash interest.
        if module_id == "CP-2E":
            return await synthesize_liquidity(retrieve, upstream.get("CP-1"))
        # CP-2F stresses CP-1's debt stack for base-rate sensitivity.
        if module_id == "CP-2F":
            return await synthesize_macro(upstream["CP-1"])
        # CP-3 scores the issuer's fundamentals vs peers from CP-1C.
        if module_id == "CP-3":
            return await synthesize_relative_value(upstream["CP-1C"])
        # CP-3B scans agreement/offering text for the debt tranches.
        if module_id == "CP-3B":
            return await synthesize_capital_structure(retrieve)
        # CP-3C maps CP-3's RV recommendation to a portfolio sleeve/sizing.
        if module_id == "CP-3C":
            return await synthesize_portfolio_fit(upstream["CP-3"], upstream.get("CP-1"))
        # CP-3D scores refinancing/LME vulnerability from leverage + fragility.
        if module_id == "CP-3D":
            return await synthesize_refinancing(upstream["CP-1"], upstream.get("CP-2B"))
        # CP-4 scans ingested agreement/covenant text for aggressive provisions.
        if module_id == "CP-4":
            return await synthesize_legal_review(retrieve)
        # CP-6A/6E are the L6 adversarial debate over the produced upstream outputs.
        if module_id in ("CP-6A", "CP-6E"):
            return await synthesize_debate(module_id, upstream)
        return await synthesizer.synthesize(
            module_id, issuer_name=issuer_name, upstream=upstream, retrieve=retrieve
        )

    async def _attempt(module_id: str) -> None:
        """Input gate -> synthesize -> validate -> persist for one module."""
        spec = REGISTRY.get(module_id)
        deps = spec.depends_on if spec is not None else ()
        blocked_dep = next(
            (d for d in deps if module_status.get(d) in (None, "Blocked")), None
        )
        if blocked_dep is not None:
            output_rows[module_id] = _persist_blocked(
                session, run.id, module_id,
                f"Input gate: required upstream {blocked_dep} is missing or Blocked.",
            )
            module_status[module_id] = "Blocked"
            return

        try:
            payload = await _synthesize_module(module_id)
        except SynthesisError as e:
            logger.warning("synthesis failed for %s: %s", module_id, e)
            output_rows[module_id] = _persist_blocked(
                session, run.id, module_id, f"Synthesis failed: {e}"
            )
            module_status[module_id] = "Blocked"
            return

        errors = validate_payload(payload)
        if errors:
            logger.warning("payload validation failed for %s: %s", module_id, errors)
            output_rows[module_id] = _persist_blocked(
                session, run.id, module_id,
                "Payload failed schema validation: " + "; ".join(errors),
                validation_status="Blocked",
            )
            module_status[module_id] = "Blocked"
            return

        # CP-X limitation propagation: carry CP-0 source-gap flags onto the module.
        if plan is not None:
            for flag in plan.propagated_flags(module_id):
                if flag not in payload.limitation_flags:
                    payload.limitation_flags.append(flag)
        await _resolve_evidence(payload, retrieve)
        output_rows[module_id] = await _persist_output(
            session, run.id, payload, validation_status="Passed"
        )
        upstream[module_id] = payload
        module_status[module_id] = "Pending"

    try:
        # ── CP-0: source readiness (always first; CP-X routes off it) ──────
        await _attempt("CP-0")

        # ── CP-X: build and persist the route plan ────────────────────────
        cp0_payload = upstream.get("CP-0") or ModulePayload(
            module_id="CP-0", module_name="SourceReadiness",
            owned_object="source_readiness_assessment", runtime_output={},
            confidence="Insufficient Information",
        )
        plan = build_route_plan(cp0_payload)
        await _persist_cpx(session, run.id, plan)

        # ── Routed analytical modules (CP-X-ordered) ──────────────────────
        # The implemented modules CP-X routes, in dependency order. Spec-only
        # (Not Implemented) and ownership-excluded modules are shown in the route
        # plan but never executed.
        routed = [
            r.module_id for r in plan.readiness
            if r.module_id != "CP-0"
            and REGISTRY[r.module_id].implemented
            and r.readiness != ROUTE_EXCLUDED
        ]
        for module_id in routed:
            if plan.verdict(module_id) == ROUTE_BLOCKED:
                output_rows[module_id] = _persist_blocked(
                    session, run.id, module_id,
                    plan.blocking_reason(module_id) or "Blocked by CP-X route plan.",
                )
                module_status[module_id] = "Blocked"
                continue
            await _attempt(module_id)

        analytical_ids = ["CP-0"] + routed
        produced = [upstream[m] for m in analytical_ids if m in upstream]

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
        monitor = monitoring_finding(upstream.get("CP-1B"))
        if monitor is not None:
            findings.append(monitor)
        peer = peer_outlier_finding(upstream.get("CP-1C"))
        if peer is not None:
            findings.append(peer)
        for f in findings:
            session.add(QAFinding(
                run_id=run.id, module_id=f.module_id, finding_id=f.finding_id,
                severity=f.severity, lane=f.lane, description=f.description,
                affected_claim_id=f.affected_claim_id, required_remediation=f.required_remediation,
            ))
        await _persist_cp5b(session, run.id, produced, findings)

        # ── CP-5C: semantic committee review (opt-in; emits findings) ─────
        # An ensemble of adversarial reviewer seats reads the produced payloads
        # and flags reasoning the lineage pass cannot see. It only *produces*
        # findings; the deterministic CP-5 gate below still decides status. No-op
        # (no token cost) unless council_enabled and a key are set.
        council = await get_reviewer().review(produced)
        for f in council:
            session.add(QAFinding(
                run_id=run.id, module_id=f.module_id, finding_id=f.finding_id,
                severity=f.severity, lane=f.lane, description=f.description,
                affected_claim_id=f.affected_claim_id,
                required_remediation=f.required_remediation,
            ))
        findings = findings + council  # the CP-5 gate consumes lineage + council
        await _persist_cp5c(session, run.id, produced, council)

        # ── CP-5: the deterministic gate ──────────────────────────────────
        for mid in analytical_ids:
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
        statuses = [module_status[m] for m in analytical_ids if m in module_status]
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
    # Non-EDGAR issuers (non-US / IFRS, no SEC XBRL): try a reported-disclosure CP-1
    # from the issuer's own quarterly investor report / earnings before the LLM/fixture
    # path. Its evidence already resolves to the source (uploaded) chunk.
    #
    # The reference/demo issuer is excluded: its docs are stub text with curated
    # fixture financials, so the thin headline-only reported extractor would preempt
    # the rich fixture (offline) or a full LLM spread (live) with a single number.
    if issuer is None or issuer.id != REFERENCE_ISSUER_ID:
        reported = await reported_cp1.build_reported_cp1_payload(issuer_name, retrieve)
        if reported is not None:
            logger.info("CP-1 grounded in issuer-disclosed reported metrics for %s", issuer_name)
            return reported
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


def _cpx_confidence(gate_status: str) -> str:
    return {"Full Run": "High", "Ready with Limitations": "Medium"}.get(gate_status, "Low")


async def _persist_cpx(session: AsyncSession, run_id: str, plan: RoutePlan) -> None:
    """Record the CP-X route plan as an auditable orchestration output.

    CP-X owns ``route_plan`` (one-owner-per-object): it routes and governs, it
    does not analyse, so it is never gated (always a Passed process record) and
    is excluded from the run-level roll-up. The plan it carries — the execution
    sequence, readiness verdicts, ownership validation, and limitation
    propagation — is the orchestrator's "show your work".
    """
    session.add(ModuleOutput(
        run_id=run_id, module_id="CP-X", module_name="PlannerRouter",
        owned_object="route_plan", schema_family="Infrastructure",
        confidence=_cpx_confidence(plan.gate_status),
        qa_status="Passed", committee_status="Committee Ready", validation_status="Passed",
        runtime_output=plan.to_runtime_output(),
        downstream_consumers=plan.routed_module_ids(),
    ))


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


async def _persist_cp5c(
    session: AsyncSession, run_id: str, produced: List[ModulePayload], findings: List[Finding]
) -> None:
    """Record the committee review as an auditable module output (show your work).

    Always Passed/Committee Ready as a *process* record — it attests the review
    ran; the findings it raised gate the analytical modules, not this row. When
    the council is disabled this records a clean, zero-seat pass.
    """
    counts = {"CRITICAL": 0, "MATERIAL": 0, "MINOR": 0}
    for f in findings:
        counts[f.severity] = counts.get(f.severity, 0) + 1
    settings = get_settings()
    seats = min(max(0, settings.council_seats), 4) if settings.council_enabled else 0
    session.add(ModuleOutput(
        run_id=run_id, module_id="CP-5C", module_name="SemanticCommitteeReview",
        owned_object="committee_review", confidence="High",
        qa_status="Passed", committee_status="Committee Ready", validation_status="Passed",
        runtime_output={
            "enabled": bool(settings.council_enabled),
            "seats": seats,
            "peer_round": bool(settings.council_enabled and settings.council_peer_round),
            "modules_reviewed": [p.module_id for p in produced],
            "findings_by_severity": counts,
            "issue_log": [
                {"id": f.finding_id, "severity": f.severity, "lane": f.lane,
                 "module": f.module_id, "claim": f.affected_claim_id,
                 "finding": f.description}
                for f in findings
            ],
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
