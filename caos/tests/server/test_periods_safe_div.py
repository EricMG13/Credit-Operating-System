"""safe_div — the structural CP-1 divide-guard (spec P0).

``safe_div`` concentrates the finite-plus-nonzero-denominator idiom that
CLAUDE.md requires in front of every CP-1 arithmetic. It returns
``numerator / denominator`` as a float only when BOTH operands are finite
(``is_finite_number``) AND the denominator is non-zero; otherwise ``None``.
``bool`` is accepted (it is an ``int`` subclass). Scaling the numerator before
the call keeps the arithmetic order (``(scale*num)/den``) bitwise-identical to
the migrated call sites."""

from engine.periods import safe_div


def test_plain_division():
    assert safe_div(4, 2) == 2.0


def test_nan_numerator_degrades_to_none():
    assert safe_div(float("nan"), 2) is None


def test_zero_denominator_degrades_to_none():
    assert safe_div(1, 0) is None


def test_inf_denominator_degrades_to_none():
    assert safe_div(1, float("inf")) is None


def test_bool_accepted_as_int():
    assert safe_div(True, 2) == 0.5


def test_scaled_numerator_preserves_arithmetic():
    assert safe_div(100 * 3, 4) == 75.0
