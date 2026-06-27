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

from engine.periods import is_finite_number

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
    """Altman Z''-Score (double-prime / EM-score) and its credit zone.

    Balance-sheet-only distress signal. Returns None when the inputs are unusable
    (a denominator <= 0, or any input missing/non-finite), otherwise (Z'', zone).

        Z'' = 3.25 + 6.56·X1 + 3.26·X2 + 6.72·X3 + 1.05·X4

    where each X-term is a standard balance-sheet ratio:

        X1 = working capital / total assets
           = (current assets − current liabilities) / total assets   (liquidity)
        X2 = retained earnings / total assets                        (cumulative profitability / age)
        X3 = EBIT / total assets                                     (operating return on assets)
        X4 = book equity / total liabilities                         (leverage / solvency cushion)

    Note X4 divides by total LIABILITIES (not total assets) — that is the
    book-equity-to-debt cushion, the double-prime variant's distinguishing term.

    Zones use the published Z'' cutoffs (strict inequalities; both boundaries
    fall in grey): Z'' > 2.6 → safe · 1.1 ≤ Z'' ≤ 2.6 → grey · Z'' < 1.1 → distress.
    """
    # Reject missing or non-finite inputs up front: a NaN passes the `<= 0` guard
    # below (NaN comparisons are False) and would poison every divide into NaN
    # garbage in the distress payload; an inf yields inf/NaN ratios. The None check
    # must precede math.isfinite (isfinite(None) raises). Valid finite inputs are
    # unaffected, so every scored case is identical to before.
    for _v in (current_assets, current_liabilities, total_assets,
               retained_earnings, ebit, total_liabilities, book_equity):
        if not is_finite_number(_v):
            return None

    if total_assets <= 0 or total_liabilities <= 0:
        return None

    working_capital = current_assets - current_liabilities
    x1 = working_capital / total_assets         # liquidity
    x2 = retained_earnings / total_assets        # cumulative profitability
    x3 = ebit / total_assets                     # operating return on assets
    x4 = book_equity / total_liabilities         # solvency cushion (equity / DEBT)

    z = round(3.25 + 6.56 * x1 + 3.26 * x2 + 6.72 * x3 + 1.05 * x4, 2)
    return z, zone_for(z)
