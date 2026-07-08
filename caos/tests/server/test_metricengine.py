"""Tests for engine/metricengine.py — the deterministic Metric Engine (Phase 2).

Covers the two computation views (headline deltas, peer robust z-scores), the
CLAUDE.md engine-convention guards (is_finite_number before arithmetic, zero-MAD
denominator degradation), and the empty-corpus / single-run degradation paths.
"""

import math
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from database import AsyncSessionLocal, Issuer, MetricFact, Run
from engine.metricengine import (
    _delta_entries,
    _robust_z,
    build_metric_facts,
)


# ── Pure-function tests (no DB) ──────────────────────────────────────────────

def test_robust_z_normal():
    # Symmetric peer set around 4.0; issuer at 5.5 is above median.
    peers = [3.0, 3.5, 4.0, 4.5, 5.0]
    res = _robust_z(5.5, peers)
    assert res is not None
    med, _mad, z = res
    assert med == 4.0
    assert z > 0  # above peers


def test_robust_z_empty_peers_returns_none():
    assert _robust_z(4.0, []) is None


def test_robust_z_nan_issuer_returns_none():
    # A NaN issuer value must not poison the z — is_finite_number rejects it.
    assert _robust_z(float("nan"), [3.0, 4.0, 5.0]) is None


def test_robust_z_inf_issuer_returns_none():
    assert _robust_z(float("inf"), [3.0, 4.0, 5.0]) is None


def test_robust_z_zero_mad_in_line_returns_zero():
    # All peers identical AND issuer on the median → z=0 (degrade, not ±inf).
    res = _robust_z(4.0, [4.0, 4.0, 4.0])
    assert res is not None
    med, _mad, z = res
    assert med == 4.0
    assert z == 0.0


def test_robust_z_zero_mad_off_median_returns_none():
    # All peers identical but issuer off-median → degenerate spread, degrade.
    assert _robust_z(6.0, [4.0, 4.0, 4.0]) is None


@dataclass
class _StubFact:
    """Duck-typed stand-in for MetricFact — only the 4 attributes _delta_entries reads."""
    issuer_id: str
    metric_key: str
    value: float
    document_chunk_id: object = None


def test_delta_entries_two_runs():
    facts = [
        _StubFact("i1", "net_leverage", 4.6, "c-latest"),  # latest (created_at desc)
        _StubFact("i1", "net_leverage", 4.2, "c-prior"),   # prior
    ]
    out = _delta_entries(facts, {"i1": "TransDigm"}, walk="metric-trend")
    assert len(out) == 1
    e = out[0]
    assert e.id == "fact:i1:net_leverage:delta"
    assert e.kind == "metric"
    assert e.issuer_id == "i1"
    assert e.walk == "metric-trend"
    assert e.chunk_id == "c-latest"  # cited back to the latest fact's chunk
    # closed numbers set = [prior, latest, abs(delta)] — the only figures a
    # citing claim may state.
    assert e.numbers == [4.2, 4.6, 0.4]
    assert "4.2" in e.text and "4.6" in e.text and "0.4" in e.text


def test_delta_entries_single_run_yields_nothing():
    # Only one complete run → no prior to move from → no delta.
    facts = [_StubFact("i1", "net_leverage", 4.6)]
    assert _delta_entries(facts, {"i1": "X"}, walk=None) == []


def test_delta_entries_nan_value_skipped():
    facts = [
        _StubFact("i1", "net_leverage", float("nan")),
        _StubFact("i1", "net_leverage", 4.2),
    ]
    assert _delta_entries(facts, {"i1": "X"}, walk=None) == []


def test_delta_entries_zero_delta_skipped():
    # No move → nothing to narrate (matches the Desk Brief _delta_entries rule).
    facts = [
        _StubFact("i1", "ebitda_margin", 41.0),
        _StubFact("i1", "ebitda_margin", 41.0),
    ]
    assert _delta_entries(facts, {"i1": "X"}, walk=None) == []


def test_delta_entries_biggest_move_first():
    facts = [
        _StubFact("i1", "net_leverage", 4.6), _StubFact("i1", "net_leverage", 4.2),   # +0.4
        _StubFact("i2", "ebitda_margin", 39.0), _StubFact("i2", "ebitda_margin", 41.0),  # -2.0
    ]
    out = _delta_entries(facts, {"i1": "A", "i2": "B"}, walk=None)
    assert len(out) == 2
    # Bigger absolute move (2.0) ranks first.
    assert out[0].numbers[2] == 2.0
    assert out[1].numbers[2] == 0.4


# ── Integration tests (seeded_db) ────────────────────────────────────────────

async def _seed_facts(db, issuer_id, run_id, values, created_at, provenance="run"):
    """Persist one complete run + its headline KPI facts at a fixed created_at."""
    run = Run(id=run_id, issuer_id=issuer_id, status="complete",
              qa_status="Not Reviewed", created_at=created_at,
              model_id="test-model", prompt_version="v1")
    db.add(run)
    await db.flush()
    for key, val, unit in values:
        db.add(MetricFact(
            issuer_id=issuer_id, run_id=run_id, metric_key=key, period="LTM",
            value=val, unit=unit, headline=True, qa_status="Not Reviewed",
            provenance=provenance, created_at=created_at,
        ))
    await db.flush()


@pytest.mark.asyncio
async def test_build_metric_facts_scoped_returns_deltas_and_peerz(seeded_db):
    async with AsyncSessionLocal() as db:
        # Two same-industry issuers, two complete runs each so a delta exists.
        now = datetime.now(timezone.utc)
        i1 = Issuer(id=str(uuid.uuid4()), name="Acme", industry="Chemicals")
        i2 = Issuer(id=str(uuid.uuid4()), name="Beta", industry="Chemicals")
        db.add_all([i1, i2])
        await db.flush()

        await _seed_facts(db, i1.id, str(uuid.uuid4()),
                          [("net_leverage", 4.2, "x"), ("interest_coverage", 4.0, "x"),
                           ("ebitda_margin", 40.0, "%")], now - timedelta(days=10))
        await _seed_facts(db, i1.id, str(uuid.uuid4()),
                          [("net_leverage", 4.6, "x"), ("interest_coverage", 3.6, "x"),
                           ("ebitda_margin", 41.0, "%")], now - timedelta(days=1))
        await _seed_facts(db, i2.id, str(uuid.uuid4()),
                          [("net_leverage", 3.0, "x"), ("interest_coverage", 6.0, "x"),
                           ("ebitda_margin", 30.0, "%")], now - timedelta(days=1))
        await db.commit()

        entries = await build_metric_facts(db, i1.id, walk="metric-trend")

    # Deltas for the three KPIs (leverage +0.4, coverage -0.4, margin +1.0).
    deltas = [e for e in entries if e.id.endswith(":delta")]
    assert {e.id.split(":")[2] for e in deltas} == {
        "net_leverage", "interest_coverage", "ebitda_margin"}
    lev = next(e for e in deltas if "net_leverage" in e.id)
    assert lev.numbers == [4.2, 4.6, 0.4]
    assert lev.walk == "metric-trend"

    # Peer z-scores: Acme vs Beta (one peer — the _MIN_PEERS=2 fallback to the
    # universe still only has Beta, so peer reads may degrade). Assert shape only
    # where present: any peerz entry must carry [issuer_value, median, z].
    peerz = [e for e in entries if e.id.endswith(":peerz")]
    for e in peerz:
        assert len(e.numbers) == 3
        assert all(math.isfinite(n) for n in e.numbers)


@pytest.mark.asyncio
async def test_build_metric_facts_unscoped_returns_deltas_only(seeded_db):
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        i1 = Issuer(id=str(uuid.uuid4()), name="Acme", industry="Chemicals")
        db.add(i1)
        await db.flush()
        await _seed_facts(db, i1.id, str(uuid.uuid4()),
                          [("net_leverage", 4.2, "x")], now - timedelta(days=10))
        await _seed_facts(db, i1.id, str(uuid.uuid4()),
                          [("net_leverage", 4.6, "x")], now - timedelta(days=1))
        await db.commit()
        entries = await build_metric_facts(db, None, walk="metric-trend")

    # Unscoped → deltas only (peer z is per-issuer by definition).
    assert all(e.id.endswith(":delta") for e in entries)
    assert any("net_leverage" in e.id for e in entries)


@pytest.mark.asyncio
async def test_build_metric_facts_empty_corpus_returns_empty(seeded_db):
    async with AsyncSessionLocal() as db:
        # A freshly-seeded issuer with no run-derived headline KPI facts.
        issuers = (await db.execute(select(Issuer))).scalars().all()
        i = issuers[0].id
        entries = await build_metric_facts(db, i, walk="metric-trend")
    assert entries == []


@pytest.mark.asyncio
async def test_build_metric_facts_blocked_facts_excluded(seeded_db):
    """A gate-Blocked fact must never feed a deterministic derivative —
    defense-in-depth behind the runner write-skip (same posture as peers._peer_facts)."""
    async with AsyncSessionLocal() as db:
        now = datetime.now(timezone.utc)
        i1 = Issuer(id=str(uuid.uuid4()), name="Acme", industry="Chemicals")
        db.add(i1)
        await db.flush()
        # Two complete runs, but the latest carries qa_status=Blocked.
        await _seed_facts(db, i1.id, str(uuid.uuid4()),
                          [("net_leverage", 4.2, "x")], now - timedelta(days=10))
        run2 = str(uuid.uuid4())
        run = Run(id=run2, issuer_id=i1.id, status="complete", qa_status="Blocked",
                  created_at=now - timedelta(days=1), model_id="m", prompt_version="v")
        db.add(run)
        await db.flush()
        db.add(MetricFact(issuer_id=i1.id, run_id=run2, metric_key="net_leverage",
                          period="LTM", value=4.6, unit="x", headline=True,
                          qa_status="Blocked", provenance="run", created_at=now - timedelta(days=1)))
        await db.commit()
        entries = await build_metric_facts(db, i1.id, walk=None)

    # The Blocked latest run is excluded → only the prior run remains → no delta.
    deltas = [e for e in entries if e.id.endswith(":delta")]
    assert deltas == []
