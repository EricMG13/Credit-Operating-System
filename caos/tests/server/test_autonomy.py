"""Tests for the autonomous-cycle orchestrator (engine/autonomy.py) + the
``GET /api/autonomy/draft`` route. Unit tests mock the DAG stages to assert the
chaining, the keyless skip, the no-change skip, and the per-stage fault isolation;
the API test runs the real cycle against the seeded DB (keyless) and asserts the
draft envelope.
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

from engine import autonomy
from engine.anomaly import Anomaly
from engine.analyst import ValidatedClaim
from engine.sentinel import Ticket


# ── run_cycle (mocked stages) ────────────────────────────────────────────────

def _wire(monkeypatch, *, available=True, anomalies=None, claims=None,
          detect_raises=None, investigate_raises=None, current=None):
    monkeypatch.setattr(autonomy, "_current_fingerprints",
                        (lambda db: asyncio.sleep(0, result=current or {"i1": "a", "i2": "b"})))
    monkeypatch.setattr(autonomy, "detect_tickets",
                        lambda current_fps, prior_fps, issuer_ids=None: [
                            Ticket("i1", "changed", "fingerprint moved")])
    monkeypatch.setattr(autonomy, "changed_issuers", lambda tickets: ["i1"])
    monkeypatch.setattr(autonomy.queryanswer, "available", lambda: available)

    async def _detect(db, issuer_ids=None):
        if detect_raises:
            raise detect_raises
        return anomalies if anomalies is not None else [
            Anomaly(kind="ts-jump", direction="up", severity=9.0, issuer_id="i1",
                    issuer_name="Acme", metric="net_leverage", chunk_id="c1",
                    context={})]
    monkeypatch.setattr(autonomy, "detect_anomalies", _detect)

    async def _investigate(db, anoms, **kw):
        if investigate_raises:
            raise investigate_raises
        return claims if claims is not None else [
            ValidatedClaim(text="Acme leverage jumped.", claim_type="observation",
                           issuer_id="i1", anomaly_kind="ts-jump", anomaly_severity=9.0,
                           chunk_ids=["c1"], fact_ids=[], model="fake-heavy")]
    monkeypatch.setattr(autonomy, "investigate", _investigate)

    composed = {"status": "draft", "ratified": False, "sections": [], "summary": {}}
    async def _compose(db, anoms, clms):
        composed["n_anomalies"] = len(anoms)
        composed["n_claims"] = len(clms)
        return dict(composed)
    monkeypatch.setattr(autonomy, "compose_draft_report", _compose)


@pytest.mark.asyncio
async def test_run_cycle_chains_stages(monkeypatch):
    _wire(monkeypatch)
    result = await autonomy.run_cycle(None, prior_fingerprints={"i1": "old", "i2": "b"})
    # Sentinel diffed current vs prior; one issuer changed → re-scanned.
    assert result["n_changed"] == 1
    assert result["n_anomalies"] == 1
    assert result["n_claims"] == 1
    # The composed draft carries the anomaly + claim counts.
    assert result["draft"]["n_anomalies"] == 1
    assert result["draft"]["n_claims"] == 1
    # Current fingerprints returned so the caller persists them as the next prior.
    assert result["current_fingerprints"] == {"i1": "a", "i2": "b"}
    assert result["tickets"]


@pytest.mark.asyncio
async def test_run_cycle_keyless_skips_analyst(monkeypatch):
    _wire(monkeypatch, available=False)
    result = await autonomy.run_cycle(None, prior_fingerprints={"i1": "old"})
    # Anomaly Detector ran (deterministic); Analyst skipped (no model key).
    assert result["n_anomalies"] == 1
    assert result["n_claims"] == 0
    assert result["draft"]["n_claims"] == 0  # deterministic-bullets-only draft


@pytest.mark.asyncio
async def test_run_cycle_no_changes_skips_anomaly_detect(monkeypatch):
    monkeypatch.setattr(autonomy, "_current_fingerprints",
                        (lambda db: asyncio.sleep(0, result={"i1": "a"})))
    monkeypatch.setattr(autonomy, "detect_tickets",
                        lambda current_fps, prior_fps, issuer_ids=None: [])  # unchanged
    monkeypatch.setattr(autonomy, "changed_issuers", lambda tickets: [])
    called = {"detect": False, "investigate": False}

    async def _detect(db, issuer_ids=None):
        called["detect"] = True
        return []
    async def _investigate(db, anoms, **kw):
        called["investigate"] = True
        return []
    monkeypatch.setattr(autonomy, "detect_anomalies", _detect)
    monkeypatch.setattr(autonomy, "investigate", _investigate)
    monkeypatch.setattr(autonomy.queryanswer, "available", lambda: True)

    async def _compose(db, anoms, clms):
        return {"status": "draft", "sections": [], "summary": {}}
    monkeypatch.setattr(autonomy, "compose_draft_report", _compose)

    result = await autonomy.run_cycle(None, prior_fingerprints={"i1": "a"})  # unchanged
    assert result["n_changed"] == 0
    assert called["detect"] is False   # change-driven: no changes → no scan
    assert called["investigate"] is False


@pytest.mark.asyncio
async def test_run_cycle_analyst_failure_composes_from_anomalies(monkeypatch):
    _wire(monkeypatch, investigate_raises=RuntimeError("analyst boom"))
    result = await autonomy.run_cycle(None, prior_fingerprints={"i1": "old"})
    # Analyst failed → claims=[]; draft still composed from anomalies.
    assert result["n_claims"] == 0
    assert result["draft"]["n_anomalies"] == 1


@pytest.mark.asyncio
async def test_run_cycle_first_run_is_full_scan(monkeypatch):
    _wire(monkeypatch, current={"i1": "a", "i2": "b", "i3": "c"})
    # prior=None → every issuer is new-coverage → all changed.
    captured = {}
    monkeypatch.setattr(autonomy, "detect_tickets",
                        lambda cur, prior, issuer_ids=None: (
                            captured.update({"cur": cur, "prior": prior}) or
                            [Ticket(iid, "new-coverage", "new") for iid in cur]))
    monkeypatch.setattr(autonomy, "changed_issuers",
                        lambda tickets: sorted(t.issuer_id for t in tickets))
    result = await autonomy.run_cycle(None, prior_fingerprints=None)
    assert captured["prior"] == {}
    assert result["n_changed"] == 3  # full scan on the first run


# ── API route (real cycle, keyless) ──────────────────────────────────────────

@pytest.fixture(scope="module")
def client():
    from main import app
    with TestClient(app) as c:
        yield c


def test_autonomy_draft_route_returns_draft_envelope(client):
    # Reset the route's module-level prior so the test is deterministic.
    import routes.autonomy as r
    r._LAST_FINGERPRINTS = {}
    resp = client.get("/api/autonomy/draft")
    assert resp.status_code == 200, resp.text
    draft = resp.json()
    # Draft envelope — autonomous drafting, NOT publishing.
    assert draft["status"] == "draft"
    assert draft["ai_generated"] is True
    assert draft["ratified"] is False
    assert draft["export_allowed"] is False
    assert draft["marking"] == "AI-GENERATED, UNRATIFIED"
    assert "sections" in draft and "summary" in draft
