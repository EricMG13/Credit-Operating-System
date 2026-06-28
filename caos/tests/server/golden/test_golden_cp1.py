"""Phase-0 golden-master — the drift alarm for the deterministic CP-1 lane.

`test_edgar_cp1.py` exercises the *logic* on hand-built synthetic facts; those
would still pass if real-issuer XBRL parsing silently drifted. This freezes the
CP-1 output computed from **real, captured** SEC company facts (trimmed fixtures
in this dir) so any numeric drift fails CI. Fully offline — never touches SEC.

The VSAT figures are cross-checked against the human-validated VIASAT_VALIDATION.md
(revenue $2,556M→$4,284M→$4,520M→$4,640M; Altman Z'' 4.47 safe), so a green run
certifies real numbers, not just "whatever the code emits today."

Regenerate fixtures with `_capture.py` (one live SEC fetch each); when a frozen
value below changes, confirm the new number is *correct* against the filing
before updating it — that is the whole point of the gate.
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from engine.edgar_cp1 import build_cp1_payload
from engine.reported_cp1 import build_reported_cp1_payload
from engine.schemas import validate_payload

HERE = Path(__file__).resolve().parent

# Frozen known-correct CP-1 output per captured issuer. Headline figures only —
# the things a credit analyst reads and a wrong value = money. Exact match (the
# builder already rounds deterministically) so the alarm is as tight as possible.
GOLDEN = {
    "vsat_facts.json": {
        "entity": "Viasat, Inc.",
        "revenue": {"FY2023": 2556.2, "FY2024": 4283.8, "FY2025": 4519.6, "FY2026": 4640.3},
        "adj_ebitda": {"FY2023": 344.4, "FY2024": 267.7, "FY2025": 1263.3, "FY2026": 1462.6},
        "net_debt_ltm": 4701.8,
        "net_leverage_adj_ltm": 3.21,
        "interest_coverage_ltm": 4.06,
        "altman_z": 4.47,
        "zone": "safe",
    },
    "fun_facts.json": {
        "entity": "Six Flags Entertainment Corporation",
        "revenue": {"FY2022": 1817.4, "FY2023": 1798.7, "FY2024": 2708.9, "FY2025": 3100.3},
        "adj_ebitda": {"FY2022": 673.2, "FY2023": 464.2, "FY2024": 628.6, "FY2025": 629.5},
        "net_debt_ltm": 5090.0,
        "net_leverage_adj_ltm": 8.09,
        "interest_coverage_ltm": None,  # interest concept predates the EBITDA period (#25 gate)
        "altman_z": 1.23,
        "zone": "grey",
    },
}


@pytest.mark.parametrize("fixture", sorted(GOLDEN))
def test_golden_cp1_no_drift(fixture):
    g = GOLDEN[fixture]
    facts = json.loads((HERE / fixture).read_text())
    payload = build_cp1_payload(g["entity"], facts)

    assert payload is not None, f"{fixture}: builder returned None on real facts"
    assert validate_payload(payload) == [], f"{fixture}: schema-invalid payload"
    nf = payload.runtime_output["normalized_financials"]

    assert nf["revenue"] == g["revenue"]
    assert nf["adj_ebitda"] == g["adj_ebitda"]
    assert nf["net_debt_ltm"] == g["net_debt_ltm"]
    assert nf["net_leverage_adj_ltm"] == g["net_leverage_adj_ltm"]
    assert nf.get("interest_coverage_ltm") == g["interest_coverage_ltm"]

    distress = payload.runtime_output.get("distress")
    assert distress is not None, f"{fixture}: Altman Z'' not derived from real balance sheet"
    assert distress["altman_z"] == g["altman_z"]
    assert distress["zone"] == g["zone"]

    # Every headline figure stays one click from its XBRL source (the platform's
    # "show your work" contract) — no claim may ship uncited.
    for claim in payload.claims:
        assert claim.evidence, f"{fixture}: claim {claim.claim_id} has no evidence"
        for ev in claim.evidence:
            assert "us-gaap:" in ev.source_locator or "XBRL" in ev.source_locator


def test_golden_reported_cp1_vmo2_no_drift():
    """VMO2 has no SEC companyfacts; freeze its reported-disclosure CP-1 lane."""
    fixture = json.loads((HERE / "vmo2_reported_chunks.json").read_text())

    async def retrieve(_query, _k=12):
        return [SimpleNamespace(**c) for c in fixture["chunks"]]

    payload = asyncio.run(build_reported_cp1_payload(fixture["entity"], retrieve))

    assert payload is not None, "VMO2: reported CP-1 returned None on issuer disclosures"
    assert validate_payload(payload) == [], "VMO2: schema-invalid reported CP-1 payload"
    assert payload.runtime_output["basis"] == "reported_disclosure"
    assert payload.runtime_output["currency"] == "£"

    nf = payload.runtime_output["normalized_financials"]
    assert nf["net_leverage_adj_ltm"] == 4.38
    assert nf["additional_disclosed_leverage"] == [
        {
            "value": 5.86,
            "as_disclosed": "o would be: Total Net Debt to Annualised Adjusted EBITDA of 5.86x",
        }
    ]
    assert nf["adj_ebitda"] == {"Q1": 901.7}
    assert nf["revenue"] == {"Reported": 2390.1}

    evidence_chunks = {
        ev.resolved_chunk_id
        for claim in payload.claims
        for ev in claim.evidence
    }
    assert evidence_chunks == {
        "vmo2-q1-2026-results",
        "vmo2-q1-2026-financial-table",
        "vmo2-q1-2026-leverage",
    }
