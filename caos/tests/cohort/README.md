# Leveraged-loan test cohort (SEC EDGAR)

30 leveraged-loan issuers ([cohort.csv](cohort.csv)) → a real-document sample
corpus for **Phase-1 engine cert** and **Phase-3 dictionary** (see
[../../docs/DEVELOPMENT_PHASES.md](../../docs/DEVELOPMENT_PHASES.md)).

[fetch_cohort.py](fetch_cohort.py) is thin glue over `server/edgar.py` (throttled,
UA-gated, SSRF-safe, stdlib-only — **no new deps, no reinvented scraping**). The
EX-10.x "Credit Agreement" classification is `edgar.classify()` (the CP-4 taxonomy),
already unit-tested in the engine suite.

## Run

```bash
# preview (no download) — resolves filings + classifies exhibits:
EDGAR_USER_AGENT="Name you@example.com" \
  caos/server/.venv/bin/python caos/tests/cohort/fetch_cohort.py --only SSNC --dry-run

# full pull (downloads to ./samples/, gitignored):
EDGAR_USER_AGENT="Name you@example.com" \
  caos/server/.venv/bin/python caos/tests/cohort/fetch_cohort.py
```

Per US filer → `samples/<TICKER>/`:
- `financials/` — 10-K + 10-Q filed 2022-01-01..2025-12-31 (`--date-from/--date-to`)
- `legal/` — 8-K exhibits classified Credit Agreement / amendment / EX-10.1-2
- `presentations/` — 8-K EX-99 earnings decks, **only** with `--ex99`

Plus `samples/manifest.json` (issuer · form · date · accession · label · url · path).

## Ceilings (lazy on purpose)

| Skipped | Why | Path |
|---------|-----|------|
| IR presentation decks | 30 bespoke, mostly-JS IR sites = fragile scraper + bs4 dep | `--ex99` pulls earnings decks from EDGAR instead |
| VMO2, Refresco | no SEC CIK (non-US) | reported-doc lane (`reported_cp1.py`) |
| filings > ~1000 ago | submissions API "recent" window | paginate older `files` if a prolific filer doesn't reach 2022 (script logs it) |
| EX-10.x text-confirm | kept by filename/CP-4 classification, not body grep | add a "Credit Agreement" text check if false positives appear |

## Feeding the engine

Two routes:
1. **Keyless / deterministic** — these are SEC filers, so the EDGAR XBRL→CP-1 lane
   already grounds them (no upload needed); promising ones become golden-master
   fixtures (`../server/golden/_capture.py`).
2. **Full pipeline** — upload the fetched 10-K + credit agreement via
   `POST /api/ingestion/upload/document` to exercise parse → retrieve → run → QA
   on real legal text (the CP-4C covenant lane).
