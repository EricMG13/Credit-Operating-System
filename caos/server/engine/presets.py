"""Analyst-selected model mode → per-lane model tier + effort (engine/presets.py).

One of four modes — TEST / LITE / BALANCED / MAX — is chosen per analyst and
carried on each request, trading token cost ↔ latency ↔ reasoning quality:

  TEST      cheapest — exercise code paths / stress-test, not answer quality
  LITE      fast — favour latency for interactive work
  BALANCED  default — strong reasoning where it matters, cheap on the light lanes
  MAX       highest reasoning — the heavy lanes on the top model

The mode picks a model *tier* + a reasoning *effort* per lane class:

  heavy    CP synthesis + adversarial council + debate narration — the
           reasoning-critical credit lanes where a wrong read costs money
  light    issuer chat, NL-query translate/plan, scenario translate — short,
           latency-sensitive, structured
  extract  document → JSON extraction — mechanical

  mode      heavy           light   extract     effort (heavy / light / extract)
  TEST      cheap           cheap   cheap        minimal / minimal / minimal
  LITE      fast            cheap   cheap        low     / minimal / minimal
  BALANCED  strong          fast    cheap        medium  / minimal / minimal
  MAX       top             fast    fast         high    / low     / minimal

The four tiers wire the agreed **hybrid**: cheap/fast/strong on Gemini, the top
tier on Claude Opus — so BALANCED heavy = Gemini 2.5 Pro and MAX heavy = Opus,
with the cheap/light lanes on Gemini Flash. The hybrid only takes effect when
``GEMINI_API_KEY`` is set; without it a Gemini tier degrades to its Anthropic
equivalent (below), so the engine runs unchanged — and offline tests stay
Anthropic. Effort drives Gemini's thinking config; it is inert on Anthropic
lanes (the seam drops it).

Carried in a ContextVar (like engine/budget's run id / budget) so it threads a
whole run — including the background runner task — without touching every
signature. Default BALANCED. In-request lanes get it from the X-Model-Mode
header (a global dependency in main.py); a run persists it on the row
(Run.model_mode) and the runner re-sets it per claim, since the run executes in
a worker task outside the request.
"""

from __future__ import annotations

import contextvars
from typing import Optional

from config import get_settings

# Lane classes.
HEAVY, LIGHT, EXTRACT = "heavy", "light", "extract"

# Modes.
TEST, LITE, BALANCED, MAX = "TEST", "LITE", "BALANCED", "MAX"
DEFAULT_MODE = BALANCED

# mode → lane class → tier (cheap | fast | strong | top).
_TABLE = {
    TEST: {HEAVY: "cheap", LIGHT: "cheap", EXTRACT: "cheap"},
    LITE: {HEAVY: "fast", LIGHT: "cheap", EXTRACT: "cheap"},
    BALANCED: {HEAVY: "strong", LIGHT: "fast", EXTRACT: "cheap"},
    MAX: {HEAVY: "top", LIGHT: "fast", EXTRACT: "fast"},
}

# mode → lane class → normalized effort. Drives Gemini thinking (engine/gemini.py);
# ignored on Anthropic lanes.
_EFFORT = {
    TEST: {HEAVY: "minimal", LIGHT: "minimal", EXTRACT: "minimal"},
    LITE: {HEAVY: "low", LIGHT: "minimal", EXTRACT: "minimal"},
    BALANCED: {HEAVY: "medium", LIGHT: "minimal", EXTRACT: "minimal"},
    MAX: {HEAVY: "high", LIGHT: "low", EXTRACT: "minimal"},
}

# When GEMINI_API_KEY is unset, a Gemini tier model degrades to this Anthropic
# equivalent so the engine still runs (and offline tests stay Anthropic).
_ANTHROPIC_FALLBACK = {
    "cheap": "claude-haiku-4-5-20251001",
    "fast": "claude-sonnet-4-6",
    "strong": "claude-sonnet-4-6",
    "top": "claude-opus-4-8",
}

_mode_var: contextvars.ContextVar[str] = contextvars.ContextVar(
    "caos_model_mode", default=DEFAULT_MODE
)


def normalize(raw: Optional[str]) -> str:
    """Coerce any input (header value, stored row, None) to a known mode.

    Unknown / missing → DEFAULT_MODE, so a stale client or a NULL column can
    never select an undefined tier."""
    mode = (raw or "").strip().upper()
    return mode if mode in _TABLE else DEFAULT_MODE


def set_mode(raw: Optional[str]) -> str:
    """Set the active mode for this context; returns the normalized value."""
    mode = normalize(raw)
    _mode_var.set(mode)
    return mode


def current_mode() -> str:
    return _mode_var.get()


def _tier_model(s, tier: str) -> str:
    return {
        "cheap": s.model_tier_cheap,
        "fast": s.model_tier_fast,
        "strong": s.model_tier_strong,
        "top": s.model_tier_top,
    }[tier]


def model_for(lane_class: str) -> str:
    """The model ID for ``lane_class`` under the active mode. A Gemini tier
    degrades to its Anthropic equivalent when no GEMINI_API_KEY is set."""
    s = get_settings()
    tier = _TABLE[current_mode()][lane_class]
    model = _tier_model(s, tier)
    if model.startswith("gemini") and not s.gemini_api_key:
        return _ANTHROPIC_FALLBACK[tier]
    return model


def effort_for(lane_class: str) -> str:
    """The normalized reasoning effort (minimal|low|medium|high) for ``lane_class``
    under the active mode. Applied by the Gemini adapter; inert on Anthropic."""
    return _EFFORT[current_mode()][lane_class]
