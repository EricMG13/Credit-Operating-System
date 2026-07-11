"""Query phase 3 — analyst-ratified links: accept is analyst-initiated and
idempotent per normalized pair, ratified links are drawn by the deterministic
builders (with a provenance caveat) wherever both endpoints render, and a
retraction stops drawing them. Cleanup deletes the pair — the suite shares one
process-global DB, so a leaked link would repaint other tests' graphs."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as c:
        yield c


def _two_unlinked_issuers(graph: dict) -> tuple[str, str]:
    """Two peer nodes (never linked to each other in a peer-set star)."""
    peers = [n["id"] for n in graph["nodes"] if n["kind"] == "issuer"]
    assert len(peers) >= 2, "seeded peer-set should carry ≥2 peers"
    return peers[0], peers[1]


def test_accept_draw_retract_roundtrip(client):
    graph = client.post("/api/query/graph", json={"capability_id": "peer-set"}).json()
    a, b = _two_unlinked_issuers(graph)
    assert not any(e for e in graph["edges"]
                   if {e["source"], e["target"]} == {a, b}), "pair must start unlinked"

    # Accept (analyst-initiated write).
    r = client.post("/api/query/links", json={
        "source_issuer_id": a, "target_issuer_id": b, "capability_id": "peer-set",
        "rationale": "shared supplier per filings", "chunk_ids": ["c1"],
        "confidence": "Medium", "model": "fake-model",
    })
    assert r.status_code == 200, r.text
    link = r.json()
    assert link["created"] is True and link["confidence"] == "Medium"

    try:
        # Idempotent per normalized pair — reversed direction returns the SAME row.
        again = client.post("/api/query/links", json={
            "source_issuer_id": b, "target_issuer_id": a, "capability_id": "peer-set",
        }).json()
        assert again["created"] is False and again["id"] == link["id"]

        # Ratified → drawn by the deterministic builder, with the provenance caveat.
        g2 = client.post("/api/query/graph", json={"capability_id": "peer-set"}).json()
        accepted = [e for e in g2["edges"] if e.get("kind") == "accepted"]
        assert any({e["source"], e["target"]} == {a, b} for e in accepted)
        assert any("analyst-accepted" in c for c in g2["caveats"])

        # Listed for the accept/undo UI state.
        links = client.get("/api/query/links").json()["links"]
        assert any(l["id"] == link["id"] for l in links)

        # Self-link and unknown endpoints rejected.
        assert client.post("/api/query/links", json={
            "source_issuer_id": a, "target_issuer_id": a, "capability_id": "peer-set",
        }).status_code == 422
        assert client.post("/api/query/links", json={
            "source_issuer_id": a, "target_issuer_id": "no-such-issuer", "capability_id": "peer-set",
        }).status_code == 404
    finally:
        # Retract — and the builder stops drawing it.
        assert client.delete(f"/api/query/links/{link['id']}").json()["deleted"] == link["id"]

    g3 = client.post("/api/query/graph", json={"capability_id": "peer-set"}).json()
    assert not any(e.get("kind") == "accepted" for e in g3["edges"])
    assert not any("analyst-accepted" in c for c in g3["caveats"])


def test_retract_unknown_is_404(client):
    assert client.delete("/api/query/links/nope").status_code == 404


def test_retract_link_idor_single_team_is_intentional(client):
    """Authorization is single-team by design (matches routes/runs.py,
    routes/portfolios.py). A link ratified by a DIFFERENT analyst is still
    retractable by this caller — no per-caller filter. If you are here because
    you added tenant scoping, update this test deliberately."""
    import asyncio

    from database import AsyncSessionLocal, QueryAcceptedLink

    graph = client.post("/api/query/graph", json={"capability_id": "peer-set"}).json()
    a, b = _two_unlinked_issuers(graph)
    link = client.post("/api/query/links", json={
        "source_issuer_id": a, "target_issuer_id": b, "capability_id": "peer-set",
    }).json()

    async def _reassign():
        async with AsyncSessionLocal() as s:
            row = await s.get(QueryAcceptedLink, link["id"])
            row.analyst_id = "someone-else@firm.com"
            await s.commit()

    asyncio.run(_reassign())

    resp = client.delete(f"/api/query/links/{link['id']}")
    assert resp.status_code == 200, resp.text  # foreign-ratified link, still retractable
    assert resp.json()["deleted"] == link["id"]
