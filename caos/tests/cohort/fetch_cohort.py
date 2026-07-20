"""Fetch the leveraged-loan test cohort from SEC EDGAR (Phase-1/3 sample corpus).

Thin glue over ``server/edgar.py`` (throttled, UA-gated, SSRF-safe, stdlib-only).
For each US filer in the cohort CSV it pulls, into ``<out>/<TICKER>/``:

  financials/   10-K + 10-Q filed in the date window (default 2022-01-01..2025-12-31)
  legal/        8-K exhibits classified "Credit Agreement" / amendment (EX-10.x)

and writes ``manifest.json`` (issuer · form · date · accession · label · url · path).

Documented ceilings (lazy on purpose):
  * IR presentation decks are NOT fetched — 30 bespoke, mostly JS-rendered IR
    sites is a fragile scraper + a new bs4 dep. The earnings decks are on EDGAR as
    8-K EX-99; pass --ex99 to grab those instead.
  * Non-US filers (VMO2, Refresco — no CIK) are skipped and logged → reported-doc lane.
  * The submissions API exposes the most-recent ~1000 filings; a very prolific
    filer may not reach back to the window start (older filings are paginated).
    The script logs when a filer's oldest 'recent' filing is inside the window.

    EDGAR_USER_AGENT="Name you@example.com" \\
      caos/server/.venv/bin/python caos/tests/cohort/fetch_cohort.py \\
      [--only SSNC,OTEX] [--dry-run] [--financials-only] [--max-8k 80] [--ex99]
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "server"))

import edgar  # noqa: E402  — reused HTTP/throttle/classify lane

DEFAULT_FROM, DEFAULT_TO = "2022-01-01", "2025-12-31"
FINANCIAL_FORMS = ["10-K", "10-Q"]
# Legal exhibits worth keeping: the CP-4 governing-doc ranks (credit agreement,
# indenture, amendment, intercreditor, security/guarantee), plus a name match on
# the material-contract exhibit slots the user called out.
_LEGAL_LABELS = {"Credit Agreement", "Amendment / A&R", "Intercreditor Agreement",
                 "Security / Guarantee Agreement", "Indenture", "Supplemental Indenture"}
_EX10_RE = re.compile(r"ex-?10[._]?[12]\b", re.I)


# ── pure, offline-testable predicates ────────────────────────────────────────
def in_window(date_str: str, lo: str, hi: str) -> bool:
    """ISO date string within [lo, hi] (lexical compare is correct for YYYY-MM-DD)."""
    return bool(date_str) and lo <= date_str <= hi


def keep_legal_exhibit(ex: "edgar.Exhibit") -> bool:
    """A governing credit document (by CP-4 classification) or an EX-10.1/10.2 slot."""
    return ex.doc_label in _LEGAL_LABELS or bool(_EX10_RE.search(ex.name))


def keep_ex99(ex: "edgar.Exhibit") -> bool:
    return ex.doc_label.startswith("Marketing / Press") or "ex-99" in ex.name.lower()


def _safe(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)[:120]


# ── fetch one issuer ─────────────────────────────────────────────────────────
def fetch_issuer(row: dict, out: Path, lo: str, hi: str, *, dry: bool,
                 financials_only: bool, max_8k: int, ex99: bool) -> list[dict]:
    ticker = row["Ticker"].strip()
    name = row["Issuer"].strip()
    cik = row["CIK"].strip()
    recs: list[dict] = []

    def grab(kind: str, hit, ex=None):
        url = ex.url if ex else hit.source_url
        label = ex.doc_label if ex else hit.form
        fname = _safe(f"{hit.form}_{hit.filed_date}_{hit.accession}_{(ex.name if ex else hit.primary_doc)}")
        rec = {"issuer": name, "ticker": ticker, "cik": cik, "kind": kind,
               "form": hit.form, "date": hit.filed_date, "accession": hit.accession,
               "label": label, "url": url, "file": f"{ticker}/{kind}/{fname}"}
        if not dry and url:
            dest = out / ticker / kind / fname
            dest.parent.mkdir(parents=True, exist_ok=True)
            data = edgar._http_get(url, accept="*/*", cap_bytes=40 * 1024 * 1024)
            dest.write_bytes(data)
            rec["bytes"] = len(data)
        recs.append(rec)

    # Financials: 10-K + 10-Q in the window.
    fin = [h for h in edgar.list_filings(cik, FINANCIAL_FORMS, limit=400) if in_window(h.filed_date, lo, hi)]
    for h in fin:
        grab("financials", h)

    if not financials_only:
        eights = [h for h in edgar.list_filings(cik, ["8-K"], limit=600) if in_window(h.filed_date, lo, hi)]
        if len(eights) > max_8k:
            print(f"   [{ticker}] {len(eights)} 8-Ks in window — examining most-recent {max_8k} (--max-8k to raise)")
            eights = eights[:max_8k]
        for h in eights:
            for ex in edgar.list_exhibits(cik, h.accession):
                if keep_legal_exhibit(ex) or (ex99 and keep_ex99(ex)):
                    grab("legal" if keep_legal_exhibit(ex) else "presentations", h, ex)

    print(f"   [{ticker}] {sum(r['kind']=='financials' for r in recs)} financials, "
          f"{sum(r['kind']=='legal' for r in recs)} legal"
          + (f", {sum(r['kind']=='presentations' for r in recs)} EX-99" if ex99 else "")
          + (" (dry-run)" if dry else ""))
    return recs


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default=str(HERE / "cohort.csv"))
    ap.add_argument("--out", default=str(HERE / "samples"))
    ap.add_argument("--only", help="comma-separated tickers")
    ap.add_argument("--date-from", default=DEFAULT_FROM)
    ap.add_argument("--date-to", default=DEFAULT_TO)
    ap.add_argument("--max-8k", type=int, default=80)
    ap.add_argument("--financials-only", action="store_true")
    ap.add_argument("--ex99", action="store_true", help="also pull 8-K EX-99 earnings decks")
    ap.add_argument("--dry-run", action="store_true", help="resolve + list, download nothing")
    a = ap.parse_args()

    if not edgar.settings.edgar_user_agent.strip():
        sys.exit("Set EDGAR_USER_AGENT='Name you@example.com' — SEC fair-access requires it.")

    only = {t.strip().upper() for t in a.only.split(",")} if a.only else None
    out = Path(a.out)
    with open(a.csv, encoding="utf-8", newline="") as cohort_file:
        rows = list(csv.DictReader(cohort_file))
    manifest, skipped = [], []
    for row in rows:
        ticker = row["Ticker"].strip()
        if only and ticker.upper() not in only:
            continue
        if not re.fullmatch(r"\d{1,10}", re.sub(r"\D", "", row["CIK"])) or "N/A" in row["CIK"]:
            skipped.append({"issuer": row["Issuer"], "ticker": ticker, "why": "no SEC CIK (non-US) — reported-doc lane"})
            print(f"!! {ticker}: no CIK — skipped (reported-doc lane)")
            continue
        print(f"== {ticker} ({row['Issuer']}) CIK {row['CIK']} ==")
        try:
            manifest += fetch_issuer(row, out, a.date_from, a.date_to, dry=a.dry_run,
                                     financials_only=a.financials_only, max_8k=a.max_8k, ex99=a.ex99)
        except edgar.EdgarError as e:
            print(f"   !! EDGAR error: {e}")
            skipped.append({"ticker": ticker, "why": str(e)})

    mpath = out / "manifest.json"
    out.mkdir(parents=True, exist_ok=True)
    mpath.write_text(json.dumps({"window": [a.date_from, a.date_to], "docs": manifest, "skipped": skipped}, indent=2))
    print(f"\n{len(manifest)} docs, {len(skipped)} skipped — manifest → {mpath}")


if __name__ == "__main__":
    main()
