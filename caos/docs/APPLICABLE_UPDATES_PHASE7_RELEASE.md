# Applicable Updates — Phase 7 Release Record

**State:** local release verification complete with environment gates · **Production rollout:** not
authorized or started · **Candidate branch:** `codex/111` · **Source base at
Phase 7 start:** `d68cdd59` · **Alembic head:** `0058`

This record is the release boundary for Phases 0–7. A green local or CI run
means the candidate is eligible for operator-controlled observation; it does
not authorize deployment, production flag changes, compatibility cleanup or a
schema downgrade over retained evidence.

## Immutable inputs

| Input | Release identity |
|---|---|
| CP-4D checked manifest | `Modular OS/CP-4D/SHA256SUMS.json` · SHA-256 `044af7c4e39631bdd50f0f272182df4ff58fbdbd5d6a52edbc6c682d460679f7` |
| CP-2G checked manifest | `Modular OS/CP-2G/SHA256SUMS.json` · SHA-256 `85ba930fa7951ba397429a94662f259ca46a028bd6d6a1f7e58150722e334396` |
| Price-feed template | `caos/docs/reference/CAOS_V1_PRICE_FEED_TEMPLATE.md` |
| Model workbook contract | `caos/docs/reference/CAOS_V1_MODEL_WORKBOOK_TEMPLATE.md` plus version 2 runtime sheets |
| Integrated fixture | `caos/tests/server/test_phase7_integrated_journey.py` · explicitly synthetic; never a production finding |

Before deployment, record the immutable image digest and merged Git commit next
to this document in the release ticket. Prompt-manifest drift reopens the critic
gate and invalidates this record.

## What the integrated journey proves

The release test performs one real application path using labelled synthetic
inputs:

`document upload → source manifest → market XLSX preview/commit → RV screen →
exact Pipeline run → CP-4D + CP-2G → Model Engine v2 → checkpoint → frozen report
preview/publication → XLSX export`

It asserts the same document, manifest, market snapshot, run, model calculation
hash and checkpoint identities survive downstream. It checks 99.5 price and 425
discount margin at the RV surface, both specialized prompt fingerprints, a
single owner-scoped terminal event and the frozen calculation hash in the
exported workbook. The test-only CP-1 bridge and Committee Ready promotion are
clearly isolated after real module assertions; they validate publication
plumbing, not credit correctness.

## Authorization matrix

Foreign or read-only access must fail without revealing object existence.
Default single-team cross-analyst run reads remain intentional; team scoping is
enforced when tenancy is enabled.

| Artifact / endpoint | Required scope | Negative proof |
|---|---|---|
| `GET /api/runs/{id}/modules[/…]` | visible issuer team | `test_tenancy_isolates_issuers_runs_portfolio_and_query` |
| market import preview/commit | authenticated write role; owned commit | `test_preview_and_commit_require_write_role`, foreign snapshot tests |
| market snapshot / RV screen | owning analyst or reference snapshot | `test_market_xlsx_commit.py` authorization cases |
| exact Model v2 read/save/checkpoint/import | issuer visible; draft/run/import owner; write role for mutations | `test_model_v2_api.py`, `test_model_workbook_api.py` |
| context lineage | context owner; every traversed object authorized | `test_phase1b_lineage.py`, freshness authorization tests |
| notification feed / seen | event owner | `test_notifications.py` and terminal fallback test |
| report preview/version/export | owner; exact authorized run/checkpoint/manifest | `test_model_v2_report_identity.py` |
| CP-4D / CP-2G output | same visible run boundary | tenancy module-read tests plus module source-gate tests |

## Verification command matrix

Run from repository root unless a different working directory is shown. API
keys are removed for deterministic fixture execution.

| Gate | Command | Candidate result |
|---|---|---|
| Phase 7 exact journey | `caos/server/.venv311/bin/python -m pytest caos/tests/server/test_phase7_integrated_journey.py -q` | PASS — 1 passed |
| Phase 7 focused server | `env -u ANTHROPIC_API_KEY -u GEMINI_API_KEY -u OPENROUTER_API_KEY caos/server/.venv311/bin/python -m pytest caos/tests/server/test_market_xlsx_commit.py caos/tests/server/test_tenancy.py caos/tests/server/test_model_v2_api.py caos/tests/server/test_async_runs.py -q` | PASS — 76 passed, 2 skipped |
| Module consistency | `caos/server/.venv311/bin/python "Modular OS/tools/check_module_consistency.py"` | PASS — 26 modules, 0 drift |
| Python compile / Ruff | `caos/server/.venv311/bin/python -m compileall -q caos/server` and configured Ruff gate | PASS |
| Full server | deterministic `pytest caos/tests/server caos/tests/stress caos/tests/cohort -q` | ENVIRONMENT GATE — 1808 passed, 9 skipped; 7 unchanged ClamAV loopback cases denied by the controller sandbox |
| Migration empty cycle | upgrade → downgrade → re-upgrade against disposable empty DB | PASS — 3 focused migration tests |
| Evidence downgrade guard | focused migration refusal tests only; never destructive rehearsal on retained evidence | PASS in focused migration tests; restored-snapshot rehearsal remains an operator gate |
| Frontend focused | exact-run authority tests | PASS — 4 files / 24 tests |
| Frontend full | `npm test -- --maxWorkers=1`, `npx tsc --noEmit`, `npm run lint`, `npm run build` from `caos/frontend` | PASS — 157 files / 861 tests; TypeScript, ESLint and production build passed |
| Browser / a11y | local axe and responsive verifier over Deep-Dive, Pipeline, Model and Reports; Phase 6 one-page print proof retained because this phase does not alter report layout | PASS — 0 axe violations; 32/32 responsive/200% zoom checks; existing one-page landscape print contract unchanged |
| Deploy configuration | `docker compose -f caos/deploy/docker-compose.yml config -q` with non-production placeholder secrets | PASS — all five flags resolve independently and default off |
| Diff / caller review | compare with `origin/main`; GitNexus when usable | GitNexus refresh failed in a deterministic worker-startup loop; exhaustive caller/diff review completed before commit |

Do not change a pending cell to PASS without retaining the command output in CI
or the release ticket. An unavailable gate stays visibly blocked; it is not
converted into a pass by documentation.

## Staged enablement and rollback

All flags are independently default-off in the deploy example and passed
through Docker Compose. Flags are deployment-global, so schedule a controlled
pilot window rather than assuming cohort isolation.

| Stage | Flag change | Entry evidence | Observe / abort | Rollback |
|---:|---|---|---|---|
| 0 | all `false` | migrations applied; compatibility routes green | baseline error/auth/latency | keep schema; return to last-good image if code-only fault |
| 1 | `CAOS_LINEAGE_V2_ENABLED=true` | dry-run/apply/verify reconciliation has zero dangling or unauthorized edges | source version invalidation, 404 boundaries, writer rollback | flag `false`; retain typed refs/edges |
| 2 | `CAOS_MARKET_XLSX_V2_ENABLED=true` | sanitized real workbook has zero blocking preview errors | malware/OOXML fail-closed, cached formulas, mapping, duplicate hash | flag `false`; retain immutable snapshots/evidence |
| 3 | `CAOS_MODEL_ENGINE_V2_ENABLED=true` | model/report/workbook fingerprints tie on representative issuers | finite outputs, CAS conflicts, interest/debt tie-outs, import failures | flag `false`; retain drafts/checkpoints; live issuers fail closed to compatibility UI |
| 4 | `CAOS_CP_4D_ENABLED=true` | source gate, schema, evidence and CP-6A degradation green | module faults isolated; no fabricated rich output | flag `false`; existing outputs remain historical |
| 5 | `CAOS_CP_2G_ENABLED=true` | independent CP-2G run and non-blocking behavior green | Not Applicable evidence basis; CP-6A degradation | flag `false`; CP-4D remains independent |

Advance only after the operator records a green observation decision for the
current stage. Abort immediately on unauthorized disclosure, dangling lineage,
workbook fail-open, a calculation/report fingerprint mismatch, duplicate or
missing terminal notification, source-gate fabrication, persistent 5xx
regression or inability to exercise the documented rollback.

## Migration and data rollback rules

- Schema changes remain additive; domain tables own structured payloads and
  secure storage owns raw binaries. The vault is a derived projection.
- Run upgrade/downgrade/re-upgrade only on a disposable empty database.
- On a database containing imported or analytical evidence, run the focused
  refusal tests. Do not force a downgrade, delete evidence or edit
  `alembic_version` to satisfy an old image.
- Flag rollback is the first response. If an old image cannot read the current
  head, keep the forward-compatible image/schema or restore the pre-deploy
  backup into a separate recovery environment and verify it before cutover.
- Compatibility paths remain until a separately approved cleanup after the
  complete observation window and a successful rollback rehearsal.

## Environment-dependent gates

The controller sandbox denied all seven ClamAV loopback cases with
`PermissionError: [Errno 1] Operation not permitted`; the remaining full server
suite completed 1808 passed and 9 skipped. Those seven cases must pass in an
unrestricted CI/release environment. PostgreSQL locking,
`SKIP LOCKED`, restored-snapshot migration, Docker/OAuth edge behavior, host
encryption, off-host backups and the production observation windows also cannot
be certified by this local SQLite/static-build record.

## Release decision

- [ ] Full command matrix is green or every environment blocker is explicitly
  assigned to an unrestricted gate.
- [ ] CI is green on the merged immutable commit.
- [ ] Backup restore and rollback rehearsal passed.
- [ ] Image digest and prompt-manifest hashes are recorded.
- [ ] Stage owner and observation/abort channel are named.
- [ ] Head of Research / QA approves CP-4D enablement.
- [ ] Head of Research / QA approves CP-2G enablement separately.

Until these boxes are signed, the release is **implementation-complete but not
authorized for production flag enablement**.
