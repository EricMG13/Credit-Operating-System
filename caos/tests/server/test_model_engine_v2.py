from __future__ import annotations

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from model_engine_v2 import (
    CellOverride,
    DebtInstrument,
    DebtPeriod,
    ModelAuthority,
    ModelDraftPayload,
    ModelPeriodInput,
    calculate_model,
    is_finite_number,
)
from model_service import ModelSourceError, payload_from_cp1, replace_active_override
from types import SimpleNamespace


AUTHORITY = ModelAuthority(origin="live", method="test", source_ids=["run-1"])
DERIVED_EXPIRY = datetime(2099, 1, 1, tzinfo=timezone.utc)


def _reporting_profile(month: int = 12, day: int = 31) -> SimpleNamespace:
    return SimpleNamespace(
        fiscal_year_end_month=month,
        fiscal_year_end_day=day,
    )


def _payload(*, overrides: list[CellOverride] | None = None) -> ModelDraftPayload:
    return ModelDraftPayload(
        reporting_currency="USD",
        reporting_unit="millions",
        periods=[ModelPeriodInput(
            period_key="FY2026",
            label="FY26e",
            kind="forecast",
            revenue=800,
            reported_ebitda=100,
            adjustments=10,
            cash=20,
            taxes=5,
            capex=10,
            working_capital_change=-2,
            other_cash_flow=0,
            authority=AUTHORITY,
        )],
        debt_instruments=[DebtInstrument(
            instrument_id="tlb-1",
            name="First-lien term loan",
            priority=1,
            seniority="1L",
            currency="USD",
            rate_type="hybrid",
            authority=AUTHORITY,
            periods=[DebtPeriod(
                period_key="FY2026",
                opening_balance=200,
                closing_balance=190,
                draws=0,
                repayments=10,
                scheduled_amortization=0,
                commitment=220,
                benchmark_rate=0.04,
                floor_rate=0.05,
                spread_rate=0.03,
                coupon_rate=0.01,
                commitment_fee_rate=0.005,
                pik_rate=0,
                cash_fees=1,
                hedge_effect=-0.5,
                fx_rate=1,
            )],
        )],
        overrides=overrides or [],
        source_ids=["run-1"],
    )


def test_average_balance_interest_components_and_rollforward_tie() -> None:
    result = calculate_model(_payload(), evaluated_at=datetime(2026, 7, 14, tzinfo=timezone.utc))
    assert result.status == "ready"
    instrument = result.periods[0].instruments[0]
    assert instrument.average_balance == 195
    assert instrument.expected_closing_balance == 190
    assert instrument.rollforward_residual == 0
    assert instrument.benchmark_interest == pytest.approx(9.75)
    assert instrument.margin_interest == pytest.approx(5.85)
    assert instrument.coupon_interest == pytest.approx(1.95)
    assert instrument.fees == pytest.approx(1.125)
    assert instrument.hedge_effect == -0.5
    assert instrument.cash_interest == pytest.approx(18.175)
    assert result.periods[0].gross_leverage == pytest.approx(190 / 110)
    assert result.periods[0].net_leverage == pytest.approx(170 / 110)
    nodes = {node.node_id: node for node in result.periods[0].nodes}
    for field in (
        "closing_balance",
        "average_balance",
        "expected_closing_balance",
        "rollforward_residual",
        "benchmark_interest",
        "margin_interest",
        "coupon_interest",
        "fees",
        "pik_interest",
        "fx_effect",
        "cash_interest",
        "debt_reporting_currency",
    ):
        node = nodes[f"debt:tlb-1:FY2026:{field}"]
        assert node.formula is not None


def test_actual_period_preserves_sourced_close_and_exposes_rollforward_residual() -> None:
    payload = _payload()
    payload.periods[0].kind = "actual"
    payload.debt_instruments[0].periods[0].closing_balance = 180

    result = calculate_model(payload)
    instrument = result.periods[0].instruments[0]

    assert instrument.closing_balance == 180
    assert instrument.expected_closing_balance == 190
    assert instrument.rollforward_residual == -10
    assert result.periods[0].total_debt == 180
    assert result.status == "partial"
    assert any("debt roll-forward residual -10.0" in warning for warning in result.warnings)
    assert any("debt roll-forward does not tie" in gap for gap in result.gaps)


def test_sequential_actual_debt_discontinuity_is_partial_without_rewriting_source() -> None:
    payload = _payload()
    payload.periods[0].kind = "actual"
    payload.periods.append(ModelPeriodInput(
        period_key="FY2027",
        label="FY27",
        kind="actual",
        revenue=850,
        adjusted_ebitda=115,
        cash=25,
        taxes=6,
        capex=11,
        working_capital_change=-3,
        other_cash_flow=0,
        authority=AUTHORITY,
    ))
    payload.debt_instruments[0].periods.append(DebtPeriod(
        period_key="FY2027",
        opening_balance=300,
        closing_balance=290,
        draws=0,
        repayments=10,
        scheduled_amortization=0,
        commitment=320,
        benchmark_rate=0.04,
        floor_rate=0.05,
        spread_rate=0.03,
        coupon_rate=0.01,
        commitment_fee_rate=0.005,
        pik_rate=0,
        cash_fees=1,
        hedge_effect=-0.5,
        fx_rate=1,
    ))

    result = calculate_model(payload)
    second = result.periods[1].instruments[0]

    assert result.status == "partial"
    assert second.opening_balance == 300
    assert second.closing_balance == 290
    assert second.rollforward_residual == 0
    assert any(
        "FY2027/tlb-1: sourced opening balance does not tie to FY2026 closing balance" in gap
        for gap in result.gaps
    )
    assert any(
        "FY2027/tlb-1: supplied opening balance does not tie to prior closing balance" in warning
        for warning in result.warnings
    )


def test_contiguous_quarter_opening_ties_to_prior_close() -> None:
    payload = _payload()
    first_period = payload.periods[0]
    first_period.period_key = "Q1-2026"
    first_period.label = "Q1 2026"
    first_period.kind = "actual"
    first_period.months = 3
    first_debt = payload.debt_instruments[0].periods[0]
    first_debt.period_key = "Q1-2026"
    payload.periods.append(ModelPeriodInput(
        period_key="Q2-2026",
        label="Q2 2026",
        kind="actual",
        months=3,
        adjusted_ebitda=30,
        cash=20,
        taxes=2,
        capex=3,
        working_capital_change=0,
        other_cash_flow=0,
        authority=AUTHORITY,
    ))
    payload.debt_instruments[0].periods.append(DebtPeriod(
        period_key="Q2-2026",
        opening_balance=190,
        closing_balance=180,
        draws=0,
        repayments=10,
        scheduled_amortization=0,
        commitment=220,
        benchmark_rate=0.04,
        floor_rate=0.05,
        spread_rate=0.03,
        coupon_rate=0.01,
        commitment_fee_rate=0.005,
        pik_rate=0,
        cash_fees=1,
        hedge_effect=-0.5,
        fx_rate=1,
    ))

    result = calculate_model(payload)

    assert result.status == "ready"
    assert result.periods[1].instruments[0].opening_balance == 190
    assert not any("opening balance does not tie" in item for item in result.gaps)
    assert not any("opening balance does not tie" in item for item in result.warnings)


@pytest.mark.parametrize(
    ("period_key", "kind", "months", "opening", "closing"),
    [
        ("YTD-Q2-2026", "actual", 6, 200, 190),
        ("LTM-2026-06-30", "ltm", 12, 300, 290),
    ],
)
def test_overlapping_comparison_windows_do_not_create_opening_tie_false_positive(
    period_key: str,
    kind: str,
    months: int,
    opening: float,
    closing: float,
) -> None:
    payload = _payload()
    first_period = payload.periods[0]
    first_period.period_key = "Q1-2026"
    first_period.label = "Q1 2026"
    first_period.kind = "actual"
    first_period.months = 3
    payload.debt_instruments[0].periods[0].period_key = "Q1-2026"
    payload.periods.append(ModelPeriodInput(
        period_key=period_key,
        label=period_key,
        kind=kind,
        months=months,
        adjusted_ebitda=120,
        cash=20,
        taxes=5,
        capex=10,
        working_capital_change=0,
        other_cash_flow=0,
        authority=AUTHORITY,
    ))
    payload.debt_instruments[0].periods.append(DebtPeriod(
        period_key=period_key,
        opening_balance=opening,
        closing_balance=closing,
        draws=0,
        repayments=10,
        scheduled_amortization=0,
        commitment=320,
        benchmark_rate=0.04,
        floor_rate=0.05,
        spread_rate=0.03,
        coupon_rate=0.01,
        commitment_fee_rate=0.005,
        pik_rate=0,
        cash_fees=1,
        hedge_effect=-0.5,
        fx_rate=1,
    ))

    result = calculate_model(payload)

    assert result.status == "ready"
    assert result.periods[1].instruments[0].opening_balance == opening
    assert not any("opening balance does not tie" in item for item in result.gaps)
    assert not any("opening balance does not tie" in item for item in result.warnings)


def test_derived_override_replaces_graph_node_and_recomputes_dependents() -> None:
    result = calculate_model(_payload(overrides=[CellOverride(
        node_id="calc:FY2026:adjusted_ebitda",
        value_type="number",
        value=80,
        reason="IC haircut",
        source="CP-6A",
        expires_at=DERIVED_EXPIRY,
    )]))
    period = result.periods[0]
    assert period.adjusted_ebitda == 80
    assert period.gross_leverage == pytest.approx(190 / 80)
    assert period.interest_coverage == pytest.approx(80 / period.cash_interest)
    node = next(node for node in period.nodes if node.node_id == "calc:FY2026:adjusted_ebitda")
    assert node.original_value == 110
    assert node.overridden is True
    assert node.override_reason == "IC haircut"


def test_input_override_propagates_and_scenario_payload_stays_unrelated() -> None:
    payload = _payload(overrides=[CellOverride(
        node_id="input:FY2026:cash",
        value_type="number",
        value=50,
        reason="Treasury update",
    )])
    result = calculate_model(payload)
    assert result.periods[0].cash == 50
    assert result.periods[0].net_debt == 140
    assert payload.overrides[0].node_id == "input:FY2026:cash"


def test_summary_input_overrides_supersede_complete_debt_schedule_downstream() -> None:
    payload = _payload(overrides=[
        CellOverride(
            node_id="input:FY2026:total_debt",
            value_type="number",
            value=999,
            reason="Analyst debt reconciliation",
        ),
        CellOverride(
            node_id="input:FY2026:cash_interest",
            value_type="number",
            value=50,
            reason="Analyst interest reconciliation",
        ),
        CellOverride(
            node_id="input:FY2026:net_debt",
            value_type="number",
            value=900,
            reason="Analyst net debt reconciliation",
        ),
    ])

    result = calculate_model(payload)
    period = result.periods[0]
    assert period.total_debt == 999
    assert period.cash_interest == 50
    assert period.net_debt == 900
    assert period.gross_leverage == pytest.approx(999 / 110)
    assert period.net_leverage == pytest.approx(900 / 110)
    assert period.interest_coverage == pytest.approx(110 / 50)
    assert period.free_cash_flow == pytest.approx(110 - 50 - 5 - 10 - 2)
    assert any("total debt input override supersedes" in item for item in result.warnings)
    assert any("cash interest input override supersedes" in item for item in result.warnings)
    assert any("net debt input override supersedes" in item for item in result.warnings)
    nodes = {node.node_id: node for node in period.nodes}
    assert nodes["calc:FY2026:total_debt"].formula == (
        "input.total_debt (analyst override)"
    )
    assert nodes["calc:FY2026:cash_interest"].formula == (
        "input.cash_interest (analyst override)"
    )
    assert nodes["calc:FY2026:net_debt"].formula == (
        "input.net_debt (analyst override)"
    )


def test_missing_live_debt_inputs_degrade_without_reference_defaults() -> None:
    payload = ModelDraftPayload(
        reporting_currency="USD",
        reporting_unit="millions",
        periods=[ModelPeriodInput(
            period_key="FY2026",
            label="FY26",
            kind="actual",
            adjusted_ebitda=120,
            net_debt=500,
            authority=AUTHORITY,
        )],
    )
    result = calculate_model(payload)
    assert result.status == "partial"
    assert result.periods[0].total_debt is None
    assert result.periods[0].cash_interest is None
    assert result.periods[0].net_debt == 500
    assert result.periods[0].net_leverage == pytest.approx(500 / 120)
    assert any("total debt" in gap for gap in result.gaps)
    assert all("Atlas" not in str(value) for value in (result.model_dump(),))
    nodes = {node.node_id: node for node in result.periods[0].nodes}
    assert nodes["calc:FY2026:total_debt"].formula == "input.total_debt"
    assert nodes["calc:FY2026:cash_interest"].formula == "input.cash_interest"
    assert nodes["calc:FY2026:net_debt"].formula == "input.net_debt"


def test_missing_declared_instrument_period_cannot_make_partial_schedule_authoritative() -> None:
    payload = _payload()
    payload.periods[0].total_debt = 300
    payload.periods[0].cash_interest = 24
    payload.debt_instruments.append(DebtInstrument(
        instrument_id="rcf-1",
        name="Revolver",
        priority=2,
        seniority="1L",
        currency="USD",
        rate_type="floating",
        authority=AUTHORITY,
        periods=[],
    ))

    result = calculate_model(payload)

    assert result.status == "partial"
    assert result.periods[0].total_debt == 300
    assert result.periods[0].cash_interest == 24
    assert any(
        "debt schedule is missing period rows for rcf-1" in gap
        for gap in result.gaps
    )


def test_rollforward_mismatch_is_visible_and_hashes_are_deterministic() -> None:
    payload = _payload()
    payload.debt_instruments[0].periods[0].closing_balance = 180
    first = calculate_model(payload, evaluated_at=datetime(2026, 7, 14, tzinfo=timezone.utc))
    second = calculate_model(payload, evaluated_at=datetime(2026, 7, 14, tzinfo=timezone.utc))
    assert first.warnings == [
        "FY2026/tlb-1: supplied closing balance does not tie to derived forecast close"
    ]
    assert first.input_fingerprint == second.input_fingerprint
    assert first.calculation_hash == second.calculation_hash


def test_stable_ltm_ytd_keys_zero_commitment_and_adjusted_ebitda_tie_warning() -> None:
    for key in ("YTD-Q2-2026", "LTM-2026-06-30"):
        assert ModelPeriodInput(
            period_key=key,
            label=key,
            kind="ltm",
            adjusted_ebitda=100,
            authority=AUTHORITY,
        ).period_key == key
    payload = _payload()
    payload.periods[0].adjusted_ebitda = 120
    payload.debt_instruments[0].periods[0].commitment = 0
    payload.debt_instruments[0].periods[0].commitment_fee_rate = 0.01
    result = calculate_model(payload)
    instrument = result.periods[0].instruments[0]
    assert instrument.fees == 1
    assert any("adjusted EBITDA does not tie" in warning for warning in result.warnings)


def test_zero_denominators_and_nonfinite_values_fail_safe() -> None:
    payload = _payload()
    payload.periods[0].adjusted_ebitda = 0
    payload.periods[0].reported_ebitda = None
    payload.periods[0].adjustments = None
    result = calculate_model(payload)
    assert result.periods[0].gross_leverage is None
    assert result.periods[0].net_leverage is None
    assert result.status == "partial"
    assert any("adjusted EBITDA is zero" in gap for gap in result.gaps)
    with pytest.raises(ValidationError):
        ModelPeriodInput(
            period_key="FY2026", label="bad", kind="actual",
            adjusted_ebitda=float("nan"), authority=AUTHORITY,
        )


@pytest.mark.parametrize(
    ("repayments", "pik_rate", "gap_fragment"),
    [
        (10, 2.1, "PIK roll-forward denominator is not positive"),
        (300, 0, "negative base closing balance"),
    ],
)
def test_forecast_rollforward_never_publishes_negative_debt_as_ready(
    repayments: float,
    pik_rate: float,
    gap_fragment: str,
) -> None:
    payload = _payload()
    point = payload.debt_instruments[0].periods[0]
    point.repayments = repayments
    point.pik_rate = pik_rate

    result = calculate_model(payload)
    instrument = result.periods[0].instruments[0]

    assert result.status == "partial"
    assert instrument.closing_balance is None
    assert instrument.average_balance is None
    assert instrument.debt_reporting_currency is None
    assert result.periods[0].total_debt is None
    assert any(gap_fragment in gap for gap in result.gaps)


def test_non_positive_ebitda_makes_credit_ratios_not_meaningful() -> None:
    payload = _payload()
    payload.periods[0].adjusted_ebitda = -10

    result = calculate_model(payload)
    period = result.periods[0]

    assert result.status == "partial"
    assert period.gross_leverage is None
    assert period.net_leverage is None
    assert period.interest_coverage is None
    assert any("leverage is not meaningful" in gap for gap in result.gaps)
    assert any("interest coverage is not meaningful" in gap for gap in result.gaps)


@pytest.mark.parametrize(
    ("rate_type", "missing_field"),
    [
        ("floating", "benchmark_rate"),
        ("floating", "spread_rate"),
        ("fixed", "coupon_rate"),
        ("hybrid", "coupon_rate"),
    ],
)
def test_rate_type_missing_inputs_emit_named_gaps(
    rate_type: str,
    missing_field: str,
) -> None:
    payload = _payload()
    instrument = payload.debt_instruments[0]
    instrument.rate_type = rate_type
    setattr(instrument.periods[0], missing_field, None)

    result = calculate_model(payload)

    assert result.status == "partial"
    assert any(f"missing debt input {missing_field}" in gap for gap in result.gaps)


def test_fixed_and_floating_rate_types_do_not_double_count_interest() -> None:
    floating_payload = _payload()
    floating_payload.debt_instruments[0].rate_type = "floating"
    floating = calculate_model(floating_payload).periods[0].instruments[0]
    assert floating.benchmark_interest == pytest.approx(9.75)
    assert floating.margin_interest == pytest.approx(5.85)
    assert floating.coupon_interest == 0

    fixed_payload = _payload()
    fixed_payload.debt_instruments[0].rate_type = "fixed"
    fixed = calculate_model(fixed_payload).periods[0].instruments[0]
    assert fixed.benchmark_interest == 0
    assert fixed.margin_interest == 0
    assert fixed.coupon_interest == pytest.approx(1.95)


def test_same_currency_fx_defaults_to_one_but_cross_currency_fx_is_required() -> None:
    same_currency = _payload()
    same_currency.debt_instruments[0].periods[0].fx_rate = None
    same_result = calculate_model(same_currency)
    same_instrument = same_result.periods[0].instruments[0]
    assert same_result.status == "ready"
    assert same_instrument.debt_reporting_currency == 190
    fx_node = next(
        node
        for node in same_result.periods[0].nodes
        if node.node_id == "debt:tlb-1:FY2026:fx_rate"
    )
    assert fx_node.value == 1
    assert fx_node.formula == "1 when instrument currency equals reporting currency"

    cross_currency = _payload()
    cross_currency.debt_instruments[0].currency = "EUR"
    cross_currency.debt_instruments[0].periods[0].fx_rate = None
    cross_result = calculate_model(cross_currency)
    assert cross_result.status == "partial"
    assert cross_result.periods[0].instruments[0].debt_reporting_currency is None
    assert any("EUR/USD conversion" in gap for gap in cross_result.gaps)


def test_forecast_rollforward_and_closing_override_propagate_across_periods() -> None:
    payload = _payload(overrides=[CellOverride(
        node_id="debt:tlb-1:FY2026:closing_balance",
        value_type="number",
        value=180,
        reason="Refinancing case",
        source="scenario-fixture",
        expires_at=DERIVED_EXPIRY,
    )])
    payload.periods.append(ModelPeriodInput(
        period_key="FY2027",
        label="FY27e",
        kind="forecast",
        revenue=850,
        reported_ebitda=115,
        adjustments=5,
        cash=25,
        taxes=6,
        capex=12,
        working_capital_change=-1,
        other_cash_flow=0,
        authority=AUTHORITY,
    ))
    payload.debt_instruments[0].periods.append(DebtPeriod(
        period_key="FY2027",
        opening_balance=190,
        closing_balance=170,
        draws=0,
        repayments=20,
        scheduled_amortization=0,
        commitment=220,
        benchmark_rate=0.04,
        floor_rate=None,
        spread_rate=0.03,
        coupon_rate=0.01,
        commitment_fee_rate=0.005,
        pik_rate=0,
        cash_fees=1,
        hedge_effect=0,
        fx_rate=1,
    ))

    result = calculate_model(payload)
    first, second = result.periods

    assert first.instruments[0].closing_balance == 180
    assert first.total_debt == 180
    assert second.instruments[0].opening_balance == 180
    assert second.instruments[0].closing_balance == 160
    assert second.total_debt == 160
    opening_node = next(
        node
        for node in second.nodes
        if node.node_id == "debt:tlb-1:FY2027:opening_balance"
    )
    assert opening_node.original_value == 180
    assert opening_node.formula == "FY2026.closing_balance"
    assert any("supplied opening balance" in warning for warning in result.warnings)


def test_debt_derived_overrides_are_nodes_and_recompute_aggregates() -> None:
    payload = _payload(overrides=[
        CellOverride(
            node_id="debt:tlb-1:FY2026:benchmark_interest",
            value_type="number",
            value=20,
            reason="Swap curve stress",
            source="scenario-fixture",
            expires_at=DERIVED_EXPIRY,
        ),
        CellOverride(
            node_id="debt:tlb-1:FY2026:debt_reporting_currency",
            value_type="number",
            value=250,
            reason="FX stress",
            source="scenario-fixture",
            expires_at=DERIVED_EXPIRY,
        ),
    ])

    result = calculate_model(payload)
    period = result.periods[0]
    instrument = period.instruments[0]
    assert instrument.benchmark_interest == 20
    assert instrument.cash_interest == pytest.approx(28.425)
    assert period.cash_interest == pytest.approx(28.425)
    assert period.total_debt == 250
    assert period.gross_leverage == pytest.approx(250 / 110)
    benchmark_node = next(
        node
        for node in period.nodes
        if node.node_id == "debt:tlb-1:FY2026:benchmark_interest"
    )
    assert benchmark_node.original_value == pytest.approx(9.75)
    assert benchmark_node.formula is not None
    assert benchmark_node.overridden is True


def test_null_debt_override_propagates_instead_of_becoming_zero() -> None:
    result = calculate_model(_payload(overrides=[CellOverride(
        node_id="debt:tlb-1:FY2026:benchmark_interest",
        value_type="null",
        reason="Rate evidence unavailable",
        source="scenario-fixture",
        expires_at=DERIVED_EXPIRY,
    )]))

    instrument = result.periods[0].instruments[0]
    assert instrument.benchmark_interest is None
    assert instrument.cash_interest is None
    assert result.periods[0].cash_interest is None
    assert result.status == "partial"


def test_unknown_override_targets_and_naive_expiry_are_rejected() -> None:
    unknown = CellOverride(
        node_id="debt:tlb-1:FY2026:not_a_real_cell",
        value_type="number",
        value=1,
        reason="Invalid target",
    )
    with pytest.raises(ValidationError, match="override targets do not exist"):
        _payload(overrides=[unknown])

    with pytest.raises(ValidationError, match="timezone"):
        CellOverride(
            node_id="input:FY2026:cash",
            value_type="number",
            value=10,
            expires_at=datetime(2027, 1, 1),
        )


def test_extreme_values_are_rejected_before_float_overflow() -> None:
    assert is_finite_number(10**10_000) is False
    with pytest.raises(ValidationError):
        ModelPeriodInput(
            period_key="FY2026",
            label="overflow",
            kind="forecast",
            adjusted_ebitda=1e308,
            authority=AUTHORITY,
        )


def test_monetary_identity_is_explicit_supported_and_never_defaulted() -> None:
    base = _payload().model_dump(mode="json")
    for field_name in ("reporting_currency", "reporting_unit"):
        missing = dict(base)
        missing.pop(field_name)
        with pytest.raises(ValidationError, match=field_name):
            ModelDraftPayload.model_validate(missing)

    with pytest.raises(ValidationError, match="reporting_currency is not supported"):
        ModelDraftPayload.model_validate({**base, "reporting_currency": "ZZZ"})
    with pytest.raises(ValidationError, match="reporting_unit is not supported"):
        ModelDraftPayload.model_validate({**base, "reporting_unit": "trillions"})

    normalized = ModelDraftPayload.model_validate({
        **base,
        "reporting_currency": "gbp",
        "reporting_unit": "THOUSANDS",
    })
    assert normalized.reporting_currency == "GBP"
    assert normalized.reporting_unit == "thousands"


def test_zero_cash_interest_marks_coverage_undefined() -> None:
    result = calculate_model(_payload(overrides=[CellOverride(
        node_id="debt:tlb-1:FY2026:cash_interest",
        value_type="number",
        value=0,
        reason="Interest holiday",
        source="scenario-fixture",
        expires_at=DERIVED_EXPIRY,
    )]))

    assert result.periods[0].cash_interest == 0
    assert result.periods[0].interest_coverage is None
    assert result.status == "partial"
    assert any("cash interest is zero" in gap for gap in result.gaps)


def test_negative_explicit_cash_interest_degrades_fcf_and_coverage() -> None:
    payload = _payload()
    payload.debt_instruments = []
    payload.periods[0].total_debt = 190
    payload.periods[0].cash_interest = -10

    result = calculate_model(payload)
    period = result.periods[0]

    assert result.status == "partial"
    assert period.cash_interest is None
    assert period.interest_coverage is None
    assert period.free_cash_flow is None
    assert any(
        "calc:FY2026:cash_interest: cash interest must be a non-negative expense" in gap
        for gap in result.gaps
    )


def test_negative_derived_cash_interest_override_degrades_downstream() -> None:
    payload = _payload(overrides=[CellOverride(
        node_id="calc:FY2026:cash_interest",
        value_type="number",
        value=-10,
        reason="Adversarial sign regression",
        source="test-suite",
        expires_at=DERIVED_EXPIRY,
    )])

    result = calculate_model(payload)
    period = result.periods[0]
    node = next(
        item for item in period.nodes
        if item.node_id == "calc:FY2026:cash_interest"
    )

    assert result.status == "partial"
    assert node.overridden is True
    assert node.original_value == pytest.approx(18.175)
    assert node.value is None
    assert period.cash_interest is None
    assert period.interest_coverage is None
    assert period.free_cash_flow is None


def test_negative_debt_schedule_cash_interest_degrades_downstream() -> None:
    payload = _payload()
    payload.debt_instruments[0].periods[0].hedge_effect = -100

    result = calculate_model(payload)
    period = result.periods[0]
    instrument = period.instruments[0]

    assert result.status == "partial"
    assert instrument.cash_interest is None
    assert period.cash_interest is None
    assert period.interest_coverage is None
    assert period.free_cash_flow is None
    assert any(
        "debt:tlb-1:FY2026:cash_interest: cash interest must be a non-negative expense" in gap
        for gap in result.gaps
    )


def test_derived_override_requires_complete_governance_and_duplicate_nodes_fail() -> None:
    with pytest.raises(ValidationError, match="reason"):
        CellOverride(
            node_id="calc:FY2026:net_leverage",
            value_type="number",
            value=5.5,
        )
    with pytest.raises(ValidationError, match="source"):
        CellOverride(
            node_id="calc:FY2026:net_leverage",
            value_type="number",
            value=5.5,
            reason="Governance fixture",
            expires_at=DERIVED_EXPIRY,
        )
    with pytest.raises(ValidationError, match="expiry"):
        CellOverride(
            node_id="calc:FY2026:net_leverage",
            value_type="number",
            value=5.5,
            reason="Governance fixture",
            source="test-source",
        )
    one = CellOverride(
        node_id="input:FY2026:cash", value_type="number", value=25, reason="one"
    )
    with pytest.raises(ValidationError):
        ModelDraftPayload(
            reporting_currency="USD",
            reporting_unit="millions",
            periods=_payload().periods,
            debt_instruments=_payload().debt_instruments,
            overrides=[one, one],
        )


def test_model_periods_must_be_chronological_before_rollforward() -> None:
    base = _payload()
    fy2026 = base.periods[0]
    fy2027 = fy2026.model_copy(update={
        "period_key": "FY2027",
        "label": "FY27e",
    })

    with pytest.raises(ValidationError, match="canonical chronological order"):
        ModelDraftPayload(
            reporting_currency="USD",
            reporting_unit="millions",
            periods=[fy2027, fy2026],
            debt_instruments=[],
            source_ids=["run-1"],
        )


def test_same_end_comparison_shapes_keep_independent_debt_rows_and_months() -> None:
    period_specs = (
        ("Q4-2026", "Q4 2026", 3),
        ("YTD-Q4-2026", "YTD Q4 2026", 12),
        ("LTM-2026-12-31", "LTM Dec-26", 12),
        ("FY2026", "FY2026", 12),
    )
    periods = [
        ModelPeriodInput(
            period_key=period_key,
            label=label,
            kind="forecast",
            months=months,
            revenue=500,
            adjusted_ebitda=100,
            cash=20,
            taxes=0,
            capex=0,
            working_capital_change=0,
            other_cash_flow=0,
            authority=AUTHORITY,
        )
        for period_key, label, months in period_specs
    ]
    debt_periods = [
        DebtPeriod(
            period_key=period_key,
            opening_balance=200,
            closing_balance=190,
            draws=0,
            repayments=10,
            scheduled_amortization=0,
            commitment=220,
            benchmark_rate=0.04,
            floor_rate=0.05,
            spread_rate=0.03,
            coupon_rate=0,
            commitment_fee_rate=0,
            pik_rate=0,
            cash_fees=0,
            hedge_effect=0,
            fx_rate=1,
        )
        for period_key, _label, _months in period_specs
    ]
    payload = ModelDraftPayload(
        reporting_currency="USD",
        reporting_unit="millions",
        periods=periods,
        debt_instruments=[DebtInstrument(
            instrument_id="same-end-tlb",
            name="Same-end comparison term loan",
            priority=1,
            seniority="1L",
            currency="USD",
            rate_type="floating",
            authority=AUTHORITY,
            periods=debt_periods,
        )],
    )

    result = calculate_model(payload)

    assert result.status == "ready"
    assert [
        period.instruments[0].opening_balance for period in result.periods
    ] == [200, 200, 200, 200]
    assert result.periods[0].cash_interest == pytest.approx(3.9)
    assert [
        period.cash_interest for period in result.periods[1:]
    ] == pytest.approx([15.6, 15.6, 15.6])
    assert not any("supplied opening balance" in item for item in result.warnings)


def test_model_complexity_rejects_an_oversized_debt_period_matrix() -> None:
    base = _payload()
    periods = [
        base.periods[0].model_copy(update={
            "period_key": f"FY{2026 + index}",
            "label": f"FY{26 + index}e",
        })
        for index in range(40)
    ]
    instruments = [
        base.debt_instruments[0].model_copy(update={
            "instrument_id": f"tlb-{index}",
            "periods": [],
        })
        for index in range(100)
    ]

    with pytest.raises(ValidationError, match="instrument-period complexity"):
        ModelDraftPayload(
            reporting_currency="USD",
            reporting_unit="millions",
            periods=periods,
            debt_instruments=instruments,
            source_ids=["run-1"],
        )


def test_source_ids_and_ui_preferences_honor_workbook_roundtrip_bounds() -> None:
    with pytest.raises(ValidationError, match="source IDs"):
        ModelAuthority(
            origin="analyst",
            method="test",
            source_ids=["s" * 241],
        )

    with pytest.raises(ValidationError, match="workbook cell contract"):
        ModelDraftPayload.model_validate({
            **_payload().model_dump(mode="json"),
            "ui_preferences": {
                "collapsed_rows": [
                    f"row-{index}-{'x' * 25}" for index in range(300)
                ]
            },
        })

    payload = ModelDraftPayload.model_validate({
        **_payload().model_dump(mode="json"),
        "ui_preferences": {
            "collapsed_rows": [f"row-{index}" for index in range(100)]
        },
    })
    assert len(payload.ui_preferences.collapsed_rows) == 100


def test_override_replacement_revalidates_the_maximum_collection_bound() -> None:
    periods = [
        ModelPeriodInput(
            period_key=f"FY{2026 + period_index}",
            label=f"FY{26 + period_index}e",
            kind="forecast",
            authority=AUTHORITY,
        )
        for period_index in range(50)
    ]
    instruments = [
        DebtInstrument(
            instrument_id=f"tlb-{instrument_index}",
            name=f"Term loan {instrument_index}",
            priority=instrument_index,
            seniority="1L",
            currency="USD",
            authority=AUTHORITY,
            periods=[
                DebtPeriod(period_key=period.period_key) for period in periods
            ],
        )
        for instrument_index in range(40)
    ]
    debt_fields = (
        "opening_balance", "closing_balance", "draws", "repayments",
        "scheduled_amortization", "commitment", "benchmark_rate", "floor_rate",
        "spread_rate", "coupon_rate", "commitment_fee_rate", "pik_rate",
        "cash_fees", "hedge_effect", "fx_rate",
    )
    candidate_nodes = [
        f"debt:{instrument.instrument_id}:{period.period_key}:{field_name}"
        for instrument in instruments
        for period in periods
        for field_name in debt_fields
    ]
    overrides = [
        CellOverride(
            node_id=node_id,
            value_type="null",
            reason="Capacity fixture",
            source="test-source",
            expires_at=DERIVED_EXPIRY,
        )
        for node_id in candidate_nodes[:10_000]
    ]
    payload = ModelDraftPayload(
        reporting_currency="USD",
        reporting_unit="millions",
        periods=periods,
        debt_instruments=instruments,
        overrides=overrides,
    )

    with pytest.raises(ValueError, match="Model override capacity reached"):
        replace_active_override(
            payload,
            CellOverride(
                node_id=candidate_nodes[10_000],
                value_type="null",
                reason="Capacity fixture",
                source="test-source",
                expires_at=DERIVED_EXPIRY,
            ),
        )


def test_cp1_binder_is_partial_and_never_invents_debt() -> None:
    run = SimpleNamespace(
        id="run-live", status="complete", as_of_date="2026-03-31"
    )
    cp1 = SimpleNamespace(
        id="cp1-live",
        run_id="run-live",
        module_id="CP-1",
        limitation_flags=[],
        runtime_output={"currency": "USD", "reporting_unit": "millions", "normalized_financials": {
            "revenue": {"FY2025": 900, "LTM_Q1_26": 950},
            "adj_ebitda": {"FY2025": 120, "LTM_Q1_26": 125},
            "net_debt_ltm": 500,
            "interest_coverage_ltm": 2.5,
        }},
    )
    payload = payload_from_cp1(
        run, cp1, reporting_profile=_reporting_profile()
    )
    assert payload.debt_instruments == []
    assert payload.periods[0].period_key == "LTM-2026-03-31"
    assert payload.periods[0].kind == "ltm"
    assert payload.periods[0].cash_interest == 50
    calculation = calculate_model(payload)
    assert calculation.status == "partial"
    assert calculation.periods[0].total_debt is None


def test_cp1_binder_ranks_effective_period_before_ltm_shape() -> None:
    run = SimpleNamespace(
        id="run-period-rank", status="complete", as_of_date="2026-07-14"
    )
    cp1 = SimpleNamespace(
        id="cp1-period-rank",
        run_id=run.id,
        module_id="CP-1",
        limitation_flags=[],
        runtime_output={"currency": "USD", "reporting_unit": "millions", "normalized_financials": {
            "revenue": {"LTM_Q4_23": 100, "FY2025": 200},
            "adj_ebitda": {"LTM_Q4_23": 10, "FY2025": 20},
            "net_debt_ltm": 50,
            "interest_coverage_ltm": 2,
        }},
    )

    payload = payload_from_cp1(
        run, cp1, reporting_profile=_reporting_profile()
    )
    period = payload.periods[0]
    assert period.period_key == "FY2025"
    assert period.kind == "actual"
    assert period.months == 12
    assert period.revenue == 200
    assert period.adjusted_ebitda == 20
    assert period.net_debt is None
    assert period.cash_interest is None


def test_cp1_binder_never_combines_metrics_from_different_periods() -> None:
    run = SimpleNamespace(
        id="run-period-match", status="complete", as_of_date="2026-07-14"
    )
    cp1 = SimpleNamespace(
        id="cp1-period-match",
        run_id=run.id,
        module_id="CP-1",
        limitation_flags=[],
        runtime_output={"currency": "USD", "reporting_unit": "millions", "normalized_financials": {
            "revenue": {"FY2025": 900},
            "adj_ebitda": {"LTM_Q1_26": 100},
            "net_debt_ltm": 400,
            "interest_coverage_ltm": 2,
        }},
    )

    payload = payload_from_cp1(
        run, cp1, reporting_profile=_reporting_profile()
    )
    period = payload.periods[0]
    assert period.period_key == "LTM-2026-03-31"
    assert period.kind == "ltm"
    assert period.revenue is None
    assert period.adjusted_ebitda == 100
    assert period.net_debt == 400
    assert period.cash_interest == 50


def test_cp1_binder_uses_run_as_of_only_for_an_explicit_undated_ltm() -> None:
    run = SimpleNamespace(
        id="run-undated-ltm", status="complete", as_of_date="2026-03-31"
    )
    cp1 = SimpleNamespace(
        id="cp1-undated-ltm",
        run_id=run.id,
        module_id="CP-1",
        limitation_flags=[],
        runtime_output={"currency": "USD", "reporting_unit": "millions", "normalized_financials": {
            "revenue": {"FY2025": 900, "LTM": 950},
            "adj_ebitda": {"FY2025": 95, "LTM": 100},
            "net_debt_ltm": 400,
            "interest_coverage_ltm": 2,
        }},
    )

    period = payload_from_cp1(run, cp1).periods[0]
    assert period.period_key == "LTM-2026-03-31"
    assert period.label == "LTM"
    assert period.revenue == 950
    assert period.adjusted_ebitda == 100


def test_cp1_binder_accepts_bare_ltm_only_with_a_valid_run_as_of() -> None:
    run = SimpleNamespace(
        id="run-bare-ltm", status="complete", as_of_date="2025-09-30"
    )
    cp1 = SimpleNamespace(
        id="cp1-bare-ltm",
        run_id=run.id,
        module_id="CP-1",
        limitation_flags=[],
        runtime_output={"currency": "USD", "reporting_unit": "millions", "normalized_financials": {
            "revenue": {"LTM": 800},
            "adj_ebitda": {"LTM": 80},
        }},
    )

    period = payload_from_cp1(run, cp1).periods[0]
    assert period.period_key == "LTM-2025-09-30"
    assert period.kind == "ltm"


def test_cp1_binder_maps_gbp_symbol_and_explicit_unit() -> None:
    run = SimpleNamespace(
        id="run-gbp", status="complete", as_of_date="2026-03-31"
    )
    cp1 = SimpleNamespace(
        id="cp1-gbp",
        run_id=run.id,
        module_id="CP-1",
        limitation_flags=[],
        runtime_output={
            "currency": "£",
            "reporting_unit": "£M",
            "normalized_financials": {
                "revenue": {"FY2025": 900},
                "adj_ebitda": {"FY2025": 100},
            },
        },
    )

    payload = payload_from_cp1(
        run, cp1, reporting_profile=_reporting_profile()
    )

    assert payload.reporting_currency == "GBP"
    assert payload.reporting_unit == "millions"
    assert payload.periods[0].period_key == "FY2025"


@pytest.mark.parametrize("currency", [None, "XYZ", ""])
def test_cp1_binder_degrades_missing_or_unsupported_currency(currency) -> None:
    run = SimpleNamespace(
        id="run-currency-gap", status="complete", as_of_date="2026-03-31"
    )
    runtime_output = {
        "normalized_financials": {
            "revenue": {"FY2025": 900},
            "adj_ebitda": {"FY2025": 100},
        },
    }
    if currency is not None:
        runtime_output["currency"] = currency
    cp1 = SimpleNamespace(
        id="cp1-currency-gap",
        run_id=run.id,
        module_id="CP-1",
        limitation_flags=[],
        runtime_output=runtime_output,
    )

    with pytest.raises(ModelSourceError, match="reporting currency"):
        payload_from_cp1(
            run, cp1, reporting_profile=_reporting_profile()
        )


@pytest.mark.parametrize("reporting_unit", [None, "", "unknown"])
def test_cp1_binder_degrades_missing_or_unsupported_reporting_unit(
    reporting_unit,
) -> None:
    run = SimpleNamespace(
        id="run-unit-gap", status="complete", as_of_date="2026-03-31"
    )
    runtime_output = {
        "currency": "GBP",
        "normalized_financials": {
            "revenue": {"FY2025": 900},
            "adj_ebitda": {"FY2025": 100},
        },
    }
    if reporting_unit is not None:
        runtime_output["reporting_unit"] = reporting_unit
    cp1 = SimpleNamespace(
        id="cp1-unit-gap",
        run_id=run.id,
        module_id="CP-1",
        limitation_flags=[],
        runtime_output=runtime_output,
    )

    with pytest.raises(ModelSourceError, match="reporting unit"):
        payload_from_cp1(
            run, cp1, reporting_profile=_reporting_profile()
        )


def test_cp1_binder_degrades_explicit_null_reporting_unit() -> None:
    run = SimpleNamespace(
        id="run-unit-null", status="complete", as_of_date="2026-03-31"
    )
    cp1 = SimpleNamespace(
        id="cp1-unit-null",
        run_id=run.id,
        module_id="CP-1",
        limitation_flags=[],
        runtime_output={
            "currency": "GBP",
            "reporting_unit": None,
            "normalized_financials": {
                "revenue": {"FY2025": 900},
                "adj_ebitda": {"FY2025": 100},
            },
        },
    )

    with pytest.raises(ModelSourceError, match="reporting unit is invalid"):
        payload_from_cp1(
            run, cp1, reporting_profile=_reporting_profile()
        )


def test_cp1_binder_rejects_conflicting_reporting_unit_fields() -> None:
    run = SimpleNamespace(
        id="run-unit-conflict", status="complete", as_of_date="2026-03-31"
    )
    cp1 = SimpleNamespace(
        id="cp1-unit-conflict",
        run_id=run.id,
        module_id="CP-1",
        limitation_flags=[],
        runtime_output={
            "currency": "GBP",
            "reporting_unit": "millions",
            "unit": "billions",
            "normalized_financials": {
                "revenue": {"FY2025": 900},
                "adj_ebitda": {"FY2025": 100},
            },
        },
    )

    with pytest.raises(ModelSourceError, match="reporting unit fields conflict"):
        payload_from_cp1(
            run, cp1, reporting_profile=_reporting_profile()
        )


def test_cp1_binder_does_not_fabricate_relative_dates_without_profile() -> None:
    run = SimpleNamespace(
        id="run-profile-gap", status="complete", as_of_date="2026-03-31"
    )
    cp1 = SimpleNamespace(
        id="cp1-profile-gap",
        run_id=run.id,
        module_id="CP-1",
        limitation_flags=[],
        runtime_output={
            "currency": "USD",
            "reporting_unit": "millions",
            "normalized_financials": {
                "revenue": {"FY2025": 900},
                "adj_ebitda": {"Q4 FY2025": 100},
            },
        },
    )

    with pytest.raises(ModelSourceError, match="no canonical reported financial period"):
        payload_from_cp1(run, cp1)


@pytest.mark.parametrize(
    ("month", "day", "expected_key"),
    [
        (1, 31, "2026-04-30"),
        (6, 30, "2026-09-30"),
        (9, 30, "2026-12-31"),
    ],
)
def test_cp1_binder_orders_non_calendar_fiscal_periods(
    month: int,
    day: int,
    expected_key: str,
) -> None:
    run = SimpleNamespace(
        id=f"run-fiscal-{month}", status="complete", as_of_date="2027-01-31"
    )
    cp1 = SimpleNamespace(
        id=f"cp1-fiscal-{month}",
        run_id=run.id,
        module_id="CP-1",
        limitation_flags=[],
        runtime_output={
            "currency": "EUR",
            "reporting_unit": "millions",
            "normalized_financials": {
                "revenue": {
                    "Q3 FY2026": 800,
                    "FY2026": 900,
                    "Q1 FY2027": 250,
                },
                "adj_ebitda": {
                    "Q3 FY2026": 80,
                    "FY2026": 90,
                    "Q1 FY2027": 25,
                },
            },
        },
    )

    period = payload_from_cp1(
        run,
        cp1,
        reporting_profile=_reporting_profile(month, day),
    ).periods[0]

    assert period.period_key == expected_key
    assert period.label == "Q1 FY2027"
    assert period.months == 3


def test_cp1_binder_rejects_non_reference_demo_fixture_marker() -> None:
    from engine.fixtures import DEMO_FIXTURE_LIMITATION

    run = SimpleNamespace(id="run-demo", status="complete", as_of_date="2026-03-31")
    cp1 = SimpleNamespace(
        id="cp1-demo", run_id="run-demo", module_id="CP-1",
        limitation_flags=[DEMO_FIXTURE_LIMITATION], runtime_output={},
    )
    with pytest.raises(ModelSourceError, match="demo-fixture"):
        payload_from_cp1(run, cp1)
