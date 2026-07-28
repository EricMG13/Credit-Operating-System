"""Fail-closed semantic, numerical, and page checks for visual PDF exports."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from pypdf import PdfReader
from reportlab.lib.pagesizes import A4

try:
    from tools.validate_handoff import _parse_frontmatter
    from tools.visual_pdf.registry import get_profile
    from tools.visual_pdf.renderer import ascii_text, clean_markup, load_report
except ModuleNotFoundError:  # Direct execution from a deployed tools directory.
    from validate_handoff import _parse_frontmatter
    from visual_pdf.registry import get_profile
    from visual_pdf.renderer import ascii_text, clean_markup, load_report


NUMBER_TOKEN = re.compile(
    r"(?<![A-Za-z])(?:[$£€])?\(?[-+]?\d[\d,]*(?:\.\d+)?%?\)?x?"
)


def _compact_text(value: str) -> str:
    return re.sub(r"\s+", "", ascii_text(clean_markup(value))).casefold()


def _normalized_number(token: str) -> str:
    text = token.replace(",", "").lstrip("$£€")
    suffix = ""
    if text.endswith(("x", "%")):
        suffix = text[-1]
        text = text[:-1]
    if text.startswith("(") and text.endswith(")"):
        text = f"-{text[1:-1]}"
    return f"{text}{suffix}"


def _number_set(text: str) -> set[str]:
    return {
        _normalized_number(match.group())
        for match in NUMBER_TOKEN.finditer(text)
    }


def verify_visual_pdf(markdown: Path, pdf: Path) -> dict[str, Any]:
    """Verify that a visual PDF preserves canonical values and is valid A4."""

    report = load_report(markdown)
    profile = get_profile(report.module_id)
    reader = PdfReader(pdf)
    page_count = len(reader.pages)
    if page_count == 0:
        raise ValueError("visual PDF contains no pages")
    if page_count > profile.stress_page_budget:
        raise ValueError(
            f"visual PDF exceeds {report.module_id} stress page budget: "
            f"{page_count} > {profile.stress_page_budget}"
        )

    page_text: list[str] = []
    for index, page in enumerate(reader.pages, start=1):
        width = float(page.mediabox.width)
        height = float(page.mediabox.height)
        if abs(width - A4[0]) > 0.02 or abs(height - A4[1]) > 0.02:
            raise ValueError(
                f"visual PDF page {index} is not A4: {width:.2f} x {height:.2f}"
            )
        page_text.append(page.extract_text() or "")

    pdf_text = "\n".join(page_text)
    compact_pdf = _compact_text(pdf_text)
    missing_cells: list[str] = []
    checked_cells = 0
    for rows in report.tables.values():
        for row in rows:
            for cell in row:
                compact_cell = _compact_text(cell)
                if not compact_cell:
                    continue
                checked_cells += 1
                if compact_cell not in compact_pdf:
                    missing_cells.append(clean_markup(cell))
    if missing_cells:
        sample = ", ".join(repr(cell) for cell in missing_cells[:5])
        raise ValueError(
            f"visual PDF table-cell parity failed; "
            f"{len(missing_cells)} missing cell(s): {sample}"
        )

    _, body = _parse_frontmatter(markdown.read_text(encoding="utf-8"))
    source_numbers = _number_set(body)
    pdf_numbers = _number_set(pdf_text)
    missing_numbers = sorted(source_numbers - pdf_numbers)
    if missing_numbers:
        raise ValueError(
            "visual PDF numerical parity failed; missing token(s): "
            + ", ".join(missing_numbers[:12])
        )

    return {
        "quality_status": "valid",
        "pages": page_count,
        "a4_pages": page_count,
        "table_cells_checked": checked_cells,
        "numeric_tokens_checked": len(source_numbers),
    }
