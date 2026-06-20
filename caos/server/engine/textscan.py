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


def amount_musd(text: str, keyword: re.Pattern) -> Optional[float]:
    """First dollar amount within ~120 chars of a keyword hit, normalised to $M.

    Returns None when the keyword or an adjacent amount is absent — the caller
    records the qualitative hit and leaves the quantum null (never invented).
    """
    # ponytail: nearest-amount-in-window heuristic — two keywords+amounts co-located
    # in one sentence misattribute. Real agreement packs chunk tranches separately;
    # upgrade to table/clause parsing only if a real pack needs tighter precision.
    m = keyword.search(text)
    if not m:
        return None
    window = text[max(0, m.start() - 120): m.end() + 120]
    a = _AMOUNT.search(window)
    if not a:
        return None
    val = float(a.group(1).replace(",", ""))
    return round(val * 1000, 1) if a.group(2).lower() in ("billion", "bn") else round(val, 1)


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
