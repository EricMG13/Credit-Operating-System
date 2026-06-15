"""Background run execution — opt-in async path: POST returns a queued run and
execution runs in a background task; failures are still persisted + inspectable.
The default (synchronous) path is covered by test_engine.py.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from engine.fixtures import REFERENCE_ISSUER_ID


@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as c:
        yield c


def test_background_run_queues_then_completes(client):
    r = client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID, "background": True})
    assert r.status_code == 201, r.text
    # The response is built before the background task runs.
    assert r.json()["status"] == "queued"
    # By the time the request returns, the background task has executed.
    got = client.get(f"/api/runs/{r.json()['id']}").json()
    assert got["status"] == "complete"
    # It gated identically to the synchronous path (ATLF → Restricted).
    assert got["qa_status"] == "Restricted"


def test_background_run_failure_is_persisted(client, monkeypatch):
    import routes.runs as runs_route

    async def boom(session, run):
        raise RuntimeError("bg synthetic failure")

    monkeypatch.setattr(runs_route, "execute_run", boom)
    r = client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID, "background": True})
    assert r.status_code == 201
    got = client.get(f"/api/runs/{r.json()['id']}").json()
    assert got["status"] == "failed"
    assert "bg synthetic failure" in (got["failure_reason"] or "")
