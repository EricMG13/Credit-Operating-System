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

from sqlalchemy import delete
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import (
    Claim, EvidenceItem, Issuer, MetricFact,
    ModuleOutput, QAFinding, Run,
)
from engine import budget, presets
from engine.bindings import RunContext, resolve_binding
from engine.fixtures import DEMO_FIXTURE_LIMITATION, REFERENCE_ISSUER_ID, demo_fixture_finding
from engine.adjusted import reconciliation_finding
from engine.council import get_reviewer
from engine.covenants import addback_cap_finding, covlite_finding
from engine.earnings import monitoring_finding
from engine.peers import peer_outlier_finding
from engine.metrics import (
    cp1_completeness_finding,
    cp1_grounding_finding,
    extract_cost_facts,
    extract_facts,
    leverage_magnitude_finding,
    leverage_plausibility_finding,
)
from engine.gate import (
    Finding,
    cap_committee_status_for_blocked_upstream,
    committee_status_from,
    qa_status_from,
    roll_up_qa_status,
    worst_confidence,
)
from engine.lineage import _SOURCED_TYPES, validate_lineage
from engine.planner import BLOCKED as ROUTE_BLOCKED, EXCLUDED as ROUTE_EXCLUDED, RoutePlan, build_route_plan
from engine.registry import REGISTRY, all_specs
from engine.schemas import ModulePayload, validate_payload
from engine.synth import SynthesisError, get_synthesizer, prompt_corpus_fingerprint
from retrieval import build_issuer_index, rank_with_index

logger = logging.getLogger("caos.engine")


class RetryableRunTransactionError(RuntimeError):
    """A session-bound synthesizer invalidated the run transaction."""

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
# the metric store for peers; CP-3C reads the bound portfolio's positions.
# Derived from the registry (ModuleSpec.session_bound), not hardcoded: a new
# session-using synthesizer declares the flag where the module is declared, so
# it can never be silently fanned out concurrently on the shared AsyncSession.
_SESSION_SYNTH = {m.module_id for m in REGISTRY.values() if m.session_bound}


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
    placed = set()
    layers: List[List[str]] = []
    remaining = list(module_ids)
    while remaining:
        # Layering honors BOTH edge kinds: depends_on (hard, also input-gated)
        # and after (soft ordering only) — so a module scheduled ``after`` its
        # corpus feeds actually sees them in ``upstream`` at synth time, without
        # the input gate blocking it when a soft feed is Blocked (SPEC-1/2).
        layer = [
            m for m in remaining
            if all(d in placed
                   for d in (*REGISTRY[m].depends_on, *getattr(REGISTRY[m], "after", ()))
                   if d in in_set)
        ]
        if not layer:
            # The registry is asserted to be a DAG; an empty layer with modules
            # still remaining means a dependency cycle. Fail loudly instead of
            # running them in arbitrary order (which degraded to silent
            # input-gate "Blocked" cascades — a non-DAG should surface, not hide). C3.
            raise RuntimeError(f"CP-X registry dependency cycle among: {sorted(remaining)}")
        placed.update(layer)
        layers.append(layer)
        remaining = [m for m in remaining if m not in placed]
    return layers


def _blocked_ancestors(
    module_id: str, blocked: frozenset, memo: Dict[str, frozenset]
) -> frozenset:
    """The set of ``blocked`` modules ``module_id`` transitively depends on, walked
    over the registry DAG. Empty when nothing upstream is Blocked. Memoized across
    the run's modules; the ``memo`` guard also tolerates a stray cycle (the registry
    is a validated DAG, so this is defense-in-depth, not a live case)."""
    if module_id in memo:
        return memo[module_id]
    memo[module_id] = frozenset()  # cycle guard: in-progress nodes contribute nothing
    spec = REGISTRY.get(module_id)
    if not spec:
        return frozenset()
    acc = set()
    for dep in spec.depends_on:
        if dep in blocked:
            acc.add(dep)
        acc.update(_blocked_ancestors(dep, blocked, memo))
    result = frozenset(acc)
    memo[module_id] = result
    return result


def _apply_blocked_upstream_cascade(
    analytical_ids: Sequence[str],
    module_status: Dict[str, str],
    output_rows: Dict[str, ModuleOutput],
) -> None:
    """CP-5D cascade: cap every module that transitively depends on a post-gate
    ``Blocked`` module at ``Restricted`` (committee usability only — ``qa_status``
    stays honest) and append a limitation flag naming the compromised upstream. Only
    ``Blocked`` cascades (a merely-Restricted upstream is a softer signal not worth
    the noise); a Blocked module and modules with no Blocked ancestor are untouched.
    In-place mutation of the persisted ``ModuleOutput`` rows (already added to the
    session) — the JSON ``limitation_flags`` is *reassigned*, not appended in place,
    so SQLAlchemy tracks the change."""
    blocked = frozenset(m for m in analytical_ids if module_status.get(m) == "Blocked")
    if not blocked:
        return
    memo: Dict[str, frozenset] = {}
    for mid in analytical_ids:
        if mid in blocked:
            continue
        ancestors = _blocked_ancestors(mid, blocked, memo)
        if not ancestors:
            continue
        row = output_rows.get(mid)
        if row is None:
            continue
        row.committee_status = cap_committee_status_for_blocked_upstream(row.committee_status)
        flag = (
            f"Rests on QA-Blocked upstream: {', '.join(sorted(ancestors))}. "
            "Not committee-ready until the upstream clears."
        )
        if flag not in (row.limitation_flags or []):
            row.limitation_flags = list(row.limitation_flags or []) + [flag]


def _provider_degradation_finding(degraded: bool) -> Finding | None:
    """Turn a provider fallback into a CP-5 gate input, not just UI copy."""
    if not degraded:
        return None
    return Finding(
        finding_id="PROVIDER-FALLBACK",
        severity="MATERIAL",
        lane=8,
        module_id="CP-1",
        description=(
            "One or more LLM calls used a cheaper fallback after a provider "
            "rate limit or overload; the run was not produced under its pinned "
            "model route."
        ),
        required_remediation=(
            "Re-run when the pinned provider route is healthy before committee release."
        ),
    )


async def execute_run(session: AsyncSession, run: Run) -> None:  # noqa: C901  # 283-line orchestrator; decompose (QA phase + fact projection) when next touched
    """Execute the slice for ``run`` in place; sets status and gate roll-up.

    Synchronous for the slice (deterministic and easy to test); a queue/worker
    is a later concern. The caller's session commits the result.
    """
    run.status = "running"
    settings = get_settings()
    enabled_module_flags = frozenset(
        flag for flag in ("caos_cp_4d_enabled", "caos_cp_2g_enabled")
        if bool(getattr(settings, flag, False))
    )
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
    issuer_index = await build_issuer_index(
        session, run.issuer_id, document_ids=run.input_document_ids
    )

    async def retrieve(query: str, k: int = 5):
        return rank_with_index(issuer_index, query, k)

    upstream: Dict[str, ModulePayload] = {}
    module_status: Dict[str, str] = {}
    output_rows: Dict[str, ModuleOutput] = {}
    # CRITICAL lane-7 GATE findings from structurally Blocked modules — folded
    # into the CP-5 clearance payload so it can never read PASSED/CRITICAL:0
    # while a module (and the run roll-up) is Blocked (audit 2026-07-10 QA-6).
    structural_findings: List[Finding] = []
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
                ctx = RunContext(
                    module_id=module_id, session=session, issuer=issuer,
                    issuer_name=issuer_name, synthesizer=synthesizer, upstream=upstream,
                    retrieve=retrieve, portfolio_id=run.portfolio_id,
                )
                return await resolve_binding(ctx)
            except SynthesisError as e:
                return e
            except SQLAlchemyError as exc:
                if module_id in _SESSION_SYNTH:
                    # The shared AsyncSession may now require rollback. Do not
                    # convert this into a persistable Blocked payload and keep
                    # using a poisoned transaction; abort the run attempt so the
                    # executor's failure path rolls it back.
                    logger.exception("session-bound synth database failure for %s", module_id)
                    raise RetryableRunTransactionError(
                        f"session-bound synthesis failed for {module_id}"
                    ) from exc
                logger.exception("unexpected database error for pure synth %s", module_id)
                return SynthesisError("unexpected database error during synthesis")
            except Exception as e:  # noqa: BLE001 — isolate the fault to this module
                logger.exception("unexpected synth error for %s", module_id)
                return SynthesisError(f"unexpected synth error: {e}")

    async def _persist_synth_result(module_id: str, result) -> None:
        """Validate -> propagate flags -> resolve evidence -> persist one synth
        result. Sequential (single AsyncSession): the fan-in after a layer's
        concurrent synthesis."""
        if isinstance(result, SynthesisError):
            logger.warning("synthesis failed for %s: %s", module_id, result)
            output_rows[module_id], gate_f = _persist_blocked(
                session, run.id, module_id, f"Synthesis failed: {result}",
                severity="CRITICAL" if REGISTRY[module_id].run_blocking else "MATERIAL",
            )
            structural_findings.append(gate_f)
            module_status[module_id] = "Blocked"
            return
        payload = result
        errors = validate_payload(payload)
        if errors:
            logger.warning("payload validation failed for %s: %s", module_id, errors)
            output_rows[module_id], gate_f = _persist_blocked(
                session, run.id, module_id,
                "Payload failed schema validation: " + "; ".join(errors),
                validation_status="Blocked",
                severity="CRITICAL" if REGISTRY[module_id].run_blocking else "MATERIAL",
            )
            structural_findings.append(gate_f)
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
        if payload.runtime_output.get("module_status") == "Blocked":
            row = output_rows[module_id]
            row.qa_status = "Blocked"
            row.committee_status = "Blocked"
            reason = str(payload.runtime_output.get("status_basis") or f"{module_id} source gate blocked")
            gate_f = _gate_finding(
                module_id,
                reason,
                severity="CRITICAL" if REGISTRY[module_id].run_blocking else "MATERIAL",
            )
            structural_findings.append(gate_f)
            session.add(QAFinding(
                run_id=run.id, module_id=gate_f.module_id, finding_id=gate_f.finding_id,
                severity=gate_f.severity, lane=gate_f.lane, description=gate_f.description,
                required_remediation=gate_f.required_remediation,
            ))
            module_status[module_id] = "Blocked"
            return
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
                output_rows[module_id], gate_f = _persist_blocked(
                    session, run.id, module_id, reason,
                    severity="CRITICAL" if REGISTRY[module_id].run_blocking else "MATERIAL",
                )
                structural_findings.append(gate_f)
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
        plan = build_route_plan(cp0_payload, all_specs(enabled_module_flags))
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
        # Deterministic per-module finding providers the CP-5 gate consumes
        # alongside lineage findings. Table-driven: nine copy-pasted blocks used
        # to live here, and a pasted-wrong upstream key silently fed a check the
        # wrong module's payload (the finding just never fired). Declare the
        # (provider, module) pair once; the loop cannot drift.
        _FINDING_PROVIDERS = (
            (reconciliation_finding, "CP-1"),      # reported-vs-adjusted recon
            (covlite_finding, "CP-4C"),
            (addback_cap_finding, "CP-4C"),
            (monitoring_finding, "CP-1B"),
            (peer_outlier_finding, "CP-1C"),
            (leverage_plausibility_finding, "CP-1"),
            (leverage_magnitude_finding, "CP-1"),
            (cp1_grounding_finding, "CP-1"),
            # CP-5 numeric-completeness lane: a confident-but-empty CP-1 must not
            # ship committee-ready just because it raised no severity findings (the
            # gate has no numeric check of its own).
            (cp1_completeness_finding, "CP-1"),
        )
        for provider, module_id in _FINDING_PROVIDERS:
            f = provider(upstream.get(module_id))
            if f is not None:
                findings.append(f)
        if run.input_snapshot_state == "unapproved" or (
            run.input_snapshot_state in {None, "empty"} and synthesizer.name == "live"
        ):
            findings.append(Finding(
                finding_id="RUN-INPUT-AUTHORITY",
                severity="MATERIAL",
                lane=7,
                # CP-1 is the first committee-bearing consumer. A CP-0-only
                # finding is persisted but never participates in the analytical
                # module gate or run roll-up.
                module_id="CP-1",
                description=(
                    "The run input corpus is not fully covered by ready, "
                    "analyst-ratified source manifests."
                ),
                required_remediation=(
                    "Ratify the exact source manifests and create a new run so "
                    "its immutable input snapshot can be committee-released."
                ),
            ))
        provider_fallback = _provider_degradation_finding(run_budget.degraded)
        if provider_fallback is not None:
            findings.append(provider_fallback)
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
        reviewer = get_reviewer()
        council = await reviewer.review(produced)
        for f in council:
            session.add(QAFinding(
                run_id=run.id, module_id=f.module_id, finding_id=f.finding_id,
                severity=f.severity, lane=f.lane, description=f.description,
                affected_claim_id=f.affected_claim_id,
                required_remediation=f.required_remediation,
            ))
        findings = findings + council  # the CP-5 gate consumes lineage + council
        await _persist_cp5c(
            session, run.id, produced, council,
            review_meta=getattr(reviewer, "last_review_meta", None),
        )

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

        # ── CP-5D: post-gate committee-status cascade ─────────────────────
        # CP-5B/CP-5C run AFTER synthesis, so a lineage/council CRITICAL can turn a
        # module Blocked *after* its dependents already consumed its output. Those
        # dependents' own evidence may pass, leaving them "Committee Ready" while
        # resting on a Blocked foundation — a wrong-read on the money path. A
        # structurally input-gated module already Blocked its dependents, so this only
        # bites the post-gate case.
        _apply_blocked_upstream_cascade(analytical_ids, module_status, output_rows)

        await _persist_cp5(session, run.id, findings + structural_findings, module_status)

        # ── Project structured metric facts (run-derived, for cross-issuer NL query) ──
        # A gate-Blocked CP-1/CP-2 (CP-5 emitted an unresolved CRITICAL — e.g. an
        # evidence-unsupported headline claim) must NOT project metric facts: they
        # would enter another issuer's cross-issuer peer medians as if QA-passed.
        # Fail closed — skip the write. The retention delete below is likewise
        # gated on a real write, so a Blocked re-run keeps the last QA-passed facts
        # rather than wiping them. Defense-in-depth read-filter: peers._peer_facts.
        cp1 = upstream.get("CP-1")
        cp1_facts: List[dict] = []
        if cp1 is not None and output_rows["CP-1"].qa_status != "Blocked":
            # is_reference_issuer gates fixture provenance: the genuine ATLF demo keeps
            # "fixture"; the same fixture served for any other issuer is tagged the
            # non-authoritative "demo_fixture" (#10).
            is_ref = run.issuer_id == REFERENCE_ISSUER_ID
            cp1_facts = extract_facts(
                run.id, cp1, output_rows["CP-1"].qa_status, is_reference_issuer=is_ref
            )
            for fact in cp1_facts:
                session.add(MetricFact(issuer_id=run.issuer_id, **fact))
        cp2 = upstream.get("CP-2")
        cp2_facts: List[dict] = []
        if cp2 is not None and output_rows["CP-2"].qa_status != "Blocked":
            cp2_facts = extract_cost_facts(run.id, cp2, output_rows["CP-2"].qa_status)
            for fact in cp2_facts:
                session.add(MetricFact(issuer_id=run.issuer_id, **fact))

        # Retention (DATA-1): the cross-issuer query only uses the latest run's
        # facts per issuer, so supersede older run-derived rows for this issuer
        # rather than letting them accumulate unbounded. Seed facts are untouched.
        #
        # Gated on cp1_facts/cp2_facts (an ACTUAL write this run), not on
        # cp1_ok/cp2_ok (merely "not Blocked") — a not-Blocked module can still
        # legitimately extract zero facts (e.g. a CP-1 with no finite headline
        # metric that isn't confident enough to trip cp1_completeness_finding).
        # Scoped per module_id too: CP-1 succeeding must not sweep CP-2's own
        # untouched prior facts (or vice versa) — each module only supersedes
        # its own earlier rows, and only when it actually wrote a replacement.
        # Both conditions matter: the old `if cp1_ok or cp2_ok` fired the ONE
        # shared delete whenever either module merely wasn't Blocked, which
        # could wipe a module's last-known-good facts down to nothing even
        # though this run wrote no replacement for them (confidence-review).
        if cp1_facts:
            await session.execute(
                delete(MetricFact).where(
                    MetricFact.issuer_id == run.issuer_id,
                    MetricFact.module_id == "CP-1",
                    # #04 fixture + #10 demo_fixture facts supersede too, so a non-demo
                    # issuer's fabricated fixture rows don't accumulate across re-runs.
                    MetricFact.provenance.in_(("run", "fixture", "demo_fixture")),
                    MetricFact.run_id != run.id,
                )
            )
        if cp2_facts:
            await session.execute(
                delete(MetricFact).where(
                    MetricFact.issuer_id == run.issuer_id,
                    MetricFact.module_id == "CP-2",
                    MetricFact.provenance.in_(("run", "fixture", "demo_fixture")),
                    MetricFact.run_id != run.id,
                )
            )

        # ── Run-level roll-up ─────────────────────────────────────────────
        rollup_ids = [
            m for m in analytical_ids
            if m in module_status and REGISTRY[m].run_blocking
        ]
        statuses = [module_status[m] for m in rollup_ids]
        run.qa_status = roll_up_qa_status(statuses)
        run.committee_status = committee_status_from(
            run.qa_status,
            worst_confidence([
                upstream[m].confidence for m in rollup_ids if m in upstream
            ]),
        )
        run.tokens_used = run_budget.used
        if run_budget.budget_exhausted:
            run.error = "Degraded: Ran out of LLM token budget. Some analytical modules were skipped."
        elif run_budget.degraded:
            run.error = "Degraded: LLM rate limits/overloads forced fallback to cheaper models."
        else:
            run.error = None
        run.status = "complete"
        run.completed_at = _now()
        # A run created without an explicit as_of_date (keyless/demo runs never
        # supply one) must not stay null forever — every consumer that reads
        # run.as_of_date (model_service period selection, vault_export history
        # ordering, querygraph labels, the freshness/profile surfaces) treats
        # null as "unknown", which is wrong once the run has actually produced
        # output. Backfill with the completion date; never overwrite an
        # analyst-declared as_of_date.
        if not run.as_of_date:
            run.as_of_date = run.completed_at.date().isoformat()
    except Exception:
        logger.exception("run %s failed", run.id)
        run.status = "failed"
        run.tokens_used = run_budget.used
        raise


def _persist_blocked(
    session: AsyncSession, run_id: str, module_id: str, reason: str,
    *, validation_status: str = "Not Executed", severity: str = "CRITICAL",
) -> Tuple[ModuleOutput, Finding]:
    """Record a module that could not run, plus its structural gate finding.

    Returns the Finding too so execute_run can fold it into the CP-5 clearance
    payload: these GATE findings used to be written straight to the QAFinding
    table and never reach the ``findings`` list CP-5 counts — a run with a
    structurally Blocked module could persist a CP-5 payload reading
    ``clearance: PASSED, CRITICAL: 0`` while run.qa_status was Blocked
    (audit 2026-07-10 QA-6)."""
    row = ModuleOutput(
        run_id=run_id, module_id=module_id, module_name=module_id,
        owned_object="", runtime_output={"blocked_reason": reason},
        confidence="Insufficient Information", qa_status="Blocked",
        committee_status="Blocked", validation_status=validation_status,
        limitation_flags=[reason],
    )
    session.add(row)
    finding = _gate_finding(module_id, reason, severity=severity)
    session.add(QAFinding(
        run_id=run_id, module_id=finding.module_id, finding_id=finding.finding_id,
        severity=finding.severity, lane=finding.lane, description=finding.description,
        required_remediation=finding.required_remediation,
    ))
    return row, finding


def _gate_finding(module_id: str, reason: str, *, severity: str) -> Finding:
    return Finding(
        finding_id=f"{module_id}-GATE", severity=severity, lane=7,
        module_id=module_id, description=reason,
        required_remediation="Resolve the upstream or schema failure and re-run the module.",
    )


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
    # Two flushes per module, not one per claim: add every Claim, flush once to
    # materialize all their PKs, then add the EvidenceItems — the old per-claim
    # flush cost a serial DB round trip per claim across every module of every run.
    claims = [
        Claim(module_output_id=row.id, claim_id=c.claim_id, claim_text=c.claim_text)
        for c in payload.claims
    ]
    session.add_all(claims)
    if claims:
        await session.flush()
    for c, claim in zip(payload.claims, claims):
        for e in c.evidence:
            session.add(EvidenceItem(
                claim_pk=claim.id, evidence_id=e.evidence_id,
                extraction_type=e.extraction_type, lineage_class=e.lineage_class,
                source_locator=e.source_locator, document_chunk_id=e.resolved_chunk_id,
                confidence=e.confidence,
            ))
    return row


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


_DRIVER_MODULE_ORDER = (
    "CP-6A", "CP-6E", "CP-4C", "CP-4D", "CP-4", "CP-3B", "CP-3D",
    "CP-3", "CP-2B", "CP-2E", "CP-2", "CP-1B", "CP-1C", "CP-1A",
    "CP-1", "CP-2C", "CP-2D", "CP-2F", "CP-2G", "CP-3C", "CP-0",
)
_DRIVER_CONFIDENCE = {
    "High": 0.95,
    "Medium": 0.75,
    "Low": 0.50,
    "Insufficient Information": 0.25,
}
_WEAK_DRIVER_LINEAGE = {"Weak Lineage", "Untraced", "Conflicting", "Insufficient Information"}


def _build_driver_register(
    produced: List[ModulePayload], findings: List[Finding], *, limit: int = 5
) -> List[Dict]:
    """Select a bounded, evidence-carrying decision-driver register.

    The ordering is intentionally disclosed as a deterministic decision-proximity
    heuristic, not a measured market-materiality score. Module diversity wins the
    first pass; only then can a second claim from the same module fill a spare slot.
    """
    order = {module_id: rank for rank, module_id in enumerate(_DRIVER_MODULE_ORDER)}
    candidates = [
        (order.get(payload.module_id, len(order)), payload_index, claim_index, payload, claim)
        for payload_index, payload in enumerate(produced)
        for claim_index, claim in enumerate(payload.claims)
    ]
    candidates.sort(key=lambda item: item[:3])

    selected = []
    selected_keys = set()
    seen_modules = set()
    for candidate in candidates:
        module_id = candidate[3].module_id
        if module_id in seen_modules:
            continue
        selected.append(candidate)
        selected_keys.add((candidate[1], candidate[2]))
        seen_modules.add(module_id)
        if len(selected) == limit:
            break
    if len(selected) < limit:
        for candidate in candidates:
            key = (candidate[1], candidate[2])
            if key in selected_keys:
                continue
            selected.append(candidate)
            selected_keys.add(key)
            if len(selected) == limit:
                break

    register: List[Dict] = []
    for rank, (_, _, _, payload, claim) in enumerate(selected, start=1):
        evidence_ids = list(dict.fromkeys(e.evidence_id for e in claim.evidence if e.evidence_id))
        locators = list(dict.fromkeys(
            e.source_locator.strip() for e in claim.evidence
            if e.source_locator and e.source_locator.strip()
        ))
        matching_findings = [
            finding for finding in findings
            if finding.module_id == payload.module_id
            and (finding.affected_claim_id is None or finding.affected_claim_id == claim.claim_id)
        ]
        weak_lineage = not claim.evidence or any(
            evidence.lineage_class in _WEAK_DRIVER_LINEAGE for evidence in claim.evidence
        )
        confidence = min(
            (_DRIVER_CONFIDENCE.get(evidence.confidence, 0.25) for evidence in claim.evidence),
            default=0.0,
        )
        lineage_tail = f"{payload.module_id} · {claim.claim_id}"
        lineage = " → ".join([*locators[:2], lineage_tail]) if locators else f"No source locator → {lineage_tail}"
        register.append({
            "rank": rank,
            "driver": claim.claim_text,
            "module_id": payload.module_id,
            "claim_id": claim.claim_id,
            "lineage": lineage,
            "confidence": confidence,
            "status": "open" if matching_findings or weak_lineage else "verified",
            "evidence_ids": evidence_ids,
            "qa_findings": [finding.finding_id for finding in matching_findings],
        })
    return register


async def _persist_cp5b(
    session: AsyncSession, run_id: str, produced: List[ModulePayload], findings: List[Finding]
) -> None:
    total_claims = sum(len(p.claims) for p in produced)
    weak = sum(1 for f in findings if f.lane == 6)
    driver_register = _build_driver_register(produced, findings)
    session.add(ModuleOutput(
        run_id=run_id, module_id="CP-5B", module_name="EvidenceTraceValidator",
        owned_object="evidence_trace_validation", confidence="High",
        qa_status="Passed", committee_status="Committee Ready", validation_status="Passed",
        runtime_output={
            "claims_traced": total_claims,
            "weak_lineage_flags": weak,
            "orphan_claims": sum(1 for f in findings if f.lane == 1),
            "auditability": "STRONG" if weak == 0 else "QUALIFIED",
            "selection_basis": (
                "Decision-proximity plus module diversity; deterministic review ordering, "
                "not a market-materiality score."
            ),
            "driver_register": driver_register,
        },
        downstream_consumers=["CP-5"],
    ))


async def _persist_cp5c(
    session: AsyncSession, run_id: str, produced: List[ModulePayload], findings: List[Finding],
    *, review_meta: Optional[Dict] = None,
) -> None:
    """Record the committee review as an auditable module output (show your work).

    Always Passed/Committee Ready as a *process* record — it attests what the
    review DID; the findings it raised gate the analytical modules, not this
    row. When the council is disabled this records a clean, zero-seat pass.

    ``review_meta`` (from the reviewer's ``last_review_meta``) discloses actual
    execution: an ENABLED council whose fan-out was skipped (token budget
    exhausted) or whose seats all failed used to persist ``enabled: true,
    findings: all-zero`` — indistinguishable from "reviewed and clean"
    (audit 2026-07-10 QA-4). The record now carries executed/requested seat
    counts and a skip reason, so "not assessed" never reads as "passed".
    """
    counts = {"CRITICAL": 0, "MATERIAL": 0, "MINOR": 0}
    for f in findings:
        counts[f.severity] = counts.get(f.severity, 0) + 1
    settings = get_settings()
    seats = min(max(0, settings.council_seats), 4) if settings.council_enabled else 0
    meta = review_meta or {}
    session.add(ModuleOutput(
        run_id=run_id, module_id="CP-5C", module_name="SemanticCommitteeReview",
        owned_object="committee_review", confidence="High",
        qa_status="Passed", committee_status="Committee Ready", validation_status="Passed",
        runtime_output={
            "enabled": bool(settings.council_enabled),
            "seats": seats,
            "review_execution": {
                "requested_seats": meta.get("requested_seats", seats),
                "executed_seats": meta.get("executed_seats", 0),
                "failed_seats": meta.get("failed_seats", 0),
                "skipped_reason": meta.get("skipped_reason"),
            },
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
