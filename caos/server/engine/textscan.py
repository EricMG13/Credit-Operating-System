"""Shared chunk scanner for the document-grounded modules (CP-2D/2E/3B/4).

One pass over ``(chunk_id, text)`` pairs, matching each entry in a pattern table
at most once (deduped by its key field), case-insensitively. The per-module
pattern tables and the shape of what each records stay in those modules; only the
scan-and-dedupe loop lives here.
"""

from __future__ import annotations

import re
from typing import Iterable, Iterator, Optional, Sequence, Tuple

# "$1,234.5 million / billion / m / bn" → normalised to $M.
_AMOUNT = re.compile(r"\$?\s?([\d,]+(?:\.\d+)?)\s*(billion|bn|million|m)\b", re.IGNORECASE)

# Clause terminators: an amount on the far side of one of these belongs to a
# different sentence/tranche, so the keyword's clause stops here. A period is a
# terminator only when NOT a decimal point (so "$1.2 billion" / "$500.0m" stay
# intact); `;` and newlines always terminate.
_TERMINATOR = re.compile(r"[;\n]|\.(?!\d)")
# How far from the keyword to look within its clause before giving up.
_CLAUSE_GAP = 200


def _to_musd(a: "re.Match[str]") -> float:
    val = float(a.group(1).replace(",", ""))
    return round(val * 1000, 1) if a.group(2).lower() in ("billion", "bn") else round(val, 1)


def _clause_bounds(text: str, kstart: int, kend: int) -> Tuple[int, int]:
    """[left, right) of the keyword's clause: bounded by the nearest terminator on
    each side (or _CLAUSE_GAP). Amounts outside this belong to another tranche."""
    lo = max(0, kstart - _CLAUSE_GAP)
    last_term = None
    for last_term in _TERMINATOR.finditer(text, lo, kstart):
        pass  # walk to the last terminator before the keyword
    left = last_term.end() if last_term else lo
    hi = min(len(text), kend + _CLAUSE_GAP)
    nxt = _TERMINATOR.search(text, kend, hi)
    right = nxt.start() if nxt else hi
    return left, right


def amount_musd(text: str, keyword: re.Pattern) -> Optional[float]:
    """Dollar amount bound to a keyword hit, normalised to $M — the amount in the
    keyword's own clause, preferring the one that FOLLOWS it.

    Returns None when the keyword or an in-clause amount is absent — the caller
    records the qualitative hit and leaves the quantum null (never invented).

    Why not "first amount in a ±120 window" (the previous rule): the chunker packs
    a whole 'Description of Indebtedness' paragraph into one chunk, so several
    tranches sit together. First-in-window then grabbed whichever amount appeared
    earliest in reading order — systematically the *preceding* tranche's figure
    ("…First Lien $500m. Second Lien…" → Second Lien inherits $500m). Binding to
    the amount in the keyword's clause, after-first ("Term Loan of $500m"), then
    the nearest one before it within the clause ("$500m first lien term loan"),
    fixes the misattribution.
    ponytail: clause = split on . ; newline — not a real table/grammar parser;
    upgrade to clause-grammar or table extraction only if a real pack needs it."""
    for km in keyword.finditer(text):
        left, right = _clause_bounds(text, km.start(), km.end())
        fwd = _AMOUNT.search(text, km.end(), right)
        if fwd:
            return _to_musd(fwd)
        prev = None
        for prev in _AMOUNT.finditer(text, left, km.start()):
            pass  # nearest amount before the keyword, still inside the clause
        if prev:
            return _to_musd(prev)
    return None


def scan(chunks: Iterable[Tuple[str, str]], patterns: Sequence[tuple], key: int = 0
         ) -> Iterator[Tuple[tuple, str, str]]:
    """Yield ``(pattern, chunk_id, text)`` for the first chunk each pattern hits.

    ``pattern[key]`` is the dedup id; ``pattern[-1]`` is the regex (matched against
    the lower-cased chunk text). ``text`` is yielded raw so callers that need the
    original (e.g. to read a dollar amount near the hit) can post-process.
    """
    seen: set = set()
    for chunk_id, text in chunks:
        low = (text or "").lower()
        for pat in patterns:
            if pat[key] not in seen and re.search(pat[-1], low):
                seen.add(pat[key])
                yield pat, chunk_id, text
