"""Route-independent binders and mutation helpers for Model Engine v2."""

from __future__ import annotations

import hashlib
import json
import re
from calendar import monthrange
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any, Optional

from database import IssuerReportingProfile, ModelCheckpoint, ModuleOutput, Run
from engine.fixtures import DEMO_FIXTURE_LIMITATION
from model_engine_v2 import (
    MAX_MODEL_OVERRIDES,
    CellOverride,
    ModelAuthority,
    ModelCalculation,
    ModelDraftPayload,
    ModelPeriodInput,
    calculate_model,
    is_finite_number,
)


class ModelSourceError(ValueError):
    pass


class ModelCheckpointError(ValueError):
    pass


_CP1_CURRENCY_ALIASES = {
    "$": "USD",
    "US$": "USD",
    "USD": "USD",
    "£": "GBP",
    "GBP": "GBP",
    "€": "EUR",
    "EUR": "EUR",
    "C$": "CAD",
    "CAD": "CAD",
    "A$": "AUD",
    "AUD": "AUD",
    "NZD": "NZD",
    "CHF": "CHF",
    "JPY": "JPY",
    "SEK": "SEK",
    "NOK": "NOK",
    "DKK": "DKK",
}
_CP1_UNIT_ALIASES = {
    "M": "millions",
    "MM": "millions",
    "MILLION": "millions",
    "MILLIONS": "millions",
    "$M": "millions",
    "£M": "millions",
    "€M": "millions",
    "K": "thousands",
    "THOUSAND": "thousands",
    "THOUSANDS": "thousands",
    "BN": "billions",
    "BILLION": "billions",
    "BILLIONS": "billions",
    "UNIT": "units",
    "UNITS": "units",
}


@dataclass(frozen=True)
class _DisclosurePeriod:
    source_label: str
    period_key: str
    kind: str
    months: int
    effective_end: date


def _year(value: str) -> int:
    year = int(value)
    return year + 2000 if year < 100 else year


def _add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    source_month_end = value.day == monthrange(value.year, value.month)[1]
    target_month_end = monthrange(year, month)[1]
    day = target_month_end if source_month_end else min(value.day, target_month_end)
    return date(year, month, day)


def _profile_fiscal_year_end(
    reporting_profile: Optional[IssuerReportingProfile],
) -> Optional[tuple[int, int]]:
    if reporting_profile is None:
        return None
    month = getattr(reporting_profile, "fiscal_year_end_month", None)
    day = getattr(reporting_profile, "fiscal_year_end_day", None)
    if (
        isinstance(month, bool)
        or isinstance(day, bool)
        or not isinstance(month, int)
        or not isinstance(day, int)
        or month < 1
        or month > 12
        or day < 1
        or day > monthrange(2000, month)[1]
    ):
        return None
    return month, day


def _fiscal_year_end_date(year: int, fiscal_year_end: tuple[int, int]) -> date:
    month, day = fiscal_year_end
    return date(year, month, min(day, monthrange(year, month)[1]))


def _fiscal_quarter_end(
    fiscal_year: int,
    quarter: int,
    fiscal_year_end: tuple[int, int],
) -> date:
    previous_year_end = _fiscal_year_end_date(fiscal_year - 1, fiscal_year_end)
    return _add_months(previous_year_end, quarter * 3)


def _actual_period_key(
    legacy_key: str,
    effective_end: date,
    fiscal_year_end: tuple[int, int],
) -> str:
    # Preserve existing stable keys for calendar reporters. Non-calendar
    # periods use their actual effective end so engine chronology stays true.
    return legacy_key if fiscal_year_end == (12, 31) else effective_end.isoformat()


def _cp1_reporting_currency(runtime: dict) -> str:
    raw = runtime.get("currency")
    if not isinstance(raw, str) or not raw.strip():
        raise ModelSourceError("CP-1 reporting currency is missing.")
    normalized = _CP1_CURRENCY_ALIASES.get(raw.strip().upper())
    if normalized is None:
        raise ModelSourceError("CP-1 reporting currency is unsupported.")
    return normalized


def _cp1_reporting_unit(runtime: dict) -> str:
    explicit = [runtime[key] for key in ("reporting_unit", "unit") if key in runtime]
    if not explicit:
        raise ModelSourceError("CP-1 reporting unit is missing.")
    normalized: set[str] = set()
    for raw in explicit:
        if not isinstance(raw, str) or not raw.strip():
            raise ModelSourceError("CP-1 reporting unit is invalid.")
        unit = _CP1_UNIT_ALIASES.get(raw.strip().upper())
        if unit is None:
            raise ModelSourceError("CP-1 reporting unit is unsupported.")
        normalized.add(unit)
    if len(normalized) != 1:
        raise ModelSourceError("CP-1 reporting unit fields conflict.")
    return normalized.pop()


def _disclosure_period(
    raw_label: str,
    *,
    undated_ltm_end: Optional[date] = None,
    fiscal_year_end: Optional[tuple[int, int]] = None,
) -> Optional[_DisclosurePeriod]:
    label = raw_label.strip()
    upper = label.upper()
    iso_match = re.search(r"(\d{4})[-_/](\d{1,2})[-_/](\d{1,2})", upper)
    if iso_match:
        try:
            effective_end = date(*map(int, iso_match.groups()))
        except ValueError:
            return None
        is_ltm = upper.startswith("LTM")
        ytd_quarter = re.search(r"YTD.*?Q([1-4])", upper)
        is_quarter = re.search(r"(?:^|[^A-Z])Q([1-4])", upper)
        return _DisclosurePeriod(
            source_label=label,
            period_key=(
                f"LTM-{effective_end.isoformat()}"
                if is_ltm
                else effective_end.isoformat()
            ),
            kind="ltm" if is_ltm else "actual",
            months=(
                12 if is_ltm
                else int(ytd_quarter.group(1)) * 3 if ytd_quarter
                else 3 if is_quarter
                else 12
            ),
            effective_end=effective_end,
        )
    ytd = re.search(r"YTD.*?Q([1-4]).*?(\d{2,4})(?!.*\d)", upper)
    if ytd:
        if fiscal_year_end is None:
            return None
        quarter, year = int(ytd.group(1)), _year(ytd.group(2))
        effective_end = _fiscal_quarter_end(year, quarter, fiscal_year_end)
        return _DisclosurePeriod(
            label,
            _actual_period_key(
                f"YTD-Q{quarter}-{year}", effective_end, fiscal_year_end
            ),
            "actual",
            quarter * 3,
            effective_end,
        )
    ltm = re.search(r"LTM.*?Q([1-4]).*?(\d{2,4})(?!.*\d)", upper)
    if ltm:
        if fiscal_year_end is None:
            return None
        quarter, year = int(ltm.group(1)), _year(ltm.group(2))
        effective_end = _fiscal_quarter_end(year, quarter, fiscal_year_end)
        return _DisclosurePeriod(
            label, f"LTM-{effective_end.isoformat()}", "ltm", 12,
            effective_end,
        )
    if upper == "LTM" and undated_ltm_end is not None:
        return _DisclosurePeriod(
            label,
            f"LTM-{undated_ltm_end.isoformat()}",
            "ltm",
            12,
            undated_ltm_end,
        )
    quarter_match = re.search(r"Q([1-4]).*?(\d{2,4})(?!.*\d)", upper)
    if quarter_match:
        if fiscal_year_end is None:
            return None
        quarter, year = int(quarter_match.group(1)), _year(quarter_match.group(2))
        effective_end = _fiscal_quarter_end(year, quarter, fiscal_year_end)
        return _DisclosurePeriod(
            label,
            _actual_period_key(
                f"Q{quarter}-{year}", effective_end, fiscal_year_end
            ),
            "actual",
            3,
            effective_end,
        )
    fiscal = re.search(r"(?:FY|FYE)[^0-9]*(\d{2,4})(?!.*\d)", upper)
    if fiscal is None:
        fiscal = re.fullmatch(r"(\d{4})A?", upper)
    if fiscal:
        if fiscal_year_end is None:
            return None
        year = _year(fiscal.group(1))
        effective_end = _fiscal_year_end_date(year, fiscal_year_end)
        return _DisclosurePeriod(
            label,
            _actual_period_key(f"FY{year}", effective_end, fiscal_year_end),
            "actual",
            12,
            effective_end,
        )
    return None


def _period_values(
    series: object,
    *,
    undated_ltm_end: Optional[date],
    fiscal_year_end: Optional[tuple[int, int]],
) -> dict[str, tuple[_DisclosurePeriod, float]]:
    if not isinstance(series, dict):
        return {}
    usable: dict[str, tuple[_DisclosurePeriod, float]] = {}
    for raw_label, raw_value in series.items():
        if not isinstance(raw_label, str) or not is_finite_number(raw_value):
            continue
        period = _disclosure_period(
            raw_label,
            undated_ltm_end=undated_ltm_end,
            fiscal_year_end=fiscal_year_end,
        )
        if period is None:
            continue
        candidate = (period, float(raw_value))
        identity = f"{period.period_key}|{period.kind}|{period.months}"
        current = usable.get(identity)
        if current is None or period.source_label > current[0].source_label:
            usable[identity] = candidate
    return usable


def _select_disclosure_period(
    revenue_series: object,
    ebitda_series: object,
    *,
    undated_ltm_end: Optional[date],
    fiscal_year_end: Optional[tuple[int, int]],
) -> tuple[_DisclosurePeriod, Optional[float], Optional[float]]:
    revenue = _period_values(
        revenue_series,
        undated_ltm_end=undated_ltm_end,
        fiscal_year_end=fiscal_year_end,
    )
    ebitda = _period_values(
        ebitda_series,
        undated_ltm_end=undated_ltm_end,
        fiscal_year_end=fiscal_year_end,
    )
    candidates = {
        key: value[0] for key, value in (*revenue.items(), *ebitda.items())
    }
    if not candidates:
        raise ModelSourceError("CP-1 has no canonical reported financial period.")
    # Effective period is authoritative. LTM wins only when two disclosure
    # shapes share the same end date; broader spans then provide a stable tie.
    selected_identity, selected = max(
        candidates.items(),
        key=lambda pair: (
            pair[1].effective_end,
            pair[1].kind == "ltm",
            pair[1].months,
            pair[1].period_key,
        ),
    )
    revenue_point = revenue.get(selected_identity)
    ebitda_point = ebitda.get(selected_identity)
    label_source = ebitda_point or revenue_point
    assert label_source is not None
    selected = _DisclosurePeriod(
        source_label=label_source[0].source_label,
        period_key=selected.period_key,
        kind=selected.kind,
        months=selected.months,
        effective_end=selected.effective_end,
    )
    return (
        selected,
        revenue_point[1] if revenue_point else None,
        ebitda_point[1] if ebitda_point else None,
    )


def payload_from_cp1(
    run: Run,
    cp1: ModuleOutput,
    *,
    reporting_profile: Optional[IssuerReportingProfile] = None,
) -> ModelDraftPayload:
    """Build the honest, usually partial starting draft from one exact CP-1.

    This binder intentionally does not infer a debt schedule or forecast and
    rejects the non-reference Atlas fixture marker.  Missing inputs remain named
    gaps when the pure engine calculates the payload.
    """

    if run.status != "complete" or cp1.run_id != run.id or cp1.module_id != "CP-1":
        raise ModelSourceError("A completed exact CP-1 output is required.")
    if (
        getattr(cp1, "qa_status", None) == "Blocked"
        or getattr(cp1, "committee_status", None) == "Blocked"
    ):
        raise ModelSourceError("A QA-Blocked CP-1 output cannot seed a live model.")
    if DEMO_FIXTURE_LIMITATION in (cp1.limitation_flags or []):
        raise ModelSourceError("Synthetic demo-fixture financials cannot seed a live model.")
    runtime = cp1.runtime_output if isinstance(cp1.runtime_output, dict) else {}
    normalized = runtime.get("normalized_financials")
    if not isinstance(normalized, dict):
        raise ModelSourceError("CP-1 does not contain normalized financials.")
    reporting_currency = _cp1_reporting_currency(runtime)
    reporting_unit = _cp1_reporting_unit(runtime)
    fiscal_year_end = _profile_fiscal_year_end(reporting_profile)
    as_of: Optional[datetime]
    try:
        as_of = datetime.fromisoformat((run.as_of_date or "").replace("Z", "+00:00"))
        if as_of.tzinfo is None:
            as_of = as_of.replace(tzinfo=timezone.utc)
    except ValueError:
        as_of = None
    period, revenue, adjusted_ebitda = _select_disclosure_period(
        normalized.get("revenue"),
        normalized.get("adj_ebitda"),
        undated_ltm_end=as_of.date() if as_of is not None else None,
        fiscal_year_end=fiscal_year_end,
    )
    net_debt = normalized.get("net_debt_ltm")
    coverage = normalized.get("interest_coverage_ltm")
    if period.kind != "ltm" or not is_finite_number(net_debt):
        net_debt = None
    if (
        period.kind != "ltm"
        or not is_finite_number(coverage)
        or float(coverage) <= 0
    ):
        coverage = None
    cash_interest = (
        float(adjusted_ebitda) / float(coverage)
        if is_finite_number(adjusted_ebitda) and coverage is not None
        else None
    )
    authority = ModelAuthority(
        origin="live",
        method="CP-1 normalized financials",
        source_ids=[run.id, cp1.id],
        as_of=as_of,
    )
    return ModelDraftPayload(
        reporting_currency=reporting_currency,
        reporting_unit=reporting_unit,
        periods=[ModelPeriodInput(
            period_key=period.period_key,
            label=period.source_label,
            kind=period.kind,
            months=period.months,
            revenue=revenue,
            adjusted_ebitda=adjusted_ebitda,
            net_debt=net_debt,
            cash_interest=cash_interest,
            authority=authority,
        )],
        debt_instruments=[],
        source_ids=[run.id, cp1.id],
    )


def calculation_node(calculation: ModelCalculation, node_id: str) -> dict[str, Any]:
    for period in calculation.periods:
        for node in period.nodes:
            if node.node_id == node_id:
                return node.model_dump(mode="json")
    raise ValueError("Override target does not exist in this model calculation.")


def replace_active_override(
    payload: ModelDraftPayload,
    override: CellOverride,
) -> tuple[ModelDraftPayload, Optional[CellOverride]]:
    prior = next((item for item in payload.overrides if item.node_id == override.node_id), None)
    next_overrides = [item for item in payload.overrides if item.node_id != override.node_id]
    next_overrides.append(override)
    next_overrides.sort(key=lambda item: item.node_id)
    if len(next_overrides) > MAX_MODEL_OVERRIDES:
        raise ValueError("Model override capacity reached.")
    value = payload.model_dump(mode="json")
    value["overrides"] = [item.model_dump(mode="json") for item in next_overrides]
    return ModelDraftPayload.model_validate(value), prior


def remove_active_override(
    payload: ModelDraftPayload,
    node_id: str,
) -> tuple[ModelDraftPayload, Optional[CellOverride]]:
    prior = next((item for item in payload.overrides if item.node_id == node_id), None)
    next_overrides = [item for item in payload.overrides if item.node_id != node_id]
    value = payload.model_dump(mode="json")
    value["overrides"] = [item.model_dump(mode="json") for item in next_overrides]
    return ModelDraftPayload.model_validate(value), prior


def model_v2_checkpoint_snapshot(checkpoint: ModelCheckpoint) -> dict:
    """Validate one immutable checkpoint envelope before restore or publication."""
    required = (
        checkpoint.engine_version,
        checkpoint.source_fingerprint,
        checkpoint.input_fingerprint,
        checkpoint.calculation_hash,
        checkpoint.draft_revision,
    )
    frozen = checkpoint.payload if isinstance(checkpoint.payload, dict) else {}
    if not all(value is not None for value in required) or frozen.get("version") != 2:
        raise ModelCheckpointError(
            "Model Engine v2 requires a v2 checkpoint with complete calculation identity."
        )
    canonical = json.dumps(
        frozen, sort_keys=True, separators=(",", ":"), allow_nan=False, default=str
    )
    if not checkpoint.payload_hash or not hashlib.sha256(
        canonical.encode("utf-8")
    ).hexdigest() == checkpoint.payload_hash:
        raise ModelCheckpointError("The model checkpoint payload hash is inconsistent.")
    try:
        draft_payload = ModelDraftPayload.model_validate(frozen.get("payload"))
        stored_calculation = ModelCalculation.model_validate(frozen.get("calculation"))
    except ValueError as exc:
        raise ModelCheckpointError(
            "The selected model checkpoint failed the v2 contract."
        ) from exc
    evaluated_at = checkpoint.created_at
    if evaluated_at.tzinfo is None:
        evaluated_at = evaluated_at.replace(tzinfo=timezone.utc)
    recalculated = calculate_model(draft_payload, evaluated_at=evaluated_at)
    if (
        checkpoint.engine_version != recalculated.engine_version
        or frozen.get("draft_revision") != checkpoint.draft_revision
        or stored_calculation.engine_version != checkpoint.engine_version
        or stored_calculation.source_fingerprint != checkpoint.source_fingerprint
        or stored_calculation.input_fingerprint != checkpoint.input_fingerprint
        or stored_calculation.calculation_hash != checkpoint.calculation_hash
        or recalculated.model_dump(mode="json")
        != stored_calculation.model_dump(mode="json")
    ):
        raise ModelCheckpointError(
            "The selected model checkpoint calculation identity is inconsistent."
        )
    return {
        "engine_version": checkpoint.engine_version,
        "source_fingerprint": checkpoint.source_fingerprint,
        "input_fingerprint": checkpoint.input_fingerprint,
        "calculation_hash": checkpoint.calculation_hash,
        "draft_revision": checkpoint.draft_revision,
        "authority": {
            "origin": (checkpoint.authority or {}).get("origin", "unknown"),
            "model_input_origins": (checkpoint.authority or {}).get(
                "model_input_origins", []
            ),
            "analyst_override": bool(
                (checkpoint.authority or {}).get("analyst_override")
            ),
        },
        "payload": draft_payload.model_dump(mode="json"),
        "calculation": stored_calculation.model_dump(mode="json"),
    }
