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
from typing import Dict, List, Optional, Sequence, Tuple

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import (
    Claim, Document, DocumentChunk, EvidenceItem, Issuer, MetricFact,
    ModuleOutput, QAFinding, Run,
)
from engine import budget, edgar_cp1, presets, reported_cp1
from engine.fixtures import DEMO_FIXTURE_LIMITATION, REFERENCE_ISSUER_ID, demo_fixture_finding
from engine.adjusted import reconcile_adjusted_ebitda, reconciliation_finding
from engine.factpack import synthesize_fact_pack
from engine.council import get_reviewer
from engine.covenants import covlite_finding, synthesize_covenants
from engine.capstructure import synthesize_recovery_preference
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
from engine.metrics import extract_cost_facts, extract_facts, leverage_plausibility_finding
from engine.gate import (
    Finding,
    committee_status_from,
    qa_status_from,
    roll_up_qa_status,
    worst_confidence,
)
from engine.lineage import _SOURCED_TYPES, validate_lineage
from engine.planner import BLOCKED as ROUTE_BLOCKED, EXCLUDED as ROUTE_EXCLUDED, RoutePlan, build_route_plan
from engine.registry import REGISTRY
from engine.schemas import ModulePayload, validate_payload
from engine.synth import SynthesisError, get_synthesizer, prompt_corpus_fingerprint
from retrieval import build_issuer_index, rank_with_index

logger = logging.getLogger("caos.engine")

# Human-readable methodology label. The persisted ``run.prompt_version`` appends a
# content fingerprint of the active-prompt corpus actually used (see _stamp_prompt_
# version) so editing any ACTIVE_PROMPT.md changes the stamped version — runs stay
# reproducible from metadata instead of all reading a stale hand-bumped "v2.0".
PROMPT_VERSION = "v2.0"


def _stamp_prompt_version(synthesizer_name: str) -> str:
    """``run.prompt_version`` for this run: the human label plus a fingerprint of the
    active-prompt corpus (live) — or a ``+fixture`` marker offline, where the corpus
    prompts are not read and the deterministic fixtures produce the output. Kept under
    the prompt_version String(32) column so no schema change is needed (database.py is
    owned by another agent)."""
    if synthesizer_name == "live":
        return f"{PROMPT_VERSION}+{prompt_corpus_fingerprint()}"
    return f"{PROMPT_VERSION}+fixture"

# The only analytical synthesizers that read/write the AsyncSession during
# synthesis. An AsyncSession is not safe for concurrent use, so these run
# serially within their layer while the pure (retrieve-only) modules fan out.
# CP-0 reads the issuer's vaulted docs; CP-1 may vault EDGAR XBRL; CP-1C reads
# the metric store for peers.
_SESSION_SYNTH = {"CP-0", "CP-1", "CP-1C"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _dependency_layers(module_ids: Sequence[str]) -> List[List[str]]:
    """Group ``module_ids`` into CP-X dependency layers: layer N holds the modules
    whose in-set registry deps are all in layers < N. Modules with no in-set deps
    land in layer 0. Within a layer no module depends on another, so a layer's
    synthesis can run concurrently; input order (topological) is preserved inside a
    layer so execution stays deterministic. Deps outside the set (CP-0, Not
    Implemented, Excluded) don't gate layering — the runner's input gate does."""
    in_set = set(module_ids)
    placed: Dict[str, int] = {}
    layers: List[List[str]] = []
    remaining = list(module_ids)
    while remaining:
        layer = [
            m for m in remaining
            if all(d in placed for d in REGISTRY[m].depends_on if d in in_set)
        ]
        if not layer:
            # The registry is asserted to be a DAG; an empty layer with modules
            # still remaining means a dependency cycle. Fail loudly instead of
            # running them in arbitrary order (which degraded to silent
            # input-gate "Blocked" cascades — a non-DAG should surface, not hide). C3.
            raise RuntimeError(f"CP-X registry dependency cycle among: {sorted(remaining)}")
        for m in layer:
            placed[m] = len(layers)
        layers.append(layer)
        remaining = [m for m in remaining if m not in placed]
    return layers


async def synthesize_module(  # noqa: C901  # pre-existing multi-branch dispatcher; decompose the dispatch table when reworked
    module_id: str, session: AsyncSession, issuer: Optional[Issuer],
    issuer_name: str, synthesizer, upstream: Dict[str, ModulePayload], retrieve,
) -> ModulePayload:
    """Dispatch one module to its wired synthesizer (the engine's slice). Reads run
    state (issuer / upstream / retrieve) but writes none, so a layer's pure-synth
    modules run concurrently; the if-chain wires each module's own arg shape."""
    # CP-0 reads the issuer's own vaulted documents (no fixture), so a fresh
    # issuer reports its real source pack, not a canned one.
    if module_id == "CP-0" and issuer is not None:
        return await synthesize_source_readiness(session, issuer)
    # CP-2 = FundamentalCreditSynthesizer. Live mode runs the corpus Active Prompt
    # (full qualitative synthesis grounded in retrieved chunks + upstream); the
    # offline/fixture path falls back to the deterministic cost-structure read, so
    # the engine stays fully exercisable without a model key.
    if module_id == "CP-2":
        if synthesizer.name == "live":
            return await synthesizer.synthesize(
                "CP-2", issuer_name=issuer_name, upstream=upstream, retrieve=retrieve
            )
        return await synthesize_cost_structure(issuer_name, retrieve)
    # CP-1 prefers a deterministic EDGAR reported foundation for any public
    # filer, falling back to the LLM/fixture synthesizer; then it embeds the
    # reported-vs-adjusted (add-back) reconciliation it adjusts.
    if module_id == "CP-1":
        cp1 = await _synthesize_cp1(
            session, issuer, issuer_name, synthesizer, upstream, retrieve
        )
        # The add-back reconciliation strips a "% of adjusted EBITDA" haircut off
        # CP-1's EBITDA, so it is only correct when that EBITDA is the *adjusted*
        # (marketed) figure — the fixture / live-LLM basis. On a REPORTED basis
        # (EDGAR XBRL or issuer-disclosed) the EBITDA already excludes those
        # add-backs, so re-stripping them double-counts and manufactures a
        # worse-than-reported "deleveraging gap" — a provenance violation
        # ("reported is canonical"). Skip it there; the reported EBITDA already
        # carries its own limitation flag. The marketed-vs-reported bridge would
        # need the inverse math (E/(1-pct)) and is a separate deliberate feature.
        basis = (cp1.runtime_output or {}).get("basis")
        if basis not in ("reported_gaap_xbrl", "reported_disclosure"):
            res = await reconcile_adjusted_ebitda(cp1, retrieve)
            if res is not None:
                recon, claim = res
                (cp1.runtime_output or {})["adjusted_ebitda_reconciliation"] = recon
                cp1.claims.append(claim)
        return cp1
    # CP-1A is the BusinessTransactionFactPack: scan offering/transaction text.
    if module_id == "CP-1A":
        return await synthesize_fact_pack(retrieve)
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
    # CP-2F stresses CP-1's debt stack for base-rate sensitivity and scans for an
    # interest-rate hedge register / FX exposure.
    if module_id == "CP-2F":
        return await synthesize_macro(upstream["CP-1"], retrieve)
    # CP-3 scores the issuer's fundamentals vs peers from CP-1C.
    if module_id == "CP-3":
        return await synthesize_relative_value(upstream["CP-1C"])
    # CP-3B scans agreement/offering text for the debt tranches, then waterfalls
    # CP-1's distressed EV over them for expected recovery / instrument preference.
    if module_id == "CP-3B":
        return await synthesize_recovery_preference(retrieve, upstream.get("CP-1"))
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


async def execute_run(session: AsyncSession, run: Run) -> None:  # noqa: C901  # 283-line orchestrator; decompose (QA phase + fact projection) when next touched
    """Execute the slice for ``run`` in place; sets status and gate roll-up.

    Synchronous for the slice (deterministic and easy to test); a queue/worker
    is a later concern. The caller's session commits the result.
    """
    run.status = "running"
    settings = get_settings()
    # H-1: seed from tokens already spent on prior attempts so run_token_budget is
    # a CUMULATIVE per-run cap, not a per-attempt one. A re-claimed run (worker
    # death → QueueWorker re-claim, up to caos_run_max_attempts) would otherwise
    # restart the budget at 0 and re-bill every module, spending up to N× the cap.
    run_budget = budget.RunBudget(limit=settings.run_token_budget, used=run.tokens_used or 0)
    budget.set_budget(run_budget)  # consulted by every LLM module this run
    budget.set_run_id(run.id)      # M-1: tags every caos.llm trace line with this run
    # Apply the analyst's model mode for this run's lanes. The run executes in a
    # worker task (outside the creating request), and a re-claim runs in yet
    # another, so the mode is read off the persisted row each time — never the
    # request context. (engine/presets.py)
    presets.set_mode(run.model_mode)
    synthesizer = get_synthesizer()
    # Pin the actual heavy-lane model the mode selected (reproducibility).
    run.model_id = presets.model_for(presets.HEAVY) if synthesizer.name == "live" else "fixture"
    run.prompt_version = _stamp_prompt_version(synthesizer.name)

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

    sem = asyncio.Semaphore(max(1, settings.synth_concurrency))

    def _block_reason(module_id: str) -> Optional[str]:
        """Why ``module_id`` can't run now, or None if it's runnable: a CP-X
        route-plan block, or a required upstream that is missing/Blocked (the input
        gate)."""
        if plan is not None and plan.verdict(module_id) == ROUTE_BLOCKED:
            return plan.blocking_reason(module_id) or "Blocked by CP-X route plan."
        spec = REGISTRY.get(module_id)
        deps = spec.depends_on if spec is not None else ()
        blocked_dep = next(
            (d for d in deps if module_status.get(d) in (None, "Blocked")), None
        )
        if blocked_dep is not None:
            return f"Input gate: required upstream {blocked_dep} is missing or Blocked."
        return None

    async def _attempt_synth(module_id: str):
        """Synthesize one module; return its payload or a SynthesisError. No DB
        writes here, so pure-synth modules in a layer run concurrently on the
        shared session. Any unexpected exception (e.g. a malformed live CP-1 shape
        making a downstream module raise TypeError) is caught and converted to a
        SynthesisError so it degrades to the per-module Blocked gate — it must NOT
        propagate out of asyncio.gather and abort the whole run, discarding the
        already-completed peers in this layer."""
        async with sem:
            try:
                return await synthesize_module(
                    module_id, session, issuer, issuer_name,
                    synthesizer, upstream, retrieve,
                )
            except SynthesisError as e:
                return e
            except Exception as e:  # noqa: BLE001 — isolate the fault to this module
                logger.exception("unexpected synth error for %s", module_id)
                return SynthesisError(f"unexpected synth error: {e}")

    async def _persist_synth_result(module_id: str, result) -> None:
        """Validate -> propagate flags -> resolve evidence -> persist one synth
        result. Sequential (single AsyncSession): the fan-in after a layer's
        concurrent synthesis."""
        if isinstance(result, SynthesisError):
            logger.warning("synthesis failed for %s: %s", module_id, result)
            output_rows[module_id] = _persist_blocked(
                session, run.id, module_id, f"Synthesis failed: {result}"
            )
            module_status[module_id] = "Blocked"
            return
        payload = result
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
        await _resolve_evidence(payload, retrieve, suppress_sourced=(synthesizer.name == "live"))
        output_rows[module_id] = await _persist_output(
            session, run.id, payload, validation_status="Passed"
        )
        upstream[module_id] = payload
        module_status[module_id] = "Pending"

    async def _run_layer(layer: List[str]) -> None:
        """Run one CP-X dependency layer. Gate the un-runnable first (sequential DB
        writes), then synthesize the rest — session-touching modules serially, the
        pure ones concurrently — and persist every result in deterministic order.
        Within a layer no module depends on another, so concurrent synthesis is
        safe; persistence is always sequential on the single session."""
        runnable: List[str] = []
        for module_id in layer:
            reason = _block_reason(module_id)
            if reason is not None:
                output_rows[module_id] = _persist_blocked(session, run.id, module_id, reason)
                module_status[module_id] = "Blocked"
            else:
                runnable.append(module_id)
        results: List[Tuple[str, object]] = []
        for module_id in (m for m in runnable if m in _SESSION_SYNTH):
            results.append((module_id, await _attempt_synth(module_id)))
        parallel = [m for m in runnable if m not in _SESSION_SYNTH]
        if parallel:
            # ponytail: concurrent synth can let two modules pass llm_allowed() before
            # either records usage, overshooting run_token_budget by ~one call — fine,
            # the budget is a runaway guard, not a hard cap. Tighten only if it matters.
            gathered = await asyncio.gather(*(_attempt_synth(m) for m in parallel))
            results.extend(zip(parallel, gathered))
        for module_id, result in results:
            await _persist_synth_result(module_id, result)

    try:
        # ── CP-0: source readiness (always first; CP-X routes off it) ──────
        # plan is still None, so _run_layer treats CP-0 as a plain runnable (no
        # route-block), synthesizes it on the session, and persists it.
        await _run_layer(["CP-0"])

        # ── CP-X: build and persist the route plan ────────────────────────
        cp0_payload = upstream.get("CP-0") or ModulePayload(
            module_id="CP-0", module_name="SourceReadiness",
            owned_object="source_readiness_assessment", runtime_output={},
            confidence="Insufficient Information",
        )
        plan = build_route_plan(cp0_payload)
        await _persist_cpx(session, run.id, plan)

        # ── Routed analytical modules, executed in dependency LAYERS ───────
        # CP-X already ordered the DAG; modules in the same layer have no
        # dependency on each other, so their synthesis fans out concurrently and
        # the layer's wall-clock approaches its slowest module, not the sum.
        # Spec-only (Not Implemented) and ownership-excluded modules are shown in
        # the route plan but never executed.
        routed = [
            r.module_id for r in plan.readiness
            if r.module_id != "CP-0"
            and REGISTRY[r.module_id].implemented
            and r.readiness != ROUTE_EXCLUDED
        ]
        for layer in _dependency_layers(routed):
            await _run_layer(layer)

        analytical_ids = ["CP-0"] + routed
        produced = [upstream[m] for m in analytical_ids if m in upstream]

        # ── CP-5B: evidence lineage validation ───────────────────────────
        findings = validate_lineage(produced)
        # CP-1's embedded reported-vs-adjusted reconciliation → an informational
        # finding the deterministic CP-5 gate consumes alongside lineage findings.
        recon = reconciliation_finding(upstream.get("CP-1"))
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
        lev_plaus = leverage_plausibility_finding(upstream.get("CP-1"))
        if lev_plaus is not None:
            findings.append(lev_plaus)
        # #10: the keyless fixture path serves the ATLF demo numbers for ANY issuer.
        # For a non-demo issuer that is fabricated data persisted under provenance
        # "run"-adjacent — flag it as a MATERIAL finding (→ Restricted) and surface a
        # limitation on the CP-1 row so the synthetic origin is unmistakable.
        demo_fix = demo_fixture_finding(run.issuer_id, upstream.get("CP-1"))
        if demo_fix is not None:
            findings.append(demo_fix)
            cp1_row = output_rows.get("CP-1")
            if cp1_row is not None and DEMO_FIXTURE_LIMITATION not in (cp1_row.limitation_flags or []):
                # Reassign (not in-place append) so the JSON column change is tracked.
                cp1_row.limitation_flags = list(cp1_row.limitation_flags or []) + [DEMO_FIXTURE_LIMITATION]
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
            # is_reference_issuer gates fixture provenance: the genuine ATLF demo keeps
            # "fixture"; the same fixture served for any other issuer is tagged the
            # non-authoritative "demo_fixture" (#10).
            is_ref = run.issuer_id == REFERENCE_ISSUER_ID
            for fact in extract_facts(
                run.id, cp1, output_rows["CP-1"].qa_status, is_reference_issuer=is_ref
            ):
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
                    # #04 fixture + #10 demo_fixture facts supersede too, so a non-demo
                    # issuer's fabricated fixture rows don't accumulate across re-runs.
                    MetricFact.provenance.in_(("run", "fixture", "demo_fixture")),
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


async def _resolve_evidence(payload: ModulePayload, retrieve, *, suppress_sourced: bool) -> None:
    """Link each claim's evidence to the best-matching ingested chunk via BM25.

    When ``suppress_sourced`` (the LIVE LLM path), a *sourced* citation
    (sourced_fact / quoted_text / table_value) the model did not already ground is
    left UNRESOLVED so CP-5B's 'unresolved sourced citation -> MINOR' lane
    ([lineage.py]) can fire — auto-anchoring an LLM-fabricated locator to the best
    claim-text match (the locator itself is never reconciled) would silently defeat
    that integrity check. Deterministic / fixture evidence (suppress_sourced=False)
    keeps the back-fill: its sources are curated and it depends on runtime
    resolution for click-to-source (a static payload can't know chunk ids).
    ponytail: claim-text match, not locator-aware — the proper fix resolves on the
    locator and flags a mismatch; do that if fabricated-but-plausible locators matter."""
    for c in payload.claims:
        hits = await retrieve(c.claim_text, 3)
        if not hits:
            continue
        top = hits[0].chunk_id
        for e in c.evidence:
            if e.resolved_chunk_id is None and not (suppress_sourced and e.extraction_type in _SOURCED_TYPES):
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
