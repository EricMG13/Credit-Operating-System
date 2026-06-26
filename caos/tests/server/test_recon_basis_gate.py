"""Regression: the add-back reconciliation must run only on an *adjusted*-basis
CP-1. On a reported basis (EDGAR XBRL / issuer-disclosed) the EBITDA already
excludes add-backs, so re-stripping them double-counts and reports leverage
*worse* than reported — a "reported is canonical" provenance violation.

The gate lives in runner.synthesize_module's CP-1 branch; these tests drive it
directly with a monkeypatched _synthesize_cp1 + a stub retrieve that surfaces an
"18% of adjusted EBITDA" add-back chunk.
"""
from types import SimpleNamespace

import pytest

from engine import runner
from engine.schemas import ModulePayload


def _cp1(basis):
    rt = {"normalized_financials": {"net_leverage_adj_ltm": 5.0, "net_debt_ltm": 2050.0}}
    if basis is not None:
        rt["basis"] = basis
    return ModulePayload(
        module_id="CP-1", module_name="CanonicalDataFoundation",
        owned_object="canonical_financials", runtime_output=rt, confidence="Medium",
    )


async def _retrieve(query, k=5):
    # An add-back disclosure chunk the deterministic extractor will match.
    return [SimpleNamespace(
        chunk_id="C-ADDBACK",
        text="EBITDA is presented with add-backs of approximately 18 percent of adjusted EBITDA.",
    )]


async def _synth_module(cp1):
    async def fake_cp1(*a, **k):
        return cp1
    return cp1, fake_cp1


@pytest.mark.asyncio
@pytest.mark.parametrize("basis", ["reported_gaap_xbrl", "reported_disclosure"])
async def test_reported_basis_skips_reconciliation(monkeypatch, basis):
    cp1 = _cp1(basis)
    monkeypatch.setattr(runner, "_synthesize_cp1", (await _synth_module(cp1))[1])
    out = await runner.synthesize_module(
        "CP-1", session=None, issuer=None, issuer_name="X",
        synthesizer=None, upstream={}, retrieve=_retrieve,
    )
    assert "adjusted_ebitda_reconciliation" not in (out.runtime_output or {})
    assert not any(c.claim_id == "C-ADJ1" for c in out.claims)


@pytest.mark.asyncio
async def test_adjusted_basis_runs_reconciliation(monkeypatch):
    cp1 = _cp1(None)  # fixture / live-LLM path carries no reported basis tag
    monkeypatch.setattr(runner, "_synthesize_cp1", (await _synth_module(cp1))[1])
    out = await runner.synthesize_module(
        "CP-1", session=None, issuer=None, issuer_name="X",
        synthesizer=None, upstream={}, retrieve=_retrieve,
    )
    recon = (out.runtime_output or {}).get("adjusted_ebitda_reconciliation")
    assert recon is not None
    assert recon["addback_pct"] == pytest.approx(0.18)
    # Adjusted-basis math: stripping add-backs RAISES leverage off the marketed base.
    assert recon["leverage_excl_addbacks"] > recon["leverage_current"]
