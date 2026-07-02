"""Sponsor track-record, daily digest, and cross-default domino read-models.

All three are reads over persisted state (no LLM): sponsors group issuers by the
analyst-entered ``Issuer.sponsor`` and roll up CP-2D reviews; the digest rolls up
coverage staleness + WARF over analyst-entered ratings; the cross-default map
combines CP-3B tranches with CP-4C's extracted threshold. Assertions are
membership-based where the DB is shared across test modules (totals drift), and
exact only for data this module creates.
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

from routes.digest import _rating_index, _warf_band  # noqa: E402
from routes.issuers import _domino_map  # noqa: E402


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("caos-sponsor-digest")
    os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{tmp / 'test.db'}"
    os.environ["CAOS_STORAGE_DIR"] = str(tmp / "vault")
    os.environ["ANTHROPIC_API_KEY"] = ""  # deterministic regex/fixture paths only
    from main import app

    with TestClient(app) as c:
        yield c


# ── Pure helpers ─────────────────────────────────────────────────────────────
class _I:
    """Duck-typed issuer for the rating helpers."""

    def __init__(self, m=None, s=None, f=None):
        self.rating_moody, self.rating_sp, self.rating_fitch = m, s, f


def test_rating_index_scales_align_and_outlooks_drop():
    assert _rating_index(_I(m="B2")) == _rating_index(_I(s="B"))  # index-aligned scales
    assert _rating_index(_I(m="B2 (negative)")) == _rating_index(_I(m="B2"))
    assert _rating_index(_I(m="B2", s="CCC+")) == _rating_index(_I(m="B2"))  # Moody's preferred
    assert _rating_index(_I(f="BB-")) is not None  # Fitch fallback
    assert _rating_index(_I()) is None
    assert _rating_index(_I(m="not-a-rating")) is None


def test_warf_band_nearest_factor():
    assert _warf_band(2720) == "B2"
    assert _warf_band(3745) == "B3"    # nearer 3490 than Caa1's 4770
    assert _warf_band(9600) == "Ca"  # nearer 10000 than Caa3's 8070


def test_domino_map_threshold_unsized_and_missing():
    tranches = [
        {"code": "TLB", "tranche": "Term Loan B", "amount_musd": 900.0},
        {"code": "SSN", "tranche": "Senior Secured Notes", "amount_musd": 40.0},
        {"code": "RCF", "tranche": "Revolver", "amount_musd": None},
    ]
    rows = {r.code: r for r in _domino_map(tranches, 50.0)}
    assert rows["TLB"].trips_cross_default is True
    assert set(rows["TLB"].pulls_in) == {"SSN", "RCF"}
    assert rows["SSN"].trips_cross_default is False and rows["SSN"].pulls_in == []
    assert rows["RCF"].trips_cross_default is None  # unsized → cannot say
    # No / non-finite threshold → nothing computable, never a guess.
    assert all(r.trips_cross_default is None for r in _domino_map(tranches, None))
    assert all(r.trips_cross_default is None for r in _domino_map(tranches, float("nan")))
    assert _domino_map([{"no": "code"}, "junk"], 50.0) == []  # malformed rows dropped


# ── Sponsor endpoints ────────────────────────────────────────────────────────
def test_sponsors_group_and_track_record(client):
    client.post("/api/issuers/", json={"name": "Sponsored A Co", "sponsor": "Apex Capital"})
    client.post("/api/issuers/", json={"name": "Sponsored B Co", "sponsor": "Apex Capital"})
    client.post("/api/issuers/", json={"name": "Solo C Co"})  # no sponsor → not listed

    lst = client.get("/api/sponsors/").json()
    apex = next(s for s in lst if s["sponsor"] == "Apex Capital")
    assert apex["issuer_count"] == 2
    assert all(s["sponsor"] for s in lst)

    tr = client.get("/api/sponsors/Apex Capital").json()
    assert tr["issuer_count"] == 2
    assert {r["name"] for r in tr["issuers"]} == {"Sponsored A Co", "Sponsored B Co"}
    # No runs yet → scores absent, never fabricated.
    assert tr["avg_governance_risk_score"] is None
    assert all(r["governance_risk_score"] is None for r in tr["issuers"])

    assert client.get("/api/sponsors/NoSuchSponsor").status_code == 404


def test_sponsor_track_record_after_run(client):
    iid = client.post(
        "/api/issuers/", json={"name": "Sponsored Run Co", "sponsor": "RunFund"}
    ).json()["id"]
    run = wait_for_run(client, client.post("/api/runs", json={"issuer_id": iid}).json()["id"])
    assert run["status"] == "complete"

    tr = client.get("/api/sponsors/RunFund").json()
    row = tr["issuers"][0]
    assert row["run_id"] == run["id"]
    assert row["qa_status"]  # roll-up carried from the run


# ── Cross-default map ────────────────────────────────────────────────────────
def test_cross_default_unknown_issuer_404(client):
    assert client.get("/api/issuers/nope-no-such/cross-default").status_code == 404


def test_cross_default_no_run_degrades(client):
    iid = client.post("/api/issuers/", json={"name": "XD NoRun Co"}).json()["id"]
    body = client.get(f"/api/issuers/{iid}/cross-default").json()
    assert body["run_id"] is None and body["dominoes"] == []
    assert "No completed run" in body["note"]


def test_cross_default_docless_run_degrades_with_note(client):
    iid = client.post("/api/issuers/", json={"name": "XD DocLess Co"}).json()["id"]
    run = wait_for_run(client, client.post("/api/runs", json={"issuer_id": iid}).json()["id"])
    body = client.get(f"/api/issuers/{iid}/cross-default").json()
    assert body["run_id"] == run["id"]
    assert body["threshold_musd"] is None
    assert body["note"]  # explains what's missing rather than fabricating a map


# ── Daily digest ─────────────────────────────────────────────────────────────
def test_daily_digest_watchlists_and_warf(client):
    ccc = client.post(
        "/api/issuers/", json={"name": "Digest CCC Co", "rating_moody": "Caa1"}
    ).json()["id"]
    client.post("/api/issuers/", json={"name": "Digest Unrated Co"})

    d = client.get("/api/digest/daily").json()
    assert d["coverage"]["issuers"] >= 2
    assert d["coverage"]["rated"] >= 1 and d["coverage"]["unrated"] >= 1
    assert d["warf"] is not None and d["warf_band"]
    assert any(w["issuer_id"] == ccc for w in d["ccc_watch"])
    # Never-run names appear on the stale list with an explicit "never run".
    assert any(w["issuer_id"] == ccc and w["detail"] == "never run" for w in d["stale"])
    assert set(d["activity_24h"]) == {"runs_completed", "runs_failed"}
    assert d["stale_threshold_days"] == 30
