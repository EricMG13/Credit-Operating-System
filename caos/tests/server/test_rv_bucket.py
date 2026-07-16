"""RV screen rating-cohort bucketing + finite gate (triage 2026-07-16 P2/P3)."""

from __future__ import annotations

import math

from routes.rv import _number, _rating_bucket


def test_sp_modifier_ratings_bucket_to_their_own_notch():
    # Substring order: "BB-" contains "BB" — a base-first scan bucketed the
    # weakest modifier ratings one notch senior, pooling BB-/CCC- names with a
    # tighter-spread cohort and overstating their DM pickup.
    assert _rating_bucket("BB-") == "Ba3"
    assert _rating_bucket("CCC-") == "Caa3"
    assert _rating_bucket("BB+") == "Ba1"
    assert _rating_bucket("BB") == "Ba2"
    assert _rating_bucket("CCC+") == "Caa1"
    assert _rating_bucket("CCC") == "Caa2"
    # Moody's tokens still win outright on dual-source strings.
    assert _rating_bucket("Ba3/BB-") == "Ba3"
    assert _rating_bucket(None) == "NR"


def test_number_rejects_non_finite():
    assert _number(float("nan")) is None
    assert _number(float("inf")) is None
    assert _number(True) is None
    assert _number(101.25) == 101.25
    assert _number(0) == 0.0
    assert not any(v is not None and math.isnan(v) for v in map(_number, [float("nan")]))
