"""CP-X PlannerRouter — the deterministic DAG executor's planning half.

``build_route_plan`` consumes the CP-0 readiness assessment plus the module
registry ([registry.py]) and produces a ``RoutePlan``: a dependency-ordered
execution sequence, a per-module readiness verdict, one-owner-per-object
validation, and a limitation-propagation register. It is the code realisation of
the CP-X contract (``Modular OS/CP-X/`` REF_CP-X_01..07).

It is pure — no DB, no LLM, no I/O — so it is exhaustively unit-testable and can
never "decide" analysis: CP-X routes and governs, it does not analyse (corpus
governance rule 3). The runner runs CP-0 first, calls this to get the plan,
persists the plan as the CP-X module output, then executes ``execution_order``.

Readiness verdicts (REF_CP-X_02/03):

    Full Run                — all required source categories present.
    Ready with Limitations  — partial/absent sources but the module still runs
                              (incl. CP-1's EDGAR-XBRL fallback), or an upstream
                              ran with limitations.
    Blocked                 — a required upstream is Blocked/absent, or (for an
                              input-gated module) its required sources are absent.
    Not Implemented         — no synthesizer wired yet (spec-only); routed and
                              shown, never executed, never gated.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Set, Tuple

from engine.registry import (
    AGREEMENT, COVENANT, FINANCIALS, OFFERING, ModuleSpec, all_specs,
)
from engine.schemas import ModulePayload

# Readiness verdict vocabulary.
FULL_RUN = "Full Run"
READY_WITH_LIMITATIONS = "Ready with Limitations"
BLOCKED = "Blocked"
NOT_IMPLEMENTED = "Not Implemented"
EXCLUDED = "Excluded"  # one-owner-per-object conflict (VE-009)

# Verdicts that actually execute.
_EXECUTABLE = {FULL_RUN, READY_WITH_LIMITATIONS}

# Keyword -> CP-0 source category, for classifying a CP-0 limitation flag so it
# propagates to the modules that depend on that category.
_FLAG_CATEGORY = (
    ("financ", FINANCIALS), ("audited", FINANCIALS), ("xbrl", FINANCIALS),
    ("agreement", AGREEMENT), ("indenture", AGREEMENT), ("facilit", AGREEMENT),
    ("offering", OFFERING), ("prospectus", OFFERING), ("memorandum", OFFERING),
    ("covenant", COVENANT), ("compliance", COVENANT),
)


@dataclass
class ReadinessEntry:
    """TX.3 row + the bits the runner needs to execute/annotate the module."""

    module_id: str
    module_name: str
    layer: str
    readiness: str
    sources_met: str  # Yes | Partial | No
    limitation_flags: List[str] = field(default_factory=list)
    blocking_reason: Optional[str] = None
    depends_on: Tuple[str, ...] = ()


@dataclass
class OwnershipEntry:
    """TX.4 row."""

    owned_object: str
    owning_module: str
    conflict_detected: str  # Yes | No
    resolution: str


@dataclass
class LimitationEntry:
    """TX.6 row."""

    limitation: str
    source: str
    affected_modules: List[str]
    impact: str
    propagated_flag: str


@dataclass
class RoutePlan:
    """The CP-X route plan — CP-0-driven routing over the module registry."""

    gate_status: str
    cp0_assessment: str
    execution_order: List[str]
    readiness: List[ReadinessEntry]
    ownership: List[OwnershipEntry]
    limitations: List[LimitationEntry]
    summary: str

    def __post_init__(self) -> None:
        self._by_id: Dict[str, ReadinessEntry] = {r.module_id: r for r in self.readiness}

    def verdict(self, module_id: str) -> Optional[str]:
        e = self._by_id.get(module_id)
        return e.readiness if e else None

    def blocking_reason(self, module_id: str) -> Optional[str]:
        e = self._by_id.get(module_id)
        return e.blocking_reason if e else None

    def propagated_flags(self, module_id: str) -> List[str]:
        """Limitation flags the register propagated onto ``module_id`` (deduped)."""
        out: List[str] = []
        for lim in self.limitations:
            if module_id in lim.affected_modules and lim.propagated_flag not in out:
                out.append(lim.propagated_flag)
        return out

    def routed_module_ids(self) -> List[str]:
        """All routed analytical modules, for the CP-X downstream_consumers list."""
        return [r.module_id for r in self.readiness if r.module_id != "CP-0"]

    def to_runtime_output(self) -> dict:
        """The CP-X ModuleOutput.runtime_output — the auditable route plan."""
        return {
            "gate_status": self.gate_status,
            "cp0_assessment": self.cp0_assessment,
            "summary": self.summary,
            "execution_sequence": [
                {
                    "order": i + 1, "module_id": r.module_id, "module_name": r.module_name,
                    "layer": r.layer, "readiness": r.readiness,
                    "depends_on": list(r.depends_on),
                }
                for i, r in enumerate(self._ordered_for_display())
            ],
            "readiness_register": [
                {
                    "module_id": r.module_id, "module_name": r.module_name, "layer": r.layer,
                    "readiness": r.readiness, "sources_met": r.sources_met,
                    "limitation_flags": r.limitation_flags, "blocking_reason": r.blocking_reason,
                }
                for r in self.readiness
            ],
            "ownership_validation": [
                {
                    "owned_object": o.owned_object, "owning_module": o.owning_module,
                    "conflict_detected": o.conflict_detected, "resolution": o.resolution,
                }
                for o in self.ownership
            ],
            "limitation_propagation": [
                {
                    "limitation": lim.limitation, "source": lim.source,
                    "affected_modules": lim.affected_modules, "impact": lim.impact,
                    "propagated_flag": lim.propagated_flag,
                }
                for lim in self.limitations
            ] or [{"limitation": "No limitations to propagate.", "source": "CP-0",
                   "affected_modules": [], "impact": "—", "propagated_flag": "—"}],
        }

    def _ordered_for_display(self) -> List[ReadinessEntry]:
        """Executable modules first (in run order), then blocked/not-implemented."""
        order_index = {m: i for i, m in enumerate(self.execution_order)}
        executed = [r for r in self.readiness if r.module_id in order_index]
        executed.sort(key=lambda r: order_index[r.module_id])
        rest = [r for r in self.readiness if r.module_id not in order_index]
        return executed + rest


def _sources_met(spec: ModuleSpec, present: Set[str]) -> str:
    if not spec.required_sources:
        return "Yes"
    have = spec.required_sources & present
    if have == spec.required_sources:
        return "Yes"
    return "Partial" if have else "No"


def _verdict(
    spec: ModuleSpec, present: Set[str], edgar: bool, statuses: Dict[str, str],
) -> Tuple[str, Optional[str]]:
    """Return (readiness, blocking_reason) for one module, given upstream statuses."""
    if not spec.implemented:
        return NOT_IMPLEMENTED, "No synthesizer wired (spec-only module)."

    for dep in spec.depends_on:
        ds = statuses.get(dep)
        if ds in (BLOCKED, NOT_IMPLEMENTED, EXCLUDED):
            return BLOCKED, f"Upstream {dep} is {ds.lower()}."

    req = spec.required_sources
    if not req:
        return FULL_RUN, None
    have = req & present
    if have == req:
        return FULL_RUN, None
    if have:
        missing = ", ".join(sorted(req - have))
        return READY_WITH_LIMITATIONS, f"Partial source coverage; missing {missing}."
    # None of the required categories are present.
    if spec.edgar_fallback and edgar:
        return READY_WITH_LIMITATIONS, "No financial-statement docs vaulted; grounding on SEC EDGAR XBRL."
    if spec.blocks_on_missing_sources:
        return BLOCKED, f"Required sources absent: {', '.join(sorted(req))}."
    return READY_WITH_LIMITATIONS, f"Required sources absent ({', '.join(sorted(req))}); degraded synthesis."


def _topological_order(specs: Sequence[ModuleSpec]) -> List[str]:
    """Kahn's algorithm with (layer_rank, declaration_index) as the deterministic
    tie-breaker, so layer precedence is honoured and ordering is reproducible."""
    ids = {s.module_id for s in specs}
    decl = {s.module_id: i for i, s in enumerate(specs)}  # declaration order = tie-breaker
    indeg: Dict[str, int] = {s.module_id: 0 for s in specs}
    dependents: Dict[str, List[str]] = {s.module_id: [] for s in specs}
    for s in specs:
        for dep in s.depends_on:
            if dep in ids:  # ignore deps outside the registry
                indeg[s.module_id] += 1
                dependents[dep].append(s.module_id)

    spec_by_id = {s.module_id: s for s in specs}

    def priority(mid: str) -> Tuple[int, int]:
        s = spec_by_id[mid]
        return (s.layer_rank, decl.get(mid, 999))

    ready = sorted([m for m, d in indeg.items() if d == 0], key=priority)
    order: List[str] = []
    while ready:
        mid = ready.pop(0)
        order.append(mid)
        for nxt in dependents[mid]:
            indeg[nxt] -= 1
            if indeg[nxt] == 0:
                ready.append(nxt)
        ready.sort(key=priority)
    # Any module left with indeg>0 sits in a cycle (registry bug) — append it so
    # nothing silently vanishes; the caller will see it never executes.
    order.extend(m for m in indeg if m not in order)
    return order


def _classify_flag(flag: str) -> Optional[str]:
    low = flag.lower()
    for kw, cat in _FLAG_CATEGORY:
        if kw in low:
            return cat
    return None


def _validate_ownership(specs: Sequence[ModuleSpec]) -> Tuple[List[OwnershipEntry], Set[str]]:
    """Step 4 (precedes verdicts): one-owner-per-object validation (VE-009).

    Walks ``specs`` in declaration order; the first module to claim an object
    owns it, every later claimant is excluded from routing. Returns the TX.4
    register plus the set of excluded module ids.
    """
    ownership: List[OwnershipEntry] = []
    excluded: Set[str] = set()
    owner_of: Dict[str, str] = {}
    for s in specs:
        prior = owner_of.get(s.owned_object)
        if prior is None:
            owner_of[s.owned_object] = s.module_id
            ownership.append(OwnershipEntry(s.owned_object, s.module_id, "No", "N/A"))
        else:
            excluded.add(s.module_id)
            ownership.append(OwnershipEntry(
                s.owned_object, s.module_id, "Yes",
                f"VE-009 OWNERSHIP_VIOLATION: {s.module_id} excluded; {prior} owns "
                f"{s.owned_object}.",
            ))
    return ownership, excluded


def _readiness_verdicts(
    order: Sequence[str], spec_by_id: Dict[str, ModuleSpec], excluded: Set[str],
    present: Set[str], edgar: bool,
) -> Tuple[List[ReadinessEntry], Dict[str, str]]:
    """Steps 2/3: dependency-ordered readiness verdicts (the TX.3 register).

    Walks the topological ``order`` so every module is judged after its
    upstreams' statuses are settled (``_verdict`` reads them from ``statuses``).
    VE-009 exclusions short-circuit to Excluded without consulting sources.
    """
    statuses: Dict[str, str] = {}
    readiness: List[ReadinessEntry] = []
    for mid in order:
        s = spec_by_id[mid]
        if mid in excluded:
            statuses[mid] = EXCLUDED
            verdict, reason = EXCLUDED, "Excluded by one-owner-per-object (VE-009)."
        else:
            verdict, reason = _verdict(s, present, edgar, statuses)
            statuses[mid] = verdict
        readiness.append(ReadinessEntry(
            module_id=mid, module_name=s.module_name, layer=s.layer,
            readiness=verdict, sources_met=_sources_met(s, present),
            blocking_reason=reason, depends_on=s.depends_on,
        ))
    return readiness, statuses


def _propagate_limitations(
    cp0_flags: Sequence[str], execution_order: Sequence[str],
    spec_by_id: Dict[str, ModuleSpec], readiness: Sequence[ReadinessEntry],
) -> List[LimitationEntry]:
    """Step 6: limitation propagation register (TX.6).

    A CP-0 flag classified to a source category reaches the executing modules
    that require that category; an unclassified flag reaches every executing
    module (never CP-0 itself). Each hit is appended (deduped) onto the
    affected ``ReadinessEntry.limitation_flags`` in place; a TX.6 row is
    recorded only when a flag actually reached someone.
    """
    readiness_by_id = {r.module_id: r for r in readiness}
    limitations: List[LimitationEntry] = []
    for flag in cp0_flags:
        cat = _classify_flag(flag)
        if cat is not None:
            affected = [mid for mid in execution_order
                        if cat in spec_by_id[mid].required_sources and mid != "CP-0"]
            impact = f"Constrains {cat} grounding for downstream modules."
        else:
            affected = [mid for mid in execution_order if mid != "CP-0"]
            impact = "General source gap propagated to all routed modules."
        if affected:
            for mid in affected:
                if flag not in readiness_by_id[mid].limitation_flags:
                    readiness_by_id[mid].limitation_flags.append(flag)
            limitations.append(LimitationEntry(
                limitation=flag, source="CP-0", affected_modules=affected,
                impact=impact, propagated_flag=flag,
            ))
    return limitations


def _gate_and_summary(
    files: int, edgar: bool, present: Set[str],
    readiness: Sequence[ReadinessEntry], execution_order: Sequence[str],
) -> Tuple[str, str, str]:
    """Step 1 + Step 7: overall gate status, CP-0 assessment, route summary.

    Gate ladder (order is contractual): a critically thin CP-0 (no files, no
    EDGAR) LABELS the run BLOCKED; any *executing* module on limitations degrades
    the gate; otherwise Full Run. Verdict counts roll up over ALL routed modules.

    The gate status is a persisted LABEL, not an execution switch (BE3-7): the
    runner gates execution per-module via each verdict, so a zero-source run
    still executes its degradable modules — which then flag limitations and land
    behind the CP-5 gate. That is the intended degrade-and-disclose posture.
    """
    if files == 0 and not edgar:
        gate_status = BLOCKED
        cp0_assessment = "CP-0 critically thin: no documents vaulted and no EDGAR source."
    elif any(r.readiness == READY_WITH_LIMITATIONS for r in readiness if r.module_id in execution_order):
        gate_status = READY_WITH_LIMITATIONS
        cp0_assessment = f"CP-0 available; {len(present)}/4 source categories present."
    else:
        gate_status = FULL_RUN
        cp0_assessment = f"CP-0 available; all required source categories present ({len(present)}/4)."

    n_full = sum(1 for r in readiness if r.readiness == FULL_RUN)
    n_lim = sum(1 for r in readiness if r.readiness == READY_WITH_LIMITATIONS)
    n_blocked = sum(1 for r in readiness if r.readiness == BLOCKED)
    n_unimpl = sum(1 for r in readiness if r.readiness == NOT_IMPLEMENTED)
    summary = (
        f"Route plan includes {len(execution_order)} modules for execution "
        f"({n_full} Full Run, {n_lim} Ready with Limitations); "
        f"{n_blocked} Blocked, {n_unimpl} not yet implemented."
    )
    return gate_status, cp0_assessment, summary


def build_route_plan(cp0_payload: ModulePayload, specs: Optional[Sequence[ModuleSpec]] = None) -> RoutePlan:
    """Build the CP-X route plan from a CP-0 payload and the module registry.

    Orchestrates the corpus methodology steps over the registry:
    Step 4 ownership/VE-009 → Steps 2/3 dependency-ordered verdicts →
    Step 6 limitation propagation (TX.6) → Step 1 + Step 7 gate and summary.
    """
    specs = list(specs) if specs is not None else all_specs()
    rt = cp0_payload.runtime_output or {}
    # Defensive casts: the deterministic CP-0 emits exact types, but the
    # deleted-issuer fallback path synthesizes CP-0 via the LLM, whose interior
    # types are unvalidated — a "fourteen" files count or scalar categories list
    # would raise here, OUTSIDE the per-module guard, and abort the run (BE3-4).
    raw_present = rt.get("categories_present")
    present: Set[str] = ({c for c in raw_present if isinstance(c, str)}
                         if isinstance(raw_present, (list, tuple, set)) else set())
    edgar = bool(rt.get("edgar_available", False))
    try:
        files = int(rt.get("files_classified", 0) or 0)
    except (TypeError, ValueError):
        files = 0
    cp0_flags = [f for f in (cp0_payload.limitation_flags or []) if isinstance(f, str)]

    # Step 4 (precedes verdicts): one-owner-per-object validation (VE-009).
    ownership, excluded = _validate_ownership(specs)

    # Steps 2/3: dependency-ordered verdicts over the topological order.
    order = _topological_order(specs)
    spec_by_id = {s.module_id: s for s in specs}
    readiness, statuses = _readiness_verdicts(order, spec_by_id, excluded, present, edgar)
    execution_order = [mid for mid in order if statuses.get(mid) in _EXECUTABLE]

    # Step 6: limitation propagation register (TX.6) — annotates ``readiness``.
    limitations = _propagate_limitations(cp0_flags, execution_order, spec_by_id, readiness)

    # Step 1 + Step 7: gate status and summary.
    gate_status, cp0_assessment, summary = _gate_and_summary(
        files, edgar, present, readiness, execution_order,
    )

    return RoutePlan(
        gate_status=gate_status, cp0_assessment=cp0_assessment,
        execution_order=execution_order, readiness=readiness, ownership=ownership,
        limitations=limitations, summary=summary,
    )
