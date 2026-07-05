"""CP-6A / CP-6E adversarial debate — the L6 challenge layer.

Mirrors the council.py ensemble pattern, but produces an *analytical payload* (a
``ModulePayload``), not gate findings: a panel of adversarial advocates argues
over the already-produced upstream outputs, and a **deterministic** chair weighs
their points into a verdict. The chair is code, never an LLM — synthesis must be
reproducible and must never soften the evidence (same rule as council's ``_merge``).

Two layers, mirroring the demo-mode duality elsewhere in the engine:

  - The structured debate is built deterministically from real upstream signals
    (leverage, earnings deltas, peer standing, covenant headroom/structure). It
    runs for any issuer with no LLM, so the module is exhaustively testable
    offline and every point traces to an upstream artifact.
  - When ``debate_enabled`` and a key are set, ``LiveDebater`` fans out one call
    per advocate seat (concurrent, budget-guarded, untrusted-data-safe) to author
    the *narrative* for each side. The structured points and the chair verdict
    stay deterministic; the LLM only adds colour, and a failed call or an
    exhausted budget falls back to the deterministic prose.

CP-6A debates the credit (Bull vs Bear, IC Chair verdict). CP-6E debates the
position (RV Trader vs Compliance, CIO sizing posture) over CP-6A's verdict.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from config import get_settings
from engine import budget, llm_client, presets
from engine.llm_safety import UNTRUSTED_RULE, wrap_untrusted
from engine.schemas import ClaimSpec, EvidenceSpec, ModulePayload

logger = logging.getLogger("caos.engine")

# Net score (sum of bull point weights − bear point weights) at/above which the
# chair leans one way; between the two it stays balanced.
_LEAN_THRESHOLD = 2


@dataclass
class Point:
    """One debate point, derived deterministically from an upstream output.

    ``weight`` (1 minor / 2 material / 3 major) is what the chair tallies — the
    debate's verdict is a reproducible function of these weights, not a judgement.
    """

    text: str
    source: str  # the upstream module_id this point derives from
    weight: int


@dataclass(frozen=True)
class _Spec:
    bull: str
    bear: str
    chair: str


# Per-module advocate roster. The "bull" seat argues to own the credit / add the
# position; the "bear" seat argues the downside / for restraint.
_SPECS: Dict[str, _Spec] = {
    "CP-6A": _Spec("Bull Advocate", "Bear Advocate", "IC Chair"),
    "CP-6E": _Spec("RV Trader", "Compliance", "CIO"),
}

_LENS: Dict[str, str] = {
    "Bull Advocate": "Make the strongest constructive credit case the evidence supports.",
    "Bear Advocate": "Argue the bear case: every risk and downside the analysis surfaced.",
    "RV Trader": "Argue to add the position on relative value and credit conviction.",
    "Compliance": "Argue for restraint: structural protection, downside, and prudent sizing.",
}


# ── Deterministic signal extraction ──────────────────────────────────────────

def _leverage(cp1: Optional[ModulePayload]) -> Optional[float]:
    if cp1 is None:
        return None
    nf = (cp1.runtime_output or {}).get("normalized_financials") or {}
    lev = nf.get("net_leverage_adj_ltm")
    return float(lev) if isinstance(lev, (int, float)) else None


def _ic_signals(up: Dict[str, ModulePayload]) -> Tuple[List[Point], List[Point]]:  # noqa: C901
    """Bull/bear points for the CP-6A credit debate, from the wired upstreams.

    CP-1 / CP-2 / CP-4C are the module's declared deps (always present when it
    runs); CP-1B / CP-1C are read opportunistically — the debate degrades to
    fewer points rather than blocking when they were not produced.
    """
    bull: List[Point] = []
    bear: List[Point] = []

    lev = _leverage(up.get("CP-1"))
    if lev is not None:
        if lev >= 6.0:
            bear.append(Point(f"Leverage is high at {lev:g}x net — little margin for error.", "CP-1", 3))
        elif lev >= 5.0:
            bear.append(Point(f"Leverage is elevated at {lev:g}x net.", "CP-1", 2))
        elif lev <= 4.0:
            bull.append(Point(f"Leverage is moderate at {lev:g}x net — room to delever.", "CP-1", 2))
        else:
            bull.append(Point(f"Leverage is manageable at {lev:g}x net.", "CP-1", 1))

    cp1b = up.get("CP-1B")
    if cp1b is not None:
        rt = cp1b.runtime_output or {}
        eg = (rt.get("summary") or {}).get("ebitda_growth_pct")
        if isinstance(eg, (int, float)) and eg > 0:
            bull.append(Point(f"Adjusted EBITDA grew {eg:g}% YoY.", "CP-1B", 1))
        for sig in rt.get("monitoring_signals") or []:
            bear.append(Point(str(sig), "CP-1B", 2))

    cp1c = up.get("CP-1C")
    if cp1c is not None:
        rt = cp1c.runtime_output or {}
        outliers = rt.get("outlier_metrics") or []
        scope = rt.get("peer_scope", "peers")
        if outliers:
            bear.append(Point(f"Bottom-quartile vs {scope} on {', '.join(map(str, outliers))}.", "CP-1C", 2))
        elif rt.get("comparisons"):
            bull.append(Point(f"In line with or ahead of {scope} on the benchmarked metrics.", "CP-1C", 1))

    cp4c = up.get("CP-4C")
    if cp4c is not None:
        rt = cp4c.runtime_output or {}
        if rt.get("covenant_structure") == "cov-lite":
            bear.append(Point("Cov-lite structure — no maintenance covenant to trip early.", "CP-4C", 2))
        for calc in rt.get("calculations") or []:
            if "headroom" in str(calc.get("name", "")).lower() and isinstance(calc.get("value"), (int, float)):
                hr = calc["value"]
                if hr >= 1.0:
                    bull.append(Point(f"{hr:g} turns of covenant headroom.", "CP-4C", 1))
                else:
                    bear.append(Point(f"Thin covenant headroom: {hr:g} turns to a breach.", "CP-4C", 2))

    cp2b = up.get("CP-2B")
    if cp2b is not None:
        frag = (cp2b.runtime_output or {}).get("fragility")
        if frag == "HIGH":
            bear.append(Point("Downside fragility HIGH — a modest EBITDA decline breaches distress leverage.", "CP-2B", 3))
        elif frag == "MODERATE":
            bear.append(Point("Downside fragility MODERATE under EBITDA stress.", "CP-2B", 1))
        elif frag == "LOW":
            bull.append(Point("Leverage is resilient to a 30% EBITDA decline.", "CP-2B", 1))

    cp3 = up.get("CP-3")
    if cp3 is not None:
        rec = (cp3.runtime_output or {}).get("recommendation")
        if rec == "OVERWEIGHT":
            bull.append(Point("Strong fundamentals vs peers (top-tier composite percentile).", "CP-3", 2))
        elif rec == "UNDERWEIGHT":
            bear.append(Point("Weak fundamentals vs peers (bottom-tier composite percentile).", "CP-3", 2))

    cp4 = up.get("CP-4")
    if cp4 is not None:
        score = (cp4.runtime_output or {}).get("aggressiveness_score")
        if isinstance(score, (int, float)) and score >= 6:
            bear.append(Point(f"Aggressive covenant package ({score}/10) — weak creditor protection.", "CP-4", 2))

    cp2d = up.get("CP-2D")
    if cp2d is not None:
        gscore = (cp2d.runtime_output or {}).get("governance_risk_score")
        if isinstance(gscore, (int, float)) and gscore >= 2:
            bear.append(Point(f"Sponsor-governance risk ({gscore}/10) — distributions/control flags.", "CP-2D", 2))

    cp2f = up.get("CP-2F")
    if cp2f is not None:
        scn = (cp2f.runtime_output or {}).get("scenarios") or []
        # Require BOTH fields the point interpolates, so a malformed/shape-shifted
        # CP-2F scenario can't KeyError on rate_shock_bps. (review run-2 #B8)
        worst = next((s for s in reversed(scn)
                      if isinstance(s.get("stressed_interest_coverage"), (int, float))
                      and isinstance(s.get("rate_shock_bps"), (int, float))), None)
        if worst and worst["stressed_interest_coverage"] < 1.5:
            bear.append(Point(
                f"Rate-sensitive: +{worst['rate_shock_bps']}bps cuts coverage to "
                f"{worst['stressed_interest_coverage']:g}x (unhedged).", "CP-2F", 2))

    cp3d = up.get("CP-3D")
    if cp3d is not None:
        band = (cp3d.runtime_output or {}).get("lme_vulnerability_band")
        if band == "HIGH":
            bear.append(Point("HIGH refinancing/LME vulnerability — exposed to coercive liability management.", "CP-3D", 2))
        elif band == "LOW":
            bull.append(Point("Low refinancing/LME vulnerability.", "CP-3D", 1))

    # CP-3C portfolio concentration (only present when the run is portfolio-bound).
    cp3c = up.get("CP-3C")
    if cp3c is not None:
        conc = (cp3c.runtime_output or {}).get("concentration") or {}
        risk = conc.get("concentration_risk")
        held = conc.get("held_pct_nav")
        if risk == "HIGH":
            bear.append(Point(
                f"Portfolio concentration HIGH — name is {held}% of NAV, near/over a book limit.", "CP-3C", 2))
        elif risk == "MODERATE":
            bear.append(Point(
                f"Portfolio concentration MODERATE — {held}% of NAV, limited room to add.", "CP-3C", 1))
        elif risk == "LOW" and conc.get("in_portfolio"):
            bull.append(Point("Comfortable portfolio headroom to add or hold the name.", "CP-3C", 1))

    return bull, bear


def _portfolio_signals(up: Dict[str, ModulePayload]) -> Tuple[List[Point], List[Point]]:
    """Bull/bear points for the CP-6E sizing debate, anchored on CP-6A's verdict."""
    bull: List[Point] = []
    bear: List[Point] = []

    cp6a = up.get("CP-6A")
    lean = ((cp6a.runtime_output or {}).get("verdict") or {}).get("lean") if cp6a else None
    if lean == "CONSTRUCTIVE":
        bull.append(Point("IC credit verdict is constructive.", "CP-6A", 2))
    elif lean == "CAUTIOUS":
        bear.append(Point("IC credit verdict is cautious.", "CP-6A", 2))
    elif lean == "BALANCED":
        bear.append(Point("IC credit verdict is balanced — no strong conviction either way.", "CP-6A", 1))

    cp4c = up.get("CP-4C")
    if cp4c is not None and (cp4c.runtime_output or {}).get("covenant_structure") == "cov-lite":
        bear.append(Point("Cov-lite docs — weak structural protection caps prudent size.", "CP-4C", 2))

    return bull, bear


# ── Deterministic chair ──────────────────────────────────────────────────────

def _net(bull: List[Point], bear: List[Point]) -> int:
    return sum(p.weight for p in bull) - sum(p.weight for p in bear)


def _ic_verdict(bull: List[Point], bear: List[Point]) -> dict:
    net = _net(bull, bear)
    lean = ("CONSTRUCTIVE" if net >= _LEAN_THRESHOLD
            else "CAUTIOUS" if net <= -_LEAN_THRESHOLD else "BALANCED")
    top_bear = max(bear, key=lambda p: p.weight, default=None)
    return {
        "lean": lean,
        "net_score": net,
        "greatest_uncertainty": top_bear.text if top_bear else "No material bear point raised.",
    }


def _sizing_verdict(bull: List[Point], bear: List[Point]) -> dict:
    net = _net(bull, bear)
    if net >= _LEAN_THRESHOLD:
        posture = "Add — constructive entry, size toward target."
    elif net <= -_LEAN_THRESHOLD:
        posture = "Pass / minimal — risk-reward does not support a position."
    else:
        posture = "Add-on-weakness — modest initial size, scale on a better entry."
    return {"sizing_posture": posture, "net_score": net}


# ── Narration (the council.py fixture/live duality) ──────────────────────────

def _prose(advocate: str, points: List[Point]) -> str:
    if not points:
        return f"{advocate}: no material points on this side from the available analysis."
    return f"{advocate}: " + " ".join(p.text for p in points)


class FixtureDebater:
    """Deterministic prose — the engine runs identically without an LLM."""

    name = "fixture"

    async def narrate(self, advocate: str, lens: str, points: List[Point],
                      upstream: Dict[str, ModulePayload]) -> str:
        return _prose(advocate, points)


class LiveDebater:
    name = "live"

    def __init__(self) -> None:
        self._settings = get_settings()
        self._client = None

    def _get_client(self):
        if self._client is None:
            import anthropic

            self._client = anthropic.AsyncAnthropic(
                api_key=self._settings.anthropic_api_key,
                timeout=self._settings.caos_llm_timeout_s,
            )
        return self._client

    async def narrate(self, advocate: str, lens: str, points: List[Point],
                      upstream: Dict[str, ModulePayload]) -> str:
        # No points to argue, or the analytical modules already spent the budget:
        # fall back to deterministic prose rather than overspend / argue nothing.
        if not points or not budget.llm_allowed():
            return _prose(advocate, points)
        system = (
            f"You are the {advocate} on a credit investment committee. {lens} Argue "
            "your side in 2-3 sentences, grounded ONLY in the structured points and "
            "upstream payloads provided. Never invent figures. " + UNTRUSTED_RULE
        )
        user = (
            "YOUR POINTS:\n" + "\n".join(f"- {p.text} [{p.source}]" for p in points)
            + "\n\nUPSTREAM OUTPUTS:\n"
            + wrap_untrusted(json.dumps({m: p.runtime_output for m, p in upstream.items()}, default=str))
        )
        try:
            resp = await llm_client.create(
                self._get_client(),
                lane=f"debate:{advocate}",
                model=presets.model_for(presets.HEAVY),
                effort=presets.effort_for(presets.HEAVY),
                max_tokens=512,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            text = next((b.text for b in resp.content if b.type == "text"), "").strip()
            return text or _prose(advocate, points)
        except Exception as e:  # one seat failing must never block the module
            logger.warning("debate narration (%s) failed: %s", advocate, e)
            return _prose(advocate, points)


def get_debater():
    """Live only when the debate is enabled and a key is set; else deterministic."""
    s = get_settings()
    if s.debate_enabled and s.anthropic_api_key:
        return LiveDebater()
    return FixtureDebater()


# ── Payload assembly ─────────────────────────────────────────────────────────

def _claim(claim_id: str, text: str, points: List[Point]) -> ClaimSpec:
    """One claim evidenced to each distinct upstream module a point derives from.

    extraction_type ``upstream_artifact`` + lineage_class ``Calculated`` keeps the
    lineage clean (CP-5B raises no finding) — the points ARE calculated from gated
    upstream outputs, not fresh source reads.
    """
    evidence: List[EvidenceSpec] = []
    for src in dict.fromkeys(p.source for p in points):  # distinct, order-preserving
        evidence.append(EvidenceSpec(
            evidence_id=f"E-{claim_id[2:]}-{src}",
            extraction_type="upstream_artifact", lineage_class="Calculated",
            source_locator=f"Derived from {src} output", confidence="High",
        ))
    return ClaimSpec(claim_id=claim_id, claim_text=text, evidence=evidence)


async def synthesize_debate(module_id: str, upstream: Dict[str, ModulePayload]) -> ModulePayload:
    """Build the CP-6A / CP-6E debate payload from the upstream analytical outputs."""
    spec = _SPECS[module_id]
    if module_id == "CP-6A":
        bull, bear = _ic_signals(upstream)
        verdict = _ic_verdict(bull, bear)
        name, owned = "ICDebateChallenge", "ic_debate_challenge"
        consumers = ["CP-6E", "CP-RENDER", "CP-EXTRACT"]
        headline = verdict["lean"]
    else:  # CP-6E
        bull, bear = _portfolio_signals(upstream)
        verdict = _sizing_verdict(bull, bear)
        name, owned = "PortfolioDebateChallenge", "portfolio_debate_challenge"
        consumers = ["CP-RENDER", "CP-EXTRACT"]
        headline = verdict["sizing_posture"]

    debater = get_debater()
    bull_narr, bear_narr = await asyncio.gather(
        debater.narrate(spec.bull, _LENS[spec.bull], bull, upstream),
        debater.narrate(spec.bear, _LENS[spec.bear], bear, upstream),
    )

    runtime_output = {
        "participants": {"bull": spec.bull, "bear": spec.bear, "chair": spec.chair},
        "bull_case": {
            "advocate": spec.bull, "narrative": bull_narr,
            "points": [{"point": p.text, "source": p.source, "weight": p.weight} for p in bull],
        },
        "bear_case": {
            "advocate": spec.bear, "narrative": bear_narr,
            "points": [{"point": p.text, "source": p.source, "weight": p.weight} for p in bear],
        },
        "verdict": {**verdict, "chair": spec.chair},
    }

    claims: List[ClaimSpec] = []
    if bull:
        claims.append(_claim("C-BULL", _prose(spec.bull, bull), bull))
    if bear:
        claims.append(_claim("C-BEAR", _prose(spec.bear, bear), bear))
    claims.append(ClaimSpec(
        claim_id="C-VERDICT", claim_text=f"{spec.chair} verdict: {headline}",
        evidence=[EvidenceSpec(
            "E-VERDICT", "upstream_artifact", "Calculated",
            f"Deterministic chair tally over the {module_id} debate points", "High")],
    ))

    # No upstream signals at all → the verdict is a bare neutral default; say so.
    has_signal = bool(bull or bear)
    return ModulePayload(
        module_id=module_id, module_name=name, owned_object=owned,
        runtime_output=runtime_output,
        confidence="High" if has_signal else "Low",
        limitation_flags=[] if has_signal else
            ["No upstream signals available to debate; verdict defaults to a neutral lean."],
        downstream_consumers=consumers, claims=claims,
    )
