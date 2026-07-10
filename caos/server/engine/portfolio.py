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

from typing import Any, Dict, List, Optional

from engine.periods import is_finite_number
from ratings import FACTORS, rating_bucket, rating_index

# Senior→junior bucket order so the distribution reads like a rating table.
_BUCKET_ORDER = ["IG", "BB", "B", "CCC", "Unrated"]


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
    par = p.get("par_usd")
    if not is_finite_number(par) or par <= 0:
        return None
    price = p.get("price")
    return par * price / 100.0 if is_finite_number(price) and price > 0 else float(par)


def _is_first_lien(ranking: Any) -> bool:
    return str(ranking or "").strip().lower().startswith("1l")


def _pct(part: float, whole: float) -> Optional[float]:
    """part/whole × 100, guarded. None when the denominator is non-finite or zero."""
    if not is_finite_number(part) or not is_finite_number(whole) or whole == 0:
        return None
    return round(100.0 * part / whole, 2)


def compute_exposure(positions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Portfolio exposure report from CLO positions — NAV/par, counts, sector +
    rating distribution, WA rating/margin/price, 1st-lien %, single-name max,
    top-10. All %s are of NAV (market value). Positions with a non-finite/≤0 par
    are dropped (they carry no exposure)."""
    valid = [p for p in positions if is_finite_number(p.get("par_usd")) and p["par_usd"] > 0]
    if not valid:
        return {"n_positions": 0, "n_obligors": 0, "n_sectors": 0, "total_par": 0.0,
                "total_nav": 0.0, "sectors": [], "rating_dist": [], "top10": [],
                "wa_rating": None, "warf": None, "wa_margin": None, "wa_price": None,
                "first_lien_pct": None, "single_name_max": None}

    total_par = 0.0
    total_nav = 0.0
    first_lien_mv = 0.0
    warf_num = 0.0
    warf_den = 0.0
    margin_weighted_sum = 0.0
    margin_weight_sum = 0.0
    price_weighted_sum = 0.0
    price_weight_sum = 0.0

    obligor_mv: Dict[str, float] = {}
    obligor_name: Dict[str, str] = {}
    
    sector_mv: Dict[str, float] = {}
    sector_obl: Dict[str, set] = {}

    bucket_mv: Dict[str, float] = {}
    bucket_obl: Dict[str, set] = {}

    for p in valid:
        par = p["par_usd"]
        total_par += par
        
        price = p.get("price")
        p_mv = par * price / 100.0 if is_finite_number(price) and price > 0 else float(par)
        total_nav += p_mv

        k = _obligor_key(p)
        obligor_mv[k] = obligor_mv.get(k, 0.0) + p_mv
        obligor_name.setdefault(k, str(p.get("borrower_name") or p.get("ticker") or k))

        s = str(p.get("sector") or "Unclassified")
        sector_mv[s] = sector_mv.get(s, 0.0) + p_mv
        sector_obl.setdefault(s, set()).add(k)

        idx = rating_index(p.get("rating_moody"), p.get("rating_sp"), p.get("rating_fitch"))
        b = rating_bucket(idx)
        bucket_mv[b] = bucket_mv.get(b, 0.0) + p_mv
        bucket_obl.setdefault(b, set()).add(k)
        if idx is not None:
            warf_num += FACTORS[idx] * p_mv
            warf_den += p_mv

        margin = p.get("margin_bps")
        if is_finite_number(margin):
            margin_weighted_sum += margin * p_mv
            margin_weight_sum += p_mv

        if is_finite_number(price):
            price_weighted_sum += price * p_mv
            price_weight_sum += p_mv

        if _is_first_lien(p.get("ranking")):
            first_lien_mv += p_mv

    sectors = [
        {"sector": s, "mv": round(v, 2), "pct_nav": _pct(v, total_nav),
         "n_obligors": len(sector_obl[s])}
        for s, v in sorted(sector_mv.items(), key=lambda kv: kv[1], reverse=True)
    ]

    rating_dist = [
        {"bucket": b, "mv": round(bucket_mv[b], 2), "pct_nav": _pct(bucket_mv[b], total_nav),
         "n_obligors": len(bucket_obl[b])}
        for b in _BUCKET_ORDER if b in bucket_mv
    ]

    warf = round(warf_num / warf_den, 0) if warf_den > 0 else None
    wa_margin = round(margin_weighted_sum / margin_weight_sum, 3) if margin_weight_sum > 0 else None
    wa_price = round(price_weighted_sum / price_weight_sum, 3) if price_weight_sum > 0 else None

    top_obl = sorted(obligor_mv.items(), key=lambda kv: kv[1], reverse=True)
    top10 = [{"obligor": obligor_name[k], "mv": round(v, 2), "pct_nav": _pct(v, total_nav)}
             for k, v in top_obl[:10]]
    single = top_obl[0] if top_obl else None

    return {
        "n_positions": len(valid),
        "n_obligors": len(obligor_mv),
        "n_sectors": len(sector_mv),
        "total_par": round(total_par, 2),
        "total_nav": round(total_nav, 2),
        "sectors": sectors,
        "rating_dist": rating_dist,
        "top10": top10,
        "top10_pct_nav": _pct(sum(v for _k, v in top_obl[:10]), total_nav),
        "wa_rating": rating_bucket(_nearest_rating_idx(warf)) if warf is not None else None,
        "warf": warf,
        "wa_margin": wa_margin,
        "wa_price": wa_price,
        "first_lien_pct": _pct(first_lien_mv, total_nav),
        "single_name_max": ({"obligor": obligor_name[single[0]], "pct_nav": _pct(single[1], total_nav)}
                             if single else None),
    }


def _wavg(pairs: List[Any]) -> Optional[float]:
    """MV-weighted average of finite (value, weight) pairs; None if no finite weight."""
    num = den = 0.0
    for value, weight in pairs:
        if is_finite_number(value) and is_finite_number(weight) and weight > 0:
            num += value * weight
            den += weight
    return round(num / den, 3) if den > 0 else None


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
    of the limit magnitude. Unknown current or limit → 'Info' (not computed)."""
    if not is_finite_number(current) or not is_finite_number(limit_value):
        return "Info"
    band = max(0.2, abs(limit_value) * 0.10)
    if op == ">=":
        if current < limit_value:
            return "Breach"
        return "Watch" if current - limit_value < band else "Pass"
    # default / "<=" : a maximum
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
            headroom = round((limit_value - current) if op != ">=" else (current - limit_value), 2)
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
