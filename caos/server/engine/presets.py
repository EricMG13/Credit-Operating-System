"""Analyst-selected model mode → per-lane model tier (engine/presets.py).

One of four modes — TEST / LITE / BALANCED / MAX — is chosen per analyst and
carried on each request, trading token cost ↔ latency ↔ reasoning quality:

  TEST      cheapest — exercise code paths / stress-test, not answer quality
  LITE      fast — favour latency for interactive work
  BALANCED  default — strong where it matters, cheap on the light lanes
  MAX       highest reasoning — the heavy lanes on the top model

The mode picks a model *tier* (cheap / mid / top) per lane class:

  heavy    CP synthesis + adversarial council + debate narration — the
           reasoning-critical credit lanes where a wrong read costs money
  light    issuer chat, NL-query translate/plan, scenario translate — short,
           latency-sensitive, structured
  extract  document → JSON extraction — mechanical

  mode      heavy   light   extract     (effort, applied in the Gemini follow-up)
  TEST      cheap   cheap   cheap        minimal
  LITE      mid     cheap   cheap        low
  BALANCED  mid     mid     cheap        medium
  MAX       top     mid     mid          high

PR-1 maps the tiers onto the already-wired Anthropic models (cheap=Haiku,
mid=Sonnet, top=Opus) via config, so the modes work end-to-end today. The
hybrid that runs the cheap lanes on Gemini swaps the tier model IDs (config) and
adds the provider adapter behind this same table — this module is unchanged.

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

# mode → lane class → tier. Tiers resolve to a model via config (model_tier_*).
_TABLE = {
    TEST: {HEAVY: "cheap", LIGHT: "cheap", EXTRACT: "cheap"},
    LITE: {HEAVY: "mid", LIGHT: "cheap", EXTRACT: "cheap"},
    BALANCED: {HEAVY: "mid", LIGHT: "mid", EXTRACT: "cheap"},
    MAX: {HEAVY: "top", LIGHT: "mid", EXTRACT: "mid"},
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


def model_for(lane_class: str) -> str:
    """The model ID for ``lane_class`` under the active mode."""
    s = get_settings()
    tier = _TABLE[current_mode()][lane_class]
    return {
        "cheap": s.model_tier_cheap,
        "mid": s.model_tier_mid,
        "top": s.model_tier_top,
    }[tier]
