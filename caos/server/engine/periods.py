"""Period-label helpers shared across the financial modules.

A "period" is a free-text label like ``FY24``, ``Q1 2026``, ``LTM_Q1_26``:
``year`` reads its trailing 2-4 digit year for ordering, and ``latest`` picks the
numeric value at the most-recent period of a ``{label: number}`` series.
"""

from __future__ import annotations

import re
from typing import Optional


def year(period: str) -> int:
    """Trailing year in a period label ('LTM_Q1_26' -> 26), or -1 if none."""
    nums = re.findall(r"\d{2,4}", period or "")
    return int(nums[-1]) if nums else -1


def latest(series: dict) -> Optional[float]:
    """Numeric value at the period with the largest trailing year, or None."""
    vals = [(p, v) for p, v in (series or {}).items() if isinstance(v, (int, float))]
    return max(vals, key=lambda kv: year(kv[0]))[1] if vals else None
