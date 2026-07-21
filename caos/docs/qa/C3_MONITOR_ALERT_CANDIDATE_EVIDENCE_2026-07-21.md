# C3 Monitor Alert Candidate Evidence — 2026-07-21

**Evidence class:** CANDIDATE-LOCAL / OFFLINE ONLY<br>
**C3 implementation:** `2736af768566c491e1211ee26d93401f914f929c`<br>
**Branch:** `codex/pd06-c3`<br>
**CP-MON:** PROVISIONAL<br>
**PD-06:** OPEN<br>
**Release decision:** NO-GO

This record proves the internal default-off activation contract and a local
end-to-end C3 Monitor journey. It is not immutable H0 evidence, production-data
evidence, a live PostgreSQL rehearsal, target-host evidence, proof of an
externally operated scheduler/dispatcher, production flag observation, or
enterprise email delivery evidence.

## Candidate identity and topology

| Attribute | Exact candidate value |
|---|---|
| Implementation commit | `2736af768566c491e1211ee26d93401f914f929c` (`feat: gate C3 alert activation`) |
| Commit time | `2026-07-21 22:59:20 +0100` |
| Worktree | `/private/tmp/caos-pd06-c3` |
| Application topology | One local FastAPI process serving the staged Next.js static export and API directly on `http://127.0.0.1:8000`; no Caddy, oauth2-proxy, load balancer, or second worker |
| Browser database | SQLite via `sqlite+aiosqlite:////private/tmp/caos-c3-e2e.oXtDYj/e2e.db` |
| Migration database | Disposable SQLite via `sqlite+aiosqlite:////private/tmp/caos-c3-migration.pjcmMw/rehearsal.db` |
| Browser flags | `CAOS_ALERT_RULES_V1_ENABLED=true`, `CAOS_LINEAGE_V2_ENABLED=true`, `CAOS_MODEL_ENGINE_V2_ENABLED=true` |
| Default/deploy flag | `CAOS_ALERT_RULES_V1_ENABLED=false` in settings, compose, and both environment examples |
| Browser projects | Chromium, Firefox, WebKit; one worker; command-line `--retries=0` |
| Email boundary | Governed rendered intent only; `NOT SENT`; no transport call or enterprise acceptance |

The local browser database was intentionally reused during test-hardening runs.
The screenshots therefore show cumulative acknowledged test alerts and disabled
test rules, not a clean production snapshot or an assertion that only one total
alert exists. Each final golden journey creates, evaluates, acknowledges,
reloads, and cleans up its own deterministic rule/event boundary.

## Frozen activation and rollback contract

There is exactly one deployment-global activation flag:

```text
CAOS_ALERT_RULES_V1_ENABLED=false
Settings.caos_alert_rules_v1_enabled: bool = False
```

Migration `0066` remains applied in every production flag state. Production
rollback means set the flag to false and restart/roll the application normally;
it never means downgrade a populated production database or delete rule,
evaluation, event-context, or delivery-intent evidence.

| Boundary | Flag false | Flag true |
|---|---|---|
| `/api/watch-rules` router | Generic `404 Not Found` before rule quota or database dependency work | Task 5 scoped CRUD/manual evaluation contract remains active |
| Completed-run trigger | First-statement no-op returning zero-count `evaluated` | Task 6 committed-output evaluation remains active |
| Scheduled evaluation | First-statement no-op returning `no_claim` | Externally invoked one-shot durable claim/evaluation remains active |
| Delivery dispatch | First-statement no-op returning `None` | Externally invoked one-shot rendered-intent dispatch remains active |
| Watch-rule editor | `checking`, explicit disabled, or activation-unavailable state; no list/read/write call until exact `true` | Rule list/create/edit controls available after verified settings and list authority |
| Persisted alert inbox/state | Remains available and mutable under its existing authorization contract | Remains available; no authority change |
| Migration `0066` | Retained | Retained |

No in-process timer, scheduler loop, transport call, or startup dispatch hook was
added.

## Ordered candidate gates

| Order | Gate | Candidate result |
|---:|---|---|
| 1 | Additive schema remains present independently of activation | PASS locally: `0066` at head; model/migration regression green |
| 2 | Default-false configuration and settings disclosure | PASS: default/env parsing and `features.alert_rules_v1_enabled` false/true snapshots verified |
| 3 | Flag-off route and runtime isolation | PASS: router methods are masked; exploding DB/quota/session/clock/registry sentinels remain untouched |
| 4 | Flag-off compatibility | PASS: legacy alert-event list, alert-state open/ack, and event resolve remain available |
| 5 | Flag-on rule/evaluation seam | PASS: scoped create/get/manual evaluation and deterministic replay regression green |
| 6 | Atomic in-app plus email-intent materialization | PASS locally: one persisted event/context and approved intents; email vocabulary remains `rendered_intent` / `not_sent` |
| 7 | Scheduled claim and dispatch state machines | PASS locally: claim/completion/failure/reclaim/idempotency suites green; no external operator was run |
| 8 | Persisted Monitor authority and browser journey | PASS locally: real API create → evaluate → dedupe → event → injected PATCH failure → retained input/selection → retry → acknowledge → reload |
| 9 | Rendered accessibility/layout | PASS locally: normal and reduced-motion desktop/phone axe matrices are zero-finding and screenshots were visually inspected |
| 10 | Operational rollback truth | PASS as contract: flag-off is non-destructive; downgrade was disposable local rehearsal only |

These are ordered verification gates under the one Boolean, not separate hidden
feature flags.

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

Focused GREEN after implementation:

```text
server activation/settings: 17 passed
frontend activation slice: 40 passed
frontend Monitor/API regression at that checkpoint: 89 passed
```

The final current-tree regression matrices below supersede those intermediate
counts.

## Server and frontend regression evidence

Server command, from the repository root:

```bash
PYTHONDONTWRITEBYTECODE=1 \
  /Users/ericguei/Claude/Projects/Credit\ Operating\ System/caos/server/.venv311/bin/python \
  -m pytest -q \
  caos/tests/server/test_alert_rules_activation.py \
  caos/tests/server/test_settings.py \
  caos/tests/server/test_settings_inventory_contract.py \
  caos/tests/server/test_watch_rule_routes.py \
  caos/tests/server/test_alert_states.py \
  caos/tests/server/test_watch_rules.py \
  caos/tests/server/test_alert_evaluation.py \
  caos/tests/server/test_alert_sinks.py \
  caos/tests/server/test_alert_dispatch.py \
  caos/tests/server/test_alert_triggers.py \
  caos/tests/server/test_decisions_thesis.py
```

Result: **505 passed, 1 warning in 23.24s**. The sole warning is the inherited
FastAPI TestClient `StarletteDeprecationWarning` concerning `httpx` integration.
There were no skips in this matrix.

Frontend command, from `caos/frontend`:

```bash
npm test -- --run --retry=0 \
  src/lib/api-monitor-persistence.test.ts \
  src/lib/api-routes-coverage.test.ts \
  src/components/monitor/WatchRuleEditor.test.tsx \
  src/components/monitor/usePersistedMonitorController.test.tsx \
  src/components/monitor/AlertInbox.test.tsx \
  src/components/monitor/PhoneTriage.test.tsx \
  src/app/monitor/monitor-phone-triage.test.tsx \
  src/app/monitor/monitor-governance.test.tsx
```

Result: **8 files passed, 86 tests passed, 0 failed** in 2.64s. Per-file counts
were 2, 10, 13, 23, 10, 9, 4, and 15 respectively.

Static commands and results:

```bash
/Users/ericguei/Claude/Projects/Credit\ Operating\ System/caos/server/.venv311/bin/python \
  -m ruff check \
  caos/server/config.py \
  caos/server/routes/settings.py \
  caos/server/routes/watch_rules.py \
  caos/server/alert_triggers.py \
  caos/server/alert_dispatch.py \
  caos/tests/server/test_alert_rules_activation.py \
  caos/tests/server/test_alert_dispatch.py \
  caos/tests/server/test_alert_states.py \
  caos/tests/server/test_alert_triggers.py \
  caos/tests/server/test_decisions_thesis.py \
  caos/tests/server/test_settings.py \
  caos/tests/server/test_watch_rule_routes.py
# All checks passed!

cd caos/frontend
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint src --max-warnings=0
# both exit 0 with no output

cd ../..
node --check caos/frontend/scripts/browser-surface-fixtures.mjs
git diff --check
# both exit 0
```

Production build commands:

```bash
cd caos/frontend
npm run build

cd ../..
bash caos/scripts/build_frontend.sh
```

Both passed. The staging script copied **249 static files** into the FastAPI
static tree for the real-API browser run. The first sandboxed Turbopack attempt
could not bind its local compiler port; the approved local rerun passed. That
was a harness restriction, not an application build failure.

## Real-local-API browser evidence

The server was started from the repository root with the staged production
frontend and the exact non-secret environment below:

```bash
env \
  DATABASE_URL=sqlite+aiosqlite:////private/tmp/caos-c3-e2e.oXtDYj/e2e.db \
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

Final focused C3 command, from `caos/frontend`:

```bash
env NODE_PATH=node_modules PLAYWRIGHT_BASE_URL=http://127.0.0.1:8000 \
  npx playwright test ../tests/frontend/e2e/monitor_flow.spec.ts \
  --grep 'C3 real API' \
  --project=chromium --project=firefox --project=webkit \
  --workers=1 --retries=0
```

Result: **3 passed in 5.9s**.

Final complete Monitor command:

```bash
env NODE_PATH=node_modules PLAYWRIGHT_BASE_URL=http://127.0.0.1:8000 \
  npx playwright test ../tests/frontend/e2e/monitor_flow.spec.ts \
  --project=chromium --project=firefox --project=webkit \
  --workers=1 --retries=0
```

Result: **15 passed in 11.7s**. The inherited `NO_COLOR` / `FORCE_COLOR`
warning was informational. No retry was available to hide a failure.

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

## Actual axe and visual evidence

Normal-motion command, from `caos/frontend`:

```bash
env BASE=http://127.0.0.1:8000 \
  'ROUTES=/monitor?mode=live&dataset=alerts' \
  VIEWPORTS=1440x900,390x844 \
  'A11Y_READY_SELECTOR=[data-testid="monitor-persisted-ready"]' \
  A11Y_RESULT_FILE=/private/tmp/c3-task8-monitor-real-axe.json \
  SCREENSHOT_DIR=/private/tmp/c3-task8-monitor-real-axe \
  node scripts/a11y-axe.mjs
```

Reduced-motion command was identical with:

```text
REDUCED_MOTION=1
A11Y_RESULT_FILE=/private/tmp/c3-task8-monitor-real-axe-reduced.json
SCREENSHOT_DIR=/private/tmp/c3-task8-monitor-real-axe-reduced
```

Both matrices report:

```text
total_nodes: 0
scan_errors: 0
layout_failures: 0
page_overflow_px: 0 for both viewports
clipped_controls: []
target_size_failures: []
overlay_collisions: []
violations: []
```

All four desktop/phone normal/reduced screenshots were visually inspected. The
rendered institutional Monitor remained legible, keyboard controls remained
reachable, and normal/reduced layouts were consistent.

Local artifact hashes captured after the run:

| Local artifact | SHA-256 |
|---|---|
| `/private/tmp/c3-task8-monitor-real-axe.json` | `7452db872487db66437a7ce74c624b7223880860c8ac625d7679be2d36314d6b` |
| `/private/tmp/c3-task8-monitor-real-axe-reduced.json` | `7452db872487db66437a7ce74c624b7223880860c8ac625d7679be2d36314d6b` |
| normal 1440×900 screenshot | `5db3c264182aa5d3d7e5ac52875441676ecc8696d4ac46c2533894f7ee1612e1` |
| normal 390×844 screenshot | `f6d0074693ab342d812df510f0dd7170456e755fe51c690c92a852d4c36df043` |
| reduced 1440×900 screenshot | `5db3c264182aa5d3d7e5ac52875441676ecc8696d4ac46c2533894f7ee1612e1` |
| reduced 390×844 screenshot | `5931118841a883bd15535701847bd8384e187ffb0deade76eb219c465cc9cdcf` |

These files remain local `/private/tmp` artifacts. Their hashes make this record
checkable while the files exist; they do not make the evidence an immutable H0
archive.

## Disposable migration rehearsal

This was a **destructive local SQLite rehearsal, not production rollback**.
From `caos/server`, each Alembic command used:

```bash
env \
  DATABASE_URL=sqlite+aiosqlite:////private/tmp/caos-c3-migration.pjcmMw/rehearsal.db \
  SESSION_SECRET=test-c3 ANALYST_SIGNUP_CODE=test \
  /Users/ericguei/Claude/Projects/Credit\ Operating\ System/caos/server/.venv311/bin/python \
  -m alembic <operation>
```

Ordered results:

1. `upgrade head` — exit 0.
2. `check` — exit 0, `No new upgrade operations detected.`
3. `downgrade 0065` — exit 0; `0066 -> 0065` executed.
4. `upgrade head` — exit 0; `0065 -> 0066` executed.
5. Populated legacy preservation selector:

   ```bash
   PYTHONDONTWRITEBYTECODE=1 \
     /Users/ericguei/Claude/Projects/Credit\ Operating\ System/caos/server/.venv311/bin/python \
     -m pytest -q \
     caos/tests/server/test_watch_rule_migration.py::test_upgrade_and_reverse_downgrade_preserve_populated_legacy_alerts
   ```

   Result: **1 passed in 2.36s**.

The Alembic check emitted the inherited SQLAlchemy mutually dependent-table
sort warning and the existing computed-default comparison warning for
`document_chunks.tsv`. Neither produced schema drift or a non-zero exit.

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

Pre-implementation-commit `detect_changes(scope="all")` reported **26 changed
files, 16 indexed changed symbols, 0 affected processes, LOW diff risk**. The
index predates the new C3 symbols and has degraded semantic search due to a
missing FTS layer, so focused regression and rendered evidence bound that gap.

## Critic and review disposition

RT-2026-07-21-781 through RT-2026-07-21-787 are resolved in
`.agent-reviews/redteam.md`: route ordering, first-statement no-ops, mixed-version
settings compatibility, honest UI states, CI scoping, non-destructive rollback,
and evidence truth are all encoded in tests or this record.

Independent server and frontend reviews returned CLEAN after the real-API E2E
selector, acknowledged-state assertion, and cleanup assertion were corrected.
Those corrections hardened the test and cleanup path; they did not broaden the
runtime contract.

## Residual blockers and decision

The candidate does **not** close any of the following:

- a clean reconciled, digest-addressed H0 image and production-data snapshot;
- migration `0066` upgrade/check and multi-worker lease behavior on live
  PostgreSQL;
- target edge/authz/storage parity;
- an actually operated external scheduler and dispatcher over an observation
  window;
- a controlled production flag enablement, observation, and flag-off rollback;
- enterprise email transport, acceptance, rejection, retry, and safe failure
  evidence;
- target-host capacity, queue/pool, fault, custody, backup, and recovery proof;
- C5 and C13 runtime-promise closure.

Decision: accept C3 as a **PROVISIONAL candidate-local implementation** behind
the default-off flag. Keep migration `0066` applied. Keep PD-06 OPEN and the
overall release NO-GO. Do not push, deploy, enable the production flag, claim
email delivery, or represent this record as H0/live evidence.

Related truth records:

- [Promise-to-Runtime Map](PROMISE_TO_RUNTIME_MAP.md)
- [Application Surface Matrix](APPLICATION_SURFACE_MATRIX_2026-07-20.csv)
- [Frozen C3 contract](C3_MONITOR_ALERT_CONTRACT.md)
