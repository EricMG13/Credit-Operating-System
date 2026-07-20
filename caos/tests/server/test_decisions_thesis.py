"""IC decision immutability/gate and thesis-memory lifecycle."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
sys.path.insert(0, str(SERVER_DIR))


@pytest.fixture(scope="module")
def client():
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
async def test_decision_snapshot_is_bounded_before_run_lookup(client):
    response = client.post("/api/decisions", json={
        "issuer_id": "missing",
        "run_id": "missing",
        "action": "revisit",
        "snapshot": {"context": "x" * (250 * 1024)},
    })
    assert response.status_code == 413


@pytest.mark.asyncio
async def test_decision_freezes_authoritative_snapshot_and_appends_thesis(client):
    issuer_id, run_id = await _make_run(client, "Ready Decision Co", "Committee Ready")
    response = client.post("/api/decisions", json={
        "issuer_id": issuer_id, "run_id": run_id, "report_id": "snapshot",
        "action": "approve", "conditions": ["Monthly liquidity update"],
        "snapshot": {
            "committee_status": "forged",
            "thesis_md": "Base case remains defensible.",
            "authority": {"origin": "live", "approval_state": "ratified", "source_ids": ["forged"]},
            "evidence": [{"source_locator": "forged"}],
            "document_sha256": "f" * 64,
        },
    })
    assert response.status_code == 201, response.text
    decision = response.json()
    assert decision["snapshot"]["committee_status"] == "Committee Ready"
    assert len(decision["snapshot"]["document_sha256"]) == 64
    assert decision["snapshot"]["document_sha256"] != "f" * 64
    assert decision["snapshot"]["origin"] == "legacy-direct"
    assert decision["snapshot"]["authority"]["method"] == "legacy-direct-decision"
    assert decision["snapshot"]["authority"]["source_ids"] != ["forged"]
    assert "evidence" not in decision["snapshot"]
    assert decision["snapshot"]["untrusted_client_context"]["evidence"][0]["source_locator"] == "forged"
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
async def test_manual_thesis_prediction_is_vaulted_and_can_be_realized(client, monkeypatch, tmp_path):
    import config
    import vault_export

    patched = config.get_settings().model_copy(update={"vault_export_dir": str(tmp_path)})
    monkeypatch.setattr(config, "get_settings", lambda: patched)
    vault_export._last_vault_mtime = 0.0
    vault_export._last_vault_file_count = 0
    issuer_id, _ = await _make_run(client, "Prediction Co", "Committee Ready")
    response = client.post("/api/thesis", json={
        "issuer_id": issuer_id,
        "thesis_md": "Leverage should decline after the seasonal working-capital release.",
        "trigger": "manual",
        "predictions": [{"metric": "net_leverage", "horizon": "2026-12-31", "predicted": 4.5}],
    })
    assert response.status_code == 201, response.text
    version = response.json()
    assert version["thesis_md"] == "Leverage should decline after the seasonal working-capital release."
    notes = list((tmp_path / vault_export.MEMOS_DIR).glob("*.md"))
    assert len(notes) == 1
    note = notes[0].read_text(encoding="utf-8")
    assert "[[Prediction Co]]" in note
    assert version["thesis_md"] in note
    assert f'"thesis-version:{version["id"]}"' in note
    profile_versions = client.get("/api/thesis", params={"issuer_id": issuer_id}).json()
    assert profile_versions[0]["id"] == version["id"]
    prediction = response.json()["predictions"][0]
    realized = client.patch(f"/api/thesis/predictions/{prediction['id']}", json={"realized": 4.8})
    assert realized.status_code == 200
    assert realized.json()["realized"] == 4.8


@pytest.mark.asyncio
async def test_manual_thesis_fails_closed_without_a_vault(client, monkeypatch):
    import config

    patched = config.get_settings().model_copy(update={"vault_export_dir": ""})
    monkeypatch.setattr(config, "get_settings", lambda: patched)
    issuer_id, _ = await _make_run(client, "No Thesis Vault Co", "Committee Ready")
    response = client.post("/api/thesis", json={
        "issuer_id": issuer_id,
        "thesis_md": "This must not become a database-only saved state.",
    })
    assert response.status_code == 503
    assert "no thesis version was saved" in response.json()["detail"].lower()
    assert client.get("/api/thesis", params={"issuer_id": issuer_id}).json() == []
