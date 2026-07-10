"""The module routing index — CP-X's authoritative view of the module graph.

This is the declarative source of truth that replaces the runner's hardcoded
``ANALYTICAL_SLICE`` + ``DEPENDENCIES``: one ``ModuleSpec`` per designed
analytical module, seeded from the corpus route graph
(``Modular OS/CP-X/SYSTEM_REFERENCE.md``). CP-X ([planner.py]) consumes it with
the CP-0 readiness assessment to build a route plan; the runner executes the
plan's order.

Two populations:

  - **Implemented** modules have a synthesizer wired in the runner today. Their
    ``owned_object`` is exactly what the synthesizer's payload emits, so the
    one-owner-per-object check validates real output. Names are canonical
    Taxonomy A (re-synced to the corpus 2026-06-20). Two notes: CP-2
    (FundamentalCreditSynthesizer) runs the full LLM synthesis in live mode and a
    deterministic cost-structure read offline; CP-1A is the BusinessTransactionFactPack
    and the adjusted-EBITDA bridge it used to own is folded into CP-1.
  - **Spec-only** modules (``implemented=False``) are the rest of the designed
    graph that have no synthesizer wired in the engine yet: the corpus L7 modules
    (CP-SR SectorReview, CP-MON CreditPulse) and the Infra modules (CP-RENDER,
    CP-EXTRACT) named in the CP-X route graph. CP-X routes to them and the planner
    marks them ``Not Implemented`` (engine.planner) so the route plan reflects the
    full corpus mesh honestly; they are never executed and never counted in the QA
    roll-up. Their ``owned_object`` is not validated by the one-owner check (that
    only runs over implemented modules), so where the corpus pins one we use it
    (sector_review, signal_register) and otherwise a sensible canonical name.

Layer ordering (Active Prompt / REF_CP-X_02): L0 -> Orch -> L1 -> L2 -> L3 ->
L4 -> L5/L6 -> Infra. CP-X (Orch) is the router itself and the infrastructure
modules (CP-5B/5C/5) are produced by the QA phase, so neither is a routed entry
here.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, FrozenSet, List, Tuple

# CP-0 source categories (must match engine.readiness._CATEGORIES keys).
FINANCIALS = "financials"
AGREEMENT = "agreement"
OFFERING = "offering"
COVENANT = "covenant"

# Layer execution precedence. Lower rank runs first. L7 (CP-SR/CP-MON, sector /
# monitoring) sits after L6 and before Infrastructure, per CP-X SYSTEM_REFERENCE
# "Layer Ordering": L0 → Orch → L1 → L2 → L3 → L4 → L5 → L6 → L7 → Infrastructure.
LAYER_RANK: Dict[str, int] = {
    "L0": 0, "Orch": 1, "L1": 2, "L2": 3, "L3": 4, "L4": 5, "L5": 6, "L6": 7,
    "L7": 8, "Infra": 9,
}


@dataclass(frozen=True)
class ModuleSpec:
    """One node in the module DAG."""

    module_id: str
    module_name: str
    layer: str
    owned_object: str
    depends_on: Tuple[str, ...] = ()
    # SOFT ordering edges: schedule this module in a LATER dependency layer than
    # these, WITHOUT input-gating on them. depends_on does double duty — it both
    # orders the layering AND blocks the module when the upstream is Blocked —
    # which forced a choice between two wrong graphs: declaring the corpus edge
    # blocked modules the spec says should merely degrade, and omitting it
    # co-scheduled them so upstream.get() read None at synth time (live CP-2
    # synthesized with only CP-1 of its four spec feeds — audit 2026-07-10
    # SPEC-1/2). ``after`` carries the pure ordering half of the corpus edge.
    after: Tuple[str, ...] = ()
    # CP-0 source categories that, when present, make the module Full Run.
    required_sources: FrozenSet[str] = field(default_factory=frozenset)
    implemented: bool = False
    # CP-1 alone can ground on SEC EDGAR XBRL when no financial-statement docs
    # are vaulted, so missing financials degrade it rather than block it.
    edgar_fallback: bool = False
    # When required sources are entirely absent (and no fallback applies), block
    # rather than degrade. Off by default: the wired synthesizers have fixture/
    # LLM fallbacks and never hard-fail on a thin pack — only their dependency
    # chain blocks them. Reserved for true input-gated modules.
    blocks_on_missing_sources: bool = False
    # This module's synthesizer reads/writes the shared AsyncSession during
    # synthesis (an AsyncSession is not safe for concurrent use), so the runner
    # executes it serially within its layer instead of in the parallel gather.
    # Declared HERE, next to the module, so a new session-using synthesizer
    # can't be silently fanned out concurrently because a runner-side set was
    # forgotten (the old hardcoded _SESSION_SYNTH failure mode).
    session_bound: bool = False

    @property
    def layer_rank(self) -> int:
        return LAYER_RANK.get(self.layer, 99)


# Declaration order is significant: within a layer it is the deterministic
# tie-breaker for the topological sort, and dependencies are declared before
# their dependents.
_SPECS: Tuple[ModuleSpec, ...] = (
    # ── L0 ────────────────────────────────────────────────────────────────
    ModuleSpec("CP-0", "SourceReadiness", "L0", "source_readiness_assessment",
               implemented=True, session_bound=True),
    # ── L1 — financial foundation ──────────────────────────────────────────
    ModuleSpec("CP-1", "CanonicalDataFoundation", "L1", "canonical_financials",
               depends_on=("CP-0",), required_sources=frozenset({FINANCIALS}),
               implemented=True, edgar_fallback=True, session_bound=True),
    # Corpus M2 fix: "CP-1 NOT downstream" (CP-1A/SYSTEM_REFERENCE.md — UP is
    # CP-0/CP-X only). The old depends_on=("CP-1",) declared exactly the
    # repudiated edge, so a Blocked CP-1 wrongly input-gated a module that needs
    # only offering docs (audit 2026-07-10 SPEC-2). The synthesizer reads no
    # CP-1 output (fact-pack text scan), so no ordering edge is needed either.
    ModuleSpec("CP-1A", "BusinessTransactionFactPack", "L1", "business_transaction_fact_register",
               required_sources=frozenset({OFFERING}),
               implemented=True),
    ModuleSpec("CP-1B", "EarningsDelta", "L1", "earnings_delta",
               depends_on=("CP-1",), implemented=True),
    ModuleSpec("CP-1C", "PeerBenchmark", "L1", "peer_benchmark",
               depends_on=("CP-1",), implemented=True, session_bound=True),
    # ── L2 — fundamental credit ────────────────────────────────────────────
    # CP-2 is the corpus "L2 hub" (SYSTEM_REFERENCE UP: CP-1, CP-1A, CP-1B,
    # CP-1C). Only CP-1 is a hard gate; the other three are soft ``after``
    # edges so live CP-2 synthesizes with the business facts / earnings delta /
    # peer benchmark in its UPSTREAM OUTPUTS instead of co-scheduling beside
    # them and reading None — the same starvation fixed for CP-2C/CP-3D/CP-6A
    # was never applied here (audit 2026-07-10 SPEC-1).
    ModuleSpec("CP-2", "CostStructure", "L2", "cost_structure",
               depends_on=("CP-1",), after=("CP-1A", "CP-1B", "CP-1C"),
               required_sources=frozenset({FINANCIALS}),
               implemented=True),
    # Corpus hard stop (CP_CANONICAL_STATE_RULES SEC4): CP-2B stops only when
    # CP-1 AND CP-2 are BOTH unavailable. Hard-gating on CP-2 turned that AND
    # into an OR (audit 2026-07-10 SPEC-2); CP-2 is a soft ordering edge — the
    # synthesizer reads only CP-1's financials.
    ModuleSpec("CP-2B", "DownsidePathway", "L2", "downside_pathway",
               depends_on=("CP-1",), after=("CP-2",),
               required_sources=frozenset({FINANCIALS}),
               implemented=True),
    # CP-2C derives catalysts from CP-1B (earnings) and CP-1C (peers) as well as
    # CP-1; they are declared deps so the layerer schedules CP-2C *after* them —
    # otherwise upstream.get("CP-1B"/"CP-1C") read None and the register is near
    # empty. See [catalysts.py].
    ModuleSpec("CP-2C", "EventCatalystRegister", "L2", "event_catalyst_register",
               depends_on=("CP-1", "CP-1B", "CP-1C"), implemented=True),
    ModuleSpec("CP-2D", "GovernanceSponsorScore", "L2", "sponsor_governance_review",
               depends_on=("CP-1",), required_sources=frozenset({OFFERING}),
               implemented=True),
    ModuleSpec("CP-2E", "LiquidityCashFlowBridge", "L2", "liquidity_maturity_analysis",
               depends_on=("CP-1",), required_sources=frozenset({FINANCIALS, AGREEMENT}),
               implemented=True),
    ModuleSpec("CP-2F", "MacroFXHedgingSensitivity", "L2", "macro_sector_overlay",
               depends_on=("CP-1",), implemented=True),
    # ── L3 — relative value ────────────────────────────────────────────────
    ModuleSpec("CP-3", "RelativeValueSecuritySelection", "L3", "relative_value_analysis",
               depends_on=("CP-1", "CP-1C"), implemented=True),
    # Corpus Input Gate 1 (CP-3B_ACTIVE_PROMPT): "CP-3 RV analysis must be
    # available … else Blocked". The old dep (CP-1) implemented neither the
    # spec gate nor the spec edge (UP: CP-3) — audit 2026-07-10 SPEC-3. CP-1 is
    # a soft ordering edge: the waterfall reads its EBITDA opportunistically
    # (upstream.get, degrades to seniority-only when absent).
    ModuleSpec("CP-3B", "RecoveryInstrumentPreference", "L3", "recovery_instrument_preference",
               depends_on=("CP-3",), after=("CP-1",),
               required_sources=frozenset({AGREEMENT}),
               implemented=True),
    ModuleSpec("CP-3C", "PortfolioFitPositionSizing", "L3", "portfolio_fit_analysis",
               depends_on=("CP-3", "CP-1"), implemented=True, session_bound=True),
    # CP-3D scores refinancing/LME vulnerability from CP-1 leverage *and* CP-2B
    # downside fragility; CP-2B is a declared dep so the layerer schedules CP-3D
    # after it (else upstream.get("CP-2B") is None and the fragility term is lost).
    ModuleSpec("CP-3D", "RefinancingLMERisk", "L3", "refinancing_lme_risk",
               depends_on=("CP-1", "CP-2B"), implemented=True),
    # ── L4 — legal / recovery ──────────────────────────────────────────────
    ModuleSpec("CP-4", "LegalCovenantInterpreter", "L4", "legal_covenant_review",
               depends_on=("CP-1",), required_sources=frozenset({AGREEMENT, COVENANT}),
               implemented=True),
    ModuleSpec("CP-4C", "CovenantCapacityCalculator", "L4", "covenant_capacity_calculation",
               depends_on=("CP-1",), required_sources=frozenset({AGREEMENT, COVENANT}),
               implemented=True),
    # ── L6 — adversarial debate ────────────────────────────────────────────
    # Deps are the wired upstreams the debate reads. CP-2B (downside fragility)
    # and CP-3 (peer fundamentals) are now implemented and routed, so they are
    # declared deps — otherwise the layerer co-schedules CP-6A with them and the
    # runtime upstream.get() reads return None on every run. CP-1B/CP-1C are read
    # opportunistically; CP-6A lands in a later layer via CP-3 (→CP-1C), so those
    # reads now resolve too. See [debate.py].
    ModuleSpec("CP-6A", "ICDebateChallenge", "L6", "ic_debate_challenge",
               depends_on=("CP-1", "CP-2", "CP-4C", "CP-2B", "CP-3", "CP-3C"), implemented=True),
    ModuleSpec("CP-6E", "PortfolioDebateChallenge", "L6", "portfolio_debate_challenge",
               depends_on=("CP-6A",), implemented=True),
    # ── Spec-only corpus modules (no engine synthesizer) ────────────────────
    # Registered so CP-X routes to them and the planner surfaces them as
    # "Not Implemented" — making the route plan reflect the full corpus mesh
    # (Modular OS/CP-X/SYSTEM_REFERENCE.md "Route Graph — All Modules") rather than
    # silently omitting them. implemented=False ⇒ never executed, never QA-counted.
    # Deps are declared-before (so the ordering invariant holds) and faithful to the
    # corpus: L7 sector/monitor read the analytical synthesis; Infra runs after all.
    # ── L7 — sector / monitoring ────────────────────────────────────────────
    ModuleSpec("CP-SR", "SectorReview", "L7", "sector_review",
               depends_on=("CP-2",), implemented=False),
    ModuleSpec("CP-MON", "CreditPulse", "L7", "signal_register",
               depends_on=("CP-2",), implemented=False),
    # ── Infra — render / extract (run after all analytical modules) ──────────
    # No owned_object const in the corpus schema for these; sensible canonical
    # snake_case names (never validated, since the one-owner check skips spec-only).
    ModuleSpec("CP-RENDER", "ReportRenderer", "Infra", "rendered_report",
               depends_on=("CP-6E",), implemented=False),
    ModuleSpec("CP-EXTRACT", "AppendixExtractor", "Infra", "extraction_envelope",
               depends_on=("CP-6E",), implemented=False),
)

REGISTRY: Dict[str, ModuleSpec] = {s.module_id: s for s in _SPECS}

# Declaration order (the topological tie-breaker), id -> index.
DECLARATION_INDEX: Dict[str, int] = {s.module_id: i for i, s in enumerate(_SPECS)}


def all_specs() -> List[ModuleSpec]:
    """The routing index in declaration order."""
    return list(_SPECS)


def _validate_registry() -> None:
    """Fail loud at import if the static module graph is malformed — a dangling
    ``depends_on`` id or a dependency cycle would otherwise surface as a confusing
    runtime ``upstream.get() is None`` or a non-terminating layer sort. Enforces the
    graph's own declared invariant (every dependency declared before its dependent,
    see the _SPECS note) — which also guarantees acyclicity, since a cycle cannot be
    forward-declared only. (review run-2 #B9/#B10)"""
    # A duplicated module_id would silently last-win in REGISTRY/DECLARATION_INDEX
    # and skew the planner's indegree bookkeeping (BE3-5) — fail loud instead.
    if len(REGISTRY) != len(_SPECS):
        dupes = sorted({s.module_id for s in _SPECS
                        if sum(x.module_id == s.module_id for x in _SPECS) > 1})
        raise ValueError(f"registry: duplicate module_id(s) {dupes}")
    for spec in _SPECS:
        # ``after`` edges join the same declared-before invariant: they feed the
        # runner's layering exactly like depends_on, so a forward or dangling
        # reference would admit the same cycle/None-read failure modes.
        for kind, edges in (("depends_on", spec.depends_on), ("after", spec.after)):
            for dep in edges:
                if dep not in REGISTRY:
                    raise ValueError(f"registry: {spec.module_id} {kind} unknown module {dep!r}")
                if DECLARATION_INDEX[dep] >= DECLARATION_INDEX[spec.module_id]:
                    raise ValueError(
                        f"registry: {spec.module_id} {kind} {dep!r} declared after it "
                        "— violates declared-before-dependent ordering (and would admit a cycle)")


_validate_registry()
