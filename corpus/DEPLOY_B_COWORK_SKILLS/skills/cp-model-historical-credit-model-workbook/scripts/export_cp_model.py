#!/usr/bin/env python3
"""Create a validated CP-MODEL workbook from canonical CP-1/CP-1B Markdown."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import os
import re
import tempfile
import zipfile
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence
from xml.etree import ElementTree as ET

try:
    from validate_cp_model_inputs import (
        MANDATORY_ACCOUNT_METRICS,
        parse_stable_tables,
        validate_cp_model_inputs,
    )
    from validate_handoff import validate_text as validate_common_handoff
except ModuleNotFoundError:
    from tools.validate_cp_model_inputs import (
        MANDATORY_ACCOUNT_METRICS,
        parse_stable_tables,
        validate_cp_model_inputs,
    )
    from tools.validate_handoff import validate_text as validate_common_handoff


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
PACKAGED_TEMPLATE = (
    SCRIPT_DIR.parent / "assets" / "REF_CP_MODEL_SNAPSHOT_TEMPLATE.xlsx"
)
CANONICAL_TEMPLATE = (
    ROOT
    / "Co-Pilot Agents"
    / "KNOWLEDGE SOURCES"
    / "06_WORKBOOK_TEMPLATES"
    / "REF_CP_MODEL_SNAPSHOT_TEMPLATE.xlsx"
)
TEMPLATE = PACKAGED_TEMPLATE if PACKAGED_TEMPLATE.is_file() else CANONICAL_TEMPLATE
EXPECTED_TEMPLATE_SHA256 = (
    "a0f5e3877ee284f674d78d3f303a22e2dd155a036aad35f8cf0fc8131777568f"
)

SHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
DOC_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = f"{{{SHEET_NS}}}"
ET.register_namespace("x", SHEET_NS)

ISSUER_FILE_TOKEN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
CELL_ADDRESS = re.compile(r"^(?P<column>\$?[A-Z]{1,3})(?P<absolute>\$?)(?P<row>[1-9]\d*)$")
A1_REFERENCE = re.compile(
    r"(?P<sheet>(?:'[^']+'|[A-Za-z_][A-Za-z0-9_. ]*)!)?"
    r"(?P<column>\$?[A-Z]{1,3})(?P<absolute>\$?)(?P<row>[1-9]\d*)"
)
SLOT_FIELD = re.compile(r"^business_unit_revenue_template_slot_[1-6]$")
GROWTH_FIELD = re.compile(r"^segment_yoy_growth_[1-6]$")
ADDBACK_FIELD = re.compile(r"^adjusted_ebitda_addback_template_slot_[1-4]$")
NULL_TEXT = {"", "null", "n/a", "not available", "not calculable", "-"}
FLOW_PERIOD_TYPES = {"QUARTER", "YTD", "FY"}
BALANCE_METRICS = {
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
DEBT_COMPONENT_FIELDS = {
    "rcf_drawn",
    "senior_secured_facility",
    "term_loan_b",
    "finance_lease_debt",
    "other_secured_debt",
    "senior_unsecured_notes",
    "subordinated_notes",
    "other_su_notes",
    "other_unsecured_debt",
}
DIRECT_FIELD_ALIASES = {"net_cash_change_reported": "net_cash_change"}
PROTECTED_ERROR_TOKENS = ("#REF!", "#DIV/0!", "#VALUE!", "#NAME?")


class CpModelRuntimeError(ValueError):
    """Raised when CP-MODEL would violate a workbook hard gate."""


@dataclass(frozen=True)
class RuntimePlan:
    segments: tuple[tuple[str, str, int], ...]
    addbacks: tuple[tuple[str, str, int], ...]

    @property
    def segment_rows(self) -> int:
        return len(self.segments) * 2

    @property
    def segment_delta(self) -> int:
        return self.segment_rows - 12

    @property
    def addback_start(self) -> int:
        return 29 + self.segment_delta

    @property
    def addback_delta(self) -> int:
        return len(self.addbacks) - 4

    @property
    def total_delta(self) -> int:
        return self.segment_delta + self.addback_delta

    def map_row(self, old_row: int) -> int | None:
        if 5 <= old_row <= 16 or 29 <= old_row <= 32:
            return None
        if 17 <= old_row <= 28:
            return old_row + self.segment_delta
        if old_row >= 33:
            return old_row + self.total_delta
        return old_row


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _column_number(address: str) -> int:
    match = re.match(r"^\$?([A-Z]{1,3})", address)
    if match is None:
        raise CpModelRuntimeError(f"invalid cell address: {address!r}")
    number = 0
    for character in match.group(1):
        number = number * 26 + ord(character) - ord("A") + 1
    return number


def _column_name(number: int) -> str:
    if number < 1:
        raise CpModelRuntimeError(f"invalid column number: {number}")
    result = ""
    while number:
        number, remainder = divmod(number - 1, 26)
        result = chr(ord("A") + remainder) + result
    return result


def _worksheet_member(archive: zipfile.ZipFile, sheet_name: str) -> str:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {
        relationship.attrib["Id"]: relationship.attrib["Target"]
        for relationship in relationships.findall(f"{{{PKG_REL_NS}}}Relationship")
    }
    for sheet in workbook.findall(f".//{NS}sheet"):
        if sheet.attrib.get("name") != sheet_name:
            continue
        relationship_id = sheet.attrib[f"{{{DOC_REL_NS}}}id"]
        target = targets[relationship_id].lstrip("/")
        return target if target.startswith("xl/") else f"xl/{target}"
    raise CpModelRuntimeError(f"worksheet is missing: {sheet_name}")


def _shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return [
        "".join(node.text or "" for node in item.findall(f".//{NS}t"))
        for item in root.findall(f"{NS}si")
    ]


def _cell_text(cell: ET.Element, strings: Sequence[str]) -> str:
    kind = cell.attrib.get("t")
    inline = cell.find(f"{NS}is")
    if inline is not None:
        return "".join(node.text or "" for node in inline.findall(f".//{NS}t"))
    value = cell.find(f"{NS}v")
    if value is None or value.text is None:
        return ""
    if kind == "s":
        try:
            return strings[int(value.text)]
        except (IndexError, ValueError) as exc:
            raise CpModelRuntimeError("invalid shared-string reference") from exc
    return value.text


def _map_rows(archive: zipfile.ZipFile) -> tuple[tuple[str, ...], list[dict[str, str]]]:
    member = _worksheet_member(archive, "_RBOT_MAP")
    root = ET.fromstring(archive.read(member))
    strings = _shared_strings(archive)
    parsed: list[dict[int, str]] = []
    for row in root.findall(f".//{NS}row"):
        values: dict[int, str] = {}
        for cell in row.findall(f"{NS}c"):
            address = cell.attrib.get("r")
            if address:
                values[_column_number(address)] = _cell_text(cell, strings)
        parsed.append(values)
    if not parsed:
        raise CpModelRuntimeError("_RBOT_MAP is empty")
    headers_by_column = {
        column: value for column, value in parsed[0].items() if value
    }
    headers = tuple(headers_by_column[column] for column in sorted(headers_by_column))
    if len(headers) != 17 or len(set(headers)) != len(headers):
        raise CpModelRuntimeError("_RBOT_MAP header registry is invalid")
    return headers, [
        {
            header: values.get(column, "")
            for column, header in headers_by_column.items()
        }
        for values in parsed[1:]
        if any(values.values())
    ]


def _numeric(value: str, *, field: str) -> float | None:
    text = value.strip()
    if text.lower() in NULL_TEXT:
        return None
    negative = text.startswith("(") and text.endswith(")")
    cleaned = text.strip("()").replace(",", "").replace("$", "")
    percent = cleaned.endswith("%")
    if percent:
        cleaned = cleaned[:-1]
    try:
        result = float(cleaned)
    except ValueError as exc:
        raise CpModelRuntimeError(f"{field}: invalid numeric value {value!r}") from exc
    if not math.isfinite(result):
        raise CpModelRuntimeError(f"{field}: numeric value must be finite")
    if negative:
        result = -result
    return result / 100 if percent else result


def _number_text(value: float) -> str:
    if not math.isfinite(value):
        raise CpModelRuntimeError("cannot write a non-finite workbook value")
    if abs(value) < 5e-15:
        value = 0.0
    return format(value, ".15g")


def _same_scope(left: Mapping[str, str], right: Mapping[str, str]) -> bool:
    return all(
        left.get(field) == right.get(field)
        for field in (
            "end_date",
            "currency",
            "unit",
            "accounting_basis",
            "entity_perimeter",
        )
    )


def _scale_for_period(period: Mapping[str, str]) -> float:
    unit = period.get("unit")
    try:
        return {"MILLIONS": 1.0, "THOUSANDS": 0.001, "UNITS": 0.000001}[unit]
    except KeyError as exc:
        raise CpModelRuntimeError(
            f"{period.get('period_id')}: unsupported unit {unit!r}"
        ) from exc


def _row_definitions(
    tables: Mapping[str, Sequence[Mapping[str, str]]],
) -> RuntimePlan:
    segments: dict[str, tuple[str, int]] = {}
    for row in tables["cp1.segment_revenue_schedule"]:
        if row["segment_type"] != "OPERATING_SEGMENT":
            continue
        segments.setdefault(
            row["segment_id"],
            (row["segment_name"], int(row["display_priority"])),
        )
    addbacks: dict[str, tuple[str, int]] = {}
    for row in tables["cp1.adjusted_ebitda_bridge"]:
        addbacks.setdefault(
            row["addback_id"],
            (row["addback_label"], int(row["display_priority"])),
        )
    return RuntimePlan(
        segments=tuple(
            (identifier, name, priority)
            for identifier, (name, priority) in sorted(
                segments.items(), key=lambda item: (item[1][1], item[0])
            )
        ),
        addbacks=tuple(
            (identifier, label, priority)
            for identifier, (label, priority) in sorted(
                addbacks.items(), key=lambda item: (item[1][1], item[0])
            )
        ),
    )


def _shift_references(
    text: str,
    plan: RuntimePlan,
    *,
    allow_deleted: bool = False,
) -> str:
    def replace(match: re.Match[str]) -> str:
        old_row = int(match.group("row"))
        new_row = plan.map_row(old_row)
        if new_row is None:
            if allow_deleted:
                return match.group(0)
            raise CpModelRuntimeError(
                f"surviving formula/map reference points at deleted row: {match.group(0)}"
            )
        return (
            f"{match.group('sheet') or ''}{match.group('column')}"
            f"{match.group('absolute')}{new_row}"
        )

    return A1_REFERENCE.sub(replace, text)


def _translate_clone(text: str, delta: int) -> str:
    def replace(match: re.Match[str]) -> str:
        return (
            f"{match.group('sheet') or ''}{match.group('column')}"
            f"{match.group('absolute')}{int(match.group('row')) + delta}"
        )

    return A1_REFERENCE.sub(replace, text)


def _cell_column(address: str) -> str:
    match = CELL_ADDRESS.fullmatch(address.replace("$", ""))
    if match is None:
        raise CpModelRuntimeError(f"invalid cell address: {address!r}")
    return match.group("column").replace("$", "")


def _adjustments_formula(column: str, plan: RuntimePlan) -> str:
    count = len(plan.addbacks)
    if count == 0:
        return "0"
    start = plan.addback_start
    end = start + count - 1
    cells = ",".join(f"{column}{row}" for row in range(start, end + 1))
    return (
        f'IF(COUNT({cells})<{count},"",'
        f"SUM({column}{start}:{column}{end}))"
    )


def _set_text_cell(cell: ET.Element, value: str) -> None:
    for child in list(cell):
        cell.remove(child)
    cell.attrib["t"] = "inlineStr"
    inline = ET.SubElement(cell, f"{NS}is")
    text = ET.SubElement(inline, f"{NS}t")
    if value != value.strip():
        text.attrib["{http://www.w3.org/XML/1998/namespace}space"] = "preserve"
    text.text = value


def _set_numeric_cell(cell: ET.Element, value: float) -> None:
    for child in list(cell):
        cell.remove(child)
    cell.attrib.pop("t", None)
    node = ET.SubElement(cell, f"{NS}v")
    node.text = _number_text(value)


def _transform_cloned_row(
    source: ET.Element,
    *,
    source_row: int,
    target_row: int,
    plan: RuntimePlan,
    formula_mode: str,
) -> ET.Element:
    cloned = copy.deepcopy(source)
    cloned.attrib["r"] = str(target_row)
    delta = target_row - source_row
    for cell in cloned.findall(f"{NS}c"):
        address = cell.attrib.get("r", "")
        match = CELL_ADDRESS.fullmatch(address)
        if match is None:
            raise CpModelRuntimeError(f"invalid worksheet cell address: {address!r}")
        cell.attrib["r"] = (
            f"{match.group('column')}{match.group('absolute')}{target_row}"
        )
        formula = cell.find(f"{NS}f")
        if formula is not None and formula.text:
            if formula_mode == "clone":
                formula.text = _translate_clone(formula.text, delta)
            elif formula_mode == "survivor":
                if source_row == 33:
                    formula.text = _adjustments_formula(
                        match.group("column").replace("$", ""),
                        plan,
                    )
                else:
                    formula.text = _shift_references(formula.text, plan)
            else:
                raise CpModelRuntimeError(f"unknown formula mode: {formula_mode}")
    return cloned


def _resize_worksheet(
    payload: bytes,
    plan: RuntimePlan,
    *,
    is_model: bool,
) -> bytes:
    root = ET.fromstring(payload)
    sheet_data = root.find(f"{NS}sheetData")
    if sheet_data is None:
        raise CpModelRuntimeError("worksheet has no sheetData")
    original_rows = {
        int(row.attrib["r"]): row
        for row in sheet_data.findall(f"{NS}row")
        if "r" in row.attrib
    }
    if not {5, 6, 29}.issubset(original_rows):
        raise CpModelRuntimeError("repeat-block row patterns are missing")

    # Model and _RBOT_INPUTS intentionally use the same structural transform.
    _ = is_model

    def labeled_clone(
        template_row: int,
        target_row: int,
        label_text: str,
        missing_label_error: str,
    ) -> ET.Element:
        row = _transform_cloned_row(
            original_rows[template_row],
            source_row=template_row,
            target_row=target_row,
            plan=plan,
            formula_mode="clone",
        )
        label = row.find(f"{NS}c[@r='A{target_row}']")
        if label is None:
            raise CpModelRuntimeError(missing_label_error)
        _set_text_cell(label, label_text)
        return row

    output_rows: list[ET.Element] = []
    for old_row, source in sorted(original_rows.items()):
        if 5 <= old_row <= 16:
            if old_row == 5:
                for index, (_, name, _) in enumerate(plan.segments):
                    value_row = 5 + index * 2
                    output_rows.append(
                        labeled_clone(
                            5,
                            value_row,
                            name,
                            "segment label cell pattern is missing",
                        )
                    )
                    output_rows.append(
                        _transform_cloned_row(
                            original_rows[6],
                            source_row=6,
                            target_row=value_row + 1,
                            plan=plan,
                            formula_mode="clone",
                        )
                    )
            continue

        if 29 <= old_row <= 32:
            if old_row == 29:
                for index, (_, label_text, _) in enumerate(plan.addbacks):
                    output_rows.append(
                        labeled_clone(
                            29,
                            plan.addback_start + index,
                            label_text,
                            "add-back label cell pattern is missing",
                        )
                    )
            continue

        target_row = plan.map_row(old_row)
        if target_row is None:
            raise CpModelRuntimeError(f"unexpected deleted row: {old_row}")
        output_rows.append(
            _transform_cloned_row(
                source,
                source_row=old_row,
                target_row=target_row,
                plan=plan,
                formula_mode="survivor",
            )
        )

    sheet_data[:] = output_rows

    dimension = root.find(f"{NS}dimension")
    if dimension is not None and "ref" in dimension.attrib:
        dimension.attrib["ref"] = ":".join(
            _shift_references(address, plan)
            for address in dimension.attrib["ref"].split(":", 1)
        )
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def _runtime_address(address: str, plan: RuntimePlan) -> str:
    if not address:
        return ""
    if address.startswith("ROWS "):
        return address
    if CELL_ADDRESS.fullmatch(address.replace("$", "")) is None:
        return address
    return _shift_references(address, plan)


def _clone_map_row(
    template: Mapping[str, str],
    *,
    field_id: str,
    row_delta: int,
    notes: str,
) -> dict[str, str]:
    row = dict(template)
    row["field_id"] = field_id
    row["input_cell"] = _translate_clone(row.get("input_cell", ""), row_delta)
    row["target_cell"] = _translate_clone(row.get("target_cell", ""), row_delta)
    rule = row.get("formula_rule", "")
    if A1_REFERENCE.search(rule):
        row["formula_rule"] = _translate_clone(rule, row_delta)
    row["notes"] = notes
    return row


def _remap_map_rows(
    headers: Sequence[str],
    rows: Sequence[Mapping[str, str]],
    plan: RuntimePlan,
) -> list[dict[str, str]]:
    segment_source_templates = [
        row for row in rows
        if row.get("field_id") == "business_unit_revenue_template_slot_1"
    ]
    segment_growth_templates = [
        row for row in rows if row.get("field_id") == "segment_yoy_growth_1"
    ]
    addback_templates = [
        row for row in rows
        if row.get("field_id") == "adjusted_ebitda_addback_template_slot_1"
    ]
    if not segment_source_templates or not segment_growth_templates or not addback_templates:
        raise CpModelRuntimeError("_RBOT_MAP repeat-block templates are incomplete")

    output: list[dict[str, str]] = []
    emitted_segment_sources = False
    emitted_segment_growth = False
    emitted_addbacks = False
    for source in rows:
        field_id = source.get("field_id", "")
        if SLOT_FIELD.fullmatch(field_id):
            if emitted_segment_sources:
                continue
            emitted_segment_sources = True
            for index, (segment_id, segment_name, _) in enumerate(plan.segments):
                delta = index * 2
                for template in segment_source_templates:
                    output.append(
                        _clone_map_row(
                            template,
                            field_id=f"segment_revenue::{segment_id}",
                            row_delta=delta,
                            notes=f"Runtime segment source: {segment_name} ({segment_id}).",
                        )
                    )
            continue
        if GROWTH_FIELD.fullmatch(field_id):
            if emitted_segment_growth:
                continue
            emitted_segment_growth = True
            for index, (segment_id, segment_name, _) in enumerate(plan.segments):
                delta = index * 2
                for template in segment_growth_templates:
                    output.append(
                        _clone_map_row(
                            template,
                            field_id=f"segment_yoy_growth::{segment_id}",
                            row_delta=delta,
                            notes=f"Runtime YoY formula: {segment_name} ({segment_id}).",
                        )
                    )
            continue
        if ADDBACK_FIELD.fullmatch(field_id):
            if emitted_addbacks:
                continue
            emitted_addbacks = True
            for index, (addback_id, label, _) in enumerate(plan.addbacks):
                delta = plan.segment_delta + index
                for template in addback_templates:
                    output.append(
                        _clone_map_row(
                            template,
                            field_id=f"adjusted_ebitda_addback::{addback_id}",
                            row_delta=delta,
                            notes=f"Runtime identified add-back: {label} ({addback_id}).",
                        )
                    )
            continue

        row = dict(source)
        if field_id == "business_unit_revenue_block":
            end = 4 + plan.segment_rows
            rendered = "EMPTY BEFORE ROW 5" if end == 4 else f"ROWS 5:{end}"
            row["input_cell"] = rendered
            row["target_cell"] = rendered
            row["notes"] = (
                f"Resolved to {len(plan.segments)} operating segment(s); "
                "one source row plus one paired YoY row per segment."
            )
        elif field_id == "adjusted_ebitda_addback_block":
            if plan.addbacks:
                rendered = (
                    f"ROWS {plan.addback_start}:"
                    f"{plan.addback_start + len(plan.addbacks) - 1}"
                )
            else:
                rendered = f"EMPTY BEFORE ROW {plan.addback_start}"
            row["input_cell"] = rendered
            row["target_cell"] = rendered
            row["notes"] = (
                f"Resolved to {len(plan.addbacks)} identified add-back row(s)."
            )
        elif row.get("module_id") == "CP-MODEL":
            for key in ("input_cell", "target_cell"):
                row[key] = _runtime_address(row.get(key, ""), plan)
            rule = row.get("formula_rule", "")
            if field_id == "adjustments":
                target = row.get("target_cell", "")
                row["formula_rule"] = _adjustments_formula(
                    _cell_column(target),
                    plan,
                )
            elif A1_REFERENCE.search(rule):
                row["formula_rule"] = _shift_references(rule, plan)
        output.append(row)

    if any(
        SLOT_FIELD.fullmatch(row.get("field_id", ""))
        or GROWTH_FIELD.fullmatch(row.get("field_id", ""))
        or ADDBACK_FIELD.fullmatch(row.get("field_id", ""))
        for row in output
    ):
        raise CpModelRuntimeError("runtime map retained a template-slot field")
    for row in output:
        missing = set(headers) - set(row)
        if missing:
            raise CpModelRuntimeError(
                f"runtime map row {row.get('field_id')!r} lacks columns {sorted(missing)}"
            )
    return output


def _write_map_xml(
    payload: bytes,
    headers: Sequence[str],
    rows: Sequence[Mapping[str, str]],
) -> bytes:
    root = ET.fromstring(payload)
    sheet_data = root.find(f"{NS}sheetData")
    if sheet_data is None:
        raise CpModelRuntimeError("_RBOT_MAP has no sheetData")
    original = sheet_data.findall(f"{NS}row")
    if len(original) < 2:
        raise CpModelRuntimeError("_RBOT_MAP has no row style template")
    header_template = original[0]
    data_template = original[1]

    def create_row(
        row_number: int,
        values: Sequence[str],
        template: ET.Element,
    ) -> ET.Element:
        row = copy.deepcopy(template)
        row.attrib["r"] = str(row_number)
        cells = row.findall(f"{NS}c")
        if len(cells) < len(headers):
            raise CpModelRuntimeError("_RBOT_MAP row template is incomplete")
        for index, value in enumerate(values, 1):
            cell = cells[index - 1]
            cell.attrib["r"] = f"{_column_name(index)}{row_number}"
            if value:
                _set_text_cell(cell, value)
            else:
                for child in list(cell):
                    cell.remove(child)
                cell.attrib.pop("t", None)
        for cell in cells[len(headers):]:
            row.remove(cell)
        return row

    for element in list(sheet_data):
        sheet_data.remove(element)
    sheet_data.append(create_row(1, list(headers), header_template))
    for row_number, row in enumerate(rows, 2):
        sheet_data.append(
            create_row(
                row_number,
                [str(row.get(header, "")) for header in headers],
                data_template,
            )
        )
    dimension = root.find(f"{NS}dimension")
    if dimension is not None:
        dimension.attrib["ref"] = f"A1:{_column_name(len(headers))}{len(rows) + 1}"
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def _period_registry(
    tables: Mapping[str, Sequence[Mapping[str, str]]],
) -> dict[str, Mapping[str, str]]:
    return {
        row["period_id"]: row
        for row in tables["cp1.model_period_register"]
    }


def _account_registry(
    tables: Mapping[str, Sequence[Mapping[str, str]]],
) -> dict[tuple[str, str], float | None]:
    return {
        (row["metric_id"], row["period_id"]): _numeric(
            row["value"],
            field=f"{row['metric_id']}::{row['period_id']}",
        )
        for row in tables["cp1.model_account_register"]
    }


def _resolve_account(
    metric_id: str,
    period_id: str,
    *,
    periods: Mapping[str, Mapping[str, str]],
    accounts: Mapping[tuple[str, str], float | None],
) -> float | None:
    direct = accounts.get((metric_id, period_id))
    if direct is not None or (metric_id, period_id) in accounts:
        return direct
    if metric_id not in BALANCE_METRICS:
        return None
    target = periods[period_id]
    matches = [
        (candidate_id, value)
        for (candidate_metric, candidate_id), value in accounts.items()
        if candidate_metric == metric_id
        and candidate_id in periods
        and _same_scope(target, periods[candidate_id])
    ]
    if len(matches) > 1:
        raise CpModelRuntimeError(
            f"{metric_id}::{period_id}: multiple matching period-end values"
        )
    return matches[0][1] if matches else None


def _scaled_account(
    metric_id: str,
    period_id: str,
    *,
    periods: Mapping[str, Mapping[str, str]],
    accounts: Mapping[tuple[str, str], float | None],
) -> float | None:
    value = _resolve_account(
        metric_id,
        period_id,
        periods=periods,
        accounts=accounts,
    )
    if value is None or metric_id == "effective_tax_rate":
        return value
    source_period_id = period_id
    if (metric_id, period_id) not in accounts and metric_id in BALANCE_METRICS:
        source_period_id = next(
            candidate_id
            for (candidate_metric, candidate_id), candidate_value in accounts.items()
            if candidate_metric == metric_id
            and candidate_value == value
            and candidate_id in periods
            and _same_scope(periods[period_id], periods[candidate_id])
        )
    return value * _scale_for_period(periods[source_period_id])


def _facility_rows_for_period(
    period_id: str,
    *,
    periods: Mapping[str, Mapping[str, str]],
    facilities: Sequence[Mapping[str, str]],
) -> list[Mapping[str, str]]:
    exact = [row for row in facilities if row["period_id"] == period_id]
    if exact:
        return exact
    matching = [
        row for row in facilities
        if row["period_id"] in periods
        and _same_scope(periods[period_id], periods[row["period_id"]])
    ]
    matching_periods = sorted({row["period_id"] for row in matching})
    if len(matching_periods) > 1:
        raise CpModelRuntimeError(
            f"{period_id}: multiple matching debt-facility period registers "
            f"{matching_periods}"
        )
    return matching


def _classify_facility(row: Mapping[str, str]) -> str:
    text = " ".join(
        (
            row.get("facility_type", ""),
            row.get("facility_name", ""),
            row.get("lease_classification", ""),
        )
    ).upper()
    secured = row.get("secured_status", "").upper()
    seniority = row.get("seniority", "").upper()
    if "LEASE" in text and "NOT_LEASE" not in text:
        return "finance_lease_debt"
    if "RCF" in text or "REVOLV" in text:
        return "rcf_drawn"
    if "SECURED" in secured and "UNSECURED" not in secured:
        if re.search(r"\bTLB\b|TERM\s+LOAN\s+B", text):
            return "term_loan_b"
        if "FACILITY" in text or "TERM LOAN" in text:
            return "senior_secured_facility"
        return "other_secured_debt"
    if "SUBORD" in seniority or "SUBORD" in text:
        return "subordinated_notes"
    if "NOTE" in text and ("SENIOR" in seniority or "SENIOR" in text):
        return "senior_unsecured_notes"
    if "NOTE" in text:
        return "other_su_notes"
    return "other_unsecured_debt"


def _debt_components(
    period_id: str,
    *,
    periods: Mapping[str, Mapping[str, str]],
    accounts: Mapping[tuple[str, str], float | None],
    facilities: Sequence[Mapping[str, str]],
) -> dict[str, float]:
    components = {field: 0.0 for field in DEBT_COMPONENT_FIELDS}
    rcf_drawn = _scaled_account(
        "rcf_drawn", period_id, periods=periods, accounts=accounts
    )
    components["rcf_drawn"] = 0.0 if rcf_drawn is None else rcf_drawn
    for row in _facility_rows_for_period(
        period_id,
        periods=periods,
        facilities=facilities,
    ):
        value = _numeric(
            row.get("carrying_value", ""),
            field=f"facility {row.get('facility_id')} carrying_value",
        )
        if value is None:
            continue
        value *= _scale_for_period(periods[row["period_id"]])
        bucket = _classify_facility(row)
        if bucket == "rcf_drawn":
            if not math.isclose(
                value,
                components["rcf_drawn"],
                rel_tol=0.0,
                abs_tol=max(1e-6, abs(value) * 1e-6),
            ):
                raise CpModelRuntimeError(
                    f"{period_id}: RCF facility carrying value does not match rcf_drawn"
                )
            continue
        components[bucket] += value

    secured = _scaled_account(
        "senior_secured_debt", period_id, periods=periods, accounts=accounts
    )
    unsecured = _scaled_account(
        "unsecured_debt", period_id, periods=periods, accounts=accounts
    )
    total = _scaled_account(
        "total_debt", period_id, periods=periods, accounts=accounts
    )
    if secured is None or unsecured is None or total is None:
        raise CpModelRuntimeError(f"{period_id}: debt aggregates are incomplete")
    tolerance = max(1e-6, abs(total) * 1e-6)
    known_secured = sum(
        components[field]
        for field in (
            "rcf_drawn",
            "senior_secured_facility",
            "term_loan_b",
            "finance_lease_debt",
            "other_secured_debt",
        )
    )
    known_unsecured = sum(
        components[field]
        for field in (
            "senior_unsecured_notes",
            "subordinated_notes",
            "other_su_notes",
            "other_unsecured_debt",
        )
    )
    secured_residual = secured - known_secured
    unsecured_residual = unsecured - known_unsecured
    if secured_residual < -tolerance or unsecured_residual < -tolerance:
        raise CpModelRuntimeError(
            f"{period_id}: debt facility carrying values exceed CP-1 aggregate debt"
        )
    components["other_secured_debt"] += max(0.0, secured_residual)
    components["other_unsecured_debt"] += max(0.0, unsecured_residual)
    if not math.isclose(
        secured + unsecured,
        total,
        rel_tol=0.0,
        abs_tol=tolerance,
    ):
        raise CpModelRuntimeError(
            f"{period_id}: total_debt does not equal secured plus unsecured debt"
        )
    return components


def _source_values(
    tables: Mapping[str, Sequence[Mapping[str, str]]],
    map_rows: Sequence[Mapping[str, str]],
    plan: RuntimePlan,
) -> tuple[dict[str, float], tuple[str, ...], tuple[str, ...]]:
    periods = _period_registry(tables)
    accounts = _account_registry(tables)
    mapped_periods = {
        row.get("period_id", "")
        for row in map_rows
        if row.get("module_id") == "CP-MODEL" and row.get("period_id")
    }
    active_periods = {
        period_id
        for period_id, row in periods.items()
        if row.get("period_type") != "PERIOD_END"
    }
    unknown = active_periods - mapped_periods
    if unknown:
        raise CpModelRuntimeError(
            f"CP-1 periods have no template mapping: {sorted(unknown)}"
        )
    segment_values = {
        (row["segment_id"], row["period_id"]): _numeric(
            row["revenue"],
            field=f"segment {row['segment_id']}::{row['period_id']}",
        )
        for row in tables["cp1.segment_revenue_schedule"]
    }
    corporate_values = {
        row["period_id"]: _numeric(
            row["revenue"],
            field=f"corporate elimination::{row['period_id']}",
        )
        for row in tables["cp1.segment_revenue_schedule"]
        if row["segment_type"] == "CORPORATE_ELIMINATION"
    }
    addback_values = {
        (row["addback_id"], row["period_id"]): _numeric(
            row["value"],
            field=f"add-back {row['addback_id']}::{row['period_id']}",
        )
        for row in tables["cp1.adjusted_ebitda_bridge"]
    }
    debt_cache: dict[str, dict[str, float]] = {}

    def scaled(value: float | None, period_id: str) -> float | None:
        if value is None:
            return None
        return value * _scale_for_period(periods[period_id])

    def source_value(field_id: str, period_id: str) -> float | None:
        if field_id.startswith("segment_revenue::"):
            segment_id = field_id.split("::", 1)[1]
            return scaled(
                segment_values.get((segment_id, period_id), 0.0),
                period_id,
            )

        if field_id.startswith("adjusted_ebitda_addback::"):
            addback_id = field_id.split("::", 1)[1]
            return scaled(
                addback_values.get((addback_id, period_id), 0.0),
                period_id,
            )

        if field_id == "corporate_elimination_revenue":
            return scaled(corporate_values.get(period_id), period_id)

        if field_id in DEBT_COMPONENT_FIELDS:
            if period_id not in debt_cache:
                debt_cache[period_id] = _debt_components(
                    period_id,
                    periods=periods,
                    accounts=accounts,
                    facilities=tables["cp1.debt_facility_register"],
                )
            return debt_cache[period_id][field_id]

        return _scaled_account(
            DIRECT_FIELD_ALIASES.get(field_id, field_id),
            period_id,
            periods=periods,
            accounts=accounts,
        )

    writes: dict[str, float] = {}
    metrics_written: set[str] = set()
    periods_written: set[str] = set()

    for row in map_rows:
        if (
            row.get("module_id") != "CP-MODEL"
            or row.get("write_class") != "MODEL_SOURCE"
        ):
            continue
        period_id = row.get("period_id", "")
        if period_id not in periods:
            continue
        field_id = row.get("field_id", "")
        value = source_value(field_id, period_id)
        if value is None:
            if field_id in MANDATORY_ACCOUNT_METRICS:
                raise CpModelRuntimeError(
                    f"{field_id}::{period_id}: mandatory mapped value is null"
                )
            continue
        address = row.get("input_cell", "")
        if CELL_ADDRESS.fullmatch(address) is None:
            raise CpModelRuntimeError(
                f"{field_id}::{period_id}: invalid MODEL_SOURCE input cell {address!r}"
            )
        if address in writes and not math.isclose(
            writes[address],
            value,
            rel_tol=0.0,
            abs_tol=1e-12,
        ):
            raise CpModelRuntimeError(f"conflicting writes target _RBOT_INPUTS!{address}")
        writes[address] = value
        metrics_written.add(field_id)
        periods_written.add(period_id)
    return (
        writes,
        tuple(sorted(periods_written)),
        tuple(sorted(metrics_written)),
    )


def _formula_identity_checks(
    tables: Mapping[str, Sequence[Mapping[str, str]]],
) -> tuple[dict[str, str], ...]:
    periods = _period_registry(tables)
    accounts = _account_registry(tables)
    addbacks: dict[str, list[float]] = {}
    for row in tables["cp1.adjusted_ebitda_bridge"]:
        value = _numeric(row["value"], field="add-back identity")
        if value is not None:
            addbacks.setdefault(row["period_id"], []).append(value)
    checks: list[dict[str, str]] = []
    for period_id, period in periods.items():
        if period.get("period_type") not in FLOW_PERIOD_TYPES:
            continue
        values = {
            metric: _resolve_account(
                metric,
                period_id,
                periods=periods,
                accounts=accounts,
            )
            for metric in (
                "revenue",
                "cogs",
                "opex_including_da",
                "depreciation_amortization",
                "ebitda",
                "adjusted_ebitda",
                "cfo_ncfo",
                "capex_and_intangible_investment",
                "acquisitions_disposals",
                "net_debt_issue_repay",
                "net_equity_issue_repay",
                "dividends_paid",
                "other_investing_financing",
                "net_cash_change",
            )
        }
        if any(value is None for value in values.values()):
            raise CpModelRuntimeError(
                f"{period_id}: formula identity inputs are incomplete"
            )
        tolerance = max(1e-6, abs(values["revenue"] or 0.0) * 1e-6)
        expected_ebitda = (
            (values["revenue"] or 0.0)
            + (values["cogs"] or 0.0)
            + (values["opex_including_da"] or 0.0)
            + (values["depreciation_amortization"] or 0.0)
        )
        expected_adjusted = expected_ebitda + sum(addbacks.get(period_id, []))
        expected_ncf = sum(
            values[metric] or 0.0
            for metric in (
                "cfo_ncfo",
                "capex_and_intangible_investment",
                "acquisitions_disposals",
                "net_debt_issue_repay",
                "net_equity_issue_repay",
                "dividends_paid",
                "other_investing_financing",
            )
        )
        for check_id, expected, observed in (
            ("EBITDA_IDENTITY", expected_ebitda, values["ebitda"]),
            (
                "ADJUSTED_EBITDA_IDENTITY",
                expected_adjusted,
                values["adjusted_ebitda"],
            ),
            ("NET_CASH_CHANGE_IDENTITY", expected_ncf, values["net_cash_change"]),
        ):
            if not math.isclose(
                expected,
                observed or 0.0,
                rel_tol=0.0,
                abs_tol=tolerance,
            ):
                raise CpModelRuntimeError(
                    f"{period_id}: {check_id} fails "
                    f"(expected {expected}, CP-1 has {observed})"
                )
            checks.append(
                {
                    "check_id": f"{check_id}::{period_id}",
                    "status": "PASS",
                    "detail": "CP-1 source values reconcile to the preserved template formula.",
                }
            )
    return tuple(checks)


def _populate_inputs(payload: bytes, writes: Mapping[str, float]) -> bytes:
    root = ET.fromstring(payload)
    cells = {
        cell.attrib.get("r", ""): cell
        for cell in root.findall(f".//{NS}c")
    }
    for address, value in writes.items():
        cell = cells.get(address)
        if cell is None:
            raise CpModelRuntimeError(
                f"runtime map target is absent from _RBOT_INPUTS: {address}"
            )
        _set_numeric_cell(cell, value)
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def _formula_registry(payload: bytes) -> dict[str, str]:
    root = ET.fromstring(payload)
    return {
        cell.attrib.get("r", ""): formula.text or ""
        for cell in root.findall(f".//{NS}c")
        if (formula := cell.find(f"{NS}f")) is not None
    }


def _validate_output(
    candidate: Path,
    *,
    template_members: Mapping[str, bytes],
    member_order: Sequence[str],
    mutable_members: set[str],
    model_member: str,
    input_member: str,
    map_member: str,
    plan: RuntimePlan,
    writes: Mapping[str, float],
) -> tuple[dict[str, str], ...]:
    with zipfile.ZipFile(candidate) as archive:
        if archive.namelist() != list(member_order):
            raise CpModelRuntimeError("workbook ZIP member registry/order changed")
        for member, original in template_members.items():
            if member not in mutable_members and archive.read(member) != original:
                raise CpModelRuntimeError(f"protected workbook member changed: {member}")
        model_payload = archive.read(model_member)
        input_payload = archive.read(input_member)
        map_payload = archive.read(map_member)
        _, exported_map_rows = _map_rows(archive)
        try:
            ET.fromstring(model_payload)
            input_root = ET.fromstring(input_payload)
            ET.fromstring(map_payload)
        except ET.ParseError as exc:
            raise CpModelRuntimeError(f"exported worksheet XML is invalid: {exc}") from exc

    formulas = _formula_registry(model_payload)
    expected_formula_count = (
        len(_formula_registry(template_members[model_member]))
        + (len(plan.segments) - 6) * 60
        + (len(plan.addbacks) - 4) * 30
    )
    if len(formulas) != expected_formula_count:
        raise CpModelRuntimeError(
            f"Model formula count mismatch: expected {expected_formula_count}, "
            f"found {len(formulas)}"
        )
    for address, formula in formulas.items():
        if not formula or any(token in formula for token in PROTECTED_ERROR_TOKENS):
            raise CpModelRuntimeError(f"invalid Model formula at {address}: {formula!r}")
    for row in exported_map_rows:
        if (
            row.get("module_id") == "CP-MODEL"
            and row.get("write_class") == "MODEL_FORMULA"
        ):
            address = row.get("target_cell", "")
            if formulas.get(address) != row.get("formula_rule", ""):
                raise CpModelRuntimeError(
                    f"formula/map mismatch at Model!{address}"
                )
    input_cells = {
        cell.attrib.get("r", ""): _cell_text(cell, ())
        for cell in input_root.findall(f".//{NS}c")
    }
    for address, value in writes.items():
        observed = input_cells.get(address)
        if observed is None or not math.isclose(
            float(observed),
            value,
            rel_tol=0.0,
            abs_tol=max(1e-12, abs(value) * 1e-12),
        ):
            raise CpModelRuntimeError(
                f"round-trip source mismatch at _RBOT_INPUTS!{address}"
            )
    return (
        {
            "check_id": "WORKBOOK_MEMBER_PRESERVATION",
            "status": "PASS",
            "detail": "Every workbook member outside Model, _RBOT_INPUTS and _RBOT_MAP is byte-identical.",
        },
        {
            "check_id": "MODEL_FORMULA_PRESERVATION",
            "status": "PASS",
            "detail": (
                f"{len(formulas)} formula cells retained and matched the "
                "regenerated formula map after authorised row resizing."
            ),
        },
        {
            "check_id": "MODEL_SOURCE_ROUND_TRIP",
            "status": "PASS",
            "detail": f"{len(writes)} mapped source cells round-tripped exactly.",
        },
    )


def _write_workbook(
    template: Path,
    candidate: Path,
    replacements: Mapping[str, bytes],
) -> tuple[dict[str, bytes], list[str]]:
    with zipfile.ZipFile(template) as source:
        infos = source.infolist()
        names = [info.filename for info in infos]
        if len(names) != len(set(names)):
            raise CpModelRuntimeError("reference workbook has duplicate ZIP members")
        originals = {info.filename: source.read(info) for info in infos}
        with zipfile.ZipFile(candidate, "w", allowZip64=True) as destination:
            for info in infos:
                destination.writestr(
                    info,
                    replacements.get(info.filename, originals[info.filename]),
                )
    return originals, names


def export_cp_model(
    template: Path,
    output: Path,
    cp1_markdown: str,
    cp1b_markdown: str,
) -> dict[str, Any]:
    """Create one CP-MODEL export and publish it only after full verification."""
    template = template.resolve()
    requested_output = Path(output)
    output = requested_output.resolve()
    if template == output:
        raise CpModelRuntimeError("reference workbook overwrite is prohibited")
    if not template.is_file():
        raise CpModelRuntimeError(f"reference workbook is missing: {template}")
    if requested_output.is_symlink() or requested_output.exists():
        raise CpModelRuntimeError(f"output already exists: {requested_output}")
    template_bytes = template.read_bytes()
    template_hash = hashlib.sha256(template_bytes).hexdigest()
    if template_hash != EXPECTED_TEMPLATE_SHA256:
        raise CpModelRuntimeError(
            f"reference workbook signature mismatch: {template_hash}"
        )
    with tempfile.TemporaryDirectory(prefix="cp-model-source-") as source_directory:
        snapshot = Path(source_directory) / "template.xlsx"
        snapshot.write_bytes(template_bytes)
        return _export_verified_snapshot(
            snapshot,
            output,
            cp1_markdown,
            cp1b_markdown,
            template_hash=template_hash,
        )


def _export_verified_snapshot(
    template: Path,
    output: Path,
    cp1_markdown: str,
    cp1b_markdown: str,
    *,
    template_hash: str,
) -> dict[str, Any]:
    """Export only from the immutable template bytes that passed hashing."""
    validation = validate_cp_model_inputs(cp1_markdown, cp1b_markdown)
    if not validation.ok:
        raise CpModelRuntimeError(
            "CP-MODEL input contract failed: " + "; ".join(validation.errors)
        )
    tables = parse_stable_tables(cp1_markdown)
    plan = _row_definitions(tables)
    reconciliations = _formula_identity_checks(tables)

    with zipfile.ZipFile(template) as source:
        model_member = _worksheet_member(source, "Model")
        input_member = _worksheet_member(source, "_RBOT_INPUTS")
        map_member = _worksheet_member(source, "_RBOT_MAP")
        headers, source_map_rows = _map_rows(source)
        model_payload = source.read(model_member)
        input_payload = source.read(input_member)
        map_payload = source.read(map_member)

    runtime_map_rows = _remap_map_rows(headers, source_map_rows, plan)
    writes, periods_written, metrics_written = _source_values(
        tables,
        runtime_map_rows,
        plan,
    )
    resized_model = _resize_worksheet(model_payload, plan, is_model=True)
    resized_inputs = _resize_worksheet(input_payload, plan, is_model=False)
    populated_inputs = _populate_inputs(resized_inputs, writes)
    runtime_map = _write_map_xml(map_payload, headers, runtime_map_rows)
    replacements = {
        model_member: resized_model,
        input_member: populated_inputs,
        map_member: runtime_map,
    }

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(
        prefix=f".{output.name}.",
        dir=output.parent,
    ) as temporary:
        candidate = Path(temporary) / "candidate.xlsx"
        originals, member_order = _write_workbook(template, candidate, replacements)
        preservation_checks = _validate_output(
            candidate,
            template_members=originals,
            member_order=member_order,
            mutable_members=set(replacements),
            model_member=model_member,
            input_member=input_member,
            map_member=map_member,
            plan=plan,
            writes=writes,
        )
        result = {
            "output": output,
            "output_sha256": sha256(candidate),
            "template_sha256": template_hash,
            "periods_written": periods_written,
            "metrics_written": metrics_written,
            "repeat_blocks": (
                {
                    "repeat_group": "business_unit_revenue",
                    "source_row_count": len(plan.segments),
                    "rendered_row_count": plan.segment_rows,
                    "status": "PASS",
                },
                {
                    "repeat_group": "adjusted_ebitda_addbacks",
                    "source_row_count": len(plan.addbacks),
                    "rendered_row_count": len(plan.addbacks),
                    "status": "PASS",
                },
            ),
            "formula_checks": (
                {
                    "check_id": "TEMPLATE_FORMULAS",
                    "status": "PASS",
                    "detail": "Formula registry, shifted references and dynamic Adjustments formulas passed.",
                },
            ),
            "reconciliations": reconciliations,
            "preservation_checks": preservation_checks,
            "validation_warnings": validation.warnings,
        }
        try:
            os.link(candidate, output)
        except FileExistsError as exc:
            raise CpModelRuntimeError(f"output already exists: {output}") from exc
    return result


def _identity_fields(markdown: str, expected_module: str) -> Mapping[str, Any]:
    result = validate_common_handoff(markdown, expected_module=expected_module)
    if result.errors or result.identity_mismatches or result.fields is None:
        details = (*result.errors, *result.identity_mismatches)
        raise CpModelRuntimeError(
            f"{expected_module} common envelope failed: {'; '.join(details)}"
        )
    return result.fields


def _canonical_output(
    cp1_markdown: str,
    cp1b_markdown: str,
    output_dir: Path,
    *,
    issuer_file_token: str | None,
    export_date: date | None,
) -> Path:
    cp1 = _identity_fields(cp1_markdown, "CP-1")
    cp1b = _identity_fields(cp1b_markdown, "CP-1B")
    for field in ("issuer_id", "analysis_date"):
        if cp1.get(field) != cp1b.get(field):
            raise CpModelRuntimeError(f"CP-1/CP-1B envelope mismatch for {field}")
    issuer = issuer_file_token or str(cp1["issuer_id"])
    if ISSUER_FILE_TOKEN.fullmatch(issuer) is None:
        raise CpModelRuntimeError(
            "issuer file token must match [A-Za-z0-9][A-Za-z0-9._-]*"
        )
    if export_date is None:
        try:
            export_date = date.fromisoformat(str(cp1["analysis_date"]))
        except ValueError as exc:
            raise CpModelRuntimeError("analysis_date must use YYYY-MM-DD") from exc
    return output_dir / f"{issuer}_CP-MODEL_{export_date.strftime('%Y%m%d')}.xlsx"


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cp1", type=Path, required=True)
    parser.add_argument("--cp1b", type=Path, required=True)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path.cwd(),
        help="destination directory; the canonical filename is derived",
    )
    parser.add_argument("--issuer-file-token")
    parser.add_argument("--export-date", type=date.fromisoformat)
    args = parser.parse_args(argv)
    try:
        cp1_markdown = args.cp1.read_text(encoding="utf-8")
        cp1b_markdown = args.cp1b.read_text(encoding="utf-8")
        output = _canonical_output(
            cp1_markdown,
            cp1b_markdown,
            args.output_dir,
            issuer_file_token=args.issuer_file_token,
            export_date=args.export_date,
        )
        result = export_cp_model(
            TEMPLATE,
            output,
            cp1_markdown,
            cp1b_markdown,
        )
    except (CpModelRuntimeError, OSError, UnicodeError, zipfile.BadZipFile) as exc:
        print(json.dumps({"status": "blocked", "error": str(exc)}, sort_keys=True))
        return 2
    print(
        json.dumps(
            {
                "status": "complete",
                "output": str(result["output"]),
                "output_sha256": result["output_sha256"],
                "template_sha256": result["template_sha256"],
                "periods_written": result["periods_written"],
                "metrics_written": result["metrics_written"],
                "repeat_blocks": result["repeat_blocks"],
                "formula_checks": result["formula_checks"],
                "reconciliations": result["reconciliations"],
                "preservation_checks": result["preservation_checks"],
                "validation_warnings": result["validation_warnings"],
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
