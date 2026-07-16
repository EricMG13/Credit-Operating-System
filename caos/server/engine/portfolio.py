"""Deterministic portfolio posture — exposure aggregation + constraint compliance.

Pure functions over position dicts (no ORM, no LLM, no DB); the route maps
``portfolio_positions`` rows → these dicts. Every ratio is guarded with
``engine.periods.is_finite_number`` (CLAUDE.md money-math discipline): a bad/zero
denominator degrades to ``None`` rather than poisoning the payload or dividing by
zero. Reproduces the CP-6A exposure report + CP-3C compliance monitor off the
holdings the analyst uploads.

A "position" dict carries: ``par_usd`` (the CLO's par holding, $), ``price`` (mid,
0..~101), ``sector``, ``ranking`` ("1L Gtd Sr. Secd"), ``rating_moody``/``rating_sp``
("B2"/"B"), ``margin_bps``, and an obligor key (``issuer_id`` else ``figi`` else
``borrower_name``).
"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from analysis_contracts import AuthorityEnvelope
from engine.periods import is_finite_number
from ratings import FACTORS, rating_bucket, rating_index

# Senior→junior bucket order so the distribution reads like a rating table.
_BUCKET_ORDER = ["IG", "BB", "B", "CCC", "Unrated"]
_DISTRIBUTION_LIMIT = 50
_MISSING_LIMIT = 100


def checked_add(left: Any, right: Any) -> Optional[float]:
    """Finite addition; overflow/non-finite operands degrade to None."""
    if not is_finite_number(left) or not is_finite_number(right):
        return None
    result = float(left) + float(right)
    return result if is_finite_number(result) else None


def checked_multiply(left: Any, right: Any) -> Optional[float]:
    """Finite multiplication; overflow/non-finite operands degrade to None."""
    if not is_finite_number(left) or not is_finite_number(right):
        return None
    result = float(left) * float(right)
    return result if is_finite_number(result) else None


def checked_divide(numerator: Any, denominator: Any) -> Optional[float]:
    """Finite division with an explicit non-zero denominator."""
    if (
        not is_finite_number(numerator)
        or not is_finite_number(denominator)
        or denominator == 0
    ):
        return None
    result = float(numerator) / float(denominator)
    return result if is_finite_number(result) else None


def _rounded(value: Any, digits: int = 2) -> Optional[float]:
    return round(float(value), digits) if is_finite_number(value) else None


def _is_positive_number(value: Any) -> bool:
    return is_finite_number(value) and float(value) > 0


def _bounded_missing(values: List[str]) -> List[str]:
    unique = list(dict.fromkeys(values))
    if len(unique) <= _MISSING_LIMIT:
        return unique
    remainder = len(unique) - _MISSING_LIMIT
    return unique[:_MISSING_LIMIT] + [f"additional_missing_dependencies:{remainder}"]


def bound_missing_dependencies(values: List[str]) -> List[str]:
    return _bounded_missing(values)


def normalize_portfolio_as_of(value: Any) -> Optional[datetime]:
    """Strictly normalize a reported portfolio date to UTC midnight."""
    if value is None:
        return None
    if isinstance(value, datetime):
        normalized = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return normalized.astimezone(timezone.utc)
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
    if isinstance(value, str) and len(value) == 10:
        try:
            parsed = date.fromisoformat(value)
        except ValueError:
            return None
        return datetime(parsed.year, parsed.month, parsed.day, tzinfo=timezone.utc)
    return None


def portfolio_authority(
    *,
    method: str,
    as_of: Any,
    portfolio_id: str,
) -> Dict[str, Any]:
    normalized = normalize_portfolio_as_of(as_of)
    return AuthorityEnvelope(
        origin="portfolio-holdings",
        method=method,
        freshness="reported" if normalized is not None else "unknown",
        as_of=normalized,
        source_ids=[portfolio_id],
        approval_state="published",
    ).model_dump(mode="json")


def position_market_value(position: Dict[str, Any]) -> Optional[float]:
    """Finite market value with par fallback when price is absent or invalid.

    A price of 0.0 is a REAL mark (a fully distressed quote), not a missing one:
    the old ``price > 0`` gate sent zero-priced positions to the par fallback,
    marking precisely the most distressed holding at 100 (triage 2026-07-16 P3,
    the ingest-side zero-bid fix's other half). Negative prices stay invalid."""
    par = position.get("par_usd")
    if not is_finite_number(par) or par <= 0:
        return None
    price = position.get("price")
    if is_finite_number(price) and price >= 0:
        price_factor = checked_divide(price, 100.0)
        return checked_multiply(par, price_factor)
    return float(par)


def _safe_json(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _safe_json(item) for key, item in sorted(value.items())}
    if isinstance(value, (list, tuple)):
        return [_safe_json(item) for item in value]
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value) if is_finite_number(value) else None
    return value


def stress_source_fingerprint(
    positions: List[Dict[str, Any]],
    inputs: Dict[str, Any],
    *,
    as_of: Optional[str],
    portfolio_id: str,
) -> str:
    """Fingerprint the exact sorted holdings snapshot and canonical stress input."""
    payload = {
        "portfolio_id": portfolio_id,
        "as_of": as_of,
        "inputs": _safe_json(inputs),
        "positions": [
            _safe_json(position)
            for position in sorted(
                positions,
                key=lambda row: (
                    str(row.get("id") or ""),
                    str(row.get("borrower_name") or ""),
                ),
            )
        ],
    }
    canonical = json.dumps(
        payload, sort_keys=True, separators=(",", ":"), allow_nan=False, default=str
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def compute_stress_snapshot(
    positions: List[Dict[str, Any]],
    inputs: Dict[str, Any],
    *,
    as_of: Optional[str],
    portfolio_id: str,
) -> Dict[str, Any]:
    """Deterministic book/sector price shock over an immutable holdings snapshot."""
    missing: List[str] = []
    if as_of and normalize_portfolio_as_of(as_of) is None:
        missing.append("valid portfolio as_of snapshot")
    book_shock = inputs.get("book_price_shock_pct", 0.0)
    if not is_finite_number(book_shock):
        missing.append("finite book price shock")
        book_shock = 0.0
    sector_shocks = inputs.get("sector_shock_pcts") or {}
    if not isinstance(sector_shocks, dict):
        missing.append("valid sector shock map")
        sector_shocks = {}

    base_nav: Optional[float] = 0.0
    stressed_nav: Optional[float] = 0.0
    contributions: Dict[str, Optional[float]] = {}
    for position in positions:
        position_id = str(position.get("id") or position.get("borrower_name") or "unknown")
        par = position.get("par_usd")
        if not is_finite_number(par) or par <= 0:
            missing.append(f"invalid par value:{position_id}")
            continue
        price = position.get("price")
        if not is_finite_number(price) or price <= 0:
            missing.append(f"finite price:{position_id}")
        market_value = position_market_value(position)
        if market_value is None:
            missing.append(f"overflow market value:{position_id}")
            base_nav = None
            stressed_nav = None
            continue

        # Base and stressed NAV are independent facts. Record the base holding
        # before stress math so a stressed-only overflow cannot erase it.
        next_base = checked_add(base_nav, market_value)
        if next_base is None:
            missing.append("overflow base NAV")
        base_nav = next_base

        sector = str(position.get("sector") or "Unclassified")
        sector_shock = sector_shocks.get(sector, 0.0)
        if not is_finite_number(sector_shock):
            missing.append(f"finite sector shock:{sector}")
            sector_shock = 0.0
        raw_combined = checked_add(book_shock, sector_shock)
        if raw_combined is None:
            missing.append(f"overflow combined shock:{position_id}")
            continue
        combined_shock = max(-100.0, raw_combined)
        shock_fraction = checked_divide(combined_shock, 100.0)
        multiplier = checked_add(1.0, shock_fraction)
        stressed_value = checked_multiply(market_value, multiplier)
        if stressed_value is None:
            missing.append(f"overflow stressed market value:{position_id}")
            stressed_nav = None
            continue

        next_stressed = checked_add(stressed_nav, stressed_value)
        if next_stressed is None:
            missing.append("overflow stressed NAV")
        stressed_nav = next_stressed
        contribution = checked_add(market_value, -stressed_value)
        next_contribution = checked_add(
            contributions.get(sector, 0.0), contribution
        )
        if next_contribution is None:
            missing.append(f"overflow sector contribution:{sector}")
        contributions[sector] = next_contribution

    loss_amount: Optional[float] = None
    loss_percent: Optional[float] = None
    if not is_finite_number(stressed_nav):
        missing.append("stressed NAV unavailable")
    else:
        loss_amount = checked_add(base_nav, -stressed_nav)
    if not is_finite_number(base_nav) or base_nav == 0:
        missing.append("non-zero base NAV")
    elif is_finite_number(stressed_nav):
        if loss_amount is None:
            missing.append("overflow loss amount")
        else:
            loss_percent = checked_multiply(
                checked_divide(loss_amount, base_nav), 100.0
            )
            if loss_percent is None:
                missing.append("overflow loss percent")
    ordered_contributions = sorted(
        contributions.items(),
        key=lambda item: item[1] if is_finite_number(item[1]) else float("-inf"),
        reverse=True,
    )
    if len(ordered_contributions) > _DISTRIBUTION_LIMIT:
        kept = ordered_contributions[:_DISTRIBUTION_LIMIT]
        remainder_total: Optional[float] = 0.0
        for _sector, value in ordered_contributions[_DISTRIBUTION_LIMIT:]:
            remainder_total = checked_add(remainder_total, value)
        kept.append(("Other", remainder_total))
        ordered_contributions = kept
    return {
        "base_nav": _rounded(base_nav),
        "stressed_nav": _rounded(stressed_nav),
        "loss_amount": _rounded(loss_amount),
        "loss_percent": _rounded(loss_percent, 8),
        "sector_contributions": [
            {"sector": sector, "loss_amount": _rounded(value)}
            for sector, value in ordered_contributions
        ],
        "missing_dependencies": _bounded_missing(missing),
        "authority": portfolio_authority(
            method="deterministic-stress-v1",
            as_of=as_of,
            portfolio_id=portfolio_id,
        ),
    }


def compute_portfolio_analytics(
    positions: List[Dict[str, Any]],
    constraints: List[Dict[str, Any]],
    *,
    as_of: Optional[str],
    portfolio_id: str,
) -> Dict[str, Any]:
    """Bounded deterministic portfolio aggregates for the Portfolio Lab."""
    exposure = compute_exposure(positions)
    compliance = check_constraints(constraints, exposure)
    missing: List[str] = list(exposure.get("missing_dependencies") or [])
    if as_of and normalize_portfolio_as_of(as_of) is None:
        missing.append("valid portfolio as_of snapshot")
    rating_mv: Dict[str, Optional[float]] = {}
    maturity_mv: Dict[str, Optional[float]] = {}
    priced_nav: Optional[float] = 0.0
    finite_nav: Optional[float] = 0.0

    for position in positions:
        position_id = str(position.get("id") or position.get("borrower_name") or "unknown")
        market_value = position_market_value(position)
        if market_value is None:
            missing.append(f"overflow market value:{position_id}")
            finite_nav = None
            if _is_positive_number(position.get("price")):
                priced_nav = None
            continue
        next_nav = checked_add(finite_nav, market_value)
        if next_nav is None:
            missing.append("overflow analytics NAV")
        finite_nav = next_nav
        price = position.get("price")
        if _is_positive_number(price):
            next_priced = checked_add(priced_nav, market_value)
            if next_priced is None:
                missing.append("overflow priced NAV")
            priced_nav = next_priced
        else:
            missing.append(f"price:{position_id}")

        rating = str(
            position.get("rating_moody")
            or position.get("rating_sp")
            or "Unrated"
        )
        next_rating = checked_add(rating_mv.get(rating, 0.0), market_value)
        if next_rating is None:
            missing.append(f"overflow rating exposure:{rating}")
        rating_mv[rating] = next_rating

        maturity = str(position.get("maturity") or "")
        match = re.search(r"\b(20\d{2})\b", maturity)
        if match:
            year = match.group(1)
            next_maturity = checked_add(maturity_mv.get(year, 0.0), market_value)
            if next_maturity is None:
                missing.append(f"overflow maturity exposure:{year}")
            maturity_mv[year] = next_maturity
        else:
            missing.append(f"maturity:{position_id}")

    rating_rows: List[tuple[str, Optional[float]]] = []
    for rating, value in rating_mv.items():
        percentage = checked_multiply(
            checked_divide(value, finite_nav), 100.0
        )
        rating_rows.append((rating, _rounded(percentage, 8)))
    rating_rows.sort(
        key=lambda item: item[1] if is_finite_number(item[1]) else float("-inf"),
        reverse=True,
    )
    if len(rating_rows) > _DISTRIBUTION_LIMIT:
        kept = rating_rows[:_DISTRIBUTION_LIMIT]
        other: Optional[float] = 0.0
        for _rating, percentage in rating_rows[_DISTRIBUTION_LIMIT:]:
            other = checked_add(other, percentage)
        kept.append(("Other", _rounded(other, 8)))
        rating_rows = kept
    rating_distribution = dict(rating_rows)
    if not is_finite_number(finite_nav) or finite_nav == 0:
        missing.append("non-zero portfolio NAV")
    statuses = {status: 0 for status in ("Breach", "Watch", "Pass", "Info")}
    for row in compliance:
        statuses[row.get("status", "Info")] = statuses.get(row.get("status", "Info"), 0) + 1
    headroom = [
        {
            "code": row.get("code"),
            "status": row.get("status"),
            "headroom": row.get("headroom"),
            "current": row.get("current"),
            "limit_value": row.get("limit_value"),
        }
        for row in compliance[:50]
    ]
    normalized_as_of = normalize_portfolio_as_of(as_of)
    return {
        "as_of": normalized_as_of.date().isoformat() if normalized_as_of is not None else None,
        "concentration": exposure,
        "rating_distribution": rating_distribution,
        "maturity_wall": {
            year: _rounded(value)
            for year, value in sorted(maturity_mv.items())[:20]
        },
        "risk_budget": {"status_counts": statuses, "headroom": headroom},
        "liquidity": {
            "priced_nav_pct": _rounded(
                checked_multiply(
                    checked_divide(priced_nav, finite_nav), 100.0
                )
            ),
            "wa_price": exposure.get("wa_price"),
            "unpriced_positions": sum(
                not _is_positive_number(row.get("price"))
                for row in positions
            ),
        },
        "compliance": compliance[:100],
        "authority": portfolio_authority(
            method="deterministic-portfolio-v1",
            as_of=as_of,
            portfolio_id=portfolio_id,
        ),
        "missing_dependencies": _bounded_missing(missing),
    }


def _obligor_key(p: Dict[str, Any]) -> str:
    """Stable *obligor* identity: issuer_id else borrower name (lowered).

    NOT figi — figi is per-instrument, so an obligor's several loans/tranches each
    carry a different one; keying on it would over-count obligors and split a
    single name's exposure across its tranches (single-name / top-10 must aggregate
    all of an obligor's positions, e.g. Asurion's five)."""
    for k in ("issuer_id", "borrower_name"):
        v = p.get(k)
        if v and str(v).strip():
            return str(v).strip().lower()
    return "—"


def _mv(p: Dict[str, Any]) -> Optional[float]:
    """Market value = par × price/100. No/blank price → par as proxy (never crash)."""
    return position_market_value(p)


def _is_first_lien(ranking: Any) -> bool:
    return str(ranking or "").strip().lower().startswith("1l")


def _pct(part: Any, whole: Any) -> Optional[float]:
    """part/whole × 100, guarded. None when the denominator is non-finite or zero."""
    return _rounded(checked_multiply(checked_divide(part, whole), 100.0))


def compute_exposure(positions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Portfolio exposure report from CLO positions — NAV/par, counts, sector +
    rating distribution, WA rating/margin/price, 1st-lien %, single-name max,
    top-10. All %s are of NAV (market value). Positions with a non-finite/≤0 par
    are dropped (they carry no exposure)."""
    valid = [
        p
        for p in positions
        if is_finite_number(p.get("par_usd")) and p["par_usd"] > 0
    ]
    if not valid:
        return {"n_positions": 0, "n_obligors": 0, "n_sectors": 0, "total_par": 0.0,
                "total_nav": 0.0, "sectors": [], "rating_dist": [], "top10": [],
                "wa_rating": None, "warf": None, "wa_margin": None, "wa_price": None,
                "first_lien_pct": None, "single_name_max": None,
                "missing_dependencies": []}

    missing: List[str] = []
    total_par: Optional[float] = 0.0
    total_nav: Optional[float] = 0.0
    first_lien_mv: Optional[float] = 0.0
    warf_num: Optional[float] = 0.0
    warf_den: Optional[float] = 0.0
    margin_weighted_sum: Optional[float] = 0.0
    margin_weight_sum: Optional[float] = 0.0
    price_weighted_sum: Optional[float] = 0.0
    price_weight_sum: Optional[float] = 0.0

    obligor_mv: Dict[str, Optional[float]] = {}
    obligor_name: Dict[str, str] = {}

    sector_mv: Dict[str, Optional[float]] = {}
    sector_obl: Dict[str, set] = {}

    bucket_mv: Dict[str, Optional[float]] = {}
    bucket_obl: Dict[str, set] = {}

    for p in valid:
        par = p["par_usd"]
        next_total_par = checked_add(total_par, par)
        if next_total_par is None:
            missing.append("overflow total par")
        total_par = next_total_par

        price = p.get("price")
        p_mv = position_market_value(p)
        if p_mv is None:
            total_nav = None
            missing.append(
                f"overflow market value:{p.get('id') or p.get('borrower_name') or 'unknown'}"
            )
            continue
        next_total_nav = checked_add(total_nav, p_mv)
        if next_total_nav is None:
            missing.append("overflow total NAV")
        total_nav = next_total_nav

        k = _obligor_key(p)
        next_obligor = checked_add(obligor_mv.get(k, 0.0), p_mv)
        if next_obligor is None:
            missing.append(f"overflow obligor exposure:{k}")
        obligor_mv[k] = next_obligor
        obligor_name.setdefault(k, str(p.get("borrower_name") or p.get("ticker") or k))

        s = str(p.get("sector") or "Unclassified")
        next_sector = checked_add(sector_mv.get(s, 0.0), p_mv)
        if next_sector is None:
            missing.append(f"overflow sector exposure:{s}")
        sector_mv[s] = next_sector
        sector_obl.setdefault(s, set()).add(k)

        idx = rating_index(p.get("rating_moody"), p.get("rating_sp"), p.get("rating_fitch"))
        b = rating_bucket(idx)
        next_bucket = checked_add(bucket_mv.get(b, 0.0), p_mv)
        if next_bucket is None:
            missing.append(f"overflow rating bucket:{b}")
        bucket_mv[b] = next_bucket
        bucket_obl.setdefault(b, set()).add(k)
        if idx is not None:
            weighted_factor = checked_multiply(FACTORS[idx], p_mv)
            next_warf_num = checked_add(warf_num, weighted_factor)
            next_warf_den = checked_add(warf_den, p_mv)
            if next_warf_num is None or next_warf_den is None:
                missing.append("overflow WARF aggregation")
            warf_num, warf_den = next_warf_num, next_warf_den

        margin = p.get("margin_bps")
        if is_finite_number(margin):
            weighted_margin = checked_multiply(margin, p_mv)
            next_margin_sum = checked_add(margin_weighted_sum, weighted_margin)
            next_margin_weight = checked_add(margin_weight_sum, p_mv)
            if next_margin_sum is None or next_margin_weight is None:
                missing.append("overflow margin aggregation")
            margin_weighted_sum, margin_weight_sum = (
                next_margin_sum,
                next_margin_weight,
            )

        if is_finite_number(price):
            weighted_price = checked_multiply(price, p_mv)
            next_price_sum = checked_add(price_weighted_sum, weighted_price)
            next_price_weight = checked_add(price_weight_sum, p_mv)
            if next_price_sum is None or next_price_weight is None:
                missing.append("overflow price aggregation")
            price_weighted_sum, price_weight_sum = (
                next_price_sum,
                next_price_weight,
            )

        if _is_first_lien(p.get("ranking")):
            next_first_lien = checked_add(first_lien_mv, p_mv)
            if next_first_lien is None:
                missing.append("overflow first-lien exposure")
            first_lien_mv = next_first_lien

    ordered_sectors = sorted(
        sector_mv.items(),
        key=lambda item: item[1] if is_finite_number(item[1]) else float("-inf"),
        reverse=True,
    )
    sector_rows = [
        {
            "sector": sector,
            "mv": _rounded(value),
            "pct_nav": _pct(value, total_nav),
            "n_obligors": len(sector_obl[sector]),
        }
        for sector, value in ordered_sectors[:_DISTRIBUTION_LIMIT]
    ]
    if len(ordered_sectors) > _DISTRIBUTION_LIMIT:
        other_mv: Optional[float] = 0.0
        other_obligors: set = set()
        for sector, value in ordered_sectors[_DISTRIBUTION_LIMIT:]:
            other_mv = checked_add(other_mv, value)
            other_obligors.update(sector_obl[sector])
        if other_mv is None:
            missing.append("overflow other-sector exposure")
        sector_rows.append({
            "sector": "Other",
            "mv": _rounded(other_mv),
            "pct_nav": _pct(other_mv, total_nav),
            "n_obligors": len(other_obligors),
        })

    rating_dist = [
        {"bucket": b, "mv": _rounded(bucket_mv[b]), "pct_nav": _pct(bucket_mv[b], total_nav),
         "n_obligors": len(bucket_obl[b])}
        for b in _BUCKET_ORDER if b in bucket_mv
    ]

    warf = _rounded(checked_divide(warf_num, warf_den), 0)
    wa_margin = _rounded(checked_divide(margin_weighted_sum, margin_weight_sum), 3)
    wa_price = _rounded(checked_divide(price_weighted_sum, price_weight_sum), 3)

    top_obl = sorted(
        obligor_mv.items(),
        key=lambda item: item[1] if is_finite_number(item[1]) else float("-inf"),
        reverse=True,
    )
    top10 = [{"obligor": obligor_name[k], "mv": _rounded(v), "pct_nav": _pct(v, total_nav)}
             for k, v in top_obl[:10]]
    single = top_obl[0] if top_obl else None
    top10_total: Optional[float] = 0.0
    for _key, value in top_obl[:10]:
        top10_total = checked_add(top10_total, value)

    return {
        "n_positions": len(valid),
        "n_obligors": len(obligor_mv),
        "n_sectors": len(sector_mv),
        "total_par": _rounded(total_par),
        "total_nav": _rounded(total_nav),
        "sectors": sector_rows,
        "rating_dist": rating_dist,
        "top10": top10,
        "top10_pct_nav": _pct(top10_total, total_nav),
        "wa_rating": rating_bucket(_nearest_rating_idx(warf)) if warf is not None else None,
        "warf": warf,
        "wa_margin": wa_margin,
        "wa_price": wa_price,
        "first_lien_pct": _pct(first_lien_mv, total_nav),
        "single_name_max": ({"obligor": obligor_name[single[0]], "pct_nav": _pct(single[1], total_nav)}
                             if single else None),
        "missing_dependencies": _bounded_missing(missing),
    }


def _wavg(pairs: List[Any]) -> Optional[float]:
    """MV-weighted average of finite (value, weight) pairs; None if no finite weight."""
    num: Optional[float] = 0.0
    den: Optional[float] = 0.0
    for value, weight in pairs:
        if is_finite_number(value) and is_finite_number(weight) and weight > 0:
            num = checked_add(num, checked_multiply(value, weight))
            den = checked_add(den, weight)
    return _rounded(checked_divide(num, den), 3)


def _nearest_rating_idx(warf: float) -> Optional[int]:
    """Rating-scale index whose idealized factor is nearest ``warf`` (WA rating label)."""
    if not is_finite_number(warf):
        return None
    return min(range(len(FACTORS)), key=lambda i: abs(FACTORS[i] - warf))


# ── Constraint compliance ────────────────────────────────────────────────────
# Map a constraint category → the exposure figure to check it against. Only the
# deterministically-computable ones are mapped; anything else carries its limit
# with current=None and status "Info" (honest "not computed", never a fabricated
# Pass). Watch = within 10% of the limit's magnitude (mirrors the user's monitor,
# e.g. Asurion 2.37 vs 2.5 → Watch).
def _current_for(constraint: Dict[str, Any], exposure: Dict[str, Any]) -> Optional[float]:
    """The exposure figure a constraint checks against. Keys off category + the
    parameter text (so 'min 1st lien' and 'max 2nd lien' — same 'Instrument'
    category — don't collide, and the Nth-largest sector reads the Nth sector).
    Returns None for anything not deterministically computable (→ status 'Info')."""
    cat = (constraint.get("category") or "").strip().lower()
    param = (constraint.get("parameter") or "").strip().lower()
    dist = {r["bucket"]: (r["pct_nav"] or 0.0) for r in exposure.get("rating_dist", [])}
    fl = exposure.get("first_lien_pct")

    if "single name" in cat:
        sn = exposure.get("single_name_max")
        return sn.get("pct_nav") if sn else None
    if "top 10" in cat or "top10" in cat:
        return exposure.get("top10_pct_nav")
    # CCC-bucket before unrated: the CCC constraint's text mentions "unrated" too
    # ("Max CCC+ and below, incl. Unrated"), so it must match the CCC branch first.
    if "ccc" in cat or "ccc" in param:  # CCC+ and below, incl. unrated/other
        return round(dist.get("CCC", 0.0) + dist.get("Unrated", 0.0), 2)
    if "unrated" in cat or "unrated" in param:
        return dist.get("Unrated", 0.0)
    if cat.startswith("sector"):
        secs = exposure.get("sectors") or []
        rank = 2 if "3rd" in param else 1 if "2nd" in param else 0
        return secs[rank].get("pct_nav") if len(secs) > rank else None
    if "instrument" in cat:
        # "≥ 90% 1st lien" vs "≤ 10% 2nd lien / unsecured" share the category.
        if "2nd" in param or "second" in param or "unsec" in param:
            return round(100.0 - fl, 2) if is_finite_number(fl) else None
        if "1st" in param or "first" in param or "senior secured" in param or "1l" in param:
            return fl
        return None
    if "diversification" in cat and "obligor" in param:
        return float(exposure.get("n_obligors") or 0)
    return None


def _status(current: Optional[float], limit_value: Optional[float], op: Optional[str]) -> str:
    """Pass / Watch / Breach for a computed current vs a limit. Watch = within 10%
    of the limit magnitude. Unknown current or limit → 'Info' (not computed).

    ``>`` joins the ``>=`` branch: both are FLOORS, and routing bare ``>`` through
    the default max-branch inverted it — a floor breach read as Pass with positive
    headroom (triage 2026-07-16 P1 family). An op that is neither a known floor
    nor a known ceiling is 'Info', never a guessed direction."""
    if not is_finite_number(current) or not is_finite_number(limit_value):
        return "Info"
    if op not in (">=", ">", "<=", "<", None):
        return "Info"
    band = max(0.2, abs(limit_value) * 0.10)
    if op in (">=", ">"):
        if current < limit_value:
            return "Breach"
        return "Watch" if current - limit_value < band else "Pass"
    # default / "<=" / "<" : a maximum
    if current > limit_value:
        return "Breach"
    return "Watch" if limit_value - current < band else "Pass"


def check_constraints(constraints: List[Dict[str, Any]], exposure: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Per constraint: compute ``current`` from ``exposure``, ``headroom`` (limit −
    current, sign-aware), and ``status``. Constraints whose current can't be
    computed carry status 'Info'. ``constraints`` dicts: code, category, parameter,
    limit_text, limit_value, limit_unit, limit_op, breach_type, source_document."""
    out: List[Dict[str, Any]] = []
    for k in constraints:
        current = _current_for(k, exposure)
        limit_value, op = k.get("limit_value"), k.get("limit_op")
        status = _status(current, limit_value, op)
        headroom = None
        if is_finite_number(current) and is_finite_number(limit_value):
            # Sign-aware both ways: floors (>=, >) measure room ABOVE the limit.
            headroom = round((current - limit_value) if op in (">=", ">") else (limit_value - current), 2)
        out.append({
            "code": k.get("code"), "category": k.get("category"), "parameter": k.get("parameter"),
            "limit_text": k.get("limit_text"), "breach_type": k.get("breach_type"),
            "source_document": k.get("source_document"),
            "current": current, "headroom": headroom, "status": status,
        })
    return out


def _limit_for(constraints: List[Dict[str, Any]], keyword: str) -> Optional[float]:
    """The numeric limit of the first constraint whose category contains ``keyword``."""
    for k in constraints or []:
        if keyword in (k.get("category") or "").strip().lower() and is_finite_number(k.get("limit_value")):
            return float(k["limit_value"])
    return None


def _conc_level(headroom: Optional[float], cap: Optional[float]) -> Optional[int]:
    """0=comfortable, 1=near cap (<10% of it), 2=at/over cap. None if not computable."""
    if not is_finite_number(headroom) or not is_finite_number(cap):
        return None
    if headroom < 0:
        return 2
    return 1 if headroom < max(0.2, abs(cap) * 0.10) else 0


def assess_issuer_fit(positions: List[Dict[str, Any]], constraints: List[Dict[str, Any]],
                      issuer_id: Optional[str] = None, issuer_name: Optional[str] = None) -> Optional[dict]:
    """One issuer's live fit in the book — its single-name %NAV, its sector %NAV +
    headroom to the sector cap, and a ``concentration_risk`` (LOW/MODERATE/HIGH).
    Feeds CP-3C's concentration register (replaces the 'no feed' stub). Matches the
    issuer by soft-linked ``issuer_id`` else exact ``borrower_name``. None when the
    book is empty (nothing to fit against)."""
    ex = compute_exposure(positions)
    total_nav = ex["total_nav"]
    if not positions or not is_finite_number(total_nav) or total_nav <= 0:
        return None
    kid = (issuer_id or "").strip().lower()
    kname = (issuer_name or "").strip().lower()

    def mine(p: Dict[str, Any]) -> bool:
        if kid and str(p.get("issuer_id") or "").strip().lower() == kid:
            return True
        return bool(kname) and str(p.get("borrower_name") or "").strip().lower() == kname

    held = [p for p in positions if mine(p)]
    held_pct = _pct(sum(_mv(p) or 0.0 for p in held), total_nav)
    sector = next((p.get("sector") for p in held if p.get("sector")), None)
    sector_row = next((s for s in ex["sectors"] if s["sector"] == sector), None) if sector else None
    sector_pct = sector_row["pct_nav"] if sector_row else None

    single_cap = _limit_for(constraints, "single name")
    sector_cap = _limit_for(constraints, "sector")
    single_hr = (round(single_cap - held_pct, 2)
                 if is_finite_number(single_cap) and is_finite_number(held_pct) else None)
    sector_hr = (round(sector_cap - sector_pct, 2)
                 if is_finite_number(sector_cap) and is_finite_number(sector_pct) else None)
    levels = [lv for lv in (_conc_level(single_hr, single_cap), _conc_level(sector_hr, sector_cap))
              if lv is not None]
    risk = None if not levels else ("HIGH" if max(levels) == 2 else "MODERATE" if max(levels) == 1 else "LOW")

    return {
        "in_portfolio": bool(held),
        "held_pct_nav": held_pct,
        "n_positions": len(held),
        "sector": sector,
        "sector_pct_nav": sector_pct,
        "single_name_cap": single_cap,
        "single_name_headroom": single_hr,
        "sector_cap": sector_cap,
        "sector_headroom": sector_hr,
        "concentration_risk": risk,
    }


if __name__ == "__main__":
    # ponytail: one runnable self-check — exposure math + compliance status on a
    # tiny hand-built book with a known answer.
    pos: List[Dict[str, Any]] = [
        # obligor A: two 1L positions, B-rated, Software; par 6M @ 100 → MV 6M
        {"par_usd": 4_000_000, "price": 100, "sector": "Software", "ranking": "1L Sr. Secd",
         "rating_moody": "B2", "rating_sp": "B", "margin_bps": 400, "borrower_name": "Alpha"},
        {"par_usd": 2_000_000, "price": 100, "sector": "Software", "ranking": "1L Sr. Secd",
         "rating_moody": "B2", "rating_sp": "B", "margin_bps": 400, "borrower_name": "Alpha"},
        # obligor B: Insurance, BB, 1L; 3M @ 100
        {"par_usd": 3_000_000, "price": 100, "sector": "Insurance", "ranking": "1L Gtd Sr. Secd",
         "rating_moody": "Ba3", "rating_sp": "BB-", "margin_bps": 300, "borrower_name": "Beta"},
        # obligor C: Chemicals, CCC, 2L; 1M @ 100
        {"par_usd": 1_000_000, "price": 100, "sector": "Chemicals", "ranking": "2L",
         "rating_moody": "Caa1", "rating_sp": "CCC+", "margin_bps": 600, "borrower_name": "Gamma"},
    ]
    ex = compute_exposure(pos)
    assert ex["n_positions"] == 4 and ex["n_obligors"] == 3 and ex["n_sectors"] == 3
    assert ex["total_nav"] == 10_000_000.0, ex["total_nav"]
    # Alpha = 6M/10M = 60% single name; Software sector = 60%.
    assert ex["single_name_max"]["obligor"] == "Alpha" and ex["single_name_max"]["pct_nav"] == 60.0
    assert ex["sectors"][0]["sector"] == "Software" and ex["sectors"][0]["pct_nav"] == 60.0
    # 1st lien = 9M/10M = 90%; CCC bucket = 1M/10M = 10%.
    assert ex["first_lien_pct"] == 90.0
    ccc = next(r for r in ex["rating_dist"] if r["bucket"] == "CCC")
    assert ccc["pct_nav"] == 10.0
    # MV-weighted margin = (4*400+2*400+3*300+1*600)/10 = 390.
    assert ex["wa_margin"] == 390.0, ex["wa_margin"]

    # Two loans of "Alpha" aggregate into ONE obligor (single-name is obligor-level).
    assert ex["top10"][0]["obligor"] == "Alpha" and ex["top10"][0]["pct_nav"] == 60.0

    cons: List[Dict[str, Any]] = [
        {"code": "C-01", "category": "Single Name", "parameter": "max issuer",
         "limit_text": "≤ 2.5%", "limit_value": 2.5, "limit_op": "<=", "breach_type": "Hard"},
        {"code": "C-09", "category": "Instrument", "parameter": "Min 1st Lien / Senior Secured",
         "limit_text": "≥ 90%", "limit_value": 90.0, "limit_op": ">=", "breach_type": "Hard"},
        {"code": "C-10", "category": "Instrument", "parameter": "Max 2nd Lien / Unsecured",
         "limit_text": "≤ 10%", "limit_value": 10.0, "limit_op": "<=", "breach_type": "Soft"},
        {"code": "C-16", "category": "Covenant", "parameter": "cov-lite %",
         "limit_text": "Info", "limit_value": None, "limit_op": None, "breach_type": "Info"},
    ]
    comp = {r["code"]: r for r in check_constraints(cons, ex)}
    assert comp["C-01"]["current"] == 60.0 and comp["C-01"]["status"] == "Breach"  # 60% ≫ 2.5%
    assert comp["C-09"]["current"] == 90.0 and comp["C-09"]["status"] == "Watch"   # exactly at 90% min
    # 2nd-lien = 100 − 90 = 10% (Gamma's 2L position), NOT the 1st-lien 90%.
    assert comp["C-10"]["current"] == 10.0 and comp["C-10"]["status"] == "Watch"
    assert comp["C-16"]["status"] == "Info" and comp["C-16"]["current"] is None    # not computable

    # Issuer fit: Alpha is 60% of NAV vs a 2.5% single-name cap → over → HIGH risk.
    fit = assess_issuer_fit(pos, cons, issuer_name="Alpha")
    assert fit is not None
    assert fit["in_portfolio"] and fit["held_pct_nav"] == 60.0
    assert fit["single_name_cap"] == 2.5 and fit["single_name_headroom"] == round(2.5 - 60.0, 2)
    assert fit["concentration_risk"] == "HIGH"
    # A name not in the book → held 0%, comfortable single-name headroom.
    absent = assess_issuer_fit(pos, cons, issuer_name="Nobody")
    assert absent is not None
    assert absent["in_portfolio"] is False and absent["held_pct_nav"] == 0.0
    assert absent["concentration_risk"] == "LOW"
    print("engine/portfolio.py self-check OK")
