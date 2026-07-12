"""IC decision immutability/gate and thesis-memory lifecycle."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
sys.path.insert(0, str(SERVER_DIR))


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("caos-decisions")
    os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{tmp / 'test.db'}"
    os.environ["CAOS_STORAGE_DIR"] = str(tmp / "vault")
    os.environ["ANTHROPIC_API_KEY"] = ""
    from main import app
    with TestClient(app) as c:
        yield c


async def _make_run(client, name: str, committee_status: str):
    issuer_id = client.post("/api/issuers/", json={"name": name}).json()["id"]
    from database import AsyncSessionLocal, Run
    async with AsyncSessionLocal() as db:
        run = Run(
            issuer_id=issuer_id, status="complete", qa_status="Passed",
            committee_status=committee_status, analyst_id="local-dev",
        )
        db.add(run)
        await db.commit()
        return issuer_id, run.id


@pytest.mark.asyncio
async def test_decision_fails_closed_until_run_is_committee_ready(client):
    issuer_id, run_id = await _make_run(client, "Draft Decision Co", "Restricted")
    response = client.post("/api/decisions", json={
        "issuer_id": issuer_id, "run_id": run_id, "action": "revisit",
        "snapshot": {"committee_status": "Committee Ready"},
    })
    assert response.status_code == 409
    assert response.json()["detail"]["committee_status"] == "Restricted"


@pytest.mark.asyncio
async def test_decision_freezes_authoritative_snapshot_and_appends_thesis(client):
    issuer_id, run_id = await _make_run(client, "Ready Decision Co", "Committee Ready")
    response = client.post("/api/decisions", json={
        "issuer_id": issuer_id, "run_id": run_id, "report_id": "snapshot",
        "action": "approve", "conditions": ["Monthly liquidity update"],
        "snapshot": {"committee_status": "forged", "thesis_md": "Base case remains defensible."},
    })
    assert response.status_code == 201, response.text
    decision = response.json()
    assert decision["snapshot"]["committee_status"] == "Committee Ready"
    assert len(decision["snapshot"]["document_sha256"]) == 64
    assert len(decision["snapshot_sha256"]) == 64

    versions = client.get("/api/thesis", params={"issuer_id": issuer_id}).json()
    assert versions[0]["trigger"] == "decision"
    assert versions[0]["linked_decision_id"] == decision["id"]

    bad_vote = client.post(f"/api/decisions/{decision['id']}/votes", json={"vote": "dissent"})
    assert bad_vote.status_code == 422
    voted = client.post(f"/api/decisions/{decision['id']}/votes", json={
        "vote": "dissent", "dissent_note": "Recovery assumption too generous.",
    }).json()
    assert voted["votes"][0]["member"] == "local-dev"
    duplicate = client.post(f"/api/decisions/{decision['id']}/votes", json={"vote": "abstain"})
    assert duplicate.status_code == 409

    reopened = client.post(f"/api/decisions/{decision['id']}/reopen", json={
        "trigger_alert_key": f"cycle:{issuer_id}:covenant:headroom",
    }).json()
    assert reopened["status"] == "reopened"
    assert reopened["snapshot_sha256"] == decision["snapshot_sha256"]
    assert len(client.get("/api/thesis", params={"issuer_id": issuer_id}).json()) == 2


@pytest.mark.asyncio
async def test_manual_thesis_prediction_can_be_realized(client):
    issuer_id, _ = await _make_run(client, "Prediction Co", "Committee Ready")
    response = client.post("/api/thesis", json={
        "issuer_id": issuer_id,
        "thesis_md": "Leverage should decline after the seasonal working-capital release.",
        "trigger": "manual",
        "predictions": [{"metric": "net_leverage", "horizon": "2026-12-31", "predicted": 4.5}],
    })
    assert response.status_code == 201, response.text
    prediction = response.json()["predictions"][0]
    realized = client.patch(f"/api/thesis/predictions/{prediction['id']}", json={"realized": 4.8})
    assert realized.status_code == 200
    assert realized.json()["realized"] == 4.8
