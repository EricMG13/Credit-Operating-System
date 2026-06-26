"""Period-label helpers shared across the financial modules.

A "period" is a free-text label like ``FY24``, ``Q1 2026``, ``LTM_Q1_26``:
``year`` reads its trailing 2-4 digit year for ordering, and ``latest`` picks the
numeric value at the most-recent period of a ``{label: number}`` series.
"""

from __future__ import annotations

import re
from typing import Optional


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
    return 2000 + y if y < 100 else y


def latest(series: dict) -> Optional[float]:
    """Numeric value at the period with the largest trailing year, or None."""
    vals = [(p, v) for p, v in (series or {}).items() if isinstance(v, (int, float))]
    return max(vals, key=lambda kv: year(kv[0]))[1] if vals else None
