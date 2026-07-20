# CAOS — Consolidated Pre-Deployment Update

**Audit date:** 2026-07-20

**Application snapshot:** `codex/112@f4c790f437325152877663a87ddbdfcacd8a9b0f`

**Decision:** **NO-GO** — the application is materially stronger and the current
application files are commit-pinned, but the exact deployable image has not been
frozen or re-certified. Current narrow-screen accessibility/layout defects,
current-commit browser proof, target capacity/custody/recovery controls, and the
final digest-bound evidence bundle remain open.

This report supersedes the status verdict in
[PRE_DEPLOYMENT_CLOSURE_2026-07-18.md](PRE_DEPLOYMENT_CLOSURE_2026-07-18.md).
That report and the 2026-07-19 quality workbook remain historical evidence for
the snapshots they tested. The current route/platform/custody map is
[APPLICATION_SURFACE_MATRIX_2026-07-20.csv](../APPLICATION_SURFACE_MATRIX_2026-07-20.csv).

## 1. Executive decision

The current application builds and its principal unit/server suites pass. The
quality tracker now maps the whole product much more completely, browser
defects recorded on 2026-07-18 were closed in a 2026-07-19 seal, and the
Postgres/two-worker stack recovered from a measured 320-user latency fault and
then passed three 300-user repetitions. Those are significant readiness gains.

They do not yet justify deployment:

- the 2026-07-19 workbook and three-browser seal predate production changes in
  `f4c790f`; the final image digest has not been created or tested;
- the current 18-route × two-viewport scan has two serious WCAG target-size
  findings and two 390px layout failures;
- 17 frontend paths are reachability candidates without owner disposition;
- dedicated browser journeys remain absent for five routed business concepts,
  and 1,207 tracker scenarios remain Designed/unexecuted;
- target encryption, retention/legal-hold, paired-backup freshness, alerting,
  and remote-only recovery are not evidenced; and
- capacity is strong for the measured read mix, but the exact image/host has not
  been exercised with 15 separate principals, simultaneous heavy work, and
  provider/storage faults.

No application code was changed by this reconciliation. Audit-document edits
remain working-tree changes until intentionally reviewed and committed.
GitNexus classified the tracked unstaged documentation diff as **low risk**
with no affected execution process. Its branch-wide `origin/main` comparison
is **critical** (6,323 changed symbols, 1,328 files, 290 affected processes),
which reflects the full 63-commit-ahead branch and reinforces PD-01; it is not
the risk classification of this documentation-only update. The index itself
predates `f4c790f`, so final route/process parity must be regenerated at H0.

## 2. Current verification ledger

| Area | Evidence collected | Result / boundary |
|---|---|---|
| Application identity | Application source is at `f4c790f`; branch is one commit behind and 63 ahead of `origin/main` at audit time | Commit-pinned application snapshot; not the canonical H0 image/config/schema artifact |
| Frontend unit/static | eslint, strict `tsc --noEmit`, production build; **263 files / 1,833 tests passed** | PASS; one freshness-transition test passed via configured Vitest retry, so no-retry stability remains an H2 requirement |
| Page inventory | Build exports **18 business page endpoints** (20 static pages including framework not-found output) | Structurally mapped in the application matrix |
| Server | **2,594 passed / 15 skipped** in the restricted aggregate run; seven ClamAV cases denied loopback sockets there, then all nine AV tests passed unrestricted | Effective current evidence: **2,601 passed / 15 skipped** |
| Backend relevance | Vulture at ≥80% confidence across `server` and `scripts` | No backend candidate reported |
| Frontend relevance | Framework-aware production dependency walk: 279 production TS/TSX files, 27 roots, 262 reached | **17 candidates**; disposition required, not deletion authority |
| Current rendered accessibility/layout | 18 routes × 1440×900 and 390×844; real axe, no scan errors | **RED:** 2 serious target-size nodes and 2 narrow-layout failures; see [axe-2026-07-20.json](axe-2026-07-20.json) |
| Sealed three-browser workflows | 2026-07-19 workbook: **165 passed** across 14 Playwright specs, no retry in the sealed runs | Closes the old 125/15/1 snapshot only; production files in `f4c790f` are newer and require final-commit rerun |
| Quality tracker | 683 canonical features; 4,917 cases; 4,638 executed automation nodes; 683 features with direct automation; 710 UI controls; 173 AST handler rows; 17 processes | Strong structural coverage, but not every effect/state: 3,060 direct passes, 388 suite-evidence, 1,207 Designed, 262 N/A |
| Capacity | Original 15-user PG/two-worker: 2,584 requests, 0 failures, p95 89 ms. Post-fix 300-user repetitions: 0 failures in 51,105 / 49,770 / 51,109 requests; aggregate p95 46 / 120 / 35 ms | Strong headroom/fault-remediation evidence; target-image heavy-operation run remains open |
| Custody/recovery | source vault + Postgres records + browser draft state + operator logs + paired backup mechanism | Architecture is explicit; target encryption/governance/freshness/remote-only restore proof is open |

## 3. Answers to the application considerations

### What exists in code but was not fully represented by the prior plan?

The latest map now includes the explicit `LIVE`/`REFERENCE` authority modes and
separate Pipeline/Monitor controllers; analyst-stage Pipeline topology;
outcome-oriented Settings; Portfolio and Report visualizations; the lazy
`AskContext`/`AskShell` split; skip-link/data-mode/completion/evidence shared
surfaces; route headings and color-policy work; notification action labels plus
migration `0065`; the bounded Postgres pool; and the consolidated raw-ASGI HTTP
policy middleware. It also records platform, storage, browser-state, logging,
backup, and external-provider seams rather than treating page routes as the
entire application.

Remaining proof gaps are explicit: dedicated current browser journeys for
Decisions, Portfolios, Issuer Profile, Sector RV, and Sponsors; enterprise
email/licensed market-data activation; dynamic recovery equivalence; and the
1,207 designed tracker scenarios.

### Is all code relevant; is there dead code?

The backend scan is clean at the configured confidence. The frontend walk has
17 candidates:

1. `components/command/ActionableDislocations.tsx`
2. `components/command/SectorRV.tsx`
3. `components/issuers/ProfileSectionNav.tsx`
4. `components/query/LaneRouter.tsx`
5. `components/shared/EvidenceInspector.tsx`
6. `components/shared/FlashOnChange.tsx`
7. `components/shared/RecoveryState.tsx`
8. `lib/citations.ts`
9. `lib/color-literal-policy.ts`
10. `lib/command/coverage.ts`
11. `lib/command/dislocations.ts`
12. `lib/command/stats.ts`
13. `lib/query/format.ts`
14. `lib/query/intent-router.ts`
15. `lib/query/questions.ts`
16. `lib/query/report.ts`
17. `lib/use-resize-observer.ts`

They may include dynamic/framework, support, or test seams. L24 requires an
owner to mark each `remove`, `restore runtime reachability`, or `retain with
rationale`, followed by the full affected regression suite.

### Is the entire application mapped by the plan?

It is mapped structurally at the current snapshot: 18 routed business pages,
the global Ask/auth/shell surfaces, 173 API handler rows, 17 business processes,
background execution, ingestion/AV, database/pool, vault/backups, browser state,
logs/telemetry, and external seams. The 173 count is AST-derived and treats
method and trailing-slash aliases as distinct handler rows; it must not be
compared directly with older GitNexus route counts that used a different,
stale index. L23 must regenerate every inventory from the final candidate.

### Are all features and buttons wired?

There is strong evidence, but not a defensible all-wired claim. The tracker has
683/683 features with at least one direct automation link and inventories 710
UI controls; the sealed suite passed 165 browser nodes. However, direct
automation is not proof of success, validation, unavailable state,
persistence/reload, authorization, retry, and duplicate prevention for every
control. The sealed suite is older than the current commit, five business
routes lack dedicated E2E specs, and the current accessibility scan is red.
L27 is the closure mechanism.

### Do the audit frameworks and loops cover all areas?

The L1–L27 framework covers build/test, security, analytical correctness,
accessibility, workflow/browser behavior, surface parity, dead code, capacity,
recovery, custody, and failure handling. Coverage breadth is adequate; current
execution completeness is not. L23–L27 remain manual/final-candidate gates,
L11 is currently red, and several L27 failure/recovery states and L25/L26
target-host legs are unexecuted. A framework entry is not evidence until its
artifact is current, green, and bound to the released bytes.

### Has the codebase, its connections, and throughput been stress-tested?

Yes, materially, but not completely on the release target. A 320-user
read-latency fault was reproduced on Postgres/two workers. The remediation
bounded the SQLAlchemy pool and replaced four `BaseHTTPMiddleware` layers with
one raw-ASGI policy layer. Three subsequent 300-user runs completed with zero
failures and aggregate p95 of 46, 120, and 35 ms. This proves the defect was
addressed in that local topology. It does not prove the final image, target
vault/storage, external providers, large datasets, simultaneous heavy jobs,
or host-level recovery.

### What happens with 15 active users?

Under the measured mixed read/navigation profile, 15 users are below the
observed capacity knee: both the older Postgres/two-worker 15-user run and the
post-fix 300-user repetitions completed without request failure. Heavy work is
intentionally bounded, so simultaneous runs/uploads do not all execute at
once: work queues or rejects with explicit backpressure according to per-worker,
global, per-analyst, and upload admission limits. Final proof still requires
15 distinct authenticated principals on the exact target configuration while
runs, research, reports, uploads, slow providers, and storage faults overlap.

### Is all collected and produced data stored safely in the vault?

No—and the design should not claim that it is. Custody is deliberately split:

| Record class | Authoritative/current location | Release control still required |
|---|---|---|
| Original uploads, source bytes, committed source workbooks | Document vault | target volume encryption, permissions, retention/legal hold, backup/restore evidence |
| Issuers, chunks, runs, facts, claims/evidence, QA, alerts, decisions, models, reports, research jobs | Postgres | target DB/volume encryption, least privilege, retention/erasure, backup/restore evidence |
| Signed session and analyst identity | Secure signed cookie + Postgres analyst record | final edge/cookie/auth configuration test |
| Unsaved chat/model/report/research and UI preferences | Browser local/session storage | disclose non-durability; prevent secrets and authoritative records from relying on it |
| Application/access/audit logs | Operator log storage | access, redaction, retention, rotation, alerting |
| Recovery copies | Paired Postgres dump + vault archive; optional remote sync | encrypted off-host destination, freshness/failure alarm, remote-only restore drill |

The application does not itself guarantee encryption at rest for Postgres,
vault volumes, logs, or backup media. Those are deployment controls and PD-08
remains non-waivable.

## 4. Final blocker ledger

| ID | Blocking condition | Completion gate |
|---|---|---|
| **PD-01** | No canonical release image: branch reconciliation, image digest, schema/config/flag manifest, SBOM and scan are not one H0 artifact | Clean reconciled H0 candidate; record commit, image digest, schema head, config fingerprint, flags, dependency/SBOM/scan evidence |
| **PD-02** | The 165-case seal predates `f4c790f`; five routed concepts lack dedicated E2E; current unit run used one configured retry | L27 current candidate green across Chromium/Firefox/WebKit without retry for primary journeys and affected states |
| **PD-03** | Tracker is comprehensive but sealed before current production changes; 1,207 scenarios remain Designed and 388 rely on suite evidence | L23 regenerate route/nav/API/process/control/tracker/evidence parity from the candidate and execute all release-required scenarios |
| **PD-04** | 17 frontend reachability candidates lack owner disposition | L24 disposition every row and rerun lint/type/unit/build/affected browser evidence |
| **PD-05** | Root/shared and six segment error surfaces are tested statically/unit-level, not by injected browser failure across route classes | L27 prove named failure, preserved issuer/context/draft state, authorized retry, and no duplicate effect |
| **PD-06** | Reference/manual/enterprise seams remain for some analytical modules, Monitor/email, licensed market data, and external providers | Promise-to-runtime map; honest unavailable/reference state; activation and failure evidence for enabled seams |
| **PD-07** | Strong local 300-user evidence is not bound to the target image/host or simultaneous authenticated heavy work | L25 exact image with 15 principals, target-size data, heavy-operation overlap, slow/429/529/storage faults, queue/pool/memory/isolation/recovery telemetry |
| **PD-08** | Target at-rest encryption, record governance, paired-backup freshness/alerting, and off-host recovery are unproven | E8/G8/G9 + L22/L26: approved custody policy, encrypted target/off-host stores, alarms, and remote-only restore |
| **PD-09** | Final evidence is not bound to released bytes | Archive one digest-addressed H0/H1/H2 evidence bundle and signed decision record |
| **PD-10** | Current a11y/layout scan is red and frontend retry stability is not proven | Zero axe nodes/scan errors/clipped controls/layout failures at required desktop, 390px/coarse pointer, reduced motion, and native 200% zoom; no-retry frontend pass |

## 5. Required release order

1. Fix PD-10 and close or explicitly disposition the PD-04 candidates.
2. Add the missing route/recovery journeys and resolve PD-06 seam promises.
3. Reconcile with `origin/main`, freeze H0, and generate the immutable
   commit/image/schema/config/flag/SBOM manifest.
4. Regenerate L23 and run L27 in all three browsers against that image without
   retry; execute every release-required tracker scenario.
5. Execute L25/L26 on the target-shaped host with 15 principals, heavy work,
   provider/storage faults, custody controls, and remote-only recovery.
6. Archive the digest-bound evidence bundle and make the final go/no-go decision.

PD-01, PD-02, PD-03, PD-06, PD-07, PD-08, PD-09, and PD-10 are non-waivable:
they establish artifact identity, behavior, scope, dependency truth, capacity,
custody/recovery, evidence integrity, and accessible operation.
