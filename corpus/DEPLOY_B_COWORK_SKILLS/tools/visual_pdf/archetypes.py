"""Reusable deterministic story layouts for configured visual profiles."""

from __future__ import annotations

from collections.abc import Sequence

from reportlab.lib.colors import Color
from reportlab.lib.units import mm

from .registry import TableSpec, VisualArchetype, VisualProfile
from .renderer import (
    AMBER,
    AMBER_BG,
    BLUE,
    BLUE_BG,
    BORDER,
    CONTENT_W,
    GREEN,
    GREEN_BG,
    INK,
    MARGIN,
    MUTED,
    PANEL,
    RED,
    RED_BG,
    SOFT,
    TEAL,
    TEAL_BG,
    WHITE,
    VisualReport,
    clean_markup,
    draw_bar_comparison,
    para,
    parse_number,
    rounded,
    rule,
)


def exact_table(visual: VisualReport, spec: TableSpec) -> list[list[str]]:
    for record in visual.report.table_records:
        if record.table_id.casefold() == spec.stable_id.casefold():
            return record.rows
    raise KeyError(
        f"{visual.report.module_id}: required stable table-id not found: "
        f"{spec.stable_id}"
    )


def compact_row(headers: Sequence[str], row: Sequence[str], *, cells: int = 4) -> str:
    pairs = [
        f"{clean_markup(headers[index])}: {clean_markup(value)}"
        for index, value in enumerate(row[:cells])
        if index < len(headers) and clean_markup(value)
    ]
    return " | ".join(pairs)


def display_rows(rows: Sequence[Sequence[str]], *, limit: int = 2) -> str:
    if not rows:
        return "No canonical rows."
    headers = rows[0]
    body = [compact_row(headers, row) for row in rows[1 : limit + 1]]
    shown = "\n".join(row for row in body if row)
    count = max(0, len(rows) - 1)
    suffix = f" Showing {min(count, limit)} of {count} rows; complete table in appendix."
    return (shown or "Header-only canonical table.") + suffix


def metric_entries(
    tables: Sequence[tuple[TableSpec, Sequence[Sequence[str]]]],
    *,
    limit: int = 6,
) -> list[tuple[str, float, str, Color]]:
    entries: list[tuple[str, float, str, Color]] = []
    tones = (BLUE, TEAL, AMBER, GREEN, RED)
    for spec, rows in tables:
        if not rows:
            continue
        for row in rows[1:]:
            label = clean_markup(row[0]) if row else spec.heading
            for value in row[1:]:
                number = parse_number(value)
                if number is None:
                    continue
                entries.append(
                    (
                        label,
                        number,
                        clean_markup(value),
                        RED if number < 0 else tones[len(entries) % len(tones)],
                    )
                )
                break
            if len(entries) >= limit:
                return entries
    return entries


def overview_cards(
    visual: VisualReport,
    tables: Sequence[tuple[TableSpec, Sequence[Sequence[str]]]],
    top: float,
) -> float:
    gap = 4 * mm
    width = (CONTENT_W - 2 * gap) / 3
    for index, (spec, rows) in enumerate(tables[:3]):
        body = rows[1] if len(rows) > 1 else rows[0]
        value = clean_markup(body[1] if len(body) > 1 else body[0])
        note = clean_markup(body[0]) if body else "Header only"
        visual.kpi_card(
            MARGIN + index * (width + gap),
            top,
            width,
            spec.heading,
            value,
            note,
        )
    return top - 36 * mm


def table_panel(
    visual: VisualReport,
    spec: TableSpec,
    rows: Sequence[Sequence[str]],
    *,
    x: float,
    top: float,
    width: float,
    height: float,
    fill: Color = WHITE,
    accent: Color | None = None,
) -> None:
    visual.text_card(
        x,
        top,
        width,
        height,
        spec.heading,
        display_rows(rows),
        fill=fill,
        accent=accent,
        body_size=7.2,
    )


def render_control(
    visual: VisualReport,
    tables: Sequence[tuple[TableSpec, Sequence[Sequence[str]]]],
    top: float,
) -> None:
    fills = (TEAL_BG, BLUE_BG, AMBER_BG)
    tones = (TEAL, BLUE, AMBER)
    gap = 4 * mm
    height = 39 * mm
    for index, (spec, rows) in enumerate(tables[:3]):
        table_panel(
            visual,
            spec,
            rows,
            x=MARGIN,
            top=top - index * (height + gap),
            width=CONTENT_W,
            height=height,
            fill=fills[index],
            accent=tones[index],
        )


def render_financial(
    visual: VisualReport,
    tables: Sequence[tuple[TableSpec, Sequence[Sequence[str]]]],
    top: float,
) -> None:
    entries = metric_entries(tables)
    if entries:
        draw_bar_comparison(
            visual,
            entries,
            x=MARGIN,
            top=top,
            width=CONTENT_W,
            height=76 * mm,
            title="Canonical numeric profile",
        )
        panel_top = top - 82 * mm
    else:
        panel_top = top
    gap = 4 * mm
    width = (CONTENT_W - gap) / 2
    for index, (spec, rows) in enumerate(tables[-2:]):
        table_panel(
            visual,
            spec,
            rows,
            x=MARGIN + index * (width + gap),
            top=panel_top,
            width=width,
            height=50 * mm,
            fill=BLUE_BG if index == 0 else TEAL_BG,
            accent=BLUE if index == 0 else TEAL,
        )


def render_fundamental(
    visual: VisualReport,
    tables: Sequence[tuple[TableSpec, Sequence[Sequence[str]]]],
    top: float,
) -> None:
    canvas = visual.canvas
    rounded(canvas, MARGIN, top - 83 * mm, CONTENT_W * 0.61, 83 * mm, fill=WHITE)
    canvas.setFillColor(visual.accent)
    canvas.setFont("Helvetica-Bold", 7)
    canvas.drawString(MARGIN + 6 * mm, top - 7 * mm, "CANONICAL SEQUENCE / REGISTER ORDER")
    axis_x = MARGIN + 12 * mm
    axis_top = top - 16 * mm
    axis_bottom = top - 72 * mm
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(1.2)
    canvas.line(axis_x, axis_top, axis_x, axis_bottom)

    sequence: list[tuple[str, str]] = []
    for spec, rows in tables[:2]:
        headers = rows[0] if rows else ()
        for row in rows[1:4]:
            sequence.append((spec.heading, compact_row(headers, row, cells=3)))
    for index, (heading, body) in enumerate(sequence[:6]):
        y = axis_top - index * 10.5 * mm
        canvas.setFillColor(visual.accent)
        canvas.circle(axis_x, y, 2.1 * mm, fill=1, stroke=0)
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica-Bold", 6.4)
        canvas.drawString(axis_x + 6 * mm, y + 2.2 * mm, clean_markup(heading).upper())
        para(
            canvas,
            body,
            axis_x + 6 * mm,
            y,
            CONTENT_W * 0.49,
            8 * mm,
            size=6.8,
            leading=8,
            color=INK,
            label=f"sequence-{index}",
        )

    side_x = MARGIN + CONTENT_W * 0.65
    side_width = CONTENT_W * 0.35
    if len(tables) >= 3:
        table_panel(
            visual,
            tables[2][0],
            tables[2][1],
            x=side_x,
            top=top,
            width=side_width,
            height=83 * mm,
            fill=AMBER_BG,
            accent=AMBER,
        )
    if tables:
        table_panel(
            visual,
            tables[0][0],
            tables[0][1],
            x=MARGIN,
            top=top - 89 * mm,
            width=CONTENT_W,
            height=43 * mm,
            fill=BLUE_BG,
            accent=BLUE,
        )


def render_security(
    visual: VisualReport,
    tables: Sequence[tuple[TableSpec, Sequence[Sequence[str]]]],
    top: float,
) -> None:
    primary_spec, primary_rows = tables[0]
    canvas = visual.canvas
    height = 68 * mm
    rounded(canvas, MARGIN, top - height, CONTENT_W, height, fill=WHITE)
    canvas.setFillColor(visual.accent)
    canvas.setFont("Helvetica-Bold", 7)
    canvas.drawString(
        MARGIN + 6 * mm,
        top - 7 * mm,
        f"{clean_markup(primary_spec.heading).upper()} / CANONICAL ROW ORDER",
    )
    headers = primary_rows[0] if primary_rows else ()
    body_rows = primary_rows[1:5]
    row_height = 12 * mm
    for index, row in enumerate(body_rows):
        y = top - 15 * mm - index * row_height
        tone = (visual.accent, BLUE, TEAL, AMBER)[index % 4]
        canvas.setFillColor(SOFT)
        canvas.roundRect(
            MARGIN + 7 * mm,
            y - 7 * mm,
            CONTENT_W - 14 * mm,
            8.5 * mm,
            3 * mm,
            fill=1,
            stroke=0,
        )
        canvas.setFillColor(tone)
        canvas.roundRect(
            MARGIN + 7 * mm,
            y - 7 * mm,
            3.5 * mm,
            8.5 * mm,
            2 * mm,
            fill=1,
            stroke=0,
        )
        para(
            canvas,
            compact_row(headers, row),
            MARGIN + 14 * mm,
            y,
            CONTENT_W - 24 * mm,
            7 * mm,
            size=6.8,
            leading=8,
            label=f"security-row-{index}",
        )

    gap = 4 * mm
    width = (CONTENT_W - gap) / 2
    for index, (spec, rows) in enumerate(tables[1:3]):
        table_panel(
            visual,
            spec,
            rows,
            x=MARGIN + index * (width + gap),
            top=top - height - 6 * mm,
            width=width,
            height=55 * mm,
            fill=RED_BG if index == 0 else AMBER_BG,
            accent=RED if index == 0 else AMBER,
        )


def render_decision(
    visual: VisualReport,
    tables: Sequence[tuple[TableSpec, Sequence[Sequence[str]]]],
    top: float,
) -> None:
    gap = 5 * mm
    width = (CONTENT_W - gap) / 2
    fills = (GREEN_BG, RED_BG)
    tones = (GREEN, RED)
    for index, (spec, rows) in enumerate(tables[:2]):
        table_panel(
            visual,
            spec,
            rows,
            x=MARGIN + index * (width + gap),
            top=top,
            width=width,
            height=66 * mm,
            fill=fills[index],
            accent=tones[index],
        )
    if len(tables) >= 3:
        entries = metric_entries(tables[2:], limit=5)
        if entries:
            draw_bar_comparison(
                visual,
                entries,
                x=MARGIN,
                top=top - 73 * mm,
                width=CONTENT_W,
                height=58 * mm,
                title=tables[2][0].heading,
            )
        else:
            table_panel(
                visual,
                tables[2][0],
                tables[2][1],
                x=MARGIN,
                top=top - 73 * mm,
                width=CONTENT_W,
                height=58 * mm,
                fill=BLUE_BG,
                accent=BLUE,
            )


def render_configured_profile(visual: VisualReport, profile: VisualProfile) -> None:
    tables = [(spec, exact_table(visual, spec)) for spec in profile.tables if spec.required]
    visual.cover(visual.report.summary)
    visual.new_page(profile.kicker, bookmark=f"{profile.module_id.lower()}-story")
    cursor = visual.section_title(
        f"{profile.module_id} / {profile.kicker}",
        profile.story_title,
        profile.story_subtitle,
    )
    story_top = overview_cards(visual, tables, cursor - 3 * mm)

    renderers = {
        VisualArchetype.CONTROL: render_control,
        VisualArchetype.FINANCIAL: render_financial,
        VisualArchetype.FUNDAMENTAL: render_fundamental,
        VisualArchetype.SECURITY: render_security,
        VisualArchetype.DECISION: render_decision,
    }
    try:
        renderer = renderers[profile.archetype]
    except KeyError as error:
        raise ValueError(
            f"{profile.module_id}: no visual renderer for {profile.archetype.value}"
        ) from error
    renderer(visual, tables, story_top)
