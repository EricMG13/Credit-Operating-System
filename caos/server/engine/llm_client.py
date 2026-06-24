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
from typing import Optional

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
    return False


async def create(
    client,
    *,
    lane: str,
    model: Optional[str] = None,
    fallback_model: Optional[str] = None,
    **kwargs,
):
    """Run one ``client.messages.create`` with model fallback (M-2) + trace (M-1).

    ``lane`` labels the call in the trace. ``model`` defaults to the configured
    ``anthropic_model``; ``fallback_model`` to ``synth_executor_model``. All other
    kwargs (system, max_tokens, tools, tool_choice, messages, …) pass straight
    through, so the seam is shape-agnostic for plain Messages calls.
    """
    s = get_settings()
    primary = model or s.anthropic_model
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
