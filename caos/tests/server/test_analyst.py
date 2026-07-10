"""Tests for engine/analyst.py — the Phase-3 Analyst agent.

The Analyst reuses ``queryanswer._generate`` (the full Phase-2 gate stack) so
these tests mock ``_generate`` to return canned validated payloads and assert
the ValidatedClaim conversion, the model-tier router (HEAVY ≥5.0 / LIGHT 3.0–5.0),
the spend cap, and the per-anomaly fault isolation. No LLM is called.
"""

from __future__ import annotations

import asyncio
from typing import List

import pytest

from engine import analyst, presets
from engine.anomaly import Anomaly
from engine.queryanswer import _generate  # noqa: F401 — imported for monkeypatch target


def _anom(kind: str, severity: float, issuer_id: str = "i1",
          issuer_name: str = "Acme", metric: str = "net_leverage") -> Anomaly:
    return Anomaly(
        kind=kind, direction="up", severity=severity, issuer_id=issuer_id,
        issuer_name=issuer_name, metric=metric, chunk_id="c-anom",
        context={"peer_scope": "same-industry"})


def _payload(sentences, unavailable=False, model="fake-heavy"):
    return {
        "answer": " ".join(s["text"] for s in sentences),
        "sentences": sentences,
        "citations": [], "fact_citations": [],
        "unavailable": unavailable, "model": model,
    }


_CANNED = _payload([
    {"text": "Acme leverage jumped to 7.5x on the latest run.",
     "chunk_ids": ["c1"], "fact_ids": ["fact:i1:net_leverage:delta"],
     "claim_type": "observation"},
    {"text": "The move likely reflects EBITDA compression from the leveraged recap.",
     "chunk_ids": ["c1"], "fact_ids": [], "claim_type": "causal-hypothesis"},
])


def _wire_generate(monkeypatch, payload=_CANNED, calls: List = None, exc=None):
    async def _gen(db, question, capability_id=None, issuer_id=None, tier=None):
        if calls is not None:
            calls.append({"question": question, "issuer_id": issuer_id, "tier": tier})
        if exc is not None:
            raise exc
        return payload
    monkeypatch.setattr(analyst, "_generate", _gen)


# ── should_investigate / tier_for (pure routers) ─────────────────────────────

def test_should_investigate_routes_by_severity():
    # The LIGHT bar is 3.0 — every flagged anomaly (≥3.0) gets a pass (HEAVY or LIGHT).
    assert analyst.should_investigate(_anom("ts-jump", 3.0))
    assert analyst.should_investigate(_anom("ts-jump", 4.9))
    assert analyst.should_investigate(_anom("ts-jump", 10.0))
    assert not analyst.should_investigate(_anom("peer-outlier", 2.9))


def test_tier_for_routes_heavy_vs_light():
    # HEAVY for clearly-extreme (≥5.0); LIGHT for material-but-routine (3.0–5.0).
    assert analyst.tier_for(_anom("ts-jump", 5.0)) == presets.HEAVY
    assert analyst.tier_for(_anom("ts-jump", 10.0)) == presets.HEAVY
    assert analyst.tier_for(_anom("peer-outlier", 4.9)) == presets.LIGHT
    assert analyst.tier_for(_anom("peer-outlier", 3.0)) == presets.LIGHT


# ── investigate_anomaly (conversion + tier + fault isolation) ────────────────

@pytest.mark.usefixtures("seeded_db")
def test_investigate_anomaly_converts_payload_to_claims(monkeypatch):
    calls: list = []
    _wire_generate(monkeypatch, _CANNED, calls)
    anom = _anom("ts-jump", 9.0)  # severity 9.0 → tier_for → HEAVY

    out = asyncio.run(analyst.investigate_anomaly(None, anom))

    assert len(out) == 2
    assert out[0].text == "Acme leverage jumped to 7.5x on the latest run."
    assert out[0].claim_type == "observation"
    assert out[0].anomaly_kind == "ts-jump"
    assert out[0].anomaly_severity == 9.0
    assert out[0].issuer_id == "i1"
    assert out[0].chunk_ids == ["c1"]
    assert out[0].fact_ids == ["fact:i1:net_leverage:delta"]
    assert out[0].model == "fake-heavy"
    assert out[1].claim_type == "causal-hypothesis"
    # The seed question was anomaly-derived and scoped to the issuer; tier routed HEAVY.
    assert "Acme" in calls[0]["question"] and "ts-jump" in calls[0]["question"]
    assert calls[0]["issuer_id"] == "i1"
    assert calls[0]["tier"] == presets.HEAVY


@pytest.mark.usefixtures("seeded_db")
def test_investigate_anomaly_light_tier_for_material(monkeypatch):
    calls: list = []
    _wire_generate(monkeypatch, _CANNED, calls)
    anom = _anom("peer-outlier", 4.0)  # 3.0 ≤ 4.0 < 5.0 → LIGHT
    asyncio.run(analyst.investigate_anomaly(None, anom))
    assert calls[0]["tier"] == presets.LIGHT


@pytest.mark.usefixtures("seeded_db")
def test_investigate_anomaly_explicit_tier_overrides(monkeypatch):
    calls: list = []
    _wire_generate(monkeypatch, _CANNED, calls)
    # Caller forces HEAVY even on a material-range anomaly.
    asyncio.run(analyst.investigate_anomaly(None, _anom("peer-outlier", 4.0),
                                            tier=presets.HEAVY))
    assert calls[0]["tier"] == presets.HEAVY


@pytest.mark.usefixtures("seeded_db")
def test_investigate_anomaly_unavailable_returns_empty(monkeypatch):
    _wire_generate(monkeypatch, _payload([], unavailable=True))
    out = asyncio.run(analyst.investigate_anomaly(None, _anom("ts-jump", 9.0)))
    assert out == []  # gates dropped everything — honest silence


@pytest.mark.usefixtures("seeded_db")
def test_investigate_anomaly_failure_returns_empty(monkeypatch):
    _wire_generate(monkeypatch, exc=TimeoutError("analyst llm timeout"))
    out = asyncio.run(analyst.investigate_anomaly(None, _anom("ts-jump", 9.0)))
    assert out == []  # fault-isolated — never aborts


# ── investigate (batch routing + cap) ────────────────────────────────────────

@pytest.mark.usefixtures("seeded_db")
def test_investigate_routes_all_flagged_with_tier(monkeypatch):
    calls: list = []
    _wire_generate(monkeypatch, _CANNED, calls)
    anomalies = [
        _anom("ts-jump", 10.0, "i1", "Acme"),    # HEAVY
        _anom("peer-outlier", 4.0, "i2", "Beta"),  # LIGHT
        _anom("cusum-shift", 8.0, "i3", "Gamma"),  # HEAVY
        _anom("ts-jump", 2.5, "i4", "Delta"),     # below 3.0 → skipped
    ]
    out = asyncio.run(analyst.investigate(None, anomalies))
    # Three flagged anomalies (≥3.0) get a pass; the 2.5 is skipped.
    assert len(calls) == 3
    tiers_by_issuer = {c["issuer_id"]: c["tier"] for c in calls}
    assert tiers_by_issuer["i1"] == presets.HEAVY
    assert tiers_by_issuer["i2"] == presets.LIGHT
    assert tiers_by_issuer["i3"] == presets.HEAVY
    assert "i4" not in tiers_by_issuer
    assert len(out) == 6  # 3 anomalies × 2 canned claims each


@pytest.mark.usefixtures("seeded_db")
def test_investigate_respects_max_per_run(monkeypatch):
    calls: list = []
    _wire_generate(monkeypatch, _CANNED, calls)
    anomalies = [_anom("ts-jump", float(9 + i), f"i{i}", f"Issuer{i}") for i in range(5)]
    out = asyncio.run(analyst.investigate(None, anomalies, max_per_run=2))
    assert len(calls) == 2  # cap hit after 2 passes (HEAVY + LIGHT combined)
    assert len(out) == 4   # 2 × 2 canned claims


@pytest.mark.usefixtures("seeded_db")
def test_investigate_empty_input_returns_empty(monkeypatch):
    calls: list = []
    _wire_generate(monkeypatch, _CANNED, calls)
    out = asyncio.run(analyst.investigate(None, []))
    assert out == []
    assert calls == []  # no LLM spend on an empty anomaly set


@pytest.mark.usefixtures("seeded_db")
def test_investigate_all_below_bar_no_spend(monkeypatch):
    calls: list = []
    _wire_generate(monkeypatch, _CANNED, calls)
    # All below the 3.0 LIGHT bar — the Anomaly Detector would not normally emit
    # these, but the router defends in depth: zero spend.
    anomalies = [_anom("peer-outlier", 2.0 + 0.1 * i) for i in range(5)]  # 2.0–2.4
    out = asyncio.run(analyst.investigate(None, anomalies))
    assert out == []
    assert calls == []
