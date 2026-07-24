"""OKF ↔ Obsidian mapping: ``StructuredReport`` → ``OKFNote`` → a file under
``{vault_export_dir}/Sources/``.

``source-document`` is a **fourth** note family alongside ``credit-run`` (spoke),
``issuer`` (hub), and ``analyst-memo``. It reuses their issuer-identity vocabulary
verbatim (``issuer``/``ticker``/``industry``/``country``) so a Dataview or graph
query spanning families keys on the same names, and adds only what an inbound
source document needs (``document_id``, ``doc_type``, ``report_date``,
``extraction_status``, ``contains_source_text``, ratings).

Two constraints that are easy to break:

  - **Never route this family through ``_output_md``/``_redact``.** The frontmatter
    key ``contains_source_text`` contains the substring ``source_text``, which is a
    ``vault_export._RAW_CONTENT_MARKERS`` entry — the redaction pass would blank
    the very flag that marks the note as carrying source text. Rendering goes
    through ``_yaml_block`` directly, which is why this holds.
  - **Required keys must never be empty.** ``_yaml_block`` drops any key whose
    value is ``None`` or ``""``, so an empty ``extraction_status`` would silently
    vanish and a reader could mistake a degraded note for a complete one.

Redaction posture: the three *outbound* families keep ``_redact`` untouched —
engine output must not leak raw source text off-machine. This *inbound* family
carries extracted source text **by design** (it is the document), and every note
declares ``contains_source_text: true`` so sync tooling and local-embed plugins can
select or exclude the ``Sources/`` subtree.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Optional

from okf_schema import OKF_VERSION, IssuerRef, OKFNote, StructuredReport
from vault_export import _title, _yaml_block, autolink_issuers

SOURCES_DIRNAME = "Sources"


def okf_note_title(report: StructuredReport, issuer: IssuerRef) -> str:
    """The note filename stem — and the **supersede identity slug**.

    The ``report_date or fiscal_period or 'undated'`` fallback is identical to the
    Stage-5 identity key, so the ``note_path`` lookup *is* the identity lookup and
    the two can never drift. Two documents for distinct periods therefore never
    collide on one path; a re-issue for the same period supersedes in place.
    """
    return _title(
        f"{issuer.name} - {report.doc_type.value} - {report.source or 'na'} - "
        f"{report.report_date or report.fiscal_period or 'undated'}"
    )


def _page_suffix(page_start: Optional[int], page_end: Optional[int]) -> str:
    """``" (p. 4)"`` / ``" (p. 3–5)"`` / ``""``. Body-only — these anchors must
    never reach ``OKFChunk.text`` (the grounding-pool rule)."""
    if page_start is None:
        return ""
    if page_end is None or page_end == page_start:
        return f" (p. {page_start})"
    return f" (p. {page_start}–{page_end})"


def _frontmatter(
    report: StructuredReport, issuer: IssuerRef, document_id: str, storage_key: str
) -> dict:
    """Appendix-A field order. Required keys are always non-empty; optional keys
    are simply omitted by ``_yaml_block`` when absent."""
    return {
        # Required — never empty.
        "type": "source-document",
        "okf_version": OKF_VERSION,
        "issuer": issuer.name,
        "document_id": document_id,
        "doc_type": report.doc_type.value,
        "extraction_status": report.extraction_status,
        # Which extractor produced this note — a vision read must stay visibly
        # distinguishable from a deterministic one for any programmatic reader.
        "extractor": report.extractor,
        "contains_source_text": True,  # real bool → unquoted YAML `true`
        # Optional — dropped when None/"".
        "ticker": issuer.ticker,
        "industry": issuer.industry,
        "country": issuer.country,
        "source": report.source,
        "report_date": report.report_date,
        "fiscal_period": report.fiscal_period,
        "rating_moody": report.rating_moody,
        "rating_sp": report.rating_sp,
        "storage_key": storage_key,
        "page_count": report.page_count,
    }


def _link_line(report: StructuredReport, issuer: IssuerRef) -> str:
    """``Issuer: [[X]] · Industry: [[Y]] · …`` — targets are ``_title()``-sanitized
    so an issuer/sector/country with an illegal character still resolves to the
    same hub node the other families link to."""
    parts = [f"Issuer: [[{_title(issuer.name)}]]"]
    if issuer.industry:
        parts.append(f"Industry: [[{_title(issuer.industry)}]]")
    if issuer.country:
        parts.append(f"Country: [[{_title(issuer.country)}]]")
    if report.source:
        parts.append(f"Source: [[{_title(report.source)}]]")
    return " · ".join(parts)


def _body(
    report: StructuredReport, issuer: IssuerRef, document_id: str
) -> tuple[str, list[str]]:
    lines = [f"# {report.title}", "", _link_line(report, issuer), ""]

    if report.key_facts:
        lines.append("## Key facts")
        for fact in report.key_facts:
            agency = f" ({fact.unit})" if fact.unit and fact.kind == "rating" else ""
            # Basis and confidence are shown inline because a marketed
            # ("sponsor-adjusted") figure and a reported one are different claims
            # about the same company — an analyst must never have to guess which
            # they are reading.
            qualifiers = [q for q in (fact.basis, fact.confidence) if q]
            suffix = f" — {' · '.join(qualifiers)}" if qualifiers else ""
            lines.append(
                f"- **{fact.label}:** {fact.value}{agency}"
                f"{_page_suffix(fact.page, None)}{suffix}"
            )
        lines.append("")

    for section in report.sections:
        if not section.text.strip():
            continue
        lines.append(f"## {section.title}{_page_suffix(section.page_start, section.page_end)}")
        lines.append(section.text)
        lines.append("")

    lines.extend([
        "## Extraction notes",
        f"- status: {report.extraction_status}",
        f"- method: {report.method}",
        f"- extractor: {report.extractor}",
        f"- pages: {report.page_count}",
        f"- document_id: {document_id}",
    ])
    for warning in report.warnings:
        lines.append(f"- warning: {warning}")

    body = "\n".join(lines)
    # Wrap the first plain mention of the issuer inside the prose too, so the note
    # links itself into the issuer graph the way an uploaded memo does. Only the
    # first mention is touched; text already inside a [[link]] is left alone.
    body, linked = autolink_issuers(body, [(issuer.name, issuer.ticker)])
    return body, linked


def render_okf_note(
    report: StructuredReport,
    issuer: IssuerRef,
    document_id: str,
    storage_key: str,
) -> OKFNote:
    """Pure mapping — no I/O.

    Called *inside* the Stage-5 transaction (after ``db.flush()``), because
    ``document_id`` is a canonical ``Document.id`` that does not exist until the
    insert mints it.
    """
    note_title = okf_note_title(report, issuer)
    body, _ = _body(report, issuer, document_id)

    # Raw names — this is the graph-edge list, not a set of link targets.
    wikilinks = [issuer.name]
    for extra in (issuer.industry, issuer.country, report.source):
        if extra and extra not in wikilinks:
            wikilinks.append(extra)

    return OKFNote(
        note_title=note_title,
        note_rel_path=f"{SOURCES_DIRNAME}/{note_title}.md",
        frontmatter=_frontmatter(report, issuer, document_id, storage_key),
        body=body,
        wikilinks=wikilinks,
        contains_source_text=True,
    )


def render_note_file(note: OKFNote) -> str:
    """The complete file text: frontmatter block + body."""
    return f"{_yaml_block(note.frontmatter)}\n{note.body}\n"


def _write_note_file(vault_dir: str, note: OKFNote) -> str:
    root = Path(vault_dir).resolve()
    path = (root / note.note_rel_path).resolve()
    # `_title` already strips path separators, so this is defence in depth rather
    # than the primary guard — an OKF note may only ever land under Sources/.
    if not path.is_relative_to(root / SOURCES_DIRNAME):
        raise ValueError("OKF note path escaped the Sources/ tree.")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_note_file(note), encoding="utf-8")
    return str(path)


async def write_okf_note(vault_dir: str, note: OKFNote) -> str:
    """Write the note to disk off-thread. Scheduled post-commit, so a slow or
    failing disk never blocks or corrupts the database write."""
    return await asyncio.to_thread(_write_note_file, vault_dir, note)
