"""Shared chunk scanner for the document-grounded modules (CP-2D/2E/3B/4).

One pass over ``(chunk_id, text)`` pairs, matching each entry in a pattern table
at most once (deduped by its key field), case-insensitively. The per-module
pattern tables and the shape of what each records stay in those modules; only the
scan-and-dedupe loop lives here.
"""

from __future__ import annotations

import math
import re
from typing import Iterable, Iterator, Optional, Sequence, Tuple

# "$1,234.5 million / billion / m / bn" → normalised to $M. Require a leading DIGIT
# (\d[\d,]*) so a lone/leading comma can't match — "[\d,]+" would capture "," and
# float("") then raised ValueError, losing a whole CP-2E/3B module to one malformed
# sentence (the runner's per-module catch contains it, but it's still a lost module).
# The currency symbol is CAPTURED, not optional-and-ignored: "£1,250 million" used
# to land as amount_musd=1250.0 — a GBP magnitude under a $M label in the tranche/
# liquidity registers (triage 2026-07-16 P2). A non-$ symbol now degrades to the
# qualitative-hit path (quantum null), per "degrade, never guess"; a symbol-less
# amount stays accepted (in-$M table rows).
_AMOUNT = re.compile(r"(?:([£€$])\s?)?(\d[\d,]*(?:\.\d+)?)\s*(billion|bn|million|m)\b", re.IGNORECASE)

# Clause terminators: an amount on the far side of one of these belongs to a
# different sentence/tranche, so the keyword's clause stops here. A period is a
# terminator only when NOT a decimal point (so "$1.2 billion" / "$500.0m" stay
# intact); `;` and newlines always terminate.
_TERMINATOR = re.compile(r"[;\n]|\.(?!\d)")
# How far from the keyword to look within its clause before giving up.
_CLAUSE_GAP = 200


def _to_musd(a: "re.Match[str]") -> Optional[float]:
    # A captured non-$ currency symbol means the figure is NOT in USD millions —
    # returning it under a *_musd field mislabeled every absolute magnitude for a
    # non-USD issuer. Degrade to the qualitative hit instead (the ratios that
    # matter — recovery %, % of structure, runway — never needed the label).
    if a.group(1) and a.group(1) != "$":
        return None
    # Defensive try/except (belt-and-suspenders behind the leading-digit _AMOUNT
    # regex): never let a surprising capture raise into a caller with no try/except
    # (liquidity/capstructure/sponsor) — return None so the caller records the
    # qualitative hit with a null quantum instead of losing the module.
    try:
        val = float(a.group(2).replace(",", ""))
    except ValueError:
        return None
    out = round(val * 1000, 1) if a.group(3).lower() in ("billion", "bn") else round(val, 1)
    # `[\d,]+` is unbounded: a garbage 309+-digit run parses to inf. Every current
    # consumer re-filters is_finite_number, but enforce the contract at the source
    # so a future consumer can't inherit an inf quantum.
    return out if math.isfinite(out) else None


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
            v = _to_musd(fwd)
            if v is not None:
                return v
        prev = None
        for prev in _AMOUNT.finditer(text, left, km.start()):
            pass  # nearest amount before the keyword, still inside the clause
        if prev:
            v = _to_musd(prev)
            if v is not None:
                return v
    return None


def scan(chunks: Iterable[Tuple[str, str]], patterns: Sequence[tuple], key: int = 0
         ) -> Iterator[Tuple[tuple, str, str]]:
    """Yield ``(pattern, chunk_id, text)`` for the first chunk each pattern hits.

    ``pattern[key]`` is the dedup id; ``pattern[-1]`` is the regex (matched against
    the chunk text case-insensitively). ``text`` is yielded raw so callers that need the
    original (e.g. to read a dollar amount near the hit) can post-process.
    """
    seen: set = set()
    compiled = [
        pat[-1] if isinstance(pat[-1], re.Pattern) else re.compile(pat[-1], re.IGNORECASE)
        for pat in patterns
    ]

    for chunk_id, text in chunks:
        raw_text = text or ""
        for i, pat in enumerate(patterns):
            pid = pat[key]
            if pid not in seen and compiled[i].search(raw_text):
                seen.add(pid)
                yield pat, chunk_id, text
