"""CP-X PlannerRouter — pure route-plan unit tests (no DB, no LLM).

Covers the CP-X contract: readiness mapping from CP-0 source coverage (incl. the
CP-1 EDGAR fallback), dependency-ordered/layered sequencing, dependency-block
propagation, one-owner-per-object (VE-009), and limitation propagation.
"""
from __future__ import annotations

from typing import List

from engine.planner import (
    BLOCKED, EXCLUDED, FULL_RUN, NOT_IMPLEMENTED, READY_WITH_LIMITATIONS,
    build_route_plan,
)
from engine.registry import (
    AGREEMENT, COVENANT, FINANCIALS, OFFERING, ModuleSpec,
)
from engine.schemas import ModulePayload

ALL_SOURCES = [FINANCIALS, AGREEMENT, OFFERING, COVENANT]


def _cp0(present=ALL_SOURCES, *, edgar=True, files=9, flags=None) -> ModulePayload:
    return ModulePayload(
        module_id="CP-0", module_name="SourceReadiness",
        owned_object="source_readiness_assessment",
        runtime_output={
            "categories_present": list(present),
            "categories_missing": [c for c in ALL_SOURCES if c not in present],
            "edgar_available": edgar,
            "files_classified": files,
        },
        confidence="High",
        limitation_flags=list(flags or []),
    )


def _order(plan) -> List[str]:
    return plan.execution_order


# ── Full coverage: the demo-issuer shape ─────────────────────────────────────


def test_full_run_when_all_sources_present():
    from engine.registry import REGISTRY

    plan = build_route_plan(_cp0())
    assert plan.gate_status == FULL_RUN
    # Every *implemented* module routes Full Run and executes. The spec-only corpus
    # modules (CP-SR/CP-MON L7, CP-RENDER/CP-EXTRACT Infra) are registered so the
    # route plan reflects the full corpus mesh honestly: they surface as
    # Not Implemented and are excluded from the execution order. (engine item #8)
    for r in plan.readiness:
        mid = r.module_id
        if REGISTRY[mid].implemented:
            assert plan.verdict(mid) == FULL_RUN, mid
            assert mid in plan.execution_order
        else:
            assert plan.verdict(mid) == NOT_IMPLEMENTED, mid
            assert mid not in plan.execution_order
    spec_only = {mid for mid, s in REGISTRY.items() if not s.implemented}
    assert spec_only == {"CP-SR", "CP-MON", "CP-RENDER", "CP-EXTRACT"}
    assert {r.module_id for r in plan.readiness if r.readiness == NOT_IMPLEMENTED} == spec_only
    # CP-X advertises the routed modules to downstream, excluding CP-0 itself.
    routed = plan.routed_module_ids()
    assert "CP-0" not in routed and "CP-1" in routed


def test_topological_and_layer_order():
    order = _order(build_route_plan(_cp0()))
    assert order[0] == "CP-0"
    # Dependencies precede dependents.
    assert order.index("CP-1") < order.index("CP-1A")
    assert order.index("CP-1") < order.index("CP-1C")
    assert order.index("CP-1") < order.index("CP-2")
    assert order.index("CP-1") < order.index("CP-4C")
    # Layer precedence: L1 before L2 before L4.
    assert order.index("CP-1A") < order.index("CP-2") < order.index("CP-4C")


def test_phase4_flag_on_order_and_soft_downstream_contract():
    from engine.registry import all_specs

    specs = all_specs(frozenset({"caos_cp_4d_enabled", "caos_cp_2g_enabled"}))
    plan = build_route_plan(_cp0(), specs)
    order = _order(plan)
    assert order.index("CP-2") < order.index("CP-2G") < order.index("CP-6A")
    assert order.index("CP-4") < order.index("CP-4D") < order.index("CP-4C")
    assert "CP-2G" not in next(s for s in specs if s.module_id == "CP-6A").depends_on
    assert "CP-4D" not in next(s for s in specs if s.module_id == "CP-4C").depends_on


# ── Readiness mapping from coverage ──────────────────────────────────────────


def test_cp1_edgar_fallback_when_no_financials_docs():
    # No documents vaulted, but EDGAR is available for the ticker.
    plan = build_route_plan(_cp0(present=[], edgar=True, files=0))
    assert plan.gate_status == READY_WITH_LIMITATIONS
    assert plan.verdict("CP-1") == READY_WITH_LIMITATIONS
    assert "CP-1" in plan.execution_order
    assert "EDGAR" in (plan.blocking_reason("CP-1") or "")


def test_partial_coverage_is_ready_with_limitations():
    # CP-4C needs agreement+covenant; only agreement present -> partial.
    plan = build_route_plan(_cp0(present=[FINANCIALS, AGREEMENT], edgar=False))
    assert plan.verdict("CP-1") == FULL_RUN  # financials present
    assert plan.verdict("CP-4C") == READY_WITH_LIMITATIONS
    assert "missing" in (plan.blocking_reason("CP-4C") or "").lower()


def test_gate_blocked_when_no_sources_and_no_edgar():
    plan = build_route_plan(_cp0(present=[], edgar=False, files=0))
    assert plan.gate_status == BLOCKED


# ── Dependency-block propagation ─────────────────────────────────────────────


def test_dependency_block_cascades():
    specs = [
        ModuleSpec("CP-0", "Readiness", "L0", "o0", implemented=True),
        ModuleSpec("CP-1", "Foundation", "L1", "o1", depends_on=("CP-0",),
                   required_sources=frozenset({FINANCIALS}), implemented=True,
                   blocks_on_missing_sources=True),
        ModuleSpec("CP-2", "Dependent", "L2", "o2", depends_on=("CP-1",), implemented=True),
    ]
    plan = build_route_plan(_cp0(present=[], edgar=False, files=0), specs)
    assert plan.verdict("CP-1") == BLOCKED          # required sources absent, input-gated
    assert plan.verdict("CP-2") == BLOCKED          # upstream CP-1 blocked
    assert plan.execution_order == ["CP-0"]
    assert "CP-1" in (plan.blocking_reason("CP-2") or "")


def test_spec_only_module_routes_not_implemented():
    # Registry-independent: a spec-only (implemented=False) module is routed and
    # shown but never executed, and it blocks its dependents.
    specs = [
        ModuleSpec("CP-0", "Readiness", "L0", "o0", implemented=True),
        ModuleSpec("CP-1", "Foundation", "L1", "o1", depends_on=("CP-0",), implemented=True),
        ModuleSpec("CP-2", "SpecOnly", "L2", "o2", depends_on=("CP-1",)),  # implemented=False
        ModuleSpec("CP-2B", "Dependent", "L2", "o2b", depends_on=("CP-2",), implemented=True),
    ]
    plan = build_route_plan(_cp0(), specs)
    assert plan.verdict("CP-2") == NOT_IMPLEMENTED
    assert "CP-2" not in plan.execution_order
    assert plan.verdict("CP-2B") == BLOCKED  # upstream not implemented
    assert "CP-1" in plan.execution_order


# ── One-owner-per-object (VE-009) ────────────────────────────────────────────


def test_one_owner_per_object_excludes_conflict():
    specs = [
        ModuleSpec("CP-0", "Readiness", "L0", "o0", implemented=True),
        ModuleSpec("CP-1", "Owner", "L1", "dup", depends_on=("CP-0",), implemented=True),
        ModuleSpec("CP-1A", "Claimant", "L1", "dup", depends_on=("CP-1",), implemented=True),
        ModuleSpec("CP-2", "Downstream", "L2", "o2", depends_on=("CP-1A",), implemented=True),
    ]
    plan = build_route_plan(_cp0(), specs)
    assert plan.verdict("CP-1A") == EXCLUDED
    assert "CP-1A" not in plan.execution_order
    assert plan.verdict("CP-2") == BLOCKED  # depended on the excluded module
    conflict = [o for o in plan.ownership if o.conflict_detected == "Yes"]
    assert len(conflict) == 1 and "VE-009" in conflict[0].resolution


# ── Limitation propagation ───────────────────────────────────────────────────


def test_limitation_propagates_to_category_modules():
    flag = "No credit agreement / indenture vaulted."
    plan = build_route_plan(_cp0(present=[FINANCIALS], edgar=False, flags=[flag]))
    # The agreement gap reaches CP-4C (needs agreement+covenant), an executed module.
    assert "CP-4C" in plan.execution_order  # sanity: it ran
    assert flag in plan.propagated_flags("CP-4C")
    reg = [l for l in plan.limitations if l.propagated_flag == flag]
    assert reg and "CP-4C" in reg[0].affected_modules


def test_no_limitations_message_when_clean():
    rt = build_route_plan(_cp0()).to_runtime_output()
    prop = rt["limitation_propagation"]
    assert prop == [{"limitation": "No limitations to propagate.", "source": "CP-0",
                     "affected_modules": [], "impact": "—", "propagated_flag": "—"}]


# ── Serialised shape ─────────────────────────────────────────────────────────


def test_runtime_output_shape():
    rt = build_route_plan(_cp0()).to_runtime_output()
    for key in ("gate_status", "cp0_assessment", "summary", "execution_sequence",
                "readiness_register", "ownership_validation", "limitation_propagation"):
        assert key in rt, key
    assert rt["summary"].startswith("Route plan includes")
    # Execution sequence is 1-indexed and ordered.
    orders = [row["order"] for row in rt["execution_sequence"]]
    assert orders == sorted(orders) and orders[0] == 1
