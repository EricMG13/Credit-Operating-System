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


def test_non_usd_amounts_degrade_to_null_quantum():
    # "£1,250 million" used to return 1250.0 into a *_musd field — a GBP
    # magnitude under a $M label (triage 2026-07-16 P2). Non-$ symbols degrade;
    # $-prefixed and symbol-less (in-$M table row) amounts still parse.
    import re

    from engine.textscan import amount_musd

    rcf = re.compile(r"revolving credit facilit|\brcf\b|revolver", re.IGNORECASE)
    assert amount_musd("The £1,250 million revolving credit facility remains undrawn.", rcf) is None
    assert amount_musd("The €500 million revolving credit facility.", rcf) is None
    assert amount_musd("The $1,250 million revolving credit facility.", rcf) == 1250.0
    assert amount_musd("A 750 million revolving credit facility.", rcf) == 750.0
    assert amount_musd("The $1.5 billion revolver.", rcf) == 1500.0
