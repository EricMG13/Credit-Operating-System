"""Grounded answer lane (engine/queryanswer.py): the sentence gate (a sentence
survives only when it cites a real retrieved chunk AND states only grounded
figures), the no-chunks degrade, and the scoped cache."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from engine import queryanswer

HITS = [
    SimpleNamespace(chunk_id="c1", text="Acme reported net leverage of 4.4x for the LTM period.",
                    issuer_id="i1", doc="acme-10k.pdf", score=1.0),
    SimpleNamespace(chunk_id="c2", text="Beta operates in the same sector as Acme.",
                    issuer_id="i2", doc="beta-10k.pdf", score=0.5),
]

REPLY = ('{"sentences": ['
         '{"text": "Acme carries net leverage of 4.4x.", "chunk_ids": ["c1"]},'
         '{"text": "It levered up to 9.9x thereafter.", "chunk_ids": ["c1"]},'
         '{"text": "Acme is highly distressed.", "chunk_ids": []},'
         '{"text": "Ratings cite chunk c1.", "chunk_ids": ["c-invented"]}'
         ']}')


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


def _wire(monkeypatch, hits=HITS, fp="fp0"):
    async def _retrieve(db, query, k=8, issuer_ids=None):
        return list(hits)

    async def _fp(db):
        return fp

    monkeypatch.setattr(queryanswer, "retrieve_corpus", _retrieve)
    monkeypatch.setattr(queryanswer, "fingerprint", _fp)


@pytest.mark.usefixtures("seeded_db")
def test_sentence_gate_and_cache(monkeypatch):
    from database import AsyncSessionLocal

    calls: list = []
    _wire(monkeypatch)
    _fake_anthropic(monkeypatch, REPLY, calls)

    async def _run():
        async with AsyncSessionLocal() as db:
            first = await queryanswer.answer(db, "What is Acme's leverage?", analyst_id="a1")
        async with AsyncSessionLocal() as db:
            second = await queryanswer.answer(db, "What is Acme's leverage?", analyst_id="a1")
        return first, second

    first, second = asyncio.run(_run())
    # Only the cited, number-grounded sentence survives: the 9.9x invention, the
    # uncited sentence, and the fabricated-chunk citation are all dropped.
    assert first["answer"] == "Acme carries net leverage of 4.4x."
    assert [s["text"] for s in first["sentences"]] == ["Acme carries net leverage of 4.4x."]
    assert first["citations"] == [{"chunk_id": "c1", "label": "acme-10k.pdf"}]
    assert first["unavailable"] is False
    assert first["cached"] is False and first["model"] == "fake-model"
    # Same question + unchanged corpus fingerprint → cached, no second LLM call.
    assert second["cached"] is True
    assert len(calls) == 1


@pytest.mark.usefixtures("seeded_db")
def test_cache_is_scoped_by_capability_and_issuer(monkeypatch):
    from database import AsyncSessionLocal

    calls: list = []
    _wire(monkeypatch)
    _fake_anthropic(monkeypatch, REPLY, calls)

    async def _run():
        async with AsyncSessionLocal() as db:
            first = await queryanswer.answer(
                db, "Where is leverage?", capability_id="peer-set", issuer_id="i1", analyst_id="a1"
            )
        async with AsyncSessionLocal() as db:
            second = await queryanswer.answer(
                db, "Where is leverage?", capability_id="issuer-risk", issuer_id="i2", analyst_id="a1"
            )
        return first, second

    first, second = asyncio.run(_run())
    assert first["cached"] is False and second["cached"] is False
    assert len(calls) == 2


@pytest.mark.usefixtures("seeded_db")
def test_no_chunks_degrades_without_llm(monkeypatch):
    from database import AsyncSessionLocal

    calls: list = []
    _wire(monkeypatch, hits=[])
    _fake_anthropic(monkeypatch, REPLY, calls)

    async def _run():
        async with AsyncSessionLocal() as db:
            return await queryanswer.answer(db, "Anything?", analyst_id="a1")

    out = asyncio.run(_run())
    assert out["unavailable"] is True
    assert out["answer"] == ""
    assert calls == []  # no chunks → no model spend
