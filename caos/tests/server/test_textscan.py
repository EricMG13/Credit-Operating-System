"""#11: amount_musd must bind a keyword to the amount in its OWN clause, not the
preceding tranche's. The old 'first amount in a ±120 window' rule grabbed
whichever amount appeared earliest in reading order, so when several tranches
share one chunk (the chunker packs a whole cap-structure paragraph into one), a
Second Lien inherited the First Lien's size."""
import re

from engine.textscan import amount_musd


def _kw(s):
    return re.compile(s, re.IGNORECASE)


def test_single_amount_before_keyword():
    # The legacy behaviour for the simple case must be preserved.
    assert amount_musd("a $1.2 billion revolver", _kw("revolver")) == 1200.0


def test_multi_tranche_one_chunk_amount_follows_keyword():
    text = (
        "The First Lien Term Loan in an aggregate principal amount of $500.0 million. "
        "The Second Lien Term Loan in an aggregate principal amount of $200.0 million. "
        "A revolving credit facility of $150.0 million."
    )
    assert amount_musd(text, _kw("first lien term loan")) == 500.0
    # The old rule returned 500.0 here (preceding tranche) — the bug.
    assert amount_musd(text, _kw("second lien term loan")) == 200.0
    assert amount_musd(text, _kw("revolving credit facility")) == 150.0


def test_multi_tranche_one_chunk_amount_precedes_keyword():
    text = "A $750.0 million senior secured first lien term loan; a $250.0 million second lien note."
    assert amount_musd(text, _kw("first lien term loan")) == 750.0
    assert amount_musd(text, _kw("second lien note")) == 250.0


def test_no_in_clause_amount_returns_none():
    # The amount is in a different sentence (after a terminator) → not attributed.
    assert amount_musd("The term loan B is undrawn. Separately, $99 million of notes.", _kw("term loan b")) is None


def test_billion_normalises_to_musd():
    assert amount_musd("first lien term loan of $1.5 billion", _kw("first lien term loan")) == 1500.0
