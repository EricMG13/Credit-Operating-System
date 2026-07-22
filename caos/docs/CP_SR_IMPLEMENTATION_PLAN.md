# CP-SR Implementation Plan — asynchronous, source-backed Sector Review

**Gate:** PD-06 (promise map row CP-SR, status BLOCKED)
**Written:** 2026-07-22 · plan only — no code in this tranche
**Red-team:** RT-2026-07-20-767/768 (service constraints), RT-2026-07-22-784…787 (this plan)
**Execution pickup gate:** after the C3 Monitor/alert tranche lands — CP-SR
reuses C3's claim/lease substrate and the next free Alembic head
(RT-2026-07-22-784); re-verify this plan's substrate assumptions at pickup.

## 1. Current runtime truth (what already exists)

| Piece | Where | State |
|---|---|---|
| Versioned dossier substrate ("CP-SR V2") | `caos/server/routes/sector.py` (SectorReviewRun, version race handling, per-section freshness `live/reference/partial/stale/unavailable`) | SHIPPED |
| Section ratification + publication routes | same | SHIPPED, but `ready` is unreachable: all six dimensions are permanently `unavailable` |
| Signals store + seed fallback | `SectorSignal` rows with provenance; seed/demo/reference vs live origin split | SHIPPED |
| Sector RV market snapshots | analyst-supplied XLSX flow, immutable snapshots (C5 map row "manual market data") | SHIPPED |
| Six-dimension synthesis, comparables, recovery evidence, early warnings | — | **ABSENT — this plan** |

The corpus contract is `Modular OS/CP-SR/` (ACTIVE_PROMPT + REF_A…G): source
register with reliability tiers, six-dimension investigation scored 1–5 with
confidence, risk mapping to the canonical credit-implication taxonomy,
comparative peer table, early-warning dashboard against REF_E thresholds.

## 2. Decision rule (inherited from the promise map)

CP-SR resolves only as **a callable service with production-data evidence**.
Reference fixtures, registry entries, and the existing partial/reference
dossiers do not count. Partial dossiers remain unpublishable; ratification
stays a human gate; nothing auto-publishes (RT-767/768).

## 3. Target architecture

**Deterministic-first, LLM-second, abstain-on-thin-sources (RT-785).**

- **Execution model:** an asynchronous sector-review job (`scheduled |
  event-driven | ad-hoc` per the corpus config), claimed via the same
  persisted claim/lease contract C3 lands for alert evaluation — no second
  scheduler substrate, no in-process timers (RT-766 parity).
- **Source register (Step A):** built from vault documents (memochunks +
  ingested filings for the sector's issuers) and analyst-supplied market
  snapshots only. Every register row carries source id, reliability tier,
  as-of date, relevance. **Email intake (corpus Step A.2) is out of scope**
  until the enterprise transport exists (RT-786) — the dossier records the
  deviation as a named limitation, not silently.
- **Six dimensions (Step B):** each computed deterministic-first from CP-1
  facts and register evidence (e.g. leverage/coverage distributions across the
  sector's covered issuers, ratings mix, maturity wall, spread/DM posture from
  the manual snapshot). An LLM narrative lane may enrich a dimension but is
  fault-isolated under the existing `llm_safety` wrap and one of the three
  established isolation patterns; when evidence cannot support a score the
  dimension stays `unavailable` — no fabricated 1–5 (RT-785).
- **Risks + credit-implication mapping (Step C):** top sector risks scored
  severity×likelihood, mapped to the canonical taxonomy REF_F; every risk row
  cites register sources.
- **Comparative table (Step D):** peer table per REF_D from covered-issuer
  CP-1 facts; missing/stale/estimated cells flagged, never imputed.
- **Early warnings (Step E):** REF_E thresholds evaluated against current
  facts; `warning_status` feeds the existing per-section field.
- **CP-MON hook:** an alert may trigger an ad-hoc refresh only with the
  RT-768 correlation contract (correlation id, root cause, hop count, no
  same-observation return edge, never auto-ratify) (RT-787).
- **Publication:** a dossier version becomes `ready` only when all six
  dimensions are scored-with-evidence and every section is analyst-ratified;
  it is then frozen immutable like the existing version rows. Everything else
  publishes as the current honest `partial`/`reference`.

## 4. Phases

| Phase | Scope | Exit gate |
|---|---|---|
| **S0** | Schema: dimension/evidence/register tables (or JSON columns on SectorReviewRun), job + claim wiring on C3's substrate | `alembic check` clean; migration guard tests; no second scheduler |
| **S1** | Source register + deterministic dimension computation for the covered-issuer sector slice | Unit tests per dimension incl. abstention cases; register rows cite real vault chunks |
| **S2** | Risk mapping, peer table, early warnings | REF_D/REF_E/REF_F contract tests; missing-data flags proven |
| **S3** | LLM narrative lane (fault-isolated), ratification → `ready` publication | Honest-state API contract tests (unavailable/reference/partial/live); authz scoping; idempotent re-evaluation; concurrency; failure-path (LLM down ⇒ deterministic dossier still lands) |
| **S4** | Frontend: sector route consumes real dossiers; DEMO/REFERENCE labels retained where applicable | Route-contract E2E; PD-10 matrix stays zero-finding |
| **S5** | Production-data evidence run + promise-map flip to RESOLVED | H0 no-retry evidence per the map's contract-evidence list |

## 5. Non-goals

- Email intelligence intake (blocked: no authenticated transport — map seam row).
- Bloomberg/licensed market data (C5; blocked on enterprise transport decision).
- Auto-ratification or auto-publication of any dossier (RT-767/768 — never).
- Replicating issuer-level CP-1/CP-2/CP-4 analysis (corpus scope boundary).

## 6. Evidence checklist (from the promise map, CP-SR slice)

- [ ] API contract tests: honest unavailable / reference / partial / live states.
- [ ] Authorization: dossiers, register rows, refresh triggers scoped to owning analyst/team.
- [ ] Idempotency + concurrency: refresh, claim, re-evaluation, ratification races.
- [ ] Failure paths: LLM/provider faults never abort the job or fabricate scores.
- [ ] Production-data dossier reaching `ready` through real ratification.
- [ ] H0 no-retry rerun after the runtime work is complete.
