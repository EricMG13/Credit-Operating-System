# Bloomberg activation runbook — H4 activation package #2

**Status:** transfer-ready build-and-activate package (C5 was rescoped out of
pre-deployment on 2026-07-22 — RT-2026-07-22-788/789). Phase-1 ships on
provenance-labeled fixed/manual market data: immutable `market_snapshots`
(migration 0055) + the analyst XLSX import lane
(`/api/rv/snapshots/import[/preview]`, flag `CAOS_MARKET_XLSX_V2_ENABLED`) +
the bundled RV `REFERENCE` snapshot. Nothing in this runbook is a
pre-deployment gate; it is the complete specification enterprise work starts
from, executed **with** enterprise licensing/IT.

## Phase 0 — licensed transport decision (enterprise, first)

Choose one, with licensing:

| Option | Shape | When |
|---|---|---|
| **HAPI** (Hypermedia REST, per-request entitlements) | HTTPS pull, DLREST licence | Preferred for a self-hosted single-tenant stack: no local infrastructure, request-metered |
| **SAPI** (Server API) | BLPAPI SDK against a local Bloomberg gateway | If the firm already runs SAPI entitlements |
| **B-PIPE** | managed feed | Only if the firm already licenses it; overkill for Phase-1 DM needs |

Record: transport, EIDs/entitlements, network path (egress allow-list — the
deploy stack is deny-by-default), data licence scope (display vs. derived —
DM computation is derived use; confirm licence covers storing derived DM in
`market_snapshots`).

## Phase 1 — build (on the shipped store; do NOT create a parallel store)

Anchor: the C5 section body in
[PRE_DEPLOYMENT_PLAN.md §5](../PRE_DEPLOYMENT_PLAN.md) (retained there as the
authoritative spec). Build order:

1. **Store**: reuse merged `market_snapshots` (0055) as the persisted quote
   store — issuer/tranche → DM, price, as-of, source tag. Reconcile the
   legacy `market_quotes` naming at pickup; one store, one read-model, every
   RV/DM surface (Sector RV, Deep-Dive RV, CP-3 peer percentiles, Command
   marks, Query walks) reads it.
2. **Provider chain**: `MarketDataProvider` → `BloombergProvider` →
   `ManualQuoteProvider` (analyst XLSX/manual entry — already live). An
   unconfigured/unreachable Bloomberg degrades to manual with an explicit
   source tag — the same fault-isolation invariant as the LLM lanes (never
   blank RV on feed outage).
3. **`BloombergProvider`**: field mapping to DM inputs (bid/ask price, spread
   fields per transport), request throttling, error taxonomy
   (auth/entitlement/throttle/field-missing), all tested offline against
   recorded response fixtures (`caos/tests/server/test_marketdata.py`, new).
   The existing `credibleDm` plausibility guard moves into the chain as the
   validation stage.
4. **Sector RV refresh button**: manual pull → chain → validate → upsert →
   re-render with as-of, per-row source tag, stale-age. Server-side rate
   limit.
5. **Settings → Market Data**: transport + credential config (admin-only
   under E2 roles), status readout
   (unconfigured/configured/live/unreachable), test-connection button,
   last-refresh + quota. Credentials are secrets: E4 inventory, masked,
   never logged.

## Phase 2 — activation with enterprise

1. Credentials/EIDs entered via Settings (admin); test-connection green.
2. **Parallel run** (DEVELOPMENT_PHASES Phase 5 — never flip-the-switch):
   Bloomberg pulls alongside the manual marks on the golden issuers for an
   agreed window; every material DM diff explained and signed off.
3. Cutover: provider order flips to Bloomberg-first; manual stays as the
   documented fallback with source tags.
4. **Rollback**: chain falls back to manual/fixed snapshots — one config
   change, no schema or surface change; provenance labels make the state
   visible to analysts immediately.

## Verification gates

- `pytest caos/tests/server/test_marketdata.py` green against recorded
  fixtures (offline, keyless CI).
- `grep -n market_quotes caos/server/migrations/versions/*.py` — naming
  reconciliation recorded.
- Sector RV refresh round-trips on the fixture-backed provider; degrades
  cleanly to manual on injected failure; every RV surface reads the store.
- Parallel-run reconciliation record signed (enterprise + Head of Research).

## Exit

Bloomberg live behind the provider chain with signed parallel-run evidence,
or consciously deferred with the manual lane as the operating mode — either
state is legitimate; the activation decision and evidence are what H5's PM/CIO
row signs.
