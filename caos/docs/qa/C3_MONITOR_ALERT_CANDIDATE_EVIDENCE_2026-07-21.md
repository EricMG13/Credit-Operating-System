# C3 Monitor Alert Candidate Evidence — 2026-07-21

**Evidence class:** CANDIDATE-LOCAL / OFFLINE ONLY<br>
**Evidence refreshed:** 2026-07-22<br>
**Record status:** VERIFIED CANDIDATE-LOCAL; not release evidence<br>
**Frozen branch base:** `66e8bbfb3dae11c7427ac101aa4d184d467f0ed0`<br>
**Branch:** `codex/pd06-c3`<br>
**CP-MON:** PROVISIONAL<br>
**PD-06:** OPEN<br>
**Release decision:** NO-GO

This record captures the completed local authority, privacy, idempotency, and
evidence-path correction gate. It remains candidate-local: it is not immutable
H0, production-data, live PostgreSQL, target-host, externally operated
scheduler/dispatcher/recurring reconciler, production-flag, or enterprise-email
evidence.

## Candidate identity and topology

| Attribute | Exact candidate value |
|---|---|
| Activation implementation | Default-off activation and pre-body masking are retained from commits `2736af768566c491e1211ee26d93401f914f929c` and `901f0e65919a77cc32574b96adc16f3fd975d31b`; this record and its containing commit cover the final correction wave verified in the worktree. |
| Schema identity | `0068` is the verified single head. It adds create-idempotency persistence above `0067`; `0066` creates the additive five-table graph and `0067` adds bounded JSON storage envelopes plus safe downgrade preflight. |
| Worktree | `/private/tmp/caos-pd06-c3` |
| Application topology | One local FastAPI process serving the staged Next.js static export and API directly on `http://127.0.0.1:8000`; no Caddy, oauth2-proxy, load balancer, or second worker |
| Browser database | Fresh disposable SQLite via `sqlite+aiosqlite:////private/tmp/caos-c3-sealed-final.XXH0vD/e2e.db` |
| Browser flags | `CAOS_ALERT_RULES_V1_ENABLED=true`, `CAOS_LINEAGE_V2_ENABLED=true`, `CAOS_MODEL_ENGINE_V2_ENABLED=true` |
| Default/deploy flag | `CAOS_ALERT_RULES_V1_ENABLED=false` in settings, compose, and both environment examples |
| Browser projects | Chromium, Firefox, WebKit; one worker; command-line `--retries=0` |
| Email boundary | Governed rendered intent only; `NOT SENT`; no transport call or enterprise acceptance |

The sealed browser database started empty. A focused Chromium layout regression
ran first; its watch-rule response was browser-route-owned and persisted no C3
rule or alert. The authoritative captured 18-test matrix then ran once, followed
by axe. The screenshots therefore show three acknowledged test alerts and three
disabled cleanup rules, not production data. Each engine journey creates,
evaluates, acknowledges, reloads, and disables its own deterministic rule/event
boundary.

## Frozen activation and rollback contract

There is exactly one deployment-global activation flag:

```text
CAOS_ALERT_RULES_V1_ENABLED=false
Settings.caos_alert_rules_v1_enabled: bool = False
```

Migrations `0066` through candidate head `0068` remain applied in every
production flag state.
Production rollback means set the flag to false and restart/roll the application
normally; it never means downgrade a populated production database or delete
rule, evaluation, event-context, or delivery-intent evidence.

| Boundary | Flag false | Flag true |
|---|---|---|
| `/api/watch-rules` surface | Raw ASGI exact-prefix gate returns generic `404 Not Found` before body receive/limits, routing, rule quota, or database work; edge/CSRF policy remains outer | Task 5 scoped CRUD/manual evaluation contract remains active |
| Completed-run trigger | First-statement no-op returning zero-count `evaluated` | Task 6 committed-output evaluation remains active |
| Scheduled evaluation | First-statement no-op returning `no_claim` | Externally invoked one-shot durable claim/evaluation remains active |
| Delivery dispatch | First-statement no-op returning `None` | Externally invoked one-shot rendered-intent dispatch remains active |
| Watch-rule editor | `checking`, explicit disabled, or activation-unavailable state; no list/read/write call until exact `true` | Rule list/create/edit controls available after verified settings and list authority |
| Persisted alert inbox/state | Legacy authority remains available; profile-less proxies cannot read/adopt contextual or orphan `c3:` alerts/states | Same isolation; profile-backed C3 ownership uses the persisted profile UUID |
| Migrations `0066` through `0068` | Retained | Retained |

No in-process timer, scheduler loop, transport call, or startup dispatch hook was
added.

## Ordered candidate gates

Every PASS below was rerun against the final local candidate tree. These results
support only the candidate-local decision in this record.

| Order | Gate | Candidate result |
|---:|---|---|
| 1 | Additive schema remains present independently of activation | PASS locally: `0068` is the single head; focused migration regressions and direct `0066 → 0067 → 0068` rehearsal are green |
| 2 | Default-false configuration and settings disclosure | PASS: default/env parsing and `features.alert_rules_v1_enabled` false/true snapshots verified |
| 3 | Flag-off route and runtime isolation | PASS: the exact-prefix ASGI gate masks malformed/invalid encoded bodies across all three body routes without consuming `receive` or entering the downstream app; DB/quota/session/clock/registry sentinels remain untouched |
| 4 | Flag-off compatibility | PASS: legacy alert-event list, alert-state open/ack, and event resolve remain available |
| 5 | Flag-on rule/evaluation seam | PASS: scoped create/get/manual evaluation and deterministic replay regression green |
| 6 | Atomic in-app plus email-intent materialization | PASS locally: one persisted event/context and approved intents; email vocabulary remains `rendered_intent` / `not_sent` |
| 7 | Scheduled claim, dispatch, and recovery state machines | PASS locally: claim/completion/failure/reclaim/idempotency suites are green; an explicit terminal resume resets attempts only and preserves cursor/watermark; one-shot boundaries and the bounded reconciliation CLI exist, but no external scheduler, dispatcher, or recurring reconciler was operated |
| 8 | Persisted Monitor authority and browser journey | PASS locally: two-way individual/batch barriers, failed-only retry, custody across failed refresh, rule-authority invalidation, exact no-fallthrough fixtures, retained-input recovery, and open-only selection removal are verified; the real API create → evaluate → dedupe → event → injected PATCH failure → retry → acknowledge → reload journey passed in all three browser engines with zero retries |
| 9 | Rendered accessibility/layout | PASS locally: normal and reduced-motion desktop/phone axe matrices have zero violations or layout failures and all four screenshots were visually inspected |
| 10 | Operational rollback truth | PASS as contract: flag-off is non-destructive; downgrade was disposable local rehearsal only |

These are ordered verification gates under the one Boolean, not separate hidden
feature flags.

## Verified correction scope

The exact-tree gates verify these fail-closed boundaries:

- `0067` keeps the frozen JSON wire limits and adds bounded database storage
  envelopes plus a pre-mutation incompatible-downgrade refusal. Revisions
  `0067` and `0068` refuse offline downgrade before emitting destructive DDL,
  because a live connection is required to inspect protected rows.
- Application SQLite connections enforce `PRAGMA foreign_keys=ON`. A test-only
  per-transaction deferral preserves commit-time orphan rejection while valid
  unordered fixtures settle.
- Completed-run and materialization scope use issuer, portfolio, and position
  authority as of the recorded observation/evaluation time. Later changes do
  not retroactively authorize an older observation.
- An explicit terminal scheduled resume resets only the attempt counter and
  preserves the schedule cursor and last-evaluated watermark.
- `python -m reconcile_alert_rules` processes one bounded, cursor-addressed,
  idempotent page and exits. It has no timer/startup hook and refuses flag-off
  execution.
- Desktop and phone alert transitions enforce two-way individual/batch
  barriers. Partial batch retry retains failed IDs only, and failed refreshes
  retain workflow custody until completion or dismissal.
- Event lifecycle `PATCH` preserves omitted assignee, note, and prior resolution
  note through acknowledgement/resolution. Explicit null or blank assignee/note
  inputs still clear those fields.
- Rule-authority loss closes writable editor state and clears its draft.
  Browser fixtures intercept the complete alert/watch-rule prefixes with fresh
  state per installation and no backend fallthrough.
- A failed acknowledgement renders the retained-input copy exactly as
  `Input was preserved. The workflow transition is available to retry.`
- A cookie-less proxy email that resolves a persisted Analyst keeps the
  historical global `caller.id` (`X-Forwarded-User`, with email fallback) while
  carrying the profile UUID separately. Only the five watch-rule handlers and
  contextual C3 alert/state ownership substitute that UUID; a valid profile
  cookie retains its existing UUID-based global identity contract.
- A profile-less proxy retains its existing forwarded-user identity but every
  watch-rule handler fails closed with 403. It also cannot read contextual or
  orphan `c3:` alerts/states or adopt C3 lifecycle state, with tenancy on or off
  (including `UNASSIGNED` team scope); legacy alerts and caller-owned orphan
  legacy state remain available.
- Proxy identity resolution, SSO profile creation, and operator email erasure
  read at most two ordered case-insensitive Analyst matches and fail closed on
  ambiguity. SSO creation stores normalized email and reattaches an unambiguous
  legacy mixed-case profile to the same UUID. Document erasure uses the same
  exact-equality predicate. SQLite uses deterministic `caos_unicode_lower`;
  PostgreSQL uses `lower()` on that dialect. Unicode SQLite regressions cover
  identity, operator, and document cleanup.
- Self-erasure always covers the profile UUID and canonical email. It also
  covers the active forwarded-user/email principal only when the forwarded email
  case-insensitively matches authenticated `caller.email`; a mismatched header
  cannot broaden erasure. Operator erasure by email resolves and removes the
  UUID-owned C3 graph. Neither path can infer a distinct historical proxy alias
  not stored on Analyst, a pre-existing limitation retained explicitly rather
  than overstated.
- `SignalObservation` rejects U+0000 in `source_identity`,
  `categorical_value`, every `source_artifact_refs` item, and bounded JSON;
  manual evaluation converts those request defects to 422 before persistence.

## TDD record

Server RED was captured before production/config edits with the activation suite
plus the existing settings snapshot selector. Result: **9 failed, 2 passed**.
The two pre-existing compatibility assertions passed; all nine failures mapped
to the absent flag, settings disclosure, route mask, or runtime no-op boundary.

Frontend RED was captured before production edits over the rule editor,
persisted controller, and phone/governance integration slices. Result:
**5 failed, 33 passed across 38 tests**. Every failure mapped to absent
activation discovery/gating: missing availability, unused settings, or a
watch-rule call occurring while activation was false/unverified.

A later independent review exposed a framework-order gap in the initial route
dependency: malformed JSON was decoded before dependencies and returned `422`
instead of the required generic `404`. The focused regression was observed RED
as **1 failed**. The provisional `PUT` probe in that run already returned `404`
and was not part of the defect; the final regression is limited to the body
decoding boundary.

Focused GREEN after implementation:

```text
server activation/settings before framework-order correction: 17 passed
corrected activation suite: 22 passed
frontend activation slice: 40 passed
frontend Monitor/API regression at that checkpoint: 89 passed
```

A final cookie-precedence review found that a valid profile cookie makes
`caller.id` the profile UUID, so the prior self-erasure call omitted the active
proxy alias. The two-test regression was observed RED as **1 failed, 1 passed**:
the same-email alias survived while the mismatched-email safety case passed.
After the route conditionally added the active forwarded-user/email principal
only when forwarded email matches authenticated `caller.email`, the selector
passed **2/2**.

The first sealed 1440×900 screenshots then exposed clipped inspector controls
despite zero-finding axe JSON. The new Chromium layout regression was observed
RED with **9 px** rail overflow. The hardened axe layout probe was separately
observed RED with **1 layout failure** (`clientWidth=240`, `scrollWidth=273`,
**33 px** unexpected supporting-rail overflow). After the min-width/grid repair,
the focused browser regression passed **1/1** and the final matrices below
reported zero supporting-rail overflow.

The historical focused counts above remain TDD checkpoints only. Final
exact-tree regression totals are recorded below.

## Server and frontend regression evidence

The full server command ran from the repository root:

```bash
PYTHONDONTWRITEBYTECODE=1 \
  /Users/ericguei/Claude/Projects/Credit\ Operating\ System/caos/server/.venv311/bin/python \
  -m pytest -q caos/tests/server
```

Result: **2,919 passed, 15 skipped, 0 failed in 162.21s**. The initial sandboxed
invocation had seven fake-ClamAV failures solely because the sandbox denied
loopback socket binding; the identical authorized rerun above cleared all seven.
It emitted two non-failing warnings: the inherited FastAPI TestClient Starlette
deprecation and a duplicate XLSX fixture member.
Full server Ruff also passed:

```bash
/Users/ericguei/Claude/Projects/Credit\ Operating\ System/caos/server/.venv311/bin/python \
  -m ruff check caos/server caos/tests/server
```

The isolated full frontend rerun disabled all configured retries from
`caos/frontend`:

```bash
npm test -- --run --retry=0
```

Result: **267 test files passed; 1,927 tests passed; 0 failed in 48.36s**. The
suite's intentional offline-path tests emitted their expected diagnostic error
logs without test failures. A prior zero-retry run exposed an unrelated Report
Studio two-animation-frame staging race in its test setup; the corrected test
waits for that documented staging boundary, passed 30/30 repetitions, and the
final full-suite result above contains no retry.

Frontend static and fixture commands:

```bash
cd caos/frontend
npx tsc --noEmit
npx eslint src scripts/browser-surface-fixtures.mjs \
  scripts/browser-surface-fixtures.test.mjs --max-warnings=0
node --test scripts/browser-surface-fixtures.test.mjs
node --check scripts/browser-surface-fixtures.mjs
```

Result: **PASS**. TypeScript and ESLint exited zero; the browser fixture test
passed **1/1**; and the fixture script syntax check exited zero.

Production build and staging commands:

```bash
cd caos/frontend
npm run build

cd ../..
bash caos/scripts/build_frontend.sh
```

Result: **PASS**. Both production builds completed successfully, including
TypeScript and 20/20 static pages. The staging script copied **249 files** into
`caos/server/static`. Build output explicitly showed
`turbopackFileSystemCacheForDev` disabled.

## Real-local-API browser evidence

The server was started from the repository root with the staged production
frontend and the exact non-secret environment below:

```bash
env \
  DATABASE_URL=sqlite+aiosqlite:////private/tmp/caos-c3-sealed-final.XXH0vD/e2e.db \
  CAOS_ALERT_RULES_V1_ENABLED=true \
  CAOS_LINEAGE_V2_ENABLED=true \
  CAOS_MODEL_ENGINE_V2_ENABLED=true \
  /Users/ericguei/Claude/Projects/Credit\ Operating\ System/caos/server/.venv311/bin/python \
  caos/server/run.py
```

It used the local development authentication/profile path and did not traverse
the production edge. An earlier invocation correctly failed closed when a
production-like session secret was combined with development mode; the corrected
development-local invocation above was used for all reported browser evidence.

Corrected-candidate complete Monitor command, from `caos/frontend`:

```bash
env NODE_PATH=node_modules PLAYWRIGHT_BASE_URL=http://127.0.0.1:8000 \
  npx playwright test ../tests/frontend/e2e/monitor_flow.spec.ts \
  --project=chromium --project=firefox --project=webkit \
  --workers=1 --retries=0
```

Result: **18/18 passed in 13.3s** across Chromium, Firefox, and WebKit, one
worker, `--retries=0`. The matrix includes the inspector-rail regression at
1440×900 in each engine plus the real-API journey. An earlier correction probe
exposed one stale assertion in each engine: the journey expected a selected
checkbox to survive a successful acknowledgement even though the corrected
controller intentionally removes batch-selection authority from non-open
alerts. The journey now asserts checkbox and batch-toolbar removal. The 18/18
result above is the single retained sealed-database matrix described in the
topology section.

The C3 journey asserted:

- rule creation through the rendered editor and real API;
- manual evaluation with a deterministic observation;
- replay deduplication to the same persisted alert event;
- visible persisted event identity;
- exactly one browser-injected `PATCH` 503, with draft and selection retained;
- one explicit analyst retry, then persisted acknowledgement;
- acknowledgement retained after page reload; and
- cleanup that disables the exact created rule and asserts the cleanup response.

The injected 503 is a controlled Playwright route fault. It proves UI recovery
behavior, not a target-host or enterprise service failure.

## Axe and visual evidence

**Gate history — the first capture was a visual false negative.** The original
`c3-sealed-monitor-*` matrices reported zero findings while the four
screenshots showed desktop rule controls ("New rule", "READ ONLY") rendered
outside the 1440×900 inspector rail: the automated harness did not measure
horizontal overflow on supporting context/inspector rails, so the clipping
passed. The gate was **reopened** (RT-2026-07-22-831): the
WatchRuleEditor/MonitorInspector grid and min-width constraints were repaired,
`a11y-axe.mjs` was hardened to detect unexpected horizontal overflow on
supporting rails (its RED run against the old layout proved the defect —
inspector `clientWidth` 240 vs `scrollWidth` 273, 33px overflow), a
three-engine `monitor-08` inspector-bounds regression was added, and the full
normal/reduced matrix below was **recaptured** on the corrected tree.

Normal-motion command, from `caos/frontend`:

```bash
env BASE=http://127.0.0.1:8000 \
  'ROUTES=/monitor?mode=live&dataset=alerts' \
  VIEWPORTS=1440x900,390x844 \
  'A11Y_READY_SELECTOR=[data-testid="monitor-persisted-ready"]' \
  A11Y_RESULT_FILE=/private/tmp/c3-sealed-final-monitor-real-axe.json \
  SCREENSHOT_DIR=/private/tmp/c3-sealed-final-monitor-real-axe \
  node scripts/a11y-axe.mjs
```

Reduced-motion command was identical with:

```text
REDUCED_MOTION=1
A11Y_RESULT_FILE=/private/tmp/c3-sealed-final-monitor-real-axe-reduced.json
SCREENSHOT_DIR=/private/tmp/c3-sealed-final-monitor-real-axe-reduced
```

Both recaptured exact-tree matrices reported:

```text
total_nodes: 0
scan_errors: 0
layout_failures: 0
page_overflow_px: 0 for both viewports
unexpected_supporting_horizontal_overflow: []
clipped_controls: []
target_size_failures: []
overlay_collisions: []
violations: []
```

All four desktop/phone normal/reduced screenshots were visually inspected
again after the recapture. Desktop rule controls are fully visible inside the
inspector rail; the rendered institutional Monitor is legible, interactive
controls remain within the viewport, status is labelled independently of
color, and normal/reduced layouts are consistent.

Final local artifact hashes captured after the recaptured run:

| Local artifact | SHA-256 |
|---|---|
| `/private/tmp/c3-sealed-final-monitor-real-axe.json` | `713ad3e5a00d59c9e47f9d8d4f1fb5a996ee20f1fb6712a924fafdd2b2e7760d` |
| `/private/tmp/c3-sealed-final-monitor-real-axe-reduced.json` | `713ad3e5a00d59c9e47f9d8d4f1fb5a996ee20f1fb6712a924fafdd2b2e7760d` |
| normal 1440×900 screenshot | `7cac41246b0339047360102b04ab82c96570c084a8e3a6d2c405bc876ea43479` |
| normal 390×844 screenshot | `a3f12dac3306e122566eb88d24eec4d0a27868151475fe68bbccf5c8fbdc1223` |
| reduced 1440×900 screenshot | `da621f69d8854f71aeec0355f3d701a62cc18bd6b318221403b4ded07a6797d3` |
| reduced 390×844 screenshot | `a3f12dac3306e122566eb88d24eec4d0a27868151475fe68bbccf5c8fbdc1223` |

These files remain local `/private/tmp` artifacts. Their hashes make this record
checkable while the files exist; they do not make the evidence an immutable H0
archive.

## Migration evidence

The direct rehearsal used disposable SQLite database
`/private/tmp/caos-c3-migration-rehearsal.hBcIMG/online.db`. From `caos/server`, the
designated Python environment ran each Alembic operation with that database URL.

Ordered results:

1. `alembic heads` returned **`0068 (head)`**.
2. A fresh `upgrade head` passed; `current` returned `0068 (head)` and both
   idempotency columns were present.
3. With an empty idempotency ledger, `downgrade 0066` ran
   `0068 → 0067 → 0066`; no temporary Alembic tables remained. Re-upgrade to
   head restored `0068`.
4. A valid watch-rule row was populated with a create-idempotency key and
   64-character lowercase request hash. `downgrade 0067` then failed with the
   expected `0068 cannot downgrade` guard; revision `0068`, the row, and both
   ledger fields remained intact.
5. Clearing only those two ledger fields allowed downgrade to `0067`; re-upgrade
   restored `0068 (head)`, retained the rule/version rows, and left zero
   temporary Alembic tables.
6. PostgreSQL-dialect offline commands `downgrade 0067:0066 --sql` and
   `downgrade 0068:0067 --sql` both exited non-zero with the required live
   preflight message. Each stdout contained only `BEGIN` plus the migration
   comment; neither output contained `DROP`.

The check warnings were inherited schema warnings: cycle-sort metadata and the
`document_chunks.tsv` computed default. They did not create drift or a non-zero
result. Revision `0066` creates the additive C3 graph; `0067` keeps the canonical
64 KiB and 256 KiB wire limits while adding bounded dialect storage envelopes;
and `0068` adds scoped durable create idempotency.

The focused migration command was:

```bash
PYTHONDONTWRITEBYTECODE=1 \
  /Users/ericguei/Claude/Projects/Credit\ Operating\ System/caos/server/.venv311/bin/python \
  -m pytest -q caos/tests/server/test_watch_rule_migration.py
```

Result: **28 passed in 24.95s**. This includes the `0067` incompatible-downgrade
preflight and the `0068` populated-idempotency-ledger refusal. The suite also
covers `0066` through `0068` upgrades, wire-limit acceptance, raw-storage
overflow rejection, legacy-alert preservation, empty-ledger downgrade, and
offline refusal before destructive SQL.

Application SQLite connections execute `PRAGMA foreign_keys=ON`; a test-only
per-transaction deferral permits valid unordered fixtures while unresolved
orphans still fail at commit. This remains destructive local/disposable SQLite
and offline PostgreSQL data definition language (DDL) evidence. It is not a live
PostgreSQL migration, downgrade, or multi-worker rehearsal.

## Configuration and change-scope audit

The true-valued deployment-string audit was:

```bash
rg -n 'CAOS_ALERT_RULES_V1_ENABLED=true' \
  .github/workflows/ci.yml \
  caos/.env.example \
  caos/deploy/.env.example \
  caos/deploy/docker-compose.yml
```

It returned exactly one deployment/configuration occurrence:

```text
.github/workflows/ci.yml:178
```

That occurrence is scoped to the real-API E2E server subprocess. Compose and
both environment examples are false. Tests opt in through local settings
fixtures; the global test default remains false.

Pre-edit impact evidence retained the higher symbol risk even though final
diff detection was lower:

- `Settings`: CRITICAL, 122 direct / 258 total; additive field only.
- `WorkspaceSettings`: CRITICAL, 159 direct / 288 total; optional field only.
- `installSurfaceStubs`: MEDIUM, 14 direct / 18 total.
- `read_settings`, `MonitorInspector`, and `useLiveMonitorView`: LOW.
- the new/stale-index route, trigger, dispatch, and controller symbols were
  UNKNOWN, not treated as safe zero.

After the final documentation reconciliation, the tree was reindexed and
GitNexus reported **26,931 nodes, 48,646 edges, 805 clusters, and 300 flows**.
(The prescribed `--force` full reindex aborted twice in a gitnexus native
worker on this host; the recorded numbers come from the completed incremental
reindex of the same final tree — a tooling deviation, not an evidence gap.)
Final `detect_changes(scope="compare", base_ref="66e8bbfb…")` reported
**65 changed files, 1,542 indexed changed symbols, 223 affected execution
flows, CRITICAL aggregate risk** — the file/symbol delta over the prior
64/1,540 reading is this documentation reconciliation itself. The affected
flows include rule and alert mutation paths; the result is retained as a real
blast-radius warning, not reduced to the earlier incremental LOW readings.
Independent whole-diff review and the complete regression/browser gates are
therefore required before staging.

The required comparison against `origin/main` reported **872 files, 8,260
symbols, 287 flows, CRITICAL risk** — unchanged from the prior reading. That
remote reference predates substantial branch history and is not the frozen C3
scope; it is recorded for compliance, while commit
`66e8bbfb3dae11c7427ac101aa4d184d467f0ed0` remains the operative candidate
base.

## Critic and review disposition

RT-2026-07-21-781 through RT-2026-07-22-832 are resolved in
`.agent-reviews/redteam.md` (RT-2026-07-22-823 is the accepted scale residual).
The record covers route ordering, first-statement no-ops, mixed-version
settings, non-destructive rollback, durable idempotency, storage bounds,
historical scope, split global/C3 identity continuity, profile-less proxy
alert isolation, Unicode email equality, privacy erasure, capability
invalidation, evidence semantics, coherent decision state, open-only selection
authority, evidence truth, the inspector-clipping axe false negative and its
hardened harness recapture (RT-831), and conditional cookie-precedence
self-erasure (RT-832). The scale limitation remains an explicit activation
blocker, not a hidden local acceptance claim.

Independent whole-diff code review returned CLEAN for remaining High/Critical
defects after the real-API E2E
selector, acknowledged-state, cleanup, public idempotency, create-conflict,
mixed-case and Unicode erasure, split proxy/C3 ownership, profile-less alert
fencing, deep JSON-boundary, offline-downgrade, and open-only authority
corrections.
Those corrections hardened the implementation and test path without broadening
the frozen runtime contract. A separate pre-body review also returned CLEAN
after the malformed-body gap and associated evidence wording were corrected.

The 2026-07-22 correction wave adds the JSON storage-envelope and idempotency
migrations, runtime SQLite foreign-key enforcement, historical scope-time
checks, explicit terminal schedule resume, bounded operator reconciliation,
Monitor mutation/custody authority, rule-authority invalidation, privacy graph
erasure, deep JSON-boundary revalidation, and exact browser-fixture
interception. The integrated critic disposition is recorded in
`.agent-reviews/redteam.md`.

## Residual blockers and decision

The candidate does **not** close any of the following:

- a clean reconciled, digest-addressed H0 image and production-data snapshot;
- migrations `0066` through `0068` upgrade/check and multi-worker lease behavior on live
  PostgreSQL;
- target edge/authz/storage parity;
- an actually operated external scheduler and dispatcher over an observation
  window;
- a controlled production flag enablement, observation, and flag-off rollback;
- enterprise email transport, acceptance, rejection, retry, and safe failure
  evidence;
- target-host capacity, queue/pool, fault, custody, backup, and recovery proof;
- the accepted RT-2026-07-22-823 scale residual: **target-volume evidence,
  server-windowed alert history, and batched decision context** — the present
  drain-and-render correctness implementation is explicitly not capacity
  evidence;
- C5 and C13 runtime-promise closure.

Decision: **LOCAL CANDIDATE GATE PASS; RELEASE NO-GO**. CP-MON remains
PROVISIONAL, PD-06 remains OPEN, and the overall release remains NO-GO. Do not
push, deploy, enable the production flag, claim email delivery, or represent
this candidate-local record as H0/live evidence.

Related truth records:

- [Promise-to-Runtime Map](PROMISE_TO_RUNTIME_MAP.md)
- [Application Surface Matrix](APPLICATION_SURFACE_MATRIX_2026-07-20.csv)
- [Frozen C3 contract](C3_MONITOR_ALERT_CONTRACT.md)
