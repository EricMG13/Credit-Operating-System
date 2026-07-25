"""Marketed-vs-reported leverage bridge (CP-4C, reported-basis side).

``engine.adjusted`` answers *"how much do disclosed add-backs flatter the
**marketed** leverage?"* by stripping a haircut off CP-1's EBITDA — which is only
correct when CP-1 already carries the marketed figure. On a **reported** basis
(EDGAR XBRL or issuer disclosure) that arithmetic is deliberately skipped, because
reported EBITDA already excludes add-backs and re-stripping them would
double-count. ``bindings._bind_cp1`` names the missing counterpart in its own
comment: *"The marketed-vs-reported bridge would need the inverse math and is a
separate deliberate feature."* This module is that feature.

It answers the question from the other direction: **the sponsor says 4.2x, the
filings say 6.8x — how far apart are they?** For a buy-side analyst that gap *is*
the credit signal: it measures how much presentation separates the marketed story
from the reported basis.

The one rule that matters (red-team RT-2026-07-24-01): **a marketed figure must
never mutate the reported foundation.** This module therefore

  - reads only, and writes nothing back to ``normalized_financials``;
  - emits its output under a distinct ``marketed_vs_reported`` key, never
    overwriting a reported value;
  - accepts a figure only when it is tagged with a marketed ``basis``
    (``sponsor-adjusted`` / ``management-pro-forma``) by the OKF extractor;
  - runs *only* on a reported-basis CP-1, where the reported number is canonical
    and the marketed one can safely be presented beside it as a comparison.

Every figure passes ``is_finite_number`` before any arithmetic, per the CP-1
engine convention — a ``NaN`` from a live payload would otherwise survive a bare
truthiness check and poison the divide.
"""

from __future__ import annotations

import logging
import re
from typing import Optional, Tuple

from sqlalchemy import select

from engine.gate import Finding
from engine.periods import is_finite_number
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload, cp1_leverage

logger = logging.getLogger("caos.engine")

# The bases that mean "this is what the issuer/sponsor is marketing", as opposed
# to what it reported. Mirrors okf_schema.FACT_BASES minus "reported".
MARKETED_BASES = frozenset({"sponsor-adjusted", "management-pro-forma"})

# Below this the marketed and reported stories agree closely enough that flagging
# it would be noise on a desk that already reads both numbers.
_MATERIAL_GAP_TURNS = 0.5

# Sanity band for a parsed leverage multiple. A deck figure outside this is far
# more likely a mis-read (a page number, a percentage, a year) than a real
# leverage, and must not reach committee text.
_MIN_LEVERAGE, _MAX_LEVERAGE = 0.1, 40.0

_LEVERAGE_VALUE = re.compile(r"(\d+(?:\.\d+)?)\s*x\b", re.IGNORECASE)


def _parse_leverage(value: str) -> Optional[float]:
    """``"4.25x"`` → ``4.25``. Returns None for anything not a plausible multiple,
    so a mis-extracted string can never become a committee-facing number."""
    match = _LEVERAGE_VALUE.search(value or "")
    if match is None:
        return None
    try:
        parsed = float(match.group(1))
    except ValueError:  # pragma: no cover — the regex already constrains the shape
        return None
    if not is_finite_number(parsed) or not (_MIN_LEVERAGE <= parsed <= _MAX_LEVERAGE):
        return None
    return parsed


def _marketed_from_facts(rows) -> Optional[Tuple[float, str, Optional[int]]]:
    """The most recent marketed leverage across an issuer's OKF documents.

    Returns ``(leverage, source_label, page)`` or None. Rows arrive newest-first,
    so the first usable fact wins — a re-issued deck supersedes an older one.
    """
    for row in rows:
        facts = row.key_facts_json or []
        if not isinstance(facts, list):
            continue
        for fact in facts:
            if not isinstance(fact, dict):
                continue
            if fact.get("kind") != "leverage":
                continue
            if fact.get("basis") not in MARKETED_BASES:
                continue  # a reported-basis fact is not a marketing claim
            parsed = _parse_leverage(str(fact.get("value") or ""))
            if parsed is None:
                continue
            label = row.source or row.doc_type or "sponsor presentation"
            page = fact.get("page") if isinstance(fact.get("page"), int) else None
            return parsed, str(label), page
    return None


async def marketed_vs_reported(
    session, issuer_id: str, cp1: ModulePayload
) -> Optional[Tuple[dict, ClaimSpec]]:
    """Compare an OKF-extracted marketed leverage against reported CP-1 leverage.

    Returns ``(bridge_dict, claim)`` for CP-1 to embed under
    ``runtime_output.marketed_vs_reported``, or None when there is no marketed
    figure or no usable reported leverage. **Reads only** — the caller attaches the
    result under its own key and must not merge it into ``normalized_financials``.
    """
    from database import OkfNote  # local import: engine must not take a module-load
    # edge on database (mirrors the cycle-free pattern in cp1_sources).

    reported, _net_debt = cp1_leverage(cp1)
    if not is_finite_number(reported) or reported <= 0:
        return None  # nothing credible to compare against

    try:
        rows = (await session.execute(
            select(OkfNote)
            .where(OkfNote.issuer_id == issuer_id)
            .order_by(OkfNote.created_at.desc())
            .limit(20)
        )).scalars().all()
    except Exception:  # noqa: BLE001 — a bridge is never worth failing a run over
        logger.exception("marketed bridge: OKF registry read failed for %s", issuer_id)
        return None

    found = _marketed_from_facts(rows)
    if found is None:
        return None
    marketed, source_label, page = found

    # Positive gap = the reported basis is more levered than the marketing.
    gap = round(float(reported) - marketed, 2)
    if not is_finite_number(gap):
        return None

    bridge = {
        "marketed_leverage": round(marketed, 2),
        "reported_leverage": round(float(reported), 2),
        "gap_turns": gap,
        "marketed_source": source_label,
        "marketed_page": page,
        "basis": "okf_marketed_vs_reported",
    }
    claim = ClaimSpec(
        claim_id="C-MKT1",
        claim_text=(
            f"{source_label} markets net leverage of about {marketed:g}x, against "
            f"{float(reported):g}x on the reported basis — a {abs(gap):g}-turn "
            f"presentation gap. The reported figure remains canonical."
        ),
        evidence=[EvidenceSpec(
            evidence_id="E-MKT1", extraction_type="documentary_fact",
            # An OKF marketed figure is a promotional disclosure read out of a
            # deck, not an independently re-derived number — never "High".
            lineage_class="Analyst Inference",
            source_locator=(
                f"OKF source document ({source_label})"
                + (f", p. {page}" if page else "")
            ),
            confidence="Medium",
        )],
    )
    return bridge, claim


def marketed_gap_finding(cp1: Optional[ModulePayload]) -> Optional[Finding]:
    """A CP-5 finding when the marketed story is materially below the reported
    basis, else None.

    MINOR by design, matching ``adjusted.reconciliation_finding``: a promotional
    gap is a risk to scrutinise, not a data defect that should block export.
    """
    if cp1 is None:
        return None
    bridge = (cp1.runtime_output or {}).get("marketed_vs_reported") or {}
    # A live/replayed CP-1 could carry a truthy non-dict here; degrade rather than
    # raise in the QA phase (mirrors the BE3-1 guard in adjusted.py).
    if not isinstance(bridge, dict):
        return None
    gap = bridge.get("gap_turns")
    marketed, reported = bridge.get("marketed_leverage"), bridge.get("reported_leverage")
    if not (is_finite_number(gap) and is_finite_number(marketed) and is_finite_number(reported)):
        return None
    if abs(gap) < _MATERIAL_GAP_TURNS:
        return None  # the two stories agree closely enough — no noise
    direction = "below" if gap > 0 else "above"
    return Finding(
        finding_id="CP-1-MKTGAP", severity="MINOR", lane=2, module_id="CP-1",
        affected_claim_id="C-MKT1",
        description=(
            f"Marketed net leverage ({marketed:g}x) sits {abs(gap):g} turns {direction} the "
            f"reported basis ({reported:g}x). Sponsor and lender materials present a "
            "pro-forma / add-back-adjusted figure; confirm which basis any covenant, "
            "screening threshold, or committee comparison is actually using."
        ),
        required_remediation=(
            "Reconcile the marketed figure to the reported basis before citing it; "
            "state the basis explicitly in committee materials."
        ),
    )
