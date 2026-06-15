"""Altman Z''-Score — a transparent, deterministic distress signal.

The private-firm / non-manufacturer variant (Altman's "double-prime" / EM-score)
deliberately drops the market-value and sales-turnover terms of the classic
Z-score, so it is computable from the **balance sheet alone** — which fits the
loans-only lens (issuers are often private or sub-IG, with no clean market cap).

    Z'' = 3.25 + 6.56·X1 + 3.26·X2 + 6.72·X3 + 1.05·X4
      X1 = working capital / total assets
      X2 = retained earnings / total assets
      X3 = EBIT / total assets
      X4 = book equity / total liabilities

Zones (standard Z'' cutoffs): > 2.6 safe · 1.1–2.6 grey · < 1.1 distress.

A *transparent, cited* score — not a black-box rating. Every input is an XBRL
fact, so the engine can show its work and the CP-5 gate can audit it.
"""

from __future__ import annotations

from typing import Optional, Tuple

SAFE_CUTOFF = 2.6
DISTRESS_CUTOFF = 1.1


def zone_for(z: float) -> str:
    if z > SAFE_CUTOFF:
        return "safe"
    if z < DISTRESS_CUTOFF:
        return "distress"
    return "grey"


def altman_z_double_prime(
    *,
    current_assets: float,
    current_liabilities: float,
    total_assets: float,
    retained_earnings: float,
    ebit: float,
    total_liabilities: float,
    book_equity: float,
) -> Optional[Tuple[float, str]]:
    """Z'' and its zone, or None when the denominators are unusable (total assets
    or liabilities are zero/negative — the score would be meaningless)."""
    if total_assets <= 0 or total_liabilities <= 0:
        return None
    x1 = (current_assets - current_liabilities) / total_assets
    x2 = retained_earnings / total_assets
    x3 = ebit / total_assets
    x4 = book_equity / total_liabilities
    z = round(3.25 + 6.56 * x1 + 3.26 * x2 + 6.72 * x3 + 1.05 * x4, 2)
    return z, zone_for(z)
