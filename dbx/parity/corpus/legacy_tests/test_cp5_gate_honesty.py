"""B4 — CP-5 gate honesty re-check on golden data (PRE_DEPLOYMENT_PLAN §4).

Adjacent suites test the finding providers and the severity ladder in
isolation on synthetic payloads (`test_cp1_grounding.py`,
`test_tier2_findings_contract.py`, `golden/test_golden_query_gates.py`).
Nothing proved the chain stays honest on the *golden* CP-1 payload: that
pristine real-issuer data passes the gate clean, and that a single injected
known-bad figure — or a single dropped evidence link — actually surfaces as a
finding and gates the run instead of shipping Certified. This file freezes
that contract on the VSAT golden fixture. Fully offline — never touches SEC
or an LLM.
"""
from __future__ import annotations

import copy
import json
from pathlib import Path

from engine.adjusted import reconciliation_finding
from engine.edgar_cp1 import build_cp1_payload
from engine.gate import committee_status_from, qa_status_from, roll_up_qa_status
from engine.lineage import validate_lineage
from engine.metrics import (
    cp1_grounding_finding,
    leverage_magnitude_finding,
    leverage_plausibility_finding,
)

GOLDEN = Path(__file__).resolve().parent / "golden"

# The CP-1-consuming subset of the runner's _FINDING_PROVIDERS table
# (engine/runner.py) — the deterministic checks the CP-5 gate consumes for
# this module alongside lineage findings.
CP1_PROVIDERS = (
    reconciliation_finding,
    leverage_plausibility_finding,
    leverage_magnitude_finding,
    cp1_grounding_finding,
)


def _vsat_payload():
    facts = json.loads((GOLDEN / "vsat_facts.json").read_text())
    payload = build_cp1_payload("Viasat, Inc.", facts)
    assert payload is not None
    return payload


def _findings(payload):
    provider = [f for p in CP1_PROVIDERS if (f := p(payload)) is not None]
    return validate_lineage([payload]) + provider


def test_pristine_golden_payload_passes_the_gate_clean():
    """Control: the gate must not cry wolf on known-correct real-issuer data —
    otherwise the injection cases below prove nothing."""
    findings = _findings(_vsat_payload())
    assert [f for f in findings if f.severity in ("MATERIAL", "CRITICAL")] == []
    status = qa_status_from(findings)
    assert status == "Passed"
    assert committee_status_from(status, "High") == "Committee Ready"


def test_injected_bad_figure_raises_material_finding_and_restricts_the_run():
    """One known-bad figure: the asserted net leverage is corrupted to 10x its
    golden value while net debt and EBITDA stay untouched. The deterministic
    cross-check (CP-1-LEV-PLAUS) must fire MATERIAL and the CP-5 gate must
    hold the run at Restricted — not Certified."""
    payload = copy.deepcopy(_vsat_payload())
    nf = payload.runtime_output["normalized_financials"]
    nf["net_leverage_adj_ltm"] = nf["net_leverage_adj_ltm"] * 10  # 3.21 -> 32.1

    findings = _findings(payload)
    plaus = [f for f in findings if f.finding_id == "CP-1-LEV-PLAUS"]
    assert plaus, "corrupted leverage must raise the plausibility finding"
    assert plaus[0].severity == "MATERIAL"

    status = qa_status_from(findings)
    assert status == "Restricted"
    assert committee_status_from(status, "High") == "Restricted"
    # Run-level roll-up: one gated module gates the whole run.
    assert roll_up_qa_status(["Passed", status, "Passed"]) == "Restricted"


def test_dropped_evidence_raises_critical_finding_and_blocks_the_run():
    """One dropped evidence link: strip a single claim's evidence list. The
    lineage validator must flag the orphan claim CRITICAL and the gate must
    Block the run outright."""
    payload = copy.deepcopy(_vsat_payload())
    payload.claims[0].evidence = []

    findings = _findings(payload)
    orphans = [f for f in findings if f.severity == "CRITICAL"]
    assert orphans, "an uncited claim must raise a CRITICAL lineage finding"
    assert payload.claims[0].claim_id in (orphans[0].affected_claim_id or "")

    status = qa_status_from(findings)
    assert status == "Blocked"
    assert committee_status_from(status, "High") == "Blocked"
    assert roll_up_qa_status(["Passed", status]) == "Blocked"
