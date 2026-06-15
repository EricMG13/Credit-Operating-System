"""Loan Scorecard — the deterministic scoring methodology + the route.

The bulk exercises the pure engine (engine/scorecard.py): basis detection
(covenant_review vs the methodology fallback when no covenant-review document is
present), score direction, sub-score weighting, seniority, and graceful
degradation (Insufficient Information, never a fabricated number). A thin
integration test confirms the /api/scorecard/{deal_id} pivot over a seeded deal.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

SERVER_DIR = Path(__file__).resolve().parents[2] / "server"
sys.path.insert(0, str(SERVER_DIR))

from engine.scorecard import (  # noqa: E402
    SUBSCORE_WEIGHTS, TermValue, band_for, detect_seniority, score_deal,
)


def _tv(num=None, text=None, doc=False, conf="Moderate") -> TermValue:
    return TermValue(num=num, text=text, confidence=conf, doc_grounded=doc)


# ── Bands & weights ──────────────────────────────────────────────────────────
def test_band_for_scale():
    assert band_for(1.2) == "Strongly protective"
    assert band_for(2.2) == "Protective"
    assert band_for(3.0) == "Balanced"
    assert band_for(3.8) == "Weak"
    assert band_for(4.8) == "Deficient"


def test_subscore_weights_sum_to_one():
    assert abs(sum(SUBSCORE_WEIGHTS.values()) - 1.0) < 1e-9


# ── Seniority detection ──────────────────────────────────────────────────────
def test_detect_seniority():
    assert detect_seniority("acme 2L senior secured term loan", {}) == "2L"
    assert detect_seniority("acme first-lien TLB", {}) == "1L"
    assert detect_seniority("acme facility", {}) is None
    assert detect_seniority("acme", {"collateral": _tv(text="Second-lien on substantially all assets")}) == "2L"


# ── Degradation: nothing in → Insufficient Information (no fabrication) ───────
def test_empty_terms_insufficient():
    card = score_deal({}, label="acme")
    assert card.basis == "none"
    assert card.composite.value is None
    assert card.composite.confidence == "Insufficient Information"
    assert all(s.value is None for s in card.sub_scores)


# ── The methodology fallback: no covenant-review doc, score off empirical ────
def test_methodology_basis_when_no_doc():
    terms = {
        "cov_lite": _tv(text="Yes"),                       # empirical / seeded, not doc-grounded
        "net_first_lien_leverage_ratio": _tv(num=6.5),
        "d1_unrestricted_sub_investments_musd": _tv(num=400),
        "call_type": _tv(text="Soft"),
    }
    card = score_deal(terms, label="acme 2L senior secured term loan")
    assert card.basis == "methodology"
    assert card.composite.value is not None
    assert any("No covenant-review document" in f for f in card.limitation_flags)
    # cov-lite + high leverage should drag default protection toward deficient
    dp = next(s for s in card.sub_scores if s.key == "default_protection")
    assert dp.value >= 3.5
    assert dp.basis == "methodology"


# ── Covenant-review basis when terms trace to a document ─────────────────────
def test_covenant_review_basis():
    terms = {
        "cov_lite": _tv(text="No", doc=True, conf="High"),
        "net_first_lien_leverage_ratio": _tv(num=4.0, doc=True, conf="High"),
        "synergies_cost_savings_cap": _tv(text="25% capped", doc=True, conf="High"),
    }
    card = score_deal(terms, label="acme first-lien TLB")
    assert card.basis == "covenant_review"
    assert card.composite.value is not None
    assert card.composite.confidence in ("High", "Moderate")
    # a clean, maintenance-covenant, first-lien deal should land protective
    assert card.composite.value < 3.4


# ── Direction sanity: cov-lite is worse than a maintenance covenant ──────────
def test_cov_lite_worse_than_maintenance():
    base = {"net_first_lien_leverage_ratio": _tv(num=5.0)}
    covlite = next(s for s in score_deal({**base, "cov_lite": _tv(text="Yes")}, label="x first lien").sub_scores
                   if s.key == "default_protection").value
    maint = next(s for s in score_deal({**base, "cov_lite": _tv(text="No")}, label="x first lien").sub_scores
                 if s.key == "default_protection").value
    assert covlite > maint  # higher == weaker protection


# ── Direction sanity: 2L collateral is weaker than 1L ────────────────────────
def test_seniority_drives_collateral():
    terms = {"cov_lite": _tv(text="No")}
    c1 = next(s for s in score_deal(terms, label="acme first lien term loan").sub_scores
              if s.key == "collateral_protection").value
    c2 = next(s for s in score_deal(terms, label="acme second lien term loan").sub_scores
              if s.key == "collateral_protection").value
    assert c2 > c1


def test_shape_always_five_subs_six_quality():
    card = score_deal({"cov_lite": _tv(text="No")}, label="acme first lien")
    assert len(card.sub_scores) == 5
    assert len(card.quality_scores) == 6


# ── Route integration (seeded deal) ──────────────────────────────────────────
@pytest.fixture(scope="module")
def client(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("caos-sc")
    os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{tmp / 'test.db'}"
    os.environ["CAOS_STORAGE_DIR"] = str(tmp / "vault")
    os.environ["ANTHROPIC_API_KEY"] = ""
    from main import app  # imported after env is set

    with TestClient(app) as c:
        yield c


def test_scorecard_route_on_seeded_deal(client):
    deals = client.get("/api/compare/deals").json()
    assert deals, "demo seed should populate deals for /compare and /scorecard"
    deal_id = deals[0]["id"]
    r = client.get(f"/api/scorecard/{deal_id}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["deal_id"] == deal_id
    assert len(body["sub_scores"]) == 5
    assert len(body["quality_scores"]) == 6
    assert body["basis"] in ("covenant_review", "methodology", "mixed", "none")
    if any(s["value"] is not None for s in body["sub_scores"]):
        assert body["composite"]["value"] is not None
        assert body["composite"]["band"] is not None


def test_scorecard_route_404(client):
    assert client.get("/api/scorecard/does-not-exist").status_code == 404
