"""
Registry-driven agent dispatch (P1).

Maps each CP module_id to its agent entry point. CP-X / the DAG runner uses this
to invoke modules in the order produced from `governance/module_registry.json`,
replacing the hand-wired graph in `orchestration/dag.py` (Redeploy Plan D3).

`AGENT_DISPATCH` values are dotted "package.module:function" paths resolved
lazily (importlib) so this module imports without pulling in agent deps.
NEW_ENVELOPE marks agents already migrated to the canonical CPModulePayloadBase.
"""

from __future__ import annotations

# module_id -> "module.path:function"
AGENT_DISPATCH: dict[str, str] = {
    "CP-0":  "agents.orchestration.readiness:run_cp0",
    "CP-X":  "agents.orchestration.planner_router:run_cpx",
    "CP-1":  "agents.l1_base.cp1_capital_structure:run_cp1",
    "CP-1A": "agents.l1_base.cp1a_debt_waterfall:run_cp1a",
    "CP-1B": "agents.l1_base.cp1b_earnings_update:run_cp1b",
    "CP-1C": "agents.l1_base.cp1c_peer_benchmark:run_cp1c",            # NEW (P1)
    "CP-2":  "agents.l2_synthesis.cp2_fundamentals:run_cp2",
    "CP-2B": "agents.l2_synthesis.cp2b_downside_pathway:run_cp2b",     # NEW (P1)
    "CP-2C": "agents.l2_synthesis.cp2c_event_catalyst:run_cp2c",       # NEW (P1)
    "CP-2D": "agents.l2_synthesis.cp2d_governance_sponsor:run_cp2d",   # NEW (P1)
    "CP-2E": "agents.l2_synthesis.cp2e_liquidity_bridge:run_cp2e",     # NEW (P1)
    "CP-2F": "agents.l2_synthesis.cp2f_macro_fx:run_cp2f",             # NEW (P1)
    "CP-3":  "agents.l3_relative_value.cp3_relative_value:run_cp3",
    "CP-3B": "agents.l3_relative_value.cp3b_recovery_instrument:run_cp3b",  # NEW (P1)
    "CP-3C": "agents.l3_relative_value.cp3c_portfolio_fit:run_cp3c",   # NEW (P1)
    "CP-3D": "agents.l3_relative_value.cp3d_refinancing_lme:run_cp3d", # NEW (P1)
    "CP-4":  "agents.l4_legal.cp4_covenant_interpreter:run_cp4",
    "CP-4C": "agents.l4c_capacity.cp4c_capacity_headroom:run_cp4c",
    "CP-5":  "agents.l5_governance.cp5_integrity_qa:run_cp5",
    "CP-5B": "agents.l5_governance.cp5b_traceability:run_cp5b",
    "CP-6A": "agents.l6_debate.cp6a_ic_debate:run_cp6a",               # NEW (P1)
    "CP-6E": "agents.l6_debate.cp6e_portfolio_debate:run_cp6e",
    "CP-SR": "agents.l7_sector_monitoring.cp_sr_sector_review:run_cp_sr",   # NEW (P3)
    "CP-MON": "agents.l7_sector_monitoring.cp_mon_credit_pulse:run_cp_mon", # NEW (P3)
}

# Agents emitting the canonical CPModulePayloadBase envelope (vs legacy schema).
NEW_ENVELOPE: set[str] = {
    "CP-1C", "CP-2B", "CP-2C", "CP-2D", "CP-2E", "CP-2F",
    "CP-3B", "CP-3C", "CP-3D", "CP-6A", "CP-SR", "CP-MON",
}

# All analytical + L7 modules now have agents; only infra services remain non-agent.
PENDING: set[str] = set()

# Infra services — handled outside the agent mesh.
INFRA: set[str] = {"CP-RENDER", "CP-EXTRACT", "CP-DB"}


def resolve(module_id: str):
    """Import and return the agent run-function for a module_id."""
    import importlib

    spec = AGENT_DISPATCH[module_id]
    mod_path, func = spec.split(":")
    return getattr(importlib.import_module(mod_path), func)
