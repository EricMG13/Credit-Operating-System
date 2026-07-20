"""Expensive and append-only public actions have independent caller budgets."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_expensive_and_append_only_routes_rate_limit_before_domain_work(monkeypatch):
    import rate_limit
    from main import app
    from routes import committee, opinions, reports, runs, thesis

    monkeypatch.setattr(committee, "_COMMITTEE_WRITE_MAX_PER_MINUTE", 1)
    monkeypatch.setattr(opinions, "_OPINION_WRITE_MAX_PER_MINUTE", 1)
    monkeypatch.setattr(thesis, "_THESIS_WRITE_MAX_PER_MINUTE", 1)
    monkeypatch.setattr(reports, "_EXPORTS_PER_MINUTE", 1)
    monkeypatch.setattr(runs, "_RUNS_MAX_PER_MINUTE", 1)
    rate_limit.reset()

    requests = [
        lambda client: client.post("/api/committee/agenda", json={
            "issuer_id": "missing",
            "scheduled_for": "2026-07-19T12:00:00Z",
            "recommendation": "approve",
            "thesis": "Bounded committee thesis.",
        }),
        lambda client: client.post("/api/issuers/missing/analyst-opinions", json={
            "stance": "NEUTRAL",
            "rationale_md": "Bounded analyst rationale.",
            "evidence_state": "supported",
        }),
        lambda client: client.post("/api/thesis", json={
            "issuer_id": "missing",
            "thesis_md": "Bounded direct thesis.",
        }),
        lambda client: client.post("/api/reports/versions/missing/export"),
        lambda client: client.post("/api/runs/missing/report"),
    ]

    with TestClient(app) as client:
        for request in requests:
            assert request(client).status_code != 429
            assert request(client).status_code == 429
