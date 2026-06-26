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
    graph. CP-X routes to them and marks them ``Not Implemented`` so the route
    plan reflects the full mesh honestly; they are never executed and never
    counted in the QA roll-up.

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

# Layer execution precedence. Lower rank runs first.
LAYER_RANK: Dict[str, int] = {
    "L0": 0, "Orch": 1, "L1": 2, "L2": 3, "L3": 4, "L4": 5, "L5": 6, "L6": 7,
    "Infra": 8,
}


@dataclass(frozen=True)
class ModuleSpec:
    """One node in the module DAG."""

    module_id: str
    module_name: str
    layer: str
    owned_object: str
    depends_on: Tuple[str, ...] = ()
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

    @property
    def layer_rank(self) -> int:
        return LAYER_RANK.get(self.layer, 99)


# Declaration order is significant: within a layer it is the deterministic
# tie-breaker for the topological sort, and dependencies are declared before
# their dependents.
_SPECS: Tuple[ModuleSpec, ...] = (
    # ── L0 ────────────────────────────────────────────────────────────────
    ModuleSpec("CP-0", "SourceReadiness", "L0", "source_readiness_assessment",
               implemented=True),
    # ── L1 — financial foundation ──────────────────────────────────────────
    ModuleSpec("CP-1", "CanonicalDataFoundation", "L1", "canonical_financials",
               depends_on=("CP-0",), required_sources=frozenset({FINANCIALS}),
               implemented=True, edgar_fallback=True),
    ModuleSpec("CP-1A", "BusinessTransactionFactPack", "L1", "business_transaction_fact_register",
               depends_on=("CP-1",), required_sources=frozenset({OFFERING}),
               implemented=True),
    ModuleSpec("CP-1B", "EarningsDelta", "L1", "earnings_delta",
               depends_on=("CP-1",), implemented=True),
    ModuleSpec("CP-1C", "PeerBenchmark", "L1", "peer_benchmark",
               depends_on=("CP-1",), implemented=True),
    # ── L2 — fundamental credit ────────────────────────────────────────────
    ModuleSpec("CP-2", "CostStructure", "L2", "cost_structure",
               depends_on=("CP-1",), required_sources=frozenset({FINANCIALS}),
               implemented=True),
    ModuleSpec("CP-2B", "DownsidePathway", "L2", "downside_pathway",
               depends_on=("CP-1", "CP-2"), required_sources=frozenset({FINANCIALS}),
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
    ModuleSpec("CP-3B", "RecoveryInstrumentPreference", "L3", "recovery_instrument_preference",
               depends_on=("CP-1",), required_sources=frozenset({AGREEMENT}),
               implemented=True),
    ModuleSpec("CP-3C", "PortfolioFitPositionSizing", "L3", "portfolio_fit_analysis",
               depends_on=("CP-3",), implemented=True),
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
               depends_on=("CP-1", "CP-2", "CP-4C", "CP-2B", "CP-3"), implemented=True),
    ModuleSpec("CP-6E", "PortfolioDebateChallenge", "L6", "portfolio_debate_challenge",
               depends_on=("CP-6A",), implemented=True),
)

REGISTRY: Dict[str, ModuleSpec] = {s.module_id: s for s in _SPECS}

# Declaration order (the topological tie-breaker), id -> index.
DECLARATION_INDEX: Dict[str, int] = {s.module_id: i for i, s in enumerate(_SPECS)}


def all_specs() -> List[ModuleSpec]:
    """The routing index in declaration order."""
    return list(_SPECS)
