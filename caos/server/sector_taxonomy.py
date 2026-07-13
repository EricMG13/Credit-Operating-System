"""Canonical sector taxonomy and alias resolution used across adapters."""

from __future__ import annotations

import re

CANONICAL_SECTORS: dict[str, tuple[str, tuple[str, ...]]] = {
    "automotive": ("Automotive", ("auto", "autos")),
    "business-services": ("Business Services", ("services", "b2b services")),
    "chemicals": ("Chemicals", ("chemical",)),
    "consumer": ("Consumer", ("consumer products", "retail", "consumer discretionary", "consumer staples")),
    "energy": ("Energy", ("oil and gas", "o&g")),
    "financials": ("Financials", ("financial services", "fig")),
    "food-beverage": ("Food & Beverage", ("food and beverage", "f&b")),
    "gaming-leisure": ("Gaming & Leisure", ("gaming", "leisure", "entertainment")),
    "healthcare": ("Healthcare", ("health care",)),
    "industrials": ("Industrials", ("industrial",)),
    "media": ("Media", ("media and entertainment", "communication services")),
    "materials": ("Materials", ("basic materials",)),
    "metals-mining": ("Metals & Mining", ("metals and mining", "mining")),
    "packaging": ("Packaging", ("containers and packaging",)),
    "real-estate": ("Real Estate", ("property",)),
    "software": ("Software", ("technology", "tech", "information technology", "it services", "technology hardware")),
    "telecom": ("Telecom", ("telecommunications", "telecoms", "cable telecom")),
    "transportation": ("Transportation", ("transport", "logistics")),
    "utilities": ("Utilities", ("utility",)),
}


def _key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")


_ALIASES = {
    _key(alias): sector_id
    for sector_id, (label, aliases) in CANONICAL_SECTORS.items()
    for alias in (sector_id, label, *aliases)
}


def canonical_sector_id(value: str | None) -> str | None:
    if not value:
        return None
    return _ALIASES.get(_key(value))
