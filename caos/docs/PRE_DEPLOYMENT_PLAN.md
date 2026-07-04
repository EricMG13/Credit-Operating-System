# CAOS — Pre-Deployment Program Plan

> **For agentic workers:** this is the **master program plan** (current state →
> enterprise transfer). Each L-sized work item gets its own detailed
> implementation plan (superpowers:writing-plans) at pickup time; do not
> implement L items directly from this document. S/M items may be executed
> directly. Checkboxes (`- [ ]`) are the tracking surface.

**Goal:** take CAOS from today's state (engine certified-ish, pilot deployed,
two concepts still mock) to **pre-deployment**: the final stage before transfer
to enterprise, where the **only** outstanding items are
(1) connecting the Monitor concept to the enterprise email client, and
(2) connecting the market-data seam to Bloomberg or an Excel feed.
Everything else: functional, live, and re-tested on a defined cadence.

**Architecture of the plan:** eight gated phases (A–H). Each phase has work
items with file anchors, a hard **exit gate** (verifiable, not aspirational),
and starts one or more **recurring verification loops** that keep running for
the rest of the program. Supersedes the phase ordering in
[DEVELOPMENT_PHASES.md](DEVELOPMENT_PHASES.md) where they conflict; cross-refs
given per phase. (DEVELOPMENT_PHASES "Phase 5 market-data cutover" happens
*after* transfer — it is outstanding item #2 by design.)

**Last grounded against code:** 2026-07-03 (branch `feat/query-route-fast-lane`);
reconciled same day after the E2 roles-lite decision, the §14 expansion
backlog (feature ideation + PM review), and the A1 code fix (cfacf8a).
Verified in that pass: branch unmerged (A2 open) · `feat/covenant-frontend`
alive (A3 open) · PR #95 OPEN (A4 open) · 12 dependabot PRs open (A5 open) ·
`fix/vmo2-followups` not deleted (A6 open).

---

## 0. Definitions — read first

| Term | Meaning here |
|------|--------------|
| **Pre-deployment** | Final stage before enterprise transfer. All exit gates A–H passed. Only the two named stubs outstanding. |
| **Live** | Renders real engine/DB output with provenance. A labeled sample ("Sample — not live") is *not* live; an explicit "no data" empty state *is* acceptable. |
| **Functional** | Works end-to-end through the real path (UI → API → engine → DB), not through a simulation hook. |
| **Tested regularly** | Covered by at least one recurring loop in §10 with the stated cadence, green for ≥2 consecutive cycles. |
| **Seam / stub** | A code interface where a future integration plugs in. The seam itself is built and tested against a fake now; only the external connection is deferred. |
| **CRIT/HIGH/MED/LOW** | Dual severity rubric from DEVELOPMENT_PHASES §Conventions. CRIT+HIGH block phase exit; MED+LOW are tracked. |

### The two allowed-outstanding items — precise boundaries

**#1 Monitor → enterprise email.** Everything up to the send is in scope and
must be live: watch rules, event generation, alert persistence, in-app alert
inbox. The boundary is an `AlertSink` interface with two implementations:
`InAppSink` (live, tested) and `EmailSink` (stub that logs + records intent;
spec written for SMTP and MS Graph so enterprise IT picks one). Outstanding =
implementing/pointing `EmailSink` at the enterprise mail system.

**#2 Market data → Bloomberg/Excel.** The seam is in scope: a
`MarketDataProvider` interface consumed by every DM/spread surface (Sector RV,
Command Center marks), with `ManualQuoteProvider` (analyst-entered / CSV
upload, live, tested) as the working implementation and `BloombergProvider` as
a spec'd stub. Outstanding = wiring the real feed + the parallel-run
reconciliation (DEVELOPMENT_PHASES Phase 5). DM remains the canonical spread
metric (loans-only decision).

---

## 1. Current state — evidence, not aspiration

Grounded 2026-07-03 by code inspection + test runs. The docs trail the code;
when in doubt, trust the greps below.

### Working and tested today

| Area | Evidence |
|------|----------|
| Engine: 19 modules emit real output via governed CP-X DAG | `caos/server/engine/`, registry/planner/runner; 795+ server tests |
| EDGAR CP-1 (US XBRL) + reported-disclosure lane (non-US/IFRS) | `edgar_cp1.py`, `reported_cp1.py`; VSAT/FUN/VMO2 goldens |
| Golden-master drift alarm in CI | `caos/tests/server/golden/test_golden_cp1.py` — fails on any numeric drift |
| CP-5 QA gate + 5 finding gates (abort-on-raise) | commits 45054ba, 5fcecd8 |
| Deep-Dive, Pipeline, Model Builder, Report Studio, Query, Issuer Profile, Research wired to live runs | `caos/frontend/src/app/*` |
| Auth: Caddy → oauth2-proxy → edge-secret fail-closed → in-app analyst profiles | LAUNCH_PHASE1 §5 W1 checks |
| LLM fault isolation (timeout/5xx never aborts a run) | per-module Blocked gate / council `return_exceptions` / deterministic fallback |
| Deploy stack: single container + Postgres + vault volume + daily backups | `caos/deploy/` |
| Stress harness built (mock-Anthropic 429/529/hang, locust) | `caos/tests/stress/` |
| E2E (Playwright, storageState auth), a11y (axe, 0 violations/12 routes), perf smoke (p95 gate) | `caos/frontend/e2e/`, `scripts/a11y-axe.mjs`, `caos/tests/perf/smoke.py` |
| Feature tracker: 354 rows, 42/42 endpoint parity, 5 sweep iterations | `caos/docs/qa/FEATURE_TRACKER.csv` |
| Pilot deployed on internal host from `main` | 2026-07-02, PR #93 merged |

### Not live / not done (the gap this plan closes)

| Gap | Evidence | Phase |
|-----|----------|-------|
| **Monitor concept is mock**: static `ALERTS`, simulated pipeline (`SIM_PLAN`/`useSimRun`), mock `EmailIntel` | `src/app/monitor/page.tsx` imports `@/lib/command/data` ALERTS | C |
| Command Center sample board overlay ("Sample US HY sleeve — not live") | `src/app/command/page.tsx:62-76` (posture from runs IS live) | C |
| Residual seeded panels in Deep-Dive / Report Studio (A-1 tail) | AUDIT A-1; needs fresh inventory | C |
| No market-data seam — DM/spread surfaces have no provider interface | Sector RV feed marks ad hoc (see PR #95 guard) | C |
| No OCR — scanned PDFs → 0 chunks | markitdown[pdf] only | D |
| No RAG answer lane in Query | query vision gap #1 | D |
| `querygraph.py` uncapped run-history scans (perf finding 2026-07-03) | **code fix landed cfacf8a** (existence check / DISTINCT / `_GATE_NODE_CAP`); regression test still missing | A |
| Unmerged work: this branch, `feat/covenant-frontend` (CP-4C adapter, dominoes, /sponsors, digest), PR #95 | `git branch -a` | A |
| 12 open dependabot PRs + held majors | PRs #62, #82–#92 | A |
| Single-team authorization (any analyst sees/edits every issuer) | SECURITY §2, accepted for pilot only | E |
| Audit trail partial (runs stamped `analyst_id`; other mutations not logged) | migration 0014+ | E |
| Stress CRIT/HIGH list not fully closed (single worker, queue backpressure, per-user caps) | DEVELOPMENT_PHASES Phase 2 unchecked boxes | E |
| Restore drill manual/one-off; no error-rate alerting; DR runbook unrehearsed | LAUNCH_PHASE1 §5 last boxes | G |
| No license/SBOM report for transfer | — | E |
| Beta cohort not run (registry = pilot noise, not built dictionary) | DEVELOPMENT_PHASES Phase 3 unchecked | F |

---

## 2. Phase overview

| Phase | Name | One-line | Size | Depends on |
|-------|------|----------|------|-----------|
| A | Trunk consolidation | merge everything, close known findings, reconcile trackers | ~1 wk | — |
| B | Engine certification completion | both lanes clean on goldens, headless | ~1–2 wk | A |
| C | All concepts live | kill the mock: Monitor engine, Command board, seams | ~3–5 wk | B |
| D | Ingestion breadth | OCR, RAG answer lane, upload robustness | ~2 wk | B (∥ C) |
| E | Enterprise hardening | security, authz, audit trail, stress CRIT/HIGH | ~2–3 wk | C |
| F | Beta — build the dictionary | 3–5 analysts, real coverage, gap log | ~3–4 wk cal. | C, D (∥ E) |
| G | Ops readiness | drills, alerting loop, load, DR, loops locked | ~1–2 wk | E |
| H | Pre-deployment gate + handover | full gate on prod-parity, transfer package | ~1 wk | all |

Sizes assume one developer + Claude, analysts part-time in F. Calendar total
≈ **3–4 months** with C∥D and E∥F overlap. Honest range, not a promise —
re-estimate at each phase exit. Expansion riders (§14) add ≈1 wk to C
(C7–C9) and days to D (D4) *if taken in-phase* — they are non-blocking, so
dropping them never delays a gate. E2's upgrade from decision-only to
roles-lite build (L) is inside the E estimate.

---

## 3. Phase A — Trunk consolidation & known-debt closure

**Objective:** one trunk, zero known open findings, trackers telling the truth.
You cannot certify a moving target spread across four branches.

- [ ] **A1 (S)** ~~Fix `querygraph.py` uncapped run-history scans~~ **code fix
  landed** (cfacf8a, this branch): `availability()` → HAVING…LIMIT 1 existence
  check, `_committee` → DB DISTINCT (states×issuers), `_gate_lane` →
  `_GATE_NODE_CAP` 300 severity-ordered, `_latest_run` probe bounded to 200.
  **Remaining:** the regression test — build the graph against a seeded
  100-run history and assert node count stays bounded (`test_querygraph.py`
  has no cap assertion yet). *(Known finding, confidence review 2026-07-03.)*
- [ ] **A2 (S)** Merge `feat/query-route-fast-lane` → `main` (after A1; CI green).
- [ ] **A3 (M)** Rebase + merge `feat/covenant-frontend` (CP-4C adapter, profile
  dominoes + register rows, `/sponsors`, digest panel — wiring done at 3605c99).
  Re-run frontend gate + E2E before merge.
- [ ] **A4 (S)** Land PR #95 (Sector RV DM/YTM plausibility guard).
- [ ] **A5 (M)** Dependabot triage per policy: auto-merge safe patch/minor
  (#82–#92 candidates — e.g. next 16.2.9→16.2.10 is a patch, take it);
  re-affirm held majors (react / postgres18 / python3.14 / tailwind4 stay
  held). Record decisions on each PR.
- [ ] **A6 (S)** Delete stale branches (`fix/vmo2-followups` — merged via #93,
  grafted history; `feat/scenario-mapper-a11y-polish` if merged).
- [ ] **A7 (M)** Tracker reconciliation sweep: walk `FEATURE_TRACKER.csv` (354
  rows) + `AUDIT.md` against code; flip rows already shipped; every remaining
  "open" gets a phase letter from this plan. *(CRLF gotcha: edit the CSV in
  binary mode.)*

**Exit gate:** `main` is the only active branch · 0 open non-dependabot PRs ·
CI green · server suite ≥ baseline (795 pass) · tracker rows all carry a phase
letter or "done".

**Loops started (§10):** per-PR CI + code review + `detect_changes` · weekly
dependabot triage · per-phase-exit tracker sweep + confidence review.

---

## 4. Phase B — Engine certification completion

**Objective:** the credit math is provably correct on real third-party filings
at the API layer, both lanes, before any UI work sits on top of it.
*(= DEVELOPMENT_PHASES Phase 1 remainder. Engine-fault issues #25/#26/#27 are
closed; this phase re-proves the chain end-to-end and closes the loop.)*

- [ ] **B1 (M)** Run each golden issuer (VSAT, FUN, VMO2) **keyless** (EDGAR/
  reported lane) and **keyed** (LLM synth) end-to-end via `TestClient`:
  upload → chunk → 19-module DAG → CP-5 gate. Assert outputs match frozen
  goldens. Wire as a repeatable pytest marker (`-m golden_e2e`), not a one-off.
- [ ] **B2 (M)** Provenance chain audit: for every claim in a golden run,
  assert `claim → evidence → chunk` resolves (no dangling citation ids).
  Automated test, not eyeballing.
- [ ] **B3 (S)** `is_finite_number` sweep: grep every CP-1-derived divide/
  multiply in `engine/`; each is guarded or has a test proving NaN/inf/0-denom
  degrades to `None` (engine invariant, CLAUDE.md).
- [ ] **B4 (S)** CP-5 gate honesty re-check on goldens: inject one known-bad
  figure into a golden fixture copy; assert the gate raises a finding and the
  run aborts (extends the 45054ba tournament).

**Exit gate:** both lanes clean on all goldens · provenance test green · 0
CRIT/HIGH correctness faults open · `golden_e2e` marker runs in CI nightly.

**Loops started:** nightly `golden_e2e` (drift alarm now covers the full chain,
not just CP-1 recompute).

---

## 5. Phase C — All concepts live (kill the mock)

**Objective:** every surface renders live engine/DB output or an explicit
empty state. Monitor gets a real engine. The two allowed-outstanding seams get
built (against fakes) so nothing else ever touches mock data. **Largest phase;
C3 and C5 each get their own implementation plan at pickup.**

- [ ] **C1 (S)** Mock inventory: grep every route/component for seeded/sample/
  sim imports; classify each hit **live / labeled-sample / silent-mock**.
  Deliverable: a `MOCK_LEDGER.md` table with file:line — the phase's burndown
  list. Silent-mock = CRIT (rubric), labeled-sample = MED.
- [ ] **C2 (M)** Command Center: replace the labeled sample US HY sleeve board
  (`src/app/command/page.tsx:62-76`) with the real registry (posture from runs
  is already live). Empty registry → designed empty state, not sample data.
  "What changed" strip driven by run-delta facts.
  - Board carries threshold filters + saved views (lev / coverage / QA-state
    cuts) — the screener fold-in; no separate screener surface *(expansion 4.7)*.
  - **Maturity-wall panel**: cross-issuer rollup of CP-3D refinancing outputs
    (stacked by year × issuer, seniority ramp) via the `portfolio.py`
    one-pass aggregation pattern *(expansion 4.4)*.
- [ ] **C3 (L — own plan)** **Monitor engine.** Replace static `ALERTS`,
  `SIM_PLAN`/`useSimRun`, and mock `EmailIntel`:
  - Watch-rule model (DB, alembic migration): rule = issuer/portfolio scope ×
    signal type × threshold. Signal sources all exist already: run completions,
    QA-gate flips, covenant findings (register), new-EDGAR-filing polls,
    DM moves (via C5 seam when data present — include an **out-of-bounds jump
    rule**, DM move vs trailing band; PM review pt 3), and **CP-1B monitoring +
    CP-1C peer-outlier findings** (the sector out-of-trend flag; PM review
    pt 5). Schema reserves a `news` signal type (enum value only, no producer)
    so the Phase-2 news feed plugs in without a migration (PM review pt 4).
  - Event generator: evaluates rules on run completion + scheduled EDGAR poll;
    persists alerts (dedup on rule+issuer+fact).
  - Alert inbox UI: live feed replacing `AlertFeed` mock data; ack/resolve
    states; keyboard-operable; provenance click-through to the triggering fact.
  - **`AlertSink` seam:** `InAppSink` (live) + `EmailSink` (stub: logs, records
    "would have sent", carries the rendered subject/body so the enterprise
    adapter is a transport swap only). Spec doc for SMTP + MS Graph variants.
  - Kill `EmailIntel` mock or rebuild it on `EmailSink`'s outbox records.
  - Surface "next expected filing" per issuer (Profile + Monitor) off the
    EDGAR poll *(expansion 4.9)*; the daily digest becomes an `AlertSink`
    consumer — spec the sink for scheduled producers, not only event-driven.
- [ ] **C4 (M)** Deep-Dive / Report Studio residual seeded panels (from C1
  ledger): each → live adapter or explicit "no data / degraded" state. No
  unlabeled seed survives in a production build.
- [ ] **C5 (L — own plan)** **Market-data seam.** `MarketDataProvider`
  interface (quote: issuer/tranche → DM, price, as-of, source tag);
  `ManualQuoteProvider` = analyst-entered + CSV upload, persisted, live,
  tested; `BloombergProvider` = stub raising `NotConfigured` + spec doc
  (fields, entitlement notes, parallel-run reconciliation plan per
  DEVELOPMENT_PHASES Phase 5). Migrate Sector RV + any DM surface to consume
  the seam only; PR #95's plausibility guard moves inside the provider.
- [ ] **C6 (M)** Concept-link suite (named, repeatable): one run flows
  Pipeline → Deep-Dive → Model Builder → Report Studio with the **same number
  identical on every surface**; Evidence Sync cross-pane selection; click-to-
  source from any conclusion. Playwright + API assertions; runs nightly.
- [ ] **C7 (S)** Head-to-head issuer comparison — fifth Query walk *(expansion
  4.3)*: registered in `questions.ts`/`views.ts`/`synthesis.ts` per the Query
  design mandates (synthesis sentence first, committee exhibit = charts +
  narrative); side-by-side headline `metric_facts`, covenant register rows,
  CP-3 RV percentile + CP-2B fragility.
- [ ] **C8 (M)** **IC Decision Record** *(expansion 4.1 — the human
  qualitative-overlay capture from the PM review)*: append-only per-issuer
  record — recommendation (OW/N/UW/pass), conviction, thesis sentence,
  committee date, decision, dissent, link to the run + report it was based on.
  Surfaced on Issuer Profile + Command board; mutations follow the E3 audit
  pattern. Lands **before F** so the beta cohort dogfoods it; its timestamps
  retroactively enable call-tracking (§14). A *record*, not a workflow engine.
- [ ] **C9 (S–M)** Committee-pack XLSX export *(expansion 4.2)*: openpyxl
  (free/OSS); Model Builder scenario grid + assumptions + headline
  `metric_facts`; every sheet stamped run id + as-of ("snapshot, not model of
  record"); C6's same-number-everywhere assertion extends to the export.

**Exit gate:** `MOCK_LEDGER.md` burned to zero silent-mock and zero unlabeled
sample in prod build · Monitor generates real alerts from a golden-issuer run
end-to-end (rule → event → inbox → InAppSink; EmailSink stub records intent) ·
all DM surfaces read only from `MarketDataProvider` · concept-link suite green
· a11y axe re-run clean on new/changed routes (Monitor inbox especially).
Expansion items C7–C9 are tracked here but **do not block this gate** (§14
policy).

**Loops started:** nightly concept-link + E2E over Monitor · a11y axe per
UI-touching phase exit · CI check: prod build greps clean of known mock
imports (`ALERTS`, `SIM_PLAN` in app routes).

---

## 6. Phase D — Ingestion breadth

**Objective:** the ingestion funnel accepts what real analysts actually feed
it. Runs parallel to C after B.

- [ ] **D1 (M)** OCR lane: `ocrmypdf`/tesseract (free/OSS, no paid services)
  behind the existing markitdown path — scanned PDF → text layer → chunks > 0,
  chunk provenance tagged `ocr` (so CP-5 and analysts can discount
  fidelity). Add a scanned-PDF fixture to the ingestion tests + one to the
  golden set. Size/time cap so a 500-page scan can't wedge a worker (respect
  parse timeouts).
- [ ] **D2 (L — own plan)** RAG answer lane in Query (vision gap #1):
  retrieval-grounded NL answers citing vault chunks; same provenance +
  fault-isolation invariants as every other LLM lane (Blocked gate or
  deterministic fallback — a timeout must never abort). Register in
  `questions.ts`/`views.ts`/`synthesis.ts` per the Query design mandates
  (synthesis sentence first, committee exhibit = charts + narrative).
- [ ] **D3 (S)** Upload robustness matrix: corrupt PDF, password-protected,
  0-byte, 200MB, wrong-extension, zip-bomb-ish docx — each rejected or
  degraded with an explicit analyst-visible reason (never a silent 0-chunk
  success). Table-driven pytest.
- [ ] **D4 (S)** "Log a note" quick-capture on Issuer Profile that writes a
  tagged memo **into the vault** (no new store, no new schema) *(expansion
  4.9)* — D2 then makes analyst/meeting notes answerable alongside filings.

**Exit gate:** scanned-PDF golden green · Query answers carry chunk citations
· upload matrix green · no ingestion path can succeed silently with 0 chunks.

**Loops started:** ingestion matrix in CI (per-PR).

---

## 7. Phase E — Enterprise hardening

**Objective:** safe to put in front of an enterprise security review.
"Functional" ≠ "safe to transfer" — this phase is the difference.

- [ ] **E1 (M)** Stress CRIT/HIGH closure (reconcile the DEVELOPMENT_PHASES
  Phase-2 list against code first — several may be done): multiple uvicorn
  workers · run-queue backpressure + per-user run cap (SKIP LOCKED worker
  exists — verify caps) · DB pool sized · rate limits on expensive/LLM
  endpoints keyed to analyst identity (not sprayable) · 401 interceptor ·
  parse timeouts. Then **run the stress harness** (`caos/tests/stress/`,
  locust @ 2× pilot concurrency, mock-Anthropic fault injection) and close
  what it finds.
- [ ] **E2 (L — own plan) — DECIDED 2026-07-03: roles-lite** (product owner
  chose roles-lite for the enterprise transfer review; full row-level ACL
  stays out of scope). Three roles on the existing analyst-profile system:
  - **analyst** (default) — full workspace read/write, runs, uploads, watch
    rules.
  - **admin** — analyst rights + profile/role management + audit-log view +
    destructive ops (GDPR delete, registry reset) become admin-only.
  - **read-only** — PM/CIO view; every mutating route rejected server-side.
  Work items:
  - Migration: `role` column on analyst profiles (default `analyst`).
  - **Admin profile creation + bootstrap:** `CAOS_ADMIN_EMAILS` env — listed
    OIDC emails receive the admin role when their profile is created, so a
    fresh deploy has an admin without DB surgery; admins then create profiles
    and promote/demote/deactivate from a Settings admin panel. Empty
    `CAOS_ADMIN_EMAILS` in production = boot warning (an instance with no
    admin cannot manage itself).
  - Server-side enforcement: one FastAPI role dependency on every mutating
    route (deny-by-default for read-only; admin-only list explicit). UI hides
    what the server forbids, but the server is the boundary.
  - Tests: role × route matrix (analyst/admin/read-only vs mutate/admin
    routes), forged-role and cookie-tamper attempts, bootstrap path.
  - Feeds the transfer review: role model documented in the accepted-risk
    register + H3 admin guide (role assignment procedure).
- [ ] **E3 (M)** Audit trail: append-only `audit_log` table (who/what/when/
  before→after) on every mutating route — issuer CRUD, uploads, deletes,
  rating edits, watch-rule changes, GDPR delete. Runs already stamp
  `analyst_id`; this extends the pattern. Surface read-only in Settings.
- [ ] **E4 (S)** Secrets runbook: inventory (SESSION_SECRET, EDGE_PROXY_SECRET,
  POSTGRES_PASSWORD, ANTHROPIC/OPENROUTER keys, oauth2 client + cookie
  secret), rotation procedure per secret, fail-closed behavior re-verified
  (EDGE_PROXY_SECRET already; check the rest), "never in logs" grep test.
- [ ] **E5 (M)** Security review pass: re-verify the pre-prod gate properties —
  **no LLM lane has tools/writes** (the key safety property) · SSRF allow-list
  on `vault-exhibit`/EDGAR fetches · header-spoof + edge-secret checks
  (LAUNCH_PHASE1 §5) · CSP/HSTS headers · GDPR-delete transactional integrity.
  Run `/security-review` on the full diff since the last gate; CRIT/HIGH fixed,
  MED/LOW to the register.
- [ ] **E6 (S)** License/SBOM report: `pip-licenses` + `license-checker`
  (both free) → `caos/docs/reference/SBOM.md`; flag anything non-permissive
  for the transfer package.

**Exit gate:** stress suite green at 2× pilot concurrency with fault injection
· authz decision implemented + tested (or signed acceptance) · audit log on
100% of mutating routes (tested) · security review PASS with accepted-risk
register · SBOM published.

**Loops started:** weekly stress run · quarterly security review · secrets
grep test in CI.

---

## 8. Phase F — Beta: build the dictionary

**Objective:** real analysts build real coverage; find the gaps only breadth
exposes. *(= DEVELOPMENT_PHASES Phase 3, unchanged in spirit.)* Calendar-
parallel with E after C+D land.

- [ ] **F1 (S)** Reset production registry to empty (launch default). **Keep
  the sealed golden set** — it is the regression net, never "cleanup".
- [ ] **F2 (—)** Onboard 3–5 analysts; each builds their own issuers via the
  real ingestion path (upload / EDGAR-vault). Brief them on LAUNCH_PHASE1 §6
  expectations + how to read provenance.
- [ ] **F3 (M)** Coverage + gap log: every issuer attempted → certifiable or
  categorized gap (scanned-PDF/OCR quality, IFRS mapping, covenant not
  retrievable, market data absent…). Weekly triage; CRIT/HIGH fixed in-phase.
- [ ] **F4 (M)** Feedback → golden growth: any analyst-reported wrong read
  becomes a fault-log entry; the fix adds that issuer to the golden set if it
  exposed a new bug class. Golden-master must stay green throughout (fixes
  can't regress certified issuers).
- [ ] **F5 (S)** Monitor dogfood: analysts set real watch rules; alert
  relevance feedback (too noisy / missed it) feeds C3 rule tuning.

**Exit gate:** cohort has built ≥15 issuers (3–5 each) · certifiable rate ≥80%
with every failure categorized · gap-log CRIT/HIGH = 0 · golden set grew with
any new bug class · golden-master green the whole phase.

**Loops started:** weekly gap-log triage · analyst feedback channel → tracker.

---

## 9. Phase G — Ops readiness & loops locked

**Objective:** the boring operational muscle an enterprise handover assumes.

- [ ] **G1 (S)** Backup **restore** drill automated: script wraps LAUNCH_PHASE1
  §5's scratch-restore (pg_restore → scratch DB → row-count assert → drop;
  vault tarball → scratch extract). Run it now, calendar it quarterly. A dump
  that never restored is not a backup.
- [ ] **G2 (S)** Error-rate alerting — dogfood Monitor: a watch rule over the
  app's own logs/health (unhandled-exception count, run-failure rate, 5xx
  rate) → alert inbox via the same `AlertSink`. No paid APM (by decision);
  this closes MON-1 with our own concept.
- [ ] **G3 (M)** Load characterization: locust at enterprise-plausible
  concurrency (define with owner — e.g. 15 analysts × think-time) on
  prod-parity build; p95 targets per route class (read / run-trigger / LLM
  lane); document ceiling + first bottleneck (SCALE-1 says worker already
  supports replicas — prove it once).
- [ ] **G4 (S)** DR runbook: host-loss scenario — restore from off-host
  backups to a fresh host; state RTO/RPO honestly (daily backup = up to 24h
  RPO; note it). **Rehearse once** — paper runbooks fail.
- [ ] **G5 (S)** Migration safety: `alembic upgrade head` from a Phase-F
  production dump copy + downgrade one revision; both on prod-parity
  (`.venv311`). Never a raw prod-first migration again.
- [ ] **G6 (S)** Off-host backup copy verified (rsync/object storage per §8
  posture) — restore drill G1 pulls from the **off-host** copy at least once.

**Exit gate:** restore drill from off-host copy PASS · DR rehearsal PASS with
stated RTO/RPO · load test PASS at agreed concurrency · migration up/down PASS
· every §10 loop has run ≥2 consecutive green cycles.

---

## 10. Recurring verification loops — the "tested regularly" contract

The user-visible guarantee: everything live is re-verified on a cadence.
A loop that isn't green for 2 consecutive cycles blocks the next phase exit.

| Loop | Mechanism | Cadence | Starts |
|------|-----------|---------|--------|
| CI gate | lint · `tsc --noEmit` · vitest · `next build` · pytest · mypy · C901 (changed files) | per PR | exists |
| Code review | `/code-review` on every PR; adversarial pass on engine changes | per PR | exists |
| Blast radius | GitNexus `impact` before edits, `detect_changes` before commit | per change | exists |
| Golden-master drift | `tests/server/golden/` CP-1 recompute | per PR + nightly | exists |
| Golden E2E (both lanes) | `-m golden_e2e` full-chain on VSAT/FUN/VMO2 | nightly | B |
| Concept-link suite | same-number-everywhere + Evidence Sync + click-to-source | nightly | C |
| E2E | Playwright page specs (globalSetup auth) | nightly | exists → extended C |
| Mock regression | prod build greps clean of mock imports in app routes | per PR | C |
| Ingestion matrix | upload robustness table (D3) | per PR | D |
| a11y | `scripts/a11y-axe.mjs` all routes | per UI phase exit + monthly | exists |
| Stress / simulation | mock-Anthropic fault injection + locust | weekly + per phase exit | E |
| Perf smoke | `tests/perf/smoke.py` p95 gate | per deploy | exists |
| Dependency triage | dependabot policy sweep | weekly | A |
| Tracker sweep | FEATURE_TRACKER re-walk vs code | per phase exit | A |
| Confidence review | 5-lens adversarial review (the 06-27/07-01/07-03 pattern) | per phase exit + monthly | exists |
| Goal audit | code-grounded whole-system audit (07-01 pattern) | per phase exit | A |
| Security review | `/security-review` + gate properties re-check | phase E exit + quarterly | E |
| Restore drill | scripted scratch-restore from off-host copy | quarterly | G |
| Gap-log triage | beta coverage failures categorized + prioritized | weekly during F | F |

---

## 11. Phase H — Pre-deployment gate & handover package

**Objective:** prove the end state and package the transfer.

- [ ] **H1 (M)** Full [LAUNCH_PHASE1 §5](LAUNCH_PHASE1.md) checklist on a
  prod-parity host (`.venv311` / fastapi pin), every box, no skips.
- [ ] **H2 (S)** Full regression stack green on that build in one sweep:
  golden-master + golden E2E + concept-link + E2E + stress + a11y + perf +
  ingestion matrix. One command / one CI dispatch, results archived.
- [ ] **H3 (M)** Handover package (`caos/docs/handover/`):
  - Architecture overview (refresh README/docs to as-built)
  - Admin guide: deploy, env/secrets inventory (names, not values), rotation
    runbook, backup/restore, DR, scaling notes from G3
  - Analyst onboarding guide (from F briefings)
  - OpenAPI export + endpoint inventory
  - SBOM/license report (E6)
  - Accepted-risk register (E2/E5 decisions, signed)
  - Support model: issue intake, triage SLA, release cadence
- [ ] **H4 (S)** The two outstanding-item integration specs, transfer-ready:
  - `EmailSink` adapter spec: SMTP + MS Graph variants; auth, rate limits,
    template rendering already proven by the stub's outbox records; test plan.
  - `MarketDataProvider` Bloomberg/Excel spec: field mapping to DM inputs,
    entitlement notes, **parallel-run reconciliation plan** (test-vs-real on
    golden issuers, sign-off before cutover — DEVELOPMENT_PHASES Phase 5 is
    executed by/with enterprise, never flip-the-switch).
- [ ] **H5 (S)** Sign-off:

| Role | Gate | Sign-off |
|------|------|----------|
| Deploying engineer | H1 + H2 green | |
| Head of Research / QA | golden set + gap log + CP-5 gate | |
| PM / CIO | accepted-risk register + the two named stubs | |

**Exit gate = pre-deployment reached:** every phase gate A–G passed · H1/H2
green · handover package complete · outstanding items = exactly the two named
stubs, each with a transfer-ready spec.

---

## 12. What an app like this is expected to have — coverage map

Senior-engineer expectations for an institutional numbers platform, mapped so
nothing is missing by omission. "By design" links to a recorded decision.

| Expectation | Status today | Covered by |
|-------------|--------------|-----------|
| SSO / domain-restricted auth | ✅ oauth2-proxy + Google OIDC | exists; enterprise IdP = transfer config (H3 admin guide) |
| In-app identity / profiles | ✅ analyst profiles, signed cookie | exists |
| Authorization model | ⚠️ single-team | **E2 — decided: roles-lite** (analyst / admin / read-only) |
| Audit trail | ⚠️ runs only | E3 |
| Rate limiting / abuse caps | ⚠️ partial | E1 |
| Secrets management + rotation | ⚠️ fail-closed, no runbook | E4 |
| Dependency scanning | ✅ Dependabot + policy | A5 + weekly loop |
| Malware scanning on upload | ✅ clamav | exists |
| SSRF / egress control | ✅ allow-list | re-verified E5 |
| Security headers / TLS | ✅ Caddy + CSP/HSTS | re-verified H1 |
| Pen-test style review | ⚠️ ad hoc | E5 + quarterly loop |
| SBOM / license compliance | ❌ | E6 |
| Backups | ✅ daily + rotation | exists |
| **Restore** drills | ⚠️ manual once | G1 + quarterly |
| DR / host-loss plan | ❌ | G4 |
| Observability (logs) | ✅ structured, contextual | exists |
| Alerting on errors | ❌ | G2 (dogfoods Monitor) |
| APM | ❌ **by design** (no paid services) | recorded decision |
| Load testing | ⚠️ harness built, not characterized | G3 |
| Migrations discipline | ✅ alembic self-migrate | + G5 up/down test |
| Graceful LLM degradation | ✅ fault isolation by construction | exists; re-proven in stress loop |
| Data retention | ✅ run-fact pruning (DATA-1) | exists |
| GDPR delete | ✅ transactional | re-verified E5 |
| Empty/error/degraded states | ⚠️ most surfaces | C1/C4 ledger closes the rest |
| Accessibility | ✅ axe-clean, WCAG AA target | monthly loop |
| i18n | ❌ **by design** — single-desk English product | note in H3 |
| Multi-tenancy | ❌ **by design** — one team per deployment | SECURITY §2, H3 |
| API documentation | ✅ OpenAPI | exported H3 |
| Runbooks (deploy/rollback) | ✅ LAUNCH_PHASE1 | rehearsed G/H |
| User onboarding docs | ⚠️ §6 briefing only | H3 guide |
| Support/maintenance model | ❌ | H3 |
| Feature tracking / QA ledger | ✅ 354-row tracker | per-phase sweeps |
| Regression corpus | ✅ sealed golden set | grows in F |

This table covers *platform/ops* expectations. The **product-capability**
expectation map (analyst-workflow lifecycle: screen → analyse → model →
decide → monitor → compare → distribute) lives in
[FEATURE_IDEATION_2026-07-03.md](FEATURE_IDEATION_2026-07-03.md) §3, with its
open items tracked as §14 expansion backlog here.

---

## 13. Ways of working (applies to every phase)

- **Gates are hard.** CRIT/HIGH block exit; MED/LOW get tracker rows, not
  heroics. Do not chase perfection past a gate.
- **One implementation plan per L item** (C3, C5, D2) written at pickup —
  bite-sized TDD tasks per superpowers:writing-plans; this document stays at
  program altitude.
- **TDD default** on engine/API work; UI work ships with its E2E/a11y checks
  in the same PR.
- **Impact before edit, detect_changes before commit** (GitNexus, per
  CLAUDE.md — non-negotiable).
- **Frequent small merges to `main`;** long-lived branches are how the A-phase
  mess happened.
- **Docs lie until reconciled** — status claims come from code/tests, not
  trackers; per-phase sweeps keep them honest.
- **Re-estimate at each gate.** The sizes in §2 are planning aids for a
  first-time software owner, not commitments.

---

## 14. Expansion backlog — product-capability items

Source: [FEATURE_IDEATION_2026-07-03.md](FEATURE_IDEATION_2026-07-03.md)
(§ numbers below) + the PM review of 2026-07-03 (assessment in that doc's §7).

**Policy:** expansion items are **MED by rubric — they never block a phase
exit gate.** The in-phase ones ride their host phase and carry an
*(expansion 4.x)* tag: C2 (maturity wall, screener filters), C3 (out-of-bounds
DM jump rule, peer-outlier signal, `news` enum reservation, filing calendar,
digest-as-sink-consumer), **C7–C9**, **D4**. The rest queue here with a named
unblocking event — none is scheduled by default; the owner promotes them at a
phase exit.

- [ ] **X1 (M–L, own plan)** Amendment / credit-agreement diff *(4.5)* —
  deterministic redline + structured covenant-term delta via register
  re-extraction. **Unblock:** D1 (OCR — real amendments are scans) + F-phase
  evidence that register extraction is reliable on amendments. Needs a
  document-lineage link (amendment → parent agreement; small migration).
- [ ] **X2 (M)** Terms-vs-precedent benchmarking *(4.6)* — basket/add-back
  looseness percentiled against the register corpus by sector/sponsor.
  **Unblock:** F exit (≥15-issuer corpus) — percentiles against n<15 are
  noise dressed as signal.
- [ ] **X3 (M)** Covenant compliance calendar *(4.6b)* — cert due/test dates.
  **Unblock:** register date-field extraction proven reliable in the F gap
  log. Sparse or wrong dates on a compliance calendar are worse than none.
- [ ] **X4 (M)** Analyst call tracking / hit rate *(4.8)* — recommendation vs
  subsequent DM move. **Unblock:** post-transfer real marks (Bloomberg cutover,
  outstanding item #2). C8's timestamps make this retroactive from day one.
  Also an owner *culture* decision — measuring analysts is not a default.
- [ ] **X5 (L, own plan)** Sector dashboards — implement CP-SR *(4.10)*.
  **Unblock:** post-transfer (needs F breadth **and** real marks, else panels
  render empty). Natural first post-transfer roadmap item with Bloomberg.
- [ ] **X6 (M–L, own plan)** **Actionable-intel lane** — feed-independent
  half of PM review pt 4 (clarified 2026-07-03: the point is *extracting*
  information from emails/news and *making it actionable* — update model,
  simulate scenario — not a headline ticker). Analyst pastes/uploads an email
  or article (the vault upload path already accepts this); an LLM extraction
  lane (fault-isolated, per the standing invariants) parses it to a structured
  `CreditEvent` — issuer, event type (M&A / guidance cut / refi / rating
  action…), quantum, cited source chunk — and **proposes** up to three
  analyst-confirmed actions:
  1. **Simulate**: pro-forma scenario run via `scenario.py` (e.g. M&A →
     pro-forma leverage/coverage vs current `metric_facts`) — flag
     risk/upside, numeric and cited;
  2. **Update model**: proposed assumption delta on the issuer's `SavedModel`,
     applied by a deterministic endpoint only after analyst confirmation
     (audit-logged per E3) — **the LLM proposes, never writes** (the E5
     safety property holds: no LLM lane has tools/writes);
  3. **Alert**: raise a `news`-type alert through C3 — this lane is the
     first producer of the reserved `news` enum.
  **Unblock:** C3 (alert schema + inbox). Owner may promote it pre-transfer;
  transport is *not* required for this to be useful.
- [ ] **X7 (L, vendor + integration)** Intel transport — the automated inbound
  half: mail-gateway / vendor news API + entity resolution feeding X6's
  extraction lane without the paste step. **Unblock:** Phase-2 vendor feed
  (recorded external-feed decision, PHASE2_SCOPE §B). Free RSS stays rejected
  — noisy entity matching would erode Monitor trust exactly when C3 is trying
  to establish it.

### PM value-add ladder → program mapping (review 2026-07-03)

| PM stage | Reality today | Lands via |
|---|---|---|
| V1 "junior analyst" | Built — and understates the engine (CP-6A debate, CP-3B recovery, CP-3D LME are senior-layer, but per-run/on-demand) | Phase-1 point, done |
| V2 qualitative overlay | Machine half exists per-run (CP-2C/2D/2F reads); human half uncaptured | **D2** (RAG over vault) + **C8** (decision record = the analyst's overlay) + D4 (notes) |
| V3 price dynamics / out-of-bounds jumps | No marks by design (no paid services) | **C5** seam + **C3** DM-jump watch rule now, testable on manual/CSV quotes; Bloomberg = outstanding #2, post-transfer |
| V4 news/email intel → action (simulate, update model, alert) | Intelligence half buildable feed-free (paste/upload + scenario.py + SavedModel exist); only transport is vendor-gated | **X6** (lane) + **X7** (transport) |
| V5 sector out-of-trend | Mostly built: CP-1C `peer_outlier_finding` per run | **C3** promotes it to alerts; full sector view = **X5** |

The PM's ladder matches the plan's sequencing almost 1:1 — treat it as
independent validation of the C→transfer ordering, not a new workstream.
