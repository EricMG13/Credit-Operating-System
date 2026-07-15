"""Issuer profile read-model (GET /api/issuers/{id}/profile).

Covers the three behaviours that matter: a missing issuer 404s; a hand-created
issuer with no completed run degrades to empty sections (never fabricates); and a
real completed run populates metrics + the signal/coverage roll-ups.
"""

from __future__ import annotations

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from conftest import ratings_xlsx, wait_for_run

SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
sys.path.insert(0, str(SERVER_DIR))


@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as c:
        yield c


def test_profile_unknown_issuer_404(client):
    assert client.get("/api/issuers/nope-no-such/profile").status_code == 404


def test_profile_new_issuer_degrades_empty(client):
    """A name with no completed run shows blanks, not demo numbers (trust)."""
    iid = client.post("/api/issuers/", json={"name": "No Run Co"}).json()["id"]
    body = client.get(f"/api/issuers/{iid}/profile").json()

    assert body["issuer"]["name"] == "No Run Co"
    assert body["latest_run"] is None
    assert body["runs"] == []
    assert body["metrics"] == []            # hand-created issuer has no seed facts
    assert body["signals"] == {}            # no run → no signals (not fabricated)
    assert body["coverage"]["documents"] == 0
    assert body["findings"] == {"CRITICAL": 0, "MATERIAL": 0, "MINOR": 0}


def test_profile_after_run_populates(client):
    """A completed run flows through to metrics + the signal/coverage roll-ups."""
    iid = client.post("/api/issuers/", json={"name": "Run Me Co", "ticker": "RUNC"}).json()["id"]
    run = client.post("/api/runs", json={"issuer_id": iid})
    assert run.status_code == 201, run.text
    finished = wait_for_run(client, run.json()["id"])
    assert finished["status"] == "complete"

    body = client.get(f"/api/issuers/{iid}/profile").json()

    assert body["latest_run"]["status"] == "complete"
    assert body["latest_run"]["committee_status"]  # rolled up from the run
    assert body["runs"] and body["runs"][0]["id"] == run.json()["id"]

    keys = {m["metric_key"] for m in body["metrics"]}
    assert "net_leverage" in keys             # CP-1 projected its leverage ratio
    assert {"fcf", "fcf_conversion"} <= keys  # FCF + cash conversion (FCF / revenue)
    nls = [m for m in body["metrics"] if m["metric_key"] == "net_leverage"]
    assert any(m["headline"] for m in nls)    # one headline value backs the snapshot
    assert all(m["provenance"] for m in nls)  # every point carries provenance for the UI

    # Signals/coverage keys are always present after a complete run; values may be
    # None where a given module didn't surface them — the roll-up never errors.
    assert "recommendation" in body["signals"]
    assert "rp_basket_musd" in body["signals"]      # covenant register (CP-4C)
    assert "addback_utilization_pct" in body["signals"]
    assert "readiness_score" in body["coverage"]

    # New sections: business facts (CP-1A), sponsor (CP-2D), derived S/W — present
    # as the right container types even when a given run surfaced nothing.
    assert isinstance(body["business"], list)
    assert isinstance(body["sponsor"], dict)
    assert isinstance(body["strengths"], list) and isinstance(body["weaknesses"], list)


def test_profile_labels_retained_facts_and_excludes_blocked_signals(client):
    iid = client.post("/api/issuers/", json={"name": "Last Good Profile Co"}).json()["id"]

    async def seed():
        from database import AsyncSessionLocal, MetricFact, ModuleOutput, Run

        now = datetime.now(timezone.utc)
        async with AsyncSessionLocal() as db:
            accepted = Run(
                issuer_id=iid,
                status="complete",
                qa_status="Passed",
                committee_status="Committee Ready",
                as_of_date="2025-12-31",
                created_at=now - timedelta(days=1),
                completed_at=now - timedelta(days=1),
            )
            blocked = Run(
                issuer_id=iid,
                status="complete",
                qa_status="Blocked",
                committee_status="Blocked",
                as_of_date="2026-03-31",
                created_at=now,
                completed_at=now,
            )
            db.add_all([accepted, blocked])
            await db.flush()
            db.add(MetricFact(
                issuer_id=iid,
                run_id=accepted.id,
                module_id="CP-1",
                metric_key="net_leverage",
                period="FY2025",
                value=4.2,
                unit="x",
                headline=True,
                qa_status="Passed",
                provenance="run",
            ))
            db.add(ModuleOutput(
                run_id=blocked.id,
                module_id="CP-2E",
                module_name="LiquidityRunway",
                # A dependent can remain Restricted even though the run-level
                # foundation is Blocked; the profile must still reject it.
                qa_status="Restricted",
                committee_status="Restricted",
                runtime_output={"months_liquidity_covers_interest": 1.0},
            ))
            await db.commit()
            return accepted.id, blocked.id

    accepted_id, blocked_id = asyncio.run(seed())
    body = client.get(f"/api/issuers/{iid}/profile").json()

    assert body["signal_run_id"] == blocked_id
    assert body["signals"]["runway_months"] is None
    metric = next(m for m in body["metrics"] if m["metric_key"] == "net_leverage")
    assert metric["run_id"] == accepted_id
    assert metric["source_run_as_of"] == "2025-12-31"
    assert metric["created_at"]


def test_issuer_ratings_collected_from_ingest(client):
    """Ratings are no longer typed on the issuer — they're collected from an
    ingested structured sheet (Ratings column) and surface in the profile header.
    Ratings sent on create are ignored (not an IssuerCreate field)."""
    iid = client.post(
        "/api/issuers/", json={"name": "Rated Co", "rating_moody": "typed-should-ignore"}
    ).json()["id"]
    # Create-time rating is dropped; the issuer starts unrated.
    assert client.get(f"/api/issuers/{iid}/profile").json()["issuer"]["rating_moody"] is None

    up = client.post(
        "/api/ingestion/upload/pricing-sheet",
        data={"issuer_id": iid, "run_mode": "full"},
        files={"file": ("holdings.xlsx", ratings_xlsx([("Rated Co", "B1 / B+")]),
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert up.status_code == 200, up.text
    assert up.json().get("ratings_updated") == 1

    iss = client.get(f"/api/issuers/{iid}/profile").json()["issuer"]
    assert (iss["rating_moody"], iss["rating_sp"]) == ("B1", "B+")
    assert iss["rating_fitch"] is None  # sheets carry Moody's / S&P only


def test_issuer_created_by_stamped_from_identity_not_body(client):
    # SEAM4-4: a created issuer records who created it (governance attribution) —
    # taken from the verified identity, and a spoofed created_by in the request
    # body is ignored (not an IssuerCreate field).
    me = client.post("/api/auth/profile", json={"code": "131113", "name": "Rater Ray"}).json()
    try:
        created = client.post("/api/issuers/", json={
            "name": "Attributed Co", "created_by": "spoofed-id",
        }).json()
        assert created["created_by"] == me["id"] != "spoofed-id"
    finally:
        client.post("/api/auth/logout")  # restore local-dev identity for later tests


def test_profile_signals_covenant_register():
    """CP-4C register terms flow into the signals roll-up; absent keys stay None."""
    from routes.issuers import _profile_signals

    class _M:
        def __init__(self, rt):
            self.runtime_output = rt

    sig = _profile_signals({"CP-4C": _M({
        "covenant_structure": "cov-lite",
        "rp_basket_musd": 150.0,
        "cross_default_musd": 50.0,
        "addback_cap_pct": 0.25,
        "addback_audit": {"utilization_pct": 112.0, "breach": True},
    })})
    assert sig["rp_basket_musd"] == 150.0
    assert sig["cross_default_musd"] == 50.0
    assert sig["addback_cap_pct"] == 0.25
    assert sig["addback_utilization_pct"] == 112.0
    assert sig["addback_breach"] is True

    empty = _profile_signals({})
    assert empty["rp_basket_musd"] is None
    assert empty["addback_utilization_pct"] is None
    assert empty["addback_breach"] is None


def test_strengths_weaknesses_rules():
    """The derived read is deterministic and direction-correct."""
    from routes.issuers import _strengths_weaknesses

    s, w = _strengths_weaknesses(
        {"composite_percentile": 75, "fragility": "LOW", "lme_band": "LOW"},
        {"net_leverage": 3.0, "interest_coverage": 4.0},
    )
    assert any("cheap" in x for x in s) and any("Conservative leverage" in x for x in s)
    assert w == []

    s2, w2 = _strengths_weaknesses(
        {"composite_percentile": 20, "fragility": "HIGH", "shock_to_breach_pct": 10, "lme_band": "MODERATE"},
        {"net_leverage": 7.0, "interest_coverage": 1.2},
    )
    assert any("Elevated leverage" in x for x in w2)
    assert any("fragility" in x.lower() for x in w2)
    assert any("LME" in x for x in w2)  # MODERATE band must register (not just MEDIUM)
    assert s2 == []
