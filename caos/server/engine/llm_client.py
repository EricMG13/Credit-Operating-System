"""Single seam for live Anthropic Messages.create calls (M-1 / M-2).

Every plain ``messages.create`` lane in the engine (synth, council, debate, the
document extractors) and the issuer chat go through ``create`` so two cross-cutting
concerns live in one place instead of being re-implemented per call site:

  * **M-2 — graceful degradation.** On a rate-limit / overload (429 or 529) that
    survives the SDK's own retries, retry the call ONCE on the cheaper fallback
    model (``synth_executor_model``) before surfacing the error. A heavy-model
    quota spike degrades to a cheaper model rather than failing the lane.
  * **M-1 — agentic tracing.** Emit one structured ``caos.llm`` line per
    inference (run id, lane, model, fallback?, in/out tokens, latency, stop
    reason) via ``budget.trace_llm``, and accrue the run-budget usage there.

Streaming (deep research) and the beta advisor tool (synth) keep their own call
shape and borrow ``budget.trace_llm`` directly — only plain ``messages.create``
routes through ``create`` here.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Optional

import anthropic

from config import get_settings
from engine import budget

logger = logging.getLogger("caos.llm")


def is_overloaded(exc: Exception) -> bool:
    """True for the retry-on-a-cheaper-model cases: 429 rate limit or 529 overload."""
    if isinstance(exc, anthropic.RateLimitError):
        return True
    # 529 overloaded (and any explicit overload error) — read leniently so an SDK
    # shape change degrades to "don't fall back", never to a crash.
    if isinstance(exc, getattr(anthropic, "APIStatusError", ())):
        return getattr(exc, "status_code", None) == 529
    try:
        import httpx
        if isinstance(exc, httpx.HTTPStatusError):
            return exc.response.status_code in (429, 502, 503, 529)
    except ImportError:
        pass
    return False


def _provider(model: Optional[str]) -> str:
    """Which provider a model id belongs to. The preset tier id decides routing —
    no separate provider flag — so swapping a tier to a gemini-* id is all it takes."""
    if not model:
        return "anthropic"
    if model.startswith("gemini"):
        return "gemini"
    if "/" in model or model.startswith("deepseek") or model.startswith("openrouter"):
        return "openrouter"
    return "anthropic"


async def _create_gemini(*, lane: str, model: str, fallback_model: Optional[str],
                         effort: Optional[str], **kwargs):
    """Gemini path: hand the Anthropic-shaped kwargs to the adapter, which calls
    google-genai and returns a normalized (Anthropic-shaped) response — so the
    trace and every caller stay unchanged. Same single-retry-on-a-cheaper-model
    behaviour as the Anthropic path, using the Gemini overload classifier."""
    from engine import gemini

    s = get_settings()
    fb = fallback_model or s.model_tier_cheap
    call_kwargs: dict[str, Any] = dict(
        system=kwargs.get("system"),
        messages=kwargs.get("messages"),
        max_tokens=kwargs.get("max_tokens"),
        tools=kwargs.get("tools"),
        tool_choice=kwargs.get("tool_choice"),
        effort=effort,
    )
    t0 = time.monotonic()
    used_model, did_fallback = model, False
    try:
        resp = await gemini.call(model=model, **call_kwargs)
    except gemini.GeminiUnsupported:
        raise  # a shape PR-2 doesn't route to Gemini (advisor 2-tool path) — surfaced, not retried
    except Exception as exc:  # noqa: BLE001 — narrow to overload below, re-raise the rest
        # Fall back only to a same-provider cheaper model; never hand a non-gemini id
        # to the Gemini SDK (an operator could override model_tier_cheap).
        if model == fb or _provider(fb) != "gemini" or not gemini.is_overloaded(exc):
            raise
        logger.warning(
            "caos.llm lane=%s gemini overloaded on %s (%s) — falling back %s -> %s",
            lane, model, type(exc).__name__, model, fb,
        )
        resp = await gemini.call(model=fb, **call_kwargs)
        used_model, did_fallback = fb, True
    budget.trace_llm(
        resp, lane=lane, model=used_model,
        ms=(time.monotonic() - t0) * 1000.0, fallback=did_fallback,
    )
    return resp


async def _create_openrouter(*, lane: str, model: str, fallback_model: Optional[str],
                             effort: Optional[str], **kwargs):
    """OpenRouter path: hand the Anthropic-shaped kwargs to the adapter, which calls
    OpenRouter and returns a normalized (Anthropic-shaped) response."""
    from engine import openrouter

    s = get_settings()
    # Default to the cheap tier (a same-provider OpenRouter model) so an overload
    # actually retries cheaper; the synth_executor default is Anthropic, which the
    # _provider(fb) guard below would reject — making the fallback dead. Mirrors the
    # Gemini path.
    fb = fallback_model or s.model_tier_cheap
    call_kwargs: dict[str, Any] = dict(
        system=kwargs.get("system"),
        messages=kwargs.get("messages"),
        max_tokens=kwargs.get("max_tokens"),
        tools=kwargs.get("tools"),
        tool_choice=kwargs.get("tool_choice"),
        effort=effort,
    )
    t0 = time.monotonic()
    used_model, did_fallback = model, False
    try:
        resp = await openrouter.call(lane=lane, model=model, **call_kwargs)
    except Exception as exc:  # noqa: BLE001 — narrow to overload below, re-raise the rest
        if model == fb or _provider(fb) != "openrouter" or not openrouter.is_overloaded(exc):
            raise
        logger.warning(
            "caos.llm lane=%s openrouter overloaded on %s (%s) — falling back %s -> %s",
            lane, model, type(exc).__name__, model, fb,
        )
        resp = await openrouter.call(lane=lane, model=fb, **call_kwargs)
        used_model, did_fallback = fb, True
    budget.trace_llm(
        resp, lane=lane, model=used_model,
        ms=(time.monotonic() - t0) * 1000.0, fallback=did_fallback,
    )
    return resp


async def create(
    client,
    *,
    lane: str,
    model: Optional[str] = None,
    fallback_model: Optional[str] = None,
    effort: Optional[str] = None,
    **kwargs,
):
    """Run one ``client.messages.create`` with model fallback (M-2) + trace (M-1).

    ``lane`` labels the call in the trace. ``model`` defaults to the configured
    ``anthropic_model``; ``fallback_model`` to ``synth_executor_model``. All other
    kwargs (system, max_tokens, tools, tool_choice, messages, …) pass straight
    through, so the seam is shape-agnostic for plain Messages calls.

    When ``model`` is a ``gemini-*`` id the call routes to the Gemini adapter
    (engine/gemini.py), which returns an Anthropic-shaped response so the trace
    and callers stay unchanged; ``effort`` (minimal|low|medium|high) drives Gemini
    thinking and is inert on Anthropic.
    """
    s = get_settings()
    primary = model or s.anthropic_model
    if _provider(primary) == "gemini":
        return await _create_gemini(
            lane=lane, model=primary, fallback_model=fallback_model, effort=effort, **kwargs
        )
    if _provider(primary) == "openrouter":
        return await _create_openrouter(
            lane=lane, model=primary, fallback_model=fallback_model, effort=effort, **kwargs
        )
    fb = fallback_model or s.synth_executor_model
    t0 = time.monotonic()
    used_model, did_fallback = primary, False
    try:
        resp = await client.messages.create(model=primary, **kwargs)
    except Exception as exc:  # noqa: BLE001 — narrow to overload below, re-raise the rest
        if primary == fb or not is_overloaded(exc):
            raise
        logger.warning(
            "caos.llm lane=%s rate-limited on %s (%s) — falling back %s -> %s",
            lane, primary, type(exc).__name__, primary, fb,
        )
        resp = await client.messages.create(model=fb, **kwargs)
        used_model, did_fallback = fb, True
    budget.trace_llm(
        resp, lane=lane, model=used_model,
        ms=(time.monotonic() - t0) * 1000.0, fallback=did_fallback,
    )
    return resp
