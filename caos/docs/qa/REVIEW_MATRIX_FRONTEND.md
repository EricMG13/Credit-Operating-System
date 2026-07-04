# Frontend Review Matrix

Total frontend review of CAOS. Bootstrap 2026-07-03 on `feat/query-route-fast-lane`.
Findings recorded only after adversarial verification, with `file:line`.
Adjudicated-accepted (do NOT re-flag): command-page sample-portfolio mock (intentional,
on-screen labeled); /deepdive ~643KB first-load (dense-desk by design, dynamic-split done);
single-team IDOR.

Paths relative to `caos/frontend/src/` unless noted.

| Group | Scope paths | Status | Findings | Verified | Notes |
|-------|-------------|--------|----------|----------|-------|
| FE-1 Command+Monitor | `app/command`, `app/monitor`, `components/command`, `lib/command` | **AUDITED 2026-07-03** | 10 | 10 | 2×med, 7×low, 1×trivial — see findings below. ALL pre-existing: the live churn ({command/page, SectorRV, views} +242 lines) is the command-header responsive/honesty pass and touches none of them. Session-start git status was stale (sections/SectorReview/srdata already landed in commits). |
| FE-2 Pipeline+Upload | `app/pipeline`, `app/upload`, `components/pipeline`, `components/upload`, `lib/pipeline` | **AUDITED 2026-07-03** | 6 | 6 | Audited at 2accf5f. **1×HIGH** (var+alpha concat drops every node status border — the pattern `sev.ts` itself documents fixing), 3×med, 2×low |
| FE-3 Deep-Dive | `app/deepdive`, `components/deepdive`, `lib/deepdive`, `lib/engine/useLiveRun.ts` | **AUDITED 2026-07-03** | 6 | 6 | 1×med (dead QaQueue→Deep-Dive drill-through — FE-1 addendum), 4×low, 1×trivial. Zero churn in scope (audited at HEAD). **d01820c trust pass HELD at every seam**; both honesty-critical seams test-locked. Verified inline (classifier outage blocked subagents): refute-first personas + primary-source server reads for 3.1. |
| FE-4 Model Builder | `app/model`, `components/model`, `lib/model`, `lib/model-mode.ts`, model-side `lib/engine` (useModelEngine, modelAnchor, adapt, downsidePathway) | **AUDITED 2026-07-03** | 12 | 12 | Audited at 2accf5f. **3×HIGH** (axe grid roles; ATLF lineage residue; anchored-column mongrel KPIs), 2×med, 1×med-low, 6×low. 99ada2f fixes verified held except ATLF residue |
| FE-5 Report Studio | `app/reports`, `components/reports`, `lib/reports` (excl. model.ts anchoring = FE-4 4.3) | **AUDITED 2026-07-03** | 5 | 5 | Audited at 2accf5f. Both /reports axe leads anchored (2×HIGH a11y). Trust pass b9f80a6 verified HELD (fixture banners, cross-issuer isolation, real evidence resolution) |
| FE-6 Query | `app/query`, `components/query`, `lib/query` | **AUDITED 2026-07-03** | 14 | 14 | Audited at 3eb580e. 4×med, 4×low-med, 6×low — see findings below |
| FE-7 Issuer Profile | `app/issuers`, `components/shared/IssuerProfileOverlay.tsx`, `lib/issuers.ts`, `lib/issuer-profile-charts.ts` | **AUDITED 2026-07-03** | 11 | 11 | Audited at 2accf5f (post overlay split). 1×HIGH, 2×med, 1×med-low, 7×low — see findings below |
| FE-8 Research+Settings | `app/research`, `app/settings`, `components/research`, `lib/research-prefs.ts` | **AUDITED 2026-07-03** | 5 | 5 | Audited at 2accf5f. 2×HIGH (deepResearch poll leak on unmount — confirms the FE-9 note; live research has no AI-provenance marker), 1×med, 2×low. Markdown XSS surface closed (no rehype-raw). No var+alpha concat |
| FE-9 Shared fabric | `components/shared` (excl. IssuerProfileOverlay), `components/charts`, `lib/*.ts(x)` root (api, a11y, format, citations, chart-colors, evidence-sync, use-modal-a11y, model-mode), `app/layout.tsx`, `app/page.tsx`, `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, `app/globals.css` | **AUDITED 2026-07-03** | 15 | 15 | **1×HIGH in UNCOMMITTED use-modal-a11y churn**, 4×med, 10×low. Fan-in: api.ts=45 importers, RequireAuth=11, CloseButton=10, use-modal-a11y=8+1, ConceptNav=8 (GitNexus) |
| FE-10 Tests+e2e | 52 unit test files (`**/*.test.ts(x)`), e2e at `caos/tests/frontend/e2e/` (research/settings/upload flows + global-setup), `playwright.config`, `vitest.config` | **AUDITED 2026-07-03** | 8 | 8 | Audited at 2accf5f. Suite mechanically disciplined (0 .only/.skip/expect(true)/unmocked-time) but semantically under-protects: 4 verified app defects (2.1/6.8/4.3/4.8) have GREEN tests exercising the buggy code (assertion-gaps). 3×HIGH assertion-gap, 2×HIGH coverage-gap, 3× lower |

## Baselines (2026-07-03)

| Baseline | Command | Result |
|----------|---------|--------|
| Unit tests | `npm test` (vitest) from `caos/frontend` | **PASS 330/330** (51 files, 3.9s) |
| A11y | `BASE=http://localhost:3030 node scripts/a11y-axe.mjs` (axe-core, 12 routes, qa3 demo-seed stack) | **16 violation nodes** (was 0 on 2026-06-22): `/model` aria-required-children critical×9 (**anchored: finding 4.1**, ModelSheet grid roles); `/reports` color-contrast serious×2 + target-size serious×4 (citation-chip buttons "Open source E-*"); `/pipeline` target-size serious×1. `/query` + rest clean. → /reports + /pipeline regressions land in FE-5 / FE-2 audits |
| Fallow static | `npx fallow --format json --quiet` from `caos/frontend` (v2.104.0) | Dead code: **2 issues** — 1 unused export `src/lib/command/srdata.ts` (FE-1, file churned on this branch), 1 stale suppression `src/lib/api.ts` (FE-9). 0 unused files/deps, 0 circular deps, 0 route collisions. Health: 117 complexity findings (top: query/page.tsx ×10, GraphCanvas ×9, command/SectorRV ×7 — complexity adjudicated as style, C901-equivalent). Dupes: 41 clone groups (query/page.tsx↔shared/Ask.tsx ×5, GraphCanvas↔ScatterCanvas ×3) |

## Rollup — review complete (all 10 groups, 2026-07-03)

**98 verified findings, 0 refuted** across FE-1…FE-10 (FE-3's 6 now folded in: 1 med —
the dead QaQueue→Deep-Dive drill-through, an FE-1 clean-list correction — 4 low,
1 trivial; Deep-Dive's d01820c trust pass otherwise HELD, both honesty seams test-locked).
Every finding adversarially re-verified against code before recording.

Severity: **15 HIGH-class** = 10 HIGH app-code defects + 5 HIGH test-quality gaps.
- **App-code HIGH (10):** 2.1 var+alpha concat drops node borders · 4.1 axe grid roles ·
  4.2 ATLF lineage residue on live issuers · 4.3 anchored mongrel KPIs · 5.1 rd-cite-none
  contrast · 5.2 rd-cite target-size · 7.1 overlay links under scroll-locked modal · 8.1
  deepResearch poll leak on unmount · 8.2 live research no AI-provenance marker · 9.1
  use-modal-a11y trap fight.
- **Test-quality HIGH (5, FE-10):** 10.1 export.test assertion-gap (no injection/Infinity) ·
  10.2 pipeline views.test asserts text not borderColor · 10.3 model.test never asserts the
  mongrel intcov · 10.4 use-modal-a11y zero tests · 10.5 no e2e for /query, /model, /reports.
- FE-3 added no HIGH (worst = 1 med). The remaining 83 findings are med/low/trivial.

Cross-cutting themes:
1. **var+alpha string-concat** (`"var(--caos-x)" + "55"` → invalid CSS) — the single most
   recurrent defect: verified in FE-2 (2.1/2.2), FE-4 (4.8), FE-5 (5.3), FE-6 (6.5), FE-9
   (implicit). `sev.ts` documents fixing it yet it recurs. → codemod chip spawned.
2. **axe 0→16 regression fully root-caused**: /model×9 = 4.1, /reports×6 = 5.1+5.2,
   /pipeline×1 = 2.3. All WCAG AA, all committee/keyboard-facing.
3. **untested files == verified-defect files** (use-modal-a11y, api.ts deepResearch,
   anchored-model path, the overlay) — and where tests exist they assert *presence/value*,
   not the *honesty/validity* property (FE-10: 4 defects passed green).
4. **seam honesty mostly holds** (Report Studio fixture banners, Pipeline blocking states,
   Issuer Profile provenance) — the exceptions are labeled-but-confusing (2.4) or
   export-loses-context (8.2, 4.2), not silent fabrication.

Report-only; no app code changed. Fix chips spawned: use-modal-a11y trap stack, var+alpha
codemod, WCAG-AA axe restore.

## Verified findings

Every finding below was produced by an audit agent (5 lenses: correctness, mock-vs-live
seam, design tokens, dead code, coverage) and then independently re-verified against the
code (refute-first, adversarial-reviewer personas) before recording. File paths relative
to `caos/frontend/src/`. Audited at commit 3eb580e + uncommitted working tree.

### FE-1 Command+Monitor (10)

Audited 2026-07-03 (inline read of all 23 scope files + 1 refute-first verify
agent, adversarial-reviewer personas). All 10 findings survived; every one
PRE-EXISTING at HEAD (none introduced by the uncommitted churn).

| # | Location | Lens | Sev | Finding |
|---|----------|------|-----|---------|
| 1.1 | `components/command/views.tsx:288-289` | correctness | **med** | Δ d/d cell colors a positive move success-green (+ green bg tint) — but `dd` is a **3Y DM spread delta in bps** (`data.ts:22-23`; empirically UHCS dd +1.0 = DM spark 413→414): positive = widening = deterioration. Inverted against the sparkline rule in the same component (`:225`, dd>5 → critical), against `sections.tsx:18-21` `moveColor` (positive DM move = critical), and against its own tooltip unit. Same row can render a green +bps cell beside a red sparkline; a scanning PM reads deterioration as improvement. |
| 1.2 | `app/monitor/page.tsx:47-51, 63-64` + `views.tsx` EmailIntel/AlertFeed | seam | **med** | Monitor presents seeded CP-MON mock as live: pulsing running-dot + "LIVE · 105 msgs today", hardcoded header stats (105/4/2), sim-revealed alert feed — **zero** sample/demo/illustrative disclosure anywhere on the route (grep-verified incl. imported components; SimControls wording is aria/title-only). The command-page "Sample portfolio — not live" lens note (the adjudicated label) did not move when CP-MON was promoted to its own page (`command/page.tsx:6-8`), and the engine has no CP-MON at all (Phase-2). Fix shape: monitor-route lens note, same pattern as command. |
| 1.3 | `views.tsx:118-129` vs `:177-202`, lookup `:434` | a11y/rot | low | COL_TITLES tooltip map rotted: keys "3Y DM"/"Δ d/d"/"M2E" match no current column head (dd's head is now "Δ 1D") so 3 of 8 entries are dead and the Δ 1D column ships with no explanation; SnrLev/TotLev untitled while NetLev is. The map's own comment claims a column's meaning shouldn't depend on prior knowledge. IssuerStrip hardcodes its own "3Y DM"/"M2E" labels — not a consumer. |
| 1.4 | `views.tsx:207-216, 366-402` | a11y | low | Column-customizer `role="dialog"` popover closes only on outside-pointerdown — no Escape, no ×, while the sibling FilterHeader popover in the same header row does both (`TableColumnFilter.tsx:74, 97-104`). Not a trap (trigger re-click works) — convention gap. |
| 1.5 | `app/monitor/page.tsx:37-54` | responsive | low | Fixed `h-10` non-wrapping header: only the clock is breakpoint-gated; ungated min-content ≈1.5-1.6k px of `whitespace-nowrap` items → clipped at 1280-1440 laptop widths. The command page fixed exactly this (min-h + flex-wrap + xl/min-[1780px] gating, `page.tsx:92, 122-125, 167-169`); Monitor inherited none of it. |
| 1.6 | `SectorReview.tsx:26-31, 58-62` + `sections.tsx:151-210` + footer `:173` | seam | low | **Adjudication item.** UPDATE KNOWLEDGE is a 650ms client-side step sim with zero network calls, claiming "searching external sources: newswires · sell-side · filings · pricing services", per-source timeout/retry outcomes (seeded `reachable:false`), and a "N sources searched · issuers re-scored" receipt. In-modal disclosure is one hover-only title; the page lens note sits under the 0.72-alpha backdrop. Mitigation: honestly reports "re-scored ±0 / no change". Decide: cover under the command-page label, or add an in-modal SAMPLE chip. |
| 1.7 | `components/command/NlQuery.tsx:361-385` | dead | low | `expanded` starts `true` and the only setter call is `setExpanded(true)` → the collapsed-teaser branch (`:371-384`) is unreachable; `compact: _compact` prop accepted, never read; all callers render `<NlQuery />` bare. |
| 1.8 | `app/command/page.tsx:99` | dead | low | Empty self-closed `<span>` with classes byte-identical to the "← Directory" link's (`:93`) — leftover link chrome (hover/transition on an empty node) leaving a phantom double flex-gap slot after the divider at lg+. |
| 1.9 | `lib/command/data.ts:20, 33` + `lib/command/srdata.ts:23` | dead | low | `PortfolioRow.px` and `.watch` populated on ~380 rows, zero readers in src (filter-getter map omits both; PostureSummary counts `alerts`, not `watch`). Fallow's baseline "1 unused srdata export" = the `ImpactedIssuer` interface (type-only). |
| 1.10 | `views.tsx:1186-1190` | correctness | trivial | GapsList sort tiebreak hardcodes year: `Date.parse(requested + " 2026")` — correct for today's 4 static rows; silently NaN-degrades if the demo data's year/format changes. Record-only. |

**FE-1 coverage notes (verified):** 8 test files (incl. `stats.test.ts`); `lib/command/coverage.test.ts` genuinely covers `worstStatus`/`rollupRunToCells`/`runnableIssuerId` incl. the no-fabricated-freshness regression. Zero direct tests for `views.tsx` (1263), `SectorRV.tsx` (586), `sections.tsx` (266); riskiest untested paths = the CoverageMatrix run-poll loop (`views.tsx:982-1019`) and SectorBoard localStorage seed/persist + due-count rollup (`:656-675`, extended by the in-churn summary lift).

**FE-1 clean (spot-checked):** CoverageMatrix honesty spine (banner + Seeded chips + real-run rollup; poll with mounted/inflight guards + 180s timeout), `coverage.ts` (honest layer rollup, ponytail-marked hand-mirror ceiling), `stats.ts` (Tukey-fenced trimmed mean, null-degrade), `rvdata.ts` (credible-DM ceiling documented, n≥2 benchmark, honest N/A), RVScatter (5-95 pctile clamp, position carries signal), SortTh (`aria-sort` + real button), SectorBoard localStorage (guarded parse + Array.isArray — the FE-6 6.9 trap avoided), TimeframeBar roving-tabindex radiogroup, SectorReview live-region, EmailWindow/CitationViewer modal citizens, LiveCoverage (absent market columns not faked; finite-only fmtX), `onActivate` preventDefault double-fire refuted, NlQuery provenance chips (CP-1 LIVE/DERIVED/SEEDED + demo/seed markers + caveats), SECTOR_COLORS local palette adjudged legitimate (no categorical token set exists to bypass).

### FE-3 Deep-Dive (6)

Audited 2026-07-03 at HEAD (no churn in scope). Inline read of all 17 scope
files + `useLiveRun.ts`; verification inline (refute-first personas; the
classifier outage blocked subagents this iteration) with server-side evidence
read at the primary source for 3.1. All 6 findings PRE-EXISTING.

| # | Location | Lens | Sev | Finding |
|---|----------|------|-----|---------|
| 3.1 | `components/command/views.tsx:1165-1171` (QaQueue link) → `app/deepdive/page.tsx:88-105` + `caos/server/routes/issuers.py:145-151` + `caos/server/seed.py:17-42` | correctness (cross-group; **FE-1 addendum**) | **med** | QA-queue module drill-through is functionally dead 5-for-5: it links `/deepdive?issuer=<TICKER>&mod=…` but the page treats `?issuer=` as a PK (`ATLF_REFERENCE_ISSUER_ID` is the `a71f…` UUID, so even "ATLF" ≠ reference) and `get_issuer` is `db.get` PK-only — demo PKs are UUIDs (`11111111-…`), SXAA/QLMH/BLHP/NWCF aren't in the DB at all → every click lands "Issuer unavailable" + a RETRY that can never succeed. Honest-failing (no wrong data), but this is the advertised P1 "one click from evidence" flow. Corrects FE-1's clean-list entry for the QaQueue drill-through. Fix shape: link `?mod=` only (reference deal) or resolve ticker → id via issuers search. |
| 3.2 | `components/deepdive/IssuerChat.tsx:138-139` | correctness | low | Transcript cache `JSON.parse(localStorage.getItem(cacheKey) \|\| "[]") \|\| []` has no `Array.isArray` check — a non-array JSON value survives the `\|\|` (truthy) and `msgs.map` render-crashes the route to the error boundary until storage is cleared. localStorage = user-editable trust boundary; siblings validate (`SectorBoard` views.tsx:658-659, `layout-pref.ts:17-18`). Same class as FE-6 6.9. |
| 3.3 | `IssuerChat.tsx:155-159` + `app/deepdive/page.tsx:536-549` | a11y (class instance) | low | Raw window-level Escape listener closes the chat; chat + StepOutputModal/EvidenceModal are independently mountable, so one Escape closes the top modal AND the chat beneath it — another instance of the FE-9 9.2 stacked-Escape class (fold into that trap-stack fix). Also fires while typing in the chat's own input. |
| 3.4 | `IssuerChat.tsx:115-120, 206-218` | seam/UX | low | The 4 chat starters are ATLF-fixture questions ("Why is clearance conditional?", "What trips trigger T-1?", "Is +388bps enough…") rendered identically on the LIVE path, whose grounding (`liveContext`, :46-68) deliberately contains none of those facts — canned prompts that can only answer "not in the data" for a real issuer. Gate starters on the fixture path (or derive from live module ids). |
| 3.5 | `IssuerChat.tsx:205-241` | a11y | low | Chat transcript has no `aria-live` — assistant replies and the busy state are unannounced to AT (project convention exists: `SectorReview.tsx:115` sr-only polite status region); no focus restore on close (non-modal, so no trap — but focus drops to body). |
| 3.6 | `IssuerChat.tsx:192` | tokens | trivial | Hardcoded shadow stack (`rgba(0,0,0,0.9)` + tranche-2l ring) where every other overlay uses `var(--shadow-modal)` (EmailWindow, StepOutputModal, EvShell). Possibly intentional for the floating panel — record-only. |

**FE-3 coverage notes (verified):** 4 test files. The two honesty-critical
seams are test-locked: `issuer-chat-context.test.ts` asserts a live run's
grounding NEVER contains "Atlas Forge" (fixture-leak property) and
`ModuleView.test.tsx` asserts `allowSeededFallback={false}` renders no seeded
output. `caveat.test.ts` covers the 4-state ladder, `OutputRegister.test.tsx`
the register. Untested spine: `page.tsx` (553 — caveat/live wiring, accordion,
`?mod=` sync), `rails.tsx`, `IssuerChat` send/error/cache, bespoke tabs.

**FE-3 clean (verified):** d01820c trust-seam architecture held everywhere —
page caveat ladder (`reference`/`loading`/`live`/`noRun`, always-visible live
disclaimer <1280px), per-module ● LIVE / ◦ NO OUTPUT provenance, bespoke tabs
isolated to the reference deal, live modules shed the ATLF costume (sim
Dot/Tag, ModuleCharts, StepOutputGrid, OutputRegister suppressed with an honest
placeholder), rails render `NoIssuerRailOutput` instead of fixture stand-ins,
`EvidenceModal` prefers live evidence and shows an explicit unresolved panel on
a live run (never shadow-resolves to the seeded ATLF excerpt — the E-103
cross-issuer leak is closed), `useLiveRun` fail-safe with a ponytail-documented
21-fetch ceiling, `layout-pref`/`OutputRegister` localStorage guarded, launcher
strip edge fades + instant paging (correct reduced-motion), aria-expanded
accordion / aria-current chips / seg-bar aria-labels, `SEEDED RUN #2641` stamps
on every fixture surface incl. the step-output modal.

### FE-9 Shared fabric (15)

| # | Location | Lens | Sev | Finding |
|---|----------|------|-----|---------|
| 9.1 | `lib/use-modal-a11y.ts:81-83` (**COMMITTED in 2accf5f, 2026-07-03** — was uncommitted at audit time) | correctness/a11y | **HIGH** | New Tab-"recapture" branch breaks keyboard nav whenever two focus traps are mounted: both keydown handlers live on `window`; each sees focus outside *its* panel and recaptures, so every Tab pins focus to the last-registered trap's first focusable — cycling impossible. Reachable today: AskModal → citation chip → CitationViewer (`Ask.tsx:627`), or Alt+K over any modal (`ConceptHotkeys.tsx:37-41`). Old code no-oped safely when focus was elsewhere — this is a regression introduced by the working-tree diff. Fix shape: a module-level trap *stack*; only the top trap handles Tab/Escape. |
| 9.2 | `lib/use-modal-a11y.ts:63-64` (comment :19) | correctness/a11y | med | Escape closes ALL stacked overlays at once: `stopPropagation()` does not stop other listeners on the same target (`window`) — that's `stopImmediatePropagation` — so every mounted trap's onClose plus AskProvider's own Escape (`Ask.tsx:112-113`) all fire on one keypress. The comment "stopPropagation so nested overlays don't double-fire" is factually wrong. Pre-existing, but the churn's refcount rationale now explicitly designs for interleaved overlays. Same stack fix as 9.1. |
| 9.3 | `components/shared/Ask.tsx:250` vs `app/query/page.tsx:302-305,367-370` | seam (clone drift) | med | The Ask/Query twins drifted: Query distills the analyst's question into a theme for the shared-theme walk; Ask routes the same keywords to shared-theme but calls `queryGraph(capId)` bare — the Ask answer silently shows the server-default energy theme, not what was asked. |
| 9.4 | `components/shared/Ask.tsx:467-472` + `app/globals.css:374` | correctness | med | AskModal "PDF" button is `window.print()`, but the global print rule `body > *:not(.print-root){display:none!important}` hides everything (no `.print-root` mounts with Ask; the Query exhibit exists only on /query where Ask is disabled) — the button prints blank pages (or, on /reports, the wrong document). |
| 9.5 | `components/shared/GlobalIssuerSearch.tsx:52-57,66-83` | correctness/a11y | med | Results dropdown keyboard-inoperable beyond "Enter picks first hit": no arrow-key/combobox semantics, and the 120 ms blur timer unmounts the list as a keyboard user Tabs toward it. Violates the keyboard-operability mandate. |
| 9.6 | `lib/api.ts:20-27` + `lib/model-mode.ts` | correctness | low | Request interceptor reads localStorage unguarded on every request (`loadMode()` + `caos_query_model`); in storage-blocked contexts the throw fails all 45 importers' calls. Codebase convention guards these reads elsewhere (FirstRunHint, saveMode). Apex blast radius. |
| 9.7 | `lib/use-modal-a11y.ts:37-41,99` | correctness (latent) | low | The new `!panel` guard sits in a `[]`-deps mount-once effect, so the always-mounted-render-null consumer shape the comment advertises would never engage trap/lock on open. All 10 current consumers dodge it via conditional mount (verified one by one) — contract/comment gap only, no defect today. |
| 9.8 | `lib/api.ts:197-198` | dead | low | Stale suppression (fallow-confirmed): `// fallow-ignore-next-line unused-export` on `createRun` + "kept ahead of its UI consumer" comment are obsolete — consumer exists (`components/command/views.tsx:25,1008`). Suppression would mask a real unused-export warning later. |
| 9.9 | `components/shared/AnalystBadge.tsx:18-27` | correctness | low | Failed `logout()` leaves the badge disabled forever: `setBusy(true)` never reset (no catch, no `setBusy(false)`), rejection propagates unhandled, no user-visible error. |
| 9.10 | `components/shared/Notifications.tsx:15-17` | correctness | low | Toast id is `Date.now()` — same-millisecond notifies collide: duplicate React keys and one timer dismisses both toasts. |
| 9.11 | `components/shared/IssuerLink.tsx:24-33` | correctness/UX | low | `handleClick` unconditionally `preventDefault()`s a real `href` — cmd/ctrl/shift-click (open in new tab, desk-standard) is hijacked into the same-tab overlay. Bail on modified/non-primary clicks. |
| 9.12 | `components/shared/TableColumnFilter.tsx:72-85,101` | a11y | low | Closing the filter popover (Escape / outside-pointer / ×) never restores focus to the trigger — keyboard users land on `<body>`. Its window-level Escape also joins the 9.2 stacking pile inside modals. |
| 9.13 | `components/shared/ConceptNav.tsx:91-109` | a11y | low | Active concept link lacks `aria-current="page"`; in compact mode the you-are-here state is visual-only (bg + label visibility) with no programmatic equivalent. |
| 9.14 | `components/charts/G2Chart.tsx:162-164` | a11y/perf | low | Chart container has no accessible name/text alternative (WCAG 1.1.1), and the rebuild effect keys on `spec` object identity — a caller passing a fresh spec per render (timer-driven pages) triggers full destroy/rebuild churn. |
| 9.15 | `components/shared/GlobalIssuerSearch.tsx:60,64` | correctness (copy) | low | Hint chip/tooltip advertise "SP+S"/"Space+S" but the binding is **Alt+S** (`ConceptHotkeys.tsx:31,36`) — UI teaches a dead chord. |

### FE-6 Query (14)

| # | Location | Lens | Sev | Finding |
|---|----------|------|-----|---------|
| 6.1 | `app/query/page.tsx:194-196,452,494-499` + `:594` | seam | med | Themed shared-theme runs silently swap to the default theme on the history-replay and rail-pick paths: `pick()` never passes `themeArg` (3eb580e fixed only the two submit lanes), and the Risk-theme box renders stale `value={theme}` over the default-theme answer — box says "tariff", graph shows energy. |
| 6.2 | `app/query/page.tsx:760-782` | correctness/a11y | med | Sub-lg Evidence slide-over is a bare `role="dialog"`: no `aria-modal`, no focus trap, no Escape, no focus restore — while the codebase convention (`useModalA11y`) is used by sibling modals (VaultMemoUpload, CitationViewer). |
| 6.3 | `app/query/page.tsx:463-464,485-530` | correctness/a11y | med | Recent/Runnable-now dropdown unreachable by keyboard: input `onBlur` unmounts it before Tab lands, activation is `onMouseDown`-only, no combobox/listbox semantics or arrow-key nav. |
| 6.4 | `components/query/QueryPrintSheet.tsx:325-346` | print honesty | med | Scatter-native walks print through the force-graph `PrintChart`: the committee exhibit drops the gridlines, 0→1 ticks, and axis overlay the screen shows (`ScatterCanvas.tsx:116-186`) and permanently draws hover-only edges — printed positions are undecodable. |
| 6.5 | `components/query/EvidenceDock.tsx:302-303`, `RelativeValueTable.tsx:306-308`, `node-style.ts:67,84` | correctness/tokens | med-low | `"var(--caos-…)" + "55"` string-concat produces CSS invalid at computed-value time on every render: confidence-chip borders collapse to full-strength currentColor, bg tints to transparent; in node-style the `hueFor()` null-group fallback feeds `var(--caos-muted)33` into an SVG `fill` → black node on `#0a0a0f` (latent — needs group-less node). `RelativeValueTable.tsx:243-244` handles this exact trap, proving the idiom was known. |
| 6.6 | `app/query/page.tsx:207-211` | correctness | low-med | `refreshGraph` (post-ratify/retract) has no `runSeq` guard — a slow resolve after the user picks a new walk clobbers the new graph with the stale capability's payload, mismatching header/chip against content. `run()` itself documents and enforces exactly this contract. |
| 6.7 | `lib/query/export.ts:12` | seam/print honesty | low-med | CSV header exports the raw engine mode enum — the same defect 3eb580e fixed in the print masthead (leverage scatter reads "concentration"); `capability_id` isn't exported at all. |
| 6.8 | `lib/query/export.ts:4-8` | correctness/security | low | `csvCell` escapes quotes/commas but not spreadsheet formula injection — labels/memo filenames beginning `=`,`+`,`-`,`@` execute on Excel open (CWE-1236). |
| 6.9 | `app/query/page.tsx:101-108` | correctness | low | `JSON.parse(localStorage)` set as history with no shape check — a corrupted/legacy entry crashes `addToHistory`/render outside the try/catch (localStorage is a user-editable trust boundary). |
| 6.10 | `components/query/RelativeValueTable.tsx:148-152` | a11y | low | Sortable `<th>` carries `role="button"` (overriding columnheader semantics for AT) and sort state has no `aria-sort`. Keyboard operability itself is fine (Enter/Space handled). |
| 6.11 | `components/query/GraphCanvas.tsx:13,18,33,299,399,417,453`, `ScatterCanvas.tsx:300` | tokens | low | One-off hex greys (`#f0f0f6`, `#9a9aac`, `#a6a6b8`, `#aeb9d4`, `#5f6f8f`, `#4a4f66`, `#3a4a6a`) bypass both `--caos-*` tokens and the sanctioned `CHART_HEX` mirror (which is documented and exact — verified). |
| 6.12 | `components/query/RelativeValueTable.tsx:121` | correctness | low | Confidence column sorts alphabetically (High < Low < Medium) — semantically wrong in both directions on a ranking view. |
| 6.13 | `components/query/LineageFlow.tsx:86-91` vs `:205-225` | correctness | low | SVG connector endpoints are computed as percentages of the full container while cards are laid out by flex `justify-around` below a title block in scrollable columns — two decoupled layout systems; endpoints miss cards and detach when a column scrolls. |
| 6.14 | `components/query/GraphCanvas.tsx:122`, `ScatterCanvas.tsx:74`, `LineageFlow.tsx:196-197` | tokens/motion | low | Motion drift: reset-zoom animates 180 ms while its own comment claims the 160 ms system rhythm; LineageFlow's `motion-reduce:transition-none` class is defeated by the inline `style={{transition:"opacity 160ms"}}` (inline beats class; the global reduced-motion block only covers `.caos-*`/`.transition-caos`). |

### FE-7 Issuer Profile (11)

Audited at 2accf5f. Overlay + provider mount in root layout (`app/layout.tsx:44,46`) and
survive client navigation — that mount shape drives 7.1.

| # | Location | Lens | Sev | Finding |
|---|----------|------|-----|---------|
| 7.1 | `app/issuers/profile/ProfileContent.tsx:590,610-616,373,505` | correctness | **HIGH** | In overlay mode every internal link (OPEN DEEP-DIVE, the bottom issuer-actions bar — which the comment at :605-607 calls "the only issuer-context route to the other concepts" in overlay mode — `▸ src`, run-history rows) navigates the route *underneath* the still-open, scroll-locked modal: nothing closes on pathname change, and success-path links carry no `onClose` while the error-path link proves the intent (`IssuerProfileOverlay.tsx:202` has `onClick={onClose}`). Fix: `onClick={onClose}` on overlay-mode links, or close-on-pathname-change in the provider. |
| 7.2 | `ProfileContent.tsx:336-338,357` | correctness/seam | med | Flat period-over-period delta painted directional: `(delta >= 0) === d.higherIsBetter ? "pass" : "high"` — zero delta on net leverage renders red `+0.00×` (claimed deterioration), zero on revenue renders green — contradicting 2accf5f's own "'re-scored ±0'/'no change' instead of a claimed delta" standard. |
| 7.3 | `ProfileContent.tsx:428` + `lib/issuer-profile-charts.ts:170-180` | dead/correctness | med | `buildCharts` emits up to 4 specs in fixed order [financials, margin, leverage, coverage] but the panel renders `charts.slice(0, 2)` — whenever financials+margin exist (any normal multi-period run) the net-leverage and interest-coverage trends are computed then unconditionally discarded; the lib comment "appear only once ≥2 periods land" describes a state the UI can never show. |
| 7.4 | `components/shared/IssuerProfileOverlay.tsx:105,185-188` | correctness | med-low | First painted frame of every open is the failure branch — `loading` initializes `false` with `data=null`, the fetch effect runs post-paint, so "No data." + CLOSE/OPEN DEEP-DIVE flash before "Loading profile…". Pre-existing, but amplified since 2accf5f mounts the modal fresh per open (with `caos-enter`). Initialize `loading=true` or gate on a `fetched` flag. |
| 7.5 | `app/issuers/page.tsx:263-268` | correctness/UX | low | Recurring pattern (= 9.11): unconditional `preventDefault()` on the register row's real `href` hijacks cmd/ctrl/shift-click into the same-tab overlay. |
| 7.6 | `components/shared/IssuerProfileOverlay.tsx:51-88` | correctness | low | `openProfileByQuery` has no sequence guard — two rapid free-text opens can resolve out of order and the slower first query's `openProfile()` overwrites the issuer the user asked for last. |
| 7.7 | `ProfileContent.tsx:543-549` | seam | low | Manual ratings (mig 0014) render implied-live in the header chip — tooltip is just `` `${r.ag} rating` `` with no "on file"/analyst-entered cue; the register row does it right (`app/issuers/page.tsx:281` "…(first on file)"). |
| 7.8 | `ProfileContent.tsx:495` | seam | low | Minors-only QA state renders "Open QA findings 0 crit · 0 mat" (and not as a warning) — `totalFindings` includes MINOR so the non-"none" branch fires, but the count string hides the findings that triggered it. |
| 7.9 | `ProfileContent.tsx:457` | correctness/copy | low | Percentile ordinal always "th": "62th/71th/1th pct" on the committee-facing Relative value band. |
| 7.10 | `app/issuers/page.tsx:275` + `ProfileContent.tsx:535,539-540,546` | tokens | low | `group-hover:text-[#f2f2f7]` bypasses `--caos-*`; inline px font sizes (`fontSize: 16/14/11` + `text-[10px]`) bypass the type scale; :540 stacks `text-caos-xs` with an inline `fontSize: 11` override. |
| 7.11 | `ProfileContent.tsx:402,448-450` | seam | low | Silent hidden-tail truncations (`ms.slice(0,2)`, business facts `.slice(0,2)/(0,1)`) with no "+N more" cue — unlike Run history which titles `· ${runs.length}` honestly. |

FE-7 coverage: freshly-split `IssuerProfileOverlay.tsx` has zero tests (open/close, stale-guard on issuerId change, error→Deep-Dive fallback, overlay-mode rendering — an overlay-mode test would catch 7.1 and 7.4); TILE_DELTA/deltaSev logic untested (would catch 7.2); nothing pins the `slice(0,2)` chart contract (7.3). `issuer-profile-charts.test.ts` itself is strong. FE-7 clean list: `lib/issuers.ts`, chart math, domain contract (no LLM/engine compute — read-models only), server provenance vocabulary handled loud, stale flags preserved on all three fetch effects post-split, no overlay-added window key handlers, motion clean, no alpha-concat/Date.now/unguarded-localStorage.

### FE-4 Model Builder (12)

Audited at 2accf5f. The axe-baseline critical is 4.1; the two seam HIGHs (4.2, 4.3) are
committee-trust defects on live issuers.

| # | Location | Lens | Sev | Finding |
|---|----------|------|-----|---------|
| 4.1 | `components/model/ModelSheet.tsx:270,324,402` | a11y | **HIGH** | The axe `aria-required-children` CRITICAL ×9 decomposes exactly: ×1 the `role="grid"` whose first child is the un-roled sr-only live region (:270 — global ARIA attr makes axe treat it as owned); ×4 section `role="row"`s (:324) containing only un-roled divs (no gridcell/rowheader); ×4 collapsible rows whose ▸/▾ `<button>` (:402) sits in an un-roled sticky div directly under `role="row"`. Fix: move the live region outside the grid; `role="rowheader"` on sticky label divs (button then legally in-cell); section dividers → `role="presentation"` (or rowheader + aria-colspan); header strips (:275,:297) → `role="row"` + `columnheader`. |
| 4.2 | `components/model/ModelSheet.tsx:459,539-548` + `components/model/rows.ts:58,92,96` + `:472` | seam | **HIGH** | FormulaBar shows fabricated ATLF lineage to LIVE issuers: `src = row.src ? SRC[row.src] : null` has no `isReference` gate, so the SRC chip, L-04 warn chip, and E-xx evidence chips (which open seeded ATLF evidence) render for live names — while `Manifest` (:556-560) gates on exactly this with the comment that presenting SRC for live issuers "would fabricate lineage". ATLF-specific `formula` strings ("anchored to CP-2E beginning liquidity register ($184M Mar-26)", "2L bridge to May-26") and the derived-period note "Q4-25 management accounts missing (gap G-02)" (:472) also render live. 99ada2f's ATLF-residue fix covered refNote/Manifest/export masthead but not this block. |
| 4.3 | `lib/reports/model.ts:195-207` + `lib/engine/modelAnchor.ts:15,63` + `lib/model/scenarios.ts:135` + `components/model/rows.ts:58` | seam | **HIGH** | `applyAnchor` re-bases only rev/adj/ndebt/cash on the live-anchored columns (partial re-base is documented intent — debt stack stays seeded, cash back-solved), but the follow-on defects are not: `deriveCreditKpis` computes `intcov = adj/int` = live adj over SEEDED ATLF interest — a fabricated coverage — while the anchor's REAL reported `intCov` (modelAnchor.ts:63) has zero consumers; `totlev`/`srsec`/`fcfdebt` are the same live/seeded mongrels (only `netlev` is honestly anchored); `c.cash = c.tdebt − a.netDebt` goes negative for any live issuer with net debt above the seeded stack and that cash seeds the ScenarioPanel roll-forward (`scenarios.ts:135 cash0: l1.cash`); the rows.ts:58 formula "Total revenue = Σ divisions" is false in anchored columns (segments not re-based); the "✓ ties to CP-1" badge ties by construction and blesses the grid. |
| 4.4 | `components/model/ModelSheet.tsx:469-471` | seam | med | Live-issuer FormulaBar caseNote labels grid DOWN columns "downside = CP-2B first-order EBITDA-shock pathway" — false: live DOWN columns are seeded ATLF P1 shapes + sliders; the real live CP-2B read lives only in ScenarioPanel (the ab4c07d data boundary held; the label lies). |
| 4.5 | `app/model/page.tsx:134-148` | correctness | med | `getSavedModel(issuerId).then(…)` has no stale/cancel guard (contrast `useLatestRun`'s `cancelled` flag): switching issuer A→B mid-flight applies A's payload under B, and since `setHydrated(true)` runs synchronously (:146) the persist effects (:150-151) then durably write A's model into B's localStorage keys — re-opening the cross-issuer contamination 99ada2f closed. |
| 4.6 | `lib/model-mode.ts:21` (+ `lib/api.ts:22`) | correctness | med-low | Same root as 9.6: `loadMode()` reads localStorage outside try/catch and runs in the axios interceptor on every request; `saveMode` is guarded, `loadMode` isn't. |
| 4.7 | `app/model/page.tsx:191` | correctness | low | `hasIssuerModel = isReference || !!eng.anchor` ignores `eng.loading` — a live issuer flashes the definitive "No issuer-specific model output" empty state + Deep-Dive CTA during the engine round-trip. |
| 4.8 | `components/model/cell-style.ts:80,82,92` + `ModelSheet.tsx:287` | tokens | low | Selection/flash chrome hardcodes `rgba(79,140,255,…)` — duplicating the `--tranche-2l: #4f8cff` token value (cell-style.test locks the literals in); inline `transition: "background 160ms"` omits the mandated ease-out. |
| 4.9 | `components/model/export.ts:31` | correctness | low | `round3` guards `Number.isNaN` only — ±Infinity survives into the committee CSV as "Infinity" (reachable: override a historical rev to 0; the grid's `fmt` blanks these via `Number.isFinite`, the export doesn't). |
| 4.10 | `components/model/ModelSheet.tsx:142-163` | a11y/UX | low | 99ada2f's keyboard-trap fix HELD (Tab at the boundary releases), but Tab is still hijacked per-cell for traversal — exiting forward costs one Tab per remaining cell (~600). APG grid pattern is Tab-exits, arrows-navigate. |
| 4.11 | `components/model/ModelSheet.tsx:249,198` + `ScenarioPanel.tsx:75` | a11y | low | The ■/▲ distress glyph (added so KPI distress isn't color-alone) is `aria-hidden` and the live-region summary reads only label·period·value — SR users get no distress signal; ScenarioPanel's per-shock breach cell is color-only. |
| 4.12 | `components/model/rows.ts` (`line:` fields) + `cell-style.ts:62-64` + `lib/engine/modelAnchor.ts:15` + saved `view:{}` payload | dead | low | Positive-evidence dead code: `row.line` typed/passed/never read (total-rule styling dropped in the port); `bold ? "var(--caos-text)" : "var(--caos-text)"` identical branches; `ModelAnchor.intCov` zero consumers (see 4.3); saved-model `view:{…}` written on save, restored nowhere. |

FE-4 coverage: the anchored path is the zero-test money path — no test calls `buildModel`
with an anchor (4.3 entirely unlocked); FormulaBar's `isReference` suppression untested
(exactly where 4.2 sits); save lifecycle tests lock only the F3 failure alert (4.5 race
untested). model-format/cell-style/scenarios/modelAnchor-adapters/ScenarioPanel well
covered. Clean: scenarios.ts math, downsidePathway, useModelEngine (fault-isolated),
useLatestRun (cancel-safe), adapt.ts, model-format (rejects NaN and ±Inf), export CSV
quoting, AssumptionsPanel, keyhole guard, recurring-pattern sweeps all negative (no
alpha-concat, no Date.now keys, no href hijack, no Escape stacking, page.tsx storage
reads try-wrapped).

### FE-5 Report Studio (5)

Audited at 2accf5f. Default surface is the ATLF reference template (`isReference`), so trust
markers (red fixture banner, watermark, "REFERENCE TEMPLATE — not a live issuer run") are on
screen — the b9f80a6 trust pass held. Both /reports axe leads anchored below.

| # | Location | Lens | Sev | Finding |
|---|----------|------|-----|---------|
| 5.1 | `app/globals.css:275` (`.rd-cite-none`) rendered at `components/reports/ReportDoc.tsx:248` | a11y/tokens | **HIGH** (axe) | The axe color-contrast SERIOUS ×2: `.rd-cite-none` ("no registered evidence id") is `#8a8a93` on the cream paper ≈ **3.14:1** (fails 4.5:1, and fails on white/cool too). The default `snapshot` report's `srcs` carry exactly 2 empty-`ev` entries — `CP-6A 06` and `M-118` (`lib/reports/builders.ts:204-205`) → exactly 2 rendered `.rd-cite-none` spans = the axe ×2. Since it's the light paper, judge against ink-on-cream: darken to ~`#6a6a72` or heavier. |
| 5.2 | `components/reports/ReportDoc.tsx:232-241` + `app/globals.css:271` (`.rd-cite`) | a11y | **HIGH** (axe) | The axe target-size SERIOUS ×4: the "Open source E-*" citation buttons are `.rd-cite { font-size: 8px; padding: 0 3px; }` — zero vertical padding, no min-height/width → ~12-14px × ~20px, far under WCAG 2.2 (2.5.8) 24×24. Snapshot renders 6 such buttons (E-103/E-12/E-15/E-09/E-63/E-71); the 4-vs-6 count is an axe dedup artifact, the defect is per-chip. |
| 5.3 | `components/reports/panels.tsx:14-18` (`StatusTag`) | tokens | med | Recurring var+alpha concat (= 6.5 / 4.8 / FE-2 2.1): `c = "var(--caos-warning)"` then `borderColor: c + "55", background: c + "14"` → `var(--caos-warning)55`, invalid CSS silently dropped; the HELD/READY deliverable pill renders with no border/wash. Every other color in scope correctly uses `color-mix()`. |
| 5.4 | `components/reports/ReportDoc.tsx:64-73` (`.rd-revert-dot`) | a11y | med | The per-field "Revert override" control is a `w-1.5 h-1.5` = **6px × 6px** interactive button (far under 24×24) and uses raw `transition-transform hover:scale-125` not `.transition-caos`. Edit-mode only, so not in the default axe run — an un-flagged second target-size violation. |
| 5.5 | `components/reports/panels.tsx:114` (LineagePanel) | seam | low | Footer asserts "**Every** figure … resolves to a producing module **and a registered evidence ID**", but 2 of the snapshot's 7 sources carry `ev: []` and the paper itself honestly prints "no registered evidence id" for them — an absolute-copy overreach contradicting the on-paper chips, not fabricated provenance. |

FE-5 coverage: `builders.test.ts` (cap-structure tie-out) and `EvidenceModal.test.tsx`
(live-vs-seeded resolution, cross-issuer isolation) are solid. Gaps: no test asserts the
fixture-disclaimer banner/watermark renders on the paged IC Memo (the core "never mistaken
for a live run" property — would lock b9f80a6 against regression); no test on `RDSources`
empty-ev rendering (the element that fails contrast, 5.1). Clean: EvidenceModal refuses to
shadow-resolve a live-run id to the seeded ATLF excerpt; non-reference issuers render no
report with an honest caveat; model figures consumed via NaN/Infinity-guarded formatters (no
4.3 mongrel leak); PrintPortal `.print-root` prints the sheet (no 9.4 blank-print); no
Date.now keys, no window-Escape stacking (zoom shortcut is editable-guarded + element-scoped
Escape), localStorage try-caught, ExportToVaultButton posts a runId (no CSV/Infinity path).

### FE-2 Pipeline+Upload (6)

Audited at 2accf5f. Sim-vs-live boundary is otherwise well-guarded (honest blocking states,
seeded-QA suppression under live); the defects cluster in status-color rendering.

| # | Location | Lens | Sev | Finding |
|---|----------|------|-----|---------|
| 2.1 | `components/pipeline/views.tsx:133,195` | correctness/tokens | **HIGH** | The recurring var+alpha concat, worst instance: `color = SEV_COLOR[st]` resolves to `var(--caos-*)` for every non-idle node state (pass/warning/critical/accent/held/blocked), so `color + "66"` (:133) / `color + "55"` (:195) emit `var(--caos-warning)66` — invalid, dropped → **every colored node loses its status border** on the pipeline DAG. `lib/pipeline/sev.ts` itself documents fixing exactly this ("the old `color + "44"` string was invalid for the var-based entries and silently dropped the tint") — the fix didn't reach the node renderer. |
| 2.2 | `components/pipeline/views.tsx:324-326` | tokens | med | Same invalid concat in the required-docs tag: `REQ_TAG_COLOR` values are all `var(--caos-*)`, so `borderColor: …+ "55"` / `background: …+ "14"` are invalid → tag border/wash dropped. |
| 2.3 | `components/pipeline/views.tsx:~400` (EvChip) + `EvidenceModal.tsx:41` | a11y | med | The axe target-size SERIOUS ×1: the pipeline EvChip is `px-1 py-px text-caos-xs` (~18×20px, under 24×24) in a `flex flex-wrap gap-x-1 gap-y-2` — neighbors 4px (x) / 8px (y) apart, both <24px; the inline comment claiming `gap-y-2` "keeps ≥24px touch-target spacing" is false (gap-y-2 = 8px). |
| 2.4 | `app/pipeline/page.tsx:297-308,327` | seam | med | The DEMO toggle appears for a non-reference issuer with a complete run, and flipping it renders "Atlas Forge — {mode.title}" / "RUN #2641" with the seeded ATLF clearance verdict inside a real issuer's context. It IS labeled "Atlas Forge" (not silent fabrication), but DEMO is meaningless under a real issuer and the toggle's own title text ("Live CP-X run for the reference issuer") is wrong there. |
| 2.5 | `components/pipeline/views.tsx:91` | tokens | low | Hardcoded hex edge strokes where a token exists: downstream edge `#a855f7` though `--tranche-sub` is exactly that; idle edge `#4a4a60` has no token. |
| 2.6 | `lib/pipeline/useLivePipeline.ts:94` → `views.tsx:418` | correctness | low | `buildLiveSnapshot` maps live events with `t: ""`, so under a live run the EventLog time column renders blank (the sim fills `simClock`). Cosmetic, not wrong data. |

FE-2 coverage: sim-engine/clearance/sev/useLivePipeline/liveOutcome well-covered incl.
fail-closed (unknown→warning, Blocked→critical, isLive suppresses seeded QA). Gaps: no test
on the invalid var+alpha border concat (2.1/2.2 — a computed-style assertion on a warning
node's `borderColor` would catch the dropped tint); no page-level test that the DEMO toggle
is hidden/renamed for a non-reference issuer (2.4); ResultStep `zeroCount` (scanned-PDF→0-chunks
honesty) has no render test. Clean: `stepSim` no `dur:0`, `Bar` guards NaN/Infinity/total=0,
sim speed ∈{1,2,4}, EventLog keys position-stable (no Date.now), `useLatestRunStatus` race-safe
(cancelled flag), upload/EDGAR status truthful (0-chunks→warning, 503→not-configured, per-file
error rows), reduced-motion kills pulse/enter/flash, color never carried alone (glyph/label
pairing), no href hijack, localStorage try-caught.

### FE-8 Research+Settings (5)

Audited at 2accf5f. Markdown XSS surface is closed (react-markdown, no rehype-raw/
allowDangerousHtml; links `rel="noreferrer"`). `research-prefs.ts` localStorage is guarded
both sides. No var+alpha concat anywhere in scope.

| # | Location | Lens | Sev | Finding |
|---|----------|------|-----|---------|
| 8.1 | `lib/api.ts:421-450` (`deepResearch`) consumed at `app/research/page.tsx:110-141` | correctness | **HIGH** | The poll loop `while (Date.now() < deadline)` runs to `_RESEARCH_DEADLINE_MS` (~15 min) with no cancel param, and `run()` awaits it (:129) with no AbortController/isMounted guard — navigating away mid-research keeps polling `/api/research/{id}` every ~2s and fires `setProgress`/`setResult`/`setRunning` on an unmounted component for up to 15 min. Confirms the FE-9 below-threshold note; this group owns it. |
| 8.2 | `components/research/ReportPane.tsx:157-186` (ResultView footer) | seam | **HIGH** | A live (non-demo) Deep Research tear-sheet carries no AI-generated/synthesized/unverified marker — masthead "Deep Credit Research", "EXPORT PDF", footer just "CAOS · Credit Agent OS" + source count; only the *demo* branch says "Illustrative". Sibling Report Studio establishes the house provenance line ("Generated by CREDIT OS · CP-RENDER", `ReportDoc.tsx:361,405`) precisely so an exported paper can't be circulated as authoritative. Calibration: analyst knows it's AI in-context, but the exported PDF loses that context. |
| 8.3 | `app/settings/page.tsx:149-153` (`save`) + `lib/research-prefs.ts:49-53` | seam | med | Research-defaults "Saved" confirmation is unconditional — `savePrefs` swallows a persist failure (private mode/quota) and returns void, so `save()` sets `saved=true` regardless. Contrast the analyst-settings path (`saveAnalyst`), which surfaces `analystErr` on failure. |
| 8.4 | `app/settings/page.tsx:137,142` | correctness | low | Raw unguarded `localStorage` for the query model — `getItem` (:137) throws in the mount effect (aborting the sibling `getAnalystSettings` call at :138) and `setItem` (:142) throws in `changeQueryModel`, in storage-disabled contexts. Distinct from `research-prefs.ts` (guarded) and from 9.6 (api.ts interceptor) — this is settings/page.tsx's own. |
| 8.5 | `app/settings/page.tsx:152,160` | correctness | low | `window.setTimeout(() => setSaved(false), 2000)` (and the `analystSaved` twin) are never cleared — saving then navigating within 2s sets state on an unmounted component. The elapsed-timer at `research/page.tsx:87` shows the correct cleanup pattern. |

FE-8 coverage: `settings-models.test.tsx` covers only the Models tab (not the Research tab or
`savePrefs`); no test asserts `deepResearch` stops polling on unmount (8.1) or that a live
report renders an AI-provenance marker (8.2). Clean: ReportBody markdown (no raw HTML,
safe links), research-prefs guarded, motion compliant, toggles keyboard-operable
(role="group"/aria-pressed), no Date.now keys, no href hijack.

### FE-10 Tests + e2e (8)

Meta-audit of the test suite's protective quality (not the app code). **Mechanically
disciplined** — 0 `.only`, 0 `.skip`/`xit`/`.todo`, 0 `expect(true)`, 0 unmocked
`Date.now`/`Math.random`, 0 snapshot-only/no-expect files, strong `cleanup()` (19/19),
Playwright `globalSetup`+`storageState` 429-fix correctly wired. **Semantically it
under-protects the money paths** — the dangerous class is assertion-gaps (green test
exercises the buggy code) over coverage-gaps.

| # | Location | Lens | Sev | Finding |
|---|----------|------|-----|---------|
| 10.1 | `lib/query/export.test.ts:6-29` | assertion-gap | **HIGH** | Titled "Excel-safe escaping" but asserts only `""`-quote/RFC-4180 escaping — `csvCell` guards `/[",\n]/` only, never prefix-neutralizes formula triggers (`=`/`+`/`-`/`@`), so the injection (6.8) exports live and the test *cements the wrong safety property*; also never exercises Infinity/NaN weights (6.7). |
| 10.2 | `components/pipeline/views.test.tsx` | assertion-gap | **HIGH** | Renders the exact components carrying the var+alpha concat (2.1) but asserts only text presence (`getByText`), never computed `borderColor` — `color + "66"` / `REQ_TAG_COLOR + "55"` yield invalid CSS and drop the border, test passes green. A `getComputedStyle(...).borderColor` assertion on a warning node would catch it. |
| 10.3 | `lib/reports/model.test.ts:97-137` | assertion-gap | **HIGH** | The live-anchor block asserts `rev/adj/ndebt/netlev` (all honest) but never `intcov` — even though the `ANCHOR` fixture carries `intCov: 2.0` (:19). `applyAnchor` recomputes `intcov` from the *seeded* interest line (mongrel-KPI 4.3) and no assertion catches the live-EBITDA ÷ seeded-interest coverage. |
| 10.4 | `lib/use-modal-a11y.ts` (whole file) | coverage-gap | **HIGH** | Zero tests for the app's only focus-trap/scroll-lock hook — which owns a module-global `scrollLockCount` shared across every modal — so the HIGH stacked-trap bug (9.1) and the interleaved open-B/close-A unlock path have no regression guard. jsdom-testable with two mounted traps. |
| 10.5 | e2e route coverage (`caos/tests/frontend/e2e/`) | coverage-gap | **HIGH** | Only `/research`, `/settings`, `/upload` have real e2e specs; **`/query` (the cross-issuer money surface this branch exists for), `/model`, and `/reports` (export) have zero e2e** — the highest-value analyst money paths are unprotected end-to-end. |
| 10.6 | `components/model/cell-style.test.ts:74-93` | assertion-gap | med | Locks hardcoded rgba literals as the expected value (`rgba(79,140,255,0.28)` etc.) rather than asserting derivation from a `--caos-*` token — cementing the token violation (4.8) and *actively resisting the fix* (correcting the code to color-mix would fail the test). The `isSel` assertion correctly uses the token; the cellHl/colHl/shade ones don't. |
| 10.7 | `caos/tests/frontend/e2e/research_flow.spec.ts:44-86` | e2e-honesty | med | The only "run research" e2e stubs `/api/research` at the network boundary and asserts on canned markdown + the DEMO badge, so it validates fixture render, not live wiring — it would pass even if research wiring broke. (Comment is honest, but it's the sole run-path test.) |
| 10.8 | `components/model/ScenarioPanel.test.tsx` | assertion-gap | low | Weakest assertion ratio in the suite (17/21 are `toBeTruthy/toBeNull/toBeDefined`) — worth a spot-check that scenario-delta assertions pin numeric outputs, not element presence. Ratio outlier, not confirmed vacuous. |

FE-10 meta: of the verified app defects, **2.1 / 6.8 / 4.3 / 4.8 all had tests that exercised
the exact buggy code and passed green** (assertion-gaps — false confidence, the more dangerous
class); only 9.1 is a true no-test coverage-gap. The pattern: tests assert *a value* or
*presence*, not the *honesty/provenance/validity* property that matters (border resolves to
valid CSS; live anchor reaches the KPI; export is injection-safe; color comes from a token).
Clean/genuinely protective: `issuer-profile-charts.test.ts`, `sev.test.ts` (pins the *fixed*
color-mix triple), `modelAnchor.test.ts`, `settings-models.test.tsx`, `node-style.test.ts`,
`builders.test.ts` (CP-3B tie-out to 3,270), `questions.test.ts` (fresh fixture per call, no
singleton leak), `model.test.ts` forecast/rebasing block.

### Coverage notes (verified)

- **FE-6:** lib/query tests green but thin exactly where the branch churned — `themeFromQuery` + the submit/keyword/model-route fallback matrix live inline in `page.tsx` with zero tests; QueryPrintSheet's new ~174 lines (fit transform, wrap, view gating) untested; `capLabel` duplicated verbatim `page.tsx:53` ↔ `QueryPrintSheet.tsx:55` with no shared source (masthead/chip labels can drift silently).
- **FE-9:** the two riskiest files are exactly the untested ones — `use-modal-a11y.ts` (just rewritten; findings 9.1/9.2/9.7 are all jsdom-testable with two mounted traps + Tab/Escape assertions) and `api.ts` (45 importers; no test for the deepResearch poll loop or interceptor). `AuthProvider`/`RequireAuth` 401-vs-network-error split untested.
- Below threshold, noted un-verified: `app/not-found.tsx` "Back to Command Center" copy vs `/` redirecting to /issuers; `api.ts deepResearch` polls up to 15 min with no cancellation for unmounted callers; `LoginLanding` `role="tablist"` without the ARIA tabs keyboard pattern.

### Clean (verified by auditors, spot-checked)

FE-6: `lib/query/graph.ts` (20-importer contract sound), synthesis/questions/format/viz/types/views, QuestionRail, VaultMemoUpload (model modal citizen), EvidenceDock UUID churn. FE-9: CloseButton, CollapseButton, StatusGlyph, FlashOnChange, Panel, SectionHeader, StatCard, headStat, styles.ts, PageSubHeader, RouteHeading, FirstRunHint, RailShell, TextInput, the three toggles (aria-pressed), FlagToQa (ATLF id honest), ConceptHotkeys, evidence-sync, a11y.ts, format.ts, citations.ts, chart-colors.ts, issuers.ts, research-prefs.ts, layout/page/error/global-error, globals.css (tokens match CLAUDE.md exactly; reduced-motion honored).
