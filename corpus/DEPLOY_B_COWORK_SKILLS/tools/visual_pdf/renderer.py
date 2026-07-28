#!/usr/bin/env python3
"""Core visual-PDF renderer for validated CP Markdown handoffs.

The production foundation supports CP-1, CP-2B, CP-2D, CP-4B, CP-5A, and
CP-6. Markdown remains the authoritative analytical source. Module pages use
deterministic visual encodings; the canonical appendix retains every Markdown
block and table.
"""

from __future__ import annotations

import argparse
import html
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfbase.pdfdoc import PDFString, PDFtrue
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph

try:
    from tools.render_handoff_docx import Block, parse_markdown_body
    from tools.validate_handoff import _parse_frontmatter, validate_text
    from tools.visual_pdf.registry import ProfileState, get_profile
except ModuleNotFoundError:  # Direct execution from tools/.
    from render_handoff_docx import Block, parse_markdown_body
    from validate_handoff import _parse_frontmatter, validate_text
    from visual_pdf.registry import ProfileState, get_profile


PW, PH = A4
MARGIN = 17 * mm
CONTENT_W = PW - 2 * MARGIN
TOP = PH - 21 * mm
BOTTOM = 18 * mm

NAVY = HexColor("#102A46")
INK = HexColor("#172238")
MUTED = HexColor("#596779")
TEAL = HexColor("#087C78")
BLUE = HexColor("#2F6BFF")
PURPLE = HexColor("#6752C9")
AMBER = HexColor("#A96500")
RED = HexColor("#AD3744")
GREEN = HexColor("#167B55")
PANEL = HexColor("#F5F7FB")
SOFT = HexColor("#E9EEF5")
BORDER = HexColor("#CCD6E2")
BLUE_BG = HexColor("#EAF1FF")
TEAL_BG = HexColor("#E4F5F3")
PURPLE_BG = HexColor("#F0EDFF")
AMBER_BG = HexColor("#FFF2DB")
RED_BG = HexColor("#FCEAEC")
GREEN_BG = HexColor("#E7F5EE")
WHITE = white

ACCENTS = {
    "CP-1": BLUE,
    "CP-2B": BLUE,
    "CP-2D": TEAL,
    "CP-4B": PURPLE,
    "CP-5A": RED,
    "CP-6": AMBER,
}

MODULE_KICKERS = {
    "CP-1": "Financial profile",
    "CP-2B": "Catalyst calendar",
    "CP-2D": "Liquidity runway",
    "CP-4B": "Structural priority",
    "CP-5A": "Research integrity",
    "CP-6": "Investment committee decision",
}

PROFILE_TABLES = {
    "CP-1": {
        "core_financials": ("cp1.core_financials", "Core financials"),
        "derived_metrics": ("cp1.derived_metrics", "Derived metrics"),
    },
    "CP-2D": {
        "liquidity_snapshot": ("cp2d.liquidity_snapshot", "Liquidity snapshot"),
        "liquidity_bridge": ("cp2d.liquidity_bridge", "Twelve-month liquidity bridge"),
        "quarterly_runway": ("cp2d.quarterly_runway", "Quarterly runway"),
    },
    "CP-2B": {
        "catalyst_summary": ("cp2b.catalyst_summary", "Catalyst summary"),
        "catalyst_register": ("cp2b.catalyst_register", "Catalyst register"),
        "monitoring_actions": ("cp2b.monitoring_actions", "Monitoring actions"),
    },
    "CP-4B": {
        "entity_perimeter": ("cp4b.entity_perimeter", "Entity perimeter"),
        "guarantor_coverage": ("cp4b.guarantor_coverage", "Guarantor coverage"),
        "structural_priority": ("cp4b.structural_priority", "Structural priority"),
        "leakage_routes": ("cp4b.leakage_routes", "Leakage routes"),
    },
    "CP-6": {
        "bull_opening": ("cp6.bull_opening", "Bull opening"),
        "bear_cross_examination": (
            "cp6.bear_cross_examination",
            "Bear cross-examination",
        ),
        "evidence_weighting": ("cp6.evidence_weighting", "Evidence weighting"),
        "resolution_matrix": ("cp6.resolution_matrix", "Resolution matrix"),
        "decision_summary": ("cp6.decision_summary", "Decision summary"),
    },
    "CP-5A": {
        "clearance_summary": ("cp5a.clearance_summary", "Clearance summary"),
        "audit_lanes": ("cp5a.audit_lanes", "Audit lane results"),
        "findings_register": ("cp5a.findings_register", "Findings register"),
        "retest_status": ("cp5a.retest_status", "Retest status"),
    },
}


def ascii_text(value: Any) -> str:
    """Return stable PDF text using ASCII punctuation."""

    text = str(value)
    replacements = {
        "\u2011": "-",
        "\u2012": "-",
        "\u2013": "-",
        "\u2014": "-",
        "\u2212": "-",
        "\u2192": "->",
        "\u00a0": " ",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    return text


def clean_markup(value: Any) -> str:
    text = ascii_text(value)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1 (\2)", text)
    return text.replace("**", "").replace("__", "").replace("`", "").strip()


def paragraph_text(value: Any) -> str:
    """Escape source text before passing it to ReportLab's XML-like parser."""

    return html.escape(clean_markup(value), quote=False)


def paragraph_markup(value: Any) -> str:
    """Escape display text while retaining clickable HTTP(S) URI annotations."""

    text = clean_markup(value)
    parts: list[str] = []
    cursor = 0
    for match in re.finditer(r"https?://[^\s<>()]+", text):
        parts.append(html.escape(text[cursor:match.start()], quote=False))
        matched_url = match.group()
        url = matched_url.rstrip(".,;:!?")
        trailing_punctuation = matched_url[len(url):]
        escaped_url = html.escape(url, quote=True)
        parts.append(
            f'<link href="{escaped_url}" color="#2F6BFF">'
            f"{html.escape(url, quote=False)}</link>"
        )
        parts.append(html.escape(trailing_punctuation, quote=False))
        cursor = match.end()
    parts.append(html.escape(text[cursor:], quote=False))
    return "".join(parts)


def parse_number(value: Any) -> float | None:
    """Parse a Markdown numeric cell without treating missing values as zero."""

    text = clean_markup(value).strip()
    if not text or text in {"-", "--", "\u2014", "N/A", "[Insufficient Information]"}:
        return None
    negative = text.startswith("(") and text.endswith(")")
    text = text.strip("()").replace(",", "").replace("$", "").replace("\u00a3", "")
    text = text.replace("\u20ac", "").replace("%", "").rstrip("x")
    match = re.search(r"[-+]?\d+(?:\.\d+)?", text)
    if not match:
        return None
    number = float(match.group())
    return -abs(number) if negative else number


def profile_table(report: "Report", role: str) -> list[list[str]]:
    profile = get_profile(report.module_id)
    try:
        table_spec = next(table for table in profile.tables if table.role == role)
    except StopIteration as error:
        raise KeyError(
            f"{report.module_id}: visual profile table role not configured: {role}"
        ) from error
    for record in report.table_records:
        if record.table_id.casefold() == table_spec.stable_id.casefold():
            return record.rows
    if profile.state is ProfileState.PRODUCTION and table_spec.required:
        raise KeyError(
            f"{report.module_id}: required stable table-id not found: "
            f"{table_spec.stable_id}"
        )
    for candidate in (table_spec.heading, *PROFILE_TABLES.get(report.module_id, {}).get(role, ())):
        try:
            return report.table(candidate)
        except KeyError:
            pass
    raise KeyError(
        f"{report.module_id}: no table matched role {role}: "
        f"{table_spec.stable_id}, {table_spec.heading}"
    )


@dataclass(frozen=True)
class TableRecord:
    table_id: str
    title: str
    section: str
    rows: list[list[str]]


@dataclass(frozen=True)
class Report:
    fields: dict[str, Any]
    blocks: list[Block]
    summary: str
    tables: dict[str, list[list[str]]]
    table_records: tuple[TableRecord, ...]
    sections: dict[str, list[Block]]

    @property
    def module_id(self) -> str:
        return str(self.fields["module_id"])

    def table(self, name: str) -> list[list[str]]:
        target = name.casefold()
        for record in self.table_records:
            if target in {record.table_id.casefold(), record.title.casefold()}:
                return record.rows
        for record in self.table_records:
            if target in record.title.casefold():
                return record.rows
        raise KeyError(f"{self.module_id}: required table not found: {name}")


TABLE_ID_PATTERN = re.compile(
    r"<!--\s*table-id:\s*([A-Za-z][A-Za-z0-9._:-]{2,80})\s*-->"
)


def _is_markdown_table_start(lines: Sequence[str], index: int) -> bool:
    if index + 1 >= len(lines) or not lines[index].strip().startswith("|"):
        return False
    cells = [
        cell.strip()
        for cell in lines[index + 1].strip().strip("|").split("|")
    ]
    return bool(cells) and all(
        re.fullmatch(r":?-{3,}:?", cell)
        for cell in cells
    )


def extract_table_ids(body: str) -> dict[int, str]:
    """Map zero-based table ordinals to explicit structural Markdown IDs."""

    lines = body.splitlines()
    explicit: dict[int, str] = {}
    seen: set[str] = set()
    pending: str | None = None
    table_ordinal = 0
    for index, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("<!--") and "table-id:" in stripped:
            match = TABLE_ID_PATTERN.fullmatch(stripped)
            if match is None:
                raise ValueError(f"Malformed table-id comment: {stripped}")
            if pending is not None:
                raise ValueError(f"Orphaned table-id: {pending}")
            pending = match.group(1)
            if pending.casefold() in seen:
                raise ValueError(f"Duplicate table-id: {pending}")
            seen.add(pending.casefold())
            continue
        if pending is not None and stripped:
            if not _is_markdown_table_start(lines, index):
                raise ValueError(
                    f"table-id {pending} must immediately precede a Markdown table"
                )
            explicit[table_ordinal] = pending
            pending = None
        if _is_markdown_table_start(lines, index):
            table_ordinal += 1
    if pending is not None:
        raise ValueError(f"Orphaned table-id: {pending}")
    return explicit


def fallback_table_id(module_id: str, title: str, ordinal: int) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", title.casefold()).strip("_")
    slug = slug or "table"
    return f"{module_id.casefold().replace('-', '')}.{slug}.{ordinal + 1}"


def load_report(path: Path) -> Report:
    text = path.read_text(encoding="utf-8")
    validation = validate_text(text)
    if validation.exit_code != 0:
        details = [*validation.errors, *validation.identity_mismatches]
        raise ValueError("Invalid canonical Markdown: " + "; ".join(details))
    fields, body = _parse_frontmatter(text)
    explicit_table_ids = extract_table_ids(body)
    blocks = parse_markdown_body(body)

    sections: dict[str, list[Block]] = {}
    tables: dict[str, list[list[str]]] = {}
    table_records: list[TableRecord] = []
    current_h2 = ""
    current_h3 = ""
    for block in blocks:
        if block.kind == "h2":
            current_h2 = block.value
            current_h3 = ""
            sections.setdefault(current_h2, [])
        elif block.kind == "h3":
            current_h3 = block.value
            sections.setdefault(current_h2, []).append(block)
        else:
            sections.setdefault(current_h2, []).append(block)
            if block.kind == "table":
                table_name = current_h3 or current_h2 or f"Table {len(tables) + 1}"
                rows = [
                    [clean_markup(cell) for cell in row]
                    for row in block.value
                ]
                ordinal = len(table_records)
                table_id = explicit_table_ids.get(
                    ordinal,
                    fallback_table_id(
                        str(fields["module_id"]),
                        table_name,
                        ordinal,
                    ),
                )
                record = TableRecord(
                    table_id=table_id,
                    title=table_name,
                    section=current_h2,
                    rows=rows,
                )
                table_records.append(record)
                tables[table_id] = rows

    summary_parts = [
        block.value
        for block in sections.get("Audit Summary", [])
        if block.kind == "paragraph"
    ]
    summary = " ".join(summary_parts).strip()
    return Report(
        fields=fields,
        blocks=blocks,
        summary=summary,
        tables=tables,
        table_records=tuple(table_records),
        sections=sections,
    )


def para(
    canvas: Canvas,
    text: str,
    x: float,
    top: float,
    width: float,
    height: float,
    *,
    size: float = 9,
    leading: float | None = None,
    color: Color = INK,
    font: str = "Helvetica",
    bold: bool = False,
    label: str = "paragraph",
) -> float:
    """Draw wrapped text and fail rather than clip it."""

    style = ParagraphStyle(
        f"visual-{label}",
        fontName="Helvetica-Bold" if bold else font,
        fontSize=size,
        leading=leading or size * 1.25,
        textColor=color,
        alignment=TA_LEFT,
        spaceBefore=0,
        spaceAfter=0,
        allowWidows=0,
        allowOrphans=0,
    )
    paragraph = Paragraph(paragraph_markup(text), style)
    _, required = paragraph.wrap(width, 2000)
    if required > height + 0.25:
        raise RuntimeError(
            f"OVERFLOW {label}: requires {required:.1f}pt, available {height:.1f}pt"
        )
    paragraph.drawOn(canvas, x, top - required)
    return required


def rounded(
    canvas: Canvas,
    x: float,
    y: float,
    width: float,
    height: float,
    *,
    fill: Color = WHITE,
    stroke: Color = BORDER,
    radius: float = 7,
    line_width: float = 0.8,
) -> None:
    canvas.setFillColor(fill)
    canvas.setStrokeColor(stroke)
    canvas.setLineWidth(line_width)
    canvas.roundRect(x, y, width, height, radius, fill=1, stroke=1)


def rule(
    canvas: Canvas,
    x1: float,
    y: float,
    x2: float,
    *,
    color: Color = BORDER,
    width: float = 0.7,
) -> None:
    canvas.setStrokeColor(color)
    canvas.setLineWidth(width)
    canvas.line(x1, y, x2, y)


class VisualReport:
    def __init__(self, report: Report, output: Path):
        self.report = report
        self.profile = get_profile(report.module_id)
        self.output = output
        self.page_no = 0
        self.accent = HexColor(self.profile.accent_hex)
        output.parent.mkdir(parents=True, exist_ok=True)
        self.canvas = Canvas(
            str(output),
            pagesize=A4,
            pageCompression=1,
            invariant=1,
        )
        self.canvas.setTitle(
            ascii_text(
                f"{report.fields.get('issuer_name', 'CP')} {report.module_id} Visual Report"
            )
        )
        self.canvas.setAuthor("CP Agents deterministic visual PDF pilot")
        self.canvas.setSubject("Presentation view generated from validated canonical Markdown")
        self.canvas._doc.Catalog.Lang = PDFString("en-GB")
        self.canvas.setViewerPreference("DisplayDocTitle", PDFtrue)
        self.canvas.showOutline()

    def save(self) -> None:
        self.canvas.save()

    def bookmark(self, title: str, key: str, *, level: int = 1) -> None:
        self.canvas.bookmarkPage(key)
        self.canvas.addOutlineEntry(
            ascii_text(title),
            key,
            level=level,
            closed=False,
        )

    def new_page(self, section: str, *, bookmark: str | None = None) -> None:
        if self.page_no:
            self.canvas.showPage()
        self.page_no += 1
        if bookmark:
            self.canvas.bookmarkPage(bookmark)
            self.canvas.addOutlineEntry(section, bookmark, level=0, closed=False)
        self._header(section)
        self._footer()

    def _header(self, section: str) -> None:
        c = self.canvas
        c.setFillColor(NAVY)
        c.rect(0, PH - 16 * mm, PW, 16 * mm, fill=1, stroke=0)
        c.setFillColor(self.accent)
        c.rect(0, PH - 16 * mm, 4 * mm, 16 * mm, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(9 * mm, PH - 6.5 * mm, self.report.module_id)
        c.setFillColor(HexColor("#C4D0DE"))
        c.setFont("Helvetica", 7.5)
        c.drawString(9 * mm, PH - 11.3 * mm, ascii_text(section).upper())
        issuer = self.report.fields.get("issuer_name", self.report.fields.get("scope_key", ""))
        period = self.report.fields.get("reporting_period", "")
        right = f"{issuer} | {period}"
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawRightString(PW - 9 * mm, PH - 8.7 * mm, ascii_text(right))

    def _footer(self) -> None:
        c = self.canvas
        rule(c, MARGIN, 11 * mm, PW - MARGIN)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 6.8)
        c.drawString(MARGIN, 6.5 * mm, "Generated from validated canonical Markdown")
        c.drawRightString(PW - MARGIN, 6.5 * mm, f"{self.page_no:02d}")

    def cover(self, conclusion: str) -> None:
        if self.page_no:
            self.canvas.showPage()
        self.page_no += 1
        c = self.canvas
        c.setFillColor(NAVY)
        c.rect(0, 0, PW, PH, fill=1, stroke=0)
        c.setFillColor(self.accent)
        c.rect(0, PH - 12 * mm, PW, 12 * mm, fill=1, stroke=0)

        c.setFillColor(HexColor("#C9D6E4"))
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(MARGIN, PH - 30 * mm, "CP VISUAL REPORT / PILOT")
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 25)
        c.drawString(MARGIN, PH - 46 * mm, self.report.module_id)
        title = ascii_text(self.report.fields["module_name"])
        title_size = 25
        while stringWidth(title, "Helvetica-Bold", title_size) > CONTENT_W and title_size > 18:
            title_size -= 0.5
        c.setFont("Helvetica-Bold", title_size)
        c.drawString(MARGIN, PH - 58 * mm, title)

        issuer = self.report.fields.get("issuer_name", self.report.fields.get("scope_key", ""))
        c.setFillColor(HexColor("#DDE7F0"))
        c.setFont("Helvetica", 14)
        c.drawString(MARGIN, PH - 71 * mm, ascii_text(issuer))

        card_top = PH - 93 * mm
        rounded(
            c,
            MARGIN,
            card_top - 42 * mm,
            CONTENT_W,
            42 * mm,
            fill=HexColor("#173A5E"),
            stroke=HexColor("#35516E"),
            radius=10,
        )
        c.setFillColor(self.accent)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(MARGIN + 7 * mm, card_top - 9 * mm, self.profile.kicker.upper())
        para(
            c,
            conclusion,
            MARGIN + 7 * mm,
            card_top - 14 * mm,
            CONTENT_W - 14 * mm,
            25 * mm,
            size=10.5,
            leading=13,
            color=WHITE,
            bold=True,
            label="cover-conclusion",
        )

        self._confidence_strip(PH - 154 * mm)
        self._cover_metadata(PH - 185 * mm)
        c.setFillColor(HexColor("#9FB0C2"))
        c.setFont("Helvetica", 7)
        c.drawString(MARGIN, 13 * mm, "PILOT OUTPUT - NOT INVESTMENT RESEARCH")
        c.drawRightString(PW - MARGIN, 13 * mm, f"{self.page_no:02d}")

    def _confidence_strip(self, top: float) -> None:
        c = self.canvas
        score = int(self.report.fields["confidence_score"])
        band = ascii_text(self.report.fields["confidence_band"])
        qa = ascii_text(self.report.fields["qa_status"])
        width = CONTENT_W
        rounded(c, MARGIN, top - 21 * mm, width, 21 * mm, fill=WHITE, stroke=WHITE)
        c.setFillColor(MUTED)
        c.setFont("Helvetica-Bold", 7)
        c.drawString(MARGIN + 6 * mm, top - 7 * mm, "CONFIDENCE")
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 20)
        c.drawString(MARGIN + 6 * mm, top - 15 * mm, str(score))
        c.setFillColor(MUTED)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(MARGIN + 22 * mm, top - 13.5 * mm, f"{band} | QA {qa}")
        bar_x = MARGIN + 73 * mm
        bar_y = top - 14 * mm
        bar_w = width - 81 * mm
        c.setFillColor(SOFT)
        c.roundRect(bar_x, bar_y, bar_w, 4 * mm, 2 * mm, fill=1, stroke=0)
        c.setFillColor(self.accent)
        c.roundRect(bar_x, bar_y, bar_w * score / 100, 4 * mm, 2 * mm, fill=1, stroke=0)

    def _cover_metadata(self, top: float) -> None:
        c = self.canvas
        rows = (
            ("Reporting period", self.report.fields.get("reporting_period", "")),
            ("Analysis date", self.report.fields.get("analysis_date", "")),
            ("Run ID", self.report.fields.get("run_id", "")),
            ("Committee status", self.report.fields.get("committee_status", "")),
        )
        for index, (label, value) in enumerate(rows):
            y = top - index * 8 * mm
            c.setFillColor(HexColor("#9FB0C2"))
            c.setFont("Helvetica-Bold", 7)
            c.drawString(MARGIN, y, label.upper())
            c.setFillColor(WHITE)
            c.setFont("Helvetica", 8.5)
            c.drawString(MARGIN + 39 * mm, y, ascii_text(value))

    def section_title(self, kicker: str, title: str, subtitle: str, *, top: float = TOP) -> float:
        c = self.canvas
        c.setFillColor(self.accent)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(MARGIN, top, ascii_text(kicker).upper())
        title_height = para(
            c,
            title,
            MARGIN,
            top - 4.5 * mm,
            CONTENT_W,
            24 * mm,
            size=22,
            leading=25,
            color=INK,
            bold=True,
            label=f"title-{title}",
        )
        subtitle_top = top - 6.5 * mm - title_height
        used = para(
            c,
            subtitle,
            MARGIN,
            subtitle_top,
            CONTENT_W,
            18 * mm,
            size=9,
            leading=11.5,
            color=MUTED,
            label=f"subtitle-{title}",
        )
        return subtitle_top - 3 * mm - used

    def text_card(
        self,
        x: float,
        top: float,
        width: float,
        height: float,
        title: str,
        body: str,
        *,
        fill: Color = WHITE,
        accent: Color | None = None,
        body_size: float = 8.2,
    ) -> None:
        accent = accent or self.accent
        rounded(self.canvas, x, top - height, width, height, fill=fill)
        self.canvas.setFillColor(accent)
        self.canvas.rect(x, top - height, 3, height, fill=1, stroke=0)
        self.canvas.setFillColor(accent)
        self.canvas.setFont("Helvetica-Bold", 7)
        self.canvas.drawString(x + 4 * mm, top - 6 * mm, ascii_text(title).upper())
        para(
            self.canvas,
            body,
            x + 4 * mm,
            top - 9 * mm,
            width - 8 * mm,
            height - 13 * mm,
            size=body_size,
            leading=body_size * 1.25,
            label=f"card-{title}",
        )

    def kpi_card(
        self,
        x: float,
        top: float,
        width: float,
        label: str,
        value: str,
        note: str,
        *,
        tone: Color | None = None,
    ) -> None:
        tone = tone or self.accent
        height = 29 * mm
        rounded(self.canvas, x, top - height, width, height, fill=WHITE)
        self.canvas.setFillColor(tone)
        self.canvas.rect(x, top - 2.5, width, 2.5, fill=1, stroke=0)
        self.canvas.setFillColor(MUTED)
        self.canvas.setFont("Helvetica-Bold", 6.8)
        self.canvas.drawString(x + 4 * mm, top - 7 * mm, ascii_text(label).upper())
        value_size = 17
        while stringWidth(value, "Helvetica-Bold", value_size) > width - 8 * mm and value_size > 11:
            value_size -= 0.5
        self.canvas.setFillColor(INK)
        self.canvas.setFont("Helvetica-Bold", value_size)
        self.canvas.drawString(x + 4 * mm, top - 17 * mm, ascii_text(value))
        para(
            self.canvas,
            note,
            x + 4 * mm,
            top - 20 * mm,
            width - 8 * mm,
            7 * mm,
            size=6.8,
            leading=8,
            color=MUTED,
            label=f"kpi-{label}",
        )


def rows_as_dicts(rows: Sequence[Sequence[str]]) -> list[dict[str, str]]:
    if not rows:
        return []
    headers = [clean_markup(cell) for cell in rows[0]]
    return [
        {headers[index]: clean_markup(value) for index, value in enumerate(row)}
        for row in rows[1:]
    ]


def find_metric(rows: Sequence[Sequence[str]], metric: str) -> dict[str, str]:
    for row in rows_as_dicts(rows):
        first = next(iter(row.values()), "")
        if metric.casefold() == first.casefold():
            return row
    raise KeyError(f"Metric not found: {metric}")


def draw_bar_comparison(
    visual: VisualReport,
    rows: Sequence[tuple[str, float, str, Color]],
    *,
    x: float,
    top: float,
    width: float,
    height: float,
    title: str,
) -> None:
    c = visual.canvas
    rounded(c, x, top - height, width, height, fill=WHITE)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 5 * mm, top - 7 * mm, ascii_text(title))
    maximum = max(abs(value) for _, value, _, _ in rows) or 1
    label_w = width * 0.34
    bar_x = x + label_w
    bar_w = width - label_w - 12 * mm
    row_h = (height - 16 * mm) / len(rows)
    for index, (label, value, display, color) in enumerate(rows):
        cy = top - 15 * mm - index * row_h
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 7.4)
        c.drawString(x + 5 * mm, cy, ascii_text(label))
        c.setFillColor(SOFT)
        c.roundRect(bar_x, cy - 1.5 * mm, bar_w, 4 * mm, 2 * mm, fill=1, stroke=0)
        c.setFillColor(color)
        filled = max(1.5 * mm, bar_w * abs(value) / maximum)
        c.roundRect(bar_x, cy - 1.5 * mm, filled, 4 * mm, 2 * mm, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 7.2)
        c.drawRightString(x + width - 5 * mm, cy, ascii_text(display))


def draw_waterfall(
    visual: VisualReport,
    rows: Sequence[dict[str, str]],
    *,
    x: float,
    top: float,
    width: float,
    height: float,
) -> None:
    c = visual.canvas
    rounded(c, x, top - height, width, height, fill=WHITE)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 5 * mm, top - 7 * mm, "Twelve-month liquidity bridge")

    values = [parse_number(row.get("Amount", "")) for row in rows]
    valid = [value for value in values if value is not None]
    scale_max = max([abs(value) for value in valid] + [1])
    chart_left = x + 8 * mm
    chart_bottom = top - height + 20 * mm
    chart_height = height - 34 * mm
    slot = (width - 16 * mm) / max(1, len(rows))
    current = 0.0
    states: list[tuple[float, float, bool]] = []
    for row, value in zip(rows, values):
        if value is None:
            states.append((current, current, False))
            continue
        row_type = row.get("Type", "").casefold()
        if row_type in {"opening", "closing", "subtotal"}:
            before, after, total = 0.0, value, True
            current = value
        else:
            before, after, total = current, current + value, False
            current = after
        states.append((before, after, total))
    plotted_max = max([max(before, after) for before, after, _ in states] + [scale_max])
    plotted_min = min([min(before, after) for before, after, _ in states] + [0])
    span = plotted_max - plotted_min or 1

    def y_of(value: float) -> float:
        return chart_bottom + (value - plotted_min) / span * chart_height

    c.setStrokeColor(BORDER)
    c.setLineWidth(0.6)
    c.line(chart_left, y_of(0), x + width - 8 * mm, y_of(0))
    for index, (row, value, state) in enumerate(zip(rows, values, states)):
        cx = chart_left + index * slot + slot * 0.18
        bar_w = slot * 0.64
        before, after, is_total = state
        if value is None:
            c.setFillColor(MUTED)
            c.setFont("Helvetica-Bold", 8)
            c.drawCentredString(cx + bar_w / 2, y_of(0) + 2 * mm, "-")
        else:
            y1, y2 = y_of(before), y_of(after)
            bottom = min(y1, y2)
            bar_h = max(2, abs(y2 - y1))
            color = visual.accent if is_total else (GREEN if value >= 0 else RED)
            c.setFillColor(color)
            c.rect(cx, bottom, bar_w, bar_h, fill=1, stroke=0)
            c.setFillColor(INK)
            c.setFont("Helvetica-Bold", 6.5)
            c.drawCentredString(cx + bar_w / 2, max(y1, y2) + 2.2 * mm, row["Amount"])
        label = ascii_text(row.get("Component", ""))
        words = label.split()
        lines = [" ".join(words[:2]), " ".join(words[2:])] if len(words) > 2 else [label]
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 5.8)
        for line_index, line in enumerate(lines):
            if line:
                c.drawCentredString(cx + bar_w / 2, chart_bottom - (4 + line_index * 2.5) * mm, line)


def draw_runway(
    visual: VisualReport,
    rows: Sequence[dict[str, str]],
    *,
    x: float,
    top: float,
    width: float,
    height: float,
) -> None:
    c = visual.canvas
    rounded(c, x, top - height, width, height, fill=WHITE)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 5 * mm, top - 7 * mm, "Liquidity runway and minimum cash")
    values = [parse_number(row.get("Liquidity", "")) for row in rows]
    thresholds = [parse_number(row.get("Minimum Cash", "")) for row in rows]
    valid = [value for value in [*values, *thresholds] if value is not None]
    maximum = max(valid + [1]) * 1.12
    chart_left = x + 12 * mm
    chart_right = x + width - 8 * mm
    chart_bottom = top - height + 16 * mm
    chart_top = top - 17 * mm
    x_step = (chart_right - chart_left) / max(1, len(rows) - 1)

    def y_of(value: float) -> float:
        return chart_bottom + value / maximum * (chart_top - chart_bottom)

    c.setStrokeColor(BORDER)
    c.setLineWidth(0.6)
    for fraction in (0, 0.5, 1):
        y = chart_bottom + fraction * (chart_top - chart_bottom)
        c.line(chart_left, y, chart_right, y)
    for series, color, dash in ((thresholds, AMBER, [3, 2]), (values, visual.accent, [])):
        c.setStrokeColor(color)
        c.setLineWidth(2 if not dash else 1.2)
        c.setDash(dash)
        points = [
            (chart_left + index * x_step, y_of(value))
            for index, value in enumerate(series)
            if value is not None
        ]
        for first, second in zip(points, points[1:]):
            c.line(first[0], first[1], second[0], second[1])
        for px, py in points:
            c.setFillColor(color)
            c.circle(px, py, 2.4, fill=1, stroke=0)
        c.setDash([])
    for index, row in enumerate(rows):
        px = chart_left + index * x_step
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 6.2)
        c.drawCentredString(px, chart_bottom - 5 * mm, ascii_text(row.get("Period", "")))
        if values[index] is not None:
            c.setFillColor(INK)
            c.setFont("Helvetica-Bold", 6.2)
            c.drawCentredString(px, y_of(values[index]) + 2.4 * mm, row["Liquidity"])
    c.setFont("Helvetica-Bold", 6.5)
    c.setFillColor(visual.accent)
    c.drawString(chart_left, top - 12 * mm, "LIQUIDITY")
    c.setFillColor(AMBER)
    c.drawRightString(chart_right, top - 12 * mm, "MINIMUM CASH")


def draw_entity_map(
    visual: VisualReport,
    rows: Sequence[dict[str, str]],
    *,
    x: float,
    top: float,
    width: float,
    height: float,
) -> None:
    c = visual.canvas
    rounded(c, x, top - height, width, height, fill=WHITE)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 5 * mm, top - 7 * mm, "Restricted-group entity and guarantee map")

    levels = entity_hierarchy_levels(rows)
    if len(levels) > 4:
        raise ValueError(
            f"CP-4B entity map has {len(levels)} hierarchy levels; "
            "portrait profile supports at most 4"
        )
    widest_level = max(len(level) for level in levels)
    if widest_level > 4:
        raise ValueError(
            f"CP-4B entity map has {widest_level} entities on one level; "
            "portrait profile supports at most 4"
        )

    box_h = 17 * mm
    first_level_top = top - 17 * mm
    last_level_top = top - height + 9 * mm + box_h
    level_step = (
        0
        if len(levels) == 1
        else (first_level_top - last_level_top) / (len(levels) - 1)
    )
    horizontal_padding = 8 * mm
    horizontal_gap = 4 * mm
    available_width = width - 2 * horizontal_padding
    positions: list[tuple[float, float, float, dict[str, str]]] = []
    for depth, level in enumerate(levels):
        count = len(level)
        box_w = min(
            42 * mm,
            (available_width - horizontal_gap * (count - 1)) / count,
        )
        if box_w < 30 * mm:
            raise ValueError(
                "CP-4B entity labels cannot fit the portrait hierarchy at "
                f"depth {depth}; use a landscape or multipage profile"
            )
        row_width = count * box_w + (count - 1) * horizontal_gap
        left = x + (width - row_width) / 2
        by = (
            top - 32 * mm
            if len(levels) == 1
            else first_level_top - depth * level_step
        )
        for column, row in enumerate(level):
            bx = left + column * (box_w + horizontal_gap)
            positions.append((bx, by, box_w, row))

    positions_by_entity = {
        row.get("Entity", ""): (bx, by, box_w)
        for bx, by, box_w, row in positions
    }
    for child_x, child_top, child_w, row in positions:
        parent_position = positions_by_entity.get(row.get("Parent Entity", ""))
        if parent_position is None:
            continue
        parent_x, parent_top, parent_w = parent_position
        c.setStrokeColor(BORDER)
        c.setLineWidth(1)
        c.line(
            parent_x + parent_w / 2,
            parent_top - box_h,
            child_x + child_w / 2,
            child_top,
        )

    for bx, by, box_w, row in positions:
        status = row.get("Guarantor", "")
        fill = GREEN_BG if status == "Yes" else (RED_BG if status == "No" else PANEL)
        stroke = GREEN if status == "Yes" else (RED if status == "No" else BORDER)
        rounded(c, bx, by - box_h, box_w, box_h, fill=fill, stroke=stroke, radius=6)
        c.setFillColor(stroke)
        c.setFont("Helvetica-Bold", 6.5)
        c.drawString(bx + 3 * mm, by - 5 * mm, ascii_text(row.get("Role", "")).upper())
        para(
            c,
            row.get("Entity", ""),
            bx + 3 * mm,
            by - 8 * mm,
            box_w - 6 * mm,
            7 * mm,
            size=7.3,
            bold=True,
            label=f"entity-{row.get('Entity', '')}",
        )
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 6)
        c.drawString(
            bx + 3 * mm,
            by - 16 * mm,
            f"Guarantor {status} | {ascii_text(row.get('Jurisdiction', ''))}",
        )


def entity_hierarchy_levels(
    rows: Sequence[dict[str, str]],
) -> list[list[dict[str, str]]]:
    """Validate explicit parent edges and group entity rows by tree depth."""

    if not rows:
        raise ValueError("CP-4B entity map requires at least one entity")
    by_name: dict[str, dict[str, str]] = {}
    order: dict[str, int] = {}
    for index, row in enumerate(rows):
        name = row.get("Entity", "").strip()
        if not name:
            raise ValueError("CP-4B entity map contains an empty Entity")
        if name in by_name:
            raise ValueError(f"CP-4B entity map contains duplicate Entity: {name}")
        by_name[name] = row
        order[name] = index

    for name, row in by_name.items():
        parent = row.get("Parent Entity", "").strip()
        if parent == name:
            raise ValueError(f"CP-4B entity map contains a self-parent edge: {name}")
        if parent and parent not in by_name:
            raise ValueError(
                f"CP-4B entity map parent not found: {parent} for {name}"
            )

    depths: dict[str, int] = {}
    visiting: set[str] = set()

    def depth_of(name: str) -> int:
        if name in depths:
            return depths[name]
        if name in visiting:
            raise ValueError(f"CP-4B entity map contains a cycle at {name}")
        visiting.add(name)
        parent = by_name[name].get("Parent Entity", "").strip()
        depth = 0 if not parent else depth_of(parent) + 1
        visiting.remove(name)
        depths[name] = depth
        return depth

    for name in by_name:
        depth_of(name)

    levels: list[list[dict[str, str]]] = [
        []
        for _ in range(max(depths.values()) + 1)
    ]
    for name, row in by_name.items():
        levels[depths[name]].append(row)
    for level in levels:
        level.sort(
            key=lambda row: (
                order.get(row.get("Parent Entity", ""), -1),
                order[row["Entity"]],
            )
        )
    return levels


def draw_score_bars(
    visual: VisualReport,
    rows: Sequence[dict[str, str]],
    *,
    x: float,
    top: float,
    width: float,
    height: float,
) -> None:
    c = visual.canvas
    rounded(c, x, top - height, width, height, fill=WHITE)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 5 * mm, top - 7 * mm, "Chair evidence weighting")
    row_h = (height - 18 * mm) / len(rows)
    label_w = width * 0.42
    scale_x = x + label_w
    scale_w = width - label_w - 14 * mm
    for index, row in enumerate(rows):
        score = parse_number(row.get("Score (1-5)", row.get("Score", "")))
        y = top - 16 * mm - index * row_h
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 6.6)
        c.drawString(x + 5 * mm, y, ascii_text(row.get("Dimension", "")))
        c.setFillColor(SOFT)
        c.roundRect(scale_x, y - 1.5 * mm, scale_w, 3.6 * mm, 1.8 * mm, fill=1, stroke=0)
        if score is not None:
            color = GREEN if score < 3 else (AMBER if score == 3 else RED)
            c.setFillColor(color)
            c.roundRect(
                scale_x,
                y - 1.5 * mm,
                scale_w * score / 5,
                3.6 * mm,
                1.8 * mm,
                fill=1,
                stroke=0,
            )
            c.setFillColor(INK)
            c.setFont("Helvetica-Bold", 6.8)
            c.drawRightString(x + width - 5 * mm, y, f"{score:g}")
    c.setFillColor(GREEN)
    c.setFont("Helvetica-Bold", 6)
    c.drawString(scale_x, top - height + 5 * mm, "1 BULL")
    c.setFillColor(RED)
    c.drawRightString(scale_x + scale_w, top - height + 5 * mm, "5 BEAR")


def draw_catalyst_timeline(
    visual: VisualReport,
    rows: Sequence[dict[str, str]],
    *,
    x: float,
    top: float,
    width: float,
    height: float,
) -> None:
    c = visual.canvas
    rounded(c, x, top - height, width, height, fill=WHITE)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 5 * mm, top - 7 * mm, "Twelve-month catalyst timeline")
    if not rows:
        return
    ordered = sorted(rows, key=lambda row: row.get("Date", ""))
    line_x = x + 26 * mm
    first_y = top - 18 * mm
    last_y = top - height + 13 * mm
    row_step = 0 if len(ordered) == 1 else (first_y - last_y) / (len(ordered) - 1)
    c.setStrokeColor(BORDER)
    c.setLineWidth(1.2)
    c.line(line_x, first_y, line_x, last_y)
    for index, row in enumerate(ordered):
        y = first_y - index * row_step
        direction = row.get("Direction", "")
        tone = (
            GREEN
            if direction == "Positive"
            else RED if direction == "Negative" else AMBER
        )
        c.setFillColor(tone)
        c.circle(line_x, y, 3.2, fill=1, stroke=0)
        c.setFillColor(MUTED)
        c.setFont("Helvetica-Bold", 6.8)
        c.drawRightString(line_x - 4 * mm, y + 1, ascii_text(row.get("Date", "")))
        para(
            c,
            (
                f"{row.get('Event', '')} | {row.get('Probability', '')} probability "
                f"| {row.get('Impact', '')} impact | {row.get('Status', '')}"
            ),
            line_x + 5 * mm,
            y + 4.5 * mm,
            width - 36 * mm,
            13 * mm,
            size=7.2,
            leading=8.7,
            color=INK,
            bold=True,
            label=f"catalyst-{index}",
        )


def draw_probability_impact_matrix(
    visual: VisualReport,
    rows: Sequence[dict[str, str]],
    *,
    x: float,
    top: float,
    width: float,
    height: float,
) -> None:
    c = visual.canvas
    rounded(c, x, top - height, width, height, fill=WHITE)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 5 * mm, top - 7 * mm, "Probability-impact map")
    grid_size = min(width - 18 * mm, height - 34 * mm)
    cell = grid_size / 3
    left = x + 11 * mm
    bottom = top - height + 13 * mm
    fills = (
        (PANEL, PANEL, AMBER_BG),
        (PANEL, AMBER_BG, RED_BG),
        (AMBER_BG, RED_BG, RED_BG),
    )
    for impact in range(3):
        for probability in range(3):
            c.setFillColor(fills[impact][probability])
            c.setStrokeColor(WHITE)
            c.rect(
                left + probability * cell,
                bottom + impact * cell,
                cell,
                cell,
                fill=1,
                stroke=1,
            )
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Bold", 6.2)
    for index, label in enumerate(("LOW", "MEDIUM", "HIGH")):
        c.drawCentredString(left + (index + 0.5) * cell, bottom - 4 * mm, label)
        c.saveState()
        c.translate(left - 4 * mm, bottom + (index + 0.5) * cell)
        c.rotate(90)
        c.drawCentredString(0, 0, label)
        c.restoreState()
    c.setFillColor(MUTED)
    c.drawCentredString(left + grid_size / 2, bottom - 8 * mm, "PROBABILITY")
    c.saveState()
    c.translate(left - 8 * mm, bottom + grid_size / 2)
    c.rotate(90)
    c.drawCentredString(0, 0, "IMPACT")
    c.restoreState()

    scale = {"Low": 0, "Medium": 1, "High": 2}
    offsets = ((-3, 3), (3, -3), (-3, -3), (3, 3), (0, 0))
    for index, row in enumerate(rows):
        probability = scale.get(row.get("Probability", ""))
        impact = scale.get(row.get("Impact", ""))
        if probability is None or impact is None:
            continue
        offset_x, offset_y = offsets[index % len(offsets)]
        px = left + (probability + 0.5) * cell + offset_x
        py = bottom + (impact + 0.5) * cell + offset_y
        direction = row.get("Direction", "")
        tone = (
            GREEN
            if direction == "Positive"
            else RED if direction == "Negative" else AMBER
        )
        c.setFillColor(tone)
        c.circle(px, py, 7, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 5.4)
        label = row.get("Catalyst ID", str(index + 1)).split("-")[-1]
        c.drawCentredString(px, py - 2, ascii_text(label))


def draw_audit_lanes(
    visual: VisualReport,
    rows: Sequence[dict[str, str]],
    *,
    x: float,
    top: float,
    width: float,
    height: float,
) -> None:
    c = visual.canvas
    rounded(c, x, top - height, width, height, fill=WHITE)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 5 * mm, top - 7 * mm, "Audit lane clearance")
    row_h = (height - 19 * mm) / max(1, len(rows))
    for index, row in enumerate(rows):
        y = top - 17 * mm - index * row_h
        result = row.get("Result", "")
        tone = GREEN if result == "Passed" else RED
        c.setFillColor(PANEL if index % 2 == 0 else WHITE)
        c.rect(
            x + 4 * mm,
            y - row_h + 2 * mm,
            width - 8 * mm,
            row_h,
            fill=1,
            stroke=0,
        )
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 7.2)
        c.drawString(x + 7 * mm, y - 3 * mm, ascii_text(row.get("Lane", "")))
        c.setFillColor(tone)
        c.setFont("Helvetica-Bold", 6.8)
        c.drawRightString(
            x + width - 7 * mm,
            y - 3 * mm,
            f"{result.upper()} | {ascii_text(row.get('Highest Severity', ''))}",
        )
        count = parse_number(row.get("Finding Count", "")) or 0
        c.setFillColor(SOFT)
        c.roundRect(
            x + 7 * mm,
            y - 8 * mm,
            width - 14 * mm,
            2.6 * mm,
            1.3 * mm,
            fill=1,
            stroke=0,
        )
        if count:
            c.setFillColor(tone)
            c.roundRect(
                x + 7 * mm,
                y - 8 * mm,
                min(width - 14 * mm, 12 * mm * count),
                2.6 * mm,
                1.3 * mm,
                fill=1,
                stroke=0,
            )


def render_cp1(visual: VisualReport) -> None:
    report = visual.report
    core = profile_table(report, "core_financials")
    derived = profile_table(report, "derived_metrics")
    visual.cover(report.summary)
    visual.new_page("Financial profile", bookmark="financial-profile")
    cursor = visual.section_title(
        "CP-1 / Financial profile",
        "Credit-relevant financial snapshot",
        "Reported values and calculated metrics remain on their stated bases. "
        "The visual layer does not normalise or reconcile the source.",
    )

    core_by_metric = {next(iter(row.values())): row for row in rows_as_dicts(core)}
    derived_by_metric = {next(iter(row.values())): row for row in rows_as_dicts(derived)}
    cards = (
        ("Revenue", core_by_metric["Revenue"]["FY2025 value"], "USD millions | consolidated", BLUE),
        ("Total debt", derived_by_metric["Total debt"]["Value"], "USD millions | carrying value", RED),
        ("Cash", core_by_metric["Cash"]["FY2025 value"], "USD millions | cash only", TEAL),
        ("Free cash flow", derived_by_metric["FCF"]["Value"], "USD millions | calculated", RED),
    )
    gap = 4 * mm
    card_w = (CONTENT_W - 3 * gap) / 4
    top = cursor - 4 * mm
    for index, card in enumerate(cards):
        visual.kpi_card(
            MARGIN + index * (card_w + gap),
            top,
            card_w,
            card[0],
            card[1],
            card[2],
            tone=card[3],
        )

    bars = (
        ("Total debt", parse_number(derived_by_metric["Total debt"]["Value"]) or 0, derived_by_metric["Total debt"]["Value"], RED),
        ("Cash", parse_number(core_by_metric["Cash"]["FY2025 value"]) or 0, core_by_metric["Cash"]["FY2025 value"], TEAL),
        (
            "Short-term investments",
            parse_number(core_by_metric["Short-term investments"]["FY2025 value"]) or 0,
            core_by_metric["Short-term investments"]["FY2025 value"],
            BLUE,
        ),
        ("FCF", parse_number(derived_by_metric["FCF"]["Value"]) or 0, derived_by_metric["FCF"]["Value"], RED),
    )
    draw_bar_comparison(
        visual,
        bars,
        x=MARGIN,
        top=top - 36 * mm,
        width=CONTENT_W,
        height=61 * mm,
        title="Debt, liquidity, and cash generation (USD millions)",
    )
    visual.text_card(
        MARGIN,
        top - 103 * mm,
        (CONTENT_W - gap) / 2,
        39 * mm,
        "Perimeter warning",
        "Spirit closed on 8 December 2025. Year-end assets include the acquired "
        "perimeter, while FY2025 revenue and operating earnings include less than one month.",
        fill=AMBER_BG,
        accent=AMBER,
    )
    visual.text_card(
        MARGIN + (CONTENT_W + gap) / 2,
        top - 103 * mm,
        (CONTENT_W - gap) / 2,
        39 * mm,
        "Definition warning",
        "Reported operating earnings include a 9,672 disposition gain. "
        "The EBITDA proxy is calculated and not normalised.",
        fill=RED_BG,
        accent=RED,
    )


def render_cp2b(visual: VisualReport) -> None:
    report = visual.report
    summary = {
        row["Metric"]: row
        for row in rows_as_dicts(profile_table(report, "catalyst_summary"))
    }
    catalysts = rows_as_dicts(profile_table(report, "catalyst_register"))
    visual.cover(report.summary)
    visual.new_page("Catalyst calendar", bookmark="catalyst-calendar")
    cursor = visual.section_title(
        "CP-2B / Event catalysts",
        "Dated events, priority, and monitoring",
        "Event timing, probability, impact, direction, and status are presented "
        "exactly as stated in the canonical catalyst register.",
    )
    cards = (
        (
            "Registered catalysts",
            summary["Registered catalysts"]["Value"],
            "Twelve-month register",
            BLUE,
        ),
        (
            "High priority",
            summary["High-priority catalysts"]["Value"],
            "Combined probability and impact",
            RED,
        ),
        (
            "Next dated event",
            summary["Next dated catalyst"]["Value"],
            summary["Next dated catalyst"]["Status"],
            AMBER,
        ),
        (
            "Open actions",
            summary["Open monitoring actions"]["Value"],
            summary["Open monitoring actions"]["Status"],
            PURPLE,
        ),
    )
    gap = 4 * mm
    card_w = (CONTENT_W - 3 * gap) / 4
    top = cursor - 4 * mm
    for index, item in enumerate(cards):
        visual.kpi_card(
            MARGIN + index * (card_w + gap),
            top,
            card_w,
            item[0],
            item[1],
            item[2],
            tone=item[3],
        )
    story_top = top - 36 * mm
    timeline_w = CONTENT_W * 0.61
    draw_catalyst_timeline(
        visual,
        catalysts,
        x=MARGIN,
        top=story_top,
        width=timeline_w,
        height=135 * mm,
    )
    draw_probability_impact_matrix(
        visual,
        catalysts,
        x=MARGIN + timeline_w + gap,
        top=story_top,
        width=CONTENT_W - timeline_w - gap,
        height=135 * mm,
    )


def render_cp2d(visual: VisualReport) -> None:
    report = visual.report
    snapshot = rows_as_dicts(profile_table(report, "liquidity_snapshot"))
    bridge = rows_as_dicts(profile_table(report, "liquidity_bridge"))
    runway = rows_as_dicts(profile_table(report, "quarterly_runway"))
    visual.cover(report.summary)
    visual.new_page("Liquidity runway", bookmark="liquidity-runway")
    cursor = visual.section_title(
        "CP-2D / Liquidity",
        "Runway, cash uses, and pressure points",
        "The bridge separates opening liquidity, operating generation, mandatory uses, "
        "and minimum-cash constraints over the stated twelve-month horizon.",
    )
    snapshot_map = {row["Metric"]: row for row in snapshot}
    card_items = (
        ("Opening liquidity", snapshot_map["Opening liquidity"]["Value"], "USD millions", TEAL),
        ("Revolver availability", snapshot_map["Revolver availability"]["Value"], "USD millions", BLUE),
        ("Minimum cash", snapshot_map["Minimum cash"]["Value"], "USD millions", AMBER),
        ("Closing liquidity", snapshot_map["Closing liquidity"]["Value"], "USD millions", TEAL),
    )
    gap = 4 * mm
    card_w = (CONTENT_W - 3 * gap) / 4
    top = cursor - 4 * mm
    for index, item in enumerate(card_items):
        visual.kpi_card(
            MARGIN + index * (card_w + gap),
            top,
            card_w,
            item[0],
            item[1],
            item[2],
            tone=item[3],
        )
    draw_waterfall(
        visual,
        bridge,
        x=MARGIN,
        top=top - 35 * mm,
        width=CONTENT_W,
        height=76 * mm,
    )
    draw_runway(
        visual,
        runway,
        x=MARGIN,
        top=top - 116 * mm,
        width=CONTENT_W,
        height=66 * mm,
    )


def render_cp4b(visual: VisualReport) -> None:
    report = visual.report
    entities = rows_as_dicts(profile_table(report, "entity_perimeter"))
    coverage = rows_as_dicts(profile_table(report, "guarantor_coverage"))
    priority = rows_as_dicts(profile_table(report, "structural_priority"))
    leakage = rows_as_dicts(profile_table(report, "leakage_routes"))
    visual.cover(report.summary)
    visual.new_page("Entity and guarantee map", bookmark="entity-map")
    cursor = visual.section_title(
        "CP-4B / Structural map",
        "Where value sits and which claims reach it",
        "Entity, guarantee, collateral, and leakage relationships are shown only where "
        "the synthetic pilot source states the connection.",
    )
    draw_entity_map(
        visual,
        entities,
        x=MARGIN,
        top=cursor - 4 * mm,
        width=CONTENT_W,
        height=112 * mm,
    )
    gap = 4 * mm
    top = cursor - 121 * mm
    for index, row in enumerate(coverage[:2]):
        body = (
            f"{row['Instrument']} | borrower {row['Borrower']}. "
            f"Guarantor EBITDA coverage {row['EBITDA Coverage']}; "
            f"collateral {row['Collateral']}. Status: {row['Status']}."
        )
        visual.text_card(
            MARGIN + index * ((CONTENT_W + gap) / 2),
            top,
            (CONTENT_W - gap) / 2,
            38 * mm,
            f"Coverage {index + 1}",
            body,
            fill=TEAL_BG if row["Status"] == "Covered" else RED_BG,
            accent=TEAL if row["Status"] == "Covered" else RED,
        )

    visual.new_page("Priority and leakage", bookmark="priority-leakage")
    cursor = visual.section_title(
        "CP-4B / Creditor outcomes",
        "Structural priority and leakage exposure",
        "The visual separates claim ranking from leakage mechanics. Neither is a legal opinion.",
    )
    top = cursor - 3 * mm
    card_h = 27 * mm
    for index, row in enumerate(priority[:4]):
        tone = GREEN if "Senior" in row["Label"] else (RED if "Subordinated" in row["Label"] else AMBER)
        visual.text_card(
            MARGIN,
            top - index * (card_h + 3 * mm),
            CONTENT_W * 0.56,
            card_h,
            f"Rank {row['Rank']} / {row['Instrument']}",
            f"{row['Label']}. {row['Rationale']}",
            fill=WHITE,
            accent=tone,
            body_size=7.5,
        )
    leak_x = MARGIN + CONTENT_W * 0.60
    leak_w = CONTENT_W * 0.40
    for index, row in enumerate(leakage[:3]):
        tone = RED if row["Severity"].startswith(("4", "5")) else AMBER
        visual.text_card(
            leak_x,
            top - index * (36 * mm),
            leak_w,
            32 * mm,
            row["Route"],
            f"Severity {row['Severity']}. {row['Mechanic']} Control: {row['Control']}.",
            fill=RED_BG if tone == RED else AMBER_BG,
            accent=tone,
            body_size=7.2,
        )


def render_cp5a(visual: VisualReport) -> None:
    report = visual.report
    summary = {
        row["Field"]: row["Value"]
        for row in rows_as_dicts(profile_table(report, "clearance_summary"))
    }
    lanes = rows_as_dicts(profile_table(report, "audit_lanes"))
    findings = rows_as_dicts(profile_table(report, "findings_register"))
    visual.cover(report.summary)
    visual.new_page("QA clearance", bookmark="qa-clearance")
    cursor = visual.section_title(
        "CP-5A / Research integrity",
        "Clearance, findings, and remediation",
        "The page distinguishes passed audit lanes from findings that restrict "
        "committee use. Severity and status remain controlled source values.",
    )
    cards = (
        ("Clearance", summary["Clearance"], "Committee use", RED),
        ("Critical", summary["Critical findings"], "Open findings", GREEN),
        ("Material", summary["Material findings"], "Open findings", RED),
        ("Minor", summary["Minor findings"], "Open findings", AMBER),
    )
    gap = 4 * mm
    card_w = (CONTENT_W - 3 * gap) / 4
    top = cursor - 4 * mm
    for index, item in enumerate(cards):
        visual.kpi_card(
            MARGIN + index * (card_w + gap),
            top,
            card_w,
            item[0],
            item[1],
            item[2],
            tone=item[3],
        )

    story_top = top - 36 * mm
    lane_w = CONTENT_W * 0.58
    draw_audit_lanes(
        visual,
        lanes,
        x=MARGIN,
        top=story_top,
        width=lane_w,
        height=137 * mm,
    )
    finding_x = MARGIN + lane_w + gap
    finding_w = CONTENT_W - lane_w - gap
    for index, finding in enumerate(findings[:2]):
        tone = RED if finding["Severity"] in {"Critical", "Material"} else AMBER
        visual.text_card(
            finding_x,
            story_top - index * 52 * mm,
            finding_w,
            47 * mm,
            f"{finding['Severity']} / {finding['Finding ID']}",
            (
                f"{finding['Finding']} Remediation: {finding['Remediation']} "
                f"Owner: {finding['Owner']}. Status: {finding['Status']}."
            ),
            fill=RED_BG if tone == RED else AMBER_BG,
            accent=tone,
            body_size=7.1,
        )
    visual.text_card(
        finding_x,
        story_top - 104 * mm,
        finding_w,
        33 * mm,
        "Clearance implication",
        "Committee circulation remains restricted until the open Material "
        "market-data finding is closed.",
        fill=PURPLE_BG,
        accent=PURPLE,
        body_size=7.2,
    )


def render_cp6(visual: VisualReport) -> None:
    report = visual.report
    bulls = rows_as_dicts(profile_table(report, "bull_opening"))
    bears = rows_as_dicts(profile_table(report, "bear_cross_examination"))
    scores = rows_as_dicts(profile_table(report, "evidence_weighting"))
    resolutions = rows_as_dicts(profile_table(report, "resolution_matrix"))
    decision = {
        row["Field"]: row["Value"]
        for row in rows_as_dicts(profile_table(report, "decision_summary"))
    }
    visual.cover(
        f"Final Action Bias: {decision['Final Action Bias']}. "
        f"Winner: {decision['Debate Winner']}. {decision['Decision Rationale']}"
    )
    visual.new_page("Bull versus Bear", bookmark="bull-bear")
    cursor = visual.section_title(
        "CP-6 / Adversarial debate",
        "Central controversy: compensation versus downside",
        "Exactly three Bull claims are tested against the corresponding Bear attacks. "
        "The presentation does not add arguments to either side.",
    )
    gap = 5 * mm
    col_w = (CONTENT_W - gap) / 2
    top = cursor - 3 * mm
    for index, (bull, bear) in enumerate(zip(bulls[:3], bears[:3])):
        row_top = top - index * 52 * mm
        visual.text_card(
            MARGIN,
            row_top,
            col_w,
            47 * mm,
            f"Bull claim {bull['Claim']}",
            f"Evidence: {bull['Evidence']} Mechanic: {bull['Risk Mechanic']} "
            f"Monitoring: {bull['Monitoring Signal']}",
            fill=GREEN_BG,
            accent=GREEN,
            body_size=7.3,
        )
        visual.text_card(
            MARGIN + col_w + gap,
            row_top,
            col_w,
            47 * mm,
            f"Bear attack {bear['Claim Attacked']}",
            f"Counter-evidence: {bear['Counter-Evidence']} "
            f"Mechanic: {bear['Risk Mechanic']} Test: {bear['Falsifiability Test']}",
            fill=RED_BG,
            accent=RED,
            body_size=7.3,
        )

    visual.new_page("Chair adjudication", bookmark="chair-adjudication")
    cursor = visual.section_title(
        "CP-6 / Chair",
        "Evidence weighting and resolution",
        "Scores run from 1 (Bull clearly superior) to 5 (Bear clearly superior). "
        "The action bias remains a controlled taxonomy value.",
    )
    draw_score_bars(
        visual,
        scores,
        x=MARGIN,
        top=cursor - 3 * mm,
        width=CONTENT_W * 0.55,
        height=112 * mm,
    )
    side_x = MARGIN + CONTENT_W * 0.59
    side_w = CONTENT_W * 0.41
    visual.text_card(
        side_x,
        cursor - 3 * mm,
        side_w,
        37 * mm,
        "Final action bias",
        f"{decision['Final Action Bias']}. {decision['Decision Rationale']}",
        fill=AMBER_BG,
        accent=AMBER,
        body_size=8,
    )
    visual.text_card(
        side_x,
        cursor - 44 * mm,
        side_w,
        35 * mm,
        "Greatest uncertainty",
        decision["Single Greatest Uncertainty"],
        fill=PURPLE_BG,
        accent=PURPLE,
        body_size=7.7,
    )
    resolution_counts: dict[str, int] = {}
    for row in resolutions:
        resolution_counts[row["Resolution"]] = resolution_counts.get(row["Resolution"], 0) + 1
    count_text = " | ".join(f"{key}: {value}" for key, value in resolution_counts.items())
    visual.text_card(
        side_x,
        cursor - 83 * mm,
        side_w,
        32 * mm,
        "Resolution mix",
        count_text,
        fill=BLUE_BG,
        accent=BLUE,
        body_size=7.7,
    )


def table_column_widths(rows: Sequence[Sequence[str]], width: float) -> list[float]:
    headers = [clean_markup(value).strip().lower() for value in rows[0]]
    maxima = [
        max(len(clean_markup(row[index])) for row in rows)
        for index in range(len(rows[0]))
    ]
    weights: list[float] = []
    for header, maximum in zip(headers, maxima):
        minimum = 8.0
        if "date" in header or header == "period":
            minimum = 16.0
        elif header.endswith(" id") or header == "id":
            minimum = 13.0
        elif any(
            keyword in header
            for keyword in (
                "probability",
                "status",
                "result",
                "impact",
                "direction",
                "lineage",
                "role",
                "severity",
            )
        ):
            minimum = 12.0
        elif any(keyword in header for keyword in ("amount", "value", "score")):
            minimum = 12.0
        elif header == "unit":
            minimum = 10.0
        weights.append(min(36.0, max(minimum, float(maximum))))
    total = sum(weights)
    result = [width * weight / total for weight in weights]
    result[-1] += width - sum(result)
    return result


def cell_height(
    text: str,
    width: float,
    *,
    size: float = 6.5,
    leading: float = 8,
    bold: bool = False,
) -> float:
    style = ParagraphStyle(
        "table-measure",
        fontName="Helvetica-Bold" if bold else "Helvetica",
        fontSize=size,
        leading=leading,
        textColor=INK,
        alignment=TA_LEFT,
    )
    paragraph = Paragraph(paragraph_markup(text), style)
    _, required = paragraph.wrap(max(4, width - 4 * mm), 2000)
    return max(7 * mm, required + 3 * mm)


def draw_table_chunk(
    visual: VisualReport,
    rows: Sequence[Sequence[str]],
    title: str,
    start_index: int,
    top: float,
    *,
    continuation: bool,
    source_section: str,
) -> tuple[int, float]:
    """Draw one table chunk at the current cursor without forcing a new page."""

    c = visual.canvas
    heading = f"{title} (continued)" if continuation else title
    c.setFillColor(visual.accent)
    c.setFont("Helvetica-Bold", 6.8)
    label = f"{source_section} / canonical table"
    if continuation:
        label += " / continued"
    c.drawString(MARGIN, top, ascii_text(label).upper())
    title_height = para(
        c,
        heading,
        MARGIN,
        top - 3.5 * mm,
        CONTENT_W,
        12 * mm,
        size=12,
        leading=14,
        color=INK,
        bold=True,
        label=f"appendix-table-title-{title}",
    )
    widths = table_column_widths(rows, CONTENT_W)
    header = rows[0]
    y = top - 4.5 * mm - title_height - 2 * mm

    def draw_row(
        values: Sequence[str],
        row_height: float,
        *,
        header_row: bool,
        row_number: int = 0,
    ) -> None:
        nonlocal y
        x = MARGIN
        fill = NAVY if header_row else (PANEL if row_number % 2 else WHITE)
        c.setFillColor(fill)
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.5)
        for index, value in enumerate(values):
            c.rect(x, y - row_height, widths[index], row_height, fill=1, stroke=1)
            para(
                c,
                value,
                x + 2 * mm,
                y - 2 * mm,
                widths[index] - 4 * mm,
                row_height - 3 * mm,
                size=8.5,
                leading=10.2,
                color=WHITE if header_row else INK,
                bold=header_row,
                label=f"table-{title}-{index}",
            )
            x += widths[index]
        y -= row_height

    header_height = max(
        cell_height(value, widths[index], size=8.5, leading=10.2, bold=True)
        for index, value in enumerate(header)
    )
    draw_row(header, header_height, header_row=True)
    body_index = start_index
    while body_index < len(rows) - 1:
        values = rows[body_index + 1]
        row_height = max(
            cell_height(value, widths[index], size=8.5, leading=10.2)
            for index, value in enumerate(values)
        )
        if y - row_height < BOTTOM + 3 * mm:
            break
        draw_row(values, row_height, header_row=False, row_number=body_index)
        body_index += 1
    return body_index, y


def render_canonical_appendix(visual: VisualReport) -> None:
    report = visual.report
    visual.new_page("Canonical appendix", bookmark="canonical-appendix")
    cursor = visual.section_title(
        "Audit-complete record",
        "Canonical Markdown appendix",
        "Every source block is retained here so the visual report remains auditable "
        "without turning the main pages into a Word replica.",
    )
    c = visual.canvas
    y = cursor - 3 * mm
    current_h2 = ""
    current_h3 = ""
    table_ordinal = 0

    def new_appendix_page(section: str = "Canonical appendix") -> float:
        visual.new_page(section)
        return TOP

    def ensure_space(required: float, section: str = "Canonical appendix") -> None:
        nonlocal y
        if y - required < BOTTOM:
            y = new_appendix_page(section)

    for index, block in enumerate(report.blocks):
        next_kind = report.blocks[index + 1].kind if index + 1 < len(report.blocks) else ""
        if block.kind == "h2":
            current_h2 = block.value
            current_h3 = ""
            upcoming_table = next_kind == "table" or (
                next_kind == "h3"
                and index + 2 < len(report.blocks)
                and report.blocks[index + 2].kind == "table"
            )
            if upcoming_table:
                continue
            ensure_space(18 * mm)
            c.setFillColor(visual.accent)
            c.setFont("Helvetica-Bold", 13)
            c.drawString(MARGIN, y, ascii_text(block.value))
            y -= 8 * mm
        elif block.kind == "h3":
            current_h3 = block.value
            if next_kind == "table":
                continue
            ensure_space(14 * mm)
            c.setFillColor(INK)
            c.setFont("Helvetica-Bold", 9)
            c.drawString(MARGIN, y, ascii_text(block.value))
            y -= 6 * mm
        elif block.kind == "table":
            title = current_h3 or current_h2 or "Untitled table"
            body_index = 0
            continuation = False
            table_ordinal += 1
            widths = table_column_widths(block.value, CONTENT_W)
            header_height = max(
                cell_height(
                    value,
                    widths[column],
                    size=8.5,
                    leading=10.2,
                    bold=True,
                )
                for column, value in enumerate(block.value[0])
            )
            first_row_height = 0.0
            if len(block.value) > 1:
                first_row_height = max(
                    cell_height(value, widths[column], size=8.5, leading=10.2)
                    for column, value in enumerate(block.value[1])
                )
            minimum_chunk = 20 * mm + header_height + first_row_height
            ensure_space(
                minimum_chunk,
                f"Canonical appendix / {title}",
            )
            visual.bookmark(
                title,
                f"appendix-table-{table_ordinal}",
                level=1,
            )

            while True:
                next_index, y = draw_table_chunk(
                    visual,
                    block.value,
                    title,
                    body_index,
                    y,
                    continuation=continuation,
                    source_section=current_h2,
                )
                if len(block.value) == 1 or next_index == len(block.value) - 1:
                    break
                if next_index == body_index:
                    raise RuntimeError(f"Table row cannot fit on a fresh page: {title}")
                body_index = next_index
                continuation = True
                y = new_appendix_page(f"Canonical appendix / {title}")
            y -= 3 * mm
        elif block.kind in {"paragraph", "bullet", "number"}:
            ensure_space(18 * mm)
            available = y - BOTTOM
            prefix = "- " if block.kind == "bullet" else ""
            used = para(
                c,
                prefix + block.value,
                MARGIN,
                y,
                CONTENT_W,
                available,
                size=7.5,
                leading=9.3,
                color=INK,
                label="canonical-text",
            )
            y -= used + 3 * mm


def render_visual_pdf(markdown: Path, output: Path) -> dict[str, Any]:
    report = load_report(markdown)
    profile = get_profile(report.module_id)
    if not profile.pdf_enabled:
        raise ValueError(f"{report.module_id}: visual PDF is prohibited by module identity")
    if profile.state is not ProfileState.PRODUCTION:
        raise ValueError(
            f"{report.module_id}: visual PDF profile is {profile.state.value}; "
            "production rendering is unavailable"
        )
    output.parent.mkdir(parents=True, exist_ok=True)
    output_mode = output.stat().st_mode & 0o777 if output.exists() else 0o644
    with tempfile.NamedTemporaryFile(
        prefix=f".{output.name}.",
        suffix=".tmp",
        dir=output.parent,
        delete=False,
    ) as placeholder:
        temporary_output = Path(placeholder.name)

    renderers = {
        "cp1": render_cp1,
        "cp2b": render_cp2b,
        "cp2d": render_cp2d,
        "cp4b": render_cp4b,
        "cp5a": render_cp5a,
        "cp6": render_cp6,
    }
    try:
        visual = VisualReport(report, temporary_output)
        renderer = renderers.get(profile.renderer_key)
        if renderer is None:
            try:
                from tools.visual_pdf.archetypes import render_configured_profile
            except ModuleNotFoundError:
                from visual_pdf.archetypes import render_configured_profile

            render_configured_profile(visual, profile)
        else:
            renderer(visual)
        render_canonical_appendix(visual)
        visual.save()
        temporary_output.chmod(output_mode)
        temporary_output.replace(output)
    except BaseException:
        temporary_output.unlink(missing_ok=True)
        raise
    return {
        "module_id": report.module_id,
        "source": str(markdown),
        "output": str(output),
        "pages": visual.page_no,
        "table_count": len(report.tables),
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("markdown", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args(argv)
    result = render_visual_pdf(args.markdown, args.output)
    print(
        f"VALID module={result['module_id']} pages={result['pages']} "
        f"tables={result['table_count']} output={result['output']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
