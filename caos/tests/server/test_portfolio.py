"""GET /api/portfolio — latest-complete-run posture rolled up across issuers.

Drives a real offline run (ANTHROPIC_API_KEY="" in conftest → deterministic
engine) and asserts the issuer surfaces with its run-derived metrics. Invariants
are written to be safe under the shared process-global test DB (other modules may
have created completed runs already — so never assert the board is empty)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from engine.fixtures import REFERENCE_ISSUER_ID


@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as c:
        yield c


def test_portfolio_shape_and_invariants(client):
    r = client.get("/api/portfolio")
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body["rows"], list)
    assert body["issuer_count"] >= 1                       # demo issuers seeded
    assert body["covered_count"] == len(body["rows"])      # covered == rows
    assert body["covered_count"] <= body["issuer_count"]   # can't cover more than exist
    for row in body["rows"]:
        assert row["run_id"] and row["issuer_id"]
        assert isinstance(row["metrics"], dict)


def test_portfolio_row_appears_after_a_complete_run(client):
    from conftest import wait_for_run

    run = client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID})
    assert run.status_code in (200, 201), run.text
    rid = run.json()["id"]
    wait_for_run(client, rid)

    body = client.get("/api/portfolio").json()
    row = next((x for x in body["rows"] if x["issuer_id"] == REFERENCE_ISSUER_ID), None)
    assert row is not None, "reference issuer should appear after a complete run"
    assert row["run_id"] == rid                            # latest complete run
    assert row["qa_status"] and row["committee_status"]
    # CP-1 LTM net leverage is a headline run-provenance fact → surfaced live.
    assert "net_leverage" in row["metrics"]
    assert isinstance(row["metrics"]["net_leverage"], (int, float))
    # CP-2B fragility is engine-derived off CP-1; the key is present, value valid.
    assert row["downside_fragility"] in ("HIGH", "MODERATE", "LOW", None)


def test_portfolio_read_rate_limited(client):
    # SEC-1 parity: read GET is guarded at 60/min/caller; the window's overflow 429s.
    import rate_limit

    rate_limit.reset()
    codes = [client.get("/api/portfolio").status_code for _ in range(62)]
    assert 429 in codes, "read guard should reject once the per-minute window is exceeded"
    rate_limit.reset()


def test_portfolio_gaps_maps_cp0_gap_log():
    """The live Source-Gaps board (A-1) derives from CP-0's gap log. Map the gap
    severity to the board's high/medium/low and skip malformed/textless entries."""
    from routes.portfolio import _portfolio_gaps

    gaps = _portfolio_gaps({"gap_log": [
        {"id": "G-01", "severity": "warning", "text": "No audited financials vaulted."},
        {"id": "G-02", "severity": "critical", "text": "No credit agreement vaulted."},
        {"severity": "warning"},  # textless — skipped
        "not-a-dict",             # malformed — skipped
        {"id": "G-03", "severity": "info", "text": "No hedging register vaulted."},
    ]})
    assert [(g.sev, g.doc) for g in gaps] == [
        ("medium", "No audited financials vaulted."),
        ("high", "No credit agreement vaulted."),
        ("low", "No hedging register vaulted."),  # unknown severity → low
    ]
    assert _portfolio_gaps({}) == []               # no CP-0 output → no gaps
    assert _portfolio_gaps({"gap_log": None}) == []
