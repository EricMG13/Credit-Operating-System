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

The four tiers wire the **OpenRouter hybrid**: cheap/fast/strong on DeepSeek-v4
(flash on cheap/fast, pro on strong), the top tier on Claude Opus — so MAX heavy =
Opus and the cheap/light lanes run on DeepSeek Flash. The hybrid only takes effect
when ``OPENROUTER_API_KEY`` is set; without it an OpenRouter tier degrades to its
Anthropic equivalent (below), so the engine runs unchanged — and offline tests stay
Anthropic. A tier can also point at a ``gemini-*`` id (needs ``GEMINI_API_KEY``);
effort then drives Gemini's thinking config — it is inert on Anthropic and
OpenRouter lanes (the seam drops it).

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

_query_model_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "caos_query_model", default=None
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


def set_query_model(model: Optional[str]) -> None:
    _query_model_var.set(model)


def current_query_model() -> Optional[str]:
    return _query_model_var.get()


def resolved_query_model() -> str:
    """The resolved model ID for query lanes, falling back to the standard Light
    preset model when no custom query model override is set or its key is missing.
    """
    s = get_settings()
    model = current_query_model()
    if not model or model in ("null", "undefined"):
        return model_for(LIGHT)
    if model.startswith("gemini") and not s.gemini_api_key:
        return model_for(LIGHT)
    if ("/" in model or model.startswith("deepseek") or model.startswith("openrouter")) and not s.openrouter_api_key:
        return model_for(LIGHT)
    return model


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
    if ("/" in model or model.startswith("deepseek") or model.startswith("openrouter")) and not s.openrouter_api_key:
        return _ANTHROPIC_FALLBACK[tier]
    return model


def effort_for(lane_class: str) -> str:
    """The normalized reasoning effort (minimal|low|medium|high) for ``lane_class``
    under the active mode. Applied by the Gemini adapter; inert on Anthropic."""
    return _EFFORT[current_mode()][lane_class]


def route_model() -> str:
    """Model for the Query route lane — a bounded closed-set classification, not a
    reasoning task.

    The LIGHT tier defaults to DeepSeek-v4-flash, which burns reasoning tokens even
    at ``minimal`` effort (~19s for a one-shot classify). Prefer the fast, cheap
    Anthropic Haiku whenever an Anthropic key is set (no reasoning-token burn,
    ~1–2s). Without an Anthropic key, fall back to the LIGHT-lane model so an
    OpenRouter-only deploy still gets a router (just slower). Keyless: the lane
    never runs — ``queryoverlay.available()`` is already False."""
    s = get_settings()
    if s.anthropic_api_key:
        return _ANTHROPIC_FALLBACK["cheap"]  # claude-haiku-4-5 — fast, cheap, no reasoning burn
    return model_for(LIGHT)


def reviewer_model() -> str:
    """Model for the adversarial council seats (CP-5C). With ``council_cross_model``
    on, this is a model on the OPPOSITE provider from the heavy (synth) model — the
    critic is not the model that wrote the draft, which catches shared blind spots.
    Off, or when the opposite provider's key is missing, it degrades to the heavy
    model (the prior same-model behaviour)."""
    s = get_settings()
    heavy = model_for(HEAVY)
    if not s.council_cross_model:
        return heavy
    # Pick the configured reviewer on a DIFFERENT provider than heavy. Heavy is
    # Anthropic only on the MAX/top lane (or an anthropic-pinned tier, incl. a
    # degraded one) — there the cross critic is Gemini, if a key is set, else it
    # degrades to same-model. For a Gemini- or OpenRouter/DeepSeek-heavy lane the
    # cross critic is Anthropic (Claude critiques the DeepSeek draft).
    if heavy.startswith("claude") or heavy.startswith("anthropic"):
        return s.council_reviewer_model_gemini if s.gemini_api_key else heavy
    return s.council_reviewer_model_anthropic
