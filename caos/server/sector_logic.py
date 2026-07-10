"""Deterministic helpers for the Sector Review substrate."""

from __future__ import annotations

import hashlib

_SEVERITY_BASE = {
    "critical": 0.95,
    "high": 0.78,
    "medium": 0.55,
    "low": 0.28,
}

_CATEGORY_BONUS = {
    "rating": 0.07,
    "liquidity": 0.06,
    "earnings": 0.05,
    "covenant": 0.05,
    "technical": 0.03,
    "macro": 0.02,
}

_SOURCE_BONUS = {
    "internal_doc": 0.05,
    "edgar": 0.04,
    "external_seed": 0.02,
    "seed": 0.0,
}


def sector_signal_dedup_hash(
    sector: str,
    headline: str,
    source_ref: str,
    event_date: str | None = None,
) -> str:
    raw = "|".join([
        sector.strip().lower(),
        " ".join(headline.strip().lower().split()),
        source_ref.strip().lower(),
        (event_date or "").strip(),
    ])
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def sector_materiality_score(
    severity: str,
    category: str,
    issuer_count: int,
    source_tier: str,
) -> float:
    base = _SEVERITY_BASE.get(severity.lower(), 0.35)
    category_bonus = _CATEGORY_BONUS.get(category.lower(), 0.0)
    breadth_bonus = min(max(issuer_count, 0), 5) * 0.025
    source_bonus = _SOURCE_BONUS.get(source_tier.lower(), 0.0)
    return round(min(0.99, base + category_bonus + breadth_bonus + source_bonus), 3)
