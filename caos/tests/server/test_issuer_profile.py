"""Issuer profile read-model (GET /api/issuers/{id}/profile).

Covers the three behaviours that matter: a missing issuer 404s; a hand-created
issuer with no completed run degrades to empty sections (never fabricates); and a
real completed run populates metrics + the signal/coverage roll-ups.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from conftest import wait_for_run

SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
sys.path.insert(0, str(SERVER_DIR))


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("caos-profile")
    os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{tmp / 'test.db'}"
    os.environ["CAOS_STORAGE_DIR"] = str(tmp / "vault")
    os.environ["ANTHROPIC_API_KEY"] = ""  # demo/fixture fallback — no external calls
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
    assert "readiness_score" in body["coverage"]

    # New sections: business facts (CP-1A), sponsor (CP-2D), derived S/W — present
    # as the right container types even when a given run surfaced nothing.
    assert isinstance(body["business"], list)
    assert isinstance(body["sponsor"], dict)
    assert isinstance(body["strengths"], list) and isinstance(body["weaknesses"], list)


def test_issuer_ratings_round_trip(client):
    """Agency ratings persist on the issuer and surface in the profile header."""
    iid = client.post("/api/issuers/", json={
        "name": "Rated Co", "rating_sp": "B+", "rating_moody": "B1", "rating_fitch": "BB-",
    }).json()["id"]
    iss = client.get(f"/api/issuers/{iid}/profile").json()["issuer"]
    assert (iss["rating_sp"], iss["rating_moody"], iss["rating_fitch"]) == ("B+", "B1", "BB-")


def test_issuer_created_by_stamped_from_identity_not_body(client):
    # SEAM4-4: a created issuer records who created it (governance attribution for
    # the analyst-entered agency ratings) — taken from the verified identity, and
    # a spoofed created_by in the request body is ignored (not an IssuerCreate field).
    me = client.post("/api/auth/profile", json={"code": "131113", "name": "Rater Ray"}).json()
    try:
        created = client.post("/api/issuers/", json={
            "name": "Attributed Co", "rating_sp": "B+", "created_by": "spoofed-id",
        }).json()
        assert created["created_by"] == me["id"] != "spoofed-id"
    finally:
        client.post("/api/auth/logout")  # restore local-dev identity for later tests


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
