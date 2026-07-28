#!/usr/bin/env python3
"""Validate CP-1 and CP-1B Markdown interfaces required by CP-MODEL.

The general RBOT handoff validator intentionally validates the common envelope.
This focused validator enforces CP-MODEL's stable table IDs, table shapes,
controlled identifiers and cross-table referential integrity.
"""

from __future__ import annotations

import argparse
import math
import re
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Iterable

try:
    from validate_handoff import validate_text as validate_common_handoff
except ModuleNotFoundError:
    from tools.validate_handoff import validate_text as validate_common_handoff

TABLE_MARKER = re.compile(r"^\s*<!--\s*table-id:\s*([a-z0-9_.-]+)\s*-->\s*$")
SEPARATOR_CELL = re.compile(r"^:?-{3,}:?$")

CP1_TABLES = {
    "cp1.model_period_register",
    "cp1.model_account_register",
    "cp1.segment_revenue_schedule",
    "cp1.adjusted_ebitda_bridge",
    "cp1.debt_facility_register",
    "cp1.model_reconciliation_register",
    "cp1.downstream_readiness",
}
CP1B_TABLES = {
    "cp1b.model_comparator_register",
    "cp1b.model_validation_register",
    "cp1b.addback_validation_register",
    "cp1b.model_readiness",
}

METRIC_IDS = {
    "revenue",
    "cogs",
    "gross_profit",
    "opex_including_da",
    "ebit",
    "depreciation_amortization",
    "ebitda",
    "adjusted_ebitda",
    "cash_interest_paid",
    "cash_lease_payments",
    "cash_taxes_paid",
    "cfo_ncfo",
    "working_capital_change",
    "capex_and_intangible_investment",
    "acquisitions_disposals",
    "net_debt_issue_repay",
    "net_equity_issue_repay",
    "dividends_paid",
    "other_investing_financing",
    "net_cash_change",
    "cash_and_equivalents",
    "rcf_commitment",
    "rcf_drawn",
    "senior_secured_debt",
    "unsecured_debt",
    "total_debt",
    "net_accounts_receivable",
    "inventory",
    "accounts_payable",
    "pretax_income",
    "income_tax_expense",
    "effective_tax_rate",
}

FLOW_ACCOUNT_METRICS = {
    "revenue",
    "cogs",
    "opex_including_da",
    "depreciation_amortization",
    "ebitda",
    "adjusted_ebitda",
    "cash_interest_paid",
    "cash_lease_payments",
    "cash_taxes_paid",
    "cfo_ncfo",
    "working_capital_change",
    "capex_and_intangible_investment",
    "acquisitions_disposals",
    "net_debt_issue_repay",
    "net_equity_issue_repay",
    "dividends_paid",
    "other_investing_financing",
    "net_cash_change",
}

BALANCE_ACCOUNT_METRICS = {
    "cash_and_equivalents",
    "rcf_commitment",
    "rcf_drawn",
    "senior_secured_debt",
    "unsecured_debt",
    "total_debt",
    "net_accounts_receivable",
    "inventory",
    "accounts_payable",
}

MANDATORY_ACCOUNT_METRICS = FLOW_ACCOUNT_METRICS | BALANCE_ACCOUNT_METRICS

SIGN_CONVENTIONS = {
    "POSITIVE_INFLOW",
    "NEGATIVE_OUTFLOW",
    "POSITIVE_BALANCE",
    "SIGNED_AS_REPORTED",
}

SEGMENT_TYPES = {"OPERATING_SEGMENT", "CORPORATE_ELIMINATION"}
ADDBACK_CLASSIFICATIONS = {
    "RESTRUCTURING",
    "SBC",
    "COST_SAVINGS",
    "RUN_RATE",
    "SYNERGY",
    "TRANSACTION_COSTS",
    "OTHER_EXPLICIT",
}
SOURCE_STATUSES = {
    "Verified",
    "Calculated",
    "Partial",
    "Conflicted",
    "Not Available",
}
PERIOD_TYPES = {"QUARTER", "YTD", "FY", "LTM", "PERIOD_END"}
AUDIT_STATUSES = {"AUDITED", "UNAUDITED", "CALCULATED", "NOT_STATED"}
PERIOD_UNITS = {"UNITS", "THOUSANDS", "MILLIONS"}
PERIOD_ID = re.compile(r"^[A-Z0-9_-]+$")
NULL_TEXT = {"", "null", "n/a", "not available", "not calculable", "-"}
REQUIRED_CP1B_VALIDATION_METRICS = {
    "revenue",
    "ebitda",
    "adjusted_ebitda",
    "cfo_ncfo",
    "capex_and_intangible_investment",
    "total_debt",
    "cash_and_equivalents",
}


class ContractError(ValueError):
    """Raised when a table cannot be parsed as a deterministic contract."""


@dataclass(frozen=True)
class ValidationResult:
    errors: tuple[str, ...]
    warnings: tuple[str, ...]

    @property
    def ok(self) -> bool:
        return not self.errors


class TableRows(list[dict[str, str]]):
    """Parsed rows that retain the declared header for valid empty registers."""

    def __init__(self, headers: list[str]) -> None:
        super().__init__()
        self.headers = tuple(headers)


def _split_row(line: str) -> list[str]:
    text = line.strip()
    if not text.startswith("|"):
        raise ContractError(f"expected Markdown table row, got: {line!r}")
    return [cell.strip() for cell in text.strip("|").split("|")]


def _normalise_header(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")


def parse_stable_tables(markdown: str) -> dict[str, TableRows]:
    """Parse only Markdown tables immediately following stable table markers."""
    lines = markdown.splitlines()
    tables: dict[str, TableRows] = {}
    index = 0
    while index < len(lines):
        marker = TABLE_MARKER.match(lines[index])
        if not marker:
            index += 1
            continue
        table_id = marker.group(1)
        if table_id in tables:
            raise ContractError(f"duplicate table-id marker: {table_id}")
        index += 1
        while index < len(lines) and not lines[index].strip():
            index += 1
        if index + 1 >= len(lines):
            raise ContractError(f"{table_id}: missing Markdown table")
        headers = [_normalise_header(value) for value in _split_row(lines[index])]
        separator = _split_row(lines[index + 1])
        if len(headers) != len(separator) or not all(
            SEPARATOR_CELL.match(cell.replace(" ", "")) for cell in separator
        ):
            raise ContractError(f"{table_id}: invalid Markdown separator row")
        if len(set(headers)) != len(headers) or any(not header for header in headers):
            raise ContractError(f"{table_id}: empty or duplicate header")
        index += 2
        rows = TableRows(headers)
        while index < len(lines) and lines[index].lstrip().startswith("|"):
            values = _split_row(lines[index])
            if len(values) != len(headers):
                raise ContractError(
                    f"{table_id}: row has {len(values)} cells; expected {len(headers)}"
                )
            rows.append(dict(zip(headers, values, strict=True)))
            index += 1
        tables[table_id] = rows
    return tables


def _number(value: str, *, field: str, errors: list[str]) -> float | None:
    text = value.strip()
    if text.lower() in {"", "null", "n/a", "not available", "not calculable", "-"}:
        return None
    negative = text.startswith("(") and text.endswith(")")
    cleaned = text.strip("()").replace(",", "").replace("$", "")
    percent = cleaned.endswith("%")
    if percent:
        cleaned = cleaned[:-1]
    try:
        parsed = float(cleaned)
    except ValueError:
        errors.append(f"{field}: invalid numeric value {value!r}")
        return None
    if not math.isfinite(parsed):
        errors.append(f"{field}: numeric value must be finite, got {value!r}")
        return None
    if negative:
        parsed = -parsed
    return parsed / 100 if percent else parsed


def _list(value: str) -> list[str]:
    if value.strip().lower() in {"", "null", "-", "[]"}:
        return []
    return [part.strip() for part in re.split(r"[;,]", value) if part.strip()]


def _boolean(value: str, *, field: str, errors: list[str]) -> bool | None:
    text = value.strip().lower()
    if text == "true":
        return True
    if text == "false":
        return False
    errors.append(f"{field}: invalid boolean value {value!r}")
    return None


def _positive_integer(value: str, *, field: str, errors: list[str]) -> int | None:
    try:
        parsed = int(value)
    except ValueError:
        errors.append(f"{field}: invalid positive integer {value!r}")
        return None
    if parsed < 1:
        errors.append(f"{field}: must be at least 1")
        return None
    return parsed


def _iso_date(value: str, *, field: str, errors: list[str]) -> date | None:
    if re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value) is None:
        errors.append(f"{field}: invalid ISO date {value!r}")
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        errors.append(f"{field}: invalid ISO date {value!r}")
        return None


def _validate_envelopes(
    cp1_markdown: str,
    cp1b_markdown: str,
    errors: list[str],
) -> None:
    """Validate common handoff envelopes and matching issuer/reporting scope."""
    results = {
        "CP-1": validate_common_handoff(cp1_markdown, expected_module="CP-1"),
        "CP-1B": validate_common_handoff(cp1b_markdown, expected_module="CP-1B"),
    }
    for module_id, result in results.items():
        errors.extend(f"{module_id} common envelope: {error}" for error in result.errors)
        errors.extend(
            f"{module_id} common envelope: {mismatch}"
            for mismatch in result.identity_mismatches
        )
        if result.fields is not None and result.fields.get("qa_status") == "Blocked":
            errors.append(f"{module_id} common envelope: qa_status is Blocked")

    cp1_fields = results["CP-1"].fields
    cp1b_fields = results["CP-1B"].fields
    if not cp1_fields or not cp1b_fields:
        return
    for field in ("issuer_name", "issuer_id", "reporting_period"):
        if cp1_fields.get(field) != cp1b_fields.get(field):
            errors.append(
                f"CP-1/CP-1B envelope mismatch for {field}: "
                f"{cp1_fields.get(field)!r} != {cp1b_fields.get(field)!r}"
            )


def _require_columns(
    tables: dict[str, TableRows],
    table_id: str,
    columns: Iterable[str],
    errors: list[str],
    *,
    allow_empty: bool = False,
) -> None:
    rows = tables.get(table_id)
    if rows is None:
        return
    if not rows and not allow_empty:
        errors.append(f"{table_id}: table must contain at least one data row")
        return
    declared = set(rows[0]) if rows else set(rows.headers)
    missing = set(columns) - declared
    if missing:
        errors.append(f"{table_id}: missing columns {sorted(missing)}")


def _parse_model_tables(
    cp1_markdown: str,
    cp1b_markdown: str,
    errors: list[str],
) -> tuple[
    dict[str, TableRows] | None,
    dict[str, TableRows] | None,
]:
    parsed: list[dict[str, TableRows] | None] = []
    for module_id, markdown in (
        ("CP-1", cp1_markdown),
        ("CP-1B", cp1b_markdown),
    ):
        try:
            parsed.append(parse_stable_tables(markdown))
        except ContractError as exc:
            errors.append(f"{module_id} table parse: {exc}")
            parsed.append(None)
    return parsed[0], parsed[1]


def _validate_cp1b_model_rows(
    rows: Iterable[dict[str, str]],
    account_values: dict[tuple[str, str], float | None],
    errors: list[str],
) -> set[tuple[str, str]]:
    """Validate every independent field even when a row has an unknown key."""
    validation_keys: set[tuple[str, str]] = set()
    for row_index, row in enumerate(rows, 1):
        key = (row.get("metric_id", ""), row.get("period_id", ""))
        if key in validation_keys:
            errors.append(f"duplicate CP-1B validation key: {key}")
        validation_keys.add(key)

        known_key = key in account_values
        if not known_key:
            errors.append(
                f"CP-1B validation row {row_index}: unknown CP-1 account key {key}"
            )
        cp1_value = _number(
            row.get("cp1_value", ""),
            field=f"CP-1B validation {key} cp1_value",
            errors=errors,
        )
        tolerance_value = _number(
            row.get("tolerance", "0"),
            field=f"CP-1B validation {key} tolerance",
            errors=errors,
        )
        tolerance = 0 if tolerance_value is None else abs(tolerance_value)
        canonical = account_values[key] if known_key else None
        if known_key:
            if canonical is None and cp1_value is not None:
                errors.append(
                    f"CP-1B validation {key}: attempts to replace null CP-1 value"
                )
            elif canonical is not None and (
                cp1_value is None
                or not math.isclose(
                    canonical,
                    cp1_value,
                    rel_tol=0.0,
                    abs_tol=tolerance,
                )
            ):
                errors.append(
                    f"CP-1B validation {key}: cp1_value does not match canonical CP-1"
                )

        comparison = _number(
            row.get("cp1b_comparison_value", ""),
            field=f"CP-1B validation {key} comparison",
            errors=errors,
        )
        status = row.get("status")
        if (
            known_key
            and canonical is not None
            and comparison is not None
            and abs(canonical - comparison) > tolerance
            and status == "PASS"
        ):
            errors.append(
                f"CP-1B validation {key}: mismatched comparison cannot PASS"
            )
        if status not in {"PASS", "WARN", "BLOCK"}:
            errors.append(f"CP-1B validation {key}: invalid status")
        elif status == "BLOCK":
            errors.append(f"CP-1B validation BLOCK: {key}")
    return validation_keys


def validate_cp_model_inputs(cp1_markdown: str, cp1b_markdown: str) -> ValidationResult:
    """Return all deterministic CP-MODEL input errors and non-blocking warnings."""
    errors: list[str] = []
    warnings: list[str] = []
    _validate_envelopes(cp1_markdown, cp1b_markdown, errors)
    cp1, cp1b = _parse_model_tables(cp1_markdown, cp1b_markdown, errors)
    if cp1 is None or cp1b is None:
        return ValidationResult(tuple(errors), tuple(warnings))

    missing_cp1 = CP1_TABLES - set(cp1)
    missing_cp1b = CP1B_TABLES - set(cp1b)
    if missing_cp1:
        errors.append(f"CP-1 missing stable tables: {sorted(missing_cp1)}")
    if missing_cp1b:
        errors.append(f"CP-1B missing stable tables: {sorted(missing_cp1b)}")

    required_columns = {
        "cp1.model_period_register": {
            "period_id", "fiscal_year", "fiscal_quarter", "period_type",
            "start_date", "end_date", "day_count", "audit_status", "currency",
            "unit", "accounting_basis", "entity_perimeter", "source_id",
            "source_locator", "component_period_ids",
        },
        "cp1.model_account_register": {
            "metric_id", "period_id", "value", "sign_convention", "value_class",
            "calculation_status", "source_id", "source_locator",
            "conflict_refs", "limitation_refs",
        },
        "cp1.segment_revenue_schedule": {
            "segment_id", "segment_name", "segment_type", "display_priority",
            "period_id", "revenue", "status", "source_id", "source_locator",
        },
        "cp1.adjusted_ebitda_bridge": {
            "addback_id", "addback_label", "addback_classification",
            "display_priority", "period_id", "value", "status",
            "source_definition", "source_id", "source_locator",
        },
        "cp1.debt_facility_register": {
            "facility_id", "facility_name", "period_id", "facility_type",
            "carrying_value", "principal", "drawn_amount", "commitment",
            "secured_status", "seniority", "currency", "margin_or_coupon",
            "maturity_date", "lease_classification", "source_id", "source_locator",
        },
        "cp1.model_reconciliation_register": {
            "check_id", "period_id", "check_type", "reported_value",
            "calculated_value", "difference", "tolerance", "status",
            "explanation", "source_refs",
        },
        "cp1.downstream_readiness": {
            "downstream_module", "status", "missing_metric_ids",
            "conflict_refs", "explanation",
        },
        "cp1b.model_comparator_register": {
            "metric_id", "current_period_id", "reference_period_id",
            "comparison_basis", "current_value", "reference_value",
            "absolute_change", "percentage_change", "calculation_status",
            "restatement_flag", "basis_change_flag", "perimeter_change_flag",
            "definition_change_flag",
        },
        "cp1b.model_validation_register": {
            "metric_id", "period_id", "cp1_value", "cp1b_comparison_value",
            "difference", "tolerance", "status", "explanation",
            "source_or_conflict_ref",
        },
        "cp1b.addback_validation_register": {
            "addback_id", "period_id", "cp1_value", "cp1b_comparison_value",
            "difference", "tolerance", "status", "label_match",
            "definition_change_flag", "explanation", "source_or_conflict_ref",
        },
        "cp1b.model_readiness": {
            "downstream_module", "status", "blocking_metric_ids",
            "blocking_period_ids", "conflict_refs", "explanation",
        },
    }
    for table_id, columns in required_columns.items():
        _require_columns(
            cp1 if table_id.startswith("cp1.") else cp1b,
            table_id,
            columns,
            errors,
            allow_empty=table_id in {
                "cp1.segment_revenue_schedule",
                "cp1.adjusted_ebitda_bridge",
                "cp1b.addback_validation_register",
            },
        )

    periods = cp1.get("cp1.model_period_register", [])
    period_ids: set[str] = set()
    period_rows: dict[str, dict[str, str]] = {}
    for row_index, row in enumerate(periods, 1):
        period_id = row.get("period_id", "")
        if not period_id:
            errors.append(f"cp1.model_period_register row {row_index}: missing period_id")
            continue
        if PERIOD_ID.fullmatch(period_id) is None:
            errors.append(f"{period_id}: invalid period_id")
        if period_id in period_ids:
            errors.append(f"duplicate period_id: {period_id}")
        period_ids.add(period_id)
        period_rows[period_id] = row
        try:
            fiscal_year = int(row.get("fiscal_year", ""))
        except ValueError:
            fiscal_year = None
        if fiscal_year is None or not 1900 <= fiscal_year <= 2200:
            errors.append(f"{period_id}: invalid fiscal_year")
        period_type = row.get("period_type", "")
        if period_type not in PERIOD_TYPES:
            errors.append(f"{period_id}: invalid period_type {period_type!r}")
        start_text = row.get("start_date", "")
        start_date = (
            None
            if start_text.strip().lower() in NULL_TEXT
            else _iso_date(
                start_text,
                field=f"{period_id} start_date",
                errors=errors,
            )
        )
        end_date = _iso_date(
            row.get("end_date", ""),
            field=f"{period_id} end_date",
            errors=errors,
        )
        day_count_text = row.get("day_count", "")
        day_count = (
            None
            if day_count_text.strip().lower() in NULL_TEXT
            else _positive_integer(
                day_count_text,
                field=f"{period_id} day_count",
                errors=errors,
            )
        )
        if start_date is not None and end_date is not None:
            if start_date > end_date:
                errors.append(f"{period_id}: start_date is after end_date")
            elif day_count is not None and day_count != (end_date - start_date).days + 1:
                errors.append(
                    f"{period_id}: day_count {day_count} does not match inclusive dates"
                )
        fiscal_quarter = row.get("fiscal_quarter", "").strip().lower()
        if period_type == "QUARTER" and fiscal_quarter not in {"1", "2", "3", "4"}:
            errors.append(f"{period_id}: QUARTER requires fiscal_quarter 1-4")
        if period_type != "QUARTER" and fiscal_quarter not in {"", "null", "-", "n/a"}:
            errors.append(f"{period_id}: {period_type} must not set fiscal_quarter")
        if row.get("audit_status") not in AUDIT_STATUSES:
            errors.append(f"{period_id}: invalid audit_status")
        if len(row.get("currency", "").strip()) < 3:
            errors.append(f"{period_id}: invalid currency")
        if row.get("unit") not in PERIOD_UNITS:
            errors.append(f"{period_id}: invalid unit")
        for field in ("accounting_basis", "entity_perimeter"):
            if not row.get(field, "").strip():
                errors.append(f"{period_id}: missing {field}")
    for row in periods:
        period_id = row.get("period_id", "<missing>")
        components = _list(row.get("component_period_ids", ""))
        if row.get("audit_status") == "CALCULATED" and not components:
            errors.append(f"{period_id}: calculated period has no component_period_ids")
        if len(components) != len(set(components)):
            errors.append(f"{period_id}: duplicate component_period_ids")
        unknown = set(components) - period_ids
        if unknown:
            errors.append(f"{period_id}: unknown component periods {sorted(unknown)}")

    accounts = cp1.get("cp1.model_account_register", [])
    account_keys: set[tuple[str, str]] = set()
    account_values: dict[tuple[str, str], float | None] = {}
    present_metrics: set[str] = set()
    for row_index, row in enumerate(accounts, 1):
        metric_id = row.get("metric_id", "")
        period_id = row.get("period_id", "")
        key = (metric_id, period_id)
        if metric_id not in METRIC_IDS:
            errors.append(f"account row {row_index}: unknown metric_id {metric_id!r}")
        if period_id not in period_ids:
            errors.append(f"account {key}: unknown period_id")
        if key in account_keys:
            errors.append(f"duplicate account key: {key}")
        account_keys.add(key)
        present_metrics.add(metric_id)
        if row.get("sign_convention") not in SIGN_CONVENTIONS:
            errors.append(f"account {key}: invalid sign_convention")
        value = _number(row.get("value", ""), field=f"account {key} value", errors=errors)
        account_values[key] = value
        if row.get("calculation_status") in {"Not Available", "Not Calculable"} and value == 0:
            errors.append(f"account {key}: zero cannot stand in for unavailable/null")
        if value is not None and not row.get("source_locator") and row.get("value_class") != "CALCULATED":
            errors.append(f"account {key}: sourced value missing source_locator")
    missing_metrics = MANDATORY_ACCOUNT_METRICS - present_metrics
    if missing_metrics:
        errors.append(f"model account register missing mandatory metrics: {sorted(missing_metrics)}")

    accounts_by_period: dict[str, dict[str, float | None]] = {}
    for (metric_id, period_id), value in account_values.items():
        accounts_by_period.setdefault(period_id, {})[metric_id] = value
    flow_period_ids = [
        period_id
        for period_id, row in period_rows.items()
        if row.get("period_type") in {"QUARTER", "YTD", "FY"}
    ]
    for period_id in flow_period_ids:
        period_accounts = accounts_by_period.get(period_id, {})
        missing = FLOW_ACCOUNT_METRICS - set(period_accounts)
        if missing:
            errors.append(f"{period_id}: missing mandatory flow metrics {sorted(missing)}")
        nulls = sorted(
            metric_id
            for metric_id in FLOW_ACCOUNT_METRICS & set(period_accounts)
            if period_accounts[metric_id] is None
        )
        if nulls:
            errors.append(f"{period_id}: mandatory flow metrics are null {nulls}")

        end_date = period_rows[period_id].get("end_date")
        balance_candidates = [
            candidate_id
            for candidate_id, candidate in period_rows.items()
            if candidate.get("end_date") == end_date
            and candidate.get("currency") == period_rows[period_id].get("currency")
            and candidate.get("unit") == period_rows[period_id].get("unit")
            and candidate.get("accounting_basis") == period_rows[period_id].get("accounting_basis")
            and candidate.get("entity_perimeter") == period_rows[period_id].get("entity_perimeter")
        ]
        balance_accounts: dict[str, float | None] = {}
        for candidate_id in balance_candidates:
            balance_accounts.update(accounts_by_period.get(candidate_id, {}))
        missing_balances = BALANCE_ACCOUNT_METRICS - set(balance_accounts)
        if missing_balances:
            errors.append(
                f"{period_id}: no matching period-end coverage for {sorted(missing_balances)}"
            )
        null_balances = sorted(
            metric_id
            for metric_id in BALANCE_ACCOUNT_METRICS & set(balance_accounts)
            if balance_accounts[metric_id] is None
        )
        if null_balances:
            errors.append(f"{period_id}: mandatory balance metrics are null {null_balances}")

        effective_rate = period_accounts.get("effective_tax_rate")
        pretax_income = period_accounts.get("pretax_income")
        tax_expense = period_accounts.get("income_tax_expense")
        if effective_rate is None and (pretax_income is None or tax_expense is None):
            errors.append(
                f"{period_id}: Tax Rate requires effective_tax_rate or pretax_income plus income_tax_expense"
            )

    for table_id in (
        "cp1.segment_revenue_schedule",
        "cp1.adjusted_ebitda_bridge",
        "cp1.debt_facility_register",
        "cp1.model_reconciliation_register",
    ):
        for row_index, row in enumerate(cp1.get(table_id, []), 1):
            if row.get("period_id") not in period_ids:
                errors.append(f"{table_id} row {row_index}: unknown period_id")

    reconciliations = cp1.get("cp1.model_reconciliation_register", [])
    reconciliations_by_period: dict[str, list[dict[str, str]]] = {}
    for row in reconciliations:
        reconciliations_by_period.setdefault(row.get("period_id", ""), []).append(row)

    segment_keys: set[tuple[str, str]] = set()
    segment_definitions: dict[str, tuple[str, str, int]] = {}
    segments_by_period: dict[str, list[float | None]] = {}
    corporate_segments_by_period: dict[str, list[str]] = {}
    for row_index, row in enumerate(cp1.get("cp1.segment_revenue_schedule", []), 1):
        segment_id = row.get("segment_id", "").strip()
        period_id = row.get("period_id", "")
        key = (segment_id, period_id)
        if not segment_id:
            errors.append(f"segment row {row_index}: missing segment_id")
        if key in segment_keys:
            errors.append(f"duplicate segment key: {key}")
        segment_keys.add(key)
        segment_name = row.get("segment_name", "").strip()
        if not segment_name:
            errors.append(f"segment {key}: missing segment_name")
        segment_type = row.get("segment_type", "")
        if segment_type not in SEGMENT_TYPES:
            errors.append(f"segment {key}: invalid segment_type")
        elif segment_type == "CORPORATE_ELIMINATION":
            corporate_segments_by_period.setdefault(period_id, []).append(segment_id)
        if row.get("status") not in SOURCE_STATUSES:
            errors.append(f"segment {key}: invalid status")
        priority = _positive_integer(
            row.get("display_priority", ""),
            field=f"segment {key} display_priority",
            errors=errors,
        )
        if segment_id and priority is not None:
            definition = (segment_name, segment_type, priority)
            prior_definition = segment_definitions.setdefault(segment_id, definition)
            if definition != prior_definition:
                errors.append(
                    f"segment {segment_id}: name, type or display_priority changes across periods"
                )
        revenue = _number(
            row.get("revenue", ""),
            field=f"segment {key} revenue",
            errors=errors,
        )
        segments_by_period.setdefault(period_id, []).append(revenue)
        if revenue is not None and not row.get("source_locator"):
            errors.append(f"segment {key}: sourced revenue missing source_locator")

    operating_priorities: dict[int, str] = {}
    for segment_id, (_, segment_type, priority) in segment_definitions.items():
        if segment_type != "OPERATING_SEGMENT":
            continue
        prior_owner = operating_priorities.setdefault(priority, segment_id)
        if prior_owner != segment_id:
            errors.append(
                "operating segments have duplicate display_priority "
                f"{priority}: {prior_owner}, {segment_id}"
            )
    for period_id, segment_ids in corporate_segments_by_period.items():
        if len(segment_ids) > 1:
            errors.append(
                f"{period_id}: expected at most one CORPORATE_ELIMINATION row, "
                f"found {segment_ids}"
            )

    for period_id in flow_period_ids:
        values = segments_by_period.get(period_id, [])
        checks = [
            row for row in reconciliations_by_period.get(period_id, [])
            if row.get("check_type") in {
                "SEGMENT_REVENUE",
                "SEGMENT_REVENUE_TO_REPORTED",
            }
        ]
        if len(checks) != 1:
            errors.append(
                f"{period_id}: expected exactly one segment revenue reconciliation"
            )
            continue
        check = checks[0]
        tolerance = _number(
            check.get("tolerance", "0"),
            field=f"{period_id} segment reconciliation tolerance",
            errors=errors,
        )
        tolerance = 0 if tolerance is None else abs(tolerance)
        expected_calculated = (
            None
            if not values or any(value is None for value in values)
            else sum(values)
        )
        expected_reported = account_values.get(("revenue", period_id))
        stated_calculated = _number(
            check.get("calculated_value", ""),
            field=f"{period_id} segment reconciliation calculated_value",
            errors=errors,
        )
        stated_reported = _number(
            check.get("reported_value", ""),
            field=f"{period_id} segment reconciliation reported_value",
            errors=errors,
        )
        if not values:
            if stated_calculated is not None:
                errors.append(
                    f"{period_id}: empty segment schedule must reconcile to null"
                )
            if check.get("status") != "WARN" or not check.get("explanation", "").strip():
                errors.append(
                    f"{period_id}: empty segment schedule requires an explained WARN reconciliation"
                )
        elif expected_calculated is None:
            errors.append(f"{period_id}: segment revenue schedule contains null values")
        elif stated_calculated is None or not math.isclose(
            expected_calculated,
            stated_calculated,
            rel_tol=0.0,
            abs_tol=tolerance,
        ):
            errors.append(
                f"{period_id}: segment reconciliation does not match schedule sum"
            )
        if expected_reported is not None and (
            stated_reported is None
            or not math.isclose(
                expected_reported,
                stated_reported,
                rel_tol=0.0,
                abs_tol=tolerance,
            )
        ):
            errors.append(
                f"{period_id}: segment reconciliation does not match reported revenue"
            )
        if (
            expected_calculated is not None
            and expected_reported is not None
            and abs(expected_reported - expected_calculated) > tolerance
            and check.get("status") == "PASS"
        ):
            errors.append(
                f"{period_id}: segment revenue difference outside tolerance cannot PASS"
            )

    addback_keys: set[tuple[str, str]] = set()
    addback_definitions: dict[str, tuple[str, str, int, str]] = {}
    addback_values: dict[tuple[str, str], float | None] = {}
    addbacks_by_period: dict[str, list[float | None]] = {}
    for row_index, row in enumerate(cp1.get("cp1.adjusted_ebitda_bridge", []), 1):
        addback_id = row.get("addback_id", "").strip()
        period_id = row.get("period_id", "")
        key = (addback_id, period_id)
        if not addback_id:
            errors.append(f"add-back row {row_index}: missing addback_id")
        if key in addback_keys:
            errors.append(f"duplicate add-back key: {key}")
        addback_keys.add(key)
        label = row.get("addback_label", "").strip()
        if not label:
            errors.append(f"add-back {key}: missing addback_label")
        classification = row.get("addback_classification", "")
        if classification not in ADDBACK_CLASSIFICATIONS:
            errors.append(f"add-back {key}: invalid addback_classification")
        if row.get("status") not in SOURCE_STATUSES:
            errors.append(f"add-back {key}: invalid status")
        priority = _positive_integer(
            row.get("display_priority", ""),
            field=f"add-back {key} display_priority",
            errors=errors,
        )
        source_definition = row.get("source_definition", "").strip()
        if not source_definition:
            errors.append(f"add-back {key}: missing source_definition")
        if addback_id and priority is not None:
            definition = (label, classification, priority, source_definition)
            prior_definition = addback_definitions.setdefault(addback_id, definition)
            if definition != prior_definition:
                errors.append(
                    f"add-back {addback_id}: label, classification, priority or definition changes across periods"
                )
        value = _number(
            row.get("value", ""),
            field=f"add-back {key} value",
            errors=errors,
        )
        addback_values[key] = value
        addbacks_by_period.setdefault(period_id, []).append(value)
        if value is not None and not row.get("source_locator"):
            errors.append(f"add-back {key}: sourced value missing source_locator")

    addback_priorities: dict[int, str] = {}
    for addback_id, (_, _, priority, _) in addback_definitions.items():
        prior_owner = addback_priorities.setdefault(priority, addback_id)
        if prior_owner != addback_id:
            errors.append(
                "add-backs have duplicate display_priority "
                f"{priority}: {prior_owner}, {addback_id}"
            )

    for period_id in flow_period_ids:
        checks = [
            row for row in reconciliations_by_period.get(period_id, [])
            if row.get("check_type") == "ADJUSTED_EBITDA_BRIDGE"
        ]
        if len(checks) != 1:
            errors.append(
                f"{period_id}: expected exactly one adjusted EBITDA bridge reconciliation"
            )
            continue
        check = checks[0]
        tolerance = _number(
            check.get("tolerance", "0"),
            field=f"{period_id} adjusted EBITDA reconciliation tolerance",
            errors=errors,
        )
        tolerance = 0 if tolerance is None else abs(tolerance)
        period_addbacks = addbacks_by_period.get(period_id, [])
        if any(value is None for value in period_addbacks):
            errors.append(f"{period_id}: adjusted EBITDA bridge contains null values")
            continue
        addback_sum = sum(period_addbacks)
        ebitda = account_values.get(("ebitda", period_id))
        adjusted_ebitda = account_values.get(("adjusted_ebitda", period_id))
        if ebitda is None or adjusted_ebitda is None:
            continue
        expected_calculated = ebitda + addback_sum
        stated_reported = _number(
            check.get("reported_value", ""),
            field=f"{period_id} adjusted EBITDA reconciliation reported_value",
            errors=errors,
        )
        stated_calculated = _number(
            check.get("calculated_value", ""),
            field=f"{period_id} adjusted EBITDA reconciliation calculated_value",
            errors=errors,
        )
        if stated_reported is None or not math.isclose(
            adjusted_ebitda,
            stated_reported,
            rel_tol=0.0,
            abs_tol=tolerance,
        ):
            errors.append(
                f"{period_id}: adjusted EBITDA reconciliation does not match reported value"
            )
        if stated_calculated is None or not math.isclose(
            expected_calculated,
            stated_calculated,
            rel_tol=0.0,
            abs_tol=tolerance,
        ):
            errors.append(
                f"{period_id}: adjusted EBITDA reconciliation does not match add-back sum"
            )
        if not math.isclose(
            adjusted_ebitda,
            expected_calculated,
            rel_tol=0.0,
            abs_tol=tolerance,
        ):
            errors.append(
                f"{period_id}: adjusted EBITDA does not equal EBITDA plus identified add-backs"
            )

    facility_keys: set[tuple[str, str]] = set()
    for row_index, row in enumerate(
        cp1.get("cp1.debt_facility_register", []),
        1,
    ):
        facility_id = row.get("facility_id", "").strip()
        period_id = row.get("period_id", "").strip()
        key = (facility_id, period_id)
        if not facility_id:
            errors.append(f"debt facility row {row_index}: missing facility_id")
        if key in facility_keys:
            errors.append(f"duplicate debt facility key: {key}")
        facility_keys.add(key)

        carrying = _number(
            row.get("carrying_value", ""),
            field=f"facility {facility_id} carrying_value",
            errors=errors,
        )
        principal = _number(
            row.get("principal", ""),
            field=f"facility {facility_id} principal",
            errors=errors,
        )
        if carrying is None and principal is not None:
            errors.append(
                f"facility {facility_id}: principal cannot substitute for carrying_value"
            )
        if carrying is not None and not row.get("source_locator", "").strip():
            errors.append(f"facility {facility_id}: carrying_value missing source_locator")

    for row in reconciliations:
        if row.get("status") not in {"PASS", "WARN", "BLOCK"}:
            errors.append(
                f"CP-1 reconciliation has invalid status: {row.get('check_id')}"
            )
        elif row.get("status") == "BLOCK":
            errors.append(f"CP-1 reconciliation BLOCK: {row.get('check_id')}")

    cp1_ready = [
        row for row in cp1.get("cp1.downstream_readiness", [])
        if row.get("downstream_module") == "CP-MODEL"
    ]
    if len(cp1_ready) != 1 or cp1_ready[0].get("status") != "ready":
        errors.append("CP-1 CP-MODEL readiness must contain exactly one ready row")

    allowed_comparisons = {"YOY_SAME_QUARTER", "SEQUENTIAL", "YTD_PRIOR", "LTM_PRIOR"}
    for row_index, row in enumerate(cp1b.get("cp1b.model_comparator_register", []), 1):
        metric_id = row.get("metric_id", "")
        if metric_id not in present_metrics:
            errors.append(f"CP-1B comparator row {row_index}: unknown CP-1 metric_id")
        for field in ("current_period_id", "reference_period_id"):
            if row.get(field) not in period_ids:
                errors.append(f"CP-1B comparator row {row_index}: unknown {field}")
        if row.get("comparison_basis") not in allowed_comparisons:
            errors.append(f"CP-1B comparator row {row_index}: invalid comparison_basis")

    validation_keys = _validate_cp1b_model_rows(
        cp1b.get("cp1b.model_validation_register", []),
        account_values,
        errors,
    )

    required_validation_keys = {
        (metric_id, period_id)
        for period_id in flow_period_ids
        for metric_id in REQUIRED_CP1B_VALIDATION_METRICS
    }
    missing_validation_keys = required_validation_keys - validation_keys
    if missing_validation_keys:
        errors.append(
            "CP-1B missing required model validations "
            "(revenue, EBITDA, adjusted EBITDA, CFO/NCFO, FCF inputs, debt and cash): "
            f"{sorted(missing_validation_keys)}"
        )

    validated_addback_keys: set[tuple[str, str]] = set()
    for row_index, row in enumerate(
        cp1b.get("cp1b.addback_validation_register", []), 1
    ):
        key = (row.get("addback_id", ""), row.get("period_id", ""))
        if key in validated_addback_keys:
            errors.append(f"duplicate CP-1B add-back validation key: {key}")
        validated_addback_keys.add(key)
        if key not in addback_values:
            errors.append(
                f"CP-1B add-back validation row {row_index}: unknown CP-1 add-back key {key}"
            )
            continue
        canonical = addback_values[key]
        cp1_value = _number(
            row.get("cp1_value", ""),
            field=f"CP-1B add-back validation {key} cp1_value",
            errors=errors,
        )
        comparison = _number(
            row.get("cp1b_comparison_value", ""),
            field=f"CP-1B add-back validation {key} comparison",
            errors=errors,
        )
        tolerance = _number(
            row.get("tolerance", "0"),
            field=f"CP-1B add-back validation {key} tolerance",
            errors=errors,
        )
        tolerance = 0 if tolerance is None else abs(tolerance)
        if canonical is None and cp1_value is not None:
            errors.append(
                f"CP-1B add-back validation {key}: attempts to replace null CP-1 value"
            )
        elif canonical is not None and (
            cp1_value is None
            or not math.isclose(
                canonical,
                cp1_value,
                rel_tol=0.0,
                abs_tol=tolerance,
            )
        ):
            errors.append(
                f"CP-1B add-back validation {key}: cp1_value does not match canonical CP-1"
            )
        if (
            canonical is not None
            and comparison is not None
            and abs(canonical - comparison) > tolerance
            and row.get("status") == "PASS"
        ):
            errors.append(
                f"CP-1B add-back validation {key}: mismatched comparison cannot PASS"
            )
        label_match = _boolean(
            row.get("label_match", ""),
            field=f"CP-1B add-back validation {key} label_match",
            errors=errors,
        )
        definition_change = _boolean(
            row.get("definition_change_flag", ""),
            field=f"CP-1B add-back validation {key} definition_change_flag",
            errors=errors,
        )
        if label_match is False:
            errors.append(f"CP-1B add-back validation {key}: label mismatch")
        if definition_change is True:
            errors.append(f"CP-1B add-back validation {key}: definition changed")
        if row.get("status") not in {"PASS", "WARN", "BLOCK"}:
            errors.append(f"CP-1B add-back validation {key}: invalid status")
        elif row.get("status") == "BLOCK":
            errors.append(f"CP-1B add-back validation BLOCK: {key}")

    missing_addback_validations = addback_keys - validated_addback_keys
    if missing_addback_validations:
        errors.append(
            "CP-1B missing add-back validations: "
            f"{sorted(missing_addback_validations)}"
        )

    cp1b_ready = [
        row for row in cp1b.get("cp1b.model_readiness", [])
        if row.get("downstream_module") == "CP-MODEL"
    ]
    if len(cp1b_ready) != 1 or cp1b_ready[0].get("status") != "ready":
        errors.append("CP-1B CP-MODEL readiness must contain exactly one ready row")

    return ValidationResult(tuple(errors), tuple(warnings))


def _self_test() -> int:
    broken = "<!-- table-id: cp1.model_period_register -->\n| period_id |\n|---|\n| Q1 |"
    result = validate_cp_model_inputs(broken, "")
    if result.ok or not result.errors:
        print("self-test failed: malformed fixtures were accepted", file=sys.stderr)
        return 1
    print("CP-MODEL input validator self-test passed")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cp1", nargs="?", type=Path, help="CP-1 canonical Markdown")
    parser.add_argument("cp1b", nargs="?", type=Path, help="CP-1B canonical Markdown")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args(argv)
    if args.self_test:
        return _self_test()
    if not args.cp1 or not args.cp1b:
        parser.error("cp1 and cp1b paths are required unless --self-test is used")
    result = validate_cp_model_inputs(
        args.cp1.read_text(encoding="utf-8"),
        args.cp1b.read_text(encoding="utf-8"),
    )
    if result.errors:
        print("CP-MODEL input validation failed:")
        for error in result.errors:
            print(f"- {error}")
        return 1
    for warning in result.warnings:
        print(f"WARN: {warning}")
    print("CP-MODEL input validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
