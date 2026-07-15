"""Per-analyst Desk Brief scoping — Phase-2 personalization.

Covers the four red-team gates (RT-2026-07-07-22..25):
- watchlist persistence (model + CRUD replace semantics + unknown-issuer rejection)
- scoped evidence pack (deltas/findings filtered to the watchlist; context stays book-level)
- per-analyst cache-key isolation (a per-analyst row is served to its analyst; a
  book-level row is served to a no-watchlist analyst; the two tiers never shadow)
- empty-watchlist fallback to the shared book-level brief (never a blank panel)
"""
from __future__ import annotations

import asyncio
import math

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from database import (
    AnalystWatchlist, AsyncSessionLocal, Issuer, MetricFact, QueryInsight, Run,
)
from engine import queryinsights


# ── helpers ──────────────────────────────────────────────────────────────────

async def _add_issuer(db, iid: str, name: str) -> Issuer:
    issuer = Issuer(id=iid, name=name, ticker=name[:4].upper())
    db.add(issuer)
    await db.flush()
    return issuer


async def _add_delta(db, issuer_id: str, metric_key: str, prior: float, latest: float) -> None:
    """Two complete runs on `issuer_id` with headline `metric_key` values so
    `_delta_entries` sees a run-over-run move (prior → latest)."""
    run_prior = Run(issuer_id=issuer_id, status="complete", analyst_id="t")
    run_latest = Run(issuer_id=issuer_id, status="complete", analyst_id="t")
    db.add_all([run_prior, run_latest])
    await db.flush()
    db.add_all([
        MetricFact(issuer_id=issuer_id, run_id=run_prior.id, metric_key=metric_key,
                   value=prior, unit="x", period="FY2024", headline=True, provenance="run"),
        MetricFact(issuer_id=issuer_id, run_id=run_latest.id, metric_key=metric_key,
                   value=latest, unit="x", period="FY2025", headline=True, provenance="run"),
    ])
    await db.flush()


async def _add_watchlist(db, analyst_id: str, issuer_ids: list[str]) -> None:
    for iid in issuer_ids:
        db.add(AnalystWatchlist(analyst_id=analyst_id, issuer_id=iid))
    await db.flush()


# ── engine layer ─────────────────────────────────────────────────────────────

@pytest.mark.usefixtures("seeded_db")
def test_watchlist_issuer_ids_sorted_and_empty_when_absent():
    async def _run():
        async with AsyncSessionLocal() as db:
            await _add_issuer(db, "w1", "Watched One")
            await _add_issuer(db, "w2", "Watched Two")
            await _add_watchlist(db, "analyst-a", ["w2", "w1"])
            out = await queryinsights.watchlist_issuer_ids(db, "analyst-a")
            assert out == sorted(["w1", "w2"])  # sorted, not insertion order
            # An analyst with no watchlist rows → empty list (the fallback signal).
            assert await queryinsights.watchlist_issuer_ids(db, "analyst-b") == []
    asyncio.run(_run())


@pytest.mark.usefixtures("seeded_db")
def test_resolve_scope_per_analyst_vs_book_level():
    async def _run():
        async with AsyncSessionLocal() as db:
            await _add_issuer(db, "s1", "Scoped One")
            await _add_issuer(db, "s2", "Scoped Two")
            await _add_watchlist(db, "analyst-x", ["s1"])
            # Non-empty watchlist → per-analyst scope.
            key, persist_id, issuer_ids, _fp = await queryinsights._resolve_scope(db, "analyst-x")
            assert key == "analyst-x"
            assert persist_id == "analyst-x"
            assert issuer_ids == ["s1"]
            # Empty watchlist → book-level scope (persist_analyst_id is None).
            key, persist_id, issuer_ids, _fp = await queryinsights._resolve_scope(db, "analyst-y")
            assert key == "__book__"
            assert persist_id is None
            assert issuer_ids == []
            # No caller → book-level.
            key, persist_id, _ids, _fp = await queryinsights._resolve_scope(db, None)
            assert key == "__book__" and persist_id is None
    asyncio.run(_run())


@pytest.mark.usefixtures("seeded_db")
def test_build_pack_scopes_deltas_to_watchlist():
    """A scoped pack surfaces only the watched issuer's delta; the unscoped pack
    surfaces both. Context entries (coverage) stay book-level in both."""
    async def _run():
        async with AsyncSessionLocal() as db:
            await _add_issuer(db, "d1", "Delta One")
            await _add_issuer(db, "d2", "Delta Two")
            await _add_delta(db, "d1", "net_leverage", 3.0, 4.0)
            await _add_delta(db, "d2", "net_leverage", 5.0, 6.0)

            scoped = await queryinsights.build_pack(db, ["d1"])
            scoped_deltas = [e for e in scoped if e.kind == "delta"]
            assert {e.issuer_id for e in scoped_deltas} == {"d1"}
            # Context entries are book-level — present in the scoped pack too.
            assert any(e.kind == "coverage" for e in scoped)

            unscoped = await queryinsights.build_pack(db, None)
            unscoped_deltas = [e for e in unscoped if e.kind == "delta"]
            assert {e.issuer_id for e in unscoped_deltas} >= {"d1", "d2"}
    asyncio.run(_run())


@pytest.mark.usefixtures("seeded_db")
@pytest.mark.parametrize("corrupt", [math.nan, math.inf, -math.inf])
def test_desk_brief_skips_nonfinite_persisted_delta(corrupt):
    async def _run():
        async with AsyncSessionLocal() as db:
            await _add_issuer(db, "nf1", "Nonfinite One")
            await _add_delta(db, "nf1", "net_leverage", 4.0, corrupt)
            await db.commit()
            entries = await queryinsights._delta_entries(db, ["nf1"])
            assert entries == []

    asyncio.run(_run())


@pytest.mark.usefixtures("seeded_db")
def test_insights_cache_isolation_per_analyst_vs_book_level(monkeypatch):
    """A per-analyst brief row (analyst_id=X) is served to analyst X; a book-level
    row (analyst_id IS NULL) is served to a no-watchlist analyst. The two tiers
    never shadow each other (RT-2026-07-07-24)."""
    async def _run():
        async with AsyncSessionLocal() as db:
            await _add_issuer(db, "c1", "Cached One")
            await _add_watchlist(db, "analyst-x", ["c1"])

            # Stub the model lane OFF so insights() short-circuits to the cached row.
            monkeypatch.setattr(queryinsights, "available", lambda: False)

            # Persist two rows: a book-level brief and a per-analyst brief with
            # distinct payloads + matching fingerprints so both are "fresh".
            fp_book = await queryinsights.fingerprint(db)
            fp_x = await queryinsights.fingerprint_analyst(db, "analyst-x", ["c1"])
            db.add(QueryInsight(
                data_fingerprint=fp_book, model=None,
                payload={"cards": [{"id": "b", "headline": "BOOK", "detail": "", "evidence": []}],
                         "degraded": True, "generated_reason": "book"},
                analyst_id=None,
            ))
            db.add(QueryInsight(
                data_fingerprint=fp_x, model=None,
                payload={"cards": [{"id": "x", "headline": "ANALYST-X", "detail": "", "evidence": []}],
                         "degraded": True, "generated_reason": "x"},
                analyst_id="analyst-x",
            ))
            await db.commit()

            # analyst-x has a watchlist → served its per-analyst row.
            served_x = await queryinsights.insights(db, analyst_id="analyst-x")
            assert [c["headline"] for c in served_x["cards"]] == ["ANALYST-X"]

            # analyst-y has NO watchlist → served the book-level row, NOT analyst-x's.
            served_y = await queryinsights.insights(db, analyst_id="analyst-y")
            assert [c["headline"] for c in served_y["cards"]] == ["BOOK"]
    asyncio.run(_run())


@pytest.mark.usefixtures("seeded_db")
def test_insights_empty_watchlist_falls_back_to_book_level(monkeypatch):
    """An analyst with an empty watchlist is served the shared book-level brief —
    never a blank panel (RT-2026-07-07-23)."""
    async def _run():
        async with AsyncSessionLocal() as db:
            await _add_issuer(db, "f1", "Fallback One")
            monkeypatch.setattr(queryinsights, "available", lambda: False)
            fp = await queryinsights.fingerprint(db)
            db.add(QueryInsight(
                data_fingerprint=fp, model=None,
                payload={"cards": [{"id": "b", "headline": "BOOK", "detail": "", "evidence": []}],
                         "degraded": True, "generated_reason": "book"},
                analyst_id=None,
            ))
            await db.commit()
            # analyst-z has no watchlist rows → book-level fallback.
            served = await queryinsights.insights(db, analyst_id="analyst-z")
            assert [c["headline"] for c in served["cards"]] == ["BOOK"]
    asyncio.run(_run())


@pytest.mark.usefixtures("seeded_db")
def test_fingerprint_analyst_changes_when_watchlist_changes():
    """Adding/removing a watched issuer changes the per-analyst fingerprint, so
    the brief regenerates on the next >24h/force boundary (RT-2026-07-07-25)."""
    async def _run():
        async with AsyncSessionLocal() as db:
            await _add_issuer(db, "p1", "Pin One")
            await _add_issuer(db, "p2", "Pin Two")
            await _add_watchlist(db, "analyst-p", ["p1"])
            fp1 = await queryinsights.fingerprint_analyst(db, "analyst-p", ["p1"])
            fp2 = await queryinsights.fingerprint_analyst(db, "analyst-p", ["p1", "p2"])
            assert fp1 != fp2
    asyncio.run(_run())


# ── route layer (CRUD) ───────────────────────────────────────────────────────

@pytest.mark.usefixtures("seeded_db")
def test_watchlist_route_replace_semantics_and_unknown_rejection():
    """PUT replaces the full set idempotently; an unknown issuer id is rejected
    (422) so a bad id can't silently produce an empty scoped brief."""
    from main import app

    async def _seed():
        async with AsyncSessionLocal() as db:
            await _add_issuer(db, "r1", "Route One")
            await _add_issuer(db, "r2", "Route Two")
            await db.commit()

    asyncio.run(_seed())

    with TestClient(app) as client:
        # Empty initially.
        assert client.get("/api/query/watchlist").json() == {"issuer_ids": []}

        # Replace with a real set (response is sorted by issuer_id on insert).
        r = client.put("/api/query/watchlist", json={"issuer_ids": ["r2", "r1"]})
        assert r.status_code == 200, r.text
        assert set(r.json()["issuer_ids"]) == {"r1", "r2"}

        # Idempotent re-PUT of the same set → unchanged.
        r = client.put("/api/query/watchlist", json={"issuer_ids": ["r1", "r2"]})
        assert r.status_code == 200
        assert set(r.json()["issuer_ids"]) == {"r1", "r2"}

        # Shrink to one → the other is removed (sorted single-element list).
        r = client.put("/api/query/watchlist", json={"issuer_ids": ["r1"]})
        assert r.status_code == 200
        assert r.json()["issuer_ids"] == ["r1"]

        # Unknown issuer id → 422, no silent degradation.
        r = client.put("/api/query/watchlist", json={"issuer_ids": ["r1", "nope"]})
        assert r.status_code == 422
        # The rejected PUT did not mutate state.
        assert set(client.get("/api/query/watchlist").json()["issuer_ids"]) == {"r1"}

        # Clear via empty set.
        r = client.put("/api/query/watchlist", json={"issuer_ids": []})
        assert r.status_code == 200
        assert r.json()["issuer_ids"] == []


@pytest.mark.usefixtures("seeded_db")
def test_watchlist_route_keys_per_analyst():
    """Two analysts (distinct X-Forwarded-User) have independent watchlists."""
    from main import app

    async def _seed():
        async with AsyncSessionLocal() as db:
            await _add_issuer(db, "k1", "Key One")
            await _add_issuer(db, "k2", "Key Two")
            await db.commit()

    asyncio.run(_seed())

    with TestClient(app) as client:
        client.put("/api/query/watchlist", json={"issuer_ids": ["k1"]})
        h2 = {"X-Forwarded-User": "analyst-two"}
        client.put("/api/query/watchlist", json={"issuer_ids": ["k2"]}, headers=h2)
        assert client.get("/api/query/watchlist").json()["issuer_ids"] == ["k1"]
        assert client.get("/api/query/watchlist", headers=h2).json()["issuer_ids"] == ["k2"]

        # Verify the DB rows are keyed per analyst.
        async def _check():
            async with AsyncSessionLocal() as db:
                rows = (await db.execute(select(AnalystWatchlist).order_by(AnalystWatchlist.analyst_id))).scalars().all()
                by_analyst = {}
                for r in rows:
                    by_analyst.setdefault(r.analyst_id, set()).add(r.issuer_id)
                assert "local-dev" in by_analyst and by_analyst["local-dev"] == {"k1"}
                assert "analyst-two" in by_analyst and by_analyst["analyst-two"] == {"k2"}
        asyncio.run(_check())
