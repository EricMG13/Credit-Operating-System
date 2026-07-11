# Full-Depth Confidence Audit — 2026-07-11

**Scope:** whole system, back-to-front (UI → routes → engine → periods → Modular OS spec → deploy stack), working tree on `feat/command-center-layout-and-sector-rv-cleanup` (uncommitted 2026-07-10 fixes included).
**Method:** confidence-review loop — enumerate every genuine doubt, investigate each to root cause, adversarially verify before classifying. AST scan of all 243 arithmetic sites (109 divisions) in `caos/server`; three parallel breadth sweeps (frontend evidence/staleness, auth per-route, deploy/durability) with independent verification of every surviving finding.
**Verdict codes:** (a) CONFIRMED CORRECT · (b) CONFIRMED BUG/GAP · (c) GENUINELY UNDERDETERMINED.

## Headline

No CRITICAL, no HIGH. Two MEDIUM product findings (both Command Center trust-surface), one MEDIUM ops gap (backups on-host only), one MEDIUM sign-off item (cross-analyst destructive mutations), plus one carried-open MED (BE6-1 test gap). Engine numeric-guard discipline held under an exhaustive divide/multiply sweep — every candidate NaN/inf poison path I constructed was refuted by an existing guard, except a LOW theoretical output-inf residue in `earnings.py`. All four G10 degradation-honesty fixes and yesterday's safe_div output-inf fixes are verified present in the working tree. Auth fails closed in every shipped-artifact configuration. Deployment is durable-by-default.

---

## A. Numeric guards (engine arithmetic — full sweep)

### A-1 (b, LOW) `engine/earnings.py:37` and `:88` — output-inf class not applied
Doubt: `round(100 * (last - prev) / prev, 1)` and `round(100 * adj_ebitda / revenue, 1)` guard inputs via `is_finite_number` but not the RESULT — the exact overflow class `safe_div` was hardened against yesterday (periods.py now returns None on non-finite result; metrics/adjusted/covenants converted).
Investigation: constructed the failing input — `revenue {FY23: 5e-324, FY24: 1}` → growth = `inf` → `revenue_growth_pct: inf` in the payload; signal text renders "declined inf% YoY". Adversarial realism check: requires a denormal-scale (≤1e-306) revenue/prev value; real XBRL and LLM-extracted $M figures cannot produce this without adversarial junk, and CP-1 interiors are unvalidated so the path exists in principle.
Verdict: CONFIRMED inconsistency with the codebase's own safe_div standard; trigger theoretical. LOW.

### A-2 (b, LOW) `engine/covenants.py` deterministic extractor — unbounded float parse
`_INCREMENTAL_AMT`/`_musd` parse `[\d,]+` with no finite guard; a 309+-digit garbage number in a document chunk yields `inf`, flowing into `pf_nd = nd + amt` → `pf_lev = round(pf_nd / ebitda, 2)` (raw divide, `covenants.py:326`). Asymmetry: the LLM extraction path IS guarded (`amount_term`, `covenants.py:250` `is_finite_number … > 0`) — the trusted regex path is the unguarded one. Trigger requires absurd document content. LOW.

### A-3 (a) `engine/textscan.py:28` `_to_musd` — unbounded parse, but every consumer filters
Same inf-from-parse possibility; verified every current consumer (`liquidity.py:109`, `capstructure.py:117/122`) filters `is_finite_number` before summing/dividing. Correct today; contract enforced at consumers, not source. Observation only.

### A-4 (a) Refuted candidates — all verified guarded
- `engine/macro.py:82` bare `isinstance(cov,(int,float)) and cov` — looks like the banned anti-pattern, but `_finite()` (`macro.py:42`) collapses NaN/inf to None **before** that line. Correct. All downstream divides (`eb/cov`, `eb/new_interest`) guarded by rounded-then-truthiness; the `:g` format at `macro.py:145` unreachable with None (condition chain proves cov finite).
- `engine/liquidity.py:84-88` — `annual_cash_interest` rounded then truthiness-checked before dividing. Correct. (Minor: negative coverage → negative "months of runway" rendered; cosmetic, implies negative EBITDA which is already visible.)
- Scenario deltas (`scenario.py`): user-text `bps` parse can produce inf, but `validate_scenario` (`scenario.py:52-58`) explicitly `math.isfinite`-guards and clamps on BOTH the LLM and deterministic paths. Refuted.
- Portfolio/WARF (`portfolio_ingest.py:62-67` `_num` rejects NaN/inf; `engine/portfolio.py:65` entry filter `is_finite_number(par) and par > 0`; warf/margin/price denominators `> 0`-guarded). Holdings arrive only via xlsx parse (no raw-JSON NaN vector). Refuted.
- `engine/anomaly.py:89` `_robust_z` raw divide — both callers (`:107`, `:136-143`) pre-filter peer values with `is_finite_number`; `mad <= 0` handled. Correct. (Note: `metricengine.py:233` has a guarded twin `_robust_z` using safe_div — divergent duplicates, consolidation candidate.)
- `engine/periods.latest()` can return NaN/bool (filters bare `isinstance`) — swept all 5 call sites (`adjusted.py:168`, `capstructure.py:95`, `liquidity.py:79`, `macro.py:73`, `metrics.py:274`); every one re-guards with `is_finite_number`/`_finite` (+ `> 0` where needed). Correct.
- `engine/distress.py` Altman Z'' — full up-front finite loop + `total_assets/total_liabilities <= 0` rejection. Correct.
- `engine/edgar_cp1.py:254/261` — `> 0` comparisons reject NaN by construction (NaN > 0 is False); freshness gates sound. Correct.
- `engine/capstructure.py` recovery waterfall — `groupby` requires rank-sorted input; verified sole caller sorts (`scan_tranches`, `capstructure.py:57`). Pro-rata within rank confirmed (the old CP-3B "pari-passu modeled as ordered" MED is closed in current code). `rank_claim > 0` guaranteed by the all-finite-positive gate. Correct.
- `engine/downside.py:75` `lev / (1 - s)` — `_SHOCKS = (0.10, 0.20, 0.30)` constants; denominator can't reach 0. Correct.
- `peers.py:38`, `relval.py:56`, `routes/digest.py:124`, `routes/sponsors.py:159`, `eval.py`, `querygraph` layout math — all length/denominator-guarded or cosmetic-only. Correct.

### A-5 (a) Yesterday's uncommitted fixes verified present and coherent
`periods.safe_div` result-finiteness, `metrics` null-leaf guards (`100 * None` TypeError), `leverage_plausibility_finding` fires-on-overflow (suppression removed), `earnings._yoy` is_finite gate, `adjusted` lev_excl safe_div chain, `covenants` ebitda safe_div, deepresearch cross-turn overload degrade, `max_retries=0` on all five ad-hoc Anthropic clients, digest scan-cap constant, sector feed-override cleanup. All read end-to-end; internally consistent.

### A-6 (c, LOW) `earnings.py` "YoY" label
`_yoy` takes the last two comparable periods; with quarterly labels that's a QoQ delta rendered as "YoY". CP-1 typically emits FY/LTM series so the label is usually right; whether mixed-period series should suppress the label is an unmade product call.

## B. Evidence path ("every conclusion one interaction from evidence")

### B-1 (b, MEDIUM) Command Center `IssuerStrip` — seeded trust numbers, no evidence path, no visible not-live marker
`components/command/views.tsx:941-945` renders 3Y DM / Net Lev / Int Cov / M2E from the seeded `PORTFOLIO` fixture with no evidence chip and no strip-level marking; the page's only "Sample portfolio — not live" marker (`app/command/page.tsx:81-84`) is `hidden sm:inline` (invisible on mobile) and attached to the sleeve header, not the strip. These are exactly the money-metric types the design mandate covers. Verified by direct read.

### B-2 (b, MEDIUM) LiveCoverage → IssuerStrip cross-source seam
`LiveCoverage.tsx:104` selects live rows by ticker; `command/page.tsx:197` feeds it to `IssuerStrip`, which resolves against the seeded fixture (`views.tsx:913`). Live ticker ∉ fixture → `if (!p) return null` (`views.tsx:927`): selecting a live row is a silent no-op. Live ticker colliding with a seeded id/figi/code → seeded DM/leverage/coverage displayed attributed to the live issuer. Verified by direct read. The no-op is the common case (trust-eroding dead-end); misattribution needs a collision (low likelihood, high impact).

### B-3 (b, LOW-MED) `LiveCoverage.tsx:137-138` live net_leverage/interest_coverage have no evidence path; `command/page.tsx:101` seeded Avg 3Y DM aggregate likewise.

### B-4 (a) Everything else evidence-wired — Deep-Dive (E-chips → EvidenceModal, live/no-output badges, `allowSeededFallback` only for reference issuer), Model Builder (FormulaBar lineage + ModelProvenance reconciliation), Report Studio, Pipeline lineage, Query citations, AlertFeed source chips, Issuer Profile `▸ src`. EvidenceModal never leaks the seeded ATLF excerpt for live runs (verified; one LOW fragility: `EvidenceModal.tsx:239` `||`/ternary precedence is correct only via the `:254` early return).

## C. Command Center staleness / live-state

### C-1 (a) G10 degradation-honesty fixes — all four consumers verified wired in the working tree
`command/page.tsx:57,103` + `sector-rv/page.tsx:53` read `portfolio.error`; `reports/page.tsx:225` threads `phase` into `deepDiveCaveatKind`; `pipeline/page.tsx:104-121` destructures `phase` from `useLivePipelineStatus` with distinct error/in_flight/none/loading render states and a fail-closed `liveOutcome` (unknown committee status → never green). My initial "pipeline unfixed" doubt was a grep artifact (destructuring, not `.phase` access) — refuted by direct read.

### C-2 (a/LOW) No stale "what changed" signal exists to be wrong: FlashOnChange unmounted anywhere, demo replay clock is a labeled `useSyncExternalStore` singleton, no cross-tab state. `usePortfolio` is fetch-once (no poll) — a run completing mid-session won't refresh Live Coverage until navigation; error-flagged, not race-prone. Restore/retry races in model/reports/research/query all sequence- or flag-guarded (verified).

## D. Auth / tenancy

### D-1 (a) "Fails closed in production" — CONFIRMED for shipped artifacts
Dockerfile and compose hardcode `ENVIRONMENT=production`; four boot guards refuse to start on missing/default `EDGE_PROXY_SECRET`/`SESSION_SECRET`/`ANALYST_SIGNUP_CODE`/demo-seed (`main.py:47-87`). `is_deployed` is typo-safe (anything ≠ `"development"` is strict). Edge secret checked constant-time in both the global middleware (`main.py:225-239`) and `get_identity`; Caddy strips identity + edge headers inbound. Direct-port spoofing requires network position AND the secret. Every data route module enforces `Depends(get_identity)` (spot-verified counts across query/runs/digest/issuers/portfolios); the catch-all `/api/{path}` is 404-only.

### D-2 (c, noted) The one fail-open path: running the server bare (`python run.py`) with `ENVIRONMENT` unset → full `_LOCAL_DEV` bypass. Operator-deviation class (shipped image/compose can't hit it) — intended dev ergonomics; decide whether bare-metal deployment needs an extra tripwire.

### D-3 (c, MED sign-off) Cross-analyst destructive mutations inside "single-team IDOR by design"
`portfolios.py:281` `update_holdings` (any analyst overwrites any portfolio's holdings) and `query.py:442` `retract_link` (any analyst deletes any accepted link) are *mutations*, not reads. Personal objects (saved models, research jobs, settings, own profile — `DELETE /api/auth/profile` verified strictly self-scoped via `caller.id`) are isolated. The acceptance was argued for shared *reads*; destructive shared writes deserve explicit sign-off.

### D-4 (a/LOW) Static SPA bundle served without edge/identity check for non-`/api/` paths (data unaffected). Rate limiter is per-process; deploy verified single-worker/single-container so the assumption holds (multi-worker would silently multiply limits — documented caveat).

### D-5 (carried open, MED) BE6-1 `X-Query-Model` allowlist has zero regression-test coverage (2026-07-10 LLM-safety audit F-1, adjudicated open/non-blocking). Unchanged.

## E. Deploy / durability

### E-1 (a) Durable-by-default confirmed. DB (Postgres, `caos_db-data`) and vault (`caos_vault-data`) on named volumes; app-image rebuild touches neither. Default-SQLite-in-container path is unreachable on the shipped stack (compose always sets `DATABASE_URL`/`CAOS_STORAGE_DIR`; `read_only: true` makes the fallback a hard boot failure, not silent ephemeral writes). Migration-on-boot: single Alembic head (0033), whole-upgrade single transaction on Postgres (no partial schema), `pg_advisory_lock` serializes concurrent boots (the old pgvector-lock concern is resolved), lifespan+healthcheck+depends_on gate traffic until migrated. Static-export seam sound: all routes pre-rendered (no dynamic segments), HTML `no-cache` + hashed assets `immutable` (no stale index after redeploy), `/api` catch-all returns JSON 404 not SPA HTML.

### E-2 (b, MEDIUM ops) Backups are shipped (daily `pg_dump -Fc` + vault tar, verified-before-rotate, keep-7) but land on the **same host**. Host loss = total loss of analyst work product. Documented in `backup.sh`/`.env.example`/README but unautomated — the one real durability exposure.

### E-3 (c, LOW) Legacy-data upgrade risks: migration `0027` NOT-NULL tightening fails on pre-existing NULLs; `0029` computed tsvector slow on a huge corpus. Fresh deploys unaffected.

### E-4 (b, doc-rot LOW) `PRE_DEPLOYMENT_PLAN.md` still lists blocker A0-4 (pgvector image) — fixed in code (`pgvector/pgvector:pg18` + `CREATE EXTENSION IF NOT EXISTS`). `backup.sh:5` comment says pg16, compose runs pg18 (cosmetic).

## F. Modular OS spec ↔ engine drift

### F-1 (a) No silent drift. The registry explicitly models the designed-vs-shipped gap: CP-SR/CP-MON/CP-RENDER/CP-EXTRACT registered `implemented=False` — routed and surfaced as "Not Implemented", never executed, never QA-counted (`registry.py:152-170`). All 19 implemented modules carry corpus-faithful ids/owned objects (Taxonomy A reconciliation held). CP-3B waterfall now matches the corpus pari-passu treatment (old MED closed).

## G. Orchestration / LLM lanes (spot-verified against prior PASS audits)

CP-5 finding functions all degrade to None on junk input (adjusted/earnings/metrics read end-to-end this audit; relative-tolerance abs() and Blocked-cascade per prior audits). Fault isolation held on the one lane touched this cycle: deepresearch's cross-turn overload now degrades to composed-turns/demo instead of discarding gathered work. `max_retries=0` closes the timeout-stacking gap on all five ad-hoc clients; retry policy is solely `llm_client`'s overload-gated fallback.

---

## Still open / carried

| Item | Severity | Owner action |
|---|---|---|
| B-1/B-2/B-3 Command Center strip + seam + evidence gaps | MEDIUM | ~~product fix~~ **FIXED 2026-07-11** (live-aware IssuerStrip + SAMPLE tag + deep-dive link; browser-verified desktop+mobile; `views.test.tsx` pins both variants) |
| E-2 off-host backup sync | MEDIUM (ops) | **MITIGATED 2026-07-11** — opt-in `BACKUP_SYNC_CMD` hook in backup.sh/compose/.env.example (off by default; operator supplies target) |
| D-3 destructive shared mutations | MED sign-off | **CLOSED 2026-07-11 — accepted by design.** User: keep team-shared. `portfolios.update_holdings`/`query.retract_link` stay open to any authenticated analyst; matches the single-team IDOR acceptance already on record. No code change. |
| D-5 BE6-1 allowlist test | MED (carried) | **FIXED 2026-07-11** — 4 regression tests in `test_presets.py` (reject non-allowlisted pin / honor allowlisted / degrade keyless / null sentinels) |
| A-1/A-2 theoretical output-inf residue | LOW | **FIXED 2026-07-11** — earnings via safe_div; covenants+textscan amount parses finite-gated at source; pinned in `test_nan_guards.py` |
| A-6 YoY label on non-annual series | LOW | **CLOSED 2026-07-11 — accepted by design.** User: keep the "YoY" label. `earnings.py` compares the last two comparable periods regardless of cadence; CP-1 series are FY/LTM in practice so the label is usually right. No code change. |
| E-4 doc-rot (A0 blockers, backup.sh pg16 comment) | LOW | **FIXED 2026-07-11** — A0-1..A0-5 marked resolved with verification note; comment corrected |
| EvidenceModal `\|\|`/ternary precedence fragility | LOW | **FIXED 2026-07-11** — explicit parens + intent comment |
| 2026-07-10 fixes still uncommitted (484+/99− across 36 files, co-mingled with user WIP) | process | commit when WIP untangles (2026-07-11 fixes now share the same tree) |
