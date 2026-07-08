"""Tests for engine/reporter.py — the Phase-3 deterministic Reporter composer.

The Reporter is pure composition (no LLM); these tests assert the section
grouping, the claims-vs-bullets routing, the exhibit rendering, the draft
envelope (unratified + export-gated + marked), the ratify flywheel, and the
empty-input honest-silence path.
"""

from __future__ import annotations

import asyncio

import pytest

from database import AsyncSessionLocal
from engine import reporter
from engine.analyst import ValidatedClaim
from engine.anomaly import Anomaly
from engine.metricengine import MetricFactEntry


def _anom(kind, severity, issuer_id, metric="net_leverage", chunk_id="c-anom"):
    return Anomaly(kind=kind, direction="up", severity=severity, issuer_id=issuer_id,
                   issuer_name=issuer_id, metric=metric, chunk_id=chunk_id,
                   context={"peer_scope": "same-industry"})


def _claim(text, claim_type, issuer_id, kind, severity, chunk_ids=None, fact_ids=None):
    return ValidatedClaim(text=text, claim_type=claim_type, issuer_id=issuer_id,
                          anomaly_kind=kind, anomaly_severity=severity,
                          chunk_ids=chunk_ids or [], fact_ids=fact_ids or [],
                          model="fake-heavy")


def _wire_exhibits(monkeypatch, facts_by_issuer):
    async def _facts(db, issuer_id, walk=None):
        return list(facts_by_issuer.get(issuer_id, []))
    monkeypatch.setattr(reporter, "build_metric_facts", _facts)


# ── compose_draft_report ─────────────────────────────────────────────────────

@pytest.mark.usefixtures("seeded_db")
def test_compose_groups_by_issuer_and_routes_claims_vs_bullets(monkeypatch):
    _wire_exhibits(monkeypatch, {
        "i1": [MetricFactEntry(id="fact:i1:net_leverage:delta", kind="metric",
                               label="Acme Net leverage", text="4.0x → 5.2x (+1.2x)",
                               numbers=[4.0, 5.2, 1.2], issuer_id="i1",
                               walk="metric-trend", chunk_id="c-i1")],
    })
    anomalies = [
        _anom("ts-jump", 9.0, "i1"),          # investigated → has claims → claims
        _anom("peer-outlier", 4.0, "i1"),     # sub-threshold → bullet
        _anom("cusum-shift", 8.0, "i2"),      # investigated but 0 claims → bullet
    ]
    claims = [
        _claim("Acme leverage jumped to 7.5x.", "observation", "i1", "ts-jump", 9.0,
               chunk_ids=["c1"]),
        _claim("The move reflects EBITDA compression.", "causal-hypothesis", "i1",
               "ts-jump", 9.0, chunk_ids=["c1"]),
    ]

    async def _run():
        async with AsyncSessionLocal() as db:
            return await reporter.compose_draft_report(db, anomalies, claims)

    draft = asyncio.run(_run())

    # Draft envelope — autonomous drafting, NOT publishing.
    assert draft["status"] == "draft"
    assert draft["ai_generated"] is True
    assert draft["ratified"] is False
    assert draft["export_allowed"] is False
    assert draft["marking"] == "AI-GENERATED, UNRATIFIED"

    # Two sections, severity-ranked (i1 max 9.0 before i2 max 8.0).
    assert [s["issuer_id"] for s in draft["sections"]] == ["i1", "i2"]

    i1 = next(s for s in draft["sections"] if s["issuer_id"] == "i1")
    # ts-jump is covered by 2 claims → not a bullet; peer-outlier (sub-threshold) → bullet.
    assert len(i1["claims"]) == 2
    assert [b["kind"] for b in i1["deterministic_bullets"]] == ["peer-outlier"]
    # Exhibit rendered from the mocked Metric Engine facts.
    assert i1["exhibit"] and i1["exhibit"][0]["id"] == "fact:i1:net_leverage:delta"
    assert i1["exhibit"][0]["numbers"] == [4.0, 5.2, 1.2]

    i2 = next(s for s in draft["sections"] if s["issuer_id"] == "i2")
    # cusum-shift investigated but 0 surviving claims → deterministic bullet (no fabrication).
    assert i2["claims"] == []
    assert [b["kind"] for b in i2["deterministic_bullets"]] == ["cusum-shift"]

    # Summary counts.
    assert draft["summary"] == {"n_sections": 2, "n_claims": 2,
                                "n_deterministic_bullets": 2, "n_anomalies": 3}


@pytest.mark.usefixtures("seeded_db")
def test_compose_empty_input_is_honest_silence(monkeypatch):
    _wire_exhibits(monkeypatch, {})
    async def _run():
        async with AsyncSessionLocal() as db:
            return await reporter.compose_draft_report(db, [], [])
    draft = asyncio.run(_run())
    assert draft["sections"] == []
    assert draft["summary"]["n_sections"] == 0
    assert draft["summary"]["n_claims"] == 0
    # Still a draft envelope — the pipeline ran and found nothing.
    assert draft["status"] == "draft" and draft["marking"] == "AI-GENERATED, UNRATIFIED"


@pytest.mark.usefixtures("seeded_db")
def test_compose_exhibit_failure_does_not_block_draft(monkeypatch):
    async def _boom(db, issuer_id, walk=None):
        raise RuntimeError("metric engine blew up")
    monkeypatch.setattr(reporter, "build_metric_facts", _boom)
    anomalies = [_anom("ts-jump", 9.0, "i1")]
    claims = [_claim("Acme leverage jumped.", "observation", "i1", "ts-jump", 9.0)]
    async def _run():
        async with AsyncSessionLocal() as db:
            return await reporter.compose_draft_report(db, anomalies, claims)
    draft = asyncio.run(_run())
    # Exhibit failed → empty exhibit, but the section + claim still render.
    assert len(draft["sections"]) == 1
    assert draft["sections"][0]["exhibit"] == []
    assert draft["sections"][0]["claims"]


# ── ratify / is_exportable (the analyst flywheel) ────────────────────────────

def _empty_draft():
    return {"status": "draft", "ai_generated": True, "ratified": False,
            "export_allowed": False, "marking": "AI-GENERATED, UNRATIFIED",
            "generated_at": "t", "sections": [], "summary": {}}


def test_ratify_flips_flags_and_returns_new_dict():
    draft = _empty_draft()
    ratified = reporter.ratify(draft)
    assert ratified["ratified"] is True
    assert ratified["export_allowed"] is True
    assert ratified["marking"] == "AI-GENERATED, RATIFIED"
    assert "ratified_at" in ratified
    # Original stays unratified (audit trail — ratify never mutates in place).
    assert draft["ratified"] is False
    assert draft["marking"] == "AI-GENERATED, UNRATIFIED"


def test_is_exportable_only_when_ratified():
    assert reporter.is_exportable(_empty_draft()) is False
    assert reporter.is_exportable(reporter.ratify(_empty_draft())) is True
    # A non-draft (e.g. a stale record) is never exportable via this gate.
    assert reporter.is_exportable({"status": "archived", "ratified": True}) is False


def test_ratify_only_applies_to_draft():
    archived = {"status": "archived", "ratified": False, "marking": "x"}
    out = reporter.ratify(archived)
    assert out is archived  # returned unchanged — only a draft can be ratified
