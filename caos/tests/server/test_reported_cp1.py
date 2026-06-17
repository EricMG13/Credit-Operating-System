"""Reported-disclosure CP-1 for non-EDGAR issuers (#34) — extract issuer-disclosed
net leverage / Adjusted EBITDA / revenue from quarterly investor reports & earnings
(e.g. Virgin Media O2, a mixed bond + term-loan credit), and build a reported-basis
CP-1. All offline."""
from __future__ import annotations

import asyncio
from types import SimpleNamespace

from engine.reported_cp1 import build_reported_cp1_payload, extract_reported_metrics
from engine.schemas import validate_payload


def test_extract_net_debt_to_ebitda_form():
    m = extract_reported_metrics([("c1", "Total Net Debt to Annualised Adjusted EBITDA of 5.86x.")])
    assert m is not None and m["net_leverage"] == (5.86, "c1")


def test_extract_leverage_alternate_forms():
    assert extract_reported_metrics([("c", "Consolidated net leverage of 4.50x")])["net_leverage"][0] == 4.5
    assert extract_reported_metrics([("c", "ended the period at 3.2x net leverage")])["net_leverage"][0] == 3.2


def test_extract_leverage_bare_forms_no_connector():
    # Real releases write the number right after "leverage" with no of/was — bare
    # space, a colon, or "ratio". These used to miss and fall through to the LLM.
    assert extract_reported_metrics([("c", "Adjusted net leverage 5.68x")])["net_leverage"][0] == 5.68
    assert extract_reported_metrics([("c", "net leverage: 5.68x")])["net_leverage"][0] == 5.68
    assert extract_reported_metrics([("c", "net leverage ratio 4.2x")])["net_leverage"][0] == 4.2


def test_extract_leverage_covenant_metric_with_parenthetical_wins():
    # VMO2's real shape: the covenant metric is qualified in parens and disclosed
    # first; the broader figure comes later and must NOT win the headline.
    t = ("Net Total Debt to Annualised Adjusted EBITDA (last two quarters annualised) "
         "of 4.38x. Total Net Debt to Annualised Adjusted EBITDA of 5.86x.")
    assert extract_reported_metrics([("vmo2", t)])["net_leverage"][0] == 4.38


def test_captures_both_leverage_figures():
    t = ("Net Total Debt to Annualised Adjusted EBITDA (last two quarters annualised) "
         "of 4.38x. Total Net Debt to Annualised Adjusted EBITDA of 5.86x.")
    m = extract_reported_metrics([("vmo2", t)])
    assert m["net_leverage"][0] == 4.38           # covenant headline
    assert m["additional_leverage"][0][0] == 5.86  # broader total, captured too
    p = asyncio.run(build_reported_cp1_payload("Virgin Media O2", _retrieve(t)))
    nf = p.runtime_output["normalized_financials"]
    assert nf["net_leverage_adj_ltm"] == 4.38
    assert nf["additional_disclosed_leverage"][0]["value"] == 5.86
    assert any(c.claim_id == "C-RPT-LEV2" for c in p.claims)  # second figure is cited


def test_extract_amounts_currency_and_scale():
    m = extract_reported_metrics([("c", "Total Net Debt to EBITDA of 5.0x. Adjusted EBITDA was "
                                        "£901.7 million. Total revenue of €2.6 billion.")])
    assert m["adj_ebitda"][:2] == (901.7, "£")
    assert m["revenue"][:2] == (2600.0, "€")  # billion → million (×1000)


def test_extract_none_without_disclosed_leverage():
    # leverage gates: no disclosed leverage → None (runner falls through to LLM/fixture)
    assert extract_reported_metrics([("c", "Adjusted EBITDA was £900 million.")]) is None


def test_extract_prefers_most_recent_filing():
    # Across quarterly disclosures the later reporting period wins — and maturity years
    # ("due 2033" / "maturing 2034") must NOT be mistaken for the reporting date.
    older = "Results to 31 March 2025. Net Debt to EBITDA of 5.52x. Senior Notes due 2033."
    newer = "Results to 31 March 2026. Net Debt to EBITDA of 5.86x. Term Loan maturing 2034."
    assert extract_reported_metrics([("old", older), ("new", newer)])["net_leverage"] == (5.86, "new")
    assert extract_reported_metrics([("new", newer), ("old", older)])["net_leverage"] == (5.86, "new")  # order-independent


def _retrieve(text):
    async def r(query, k=12):
        return [SimpleNamespace(chunk_id="c1", text=text)]
    return r


def test_build_reported_cp1_payload():
    p = asyncio.run(build_reported_cp1_payload(
        "Virgin Media O2",
        _retrieve("Total Net Debt to Annualised Adjusted EBITDA of 5.86x. "
                  "Adjusted EBITDA was £901.7 million. Total revenue of £2,007.9 million."),
    ))
    assert p is not None and p.module_id == "CP-1"
    assert p.runtime_output["basis"] == "reported_disclosure"
    assert p.runtime_output["normalized_financials"]["net_leverage_adj_ltm"] == 5.86
    assert p.runtime_output["currency"] == "£"
    assert any(c.claim_id == "C-RPT-LEV" for c in p.claims)
    assert p.claims[0].evidence[0].resolved_chunk_id == "c1"  # click-to-source
    assert validate_payload(p) == []


def test_build_reported_cp1_none_without_leverage():
    assert asyncio.run(build_reported_cp1_payload("X", _retrieve("No leverage figure here."))) is None


def test_extract_term_loan_covenant_leverage():
    # VMO2 is not bond-only: the SFA covenant metric is disclosed for the term loans.
    # The reported lane must read the loan covenant ratio, not just bond-report wording.
    m = extract_reported_metrics([("c", "Senior Secured Net Leverage Ratio of 4.20x")])
    assert m is not None and m["net_leverage"] == (4.2, "c")


def test_extract_rejects_implausible_leverage():
    # The 0.5x–15.0x plausibility gate rejects stray multiples (e.g. coverage ratios).
    assert extract_reported_metrics([("c", "leverage of 25.0x")]) is None
    assert extract_reported_metrics([("c", "leverage of 0.1x")]) is None


def test_extract_amount_abbreviated_scale():
    # 'bn'/'m' abbreviations scale the same as 'billion'/'million'.
    m = extract_reported_metrics([("c", "Net leverage of 4.0x. Adjusted EBITDA of £5.0bn. "
                                        "Total revenue of £500m.")])
    assert m["adj_ebitda"][:2] == (5000.0, "£")  # bn → million (×1000)
    assert m["revenue"][:2] == (500.0, "£")


def test_extract_captures_period_token():
    # The period label (Q/FY/H/LTM/annualised) nearest the amount is captured.
    m = extract_reported_metrics([("c", "Net leverage of 4.0x. LTM Adjusted EBITDA of £900.0 million.")])
    assert m["adj_ebitda"] == (900.0, "£", "LTM", "c")


def test_extract_total_service_revenue():
    # Telecom issuers disclose 'total service revenue' — the revenue pattern accepts it.
    m = extract_reported_metrics([("c", "Net leverage of 4.0x. Total service revenue of £1,500.0 million.")])
    assert m["revenue"][:2] == (1500.0, "£")


def test_build_reported_cp1_leverage_only():
    # Amounts with no currency symbol are ignored; a leverage-only payload still builds.
    p = asyncio.run(build_reported_cp1_payload(
        "Virgin Media O2", _retrieve("Net leverage of 4.0x. Adjusted EBITDA was 901 million.")))
    assert p is not None
    assert p.runtime_output["normalized_financials"] == {"net_leverage_adj_ltm": 4.0}
    assert p.runtime_output["currency"] is None
    assert [c.claim_id for c in p.claims] == ["C-RPT-LEV"]
    assert validate_payload(p) == []


def test_build_reported_cp1_mixed_currency_prefers_ebitda():
    # When EBITDA (£) and revenue (€) disclose different currencies, EBITDA's wins.
    p = asyncio.run(build_reported_cp1_payload(
        "X", _retrieve("Net leverage of 4.0x. Adjusted EBITDA of £900.0 million. "
                       "Total revenue of €2,000.0 million.")))
    assert p is not None and p.runtime_output["currency"] == "£"
    assert validate_payload(p) == []
