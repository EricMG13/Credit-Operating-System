"""Natural-language scenario builder for the Model Builder's forward lens.

Translates a free-text scenario ("energy price spike", "a 200bps rate hike",
"demand recession") into a constrained set of **driver deltas** the frontend
applies to re-center the base/downside cash-flow projection. Two translators
behind one interface, mirroring the demo-mode pattern in nlquery.py / llm.py:

  - ``_demo_translate`` — deterministic keyword mapper, used when no model key is
    configured, so the canonical scenarios work fully offline.
  - ``_llm_translate`` — Claude fills the same constrained delta spec.

Deltas are in the frontend Drivers' own units (fractions): revGrowth/adjMargin/
capexPct as decimals (0.03 = 3pp), rate as a decimal (0.02 = 200bps).
"""

from __future__ import annotations

import json
import logging
import math
import re

from pydantic import BaseModel

from config import get_settings
from engine import llm_client, presets

logger = logging.getLogger("caos.scenario")

# Per-driver clamp bands (absolute delta) — keep a scenario from producing an
# absurd projection.
_BOUNDS = {
    "rev_growth_delta": (-0.15, 0.10),
    "margin_delta": (-0.10, 0.05),
    "capex_delta": (-0.05, 0.05),
    "rate_delta": (-0.03, 0.05),
}


class ScenarioSpec(BaseModel):
    rev_growth_delta: float = 0.0   # Δ annual revenue growth (0.03 = +3pp)
    margin_delta: float = 0.0       # Δ adj. EBITDA margin (−0.03 = −3pp)
    capex_delta: float = 0.0        # Δ capex % of revenue
    rate_delta: float = 0.0         # Δ blended cash rate (0.02 = +200bps)
    label: str = "Custom scenario"
    rationale: str = ""


class ScenarioError(ValueError):
    """Raised when a scenario cannot be mapped to any driver movement."""


def validate_scenario(spec: ScenarioSpec) -> ScenarioSpec:
    """Clamp each delta to its band; reject a no-op scenario."""
    for field, (lo, hi) in _BOUNDS.items():
        v = float(getattr(spec, field) or 0.0)
        if not math.isfinite(v):  # NaN/±Inf (json.loads/pydantic admit them) defeat max/min → poison the projection
            v = 0.0
        setattr(spec, field, max(lo, min(hi, v)))
    if not any(getattr(spec, f) for f in _BOUNDS):
        raise ScenarioError("no recognizable driver movement in the scenario")
    spec.label = (spec.label or "Custom scenario").strip()[:60]
    spec.rationale = (spec.rationale or "").strip()[:240]
    return spec


# ── Demo (offline) translator ────────────────────────────────────────────────
def _demo_translate(text: str) -> ScenarioSpec:  # noqa: C901  # pre-existing keyword ladder; table-drive when reworked
    t = text.lower()
    s = ScenarioSpec(label=text.strip()[:60] or "Custom scenario")
    parts: list[str] = []
    upside = any(w in t for w in (
        "growth", "expansion", "upside", "recovery", "demand surge",
        "demand recovery", "demand improves", "volume recovery", "accelerates",
    ))
    capex_bps = False
    margin_bps = False

    # explicit "+200bps" / "200 bps" rate move (sign from hike/cut wording)
    m = re.search(r"(\d+(?:\.\d+)?)\s*bps", t)
    if m:
        raw_bps = float(m.group(1))
        bps = raw_bps / 10000.0
        cut = any(w in t for w in ("cut", "ease", "easing", "lower", "fall", "relief")) or (
            "spread" in t and any(w in t for w in ("tighten", "tightens", "tighter"))
        )
        rate_context = any(w in t for w in ("rate", "rates", "spread", "spreads", "refinancing", "interest", "coupon"))
        margin_bps = any(w in t for w in ("margin", "margins", "gross margin", "ebitda margin", "compress")) and not rate_context
        capex_bps = "capex" in t and not rate_context and not margin_bps
        if margin_bps:
            s.margin_delta += -bps if cut or "compress" in t else bps
            parts.append(f"margin {'-' if cut or 'compress' in t else '+'}{int(raw_bps)}bps")
        elif capex_bps:
            s.capex_delta += -bps if cut else bps
            parts.append(f"capex {'-' if cut else '+'}{int(raw_bps)}bps of revenue")
        else:
            s.rate_delta += -bps if cut else bps
            parts.append(f"rates {'-' if cut else '+'}{int(raw_bps)}bps")
    elif any(w in t for w in ("rate hike", "higher rates", "tightening", "hawkish")):
        s.rate_delta += 0.01
        parts.append("rates +100bps")
    elif any(w in t for w in ("rate cut", "lower rates", "easing", "dovish")):
        s.rate_delta -= 0.01
        parts.append("rates -100bps")

    if any(w in t for w in ("deflation", "cost relief", "lower input cost", "raw material relief")):
        s.margin_delta += 0.02
        parts.append("margin +2pp on input-cost relief")

    if any(w in t for w in ("energy", "fuel", "gas", "oil", "commodit", "input cost", "inflation")) or (
        "power" in t and "pricing power" not in t
    ):
        s.margin_delta -= 0.03
        if "bps" not in t:
            s.rate_delta += 0.005
        parts.append("margin -3pp on input-cost inflation")

    if any(w in t for w in ("recession", "downturn", "slowdown", "destock")) or (
        any(w in t for w in ("demand", "volume")) and not upside
    ):
        s.rev_growth_delta -= 0.05
        s.margin_delta -= 0.02
        parts.append("revenue -5pp, margin -2pp on weaker demand")

    if not margin_bps and any(w in t for w in ("compress", "margin pressure", "pricing pressure", "cost pressure")):
        s.margin_delta -= 0.025
        parts.append("margin -2.5pp")

    if not capex_bps and any(w in t for w in ("capex", "capital expenditure", "investment", "growth spend")):
        s.capex_delta += 0.02
        parts.append("capex +2pp of revenue")

    if any(w in t for w in ("pricing improves", "pricing improvement", "pricing power")):
        s.margin_delta += 0.015
        parts.append("margin +1.5pp on better pricing")

    if upside and s.rev_growth_delta == 0:
        s.rev_growth_delta += 0.03
        parts.append("revenue +3pp")

    s.rationale = ("Heuristic read: " + "; ".join(parts) + ".") if parts else ""
    return s


# ── LLM translator ───────────────────────────────────────────────────────────
_SYSTEM = (
    "You convert a credit analyst's scenario into driver deltas for a cash-flow "
    "projection. Return ONLY JSON: {\"rev_growth_delta\":num,\"margin_delta\":num,"
    "\"capex_delta\":num,\"rate_delta\":num,\"label\":\"short title\",\"rationale\":"
    "\"one terse sentence\"}. Deltas are decimals in the drivers' own units: "
    "rev_growth_delta/margin_delta/capex_delta are fractions of revenue (0.03 = "
    "+3 percentage points), rate_delta is a fraction (0.02 = +200bps). Use the "
    "sign of the credit impact: a downside/stress scenario lowers growth and "
    "margin and/or raises rates and capex. Keep magnitudes realistic "
    "(|growth|<=0.15, |margin|<=0.10, |capex|<=0.05, rate within -0.03..0.05). "
    "Set unaffected drivers to 0."
)


async def _llm_translate(text: str) -> ScenarioSpec:

    settings = get_settings()
    # Shared cached client (llm_client.anthropic_client): per-call construction
    # re-paid TLS setup on every request and leaked unclosed httpx transports.
    client = llm_client.anthropic_client(settings)
    resp = await llm_client.create(
        client,
        lane="scenario:translate",
        model=presets.model_for(presets.LIGHT),
        effort=presets.effort_for(presets.LIGHT),
        max_tokens=400,
        system=_SYSTEM,
        messages=[{"role": "user", "content": text}],
    )
    out = next((b.text for b in resp.content if b.type == "text"), "")
    match = re.search(r"\{.*\}", out, re.DOTALL)
    if not match:
        raise ScenarioError("model returned no JSON spec")
    return ScenarioSpec(**json.loads(match.group(0)))


async def translate_scenario(text: str) -> ScenarioSpec:
    settings = get_settings()
    if settings.anthropic_api_key:
        try:
            return validate_scenario(await _llm_translate(text))
        except ScenarioError:
            raise
        except Exception as e:  # network/parse → deterministic mapper
            logger.warning("LLM scenario translate failed, using demo mapper: %s", e)
    return validate_scenario(_demo_translate(text))
