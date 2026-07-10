"""Desk Brief lane (engine/queryinsights.py): the grounding gate (a card survives
only when it cites a real pack entry AND states only grounded numbers), the
always-honest deterministic fallback, and the fingerprint-freshness path (an
unchanged book is never regenerated). Keyless → no LLM, panel degrades."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from engine import queryinsights
from engine.queryinsights import PackEntry

PACK = [
    PackEntry(id="delta:i1:net_leverage", kind="delta", label="Acme leverage",
              text="Acme: leverage 4.0x → 4.4x (+0.4x vs prior run)",
              numbers=[4.0, 4.4, 0.4], issuer_id="i1", walk="metric-trend"),
    PackEntry(id="coverage", kind="coverage", label="Coverage",
              text="Coverage: 3 issuers, 2 with a complete run.",
              numbers=[3, 2], walk="coverage-completeness"),
    PackEntry(id="f:x1", kind="finding", label="Acme F-01 (MATERIAL)",
              text="Acme: MATERIAL QA finding F-01 — leverage overstated.",
              chunk_id="f:x1", walk="open-findings"),
]
ENABLED = {"metric-trend", "coverage-completeness", "open-findings"}


def test_validate_keeps_only_grounded_cited_cards():
    reply = {"cards": [
        {"headline": "Acme leverage up", "detail": "Leverage rose to 4.4x on the latest run.",
         "evidence_ids": ["delta:i1:net_leverage"], "walk": "metric-trend"},
        {"headline": "Invented move", "detail": "Leverage jumped to 9.9x.",
         "evidence_ids": ["delta:i1:net_leverage"], "walk": "scatter"},
        {"headline": "No citation", "detail": "Something happened.",
         "evidence_ids": [], "walk": "metric-trend"},
        {"headline": "Bad id", "detail": "Ungrounded.",
         "evidence_ids": ["does-not-exist"], "walk": "metric-trend"},
    ]}
    cards = queryinsights._validate(reply, PACK, ENABLED)
    assert len(cards) == 1
    c = cards[0]
    assert c["headline"] == "Acme leverage up"
    assert c["walk"] == "metric-trend"       # model walk, valid + enabled
    assert c["issuer_id"] == "i1"            # inherited from the cited delta
    assert c["evidence"][0]["id"] == "delta:i1:net_leverage"


def test_validate_grounds_only_against_closed_numbers_not_free_text():
    # A card citing ONLY a word-only entry (finding/docs, numbers=[]) may not state
    # a number — the incidental numerals in its text (finding id "F-01", a filename
    # year) are not authorized figures. Fail-closed.
    reply = {"cards": [
        {"headline": "Finding says 4.4x", "detail": "The finding notes leverage of 4.4x.",
         "evidence_ids": ["f:x1"], "walk": "open-findings"},
        {"headline": "Acme finding is material", "detail": "Acme carries a material QA finding.",
         "evidence_ids": ["f:x1"], "walk": "open-findings"},
    ]}
    cards = queryinsights._validate(reply, PACK, ENABLED)
    # The numeric finding card is dropped; the word-only finding card survives.
    assert [c["headline"] for c in cards] == ["Acme finding is material"]


def test_validate_disabled_walk_falls_back_to_cited_entry_walk():
    reply = {"cards": [
        {"headline": "Coverage snapshot", "detail": "3 issuers, 2 with a complete run.",
         "evidence_ids": ["coverage"], "walk": "not-a-walk"},
    ]}
    cards = queryinsights._validate(reply, PACK, ENABLED)
    assert len(cards) == 1
    assert cards[0]["walk"] == "coverage-completeness"  # model's bogus walk replaced


def test_deterministic_cards_from_pack():
    cards = queryinsights._deterministic_cards(PACK)
    # delta + coverage become cards; the finding (not delta/coverage) does not.
    kinds = {c["headline"] for c in cards}
    assert "Acme leverage" in kinds and "Coverage" in kinds
    assert all(c["evidence"] for c in cards)


# ── End-to-end over a real session ───────────────────────────────────────────

def _fake_anthropic(monkeypatch, text: str, calls: list):
    import anthropic

    class _M:
        async def create(self, **kw):
            calls.append(kw)
            return SimpleNamespace(
                content=[SimpleNamespace(type="text", text=text)], usage=None, model="fake-model")

    class _C:
        messages = _M()

    monkeypatch.setattr(anthropic, "AsyncAnthropic", lambda **kw: _C())


def _wire(monkeypatch, pack=PACK, fp="fp0"):
    async def _pack(db, issuer_ids=None):
        return list(pack)

    async def _fp(db):
        return fp

    async def _caps(db):
        return {"groups": [{"id": "g", "label": "G", "icon": "", "ready": 3, "total": 3,
                            "capabilities": [{"id": w, "label": w, "mode": "x", "enabled": True,
                                              "reason": None} for w in ENABLED]}],
                "availability": {}}

    monkeypatch.setattr(queryinsights, "build_pack", _pack)
    monkeypatch.setattr(queryinsights, "fingerprint", _fp)
    monkeypatch.setattr(queryinsights.querygraph, "capabilities", _caps)


REPLY = ('{"cards": [{"headline": "Acme leverage up", "detail": "Leverage rose to 4.4x.",'
         ' "evidence_ids": ["delta:i1:net_leverage"], "walk": "metric-trend"},'
         ' {"headline": "Hallucinated", "detail": "Beta at 12.3x.",'
         ' "evidence_ids": ["delta:i1:net_leverage"]}]}')


@pytest.mark.usefixtures("seeded_db")
def test_regenerate_persists_only_grounded_cards(monkeypatch):
    from database import AsyncSessionLocal

    calls: list = []
    _wire(monkeypatch)
    _fake_anthropic(monkeypatch, REPLY, calls)
    monkeypatch.setattr(queryinsights, "available", lambda: True)

    async def _run():
        async with AsyncSessionLocal() as db:
            return await queryinsights._regenerate(db, "a1")

    out = asyncio.run(_run())
    # The invented 12.3x card is dropped; only the grounded card persists.
    assert [c["headline"] for c in out["cards"]] == ["Acme leverage up"]
    assert out["degraded"] is False
    assert out["model"] == "fake-model"
    assert len(calls) == 1


@pytest.mark.usefixtures("seeded_db")
def test_fresh_fingerprint_serves_cache_without_regen(monkeypatch):
    from database import AsyncSessionLocal

    calls: list = []
    _wire(monkeypatch)
    _fake_anthropic(monkeypatch, REPLY, calls)
    monkeypatch.setattr(queryinsights, "available", lambda: True)

    async def _run():
        async with AsyncSessionLocal() as db:
            first = await queryinsights._regenerate(db, "a1")  # persists a fresh row, fp0
        async with AsyncSessionLocal() as db:
            served = await queryinsights.insights(db, analyst_id="a1")  # same fp → cached
        return first, served

    _first, served = asyncio.run(_run())
    assert served["refreshing"] is False
    assert served["cached"] is True
    assert [c["headline"] for c in served["cards"]] == ["Acme leverage up"]
    assert len(calls) == 1  # regenerate made one call; insights made none


@pytest.mark.usefixtures("seeded_db")
def test_keyless_serves_deterministic_no_llm(monkeypatch):
    from database import AsyncSessionLocal

    calls: list = []
    _wire(monkeypatch)
    _fake_anthropic(monkeypatch, REPLY, calls)
    monkeypatch.setattr(queryinsights, "available", lambda: False)

    async def _run():
        from sqlalchemy import delete
        from database import QueryInsight
        # Keyless = a deploy that never generated a brief. The suite shares one DB
        # (per-fixture override is dead), so clear any brief a prior test persisted.
        async with AsyncSessionLocal() as db:
            await db.execute(delete(QueryInsight))
            await db.commit()
        async with AsyncSessionLocal() as db:
            return await queryinsights.insights(db, analyst_id="a1")

    out = asyncio.run(_run())
    assert out["available"] is False
    assert out["refreshing"] is False
    assert out["degraded"] is True
    assert calls == []  # never touches the model
    assert out["cards"]  # deterministic highlights still render
