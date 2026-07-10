"""Per-run LLM token budget.

A run now fans out across several LLM modules (CP-1 synth, CP-1A add-backs, CP-4C
covenant terms). To keep cost bounded — the TIER1 plan's prerequisite for opening
the runner up — the runner installs a ``RunBudget`` for the duration of a run and
each LLM call site consults it:

  * ``llm_allowed()`` — False once the budget is spent, so a module degrades to its
    deterministic path (add-backs/covenants) or is gated (synth) rather than
    spending beyond the cap.
  * ``record_usage(resp)`` — accrues the Anthropic response's token usage.

It is carried in a ``ContextVar`` so it threads through the whole run (including a
background task) without changing every function signature. ``limit <= 0`` means
unlimited (the default), so this is inert unless an operator sets a budget.
"""

from __future__ import annotations

import contextvars
import json
import logging
from dataclasses import dataclass
from typing import Optional

# M-1: per-inference trace lines land on this logger so they can be grepped /
# shipped separately from the HTTP access log (caos.access) and app log (caos).
_trace_logger = logging.getLogger("caos.llm")


@dataclass
class RunBudget:
    limit: int        # max total tokens for the run; <= 0 means unlimited
    used: int = 0
    degraded: bool = False  # Track if model rate limits/overloads forced a degraded fallback path
    budget_exhausted: bool = False  # Track if run ran out of token budget

    def exhausted(self) -> bool:
        return self.limit > 0 and self.used >= self.limit

    def remaining(self) -> Optional[int]:
        return None if self.limit <= 0 else max(0, self.limit - self.used)

    def record(self, input_tokens: int = 0, output_tokens: int = 0) -> None:
        self.used += int(input_tokens or 0) + int(output_tokens or 0)


_budget_var: contextvars.ContextVar[Optional[RunBudget]] = contextvars.ContextVar(
    "caos_run_budget", default=None
)

# Run id for trace correlation (M-1). Set alongside the budget in the runner so
# every caos.llm line can be tied back to its run; None for run-less lanes (issuer
# chat, deep research) — they still trace, just without a run id.
_run_id_var: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "caos_run_id", default=None
)


def set_budget(budget: Optional[RunBudget]) -> None:
    _budget_var.set(budget)


def current_budget() -> Optional[RunBudget]:
    return _budget_var.get()


def set_run_id(run_id: Optional[str]) -> None:
    _run_id_var.set(run_id)


def llm_allowed() -> bool:
    """True when there is budget left (or no budget is set)."""
    b = _budget_var.get()
    if b is not None and b.exhausted():
        b.budget_exhausted = True
        return False
    return True


def _input_tokens(u) -> int:
    """Total input tokens processed, cached or not. With prompt caching the cached
    prefix leaves ``input_tokens`` (it moves to cache_read/cache_creation), so summing
    all three keeps the budget invariant to caching — ``run_token_budget`` measures the
    same processed-token total whether or not a prefix was cached."""
    return (
        (getattr(u, "input_tokens", 0) or 0)
        + (getattr(u, "cache_read_input_tokens", 0) or 0)
        + (getattr(u, "cache_creation_input_tokens", 0) or 0)
    )


def record_usage(resp) -> None:
    """Accrue an Anthropic response's token usage onto the active run budget.

    Top-level usage is the executor's tokens. When the advisor tool ran, the
    advisor sub-inference bills separately and is reported only in
    ``usage.iterations`` (type ``advisor_message``) — accrue those too so the run
    budget reflects the true spend."""
    b = _budget_var.get()
    if b is None:
        return
    usage = getattr(resp, "usage", None)
    if usage is None:
        return
    b.record(_input_tokens(usage), getattr(usage, "output_tokens", 0) or 0)
    for it in getattr(usage, "iterations", None) or []:
        if getattr(it, "type", None) == "advisor_message":
            b.record(_input_tokens(it), getattr(it, "output_tokens", 0) or 0)


async def trace_llm(resp, *, lane: str, model: str, ms: Optional[float] = None,
                    fallback: bool = False, prompt_hash: Optional[str] = None) -> None:
    """M-1: accrue usage onto the run budget AND emit one structured ``caos.llm``
    trace line for the inference. Replaces the bare ``record_usage`` call at each
    live LLM site so tracing can never be forgotten where billing is recorded.

    Best-effort: a malformed response must never break the call path, so usage
    extraction is read leniently and the whole trace is guarded.
    """
    record_usage(resp)
    try:
        usage = getattr(resp, "usage", None)
        in_tokens = _input_tokens(usage) if usage is not None else 0
        out_tokens = (getattr(usage, "output_tokens", 0) or 0) if usage is not None else 0

        cost = 0.0
        m_lower = model.lower()
        if "sonnet" in m_lower:
            cost = (in_tokens * 3.0 + out_tokens * 15.0) / 1_000_000.0
        elif "haiku" in m_lower:
            cost = (in_tokens * 0.25 + out_tokens * 1.25) / 1_000_000.0
        elif "gemini-1.5-pro" in m_lower or "gemini-2.0-pro" in m_lower:
            cost = (in_tokens * 1.25 + out_tokens * 3.75) / 1_000_000.0
        elif "gemini-1.5-flash" in m_lower or "gemini-2.0-flash" in m_lower:
            cost = (in_tokens * 0.075 + out_tokens * 0.3) / 1_000_000.0
        else:
            cost = (in_tokens * 3.0 + out_tokens * 15.0) / 1_000_000.0

        _trace_logger.info(json.dumps({
            "event": "llm_call",
            "run_id": _run_id_var.get(),
            "lane": lane,
            "model": model,
            "fallback": fallback,
            "input_tokens": in_tokens,
            "output_tokens": out_tokens,
            "stop_reason": getattr(resp, "stop_reason", None),
            "ms": round(ms, 1) if ms is not None else None,
        }))

        from database import AsyncSessionLocal, LLMCallRecord
        async with AsyncSessionLocal() as session:
            record = LLMCallRecord(
                run_id=_run_id_var.get(),
                lane=lane,
                model=model,
                prompt_hash=prompt_hash,
                prompt_tokens=in_tokens,
                completion_tokens=out_tokens,
                cost=cost,
                status="success",
                latency_ms=round(ms) if ms is not None else None,
            )
            session.add(record)
            await session.commit()
            if hasattr(resp, "__dict__") or isinstance(resp, object):
                try:
                    resp.llm_call_id = record.id
                except AttributeError:
                    pass
    except Exception:  # noqa: BLE001 — a trace must never fail the inference
        _trace_logger.exception("caos.llm trace failed for lane=%s", lane)
