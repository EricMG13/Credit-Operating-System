"""Period-label helpers shared across the financial modules.

A "period" is a free-text label like ``FY24``, ``Q1 2026``, ``LTM_Q1_26``:
``year`` reads its trailing 2-4 digit year for ordering, and ``latest`` picks the
numeric value at the most-recent period of a ``{label: number}`` series.
"""

from __future__ import annotations

import math
import re
from typing import Optional

# TypeGuard so callers that gate an Optional[number] through is_finite_number get the
# value narrowed to float for the type checker (mypy targets 3.11). typing_extensions
# keeps the import working on the 3.9 test venv too (stdlib typing.TypeGuard is 3.10+).
from typing_extensions import TypeGuard


def year(period: str) -> int:
    """Trailing year in a period label, normalised to 4 digits ('LTM_Q1_26' ->
    2026, 'FY2024' -> 2024), or -1 if none.

    Normalising width is what makes ordering correct across mixed-width labels: a
    raw 2-digit year (26) would otherwise sort BELOW a 4-digit one (2024), so a
    series like {'FY2024': ..., 'LTM_Q1_26': ...} would pick the stale FY year as
    'latest'. (No real label uses pre-2000 years, so 2-digit -> 20xx is safe.)"""
    nums = re.findall(r"\d{2,4}", period or "")
    if not nums:
        return -1
    y = int(nums[-1])
    return y + (2000 if y < 100 else 0)


def _intra_year_rank(period: str) -> float:
    """Recency WITHIN a year, so same-year labels don't tie on year() alone.

    Quarter ``Qn`` -> n. A full year / bare annual -> 4 (through year-end). An LTM
    stub is the *live trailing* credit metric, so it ranks just above the period it
    trails (``+0.5``) — ``LTM_2025`` is treated as more recent than the closed
    ``FY2025``, and ``LTM_Q3`` just above ``Q3``. (Domain call: LTM is the headline
    current figure in leveraged credit; flip the +0.5 if a desk prefers closed FY.)"""
    p = period or ""
    m = re.search(r"Q\s*([1-4])", p, re.I)
    base = float(m.group(1)) if m else 4.0
    return base + (0.5 if p.upper().startswith("LTM") else 0.0)


def sort_key(period: str) -> tuple:
    """Total recency order for a period label: ``(year, intra-year rank)``. Use as
    ``key=`` for max()/sorted() so two same-year labels order by quarter (and an LTM
    stub above the full year it trails) instead of tying on year and keeping whichever
    happened to come first."""
    return year(period), _intra_year_rank(period)


def latest(series: dict) -> Optional[float]:
    """Numeric value at the most-recent period (by total recency order), or None.

    Tolerates a truthy non-dict series: live runtime_output interiors are
    unvalidated below the top level, so a list/str where a period map belongs
    must degrade to None here, not AttributeError inside the QA/projection
    phase (where any raise aborts and rolls back the whole run — BE3-2)."""
    if not isinstance(series, dict):
        return None
    valid = {p: v for p, v in series.items() if isinstance(v, (int, float))}
    return valid[max(valid, key=sort_key)] if valid else None


def is_finite_number(x: object) -> TypeGuard[float]:
    """True only for a real, FINITE int/float (NaN and ±inf rejected).

    A ``TypeGuard[float]`` (not plain ``bool``) so a guarded ``Optional[float]`` is
    narrowed to ``float`` past the check — the call sites that divide/multiply a
    CP-1 figure then type-check without a redundant cast. (``bool``/``int`` values
    are still accepted at runtime; ``float`` is the narrowed static type.)

    The guard that belongs in front of any division/multiplication of a CP-1
    figure (leverage, net debt, EBITDA, coverage). ``isinstance(x, (int, float))``
    alone lets a NaN through — and ``bool(NaN)`` is True — so a NaN input would
    survive a plain numeric/truthiness check and poison the divide: leaking NaN
    into the payload (silent wrong reads downstream) or crashing. ``bool`` is
    intentionally accepted (it is an int subclass; ``False`` is a valid 0)."""
    return isinstance(x, (int, float)) and math.isfinite(x)
