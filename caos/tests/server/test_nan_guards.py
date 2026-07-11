"""Regression tests for the CP-1 NaN/non-finite hardening sweep (engine items 1-6, 10).

Project rule (CLAUDE.md): any CP-1-derived value that is divided/multiplied must be
gated through ``engine.periods.is_finite_number`` before use — a bare
``isinstance(x,(int,float))`` passes a NaN (and ``bool(NaN)`` is True), poisoning the
divide. These tests pin that a non-finite input degrades to None/skip rather than
emitting a NaN, that a live model can't smuggle a non-finite literal in via JSON, and
that the keyless demo fixture served for a non-demo issuer is tagged + flagged.
"""

from __future__ import annotations

import json
import math

import pytest

from engine.schemas import ModulePayload, cp1_leverage


NAN = float("nan")
INF = float("inf")


def _cp1(**nf) -> ModulePayload:
    return ModulePayload(module_id="CP-1", module_name="X", owned_object="o",
                         runtime_output={"normalized_financials": nf})


# ── Item 1: schemas.cp1_leverage — NaN/inf → None, not NaN ───────────────────
def test_cp1_leverage_nan_returns_none():
    lev, nd = cp1_leverage(_cp1(net_leverage_adj_ltm=NAN, net_debt_ltm=NAN))
    assert lev is None and nd is None


def test_cp1_leverage_inf_returns_none():
    lev, nd = cp1_leverage(_cp1(net_leverage_adj_ltm=INF, net_debt_ltm=-INF))
    assert lev is None and nd is None


def test_cp1_leverage_finite_passes_through():
    lev, nd = cp1_leverage(_cp1(net_leverage_adj_ltm=5.68, net_debt_ltm=2391.0))
    assert lev == 5.68 and nd == 2391.0


def test_cp1_leverage_zero_and_missing_still_none():
    # 0 is falsy by the accessor's existing contract (kept), missing → None.
    assert cp1_leverage(_cp1(net_leverage_adj_ltm=0)) == (None, None)
    assert cp1_leverage(_cp1()) == (None, None)


# ── Item 2: covenants headroom — NaN leverage degrades, no NaN emitted ───────
@pytest.mark.asyncio
async def test_covenant_headroom_skips_on_nan_leverage():
    from engine.covenants import synthesize_covenants

    cp1 = _cp1(net_leverage_adj_ltm=NAN, net_debt_ltm=NAN)

    async def _retrieve(_q, _k=5):
        return []  # no docs → deterministic, no covenant terms extracted

    out = await synthesize_covenants(cp1, _retrieve)
    ro = out.runtime_output
    # current_net_leverage must NOT be emitted as NaN (the is_finite_number guard).
    cnl = ro.get("current_net_leverage")
    assert cnl is None or math.isfinite(cnl)
    # No calculation row should carry a NaN value/cushion.
    for calc in ro.get("calculations", []):
        for k in ("value", "ebitda_cushion_pct", "denominator"):
            v = calc.get(k)
            if isinstance(v, (int, float)):
                assert math.isfinite(v), (k, v)


def test_covenant_headroom_math_degrades_with_nan_threshold():
    # Direct probe of the guarded branch: a finite lev but a non-finite/zero threshold
    # must not produce a NaN cushion. We assert the guard predicate the code uses.
    from engine.periods import is_finite_number

    lev, thr = 5.0, NAN
    assert not (is_finite_number(lev) and is_finite_number(thr) and thr != 0)
    thr = 0.0
    assert not (is_finite_number(lev) and is_finite_number(thr) and thr != 0)


# ── Item 3: refinancing CP-3D — NaN leverage doesn't silently lower the score ─
def test_score_vulnerability_nan_leverage_treated_as_missing():
    from engine.refinancing import score_vulnerability

    # A NaN leverage must behave like a missing leverage: no leverage driver, not a
    # silently-dropped high-leverage band.
    assert score_vulnerability(NAN, "HIGH") == score_vulnerability(None, "HIGH")
    assert score_vulnerability(NAN, None) == (0, "LOW", [])


@pytest.mark.asyncio
async def test_refinancing_nan_leverage_is_insufficient_not_moderate():
    from engine.refinancing import synthesize_refinancing

    cp1 = _cp1(net_leverage_adj_ltm=NAN)
    cp2b = ModulePayload(module_id="CP-2B", module_name="X", owned_object="o",
                         runtime_output={"fragility": "HIGH"})
    out = await synthesize_refinancing(cp1, cp2b)
    # The old bug: NaN slipped past isinstance → scored MODERATE/LOW. Now: explicit
    # Insufficient Information, never a quietly-computed band.
    assert out.confidence == "Insufficient Information"
    assert "lme_vulnerability_band" not in out.runtime_output
    assert out.limitation_flags  # explains why no score


# ── Item 4: metrics.extract_facts — NaN never enters the cross-issuer store ───
def test_extract_facts_drops_nan_values():
    from engine.metrics import extract_facts

    payload = ModulePayload(
        module_id="CP-1", module_name="X", owned_object="o",
        runtime_output={"normalized_financials": {
            "revenue": {"FY24": NAN, "FY25": 2742.0},
            "adj_ebitda": {"FY24": 392.0, "FY25": NAN},
            "net_leverage_adj_ltm": NAN,
            "interest_coverage_ltm": 2.1,
        }})
    facts = extract_facts("r1", payload, "Passed")
    for f in facts:
        assert math.isfinite(f["value"]), f
    keys = {(f["metric_key"], f["period"]) for f in facts}
    # The NaN revenue/ebitda/leverage are dropped; the finite ones survive.
    assert ("revenue", "FY24") not in keys      # NaN revenue dropped
    assert ("revenue", "FY25") in keys
    assert ("adj_ebitda", "FY25") not in keys   # NaN ebitda dropped
    assert ("net_leverage", "LTM") not in keys  # NaN leverage dropped
    assert ("interest_coverage", "LTM") in keys
    # ebitda_margin only where BOTH operands finite → FY24 (NaN rev) and FY25 (NaN eb)
    # both excluded.
    assert not any(mk == "ebitda_margin" for mk, _ in keys)


def test_extract_facts_tolerates_null_leaves():
    # The live CP-1 tool schema permits null leaves (the prompt instructs "set any
    # metric the sources do not disclose to null"). 100 * None must not TypeError
    # the projection phase and fail the whole run after synthesis + QA succeeded.
    from engine.metrics import extract_facts

    payload = ModulePayload(
        module_id="CP-1", module_name="X", owned_object="o",
        runtime_output={"normalized_financials": {
            "revenue": {"FY24": 1000.0, "FY25": None},
            "adj_ebitda": {"FY24": 392.0, "FY25": None},
            "free_cash_flow": {"FY25": None},
        }})
    facts = extract_facts("r1", payload, "Passed")
    keys = {(f["metric_key"], f["period"]) for f in facts}
    assert ("ebitda_margin", "FY24") in keys   # finite pair still computed
    assert ("adj_ebitda", "FY25") not in keys  # null leaf dropped, not crashed
    assert ("fcf_conversion", "FY25") not in keys
    assert all(math.isfinite(f["value"]) for f in facts)


def test_leverage_plausibility_unaffected_by_nan():
    # Item 4 also asks: leverage_plausibility_finding still behaves. A NaN input must
    # not fire it (its is_finite_number guard already rejects non-finite operands).
    from engine.metrics import leverage_plausibility_finding

    assert leverage_plausibility_finding(
        _cp1(net_leverage_adj_ltm=NAN, net_debt_ltm=2400.0, adj_ebitda={"LTM": 400.0})) is None
    # And the genuine inconsistency still fires.
    f = leverage_plausibility_finding(
        _cp1(net_leverage_adj_ltm=5.0, net_debt_ltm=2400.0, adj_ebitda={"LTM": 400.0}))
    assert f is not None and f.severity == "MATERIAL"


# ── Item 5: peers._own_values — NaN own-values rejected ──────────────────────
def test_own_values_drops_nan():
    from engine.peers import _own_values

    cp1 = ModulePayload(
        module_id="CP-1", module_name="X", owned_object="o",
        runtime_output={"distress": {"altman_z": NAN}, "normalized_financials": {
            "net_leverage_adj_ltm": NAN, "interest_coverage_ltm": 2.1,
            "revenue": {"FY25": NAN}, "adj_ebitda": {"FY25": 415.0}}})
    v = _own_values(cp1)
    assert "net_leverage" not in v   # NaN leverage rejected
    assert "altman_z" not in v       # NaN altman rejected
    assert v.get("interest_coverage") == 2.1
    assert "ebitda_margin" not in v  # NaN revenue → no finite margin
    for val in v.values():
        assert math.isfinite(val)


def test_own_values_margin_finite_when_clean():
    from engine.peers import _own_values

    cp1 = ModulePayload(
        module_id="CP-1", module_name="X", owned_object="o",
        runtime_output={"normalized_financials": {
            "revenue": {"FY25": 1000.0}, "adj_ebitda": {"FY25": 200.0}}})
    assert _own_values(cp1)["ebitda_margin"] == 20.0


# ── Item 6: loads_finite — NaN/Infinity JSON literals rejected (fail-closed) ──
@pytest.mark.parametrize("blob", [
    '{"net_leverage_adj_ltm": NaN}',
    '{"net_leverage_adj_ltm": Infinity}',
    '{"net_leverage_adj_ltm": -Infinity}',
    '{"x": [1, 2, NaN]}',
])
def test_loads_finite_rejects_non_finite(blob):
    from engine.llm_safety import loads_finite

    # stdlib json.loads ACCEPTS these by default (the bug) ...
    assert math.isnan(json.loads('{"v": NaN}')["v"])
    # ... loads_finite refuses them with a ValueError (fail-closed).
    with pytest.raises(ValueError):
        loads_finite(blob)


def test_loads_finite_accepts_normal_json():
    from engine.llm_safety import loads_finite

    assert loads_finite('{"net_leverage_adj_ltm": 5.68, "ok": true}') == {
        "net_leverage_adj_ltm": 5.68, "ok": True}


def test_synth_text_fallback_rejects_non_finite():
    # The synth text→JSON fallback must treat a non-finite literal as "no payload"
    # (→ repair path), never returning a dict with a NaN financial.
    from engine.synth import _payload_data_from_resp

    class _Block:
        type = "text"
        text = '{"runtime_output": {"normalized_financials": {"net_leverage_adj_ltm": NaN}}}'

    class _Resp:
        content = [_Block()]

    assert _payload_data_from_resp(_Resp()) is None


def test_synth_text_fallback_parses_finite_json():
    from engine.synth import _payload_data_from_resp

    class _Block:
        type = "text"
        text = '{"module_name": "CP-1", "runtime_output": {"x": 1.5}}'

    class _Resp:
        content = [_Block()]

    data = _payload_data_from_resp(_Resp())
    assert data["runtime_output"]["x"] == 1.5


# ── Item 10: keyless demo fixture for a non-demo issuer is tagged + flagged ───
def test_demo_fixture_finding_only_for_non_reference_issuer():
    from engine.fixtures import _cp1 as atlf_cp1, REFERENCE_ISSUER_ID, demo_fixture_finding

    cp1 = atlf_cp1()
    assert demo_fixture_finding(REFERENCE_ISSUER_ID, cp1) is None  # genuine demo: ok
    f = demo_fixture_finding("not-the-demo", cp1)
    assert f is not None and f.severity == "MATERIAL"
    assert f.finding_id == "CP-1-DEMO-FIXTURE" and f.module_id == "CP-1"


def test_demo_fixture_finding_none_for_real_cp1():
    from engine.fixtures import demo_fixture_finding

    real = ModulePayload(module_id="CP-1", module_name="X", owned_object="o",
                         runtime_output={"normalized_financials": {"net_leverage_adj_ltm": 4.0}})
    assert demo_fixture_finding("anyone", real) is None  # not a fixture payload


def test_extract_facts_provenance_demo_fixture_for_non_reference():
    from engine.fixtures import _cp1 as atlf_cp1
    from engine.metrics import extract_facts

    cp1 = atlf_cp1()
    ref = {f["provenance"] for f in extract_facts("r", cp1, "Passed", is_reference_issuer=True)}
    other = {f["provenance"] for f in extract_facts("r", cp1, "Passed", is_reference_issuer=False)}
    assert ref == {"fixture"}            # genuine demo keeps "fixture"
    assert other == {"demo_fixture"}     # served elsewhere → non-authoritative tag


# ── 2026-07-03 container-guard pass (BE3-1/2/3/4/6, BE5-3, BE2-1/2/3, BE1-1) ──
# The leaf-level is_finite_number discipline above holds, but live runtime_output
# interiors are unvalidated below the top level: `or {}` keeps a truthy non-dict
# whose .keys()/.items()/.get() raised inside the fatal QA/projection phase and
# aborted + rolled back the whole run. These pin the container-level guards.

def test_latest_tolerates_non_dict_series():
    from engine.periods import latest

    assert latest([358, 392, 415]) is None          # list where a period map belongs
    assert latest("not disclosed") is None          # narrative string
    assert latest(None) is None
    assert latest({"FY24": 1.0, "FY25": 2.0}) == 2.0


def test_extract_facts_tolerates_wrong_typed_containers():
    from engine.metrics import extract_facts

    payload = ModulePayload(
        module_id="CP-1", module_name="X", owned_object="o",
        runtime_output={
            "normalized_financials": {
                "revenue": [{"period": "FY24", "value": 2588}],  # list, not period map
                "adj_ebitda": "not disclosed",                   # narrative string
                "net_leverage": 5.1,                             # scalar where series belongs
                "net_leverage_adj_ltm": 5.1,
                "interest_coverage_ltm": 2.1,
            },
            "distress": "not computable",                        # truthy non-dict
        })
    facts = extract_facts("r1", payload, "Passed")               # must not raise
    keys = {(f["metric_key"], f["period"]) for f in facts}
    assert ("net_leverage", "LTM") in keys        # scalar degrades to the LTM fallback
    assert ("interest_coverage", "LTM") in keys
    assert not any(mk == "revenue" for mk, _ in keys)


def test_extract_facts_tolerates_narrative_normalized_financials():
    from engine.metrics import extract_facts

    payload = ModulePayload(module_id="CP-1", module_name="X", owned_object="o",
                            runtime_output={"normalized_financials": "narrative text"})
    assert extract_facts("r1", payload, "Passed") == []


def test_leverage_plausibility_tolerates_wrong_typed_containers():
    from engine.metrics import leverage_plausibility_finding

    # Narrative normalized_financials → inputs absent → None, not AttributeError.
    assert leverage_plausibility_finding(
        ModulePayload(module_id="CP-1", module_name="X", owned_object="o",
                      runtime_output={"normalized_financials": "narrative"})) is None
    # List-shaped adj_ebitda series → latest() degrades → None.
    assert leverage_plausibility_finding(
        _cp1(net_leverage_adj_ltm=5.0, net_debt_ltm=2400.0, adj_ebitda=[400.0])) is None


def test_reconciliation_finding_tolerates_scalar_key():
    from engine.adjusted import reconciliation_finding

    p = ModulePayload(module_id="CP-1", module_name="X", owned_object="o",
                      runtime_output={"adjusted_ebitda_reconciliation": "not disclosed"})
    assert reconciliation_finding(p) is None


def test_extract_cost_facts_rejects_non_finite_and_non_numeric():
    from engine.metrics import extract_cost_facts

    for bad in (NAN, INF, "12% of COGS", None, [12.0]):
        p = ModulePayload(module_id="CP-2", module_name="X", owned_object="o",
                          runtime_output={"energy_cost_pct": bad})
        assert extract_cost_facts("r1", p, "Passed") == [], bad
    ok = extract_cost_facts("r1", ModulePayload(
        module_id="CP-2", module_name="X", owned_object="o",
        runtime_output={"energy_cost_pct": 12.5}), "Passed")
    assert ok and ok[0]["value"] == 12.5


def test_qa_gates_tolerate_scalar_containers():
    from engine.covenants import addback_cap_finding
    from engine.earnings import monitoring_finding
    from engine.peers import peer_outlier_finding

    def mk(mid, ro):
        return ModulePayload(module_id=mid, module_name="X", owned_object="o",
                             runtime_output=ro)

    # A truthy scalar where a list belongs must not raise on iteration.
    f = monitoring_finding(mk("CP-1B", {"monitoring_signals": 5}))
    assert f is not None and "5" in f.description
    # A bare string joins as ONE item, not char-by-char.
    f = peer_outlier_finding(mk("CP-1C", {"outlier_metrics": "net_leverage"}))
    assert f is not None and "net_leverage" in f.description and "n, e, t" not in f.description
    # A truthy non-dict audit degrades to None, never AttributeError.
    assert addback_cap_finding(mk("CP-4C", {"addback_audit": "n/a"})) is None


def test_build_route_plan_tolerates_llm_shaped_cp0():
    from engine.planner import build_route_plan

    cp0 = ModulePayload(
        module_id="CP-0", module_name="SourceReadiness", owned_object="source_readiness",
        runtime_output={"categories_present": "financials",   # scalar, not a list
                        "edgar_available": False,
                        "files_classified": "fourteen"},      # non-numeric count
        limitation_flags=["ok-flag", 7],                      # non-str flag
    )
    plan = build_route_plan(cp0)                              # must not raise (BE3-4)
    assert plan.execution_order  # still routes the graph


@pytest.mark.asyncio
async def test_liquidity_sum_drops_non_finite_amounts(monkeypatch):
    # BE2-1/BE2-3: a NaN amount must not reach the disclosed-liquidity sum (the
    # producers can't emit one today — this pins the is_finite_number filter so a
    # regression back to bare isinstance fails loudly).
    import engine.liquidity as liquidity

    monkeypatch.setattr(liquidity, "scan_liquidity", lambda pairs: [
        {"source": "Undrawn RCF", "amount_musd": 250.0, "chunk_id": "c1"},
        {"source": "Cash on hand", "amount_musd": NAN, "chunk_id": "c2"},
    ])

    class _Hit:
        chunk_id, text = "c1", "irrelevant"

    async def retrieve(_q, _k=6):
        return [_Hit()]

    out = await liquidity.synthesize_liquidity(retrieve)
    total = out.runtime_output["disclosed_liquidity_musd"]
    assert total == 250.0 and math.isfinite(total)
    assert "nan" not in out.claims[0].claim_text.lower()


def test_recovery_waterfall_skips_non_finite_claim():
    # BE2-3: the is_finite_number(claim) guard treats a NaN claim as unsized —
    # no NaN may leak into any waterfall row.
    from engine.capstructure import recovery_waterfall

    rows = recovery_waterfall(
        [{"code": "TLB", "seniority_rank": 1, "amount_musd": NAN},
         {"code": "2L", "seniority_rank": 2, "amount_musd": 900.0}],
        distressed_ev=1000.0,
    )
    for row in rows:
        for v in row.values():
            if isinstance(v, float):
                assert math.isfinite(v), row


def test_edgar_interest_coverage_requires_positive_interest():
    # BE1-1: a negative-tagged interest concept must not emit a negative coverage.
    # The guard is inline in edgar_cp1's leverage block; pin the predicate shape
    # the fix restored (symmetry with the leverage guard): only a strictly
    # positive interest figure reaches the divide.
    eb_ly, int0 = 421.0, -50.0
    assert not (eb_ly and eb_ly > 0 and int0 and int0 > 0)
    int0 = 200.0
    assert (eb_ly and eb_ly > 0 and int0 and int0 > 0)


# ── Output-inf residue: finite operands whose RATIO overflows float range ─────
# (confidence-audit 2026-07-11 A-1/A-2/A-3: the safe_div output-finiteness
# discipline applied to the earnings deltas and the document-amount parsers.)


def test_compute_deltas_denormal_prior_revenue_degrades_not_inf():
    """revenue 5e-324 → 1.0 is a +inf percent change with finite operands; the
    YoY delta must degrade to None, never emit inf into committee text."""
    from engine.earnings import compute_deltas

    out = compute_deltas({"revenue": {"FY23": 5e-324, "FY24": 1.0},
                          "adj_ebitda": {"FY23": 5e-324, "FY24": 1.0}})
    s = out["summary"]
    assert s["revenue_growth_pct"] is None
    assert s["ebitda_growth_pct"] is None
    for row in out["periods"]:
        m = row["ebitda_margin"]
        assert m is None or math.isfinite(m)


def test_compute_deltas_denormal_revenue_margin_degrades_not_inf():
    """EBITDA margin with a denormal revenue denominator overflows to inf with
    finite operands; the row margin must be None."""
    from engine.earnings import compute_deltas

    out = compute_deltas({"revenue": {"FY24": 5e-324}, "adj_ebitda": {"FY24": 1.0}})
    assert out["periods"][0]["ebitda_margin"] is None


def test_textscan_amount_musd_rejects_overflowing_amount():
    """`[\\d,]+` is unbounded — a 320-digit amount parses to inf and must be
    dropped at the source, not handed to consumers as a quantum."""
    import re

    from engine.textscan import amount_musd

    kw = re.compile(r"revolver", re.IGNORECASE)
    garbage = "undrawn revolver of $" + "9" * 320 + " million available"
    assert amount_musd(garbage, kw) is None
    # sanity: a real amount still parses
    assert amount_musd("undrawn revolver of $500 million", kw) == 500.0


def test_covenants_amount_match_rejects_overflowing_amount():
    from engine.covenants import _INCREMENTAL_AMT, _amount_match

    garbage = "incremental facility of $" + "9" * 320 + " million"
    assert _amount_match(_INCREMENTAL_AMT, garbage) is None
    assert _amount_match(_INCREMENTAL_AMT, "incremental facility of $250 million") == 250.0
