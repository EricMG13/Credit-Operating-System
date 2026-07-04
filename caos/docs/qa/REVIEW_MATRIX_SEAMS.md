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
| SEAM-2 mock-vs-live honesty | every seeded-mock surface; ATLF-fabrication guard | **audited** | 2 (2 MED) | yes (inline, self-adversarial) | Guard HOLDS server-side (3 layers, 3 dedicated tests). Gaps are downstream: query-lane + peer-benchmark consumption of `demo_fixture`. 3 known honesty HIGHs (FE 4.2/4.3/8.2) re-confirmed still open on this tree. |
| SEAM-3 error-surface parity | backend error/404/422 shapes vs frontend error surfaces | **audited** | 10 (2 MED, 8 LOW) | yes (inline re-verify) | Systemic pattern: the 422 list-shaped `detail` is handled correctly at 3 sites and crashes/garbles at the rest; plus a family of silent catches that render failure as empty/stale/mock. |
| SEAM-4 auth seam | edge proxy → signed cookie → analyst_id stamping; frontend session | **audited** | 5 (1 MED, 4 LOW) | yes (inline re-verify) | Server chain battle-hardened (BE-7 confirmed again). The seam defect is client-side: mid-session identity loss is invisible to the frontend. Register SSO-bind question CLOSED for the reference deploy. Roles-lite: not implemented (matches DECIDED-not-built plan). |

**Totals: 19 new verified findings — 1 HIGH, 6 MED, 12 LOW.**
(HIGH SEAM1-1 FIXED 2026-07-04 — commit `06bc6439`, branch `claude/vigilant-panini-735ad4`; see SEAM-1 fix-pass log.)
(SEAM2-2 FIXED + SEAM2-1 backend half FIXED 2026-07-04 in-tree — see SEAM-2
fix-pass log; the frontend badge half of SEAM2-1 is deferred until
`claude/vigilant-panini-735ad4` merges, to avoid conflicting edits in
`lib/query/types.ts` / `viz.ts`.)

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
- **FE 8.2 (HIGH)** — `ReportPane.tsx:157-186` live Deep Research tear-sheet
  still exports with no AI-provenance marker (footer = "CAOS · Credit Agent OS"
  + source count; only the demo branch says "Illustrative · demo").
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
| SEAM3-6 | LOW | `GlobalIssuerSearch.tsx:28,34` (error → `setRows([])`, dropdown hidden) | `main.py:250-258` | Backend 500 during issuer search is indistinguishable from "no matches" — analyst concludes the name isn't registered. |
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
| SEAM4-4 | LOW | `issuers.py:131-142` (no `created_by` — grep: zero occurrences server-wide), `runs.py:361-362` (report export: `caller` injected, unused), `vault_export.py:222` (takes no caller) | **Unattributed governance writes.** Issuer creation incl. manual agency ratings + sponsor (WARF/digest inputs) and both export lanes record no author. A wrong or tampered manual rating is unattributable except via the transport access log. |
| SEAM4-5 | LOW | `AnalystBadge.tsx:18-27,32` (`setBusy(true)`, `try/finally` with no catch and no `setBusy(false)`) | **Sign-out button bricks on one failure.** If `POST /logout` fails/times out (8s), `finally`'s `refresh()` re-resolves the still-valid profile → button remains `disabled={busy}` for the rest of the session, no error surfaced, no retry without a full reload. |

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
