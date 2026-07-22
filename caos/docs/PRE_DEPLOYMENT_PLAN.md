# CAOS — Pre-Deployment Program Plan

> **Latest status:** the **2026-07-20 consolidated update** below is the
> operative status source. Its PD-01…PD-10 rows are the release-blocker ledger.
> The 2026-07-18 closure, 2026-07-19 quality seal, and the PG/UW/UF registers
> remain traceable historical evidence, but do not override the current
> **NO-GO** verdict.

> **For agentic workers:** this is the **master program plan** (current state
> → enterprise transfer). It tracks **status** only — status verdicts,
> checkboxes, exit gates. Every "tested regularly" / cadence claim resolves to
> a loop ID (`L1`–`L27`) defined in
> [PRE_DEPLOYMENT_QA_LOOPS.md](PRE_DEPLOYMENT_QA_LOOPS.md), which owns
> **mechanism** — do not restate cadences here without a loop ID; if a claim
> needs a new automation, the loop doc names the work item. Tooling/skills
> live in [PRE_DEPLOYMENT_SKILLS_SHORTLIST.md](PRE_DEPLOYMENT_SKILLS_SHORTLIST.md).
> The four remaining L-sized items (**B5**, **C3-seam**, **C5**, **E2**) each
> get a detailed implementation plan written **at pickup time** (plan-mode →
> `docs/superpowers/plans/`, following the existing convention in this repo —
> see `docs/superpowers/plans/2026-07-06-command-center-refinement.md` for the
> pattern); do not implement them directly from this document. S/M items may
> be executed directly. Checkboxes (`- [ ]`) are the tracking surface.

**Goal:** take CAOS from the latest reconciled state below to a defensible
**pre-deployment** release: one immutable candidate whose product scope,
control wiring, capacity, security, and recovery claims all resolve to dated
evidence. Enterprise email and licensed market-data activation remain planned
transfer seams, but they are not the only current blockers; PD-01…PD-10 must be
closed before the candidate can be called ready.

**Architecture of the plan:** eight gated phases (A–H). Each phase has work
items with file anchors, a verify command, and a hard **exit gate**
(verifiable, not aspirational); §10 points to the loop doc that keeps
everything live re-verified after its phase lands. Supersedes the phase
ordering in [DEVELOPMENT_PHASES.md](DEVELOPMENT_PHASES.md) where they
conflict (DEVELOPMENT_PHASES "Phase 5 market-data cutover" happens *after*
transfer — it is outstanding item #2 by design).

### 2026-07-22 consolidated update — full phase/task reconciliation (operative)

Candidate **`3b66da67`** / image `sha256:882efb398526…`, strict manifest
zero-failures, main CI green. Every CAOS-side executable task is DONE; every
remaining row is an owner/target action with its artifact prepared
([H8 ledger](qa/H8_CLOSURE_LEDGER_2026-07-22.md): zero OPEN rows). Status
vocabulary: **DONE** (evidence linked at the item), **OWNER** (only a
human/target action remains), **POST-FREEZE** (real work, deliberately
scheduled after the release decision because merging it would invalidate the
frozen candidate), **PILOT** (post-deployment program by design).

| Phase | Task status |
|---|---|
| **A — Trunk consolidation** | A1–A4, A6b, A7/A7b, A8 DONE (prior sessions) · **A5 DONE 07-22** (all 15 dependabot deferred-post-H0 recorded; #169/#184/#191/#192 = POST-FREEZE) · A6 branch hygiene = OWNER (deletions need approval) |
| **B — Engine certification** | B1, B3, B4 DONE (prior) · **B2 DONE** (run-wide citation floor; breadth-applied by the corpus) · **B5 EXECUTED 07-22** at core-33 scope: 28/28 EDGAR fixtures, `corpus_run` property net, ~7 s full sweep, nightly `CORPUS_FULL=1` + per-PR smoke (L6 live); Batch-2 28 names = future tranche; SFR/Refresco/INEOS/Cirsa fixtures = OWNER documents |
| **C — Concepts live** | C1, C7, C9 DONE (prior) · **C3-seam DONE 07-22** (landed + live-operated; target flag cycle → H4/PD-06 owner leg) · **C13 DONE** (all four runtime promises dispositioned) · **C14 DONE** (ships all-flags-off per manifest; staged enablement = PILOT) · C5 rescoped → H4 package · C2 residual (issuers-directory reference workspace), C4 (seeded-panel ledger), C6 (concept-link spec), C8 (PR #191), C10 (worklist semantics), C11 (Apply-to-model UI), C12 (run-mode semantics) = POST-FREEZE |
| **D — Ingestion breadth** | D1 (OCR provenance + scanned golden), D2 (RAG lane), D3 DONE (prior) · D4 = one live RAG-cites-memo confirm (POST-FREEZE, S) |
| **E — Hardening** | E4, E6 DONE (prior) · **E8 DONE 07-22** (governance matrix; ☐ owner decisions at H5) · E1 stale text corrected (durable claiming landed #179; residual = PILOT calibration) · E5 final full-diff `/security-review` rerun = POST-FREEZE (per-PR L18 subset green on the candidate meanwhile) · E2 legacy-route roles + admin panel, E3 audit trail (#169), E7 per-lane routing UI = POST-FREEZE |
| **F — Beta dictionary** | F1–F5 = OWNER/analyst-cohort phase on the target (F1 separation decision first); artifacts (onboarding guide, gap-log process, golden-promotion rule) ready |
| **G — Ops readiness** | G1, G4, G5, G6 DONE (prior) · **G3 DONE 07-22** (= L25 on the frozen image) · G8 mechanism DONE (off-host round trip + remote-only restore; real remote + alarms = OWNER) · G2 (Monitor dogfood rule; needs target flag-on), G7 (external probe), G9 (host baseline) = OWNER |
| **H — Gate & handover** | **H2, H3, H4, H8 DONE 07-22** · **H0 DONE except the scan-disposition signature** (re-frozen `3b66da67`; 3/4 manual slots executed) · **H1 rehearsed** (4 OWNER rows named) · **H6 executed to the persona line** (3 walkthrough signatures = OWNER) · **H7 mechanics rehearsed** (36 s abort→restore; names + target repeat = OWNER) · H5 = signatures |
| **PD blockers** | PD-01…PD-10: all evidence CLOSED on the candidate; residuals = sign scan disposition (PD-01), target-host repeats (PD-06/07/08 legs), PD-09 signed decision — see the [blocker ledger](qa/reports/PRE_DEPLOYMENT_UPDATE_2026-07-20.md) and H8 |
| **§14 expansion (X1–X13)** | Visible, MED, non-blocking by policy — untouched |

The remaining path to deployment is exactly: **sign** (scan disposition, risk
register, H5 table) → **name the target host** (G9) → repeat
L25/L26/H1/H6/H7 there with the real edge (OAuth), real off-host remote,
encryption, and the external probe (G7) → **archive PD-09 + signed go/no-go**
→ F beta on the target. The two allowed-outstanding items (email transport,
Bloomberg activation) remain exactly two, both packaged.

### 2026-07-20 consolidated update — operative release status

The canonical status and evidence-boundary report is
[PRE_DEPLOYMENT_UPDATE_2026-07-20.md](qa/reports/PRE_DEPLOYMENT_UPDATE_2026-07-20.md),
with the current route/platform/custody inventory in
[APPLICATION_SURFACE_MATRIX_2026-07-20.csv](qa/APPLICATION_SURFACE_MATRIX_2026-07-20.csv).
The current PD-01/PD-04/PD-05/PD-10 execution is based on
`codex/112@66e8bbfb3dae11c7427ac101aa4d184d467f0ed0` plus its reviewed working-tree
delta. No clean, reconciled, digest-addressed H0 release image exists. The branch
is one commit behind and 70 ahead of `origin/main`; the working-tree delta is not yet a
release artifact.

| Check | Current evidence | Status |
|---|---|---|
| Frontend compile/regression | eslint, strict TypeScript through the production build, export of 18 business page endpoints, **1,750 tests / 593 suites with `--retry=0`** | **PASS** on the current working tree; 103 dead-subject tests removed and accounted for |
| Server regression | **2,594 passed / 15 skipped** restricted aggregate; all nine AV tests pass unrestricted, making effective current evidence **2,601 / 15** | PASS for current snapshot |
| Rendered accessibility/layout | 18 routes × desktop/390px, real axe; separate coarse-pointer, reduced-motion, and native 200% zoom checks | **PASS** on the current working tree — zero axe nodes, scan errors, clipped controls, or layout failures |
| Three-browser workflow inventory | Historical seal: **165 passed** across 14 specs. Current collection: **189 nodes across 16 specs**; the routed-concept cases passed **15/15** and the root/shared-boundary recovery cases passed **6/6** across Chromium/Firefox/WebKit without retry | Fixture-backed route and shipped-boundary deltas are green; complete real-API H0 rerun remains required |
| Feature/control inventory | Rebuilt tracker: 683 features, 692 current UI controls, 173 AST handler rows, 17 processes; 683 features link to direct automation | Strong structural map; 983 Designed and 377 suite-evidence scenarios prevent an all-effects-tested claim; dated surface matrix needs post-cleanup regeneration |
| Code relevance | backend Vulture clean; frontend graph reaches **262/263 production files from 27 roots** | **PASS:** 16 dead modules removed; sole residual is the retained color-policy test seam; rerun Fallow on controlled H0 host |
| Capacity | three post-fix 300-user PG/two-worker passes, zero failures, aggregate p95 46/120/35 ms | Strong headroom/fix evidence; target 15-principal heavy/fault run remains open |
| Data/vault | original bytes in vault; structured work product in Postgres; drafts/preferences in browser; logs/backups in operator stores | **BLOCKED** — target encryption, governance, freshness/alerting, and remote-only recovery proof absent |

#### Final blocker ledger

| ID | Blocking condition | Completion gate |
|---|---|---|
| **PD-01** | **RESOURCE DEFECT CLOSED on the current working tree:** the app image now bakes the governed `/Modular OS` subset and RV JSON through a measured 3.88 MB deny-by-default context; its UID-10001 consumer probe validates prompt fingerprint `15bdcbc3628d`, both specialized bundles, and 588 RV rows. PD-01 remains open because no clean canonical release image or digest/schema/config/flag/SBOM provenance exists | Repeat the fail-closed image contract after branch reconciliation, then bind clean H0 to commit and image digest, schema head, config fingerprint, flags, final SBOM/scan |
| **PD-02** | Historical 165-case seal predates current production changes. The routed-concept and boundary-recovery deltas now pass fixture-backed contracts 21/21 across all engines, but the complete 189-node inventory is not bound to real H0 API/data | L27 complete candidate green in Chromium, Firefox, and WebKit without retry against frozen H0 API/data, including affected states |
| **PD-03** | Exact tracker is rebuilt, but 983 Designed plus 377 suite-evidence scenarios remain and the dated surface matrix predates the 692-control post-cleanup inventory | L23 regenerate candidate route/nav/API/process/control/tracker parity and execute every release-required scenario |
| **PD-04** | **CLOSED on the current working tree:** 16 dead modules removed; one policy test seam retained with rationale; graph is 262/263 from 27 roots | Rerun native graph and controlled-host Fallow against frozen H0; reopen on a new or unexplained candidate |
| **PD-05** | **CLOSED on the current working tree:** test-only exact-cardinality chunk rewriting reaches the shipped root/global boundary and the shared segment boundary used by all six routed segment error files; 6/6 no-retry executions preserve path, mode, authentication, analysis context, draft payload, source preference, and analyst edits, with zero failure-time writes and exactly one recovery autosave | Rerun the same fail-closed boundary proof against frozen H0; reopen if the boundary delegation map, compiled sentinels, state preservation, or mutation ledger changes |
| **PD-06** | The [promise-to-runtime map](qa/PROMISE_TO_RUNTIME_MAP.md) is checked in and the C3/C5 implementation plans are drafted, but CP-SR/CP-MON runtime work, CP-RENDER equivalence proof, CP-EXTRACT disposition, and enabled-seam evidence remain open | Execute the mapped closures; preserve honest unavailable/reference states; archive activation and failure evidence for every enabled seam |
| **PD-07** | 300-user fix evidence is not the immutable target's authenticated heavy-operation/fault profile | L25 exact image, 15 principals, target data, jobs/uploads/provider faults, queue/pool/memory/isolation/recovery telemetry |
| **PD-08** | At-rest encryption, record governance, paired-backup freshness/alerting, and off-host recovery are not proven on target | E8/G8/G9 + L22/L26 encrypted target/off-host custody, policy, alarms, remote-only restore |
| **PD-09** | Final audit evidence is not tied to released bytes | One archived digest-addressed H0/H1/H2 evidence bundle and signed decision |
| **PD-10** | **CLOSED on the current working tree:** the required viewport/capability matrix is zero-finding and all current 1,750 frontend tests pass with retries disabled | Rerun against frozen H0 for PD-02/PD-09 binding; reopen on regression |

**Release order:** carry the green routed-contract and boundary-recovery deltas
into the remaining seam work while retaining the PD-01 resource contract and
PD-04/PD-05/PD-10 as
frozen-candidate regression gates; reconcile and freeze H0;
regenerate L23/L24 and execute L27 against the exact image; execute L25/L26 on
the target-shaped host; archive PD-09; then decide go/no-go.
PD-01/02/03/06/07/08/09 remain open and non-waivable; PD-04/PD-05/PD-10 are
satisfied on the working tree and must remain green on H0.

### 2026-07-18 final closure audit — historical baseline (superseded)

The canonical evidence report is
[PRE_DEPLOYMENT_CLOSURE_2026-07-18.md](qa/reports/PRE_DEPLOYMENT_CLOSURE_2026-07-18.md),
with the route/platform inventory in
[APPLICATION_SURFACE_MATRIX_2026-07-18.csv](qa/APPLICATION_SURFACE_MATRIX_2026-07-18.csv).
This pass reviewed the dirty `codex/112@040f298e44b0` checkout while parallel
frontend WIP continued changing it. Results are diagnostic snapshots and
**cannot** identify one internally consistent immutable release artifact.

| Check | Current evidence | Status |
|---|---|---|
| Frontend compile/regression | eslint, strict TypeScript, production export of 18 page endpoints, **1,438 tests** | PASS on current WIP |
| Server regression | **2,405 passed / 15 skipped** in sandbox; seven sandbox-denied AV socket cases passed on unrestricted rerun, effective **2,412 / 15** | PASS on current WIP |
| Rendered accessibility/layout | 18 page endpoints × desktop/mobile, zero axe/layout/clipping findings | PASS for rendered offline/unavailable states |
| Three-browser workflow inventory | **125 passed / 15 failed / 1 flaky** | **BLOCKED** — Command, registration, Model override, and Research contracts |
| Static control wiring | 290 native production buttons; every node has an action/submit/spread or explicit unavailable state | Screen only; dynamic proof blocked above |
| Code relevance | backend Vulture clean; **16 frontend reachability candidates** | Disposition required; do not delete automatically |
| 15 active users | current SQLite smoke: 2,913 requests, 0 failures, p95 7 ms; dated Postgres/two-worker run: 2,584 requests, 0 failures, p95 89 ms | Baseline PASS; immutable target repeat required |
| Data/vault | source bytes in vault; structured work product in Postgres; unsaved state in browser; local+remote backup mechanism exists | **BLOCKED** — target encryption, governance, freshness, and remote-only recovery proof absent |

#### Final blocker ledger

| ID | Blocking condition | Completion gate |
|---|---|---|
| **PD-01** | Mutable dirty candidate | H0 clean RC, commit/image digest/schema/config/flag manifest, final SBOM/scan |
| **PD-02** | 15 E2E failures and one flake | L27 all affected journeys green in Chromium, Firefox, and WebKit without retry |
| **PD-03** | 355-row tracker omits newer routed concepts and dedicated journeys | L23 route/nav/API/tracker/E2E parity for every matrix row |
| **PD-04** | 16 frontend dead-code candidates have no owner disposition | L24 remove/restore/retain decision plus green build/tests |
| **PD-05** | 12 of 18 page endpoints lack deliberate segment-recovery evidence | L27 boundary/equivalence decision and failure-preservation E2E |
| **PD-06** | Reference/manual/enterprise seams remain in CP-RENDER, CP-SR/Monitor/email, market data, and QA issuer scoping | C3/C5/C13 promise-to-runtime and activation evidence; honest unavailable states |
| **PD-07** | Capacity was not repeated on the immutable target candidate | L25 15-principal Postgres/two-worker target run plus heavy-job/upload/provider faults |
| **PD-08** | At-rest encryption, record governance, and off-host recovery are not proven on the target | E8/G8/G9 and L22/L26: paired DB+vault backup, encrypted remote, alert, remote-only restore |
| **PD-09** | Final audit evidence is not tied to released bytes | One archived H0/H1/H2 evidence bundle for the exact image digest |

**Release order:** close PD-02/03/04/05/06 on the working branch; freeze and
merge the intended code; create the clean H0 candidate; execute L23–L27 and
the existing H1/H2 suite on the target-shaped stack; close PD-07/08 with host
evidence; archive PD-09; then take the final go/no-go decision. PD-01, PD-02,
PD-03, PD-06, PD-07, and PD-08 are non-waivable because they establish the
artifact, actual behavior, product scope, live integration, capacity, and
recoverability.

### 2026-07-13 coverage review — gaps added to the release ledger

This review examined the plan itself against the deploy stack, CI/nightly
workflows, migration/backup scripts, DR runbook, current engine registry, and
the current checkout (`codex/111@c6c0f9a6`). The checkout is dirty with
parallel work, so this is **not** a fresh readiness verdict and does not mark
implementation items complete. It closes omissions in what the program must
prove.

| ID | Coverage gap found | Why the prior plan was insufficient | Blocking owner / proof |
|---|---|---|---|
| PG-01 | Immutable release candidate and provenance | H1 could build from a mutable checkout; no release manifest pinned commit, image digest, schema head, config fingerprint, or test evidence to the same bytes. | **H0** — signed release manifest, clean `origin/main` checkout, final-image scan, archived evidence. |
| PG-02 | Production-schema migration and rollback decision | CI proves generic up/down, but not upgrade from the actual production revision/data shape or compatibility with the last-good image. | **H0** — schema preflight, restored-snapshot rehearsal, expand/contract decision, abort thresholds, pre-migration backup. |
| PG-03 | Independent availability and infrastructure alerting | G2 routed app failures through CAOS's own Monitor; a dead app/host/DB/ingress cannot alert through itself. | **G7** — external probe plus host/container/disk/cert/backup alerts, tested delivery and named owner. |
| PG-04 | Off-host backup is configured, fresh, encrypted, and observable | G6 credited an optional hook; unset or failed sync still means total loss on host failure. | **G8** — observed off-host sync, age/failure alarm, encryption/access evidence, realistic restore. |
| PG-05 | Host operating baseline | The app/container posture did not own firewall/SSH, Docker daemon access, OS patches, time sync, disk capacity/encryption, log rotation, or certificate expiry. | **G9** — dated host-readiness artifact on the target host. |
| PG-06 | Spec-only module promise resolution | UF-01 named CP-SR/CP-MON/CP-RENDER/CP-EXTRACT but no blocking item owned implementation or an explicit equivalent-service decision; X5 incorrectly made CP-SR non-blocking. | **C13** — promise-to-runtime map and production E2E; Sector Review cannot pass on reference synthesis alone. |
| PG-07 | Data governance beyond GDPR erasure | No record-class retention, backup-expiry, legal-hold, data-classification, vendor residency/DPA, or immutable-record policy. | **E8/H3** — approved policy, control tests, and accepted exceptions. |
| PG-08 | Persona-critical UAT | One same-number concept link does not prove analyst, PM/CIO, and Research/QA workflows, degraded states, exports, supported browsers, or narrow/zoom layouts. | **H6** — signed UAT matrix on the immutable candidate. |
| PG-09 | Beta/production data separation | F1 said to retain golden/corpus issuers in “production,” contradicting demo-seed-off and risking fixture data in the live workspace. | **F1 corrected** — isolated beta workspace; fixtures remain offline; production starts empty unless real pilot data is explicitly migrated. |
| PG-10 | Cutover, communications, hypercare, and abort ownership | Sign-off existed, but no change window, freeze, user notice, rollback decision owner, success thresholds, or post-cutover observation period. | **H7** — timed cutover/rollback run sheet and hypercare handoff. |
| PG-11 | Supply-chain coverage of the final OCI image | Dependency/SBOM checks did not prove the final image's OS packages, digest, or critical-vulnerability disposition. | **H0** — scan the built release image by digest and attach the result. |
| PG-12 | Blocker-only completion accounting | The final raw checkbox grep could never pass while intentionally non-blocking C7–C9 and X1–X13 remained open. | **H8** — explicit blocker ledger; expansion backlog stays outside the release verdict. |

These rows are release blockers. PG-01/02/03/04/06/08/09/11/12 are
non-waivable because they establish artifact identity, recoverability, outage
detection, honest product scope, test-data separation, and the validity of the
verdict itself. PG-05/07/10 may be satisfied by an enterprise-owned equivalent
only when H3 records the exact control, owner, evidence, and H5 approval; a
generic “accepted risk” is not closure. The matching critic pass is recorded
in `.agent-reviews/redteam.md` (RT-2026-07-13-152…160).

### 2026-07-15 reconciliation — post-wave re-grounding (A8 executed)

**This block supersedes every earlier "today/current" count in this document.**
Re-derived this session from direct code inspection, a live offline test run,
GitHub API/CI queries, and two independent register-verification sweeps whose
FIXED verdicts were then re-verified by hand before any status flip.

| Check | Result |
|---|---|
| `origin/main` | **`0b00b21a`** — CI run on the tip is **green** (the two 2026-07-13 red E2E assertions — Research `● LIVE` provenance, Settings server-backed Workspace heading — no longer fail). Main is deployable by the L1 gate again. |
| Current checkout | `codex/112@76daeecf`, **3 commits ahead / 0 behind** `origin/main` (issuer-identity uniqueness + migration `0059`, cancellation-rollback + Turbopack build switch, tenancy-preflight/a11y-runner hardening). Tree was clean at grounding; parallel WIP then appeared mid-session (~23 server files — write-role widening, workbook validator, reranker guards per RT-2026-07-15-265…269) — every count here is a snapshot from the clean-tree moment, and the E2/UW facts may improve as that WIP lands. |
| Server suite, offline, this session | **1821 passed / 9 skipped**, 74s — `env -u ANTHROPIC_API_KEY -u GEMINI_API_KEY -u OPENROUTER_API_KEY caos/server/.venv311/bin/python -m pytest caos/tests/server caos/tests/stress caos/tests/cohort -q` on `.venv311`. (The Phase-7 release record's 1808/9 run had 7 ClamAV loopback cases sandbox-denied; they pass here.) |
| Open PRs | **4** — #169 (E3 audit trail), #184 (D1 stamp), #191/#192 (C8). **C7 (#187/#188) and C9 (#189/#190) merged 2026-07-15.** |
| Migrations | Head **`0059`** (0052 lineage v2 · 0053 freshness policy · 0054 report freshness authority · 0055 market xlsx v2 · 0056 model engine v2 persistence · 0057 workbook import idempotency · 0058 notification events · 0059 issuer identity uniqueness). |
| Nightly loop (L5) | `.github/workflows/nightly.yml` live; **4 consecutive green scheduled cycles** (2026-07-12 → 2026-07-15) — the loop doc's ≥2-cycle contract is met; L5 is citable at phase exits. |
| Engine registry | **21 implemented modules** (CP-4D, CP-2G added, both flag-gated default-off) + the same 4 spec-only (`CP-SR`/`CP-MON`/`CP-RENDER`/`CP-EXTRACT`, `implemented=False`). |

#### The applicable-updates wave is now committed — and needs a plan owner

Since `c6c0f9a6` (the 2026-07-13 reconcile point), **34 commits** landed
carrying the flag-gated feature wave Phases 0–7: lineage v2, freshness
policy/authority, market XLSX import, Model Engine v2 (drafts, append-only
`model_override_events` with replay/undo, checkpoint import idempotency),
CP-4D/CP-2G modules, run-terminal `notification_events`, plus issuer-identity
uniqueness and the Turbopack build switch. Its own release boundary lives in
[APPLICABLE_UPDATES_PHASE7_RELEASE.md](APPLICABLE_UPDATES_PHASE7_RELEASE.md):
five deployment-global flags (`CAOS_LINEAGE_V2_ENABLED`,
`CAOS_MARKET_XLSX_V2_ENABLED`, `CAOS_MODEL_ENGINE_V2_ENABLED`,
`CAOS_CP_4D_ENABLED`, `CAOS_CP_2G_ENABLED`), all **default-off**, staged
enablement 0→5 with per-stage entry evidence, abort triggers, and rollback
rules; implementation-complete but **not authorized for production
enablement**. This program's pre-deployment definition ("everything else
live") cannot be met with the wave permanently dark — **C14 (new, §5) owns
the disposition**, and H0's release manifest must record the candidate's
exact flag state.

#### UW/UF register delta (vs the 2026-07-13 register)

Every UW row was re-verified against current code; FIXED verdicts were
re-confirmed by hand at the anchors below.

| Row | New verdict | Evidence |
|---|---|---|
| **UW-04** Command sample sleeve + replay | **FIXED** | `grep -n "Sample\|useSharedDayRun" app/command/page.tsx` → 0 hits; positions come from `portfolioLabApi.getCommandSnapshot` with honest offline/empty states. C2's own verify-grep is green; C2's residual narrows to UW-24. |
| **UW-08** Model export CSV stub | **FIXED** | `components/model/export.ts` is a real ExcelJS `.xlsx` (5 stamped sheets, formula-injection guard); C9 merged. |
| **UW-09** Report publish/PDF for a real issuer | **FIXED** | `routes/reports.py` composes versions/preview/export from `run_id` + `model_checkpoint_id` (`require_write_role`-gated); `reports/page.tsx` `publishCommitteeVersion` + print portal live. CP-RENDER the *module* remains `implemented=False` — this is the "equivalent live service" arm of C13; record it in the C13 promise map. Closes **UF-05**'s renderer gap. |
| **UW-07** Scenario Apply/Reset | **STILL TRUE, starting point moved** | `ScenarioPanel.tsx` still a session-local lens ("never mutates model inputs"). But Model Engine v2 now provides the persistence machinery C11 needs (`model_drafts_v2`, `model_override_events` with `inverse_event_id` replay, checkpoints) — C11 builds Apply on top of it, no new store. |
| **UW-15/UW-17 (C5 inputs)** | **STILL TRUE, starting point moved** | Profile market panel still "Feed pending"; RV still bundles the `REFERENCE` JSON. But migration `0055` + `routes/market_import.py` (`/api/rv/snapshots/import[/preview]`, `market_import_issues` audit) is a live, authz-gated, immutable **manual workbook import lane** — C5's provider chain and all RV/DM read-models must build on **this** store, not a parallel one. |
| **UF-02 (C3-seam)** | **Partial** | `notification_events` (0058) + `notification_service.emit_run_terminal_notification` wired into `run_executor.py` + `/api/notifications` feed/seen = the durable-event half exists for run-terminal events. `AlertSink`/`EmailSink`/`InAppSink`/`watch_rule` remain **zero-hit**; Monitor counts/replay/EmailIntel still fixture-backed (UW-10/UW-11 unchanged). |
| **UF-08 (E2)** | **Partial, better than written** | `Analyst.role` column exists (`database.py:249`, default `analyst`); `require_write_role` (`identity.py:71`, rejects viewer/read-only) enforced on 15 handlers across committee/decisions/issuers/model_v2/model_workbook/portfolios/reports. Residual: legacy mutating routes (runs, vault, ratings, watchlist, settings…), admin role semantics, `CAOS_ADMIN_EMAILS` bootstrap (zero code hits), assignment plane, forged-role tests. |
| **UF-14 (C9)** | **CLOSED** | Merged to `origin/main` 2026-07-15. |
| **UF-12 (C7)** | **CLOSED** | Merged to `origin/main` 2026-07-15. |
| All other UW rows | **STILL TRUE** | UW-01/02/03/05/06/10/11/12/13/14/16/18/19/20/21/23/24 re-verified at (shifted) anchors; UW-22 remains the wired baseline. |

**Immediate release order (refreshed):** (1) decide/merge the four open PRs —
#169 and #191 are the substantive two (E3, C8); (2) C14 flag-wave disposition
decision recorded; (3) the four L-sized builds unchanged: B5 corpus capture,
C3-seam, C5 provider chain (now *on top of* the 0055 store), E2 completion;
(4) then the unchanged D4/E-phase/G-phase/H-phase ladder. Every remaining UW
row resolves inside those items — no orphan work discovered this grounding.

## Historical trunk state — 2026-07-11 (superseded)

Grounded 2026-07-11 by direct code inspection (`git grep`/`git show`/`git
ls-tree`), a live offline test run, and GitHub API queries — not inherited
from any prior version of this document. Branch fast-forwarded to
`origin/main` **`313ebac`** (fresh commits landed mid-session; the load-bearing
zero-hit greps below were re-run against this SHA, not the earlier `6bf73a1`
this session started grounding against — see the discrepancy note after the
table).

| Check | Result |
|---|---|
| Server suite, offline, this session | **1393 passed / 2 skipped**, 65.7s — `env -u ANTHROPIC_API_KEY -u GEMINI_API_KEY -u OPENROUTER_API_KEY caos/server/.venv311/bin/python -m pytest caos/tests/server caos/tests/stress caos/tests/cohort -q` (venv built fresh this session from hashed `requirements.lock`). Both skips are the 2 Postgres-only worker/reaper/claim tests (no Docker daemon in this container — see `backend-api-data.md` in the loop doc for the Postgres leg). |
| `AUDIT.md` cited count (2026-07-11, prior commit) | 1378 pytest / 2 skipped (server dir only; this session's run adds `stress`+`cohort`, matching CI's job selection, hence the higher count) |
| CI on `origin/main` tip | **Not green since `ee37030` (#148, 2026-07-11T02:42Z).** Three subsequent pushes (`6bf73a1`, `ccb29f1`, `10c7a25`) show `cancelled` (superseded by rapid re-pushes); the current tip `313ebac`'s run was `in_progress` at last check. Re-check before treating "CI green" as a phase-exit fact. |
| Open PRs | **17** — **12 dependabot** (#85, #88, #133–#142; A5), 4 drafts (#118, #124, #127, #144), 1 non-draft feature (#150). #147 merged 2026-07-11. 0 open issues. |

**Mid-session drift note:** grounding began against `origin/main@6bf73a1`;
before this document was written, `origin/main` advanced to `313ebac` (13
commits: tenancy mechanism, CP-0 Source-Gaps board, security-audit fixes —
see §15). Every load-bearing zero-hit claim below (`AlertSink`/`EmailSink`,
Bloomberg/market-data, `golden_e2e`/`corpus_run` markers, `FEATURE_TRACKER.csv`
counts, corpus MANIFEST) was **re-verified against `313ebac`** before writing
this document; none flipped. One net-new fact from the drift: migration
`0037_team_tenancy` added an optional, config-gated (`CAOS_TENANCY_ENABLED`,
default off) cross-**team** isolation mechanism (`caos/server/tenancy.py`) —
this is orthogonal to **E2**'s roles-lite decision (within-team analyst/
admin/read-only roles); E2 remains open (no `role` column exists).

### 2026-07-12 update — working branch `feat/design-rebuild-p1`, not `main`

**This session is grounded on an unmerged feature branch, not `origin/main`.**
Everything above (and the exec-notes threaded through §§3–9 below) describes
`origin/main`; this block is the delta.

| Check | Result |
|---|---|
| `origin/main` tip | Advanced to **`14cb9c53`** (from `313ebac`) — merged #165 (D4 stamp) and #167 (C1/E4/E6 stamp). Those items' `[ ]`/exec-note state below is current as of `14cb9c53`. |
| Working branch | `feat/design-rebuild-p1`, **15 commits ahead of `origin/main`, 0 behind**, not yet pushed/PR'd. A P1-WP/P2-WP work-package initiative (shell unification, nav registry, breakpoints, role views, provenance-chip grammar, ⌘K palette, a11y sweep, Command governance panel, Monitor live alert inbox, Reports export trigger) — **not reconciled into the A–H phase-letter structure yet**; do that at the next full grounding. Plus substantial **uncommitted** WIP on top (`database.py`, `main.py`, `config.py`, `research_executor.py`, `research_report_executor.py`, `routes/issuers.py` modified; new migrations in flight) — this tree is being edited in parallel by the user right now; treat file-level specifics as a snapshot, not a fact to build on. |
| Dependabot, live re-check | **2 open** (#139 vitest 3→4, #140 @vitest/coverage-v8 3→4) — not 12. A5's same-day exec-note already explains the drop (9 of 12 merged 2026-07-11); this just confirms the live count today. |
| Server suite, this branch + WIP | **22 failed / 1070 passed / 2 skipped / 319 errors**, 146.5s (`.venv311`, `caos/tests/server`, offline). **Not a deploy-ready baseline** — do not cite the `origin/main` 1393/2 number for this branch. The error volume (319) is consistent with a fixture/conftest-level break from the in-flight core-file WIP, not 319 independent test bugs; root-causing it is out of scope for this doc update and the tree is a moving target. Re-run clean once the WIP settles. |
| C3-seam, concrete local delta | On **this branch only**: `monitor/page.tsx` now imports a live `AlertInbox` component (`components/monitor/AlertInbox.tsx`) driven by `useAutonomyDraft` (`lib/engine/useAutonomyDraft.ts`) + `draftToAlertRows`, and migration `0038_alert_states` (table `alert_states`: `alert_key`/`state`/`assignee`/`note`/`analyst_id`) landed — real progress beyond `origin/main`'s "confirmed entirely absent." **But:** `monitor/page.tsx` still also imports `simAlertsToday`/`CRITICAL_ALERTS` (mock) and `AlertFeed`/`EmailIntel` (mock) alongside the live inbox — a hybrid state, not yet a clean live/labeled-sample split. The `AlertSink`/`EmailSink`/`InAppSink` **interface abstraction itself is still zero-hit** (`git grep -in "alertsink\|emailsink\|inappsink"` empty), even on this branch — the P2-WP work built a direct alert-inbox path, not the seam interface C3-seam specifies. Reconcile which approach wins at C3-seam pickup. |
| Local branch/worktree hygiene | Materially worse than any prior count in this document — **104 local branches** as of this check (A6 already flags this as a moving, machine-local number not to hard-code; re-verify at pickup, do not carry today's number forward either). |

### 2026-07-13 reconciliation — code and unwired controls (superseded 2026-07-15)

**Superseded by the 2026-07-15 reconciliation above; the UW/UF register below
remains the reference numbering, corrected by the register-delta table.**
Older grounding remains below as program history and acceptance-test context;
do not use it for a release decision. Status was re-derived from the current
checkout, `origin/main`, the feature tracker, route/component source, tests,
GitHub Actions, and open PRs. “Present in the working tree” is deliberately
not treated as “merged on main.”

| Check | Latest result |
|---|---|
| `origin/main` | **`a930defa`**. The latest main CI run, [29195679256](https://github.com/EricMG13/Credit-Operating-System/actions/runs/29195679256), is **red on E2E only**: Research did not render the expected `● LIVE` provenance branch, and Settings did not render the server-backed Workspace heading. The other frontend, server, Docker, security, lock, taxonomy, and deploy-lint jobs passed. Main is therefore **not deployable** until those two assertions pass on a new main-tip run. |
| Current checkout | `codex/111@29b4fa6e`, **2 commits ahead / 0 behind** `origin/main`; the two committed deltas add decision/thesis/scenario work and capture the residual workspace update. **186 modified/untracked paths** remain in the shared worktree, including this reconciliation. This is implementation evidence, not a releasable artifact. |
| Current-checkout verification | Most recent full local sweep in this session: frontend **673/673**, server **1457 passed / 7 skipped**, TypeScript, lint, and production build green; axe **0 serious/critical across 15 routes**; responsive contract **75/75**; Impeccable **36/40**; adversarial review CLEAN. These results prove the checkout tested, but they do not override red main CI or the dirty-tree release gate. |
| Feature tracker | `caos/docs/qa/FEATURE_TRACKER.csv`: **355/355 `Pass`**, 0 `Pending Verification`. Tracker completion is UI/contract evidence only; it does not upgrade reference/demo data to live. |
| Open PRs | **8** at reconciliation: #169, #184, #187–#192. C7, C8, and C9 have green candidate/stamp PRs, but remain open and are not counted as merged capability. Re-check the [open PR list](https://github.com/EricMG13/Credit-Operating-System/pulls) at A5/H1. |
| Control scan | **317 production JSX controls** inspected by static scan plus source review: 294 `<button>`, 15 `<select>`, and 8 `role="button"` occurrences (tests excluded). There are **0 literal dead raw buttons** (no empty click handler, `undefined` click handler, or `href="#"` action). The only permanently disabled control family is the three Settings per-lane model selectors, explicitly labeled “Not yet applied.” Other disabled controls are prerequisite/state gates and are not defects by themselves. |

#### Control classification

| Class | Meaning | Deployment treatment |
|---|---|---|
| **Wired** | Reaches the intended real API/state transition or performs an honest local utility such as view/layout/export. | No remediation row. |
| **State-gated** | Disabled until a documented prerequisite exists: selection, input, completed run, actionable evidence, or committee readiness. | Keep; test the enabled and disabled paths. Do not call it dead. |
| **Local/reference-only** | The control works, but only changes browser state, replays fixtures, exports a lesser format, or consumes reference/demo data. | Remediate or keep explicitly labeled; cannot satisfy a live phase gate. |
| **Backend-unwired** | UI exists but the production mutation/source/engine seam does not, or the named action is only a focus/navigation proxy. | Open blocker with an owner and exit test. |

#### Unwired and partial user-facing controls — exhaustive current register

| ID | Surface / control | What happens now | Missing production behavior | Class / owner |
|---|---|---|---|---|
| UW-01 | Issuers batch actions | Run pipeline, add to watchlist, and CSV export are real. Assign owner, refresh, and delete are deliberately not rendered because they have no backing semantics (`batchActions.ts:1-5`; `issuers/page.tsx:264-266`). | Add owned server mutations, audit rows, per-item results, and tests before exposing any of the three omitted actions. | Backend-unwired · C2/E3 |
| UW-02 | Sponsors — **Review selected sponsor** | The primary button only focuses `#sponsor-record`; it does not create a review, ratification, assignment, or finding (`sponsors/page.tsx:113-122`). | Persist a sponsor review/finding or rename the control to an honest navigation label. | Backend-unwired · C4 |
| UW-03 | Sponsors — monitoring thresholds | The panel states sponsor thresholds are not stored and only links to Monitor (`sponsors/page.tsx:240-243`). | Sponsor-scoped watch-rule create/edit flow with evidence and owner. | Backend-unwired · C3-seam |
| UW-04 | Command — Sample Sleeve and replay controls | “Sample — not live,” static sleeve size/DM, and `useSharedDayRun` replay remain beside live coverage and Watchtower (`command/page.tsx:13-16,188-205,220-226,275-286`). | Replace sample positions/stats with persisted portfolio data or an empty state; server-backed event chronology if replay remains. | Local/reference-only · C2 |
| UW-05 | Pipeline — run modes / SimControls | The DAG can display a real run, but mode changes, play/pause, clocks, event timing, and seeded driver/QA metadata use `useSimRun`/fixture plans. They do not create, cancel, or replay a server run. | Bind controls to immutable server run events, or confine them to a clearly separate reference workspace. | Local/reference-only · C4 |
| UW-06 | Deep-Dive — bespoke tabs and evidence rails | Live module output is real; CP-0/CP-5B rails, committee output, charts/steps, and bespoke debate/recovery/covenant views remain hidden or reference-only for real issuers (`rails.tsx:18-32`; `tabs.tsx:419-424`). | Live adapters for the retained panes and evidence interactions, preserving current desktop behavior. | Backend-unwired · C4 |
| UW-07 | Model — scenario preset / natural-language Apply and Reset | Buttons recalculate a local `active` scenario lens in `ScenarioPanel`; they do not write worksheet overrides, the mutable model, or a checkpoint (`ScenarioPanel.tsx:410-435`). | Explicit apply-to-model transaction with preview, undo, provenance, persistence, and checkpoint linkage. | Local-only · A-1/C4 |
| UW-08 | Model — **Export model** | Downloads dependency-free CSV despite the committee-pack/XLSX concept (`components/model/export.ts:1-7`; `model/page.tsx:673-679`). | True `.xlsx` workbook with assumptions, scenarios, overrides, run/checkpoint/as-of stamps, and a round-trip test. | Partial · C9 |
| UW-09 | Report Studio — publish/export for a real issuer | Draft/version APIs and reference-paper editing work, but a real issuer has no report object: the page states CP-RENDER is not wired, so publish/PDF remain unavailable (`reports/page.tsx:435-439,474-480,604-606`). | CP-RENDER or an equivalent live composition adapter producing issuer-specific pages from the selected run/model checkpoint/findings. | Backend-unwired · C4 / CP-RENDER |
| UW-10 | Monitor — **Critical alerts** filter | The red count is the static `CRITICAL_ALERTS` fixture and filters the seeded replay rail, not the durable live inbox (`monitor/page.tsx:17-21,83-100,146-159`). | Derive the count/filter from persisted live `AlertEvent` rows and one shared query state. | Reference-only · C3-seam |
| UW-11 | Monitor — Replay controls and Email Intelligence | Ack/assign/resolve on the live Alert Inbox are wired. The clock, EOD email tape, source-email modal, and `EmailIntel` filters remain seeded simulation; no email transport/outbox backs them. | Watch-rule/event source pipeline plus `AlertSink`, live `InAppSink`, and a rendered-intent `EmailSink` stub before enterprise transport. | Reference/backend-unwired · C3-seam |
| UW-12 | Settings — custom model routing selects | Three per-lane selects are permanently disabled with no-op `onChange`; copy says the values are not applied (`settings/page.tsx:463-482`). | Run-lane override contract, validation, persistence, execution routing, and cost/authority audit. | Explicitly backend-unwired · new E7 |
| UW-13 | Settings — Outlook connection | Settings persist/display `outlook_connected` and approved senders, but there is no connect/disconnect, credential, OAuth/test-connection, or transport action (`settings/page.tsx:551-591`). | Enterprise email adapter/control plane; do not let a stored Boolean imply a verified connection. | Backend-unwired · C3-seam/H4 |
| UW-14 | Settings — View: Analyst / PM / QA | The selector persists composition only. It is not authorization and cannot create admin/read-only users. | Server-enforced roles-lite, role assignment, route matrix, audit visibility, and UI suppression matching policy. | Backend-unwired policy · E2 |
| UW-15 | Issuer Profile — Market · price & DM | The panel is an explicit “Feed pending” placeholder with no loan mark/DM series (`ProfileContent.tsx:754-763`). | Consume the normalized live/manual market snapshot store with source/as-of/freshness. | Backend-unwired · C5 |
| UW-16 | Research — **Run example research** | With no model provider, the normal run persists and returns a clearly labeled canned demo report (`research/page.tsx:3-7,395-470`; `routes/research.py:3-6`). | A configured grounded-research provider for live output; keep the example lane reference-only. | Capability-gated/reference · D2/E4 |
| UW-17 | RV — **Run screen / Review top candidate / Ratify candidate** | Versioned screens persist, but the only snapshot is a bundled `REFERENCE` JSON import. Every row is forced screen-only/unavailable because live origin, downside, recovery, portfolio mapping, and risk-budget gates are missing; ratification is consequently unreachable (`routes/rv.py:85-103,291-367,434-453`). | Live/manual immutable snapshot ingestion, recovery/downside adapters, exact portfolio mapping, and risk-budget calculation. | Reference-only / backend-unwired · C5 |
| UW-18 | RV — **Monitor threshold** | The button pins a finding with source surface `monitor-threshold`; it does not create a durable watch rule or alert event. | Create/edit a threshold, owner, severity, evidence link, and next-evaluation state. | Misleading partial action · C3-seam |
| UW-19 | Sector Review — **Request refresh** | Creates a versioned review from persisted signals/reference synthesis, but CP-SR is still spec-only and the route does not run the complete analytical engine as an asynchronous job. | Real queued/running/partial/ready CP-SR execution with immutable prior published version and complete source-backed dimensions. | Partial/backend-unwired · CP-SR / X5 |
| UW-20 | Sector Review — **Ratify updates / Publish review** | Mutations are wired and correctly gated, but reference/partial drafts cannot become a production published review. | Live source-backed CP-SR artifact satisfying every publication dependency. The buttons themselves should remain gated. | State-gated by missing engine · CP-SR / X5 |
| UW-21 | Query — grounded lane | Metric and graph lanes are deterministic and wired. The grounded lane degrades to `partial` with preserved question/alternatives when the model provider is unavailable. | Production model-provider configuration and a green live-provenance E2E; no UI rewrite required. | Capability-gated · main-CI blocker |
| UW-22 | Global ASK, Upload, live Alert Inbox, model save/checkpoints, issuer creation, and worklist filters | No dead action found in the current scan; their buttons either call real APIs/local utilities or are valid prerequisite gates. | Keep regression coverage; do not create fake “wire button” work for these controls. | Wired / state-gated |
| UW-23 | Upload — **Run mode** choices and queued-run label | The chosen mode is written to each source manifest, but `createRun` does not receive it; every queued run takes the full CP-X route even while the UI says the selected mode was queued (`UploadWizard.tsx:156,201`; `steps.tsx:479-494`). | Either pass a validated route template into run planning and stamp the resolved plan, or relabel/remove the selector so it is honest document metadata rather than execution control. | Misleading partial action · new C12 |
| UW-24 | Issuers — sample sleeve fallback | When live coverage is empty, the directory injects `DEMO_UNIVERSE` and says it is a sample sleeve. The labeling is honest, but the live worklist is not an actual observed-empty state (`issuers/page.tsx:334,400`; `lib/issuers.ts:7`). | Separate the reference workspace from the live directory, or show a true empty worklist with an explicit action to open sample data. | Reference-only · C2 |

#### Unwired platform capabilities without a single button

| ID | Capability gap | Current evidence | Plan owner / exit |
|---|---|---|---|
| UF-01 | Four spec-only engine modules | `CP-SR`, `CP-MON`, `CP-RENDER`, and `CP-EXTRACT` are `implemented=False` and never execute (`engine/registry.py:198-215`). | X5/C3/C4; implement or explicitly remove from the pre-deployment promise. |
| UF-02 | Alert sink and watch-rule architecture | Durable alert events and ack/assign/resolve exist in the current worktree, but `AlertSink`, `InAppSink`, `EmailSink`, scheduled watch rules, deduplicated event generation, and an outbox are absent. | C3-seam; rule → event → inbox → sink E2E, with email intent recorded. |
| UF-03 | Production market-data provider chain | Normalized snapshot/instrument tables and RV adapters exist in WIP, but no `MarketDataProvider`, `BloombergProvider`, `ManualQuoteProvider`, import/refresh endpoint, or Settings connection/test UI exists. | C5; fixture-backed provider plus manual fallback and one shared store. |
| UF-04 | Complete live Sector Review engine | The V2 dossier contract exists, but it is reference/signal synthesis rather than CP-SR compute; display-version allocation also lacks a dedicated unique DB column under concurrent refresh. | X5 plus accepted red-team follow-up; async job and uniqueness constraint. |
| UF-05 | Live Report renderer | Draft/version persistence exists; CP-RENDER and issuer-specific report composition do not. | C4/CP-RENDER; real issuer → report version → PDF/IC journey. |
| UF-06 | Live Deep-Dive rail/read-model adapters | Real module center views exist; several retained evidence, QA, output-register, and committee panes are reference-only. | C4; parity matrix must pass before fixture path retirement. |
| UF-07 | Persisted model scenario application | Scenario calculations and network readout exist; an applied scenario is not a saved override/checkpoint artifact. | A-1; apply/undo/save/reopen E2E. |
| UF-08 | Roles-lite authorization | `role_view` remains presentation-only. A server role field and selected write gates now exist in the current checkout, but exhaustive legacy-route enforcement and an admin assignment plane are not yet certified. | E2; deny-by-default mutation matrix. |
| UF-09 | Firm-wide append-only audit log | `audit_log`/audit helper are absent from current checkout and `origin/main`; candidate PR #169 is open. | E3; all shared mutations write actor/before/after rows. |
| UF-10 | Breadth corpus | The 61-name MANIFEST exists; captured fixtures and `corpus_run` marker remain absent. | B5; scoped fixture count must equal manifest scope. |
| UF-11 | Full concept-link decision journey | Individual E2Es exist, but no one test proves issuer → upload → pipeline → Deep-Dive → model checkpoint → finding → report with identical artifact identity and numbers. | C6; one backend-connected Playwright/API journey. |
| UF-12 | Head-to-head Query walk | Not present on current checkout/main; green candidate/stamp PRs #187/#188 remain open. | C7; merge only after main CI parity. |
| UF-13 | IC Decision Record on main | Implemented in the two-commit local branch (`0044_decisions`, `/api/decisions`, Decision Room) but not in `origin/main`; green candidate/stamp PRs #191/#192 remain open. | C8; merge, migrate, rerun server/frontend/E2E on main. |
| UF-14 | Committee `.xlsx` export | Current code exports CSV; green candidate/stamp PRs #189/#190 remain open. | C9; merge plus openpyxl round-trip and same-number test. |
| UF-15 | Research/report multi-worker execution | `WEB_CONCURRENCY` and stress evidence landed, but research/report executors remain in-process and are not safely coordinated across workers. | E1; durable claim/lease/reaper or documented single-worker boundary. |
| UF-16 | Graph expansion production retrieval | `engine/graphexpansion.py` is a measurement harness and explicitly is not wired into `retrieve_corpus`. | Expansion backlog; wire only after quality/latency gate. |
| UF-17 | Vault peer/sponsor edges | `vault_export.py` still describes peer/sponsor edges as a stub because CP-1C persists counts rather than identities. | X2/X6 dependency; persist evidence-backed entity identities first. |
| UF-18 | Analyst disable/delete operator path | Auth comments record that disabling an analyst needs an operator/RBAC path that does not exist. | E2/H3; admin-only lifecycle with audit and data-retention semantics. |

#### Latest phase-status delta

| Status | Items | Evidence / remaining condition |
|---|---|---|
| **Delivered on `origin/main`** | A1, A7b, B1, B4, C1, D1, D3, E4, E6, G1, G4 | Tests/artifacts exist on `origin/main`. Checkboxes below are closed in this reconciliation. |
| **Delivered locally, not on `origin/main`** | C8 | Current branch has decision tables/routes/UI/tests; PRs #191/#192 remain open. Item stays open until merged and green on main. |
| **Partial** | C2, C3-seam, C4, C5, D4, E1, E5 | Each has real shipped progress but still fails its written exit condition; the UW/UF rows above name the residual. |
| **Open** | A5, A6, B2, B5, C6, C7, C9-C12, E2, E3, E7, F1-F5, G2, G3, H1-H5, X backlog | No status promotion from an open PR, a fixture, a schema alone, or a local-only test. |

**Immediate release order:** (1) fix the two red main E2Es and obtain a green
main-tip run; (2) reduce/decide the eight open PRs and merge only green,
non-overlapping candidates; (3) stabilize the 186-path worktree into reviewable
commits; (4) resolve every local/reference/backend-unwired row in UW-01–UW-24
or explicitly descope it from the pre-deployment promise (UW-22 remains the
wired regression baseline); (5) execute H1/H2 on the resulting immutable build.

---

## 0. Definitions — read first

| Term | Meaning here |
|------|--------------|
| **Pre-deployment** | Final stage before enterprise transfer. All exit gates A–H passed. Only the two named items outstanding: EmailSink adapter + Bloomberg activation. |
| **Live** | Renders real engine/DB output with provenance. A labeled sample ("Sample — not live") is *not* live; an explicit "no data" empty state *is* acceptable. |
| **Functional** | Works end-to-end through the real path (UI → API → engine → DB), not through a simulation hook. |
| **Tested regularly** | Covered by a named loop ID in [PRE_DEPLOYMENT_QA_LOOPS.md](PRE_DEPLOYMENT_QA_LOOPS.md); scheduled loops (mechanism class `WORK-ITEM`/`LIVE` with a cron) must show ≥2 consecutive green cycles before the claim counts at a phase exit. A cadence word with no loop ID is not a claim this plan makes. |
| **Seam / stub** | A code interface where a future integration plugs in. The seam itself is built and tested against a fake now; only the external connection is deferred. |
| **CRIT/HIGH/MED/LOW** | Dual severity rubric from DEVELOPMENT_PHASES §Conventions. CRIT+HIGH block phase exit; MED+LOW are tracked. |

### The two allowed-outstanding items — precise boundaries

**#1 Monitor → enterprise email.** Everything up to the send must be live:
watch rules, event generation, alert persistence, in-app alert inbox. The
boundary is an `AlertSink` interface with two implementations: `InAppSink`
(live, tested) and `EmailSink` (stub that logs + records intent; spec written
for SMTP and MS Graph so enterprise IT picks one). Outstanding = implementing/
pointing `EmailSink` at the enterprise mail system.
**State 2026-07-11:** none of this exists yet. `git grep -in
"alertsink|emailsink|inappsink|watch_rule"` over `caos/server` and
`caos/frontend/src` returns zero hits (S4 ledger Ev-1). The Monitor autonomy
*engine* (Sentinel→Anomaly→Analyst→Reporter DAG) is committed and tested
(`test_autonomy.py`), but the seam that turns its output into persisted,
inbox-visible alerts does not exist — `monitor/page.tsx` still renders a
labeled simulation (`monitor/page.tsx:14,64-67` "Illustrative sample — not
live"). **C3-seam (§5) builds this whole boundary**; only the email-transport
half of `EmailSink` is meant to stay outstanding at the gate.
**State 2026-07-12 (branch `feat/design-rebuild-p1` only, unmerged):** a live
`AlertInbox` + `useAutonomyDraft` + `alert_states` table landed (P2-WP-3) —
see the 2026-07-12 update block above. The `AlertSink`/`EmailSink` interface
itself is still zero-hit even here; reconcile at C3-seam pickup.
**State 2026-07-15:** run-terminal `notification_events` (migration `0058`,
idempotency-keyed, seen-state, `/api/notifications` feed) are merged and
wired from `run_executor.py` — the first durable event persistence on main.
`AlertSink`/`EmailSink`/`InAppSink`/`watch_rule` remain zero-hit; Monitor UI
counts/replay/EmailIntel remain fixture-backed (UW-10/UW-11).

**#2 Market data → Bloomberg.** Product decision 2026-07-03: the Bloomberg
connector is **built in-plan** (C5), not left as a stub — persisted quote
store feeding **all RV analysis app-wide**, Sector RV **refresh button**,
Settings **login/API requirements** section, `BloombergProvider` implemented
and tested offline against recorded response fixtures, with
`ManualQuoteProvider` (analyst-entered / CSV) as the always-available
fallback. Outstanding at pre-deployment is only what requires the enterprise:
entitlements + credentials (transport per their licensing — BLPAPI Server
API/B-PIPE or HAPI REST; the Desktop API needs a running Terminal and does not
suit a server app), the first live connection, and the parallel-run
reconciliation before cutover (DEVELOPMENT_PHASES Phase 5). DM remains the
canonical spread metric (loans-only decision).
**State 2026-07-11:** entirely absent — zero code hits for `bloomberg`,
`blpapi`, `market_quotes`, `MarketDataProvider`, `ManualQuoteProvider` in
`caos/server` (S4 ledger Ev-2); no market-data migration across all 37
migrations 0001–0037; Bloomberg exists only as a name inside seeded frontend
fixture data (`lib/command/rvdata.ts`, `market-data.json`). **C5 (§5) builds
the entire layer**; only enterprise entitlements/credentials/parallel-run stay
outstanding at the gate.
**State 2026-07-15:** the persisted-store half now exists — immutable
`market_snapshots` + `market_import_issues` (migration `0055`) with the
authz-gated `/api/rv/snapshots/import[/preview]` manual XLSX lane (flag-off →
C14). Provider chain, refresh, Settings control plane, and every consuming
read-model remain unbuilt; `MarketDataProvider`/`BloombergProvider`/
`ManualQuoteProvider` still zero-hit. C5 builds on the 0055 store (see §5).

**SUPERSEDED 2026-07-22 (product decision, RT-2026-07-22-788/789):** the
2026-07-03 "connector built in-plan" decision is reversed. **No Bloomberg
code — provider chain, fixture-backed `BloombergProvider`, Settings
connection plane — is built pre-deployment.** Phase-1 ships on the existing
fixed/manual market data: the immutable `market_snapshots` store (0055) with
the analyst XLSX import lane, plus the immutable RV reference snapshot, all
provenance-labeled. Bloomberg moves entirely to the **enterprise-side final
step**, grouped with the enterprise email transport as one H4 activation
package (build-and-activate once licensing/transport documents exist — the
only honest sequence per RT-2026-07-20-770, since no licensed transport
decision exists to code against). DM remains the canonical spread metric.

---

## 1. Historical 2026-07-11 baseline — superseded

Verified 2026-07-11 against `origin/main@313ebac` by direct code inspection
and a live test run this session. Every row below is a re-derived fact, not
inherited from a prior grounding. **This section is retained for program
history only. Use the 2026-07-18 final closure audit above for every current
status or release decision.**

### Working and tested in the 2026-07-11 snapshot

| Area | Evidence |
|------|----------|
| Engine: 19 implemented modules (+4 spec-only, honestly routed "Not Implemented") emit real output via governed CP-X DAG | `caos/server/engine/`, `registry.py:152-170`; **1393 pass / 2 skip** this session (`caos/tests/server caos/tests/stress caos/tests/cohort`) |
| Model tiers (TEST/LITE/BALANCED/MAX) + OpenRouter/DeepSeek provider, default hybrid DeepSeek-v4 degrading to Anthropic w/o key | `caos/server/llm_client.py` and siblings |
| EDGAR CP-1 (US XBRL) + reported-disclosure lane (non-US/IFRS) | `edgar_cp1.py`, `reported_cp1.py`; VSAT/FUN/VMO2 goldens |
| Golden-master drift alarm in CI | `caos/tests/server/golden/test_golden_cp1.py` — runs inside the normal `pytest caos/tests/server` collection (no separate marker) |
| CP-5 QA gate + finding gates incl. the new `cp1_completeness_finding` (confident-but-empty foundation → MATERIAL/Restricted) | `engine/metrics.py` (landed in the `313ebac` drift window, commit `6a4f265`) |
| **RAG answer lane in Query — DONE, committed and wired end-to-end** (retrieval-grounded, chunk citations, entailment demotion) | `engine/queryanswer.py`, `entailment.py`, `provenance.py`, `memochunks.py`; `routes/query.py:223 POST /answer`; frontend `query/page.tsx` imports `queryAnswer`, `components/query/AiAnswer.tsx` |
| Monitor autonomy engine (Sentinel→Anomaly→Analyst→Reporter DAG) committed and tested | `engine/{autonomy,sentinel,anomaly,reporter}.py`, `engine/pipeline_executor.py`, `routes/autonomy.py`, `caos/tests/server/test_autonomy.py` |
| Command Center: live-aware `IssuerStrip` (resolves against live rows first, SAMPLE-tags the fallback) + live CP-0 Source-Gaps board | `command/page.tsx` (`usePortfolio`, `liveSelected`, `LiveCoverage`), `views.test.tsx` ("IssuerStrip live/seeded seam"); Source-Gaps board `_portfolio_gaps` + `lib/command/gaps.ts` (commit `62a04a5`) |
| Deep-Dive, Pipeline, Model Builder, Report Studio, Issuer Profile wired to live runs | `caos/frontend/src/app/*` |
| Auth: Caddy → oauth2-proxy → edge-secret fail-closed → in-app analyst profiles; fails closed in every shipped-artifact config | LAUNCH_PHASE1 §5 W1; confirmed by direct read of 4 boot guards in `main.py:47-87` |
| Optional multi-team tenancy mechanism (config-gated, default off) | `tenancy.py`, migration `0037_team_tenancy`, `test_tenancy.py` — orthogonal to E2 roles-lite (see trunk-state note) |
| LLM fault isolation (timeout/5xx never aborts a run; no LLM lane has tools/writes) | per-module Blocked gate / council `return_exceptions` / deterministic fallback |
| Deploy stack: app + Postgres + vault + hardened daily backup producer + isolated rclone off-host sync/remote-restore service | `caos/deploy/{Dockerfile.backup,Dockerfile.backup-sync,backup.sh,backup_sync.sh,restore_drill.sh,docker-compose.yml}` |
| Migration discipline: single head, `alembic check`, full up/downgrade round-trip tested on both py legs | `caos/tests/server/test_migrations.py` |
| Stress harness built (mock-Anthropic 429/529/hang, locust) | `caos/tests/stress/` — **never run at scale this program** (E1) |
| E2E (Playwright, storageState auth), a11y (axe), perf smoke (p95 gate) | `caos/tests/frontend/e2e/` (10 specs), `caos/frontend/scripts/a11y-axe.mjs`, `caos/tests/perf/smoke.py` |
| Feature tracker: 355 rows, 346 `Pass` / 9 `Pending Verification` (all Command "Sector Review" — CP-SR is `implemented=False` by design, not a defect) | `caos/docs/qa/FEATURE_TRACKER.csv` |
| `AUDIT.md` reconciled against the shipped tree, deploy-ready, no P0/P1 open | `caos/docs/AUDIT.md` (only S-4 row-authz [by-design, →Phase-2] and A-1 mock→engine epic tracked open) |
| All 9 QA playbooks present with procedure/invariants/risk-register/artifact path | `caos/docs/qa/playbooks/*.md` — see [PRE_DEPLOYMENT_QA_LOOPS.md](PRE_DEPLOYMENT_QA_LOOPS.md) §3 for the home/cadence/gate mapping |
| Pilot deployed on internal host from `main` | 2026-07-02, PR #93 merged |

### Gaps in the 2026-07-11 snapshot

| Gap | Evidence | Phase |
|-----|----------|-------|
| **`AlertSink`/`EmailSink`/`InAppSink` seam, watch-rule model, alert persistence, alert inbox — entirely absent on `origin/main`.** Monitor frontend still a labeled simulation there. Autonomy *engine* is committed but nothing turns its output into a persisted, actionable alert. *(A live `AlertInbox` UI now exists on the unmerged `feat/design-rebuild-p1` branch — see the 2026-07-12 update block above; the `AlertSink` interface itself is still unbuilt even there.)* | Zero hits (S4 Ev-1); `monitor/page.tsx:14-18,64-67` | C (C3-seam) |
| **Market-data layer — entirely absent.** No quote store, no `MarketDataProvider`/`BloombergProvider`/`ManualQuoteProvider`, no Sector RV refresh button, no Settings section. Bloomberg exists only as a name in seeded frontend fixtures. | Zero hits (S4 Ev-2); 37 migrations, none market-data | C (C5) |
| No `MOCK_LEDGER.md` mock-inventory deliverable | absent from tree | C (C1) |
| Command Center labeled sample sleeve board retained (though live-aware IssuerStrip + Source-Gaps board landed) | `command/page.tsx` "Sample portfolio — not live" | C (C2) |
| No querygraph node-count regression test (cap exists in code, zero test references it) | `querygraph.py:866 _GATE_NODE_CAP=300`; grep of `test_querygraph*.py` returns zero refs (S4 Ev-11) | A (A1) |
| No `golden_e2e` full-chain test, no `corpus_run` marker/CI — both absent | S4 Ev-3; goldens run inside normal pytest collection (CP-1-lane drift only, not upload→DAG→CP-5) | B (B1, B5) |
| 33/61-issuer breadth corpus: **selection delivered (MANIFEST now titled "61 Issuers"), zero fixtures captured** | `caos/tests/server/corpus/MANIFEST.md` — only file in the directory (S4 Ev-5) | B (B5) |
| No committee-pack `.xlsx` export — current export is a documented CSV stub | `components/model/export.ts:39-45` (S4 Ev-7) | C (C9) |
| No IC Decision Record, no head-to-head comparison walk, no concept-link (same-number-everywhere) suite | grep clean across `questions.ts`/`views.ts`/`synthesis.ts`, `caos/tests/frontend/e2e/` | C (C6/C7/C8) |
| Roles-lite (E2) not built — no `role` column, no `CAOS_ADMIN_EMAILS`, no role dependency. (The `team_id`/tenancy mechanism that landed 2026-07-10 is a *different*, orthogonal axis — cross-team isolation, not within-team roles.) | `database.py` has `team_id` columns only (S4 Ev-12) | E (E2) |
| No `audit_log` table, no SBOM, no DR runbook, no scripted restore drill (drill = shell *comments* in `backup.sh`) | grep clean; `backup.sh:13-19` | E, G |
| Unmerged: `feat/covenant-frontend` (1 orphan commit `3605c99`, frontend pages for the covenant register — the backend adapter, routes, and Query walks already shipped independently) | `git ls-remote --heads origin` | A (A3) |
| **12** open dependabot PRs (plan previously under-tracked this at 2) + 4 draft feature/infra PRs + 1 non-draft feature PR (#147 merged) *(re-verified 2026-07-12: down to 2 open — #139, #140 — the rest merged same-day per A5)* | GitHub MCP query, 2026-07-11 | A (A5) |
| 9 unmerged orphan branches (no open PR) + 18 remote branches merged & prunable | `git ls-remote --heads origin`, cross-checked via `git merge-base` | A (A6) |
| 8 dangling skill symlinks in `.claude/skills/` (targets removed by the 2026-07-08 skills audit) | S4 Ev-10 | A (A6b, new) |
| CI has not gone green on `main` since `ee37030` (#148); no `schedule:`/`workflow_dispatch:` trigger exists anywhere in `ci.yml` | S4 Ev-4 | — (tracked per-phase; automation work items in the loop doc) |
| Stress harness built but never run at pilot-plausible concurrency; no multi-worker deploy config | `caos/deploy/` grep clean for `--workers`/`WEB_CONCURRENCY` | E (E1) |

---

## 2. Phase overview

| Phase | Name | One-line | Size | Depends on |
|-------|------|----------|------|-----------|
| A | Trunk consolidation | merge/triage everything open, close known findings, reconcile trackers | ~3–5 days | — |
| B | Engine certification completion | both lanes clean on 3 goldens + captured breadth corpus, headless | ~2–3 wk | A |
| C | All concepts live | kill the mock: Monitor seam, market data, Command board, remaining seams | ~3–5 wk | B |
| D | Ingestion breadth | OCR provenance/golden, upload robustness matrix (RAG lane already done) | ~1 wk | B (∥ C) |
| E | Enterprise hardening | roles-lite, audit trail, secrets, governance, stress, SBOM | ~2–3 wk | C |
| F | Beta — build the dictionary | 3–5 analysts, real coverage, gap log | ~3–4 wk cal. | C, D (∥ E) |
| G | Ops readiness | drills, independent alerting, host baseline, load, DR | ~1–2 wk | E |
| H | Pre-deployment gate + handover | immutable candidate, UAT, cutover rehearsal, transfer package | ~1 wk | all |

Sizes are planning aids, re-estimated at each phase exit (§13). D shrank
materially this grounding (D2 RAG lane is done); A shrank (A0's five P0
blockers from the 07-08 grounding are resolved — §15). C remains the largest
phase: it now carries both L-sized outstanding-item seams (C3-seam, C5) in
full, not just their remainders.

---

## 3. Phase A — Trunk consolidation & known-debt closure

**Objective:** one trunk, zero known open findings, trackers telling the
truth, tooling roots clean.

- [x] **A1 (S) — DONE on main.** `test_querygraph.py:167-257` constructs an
  over-cap finding history, pins `_GATE_NODE_CAP == 300`, and asserts the
  deterministic severity/newest slice contains exactly 300 nodes. Keep the
  cap test in the normal server suite.
- [x] **A2 (S)** ~~Merge `feat/query-route-fast-lane` → `main`~~ **DONE**
  (merged via PR #99).
- [x] **A3 (M)** **DONE 2026-07-11** — landed as PR #160 (merge 67017f01): full rebase of `3605c99` + 3 fixes, obsolete manual-rating fields dropped, profile/digest mounts rebuilt against current layouts (parallel partial #162 closed superseded). Residual: delete `feat/covenant-frontend` (A6 list). `feat/covenant-frontend` orphan commit `3605c99` (frontend
  pages: `/sponsors`, dominoes, register rows, digest panel). The **backend**
  half already shipped independently (`routes/sponsors.py`, `routes/digest.py`,
  `covenant-register`/`sponsor-graph` Query walks registered in
  `questions.ts`/`synthesis.ts`) — confirm on rebase whether the frontend
  commit still applies cleanly or needs a rebuild against current
  `components/command`. **Verify:** `git log --oneline main..
  origin/feat/covenant-frontend` shows the 1 commit; after merge, `npm run
  build` + the relevant e2e spec pass. **Exit:** `/sponsors` route renders
  live data; branch deleted post-merge.
- [x] **A4 (S)** ~~Land PR #95 (Sector RV DM/YTM plausibility guard)~~
  **DONE/superseded** — `origin/main` carries the `credibleDm` guard.
- [x] **A5 — DECISIONS RECORDED 2026-07-22** (L14 satisfied): all 15 open
  dependabot PRs **deferred post-H0** (any dependency bump invalidates the
  frozen candidate; the per-PR CI security subset stays green meanwhile);
  #169 (E3), #184 (D1 stamp), #191/#192 (C8), #207 (docs) = post-freeze
  work, scheduled after the release decision (H8 ledger row). No PR lacks a
  decision. *Historical item text follows:*
  **(M) — live PR triage.** 2026-07-15: **4 open** — #169 (E3), #184
  (D1 stamp), #191/#192 (C8). C7 (#187/#188) and C9 (#189/#190) merged
  2026-07-15 with main-tip CI green after. Remaining decisions: #169 (had a
  server-test failure at last check), #191/#192 (green candidate/stamp),
  #184 (stamp-only; its feature #183 already merged — merge or fold the stamp).
  **Verify:** refresh the GitHub open-PR list and checks at pickup.
  **Exit:** no PR older than 14 days lacks a decision, no duplicate candidate
  remains open, and accepted work is green on `origin/main` (L14).
- [ ] **A6 (S) — remote branch hygiene.** The 2026-07-11 classification found
  18 merged branches and 9 orphan branches; that count is historical and must
  not be reused as current evidence. Refresh remote refs, classify every head
  against `origin/main`, and delete only owner-approved merged/superseded
  heads. **Verify:** `git ls-remote --heads origin` plus
  `git merge-base --is-ancestor <branch> origin/main` per branch. **Exit:** 0
  merged-and-stale remote branches remain; every orphan has a disposition.
  Machine-local branch/worktree counts are diagnostic only, never a release
  metric.
- [x] **A6b (S) — new.** **DONE 2026-07-11** — all 8 dangling links removed (verify command returns empty); `outstanding` skill now cites `.venv311` + the ~1393/2 baseline. (Local `.claude/skills` is untracked, so there is nothing to merge.) Skills-root hygiene: 8 dangling symlinks in
  `.claude/skills/` whose `.agents/skills/` targets were removed by the
  2026-07-08 skills audit (`error-model-validation-architect`,
  `openrouter-typescript-sdk`, `implement-feature`, `critique`,
  `codebase-audit`, `compose-ui-test-server`, `distill`,
  `security-best-practices` — S4 Ev-10). PR #124 already restores
  `security-best-practices`; decide per-symlink: restore the target or remove
  the dangling link. Also refresh the `outstanding` project skill
  (`.claude/skills/outstanding/SKILL.md`), which still cites the retired
  py3.9 `.venv` and a "~317 pass" baseline. **Verify:** `find .claude/skills
  -maxdepth 1 -type l -exec sh -c 'test -e "$1" || echo DANGLING: $1' _ {} \;`
  returns empty. **Exit:** zero dangling links; `outstanding` skill cites
  `.venv311` and a current pass count.
- [x] **A7 (S)** ~~Refresh `AUDIT.md`'s stale header~~ **DONE** — already
  reconciled 2026-07-11 (independently of this plan): "Server: 1378 pytest ✓ /
  2 skipped," deploy-ready, no P0/P1. (Superseded by this session's own
  1393/2 run, which adds the `stress`+`cohort` dirs AUDIT.md's `server`-only
  count doesn't include.)
- [x] **A7b (S) — DONE on main.** All nine formerly-pending Sector Review
  rows were adjudicated against shipped behavior. `FEATURE_TRACKER.csv` is
  now **355/355 `Pass`**, 0 `Pending Verification`; CP-SR production compute
  remains separately and honestly tracked under UF-01/UW-19 rather than
  hidden in the UI tracker.
- [x] **A8 (M) — DONE 2026-07-15.** The 2026-07-15 reconciliation block at the
  top of this document executed this item: every UW/UF row re-verified (FIXED
  verdicts hand-confirmed), A–H statuses re-derived against
  `origin/main@0b00b21a` + the 3 inventoried branch commits on a clean tree,
  with commit, PR list, migration head (`0059`), CI state, and suite count
  (1821/9) recorded. Scope note: grounding ran on `codex/112` (= main + 3
  listed commits), not a bare `origin/main` checkout — each branch-only delta
  is itemized in the block, so no "current" claim silently includes
  unreviewed drift. Re-open this item (per its original text) at the next
  major landing — the C8/E3 merges or any flag enablement.

**Exit gate:** `main` is the only release branch (post A3/A6/A6b) · 0 open
non-dependabot PRs without a recorded decision · dependabot backlog ≤14 days
old (A5/L14) · CI green on `main` tip (**true 2026-07-15 at `0b00b21a`** —
re-verify at gate close) · server suite green on the designated server venv
(latest local: 1821 pass / 9 skip) · `FEATURE_TRACKER.csv`
has 0 unresolved `Pending Verification` rows ·
0 dangling skill symlinks · A8 current-state reconciliation complete (done
2026-07-15; re-run at next major landing).

**Loops:** L1 (CI gate), L2 (code review), L3 (blast radius), L14 (dependency
triage), L15 (tracker sweep) — see the loop doc.

---

## 4. Phase B — Engine certification completion

**Objective:** the credit math is provably correct on real third-party
filings at the API layer, both lanes, before any UI work sits on top of it.
*(= DEVELOPMENT_PHASES Phase 1 remainder — 0/5 boxes checked there as of this
grounding, including the #25/#26/#27 engine-fault closure boxes.)*

- [x] **B1 (M) — DONE on main.** `golden/test_golden_e2e.py` covers VSAT,
  FUN, and VMO2 across keyless EDGAR/reported and keyed mock-LLM paths,
  including run-wide evidence resolution and CP-5. The `golden_e2e` marker is
  registered in `pytest.ini` and selected by `.github/workflows/nightly.yml`.
- [x] **B2 — EXIT SATISFIED** *(Exec 2026-07-11: the no-dangling-citation floor landed inside PR #163 — `_assert_provenance_resolves_run_wide` sweeps every claim across every produced module on all 4 golden runs; 2026-07-22: the same run-wide sweep now also applies breadth-wide across the 28-issuer B5 corpus. Recorded follow-on, post-release: lineage-class-aware sweep beyond chunk-existence.)* Provenance chain audit, golden-run-wide: for every claim in
  a golden run, assert `claim → evidence → chunk` resolves with no dangling
  citation ids, across the whole run rather than per-module (today's coverage
  is per-module/per-run: `test_engine.py:350`, `test_evidence_resolution.py`,
  `test_edgar_cp1.py:314` — real but not a golden-run-wide sweep). **Verify:**
  new test asserts zero dangling ids across a full golden run's claim set.
  **Exit:** test lands, green on all 3 goldens.
- [x] **B3 (S)** ~~`is_finite_number` sweep~~ **DONE.** Dedicated
  `test_nan_guards.py` plus corroborating coverage across ~11 files
  (`test_engine_math_degrade_guards.py`, `test_periods_safe_div.py`,
  `test_adjusted_guards.py`, `test_metricfactlane.py`, `test_liquidity.py`,
  `test_metricengine.py`, `test_recovery_waterfall_contract.py`,
  `test_audit_p0_fixes.py`, others). No further action required; keep as a
  standing invariant (CLAUDE.md engine-conventions).
- [x] **B4 (S) — DONE on main.** `test_cp5_gate_honesty.py` proves a pristine
  golden remains clean, an injected implausible leverage fact becomes
  MATERIAL/Restricted, and missing evidence becomes CRITICAL/Blocked.
- [x] **B5 — EXECUTED at core-33 scope 2026-07-22** (owner scope decision:
  33-name subset first; Batch-2's 28 names remain the future tranche). All 28
  EDGAR fixtures captured (`corpus/_capture.py`, KEEP-trimmed, six stale
  analyst CIKs re-resolved live), `corpus_run` marker registered,
  `test_corpus_run.py` asserts the manifest properties per issuer — full
  28-issuer sweep runs in **~7 s** (cap was 300 s), so nightly runs the whole
  set (`CORPUS_FULL=1`, L6 wired) and the per-PR server job carries the
  5-issuer smoke subset via normal collection; +1 manifest↔fixture parity
  test. VMO2 reported lane stays golden-owned; SFR/Refresco/INEOS/Cirsa are
  owner-doc-pending (recorded in MANIFEST). Full server sweep with the corpus
  collected: 2,935 passed / 38 skipped. *Historical item text follows:*
  **(L — own implementation plan at pickup)** Breadth corpus capture.
  **Selection delivered** — `caos/tests/server/corpus/MANIFEST.md` now names
  **61 issuers** (the original 30-name analyst cohort + 3 foreign
  reported-lane names from 2026-07-03, +28 from a second analyst list added
  2026-07-04 — see the MANIFEST's own "Batch 2" section). **Zero fixtures
  captured; no `corpus_run` marker; no CI wiring** (S4 Ev-3, Ev-5 — the
  directory contains only `MANIFEST.md`). Work: (a) **owner decision** — run
  the full 61-issuer set or re-scope to a 33-name subset for initial capture
  (the runtime-cap/shard rule below contains CI cost either way, so this is a
  scope call, not a blocker); (b) one live SEC/doc fetch per issuer, trimmed
  + frozen offline (same `_capture.py` pattern as the goldens); (c) register
  a `corpus_run` pytest marker; (d) assertions per issuer (property, not
  value): full 19-module DAG completes both lanes without exception · CP-5
  gate fires honestly · every claim's evidence chain resolves ·
  `is_finite_number` holds on all CP-1 divides · DM (where computed) lands in
  a plausible band · no surface returns a mock number tagged `prov=run`;
  (e) **promotion rule**: any corpus issuer exposing a new bug class gets
  hand-verified once and promoted into the frozen golden set. **Runtime cap:**
  parallelize, target <~5 min wall for the full run; shard nightly vs. a
  6-issuer per-PR smoke subset if it bloats. **Verify:** `pytest -m
  corpus_run -q` green; MANIFEST count matches captured-fixture count.
  **Exit:** ≥1 fixture captured per issuer in scope, `corpus_run` green,
  nightly wiring live (loop doc L6 work item).

**Exit gate:** both lanes clean on all 3 goldens (exact, `B1`) **and** all
in-scope corpus issuers (property, `B5`) · provenance test green (`B2`) · CP-5
honesty test green (`B4`) · `is_finite_number` invariant holds (`B3`, done) ·
0 CRIT/HIGH correctness faults open · `golden_e2e` + `corpus_run` markers run
in CI (loop doc L5/L6) · corpus MANIFEST + fixtures committed.

**Loops:** L4 (golden-master drift, already live per-PR), L5 (golden E2E —
work item), L6 (corpus breadth — work item).

---

## 5. Phase C — All concepts live (kill the mock)

**Objective:** every surface renders live engine/DB output or an explicit
empty state. Monitor gets a real alert seam. Market data gets a real
connector. **Largest phase — carries both L-sized outstanding-item builds in
full.** C3-seam and C5 each get their own implementation plan at pickup.

- [x] **C1 (S) — DONE on main.** `caos/docs/qa/MOCK_LEDGER.md` classifies
  every discovered seed source and user-facing consumer: 0 silent mocks,
  all remaining fixture use visibly labeled, with the burndown owned by
  C2/C3-seam/C4/C5. Re-run the ledger at the C exit gate.
- [ ] **C2 (M)** Command Center: replace the remaining labeled sample sleeve
  board (`command/page.tsx` "Sample portfolio — not live") with the real
  registry; empty registry → designed empty state. **Partially done already**
  — the live-aware `IssuerStrip` (resolves live rows first, SAMPLE-tags the
  fallback, `views.test.tsx` "IssuerStrip live/seeded seam") and the live
  CP-0 Source-Gaps board (`_portfolio_gaps`, commit `62a04a5`) landed this
  grounding window. Remainder: the sample sleeve table itself, and the
  "what changed" strip driven by run-delta facts. Board carries threshold
  filters + saved views (screener fold-in, expansion 4.7); maturity-wall
  panel (CP-3D refinancing rollup, expansion 4.4). **Verify:** `grep -n
  "Sample" caos/frontend/src/app/command/page.tsx` returns 0 (or only an
  explicit empty-state string). **Exit:** no unlabeled/labeled-sample data on
  the board in a prod build.
  *(2026-07-15: this item's own verify-grep is **green** — `grep -n "Sample"
  app/command/page.tsx` returns 0; the sleeve/replay path is gone and
  positions come from `portfolioLabApi.getCommandSnapshot` with honest
  offline/empty states (UW-04 FIXED). Residual for C2 = the **issuers
  directory** `DEMO_UNIVERSE` fallback (UW-24): separate the reference
  workspace from the live worklist or show a true empty state with an
  explicit open-sample action — then close.)*
- [x] **C3-seam — LANDED + LIVE-OPERATED 2026-07-22.** Candidate merged
  2026-07-22 (exact-tree gate 2,919 server / 1,824 frontend / 18/18 browser /
  recaptured axe — C3_MONITOR_ALERT_CANDIDATE_EVIDENCE_2026-07-21.md), then
  the live-operation legs executed on live PostgreSQL: migrations 0066–0068 +
  `alembic check`, SKIP-LOCKED lease suites, an 18-cycle externally-operated
  reconciler/dispatcher window (materialization with full authority chain,
  exactly-once dispatch, idempotent replay), and the flag on→observe→off
  rollback — [C3_LIVE_OPERATION_EVIDENCE_2026-07-22.md](qa/C3_LIVE_OPERATION_EVIDENCE_2026-07-22.md).
  Remaining (target/activation, tracked by PD-06/H4): target-host flag cycle,
  email transport, RT-823 target-volume residuals. *Historical item text
  follows:* **(L — own implementation plan at pickup)** Monitor alert seam.
  **Latest:** the autonomy engine and the live ack/assign/resolve inbox are
  present; the current WIP also adds durable `AlertEvent` records. The
  production rule/evaluation/sink architecture is still absent, and the
  critical counter, replay rail, and email intelligence remain fixture-backed
  (UW-03/UW-10/UW-11/UW-13/UW-18; UF-02). Remaining work:
  - **Watch-rule model** (DB, alembic migration): rule = issuer/portfolio
    scope × signal type × threshold. Signal sources exist already: run
    completions, QA-gate flips, covenant findings (register), new-EDGAR-filing
    polls, DM moves (via C5, once it lands — include an out-of-bounds jump
    rule vs. trailing band), CP-1B monitoring + CP-1C peer-outlier findings.
    Schema reserves a `news` signal-type enum value (no producer yet) so a
    future news feed plugs in without a migration.
  - **Event generator**: evaluates rules on run completion + scheduled EDGAR
    poll; persists alerts (dedup on rule+issuer+fact).
  - **Alert inbox UI cleanup**: keep the live ack/assign/resolve path, derive
    every count/filter from persisted events, and retire or isolate
    `AlertFeed`/`simAlertsToday`/`EMAIL_TILES`; retain keyboard operation and
    provenance click-through.
  - **`AlertSink` seam**: `InAppSink` (live) + `EmailSink` (stub — logs,
    records "would have sent," renders the subject/body so the enterprise
    adapter is a transport swap only). Spec doc for SMTP + MS Graph variants.
    **This `EmailSink` stub is allowed-outstanding-item #1** — everything
    else in this bullet list must be live.
  - Kill the `EmailIntel` mock or rebuild it on `EmailSink`'s outbox records.
  - Surface "next expected filing" per issuer off the EDGAR poll (expansion
    4.9); the daily digest becomes an `AlertSink` consumer.
  **Verify:** `pytest caos/tests/server/test_autonomy.py
  caos/tests/server/test_alerts.py` (new) green; `grep -in
  "alertsink|emailsink" caos/server caos/frontend/src` returns hits (not
  zero). **Exit:** rule → event → inbox → `InAppSink` round-trips end-to-end
  from a golden-issuer run; `EmailSink` stub records intent with rendered
  subject/body; Monitor frontend has zero "Illustrative sample" markers left.
  *(2026-07-15 starting point: migration `0058` + `notification_service.py`
  now persist **run-terminal** `notification_events` (unique idempotency key,
  seen-state, `/api/notifications` feed) wired from `run_executor.py` — a
  live durable-event pattern the C3-seam plan should extend or subsume rather
  than duplicate. The `AlertSink` interface, watch-rule model, and all
  non-run-terminal signal sources remain zero-hit; UW-10/UW-11 fixtures
  unchanged.)*
- [ ] **C4 (M)** Deep-Dive / Report Studio residual seeded panels (from the
  C1 ledger): each → live adapter or explicit "no data / degraded" state. No
  unlabeled seed survives in a production build. **Verify:** C1's
  `MOCK_LEDGER.md` shows 0 open silent-mock rows in these surfaces. **Exit:**
  same.
- [x] **C5 — RESCOPED OUT OF PRE-DEPLOYMENT 2026-07-22** (resolved for this
  plan: not a gate; the build spec below transfers as the H4 package, now
  written — [reference/BLOOMBERG_ACTIVATION_RUNBOOK.md](reference/BLOOMBERG_ACTIVATION_RUNBOOK.md))
  (product decision;
  see "The two allowed-outstanding items" #2 supersession block and
  RT-2026-07-22-788/789). Phase-1 uses the shipped fixed/manual market data
  (0055 immutable snapshots + analyst XLSX import + RV reference snapshot,
  provenance-labeled). The provider chain, `BloombergProvider`, refresh path,
  and Settings market-data control plane below are retained as the **H4
  enterprise activation package specification**, grouped with the email
  transport — not a pre-deployment gate. Original item follows as the H4 spec:
  **C5 (L — own implementation plan at pickup)** Market data: quote
  store + Bloomberg connector. **Latest 2026-07-15:** migration `0055` +
  `routes/market_import.py` are now **merged**: immutable analyst-owned
  `market_snapshots` (document FK, source manifest, import mapping) with a
  `market_import_issues` audit table and authz-gated
  `/api/rv/snapshots/import[/preview]` — i.e. the **manual workbook-import
  lane exists** (flag `CAOS_MARKET_XLSX_V2_ENABLED`, default off → C14). The
  C5 implementation plan must treat this as the persisted store and build the
  provider chain **on top of it — do not create a parallel `market_quotes`
  store**; reconcile naming at pickup. Still absent: the provider
  chain/refresh path, credential/status control plane, live
  recovery/downside inputs, exact portfolio mapping, risk-budget adapter,
  and every consuming read-model (profile market panel still "Feed pending",
  RV still bundles the `REFERENCE` JSON — UW-15, UW-17; UF-03). This is
  **allowed-outstanding-item #2**'s remaining build phase — only enterprise
  credentials/entitlements and parallel-run reconciliation should remain
  after it lands:
  - **Persisted quote store** (`market_quotes` migration): issuer/tranche →
    DM, price, as-of, source tag. The single source for all RV analysis
    app-wide — Sector RV table, Deep-Dive RV, CP-3 peer percentiles, Command
    Center marks, Query RV walks all read this store through one read-model.
  - `MarketDataProvider` interface + chain: `BloombergProvider` →
    `ManualQuoteProvider` (analyst-entered + CSV upload, live, tested).
    Unconfigured/unreachable Bloomberg degrades to manual with an explicit
    source tag — same fault-isolation invariant as the LLM lanes.
  - **`BloombergProvider` implemented** (transport chosen with enterprise
    licensing — BLPAPI Server API/B-PIPE or HAPI REST): field mapping to DM
    inputs, request throttling, error taxonomy. Tested offline against
    recorded response fixtures; live validation is outstanding item #2.
  - **Sector RV refresh button**: manual pull → provider chain → validate →
    upsert store → table re-renders with as-of timestamp, per-row source tag,
    stale-age indicator. Server-side rate limit. The existing `credibleDm`
    plausibility guard (A4) moves into the provider chain as the validation
    stage.
  - **Settings → Market Data section**: login/API requirements documented
    in-UI; connection config (transport + credentials — admin-only under E2
    once it lands); status readout (unconfigured/configured/live/
    unreachable); test-connection button; last-refresh + quota readout.
    Credentials are secrets: E4 inventory, masked in UI, never logged.
  **Verify:** `pytest caos/tests/server/test_marketdata.py` (new) green
  against recorded fixtures; `grep -n market_quotes
  caos/server/migrations/versions/*.py` returns a hit. **Exit:** Sector RV
  refresh round-trips against the fixture-backed `BloombergProvider`, degrades
  cleanly to manual on failure; Settings Market Data section live
  (admin-gated); all RV/DM surfaces read only the persisted quote store.
- [ ] **C6 (M)** Concept-link suite: one run flows Pipeline → Deep-Dive →
  Model Builder → Report Studio with the same number identical on every
  surface; Evidence Sync cross-pane selection; click-to-source from any
  conclusion. Does not exist today (grep clean across `caos/tests/frontend/
  e2e/`). **Verify:** new Playwright spec + API assertions pass. **Exit:**
  spec green, wired into the per-PR e2e job (loop doc L7 work item).
- [x] **C7 (S) — DONE, merged to `origin/main` 2026-07-15** (PRs #187/#188;
  main-tip CI green after). *(Exec 2026-07-12: PR #187 open — registered in
  questions.ts/views.ts/synthesis.ts; backend _head_to_head() builder in
  engine/querygraph.py reuses _covenant_register's exact node shape (group +
  member nodes), zero new render machinery needed. GraphRequest.issuer_id_b
  additive. New IssuerPicker.tsx (embeddable debounced autocomplete) wired
  into query/page.tsx. Verified: 7 new backend tests green, full server suite
  1414/1414, 5 new frontend unit tests green, tsc clean, 0 new C901
  offenders. Residual: full frontend vitest suite inconclusive (machine
  contention with a concurrent session, not a real failure); query_flow.spec.ts
  extended but not run against a live stack.)* Head-to-head issuer comparison — fifth Query walk (expansion
  4.3): register in `questions.ts`/`views.ts`/`synthesis.ts` per the Query
  design mandates (synthesis sentence first, committee exhibit = charts +
  narrative); side-by-side headline `metric_facts`, covenant register rows,
  CP-3 RV percentile + CP-2B fragility. **Verify:** `npm --prefix
  caos/frontend run test -- head-to-head` (new vitest spec) +
  `npx playwright test caos/tests/frontend/e2e/query_flow.spec.ts` (extended)
  green. **Exit:** walk answers a real query end-to-end — **met; on
  `origin/main` as of 2026-07-15.**
- [ ] **C8 (M)** IC Decision Record (expansion 4.1): append-only per-issuer
  record — recommendation, conviction, thesis sentence, committee date,
  decision, dissent, link to the run/report it was based on. Surfaced on
  Issuer Profile + Command board; mutations follow the E3 audit pattern.
  Lands before F so the beta cohort dogfoods it. **Verify:** new table +
  route + UI; `pytest caos/tests/server/test_decision_record.py` (new)
  green. **Exit:** record created/read/appended through the real UI path.
  **Latest:** implemented in the current branch only; PRs #191/#192 remain
  open. Do not close until migrated and green on `origin/main`.
- [x] **C9 (S–M) — DONE, merged to `origin/main` 2026-07-15** (PRs #189/#190;
  UW-08 verified FIXED in the 2026-07-15 register delta). *(Exec 2026-07-12, merged via PRs #189/#190 on 2026-07-15 — real .xlsx client-side
  (frontend-only) chosen over backend/openpyxl: model grid/scenarios/
  assumptions are computed exclusively client-side, so a backend export
  would mean re-implementing that math in Python (undermining C9's own
  same-number-everywhere exit criterion) for no openpyxl benefit. 5 sheets
  (Model/Scenarios/Assumptions/Headline Facts/Overrides), every sheet
  stamped ORIGIN/METHOD/RUN/AS-OF. First push used `xlsx`/SheetJS (the
  plan's own suggestion) but that package's 2 unpatched High CVEs (parse-
  path only; usage here was write-only) tripped CI's `npm audit
  --audit-level=high` gate unconditionally (no allowlist mechanism) — swapped
  to ExcelJS (residual: 2 Moderate advisories in a transitive dep, under
  CI's threshold), documented + flagged in SBOM.md. Verified: real openpyxl
  round-trip done by hand against each library's output (genuine cross-tool
  interop, all 5 sheets correct both times); 13 vitest cases (same-process
  round trip) for ongoing CI; full frontend suite green, tsc/eslint clean,
  `npm audit --audit-level=high` exits 0.)* Committee-pack `.xlsx` export (expansion 4.2): the current
  export is a documented dependency-free CSV stub (`export.ts:39-45`,
  S4 Ev-7); upgrade to real `.xlsx` via `openpyxl` (already a dependency for
  ingestion reads — `requirements.txt`) on the backend, or `npm i xlsx` on
  the frontend per the stub's own comment. Model Builder scenario grid +
  assumptions + headline `metric_facts`; every sheet stamped run id + as-of.
  **Verify:** export produces a valid `.xlsx` readable by openpyxl round-trip
  test. **Exit:** C6's same-number-everywhere assertion extends to the export.
  **Latest:** PRs #189/#190 are merged to `origin/main`; this branch preserves
  that export control alongside the checkpoint-first save flow.
- [ ] **C10 (M) — worklist action semantics (UW-01–UW-03).** Decide and
  implement the real contract for issuer assign-owner/refresh/delete and the
  Sponsor primary review action. Omitted actions may stay omitted if the
  product decision is recorded; an existing action may not claim “review” if
  it only focuses a panel. Sponsor monitoring thresholds route through the
  C3 watch-rule API. **Verify:** API mutation tests plus Issuers/Sponsors UI
  tests cover success, partial batch failure, permissions, and audit rows.
  **Exit:** every named action either persists its promised state or is
  removed/renamed so no focus/navigation proxy reads as a completed review.
- [ ] **C11 (M) — persisted model scenario application (UW-07/UF-07).** Keep
  the current scenario lens, but add an explicit **Apply to model** transaction
  that previews affected cells, writes provenance-bearing overrides, forms
  one undo step, saves to the working draft, and can be captured in an
  immutable checkpoint. Reset must never erase unrelated manual overrides.
  *(2026-07-15: Model Engine v2 (migrations `0056`/`0057`,
  `routes/model_v2.py`, `model_workbook.py`) shipped exactly the substrate
  this needs — `model_drafts_v2`, append-only `model_override_events` with
  `inverse_event_id` replay/undo, checkpoint import idempotency, all
  `require_write_role`-gated. C11 = wire the scenario lens's Apply into that
  override-event path (flag `CAOS_MODEL_ENGINE_V2_ENABLED` → C14); do not
  build a second persistence mechanism. UW-07 itself re-verified STILL TRUE —
  ScenarioPanel remains session-local today.)*
  **Verify:** scenario → preview → apply → undo/redo → save → reopen →
  checkpoint restore test. **Exit:** scenario buttons are no longer a
  session-only calculation when the analyst chooses to commit them.
- [ ] **C12 (S–M) — Upload run-mode semantics (UW-23).** Decide whether
  Full analysis / Update / Primary transaction are true engine plans or
  source-manifest classifications. If they are plans, add a validated
  run-template field to `POST /api/runs`, resolve it into an immutable module
  plan, stamp it on the run, and make retry/idempotency preserve it. If they
  are classifications, remove all copy claiming they route modules. **Verify:**
  one contract/E2E case per visible mode proves the queued run's plan matches
  its label; invalid/retired modes fail explicitly. **Exit:** no selected mode
  can queue the full route while claiming a narrower/different route.
- [x] **C13 — ALL FOUR PROMISES DISPOSITIONED** (2026-07-22 complete): the
  checked-in promise map + CP-RENDER = Report Studio **equivalent-service
  executed** and CP-EXTRACT **retired** (1974eb3d, RT-775…779), CP-MON =
  the landed C3 seam (above), CP-SR = recorded Phase-1 **deferral** with
  honest unavailable states (RT-790/791; CP_SR_IMPLEMENTATION_PLAN.md ready
  for post-pilot pickup). No spec-only route promise survives unresolved.
  *Historical item text follows:* **(M) — runtime promise resolution
  (PG-06/UF-01).** Produce a
  checked-in promise map for `CP-SR`, `CP-MON`, `CP-RENDER`, and `CP-EXTRACT`.
  For each module, either implement and register it, or name the live service
  that fully owns the same user-visible contract and remove or redirect the
  spec-only route promise. A label or reference synthesis is not equivalent.
  **2026-07-20 planning checkpoint:** the current-truth
  [promise-to-runtime map](qa/PROMISE_TO_RUNTIME_MAP.md) is now checked in.
  It deliberately leaves C13 and PD-06 open: CP-SR/CP-MON are blocked,
  CP-RENDER is provisional pending an explicit equivalent-service decision and
  production-data proof, and CP-EXTRACT is a retirement candidate.
  *(2026-07-15: two map entries are now writable — **CP-RENDER**: the live
  Report Studio composition path (`routes/reports.py` preview/versions/export
  from run + model checkpoint, UW-09 FIXED) is the equivalent-service
  candidate; record it and redirect/retire the spec-only promise. **Registry
  arithmetic**: 21 implemented modules (CP-4D/CP-2G added, flag-gated) + the
  same 4 spec-only. CP-SR remains the hard case — UW-19/UW-20 unchanged.)*
  Sector Review must have a real asynchronous, source-backed refresh/publish
  path before C exits; it is not excused by X5's non-blocking expansion policy.
  **Verify:** registry/route contract test plus one production-data E2E per
  mapped promise, including degraded and empty behavior. **Exit:** no
  production control or concept claims a module whose only runtime state is
  `implemented=False`.
- [x] **C14 — PROGRAM DECISION RECORDED** (the item's own scope): the release
  ships **every flag off** — all 13 declared `*_enabled` states are `false`
  in the strict H0 manifest, which is the signed-disposition source of truth.
  The staged 0→5 pilot enablement (with its observation windows and the two
  Head-of-Research approvals) remains the post-deployment pilot program per
  APPLICABLE_UPDATES_PHASE7_RELEASE.md — by design not a pre-deployment gate.
  *Historical item text follows:* **(M — new 2026-07-15) —
  applicable-updates flag-wave disposition.**
  The five-flag wave (lineage v2 · market xlsx v2 · model engine v2 · CP-4D ·
  CP-2G) is implementation-complete, merged, and **default-off**; its staged
  enablement 0→5, per-stage entry evidence, abort triggers, and rollback rules
  live in [APPLICABLE_UPDATES_PHASE7_RELEASE.md](APPLICABLE_UPDATES_PHASE7_RELEASE.md)
  — that record stays the mechanism; this item owns the **program decision**.
  Work: (a) execute the staged enablement through its own gates on the pilot
  host, with the operator observation windows the record requires; (b) obtain
  the record's two named Head of Research / QA approvals (CP-4D, CP-2G —
  separately); (c) record the end-state **flag disposition for the transfer
  candidate** — every flag either ON (feature is then in scope for the
  "everything live" promise, its surfaces join C-phase exit checks) or
  OFF-by-decision (recorded in H3's accepted-risk register with a named
  reason, and its dark surfaces must fail closed to the compatibility UI, as
  the record specifies). H0's release manifest records the exact flag state
  it froze. **Verify:** the release record's decision boxes are signed;
  candidate compose config matches the recorded disposition. **Exit:** no
  flag's production state is an accident of the default — each is a signed
  decision, and C-phase "live" claims count flag-ON surfaces only.

**Exit gate:** `MOCK_LEDGER.md` (C1) burned to zero silent-mock and zero
unlabeled sample in prod build · C3-seam: rule → event → inbox → `InAppSink`
live end-to-end, `EmailSink` stub records intent · C5: all RV/DM surfaces
read only the persisted quote store, Sector RV refresh round-trips against
fixture-backed Bloomberg and degrades to manual, Settings Market Data section
live · concept-link suite (C6) green · C10 action semantics honest · C11
scenario application persists and round-trips · C12 selected run mode matches
the immutable server plan · C13 closes every spec-only user promise · C14
flag disposition signed (no default-off flag without a recorded decision) ·
a11y axe re-run clean on
new/changed routes (Monitor inbox especially — loop doc `design-a11y-ux`
playbook). C7–C9 are tracked here but **do not block this gate** (§14
expansion policy).

**Loops:** L7 (concept-link — work item), L8 (e2e, live per-PR), L9 (mock
regression — work item), L11 (a11y — manual per UI-phase exit), integration-
seams and llm-safety-grounding playbooks (loop doc §3) — C3-seam is a new
LLM-adjacent surface and must hold the fault-isolation invariant.

---

## 6. Phase D — Ingestion breadth

**Objective:** the ingestion funnel accepts what real analysts actually feed
it. Runs parallel to C after B. **Shrunk this grounding — D2 (RAG answer
lane) is done and moved to §1's working table.**

- [x] **D1 (M) — DONE on main via PR #183.** The real scanned-PDF golden
  exercises upload → pypdf-empty → `ocrmypdf`/Tesseract → chunk persistence
  and asserts `prov="ocr"` plus recognized values. The deploy image installs
  both native binaries. The golden skips on hosts without the binary, so H2
  must still execute the deploy-image leg rather than treating a skip as a
  fresh runtime confirmation.
- [x] **D2 (—)** ~~RAG answer lane in Query~~ **DONE.** Committed and wired
  end-to-end — see §1 working table for anchors. No further action.
- [x] **D3 (S) — DONE on main.** `test_upload_robustness.py` covers empty,
  non-PDF, lying extension, mid-read oversize, corrupt, encrypted, non-workbook,
  and zip-bomb-like containers. Every case is an explicit 4xx or a loud
  zero-chunk warning; none becomes silent success.
- [ ] **D4 (S) — partial on main.** The Issuer Profile quick-note entry point,
  vault upload/autolink path, immediate re-read, and frontend test have landed.
  Remaining exit evidence is the live manual RAG answer proving the new memo's
  chunk id is cited. The quick capture writes a tagged memo through
  `VaultMemoUpload`/`memochunks.py` without a new store or schema; the
  `analyst-notes` and `VaultMemoUpload` tests are already green. **Exit:** a
  memo logged from Issuer Profile is answerable via D2's RAG lane (confirm
  with a manual
  `POST /api/query/answer` call citing the new memo's chunk id).

**Exit gate:** scanned-PDF golden green with real-binary confirmation (D1) ·
D2 already done · upload matrix green (D3) · no ingestion path can succeed
silently with 0 chunks.

**Loops:** L10 (ingestion matrix, live-partial today, completes with D3).

---

## 7. Phase E — Enterprise hardening

**Objective:** safe to put in front of an enterprise security review.
"Functional" ≠ "safe to transfer" — this phase is the difference.

- [ ] **E1 (M) — partial on main.** `WEB_CONCURRENCY`, Postgres-gated
  multi-worker launch, advisory-lock migration safety, and a recorded
  15-user/60-second two-worker run (2,584 requests, 0 failures, p95 89 ms)
  have landed. *(Stale-text correction 2026-07-22: durable cross-worker
  claiming for the research/report executors LANDED 2026-07-12 — QueueWorker
  claim/reclaim, PR #179 — and its SKIP-LOCKED suites ran green on live
  PostgreSQL this session; the L25 capacity artifact supersedes the 60-second
  run.)* Remaining: 2×-pilot calibration only — a pilot-host activity. Already
  landed: per-analyst run cap
  (`config.py:210 caos_run_per_analyst_limit=3`, enforced `routes/runs.py:298`),
  identity-keyed rate limits across runs/vault/chat/models/digest/edgar/
  ingestion/issuers, SKIP LOCKED worker lease (`config.py:326`,
  `routes/autonomy.py:18`, `run_executor.py:248`). Missing: DB pool sizing at
  the final 2× target and a durable lease/reaper or documented single-worker
  boundary for research/report execution.
  **Verify:** `caos/server/.venv311/bin/python -m pytest caos/tests/stress`
  plus a locust run @ 2× pilot concurrency with mock-Anthropic fault
  injection; record and close what it finds. **Exit:** stress suite green at
  2× pilot concurrency with fault injection; multi-worker config committed
  and load-tested (feeds G3).
- [ ] **E2 (L — own implementation plan at pickup) — roles-lite, partial and
  not yet certified.** Verified 2026-07-15: `Analyst.role` column exists
  (`database.py:249`, default `analyst`) and `require_write_role`
  (`identity.py:71`) is enforced on **15 handlers** across
  committee/decisions/issuers/model_v2/model_workbook/portfolios/reports —
  i.e. the new-wave mutation surface is gated. Not enough to close E2:
  **legacy mutating routes (runs, vault, ratings, watchlist, settings…) carry
  no role dependency**, there are no admin-role semantics, no
  `CAOS_ADMIN_EMAILS` bootstrap (zero code hits), no assignment plane, and no
  forged-role/cookie-tamper tests. Three roles on the existing
  analyst-profile system:
  - **analyst** (default) — full workspace read/write, runs, uploads, watch
    rules.
  - **admin** — analyst rights + profile/role management + audit-log view +
    destructive ops (GDPR delete, registry reset) become admin-only.
  - **read-only** — PM/CIO view; every mutating route rejected server-side.
  Work: migration adding `role` column (default `analyst`); admin
  bootstrap via `CAOS_ADMIN_EMAILS` env (listed OIDC emails get admin on
  profile creation; empty in production = boot warning); one FastAPI role
  dependency on every mutating route (deny-by-default for read-only,
  admin-only list explicit) — UI hides what the server forbids, but the
  server is the boundary; role × route test matrix (analyst/admin/read-only
  vs. mutate/admin routes), forged-role and cookie-tamper attempts, bootstrap
  path test. **Verify:** `pytest caos/tests/server/test_roles.py` (new)
  green — includes the forged-role/cookie-tamper cases. **Exit:** role model
  enforced server-side on 100% of mutating routes; documented in the
  accepted-risk register + H3 admin guide.
- [ ] **E3 (M)** *(Exec 2026-07-12: PR #169 open — audit_log table (migration 0038) + audit.py write helper wired into every route mutating firm/shared state; GDPR erase extends its anonymize-not-delete pattern to audit_log; caught + fixed a real flush-outside-try 500-vs-409 bug in 4 routes along the way. Full suite 1417/2, one unrelated pre-existing test_retention.py failure at full-suite scale flagged as its own follow-up, not this PR's bug.)* Audit trail: append-only `audit_log` table (who/what/when/
  before→after) on every mutating route — issuer CRUD, uploads, deletes,
  rating edits, watch-rule changes, GDPR delete. Confirmed absent (no
  `audit_log` in `database.py`'s full table list). Runs already stamp
  `analyst_id`; this extends the pattern. Surface read-only in Settings.
  **Verify:** new migration + `pytest caos/tests/server/test_audit_log.py`
  (new) asserting a row on every mutating route class. **Exit:** 100% of
  mutating routes tested to write an audit row.
- [x] **E4 (S) — DONE on main.** `docs/reference/SECRETS.md` inventories and
  explains rotation for shipped secrets; `test_secret_log_hygiene.py` is
  mutation-verified and CI-wired. C5/H4 must append future Bloomberg/email
  credential names and rotation steps when those integrations exist.
- [ ] **E5 (M) — baseline pass, final rerun still required.** The 2026-07-12
  security-infra review passed all six gates with 0 new HIGH/MED findings and
  replaced the route-gate regex with an AST sweep. Keep this item open until
  the full post-C3/C5/E2/E3 diff is rerun. Already re-verified present: SSRF
  allow-list (`edgar.py:111,270`), CSP/HSTS (`test_security_headers.py`),
  GDPR-delete transactional integrity (`test_gdpr_erase.py`,
  `erase_analyst.py`). Remaining: run `/security-review` on the full diff
  since the last gate (covering C3-seam/C5's new LLM/network surfaces and
  E2/E3's new mutating routes); confirm the key safety property — no LLM
  lane has tools/writes — still holds after C3-seam lands; header-spoof +
  edge-secret checks (LAUNCH_PHASE1 §5) re-verify. CRIT/HIGH fixed, MED/LOW
  to the accepted-risk register. **Verify:** `/security-review` run recorded
  with 0 open CRIT/HIGH. **Exit:** same, plus register published.
- [x] **E6 (S) — DONE on main.** `docs/reference/SBOM.md` records locked
  backend/frontend packages, license findings, and the three accepted flags;
  no unflagged copyleft or unknown license remains in shipped paths.
- [ ] **E7 (S–M) — per-lane model routing (UW-12).** Either wire the three
  currently disabled Settings selectors into the run contract or remove the
  stored-but-inert fields from the production UI. A real implementation must
  validate an allow-listed provider/model per lane, stamp the resolved route
  on the run authority/audit record, preserve the workspace default, and fail
  closed to that default when a selected route is unavailable. **Verify:**
  Settings persistence + run dispatch tests prove each lane selection changes
  the executed route; an unavailable route produces an explicit recovery
  state. **Exit:** no permanently disabled/no-op production select remains.
- [x] **E8 — MATRIX DRAFTED 2026-07-22** ([handover/DATA_GOVERNANCE.md](handover/DATA_GOVERNANCE.md)):
  record-class custody table (vault/Postgres/browser/logs/backups), vendor
  egress matrix (EDGAR, model providers behind the proven fail-closed
  `CAOS_DOCUMENT_EGRESS_ENABLED` gate, Bloomberg-at-H4, rclone remote),
  residency/immutable-record/beta-boundary policy, standing quarterly review.
  Owner ☐ decisions (retention years, residency, DPA confirmations) complete
  at H5 with the Data Owner signature. *Historical item text follows:*
  **(M) — data governance and vendor handling (PG-07).** Create an
  approved record-class matrix for uploaded source documents, chunks and
  embeddings, run facts, prompts/model outputs, findings, committee records,
  audit rows, analyst identity data, exports, logs, and backups. For each,
  define classification, owner, purpose, retention, deletion/anonymization,
  legal-hold behavior, backup-expiry propagation, and export/access policy.
  Record Anthropic, Google OIDC, SEC EDGAR, Bloomberg, and email-transport
  data-flow/residency/DPA decisions; do not assume a vendor's default data-use
  posture. **Verify:** policy-to-control test matrix exercises expiry and
  erasure for mutable records and proves immutable/audit exceptions are
  documented and authorized. **Exit:** Data Owner and Security Owner approve
  the matrix; every exception is in H3's accepted-risk register.

**Exit gate:** stress suite green at 2× pilot concurrency with fault
injection (E1) · roles-lite implemented + tested (E2) · audit log on 100% of
mutating routes, tested (E3) · secrets runbook + grep test (E4) · security
review PASS with accepted-risk register (E5) · SBOM published (E6) · custom
model-lane routing is either live and audited or removed from production
Settings (E7) · record-class retention and vendor handling approved (E8).

**Loops:** L12 (stress — work item for weekly smoke; manual full run at
phase exits), L18 (security review — manual + live per-PR subset),
backend-api-data and security-infra playbooks (loop doc §3).

---

## 8. Phase F — Beta: build the dictionary

**Objective:** real analysts build real coverage; find the gaps only breadth
exposes. *(= DEVELOPMENT_PHASES Phase 3, unchanged in spirit — 0/5 boxes
checked there.)* Calendar-parallel with E after C+D land.

- [ ] **F1 (S) — beta/production data separation (PG-09).** Run F on an
  isolated beta environment with production-parity configuration. Sealed
  goldens and breadth-corpus fixtures remain offline test assets and are never
  inserted into the beta or production database. Reset the **beta** registry
  before cohort onboarding; production starts empty under
  `CAOS_DEMO_SEED=false` unless a separately approved cutover imports real
  pilot records. **Verify:** environment identifier and database endpoint are
  recorded; beta contains zero fixture-tagged issuers before F2; the H0
  release manifest proves production seed is off. **Exit:** beta and
  production data stores are distinct, test fixtures are absent, and any
  real-data migration has an owner, reconciliation, and rollback plan.
- [ ] **F2 (—)** Onboard 3–5 analysts; each builds their own issuers via the
  real ingestion path (upload / EDGAR-vault). Brief them on LAUNCH_PHASE1 §6
  expectations + how to read provenance. File anchor: `LAUNCH_PHASE1.md §6`
  (briefing content). **Verify:** each onboarded analyst has ≥1 profile row
  (`SELECT * FROM analysts WHERE created_at > <F2-start-date>`) and has
  completed the briefing (recorded in F2's own onboarding log — create one
  if it doesn't exist). **Exit:** 3–5 analyst profiles active, each briefed.
- [ ] **F3 (M)** Coverage + gap log: every issuer attempted → certifiable or
  categorized gap (scanned-PDF/OCR quality, IFRS mapping, covenant not
  retrievable, market data absent…). Weekly triage (L20); CRIT/HIGH fixed
  in-phase. File anchor: new `caos/docs/qa/BETA_GAP_LOG.md`. **Verify:** the
  gap log has one row per attempted issuer with a terminal status
  (certifiable/categorized-gap) and, for each categorized gap, a severity.
  **Exit:** 0 uncategorized attempts; 0 open CRIT/HIGH gap rows.
- [ ] **F4 (M)** Feedback → golden growth: any analyst-reported wrong read
  becomes a fault-log entry (`caos/docs/qa/FAULT_LOG.md` — currently 0 open /
  6 closed); the fix adds that issuer to the golden set if it exposed a new
  bug class. Golden-master must stay green throughout. **Verify:**
  `caos/server/.venv311/bin/python -m pytest caos/tests/server/golden -q`
  stays green after every fault-log-driven fix lands. **Exit:** every
  analyst-reported wrong read has a `FAULT_LOG.md` row; golden set grew by
  ≥1 issuer for each row that exposed a new bug class.
- [ ] **F5 (S)** Monitor dogfood: analysts set real watch rules (requires
  C3-seam, §5); alert relevance feedback feeds rule tuning. File anchor:
  the watch-rule table C3-seam creates (`caos/server/database.py`, once it
  lands). **Verify:** `SELECT count(*) FROM watch_rules WHERE analyst_id IS
  NOT NULL` > 0 (real analyst-authored rules, not seed data); a feedback log
  (new `caos/docs/qa/MONITOR_DOGFOOD_LOG.md`) has ≥1 entry per active rule.
  **Exit:** every onboarded analyst (F2) has ≥1 real watch rule; feedback
  captured for each.

**Exit gate:** cohort has built ≥15 issuers (3–5 each, F2/F3) · certifiable
rate ≥80% with every failure categorized (F3) · gap-log CRIT/HIGH = 0 (F3) ·
golden set grew with any new bug class (F4) · golden-master green the whole
phase (F4) · **every onboarded analyst has set ≥1 real watch rule with
captured feedback (F5)** — F5 is core beta work, not a §14 expansion item,
and is included in this gate so it cannot silently remain open once the
phase is marked passed.

**Loops:** L20 (gap-log triage, weekly during F only).

---

## 9. Phase G — Ops readiness & loops locked

**Objective:** the boring operational muscle an enterprise handover assumes.

- [x] **G1 (S) — DONE on main.** `deploy/restore_drill.sh` restores Postgres
  and vault into scratch targets, checks data, cleans up, and fails closed on
  a corrupt dump. Compose, deploy README, and launch documentation expose the
  drill; L19 retains the quarterly handover cadence.
- [ ] **G2 (S)** Error-rate alerting — dogfood Monitor: a watch rule over the
  app's own logs/health (unhandled-exception count, run-failure rate, 5xx
  rate) → alert inbox via `AlertSink`. **Depends on C3-seam existing first.**
  No paid APM (by decision). File anchor: the watch-rule table + `AlertSink`
  seam C3-seam creates. **Verify:**
  `caos/server/.venv311/bin/python -m pytest
  caos/tests/server/test_ops_alerting.py -q` (new file — trigger a synthetic
  5xx/unhandled-exception burst against a test client and assert an alert
  lands in the inbox via `InAppSink`). **Exit:** rule live, test green. This
  proves product self-observation only; it does not satisfy PG-03/G7 because
  CAOS cannot report its own total outage.
- [x] **G3 — EXECUTED as L25 on the frozen image 2026-07-22**
  ([qa/perf/PRE_DEPLOYMENT_CAPACITY_2026-07-22.md](qa/perf/PRE_DEPLOYMENT_CAPACITY_2026-07-22.md)):
  15 authenticated principals with think-time on the deploy container
  contract — 25,630-request steady stage, per-route p50/p95/p99 documented
  (interactive p95 42 ms aggregate), upload lane characterized (AV+parse
  ~5 s p95, serialized by design, does not starve reads), provider/storage
  fault legs, ~5× memory headroom; ceiling/bottleneck history = the
  remediated 320-user pool fault + three clean 300-user runs. Owner residual:
  accept the p95 targets (all met) and repeat on the named host (G9).
  *Historical item text follows:* **(M)** Load characterization: locust at enterprise-plausible
  concurrency (define with owner — e.g. 15 analysts × think-time) on
  prod-parity build; p95 targets per route class; document ceiling + first
  bottleneck. Builds on E1's multi-worker config. **Verify:** `performance`
  playbook §4(B)/(C) legs run against the isolated QA stack. **Exit:**
  documented ceiling, p95 targets met or exception filed.
- [x] **G4 (S) — DONE on main.** `docs/reference/DR_RUNBOOK.md` records the
  fresh-host recovery procedure and an isolated-host rehearsal that restored
  a real issuer from the off-host copy in 88 seconds. RPO/RTO and the risk of
  invalid remote credentials are stated explicitly.
- [x] **G5 (S)** ~~Migration safety~~ **DONE** — `test_migrations.py` already
  covers single-head, `alembic check`, and a full up/downgrade round-trip on
  both py3.11 and py3.14 CI legs.
- [x] **G6 (S)** ~~Off-host backup mechanism~~ **DONE** — the isolated
  `backup-sync` service mounts local artifacts read-only, transfers through a
  required rclone secret/config, verifies the upload, downloads the remote
  copy, and runs the real restore drill against it. Provider-side encryption,
  retention, external alert routing, and realistic-volume timing remain G8.
- [ ] **G7 (M) — independent service/host monitoring (PG-03).** From outside
  the CAOS host, probe public ingress and a deliberately minimal liveness
  signal; monitor certificate expiry and DNS. From the host/management plane,
  monitor container health/restarts, Postgres readiness/connections, queue
  age/failures, CPU/memory/disk/inodes, backup freshness, and clock skew. Route
  alerts through a channel that does not depend on CAOS, with severity,
  acknowledgement, escalation, owner, and tested delivery. Define pilot
  availability and recovery SLOs plus an error-budget/accepted-risk decision.
  **Verify:** kill app, DB, and ingress separately; fill a scratch filesystem
  past threshold; age a backup/certificate fixture; each condition alerts and
  recovery clears it. **Exit:** dated evidence names the independent monitor,
  notification target, thresholds, and responder.
- [ ] **G8 (M) — deployable backup/restore control (PG-04).** Configure a real
  encrypted off-host destination with least-privilege credentials and
  retention matching E8. Prove the latest DB and vault artifacts arrived,
  expose their age and sync result to G7, alert on failure/staleness, and
  restore from the off-host copy at realistic pilot data volume. Record the
  measured RPO/RTO and have the Data Owner accept them. **Verify:** simulate
  loss of the local `backups` volume and recover only from the remote copy.
  **Exit:** `BACKUP_REMOTE` and the protected rclone config are valid on the
  target, latest sync is green, remote restore passes, and no operator needs
  undocumented credentials.
- [ ] **G9 (M) — target-host readiness (PG-05).** File a dated host baseline:
  supported OS/Docker/Compose versions and patch level; firewall exposes only
  80/443 publicly; SSH/admin access and Docker-group membership are
  least-privilege and logged; time sync works; data volumes and off-host
  backups are encrypted with correct ownership; disk/inode headroom covers
  database, vault, OCR scratch, image builds, logs, and one restore; log
  rotation and certificate renewal are configured; reboot/restart order is
  tested. **Verify:** commands and sanitized outputs live in the H3 admin
  package. **Exit:** deploying engineer and Security Owner sign the baseline.

**Exit gate:** restore drill from off-host copy PASS (G1/G8, using G6's hook) ·
**error-rate alerting live and tested (G2)** — included in this gate for the
same reason as F5 above: it is core ops work, not a §14 expansion item, and
must not stay silently open once the phase is marked passed · DR rehearsal
PASS with stated RTO/RPO (G4/G8) · load test PASS at agreed concurrency (G3) ·
migration up/down PASS (G5, done) · independent monitoring and tested delivery
(G7) · encrypted/fresh off-host recovery (G8) · target-host baseline signed
(G9) · every loop-doc §2 loop relevant to a
landed phase has run ≥2 consecutive green cycles.

**Loops:** L13 (perf smoke), L19 (restore drill — manual + `HANDOVER` post-
transfer cadence), L21 (independent availability/host alerts), L22 (backup
freshness and off-host recovery).

---

## 10. Recurring verification — pointer

**All loop definitions, mechanism classes (LIVE / WORK-ITEM / MANUAL /
HANDOVER), and the 9-playbook scheduling table live in
[PRE_DEPLOYMENT_QA_LOOPS.md](PRE_DEPLOYMENT_QA_LOOPS.md).** Every phase
section above cites loop IDs (`L1`–`L20`) instead of restating cadence — this
is deliberate: a cadence word with no loop ID in the other document is not a
claim this program makes. If a phase exit needs a loop that doesn't exist
yet, the loop doc names it as a `WORK-ITEM` with a file anchor (almost always
`.github/workflows/nightly.yml`, itself a new file — see loop doc §5).

---

## 11. Phase H — Pre-deployment gate & handover package

**Objective:** prove the end state and package the transfer.

- [ ] **H0 — DONE except the scan-disposition signature.** Candidate frozen
  `cda106dc` → re-frozen **`3b66da67`** (config-only delta, same image
  `sha256:882efb398526…`); zero-failure strict manifest with digest override
  pinning `app` + `vault-init`
  ([strict-h0-3b66da67adea](qa/release/strict-h0-3b66da67adea/RELEASE_MANIFEST.json));
  three of four manual slots executed 2026-07-22 (restore→upgrade→boot→
  read/write rehearsal; off-host round trip + remote-only restore; PD-09
  skeleton = RELEASE_DECISION_RECORD.md). Open: owner signs
  [SCAN_DISPOSITION.md](qa/release/strict-h0-3b66da67adea/SCAN_DISPOSITION.md)
  (66/66 error-level CVEs verified no-fix). *Historical item text follows:*
  **(M) — freeze and preflight the release candidate
  (PG-01/PG-02/PG-11).**
  Cut a candidate from a clean checkout exactly equal to a green
  `origin/main` commit. Build once, record the application image digest and
  every third-party image digest, schema head, sanitized config fingerprint
  — **including the exact state of each C14 feature flag, which must match
  the signed disposition** — Modular OS manifest hash, and linked
  CI/nightly/security evidence in a release manifest. Add a deployment override/manifest that consumes the app
  as `image@sha256` (and resolves third-party tags to recorded digests), so the
  target host loads or pulls the candidate without rebuilding source. Scan the
  **final OCI image** (including OS packages) and
  disposition every critical/high finding. Against a recent restored copy of
  the target database, rehearse upgrade from its actual Alembic revision,
  application boot, critical reads/writes, and the chosen rollback/forward-fix
  path. Immediately before H1, take and verify a fresh off-host DB+vault
  backup and record migration abort thresholds. **Exit:** deploy and rollback
  both name immutable digests; no build occurs from a dirty tree; the
  candidate schema and last-good compatibility decision are signed.
- [ ] **H1 (M)** Full [LAUNCH_PHASE1 §5](LAUNCH_PHASE1.md) checklist on a
  prod-parity host using H0's exact image digest, every box, no skips. Update
  stale checklist counts rather than copying them into the evidence record.
  *(2026-07-22: **rehearsed box-by-box on the frozen digest** —
  [qa/H1_REHEARSAL_2026-07-22.md](qa/H1_REHEARSAL_2026-07-22.md); every
  mechanically-checkable row green incl. EDGAR-live, identity gates,
  durability, hardening, backup drill; four OWNER rows named: OAuth
  sign-in/domain, Caddy strip leg, HSTS-at-edge, host encryption. Residual =
  the verbatim repeat on the named target host.)*
- [x] **H2 — GREEN + ARCHIVED 2026-07-22**: CI run 29917558055 on the frozen
  code (9 jobs incl. the complete three-browser E2E and the image resource
  probe) + dispatched Nightly 29929720671 (golden E2E both lanes, hermetic
  backend regression, concept manifests, 300-issuer load smoke) + CI
  29934546964 green on the re-frozen tip — all links bound in the strict
  manifest. *Historical item text follows:*
  **(S)** Full regression stack green on that build in one sweep:
  golden-master + golden E2E + concept-link + e2e + stress + a11y + perf +
  ingestion matrix. Reuses the `workflow_dispatch:` trigger the loop doc's
  `nightly.yml` work item adds (§5 there) — one CI dispatch, results
  archived. **Verify:** the dispatched run's summary. **Exit:** all green in
  one archived run.
- [x] **H3 — PACKAGE COMPLETE 2026-07-22** ([handover/INDEX.md](handover/INDEX.md)):
  admin guide, analyst onboarding, support model + named handover loops,
  accepted-risk register (10 rows, signatures at H5), cutover run sheet,
  monitoring inventory, data-governance matrix, OpenAPI export (139 routes /
  178 operations — matches the surface matrix), SBOM/manifest/scan links;
  owner-fill cells (names, ☐ decisions) complete at H5. *Historical item
  text follows:* **(M)** Handover package (`caos/docs/handover/`, S4 Ev-9):
  - Architecture overview (refresh README/docs to as-built)
  - Admin guide: deploy, env/secrets inventory (names, not values), rotation
    runbook (E4), backup/restore (G1), DR (G4), scaling notes (G3), role
    assignment procedure (E2)
  - Analyst onboarding guide (from F briefings)
  - OpenAPI export + endpoint inventory
  - SBOM/license report (E6)
  - Release manifest, migration/rollback evidence, host baseline, monitoring
    inventory, and cutover run sheet (H0/G7/G9/H7)
  - Data-governance/vendor-handling matrix (E8), including retention, legal
    hold, backup expiry, residency/DPA decisions, and immutable-record policy
  - Accepted-risk register (E2/E5/E8 and availability/RPO/RTO decisions, signed)
  - Support model: issue intake, triage SLA, release cadence — this is also
    where the `HANDOVER`-class loops (quarterly security review, quarterly
    restore drill) get a named owner post-transfer.
  **Verify:** a dated handover index enumerates every artifact above and each
  link resolves; do not use a brittle file-count assertion. **Exit:** package complete; PM/CIO can execute
  the H5 sign-off from it without asking a follow-up question.
- [x] **H4 — BOTH PACKAGES TRANSFER-READY 2026-07-22**:
  [reference/EMAILSINK_SPEC.md](reference/EMAILSINK_SPEC.md) (MS Graph
  primary + SMTP variant, named auth/rate-limit/failure taxonomy, 4-step
  test plan, anchored on the proven C3 render-intent contract) and
  [reference/BLOOMBERG_ACTIVATION_RUNBOOK.md](reference/BLOOMBERG_ACTIVATION_RUNBOOK.md)
  (licensed-transport decision table, build-on-`market_snapshots` order,
  parallel-run reconciliation, rollback = provider-chain fallback). Both
  reviewable by enterprise IT/licensing with no CAOS-side follow-up.
  *Historical item text follows:*
  **(S)** The two outstanding-item activation packages, transfer-ready.
  **Rescoped 2026-07-22:** Bloomberg is now build-and-activate at this step
  (no connector is built pre-deployment — C5 rescope, RT-2026-07-22-789); the
  C5 section body above is the build specification enterprise work starts
  from:
  - `EmailSink` adapter spec: SMTP + MS Graph variants; auth, rate limits,
    template rendering already proven by the stub's outbox records (C3-seam);
    test plan.
  - **Bloomberg activation package** (build + activate with enterprise):
    licensed transport decision and official SDK/API documents first
    (SAPI/B-PIPE or HAPI; EIDs; network path), then the C5-spec provider
    chain, Settings Market Data section, and credential entry
    (test-connection green), then the **parallel-run reconciliation** —
    Bloomberg vs. manual marks on golden issuers, material diffs explained
    and signed off before cutover (DEVELOPMENT_PHASES Phase 5 is executed
    by/with enterprise, never flip-the-switch). Rollback = provider chain
    falls back to manual/fixed snapshots.
  **Verify:** `caos/docs/reference/EMAILSINK_SPEC.md` and
  `caos/docs/reference/BLOOMBERG_ACTIVATION_RUNBOOK.md` (both new) exist,
  each with a named transport decision and a test plan. **Exit:** both
  packages reviewable by enterprise IT/licensing without further CAOS-side
  work.
- [ ] **H5 (S)** Sign-off (table below). **Verify:** each row's "Sign-off"
  cell is filled with a name + date, not blank. **Exit:** all rows
  signed.

| Role | Gate | Sign-off |
|------|------|----------|
| Deploying engineer | H1 + H2 green | |
| Head of Research / QA | golden set + gap log + CP-5 gate | |
| PM / CIO | accepted-risk register + the two named outstanding items | |
| Security / Platform owner | H0, G7, G9, E5 and incident path | |
| Data owner | E8 policy, G8 RPO/RTO and production-data boundary | |
| Support owner | H7 cutover, escalation and handover loops | |

- [ ] **H6 — EXECUTED TO THE PERSONA LINE 2026-07-22**
  ([qa/H6_UAT_MATRIX_2026-07-22.md](qa/H6_UAT_MATRIX_2026-07-22.md)): every
  machine-checkable case ran live on the digest (EICAR-in-valid-PDF → named
  422 malware rejection with no vault write; non-PDF 400; ghost-issuer 404;
  tampered cookie 401; empty/vendor-down/provider-fault rows) and the
  viewport/zoom/keyboard/browser rows bind to the zero-finding PD-10 and
  three-browser matrices. Open: the three persona walkthroughs (analyst,
  PM/CIO, Research/QA) executed and signed on the target. *Historical item
  text follows:* **(M) — persona-critical UAT (PG-08).** On H0's immutable candidate,
  execute a signed matrix for: analyst issuer onboarding → evidence-backed run
  → Deep-Dive/model/report/decision; PM/CIO portfolio posture, changes,
  committee pack and read-only behavior; Research/QA source tracing, CP-5
  restriction, ratification, audit and correction. Include empty, partial,
  vendor-down, stale-market, auth-expiry, failed-upload, failed-run, narrow
  viewport, 200% zoom, keyboard, print/PDF/XLSX, and supported-browser cases.
  Reference data must remain visibly reference-only and cannot satisfy a live
  case. **Exit:** all critical cases pass or carry a signed accepted risk with
  workaround and owner.
- [ ] **H7 — MECHANICS REHEARSED 2026-07-22**
  ([qa/H7_CUTOVER_REHEARSAL_2026-07-22.md](qa/H7_CUTOVER_REHEARSAL_2026-07-22.md)):
  timed digest-pinned deploy (14 s to healthy), pre-cutover backup, forced
  abort of a fail-closed bad cutover, and a **36-second** rollback to the
  last-good digest with the pre-cutover state verified present. Open: the
  names (deployer, migration owner, chair, rollback owner, rota), analyst
  comms, and the timed repeat on the target. *Historical item text follows:*
  **(S) — cutover, abort, communications, and hypercare (PG-10).** Name
  the change window, freeze point, deployer, migration owner, go/no-go chair,
  rollback decision owner, analyst notification, status channel, success/error
  thresholds, observation period, and support rota. Rehearse the timed run
  sheet on prod-parity, including one forced abort and restoration of the
  last-good digest/data state. **Exit:** contacts acknowledge the plan and
  hypercare ends only after the agreed stable window and evidence review.
- [x] **H8 — LEDGER GENERATED, ZERO OPEN ROWS 2026-07-22**
  ([qa/H8_CLOSURE_LEDGER_2026-07-22.md](qa/H8_CLOSURE_LEDGER_2026-07-22.md)):
  every blocking PD/H/G row is CLOSED with a dated artifact or OWNER with its
  artifact ready; C7–C9/§14 expansion stays visible and non-blocking; the
  re-freeze addendum binds the ledger to candidate `3b66da67`. *Historical
  item text follows:* **(S) — blocker-only closure ledger (PG-12).** Generate a final table
  of every blocking A–H item plus PG-01…PG-12 with status, evidence link,
  owner, and accepted-risk reference. C7–C9 and §14 expansion items remain
  visible but explicitly non-blocking. **Exit:** zero blocking rows are open
  or evidence-free; no readiness conclusion depends on counting every
  Markdown checkbox in this mixed program/backlog document.

**Exit gate = pre-deployment reached:** every phase gate A–G passed
(including F5's dogfood row and G2's alerting row above, so no unlisted item
survives outside the two named seams) · H0 release candidate frozen and
preflighted · H1/H2 green · handover package
complete (H3) · both outstanding-item packages ready (H4) · H5 signed ·
persona UAT signed (H6) · cutover/hypercare rehearsed (H7) · blocker ledger
closed (H8) ·
outstanding items = exactly two: the `EmailSink` adapter (spec'd) and
Bloomberg activation (connector built; runbook ready). **Verify:** H8's
blocker-only ledger has zero open/evidence-free rows. Do not use a raw checkbox
grep: this document deliberately retains non-blocking expansion work.

---

## 12. What an app like this is expected to have — coverage map

Senior-engineer expectations for an institutional numbers platform, mapped so
nothing is missing by omission. "By design" links to a recorded decision.

| Expectation | Status today | Covered by |
|-------------|--------------|-----------|
| SSO / domain-restricted auth | ✅ oauth2-proxy + Google OIDC | exists; enterprise IdP = transfer config (H3) |
| In-app identity / profiles | ✅ analyst profiles, signed cookie | exists |
| Authorization model | ⚠️ `Analyst.role` + `require_write_role` on 15 new-wave handlers (verified 2026-07-15); legacy mutating routes, admin semantics, bootstrap all absent | **E2 — prove deny-by-default coverage** |
| Audit trail | ⚠️ runs/decision events only; firm-wide append-only log is not on main | E3; PR #169 remains open |
| Rate limiting / abuse caps | ✅ per-analyst run cap + identity-keyed limits | E1 closes multi-worker gap |
| Secrets management + rotation | ✅ fail-closed + shipped rotation/log-hygiene runbook | E4 done; append future market/email credentials in C5/H4 |
| Dependency scanning | ✅ Dependabot + policy | A5 + L14 loop |
| Malware scanning on upload | ✅ clamav | exists |
| SSRF / egress control | ✅ allow-list | re-verified E5 |
| Security headers / TLS | ✅ Caddy + CSP/HSTS | re-verified H1 |
| Pen-test style review | ⚠️ 2026-07-12 baseline pass; final-diff rerun outstanding | E5 + loop doc L18 |
| SBOM / license compliance | ✅ shipped report; no unflagged non-permissive license | E6 done |
| Backups | ⚠️ daily local + optional off-host mechanism; target configuration/freshness/encryption not yet proven | G6 mechanism; **G8 deployment control** |
| Restore drills | ✅ scripted and real failure path verified | G1 done; quarterly L19 cadence |
| DR / host-loss plan | ✅ fresh-host runbook rehearsed from off-host copy | G4 done; H2 final-build rehearsal |
| Observability (logs) | ✅ structured, contextual | exists |
| Product self-alerting | ❌ (depends on C3-seam) | G2 |
| Independent uptime/host/backup alerting | ❌ | **G7/G8; L21/L22** |
| APM | ❌ **by design** (no paid services) | recorded decision |
| Load testing | ⚠️ 15-user/2-worker run passed; 2× pilot calibration remains | E1, G3 |
| Migrations discipline | ⚠️ generic up/down tests pass; actual-target preflight and release rollback decision remain | G5 + **H0** |
| Graceful LLM degradation | ✅ fault isolation by construction | exists; re-proven at each LLM-surface phase exit |
| Market-data integration | ⚠️ merged: immutable `market_snapshots` store + authz-gated XLSX import lane (flag-off, C14); no provider chain/refresh/Settings, consumers still reference-only | C5 builds on the 0055 store; H4 activation w/ entitlements |
| Monitor alert seam | ⚠️ run-terminal `notification_events` + feed merged (0058); no watch-rule/sink/email pipeline, Monitor UI still fixture-backed | C3-seam; H4 EmailSink activation |
| Data retention / legal hold / backup expiry | ⚠️ run-fact pruning exists; record-class governance is incomplete | **E8/H3** |
| GDPR delete | ✅ transactional | re-verified E5 |
| Empty/error/degraded states | ⚠️ explicit shared state contract shipped; reference/live route gaps remain | C4 plus UW/UF register |
| Accessibility | ✅ latest local sweep: 0 serious/critical axe findings on 15 routes | rerun on immutable H1 build; loop doc `design-a11y-ux` |
| i18n | ❌ **by design** — single-desk English product | note in H3 |
| Multi-tenancy | ⚠️ mechanism exists (config-gated, off) but **by design** default is one shared team | SECURITY §2, H3; `tenancy.py` |
| API documentation | ✅ OpenAPI | exported H3 |
| Immutable release / image provenance | ❌ | **H0** |
| Target-host hardening and capacity | ❌ as a signed release artifact | **G9/H3** |
| Runbooks (deploy/rollback) | ⚠️ LAUNCH_PHASE1 exists; immutable-digest and production-schema rehearsal remain | **H0/H1/H7** |
| Persona-critical UAT | ❌ formal signed matrix | **H6** |
| Cutover/change communications/hypercare | ❌ | **H7** |
| User onboarding docs | ⚠️ §6 briefing only | H3 guide |
| Support/maintenance model | ❌ | H3 |
| Feature tracking / QA ledger | ✅ 355/355 `Pass` | A7b done; per-phase sweeps keep it current |
| Regression corpus (exact) | ✅ 3 sealed goldens | grows in F + via B5 promotion |
| Test corpus (breadth) | ⚠️ selection delivered (61 issuers), 0 fixtures captured | B5 |

This table covers *platform/ops* expectations. The **product-capability**
expectation map (analyst-workflow lifecycle: screen → analyse → model →
decide → monitor → compare → distribute) lives in
[FEATURE_IDEATION_2026-07-03.md](FEATURE_IDEATION_2026-07-03.md) §3, with its
open items tracked as §14 expansion backlog here.

---

## 13. Ways of working (applies to every phase)

- **Gates are hard.** CRIT/HIGH block exit; MED/LOW get tracker rows, not
  heroics. Do not chase perfection past a gate.
- **One implementation plan per L item** (B5, C3-seam, C5, E2) written **at
  pickup**, in plan mode, output to `docs/superpowers/plans/` following the
  existing convention in this repo — this document stays at program altitude.
- **TDD default** on engine/API work; UI work ships with its E2E/a11y checks
  in the same PR.
- **Impact before edit, `detect_changes` before commit** (GitNexus, per
  CLAUDE.md — non-negotiable).
- **Frequent small merges to `main`;** long-lived branches are how the A0
  incident happened (§15) — never commit code that references still-
  uncommitted implementation files; land features as one coherent commit or
  stack, not committed-refs-ahead-of-files.
- **Freeze once, build once, promote by digest.** H0 is the point where normal
  small-merge flow stops for the candidate. Any code, dependency, migration,
  prompt, config-contract, or deploy-asset change after H0 creates a new
  candidate and invalidates H1/H2/H6 evidence tied to the prior digest.
- **Production never contains regression fixtures.** Goldens, breadth corpus,
  sample sleeves, and reference workspaces remain test/reference data; F uses
  an isolated beta environment and H0 proves demo seed is off.
- **Docs lie until reconciled** — status claims come from code/tests, not
  trackers; per-phase sweeps (L15) keep them honest.
- **Confidence and goal audits at every phase exit** (L16, L17) — a
  fresh-context review thread re-grounding this plan's status claims and
  scope against the live code before calling a gate closed; see loop doc
  L16/L17.
- **Re-estimate at each gate.** The sizes in §2 are planning aids, not
  commitments.

---

## 14. Expansion backlog — product-capability items

Source: [FEATURE_IDEATION_2026-07-03.md](FEATURE_IDEATION_2026-07-03.md)
(§ numbers below) + the PM review of 2026-07-03. **Policy unchanged from
prior grounding: expansion items are MED by rubric — they never block a
phase exit gate.** The in-phase ones ride their host phase and carry an
*(expansion 4.x)* tag: C2 (maturity wall, screener filters), C3-seam
(out-of-bounds DM jump rule, peer-outlier signal, `news` enum reservation,
filing calendar, digest-as-sink-consumer), **C7–C9**, **D4**. The rest queue
here with a named unblocking event — none is scheduled by default.

- [ ] **X1 (M–L, own plan)** Amendment / credit-agreement diff (4.5) —
  deterministic redline + structured covenant-term delta. **Unblock:** D1
  (OCR) + F-phase evidence that register extraction is reliable on
  amendments.
- [ ] **X2 (M)** Terms-vs-precedent benchmarking (4.6) — basket/add-back
  looseness percentiled against the register corpus. **Unblock:** F exit
  (≥15-issuer corpus).
- [ ] **X3 (M)** Covenant compliance calendar (4.6b) — cert due/test dates.
  **Unblock:** register date-field extraction proven reliable in the F gap
  log.
- [ ] **X4 (M)** Analyst call tracking / hit rate (4.8). **Unblock:**
  post-transfer real marks (Bloomberg cutover, outstanding item #2). C8's
  timestamps make this retroactive from day one.
- [ ] **X5 (L, own plan)** Advanced cross-sector dashboards and benchmarking
  beyond C13's production Sector Review contract (4.10). **Unblock:**
  post-transfer (needs F breadth **and** real marks). CP-SR's core
  source-backed refresh/publish promise is blocking C13 work and may not be
  deferred here.
- [ ] **X6 (M–L, own plan)** Actionable-intel lane. **Unblock:** C3-seam
  (alert schema + inbox) — **now unblocked once C3-seam lands**, still
  unscheduled by default.
- [ ] **X7 (L, vendor + integration)** Intel transport (automated inbound
  half of X6). **Unblock:** Phase-2 vendor feed decision (PHASE2_SCOPE §B).

### Query concept-data collection (gap audit 2026-07-04)

**Shipped (Phase-C Query walks, no migration):** covenant register cross-
issuer walk, sponsor/counterparty graph — both live in `questions.ts`/
`views.ts`/`synthesis.ts`.

**Backlog — concept artifacts Query still should collect:**

- [ ] **X8 (M)** Deep-research reports → Query. **Unblock:** D2 — **now
  satisfied** (D2 shipped this grounding window); unblocked, unscheduled.
- [ ] **X9 (M)** Saved models/forecasts → Query. **Unblock:** none technical
  — queue behind C7 so the model-vs-model view lands once.
- [ ] **X10 (S–M)** Archived deliverables → vault. **Unblock:** none — ride a
  Report Studio export change (natural pairing with C9).
- [ ] **X11 (M)** Digest history snapshots. **Unblock:** C3-seam
  digest-as-sink work.
- [ ] **X12 (M)** Promote graph expansion from a measurement harness into
  production retrieval. **Unblock:** prove the staged expansion improves
  answer quality within the latency/token budget; then integrate it with
  `retrieve_corpus` behind a kill switch and regression corpus.
- [ ] **X13 (M)** Vault peer/sponsor identity edges. **Unblock:** CP-1C and
  sponsor extraction must persist evidence-backed entity identities rather
  than aggregate counts; export only source-linked, canonicalized edges.
- [ ] **Market-spread RV / `market_quotes`** — tracked: **C5** (store) +
  **X5** (sector dashboards); Bloomberg = outstanding #2, post-transfer.

---

## 15. Program history (compact)

- **2026-07-03:** Initial full grounding; 33-issuer corpus selected;
  Bloomberg-in-plan (C5) and roles-lite (E2) product decisions recorded.
- **2026-07-08:** Working-branch grounding found **five P0 blockers (A0)** —
  commits landed referencing still-uncommitted implementation files (main.py
  importing untracked `routes/autonomy.py`; alembic chain gap; pgvector
  imported-not-declared; prod DB missing the vector extension; 3 red tests).
  Root cause: features committed ahead of their own files.
- **2026-07-08 → 2026-07-11:** All five A0 items resolved on `main` — verified
  this session by direct code inspection (autonomy routes/migrations
  committed and tested, pgvector declared + extension-created migration
  present, suite green). The A0 incident is the source of the "frequent
  small merges" rule in §13 — do not repeat the pattern.
- **2026-07-11 (this document):** Full re-grounding against `origin/main`.
  Corrected several stale claims in both directions: flipped **DONE** where
  the prior plan under-credited shipped work (A7, B3, D2, G5, G6); flipped
  **the two allowed-outstanding items from "seam built, transport pending"
  to "seam entirely unbuilt"** (C3-seam, C5) — the single largest correction,
  since it changes what "only two items outstanding" actually requires;
  corrected dependabot count from 2 to 12; split the monolithic plan into
  three documents (this one, the QA loop doc, the skills shortlist) to keep
  status and mechanism claims from drifting independently, which is how the
  "nightly loop" cadence claims went stale the first time (no `schedule:`
  trigger ever existed in `ci.yml`).
- **2026-07-12:** `origin/main` advanced to `14cb9c53` (merged #165 D4-stamp,
  #167 C1/E4/E6-stamp — those items' exec-notes above are current as of that
  SHA). Live dependabot re-check: 2 open (#139, #140), not 12 — confirms A5's
  same-day merge narrative. Separately, this update was written from an
  **unmerged working branch**, `feat/design-rebuild-p1` (15 commits ahead of
  `origin/main`, plus uncommitted WIP) — a P1-WP/P2-WP design-rebuild
  initiative not yet reconciled into the A–H phase-letter structure. It
  contains real, concrete progress on C3-seam's alert-inbox/persistence
  bullets (`alert_states` migration, live `AlertInbox` UI, `useAutonomyDraft`
  wiring) but **not** the `AlertSink`/`EmailSink` interface itself, and the
  branch's test suite is **currently broken** (22 failed / 319 errors on
  `.venv311`) under in-flight WIP touching core server files — not a
  deploy-ready state. See the "2026-07-12 update" block after the Trunk
  state table for the full delta. **Next full grounding should**: (a)
  reconcile the P1-WP/P2-WP commits against the phase-letter structure once
  merged, (b) re-run the suite clean once the WIP settles, (c) decide whether
  the branch's direct alert-inbox approach supersedes or complements the
  `AlertSink`/`EmailSink` interface C3-seam specifies.
- **2026-07-15 (this reconciliation):** A8 executed against
  `codex/112@76daeecf` (= `origin/main@0b00b21a` + 3 inventoried commits),
  clean tree, suite 1821/9, main-tip CI green again. C7/C9 merged and
  closed; UW-04/UW-08/UW-09 verified FIXED (Command sample sleeve gone,
  ExcelJS export, live report composition); UF-05/UF-12/UF-14 closed. The
  34-commit applicable-updates wave (migrations 0052–0059, five default-off
  flags, own release record) recognized as untracked scope → **C14 added**
  to own flag disposition; C5/C11/C3-seam re-anchored onto the wave's
  merged stores (`market_snapshots`, `model_override_events`,
  `notification_events`) with explicit do-not-duplicate instructions; E2
  narrowed to its true residual (legacy routes, admin semantics, bootstrap).
  Historical coverage verdict (superseded by the 2026-07-18 PD/L23–L27
  expansion): the A–H + PG-01…12 + L1–L22 structure covered the then-known
  pre-deployment goal; the gaps were **stale facts and the unowned flag
  wave**, both corrected there. Critic pass RT-2026-07-15-270…273.
