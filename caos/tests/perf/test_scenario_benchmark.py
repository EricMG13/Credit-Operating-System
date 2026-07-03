"""Tiny benchmark guard for the deterministic scenario mapper."""

from __future__ import annotations

import time

from scenario import _demo_translate, validate_scenario


CASES = [
    "rates back up 250bps and refinancing spreads widen",
    "base rates fall 100bps but demand recession hits volumes",
    "sponsor pushes growth capex while margins compress 150bps",
    "pricing improves and demand recovery accelerates",
    "oil shock, margins compress, rates rise 100bps",
    "spreads tighten 75bps after refinancing clears",
    "base rate relief 100bps offsets flat demand",
    "raw material deflation lifts gross margin",
    "management cuts capex by 150bps to preserve liquidity",
    "margins compress 150bps",
    "volume recovery with pricing power",
]


def test_demo_translate_realistic_corpus_stays_local_and_fast():
    start = time.perf_counter()
    for _ in range(100):
        for text in CASES:
            validate_scenario(_demo_translate(text))
    elapsed_ms = (time.perf_counter() - start) * 1000
    assert elapsed_ms < 100
