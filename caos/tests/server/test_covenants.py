"""Tests for CP-4C CovenantCapacityCalculator: deterministic covenant-term
extraction, the capacity/headroom calculations, cov-lite detection + finding,
and the runner wiring on the seeded ATLF deal.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from engine.covenants import (
    addback_cap_finding,
    covlite_finding,
    derive_covenant_terms,
    synthesize_covenants,
)
from conftest import wait_for_run
from engine.fixtures import REFERENCE_ISSUER_ID
from engine.schemas import ModulePayload, validate_payload

_INDENTURE = "Senior secured notes indenture. Day-one incremental incurrence capacity of 612 million dollars."
_MAINT = "The borrower shall not permit the consolidated net leverage ratio to exceed 7.00x as of any test date."


# ── Deterministic covenant-term extraction ───────────────────────────────────
def test_derive_terms_incremental_and_covlite():
    terms = derive_covenant_terms([("c-ind", _INDENTURE)])
    assert terms is not None
    assert terms["incremental_musd"] == (612.0, "c-ind", True)  # exact: regex-matched in this chunk
    assert terms["leverage_covenant_x"] is None  # none present → cov-lite


def test_derive_terms_maintenance_covenant():
    terms = derive_covenant_terms([("c-sfa", _MAINT)])
    assert terms["leverage_covenant_x"] == (7.0, "c-sfa", True)
    assert terms["incremental_musd"] is None


def test_derive_terms_none_when_nothing():
    assert derive_covenant_terms([("c1", "The aftermarket installed base renews at 92 percent.")]) is None


def test_derive_terms_incremental_tied_to_clause_not_first_figure():
    # Regression (review run-2026-06-26 #1): the incremental amount must bind to the
    # incremental clause, NOT the first "$N million" in the chunk. A preceding fee
    # figure used to win and get cited as the basket with exact=True/High.
    text = ("The Borrower paid $5 million in arrangement fees. The agreement provides "
            "incremental capacity in the form of an incurrence basket of up to "
            "$250 million of additional term loans.")
    assert derive_covenant_terms([("c-incr", text)])["incremental_musd"] == (250.0, "c-incr", True)


def test_derive_terms_incremental_billion_scaled_to_musd():
    # Billion-denominated baskets are real and were missed entirely (million-only).
    terms = derive_covenant_terms([("c-b", "Day-one incremental incurrence capacity of $1.5 billion.")])
    assert terms["incremental_musd"] == (1500.0, "c-b", True)


# ── Capacity / headroom calculations ─────────────────────────────────────────
def _cp1(lev=5.68, nd=2391.0):
    return ModulePayload(
        module_id="CP-1", module_name="X", owned_object="o",
        runtime_output={"normalized_financials": {
            "net_leverage_adj_ltm": lev, "net_debt_ltm": nd}},
    )


def _retrieve(text, cid="c-doc"):
    async def retrieve(query, k=6):
        return [SimpleNamespace(chunk_id=cid, text=text)]
    return retrieve


def test_synthesize_incremental_capacity_and_covlite():
    p = asyncio.run(synthesize_covenants(_cp1(), _retrieve(_INDENTURE, "c-ind")))
    assert p.module_id == "CP-4C" and validate_payload(p) == []
    assert p.runtime_output["covenant_structure"] == "cov-lite"
    calc = next(c for c in p.runtime_output["calculations"] if c["name"].startswith("Pro-forma"))
    # (2391 + 612) / (2391 / 5.68) ≈ 7.13x
    assert calc["value"] == pytest.approx(7.13, abs=0.03)
    assert p.claims[0].evidence[0].resolved_chunk_id == "c-ind"


def test_synthesize_maintenance_headroom():
    p = asyncio.run(synthesize_covenants(_cp1(), _retrieve(_MAINT, "c-sfa")))
    assert p.runtime_output["covenant_structure"] == "maintenance"
    calc = next(c for c in p.runtime_output["calculations"] if c["name"].startswith("Net leverage covenant"))
    assert calc["value"] == pytest.approx(1.32, abs=0.02)        # 7.00 − 5.68 turns
    assert calc["ebitda_cushion_pct"] == pytest.approx(18.9, abs=0.2)  # decline to breach


def test_synthesize_insufficient_without_terms():
    p = asyncio.run(synthesize_covenants(_cp1(), _retrieve("no covenant content here", "c1")))
    assert p.confidence == "Insufficient Information"
    assert p.runtime_output["calculations"] == []
    assert not p.claims


# ── Real-agreement covenant formats (#26) ────────────────────────────────────
# The "N:1.00" / "N to 1.00" ratio forms real credit agreements use, plus the
# compliance-certificate form — and rejection of the many incurrence ratio tests.
_MAINT_RATIO = ("The Borrower shall not permit the Total Leverage Ratio as of the last day "
                "of any Fiscal Quarter to be greater than 5.75 to 1.00.")
_COMPLIANCE = ("Total Leverage Ratio as of the Determination Date was __ : 1.00. "
               "Maximum Permitted: 5.75:1.00. Total Leverage Ratio is computed as follows.")
_INCURRENCE = ("The Borrower may incur Incremental Facilities if, on a Pro Forma Basis, the "
               "Secured Leverage Ratio does not exceed 3.25 to 1.00 and no Default exists.")


def test_derive_terms_ratio_format_covenant_clause():
    terms = derive_covenant_terms([("c-ag", _MAINT_RATIO)])
    assert terms["leverage_covenant_x"] == (5.75, "c-ag", True)  # "to 1.00" form, not "x"


def test_derive_terms_compliance_certificate_ratio():
    terms = derive_covenant_terms([("c-cc", _COMPLIANCE)])
    assert terms["leverage_covenant_x"] == (5.75, "c-cc", True)  # "Maximum Permitted: N:1.00"


def test_derive_terms_ignores_incurrence_ratio_tests():
    # An incurrence test (no "shall not permit" / "Maximum Permitted") is NOT the
    # maintenance covenant — it must not be mistaken for one.
    assert derive_covenant_terms([("c-inc", _INCURRENCE)]) is None


def test_derive_terms_senior_secured_single_threshold():
    # Six Flags-style covenant *type* (Senior Secured Leverage Ratio) with a single
    # threshold — the qualifier must be recognized, not only Total/Consolidated/Net.
    text = ("The Borrower shall not permit the Senior Secured Leverage Ratio as of the last "
            "day of any fiscal quarter to exceed 4.50 to 1.00.")
    assert derive_covenant_terms([("c-ss", text)])["leverage_covenant_x"] == (4.5, "c-ss", True)


def test_derive_terms_captures_leverage_basis():
    # The covenant's leverage basis is carried separately (senior_secured vs total),
    # so CP-4C can tell a secured TLB covenant from a total/consolidated one.
    ss = ("The Borrower shall not permit the Senior Secured Leverage Ratio as of the last "
          "day of any fiscal quarter to exceed 4.50 to 1.00.")
    assert derive_covenant_terms([("c-ss", ss)])["leverage_covenant_basis"] == "senior_secured"
    assert derive_covenant_terms([("c-sfa", _MAINT)])["leverage_covenant_basis"] == "total"
    assert derive_covenant_terms([("c-cc", _COMPLIANCE)])["leverage_covenant_basis"] is None  # cert: no basis word


def test_synthesize_headroom_ratio_format():
    p = asyncio.run(synthesize_covenants(_cp1(5.68, 2391.0), _retrieve(_MAINT_RATIO, "c-ag")))
    assert p.runtime_output["covenant_structure"] == "maintenance"
    calc = next(c for c in p.runtime_output["calculations"] if c["name"].startswith("Net leverage covenant"))
    assert calc["numerator"] == 5.75
    assert calc["value"] == pytest.approx(0.07, abs=0.01)  # 5.75 − 5.68 turns (razor-thin)


def test_synthesize_headroom_from_reported_leverage_no_net_debt():
    # #34: a reported-disclosure CP-1 carries net leverage WITHOUT net debt; headroom
    # only needs leverage, so CP-4C must still compute it (the non-EDGAR issuer path).
    cp1 = ModulePayload(module_id="CP-1", module_name="X", owned_object="o",
                        runtime_output={"normalized_financials": {"net_leverage_adj_ltm": 5.5}})
    p = asyncio.run(synthesize_covenants(cp1, _retrieve(_MAINT_RATIO, "c-ag")))  # covenant 5.75
    calc = next(c for c in p.runtime_output["calculations"] if c["name"].startswith("Net leverage covenant"))
    assert calc["value"] == pytest.approx(0.25, abs=0.01)  # 5.75 − 5.5


def test_synthesize_flags_secured_covenant_against_total_leverage():
    # VMO2-style: a Senior Secured covenant but CP-1 carries TOTAL net leverage. The
    # headroom math is unchanged (flag-only), but the basis mismatch is labeled + flagged
    # so the conservative cushion isn't mistaken for a like-for-like read.
    ss = ("The Borrower shall not permit the Senior Secured Leverage Ratio as of the last "
          "day of any fiscal quarter to exceed 4.50 to 1.00.")
    p = asyncio.run(synthesize_covenants(_cp1(4.20, None), _retrieve(ss, "c-ss")))
    assert validate_payload(p) == []
    calc = next(c for c in p.runtime_output["calculations"] if c["name"].startswith("Net leverage covenant"))
    assert calc["value"] == pytest.approx(0.30, abs=0.01)  # 4.50 − 4.20, math NOT changed
    assert p.runtime_output["covenant_basis"] == "senior_secured"
    assert any("conservative" in f.lower() and "secured" in f.lower() for f in p.limitation_flags)
    assert any("senior secured leverage covenant" in c.claim_text.lower() for c in p.claims)


def test_synthesize_total_covenant_not_flagged():
    # A total/consolidated covenant matches CP-1's basis — no mismatch flag, wording stays "total".
    p = asyncio.run(synthesize_covenants(_cp1(), _retrieve(_MAINT, "c-sfa")))
    assert "covenant_basis" not in p.runtime_output  # basis "total" is the default, not surfaced
    assert not any("conservative" in f.lower() for f in p.limitation_flags)
    assert any("total leverage covenant" in c.claim_text.lower() for c in p.claims)


def test_synthesize_sources_covenant_without_cp1_leverage():
    """EDGAR-path case (#27): CP-1 has no leverage — still surface the covenant as a
    directly-sourced fact, with headroom deferred, rather than abstaining."""
    cp1_no_lev = ModulePayload(
        module_id="CP-1", module_name="X", owned_object="o",
        runtime_output={"normalized_financials": {"revenue": {"FY25": 4520}}},
    )
    p = asyncio.run(synthesize_covenants(cp1_no_lev, _retrieve(_MAINT_RATIO, "c-ag")))
    assert validate_payload(p) == [] and p.confidence == "High"
    assert p.runtime_output["covenant_structure"] == "maintenance"
    assert p.runtime_output["leverage_covenant_x"] == 5.75
    assert "current_net_leverage" not in p.runtime_output  # none to report
    assert p.claims[0].evidence[0].lineage_class == "Directly Sourced"
    assert all(c["name"] != "Net leverage covenant headroom" for c in p.runtime_output["calculations"])
    assert any("headroom is not computed" in f for f in p.limitation_flags)


# ── Covenant register: RP basket / cross-default / add-back cap ──────────────
_RP = ("The credit agreement permits restricted payments under a general basket "
       "of $150 million plus the builder basket.")
_XD = ("Material Indebtedness means Indebtedness in an aggregate principal amount "
       "in excess of $50.0 million; a payment default triggers the cross-default.")
_CAP_SFA = ("Senior facilities agreement. The EBITDA definition caps cost-saving "
            "add-backs at 25 percent over a trailing 24 month period.")


def test_derive_terms_rp_basket():
    assert derive_covenant_terms([("c-rp", _RP)])["rp_basket_musd"] == (150.0, "c-rp", True)


def test_derive_terms_cross_default_threshold():
    assert derive_covenant_terms([("c-xd", _XD)])["cross_default_musd"] == (50.0, "c-xd", True)


def test_derive_terms_addback_cap_both_shapes():
    # Verb-after shape ("shall not exceed 20%") and verb-before shape ("caps ... at 25 percent").
    assert derive_covenant_terms([("c1", _CAP_SFA)])["addback_cap_pct"] == (0.25, "c1", True)
    verb = "Cost savings and synergies shall not exceed 20% of Consolidated EBITDA."
    assert derive_covenant_terms([("c2", verb)])["addback_cap_pct"] == (0.20, "c2", True)


def test_derive_terms_addback_load_or_uncapped_is_not_a_cap():
    # The disclosed *load* ("represent 18.2 percent", adjusted.py's job) and an
    # "uncapped" statement carry no capping verb — neither may parse as a cap.
    load = "Adjusted EBITDA add-backs represent 18.2 percent of adjusted EBITDA."
    unc = "Add-backs to consolidated EBITDA are uncapped."
    assert derive_covenant_terms([("c1", load)]) is None
    assert derive_covenant_terms([("c2", unc)]) is None


def _cp1_with_recon(load):
    p = _cp1()
    p.runtime_output["adjusted_ebitda_reconciliation"] = {"addback_pct": load}
    return p


def test_synthesize_addback_audit_within_cap():
    p = asyncio.run(synthesize_covenants(_cp1_with_recon(0.182), _retrieve(_CAP_SFA, "c-sfa")))
    assert validate_payload(p) == []
    audit = p.runtime_output["addback_audit"]
    assert audit["cap_pct"] == 0.25 and audit["breach"] is False
    assert audit["utilization_pct"] == pytest.approx(72.8, abs=0.1)
    assert p.runtime_output["addback_cap_pct"] == 0.25
    calc = next(c for c in p.runtime_output["calculations"] if "add-back cap" in c["name"])
    assert calc["value"] == pytest.approx(72.8, abs=0.1) and calc["unit"] == "%"
    assert addback_cap_finding(p) is None  # within cap → no finding


def test_synthesize_addback_audit_breach_and_finding():
    p = asyncio.run(synthesize_covenants(_cp1_with_recon(0.30), _retrieve(_CAP_SFA, "c-sfa")))
    audit = p.runtime_output["addback_audit"]
    assert audit["breach"] is True and audit["utilization_pct"] == pytest.approx(120.0, abs=0.1)
    f = addback_cap_finding(p)
    assert f is not None and f.severity == "MINOR" and f.lane == 3
    assert f.finding_id == "CP-4C-ADDBACK-CAP"
    assert any("exceed the covenant cap" in c.claim_text for c in p.claims)


def test_synthesize_cap_without_recon_still_sourced():
    # No CP-1 add-back disclosure → the cap is still surfaced as a sourced fact;
    # no audit is fabricated.
    p = asyncio.run(synthesize_covenants(_cp1(), _retrieve(_CAP_SFA, "c-sfa")))
    assert p.runtime_output["addback_cap_pct"] == 0.25
    assert "addback_audit" not in p.runtime_output
    assert any("caps add-backs at 25%" in c.claim_text for c in p.claims)


def test_addback_finding_rejects_nonfinite_audit():
    # Trust boundary: a persisted/replayed payload could carry NaN — no finding.
    p = ModulePayload(module_id="CP-4C", module_name="X", owned_object="o",
                      runtime_output={"addback_audit": {
                          "breach": True, "disclosed_addback_pct": float("nan"), "cap_pct": 0.25}})
    assert addback_cap_finding(p) is None
    assert addback_cap_finding(None) is None


def test_synthesize_rp_and_cross_default_surfaced():
    p = asyncio.run(synthesize_covenants(_cp1(), _retrieve(_RP + " " + _XD, "c-mix")))
    assert validate_payload(p) == []
    assert p.runtime_output["rp_basket_musd"] == 150.0
    assert p.runtime_output["cross_default_musd"] == 50.0
    ids = [c.claim_id for c in p.claims]
    assert "C-CAP3" in ids and "C-CAP4" in ids


# ── Citation provenance honesty (LLM path) ───────────────────────────────────
def test_inexact_chunk_id_downgrades_citation(monkeypatch):
    """When the model didn't pin a real retrieved chunk (safe_chunk_id exact=False),
    the covenant citation must NOT claim 'Directly Sourced / High' — it downgrades to
    Inferred/Medium so a substituted/absent source never overstates provenance."""
    import engine.covenants as cov

    cp1_no_lev = ModulePayload(
        module_id="CP-1", module_name="X", owned_object="o",
        runtime_output={"normalized_financials": {"revenue": {"FY25": 4520}}},
    )

    async def terms_inexact(retrieve):
        return {"incremental_musd": (612.0, "c-sub", False),
                "leverage_covenant_x": None, "leverage_covenant_basis": None}
    monkeypatch.setattr(cov, "extract_covenant_terms", terms_inexact)
    p = asyncio.run(cov.synthesize_covenants(cp1_no_lev, _retrieve(_INDENTURE, "c-sub")))
    ev = p.claims[0].evidence[0]
    assert ev.lineage_class == "Inferred" and ev.confidence == "Medium"
    assert ev.resolved_chunk_id == "c-sub"  # still points at the chunk for navigation

    async def terms_exact(retrieve):
        return {"incremental_musd": (612.0, "c-real", True),
                "leverage_covenant_x": None, "leverage_covenant_basis": None}
    monkeypatch.setattr(cov, "extract_covenant_terms", terms_exact)
    p2 = asyncio.run(cov.synthesize_covenants(cp1_no_lev, _retrieve(_INDENTURE, "c-real")))
    ev2 = p2.claims[0].evidence[0]
    assert ev2.lineage_class == "Directly Sourced" and ev2.confidence == "High"


# ── Cov-lite finding ─────────────────────────────────────────────────────────
def test_covlite_finding_fires_for_covlite():
    p = ModulePayload(module_id="CP-4C", module_name="X", owned_object="o",
                      runtime_output={"covenant_structure": "cov-lite"})
    f = covlite_finding(p)
    assert f is not None and f.severity == "MINOR" and f.lane == 3
    assert f.finding_id == "CP-4C-COVLITE"


def test_covlite_finding_silent_for_maintenance():
    p = ModulePayload(module_id="CP-4C", module_name="X", owned_object="o",
                      runtime_output={"covenant_structure": "maintenance"})
    assert covlite_finding(p) is None
    assert covlite_finding(None) is None


# ── Runner wiring on the ATLF deal ───────────────────────────────────────────
# ── _llm_covenant_terms: magnitude grounding (#3) ───────────────────────────
# amount_term/cap_t previously accepted any sign/range-valid figure with no check
# that it actually appears in its own cited chunk — a hallucinated (or prompt-
# injected) magnitude sailed through. These pin the grounding gate added on top.

def _hit(cid: str, text: str) -> SimpleNamespace:
    return SimpleNamespace(chunk_id=cid, text=text)


@pytest.mark.asyncio
async def test_llm_covenant_terms_grounds_leverage_covenant(monkeypatch):
    import engine.covenants as cov

    async def fake_extract_json(retrieve, *, query, k, system, schema=None):
        return ({"leverage_covenant_x": 6.0, "leverage_chunk_id": "c1", "leverage_basis": "total"},
               [_hit("c1", "Consolidated Total Net Leverage Ratio shall not exceed 6.00x.")])

    monkeypatch.setattr(cov, "extract_json", fake_extract_json)
    out = await cov._llm_covenant_terms(lambda q, k=10: [])
    assert out["leverage_covenant_x"] == (6.0, "c1", True)


@pytest.mark.asyncio
async def test_llm_covenant_terms_rejects_ungrounded_leverage_covenant(monkeypatch):
    import engine.covenants as cov

    async def fake_extract_json(retrieve, *, query, k, system, schema=None):
        # Chunk says nothing about a 9.0x covenant — hallucinated/injected figure.
        return ({"leverage_covenant_x": 9.0, "leverage_chunk_id": "c1"},
               [_hit("c1", "The credit agreement governs a term loan B facility.")])

    monkeypatch.setattr(cov, "extract_json", fake_extract_json)
    out = await cov._llm_covenant_terms(lambda q, k=10: [])
    assert out is None  # every term was rejected → whole-payload None


@pytest.mark.asyncio
async def test_llm_covenant_terms_grounds_billion_scale_amount(monkeypatch):
    """incremental_musd is normalized to $M, but a source stating '$1.5 billion'
    surfaces only 1.5 via the raw numeral scan — the dual-form check (raw + /1000)
    must ground a correctly-extracted billion-scale figure."""
    import engine.covenants as cov

    async def fake_extract_json(retrieve, *, query, k, system, schema=None):
        return ({"incremental_musd": 1500.0, "incremental_chunk_id": "c1"},
               [_hit("c1", "Incremental facilities may not exceed $1.5 billion in the aggregate.")])

    monkeypatch.setattr(cov, "extract_json", fake_extract_json)
    out = await cov._llm_covenant_terms(lambda q, k=10: [])
    assert out["incremental_musd"] == (1500.0, "c1", True)


@pytest.mark.asyncio
async def test_llm_covenant_terms_rejects_ungrounded_amount(monkeypatch):
    import engine.covenants as cov

    async def fake_extract_json(retrieve, *, query, k, system, schema=None):
        return ({"rp_basket_musd": 250.0, "rp_chunk_id": "c1"},
               [_hit("c1", "Restricted payments require board approval.")])

    monkeypatch.setattr(cov, "extract_json", fake_extract_json)
    out = await cov._llm_covenant_terms(lambda q, k=10: [])
    assert out is None


@pytest.mark.asyncio
async def test_llm_covenant_terms_grounds_addback_cap_percent_form(monkeypatch):
    import engine.covenants as cov

    async def fake_extract_json(retrieve, *, query, k, system, schema=None):
        return ({"addback_cap_pct": 0.25, "addback_cap_chunk_id": "c1"},
               [_hit("c1", "Cost savings add-backs are capped at 25% of Consolidated EBITDA.")])

    monkeypatch.setattr(cov, "extract_json", fake_extract_json)
    out = await cov._llm_covenant_terms(lambda q, k=10: [])
    assert out["addback_cap_pct"] == (0.25, "c1", True)


@pytest.fixture(scope="module")
def client():
    from main import app

    with TestClient(app) as c:
        yield c


def test_run_produces_cp4c_capacity_and_covlite(client):
    run = wait_for_run(client, client.post("/api/runs", json={"issuer_id": REFERENCE_ISSUER_ID}).json()["id"])
    detail = client.get(f"/api/runs/{run['id']}/modules/CP-4C").json()
    calcs = detail["runtime_output"]["calculations"]
    assert any(c["name"].startswith("Pro-forma") for c in calcs)  # $612M incremental → PF leverage

    qa = client.get(f"/api/runs/{run['id']}/qa").json()
    cov = [f for f in qa["findings"] if f["finding_id"] == "CP-4C-COVLITE"]
    assert cov and cov[0]["severity"] == "MINOR"
    assert qa["findings_by_severity"]["CRITICAL"] == 0
