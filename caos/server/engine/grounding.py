"""Numeric grounding gate — shared by the Query AI lanes (insights + answers).

The CP-5 finding-gate discipline applied to generated prose: an AI card or
sentence may only assert a number that appears in the evidence it cites. A model
that invents "+0.6x" when the cited fact says "+0.4x" has that claim DROPPED, not
shown. Formatting-tolerant (thousands separators, 1-dp rounding, trailing
%/x/$/bps suffixes) so a reworded-but-correct figure survives; anything that does
not round-match a cited number fails closed.

Pure functions, no I/O — unit-tested in isolation. This is the one place a
generated numeral is checked against its source, so both lanes reuse it rather
than each re-deriving a (subtly different) gate.
"""

from __future__ import annotations

import re
from typing import Iterable, List

# A numeral: optional sign, digits with optional thousands separators, optional
# decimal. Deliberately does NOT swallow a trailing %/x/bps — those are units, and
# "40%" and "40" must ground against the same cited "40".
_NUM_RE = re.compile(r"-?\d[\d,]*(?:\.\d+)?")

# Absolute slack for representation differences only (e.g. a cited 4.25 restated
# as "4.3"). Tight on purpose: a genuinely different figure must fail. Larger
# gaps are only tolerated via same-1dp-rounding below, never widened here.
_ABS_SLACK = 0.05


def numbers_in(text: str) -> List[float]:
    """Every numeral in ``text`` as a float (commas stripped). Non-parseable
    tokens are skipped rather than raising, so scanning free text is safe."""
    out: List[float] = []
    for tok in _NUM_RE.findall(text or ""):
        try:
            out.append(float(tok.replace(",", "")))
        except ValueError:
            continue
    return out


def _matches(n: float, pool: List[float]) -> bool:
    """True when ``n`` round-matches some cited number: exact, equal to 1 dp, or
    within a hair (formatting slack). Fail-closed on everything else."""
    for a in pool:
        if n == a or round(n, 1) == round(a, 1) or abs(n - a) <= _ABS_SLACK:
            return True
    return False


def all_grounded(text: str, allowed: Iterable) -> bool:
    """True iff every numeral in ``text`` is grounded in ``allowed``.

    ``allowed`` may mix floats/ints (exact cited values) and strings (free text
    scanned for the numbers it contains, e.g. a cited chunk or pack entry). Text
    with no numerals is trivially grounded — the gate only constrains figures the
    model states, never its wording.
    """
    pool: List[float] = []
    for a in allowed:
        if isinstance(a, bool):  # bool is an int subclass — never a cited figure
            continue
        if isinstance(a, (int, float)):
            pool.append(float(a))
        else:
            pool.extend(numbers_in(str(a)))
    return all(_matches(n, pool) for n in numbers_in(text))


def demo() -> None:
    # Grounded: exact, 1-dp restatement, and unit-suffixed all pass.
    assert all_grounded("leverage rose to 4.3x", [4.25])  # 4.25 restated as 4.3
    assert all_grounded("2 of 15 names", ["2 findings across 15 issuers"])
    assert all_grounded("margin held at 41.0%", [41.0])
    assert all_grounded("no numbers here", [])  # nothing to ground
    # Fail-closed: an invented figure with no cited source is rejected.
    assert not all_grounded("leverage rose to 6.1x", [4.25])
    assert not all_grounded("WARF drifted to 1400", [1350])
    # bool must not be treated as the number 1/0.
    assert not all_grounded("1 finding", [True])
    print("grounding demo OK")


if __name__ == "__main__":
    demo()
