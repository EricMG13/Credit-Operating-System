"""The numeric grounding gate (engine/grounding.py) — the CP-5 finding-gate
discipline for generated prose. A stated figure survives only if it round-matches
a cited number; an invented figure fails closed."""

from __future__ import annotations

from engine.grounding import all_grounded, numbers_in


def test_numbers_in_parses_and_skips_junk():
    assert numbers_in("leverage 4.3x, margin 41.0%, WARF 1,350") == [4.3, 41.0, 1350.0]
    assert numbers_in("no digits") == []
    assert numbers_in("") == []


def test_grounded_exact_and_reformatted():
    assert all_grounded("leverage at 4.30x", [4.3])
    assert all_grounded("WARF 1350", ["band Ba2 at 1,350"])  # comma-formatted source
    # 4.25 restated as 4.3 (rounded representation) — tolerated.
    assert all_grounded("rose to 4.3x", [4.25])


def test_invented_number_fails_closed():
    assert not all_grounded("leverage jumped to 6.1x", [4.25])
    assert not all_grounded("WARF drifted to 1400", [1350])
    # One good number + one invented number → the whole claim fails.
    assert not all_grounded("2 of 15 names, up 3 notches", [2.0, 15.0])


def test_wordy_claim_with_no_numbers_passes():
    assert all_grounded("leverage thinned across the book", [])
    assert all_grounded("two names share the theme", ["several issuers"])  # word, not numeral


def test_bool_is_not_a_cited_number():
    # bool is an int subclass — it must never satisfy a numeric claim.
    assert not all_grounded("1 open finding", [True])


def test_mixed_pool_floats_and_text():
    allowed = [4.4, "coverage 3.2x on the latest run", 12]
    assert all_grounded("leverage 4.4x, coverage 3.2x, 12 modules", allowed)
    assert not all_grounded("leverage 4.4x, coverage 9.9x", allowed)
