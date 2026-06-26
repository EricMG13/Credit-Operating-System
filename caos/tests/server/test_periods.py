"""#10: period ordering must be width-agnostic. year() reads a trailing 2-4 digit
year; a raw 2-digit value (LTM_Q1_26 -> 26) used to sort BELOW a 4-digit one
(FY2024 -> 2024), so latest() (and the six other year()-ordered consumers:
liquidity, metrics, earnings, peers, capstructure, macro) picked the STALE fiscal
year as 'latest', feeding wrong recovery EV / runway / margins. year() now
normalises 2-digit years to 4 digits so the comparison is correct."""
from engine.periods import latest, year


def test_year_normalises_two_digit_to_four():
    assert year("FY2024") == 2024
    assert year("LTM_Q1_26") == 2026
    assert year("FY24") == 2024
    assert year("Q1 2026") == 2026
    assert year("no digits here") == -1


def test_latest_picks_true_latest_across_mixed_widths():
    # The bug: LTM_Q1_26 (26) < FY2024 (2024) → latest() wrongly returned 100.
    assert latest({"FY2024": 100.0, "FY2023": 90.0, "LTM_Q1_26": 200.0}) == 200.0
    # All-4-digit and all-2-digit series are unaffected.
    assert latest({"FY2023": 90.0, "FY2024": 100.0}) == 100.0
    assert latest({"FY23": 90.0, "FY24": 100.0}) == 100.0
    assert latest({}) is None
