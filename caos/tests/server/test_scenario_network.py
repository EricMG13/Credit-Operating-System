"""Scenario Network finite/degradation contract."""

from __future__ import annotations

from types import SimpleNamespace

from engine.scenario_network import NodeStatus, PropagationSource, ShockInput, propagate
import pytest
from fastapi import HTTPException


def _payload(ebitda=100.0):
    return {
        "CP-1": {"normalized_financials": {
            "adj_ebitda": {"LTM 2026": ebitda},
            "net_debt_ltm": 500.0,
            "net_leverage_adj_ltm": 5.0,
        }},
        "CP-2E": {"disclosed_liquidity_musd": 120.0, "annual_cash_interest_musd": 50.0},
        "CP-4C": {"leverage_covenant_x": 6.5},
        "CP-3B": {"tranches": [
            {"code": "1L", "tranche": "First lien", "seniority_rank": 1, "amount_musd": 400.0},
            {"code": "2L", "tranche": "Second lien", "seniority_rank": 2, "amount_musd": 200.0},
        ]},
        "CP-3": {"recommendation": "NEUTRAL"},
    }


def test_propagates_finite_stress_chain():
    result = propagate(ShockInput(issuer_id="i", run_id="r", ebitda_pct=-0.2, rate_bps=200), _payload())
    by_id = {node.node: node for node in result.nodes}
    assert by_id["stress"].value == 80.0
    assert by_id["liquidity"].status == NodeStatus.COMPUTED
    assert by_id["covenant"].value == 0.25
    assert by_id["recovery"].status == NodeStatus.COMPUTED
    assert by_id["rv"].status == NodeStatus.NO_DATA
    assert by_id["portfolio"].status == NodeStatus.NO_DATA


def test_nonfinite_ebitda_degrades_without_nan():
    result = propagate(ShockInput(issuer_id="i", run_id="r", ebitda_pct=-0.2), _payload(float("nan")))
    by_id = {node.node: node for node in result.nodes}
    assert by_id["stress"].status == NodeStatus.NO_DATA
    assert by_id["stress"].value is None
    assert by_id["recovery"].status == NodeStatus.DEGRADED


def test_near_total_shock_never_divides_by_zero():
    result = propagate(ShockInput(issuer_id="i", run_id="r", ebitda_pct=-0.9), _payload())
    assert all(node.value is None or node.value == node.value for node in result.nodes)


def test_noop_shock_is_rejected():
    with pytest.raises(ValueError):
        ShockInput(issuer_id="i", run_id="r", ebitda_pct=0, rate_bps=0)


@pytest.mark.parametrize(
    ("status", "qa_status"),
    [("running", "Pending"), ("complete", "Blocked")],
)
def test_scenario_route_rejects_ineligible_runs(status, qa_status):
    from routes.scenario import _accepted_scenario_payload

    run = SimpleNamespace(status=status, qa_status=qa_status, committee_status="Blocked")
    with pytest.raises(HTTPException) as exc:
        _accepted_scenario_payload(run, [])
    assert exc.value.status_code == 409


def test_scenario_payload_excludes_blocked_modules_and_reports_source_status():
    from routes.scenario import _accepted_scenario_payload

    run = SimpleNamespace(status="complete", qa_status="Restricted", committee_status="Restricted")
    outputs = [
        SimpleNamespace(module_id="CP-1", qa_status="Passed", runtime_output={"x": 1}),
        SimpleNamespace(module_id="CP-2E", qa_status="Blocked", runtime_output={"x": 2}),
    ]
    payload, source = _accepted_scenario_payload(run, outputs)

    assert payload == {"CP-1": {"x": 1}}
    assert source == PropagationSource(
        run_status="complete",
        qa_status="Restricted",
        committee_status="Restricted",
        included_modules=["CP-1"],
        excluded_modules=["CP-2E"],
    )
    result = propagate(
        ShockInput(issuer_id="i", run_id="r", ebitda_pct=-0.2), payload, source=source
    )
    assert result.source == source
