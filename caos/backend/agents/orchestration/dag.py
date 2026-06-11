"""
CAOS LangGraph DAG — Master Orchestration Engine.

State machine managing the CP-X agent mesh.
Nodes correspond to CP modules; edges encode DAG dependencies.

Run types:
  FULL_RUN  — New primary transaction (OM + Credit Agreement + LBO Model)
  DELTA_RUN — Quarterly earnings update (Interim Report only)

⚠ COVERAGE GAP (tracked in docs/REMEDIATION_PLAN.md, P0):
  This hand-wired graph only exercises CP-0, CP-X, CP-1, CP-1A, CP-1B, CP-2,
  CP-3, CP-4, CP-4C, CP-5, CP-5B, CP-6E (12 of the 24 analytical modules
  registered in `governance/module_registry.json`). CP-1C, CP-2B/2C/2D/2E/2F,
  CP-3B/3C/3D, CP-6A, CP-SR, CP-MON have agent implementations but are
  unreachable from this DAG. The registry-driven runner in
  `agents/orchestration/registry_runner.py` is the intended replacement —
  flip `trigger_run` (api/routes/agents.py) to call `run_pipeline` once it
  is end-to-end tested.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Literal, TypedDict

import structlog
from langgraph.graph import END, StateGraph

from agents.l1_base.cp1_capital_structure import run_cp1
from agents.l1_base.cp1a_debt_waterfall import run_cp1a
from agents.l1_base.cp1b_earnings_update import run_cp1b
from agents.l2_synthesis.cp2_fundamentals import run_cp2
from agents.l3_relative_value.cp3_relative_value import run_cp3
from agents.l4_legal.cp4_covenant_interpreter import run_cp4
from agents.l4c_capacity.cp4c_capacity_headroom import run_cp4c
from agents.l5_governance.cp5_integrity_qa import run_cp5
from agents.l5_governance.cp5b_traceability import run_cp5b
from agents.l6_debate.cp6e_portfolio_debate import run_cp6e
from agents.orchestration.planner_router import run_cpx
from agents.orchestration.readiness import run_cp0

logger = structlog.get_logger()


async def _persist_agent_output(
    dag_run_id: str,
    module_id: str,
    status: str,
    output: dict | None,
    severity: str | None = None,
    blocked_reason: str | None = None,
) -> None:
    """Write an individual AgentOutput row to the database."""
    from db.models import AgentOutput
    from db.session import AsyncSessionLocal

    # `material_conclusions` may legitimately be absent from a payload (e.g.
    # CP-0 readiness records). Guard against output also being a non-dict.
    evidence_chain = None
    if isinstance(output, dict):
        evidence_chain = output.get("material_conclusions")

    async with AsyncSessionLocal() as db:
        agent_output = AgentOutput(
            dag_run_id=dag_run_id,
            module_id=module_id,
            status=status,
            severity=severity,
            output=output,
            evidence_chain=evidence_chain,
            blocked_reason=blocked_reason,
        )
        db.add(agent_output)
        await db.commit()


class CAOSState(TypedDict):
    """LangGraph state — shared across all nodes."""
    dag_run_id: str
    issuer_id: str
    document_id: str
    force_full_run: bool

    # CP-0 outputs
    run_type: Literal["FULL_RUN", "DELTA_RUN"] | None
    cp0_verdict: Literal["READY", "BLOCKED"] | None
    cp0_output: dict[str, Any] | None

    # CP-X routing
    execution_plan: list[str] | None  # ordered module IDs to execute

    # L1 outputs
    cp1_output: dict[str, Any] | None
    cp1a_output: dict[str, Any] | None
    cp1b_output: dict[str, Any] | None

    # L2 output
    cp2_output: dict[str, Any] | None

    # L3 output
    cp3_output: dict[str, Any] | None

    # L4 outputs
    cp4_output: dict[str, Any] | None
    cp4c_output: dict[str, Any] | None

    # L5 governance
    cp5_reports: list[dict[str, Any]] | None
    cp5b_output: dict[str, Any] | None

    # L6 debate
    cp6e_output: dict[str, Any] | None

    # Global state
    blocked_modules: list[str]
    errors: list[str]
    final_status: Literal["COMPLETED", "BLOCKED", "FAILED"] | None


# ─── Node functions ────────────────────────────────────────────────────────

async def node_cp0(state: CAOSState) -> CAOSState:
    try:
        output = await run_cp0(state["issuer_id"], state["document_id"])
        state["cp0_output"] = output
        state["run_type"] = output.get("run_type")
        state["cp0_verdict"] = output.get("verdict")
    except Exception as e:
        logger.error("CP-0 error", error=str(e))
        state["errors"].append(f"CP-0: {e}")
        state["cp0_verdict"] = "BLOCKED"
    return state


async def node_cpx(state: CAOSState) -> CAOSState:
    try:
        plan = await run_cpx(
            run_type=state["run_type"],
            issuer_id=state["issuer_id"],
            force_full=state["force_full_run"],
        )
        state["execution_plan"] = plan
    except Exception as e:
        logger.error("CP-X router error", error=str(e))
        state["errors"].append(f"CP-X: {e}")
    return state


async def node_l1_parallel(state: CAOSState) -> CAOSState:
    """Run CP-1, CP-1A in parallel (FULL_RUN) or CP-1B (DELTA_RUN)."""
    plan = state["execution_plan"] or []

    if state["run_type"] == "DELTA_RUN":
        try:
            state["cp1b_output"] = await run_cp1b(state["issuer_id"], state["document_id"])
        except Exception as e:
            state["errors"].append(f"CP-1B: {e}")
    else:
        # Parallel execution of CP-1 and CP-1A
        tasks = []
        if "CP-1" in plan:
            tasks.append(run_cp1(state["issuer_id"], state["document_id"]))
        if "CP-1A" in plan:
            tasks.append(run_cp1a(state["issuer_id"], state["document_id"]))

        results = await asyncio.gather(*tasks, return_exceptions=True)
        idx = 0
        if "CP-1" in plan:
            if isinstance(results[idx], Exception):
                state["errors"].append(f"CP-1: {results[idx]}")
            else:
                state["cp1_output"] = results[idx]
            idx += 1
        if "CP-1A" in plan:
            if isinstance(results[idx], Exception):
                state["errors"].append(f"CP-1A: {results[idx]}")
            else:
                state["cp1a_output"] = results[idx]

    return state


async def node_cp2(state: CAOSState) -> CAOSState:
    try:
        state["cp2_output"] = await run_cp2(state["issuer_id"], state["document_id"])
    except Exception as e:
        state["errors"].append(f"CP-2: {e}")
    return state


async def node_l3_l4_parallel(state: CAOSState) -> CAOSState:
    """Run CP-3, CP-4, CP-4C in parallel, honoring the CP-X execution plan."""
    plan = state["execution_plan"] or []

    # (module_id, coroutine factory, state key) — only scheduled if in the plan.
    planned = [
        ("CP-3", lambda: run_cp3(state["issuer_id"]), "cp3_output"),
        ("CP-4", lambda: run_cp4(state["issuer_id"], state["document_id"]), "cp4_output"),
        ("CP-4C", lambda: run_cp4c(state["issuer_id"]), "cp4c_output"),
    ]
    to_run = [(mid, key, factory) for mid, factory, key in planned if mid in plan]

    if not to_run:
        return state

    results = await asyncio.gather(*(factory() for _, _, factory in to_run), return_exceptions=True)
    for (module_id, state_key, _), result in zip(to_run, results):
        if isinstance(result, Exception):
            state["errors"].append(f"{module_id}: {result}")
        else:
            state[state_key] = result  # type: ignore[literal-required]

    return state


async def node_cp5_governance(state: CAOSState) -> CAOSState:
    """CP-5 Integrity QA — validate all L1-L4 outputs, block on Critical."""
    modules_to_check = {
        "CP-1": state.get("cp1_output"),
        "CP-1A": state.get("cp1a_output"),
        "CP-1B": state.get("cp1b_output"),
        "CP-2": state.get("cp2_output"),
        "CP-3": state.get("cp3_output"),
        "CP-4": state.get("cp4_output"),
        "CP-4C": state.get("cp4c_output"),
    }

    reports = []
    blocked_modules = []

    for module_id, output in modules_to_check.items():
        if output is None:
            continue
        report = await run_cp5(module_id, output)
        reports.append(report)
        if report.get("blocked"):
            blocked_modules.append(module_id)
            logger.warning("Module BLOCKED by CP-5", module_id=module_id, reason=report.get("blocked_reason"))

    state["cp5_reports"] = reports
    state["blocked_modules"] = blocked_modules

    # Persist individual AgentOutput rows with CP-5 severity verdicts
    for module_id, output in modules_to_check.items():
        if output is None:
            continue
        matching_report = next((r for r in reports if r.get("target_module_id") == module_id or r.get("module_id") == module_id), None)
        severity = matching_report.get("overall_severity", "PASS") if matching_report else "PASS"
        is_blocked = module_id in blocked_modules
        await _persist_agent_output(
            dag_run_id=state["dag_run_id"],
            module_id=module_id,
            status="BLOCKED" if is_blocked else "COMPLETED",
            output=output,
            severity=severity,
            blocked_reason=matching_report.get("blocked_reason") if is_blocked and matching_report else None,
        )

    return state


async def node_cp5b_traceability(state: CAOSState) -> CAOSState:
    all_outputs = [o for o in [
        state.get("cp1_output"), state.get("cp1b_output"),
        state.get("cp2_output"), state.get("cp4_output"),
    ] if o is not None]
    try:
        state["cp5b_output"] = await run_cp5b(all_outputs)
    except Exception as e:
        state["errors"].append(f"CP-5B: {e}")
    return state


async def node_cp6e(state: CAOSState) -> CAOSState:
    if state.get("blocked_modules"):
        logger.info("Skipping CP-6E: blocked modules present", blocked=state["blocked_modules"])
        return state
    try:
        state["cp6e_output"] = await run_cp6e(state)
    except Exception as e:
        state["errors"].append(f"CP-6E: {e}")
    return state


async def node_finalize(state: CAOSState) -> CAOSState:
    if state.get("blocked_modules"):
        state["final_status"] = "BLOCKED"
    elif state.get("errors"):
        state["final_status"] = "FAILED"
    else:
        state["final_status"] = "COMPLETED"

    # Persist CP-5B and CP-6E outputs (they bypass per-module CP-5 governance)
    if state.get("cp5b_output"):
        await _persist_agent_output(
            dag_run_id=state["dag_run_id"],
            module_id="CP-5B",
            status="COMPLETED",
            output=state["cp5b_output"],
            severity="PASS",
        )
    if state.get("cp6e_output"):
        await _persist_agent_output(
            dag_run_id=state["dag_run_id"],
            module_id="CP-6E",
            status="COMPLETED",
            output=state["cp6e_output"],
            severity="PASS",
        )

    return state


# ─── Routing conditions ───────────────────────────────────────────────────

def route_cp0(state: CAOSState) -> str:
    return "node_cpx" if state["cp0_verdict"] == "READY" else "node_finalize"


# ─── Graph construction ───────────────────────────────────────────────────

def build_graph() -> StateGraph:
    graph = StateGraph(CAOSState)

    graph.add_node("node_cp0", node_cp0)
    graph.add_node("node_cpx", node_cpx)
    graph.add_node("node_l1_parallel", node_l1_parallel)
    graph.add_node("node_cp2", node_cp2)
    graph.add_node("node_l3_l4_parallel", node_l3_l4_parallel)
    graph.add_node("node_cp5_governance", node_cp5_governance)
    graph.add_node("node_cp5b_traceability", node_cp5b_traceability)
    graph.add_node("node_cp6e", node_cp6e)
    graph.add_node("node_finalize", node_finalize)

    graph.set_entry_point("node_cp0")
    graph.add_conditional_edges("node_cp0", route_cp0)
    graph.add_edge("node_cpx", "node_l1_parallel")
    graph.add_edge("node_l1_parallel", "node_cp2")
    graph.add_edge("node_cp2", "node_l3_l4_parallel")
    graph.add_edge("node_l3_l4_parallel", "node_cp5_governance")
    graph.add_edge("node_cp5_governance", "node_cp5b_traceability")
    graph.add_edge("node_cp5b_traceability", "node_cp6e")
    graph.add_edge("node_cp6e", "node_finalize")
    graph.add_edge("node_finalize", END)

    return graph.compile()


_compiled_graph = None


def get_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_graph()
    return _compiled_graph


async def run_dag(dag_run_id: str, issuer_id: str, document_id: str, force_full_run: bool = False) -> None:
    """Entry point called from FastAPI background task."""
    from db.models import DagRun
    from db.session import AsyncSessionLocal

    initial_state: CAOSState = {
        "dag_run_id": dag_run_id,
        "issuer_id": issuer_id,
        "document_id": document_id,
        "force_full_run": force_full_run,
        "run_type": None,
        "cp0_verdict": None,
        "cp0_output": None,
        "execution_plan": None,
        "cp1_output": None, "cp1a_output": None, "cp1b_output": None,
        "cp2_output": None, "cp3_output": None,
        "cp4_output": None, "cp4c_output": None,
        "cp5_reports": None, "cp5b_output": None,
        "cp6e_output": None,
        "blocked_modules": [],
        "errors": [],
        "final_status": None,
    }

    graph = get_graph()
    logger.info("DAG starting", dag_run_id=dag_run_id)

    async with AsyncSessionLocal() as db:
        run = await db.get(DagRun, dag_run_id)
        if run:
            run.status = "RUNNING"
            await db.commit()

    try:
        final_state: CAOSState = await graph.ainvoke(initial_state)
    except Exception as e:
        # A crash inside the graph must not leave the run stuck at RUNNING.
        logger.exception("DAG crashed", dag_run_id=dag_run_id, error=str(e))
        async with AsyncSessionLocal() as db:
            run = await db.get(DagRun, dag_run_id)
            if run:
                run.status = "FAILED"
                run.completed_at = datetime.now(timezone.utc)
                run.agent_outputs = {"errors": [f"DAG crashed: {e}"]}
                await db.commit()
        return

    async with AsyncSessionLocal() as db:
        run = await db.get(DagRun, dag_run_id)
        if run:
            run.status = final_state.get("final_status", "FAILED")
            run.completed_at = datetime.now(timezone.utc)
            run.agent_outputs = {
                "cp0": final_state.get("cp0_output"),
                "cp1": final_state.get("cp1_output"),
                "cp2": final_state.get("cp2_output"),
                "cp3": final_state.get("cp3_output"),
                "cp4": final_state.get("cp4_output"),
                "cp4c": final_state.get("cp4c_output"),
                "cp6e": final_state.get("cp6e_output"),
                "blocked_modules": final_state.get("blocked_modules"),
                "errors": final_state.get("errors"),
            }
            await db.commit()

    logger.info("DAG complete", dag_run_id=dag_run_id, status=final_state.get("final_status"))
