"""Shared chunk scanner for the document-grounded modules (CP-2D/2E/3B/4).

One pass over ``(chunk_id, text)`` pairs, matching each entry in a pattern table
at most once (deduped by its key field), case-insensitively. The per-module
pattern tables and the shape of what each records stay in those modules; only the
scan-and-dedupe loop lives here.
"""

from __future__ import annotations

import re
from typing import Iterable, Iterator, Sequence, Tuple


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
