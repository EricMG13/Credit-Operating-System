"""Golden eval harness support — grounding precision/recall from the run ledger.

The companion to the gate-behavior golden cases (``tests/server/golden/
test_golden_query_gates.py``): the golden cases pin the *deterministic gate
semantics* on canned model replies, while this module aggregates the *live*
kept/dropped counts the run ledger (``llm_call_records``) records per LLM call so
grounding precision/recall can be tracked over time as prompts and models change.

A falling precision (kept/(kept+dropped)) on a lane means retrieval or grounding
is drifting *before* users see wrong answers — the health metric the Intelligent
Data Vault plan names as the early-warning signal.

Pure functions, no I/O — the caller reads ``LLMCallRecord`` rows and passes them
in; the metrics are computed in-memory so this is unit-testable without a DB.
"""

from __future__ import annotations

from typing import Dict, Iterable, List, Optional


def _num(record: object, attr: str) -> int:
    """Read an int count from a record, treating None/missing as 0. Duck-typed so
    both ``LLMCallRecord`` rows and ``SimpleNamespace`` test doubles work."""
    v = getattr(record, attr, None)
    if v is None:
        return 0
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def _lane(record: object) -> str:
    return str(getattr(record, "lane", "") or "unknown")


def _status(record: object) -> str:
    return str(getattr(record, "status", "") or "success")


def grounding_metrics(records: Iterable[object]) -> Dict[str, object]:
    """Aggregate kept/dropped counts into per-lane and overall grounding metrics.

    precision = kept / (kept + dropped) — the share of model claims the gates
    kept. A lane with no kept+dropped is omitted (no signal). ``failed`` counts
    LLM calls whose ``status != "success"`` (parse errors, timeouts) so a rising
    failure rate is visible alongside precision drift.

    Returns ``{"overall": {kept, dropped, precision, n, failed}, "by_lane": {lane: {...}}}``.
    Precision is ``None`` when kept+dropped is 0 (no grounded claims recorded).
    """
    overall_kept = 0
    overall_dropped = 0
    overall_n = 0
    overall_failed = 0
    by_lane: Dict[str, Dict[str, int]] = {}

    for r in records:
        overall_n += 1
        lane = _lane(r)
        lane_agg = by_lane.setdefault(lane, {"kept": 0, "dropped": 0, "n": 0, "failed": 0})
        kept = _num(r, "kept_count")
        dropped = _num(r, "dropped_count")
        overall_kept += kept
        overall_dropped += dropped
        lane_agg["kept"] += kept
        lane_agg["dropped"] += dropped
        lane_agg["n"] += 1
        if _status(r) != "success":
            overall_failed += 1
            lane_agg["failed"] += 1

    def _precision(kept: int, dropped: int) -> Optional[float]:
        denom = kept + dropped
        return round(kept / denom, 4) if denom else None

    return {
        "overall": {
            "kept": overall_kept,
            "dropped": overall_dropped,
            "precision": _precision(overall_kept, overall_dropped),
            "n": overall_n,
            "failed": overall_failed,
        },
        "by_lane": {
            lane: {
                "kept": agg["kept"],
                "dropped": agg["dropped"],
                "precision": _precision(agg["kept"], agg["dropped"]),
                "n": agg["n"],
                "failed": agg["failed"],
            }
            for lane, agg in by_lane.items()
        },
    }


def precision_trend(records: Iterable[object], lane: Optional[str] = None) -> List[Dict[str, object]]:
    """Time-ordered per-call precision series for a lane (or all lanes when None),
    for drift visualization. Each entry: ``{lane, kept, dropped, precision, status}``.
    The caller is expected to pass records ordered by ``created_at``; this function
    does not re-sort (it has no I/O and no timestamp assumption baked in)."""
    out: List[Dict[str, object]] = []
    for r in records:
        if lane is not None and _lane(r) != lane:
            continue
        kept = _num(r, "kept_count")
        dropped = _num(r, "dropped_count")
        denom = kept + dropped
        out.append({
            "lane": _lane(r),
            "kept": kept,
            "dropped": dropped,
            "precision": round(kept / denom, 4) if denom else None,
            "status": _status(r),
        })
    return out


def dropped_claim_rate(metrics: dict) -> Optional[float]:
    """``dropped / (kept + dropped)`` — the plan's named health metric. ``None``
    when there is no signal (kept+dropped = 0), distinguishing "no data" from
    "all dropped." A *rising* rate on a lane means retrieval or prompt drift is
    producing more ungroundable claims — visible here BEFORE users see wrong
    answers.

    **Never the basis for loosening the gates.** The Phase-4 anti-pattern is
    trading drop rate for "answer availability" by relaxing the validator; the
    fix for a rising drop rate is better retrieval (Phase-1 remainder: graph
    expansion, metric-fact SQL lane, cross-encoder rerank) or a prompt review —
    never a laxer gate. This metric is the alarm, not the fix.

    ``metrics`` is a per-lane or overall dict from ``grounding_metrics`` (with
    ``kept`` / ``dropped`` keys)."""
    kept = int(metrics.get("kept", 0) or 0)
    dropped = int(metrics.get("dropped", 0) or 0)
    denom = kept + dropped
    return round(dropped / denom, 4) if denom else None


def health_check(
    records: Iterable[object],
    *,
    drop_rate_threshold: float = 0.5,
    min_n: int = 3,
) -> Dict[str, object]:
    """The drift alarm: aggregate ``grounding_metrics`` over the run-ledger rows,
    then flag lanes whose ``dropped_claim_rate`` exceeds ``drop_rate_threshold``
    (with at least ``min_n`` calls so a single noisy call doesn't trip it).

    Returns ``{overall, overall_dropped_claim_rate, by_lane, flagged_lanes,
    threshold, min_n}``. ``flagged_lanes`` is severity-ranked (highest drop rate
    first). A flagged lane means retrieval or prompt drift — the fix is better
    retrieval / a prompt review, NEVER loosening the gates (the drop rate is the
    alarm, not the fix; see ``dropped_claim_rate``).

    The threshold + min_n are the alarm's sensitivity: ``drop_rate_threshold=0.5``
    matches the self-correction retry trigger (a lane dropping > half its claims
    is the same signal that fires a HEAVY retry), and ``min_n=3`` rules out
    small-sample noise."""
    m = grounding_metrics(records)
    by_lane = m["by_lane"]
    assert isinstance(by_lane, dict)
    overall = m["overall"]
    assert isinstance(overall, dict)
    flagged: List[dict] = []
    for lane, lm in by_lane.items():
        assert isinstance(lm, dict)
        if int(lm.get("n", 0) or 0) < min_n:
            continue  # too few calls to trust the rate
        rate = dropped_claim_rate(lm)
        if rate is not None and rate > drop_rate_threshold:
            flagged.append({"lane": lane, "dropped_claim_rate": rate,
                            "kept": lm.get("kept", 0), "dropped": lm.get("dropped", 0),
                            "n": lm.get("n", 0)})
    flagged.sort(key=lambda f: float(f["dropped_claim_rate"]), reverse=True)
    return {
        "overall": overall,
        "overall_dropped_claim_rate": dropped_claim_rate(overall),
        "by_lane": by_lane,
        "flagged_lanes": flagged,
        "threshold": drop_rate_threshold,
        "min_n": min_n,
    }
