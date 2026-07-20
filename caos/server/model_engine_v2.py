"""Pure, deterministic calculation authority for Model Builder v2.

The engine has no database, filesystem, network, or clock side effects.  Routes
own authorization and persistence; this module owns validation, calculation,
dependency propagation, invariant warnings, and stable fingerprints.

Rates are decimals (``0.05`` means 5%).  Monetary values use the draft's stated
reporting unit.  Workbook formulas are never accepted as executable inputs.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from calendar import monthrange
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


ENGINE_VERSION = "2.0.0"
MODEL_SCHEMA_VERSION = 2
# Bound graph expansion independently of JSON byte size. The issuer model is a
# debt schedule, not a portfolio cube: 2,000 instrument-period intersections
# supports, for example, 50 instruments over 40 reporting periods while keeping
# one calculation within a predictable API worker memory/CPU envelope.
MAX_MODEL_DEBT_INTERSECTIONS = 2_000
MAX_MODEL_DEBT_ROWS = 2_000
MAX_MODEL_ESTIMATED_NODES = 75_000
MAX_MODEL_SOURCE_IDS = 9_000
MAX_SOURCE_ID_LENGTH = 240
MAX_UI_PREFERENCES_JSON = 4_096
MAX_MODEL_OVERRIDES = 10_000
SUPPORTED_REPORTING_CURRENCIES = frozenset({
    "AED", "AUD", "BRL", "CAD", "CHF", "CNY", "CZK", "DKK", "EUR",
    "GBP", "HKD", "HUF", "IDR", "ILS", "INR", "ISK", "JPY", "KRW",
    "MXN", "MYR", "NOK", "NZD", "PHP", "PLN", "RON", "SAR", "SEK",
    "SGD", "THB", "TRY", "TWD", "USD", "ZAR",
})
SUPPORTED_REPORTING_UNITS = frozenset({
    "units", "thousands", "millions", "billions",
})
_PERIOD_KEY = re.compile(
    r"^(?:FY\d{4}|Q[1-4]-\d{4}|YTD-Q[1-4]-\d{4}|LTM-\d{4}-\d{2}-\d{2}|\d{4}-\d{2}-\d{2})$"
)
_NODE_PART = re.compile(r"^[A-Za-z0-9_.-]{1,96}$")
_TOLERANCE = Decimal("0.01")
_ZERO = Decimal("0")
_MAX_ABS_INPUT = Decimal("1e250")
_DERIVED_DEBT_FIELDS = frozenset({
    "opening_balance",
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
})


def _period_order_key(value: str) -> tuple[date, int]:
    """Canonical chronological order for every supported reporting-key shape."""

    if value.startswith("FY"):
        return date(int(value[2:]), 12, 31), 4
    if value.startswith("Q"):
        quarter = int(value[1])
        year = int(value[3:])
        month_day = {1: (3, 31), 2: (6, 30), 3: (9, 30), 4: (12, 31)}[quarter]
        return date(year, *month_day), 1
    if value.startswith("YTD-Q"):
        quarter = int(value[5])
        year = int(value[7:])
        month_day = {1: (3, 31), 2: (6, 30), 3: (9, 30), 4: (12, 31)}[quarter]
        return date(year, *month_day), 2
    if value.startswith("LTM-"):
        return date.fromisoformat(value[4:]), 3
    return date.fromisoformat(value), 0


def _shift_months(value: date, months: int) -> date:
    """Shift a reporting date while preserving month-end semantics."""

    source_is_month_end = value.day == monthrange(value.year, value.month)[1]
    absolute_month = value.year * 12 + (value.month - 1) + months
    year, month_index = divmod(absolute_month, 12)
    month = month_index + 1
    last_day = monthrange(year, month)[1]
    day = last_day if source_is_month_end else min(value.day, last_day)
    return date(year, month, day)


def is_finite_number(value: object) -> bool:
    """Reject bool, NaN, and infinities at every model boundary."""

    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        return False
    try:
        return math.isfinite(float(value))
    except (OverflowError, ValueError):
        return False


def _decimal(value: object) -> Optional[Decimal]:
    if value is None or not is_finite_number(value):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _number(value: Optional[Decimal]) -> Optional[float]:
    if value is None or not value.is_finite():
        return None
    number = float(value)
    if not math.isfinite(number):
        return None
    return 0.0 if number == 0 else number


def _validate_bounded_number(value: Optional[float], *, label: str) -> Optional[float]:
    if value is None:
        return None
    if not is_finite_number(value):
        raise ValueError(f"{label} must be a finite number")
    if abs(Decimal(str(value))) > _MAX_ABS_INPUT:
        raise ValueError(f"{label} exceeds the supported magnitude")
    return value


def _validate_source_ids(value: list[str]) -> list[str]:
    invalid = [
        item for item in value
        if not item.strip() or len(item) > MAX_SOURCE_ID_LENGTH
    ]
    if invalid:
        raise ValueError(
            f"source IDs must be non-empty and at most {MAX_SOURCE_ID_LENGTH} characters"
        )
    return value


def _safe_div(numerator: Optional[Decimal], denominator: Optional[Decimal]) -> Optional[Decimal]:
    if numerator is None or denominator is None or denominator == 0:
        return None
    result = numerator / denominator
    return result if result.is_finite() else None


def _canonical_hash(value: Any) -> str:
    payload = json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
        default=str,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class ModelAuthority(StrictModel):
    origin: Literal["live", "imported", "analyst", "reference"]
    method: str = Field(min_length=1, max_length=64)
    source_ids: list[str] = Field(default_factory=list, max_length=100)
    as_of: Optional[datetime] = None

    @field_validator("source_ids")
    @classmethod
    def validate_source_ids(cls, value: list[str]) -> list[str]:
        return _validate_source_ids(value)


class ModelPeriodInput(StrictModel):
    period_key: str = Field(min_length=4, max_length=24)
    label: str = Field(min_length=1, max_length=64)
    kind: Literal["actual", "forecast", "ltm", "pro_forma"]
    months: int = Field(default=12, ge=1, le=24)
    revenue: Optional[float] = None
    reported_ebitda: Optional[float] = None
    adjustments: Optional[float] = None
    adjusted_ebitda: Optional[float] = None
    cash: Optional[float] = None
    total_debt: Optional[float] = None
    net_debt: Optional[float] = None
    cash_interest: Optional[float] = None
    taxes: Optional[float] = Field(default=None, ge=0)
    capex: Optional[float] = Field(default=None, ge=0)
    working_capital_change: Optional[float] = None
    other_cash_flow: Optional[float] = None
    authority: ModelAuthority

    @field_validator("period_key")
    @classmethod
    def validate_period_key(cls, value: str) -> str:
        value = value.strip()
        if not _PERIOD_KEY.fullmatch(value):
            raise ValueError(
                "period_key must be ISO date, FYyyyy, Qn-yyyy, YTD-Qn-yyyy, or LTM-yyyy-mm-dd"
            )
        try:
            _period_order_key(value)
        except (ValueError, KeyError) as exc:
            raise ValueError("period_key contains an invalid calendar period") from exc
        return value

    @field_validator(
        "revenue", "reported_ebitda", "adjustments", "adjusted_ebitda",
        "cash", "total_debt", "net_debt", "cash_interest", "taxes",
        "capex", "working_capital_change", "other_cash_flow",
    )
    @classmethod
    def validate_finite_values(cls, value: Optional[float]) -> Optional[float]:
        return _validate_bounded_number(value, label="model values")


class DebtPeriod(StrictModel):
    period_key: str = Field(min_length=4, max_length=24)
    opening_balance: Optional[float] = None
    closing_balance: Optional[float] = None
    draws: Optional[float] = None
    repayments: Optional[float] = None
    scheduled_amortization: Optional[float] = None
    commitment: Optional[float] = None
    benchmark_rate: Optional[float] = None
    floor_rate: Optional[float] = None
    spread_rate: Optional[float] = None
    coupon_rate: Optional[float] = None
    commitment_fee_rate: Optional[float] = None
    pik_rate: Optional[float] = None
    cash_fees: Optional[float] = None
    hedge_effect: Optional[float] = None
    fx_rate: Optional[float] = None

    @field_validator("period_key")
    @classmethod
    def validate_period_key(cls, value: str) -> str:
        value = value.strip()
        if not _PERIOD_KEY.fullmatch(value):
            raise ValueError(
                "period_key must be ISO date, FYyyyy, Qn-yyyy, YTD-Qn-yyyy, or LTM-yyyy-mm-dd"
            )
        return value

    @field_validator(
        "opening_balance", "closing_balance", "draws", "repayments",
        "scheduled_amortization", "commitment", "benchmark_rate", "floor_rate",
        "spread_rate", "coupon_rate", "commitment_fee_rate", "pik_rate",
        "cash_fees", "hedge_effect", "fx_rate",
    )
    @classmethod
    def validate_finite_values(cls, value: Optional[float]) -> Optional[float]:
        return _validate_bounded_number(value, label="debt values")

    @model_validator(mode="after")
    def validate_ranges(self) -> "DebtPeriod":
        for field in (
            "benchmark_rate", "floor_rate", "spread_rate", "coupon_rate",
            "commitment_fee_rate", "pik_rate",
        ):
            value = getattr(self, field)
            if value is not None and (value < -1 or value > 5):
                raise ValueError(f"{field} must be a decimal rate between -1 and 5")
        if self.fx_rate is not None and (self.fx_rate <= 0 or self.fx_rate > 1000):
            raise ValueError("fx_rate must be greater than zero and bounded")
        for field in (
            "opening_balance", "closing_balance", "draws", "repayments",
            "scheduled_amortization", "commitment",
        ):
            value = getattr(self, field)
            if value is not None and value < 0:
                raise ValueError(f"{field} cannot be negative")
        return self


class DebtInstrument(StrictModel):
    instrument_id: str = Field(min_length=1, max_length=96)
    name: str = Field(min_length=1, max_length=160)
    priority: int = Field(ge=0, le=99)
    seniority: str = Field(min_length=1, max_length=64)
    currency: str = Field(min_length=3, max_length=3)
    rate_type: Optional[Literal["floating", "fixed", "hybrid"]] = None
    maturity: Optional[str] = Field(default=None, max_length=24)
    amortization: Optional[str] = Field(default=None, max_length=240)
    benchmark_curve: Optional[str] = Field(default=None, max_length=120)
    periods: list[DebtPeriod] = Field(default_factory=list, max_length=120)
    sources: list[str] = Field(default_factory=list, max_length=100)
    authority: ModelAuthority

    @field_validator("sources")
    @classmethod
    def validate_sources(cls, value: list[str]) -> list[str]:
        return _validate_source_ids(value)

    @field_validator("instrument_id")
    @classmethod
    def validate_instrument_id(cls, value: str) -> str:
        value = value.strip()
        if not _NODE_PART.fullmatch(value):
            raise ValueError("instrument_id must be a stable bounded key")
        return value

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        value = value.strip().upper()
        if not value.isalpha():
            raise ValueError("currency must be a three-letter code")
        return value

    @model_validator(mode="after")
    def unique_periods(self) -> "DebtInstrument":
        keys = [period.period_key for period in self.periods]
        if len(keys) != len(set(keys)):
            raise ValueError("debt instrument period keys must be unique")
        return self


OverrideValueType = Literal["number", "null"]


def is_derived_override_node(node_id: str) -> bool:
    """Return whether an override replaces a calculated graph node."""

    parts = node_id.split(":")
    return node_id.startswith("calc:") or (
        len(parts) in (3, 4)
        and parts[0] == "debt"
        and parts[-1] in _DERIVED_DEBT_FIELDS
    )


class CellOverride(StrictModel):
    node_id: str = Field(min_length=3, max_length=300)
    value_type: OverrideValueType
    value: Optional[float] = None
    reason: Optional[str] = Field(default=None, max_length=1000)
    scope: str = Field(default="draft", min_length=1, max_length=64)
    source: Optional[str] = Field(default=None, max_length=240)
    expires_at: Optional[datetime] = None

    @field_validator("node_id")
    @classmethod
    def validate_node_id(cls, value: str) -> str:
        parts = value.split(":")
        if len(parts) not in (3, 4) or parts[0] not in {"input", "debt", "calc"}:
            raise ValueError("node_id must identify input, debt, or calc node")
        if any(not _NODE_PART.fullmatch(part) for part in parts[1:]):
            raise ValueError("node_id contains an invalid key")
        return value

    @field_validator("expires_at")
    @classmethod
    def require_timezone(cls, value: Optional[datetime]) -> Optional[datetime]:
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("override expiry must include a timezone")
        return value

    @model_validator(mode="after")
    def validate_typed_value_and_audit(self) -> "CellOverride":
        if self.value_type == "number":
            if self.value is None:
                raise ValueError("number overrides require a finite value")
            _validate_bounded_number(self.value, label="override values")
        elif self.value is not None:
            raise ValueError("null overrides cannot carry a value")
        if is_derived_override_node(self.node_id):
            if not (self.reason or "").strip():
                raise ValueError("derived-cell overrides require a reason")
            if not (self.source or "").strip():
                raise ValueError("derived-cell overrides require a source")
            if self.expires_at is None:
                raise ValueError("derived-cell overrides require an expiry")
        return self


class ModelUiPreferences(StrictModel):
    show_quarters: bool = True
    show_assumptions: bool = True
    show_scenarios: bool = True
    warn_on_unsaved_leave: bool = True
    collapsed_rows: list[str] = Field(default_factory=list, max_length=500)

    @field_validator("collapsed_rows")
    @classmethod
    def validate_collapsed_rows(cls, value: list[str]) -> list[str]:
        if any(not item.strip() or len(item) > 300 for item in value):
            raise ValueError("collapsed row IDs must be non-empty and at most 300 characters")
        if len(value) != len(set(value)):
            raise ValueError("collapsed row IDs must be unique")
        return value

    @model_validator(mode="after")
    def bounded_serialized_preferences(self) -> "ModelUiPreferences":
        serialized = json.dumps(
            self.model_dump(mode="json"),
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        )
        if len(serialized) > MAX_UI_PREFERENCES_JSON:
            raise ValueError("model UI preferences exceed the workbook cell contract")
        return self


class ModelDraftPayload(StrictModel):
    schema_version: Literal[2] = MODEL_SCHEMA_VERSION
    reporting_currency: str = Field(min_length=3, max_length=3)
    reporting_unit: str = Field(min_length=1, max_length=32)
    periods: list[ModelPeriodInput] = Field(default_factory=list, max_length=120)
    debt_instruments: list[DebtInstrument] = Field(default_factory=list, max_length=500)
    overrides: list[CellOverride] = Field(
        default_factory=list, max_length=MAX_MODEL_OVERRIDES
    )
    ui_preferences: ModelUiPreferences = Field(default_factory=ModelUiPreferences)
    source_ids: list[str] = Field(default_factory=list, max_length=500)

    @field_validator("reporting_currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        value = value.strip().upper()
        if value not in SUPPORTED_REPORTING_CURRENCIES:
            raise ValueError("reporting_currency is not supported")
        return value

    @field_validator("reporting_unit")
    @classmethod
    def normalize_reporting_unit(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in SUPPORTED_REPORTING_UNITS:
            raise ValueError("reporting_unit is not supported")
        return value

    @field_validator("source_ids")
    @classmethod
    def validate_source_ids(cls, value: list[str]) -> list[str]:
        return _validate_source_ids(value)

    @model_validator(mode="after")
    def unique_keys(self) -> "ModelDraftPayload":
        period_keys = [period.period_key for period in self.periods]
        instrument_ids = [instrument.instrument_id for instrument in self.debt_instruments]
        override_nodes = [override.node_id for override in self.overrides]
        if len(period_keys) != len(set(period_keys)):
            raise ValueError("model period keys must be unique")
        if len(instrument_ids) != len(set(instrument_ids)):
            raise ValueError("debt instrument IDs must be unique")
        if len(override_nodes) != len(set(override_nodes)):
            raise ValueError("only one active override is allowed per node")
        period_order = [_period_order_key(key) for key in period_keys]
        if period_order != sorted(period_order):
            raise ValueError(
                "model periods must be supplied in canonical chronological order"
            )
        intersections = len(self.periods) * len(self.debt_instruments)
        debt_rows = sum(len(instrument.periods) for instrument in self.debt_instruments)
        estimated_nodes = len(self.periods) * 20 + debt_rows * 32
        if intersections > MAX_MODEL_DEBT_INTERSECTIONS:
            raise ValueError(
                "model debt schedule exceeds the supported instrument-period complexity"
            )
        if debt_rows > MAX_MODEL_DEBT_ROWS or estimated_nodes > MAX_MODEL_ESTIMATED_NODES:
            raise ValueError(
                "model calculation graph exceeds the supported node complexity"
            )
        source_audit_ids = set(self.source_ids)
        for period in self.periods:
            source_audit_ids.update(period.authority.source_ids)
        for instrument in self.debt_instruments:
            source_audit_ids.update(instrument.sources)
            source_audit_ids.update(instrument.authority.source_ids)
        if len(source_audit_ids) > MAX_MODEL_SOURCE_IDS:
            raise ValueError("model source audit exceeds the workbook row contract")
        known_periods = set(period_keys)
        for instrument in self.debt_instruments:
            unknown = sorted({point.period_key for point in instrument.periods} - known_periods)
            if unknown:
                raise ValueError(
                    f"debt instrument {instrument.instrument_id} references unknown periods: {', '.join(unknown)}"
                )
        known_nodes: set[str] = set()
        input_fields = (
            "revenue", "reported_ebitda", "adjustments", "adjusted_ebitda",
            "cash", "total_debt", "net_debt", "cash_interest", "taxes",
            "capex", "working_capital_change", "other_cash_flow",
        )
        calculation_fields = (
            "adjusted_ebitda", "total_debt", "cash_interest", "net_debt",
            "gross_leverage", "net_leverage", "interest_coverage", "free_cash_flow",
        )
        # ``period_key`` identifies the node and is not itself an editable value.
        debt_input_fields = tuple(
            name for name in DebtPeriod.model_fields if name != "period_key"
        )
        for period in self.periods:
            known_nodes.update(f"input:{period.period_key}:{field}" for field in input_fields)
            known_nodes.update(f"calc:{period.period_key}:{field}" for field in calculation_fields)
        for instrument in self.debt_instruments:
            for point in instrument.periods:
                prefix = f"debt:{instrument.instrument_id}:{point.period_key}"
                known_nodes.update(f"{prefix}:{field}" for field in debt_input_fields)
                known_nodes.update(f"{prefix}:{field}" for field in _DERIVED_DEBT_FIELDS)
        unknown_overrides = sorted(set(override_nodes) - known_nodes)
        if unknown_overrides:
            raise ValueError(
                "override targets do not exist in this model: "
                + ", ".join(unknown_overrides[:10])
            )
        return self


class ModelNode(StrictModel):
    node_id: str
    value: Optional[float]
    original_value: Optional[float]
    formula: Optional[str] = None
    overridden: bool = False
    override_reason: Optional[str] = None


class DebtInstrumentCalculation(StrictModel):
    instrument_id: str
    period_key: str
    opening_balance: Optional[float]
    closing_balance: Optional[float]
    average_balance: Optional[float]
    expected_closing_balance: Optional[float]
    rollforward_residual: Optional[float]
    benchmark_interest: Optional[float]
    margin_interest: Optional[float]
    coupon_interest: Optional[float]
    fees: Optional[float]
    pik_interest: Optional[float]
    hedge_effect: Optional[float]
    fx_effect: Optional[float]
    cash_interest: Optional[float]
    debt_reporting_currency: Optional[float]


class ModelPeriodCalculation(StrictModel):
    period_key: str
    label: str
    kind: str
    revenue: Optional[float]
    reported_ebitda: Optional[float]
    adjustments: Optional[float]
    adjusted_ebitda: Optional[float]
    cash_interest: Optional[float]
    total_debt: Optional[float]
    cash: Optional[float]
    net_debt: Optional[float]
    gross_leverage: Optional[float]
    net_leverage: Optional[float]
    interest_coverage: Optional[float]
    free_cash_flow: Optional[float]
    instruments: list[DebtInstrumentCalculation]
    nodes: list[ModelNode]


class ModelCalculation(StrictModel):
    engine_version: Literal[ENGINE_VERSION] = ENGINE_VERSION
    schema_version: Literal[2] = MODEL_SCHEMA_VERSION
    status: Literal["ready", "partial", "insufficient_inputs"]
    source_fingerprint: str
    input_fingerprint: str
    calculation_hash: str
    periods: list[ModelPeriodCalculation]
    gaps: list[str]
    warnings: list[str]


def source_fingerprint(payload: ModelDraftPayload) -> str:
    sources: set[str] = set(payload.source_ids)
    authority_rows: list[dict[str, Any]] = []
    for period in payload.periods:
        sources.update(period.authority.source_ids)
        authority_rows.append(period.authority.model_dump(mode="json"))
    for instrument in payload.debt_instruments:
        sources.update(instrument.sources)
        sources.update(instrument.authority.source_ids)
        authority_rows.append(instrument.authority.model_dump(mode="json"))
    return _canonical_hash({"sources": sorted(sources), "authority": authority_rows})


def _calculation_status(
    periods: list[ModelPeriodCalculation], gaps: list[str]
) -> Literal["ready", "partial", "insufficient_inputs"]:
    if not periods:
        return "insufficient_inputs"
    if not gaps:
        return "ready"
    usable = any(
        period.adjusted_ebitda is not None
        or period.total_debt is not None
        or period.net_debt is not None
        for period in periods
    )
    return "partial" if usable else "insufficient_inputs"


class ModelEngineV2:
    """Pure calculator. Instantiate once; ``calculate`` has no mutable state."""

    version = ENGINE_VERSION

    def calculate(
        self,
        payload: ModelDraftPayload,
        *,
        evaluated_at: Optional[datetime] = None,
    ) -> ModelCalculation:
        now = evaluated_at or datetime.now(timezone.utc)
        if now.tzinfo is None or now.utcoffset() is None:
            raise ValueError("evaluated_at must include a timezone")
        now = now.astimezone(timezone.utc)
        active_overrides = {
            item.node_id: item
            for item in payload.overrides
            if item.expires_at is None or item.expires_at > now
        }
        canonical_input = payload.model_dump(mode="json")
        canonical_input["overrides"] = [
            active_overrides[key].model_dump(mode="json") for key in sorted(active_overrides)
        ]
        canonical_input.pop("ui_preferences", None)
        input_fingerprint = _canonical_hash({
            "engine_version": self.version,
            "payload": canonical_input,
        })
        gaps: list[str] = []
        warnings: list[str] = []
        periods: list[ModelPeriodCalculation] = []
        debt_by_period: dict[str, list[tuple[DebtInstrument, DebtPeriod]]] = {}
        for instrument in payload.debt_instruments:
            for point in instrument.periods:
                debt_by_period.setdefault(point.period_key, []).append((instrument, point))

        def apply_node(
            node_id: str,
            original: Optional[Decimal],
            nodes: list[ModelNode],
            formula: Optional[str] = None,
            *,
            non_negative: bool = False,
            negative_message: str = "debt value cannot be negative",
        ) -> Optional[Decimal]:
            override = active_overrides.get(node_id)
            value = original
            if override is not None:
                value = _decimal(override.value) if override.value_type == "number" else None
            original_number = _number(original)
            if original is not None and original_number is None:
                gaps.append(f"{node_id}: calculated value exceeds the supported finite range")
                if override is None:
                    value = None
            value_number = _number(value)
            if value is not None and value_number is None:
                gaps.append(f"{node_id}: effective value exceeds the supported finite range")
                value = None
                value_number = None
            if non_negative and value is not None and value < 0:
                gaps.append(f"{node_id}: {negative_message}")
                value = None
                value_number = None
            nodes.append(ModelNode(
                node_id=node_id,
                value=value_number,
                original_value=original_number,
                formula=formula,
                overridden=override is not None,
                override_reason=override.reason if override else None,
            ))
            return value

        prior_closing_by_instrument: dict[str, Optional[Decimal]] = {}
        prior_period_by_instrument: dict[str, str] = {}
        prior_effective_by_instrument: dict[str, date] = {}
        for period in payload.periods:
            nodes: list[ModelNode] = []
            key = period.period_key

            def input_value(
                field: str,
                *,
                non_negative: bool = False,
                negative_message: str = "model value cannot be negative",
            ) -> Optional[Decimal]:
                return apply_node(
                    f"input:{key}:{field}",
                    _decimal(getattr(period, field)),
                    nodes,
                    non_negative=non_negative,
                    negative_message=negative_message,
                )

            def input_is_overridden(field: str) -> bool:
                return f"input:{key}:{field}" in active_overrides

            revenue = input_value("revenue")
            reported_ebitda = input_value("reported_ebitda")
            adjustments = input_value("adjustments")
            direct_adjusted = input_value("adjusted_ebitda")
            if direct_adjusted is not None:
                adjusted_original = direct_adjusted
                adjusted_formula = "input.adjusted_ebitda"
                if (
                    reported_ebitda is not None
                    and adjustments is not None
                    and abs(direct_adjusted - (reported_ebitda + adjustments)) > _TOLERANCE
                ):
                    warnings.append(
                        f"{key}: explicit adjusted EBITDA does not tie to reported EBITDA plus adjustments"
                    )
            elif reported_ebitda is not None and adjustments is not None:
                adjusted_original = reported_ebitda + adjustments
                adjusted_formula = "reported_ebitda + adjustments"
            else:
                adjusted_original = None
                adjusted_formula = "reported_ebitda + adjustments"
                gaps.append(f"{key}: adjusted EBITDA requires adjusted_ebitda or reported EBITDA plus adjustments")
            adjusted_ebitda = apply_node(
                f"calc:{key}:adjusted_ebitda", adjusted_original, nodes, adjusted_formula
            )

            instrument_results: list[DebtInstrumentCalculation] = []
            reporting_debt_values: list[Decimal] = []
            debt_cash_interest_values: list[Decimal] = []
            schedule_rows = sorted(
                debt_by_period.get(key, []),
                key=lambda item: (item[0].priority, item[0].instrument_id),
            )
            scheduled_instruments = {
                instrument.instrument_id for instrument, _point in schedule_rows
            }
            missing_instruments = sorted(
                instrument.instrument_id
                for instrument in payload.debt_instruments
                if instrument.instrument_id not in scheduled_instruments
            )
            if missing_instruments:
                gaps.append(
                    f"{key}: debt schedule is missing period rows for "
                    + ", ".join(missing_instruments)
                )
            complete_balance_schedule = bool(schedule_rows) and not missing_instruments
            complete_interest_schedule = bool(schedule_rows) and not missing_instruments
            for instrument, point in schedule_rows:
                prefix = f"debt:{instrument.instrument_id}:{key}"
                context = f"{key}/{instrument.instrument_id}"

                def debt_value(
                    field: str,
                    *,
                    default: Optional[Decimal] = None,
                    formula: Optional[str] = None,
                ) -> Optional[Decimal]:
                    node_id = f"{prefix}:{field}"
                    original = _decimal(getattr(point, field))
                    if original is None and default is not None and node_id not in active_overrides:
                        original = default
                    return apply_node(
                        node_id,
                        original,
                        nodes,
                        formula,
                        non_negative=field in {
                            "opening_balance",
                            "closing_balance",
                            "draws",
                            "repayments",
                            "scheduled_amortization",
                            "commitment",
                            "average_balance",
                            "expected_closing_balance",
                            "debt_reporting_currency",
                        },
                    )

                def add_missing(field: str, value: object, *, required: bool = True) -> None:
                    if required and value is None:
                        gaps.append(f"{context}: missing debt input {field}")

                supplied_opening = _decimal(point.opening_balance)
                opening_formula: Optional[str] = None
                current_effective = _period_order_key(key)[0]
                has_prior_contiguous_period = (
                    instrument.instrument_id in prior_closing_by_instrument
                    and prior_effective_by_instrument[instrument.instrument_id]
                    < current_effective
                    and prior_effective_by_instrument[instrument.instrument_id]
                    == _shift_months(current_effective, -period.months)
                )
                if has_prior_contiguous_period:
                    prior_closing = prior_closing_by_instrument[instrument.instrument_id]
                    prior_period = prior_period_by_instrument[instrument.instrument_id]
                    opening_discontinuity = (
                        prior_closing is not None
                        and supplied_opening is not None
                        and abs(prior_closing - supplied_opening) > _TOLERANCE
                    )
                    if period.kind in {"forecast", "pro_forma"}:
                        opening_original = prior_closing
                        opening_formula = f"{prior_period}.closing_balance"
                    else:
                        # Preserve an actual/LTM sourced opening, but never let a
                        # discontinuity pass as a fully tied schedule.
                        opening_original = supplied_opening
                    if opening_discontinuity:
                        warnings.append(
                            f"{context}: supplied opening balance does not tie to prior closing balance"
                        )
                        if period.kind not in {"forecast", "pro_forma"}:
                            gaps.append(
                                f"{context}: sourced opening balance does not tie to "
                                f"{prior_period} closing balance"
                            )
                else:
                    opening_original = supplied_opening
                opening = apply_node(
                    f"{prefix}:opening_balance",
                    opening_original,
                    nodes,
                    opening_formula,
                    non_negative=True,
                )

                draws = debt_value("draws")
                repayments = debt_value("repayments")
                amortization = debt_value("scheduled_amortization")
                commitment = debt_value("commitment")
                benchmark = debt_value("benchmark_rate")
                floor = debt_value(
                    "floor_rate",
                    default=_ZERO,
                    formula="0 when no contractual floor is supplied",
                )
                spread = debt_value("spread_rate")
                coupon = debt_value("coupon_rate")
                commitment_fee = debt_value("commitment_fee_rate")
                pik_rate = debt_value("pik_rate")
                cash_fees = debt_value("cash_fees")
                hedge_effect = debt_value("hedge_effect")
                fx_default = (
                    Decimal(1)
                    if instrument.currency == payload.reporting_currency
                    else None
                )
                fx_rate = debt_value(
                    "fx_rate",
                    default=fx_default,
                    formula=(
                        "1 when instrument currency equals reporting currency"
                        if fx_default is not None
                        else None
                    ),
                )

                add_missing("opening_balance", opening)
                for field_name, value in (
                    ("draws", draws),
                    ("repayments", repayments),
                    ("scheduled_amortization", amortization),
                    ("commitment_fee_rate", commitment_fee),
                    ("pik_rate", pik_rate),
                    ("cash_fees", cash_fees),
                    ("hedge_effect", hedge_effect),
                ):
                    add_missing(field_name, value)
                if instrument.rate_type is None:
                    gaps.append(f"{context}: missing debt input rate_type")
                if instrument.rate_type in {"floating", "hybrid"}:
                    add_missing("benchmark_rate", benchmark)
                    add_missing("floor_rate", floor)
                    add_missing("spread_rate", spread)
                if instrument.rate_type in {"fixed", "hybrid"}:
                    add_missing("coupon_rate", coupon)
                if fx_rate is None:
                    if instrument.currency == payload.reporting_currency:
                        gaps.append(f"{context}: same-currency FX override cannot be null")
                    else:
                        gaps.append(
                            f"{context}: missing debt input fx_rate for "
                            f"{instrument.currency}/{payload.reporting_currency} conversion"
                        )
                if commitment_fee is not None and commitment_fee != 0:
                    add_missing("commitment", commitment)

                annualization = Decimal(period.months) / Decimal(12)
                supplied_closing = _decimal(point.closing_balance)
                if period.kind in {"forecast", "pro_forma"}:
                    core_values = (opening, draws, repayments, amortization, pik_rate)
                    base_closing: Optional[Decimal]
                    formula_closing: Optional[Decimal]
                    if all(value is not None for value in core_values):
                        assert opening is not None
                        assert draws is not None
                        assert repayments is not None
                        assert amortization is not None
                        assert pik_rate is not None
                        base_closing = opening + draws - repayments - amortization
                        pik_factor = pik_rate * annualization
                        denominator = Decimal(1) - (pik_factor / Decimal(2))
                        if base_closing < 0:
                            formula_closing = None
                            gaps.append(
                                f"{context}: forecast debt roll-forward produces a negative "
                                "base closing balance"
                            )
                            base_closing = None
                        elif denominator <= 0:
                            formula_closing = None
                            gaps.append(
                                f"{context}: forecast closing balance is undefined because "
                                "the PIK roll-forward denominator is not positive"
                            )
                        else:
                            formula_closing = (
                                base_closing + (pik_factor * opening / Decimal(2))
                            ) / denominator
                    else:
                        base_closing = None
                        formula_closing = None

                    if (
                        supplied_closing is not None
                        and formula_closing is not None
                        and abs(supplied_closing - formula_closing) > _TOLERANCE
                    ):
                        warnings.append(
                            f"{context}: supplied closing balance does not tie to derived forecast close"
                        )

                    def override_value(field: str) -> tuple[bool, Optional[Decimal]]:
                        override = active_overrides.get(f"{prefix}:{field}")
                        if override is None:
                            return False, None
                        if override.value_type == "null":
                            return True, None
                        return True, _decimal(override.value)

                    closing_overridden, closing_override = override_value("closing_balance")
                    expected_overridden, expected_override = override_value(
                        "expected_closing_balance"
                    )
                    pik_overridden, pik_override = override_value("pik_interest")
                    average_overridden, average_override = override_value("average_balance")

                    if closing_overridden:
                        closing_candidate = closing_override
                    elif expected_overridden:
                        closing_candidate = expected_override
                    elif pik_overridden:
                        closing_candidate = (
                            None
                            if base_closing is None or pik_override is None
                            else base_closing + pik_override
                        )
                    elif average_overridden:
                        closing_candidate = (
                            None
                            if base_closing is None
                            or average_override is None
                            or pik_rate is None
                            else base_closing + average_override * pik_rate * annualization
                        )
                    else:
                        closing_candidate = formula_closing

                    average_original = (
                        None
                        if opening is None or closing_candidate is None
                        else (opening + closing_candidate) / Decimal(2)
                    )
                    average = apply_node(
                        f"{prefix}:average_balance",
                        average_original,
                        nodes,
                        "(opening_balance + closing_balance) / 2",
                        non_negative=True,
                    )
                    pik_original = (
                        None
                        if average is None or pik_rate is None
                        else average * pik_rate * annualization
                    )
                    pik_interest = apply_node(
                        f"{prefix}:pik_interest",
                        pik_original,
                        nodes,
                        "average_balance * pik_rate * months / 12",
                    )
                    expected_original = (
                        None
                        if base_closing is None or pik_interest is None
                        else base_closing + pik_interest
                    )
                    expected = apply_node(
                        f"{prefix}:expected_closing_balance",
                        expected_original,
                        nodes,
                        "opening_balance + draws + pik_interest - repayments - scheduled_amortization",
                        non_negative=True,
                    )
                    closing = apply_node(
                        f"{prefix}:closing_balance",
                        expected,
                        nodes,
                        "expected_closing_balance",
                        non_negative=True,
                    )
                else:
                    closing = apply_node(
                        f"{prefix}:closing_balance",
                        supplied_closing,
                        nodes,
                        non_negative=True,
                    )
                    add_missing("closing_balance", closing)
                    average_original = (
                        None
                        if opening is None or closing is None
                        else (opening + closing) / Decimal(2)
                    )
                    average = apply_node(
                        f"{prefix}:average_balance",
                        average_original,
                        nodes,
                        "(opening_balance + closing_balance) / 2",
                        non_negative=True,
                    )
                    pik_original = (
                        None
                        if average is None or pik_rate is None
                        else average * pik_rate * annualization
                    )
                    pik_interest = apply_node(
                        f"{prefix}:pik_interest",
                        pik_original,
                        nodes,
                        "average_balance * pik_rate * months / 12",
                    )
                    expected_original = (
                        None
                        if any(
                            value is None
                            for value in (opening, draws, pik_interest, repayments, amortization)
                        )
                        else opening + draws + pik_interest - repayments - amortization
                    )
                    expected = apply_node(
                        f"{prefix}:expected_closing_balance",
                        expected_original,
                        nodes,
                        "opening_balance + draws + pik_interest - repayments - scheduled_amortization",
                        non_negative=True,
                    )

                residual_original = (
                    None
                    if closing is None or expected is None
                    else closing - expected
                )
                residual = apply_node(
                    f"{prefix}:rollforward_residual",
                    residual_original,
                    nodes,
                    "closing_balance - expected_closing_balance",
                )
                if residual_original is not None and abs(residual_original) > _TOLERANCE:
                    warnings.append(
                        f"{context}: debt roll-forward residual {_number(residual_original)}"
                    )
                    gaps.append(
                        f"{context}: debt roll-forward does not tie; residual "
                        f"{_number(residual_original)} exceeds tolerance {_number(_TOLERANCE)}"
                    )

                if instrument.rate_type == "fixed":
                    benchmark_interest_original = _ZERO
                    margin_interest_original = _ZERO
                elif instrument.rate_type in {"floating", "hybrid"}:
                    benchmark_interest_original = (
                        None
                        if average is None or benchmark is None or floor is None
                        else average * max(benchmark, floor) * annualization
                    )
                    margin_interest_original = (
                        None
                        if average is None or spread is None
                        else average * spread * annualization
                    )
                else:
                    benchmark_interest_original = None
                    margin_interest_original = None
                benchmark_interest = apply_node(
                    f"{prefix}:benchmark_interest",
                    benchmark_interest_original,
                    nodes,
                    "average_balance * max(benchmark_rate, floor_rate) * months / 12",
                )
                margin_interest = apply_node(
                    f"{prefix}:margin_interest",
                    margin_interest_original,
                    nodes,
                    "average_balance * spread_rate * months / 12",
                )

                if instrument.rate_type == "floating":
                    coupon_interest_original = _ZERO
                elif instrument.rate_type in {"fixed", "hybrid"}:
                    coupon_interest_original = (
                        None
                        if average is None or coupon is None
                        else average * coupon * annualization
                    )
                else:
                    coupon_interest_original = None
                coupon_interest = apply_node(
                    f"{prefix}:coupon_interest",
                    coupon_interest_original,
                    nodes,
                    "average_balance * coupon_rate * months / 12",
                )

                if average is None or commitment_fee is None or cash_fees is None:
                    fees_original = None
                elif commitment_fee == 0:
                    fees_original = cash_fees
                elif commitment is None:
                    fees_original = None
                else:
                    undrawn = max(
                        _ZERO,
                        commitment - average,
                    )
                    fees_original = undrawn * commitment_fee * annualization + cash_fees
                fees = apply_node(
                    f"{prefix}:fees",
                    fees_original,
                    nodes,
                    "max(0, commitment - average_balance) * commitment_fee_rate * months / 12 + cash_fees",
                )

                cash_components = (
                    benchmark_interest,
                    margin_interest,
                    coupon_interest,
                    fees,
                    hedge_effect,
                )
                local_cash_interest = (
                    None
                    if any(value is None for value in cash_components)
                    else sum(cash_components, _ZERO)
                )
                fx_effect_original = (
                    None
                    if local_cash_interest is None or fx_rate is None
                    else local_cash_interest * (fx_rate - Decimal(1))
                )
                fx_effect = apply_node(
                    f"{prefix}:fx_effect",
                    fx_effect_original,
                    nodes,
                    "local_cash_interest * (fx_rate - 1)",
                )
                cash_interest_original = (
                    None
                    if local_cash_interest is None or fx_effect is None
                    else local_cash_interest + fx_effect
                )
                cash_interest = apply_node(
                    f"{prefix}:cash_interest",
                    cash_interest_original,
                    nodes,
                    "benchmark_interest + margin_interest + coupon_interest + fees + hedge_effect + fx_effect",
                    non_negative=True,
                    negative_message="cash interest must be a non-negative expense",
                )
                debt_reporting_original = (
                    None
                    if closing is None or fx_rate is None
                    else closing * fx_rate
                )
                debt_reporting = apply_node(
                    f"{prefix}:debt_reporting_currency",
                    debt_reporting_original,
                    nodes,
                    "closing_balance * fx_rate",
                    non_negative=True,
                )

                derived_values = {
                    "closing_balance": closing,
                    "average_balance": average,
                    "expected_closing_balance": expected,
                    "rollforward_residual": residual,
                    "benchmark_interest": benchmark_interest,
                    "margin_interest": margin_interest,
                    "coupon_interest": coupon_interest,
                    "fees": fees,
                    "pik_interest": pik_interest,
                    "fx_effect": fx_effect,
                    "cash_interest": cash_interest,
                    "debt_reporting_currency": debt_reporting,
                }
                for field_name, value in derived_values.items():
                    if value is None:
                        gaps.append(f"{context}: calculated debt field {field_name} is unavailable")

                if debt_reporting is None:
                    complete_balance_schedule = False
                else:
                    reporting_debt_values.append(debt_reporting)
                if cash_interest is None:
                    complete_interest_schedule = False
                else:
                    debt_cash_interest_values.append(cash_interest)
                prior_closing_by_instrument[instrument.instrument_id] = closing
                prior_period_by_instrument[instrument.instrument_id] = key
                prior_effective_by_instrument[instrument.instrument_id] = (
                    _period_order_key(key)[0]
                )
                instrument_results.append(DebtInstrumentCalculation(
                    instrument_id=instrument.instrument_id,
                    period_key=key,
                    opening_balance=_number(opening),
                    closing_balance=_number(closing),
                    average_balance=_number(average),
                    expected_closing_balance=_number(expected),
                    rollforward_residual=_number(residual),
                    benchmark_interest=_number(benchmark_interest),
                    margin_interest=_number(margin_interest),
                    coupon_interest=_number(coupon_interest),
                    fees=_number(fees),
                    pik_interest=_number(pik_interest),
                    # Unconditional: this was the only component gated on balance
                    # availability, so a row could show components that don't sum
                    # to its cash_interest (which always includes the hedge —
                    # triage 2026-07-16 P3).
                    hedge_effect=_number(hedge_effect),
                    fx_effect=_number(fx_effect),
                    cash_interest=_number(cash_interest),
                    debt_reporting_currency=_number(debt_reporting),
                ))

            debt_total = sum(reporting_debt_values, _ZERO)
            calculated_cash_interest = sum(debt_cash_interest_values, _ZERO)

            explicit_total_debt = input_value("total_debt")
            if input_is_overridden("total_debt"):
                total_debt_original = explicit_total_debt
                total_debt_formula = "input.total_debt (analyst override)"
                warnings.append(
                    f"{key}: analyst total debt input override supersedes the debt schedule"
                )
            elif complete_balance_schedule:
                total_debt_original: Optional[Decimal] = debt_total
                total_debt_formula = "sum(debt_instrument.closing_balance * fx_rate)"
                if explicit_total_debt is not None and abs(explicit_total_debt - debt_total) > _TOLERANCE:
                    warnings.append(f"{key}: explicit total debt does not tie to the debt schedule")
            else:
                total_debt_original = explicit_total_debt
                total_debt_formula = "input.total_debt"
            if total_debt_original is None:
                gaps.append(f"{key}: total debt or a complete balance schedule is required")
            total_debt = apply_node(
                f"calc:{key}:total_debt",
                total_debt_original,
                nodes,
                total_debt_formula,
                non_negative=True,
            )

            explicit_interest = input_value("cash_interest")
            if input_is_overridden("cash_interest"):
                cash_interest_original = explicit_interest
                cash_interest_formula = "input.cash_interest (analyst override)"
                warnings.append(
                    f"{key}: analyst cash interest input override supersedes the debt schedule"
                )
            elif complete_interest_schedule:
                cash_interest_original: Optional[Decimal] = calculated_cash_interest
                cash_interest_formula = "benchmark + margin + coupon + fees + hedge + FX"
                if explicit_interest is not None and abs(explicit_interest - calculated_cash_interest) > _TOLERANCE:
                    warnings.append(f"{key}: explicit cash interest does not tie to the debt schedule")
            else:
                cash_interest_original = explicit_interest
                cash_interest_formula = "input.cash_interest"
            if cash_interest_original is None:
                gaps.append(f"{key}: cash interest or a complete interest schedule is required")
            cash_interest = apply_node(
                f"calc:{key}:cash_interest",
                cash_interest_original,
                nodes,
                cash_interest_formula,
                non_negative=True,
                negative_message="cash interest must be a non-negative expense",
            )

            cash = input_value("cash")
            explicit_net_debt = input_value("net_debt")
            if input_is_overridden("net_debt"):
                net_debt_original = explicit_net_debt
                net_debt_formula = "input.net_debt (analyst override)"
                warnings.append(
                    f"{key}: analyst net debt input override supersedes total debt less cash"
                )
            elif total_debt is not None and cash is not None:
                net_debt_original = total_debt - cash
                net_debt_formula = "total_debt - cash"
                if explicit_net_debt is not None and abs(explicit_net_debt - net_debt_original) > _TOLERANCE:
                    warnings.append(f"{key}: explicit net debt does not tie to total debt less cash")
            else:
                net_debt_original = explicit_net_debt
                net_debt_formula = "input.net_debt"
            if net_debt_original is None:
                gaps.append(f"{key}: net debt requires net_debt or total debt less cash")
            net_debt = apply_node(
                f"calc:{key}:net_debt", net_debt_original, nodes, net_debt_formula
            )
            if adjusted_ebitda == 0:
                gaps.append(
                    f"{key}: leverage is undefined because adjusted EBITDA is zero"
                )
            elif adjusted_ebitda is not None and adjusted_ebitda < 0:
                gaps.append(
                    f"{key}: leverage is not meaningful because adjusted EBITDA is non-positive"
                )
            elif adjusted_ebitda is not None and period.months != 12:
                warnings.append(
                    f"{key}: leverage requires a 12-month EBITDA basis; "
                    f"this period contains {period.months} months"
                )
            leverage_ebitda = (
                adjusted_ebitda
                if (
                    adjusted_ebitda is not None
                    and adjusted_ebitda > 0
                    and period.months == 12
                )
                else None
            )
            gross_leverage = apply_node(
                f"calc:{key}:gross_leverage",
                _safe_div(total_debt, leverage_ebitda),
                nodes,
                "total_debt / adjusted_ebitda",
            )
            net_leverage = apply_node(
                f"calc:{key}:net_leverage",
                _safe_div(net_debt, leverage_ebitda),
                nodes,
                "net_debt / adjusted_ebitda",
            )
            if cash_interest == 0:
                gaps.append(
                    f"{key}: interest coverage is undefined because cash interest is zero"
                )
            if adjusted_ebitda is not None and adjusted_ebitda <= 0:
                gaps.append(
                    f"{key}: interest coverage is not meaningful because adjusted EBITDA is non-positive"
                )
            coverage_interest = (
                cash_interest
                if cash_interest is not None and cash_interest > 0
                else None
            )
            coverage_ebitda = (
                adjusted_ebitda
                if adjusted_ebitda is not None and adjusted_ebitda > 0
                else None
            )
            interest_coverage = apply_node(
                f"calc:{key}:interest_coverage",
                _safe_div(coverage_ebitda, coverage_interest),
                nodes,
                "adjusted_ebitda / cash_interest",
            )
            taxes = input_value(
                "taxes",
                non_negative=True,
                negative_message="taxes must be a non-negative outflow",
            )
            capex = input_value(
                "capex",
                non_negative=True,
                negative_message="capex must be a non-negative outflow",
            )
            working_capital = input_value("working_capital_change")
            other_cash_flow = input_value("other_cash_flow")
            if all(value is not None for value in (
                adjusted_ebitda, cash_interest, taxes, capex, working_capital, other_cash_flow,
            )):
                fcf_original = (
                    adjusted_ebitda - cash_interest - taxes - capex
                    + working_capital + other_cash_flow
                )
            else:
                fcf_original = None
                gaps.append(f"{key}: free cash flow requires EBITDA, interest, tax, capex, working capital, and other cash flow")
            free_cash_flow = apply_node(
                f"calc:{key}:free_cash_flow",
                fcf_original,
                nodes,
                "adjusted_ebitda - cash_interest - taxes - capex + working_capital_change + other_cash_flow",
            )
            periods.append(ModelPeriodCalculation(
                period_key=key,
                label=period.label,
                kind=period.kind,
                revenue=_number(revenue),
                reported_ebitda=_number(reported_ebitda),
                adjustments=_number(adjustments),
                adjusted_ebitda=_number(adjusted_ebitda),
                cash_interest=_number(cash_interest),
                total_debt=_number(total_debt),
                cash=_number(cash),
                net_debt=_number(net_debt),
                gross_leverage=_number(gross_leverage),
                net_leverage=_number(net_leverage),
                interest_coverage=_number(interest_coverage),
                free_cash_flow=_number(free_cash_flow),
                instruments=instrument_results,
                nodes=nodes,
            ))

        unique_gaps = list(dict.fromkeys(gaps))
        unique_warnings = list(dict.fromkeys(warnings))
        status = _calculation_status(periods, unique_gaps)
        result_without_hash = {
            "engine_version": self.version,
            "schema_version": MODEL_SCHEMA_VERSION,
            "status": status,
            "source_fingerprint": source_fingerprint(payload),
            "input_fingerprint": input_fingerprint,
            "periods": [period.model_dump(mode="json") for period in periods],
            "gaps": unique_gaps,
            "warnings": unique_warnings,
        }
        return ModelCalculation(
            **result_without_hash,
            calculation_hash=_canonical_hash(result_without_hash),
        )


def calculate_model(payload: ModelDraftPayload, *, evaluated_at: Optional[datetime] = None) -> ModelCalculation:
    return ModelEngineV2().calculate(payload, evaluated_at=evaluated_at)
