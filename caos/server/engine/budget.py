"""Per-run LLM token budget.

A run now fans out across several LLM modules (CP-1 synth, CP-1A add-backs, CP-4C
covenant terms). To keep cost bounded — the TIER1 plan's prerequisite for opening
the runner up — the runner installs a ``RunBudget`` for the duration of a run and
each LLM call site consults it:

  * ``llm_allowed()`` — False once the budget is spent, so a module degrades to its
    deterministic path (add-backs/covenants) or is gated (synth) rather than
    spending beyond the cap.
  * ``reserve_call()`` — before network I/O, atomically reserves a conservative
    input-token upper bound plus the provider's maximum output. Concurrent fan-out
    waits for released headroom instead of every lane independently passing a
    stale pre-call check.
  * ``record_usage(resp)`` — accrues the Anthropic response's token usage.

It is carried in a ``ContextVar`` so it threads through the whole run (including a
background task) without changing every function signature. ``limit <= 0`` means
unlimited (the default), so this is inert unless an operator sets a budget.
"""

from __future__ import annotations

import asyncio
import contextvars
import json
import logging
import math
from dataclasses import dataclass, field
from typing import Optional

# M-1: per-inference trace lines land on this logger so they can be grepped /
# shipped separately from the HTTP access log (caos.access) and app log (caos).
_trace_logger = logging.getLogger("caos.llm")


@dataclass(frozen=True)
class BudgetReservation:
    amount: int
    max_output_tokens: int


class TokenBudgetExceeded(RuntimeError):
    """No bounded provider call can fit in the active run budget."""


@dataclass
class RunBudget:
    limit: int        # max total tokens for the run; <= 0 means unlimited
    used: int = 0
    reserved: int = 0
    degraded: bool = False  # Track if model rate limits/overloads forced a degraded fallback path
    budget_exhausted: bool = False  # Track if run ran out of token budget
    _changed: asyncio.Condition = field(default_factory=asyncio.Condition, repr=False)

    def exhausted(self) -> bool:
        return self.limit > 0 and self.used >= self.limit

    def remaining(self) -> Optional[int]:
        return None if self.limit <= 0 else max(0, self.limit - self.used)

    def record(self, input_tokens: int = 0, output_tokens: int = 0) -> None:
        self.used += int(input_tokens or 0) + int(output_tokens or 0)

    async def reserve(
        self, input_tokens: int, max_output_tokens: int
    ) -> BudgetReservation | None:
        """Atomically reserve one call, waiting for concurrent calls to settle.

        If a call's requested ceiling is larger than the remaining budget after
        all prior reservations settle, its output ceiling is reduced to the exact
        remaining headroom. ``None`` means even the conservative input bound does
        not fit, so no provider request is allowed.
        """
        requested_input = max(0, int(input_tokens))
        requested_output = max(1, int(max_output_tokens))
        if self.limit <= 0:
            return BudgetReservation(0, requested_output)
        async with self._changed:
            while True:
                available = max(0, self.limit - self.used - self.reserved)
                requested = requested_input + requested_output
                if available >= requested:
                    reservation = BudgetReservation(requested, requested_output)
                    self.reserved += reservation.amount
                    return reservation
                if self.reserved > 0:
                    await self._changed.wait()
                    continue
                output_room = available - requested_input
                if output_room <= 0:
                    self.budget_exhausted = True
                    return None
                reservation = BudgetReservation(available, output_room)
                self.reserved += reservation.amount
                return reservation

    async def release(self, reservation: BudgetReservation) -> None:
        if reservation.amount <= 0:
            return
        async with self._changed:
            self.reserved = max(0, self.reserved - reservation.amount)
            self._changed.notify_all()


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


def _input_reservation(kwargs: dict, *, copies: int = 1) -> int:
    """Conservative provider-input bound from actual request bytes.

    BPE/SentencePiece inputs cannot contain more base text tokens than their UTF-8
    bytes. Eight thousand tokens per copy cover provider-added message/tool framing;
    the advisor path uses two copies because its sub-inference receives context too.
    This deliberately over-reserves, then releases against provider-reported usage.
    """
    payload = {
        "system": kwargs.get("system"),
        "messages": kwargs.get("messages"),
        "tools": kwargs.get("tools"),
        "tool_choice": kwargs.get("tool_choice"),
    }
    raw_bytes = len(
        json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
    )
    count = max(1, int(copies))
    return raw_bytes * count + 8192 * count


async def reserve_call(
    kwargs: dict,
    *,
    extra_output_tokens: int = 0,
    input_copies: int = 1,
) -> BudgetReservation:
    """Reserve the active run's conservative input + maximum output spend."""
    requested_output = max(1, int(kwargs.get("max_tokens") or 0)) + max(
        0, int(extra_output_tokens)
    )
    b = _budget_var.get()
    if b is None:
        return BudgetReservation(0, requested_output)
    reservation = await b.reserve(
        _input_reservation(kwargs, copies=input_copies), requested_output
    )
    if reservation is None:
        raise TokenBudgetExceeded("per-run token budget exhausted before provider call")
    return reservation


async def release_call(reservation: BudgetReservation) -> None:
    b = _budget_var.get()
    if b is not None:
        await b.release(reservation)


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


def _estimated_cost(usage, model: str) -> Optional[float]:
    """Return provider-reported cost, else a bounded exact-model estimate.

    Unknown models deliberately return ``None``. Recording a Sonnet estimate for
    every unfamiliar model made OpenRouter/DeepSeek and new Opus telemetry look
    precise while being materially wrong.
    """
    raw_provider_cost = getattr(usage, "cost", None)
    if raw_provider_cost is not None:
        try:
            provider_cost = float(raw_provider_cost)
        except (TypeError, ValueError):
            provider_cost = math.nan
        if math.isfinite(provider_cost) and provider_cost >= 0:
            return provider_cost

    m = model.lower()
    in_tokens = int(getattr(usage, "input_tokens", 0) or 0)
    cache_read = int(getattr(usage, "cache_read_input_tokens", 0) or 0)
    cache_write = int(getattr(usage, "cache_creation_input_tokens", 0) or 0)
    out_tokens = int(getattr(usage, "output_tokens", 0) or 0)

    # Standard, non-batch list prices per MTok. Keep this exact and small; add a
    # model only with a dated provider-source check. Cache reads/writes use the
    # common 0.1x/1.25x modifiers for these supported direct-provider lanes.
    prices: Optional[tuple[float, float]] = None
    if "claude-opus-4-8" in m:
        prices = (5.0, 25.0)
    elif "gemini-2.5-flash" in m:
        prices = (0.30, 2.50)
    elif "gemini-2.5-pro" in m:
        prices = (
            (2.50, 15.0)
            if in_tokens + cache_read + cache_write > 200_000
            else (1.25, 10.0)
        )
    elif "gemini-3.5-flash" in m:
        prices = (1.50, 9.0)
    elif "gemini-3-flash-preview" in m:
        prices = (0.50, 3.0)
    elif "gemini-3.1-flash-lite" in m:
        prices = (0.25, 1.50)
    elif "gemini-3.1-pro-preview" in m:
        prices = (
            (4.0, 18.0)
            if in_tokens + cache_read + cache_write > 200_000
            else (2.0, 12.0)
        )
    if prices is None:
        return None
    input_price, output_price = prices
    return (
        in_tokens * input_price
        + cache_read * input_price * 0.1
        + cache_write * input_price * 1.25
        + out_tokens * output_price
    ) / 1_000_000.0


async def trace_llm(resp, *, lane: str, model: str, ms: Optional[float] = None,
                    fallback: bool = False, prompt_hash: Optional[str] = None) -> None:
    """M-1: accrue usage onto the run budget AND emit one structured ``caos.llm``
    trace line for the inference. Replaces the bare ``record_usage`` call at each
    live LLM site so tracing can never be forgotten where billing is recorded.

    Best-effort: a malformed response must never break the call path, so usage
    extraction is read leniently and the whole trace is guarded.
    """
    # Guard billing separately from tracing: record_usage sat OUTSIDE the guard,
    # so a provider emitting a non-int-coercible usage field crashed the live
    # inference path the docstring promises never breaks (audit 2026-07-10 B1).
    # Its own try (not the shared one below) so a trace-formatting error can
    # never skip billing, and vice versa.
    try:
        record_usage(resp)
    except Exception:  # noqa: BLE001 — billing is best-effort on malformed usage
        _trace_logger.warning("record_usage failed on a malformed response", exc_info=True)
    try:
        usage = getattr(resp, "usage", None)
        in_tokens = _input_tokens(usage) if usage is not None else 0
        out_tokens = (getattr(usage, "output_tokens", 0) or 0) if usage is not None else 0

        cost = _estimated_cost(usage, model)

        _trace_logger.info(json.dumps({
            "event": "llm_call",
            "run_id": _run_id_var.get(),
            "lane": lane,
            "model": model,
            "fallback": fallback,
            "input_tokens": in_tokens,
            "output_tokens": out_tokens,
            "cost": cost,
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
            try:
                resp.llm_call_id = record.id
            except AttributeError:
                pass
    except Exception:  # noqa: BLE001 — a trace must never fail the inference
        _trace_logger.exception("caos.llm trace failed for lane=%s", lane)
