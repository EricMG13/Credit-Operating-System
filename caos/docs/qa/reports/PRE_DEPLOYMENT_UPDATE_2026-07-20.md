# CAOS — Consolidated Pre-Deployment Update

**Audit date:** 2026-07-20

**Application snapshot:** `codex/112@66e8bbfb3dae11c7427ac101aa4d184d467f0ed0`
plus the reviewed PD-01/PD-04/PD-05/PD-10 working-tree delta described below

**Decision:** **NO-GO** — the PD-01 resource contract plus PD-04, PD-05, and
PD-10 are closed on the current working tree, but the exact deployable image
has not been frozen or re-certified.
Candidate browser proof, target capacity/custody/recovery controls, and the final
digest-bound evidence bundle remain open.

This report supersedes the status verdict in
[PRE_DEPLOYMENT_CLOSURE_2026-07-18.md](PRE_DEPLOYMENT_CLOSURE_2026-07-18.md).
That report and the 2026-07-19 quality workbook remain historical evidence for
the snapshots they tested. The current route/platform/custody map is
[APPLICATION_SURFACE_MATRIX_2026-07-20.csv](../APPLICATION_SURFACE_MATRIX_2026-07-20.csv).

### Execution delta — PD-10 closed on 2026-07-20

The first release-order gate was executed against the current checkout. The
18-route desktop/390px axe and layout matrix is now zero-finding; coarse-pointer
390px, reduced-motion, and dedicated native 200% browser-zoom checks are also
zero-finding. Command worklist controls, Monitor triage controls, primary
actions, and descendant table scroll ownership remain available. Report Studio
restores its proofing type floor at native 200% zoom.

Before the PD-04 dead-subject cleanup, frontend verification was green with
retries disabled: **626/626 suites and 1,853/1,853 tests passed**. A Monitor
dynamic-import assertion now awaits the
rendered tab content, and a Report Studio deep-link race was fixed so a later
preview rebuild cannot overwrite the analyst's immutable-report selection.
That focused transition passed 10 consecutive zero-retry runs. ESLint with zero
warnings and the Next.js 16.2.10 production build also pass. The red-team
decision record is in `.agent-reviews/redteam.md` (RT-2026-07-20-723…728).

This closes **PD-10 on the current working tree**. It does not substitute
for PD-02's final three-browser journey seal or PD-09's digest-bound archive,
and it must be rerun after H0 is frozen.

### Execution delta — five routed-concept contracts green on 2026-07-20

Decisions, Portfolios, Issuer Profile, Sector RV, and Sponsors now have five
dedicated Playwright cases in `routed_concepts_flow.spec.ts`. Each case asserts
a route-specific dataset and primary transition; Sponsors additionally proves
a failed record read preserves the selected sponsor and succeeds on one retry.
All 15 browser-project executions passed across Chromium, Firefox, and WebKit
with `--retries=0 --workers=1` against an isolated local service.

The fixtures match exact URL pathnames and a final local `/api/` oracle returns
501 for any unhandled request, so no fixture miss can silently read developer
data. The production-like runner now fails closed if a discovered journey spec
is missing, duplicated, or unknown; it also includes the previously omitted
Pipeline and Sector specs and limits setup authentication to the selected
project, keeping the four-lane matrix at 12 setup logins rather than 36.

This advances **PD-02 and L27 but does not close them**. These five journeys
intercept the application API and therefore prove mounted UI contracts, not
FastAPI/migration/seed integration on frozen H0.

### Execution delta — PD-05 closed on the current working tree

`recovery_flow.spec.ts` adds two fail-closed browser contracts executed in
Chromium, Firefox, and WebKit. A Playwright-only response rewrite injects a
named render failure into the delivered WorkflowRail or Report Studio chunk;
it separately wraps the shipped Next reset callback, and it requires exactly
one component sentinel and one reset-handler match. Compiler drift therefore
fails the test instead of silently skipping the fault. No production query
flag, environment switch, fault hook, or source branch was added.

The root case reaches `global-error`, retains `/settings/?mode=reference` and
the authenticated session, retries into the live Settings surface, and records
zero writes. The segment case reaches the shared route boundary used by all six
segment `error.tsx` files, preserves the owned analysis-context identity, IC
Memo selection, exact draft payload, hidden-source preference, and one analyst
override, records zero failure-time writes, and after reset advances the
original draft exactly one revision with no publication or duplicate mutation.
All **6/6** browser-project executions passed with retries disabled.

This closes **PD-05 on the current working tree**, not for release. The same
proof must remain green after H0 is frozen; PD-02 still requires the complete
189-node inventory against real candidate API/data.

### Execution delta — PD-01 resource layout closed on the current working tree

The app build now uses a repository-root context governed by a deny-by-default
`.dockerignore`. It copies the governed methodology subset into `/Modular OS`,
the single immutable RV JSON into the exact consumer path
`/frontend/src/lib/command/market-data.json`, and no frontend source beyond that
JSON into the final runtime. Backup and backup-sync retain their existing
`caos/` contexts; this tranche does not broaden their build contracts.

The first real build was deliberately aborted after exposing an overbroad
4.86 GB context: parent negations had reopened descendants despite the leading
deny. Immediate `parent/**` re-exclusions reduced a fresh isolated BuildKit
transfer to **3.88 MB**. The completed image then ran the consumer probe as UID
10001 and reported prompt fingerprint `15bdcbc3628d`, valid CP-2G and CP-4D
manifest-backed bundle fingerprints, and **588** RV rows with SHA-256
`8ca8c785070a6837b118f0cf9a530d3c63e89d051526f9a70fdf5f844a021597`.
An independent `docker run` repeated the probe and found no application secrets,
tests, virtualenvs, or extra frontend source.

This closes the known PD-01 resource-layout defect, not PD-01 itself. The local
image ID is diagnostic only; the branch is dirty and unreconciled, and no
canonical H0 commit/digest, schema/config/flag manifest, SBOM, or scan decision
exists yet.

### Execution delta — PD-04 closed on 2026-07-20

Every frontend reachability candidate received an owner disposition. Sixteen
test-only or superseded production modules were removed with their subject-only
tests: the old Command Sector RV/dislocation cluster; obsolete Issuer Profile,
Query router, evidence, change-flash, and recovery prototypes; and orphaned
citation, coverage, statistics, Query format/question/report, and resize-observer
utilities. Mixed suites were trimmed only where they asserted a removed subject.

`src/lib/color-literal-policy.ts` is retained as the one intentional test-support
seam: its test scans the complete production frontend for non-allowlisted color
literals, and it is not represented as runtime functionality. The regenerated
framework-aware graph reaches **262/263 production TS/TSX files from 27 roots**;
the retained policy seam is the only candidate. Fallow itself was unavailable,
and the managed safety reviewer rejected downloading and executing its npm
package outside the sandbox, so the native graph, GitNexus impacts, direct and
dynamic reference scans, lint, tests, and build form this disposition evidence;
rerun Fallow on the controlled H0 candidate host.

The post-removal frontend is green: **593/593 suites and 1,750/1,750 tests pass
with `--retry=0`**, ESLint has zero warnings, and the production build exports
all 18 business routes. The reduction of 103 tests is explicitly the removal of
dead subjects, not claimed coverage growth. The attempted Query Playwright flow
could not start because no local FastAPI test server was running; no removed
module had a runtime edge, and the mounted Query and Sector RV route contracts
remain covered by the full unit/build evidence. H0 still requires the complete
no-retry browser seal.

## 1. Executive decision

The current application builds and its principal unit/server suites pass. The
quality tracker now maps the whole product much more completely, browser
defects recorded on 2026-07-18 were closed in a 2026-07-19 seal, and the
Postgres/two-worker stack recovered from a measured 320-user latency fault and
then passed three 300-user repetitions. Those are significant readiness gains.

They do not yet justify deployment:

- the 2026-07-19 workbook and three-browser seal predate the current working
  tree; the final image digest has not been created or tested;
- PD-10 is green on the current working tree, but its proof is not yet bound to
  a frozen release image or the final three-browser journey seal;
- PD-04 is green on the working tree: 16 dead modules are removed and the sole
  remaining non-runtime file has an explicit test-support rationale;
- the five formerly missing browser journeys are green as fixture-backed route
  contracts, but the full real-API H0 matrix and 983 Designed tracker
  scenarios remain unexecuted;
- target encryption, retention/legal-hold, paired-backup freshness, alerting,
  and remote-only recovery are not evidenced; and
- capacity is strong for the measured read mix, but the exact image/host has not
  been exercised with 15 separate principals, simultaneous heavy work, and
  provider/storage faults.

The PD-01/PD-04/PD-05/PD-10 application and audit-document changes remain working-tree changes
until intentionally reviewed and committed. GitNexus classified the shared
navigation/workbench symbols as **critical** hubs before the CSS edit, so the
change was kept breakpoint-scoped and verified across the full route matrix;
the Report Studio workspace selection fix was **low risk** with one direct
caller in the pre-edit symbol analysis. Post-change `detect_changes` rates the
combined diff **high** because that workspace anchors six context/run flows;
the exact selection regression, full zero-retry suite, route matrix, lint, and
production build are green. The index is four commits behind the current HEAD,
so final route/process parity must still be regenerated at H0.

## 2. Current verification ledger

| Area | Evidence collected | Result / boundary |
|---|---|---|
| Application identity | Working tree is based on `66e8bbfb`; branch is one commit behind and 70 ahead of `origin/main` | Reviewed PD-01/PD-04/PD-05/PD-10 delta on a commit-pinned base; not the canonical H0 image/config/schema artifact |
| App-image resources | Real multi-stage build from a fresh-builder **3.88 MB** context; embedded and independent UID-10001 consumer probes; local image `sha256:dce1761f74b78ea78068e4a45b40e6c4aa1bdf2297f4bbe0161a70e3eddea9a6` | **PASS on this working tree:** prompt corpus, governed bundles, and RV reference are immutable/readable in the image; local ID is not an H0 registry digest or release provenance |
| Frontend unit/static | eslint, strict TypeScript through the production build; **593 suites / 1,750 tests passed with `--retry=0`** | PASS on the current working tree; 103 dead-subject tests removed and explicitly accounted for |
| Page inventory | Build exports **18 business page endpoints** (20 static pages including framework not-found output) | Structurally mapped in the application matrix |
| Server | **2,594 passed / 15 skipped** in the restricted aggregate run; seven ClamAV cases denied loopback sockets there, then all nine AV tests passed unrestricted | Effective current evidence: **2,601 passed / 15 skipped** |
| Backend relevance | Vulture at ≥80% confidence across `server` and `scripts` | No backend candidate reported |
| Frontend relevance | Framework-aware production dependency walk: 263 production TS/TSX files, 27 roots, 262 reached | **PASS:** 16 dead modules removed; `color-literal-policy.ts` retained as the sole intentional test-support seam |
| Current rendered accessibility/layout | 18 routes × 1440×900 and 390×844; real axe; coarse pointer, reduced motion, and native 200% zoom checked separately | **PASS:** 0 axe nodes, scan errors, clipped controls, or layout failures on the current working tree; the earlier [axe-2026-07-20.json](axe-2026-07-20.json) remains the pre-fix baseline |
| Three-browser workflows | Historical workbook: **165 passed** across 14 specs. Current collection: **189 nodes across 16 specs**; routed-concept delta **15/15** and boundary-recovery delta **6/6** across all engines, no retry | Current deltas are deterministic fixture/test-only-injection evidence; complete frozen-H0 real-API rerun remains open |
| Quality tracker | 683 canonical features; **4,930 generated cases**; rebuilt exact-current gate reconciled to **4,601 automation nodes** (1,750 frontend, 2,618 server/stress/cohort, 189 browser, 36 accessibility, seven performance, one responsive-workbench); 692 current UI controls; 173 AST handler rows; 17 processes | Strong structural coverage, but not every effect/state: 3,308 direct passes, 377 suite-evidence, 983 Designed, and 262 N/A; the dated surface matrix still needs post-cleanup regeneration |
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

Remaining proof gaps are explicit: complete real-API H0 repetition of the now
green Decisions, Portfolios, Issuer Profile, Sector RV, Sponsors, and boundary
recovery contracts; enterprise email/licensed market-data activation; and the
983 designed tracker scenarios.

### Is all code relevant; is there dead code?

The backend scan is clean at the configured confidence. PD-04 disposition is
complete: 16 unreachable production modules and their dead-subject tests were
removed; `lib/color-literal-policy.ts` is retained with an explicit test-support
rationale. The current graph has 263 production files, 27 framework roots, and
262 reached files. Direct/dynamic import searches report no removed reference,
all primary-export GitNexus impacts were LOW with no process participation, and
the full no-retry suite, lint, strict build/typecheck, and 18-route export pass.

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
683/683 features with at least one direct automation link and inventories 692
UI controls; the current collector sees 189 browser nodes, with the 15-node
routed-concept and six-node boundary-recovery deltas green. However, direct
automation is not proof of success, validation, unavailable state,
persistence/reload, authorization, retry, and duplicate prevention for every
control. The complete suite remains unsealed against current real H0 data, and
the current PD-10 proof must be repeated on H0. L27 is the closure mechanism.

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
| **PD-01** | **RESOURCE DEFECT CLOSED on the current working tree:** real app image and UID-10001 probes validate the governed prompt corpus/bundles and 588-row RV file from a measured 3.88 MB context. No clean canonical release image; branch reconciliation, registry digest, schema/config/flag manifest, SBOM, and scan remain open | Repeat the exact image contract after reconciliation, then record clean H0 commit, immutable registry digest, schema head, config fingerprint, flags, dependency/SBOM/scan evidence |
| **PD-02** | The historical 165-case seal predates the current working tree. Routed-concept and boundary-recovery deltas now pass 21/21 fixture/test-only-injection executions, but the complete 189-node inventory is not bound to frozen H0 API/data | L27 current candidate green across Chromium/Firefox/WebKit without retry against real H0 API/data for primary journeys and affected states |
| **PD-03** | Exact tracker rebuild is current, but 983 scenarios remain Designed, 377 rely on suite evidence, and the dated application-surface matrix predates the post-cleanup 692-control inventory | L23 regenerate route/nav/API/process/control/tracker/evidence parity from the candidate and execute all release-required scenarios |
| **PD-04** | **CLOSED on the current working tree:** 16 dead modules removed; one policy test seam retained with rationale; graph is 262/263 from 27 roots | Rerun native graph and controlled-host Fallow against frozen H0; reopen on a new or unexplained candidate |
| **PD-05** | **CLOSED on the current working tree:** the shipped root/global boundary and shared segment boundary delegated by all six segment error files pass 6/6 injected-browser executions with named failure, preserved authenticated analyst/context/draft state, zero failure-time writes, and exactly one recovery autosave | Repeat the same fail-closed proof on frozen H0; reopen on boundary-map, compiled-sentinel, state-preservation, or mutation-ledger drift |
| **PD-06** | The [promise-to-runtime map](../PROMISE_TO_RUNTIME_MAP.md) and C3/C5 pickup plans now exist, but CP-SR/CP-MON runtime work, CP-RENDER equivalence proof, CP-EXTRACT disposition, licensed market data, email, and provider activation evidence remain open | Execute the mapped closures; keep unavailable/reference states honest; capture activation and failure evidence for every enabled seam |
| **PD-07** | Strong local 300-user evidence is not bound to the target image/host or simultaneous authenticated heavy work | L25 exact image with 15 principals, target-size data, heavy-operation overlap, slow/429/529/storage faults, queue/pool/memory/isolation/recovery telemetry |
| **PD-08** | Target at-rest encryption, record governance, paired-backup freshness/alerting, and off-host recovery are unproven | E8/G8/G9 + L22/L26: approved custody policy, encrypted target/off-host stores, alarms, and remote-only restore |
| **PD-09** | Final evidence is not bound to released bytes | Archive one digest-addressed H0/H1/H2 evidence bundle and signed decision record |
| **PD-10** | **CLOSED on the current working tree:** required viewport/capability matrix is zero-finding and all current 1,750 frontend tests pass with retries disabled | Rerun against frozen H0 for PD-02/PD-09 binding; reopen on any regression |

## 5. Required release order

1. Resolve PD-06 seam promises; carry the green five-route and boundary-
   recovery tranches forward and retain PD-04/PD-05/PD-10 as frozen-candidate
   regression gates.
2. Reconcile with `origin/main`, freeze H0, and generate the immutable
   commit/image/schema/config/flag/SBOM manifest.
3. Regenerate L23/L24 and run L27 in all three browsers against that image without
   retry; execute every release-required tracker scenario.
4. Execute L25/L26 on the target-shaped host with 15 principals, heavy work,
   provider/storage faults, custody controls, and remote-only recovery.
5. Archive the digest-bound evidence bundle and make the final go/no-go decision.

PD-01, PD-02, PD-03, PD-06, PD-07, PD-08, and PD-09 remain open and
non-waivable. The PD-01 resource contract plus PD-04, PD-05, and PD-10 are
satisfied on the working tree but remain non-waivable regression gates for the
frozen candidate.
