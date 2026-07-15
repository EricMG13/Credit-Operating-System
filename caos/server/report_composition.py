"""Deterministic, server-owned Report Studio composition.

The browser submits editorial intent (omissions and stable-path text edits), not
an opaque rendered report.  This module projects the exact frozen run into the
small Report Studio DSL and then materializes that intent.  Published UI, PDF,
and XLSX consumers therefore read one reviewed composition instead of trying to
replay browser-only overlays later.
"""

from __future__ import annotations

import copy
import json
import re
from typing import Any, Iterable, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ReportCompositionIntent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    deliverable_id: Literal["live-committee-pack"] = "live-committee-pack"
    source_run_id: str = Field(min_length=1, max_length=64)
    omit: dict[str, bool] = Field(default_factory=dict)
    edits: dict[str, str] = Field(default_factory=dict)
    show_sources: bool = True
    hide_addbacks: bool = False

    @field_validator("omit")
    @classmethod
    def validate_omit(cls, value: dict[str, bool]) -> dict[str, bool]:
        if len(value) > 500:
            raise ValueError("Too many report section omissions.")
        for key in value:
            if not key.isdigit():
                raise ValueError("Report omission keys must be section indices.")
        return value

    @field_validator("edits")
    @classmethod
    def validate_edits(cls, value: dict[str, str]) -> dict[str, str]:
        if len(value) > 2_000:
            raise ValueError("Too many report edits.")
        if any(len(text) > 2_000 for text in value.values()):
            raise ValueError("Report edits are limited to 2,000 characters each.")
        return value


def _display(value: Any) -> str | int | float | bool:
    if value is None:
        return ""
    if isinstance(value, (str, int, float, bool)):
        return value
    return json.dumps(value, sort_keys=True, ensure_ascii=False, default=str)


def _rows(value: Any, prefix: str = "") -> Iterable[tuple[str, Any]]:
    if isinstance(value, dict):
        if not value:
            yield prefix or "summary", ""
        for key in sorted(value):
            path = f"{prefix}.{key}" if prefix else str(key)
            yield from _rows(value[key], path)
    elif isinstance(value, list):
        if not value:
            yield prefix, ""
        elif all(not isinstance(item, (dict, list)) for item in value):
            yield prefix, ", ".join(str(_display(item)) for item in value)
        else:
            for index, item in enumerate(value):
                yield from _rows(item, f"{prefix}[{index}]")
    else:
        yield prefix, value


def build_review_base(document: dict, *, show_sources: bool) -> dict:
    """Project the exact assembled run document into the Report Studio DSL."""
    run_id = str(document.get("run_id") or "")
    issuer_id = str(document.get("issuer_id") or "")
    modules = document.get("sections") if isinstance(document.get("sections"), list) else []
    sections: list[dict] = [{
        "t": "profile",
        "title": "FROZEN ANALYSIS ENVELOPE",
        "rows": [
            ["Issuer", issuer_id],
            ["Run", run_id],
            ["As of", str(document.get("as_of_date") or "Unavailable")],
            ["Committee status", str(document.get("committee_status") or "Unavailable")],
            ["Modules included", str(len(modules))],
        ],
    }]
    sources: list[dict] = []
    for index, raw_module in enumerate(modules, start=1):
        if not isinstance(raw_module, dict):
            continue
        module_id = str(raw_module.get("module_id") or f"MODULE-{index}")
        module_name = str(raw_module.get("module_name") or "Frozen output")
        summary = raw_module.get("summary") if isinstance(raw_module.get("summary"), dict) else {}
        sections.append({
            "t": "table",
            "title": f"{module_id} · {module_name}",
            "sub": (
                f"QA {raw_module.get('qa_status') or 'Not Reviewed'} · "
                f"confidence {raw_module.get('confidence') or 'Unavailable'}"
            ),
            "cols": ["Field", "Frozen value"],
            "align": [0, 0],
            "rows": [
                {"cells": [str(path or "summary"), _display(value)]}
                for path, value in _rows(summary)
            ],
        })
        if show_sources:
            sources.append({"chip": module_id, "ev": []})
    return {
        "id": "live-committee-pack",
        "title": "Live IC Credit Memo",
        "file": f"{issuer_id}-IC-Credit-Memo",
        "subtitle": (
            f"{issuer_id} · run {run_id} · "
            f"{document.get('as_of_date') or 'as-of unavailable'}"
        ),
        "icon": "document",
        "srcs": sources,
        "sections": sections,
    }


_SECTION_PATH = re.compile(r"^s(\d+)\.(.+)$")
_PROFILE_PATH = re.compile(r"^r(\d+)\.(l|v)$")
_TABLE_HEADER_PATH = re.compile(r"^h(\d+)$")
_TABLE_CELL_PATH = re.compile(r"^r(\d+)\.(c(\d+)|lbl0)$")
_LIST_ITEM_PATH = re.compile(r"^i(\d+)$")


def _apply_section_edit(section: dict, suffix: str, text: str) -> bool:
    if suffix in {"title", "sub", "subhead", "body", "label", "labelBody", "note"}:
        if suffix not in section:
            return False
        section[suffix] = text
        return True
    if section.get("t") == "profile" and (match := _PROFILE_PATH.fullmatch(suffix)):
        row_index = int(match.group(1))
        column = 0 if match.group(2) == "l" else 1
        rows = section.get("rows")
        if not isinstance(rows, list) or row_index >= len(rows):
            return False
        rows[row_index][column] = text
        return True
    if section.get("t") == "table" and (match := _TABLE_HEADER_PATH.fullmatch(suffix)):
        index = int(match.group(1))
        cols = section.get("cols")
        if not isinstance(cols, list) or index >= len(cols):
            return False
        cols[index] = text
        return True
    if section.get("t") == "table" and (match := _TABLE_CELL_PATH.fullmatch(suffix)):
        row_index = int(match.group(1))
        rows = section.get("rows")
        if not isinstance(rows, list) or row_index >= len(rows) or not isinstance(rows[row_index], dict):
            return False
        if match.group(2) == "lbl0":
            if "lbl0" not in rows[row_index]:
                return False
            rows[row_index]["lbl0"] = text
            return True
        cell_index = int(match.group(3))
        cells = rows[row_index].get("cells")
        if not isinstance(cells, list) or cell_index >= len(cells):
            return False
        cells[cell_index] = text
        return True
    if section.get("t") == "list" and (match := _LIST_ITEM_PATH.fullmatch(suffix)):
        index = int(match.group(1))
        items = section.get("items")
        if not isinstance(items, list) or index >= len(items):
            return False
        items[index] = text
        return True
    return False


def materialize_reviewed_report(document: dict, intent: ReportCompositionIntent) -> dict:
    """Apply only valid stable-path edits/omissions to the server-owned base."""
    report = copy.deepcopy(build_review_base(document, show_sources=intent.show_sources))
    sections = report["sections"]
    for path, text in intent.edits.items():
        if path in {"title", "subtitle"}:
            report[path] = text
            continue
        match = _SECTION_PATH.fullmatch(path)
        if match is None:
            raise ValueError(f"Unknown report edit path: {path}")
        index = int(match.group(1))
        if index >= len(sections) or not _apply_section_edit(sections[index], match.group(2), text):
            raise ValueError(f"Unknown report edit path: {path}")
    omitted = {int(key) for key, hidden in intent.omit.items() if hidden}
    if omitted and max(omitted) >= len(sections):
        raise ValueError("Report omission references an unavailable section.")
    report["sections"] = [section for index, section in enumerate(sections) if index not in omitted]
    return report

