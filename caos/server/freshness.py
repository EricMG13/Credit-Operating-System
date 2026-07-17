"""Canonical source-aware freshness policy.

Freshness is evaluated from source-effective metadata, never from UI render time
or file upload time.  Callers pass ``now`` so boundary behavior is deterministic
and testable.  Domain tables continue to own the underlying observations.
"""

from __future__ import annotations

import calendar
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal, Optional, TypeAlias

from pydantic import BaseModel

FreshnessState: TypeAlias = Literal["current", "due", "stale", "unknown"]
FreshnessSourceKind: TypeAlias = Literal[
    "reported_financials",
    "price",
    "rating",
    "legal_document",
    "run",
    "derived_artifact",
]
ReportingCadence: TypeAlias = Literal[
    "quarterly", "semiannual", "annual", "private", "unknown"
]
SourceVersionState: TypeAlias = Literal["match", "changed", "unknown"]

POLICY_VERSION = "caos-freshness-v1"
_REPORTING_MONTHS = {"quarterly": 3, "semiannual": 6, "annual": 12}
_REPORTING_LAG_DAYS = {"quarterly": 45, "semiannual": 75, "annual": 90}
_SOURCE_KINDS = {
    "reported_financials",
    "price",
    "rating",
    "legal_document",
    "run",
    "derived_artifact",
}


class FreshnessEvaluation(BaseModel):
    state: FreshnessState
    source_kind: FreshnessSourceKind
    observed_at: Optional[datetime] = None
    effective_period_end: Optional[date] = None
    expected_next_at: Optional[datetime] = None
    due_at: Optional[datetime] = None
    age_days: Optional[int] = None
    reason: str
    policy_version: str = POLICY_VERSION


def _utc(value: datetime | date | str | None) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            try:
                parsed_date = date.fromisoformat(value)
            except ValueError:
                return None
            return datetime.combine(parsed_date, time.min, tzinfo=timezone.utc)
        value = parsed
    if isinstance(value, date) and not isinstance(value, datetime):
        return datetime.combine(value, time.min, tzinfo=timezone.utc)
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _add_months(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _unknown(
    source_kind: FreshnessSourceKind,
    reason: str,
    observed_at: Optional[datetime] = None,
    effective_period_end: Optional[date] = None,
) -> FreshnessEvaluation:
    return FreshnessEvaluation(
        state="unknown",
        source_kind=source_kind,
        observed_at=observed_at,
        effective_period_end=effective_period_end,
        reason=reason,
    )


def _reject_unsupported_source_kind(source_kind: str) -> None:
    # Runtime callers are not constrained by the Literal annotation. Reject an
    # unsupported kind at this boundary so callers receive the documented
    # domain error instead of an implementation-specific Pydantic error later.
    if source_kind not in _SOURCE_KINDS:
        raise ValueError(f"unsupported source_kind: {source_kind!r}")


def evaluate_freshness(
    *,
    source_kind: FreshnessSourceKind,
    now: datetime,
    observed_at: datetime | date | str | None = None,
    effective_period_end: date | datetime | str | None = None,
    cadence: ReportingCadence = "unknown",
    reporting_lag_days: Optional[int] = None,
    grace_days: int = 7,
    source_version_state: SourceVersionState = "match",
) -> FreshnessEvaluation:
    """Evaluate one observation with the clock for its source kind.

    ``source_version_state`` is load-bearing for derived and event-driven
    artifacts: a proven mismatch is stale; insufficient lineage is unknown.
    """
    _reject_unsupported_source_kind(source_kind)

    now_utc = _utc(now)
    observed = _utc(observed_at)
    period_dt = _utc(effective_period_end)
    period = period_dt.date() if period_dt else None
    if now_utc is None:
        raise ValueError("now must be a valid datetime")
    if observed_at is not None and observed is None:
        return _unknown(source_kind, "invalid_observed_at", effective_period_end=period)
    if effective_period_end is not None and period is None:
        return _unknown(source_kind, "invalid_effective_period_end", observed)
    if observed is not None and observed > now_utc:
        return _unknown(source_kind, "future_observation", observed, period)
    if period_dt is not None and period_dt > now_utc:
        return _unknown(source_kind, "future_effective_period", observed, period)

    if source_version_state == "changed":
        return FreshnessEvaluation(
            state="stale", source_kind=source_kind, observed_at=observed,
            effective_period_end=period, reason="source_version_changed",
        )
    if source_version_state == "unknown" and source_kind in {
        "rating", "legal_document", "run", "derived_artifact"
    }:
        return _unknown(source_kind, "source_version_unknown", observed, period)

    if source_kind == "reported_financials":
        if cadence in {"private", "unknown"}:
            return _unknown(
                source_kind,
                "private_event_driven" if cadence == "private" else "reporting_cadence_unknown",
                observed,
                period,
            )
        if cadence not in _REPORTING_MONTHS or period is None:
            return _unknown(source_kind, "reporting_period_unknown", observed, period)
        expected_date = _add_months(period, _REPORTING_MONTHS[cadence])
        expected = datetime.combine(expected_date, time.min, tzinfo=timezone.utc)
        lag = reporting_lag_days if reporting_lag_days is not None else _REPORTING_LAG_DAYS[cadence]
        if lag < 0 or grace_days < 0:
            return _unknown(source_kind, "invalid_reporting_policy", observed, period)
        due = expected + timedelta(days=lag + grace_days)
        age = max(0, (now_utc.date() - period).days)
        if now_utc < expected:
            state, reason = "current", "within_reporting_period"
        elif now_utc <= due:
            state, reason = "due", "next_report_due"
        else:
            state, reason = "stale", "report_overdue"
        return FreshnessEvaluation(
            state=state,
            source_kind=source_kind,
            observed_at=observed,
            effective_period_end=period,
            expected_next_at=expected,
            due_at=due,
            age_days=age,
            reason=reason,
        )

    if observed is None:
        return _unknown(source_kind, "observation_time_unknown", effective_period_end=period)
    age = max(0, (now_utc.date() - observed.date()).days)

    if source_kind == "price":
        if age <= 1:
            state, reason = "current", "price_current"
        elif age <= 3:
            state, reason = "due", "price_refresh_due"
        else:
            state, reason = "stale", "price_stale"
    elif source_kind in {"rating", "legal_document"}:
        state, reason = "current", "event_source_current"
    elif source_kind in {"run", "derived_artifact"}:
        if age <= 30:
            state, reason = "current", f"{source_kind}_current"
        elif age <= 45:
            state, reason = "due", f"{source_kind}_refresh_due"
        else:
            state, reason = "stale", f"{source_kind}_stale"
    else:  # closed TypeAlias; defensive for untyped Python callers
        return _unknown(source_kind, "source_kind_unknown", observed, period)

    return FreshnessEvaluation(
        state=state,
        source_kind=source_kind,
        observed_at=observed,
        effective_period_end=period,
        age_days=age,
        reason=reason,
    )


_FRESHNESS_SEVERITY = {"current": 0, "due": 1, "unknown": 2, "stale": 3}


def worst_freshness(
    evaluations: list[FreshnessEvaluation],
    *,
    source_kind: FreshnessSourceKind = "derived_artifact",
    missing_reason: str = "freshness_evidence_missing",
) -> FreshnessEvaluation:
    """Return the most severe proven state, failing closed when none exist."""
    if not evaluations:
        return _unknown(source_kind, missing_reason)
    return max(evaluations, key=lambda item: _FRESHNESS_SEVERITY[item.state])
