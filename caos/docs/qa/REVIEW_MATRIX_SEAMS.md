# Cross-Stack Seam Review Matrix — frontend ↔ server

Bootstrap 2026-07-04 on `feat/query-route-fast-lane` @ dbf69a05, working tree
as-is (user WIP present and audited in place: staged `command/page.tsx` +
`command/views.tsx`, unstaged `SectorRV.tsx` + 3 query files — all
honesty-neutral or honesty-positive, see SEAM-2 checked-clean).
Report-only: findings recorded here; no fixes applied in this pass.

Method: SEAM-2 audited first, inline by main thread (highest risk); SEAM-1/3/4
by 3 read-only subagents (goal cap: max 3), then **every** subagent finding
adversarially re-verified inline against the cited lines before entry — legs
that could not be reproduced were excluded (see UNPROVEN). Severity HIGH / MED /
LOW, right-sized per the house rule (agents inflate severity). Nothing below is
listed on agent authority alone.

## Rollup — review complete (all 4 seams, 2026-07-04)

| Seam | Scope | Status | New findings | Verified | Notes |
|---|---|---|---|---|---|
| SEAM-1 API contract parity | `lib/api.ts` (+ stray fetches) vs `server/routes/*`; 42/42 tracker claim | **audited** | 2 (1 HIGH, 1 MED) | yes (inline re-verify) | Shape parity is otherwise excellent — 20+ endpoint pairs field-checked clean. The HIGH is a third `/api/query/nl` response mode the frontend cannot represent. 42/42 is stale on both axes. |
| SEAM-2 mock-vs-live honesty | every seeded-mock surface; ATLF-fabrication guard | **audited** | 2 (2 MED) | yes (inline, self-adversarial) | Guard HOLDS server-side (3 layers, 3 dedicated tests). Gaps are downstream: query-lane + peer-benchmark consumption of `demo_fixture`. Known honesty HIGHs FE 4.2/4.3 still open; **FE 8.2 FIXED+guarded 2026-07-04** (see SEAM-2 note — `report-provenance.test.tsx`). |
| SEAM-3 error-surface parity | backend error/404/422 shapes vs frontend error surfaces | **audited** | 10 (2 MED, 8 LOW) | yes (inline re-verify) | Systemic pattern: the 422 list-shaped `detail` is handled correctly at 3 sites and crashes/garbles at the rest; plus a family of silent catches that render failure as empty/stale/mock. |
| SEAM-4 auth seam | edge proxy → signed cookie → analyst_id stamping; frontend session | **audited** | 5 (1 MED, 4 LOW) | yes (inline re-verify) | Server chain battle-hardened (BE-7 confirmed again). The seam defect is client-side: mid-session identity loss is invisible to the frontend. Register SSO-bind question CLOSED for the reference deploy. Roles-lite: not implemented (matches DECIDED-not-built plan). |

**Totals: 19 new verified findings — 1 HIGH, 6 MED, 12 LOW.**

**Fix status (2026-07-04) — every HIGH + MED closed or actively owned; 10 fixed:**

| Finding | Sev | Status |
|---|---|---|
| SEAM1-1 | HIGH | **FIXED** — synthesis-mode crash; hand-ported in-tree at `122c8fb5` (also on `claude/vigilant-panini-735ad4` @ `06bc6439`) |
| SEAM2-1 | MED | **FIXED** — backend caveat `7254fdc8` + frontend FABRICATED badge/colour `dd684b60` |
| SEAM2-2 | MED | **FIXED** — `_peer_facts` excludes `demo_fixture` (`7254fdc8`) |
| SEAM3-1 | MED | **owned by chip `task_762cc182`** (422 list-detail guard + research maxLength) |
| SEAM3-2 | MED | **owned by chip `task_762cc182`** (422 guard + New-Issuer maxLength) |
| SEAM4-1 | MED | **blocked** on chip 2's `api.ts` edits — axios 401/identity-drift interceptor; wire once chip 2 lands |
| SEAM3-6 | LOW | **FIXED** — issuer search failure shows a distinct error, not a silent empty (`63a14d36`) |
| SEAM4-2 | LOW | **FIXED** — bytes-mode code compare (`2197a600`) |
| SEAM4-4 | LOW | **FIXED (issuer half)** — `issuers.created_by` (mig `0023`) stamped from caller (`d4c69057`) |
| SEAM4-5 | LOW | **FIXED** — sign-out button retryable on failed logout (`cea4a2b1`) |
| SEAM1-2 | MED | **open (report-only)** — 6 endpoints untracked in FEATURE_TRACKER.csv; tracker-sweep owns the 16-col + scenario-set authoring (CRLF, binary-mode) |
| SEAM3-3, 3-5, 3-7 | LOW×3 | **open (report-only)** — silent-catch surfaces in files chip 2 / the adversarial-review session are actively editing (deferred to avoid merge churn) |
| SEAM3-4, 3-10 | LOW×2 | **deferred to chip 2** — both `api.ts` (poll status-code + `exportReport` dict-detail); fold into chip 2's `toErrorMessage` work |
| SEAM3-8, 3-9 | LOW×2 | **open (report-only)** — swallowed graph-refresh redraw (link is persisted; reload shows it) + a *deliberate* 429→keyword degrade; messaging is a query-lane UX call |
| SEAM4-3 | LOW | **open** — SSO-bind pre-squat residue in edge-secret-only deploys; needs a design decision (refuse password-reg with no proxy identity) |

Commits by this review (fast-lane): `7254fdc8`, `dd684b60`, `2197a600`,
`cea4a2b1`, `d4c69057`, `63a14d36` (+ matrix docs). SEAM1-1 = `122c8fb5`
(parallel adversarial-review pass).

Adjudicated-accepted register honored (never re-flagged): single-team IDOR ·
XFF rate-key spoof · global login-bucket self-DoS · edge-secret-trust ·
demo/mock seams by design (seed universe) · PERF-2 bundle.

---

## SEAM-1 — API contract parity (audited 2026-07-04)

Inventory: backend **53 logical endpoints** (58 decorated — `""`/`"/"` aliases on
issuers GET+POST, portfolio, sponsors; `/vault-exhibit` ≡ `/vault-url`), all
prefixed via `main.py:262-277` + catch-all `/api/{path}` 404 at `main.py:284`.
Frontend calls **40** distinct endpoints, all through `lib/api.ts` — zero stray
`fetch(`/`EventSource(` anywhere else in `src` (grep-verified). 3 api.ts wrappers
have no UI consumer (`createProfile`, `exportReport`, `getMetricCatalog` — all
fallow-marked). Backend-only set (digest, sponsors ×2, cross-default, edgar
search/filings/exhibits, documents, DELETE profile, health) is consistent with
the covenant-register frontend living on unmerged `feat/covenant-frontend`.

| id | sev | frontend | backend | defect + failing scenario |
|---|---|---|---|---|
| SEAM1-1 | **HIGH → FIXED 2026-07-04** | `lib/query/types.ts:89` (result union = Structured\|Semantic only); `components/command/NlQuery.tsx:332-345` (`barSpecFor(res)` runs for every result; only `"semantic"` branches to SemanticView); `lib/query/viz.ts:27-36` + `:55-63` (`barSpecFor`/`narrate` null-guard only `mode==="semantic"`, then call `res.columns.find` unconditionally) | `nlquery.py:741-747` (returns `mode:"synthesis"`, `rank_by:null`, **no `columns` key**); reachable keyless via `_demo_plan` `nlquery.py:207-211` — `_SYNTHESIS_WORDS` `:185-188` substring-routes "finding", "qa", "module", "claim", "verdict", "consensus"… | POST `/api/query/nl` has a third response mode the frontend cannot represent. Analyst types "show the QA findings for Atlas Forge" (any question containing "qa"/"finding"/"module"/"claim" — core desk vocabulary) into the Command Center Ask panel → backend returns `mode:"synthesis"` → `barSpecFor` throws `TypeError: Cannot read properties of undefined (reading 'find')` during render → route error boundary replaces the **whole Command Center**. Deterministic; no key, no data prerequisites. Verified all four legs inline. |
| SEAM1-2 | MED | (claim, not code) — asserted at `caos/docs/PRE_DEPLOYMENT_PLAN.md:82` and in the tracker | `FEATURE_TRACKER.csv` endpoint column vs the 53 live routes | "42/42 endpoint parity" no longer describes this branch: backend is 53 logical endpoints, frontend calls 40, and **six endpoints appear nowhere in the tracker** (GET /api/digest/daily, GET /api/sponsors/, GET /api/sponsors/{sponsor}, GET /api/issuers/{id}/cross-default, POST+GET /api/qa/flags — grep 0/6, verified) — so no scenario sets exist for them and the parity figure would mask the gap in the next sweep. Tracker not modified (CRLF; report-only). |

Checked clean (each pair verified request-fields ⊆ backend model AND
response-fields-read ⊆ backend payload, file:line both sides): run
create/list/get/module/qa (`api.ts:199-212` ↔ `runs.py:64-66,181,221-297`;
DTOs exact subsets, backend-extra `analyst_id`/`tokens_used` unread) · vault
export `{written, vault_dir}` · uploads (document/pricing/memo FormData =
ingestion Form params) · EDGAR vault-url · full query concept
(graph/route/overlay/links/chunk — `lib/query/graph.ts` mirrors
`querygraph.py:210-213`, overlay `capability_id` present in all three return
paths, `AcceptLinkRequest`/`AcceptedLink`/`ChunkDTO` exact) · auth bodies +
`MeResponse` · issuer create/list/profile (incl. `earnings:{}` guarded via
`?? EMPTY_EARNINGS`) · portfolio · chat · scenario · research brief/poll/progress
· settings · qa flags · saved model (GET-null handled) · trailing-slash seam
(both forms registered; catch-all can't shadow).

### Fix pass — 2026-07-04 (commit `06bc6439`, branch `claude/vigilant-panini-735ad4`, TDD)

**SEAM1-1 FIXED** — the frontend now represents the `synthesis` mode instead of
crashing. Root cause was the `barSpecFor`/`narrate` guard: both treated *anything
not `"semantic"`* as structured and dereferenced `res.columns`, so the
columns-less `synthesis` payload threw during render.

- `lib/query/types.ts` — added `SynthesisResult` (`mode:"synthesis"`,
  `rank_by:null`, `rows: SemanticRow[]`, `caveats`) to the `NlQueryResult` union.
  Reuses `SemanticRow` — the backend `synthesis` row shape (issuer/score/excerpts,
  `nlquery.py:741-747`) is identical to `semantic`.
- `lib/query/viz.ts` — `barSpecFor` now emits a chart only for
  `mode==="structured" || "hybrid"` (the only modes carrying `columns`); `narrate`
  handles `synthesis` alongside `semantic` with its own wording ("matched on agent
  syntheses and QA findings" / synthesis-specific empty state). No more unguarded
  `res.columns.find`.
- `components/command/NlQuery.tsx` — `SemanticView` widened to
  `SemanticResult | SynthesisResult`; renders a `SYNTHESIS` pill (vs `EVIDENCE`)
  and a synthesis empty-state; the render branch routes both qualitative modes there.
- Regression test (`NlQuery.test.tsx`) — a `mode:"synthesis"` payload renders the
  issuer + excerpt, no ranked table, no bar chart, and does not throw. Was RED
  (reproduced the exact `TypeError`) before the fix.

Gates: 336/336 frontend vitest · `tsc --noEmit` clean · eslint clean on the four
changed files. Branch unmerged as of this log.

---

## SEAM-2 — mock-vs-live honesty (audited first, 2026-07-04, inline)

### ATLF-fabrication guard: HOLDS (server side)

The #10 guard chain is intact on this tree and test-locked
(`caos/tests/server/test_nan_guards.py`: 3 dedicated tests):

1. `engine/metrics.py:143-146` — fixture CP-1 payload for a NON-reference issuer
   projects MetricFacts with provenance `demo_fixture` (genuine ATLF demo keeps
   `fixture`; real runs keep `run`).
2. `engine/runner.py:426-432` — `demo_fixture_finding` emits a MATERIAL CP-5
   finding (→ run `Restricted`) and appends `DEMO_FIXTURE_LIMITATION`
   (`engine/fixtures.py:116-120`) to the CP-1 output row.
3. `engine/runner.py:489-498` — retention supersede includes `demo_fixture`;
   fabricated rows never accumulate across re-runs.

Issuer Profile consumes it loudly: `ProfileContent.tsx:125-138` maps
`demo_fixture` → sev `critical`, label `fabricated`/`FAB`; `:163` ranks it worst.

### New findings

| id | sev | frontend | backend | defect + failing scenario |
|---|---|---|---|---|
| SEAM2-1 | MED → **FULLY FIXED 2026-07-04** | `lib/query/types.ts:24` (provenance union omits `demo_fixture`); `NlQuery.tsx:62-80` (cell badge matches only `fixture`/`seed`), `:143-150` (row badge falls through to `SEEDED · "Illustrative seed values (no source yet)"`); `lib/query/viz.ts:36,44` (bar color domain `["run","derived","seed"]` — `demo_fixture` off-domain: unexplained color, absent from legend; the `:36` type predicate asserts the union that hides it) | `nlquery.py:407,418` (collapse window has no provenance filter — a `demo_fixture` fact wins when it is the issuer's only fact), `:454` (passed through), `:493-501` (caveat lane checks `seed`/`derived` only — **silent** for `demo_fixture`) | Keyless run on a live (non-ATLF) issuer projects `demo_fixture` facts; a cross-issuer NL Query ranking then shows that issuer at ATLF's 5.68x / $2.8bn with a **SEEDED** pill ("no source yet") and an unexplained chart color, and the result-level caveat never fires — fabricated data labeled as benign seed. Why MED not HIGH: facts carry `qa_status=Restricted` and `NlQuery.tsx:162` renders the Restricted gate badge; prod runs keyed, so exposure is keyless/QA envs. |
| SEAM2-2 | MED → **FIXED 2026-07-04** | (no frontend label possible — CP-1C output carries only percentiles) | `engine/peers.py:67-90` (`_peer_facts`: `:81-84` prefers `run` over non-run but never excludes `demo_fixture`; no provenance filter in the query `:67-72`) | Peer benchmark (CP-1C) ingests `demo_fixture` facts as peer values: an issuer whose only facts came from a keyless run contributes ATLF's fabricated 5.68x / $2.8bn to ANOTHER issuer's peer distribution — medians, percentiles, outlier flags silently include fabricated peers, unlabeled downstream. Several keyless issuers collapse the peer median toward ATLF's numbers. Same keyless-env scoping keeps it MED. Note: the accepted "demo/mock seams by design" register covers the *seed universe*; `demo_fixture` exists precisely to mark fabrication, so its unfiltered entry into peer stats is in-scope, not adjudicated. |

### Fix pass — 2026-07-04 (in-tree, backend only)

**SEAM2-2 FIXED** — `engine/peers.py` `_peer_facts` now excludes
`provenance == "demo_fixture"` in the SQL selection (#10 comment in place);
fabricated ATLF rows can no longer enter another issuer's peer
medians/percentiles. E2E regression
`test_peers.py::test_peer_facts_exclude_fabricated_demo_fixture_rows`: creates a
same-industry issuer, runs it keyless (persists `demo_fixture` facts through the
real fixture path), then asserts ATLF's CP-1C peer set excludes it.

**SEAM2-1 backend half FIXED** — the provenance caveat chain is extracted to
`nlquery._provenance_caveats` (pre-existing seed/derived wording unchanged) plus
an INDEPENDENT sentence whenever `demo_fixture` is present: "… is fabricated
Atlas Forge demo-fixture data … NOT sourced from those issuers' filings; treat
as illustrative only." Renders today through the existing `res.caveats` lane
(`NlQuery.tsx:348-352`) — no frontend change required. Unit test
`test_nlquery.py::test_provenance_caveats_flag_fabricated_demo_fixture`.
**SEAM2-1 frontend half FIXED** (2026-07-04, after the SEAM1-1 synthesis fix
landed in-tree at `122c8fb5`, freeing the query files). Four consumer sites now
treat `demo_fixture` as fabricated, matching Issuer Profile's established
precedent (critical / "fabricated"):
- `lib/query/types.ts:24` — `MetricCell.provenance` union gains `demo_fixture`
  (typed + documented; no longer hidden from the compiler).
- `NlQuery.tsx` cell badge — a `demo_fixture` cell renders a loud critical "fab"
  chip (checked before `fixture`/citation/seed), not nothing.
- `NlQuery.tsx` row badge — `anyFab` takes **priority** over run/derived →
  `FABRICATED` critical pill; one synthetic cell can no longer hide behind a
  `CP-1 LIVE`/`SEEDED` label (mirrors Profile's "fabricated is always marked").
- `lib/query/viz.ts` — bar-chart colour domain extended to the full provenance
  set (`demo_fixture`→critical, `fixture`→warning): a fabricated bar gets its
  own colour + legend entry instead of an off-domain fill that read as an
  ordinary category. (Adjacent latent `fixture` off-domain bug fixed in the same
  line.)
Regression tests: `NlQuery.test.tsx` renders a `demo_fixture` result and asserts
`FABRICATED` + `fab` present, `SEEDED`/`seed` absent; `viz.test.ts` asserts the
full domain + `demo_fixture` passing through un-coerced.

Gates (SEAM2-1 backend + SEAM2-2, commit `7254fdc8`): 882/3 py3.9 · py3.11
targeted 34/34 · ruff clean · GitNexus impact LOW on `_peer_facts` +
`nlquery.execute`.
Gates (SEAM2-1 frontend half): 353/353 vitest · `tsc --noEmit` clean · eslint
clean on the five changed files.

### Known-open honesty HIGHs re-confirmed live on this tree (cross-refs, not re-counted)

From `REVIEW_MATRIX_FRONTEND.md` — the executed fix chips (axe / var+alpha /
modal-a11y) did not cover these:

- **FE 4.2 (HIGH)** — `ModelSheet.tsx:459` still ungated (`const src = row.src ?
  SRC[row.src] : null`); `:539-548` renders the SRC chip, L-04 warn chip and
  seeded E-xx evidence chips for LIVE issuers; `:472` derived-period note
  ("Q4-25 management accounts missing (gap G-02)") also ungated. Contrast
  `Manifest` `:555-560`, gated on `isReference` with the comment that presenting
  SRC for live issuers "would fabricate lineage".
- **FE 4.3 (HIGH)** — `lib/reports/model.ts:195-206` `applyAnchor` re-bases
  rev/adj/ndebt/cash then `deriveCreditKpis` (`:206`) recomputes
  `intcov = div(c.adj, c.int)` (`:156`) against the SEEDED interest line —
  live-EBITDA ÷ ATLF-interest coverage; `totlev`/`srsec` same mongrels;
  `c.cash = c.tdebt − a.netDebt` (`:205`) still goes negative for high-net-debt
  live issuers. The anchor's real reported `intCov`
  (`lib/engine/modelAnchor.ts:63`) still has zero consumers.
- **FE 8.2 (HIGH) → FIXED 2026-07-04** (reconciled during the E2E sweep, iter-6/7).
  The live Deep Research tear-sheet **now carries the AI-provenance marker**:
  `ReportPane.tsx:189-191` emits, on the non-demo branch, `"AI-synthesized · N
  sources — verify against cited sources"` on the panel badge, the on-screen
  footer, and the body-level `.print-root` (so the exported PDF carries it);
  demo keeps "Illustrative · demo". Guarded by a dedicated regression,
  `report-provenance.test.tsx` (live-marker on badge+document+print-root; demo
  stays illustrative). The earlier "still exports with no marker" note was stale
  (`ReportPane.tsx` was WIP-modified after the SEAM-2 audit).
- Low residue unchanged: FE-3 IssuerChat ATLF starter questions on live path;
  FE 7.11 silent truncations.

### Checked clean

- **Command Center labeling** — "Sample portfolio — not live" lens notes
  (`command/page.tsx:82,87`), per-row "Seeded" chips (`views.tsx:904-908`),
  coverage honesty banner (`views.tsx:1056-1058`); refresh timeout leaves seeded
  cells untouched (`:1002`).
- **User WIP is honesty-POSITIVE** — staged `views.tsx` replaces fabricated
  fallbacks with "—" (`fmtLevX` for placeholder-0 leverage/coverage; bid/ask no
  longer synthesized from `px ± 0.2`); staged `page.tsx` derives "Refreshes Due"
  + sector-board header from coverage data instead of hardcoded "2"/"8 sectors";
  unstaged query files = var+alpha → `color-mix` fix class (cosmetic).
- **Deep-Dive trust seam** — d01820c pass re-verified HELD by the 2026-07-03
  frontend review on this same branch (caveat ladder, ●LIVE/◦NO OUTPUT, fixture
  suppression, EvidenceModal E-103 closed; both honesty seams test-locked). Not
  re-audited.
- **Research progress counters** — real server counts, eased display only
  (`ReportPane.tsx:115-116`); demo reports say "Illustrative · demo".
- **Pipeline** — live issuers never get the green-PASS demo monitor
  (`pipeline/page.tsx:140`).
- **querygraph collapse tiers** — `querygraph.py:233-245,636` top only
  `run`/`fixture`; `demo_fixture` never outranks; `_provenance_split`
  (`:551-571`) reports provenance classes honestly by name.

---

## SEAM-3 — error-surface parity (audited 2026-07-04)

Backend error-shape inventory (verified): global 500 `{"detail":"Internal Server
Error"}` masked + logged (`main.py:250-258`); `/api` 404 JSON catch-all
(`main.py:284-289`) with 404-detail preserved for `/api`, SPA 404.html otherwise
(`:297-309`); 77 HTTPException raises all string details **except** the
committee-export 409 dict (`runs.py:344-359`); **no `RequestValidationError`
override** → default 422 `detail` = **list of objects** (the only other
non-string shape); 429/503 all strings; no SSE anywhere — async lanes poll.
Frontend: axios with request interceptor only — **no response interceptor**
(`api.ts:20-27`); canonical parse `e.response?.data?.detail || e.message`.

| id | sev | frontend | backend | defect + failing scenario |
|---|---|---|---|---|
| SEAM3-1 | MED | `app/research/page.tsx:134-136` → `ReportPane.tsx:150` (`{error}` as JSX child) + `Notifications.tsx:27` (toast body) | `deepresearch.py:103-113` (subject max 300, focus/exclusions 1000) + default 422 | Research brief inputs have **zero client `maxLength`** (grep: none in file). Paste a 300+-char subject → 422 `detail` is a list of objects → truthy, bypasses `\|\| fallback` → set into string-typed state → rendered as JSX child → React "Objects are not valid as a React child" → route error boundary; the toast variant crashes inside `NotificationProvider` (root layout) → global boundary. Type-guarded siblings exist (`LoginLanding.tsx:72-73`, `settings/page.tsx:162-163`, `EdgarImport.tsx:13-17`) — the hazard is known, these sites just don't apply the guard. |
| SEAM3-2 | MED | `app/issuers/page.tsx:345` → `:400` (`{createError}` as JSX child, verified); same class `UploadWizard.tsx:70-71` → `:145` | `issuers.py:23,30-32` (name 255, ratings `max_length=16`) + default 422 | New Issuer modal has zero `maxLength` attrs (grep: none). Type "B+ negative outlook" (19 chars) into the S&P rating field → 422 list detail → array into JSX child → `/issuers` route crash. Committee-facing manual-ratings path (mig 0014) crashes on realistic input. |
| SEAM3-3 | LOW | `EvidenceModal.tsx:240` (catch `/* leave loading→unavailable */`) + `:165` (null text renders "Loading source…" — **no error state exists in the render**) | `query.py:376` (404 "Chunk not found"), `:42` (429) | Click-to-source on live evidence: `getChunk` failure leaves the modal saying "Loading source…" forever. The comment claims an unavailable state; the render has none. Trust surface shows loading instead of error. |
| SEAM3-4 | LOW | `lib/api.ts:436-440` (poll catch discards HTTP status — all failures counted as transport, 10× then "Lost contact with the research backend") | `research.py:80-81` (404 when the job isn't the caller's) | A definitive 404/401 mid-poll (e.g. identity swap, SEAM4-1) is retried 10× then reported as a transport failure — wrong story for an auth/ownership 4xx. Bounded (no infinite spin). |
| SEAM3-5 | LOW (honesty-adjacent) | `app/reports/page.tsx:82` (`.catch(() => setModelInputs({}))`); `app/model/page.tsx:145` (`.catch(() => {})`) | `main.py:250-258` (500 on GET /api/models/{id}) | Saved-model hydrate failure is silent: Report Studio renders the tear-sheet **without the analyst's saved overrides/assumptions** with zero indication the figures differ from what they saved; Model Builder same silent skip of the DB restore (its save path does surface errors, `:269`). |
| SEAM3-6 | LOW → **FIXED 2026-07-04** | `GlobalIssuerSearch.tsx:28,34` (error → `setRows([])`, dropdown hidden) | `main.py:250-258` | Backend 500 during issuer search is indistinguishable from "no matches" — analyst concludes the name isn't registered. **Fix:** distinct `error` state → the dropdown now renders a critical `role="alert"` "Search unavailable — retry" row on failure instead of collapsing to silence; cleared on the next successful/short query. Regression `GlobalIssuerSearch.test.tsx` (failed search → alert; success → results, no alert). |
| SEAM3-7 | LOW (mock-seam-adjacent) | `IssuerProfileOverlay.tsx:70-87` (search failure → console.error → DEMO_UNIVERSE sleeve fallback → `openProfile(demoMatch.id \|\| raw term)`) | `issuers.py:153` (404 "Issuer not found") | API failure on issuer lookup silently degrades to the demo sleeve, then the profile fetch 404s → analyst told "Issuer not found." when the real cause was a backend failure. |
| SEAM3-8 | LOW | `app/query/page.tsx:210` (`refreshGraph().then(setGraph).catch(() => {})`) | `query.py:42` (429) / 5xx | After ratifying a link: "Link ratified" toast fires, link IS stored server-side, but the graph re-fetch failure is swallowed — solid edge never draws, success signal over stale render. |
| SEAM3-9 | LOW | `app/query/page.tsx:383-388` (catch discards status → `keywordSubmit("Model router unavailable —")`) | `query.py:129-133` (429 "Query rate limit reached…") | Route-lane 429 is shown as "Model router unavailable" before keyword fallback — deliberate degrade, wrong reason; the backend's retry-in-a-minute signal is discarded. |
| SEAM3-10 | LOW (latent) | `api.ts:246-247` `exportReport` — **no UI consumer** (grep-verified; independently corroborated by the SEAM-1 pass) | `runs.py:344-359` — the API's only dict-shaped `detail` (`{message, committee_status, qa_status, blocking_findings[]}`) | When Report Studio wires committee export, every existing handler pattern either renders "[object Object]" (string-coerce sites) or crashes (JSX-child sites). Must be special-cased at wiring time — `EdgarImport.tsx:13-17` is the house pattern that already reads `detail.message`. |

Checked clean: 500-masking current and logged with caller context ·
404-detail preservation for `/api` works as documented; unmatched `/api` returns
JSON not SPA HTML · AuthProvider/RequireAuth distinguish 401 (login landing)
from API-down (retry card) at mount (`AuthProvider.tsx:59-64`,
`RequireAuth.tsx:25-45`) · CoverageMatrix run-polling failure → RETRY chip,
180s cap, seeded cells untouched (`views.tsx:977-1019`) · research poll
resilience bounded by design (10 consecutive, 15-min cap, boot sweep fails
orphans) · 503 lanes (avscan/vault/EDGAR-unconfigured) all strings, all rendered
· edgar 502 bodies are curated `EdgarError` strings, not tracebacks ·
string-coerce error sites (NlQuery :258-260, query page :186-189, ScenarioPanel
:326-328, ProfileContent :652-654, IssuerChat :177-179) degrade to
"[object Object]" but cannot crash; NlQuery's own input `maxLength=500` matches
the server cap so its 422 is unreachable from typing.

---

## SEAM-4 — auth seam (audited 2026-07-04)

Chain map (verified): Caddy strips client `X-Forwarded-*`/`X-Edge-Authorization`
and injects the secret (`caos/deploy/Caddyfile:22-38`) → oauth2-proxy SSO
(`pass_user_headers`, `oauth2-proxy.cfg:23`) → app middleware rejects any
deployed `/api/*` request without the secret, timing-safe bytes compare,
`/api/health` sole exemption (`main.py:199-213`) + redundant per-dependency
check (`identity.py:143-150`) → fail-closed boot (secret/SESSION_SECRET/signup
code, `main.py:45-75`; typo/unset ENVIRONMENT ⇒ deployed, `config.py:237-248`)
→ HMAC-SHA256 cookie, bytes `compare_digest`, mandatory `exp`, `token_version`
revocation per request, SSO principal cross-check (`identity.py:63-71,91,98-104,
168-186`); flags httponly/samesite=lax/secure≠dev/30d (`auth.py:134-140`) →
every write stamps `caller.id` from the verified dependency (runs `runs.py:209`,
models `models.py:61`, qa flags `qa.py:63`, ratified links `query.py:256`,
research `research.py:62`, uploads `ingestion.py:98`, settings
`settings.py:94-100`); **no body model carries `analyst_id`**.

| id | sev | file:line | defect + failing scenario |
|---|---|---|---|
| SEAM4-1 | MED | `identity.py:169,180,188-206` + `auth.py:365` + `AuthProvider.tsx:50-72` (one-shot `/me` at mount) + `api.ts:20-27` (no response interceptor) | **Mid-session identity loss is invisible to the frontend.** SSO deploy: a cookie invalidated mid-session (logout on another device bumps `token_version`; 30-day exp; secret rotation) does not 401 — `get_identity` falls through to the proxy identity **by design**, whose `id` is the forwarded email, not the profile UUID. Device A keeps showing the profile initials while new runs stamp the email-id, saved-model/settings lookups key-miss and silently fork under the email key (`models.py:37,61`, `settings.py:94`), and own research jobs turn invisible (`research.py:80`). Non-SSO deploy: every call hard-401s but nothing maps 401 → `needsLogin`; each page shows its own generic error over stale data until manual reload. One fix serves both: an axios response interceptor that re-resolves `/me` on 401/`source:"proxy"` drift (server already reports `source`). Absorbs the SEAM-3 agent's duplicate (S3-4-class) finding. |
| SEAM4-2 | LOW → **FIXED 2026-07-04** | `auth.py:194,254` (contrast `identity.py:145-148`, `main.py:207-208` — same class already fixed there in bytes mode) | **str `compare_digest` on the invite code.** A non-ASCII `code` in the JSON body raises `TypeError` → 500 (not 401) on `/profile` and `/register` — log noise, and the 401-based brute-force heuristic goes blind to those probes. **Fix:** both sites now compare `body.code.encode("utf-8","ignore")` vs `settings.analyst_signup_code.encode("utf-8")` (mirrors identity.py). Regression `test_auth_profile.py::test_non_ascii_code_is_401_not_500` (non-ASCII code → 401 on both lanes, was 500). NB the reachable surface is narrower than first stated: RegisterRequest's other required fields (`recovery_words`, `email`) 422 a malformed body first, but a well-formed register/profile body with a non-ASCII code still reached the raise. |
| SEAM4-3 | LOW | `auth.py:260-269` (bind), `:206-217` (adopt-by-email on first SSO login) | **Register SSO-bind: CLOSED for the reference deploy** (mismatched body email 403s when `X-Forwarded-Email` present; Caddy strips spoofing). Residue: an edge-secret-only deploy (no email-forwarding SSO) leaves email shape-checked only — any invite-code holder can pre-squat `colleague@firm.com`; if SSO is enabled later the colleague silently adopts the squatted row whose password the attacker still holds. Fix direction: refuse password-registration (or flag the row) when no proxy identity is present in a deployed context. |
| SEAM4-4 | LOW → **FIXED (issuer half) 2026-07-04** | `issuers.py:131-142` (no `created_by` — grep: zero occurrences server-wide), `runs.py:361-362` (report export: `caller` injected, unused), `vault_export.py:222` (takes no caller) | **Unattributed governance writes.** Issuer creation incl. manual agency ratings + sponsor (WARF/digest inputs) and both export lanes record no author. A wrong or tampered manual rating is unattributable except via the transport access log. **Fix:** new `issuers.created_by` column (migration `0023`, additive/nullable, `String(255)` mirroring `Run.analyst_id`), stamped from the verified `caller.id` at create (never the body — `IssuerCreate` has no such field), surfaced in `IssuerResponse`. Regression `test_issuer_profile.py::test_issuer_created_by_stamped_from_identity_not_body` (stamps the logged-in analyst; a spoofed body `created_by` is ignored). **Export lanes deliberately not re-stamped:** the finding's own text notes exports are attributable via the transport **access_log** (`access_log.py:34-41` records the same forwarded-identity precedence), so a second stamp on the artifact is redundant. |
| SEAM4-5 | LOW → **FIXED 2026-07-04** | `AnalystBadge.tsx:18-27,32` (`setBusy(true)`, `try/finally` with no catch and no `setBusy(false)`) | **Sign-out button bricks on one failure.** If `POST /logout` fails/times out (8s), `finally`'s `refresh()` re-resolves the still-valid profile → button remains `disabled={busy}` for the rest of the session, no error surfaced, no retry without a full reload. **Fix:** `logout()`+`refresh()` moved into `try`; a `catch` resets `busy` and `window.alert`s the failure (reuses the component's existing `window.confirm` dialog idiom — no new toast wiring), leaving the button retryable. Regression `AnalystBadge.test.tsx` (failed logout → button re-enabled + alert fired + no pointless refresh). |

Checked clean: edge secret fail-closed on this tree (boot `RuntimeError`;
middleware chokepoint covers the cookie-only lanes `/register`/`/logout` that
lack `get_identity`; only `/api/health` exempt) · programmatic sweep: every data
endpoint has `Depends(get_identity)`; only the 5 auth lanes + health lack it
(intentional) · no endpoint trusts `analyst_id` from the body; frontend
`saveModel` sends `{payload}` only · cookie crypto/expiry/revocation as mapped;
logout revokes all devices; cross-user cookie neutralized per-request; CSRF =
samesite=lax + JSON + mutating-verbs-only · login/recover enumeration hygiene
(dummy PBKDF2, non-short-circuit checks); `recovery_hints` returned by no
endpoint · **roles-lite not implemented at all** — `CAOS_ADMIN_EMAILS` appears
nowhere; `role` is the constant `"analyst"` never branched; no admin routes
exist, so no hidden-UI/server-open theater either (matches DECIDED-not-built) ·
`RequireAuth` wraps all 12 route pages; gate is UX-only, server enforces
independently on every call.

---

## E2E — analyst-journey sweep (in progress, opened 2026-07-04)

One analyst journey per iteration. Existing Playwright specs
(`caos/tests/frontend/e2e/`) are **run** against an isolated single-process QA
server; journeys with no spec are **gap findings** (judged with the
playwright-pro-review + senior-qa rubric). Report-only.

**Stack.** The Playwright config (`caos/frontend/playwright.config.ts`) assumes a
*single-process* origin (FastAPI serving `/api` + the Next static export on one
port) so `global-setup` can log in once and `storageState` reuse the cookie
same-origin. The launch.json QA stack is *two-process* (:3010 Next dev + :8010
API) — cross-origin, which the single-`baseURL`/single-`storageState` model can't
carry. So this sweep runs one isolated single-process server:
`.venv311/bin/python run.py` on **:8010**, `caos_qa.db`,
`SESSION_SECRET=qa-fixed-secret-do-not-change`, `ANTHROPIC_API_KEY=` (demo
fallback → deterministic), serving `caos/server/static` (build stamped
2026-07-02 23:16 — ~2 days behind the WIP source; provenance noted). Invocation:
`PLAYWRIGHT_BASE_URL=http://localhost:8010 E2E_ACCESS_CODE=131113
NODE_PATH=node_modules npx playwright test <spec>` from `caos/frontend`. User's
:8000 left untouched.

### Journey inventory

| # | Journey | Spec | Coverage | Status |
|---|---|---|---|---|
| 1 | bootstrap: upload → pipeline → run | `upload_flow.spec.ts` | **partial** — stops at pre-upload wizard step | **DONE** (iter-1) |
| 2 | deep-dive evidence-sync walk | — (unit only) | **none (E2E)** — jsdom unit test of the sync mechanism exists | **DONE** (iter-2) |
| 3 | model scenario walk | — (unit/server only) | **none (E2E)** — rich jsdom unit + pytest server round-trip exist | **DONE** (iter-3) |
| 4 | query walk → committee exhibit | — (unit only) | **none (E2E)** — pure-fn units + SEAM1-1 jsdom guard exist; no render/E2E | **DONE** (iter-4) |
| 5 | report generation | — (unit only) | **none (E2E)** — builder/model units + EvidenceModal; tear-sheet never rendered | **DONE** (iter-5) |
| 6 | research flow | `research_flow.spec.ts` | good render coverage; run test **stubs** the backend | **DONE** (iter-6) — 3/3 pass |
| 7 | settings / login | `settings_flow.spec.ts` + `global-setup.ts` | Workspace+Research tabs; **login is API-only** (no UI walk) | **DONE** (iter-7) — 2/3 pass |

### Journey 1 — bootstrap: upload → pipeline → run (iter-1, 2026-07-04)

**Ran** `upload_flow.spec.ts` @ :8010 → **4 passed, 1 failed** (4.2s). Passing:
identity-resolves-without-login, upload-wizard-advances-to-run-mode-step (found
the created issuer in the wizard picker by name — proves create+list+wizard
render), concept-switcher, chat-endpoint. `POST /api/issuers/` → 201 confirmed
independently. App is healthy; the one failure is a **spec** defect, not an app
defect.

| id | sev | file:line | defect + evidence |
|---|---|---|---|
| E2E-1a | LOW (flaky spec) | `caos/tests/frontend/e2e/upload_flow.spec.ts:42` | `getByText("ISSUER REGISTER", {exact:false})` resolves to **2** runtime elements on `/issuers/` (the `<span>Issuer Register</span>` label **and** the `<h2>Issuer Register · coverage universe</h2>` panel header) → **strict-mode violation**, fails on both the initial run and retry #1. The page renders fine (the h2 is present); the selector is just too loose after a UI addition. Fix: `page.getByRole("heading", { name: /Issuer Register/ })`. The rest of that test (search-by-name → row visible) never executes, so the directory search leg is currently **unverified** even though a spec nominally exists for it. |
| E2E-1b | **HIGH (coverage)** | `upload_flow.spec.ts:49-60` (journey ends here) | The bootstrap journey's core legs are **entirely untested E2E**. The spec creates the issuer via API, then in the wizard only asserts the run-mode options are visible (`Full IC Committee` / `Earnings Update` / `Relative Value` / `Legal Review`) — and stops. **Never exercised:** (a) attaching/dropping a document, (b) submitting the upload (ingestion), (c) triggering a pipeline run, (d) polling the run to completion, (e) verifying run output — modules rendered, CP-1 facts, the CP-5 QA gate, committee status — and (f) the Pipeline concept `CoverageMatrix` reflecting the new run. This is the single most central journey in the product and has ~0% coverage past the pre-upload screen. It is a **test-coverage** finding (not a live production bug); flagged HIGH because the untested surface is the app's primary workflow and includes the governance gate. Note the offline/demo stack (`ANTHROPIC_API_KEY=`) still runs the deterministic engine, so a real run *is* exercisable E2E without a key — the gap is missing tests, not an untestable path. |

**Verdict (playwright-pro-review + senior-qa rubric):** the one existing spec for
this journey is shallow (arranges via API, asserts static wizard text, no
act-on-the-core-flow) and currently red on a brittle text selector. Journey 1
needs a real upload→run→output spec; recommend a keyless run against the
deterministic engine with a poll-to-completion + CP-5 gate assertion.

### Journey 2 — deep-dive evidence-sync walk (iter-2, 2026-07-04)

**No E2E spec.** Confirmed by grep: the only e2e reference to `/deepdive` is
`upload_flow.spec.ts`'s concept-switcher test, which merely clicks the Deep-Dive
nav title and asserts the URL — a navigation smoke, not an evidence walk. `/deepdive`
is reachable (HTTP 200 @ :8010). A **jsdom unit test** does exist —
`lib/evidence-sync.test.tsx` — covering the sync mechanism (provider shares/updates
the active id; EvChip hover highlights every same-id chip and not others; click →
`onOpen`; inert outside a provider). Good unit coverage of the primitive; **zero**
browser/cross-pane coverage of the actual walk.

Architecture (verified): `EvidenceSyncProvider` wraps the whole page
(`app/deepdive/page.tsx:276-551`); `EvChip` (`components/reports/EvidenceModal.tsx:26-46`)
publishes its id on `onMouseEnter`/`onFocus` and clears on `onMouseLeave`/`onBlur`,
so any chip citing an E-xx lights the accent ring (`boxShadow: … var(--caos-accent)`)
on every other chip with that id; subscribers are the CP-5B `SourceRail`
(`rails.tsx:111`), `IssuerChat` (`:151`), and `EvidenceModal` (`:30`).

| id | sev | file:line | defect + evidence |
|---|---|---|---|
| E2E-2a | **HIGH (coverage)** | `app/deepdive/page.tsx` (whole route) | The Deep-Dive evidence-sync walk — a headline, differentiated capability (Blueprint §4, and the CLAUDE.md a11y section calls it out by name) — has **no browser E2E**. The unit test renders `EvChip` in isolation, so the genuinely *cross-pane* behavior (a module-output register chip lighting the matching CP-5B source-rail driver **and** a chat citation simultaneously, across the three real panes mounted under one provider) is never exercised end-to-end. The `/deepdive` route also has no smoke coverage: no test loads it and asserts the three panes render (source rail · module launcher/output register · decision rail). Test-coverage finding, not a live defect — the page renders (200) and the mechanism is sound at unit level. |
| E2E-2b | MED (a11y coverage) | `lib/evidence-sync.test.tsx:57-65` (hover-only) vs `EvidenceModal.tsx:37-38` (`onFocus`/`onBlur`) | EvChip publishes the active id on **keyboard focus** (`onFocus`/`onBlur`) exactly as it does on hover — this is what makes the sync keyboard-operable, an explicit CLAUDE.md WCAG mandate ("the cross-pane Evidence Sync selection are keyboard-operable with a visible focus ring"). But **no test at any level exercises the focus path**: `evidence-sync.test.tsx` fires only `mouseEnter`/`mouseLeave`. So keyboard-driven cross-pane sync **and** the visible focus ring are implemented-but-unverified — a Tab-to-chip → cross-pane-highlight + visible-ring assertion (unit or E2E) is the missing guard. Narrower than 2a because the sync primitive itself is unit-covered via hover; only the keyboard variant is unguarded. |

**Verdict (playwright-pro-review + senior-qa rubric):** the unit test is a good
primitive check but stops at one chip in a bare provider. The journey needs (1) a
`/deepdive` smoke asserting the three panes render, (2) a real cross-pane sync
assertion (chip in one pane → ring on the matching chip/driver in another), and (3)
a keyboard leg (`Tab`/focus → same sync + visible ring) to cover the a11y mandate.

### Journey 3 — model scenario walk (iter-3, 2026-07-04, Workflow: 11 agents)

**Method (ultracode).** Map ×3 (walk UX · existing coverage · backend path) +
live probe @ :8010 → synth → adversarial verify (one skeptic per finding,
default-to-refute, right-size per the house rule). The synth's lone HIGH was
**downgraded to MED** on verification — the load-bearing failure path it called
"nothing catches it" is in fact unit- and server-tested. **No E2E spec.** But
this is the most-tested-in-pieces journey: jsdom unit (`ScenarioPanel`,
`model-save`, `cell-style`, `model-format`, `formulabar-lineage`, `scenarios`,
`modelAnchor`, `reports/model`) + pytest server round-trip
(`test_saved_models.py`, `test_scenario.py`, `test_compute_pathways_contract.py`)
— none stitched into one browser flow.

**Live probe @ :8010 (proves the walk works offline/keyless):** `GET /model/` →
200; `POST /api/scenario/nl {"revenue growth down 5 points…"}` → 200 deterministic
`ScenarioSpec` (heuristic parse, **no LLM key**); non-driver text → 422
committee-grade "no recognizable driver movement"; `PUT /api/models/{real-id}`
then `GET` → **identical payload** (full save/load round-trip confirmed, stamped
`analyst_id=local-dev`); `PUT /api/models/{unknown}` → 404 "Issuer not found".

| id | sev | file:line | defect + evidence (post-verify) |
|---|---|---|---|
| E2E-3a | MED (coverage) | no `model_flow.spec.ts`; `playwright.config.ts:6` testDir holds only research/settings/upload | `/model` has **zero browser E2E** — the full open → live-CP-1-anchor-renders → override → NL-scenario → SAVE → reload → restore round-trip is never driven end-to-end. **Downgraded from HIGH:** the load-bearing SAVE-failure contract *is* unit-tested (`model-save.test.tsx` asserts the `role=alert` SAVE FAILED), the server round-trip *is* pinned (`test_saved_models.py`) and live-probe-confirmed on :8010, and the scenario/override math *is* unit-tested (`scenarios.test.ts`) — the seams exist in pieces, just never stitched in a real browser. Harness (globalSetup/storageState) already present → a spec slots in with no new infra. |
| E2E-3b | MED (honesty coverage) | `app/model/page.tsx:540-611` (`ModelProvenance`) | The CP-1 **tie-out reconciliation badge** ("CP-1 LIVE · RUN" vs "SEEDED" vs "NO MODEL OUTPUT"; "✓ ties to CP-1 Xx" when drift ≤ 0.05 vs "grid Xx vs CP-1 Xx" warning, `:571-609`) is never **rendered** by any test. `model-save.test.tsx` — the only test that mounts `ModelPage` — hard-mocks `useModelEngine → anchor:null` (`:18`), so only the SEEDED branch runs; the live-anchor tie-out (`:566-609`) never renders. The tie-out *math* (`cp1ToAnchor`/`buildModel`) is unit-tested; the drift→badge mapping — the honesty guard against a fabricated "ties" claim on a different net-debt basis — is not. |
| E2E-3c | MED (coverage) | `page.tsx:253-271` (success) + `:399-409` (dirty/saved) — only SAVE FAILED asserted (`model-save.test.tsx:32-40`) | SAVE **success** + the dirty→clean state machine are untested: nothing asserts `PUT /api/models/{id}` succeeds, `savedAt` re-baselines (`:265-267`), "SAVED <time>" renders, "● UNSAVED" appears after an edit, or the client re-hydration effect (`:134-145`) restoring overrides/assumptions/collapsedRows from `getSavedModel`. The failure path is pinned; the load-bearing success/restore half — which **Report Studio reads exclusively** — is the untested one. |
| E2E-3d | LOW (coverage) | `components/model/ScenarioPanel.tsx:42-92` (`DownsideFragility`), wired `page.tsx:488` | **Downgraded from MED:** the NL→scenario wire *is* tested server-side (`test_scenario.py` hits `POST /api/scenario/nl` 200/422) and the panel error path *is* tested (`ScenarioPanel.test.tsx:99-111`); `cp2bToDownside` is unit-tested on live-shaped/NaN payloads. Only genuine gap: no test renders `<ScenarioPanel downside={…}>`, so the CP-2B **DownsideFragility** readout (the "separate panel, not grid DOWN columns" surface per project memory) never renders — but it's pure presentational JSX over already-validated scalars. |
| E2E-3e | LOW (coverage) | `ModelSheet.tsx:40,220-264` + `page.tsx:233-250,443-451` | Grid **interaction** is unit-only: no test renders the Sheet (`role=grid` "Model worksheet") to drive cell-select→FormulaBar, double-click→override→`commitEdit`→"MANUAL OVERRIDE" badge/RESET CELL, the cell-flash, or the inline "…is not a valid number — override discarded" `role=alert`. Helpers (`cell-style`/`model-format`) are pure-unit tested; overrides persist to **localStorage only** (no server state) → contained blast radius. |
| E2E-3f | LOW (coverage) | `AssumptionsPanel.tsx:76-154,249-282` + `page.tsx:360-386` | `AssumptionsPanel` is never rendered/driven: the driver Cell type/drag-scrub edit, Base/Downside case tab, ALL-broadcast vs year-pin, `scrubHighlight` flash, per-case reset, the two-click **arm-confirm** override RESET, and EXPORT MODEL CSV are all untested at the UI layer. Driver *math* is unit-tested (`model.test.ts`); localStorage-only, secondary interactions → LOW. |

**Verdict (playwright-pro-review + senior-qa rubric):** widest E2E gap relative to
risk, yet every load-bearing failure path is unit/server-pinned and the live probe
proves every endpoint keyless/deterministic offline. Recommend **one** deterministic
`model_flow.spec.ts`: open → live-anchor-renders → override → NL-scenario → SAVE →
reload → restore, asserting the tie-out badge (3b) and SAVED/UNSAVED/SAVE-FAILED
(3c). Closes the recurring "demo/golden-shaped tests bless live seams" pattern noted
in project memory. Net: **3 MED, 3 LOW** (0 HIGH survived verification).

### Journey 4 — query walk → committee exhibit (iter-4, 2026-07-04, Workflow: 11 agents)

**Method (ultracode).** Map ×3 (walk UX · coverage · backend) + live probe @ :8010
→ synth → adversarial verify. The walk has **three entry surfaces**: (A) the
`/query` concept route (`app/query/page.tsx`, 833-line orchestrator), (B) the
Command-Center "Ask" NlQuery panel (`components/command/NlQuery.tsx`), (C) the ⌘K
`AskModal` (`components/shared/Ask.tsx`, reuses A's graph engine). **No Playwright
E2E** and **no render-level test** of any of the three; only the pure query
functions are unit-tested (`routing`/`views`/`synthesis`/`viz`/`export`/`format`/
`questions`) plus the SEAM1-1 jsdom guard.

**The synth flagged 2 HIGHs; adversarial verify DOWNGRADED both to LOW** — the
house rule earned its keep here:
- The SEAM1-1 synthesis-crash (real fixed HIGH, `06bc6439`) was **mislocated**. It
  lives only on surface **B** (`NlQuery.tsx` `SemanticView`, over `/api/query/nl`);
  `/query` (A) and `AskModal` (C) render a *different* API's payload
  (`queryGraph → GraphResult`) and never touch `nlQuery`/`SynthesisResult` (grep
  0 hits). And B's crash class **is** guarded at the exact layer the bug lived —
  `NlQuery.test.tsx:131` renders the columns-less `mode:"synthesis"` fixture and
  asserts no-throw + no chart. Backend `validate_synthesis` guards the other end.
  So SEAM1-1 is guarded backend + at the render-logic layer; only a browser E2E is
  missing = defense-in-depth, not an open regression class.

**Live probe @ :8010 (walk works offline):** `/query`+`/command` → 200; structured
`POST /api/query/nl` → ranked payload; **synthesis-word** question ("show the QA
findings…") → backend returns `mode:"synthesis"` (crash class reachable, render
survives); `POST /api/query/route` (keyless) → `{candidates:[],source:"keyword"}`
(the deterministic degrade path fires as designed); `GET /api/query/graph` → node-link.

| id | sev | file:line | defect + evidence (post-verify) |
|---|---|---|---|
| E2E-4c | MED (coverage) | `app/query/page.tsx:217` (`acceptLink`) → `EvidenceDock.tsx:150` (ACCEPT) / `:161` (UNDO) | The **only state-mutating step** in the whole Query walk — analyst ratify (`acceptQueryLink` POST `/api/query/links`, stamps `analyst_id`) and its ACCEPT → "✓ accepted" → UNDO (`retractQueryLink` DELETE) transition, plus `refreshGraph` solid-redraw — has **no UI/E2E test**. Backend round-trip *is* pytest-covered (`test_query_accepted_links.py`), but nothing verifies the UI issues the write, flips `acceptedPairs`, or redraws. MED: sole analyst-attributed mutation on the walk, but a single low-traffic action with a guarded server contract. |
| E2E-4a | LOW (coverage) | `app/query/page.tsx` (833-line orchestrator; `find app/query -name '*.test.*'` = empty) | The `/query` orchestrator has zero render/component/E2E coverage — auto-run, `queryRoute` LLM→keyword degrade, `queryGraph` fetch, synthesize-before-pixels (`:582`), the `role="tablist"` roving-arrow view switch (`:626`), EvidenceDock — all verified only as isolated pure functions. **Downgraded from HIGH:** the SEAM1-1 crash it cited is on a *different* surface (B) and already guarded; `/query` degrades rather than crashes on an unknown mode (`views.ts:41` default `["graph","rv"]`, `synthesis.ts:30` `default: fallback` + empty-nodes guard `:17`, both unit-tested), and any residual canvas-shape risk is contained by the route error boundary. Secondary concept surface → LOW render-coverage debt. |
| E2E-4b | LOW (regression-guard) | `components/command/NlQuery.test.tsx:131` (the one SEAM1-1 guard) | SEAM1-1 is guarded by exactly one jsdom test rendering only the NlQuery panel (mocks `@/lib/api`, stubs `G2Chart`). **Downgraded from HIGH:** the bug was a render-logic `TypeError` *upstream* of the chart, so the stubs are irrelevant to it — the guard sits at the layer that matters, backed by backend `validate_synthesis`. The crash class exists on exactly one surface and that surface's synthesis branch is covered. Only the browser layer is missing → LOW defense-in-depth, not "unguarded at every layer". |
| E2E-4d | LOW (coverage) | `components/query/QueryPrintSheet.tsx:10,233` | The committee exhibit itself (portaled `.print-root` tear-sheet, masthead "CAOS · QUERY · committee exhibit", synthesis-before-pixels, Exhibit SVG, Answer table) has no render test, and `downloadQueryCsv`/`window.print` wiring is unexercised. **Downgraded from MED:** the load-bearing "model overlay never leaks into the printed exhibit/CSV" invariant is enforced **by construction** (print/CSV consume only `GraphResult`; overlay lives in a separate `OverlayResult` state never merged; a leak would need a type change TS catches) — not runtime logic a test guards; and `graphToCsv` (the only real logic: injection-escaping + non-finite) is already unit-tested (`export.test.ts`). Presentational print leaf → LOW. |
| E2E-4e | LOW (coverage) | `components/shared/Ask.tsx` (no `Ask.test.*`); CSV/PDF `:464/:470` | The ⌘K/Alt+K `AskModal` (`role="dialog"` "Ask with Query") has no test. It reuses A's graph engine (`queryCapabilities`+`queryGraph`) and export, so its crash risk overlaps E2E-4a and it has no unique mutation; its primitives (`rankQueryCapabilities`, `graphToCsv`) are unit-tested. LOW. |
| E2E-4f | LOW (coverage) | `lib/query/routing.test.ts` (2 assertions); `routing.ts` consumed `page.tsx:359` | The deterministic keyword router `rankQueryCapabilities` — the degrade target when the LLM route lane returns empty/503/keyless (proven live: `route → {candidates:[],source:"keyword"}`) — is covered by only 2 unit assertions (notes→memos, threshold→scatter). The rest of the ~40-keyword routing space (peer-set, contagion, trace-source, distribution, tie-breaks, no-match "!" fallback, and a genuine untested "coverage"→scatter-vs-completeness ambiguity) is unverified, and no test wires routing→views→synthesis as the real control flow does. Pure-function gap on a backend-proven degrade path → LOW. |

**Verdict (playwright-pro-review + senior-qa rubric):** the Query walk's *pure
logic* is well unit-tested and the one real past crash (SEAM1-1) is guarded at the
layer it lived; what's entirely missing is **render/browser** coverage of all three
entry surfaces. The single highest-value add is one `query_flow.spec.ts` that drives
`/query` → route a cross-issuer question → synthesis-before-pixels renders → **ratify
a link** (E2E-4c, the sole mutation) → export CSV / print exhibit, plus a browser
assertion that a synthesis-word question in the Ask panel renders without throwing
(cheap SEAM1-1 defense-in-depth). Net: **1 MED, 5 LOW** (0 HIGH survived
verification — both synth HIGHs refuted on the SEAM1-1 mislocation).

### Journey 5 — report generation / Report Studio (iter-5, 2026-07-04, Workflow: 9 agents)

**Method (ultracode).** Map ×3 (walk UX · coverage · vault/committee-gate backend) +
live probe @ :8010 → synth → adversarial verify. **No Playwright E2E** and the
tear-sheet render surface (`ReportDoc.tsx` + `panels.tsx`) is **never rendered** by
any test — only builder pure-functions (`builders.test.ts`/`model.test.ts`) and
`EvidenceModal` are covered.

**Framing that caps everything at MED:** Report Studio builds tear-sheets only for
the **seeded ATLF reference fixture** — `reports/page.tsx:88-91` gates
`buildReports` on `isReference`; a real issuer gets `reports=[]` + a "No
issuer-specific report output" empty state. So **no wrong committee output ships
today**; every seam below is *latent*, arming the moment CP-RENDER wires live
payloads. Also notable: `ExportToVaultButton` **never mounts on `/reports`** —
`ExportPanel` is rendered without a `runId` prop (`page.tsx:379`) and the button is
runId-gated (`panels.tsx:260`), so the only live vault-export mount is Deep-Dive.

| id | sev | file:line | defect + evidence (post-verify) |
|---|---|---|---|
| E2E-5d | MED (honesty coverage) | `lib/reports/model.ts:195-207` (`applyAnchor`) + `:147-158` (`deriveCreditKpis`); gap at `model.test.ts:97-137` | **FE 4.3 mongrel-KPI seam guarded at NEITHER layer.** `applyAnchor` re-bases `rev/adj/ndebt/cash` from the live CP-1 anchor but **never re-bases `c.int`** (interest stays the seeded ATLF fixture value); `deriveCreditKpis` then computes `intcov = adj / int` — a **live-EBITDA numerator over a fixture-interest denominator**, surfacing on the tear-sheet as "Interest Cover" (`builders.ts:126`) and cap-structure "PF interest" (`builders.ts:237`). The one cross-source KPI the seam is about is **verified nowhere**: `model.test.ts:97-137` asserts `rev/adj/ndebt/netlev` under a live anchor but **never `intcov`** (the anchor fixture even carries `intCov:2.0`, unused), and no test renders `ReportDoc` with an anchor. Latent (isReference-gated) → MED; already KNOWN-open (FE matrix 4.3/10.3). Becomes a wrong-committee-output HIGH the instant live rendering is wired — exactly when the guard is needed. |
| E2E-5a | MED (coverage) | `components/reports/ReportDoc.tsx:257` + `panels.tsx` (ReportList/ComposePanel/LineagePanel/ExportPanel) | The central deliverable of the journey — the committee tear-sheet render — has **zero render-layer or E2E coverage**. No test imports `ReportDoc`/`reports/panels` (grep 0). Untested: ReportList HELD/READY `StatusTag`, the CP-5 conditional watermark on the IC memo, `ComposePanel` omit/print parity, contentEditable analyst-edit persistence, zoom/paper chrome, `PrintPortal window.print()`. MED not HIGH: fixture-only surface today, so nothing wrong ships; but it's the load-bearing deliverable → not LOW. |
| E2E-5c | LOW (regression-guard) | `lib/api.ts:268` (`exportReport`, zero call sites) vs `server/routes/runs.py:346-358` (409 dict) | The committee-export CP-5 gate has **no UI consumer and no 409-dict handler** (`exportReport` never called; grep `blocking_findings` in FE = 0; SEAM3-10). **Downgraded from MED:** the gate itself is **well-tested server-side** — `test_engine.py:311-315` unit-tests `committee_export_allowed` for all 4 statuses and `:335-341` HTTP-tests the Restricted **409 with a non-empty MATERIAL `blocking_findings[]`**. The governance seam with teeth is guarded; what's missing is only a browser guard for a UI consumer that doesn't exist yet. Already tracked as SEAM3-10 "LOW (latent)". → LOW. |
| E2E-5b | LOW (coverage) | `components/reports/ExportToVaultButton.tsx:22`; `server/routes/runs.py:365` (vault) / `:319` (report 200) | Thin HTTP wrappers + FE button chrome untested: `ExportToVaultButton` has no test at any layer (busy/done/error + the 503 "not configured" branch — the only one reachable on :8010, `VAULT_EXPORT_DIR` unset) **and never mounts on `/reports`** (runId-gated → Deep-Dive only). Server: `test_vault_export.py` covers the `export_run` helpers + auto-export hook but **not** the `POST /{id}/vault` HTTP wrapper (503/404/500/429/shape), and `/report`'s Committee-Ready **200** assembled body is not HTTP-asserted (only the Restricted 409 is). Write logic + gate predicate are backend-unit-covered → LOW. |

**Verdict (playwright-pro-review + senior-qa rubric):** the Report Studio walk is
safe today *only because it renders a fixture* — the render surface, the mongrel-KPI
honesty seam, and both export mutations are all untested at the render/browser layer
and all activate together when CP-RENDER builds live payloads. The single
highest-value guard is a render/E2E test that drives `buildReports({anchor})` for a
**live** shape and asserts `intcov` is either re-based or suppressed (E2E-5d) — that
one assertion closes the sharpest honesty gap before it can ship. Net: **2 MED,
2 LOW** (0 HIGH — one synth MED downgraded; the CP-5 gate is server-guarded).

### Journey 6 — research flow (iter-6, 2026-07-04, spec RUN)

**Ran** `research_flow.spec.ts` @ :8010 → **3/3 pass** (3.8s): brief-form-empty-report,
scope-toggle (sector↔issuer), and running-research-renders-report+sources. This is
the **best-covered** journey — the render pipeline and the durable-poll *loop*
(running→complete transition) are genuinely exercised. Gap-analysis nonetheless
finds three holes, two of them on **known-open seams that live on exactly this flow**.

| id | sev | file:line | defect + evidence |
|---|---|---|---|
| E2E-6a | MED (coverage) | `research_flow.spec.ts:47-69` (`page.route` stubs both POST + poll) | The one run test **stubs `/api/research` at the network boundary** (POST → `201 {status:running}`, first GET → `running`, second → `complete` with a canned report/sources). So it verifies the frontend's render + poll-loop, but the **real durable async lane is never exercised E2E**: POST persists a job → `research_executor` runs the offline/demo path → the client polls the **real** GET to completion → boot-sweep of orphaned jobs. This is the app's most complex async governance lane and it *is* testable offline (demo executor, no key — the UI even relabels to "Run example research"), yet no test drives the real job lifecycle. |
| E2E-6b | MED (regression-guard / known-open) | `app/research/page.tsx:41,45,46` (subject/focus/exclusions — **`maxLength` count = 0**) | **SEAM3-1 lives on this exact flow and is still open here.** The brief inputs have **no client `maxLength`** (grep-confirmed 0), so a 300+char subject → server 422 whose `detail` is a **list of objects** → truthy, bypasses the `|| message` fallback → set into string-typed state → React "Objects are not valid as a React child" → route/global error boundary (the toast variant crashes inside the root-layout `NotificationProvider`). The passing spec only ever types short subjects, so **nothing guards this crash**. Tracked as SEAM3-1 (owned by chip `task_762cc182`); this records that even the well-covered journey has no E2E for its known crash input. |
| E2E-6c | LOW (honesty guard + reconciliation) | `components/research/ReportPane.tsx:189-191` (non-demo branch) vs `research_flow.spec.ts:65` (`demo:true`) | **Reconciliation:** FE 8.2 (matrix-8.2 AI-provenance marker) **appears FIXED in-tree** — `ReportPane.tsx:189-191` now emits, on the **live** (non-demo) branch, `"AI-synthesized · N sources — verify against cited sources"` (and `:285`), so the live tear-sheet *does* carry the marker. The SEAM-2 rollup still lists FE 8.2 as an open HIGH — **stale on this tree** (`ReportPane.tsx` is user-WIP-modified; matrix lags code). **Gap:** the run test stubs `demo:true`, exercising only the "Illustrative · demo" branch, so **no E2E asserts the live "AI-synthesized" marker survives** — the committee-defensibility invariant is unguarded even though the code now satisfies it. Also unguarded: the failed-job / "Lost contact with the research backend" 10-poll transport path (SEAM3-4). |

**Verdict (playwright-pro-review + senior-qa rubric):** the research spec is the
strongest in the suite (real render + poll-loop), but it stubs the backend and walks
only the happy path — so the real durable job lifecycle, the SEAM3-1 over-long-input
crash, and the live AI-provenance marker are all unguarded. Highest-value adds: (1)
one un-stubbed "Run example research" E2E against the offline demo executor (real
job → real poll → report), and (2) a maxLength/422-input assertion. **Reconciliation
worth acting on:** FE 8.2 looks fixed in-tree — verify and update the SEAM-2 rollup.
Net: **2 MED, 1 LOW** + 1 reconciliation (FE 8.2 likely closable).

### Journey 7 — settings / login (iter-7, 2026-07-04, spec RUN)

**Ran** `settings_flow.spec.ts` @ :8010 → **2 passed, 1 failed** (12.4s). Passing:
workspace-config-mirror, research-defaults-persist-to-localStorage. The login leg is
covered by `global-setup.ts` — but via **API** (`POST /api/auth/profile`), not the UI.

| id | sev | file:line | defect + evidence |
|---|---|---|---|
| E2E-7b | MED (coverage) | `global-setup.ts:18-20` (API login); no `LoginLanding` UI test | The **login UI is never exercised E2E**. `global-setup` authenticates by POSTing `/api/auth/profile` and stashing the cookie in `storageState`, so every spec starts pre-authed — the actual `LoginLanding` form (enter access code + name → submit → land signed-in), the **wrong-code error**, and the **429 login rate-limit** have zero browser coverage. Login is the gate to the whole app and the one "spec exists" journey where the spec is really an API shortcut, not a UI walk. (SEAM4-1 mid-session identity loss + the non-SSO 401→needsLogin mapping are also unguarded, but harder to drive E2E.) |
| E2E-7a | LOW (flaky spec) | `settings_flow.spec.ts:46-55` vs `app/research/page.tsx:230-244` (`{adv && …}`) | Test "saved defaults seed a new Research brief" is **RED**: `getByLabel('Audience')` finds **no element** on `/research` because the Audience field now sits inside the collapsed **"Advanced brief"** disclosure (`adv` defaults false) — the test navigates to `/research` and asserts without clicking "Advanced brief". **Not a live bug:** the value *is* seeded into state (`setAudience(p.audience)`, `research/page.tsx:65`) and test 2's localStorage-persistence (always-visible Settings field) passed. Stale spec after a UI reorg; fix = expand the disclosure before asserting. Caveat: served static export is 2026-07-02, spec 2026-07-03 — if the disclosure post-dates the build a fresh build should confirm it isn't a live seed regression. |
| E2E-7c | LOW (coverage) | `AnalystBadge.tsx` (sign-out, SEAM4-5); Settings Models/Analyst tabs | **Logout + the other Settings tabs have no E2E.** `settings_flow` covers only Workspace + Research; the Models tab (`settings-models.test.tsx` unit-covers it) and analyst-profile settings have no browser test, and `AnalystBadge` sign-out — SEAM4-5, whose "button bricks on failed logout" was fixed — has no browser guard. LOW: unit-covered / low-traffic. |

**Verdict (playwright-pro-review + senior-qa rubric):** the Settings render paths are
well covered, but "login" is a misnomer in the coverage claim — it's API-authed in
setup, never walked through the UI. Highest-value add: a `login_flow.spec.ts` that
does not consume `storageState` (fresh context), drives the real `LoginLanding` form,
and asserts land-signed-in + wrong-code error. Also un-collapse the Audience
disclosure in `settings_flow:46` to make it green. Net: **1 MED, 2 LOW**.

---

## E2E sweep — complete (7/7 journeys, 2026-07-04)

All seven analyst journeys assessed. **Specs run:** 3 (`upload_flow` 4/5,
`research_flow` 3/3, `settings_flow` 2/3 — 2 pre-existing spec failures, both stale
selectors/assumptions, **no app bug**). **Gap-analyzed (no E2E):** journeys 1–5's
render/browser layer + the whole of 2,3,4,5. Every workflow-assessed HIGH was
adversarially **downgraded** — the house rule ("agents inflate") held on all three.

| # | Journey | Method | Net (verified) |
|---|---|---|---|
| 1 | bootstrap upload→pipeline→run | spec + inline | **1 HIGH**, 1 LOW |
| 2 | deep-dive evidence-sync | inline | 1 HIGH*, 1 MED |
| 3 | model scenario walk | Workflow (11 ag) | 3 MED, 3 LOW |
| 4 | query → committee exhibit | Workflow (11 ag) | 1 MED, 5 LOW |
| 5 | report generation | Workflow (9 ag) | 2 MED, 2 LOW |
| 6 | research flow | spec + inline | 2 MED, 1 LOW (+FE-8.2 reconciliation) |
| 7 | settings / login | spec + inline | 1 MED, 2 LOW |

**The single most-actionable gap: E2E-1b (HIGH)** — the bootstrap journey
(upload→run→CP-5 gate→output→CoverageMatrix) is untested at *every* frontend layer;
it is the app's primary workflow and runs keyless/deterministic, so it is directly
E2E-able. `*` E2E-2a is recorded HIGH but, under the same adversarial rule the
workflows applied (the sync *mechanism* is jsdom-unit-tested; only the cross-pane
*browser* composition is missing), it is more precisely a **MED** — noted for
consistency. Everything else is MED/LOW coverage debt on surfaces that are either
fixture-only today, unit/server-guarded at the load-bearing layer, or degrade by
construction. **Two pre-existing specs are RED** (`upload_flow:42` strict-mode
selector, `settings_flow:46` un-expanded disclosure) — both cheap fixes, both spec
bugs not app bugs. **One reconciliation:** FE 8.2 (AI-provenance marker) appears
fixed in-tree; the SEAM-2 rollup is stale on it. Recommended new specs, by value:
`bootstrap_flow` (1b) › `login_flow` (7b) › `model_flow` (3a–c) › `query_flow` (4c)
› un-stubbed `research` (6a) › `report render` (5d). Report-only — no fixes applied.

---

## E2E — fix-all pass (2026-07-04)

Acted on the sweep (user: "fix all"). All work verified against the isolated
single-process QA server on :8010 (`caos_qa.db`, demo-fallback, fixed secret).

**Spec bugs fixed (2, both stale spec assumptions — no app bug):**
- `upload_flow.spec.ts:42` — `getByText("ISSUER REGISTER")` matched 2 nodes →
  `getByRole("heading", { name: /Issuer Register/i })`.
- `settings_flow.spec.ts:46` — the Audience field moved behind the collapsed
  "Advanced brief" disclosure; the test now expands it before asserting.

**FE 8.2 reconciliation → CLOSED.** The AI-provenance marker is present in source
(`ReportPane.tsx:189-191`, live "AI-synthesized · N sources") AND unit-guarded
(`report-provenance.test.tsx`). SEAM-2 notes updated from "open HIGH" to FIXED.

**FE 4.3 / E2E-5d mongrel-KPI — CODE FIX.** `lib/reports/model.ts` `applyAnchor`
now re-bases interest from the anchor's own reported coverage (`intCov`) so the
tear-sheet's `intcov` (and the cap-structure PF coverage that reads the same
interest line) tie to the live figure — or suppresses `intcov` when the run
reported none — instead of computing live-EBITDA ÷ seeded-ATLF-interest. Guarded
by 2 new `model.test.ts` cases (ties-to-reported-coverage · suppress-when-none).
`model.test.ts` 14/14, `builders.test.ts` 3/3.

**New E2E specs authored (6 files), verified against a rebuilt bundle → 31 passed,
4 skipped (8 spec files, 35 tests):**
- `login_flow.spec.ts` (E2E-7b) — 3/3. Drives the real `LoginLanding`: register →
  land signed-in, wrong-invite-code error, wrong-passcode error. (Stubs only the
  initial `/me`→401 to defeat the dev-stack auto-identity; register/login hit the
  real backend.)
- `bootstrap_flow.spec.ts` (E2E-1b, **the HIGH**) — 5/5, **0 skips**. create issuer
  → `POST /api/runs` → poll to `complete` (keyless run is deterministic + instant,
  23 modules) → assert live output in `/pipeline` (Live CP-X run, RUN prefix,
  CLEARANCE, CP-5 node) and `/deepdive` (issuer chrome, "live engine output"
  caveat, ● LIVE badge, EXPORT TO VAULT). The HIGH is now covered end-to-end.
- `deepdive_flow.spec.ts` (E2E-2a/2b) — 3/3, **0 skips**. Three-pane smoke +
  cross-pane evidence-sync ring on hover AND keyboard focus (25 EvChips; E-44
  cross-highlights, E-09 does not).
- `model_flow.spec.ts` (E2E-3a/3b/3c) — 4 passed, 1 skipped. Provenance badge,
  scenario-preset re-center, real SAVE (`PUT /api/models` 200 → SAVED), reload
  restores. Skip: CP-2B DownsideFragility (the demo run emits no CP-2B pathway —
  a permanent offline limitation, not a bug).
- `query_flow.spec.ts` (E2E-4a/4c + SEAM1-1) — 3 passed, 2 skipped. Auto-run
  synthesis+view, typed question, EXPORT CSV download. Skips: ratify overlay
  (green-or-skip — offline overlay is non-deterministic / needs model_lane); the
  SEAM1-1 browser guard (see build-staleness below).
- `research_run.spec.ts` (E2E-6a/6c) — 2 passed, 1 skipped. Un-stubbed real demo
  run (`POST /api/research` → real poll → report) + stubbed live-provenance
  render. Skip: the exact "AI-synthesized" text (see build-staleness below).

**Build-staleness discovery (real, worth a redeploy).** Three specs independently
found the served static bundle (`caos/server/static`, built 2026-07-02 23:16)
**predates** the SEAM1-1 fix (`122c8fb5`) and the AI-marker — so the *deployed
artifact still crashes*. A browser probe **reproduced the SEAM1-1 synthesis crash
live** on that build: submitting "show the QA findings…" to the `/command` Ask panel
throws `TypeError: Cannot read properties of undefined (reading 'find')` →
"Something broke on this view" error boundary. The fix IS in source
(`viz.ts:33` guards `res.columns.find` to structured/hybrid) and IS unit-guarded
(`NlQuery.test.tsx:131`), so this is a **stale-deployed-bundle** issue, not a source
regression. NB `next build --webpack` reused a stale cache (rebuilt `out/` kept the
Jul-2 command chunk); a clean rebuild needs `rm -rf out .next-qa-build
node_modules/.cache` first. **Action: rebuild + redeploy `caos/server/static`** —
that ships the SEAM1-1 fix + AI-marker and flips the 2 build-staleness E2E skips
(`query_flow` SEAM1-1 guard, `research_run` AI-marker) to green automatically. The
guards are coded to auto-arm on a fresh bundle. Not touched here: the user's
`caos/server/static` and running :8000 were left untouched (QA served a separate
`out/` build via `CAOS_STATIC_DIR`).

Net: 8 E2E fixes/additions + 1 honesty code fix, all green; 4 skips (2 permanent
offline limits, 2 pending the redeploy). SEAM1-1 downgraded to a deployment task
(fix + guard exist); FE 8.2 and FE 4.3 closed.

---

## UNPROVEN — excluded from findings (adversarial-verified-only mandate)

- `edgarVaultUrls` comma-split (`api.ts:357-358`) — no real SEC URL with a
  literal comma produced.
- `ResearchJobStatus.report` nullable on `complete` — executor path not proven
  to commit that state.
- Issuer-create empty-string-vs-NULL persistence — every read site
  truthiness-guards; data-hygiene only.
- oauth2-proxy behavior on expired SSO session for XHR (302 vs 401) —
  deploy-config dependent, not provable in-repo.
- `research_executor.py:92` `str(e)[:2000]` — shape-safe string; whether
  provider-SDK text can carry sensitive internals into the analyst-visible card
  unproven either way (inconsistent in spirit with `main.py` 500-masking).
- IssuerChat 20k-char message → 422 "[object Object]" in a chat bubble — client
  cap not confirmed; concat coerces so no crash.
- Per-page 401 blast radius of SEAM4-1's non-SSO shape not exhaustively
  enumerated across all 12 pages.
