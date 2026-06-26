"""metrics._headline_period (review run-2026-06-26 #3): an explicit LTM/trailing
period is the headline; among candidates pick the MOST RECENT (total order), not
whichever happened to come first in iteration."""
from engine.metrics import _headline_period


def test_headline_prefers_ltm_over_annual():
    assert _headline_period(["FY2024", "FY2025", "LTM_Q1_2026"]) == "LTM_Q1_2026"


def test_headline_most_recent_ltm_not_first():
    # Two LTM snapshots → the most recent, not ltm[0] (the old bug).
    assert _headline_period(["LTM_Q1_2025", "LTM_Q3_2025"]) == "LTM_Q3_2025"


def test_headline_most_recent_annual_when_no_ltm():
    assert _headline_period(["FY2023", "FY2025", "FY2024"]) == "FY2025"


def test_headline_same_year_quarters():
    assert _headline_period(["Q1 2026", "Q3 2026", "Q2 2026"]) == "Q3 2026"


def test_headline_empty():
    assert _headline_period([]) is None
