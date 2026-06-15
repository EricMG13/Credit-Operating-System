"""Loan Scorecard — a transparent, deterministic documentation-protection score.

A CAOS-native implementation of the Covenant-Review-style "Composite Score"
(Model 2.0): a 1 → 5 read of how well a credit agreement protects lenders, where
**1 is most protective and 5 is seriously deficient** (higher = looser = more
borrower-favorable). It rolls up:

  - **6 Quality Scores** — qualitative document categories: EBITDA-adjustment
    definition, builder basket, amendments, mandatory prepayments, reporting,
    ratio-calculation & basket flexibility.
  - **5 Sub-Scores** — collateral protection, default protection, lenders'
    repricing optionality, value leakage, reporting protection.
  - **Composite** — a weighted roll-up of the sub-scores (collateral most heavily
    weighted, mirroring the methodology's emphasis on recovery value).

Like [distress.py], this is a *transparent* score, not a black box: every score
carries the input drivers that produced it, on a fixed scale, computed by pure
functions over the deal's terms — so the surface can show its work and the QA
gate can audit it.

**The methodology fallback (the key behavior).** When a covenant-review document
has been extracted, the rich qualitative/narrative terms drive the quality scores
at high confidence (``basis = "covenant_review"``). When one has *not* been
provided, the scorecard still computes from the empirical signals CAOS already
derives — collateral package (1L/2L), cov-lite, leverage, MFN cap, day-one
capacity, ECF sweep — via the same deterministic mappings, each flagged
``basis = "methodology"`` with reduced confidence. A score is never fabricated:
a category with no usable input reports ``Insufficient Information`` rather than a
made-up number. See docs/SCORECARD_SCHEMA.md.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Mapping, Optional

# ── Scale ────────────────────────────────────────────────────────────────────
# 1 = most protective for lenders … 5 = seriously deficient. Bands pair the
# number with a label so meaning is never carried by color/position alone (a11y).
SCORE_MIN, SCORE_MAX = 1.0, 5.0
_BANDS = (
    (1.8, "Strongly protective"),
    (2.6, "Protective"),
    (3.4, "Balanced"),
    (4.2, "Weak"),
    (5.01, "Deficient"),
)

# Composite weights — collateral most heavily weighted (recovery value is the
# paramount purpose of the agreement); sum to 1.0.
SUBSCORE_WEIGHTS: dict[str, float] = {
    "collateral_protection": 0.30,
    "default_protection": 0.25,
    "lenders_repricing_optionality": 0.20,
    "value_leakage": 0.15,
    "reporting_protection": 0.10,
}

# Confidence ladder (mirrors the engine vocabulary used elsewhere).
_HIGH, _MOD, _LOW, _NONE = "High", "Moderate", "Low", "Insufficient Information"
_CONF_RANK = {_NONE: 0, _LOW: 1, _MOD: 2, _HIGH: 3}
_CONF_BY_RANK = {v: k for k, v in _CONF_RANK.items()}


def band_for(value: float) -> str:
    for cutoff, label in _BANDS:
        if value < cutoff:
            return label
    return "Deficient"


def _clamp(v: float) -> float:
    return max(SCORE_MIN, min(SCORE_MAX, v))


# ── Inputs ───────────────────────────────────────────────────────────────────
@dataclass(frozen=True)
class TermValue:
    """One deal term as the scorer sees it — a thin view over ``DealTerm`` so the
    engine stays decoupled from the ORM and is trivially unit-testable."""

    num: Optional[float] = None
    text: Optional[str] = None
    confidence: str = _NONE
    doc_grounded: bool = False  # extracted from a covenant-review document (vs seed/empirical)

    @property
    def present(self) -> bool:
        return self.num is not None or (self.text is not None and self.text not in ("", "—"))


# ── Outputs ──────────────────────────────────────────────────────────────────
@dataclass
class Driver:
    label: str
    detail: str
    contribution: Optional[float] = None  # the 1–5 value this input pushed toward


@dataclass
class ScoreResult:
    key: str
    label: str
    value: Optional[float]          # 1–5, or None when Insufficient Information
    band: Optional[str]
    confidence: str
    basis: str                      # "covenant_review" | "methodology" | "none"
    drivers: List[Driver] = field(default_factory=list)


@dataclass
class Scorecard:
    composite: ScoreResult
    sub_scores: List[ScoreResult]
    quality_scores: List[ScoreResult]
    basis: str                      # overall: "covenant_review" | "methodology" | "mixed" | "none"
    limitation_flags: List[str] = field(default_factory=list)


# ── Mapping helpers ──────────────────────────────────────────────────────────
def _looser_high(v: float, lo: float, hi: float) -> float:
    """Map an empirical value to 1–5 where MORE (toward ``hi``) is looser/worse
    for lenders (→ 5). Linear, clamped."""
    if hi == lo:
        return 3.0
    return _clamp(1.0 + 4.0 * (v - lo) / (hi - lo))


def _looser_low(v: float, lo: float, hi: float) -> float:
    """Inverse of :func:`_looser_high` — LESS is looser/worse (e.g. a small ECF
    sweep keeps more cash with the borrower)."""
    return _looser_high(-v, -hi, -lo)


def _uncapped(text: Optional[str]) -> bool:
    return bool(text) and "uncap" in text.lower()


def _is_yes(tv: Optional[TermValue]) -> bool:
    if tv is None:
        return False
    if tv.num is not None:
        return tv.num >= 1
    return bool(tv.text) and tv.text.strip().lower() in ("yes", "true", "y")


def _combine(
    key: str,
    label: str,
    contributions: List[tuple[float, str, Driver]],  # (value, confidence, driver)
) -> ScoreResult:
    """Average the present contributions into a score; roll confidence down to the
    weakest present input; basis is doc-grounded only if every present input was."""
    present = [(v, c, d) for (v, c, d) in contributions if v is not None]
    drivers = [d for (_, _, d) in contributions]
    if not present:
        return ScoreResult(key, label, None, None, _NONE, "none", drivers)
    value = round(_clamp(sum(v for v, _, _ in present) / len(present)), 2)
    conf_rank = min(_CONF_RANK.get(c, 0) for _, c, _ in present)
    confidence = _CONF_BY_RANK[max(conf_rank, 1)]
    return ScoreResult(key, label, value, band_for(value), confidence, "scored", drivers)


# ── Quality scores (6) ───────────────────────────────────────────────────────
def _q_ebitda_adjustment(t: Mapping[str, TermValue]) -> ScoreResult:
    c: List[tuple[float, str, Driver]] = []
    syn = t.get("synergies_cost_savings_cap")
    if syn and syn.present:
        v = 5.0 if _uncapped(syn.text) else 2.0
        c.append((v, _HIGH if syn.doc_grounded else _MOD,
                  Driver("Synergies / cost-savings cap", syn.text or "", v)))
    rest = t.get("restructuring_business_optimization")
    if rest and rest.present:
        v = 4.5 if _uncapped(rest.text) else 2.5
        c.append((v, _HIGH if rest.doc_grounded else _MOD,
                  Driver("Restructuring / business optimization add-back", rest.text or "", v)))
    win = t.get("realized_action_window_months")
    if win and win.num is not None:
        v = _looser_high(win.num, 12, 36)
        c.append((v, _HIGH if win.doc_grounded else _MOD,
                  Driver("Realized-action window (months)", f"{win.num:g}mo", v)))
    return _combine("ebitda_adjustment_definition", "EBITDA Adjustment Definition", c)


def _q_builder_basket(t: Mapping[str, TermValue]) -> ScoreResult:
    c: List[tuple[float, str, Driver]] = []
    base = t.get("starter_base_amount_musd")
    if base and base.num is not None:
        v = _looser_high(base.num, 0, 500)
        c.append((v, _HIGH if base.doc_grounded else _MOD,
                  Driver("Starter base amount", f"${base.num:g}M", v)))
    grow = t.get("starter_grower_pct")
    if grow and grow.num is not None:
        v = _looser_high(grow.num, 0, 75)
        c.append((v, _HIGH if grow.doc_grounded else _MOD,
                  Driver("Starter grower", f"{grow.num:g}% EBITDA", v)))
    unswept = t.get("builds_from_unswept_asset_sale_proceeds")
    if unswept and unswept.present:
        v = 4.0 if (unswept.text or "").lower().startswith(("yes", "from")) else 2.0
        c.append((v, _HIGH if unswept.doc_grounded else _LOW,
                  Driver("Builds from unswept asset-sale proceeds", unswept.text or "", v)))
    return _combine("builder_basket", "Builder Basket", c)


def _q_amendments(t: Mapping[str, TermValue]) -> ScoreResult:
    c: List[tuple[float, str, Driver]] = []
    reclass = t.get("reclassification")
    if reclass and reclass.present:
        v = 4.0 if _is_yes(reclass) else 2.0
        c.append((v, _HIGH if reclass.doc_grounded else _LOW,
                  Driver("Basket reclassification permitted", "Yes" if _is_yes(reclass) else "No", v)))
    mfn = t.get("mfn_hard_cap_musd")
    incurs = t.get("free_clear_incurs_mfn")
    if incurs and incurs.present:
        v = 2.0 if _is_yes(incurs) else 4.0  # free & clear that escapes MFN protection is looser
        c.append((v, _HIGH if incurs.doc_grounded else _MOD,
                  Driver("Free & clear incurs MFN protection", "Yes" if _is_yes(incurs) else "No", v)))
    if mfn and mfn.num is not None:
        v = _looser_high(mfn.num, 0, 1000)
        c.append((v, _HIGH if mfn.doc_grounded else _MOD,
                  Driver("MFN hard cap", f"${mfn.num:g}M", v)))
    return _combine("amendments", "Amendments", c)


def _q_mandatory_prepayments(t: Mapping[str, TermValue]) -> ScoreResult:
    c: List[tuple[float, str, Driver]] = []
    ecf = t.get("ecf_sweep_initial_pct")
    if ecf and ecf.num is not None:
        v = _looser_low(ecf.num, 0, 75)  # smaller sweep = more cash retained = looser
        c.append((v, _HIGH if ecf.doc_grounded else _MOD,
                  Driver("ECF sweep (initial)", f"{ecf.num:g}%", v)))
    step = t.get("asset_sales_stepdown")
    if step and step.present:
        v = 3.5 if _is_yes(step) else 2.5
        c.append((v, _HIGH if step.doc_grounded else _LOW,
                  Driver("Asset-sale sweep step-down", "Yes" if _is_yes(step) else "No", v)))
    reinv = t.get("asset_sales_reinvestment_period_months")
    if reinv and reinv.num is not None:
        v = _looser_high(reinv.num, 0, 24)
        c.append((v, _HIGH if reinv.doc_grounded else _MOD,
                  Driver("Asset-sale reinvestment period", f"{reinv.num:g}mo", v)))
    return _combine("mandatory_prepayments", "Mandatory Prepayments", c)


def _q_reporting(t: Mapping[str, TermValue]) -> ScoreResult:
    # Reporting terms aren't richly catalogued yet — this is the score most
    # dependent on a covenant-review document. Without a reporting term we report
    # Insufficient Information rather than invent a number (the scorecard flags
    # the gap), so it simply drops out of the composite renormalisation.
    c: List[tuple[float, str, Driver]] = []
    rep = t.get("reporting_requirements")  # forward-compat catalog key
    if rep and rep.present:
        v = 4.0 if _uncapped(rep.text) else 2.5
        c.append((v, _HIGH if rep.doc_grounded else _MOD,
                  Driver("Reporting requirements", rep.text or "", v)))
    return _combine("reporting", "Reporting", c)


def _q_ratio_calc_flexibility(t: Mapping[str, TermValue]) -> ScoreResult:
    c: List[tuple[float, str, Driver]] = []
    lvl = t.get("free_clear_ratio_level_1")
    if lvl and lvl.num is not None:
        v = _looser_high(lvl.num, 3.0, 7.0)
        c.append((v, _HIGH if lvl.doc_grounded else _MOD,
                  Driver("Free & clear ratio level", f"{lvl.num:g}x", v)))
    grow = t.get("free_clear_grower_pct")
    if grow and grow.num is not None:
        v = _looser_high(grow.num, 50, 125)
        c.append((v, _HIGH if grow.doc_grounded else _MOD,
                  Driver("Free & clear grower", f"{grow.num:g}%", v)))
    gbg = t.get("gbg_restricted_payments_pct")
    if gbg and gbg.num is not None:
        v = _looser_high(gbg.num, 0, 100)
        c.append((v, _HIGH if gbg.doc_grounded else _MOD,
                  Driver("General-basket grower (RP)", f"{gbg.num:g}%", v)))
    return _combine("ratio_calc_basket_flexibility", "Ratio Calc & Basket Flexibility", c)


def _quality_scores(t: Mapping[str, TermValue]) -> List[ScoreResult]:
    return [
        _q_ebitda_adjustment(t), _q_builder_basket(t), _q_amendments(t),
        _q_mandatory_prepayments(t), _q_reporting(t), _q_ratio_calc_flexibility(t),
    ]


# ── Seniority detection (drives collateral protection) ───────────────────────
def detect_seniority(label: str, t: Mapping[str, TermValue]) -> Optional[str]:
    """Best-effort 1L/2L read from the deal label or its collateral narrative.
    Returns "1L", "2L", or None (unknown)."""
    hay = " ".join([
        label or "",
        (t.get("collateral").text or "") if t.get("collateral") else "",
        (t.get("facilities").text or "") if t.get("facilities") else "",
    ]).lower()
    if any(k in hay for k in ("second lien", "second-lien", "2l", "2nd lien", "senior secured second")):
        return "2L"
    if any(k in hay for k in ("first lien", "first-lien", "1l", "1st lien", "senior secured first", "senior secured term loan")):
        return "1L"
    return None


# ── Sub-scores (5) ───────────────────────────────────────────────────────────
def _s_collateral(t: Mapping[str, TermValue], seniority: Optional[str], q: dict[str, ScoreResult]) -> ScoreResult:
    c: List[tuple[float, str, Driver]] = []
    if seniority == "1L":
        c.append((2.0, _MOD, Driver("Collateral package", "First-lien senior secured", 2.0)))
    elif seniority == "2L":
        c.append((3.5, _MOD, Driver("Collateral package", "Second-lien — structurally junior recovery", 3.5)))
    # Unknown seniority contributes nothing (no fabricated baseline); the scorecard
    # surfaces a "seniority not determined" limitation flag instead.
    inv = t.get("d1_unrestricted_sub_investments_musd")
    if inv and inv.num is not None:
        v = _looser_high(inv.num, 0, 600)  # capacity to move assets to unrestricted subs (J.Crew-style leakage)
        c.append((v, _HIGH if inv.doc_grounded else _MOD,
                  Driver("Day-one unrestricted-sub investment capacity", f"${inv.num:g}M", v)))
    rc = q.get("ratio_calc_basket_flexibility")
    if rc and rc.value is not None:
        c.append((rc.value, rc.confidence, Driver("Ratio calc & basket flexibility (quality)", rc.band or "", rc.value)))
    return _combine("collateral_protection", "Collateral Protection", c)


def _s_default(t: Mapping[str, TermValue], q: dict[str, ScoreResult]) -> ScoreResult:
    c: List[tuple[float, str, Driver]] = []
    cov = t.get("cov_lite")
    if cov and cov.present:
        v = 4.5 if _is_yes(cov) else 2.0
        c.append((v, _HIGH if cov.doc_grounded else _MOD,
                  Driver("Maintenance covenant", "Cov-lite (none)" if _is_yes(cov) else "Maintenance covenant present", v)))
    lev = t.get("net_first_lien_leverage_ratio")
    if lev and lev.num is not None:
        v = _looser_high(lev.num, 3.0, 8.0)
        c.append((v, _HIGH if lev.doc_grounded else _MOD,
                  Driver("Net first-lien leverage covenant level", f"{lev.num:g}x", v)))
    spring = t.get("springing_trigger_1_initial_level")
    if spring and spring.num is not None:
        v = _looser_high(spring.num, 4.0, 9.0)
        c.append((v, _HIGH if spring.doc_grounded else _MOD,
                  Driver("Springing covenant trigger level", f"{spring.num:g}x", v)))
    am = q.get("amendments")
    if am and am.value is not None:
        c.append((am.value, am.confidence, Driver("Amendments (quality)", am.band or "", am.value)))
    return _combine("default_protection", "Default Protection", c)


def _s_repricing(t: Mapping[str, TermValue], q: dict[str, ScoreResult]) -> ScoreResult:
    c: List[tuple[float, str, Driver]] = []
    ctype = t.get("call_type")
    if ctype and ctype.present:
        low = (ctype.text or "").lower()
        v = 2.0 if ("hard" in low or "non" in low) else 3.5  # soft call = less lender optionality
        c.append((v, _HIGH if ctype.doc_grounded else _MOD,
                  Driver("Call protection type", ctype.text or "", v)))
    cterm = t.get("call_term_months")
    if cterm and cterm.num is not None:
        v = _looser_low(cterm.num, 0, 24)  # longer call protection = more lender optionality = lower score
        c.append((v, _HIGH if cterm.doc_grounded else _MOD,
                  Driver("Call protection term", f"{cterm.num:g}mo", v)))
    cov = t.get("cov_lite")
    if cov and cov.present:
        v = 4.0 if _is_yes(cov) else 2.5  # no financial covenant erodes the lever to extract value
        c.append((v, _HIGH if cov.doc_grounded else _MOD,
                  Driver("Financial-covenant lever", "Cov-lite" if _is_yes(cov) else "Maintenance covenant", v)))
    return _combine("lenders_repricing_optionality", "Lenders' Repricing Optionality", c)


def _s_value_leakage(t: Mapping[str, TermValue], q: dict[str, ScoreResult]) -> ScoreResult:
    c: List[tuple[float, str, Driver]] = []
    for qk, qlabel in (("builder_basket", "Builder basket (quality)"),
                       ("ebitda_adjustment_definition", "EBITDA adjustment (quality)")):
        qs = q.get(qk)
        if qs and qs.value is not None:
            c.append((qs.value, qs.confidence, Driver(qlabel, qs.band or "", qs.value)))
    for tk, tlabel, hi in (("d1_unrestricted_sub_investments_musd", "Day-one unrestricted-sub investments", 600.0),
                           ("d1_restricted_payments_musd", "Day-one restricted payments", 500.0)):
        tv = t.get(tk)
        if tv and tv.num is not None:
            v = _looser_high(tv.num, 0, hi)
            c.append((v, _HIGH if tv.doc_grounded else _MOD, Driver(tlabel, f"${tv.num:g}M", v)))
    return _combine("value_leakage", "Value Leakage", c)


def _s_reporting(t: Mapping[str, TermValue], q: dict[str, ScoreResult]) -> ScoreResult:
    rep = q.get("reporting")
    c: List[tuple[float, str, Driver]] = []
    if rep and rep.value is not None:
        c.append((rep.value, rep.confidence, Driver("Reporting (quality)", rep.band or "", rep.value)))
    return _combine("reporting_protection", "Reporting Protection", c)


# ── Top-level ────────────────────────────────────────────────────────────────
def score_deal(terms: Mapping[str, TermValue], *, label: str = "") -> Scorecard:
    """Compute the full scorecard for one deal from its terms.

    ``terms`` maps ``term_key`` → :class:`TermValue`. The presence of
    document-grounded covenant terms decides the overall ``basis``; sub-scores and
    composite degrade gracefully (Insufficient Information, not fabrication) when
    inputs are missing — realising the methodology fallback when no covenant-review
    document was provided."""
    quality = _quality_scores(terms)
    qmap = {q.key: q for q in quality}
    seniority = detect_seniority(label, terms)

    subs = [
        _s_collateral(terms, seniority, qmap),
        _s_default(terms, qmap),
        _s_repricing(terms, qmap),
        _s_value_leakage(terms, qmap),
        _s_reporting(terms, qmap),
    ]

    # Overall basis: doc-grounded if any covenant term was extracted from a
    # document; methodology if we scored purely off empirical/seed signals.
    any_doc = any(tv.doc_grounded and tv.present for tv in terms.values())
    any_scored = any(s.value is not None for s in subs)
    overall_basis = "none" if not any_scored else ("covenant_review" if any_doc else "methodology")
    for s in subs + quality:
        s.basis = overall_basis if s.value is not None else "none"

    # Composite — weighted over the sub-scores that produced a value; renormalise
    # the weights across the present sub-scores so a missing one doesn't drag it.
    weighted = [(SUBSCORE_WEIGHTS[s.key], s) for s in subs if s.value is not None]
    if weighted:
        wsum = sum(w for w, _ in weighted)
        cval = round(_clamp(sum(w * s.value for w, s in weighted) / wsum), 2)
        cconf = _CONF_BY_RANK[max(1, min(_CONF_RANK.get(s.confidence, 0) for _, s in weighted))]
        composite = ScoreResult(
            "composite", "Composite", cval, band_for(cval), cconf, overall_basis,
            drivers=[Driver(s.label, s.band or "", s.value) for _, s in weighted],
        )
    else:
        composite = ScoreResult("composite", "Composite", None, None, _NONE, "none", [])

    flags: List[str] = []
    if overall_basis == "methodology":
        flags.append("No covenant-review document — scored from empirical signals via the methodology; "
                     "confidence reduced and qualitative categories approximated.")
    if seniority is None and any_scored:
        flags.append("Collateral seniority (1L/2L) not determined from available terms.")

    return Scorecard(composite=composite, sub_scores=subs, quality_scores=quality,
                     basis=overall_basis, limitation_flags=flags)
