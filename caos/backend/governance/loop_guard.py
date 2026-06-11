"""
CP-SR <-> CP-MON cycle termination (P2) — QA gate X7.

The only sanctioned cycle in the system. X7 bounds it: MAX_ROUND_TRIPS=2,
HARD_TIMEOUT=3, convergence when signal_register delta < 5% and no new CRITICAL
signals. Closes the F8 loop-guard gap. Pure stdlib.
"""

from __future__ import annotations

from dataclasses import dataclass

MAX_ROUND_TRIPS = 2
HARD_TIMEOUT = 3
CONVERGENCE_DELTA = 0.05

# X7.5 termination reasons.
TERMINATION_REASONS = {"converged", "max_round_trips", "hard_timeout", "no_new_signals", "manual_stop"}


@dataclass
class CycleDecision:
    should_continue: bool
    termination_reason: str | None
    iteration: int
    convergence_delta: float


def evaluate_cycle(
    iteration: int,
    convergence_delta: float,
    new_critical_signals: int,
    manual_stop: bool = False,
) -> CycleDecision:
    """
    Decide whether the CP-SR<->CP-MON loop should continue (X7).
    `iteration` is 1-based (the round-trip about to begin).
    """
    if manual_stop:
        return CycleDecision(False, "manual_stop", iteration, convergence_delta)
    # Convergence: small delta AND no new critical signals.
    if convergence_delta < CONVERGENCE_DELTA and new_critical_signals == 0:
        reason = "no_new_signals" if convergence_delta == 0 else "converged"
        return CycleDecision(False, reason, iteration, convergence_delta)
    if iteration >= HARD_TIMEOUT:
        return CycleDecision(False, "hard_timeout", iteration, convergence_delta)
    if iteration >= MAX_ROUND_TRIPS:
        return CycleDecision(False, "max_round_trips", iteration, convergence_delta)
    return CycleDecision(True, None, iteration, convergence_delta)
