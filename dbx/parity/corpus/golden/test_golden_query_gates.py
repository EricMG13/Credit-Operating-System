"""Phase-2 golden eval harness — the drift alarm for the Query answer-lane gates.

The deterministic gates (citation + numeric + fact cross-reference) are the
platform's anti-hallucination spine. Unit tests in ``test_query_answer.py`` check
each behavior in isolation; this file freezes the *combined* gate semantics on a
table of canned (retrieval, metric facts, model reply) cases so any drift in
``_validate``, ``grounding.all_grounded``, or the fact pool logic fails CI.

Fully offline — never calls an LLM. Each case pins the survivors, the
``unavailable`` flag, and the drop-reason categories the self-correction loop
would feed back. When a frozen expectation below changes, confirm the new
behavior is *correct* against the gate spec before updating — that is the whole
point of the harness.

Companion: ``engine/eval.py`` aggregates live ``llm_call_records`` kept/dropped
counts into grounding precision/recall (tested at the bottom of this file) so
drift is visible as a falling precision on a lane before users see wrong answers.
"""
from __future__ import annotations

from types import SimpleNamespace

import pytest

from engine.eval import dropped_claim_rate, grounding_metrics, health_check, precision_trend
from engine.llm_safety import first_json_object
from engine.metricengine import MetricFactEntry
from engine.queryanswer import _AnswerReply, _validate

# Shared retrieval + metric facts the cases cite against. c1 carries the 4.4x
# leverage figure; c2 is sector color (no figures). The fact carries the closed
# [4.2, 4.6, 0.4] delta numbers a citing claim may state.
HITS = [
    SimpleNamespace(chunk_id="c1", text="Acme reported net leverage of 4.4x for the LTM period.",
                    issuer_id="i1", doc="acme-10k.pdf", score=1.0),
    SimpleNamespace(chunk_id="c2", text="Beta operates in the same sector as Acme.",
                    issuer_id="i2", doc="beta-10k.pdf", score=0.5),
]
FACT = MetricFactEntry(
    id="fact:i1:net_leverage:delta", kind="metric", label="Acme Net leverage",
    text="Acme: Net leverage 4.2x → 4.6x (+0.4x vs prior run)",
    numbers=[4.2, 4.6, 0.4], issuer_id="i1", walk="metric-trend", chunk_id=None)


def _case(name, reply_json, expected_survivors, expected_unavailable,
          expected_drop_reason_substrings=None, facts=None):
    return {
        "name": name, "reply_json": reply_json,
        "expected_survivors": expected_survivors,
        "expected_unavailable": expected_unavailable,
        "expected_drop_reason_substrings": expected_drop_reason_substrings or [],
        "facts": facts or [],
    }


GOLDEN_CASES = [
    _case("cited_and_grounded",
          '{"sentences": [{"text": "Acme carries net leverage of 4.4x.", "chunk_ids": ["c1"]}]}',
          ["Acme carries net leverage of 4.4x."], False),
    _case("cited_ungrounded_figure_dropped",
          '{"sentences": [{"text": "Acme levered up to 9.9x.", "chunk_ids": ["c1"]}]}',
          [], True, ["figure not present"]),
    _case("uncited_dropped",
          '{"sentences": [{"text": "Acme is highly distressed.", "chunk_ids": []}]}',
          [], True, ["no real chunk"]),
    _case("unknown_chunk_id_dropped",
          '{"sentences": [{"text": "Ratings cite chunk c1.", "chunk_ids": ["c-invented"]}]}',
          [], True, ["no real chunk"]),
    _case("fact_cited_grounded_survives",
          '{"sentences": [{"text": "Acme leverage rose to 4.6x from 4.2x.", "chunk_ids": [], '
          '"fact_ids": ["fact:i1:net_leverage:delta"]}]}',
          ["Acme leverage rose to 4.6x from 4.2x."], False, facts=[FACT]),
    _case("fact_cited_ungrounded_dropped",
          '{"sentences": [{"text": "Acme leverage rose to 9.9x.", "chunk_ids": [], '
          '"fact_ids": ["fact:i1:net_leverage:delta"]}]}',
          [], True, ["figure not present"], facts=[FACT]),
    _case("mixed_one_survives_two_dropped",
          '{"sentences": ['
          '{"text": "Acme carries net leverage of 4.4x.", "chunk_ids": ["c1"]},'
          '{"text": "Acme levered up to 9.9x.", "chunk_ids": ["c1"]},'
          '{"text": "Acme is highly distressed.", "chunk_ids": []}]}',
          ["Acme carries net leverage of 4.4x."], False, ["figure not present", "no real chunk"]),
    _case("all_valid_no_drops",
          '{"sentences": ['
          '{"text": "Acme carries net leverage of 4.4x.", "chunk_ids": ["c1"]},'
          '{"text": "Beta operates in the same sector as Acme.", "chunk_ids": ["c2"]}]}',
          ["Acme carries net leverage of 4.4x.", "Beta operates in the same sector as Acme."],
          False),
    # Phase-4 golden expansion: fact-cited claims (the fact cross-reference gate).
    _case("fact_cited_figure_in_fact_numbers_survives",
          '{"sentences": [{"text": "Acme leverage rose to 4.6x from 4.2x.", "chunk_ids": [], '
          '"fact_ids": ["fact:i1:net_leverage:delta"]}]}',
          ["Acme leverage rose to 4.6x from 4.2x."], False, facts=[FACT]),
    _case("mixed_chunk_and_fact_citation_survives",
          '{"sentences": [{"text": "Acme leverage sits at 4.4x and rose 0.4x vs prior.", '
          '"chunk_ids": ["c1"], "fact_ids": ["fact:i1:net_leverage:delta"]}]}',
          ["Acme leverage sits at 4.4x and rose 0.4x vs prior."], False, facts=[FACT]),
    _case("fact_cited_word_only_claim_survives",
          '{"sentences": [{"text": "Acme leverage moved on the latest run.", "chunk_ids": [], '
          '"fact_ids": ["fact:i1:net_leverage:delta"]}]}',
          ["Acme leverage moved on the latest run."], False, facts=[FACT]),
]


@pytest.mark.parametrize("case", GOLDEN_CASES, ids=[c["name"] for c in GOLDEN_CASES])
def test_golden_gate_behavior(case):
    """The deterministic gates produce the frozen survivor set + drop reasons for
    each canned case. Drift in citation/numeric/fact-cross-reference fails CI."""
    reply = _AnswerReply.model_validate(first_json_object(case["reply_json"]))
    payload = _validate(reply, HITS, case["facts"])

    survivor_texts = [s["text"] for s in payload["sentences"]]
    assert survivor_texts == case["expected_survivors"], (
        f"{case['name']}: survivors {survivor_texts} != expected {case['expected_survivors']}")
    assert payload["unavailable"] is case["expected_unavailable"], (
        f"{case['name']}: unavailable {payload['unavailable']} != expected {case['expected_unavailable']}")

    # The drop-reason categories the self-correction loop would feed back. Each
    # expected substring must appear in at least one recorded reason.
    reasons = " ".join(payload.get("drop_reasons") or [])
    for substr in case["expected_drop_reason_substrings"]:
        assert substr in reasons, (
            f"{case['name']}: expected drop-reason '{substr}' not in {payload.get('drop_reasons')}")


def test_golden_drop_rate_is_well_defined():
    """drop_rate drives the self-correction retry; pin its semantics on a known
    case: 2 of 3 dropped → drop_rate 0.67 (> 0.5 → would retry)."""
    reply = _AnswerReply.model_validate(first_json_object(
        '{"sentences": ['
        '{"text": "Acme carries net leverage of 4.4x.", "chunk_ids": ["c1"]},'
        '{"text": "Acme levered up to 9.9x.", "chunk_ids": ["c1"]},'
        '{"text": "Acme is distressed.", "chunk_ids": []}]}'))
    payload = _validate(reply, HITS, [])
    assert payload["drop_rate"] == pytest.approx(2 / 3, abs=0.01)
    # All-valid case → drop_rate 0 (no retry would fire).
    reply_ok = _AnswerReply.model_validate(first_json_object(
        '{"sentences": [{"text": "Acme carries net leverage of 4.4x.", "chunk_ids": ["c1"]}]}'))
    assert _validate(reply_ok, HITS, [])["drop_rate"] == 0.0


# ── grounding_metrics (run-ledger aggregation) ───────────────────────────────

def _rec(lane, kept, dropped, status="success"):
    from types import SimpleNamespace
    return SimpleNamespace(lane=lane, kept_count=kept, dropped_count=dropped,
                           status=status)


def test_grounding_metrics_per_lane_and_overall():
    records = [
        _rec("query-answer", 4, 1),
        _rec("query-answer", 2, 3),
        _rec("query-entailment", 5, 0),
        _rec("query-answer-retry", 0, 2, status="success"),
        _rec("query-answer", 0, 0, status="failed"),
    ]
    m = grounding_metrics(records)
    # Overall: kept=4+2+5+0+0=11, dropped=1+3+0+2+0=6, n=5, failed=1.
    assert m["overall"]["kept"] == 11
    assert m["overall"]["dropped"] == 6
    assert m["overall"]["n"] == 5
    assert m["overall"]["failed"] == 1
    assert m["overall"]["precision"] == round(11 / 17, 4)

    # query-answer lane: kept=4+2+0=6, dropped=1+3+0=4 → precision 6/10.
    qa = m["by_lane"]["query-answer"]
    assert qa["kept"] == 6 and qa["dropped"] == 4
    assert qa["precision"] == round(6 / 10, 4)
    assert qa["n"] == 3 and qa["failed"] == 1

    # entailment lane: 5 kept, 0 dropped → precision 1.0.
    assert m["by_lane"]["query-entailment"]["precision"] == 1.0


def test_grounding_metrics_no_signal_is_none_not_zero():
    """A lane with no kept+dropped (e.g. a failed call before validation) has
    precision None, NOT 0 — distinguishing 'no signal' from 'all dropped'."""
    m = grounding_metrics([_rec("query-answer", 0, 0, status="failed")])
    assert m["overall"]["precision"] is None
    assert m["by_lane"]["query-answer"]["precision"] is None


def test_grounding_metrics_empty_records():
    m = grounding_metrics([])
    assert m["overall"] == {"kept": 0, "dropped": 0, "precision": None,
                            "n": 0, "failed": 0}
    assert m["by_lane"] == {}


def test_precision_trend_filters_by_lane():
    records = [
        _rec("query-answer", 4, 1),
        _rec("query-entailment", 5, 0),
        _rec("query-answer", 1, 2),
    ]
    trend = precision_trend(records, lane="query-answer")
    assert len(trend) == 2
    assert all(t["lane"] == "query-answer" for t in trend)
    assert trend[0]["precision"] == round(4 / 5, 4)
    assert trend[1]["precision"] == round(1 / 3, 4)
    # No lane filter → all records.
    assert len(precision_trend(records)) == 3


# ── dropped_claim_rate (the Phase-4 health metric) ───────────────────────────

def test_dropped_claim_rate_is_one_minus_precision():
    assert dropped_claim_rate({"kept": 8, "dropped": 2}) == 0.2
    assert dropped_claim_rate({"kept": 0, "dropped": 5}) == 1.0   # all dropped
    assert dropped_claim_rate({"kept": 5, "dropped": 0}) == 0.0   # all kept


def test_dropped_claim_rate_no_signal_is_none():
    """No kept+dropped → None, NOT 0 — 'no data' must be distinguishable from
    'all kept' so the health_check doesn't read an empty lane as healthy."""
    assert dropped_claim_rate({"kept": 0, "dropped": 0}) is None


# ── health_check (the drift alarm) ───────────────────────────────────────────

def test_health_check_flags_drifting_lane():
    # query-answer drops > half its claims (drift); query-entailment is healthy.
    records = [
        _rec("query-answer", 1, 4),
        _rec("query-answer", 2, 3),
        _rec("query-answer", 0, 5),
        _rec("query-entailment", 8, 1),
        _rec("query-entailment", 7, 1),
        _rec("query-entailment", 9, 0),
    ]
    h = health_check(records, drop_rate_threshold=0.5, min_n=3)
    flagged = {f["lane"] for f in h["flagged_lanes"]}
    assert flagged == {"query-answer"}  # entailment (1/17 dropped) not flagged
    assert h["flagged_lanes"][0]["dropped_claim_rate"] > 0.5
    assert h["overall_dropped_claim_rate"] is not None


def test_health_check_min_n_filters_small_samples():
    """A lane with < min_n calls isn't flagged even if its drop rate is high — a
    single noisy call shouldn't trip the alarm."""
    records = [_rec("query-answer", 0, 5), _rec("query-answer", 0, 5)]  # n=2 < min_n=3
    h = health_check(records, drop_rate_threshold=0.5, min_n=3)
    assert h["flagged_lanes"] == []


def test_health_check_empty_records():
    h = health_check([])
    assert h["flagged_lanes"] == []
    assert h["overall_dropped_claim_rate"] is None  # no signal
    assert h["threshold"] == 0.5 and h["min_n"] == 3


def test_health_check_no_flag_when_all_healthy():
    records = [_rec("query-answer", 5, 1), _rec("query-answer", 6, 1),
               _rec("query-answer", 4, 2)]  # drop rate 4/19 ≈ 0.21 < 0.5
    h = health_check(records, drop_rate_threshold=0.5, min_n=3)
    assert h["flagged_lanes"] == []
    assert h["overall_dropped_claim_rate"] < 0.5
