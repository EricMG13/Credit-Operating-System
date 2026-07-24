"""Deterministic structuring: ``ExtractedDocument`` → ``StructuredReport``.

Pure functions — no DB, no PDF library, no LLM. Classification routes which
key-fact extractors run; segmentation cuts the canonical text into source-derived
sections; extraction pulls typed facts.

Three rules the rest of the pipeline depends on:

  - **Values are verbatim.** A extracted "4.25x" is stored as "4.25x" and never
    rounded to "4.3x" — the downstream grounding gate compares formatting-
    tolerantly, so normalizing here would desync it.
  - **Page anchors are advisory, never fabricated.** Sections are segmented on the
    canonical ``full_text`` (which may have come from markitdown or OCR) and then
    located inside the pypdf ``pages`` map by substring. No match → ``None``, not
    a guess.
  - **Nothing raises.** An unclassifiable document is ``source-document``; an
    extractor that finds nothing contributes an empty list; an empty extraction
    still yields a well-formed report so the note is always renderable.

A future LLM enrichment lane (re-segmenting or typing low-confidence documents)
belongs behind one of the house fault-isolation patterns with *this* deterministic
``structure()`` as its fallback. ``_llm_structure_extension_point`` marks where.
"""

from __future__ import annotations

import re
from typing import Optional

from okf_schema import (
    _DOCTYPE_LABEL,
    DocSection,
    DocType,
    ExtractedDocument,
    IssuerRef,
    KeyFact,
    StructuredReport,
    StructuringOverrides,
)

# How much of the document's head classification and date/period detection read.
# Deliberately small: the markers that identify a document type live on its cover.
_HEAD_CHARS = 6_000

# Bounds so a pathological document can't explode the note or the chunk count.
_MAX_SECTIONS = 300
_MAX_FACTS = 60
_ANCHOR_PROBE_CHARS = 60

# ── Classification ───────────────────────────────────────────────────────────
# Ordered most-document-defining first. A cover-page title ("OFFERING
# MEMORANDUM") identifies the document; an agency name does not — an offering memo
# quotes Moody's and S&P throughout, so testing the bare agency masthead first
# would misfile it as a rating report. Rating markers therefore run last and lead
# with the phrases that only appear on a rating action.
_CLASSIFIERS: tuple[tuple[DocType, tuple[str, ...]], ...] = (
    (DocType.OFFERING_MEMO, (
        "offering memorandum", "offering circular", "confidential information memorandum",
        "preliminary offering memorandum",
    )),
    (DocType.SPONSOR_DECK, (
        "lender presentation", "management presentation", "sponsor presentation",
        "investor presentation",
    )),
    (DocType.LENDER_UPDATE, (
        "quarterly lender update", "lender update", "lender call",
        "compliance certificate",
    )),
    (DocType.RATING_REPORT, (
        "corporate family rating", "issuer credit rating", "rating action",
        "credit opinion", "long-term issuer default rating",
        "moody's investors service", "s&p global ratings", "fitch ratings",
    )),
)

# Agency detection for `source`. Only these are deterministic enough to assert;
# a sponsor/bank name is left to the analyst override rather than guessed.
_AGENCIES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Moody's", ("moody's", "moodys", "moody’s")),
    ("S&P Global Ratings", ("s&p global ratings", "standard & poor's", "s&p")),
    ("Fitch Ratings", ("fitch ratings", "fitch")),
)

# ── Heading shapes for segmentation ──────────────────────────────────────────
_MD_HEADING = re.compile(r"^(#{1,3})\s+(.+?)\s*$")
_NUM_HEADING = re.compile(r"^(\d+(?:\.\d+)*)[.)]?\s+(\S.*?)\s*$")


def _is_caps_heading(line: str) -> bool:
    """An ALL-CAPS line that reads like a heading, not a shouted sentence or a
    row of figures."""
    stripped = line.strip()
    if not (3 <= len(stripped) <= 90):
        return False
    letters = [c for c in stripped if c.isalpha()]
    if len(letters) < 3:
        return False
    if not all(c.isupper() for c in letters):
        return False
    # A heading is a label, not prose: reject terminal punctuation.
    return not stripped.endswith((".", ";", ":"))


def _heading_of(line: str) -> Optional[tuple[str, int]]:
    """Return ``(title, level)`` when the line is heading-shaped, else ``None``."""
    md = _MD_HEADING.match(line)
    if md:
        return md.group(2).strip(), len(md.group(1))
    num = _NUM_HEADING.match(line)
    if num and any(c.isalpha() for c in num.group(2)):
        return f"{num.group(1)} {num.group(2)}".strip(), min(3, num.group(1).count(".") + 1)
    if _is_caps_heading(line):
        return line.strip(), 1
    return None


def _normalize(text: str) -> str:
    """Whitespace-normalized, lowercased text for substring page matching. The
    canonical text and the page map come from different extractors, so anchoring
    must tolerate reflowed whitespace."""
    return re.sub(r"\s+", " ", text).strip().lower()


def classify(full_text: str, override: Optional[DocType] = None) -> DocType:
    """Deterministic doc-type routing off the document head. Never raises; an
    unmatched document is ``SOURCE_DOCUMENT``. An analyst override always wins."""
    if override is not None:
        return override
    head = _normalize(full_text[:_HEAD_CHARS])
    for doc_type, markers in _CLASSIFIERS:
        if any(marker in head for marker in markers):
            return doc_type
    return DocType.SOURCE_DOCUMENT


def detect_source(full_text: str) -> Optional[str]:
    """The issuing agency, when the head names one unambiguously."""
    head = _normalize(full_text[:_HEAD_CHARS])
    for label, markers in _AGENCIES:
        if any(marker in head for marker in markers):
            return label
    return None


# ── Date / period detection ──────────────────────────────────────────────────
_MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11,
    "december": 12,
}
_ISO_DATE = re.compile(r"\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b")
_LONG_DATE = re.compile(
    r"\b(" + "|".join(_MONTHS) + r")\s+(\d{1,2}),?\s+(20\d{2})\b", re.IGNORECASE
)
_DMY_DATE = re.compile(
    r"\b(\d{1,2})\s+(" + "|".join(_MONTHS) + r")\s+(20\d{2})\b", re.IGNORECASE
)
_FY_PERIOD = re.compile(r"\bFY\s?(20\d{2})\b", re.IGNORECASE)
_Q_PERIOD = re.compile(r"\bQ([1-4])\s*[-/ ]?\s*(20\d{2})\b", re.IGNORECASE)


def detect_report_date(full_text: str) -> Optional[str]:
    """First parseable cover date, normalized to ISO. Returns ``None`` rather than
    guessing — a fabricated date would poison the supersede identity key."""
    head = full_text[:_HEAD_CHARS]
    iso = _ISO_DATE.search(head)
    if iso:
        return iso.group(0)
    long_match = _LONG_DATE.search(head)
    if long_match:
        month = _MONTHS[long_match.group(1).lower()]
        return f"{long_match.group(3)}-{month:02d}-{int(long_match.group(2)):02d}"
    dmy = _DMY_DATE.search(head)
    if dmy:
        month = _MONTHS[dmy.group(2).lower()]
        return f"{dmy.group(3)}-{month:02d}-{int(dmy.group(1)):02d}"
    return None


def detect_fiscal_period(full_text: str) -> Optional[str]:
    """``FY2025`` / ``Q3-2025`` when stated. Quarter wins — it is the more specific
    claim when a document states both."""
    head = full_text[:_HEAD_CHARS]
    quarter = _Q_PERIOD.search(head)
    if quarter:
        return f"Q{quarter.group(1)}-{quarter.group(2)}"
    fiscal = _FY_PERIOD.search(head)
    if fiscal:
        return f"FY{fiscal.group(1)}"
    return None


# ── Segmentation ─────────────────────────────────────────────────────────────


def segment(doc: ExtractedDocument) -> list[DocSection]:
    """Cut ``full_text`` into source-derived sections, then anchor each to a page
    span best-effort. Headings are never synthesized: a document with none becomes
    a single ``Document`` section holding the whole text."""
    text = doc.full_text
    if not text.strip():
        return [DocSection(title="Document", level=1, text="")]

    collected: list[tuple[str, int, list[str]]] = []
    body: list[str] = []
    for line in text.splitlines():
        heading = _heading_of(line) if len(collected) < _MAX_SECTIONS else None
        if heading is None:
            body.append(line)
            continue
        if collected:
            collected[-1][2].extend(body)
        elif any(part.strip() for part in body):
            # Preamble before the first heading is real source text — keep it
            # rather than dropping the cover page on the floor.
            collected.append(("Document", 1, list(body)))
        body = []
        collected.append((heading[0], heading[1], []))
    if collected:
        collected[-1][2].extend(body)
    else:
        collected.append(("Document", 1, body))

    sections = [
        DocSection(title=title, level=level, text="\n".join(lines).strip())
        for title, level, lines in collected
    ]
    return _anchor_sections(sections, doc)


def _anchor_sections(
    sections: list[DocSection], doc: ExtractedDocument
) -> list[DocSection]:
    """Best-effort page spans by locating each section's opening and closing text
    inside the page map. No page map, or no match, leaves the anchor ``None``."""
    if not doc.has_page_map:
        return sections
    normalized_pages = [(page.page, _normalize(page.text)) for page in doc.pages]
    for section in sections:
        probe = _normalize(section.text)
        if not probe:
            continue
        section.page_start = _find_page(normalized_pages, probe[:_ANCHOR_PROBE_CHARS])
        if section.page_start is None:
            continue
        tail = _find_page(normalized_pages, probe[-_ANCHOR_PROBE_CHARS:])
        section.page_end = tail if tail is not None and tail >= section.page_start else section.page_start
    return sections


def _find_page(normalized_pages: list[tuple[int, str]], probe: str) -> Optional[int]:
    if len(probe) < 12:  # too short to be a confident anchor
        return None
    for page_no, page_text in normalized_pages:
        if probe in page_text:
            return page_no
    return None


# ── Key-fact extraction ──────────────────────────────────────────────────────
_RATING_TOKEN = (
    r"(?:Aaa|Aa[123]|A[123]|Baa[123]|Ba[123]|B[123]|Caa[123]|Ca|"
    r"AAA|AA[+-]?|A[+-]?|BBB[+-]?|BB[+-]?|B[+-]?|CCC[+-]?|CC|D)"
)
_RATING_LABELS = (
    "Corporate Family Rating", "Issuer Credit Rating", "Senior Secured Rating",
    "Probability of Default Rating", "Long-Term Issuer Default Rating",
)
_LEVERAGE_RE = re.compile(
    r"((?:net|total|gross|senior\s+secured)?\s*leverage[^.\n]{0,60}?(\d+(?:\.\d+)?)\s*x)",
    re.IGNORECASE,
)
_TRANCHE_KEYWORDS = (
    "term loan", "revolving credit facility", "revolver", "rcf", "senior notes",
    "senior secured notes", "unsecured notes", "second lien", "first lien",
)
_MONEY_RE = re.compile(
    r"([$€£]\s?\d[\d,]*(?:\.\d+)?\s*(?:mm|m|bn|k|million|billion)?)", re.IGNORECASE
)
_MATURITY_RE = re.compile(
    r"((?:matur\w+|due)\s+(?:in\s+)?(?:20\d{2}))", re.IGNORECASE
)


def _page_of(line: str, doc: ExtractedDocument) -> Optional[int]:
    if not doc.has_page_map:
        return None
    probe = _normalize(line)[:_ANCHOR_PROBE_CHARS]
    return _find_page([(p.page, _normalize(p.text)) for p in doc.pages], probe)


def extract_key_facts(doc: ExtractedDocument, doc_type: DocType) -> list[KeyFact]:
    """Deterministic, best-effort typed facts. Which extractors run is routed by
    ``doc_type``; each is additive and contributes an empty list when it finds
    nothing. Values are stored exactly as they appear in the source."""
    facts: list[KeyFact] = []
    lines = [line.strip() for line in doc.full_text.splitlines() if line.strip()]

    for line in lines:
        if len(facts) >= _MAX_FACTS:
            break
        if doc_type is DocType.RATING_REPORT:
            facts.extend(_ratings_in(line, doc))
        if doc_type in (DocType.OFFERING_MEMO, DocType.SPONSOR_DECK, DocType.LENDER_UPDATE):
            facts.extend(_tranches_in(line, doc))
            facts.extend(_maturities_in(line, doc))
        # Leverage is the one metric worth pulling from every family.
        facts.extend(_leverage_in(line, doc))

    return facts[:_MAX_FACTS]


def _ratings_in(line: str, doc: ExtractedDocument) -> list[KeyFact]:
    out: list[KeyFact] = []
    for label in _RATING_LABELS:
        match = re.search(
            rf"{re.escape(label)}\s*(?:of|:|is|at|=)?\s*({_RATING_TOKEN})\b", line, re.IGNORECASE
        )
        if match:
            out.append(KeyFact(
                label=label, value=match.group(1), kind="rating",
                page=_page_of(line, doc), source_span=line[:300],
            ))
    return out


def _leverage_in(line: str, doc: ExtractedDocument) -> list[KeyFact]:
    match = _LEVERAGE_RE.search(line)
    if not match:
        return []
    span = match.group(1).strip()
    return [KeyFact(
        label="Leverage", value=f"{match.group(2)}x", unit="x", kind="leverage",
        page=_page_of(line, doc), source_span=span[:300],
    )]


def _tranches_in(line: str, doc: ExtractedDocument) -> list[KeyFact]:
    lowered = line.lower()
    keyword = next((k for k in _TRANCHE_KEYWORDS if k in lowered), None)
    if keyword is None:
        return []
    money = _MONEY_RE.search(line)
    if not money:
        return []
    return [KeyFact(
        label=keyword.title(), value=money.group(1).strip(), kind="tranche",
        page=_page_of(line, doc), source_span=line[:300],
    )]


def _maturities_in(line: str, doc: ExtractedDocument) -> list[KeyFact]:
    match = _MATURITY_RE.search(line)
    if not match:
        return []
    return [KeyFact(
        label="Maturity", value=match.group(1).strip(), kind="maturity",
        page=_page_of(line, doc), source_span=line[:300],
    )]


def _agency_ratings(facts: list[KeyFact], source: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """Map the extracted ratings onto the Moody's / S&P columns the note surfaces.
    Attribution follows the document's own agency (``source``) — a rating is only
    claimed for the agency that published the report, never guessed from its shape.
    """
    rating = next((f.value for f in facts if f.kind == "rating"), None)
    if rating is None or source is None:
        return None, None
    if source == "Moody's":
        return rating, None
    if source == "S&P Global Ratings":
        return None, rating
    return None, None


def _llm_structure_extension_point() -> None:
    """Reserved: the deferred LLM enrichment lane (Stage 2). It must sit behind a
    house fault-isolation pattern (Blocked-gate / ``return_exceptions`` /
    deterministic fallback) whose fallback is exactly ``structure()`` below."""


def structure(
    doc: ExtractedDocument, issuer: IssuerRef, overrides: StructuringOverrides
) -> StructuredReport:
    """Assemble the ``StructuredReport``.

    Takes an ``IssuerRef`` rather than a bare ``issuer_id`` because the note H1 —
    which Stage 3 renders from ``report.title`` — needs the issuer's display name.
    """
    doc_type = classify(doc.full_text, overrides.doc_type)
    source = overrides.source or detect_source(doc.full_text)
    report_date = overrides.report_date or detect_report_date(doc.full_text)
    fiscal_period = overrides.fiscal_period or detect_fiscal_period(doc.full_text)

    if doc.extraction_status == "empty":
        sections: list[DocSection] = [DocSection(title="Document", level=1, text="")]
        key_facts: list[KeyFact] = []
    else:
        sections = segment(doc)
        key_facts = extract_key_facts(doc, doc_type)

    rating_moody, rating_sp = (
        _agency_ratings(key_facts, source) if doc_type is DocType.RATING_REPORT else (None, None)
    )
    period_label = report_date or fiscal_period or "undated"
    title = f"{issuer.name} — {_DOCTYPE_LABEL[doc_type]} ({period_label})"

    return StructuredReport(
        issuer_id=issuer.id,
        doc_type=doc_type,
        source=source,
        report_date=report_date,
        fiscal_period=fiscal_period,
        title=title,
        sections=sections,
        key_facts=key_facts,
        rating_moody=rating_moody,
        rating_sp=rating_sp,
        method=doc.method,
        page_count=doc.page_count,
        extraction_status=doc.extraction_status,
        warnings=list(doc.warnings),
    )
