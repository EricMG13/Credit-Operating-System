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
from dataclasses import dataclass
from typing import Optional


@dataclass
class RunBudget:
    limit: int        # max total tokens for the run; <= 0 means unlimited
    used: int = 0

    def exhausted(self) -> bool:
        return self.limit > 0 and self.used >= self.limit

    def remaining(self) -> Optional[int]:
        return None if self.limit <= 0 else max(0, self.limit - self.used)

    def record(self, input_tokens: int = 0, output_tokens: int = 0) -> None:
        self.used += int(input_tokens or 0) + int(output_tokens or 0)


_budget_var: contextvars.ContextVar[Optional[RunBudget]] = contextvars.ContextVar(
    "caos_run_budget", default=None
)


def set_budget(budget: Optional[RunBudget]) -> None:
    _budget_var.set(budget)


def current_budget() -> Optional[RunBudget]:
    return _budget_var.get()


def llm_allowed() -> bool:
    """True when there is budget left (or no budget is set)."""
    b = _budget_var.get()
    return b is None or not b.exhausted()


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
