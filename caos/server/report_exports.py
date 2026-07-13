"""Binary renderers for immutable Report Studio versions.

The renderers accept only the frozen ``ReportVersion`` payload/authority. They do
not query mutable domain state, recalculate credit metrics, or interpret prose.
"""

from __future__ import annotations

import html
import json
from io import BytesIO
from typing import Any, Iterable

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.table import Table, TableStyleInfo
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table as PdfTable, TableStyle


_INK = "1D2433"
_NAVY = "172238"
_BLUE = "2F64B7"
_MUTED = "687386"
_CREAM = "F7F5EE"


def _display(value: Any, *, limit: int = 2_000) -> str:
    if value is None:
        return ""
    if isinstance(value, (str, int, float, bool)):
        text = str(value)
    else:
        text = json.dumps(value, sort_keys=True, default=str, ensure_ascii=False)
    return text if len(text) <= limit else f"{text[:limit - 3]}..."


def _rows(value: Any, prefix: str = "") -> Iterable[tuple[str, Any]]:
    if isinstance(value, dict):
        for key in sorted(value):
            path = f"{prefix}.{key}" if prefix else str(key)
            yield from _rows(value[key], path)
    elif isinstance(value, list):
        if not value:
            yield prefix, ""
        elif all(not isinstance(item, (dict, list)) for item in value):
            yield prefix, ", ".join(_display(item, limit=200) for item in value)
        else:
            for index, item in enumerate(value):
                yield from _rows(item, f"{prefix}[{index}]")
    else:
        yield prefix, value


def _safe_sheet_name(module_id: str, used: set[str]) -> str:
    base = "".join(char if char not in "[]:*?/\\" else "-" for char in module_id).strip()[:31] or "Module"
    name = base
    suffix = 2
    while name in used:
        tail = f"-{suffix}"
        name = f"{base[:31 - len(tail)]}{tail}"
        suffix += 1
    used.add(name)
    return name


def render_report_xlsx(*, version_id: str, document_sha256: str, payload: dict, authority: dict) -> bytes:
    document = payload.get("document") if isinstance(payload.get("document"), dict) else {}
    modules = document.get("sections") if isinstance(document.get("sections"), list) else []
    wb = Workbook()
    cover = wb.active
    cover.title = "Cover"
    cover.sheet_view.showGridLines = False
    cover.freeze_panes = "A8"
    cover["A1"] = "CAOS - IMMUTABLE COMMITTEE REPORT"
    cover["A1"].font = Font(name="Arial", size=18, bold=True, color="FFFFFF")
    cover["A1"].fill = PatternFill("solid", fgColor=_NAVY)
    cover.merge_cells("A1:D2")
    cover["A1"].alignment = Alignment(vertical="center")
    metadata = [
        ("Report version", version_id),
        ("Document SHA-256", document_sha256),
        ("Issuer", document.get("issuer_id")),
        ("Run", document.get("run_id")),
        ("As of", document.get("as_of_date")),
        ("QA status", document.get("qa_status")),
        ("Committee status", document.get("committee_status")),
        ("Prepared by", document.get("prepared_by")),
        ("Authority origin", authority.get("origin")),
        ("Authority state", authority.get("approval_state")),
    ]
    for row_index, (label, value) in enumerate(metadata, start=4):
        cover.cell(row_index, 1, label).font = Font(name="Arial", bold=True, color=_MUTED)
        cover.cell(row_index, 2, _display(value))
    cover.column_dimensions["A"].width = 24
    cover.column_dimensions["B"].width = 72
    cover.column_dimensions["C"].width = 18
    cover.column_dimensions["D"].width = 18
    cover.sheet_properties.pageSetUpPr.fitToPage = True
    cover.page_setup.fitToWidth = 1
    cover.page_setup.fitToHeight = 0

    summary = wb.create_sheet("Module Summary")
    summary.sheet_view.showGridLines = False
    summary.freeze_panes = "A2"
    summary.append(["Module", "Name", "Confidence", "QA status"])
    for module in modules:
        if not isinstance(module, dict):
            continue
        summary.append([
            _display(module.get("module_id")),
            _display(module.get("module_name")),
            module.get("confidence") if isinstance(module.get("confidence"), (int, float)) else _display(module.get("confidence")),
            _display(module.get("qa_status")),
        ])
    for cell in summary[1]:
        cell.font = Font(name="Arial", bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor=_NAVY)
    summary.column_dimensions["A"].width = 16
    summary.column_dimensions["B"].width = 42
    summary.column_dimensions["C"].width = 16
    summary.column_dimensions["D"].width = 18
    if summary.max_row > 1:
        table = Table(displayName="ModuleSummary", ref=f"A1:D{summary.max_row}")
        table.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True, showFirstColumn=False, showLastColumn=False)
        summary.add_table(table)

    used = {sheet.title for sheet in wb.worksheets}
    thin = Side(style="thin", color="D8DCE5")
    for module_index, module in enumerate(modules, start=1):
        if not isinstance(module, dict):
            continue
        module_id = _display(module.get("module_id")) or f"Module {module_index}"
        sheet = wb.create_sheet(_safe_sheet_name(module_id, used))
        sheet.sheet_view.showGridLines = False
        sheet.freeze_panes = "A5"
        sheet["A1"] = f"{module_id} - {_display(module.get('module_name'))}"
        sheet["A1"].font = Font(name="Arial", size=15, bold=True, color="FFFFFF")
        sheet["A1"].fill = PatternFill("solid", fgColor=_NAVY)
        sheet["A1"].alignment = Alignment(vertical="center", indent=1)
        sheet.merge_cells("A1:B2")
        sheet["A3"] = "Path"
        sheet["B3"] = "Frozen value"
        for cell in sheet[3]:
            cell.font = Font(name="Arial", bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor=_BLUE)
        data_rows = list(_rows(module.get("summary") or {})) or [("summary", "")]
        for path, value in data_rows:
            scalar = value if isinstance(value, (int, float, bool)) else _display(value)
            sheet.append([path, scalar])
        for row in sheet.iter_rows(min_row=4, max_row=sheet.max_row, min_col=1, max_col=2):
            for cell in row:
                cell.border = Border(bottom=thin)
                cell.alignment = Alignment(vertical="top", wrap_text=True)
                cell.font = Font(name="Arial", size=9, color=_INK)
        sheet.column_dimensions["A"].width = 46
        sheet.column_dimensions["B"].width = 90
        sheet.sheet_properties.pageSetUpPr.fitToPage = True
        sheet.page_setup.fitToWidth = 1
        sheet.page_setup.fitToHeight = 0

    sources = wb.create_sheet("Sources - Audit")
    sources.sheet_view.showGridLines = False
    sources.freeze_panes = "A2"
    sources.append(["Source ID", "Authority origin", "As of", "Approval state"])
    source_ids = authority.get("source_ids") if isinstance(authority.get("source_ids"), list) else []
    for source_id in source_ids:
        sources.append([_display(source_id), _display(authority.get("origin")), _display(authority.get("as_of")), _display(authority.get("approval_state"))])
    for cell in sources[1]:
        cell.font = Font(name="Arial", bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor=_NAVY)
    for column, width in zip("ABCD", [54, 18, 28, 18]):
        sources.column_dimensions[column].width = width

    wb.properties.title = "CAOS Immutable Committee Report"
    wb.properties.subject = document_sha256
    wb.properties.creator = "CAOS Report Studio"
    wb.properties.description = f"Immutable report version {version_id}"
    output = BytesIO()
    wb.save(output)
    # Production-side structural sanity check: fail before returning malformed bytes.
    reopened = load_workbook(BytesIO(output.getvalue()), read_only=True, data_only=False)
    if "Cover" not in reopened.sheetnames or "Module Summary" not in reopened.sheetnames:
        raise ValueError("Generated workbook failed structural verification.")
    reopened.close()
    return output.getvalue()


def render_report_pdf(*, version_id: str, document_sha256: str, payload: dict, authority: dict) -> bytes:
    document = payload.get("document") if isinstance(payload.get("document"), dict) else {}
    modules = document.get("sections") if isinstance(document.get("sections"), list) else []
    output = BytesIO()
    styles = getSampleStyleSheet()
    title = ParagraphStyle("CAOSTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=19, leading=23, textColor=colors.HexColor(f"#{_NAVY}"), alignment=TA_CENTER, spaceAfter=14)
    heading = ParagraphStyle("CAOSHeading", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=colors.HexColor(f"#{_NAVY}"), spaceBefore=8, spaceAfter=6)
    body = ParagraphStyle("CAOSBody", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.5, leading=11, textColor=colors.HexColor(f"#{_INK}"))
    meta = ParagraphStyle("CAOSMeta", parent=body, fontName="Courier", fontSize=7.5, leading=10, textColor=colors.HexColor(f"#{_MUTED}"))

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#D8DCE5"))
        canvas.line(0.65 * inch, 0.52 * inch, 7.85 * inch, 0.52 * inch)
        canvas.setFont("Courier", 7)
        canvas.setFillColor(colors.HexColor(f"#{_MUTED}"))
        canvas.drawString(0.65 * inch, 0.35 * inch, f"CAOS | VERSION {version_id} | SHA {document_sha256[:16]}")
        canvas.drawRightString(7.85 * inch, 0.35 * inch, f"PAGE {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(output, pagesize=letter, rightMargin=0.65 * inch, leftMargin=0.65 * inch, topMargin=0.65 * inch, bottomMargin=0.7 * inch, title="CAOS Immutable Committee Report", author="CAOS Report Studio")
    story = [Paragraph("CAOS IMMUTABLE COMMITTEE REPORT", title)]
    metadata = [
        ["Report version", version_id], ["Document SHA-256", document_sha256],
        ["Issuer", _display(document.get("issuer_id"))], ["Run", _display(document.get("run_id"))],
        ["As of", _display(document.get("as_of_date"))], ["QA status", _display(document.get("qa_status"))],
        ["Committee status", _display(document.get("committee_status"))], ["Prepared by", _display(document.get("prepared_by"))],
        ["Authority", f"{_display(authority.get('origin'))} | {_display(authority.get('approval_state'))} | {_display(authority.get('as_of'))}"],
    ]
    meta_table = PdfTable([[Paragraph(f"<b>{html.escape(label)}</b>", body), Paragraph(html.escape(value), meta)] for label, value in metadata], colWidths=[1.45 * inch, 5.45 * inch])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor(f"#{_CREAM}")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D8DCE5")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E7E9EE")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.extend([meta_table, Spacer(1, 0.18 * inch), Paragraph("FROZEN MODULE REGISTER", heading)])
    register_rows = [["Module", "Name", "Confidence", "QA"]]
    for module in modules:
        if isinstance(module, dict):
            register_rows.append([_display(module.get("module_id")), _display(module.get("module_name")), _display(module.get("confidence")), _display(module.get("qa_status"))])
    register = PdfTable(register_rows, colWidths=[0.95 * inch, 3.8 * inch, 0.85 * inch, 1.3 * inch], repeatRows=1)
    register.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(f"#{_NAVY}")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5), ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D8DCE5")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F8FA")]),
    ]))
    story.extend([register, PageBreak()])
    for index, module in enumerate(modules):
        if not isinstance(module, dict):
            continue
        story.append(Paragraph(f"{html.escape(_display(module.get('module_id')))} - {html.escape(_display(module.get('module_name')))}", heading))
        detail_rows = [[Paragraph("Path", body), Paragraph("Frozen value", body)]]
        for path, value in list(_rows(module.get("summary") or {}))[:250]:
            detail_rows.append([Paragraph(html.escape(path), meta), Paragraph(html.escape(_display(value, limit=900)), body)])
        detail = PdfTable(detail_rows, colWidths=[2.15 * inch, 4.75 * inch], repeatRows=1)
        detail.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(f"#{_BLUE}")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D8DCE5")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F8FA")]),
            ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(detail)
        if index < len(modules) - 1:
            story.append(PageBreak())
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
