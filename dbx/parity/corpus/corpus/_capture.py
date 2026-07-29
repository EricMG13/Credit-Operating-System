"""Capture the B5 breadth-corpus fixtures (core-33 scope, EDGAR lanes).

ONE live SEC companyfacts fetch per manifest issuer, run manually — NOT in CI
(same discipline as ``../golden/_capture.py``, which this mirrors). Each dump
is trimmed to only the us-gaap concepts `engine.edgar_cp1` reads, so committed
fixtures stay tens of KB and the corpus runs keyless offline.

    EDGAR_USER_AGENT="you you@example.com" \
        caos/server/.venv311/bin/python caos/tests/server/corpus/_capture.py

Reported-lane names (VMO2, Altice France/SFR, Refresco, INEOS, Cirsa) are not
captured here: VMO2 reuses the golden reported-chunks fixture; the four
private issuers need owner-sourced bondholder documents (their IR portals are
not stable unauthenticated fetch targets) — see MANIFEST.md.

ponytail: capture script is throwaway-grade; the fixtures it writes are the asset.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
SERVER = HERE.parents[2] / "server"
sys.path.insert(0, str(SERVER))

from config import get_settings  # noqa: E402
from engine import edgar_cp1 as ec  # noqa: E402

FIXTURES = HERE / "fixtures"

# The manifest's core-33 EDGAR rows (ticker, entity, CIK) — CIKs as supplied
# by the analyst cohort; entity strings are display names for the CP-1 build.
ISSUERS = [
    # Software / Data & Analytics
    ("SSNC", "SS&C Technologies Holdings, Inc.", "0001004155"),
    ("OTEX", "Open Text Corporation", "0001062509"),
    ("GEN", "Gen Digital Inc.", "0000849399"),
    ("GDDY", "GoDaddy Inc.", "0001609711"),
    ("CLVT", "Clarivate Plc", "0001764046"),
    ("DNB", "Dun & Bradstreet Holdings, Inc.", "0001799208"),
    # Healthcare / Pharma
    ("BHC", "Bausch Health Companies Inc.", "0001300846"),
    ("THC", "Tenet Healthcare Corporation", "0000070318"),
    ("CYH", "Community Health Systems, Inc.", "0001108109"),
    ("AVTR", "Avantor, Inc.", "0001758632"),
    ("ELAN", "Elanco Animal Health Incorporated", "0001739940"),
    ("OGN", "Organon & Co.", "0001840776"),
    # Telecom / Cable / Media
    ("ATUS", "Altice USA, Inc.", "0001702780"),
    ("CHTR", "Charter Communications, Inc.", "0001091667"),
    ("LUMN", "Lumen Technologies, Inc.", "0000018926"),
    ("LBTYA", "Liberty Global Ltd.", "0001570585"),
    ("SBGI", "Sinclair, Inc.", "0000812011"),
    # Industrials / Materials / Packaging
    ("TDG", "TransDigm Group Incorporated", "0001260221"),
    ("BERY", "Berry Global Group, Inc.", "0001378992"),
    ("AXTA", "Axalta Coating Systems Ltd.", "0001616862"),
    ("BLDR", "Builders FirstSource, Inc.", "0001009829"),
    ("CC", "The Chemours Company", "0001627223"),
    # Gaming / Leisure / Travel
    ("CZR", "Caesars Entertainment, Inc.", "0001590895"),
    ("ARMK", "Aramark", "0001573297"),
    ("PENN", "PENN Entertainment, Inc.", "0000892013"),
    ("HGV", "Hilton Grand Vacations Inc.", "0001676936"),
    ("UAL", "United Airlines Holdings, Inc.", "0000100517"),
    ("BYD", "Boyd Gaming Corporation", "0000906553"),
]

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
    FIXTURES.mkdir(exist_ok=True)
    ok, failed = [], []
    for ticker, name, cik in ISSUERS:
        try:
            try:
                facts = ec.edgar._get_json(ec._FACTS_URL.format(cik=cik))
            except Exception:
                # Manifest CIKs are analyst-supplied; on a 404 re-resolve from
                # the live ticker map (the golden capture's approach).
                live_cik = ec.resolve_cik(ticker)
                if not live_cik or live_cik == cik:
                    raise
                print(f"   {ticker}: manifest CIK {cik} → resolved {live_cik}")
                facts = ec.edgar._get_json(ec._FACTS_URL.format(cik=live_cik))
            trimmed = _trim(facts)
            payload = ec.build_cp1_payload(name, trimmed)
            out = FIXTURES / f"{ticker.lower()}_facts.json"
            out.write_text(json.dumps(trimmed, separators=(",", ":")))
            size = out.stat().st_size / 1024
            if payload is None:
                print(f"?? {ticker}: fixture written ({size:.0f} KB) but "
                      f"build_cp1_payload → None — investigate before committing")
                failed.append(ticker)
            else:
                nf = payload.runtime_output["normalized_financials"]
                print(f"ok {ticker} ({size:.0f} KB) rev={nf.get('revenue')} "
                      f"lev={nf.get('net_leverage_adj_ltm')}")
                ok.append(ticker)
        except Exception as exc:  # noqa: BLE001 — batch capture must finish
            print(f"!! {ticker}: {type(exc).__name__}: {exc}")
            failed.append(ticker)
        time.sleep(0.6)  # SEC fair-access pacing
    print(f"\ncaptured {len(ok)}/{len(ISSUERS)}; failed: {failed or 'none'}")


if __name__ == "__main__":
    main()
