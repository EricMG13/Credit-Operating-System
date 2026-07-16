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
    from config import get_settings

    async def _retrieve(
        db, query, k=8, issuer_ids=None, expand_graph=False, analyst_id=None
    ):
        return list(hits)

    async def _fp(db):
        return fp

    monkeypatch.setattr(queryanswer, "retrieve_corpus", _retrieve)
    monkeypatch.setattr(queryanswer, "fingerprint", _fp)
    monkeypatch.setattr(get_settings(), "caos_document_egress_enabled", True)


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
    # Self-correction (Phase 2): the REPLY drops 3 of 4 sentences (drop_rate 0.75
    # > 0.5) → ONE retry with feedback. 1 question × 2 calls; 2nd is cached.
    assert len(calls) == 2


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
    # Self-correction (Phase 2): each scoped question drops 3 of 4 sentences →
    # one retry each. 2 distinct questions × 2 calls = 4.
    assert len(calls) == 4


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


# ── Phase 2 integration: Metric Engine facts, claim_type, self-correction ────

async def _no_facts(db, issuer_id, walk=None):
    """Metric Engine stub returning no deterministic facts — keeps the test on
    the chunk-only path so the anthropic mock fully controls the reply."""
    return []


async def _entail_returns_empty(claims):
    """Entailment-lane stub that simulates a fault-isolated failure (timeout /
    parse error / keyless) — returns no verdicts so no demotions apply."""
    return []


def _fake_anthropic_sequence(monkeypatch, replies, calls):
    """Return each reply in sequence across calls (for self-correction tests
    that need a different first-attempt vs retry reply). A reply that is an
    Exception instance is raised instead of returned."""
    import anthropic

    seq = list(replies)
    state = {"i": 0}

    class _M:
        async def create(self, **kw):
            calls.append(kw)
            i = state["i"]
            state["i"] = min(i + 1, len(seq) - 1)
            reply = seq[i]
            if isinstance(reply, Exception):
                raise reply
            return SimpleNamespace(
                content=[SimpleNamespace(type="text", text=reply)], usage=None, model="fake-model")

    class _C:
        messages = _M()

    monkeypatch.setattr(anthropic, "AsyncAnthropic", lambda **kw: _C())


@pytest.mark.usefixtures("seeded_db")
def test_fact_citation_survives_and_is_traced(monkeypatch):
    """Phase 2: a sentence citing a Metric Engine fact id, stating a figure from
    that fact's closed ``numbers`` set, survives the gate and is emitted under
    ``fact_citations`` (the ``citations`` chunk contract stays unchanged)."""
    from database import AsyncSessionLocal
    from engine.metricengine import MetricFactEntry

    calls: list = []
    _wire(monkeypatch)
    _fake_anthropic(monkeypatch,
                    '{"sentences": [{"text": "Acme leverage rose to 4.6x from 4.2x.", '
                    '"chunk_ids": [], "fact_ids": ["fact:i1:net_leverage:delta"]}]}',
                    calls)

    fact = MetricFactEntry(
        id="fact:i1:net_leverage:delta", kind="metric", label="Acme Net leverage",
        text="Acme: Net leverage 4.2x → 4.6x (+0.4x vs prior run)",
        numbers=[4.2, 4.6, 0.4], issuer_id="i1", walk="metric-trend", chunk_id=None)

    async def _facts(db, issuer_id, walk=None):
        return [fact]
    monkeypatch.setattr(queryanswer, "build_metric_facts", _facts)
    monkeypatch.setattr(queryanswer, "check_entailment", _entail_returns_empty)

    async def _run():
        async with AsyncSessionLocal() as db:
            return await queryanswer.answer(db, "What moved in leverage?", analyst_id="a1")

    out = asyncio.run(_run())
    assert out["unavailable"] is False
    assert out["answer"] == "Acme leverage rose to 4.6x from 4.2x."
    # Chunk citations unchanged (none cited); fact citation emitted separately.
    assert out["citations"] == []
    assert out["fact_citations"] == [{"fact_id": "fact:i1:net_leverage:delta",
                                      "label": "Acme Net leverage"}]


@pytest.mark.usefixtures("seeded_db")
def test_fact_citation_ungrounded_figure_dropped(monkeypatch):
    """A sentence citing a fact but stating a figure NOT in the fact's closed
    numbers set is dropped — the numeric gate applies to facts exactly as it
    applies to chunks."""
    from database import AsyncSessionLocal
    from engine.metricengine import MetricFactEntry

    calls: list = []
    _wire(monkeypatch)
    _fake_anthropic(monkeypatch,
                    '{"sentences": [{"text": "Acme leverage rose to 9.9x.", '
                    '"chunk_ids": [], "fact_ids": ["fact:i1:net_leverage:delta"]}]}',
                    calls)

    fact = MetricFactEntry(
        id="fact:i1:net_leverage:delta", kind="metric", label="Acme Net leverage",
        text="Acme: Net leverage 4.2x → 4.6x", numbers=[4.2, 4.6, 0.4],
        issuer_id="i1", walk=None, chunk_id=None)

    async def _facts(db, issuer_id, walk=None):
        return [fact]
    monkeypatch.setattr(queryanswer, "build_metric_facts", _facts)
    monkeypatch.setattr(queryanswer, "check_entailment", _entail_returns_empty)

    async def _run():
        async with AsyncSessionLocal() as db:
            return await queryanswer.answer(db, "Did leverage deteriorate?", analyst_id="a1")

    out = asyncio.run(_run())
    # 9.9 not in [4.2, 4.6, 0.4] → dropped → unavailable (no survivors). The
    # self-correction retry also drops it (same reply), so both attempts fail.
    assert out["unavailable"] is True
    assert out["answer"] == ""
    assert out["fact_citations"] == []


@pytest.mark.usefixtures("seeded_db")
def test_claim_type_label_preserved_and_coerced(monkeypatch):
    """Phase 2: claim_type (observation|causal-hypothesis|risk-flag) is preserved
    on kept sentences; an unknown value coerces to "observation" rather than
    failing the whole reply."""
    from database import AsyncSessionLocal

    calls: list = []
    _wire(monkeypatch)
    _fake_anthropic(monkeypatch,
                    '{"sentences": ['
                    '{"text": "Acme carries net leverage of 4.4x.", "chunk_ids": ["c1"], "claim_type": "observation"},'
                    '{"text": "This suggests Acme is stretching.", "chunk_ids": ["c1"], "claim_type": "causal-hypothesis"},'
                    '{"text": "Acme may face refinancing risk.", "chunk_ids": ["c1"], "claim_type": "risk-flag"},'
                    '{"text": "Acme is BBB rated.", "chunk_ids": ["c1"], "claim_type": "garbage"}'
                    ']}',
                    calls)
    monkeypatch.setattr(queryanswer, "build_metric_facts", _no_facts)
    monkeypatch.setattr(queryanswer, "check_entailment", _entail_returns_empty)

    async def _run():
        async with AsyncSessionLocal() as db:
            return await queryanswer.answer(db, "Acme leverage posture?", analyst_id="a1")

    out = asyncio.run(_run())
    types = {s["text"]: s["claim_type"] for s in out["sentences"]}
    assert types.get("Acme carries net leverage of 4.4x.") == "observation"
    assert types.get("This suggests Acme is stretching.") == "causal-hypothesis"
    assert types.get("Acme may face refinancing risk.") == "risk-flag"
    # Unknown "garbage" coerced to "observation".
    assert types.get("Acme is BBB rated.") == "observation"


@pytest.mark.usefixtures("seeded_db")
def test_self_correction_rescues_all_dropped(monkeypatch):
    """Phase 2: when the first attempt drops every sentence, the self-correction
    loop retries with feedback; the retry's valid reply is taken (take-better)."""
    from database import AsyncSessionLocal

    calls: list = []
    _wire(monkeypatch)
    _all_dropped = ('{"sentences": [{"text": "Acme leverage is 9.9x.", "chunk_ids": ["c1"]}]}')
    _good = ('{"sentences": [{"text": "Acme carries net leverage of 4.4x.", "chunk_ids": ["c1"]}]}')
    _fake_anthropic_sequence(monkeypatch, [_all_dropped, _good], calls)
    monkeypatch.setattr(queryanswer, "build_metric_facts", _no_facts)
    monkeypatch.setattr(queryanswer, "check_entailment", _entail_returns_empty)

    async def _run():
        async with AsyncSessionLocal() as db:
            return await queryanswer.answer(db, "What is Acme's leverage trend?", analyst_id="a2")

    out = asyncio.run(_run())
    assert out["unavailable"] is False
    assert out["answer"] == "Acme carries net leverage of 4.4x."
    assert len(calls) == 2  # initial + retry


@pytest.mark.usefixtures("seeded_db")
def test_self_correction_keeps_partially_grounded_answer_over_empty_retry(monkeypatch):
    """A clean-but-empty repair must not erase the better first attempt."""
    from database import AsyncSessionLocal

    calls: list = []
    _wire(monkeypatch)
    _fake_anthropic_sequence(monkeypatch, [REPLY, '{"sentences": []}'], calls)
    monkeypatch.setattr(queryanswer, "build_metric_facts", _no_facts)
    monkeypatch.setattr(queryanswer, "check_entailment", _entail_returns_empty)

    async def _run():
        async with AsyncSessionLocal() as db:
            return await queryanswer.answer(
                db,
                "Keep the stronger grounded repair attempt?",
                analyst_id="take-better-regression",
                force=True,
            )

    out = asyncio.run(_run())
    assert out["unavailable"] is False
    assert out["answer"] == "Acme carries net leverage of 4.4x."
    assert len(calls) == 2
    diagnostic = out["self_correction"]
    assert diagnostic["attempted"] is True
    assert diagnostic["selected_attempt"] == 1
    assert len(diagnostic["attempts"]) == 2
    assert diagnostic["attempts"][0]["surviving_sentences"] > diagnostic["attempts"][1]["surviving_sentences"]


# ── Phase 1 remainder: metric-fact SQL lane integration ──────────────────────

@pytest.mark.usefixtures("seeded_db")
def test_metric_fact_sql_lane_raw_facts_flow_into_answer(monkeypatch):
    """Phase 1 remainder: the metric-fact SQL lane surfaces topic-relevant raw
    facts into the facts_note, citable via ``fact_ids`` exactly like Metric
    Engine derivatives. The Metric Engine is stubbed off, so the raw fact is
    the sole numeric source — proving the SQL lane is a first-class retrieval
    input, not just a side-note to the Metric Engine."""
    from database import AsyncSessionLocal
    from engine.metricengine import MetricFactEntry

    calls: list = []
    _wire(monkeypatch)
    _fake_anthropic(monkeypatch,
                    '{"sentences": [{"text": "Acme revenue was 1200.0 in FY2024.", '
                    '"chunk_ids": [], "fact_ids": ["fact:i1:revenue:raw:FY2024"]}]}',
                    calls)

    monkeypatch.setattr(queryanswer, "build_metric_facts", _no_facts)
    monkeypatch.setattr(queryanswer, "check_entailment", _entail_returns_empty)

    raw_fact = MetricFactEntry(
        id="fact:i1:revenue:raw:FY2024", kind="metric", label="Acme Revenue",
        text="Acme: Revenue 1200$M (FY2024).", numbers=[1200.0, 2024.0],
        issuer_id="i1", walk=None, chunk_id="c-rev")

    async def _raw_lane(db, query, issuer_ids=None, walk=None, k=12):
        return [raw_fact]
    import engine.metricfactlane as mfl
    monkeypatch.setattr(mfl, "retrieve_metric_facts", _raw_lane)

    async def _run():
        async with AsyncSessionLocal() as db:
            return await queryanswer.answer(db, "What was Acme's revenue?", analyst_id="a1")

    out = asyncio.run(_run())
    assert out["unavailable"] is False
    assert "1200" in out["answer"]
    assert out["fact_citations"] == [{"fact_id": "fact:i1:revenue:raw:FY2024",
                                      "label": "Acme Revenue"}]


@pytest.mark.usefixtures("seeded_db")
def test_metric_fact_sql_lane_noop_when_query_matches_no_metric(monkeypatch):
    """The SQL lane is a no-op when the query matches no metric key — the
    facts_note stays empty (Metric Engine also stubbed off) and the answer
    degrades to chunk-grounded only."""
    from database import AsyncSessionLocal

    calls: list = []
    _wire(monkeypatch)
    _fake_anthropic(monkeypatch,
                    '{"sentences": [{"text": "Acme appointed a new CFO.", '
                    '"chunk_ids": ["c1"]}]}',
                    calls)
    monkeypatch.setattr(queryanswer, "build_metric_facts", _no_facts)
    monkeypatch.setattr(queryanswer, "check_entailment", _entail_returns_empty)

    async def _run():
        async with AsyncSessionLocal() as db:
            return await queryanswer.answer(db, "Who is Acme's CFO?", analyst_id="a1")

    out = asyncio.run(_run())
    assert out["unavailable"] is False
    assert out["fact_citations"] == []  # no metric facts surfaced (no topic match)
