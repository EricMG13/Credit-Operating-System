"""Regenerate the golden-issuer XBRL fixtures (Phase-0 drift alarm).

ONE live SEC fetch per issuer, run manually — NOT in CI. It trims the multi-MB
companyfacts JSON down to only the us-gaap concepts `engine.edgar_cp1` actually
reads (≈20 tags), so the committed fixture is tens of KB, and prints the computed
CP-1 so you can freeze the expected values in `test_golden_cp1.py`.

    EDGAR_USER_AGENT="you you@example.com" \
        caos/server/.venv/bin/python caos/tests/server/golden/_capture.py

ponytail: capture script is throwaway-grade; the fixture it writes is the asset.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SERVER = HERE.parents[2] / "server"
sys.path.insert(0, str(SERVER))

from config import get_settings  # noqa: E402
from engine import edgar_cp1 as ec  # noqa: E402

# The seed arc. VMO2 is non-US (no SEC companyfacts) — it needs the reported-doc
# lane, not EDGAR; add it there, not here.
ISSUERS = [
    ("VSAT", "Viasat, Inc."),
    ("FUN", "Six Flags Entertainment Corporation"),
]

# Every us-gaap concept the builder consults — keep only these from the dump.
KEEP = {c for grp in (
    ec._REVENUE, ec._OP_INCOME, ec._DA, ec._DEPRECIATION, ec._AMORTIZATION,
    ec._IMPAIRMENT, ec._INTEREST, ec._LT_DEBT, ec._DEBT_CURRENT, ec._CASH,
    ec._TOTAL_ASSETS, ec._CURRENT_ASSETS, ec._CURRENT_LIAB, ec._RETAINED,
    ec._TOTAL_LIAB, ec._EQUITY) for c in grp}


def _trim(facts: dict) -> dict:
    us = (facts.get("facts") or {}).get("us-gaap") or {}
    return {
        "entityName": facts.get("entityName"),
        "facts": {"us-gaap": {k: v for k, v in us.items() if k in KEEP}},
    }


def main() -> None:
    if not get_settings().edgar_user_agent.strip():
        sys.exit("Set EDGAR_USER_AGENT (e.g. 'Name you@example.com') — EDGAR lane is gated on it.")
    for ticker, name in ISSUERS:
        cik = ec.resolve_cik(ticker)
        if not cik:
            print(f"!! {ticker}: not an SEC filer — skipping (use the reported-doc lane)")
            continue
        facts = ec.edgar._get_json(ec._FACTS_URL.format(cik=cik))
        trimmed = _trim(facts)
        out = HERE / f"{ticker.lower()}_facts.json"
        out.write_text(json.dumps(trimmed, separators=(",", ":")))
        payload = ec.build_cp1_payload(name, trimmed)
        size = out.stat().st_size / 1024
        print(f"\n== {ticker} ({name}) CIK {cik} → {out.name} ({size:.0f} KB) ==")
        if payload is None:
            print("   build_cp1_payload → None (no usable revenue series)")
            continue
        nf = payload.runtime_output["normalized_financials"]
        print("   revenue:   ", nf.get("revenue"))
        print("   adj_ebitda:", nf.get("adj_ebitda"))
        print("   net_debt:  ", nf.get("net_debt_ltm"))
        print("   leverage:  ", nf.get("net_leverage_adj_ltm"))
        print("   coverage:  ", nf.get("interest_coverage_ltm"))
        print("   distress:  ", payload.runtime_output.get("distress"))
        print("   concepts:  ", payload.runtime_output.get("xbrl_concepts"))


if __name__ == "__main__":
    main()
