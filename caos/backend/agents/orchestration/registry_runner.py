"""
Registry-driven execution runner (Redeploy Plan D3) — the planner→runner loop.

Consumes a route_plan from `registry_planner.build_route_plan`, then executes the
modules level-by-level: each parallel group runs concurrently (asyncio.gather),
upstream outputs are threaded to each agent, Blocked modules are skipped, and
limitation flags propagate. This replaces the hand-wired graph in `dag.py`.

The orchestration core `execute_plan` is dependency-injected via an `invoke`
callable, so it is unit-testable without pydantic/anthropic. `default_invoke`
is the production adapter that resolves the agent (registry_dispatch) and binds
its upstream kwargs.
"""

from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable

from governance.registry import Registry, load_registry

# A unit of work: given (module_id, {upstream_id: output}, context) -> result dict.
Invoke = Callable[[str, dict[str, Any], dict[str, Any]], Awaitable[dict[str, Any]]]


def _analytical_preds(reg: Registry) -> dict[str, list[str]]:
    preds: dict[str, list[str]] = {m: [] for m in reg.modules}
    for a, b in reg.analytical_edges:
        preds[b].append(a)
    return preds


async def execute_plan(
    plan: dict,
    invoke: Invoke,
    *,
    context: dict[str, Any] | None = None,
    registry: Registry | None = None,
    qa: Callable[[dict[str, Any]], dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Execute the modules in a route_plan. Returns {module_id: result}.

    Groups run in order; modules within a group run concurrently. Each module is
    invoked with the outputs of its analytical predecessors that have completed.

    If `qa` is given (e.g. `qa_engine.run_qa`), it gates each output: a module
    whose qa_status is Blocked has its `_qa` attached and is withheld from
    downstream upstream-threading (consumers degrade to Ready with Limitations).
    """
    reg = registry or load_registry()
    context = context or {}
    preds = _analytical_preds(reg)
    results: dict[str, Any] = {}
    qa_blocked: set[str] = set()

    for group in plan["parallel_groups"]:
        async def _one(m: str) -> tuple[str, Any]:
            upstream = {p: results[p] for p in preds[m]
                        if p in results and p not in qa_blocked}
            try:
                out = await invoke(m, upstream, context)
            except Exception as e:  # a module failure is contained, not fatal
                out = {"module_id": m, "qa_status": "Blocked",
                       "validation_warnings": [f"execution error: {e}"]}
            return m, out

        completed = await asyncio.gather(*(_one(m) for m in group))
        for m, out in completed:
            if qa is not None and isinstance(out, dict):
                qa_result = qa(out)
                out = {**out, "_qa": qa_result}
                if qa_result.get("qa_status") == "Blocked":
                    qa_blocked.add(m)
            results[m] = out

    return results


# ── Production adapter ─────────────────────────────────────────────────────

# Modules NOT executed as generic plan nodes in an issuer-triggered run:
#   CP-0  — runs explicitly before the plan (readiness gate)
#   CP-X  — its deterministic core IS registry_planner.build_route_plan
#   CP-5  — runs as the runner's per-output `qa` callback (qa_engine.run_qa)
#   CP-5B — runs explicitly after the plan over the collected outputs
#   CP-SR / CP-MON — L7 standing modules; per MODULE_EXECUTION_ORDER they sit
#                    outside the issuer-level pipeline and run independently
NON_PLAN_MODULES: set[str] = {"CP-0", "CP-X", "CP-5", "CP-5B", "CP-SR", "CP-MON"}

# Per-module upstream binding: kwarg name -> source module_id.
# (Only the new-envelope agents need explicit threading; others fall back.)
UPSTREAM_BINDINGS: dict[str, dict[str, str]] = {
    "CP-1C": {},
    "CP-2B": {"cp1_output": "CP-1", "cp1b_output": "CP-1B", "cp2_output": "CP-2"},
    "CP-2C": {"cp2_output": "CP-2"},
    "CP-2D": {"cp1a_output": "CP-1A", "cp2_output": "CP-2"},
    "CP-2E": {"cp1_output": "CP-1", "cp2_output": "CP-2"},
    "CP-2F": {"cp2_output": "CP-2"},
    "CP-3B": {"cp3_output": "CP-3"},   # capital_structure comes from context
    "CP-3C": {"cp3_output": "CP-3"},   # portfolio_constraints comes from context
    "CP-3D": {"cp1_output": "CP-1", "cp1a_output": "CP-1A",
              "cp2b_output": "CP-2B", "cp2e_output": "CP-2E"},
}

# Extra kwargs pulled from the run context (not from upstream outputs).
CONTEXT_BINDINGS: dict[str, dict[str, str]] = {
    "CP-3B": {"capital_structure": "capital_structure"},
    "CP-3C": {"portfolio_constraints": "portfolio_constraints"},
}

# Legacy-signature agents that take the trigger document_id positionally.
DOC_ID_MODULES: set[str] = {"CP-0", "CP-1", "CP-1A", "CP-1B", "CP-2", "CP-4"}


async def default_invoke(module_id: str, upstream: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    """Resolve the agent and call it with bound upstream + context kwargs."""
    from agents.registry_dispatch import resolve
    from schemas.taxonomy_a import to_taxonomy_a

    fn = resolve(module_id)
    issuer_id = context.get("issuer_id", "")

    # CP-6A takes the whole upstream map.
    if module_id == "CP-6A":
        result = await fn(issuer_id, upstream={k: v for k, v in upstream.items()})
        return to_taxonomy_a(module_id, result) if isinstance(result, dict) else result

    # CP-6E takes an assembled state dict (legacy CAOSState shape).
    if module_id == "CP-6E":
        result = await fn({
            "issuer_id": issuer_id,
            "cp2_output": upstream.get("CP-2"),
            "cp3_output": upstream.get("CP-3"),
            "cp4c_output": upstream.get("CP-4C"),
        })
        return to_taxonomy_a(module_id, result) if isinstance(result, dict) else result

    kwargs: dict[str, Any] = {}
    for kwarg, src in UPSTREAM_BINDINGS.get(module_id, {}).items():
        if src in upstream:
            kwargs[kwarg] = upstream[src]
    for kwarg, ctx_key in CONTEXT_BINDINGS.get(module_id, {}).items():
        if ctx_key in context:
            kwargs[kwarg] = context[ctx_key]
    # Legacy agents that require the trigger document_id.
    if module_id in DOC_ID_MODULES:
        kwargs["document_id"] = context.get("document_id") or ""

    result = await fn(issuer_id, **kwargs)
    # Translate legacy CP-1 / CP-1A outputs into Taxonomy A envelopes so
    # downstream QA (governance.qa_engine) sees the canonical module_name.
    return to_taxonomy_a(module_id, result) if isinstance(result, dict) else result


async def run_pipeline(
    issuer_id: str,
    ready: set[str],
    *,
    document_id: str | None = None,
    capital_structure: dict[str, Any] | None = None,
    portfolio_constraints: dict[str, Any] | None = None,
    limited: set[str] | None = None,
) -> dict[str, Any]:
    """Build the route plan from readiness, then execute the issuer pipeline."""
    from agents.orchestration.registry_planner import build_route_plan

    plan = build_route_plan(ready=ready, limited=limited)
    context = {"issuer_id": issuer_id, "document_id": document_id,
               "capital_structure": capital_structure,
               "portfolio_constraints": portfolio_constraints}
    results = await execute_plan(plan, default_invoke, context=context)
    return {"route_plan": plan, "outputs": results}


# ── DagRun-aware entry point used by api/routes/agents.py ──────────────────

async def run_dag_via_registry(
    dag_run_id: str,
    issuer_id: str,
    document_id: str,
    force_full_run: bool = False,
) -> None:
    """
    Production entry: full Modular OS v2 coverage (24 analytical modules)
    driven by `module_registry.json`. Reuses the legacy `_persist_agent_output`
    helper so per-module rows land in `agent_outputs`.

    Steps:
      1. Run CP-0 readiness; flip DagRun → RUNNING.
      2. If CP-0 BLOCKED, persist + finalise as BLOCKED.
      3. Build route plan from readiness (ready := all modules CP-0 cleared).
      4. Execute via the registry runner with `governance.qa_engine.run_qa`
         gating each output (Blocked propagates downstream).
      5. Persist every module's payload (and QA result) to `agent_outputs`.
      6. Finalise DagRun with aggregated outputs.

    Failures in any single module are contained — the runner marks that
    module Blocked but the rest of the pipeline keeps going.
    """
    from datetime import datetime, timezone

    import structlog

    from agents.orchestration.dag import _persist_agent_output
    from agents.orchestration.readiness import run_cp0
    from db.models import DagRun
    from db.session import AsyncSessionLocal
    from governance.qa_engine import run_qa

    log = structlog.get_logger()

    async with AsyncSessionLocal() as db:
        run = await db.get(DagRun, dag_run_id)
        if run:
            run.status = "RUNNING"
            await db.commit()

    # 1. CP-0 readiness
    try:
        cp0_output = await run_cp0(issuer_id, document_id)
    except Exception as e:
        log.exception("CP-0 crashed", dag_run_id=dag_run_id, error=str(e))
        async with AsyncSessionLocal() as db:
            run = await db.get(DagRun, dag_run_id)
            if run:
                run.status = "FAILED"
                run.completed_at = datetime.now(timezone.utc)
                run.agent_outputs = {"errors": [f"CP-0 crashed: {e}"]}
                await db.commit()
        return

    cp0_verdict = cp0_output.get("verdict")
    run_type = cp0_output.get("run_type", "FULL_RUN")
    await _persist_agent_output(
        dag_run_id=dag_run_id, module_id="CP-0",
        status="COMPLETED" if cp0_verdict == "READY" else "BLOCKED",
        output=cp0_output, severity="PASS",
        blocked_reason=cp0_output.get("blocking_reason"),
    )

    if cp0_verdict != "READY":
        async with AsyncSessionLocal() as db:
            run = await db.get(DagRun, dag_run_id)
            if run:
                run.status = "BLOCKED"
                run.run_type = run_type
                run.completed_at = datetime.now(timezone.utc)
                run.agent_outputs = {"cp0": cp0_output}
                await db.commit()
        return

    # 2. Build & execute the registry plan.
    #    `ready` is the set of analytical modules whose source dependencies CP-0
    #    cleared, minus the modules handled outside the generic plan loop
    #    (NON_PLAN_MODULES). Individual agents enforce their own hard gates
    #    (e.g. CP-2B, CP-3B).
    from agents.orchestration.registry_planner import build_route_plan
    from governance.registry import load_registry

    reg = load_registry()
    analytical = {m for m, mod in reg.modules.items() if mod.layer not in ("Infra",)}
    ready_set: set[str]
    if force_full_run or run_type == "FULL_RUN":
        ready_set = analytical - NON_PLAN_MODULES
    else:
        # DELTA_RUN: only the modules that don't require fresh canonical inputs.
        ready_set = analytical - NON_PLAN_MODULES - {
            "CP-1A", "CP-3", "CP-3B", "CP-3C", "CP-3D", "CP-4", "CP-6E",
        }

    plan = build_route_plan(ready=ready_set)
    context = {"issuer_id": issuer_id, "document_id": document_id,
               "capital_structure": None, "portfolio_constraints": None}

    blocked_modules: list[str] = []
    aggregated: dict[str, Any] = {"cp0": cp0_output}

    try:
        results = await execute_plan(plan, default_invoke, context=context, qa=run_qa)
    except Exception as e:
        log.exception("Registry runner crashed", dag_run_id=dag_run_id, error=str(e))
        async with AsyncSessionLocal() as db:
            run = await db.get(DagRun, dag_run_id)
            if run:
                run.status = "FAILED"
                run.run_type = run_type
                run.completed_at = datetime.now(timezone.utc)
                run.agent_outputs = {"cp0": cp0_output,
                                     "errors": [f"runner crashed: {e}"]}
                await db.commit()
        return

    # 3. CP-5B traceability over the collected outputs (its legacy signature
    #    takes the outputs list, so it runs as an explicit post-step).
    try:
        from agents.l5_governance.cp5b_traceability import run_cp5b
        cp5b_out = await run_cp5b([o for o in results.values() if isinstance(o, dict)])
        results["CP-5B"] = cp5b_out
    except Exception as e:
        log.warning("CP-5B traceability failed", dag_run_id=dag_run_id, error=str(e))
        results["CP-5B"] = {"module_id": "CP-5B", "qa_status": "Blocked",
                            "validation_warnings": [f"execution error: {e}"]}

    # 4. Persist per-module outputs.
    for module_id, out in results.items():
        if not isinstance(out, dict):
            continue
        qa = out.get("_qa") or {}
        qa_status = qa.get("qa_status", "Passed")
        is_blocked = qa_status == "Blocked" or out.get("qa_status") == "Blocked"
        if is_blocked:
            blocked_modules.append(module_id)
        severity = {"Passed": "PASS", "Restricted": "WARNING",
                    "Blocked": "CRITICAL"}.get(qa_status, "PASS")
        blocked_reason = None
        if is_blocked:
            findings = qa.get("findings", [])
            blocked_reason = ("; ".join(f.get("description", "") for f in findings[:3])
                              or "; ".join(out.get("validation_warnings", [])[:3])
                              or "QA Blocked")
        await _persist_agent_output(
            dag_run_id=dag_run_id, module_id=module_id,
            status="BLOCKED" if is_blocked else "COMPLETED",
            output=out, severity="CRITICAL" if is_blocked else severity,
            blocked_reason=blocked_reason,
        )
        aggregated[module_id.lower().replace("-", "_")] = out

    # 5. Finalise. Module failures surface as BLOCKED rows; FAILED is reserved
    #    for runner crashes (handled above).
    final_status = "BLOCKED" if blocked_modules else "COMPLETED"
    async with AsyncSessionLocal() as db:
        run = await db.get(DagRun, dag_run_id)
        if run:
            run.status = final_status
            run.run_type = run_type
            run.completed_at = datetime.now(timezone.utc)
            run.agent_outputs = {
                **aggregated,
                "route_plan": plan,
                "blocked_modules": blocked_modules,
            }
            await db.commit()

    log.info("DAG complete (registry)", dag_run_id=dag_run_id,
             status=final_status, blocked=blocked_modules)
