# CAOS Surface Redesign Plan

Produced 2026-07-17 against branch `codex/112` (working tree as-is), per
[SURFACE_TRIAGE_REDESIGN_BRIEF.md](SURFACE_TRIAGE_REDESIGN_BRIEF.md). Method and
evidence provenance in §8. Every score, count, and measured rect in this
document traces to a tool run from the triage session; every P0/P1 carries a
verification tag: **[LIVE]** driven in the running qa3 stack, **[SRC]** confirmed
by an independent fresh-context verifier reading the cited lines, **[PIX]**
confirmed in captured pixels, **[API]** confirmed against the running backend.

---

## 1. Verdict

CAOS does not have a design-system problem — its tokens, motion rules, state
vocabulary, and provenance chrome are unusually strong and self-aware. It has an
**enforcement and parity problem**: the two highest-frequency primitives in a
data terminal (button, table) don't exist as components, so 18 surfaces
renegotiate size, alignment, and disabled-behavior per author; the seeded
showcase path got the craft while the live path that analysts actually deploy on
renders worse (unaligned tables, silently truncated registers, greenwashed QA
states); and a handful of hardcoded "computed" assertions — a fixture run-id on
every committee masthead, a citation audit that always reports clean — actively
fabricate trust. Scores land 23–32/40 across all 19 targets (mean 27.4, zero at
the ≥35 bar), with five verified P0s. The plan: stop the fabrication and
data-loss P0s first (small diffs), then land the missing primitives and the
live-path parity program that prevent the drift from regrowing, then close
per-surface findings in dependency order. All fixes fit inside the existing
design contract; no surface needs a contract change to reach 35.

---

## 2. Score table

Scores are this session's Nielsen /40 (impeccable heuristic guide, fresh-context
assessor per target, isolated from detector/browser evidence). "P0" counts
findings meeting the brief's P0 bar. Targets are credible post-plan scores; the
per-surface finding→heuristic mapping backing each target is in §4.

| Surface | Now /40 | Target | P0 | Principal delta drivers |
|---|---|---|---|---|
| Global chrome | 29 | 37 | 0 | Palette text-drop + scroll-blind highlight + Esc cascade (C7); durable notifications (C9); help discoverability |
| Command Center | 28 | 36 | 0 | Trust-column clip; top-change action that acts; observed-empty≠success (C5); worklist sort+keyboard (C2/C8) |
| Pipeline | 23 | 35 | 1 | Deep-link 0-runs P0; clearance visibility; issuer names (C4); mid-flight live DAG (C3); Blocked-module "why" |
| Deep-Dive | 29 | 37 | 0 | Live-table alignment + truncation disclosure (C3); layer greenwash + module QA badge (C5); pinned-run label (C4) |
| Model Builder | 31 | 37 | 0 | Checkpoint vocabulary unification; ⌘Z scope; driver-input floor; live evidence lane (C3/C12) |
| Report Studio | 30 | 36 | 2 | Masthead + audit fabrication P0s; identity-slot crush (C10); live float formatting (C3); draft-feedback visibility |
| Monitor | 26 | 35 | 0 | DEMO-chip scope; live severity bands + evidence chips (C3/C12); stale-selection ack no-op; un-ack path (C14 analog) |
| Query | 28 | 36 | 0 | Grounded-lane prose render + graph-lane edges (C3); headline-vs-slice honesty; RUN reason affordance (C1) |
| Issuers | 28 | 35 | 0 | Grid column model; per-item batch failures; keyboard rows (C8); posture columns for PM |
| Issuer Profile | 26 | 36 | 1 | Authority-contradiction P0 (C4); Restricted tooltip correction (C13); even ▸src affordance (C12) |
| Decisions (IC Book) | 25 | 35 | 0 | Names not ids (C4); vote confirm (C14); sort control (C2); state grammar (C6); UTC/local time |
| Portfolios | 25 | 35 | 0 | Silent substitution; invisible filter (C11); alignment inversion (C2); state costumes (C6); Inspect target |
| Research | 32 | 37 | 0 | Report-table alignment (C2); context-link retry; run cancel; not-run state kind (C6) |
| Sector Review | 24 | 35 | 1 | Loading-as-empty P0 (C6); posture rendered at all (P1); metrics in comparables; ratify confirm (C14) |
| Sector RV | 27 | 35 | 0 | DM-column alignment (C2); YTW copy (C13); visible row focus (C7); pre-run costume (C5); compare crash |
| Sponsors | 29 | 36 | 0 | Selection-reload churn; numeric alignment (C2); score scale anchor; time axis for track record |
| Settings | 27 | 35 | 0 | Save-model unification; mode round-trip; key-posture tri-state; holdings confirm (C14) |
| Upload | 31 | 36 | 0 | Result-step retention (C11); run-mode truth; EDGAR wiring; scan verdict surfacing |
| Home / shell | 29 | 35 | 0 | Recovery-word verification; role-aware landing (C9); reason-carrying submit (C1); branded auth gate |

System-wide gates at the bar: axe-core **0 violations / 18 routes** at baseline
(wcag2a+aa, 21a/aa, 22aa — §8) — the a11y risk is pattern-level (C7/C8), not
rule-level. Rendered-geometry baseline in §8.

**The prior 36/40 claim** (`.agent-reviews/impeccable-final-2026-07-13.md`):
re-tested and resolved. That review scoped two surfaces (Workbench + Atlas);
under this session's instrument — all 18 surfaces, live+seeded states, isolated
assessors, measured geometry — no surface exceeds 32. Both numbers can be
"true" only because they measure different things; the system-wide baseline of
record is this table.

---

## 3. Systemic causes

Fourteen causes, ranked by findings explained. Each: evidence → surfaces →
structural change → blast radius. ~150 findings collapse onto these; the orphan
bucket (§4, end) holds 6.

**C1 — No Button/action primitive; the action grammar is classname folklore.**
Evidence: raw `<button>` in 85 non-test files, 56 of them never touching
`.caos-action-*` [SRC]; ≥4 disabled-state dialects coexist (ActionReason;
aria-disabled+title-only; native `disabled`; two *dead* CSS selectors that leave
aria-disabled buttons full-opacity — `model/page.tsx:762` [SRC],
`globals.css:1167` [SRC]); sub-24px targets recur on 10+ surfaces (58 driver
inputs at 40×20px measured [PIX]; ~13px Inspect buttons; ~16px src chips); three
tab grammars; confirm grammar split (arm-pattern vs `window.confirm` vs
nothing). Touches: all 19. Change: `components/ui/` Button/IconButton/TabButton
primitives that *encode* the two action tiers, a 24px desktop floor (documented
dense-exceptions take the spacing rule), disabled-with-reason as the only
disabled mode, and one confirm/arm API; adopt by codemod, then lint raw
`<button>` outside `ui/`. Blast radius: ~85 files, mechanical for the 56
grammar-less ones; visual diff minimal (the CSS already exists — this moves it
into code that can't be skipped).

**C2 — No Table/DataGrid primitive; the alignment contract lives in nobody's
code.** Evidence: 12 raw `<table>` files + hand-rolled ARIA grids; blanket
`text-align:left` on IC Book (`globals.css:1272` [SRC]) vs blanket right on
Portfolio Lab incl. its text columns (`globals.css:1177`) vs per-author
elsewhere; units repeated per cell (%, bp, pos, $); ragged decimals
(`toLocaleString` prices); sort URL keys consumed but no sort control rendered
(decisions [SRC], coverage worklist); issuers grid: 9 cells/row vs 8
columnheaders [SRC]. Touches: 14 surfaces. Change: one DataTable/Grid primitive
taking typed column defs (kind: text|numeric|date|status → alignment, tabular
class, decimal discipline, unit-in-header, aria-sort, roving row focus), plus a
grid-adapter for engine tables. Blast radius: 12 table files + 4 ARIA grids;
highest-leverage single component in the plan.

**C3 — Live/seeded asymmetry: the fixture path got the craft, the live path got
adapters.** Evidence: generic engine adapters emit tables with no `align` and
slice flags/rows/KPIs/sections at 12/12/6/10 with zero disclosure
(`adapt.ts:176-253` [SRC]) while 18/19 seeded fixtures carry alignment; monitor
demo rows have severity bands + Source chips, live rows have neither
(`AlertInbox.tsx:139-147` vs `views.tsx:774-791` [SRC]); pipeline live runs
cannot be watched mid-flight (sim gated on `status==="complete"` [SRC]); model
live issuers dead-end on this stack ("Model authority unavailable" [LIVE]) and
V2 has no evidence lane; reports print live model floats raw
(`live-builder.ts:23-25` [SRC]); query grounded lane renders `JSON.stringify`
(`QueryInvestigationWorkbench.tsx:209-211` + server shape [SRC]), graph lane
drops edges. Touches: deepdive, monitor, pipeline, model, reports, query,
profile. Change: a **live-parity program** — upgrade the adapter layer (align
inference, "+N more" disclosure, per-module QA badge), give live rows the same
severity/evidence affordances as demo rows, native views for the top-5 modules,
mid-flight partial sim. Blast radius: the engine seam (`lib/engine/*`,
`lib/alerts/*`, reports live-builder) + 6 surfaces; this is where "what the
analyst actually sees" improves most.

**C4 — Provenance data doesn't flow, though provenance chrome is everywhere.**
Evidence: completed runs return `as_of_date: null` and no usable `completed_at`
in the list DTO [API] → Issuer Profile asserts "no completed run" beside
RESTRICTED chips (P0, [LIVE]+[SRC]), Pipeline shows FRESHNESS/AS-OF "UNKNOWN"
on runs finished minutes ago [LIVE], Command reports "evidence freshness
unavailable" [LIVE]; no shared issuer-id→name resolver → raw UUIDs in Pipeline
header/worklist [LIVE] and IC Book register [SRC]; pinned `?run=`
indistinguishable from latest [SRC]. Touches: profile, pipeline, command,
decisions, deepdive, reports. Change (backend pre-approved): stamp
`as_of_date` (default = run completion date) and return `completed_at` in run
DTOs; add issuer name/ticker to run-shaped payloads (or ship one shared
resolver hook); thread a single run-identity object (id, short-id, as-of,
pinned?) through consumers. Blast radius: 2 server routes + ~6 client files;
kills one P0 and four P1s at the root.

**C5 — Severity/state mappings betray the grammar at edges and aggregates.**
Evidence: `sev.ts:39` maps "Not Reviewed"→pass [SRC]; Deep-Dive layer chips
bucket Restricted into green "N ✓ cleared" — an all-Restricted live run renders
all-green [LIVE]; `queued` wears the running color; observed-empty decision
cells painted success-surface against the code's own warning comment
(`globals.css:219` vs `DecisionHeader.tsx:61-63` [SRC]); sector risks
always-amber; one dataset, two encodings (Signals badge-mapped vs Early Warning
all-amber [SRC]); RV pre-run wears an amber result costume [SRC]; replay counts
in live-critical red [PIX]. Touches: 9 surfaces. Change: one severity→
presentation contract (module: sev-presentation) with explicit kinds for
Restricted / Not-Reviewed / queued / observed-empty / not-yet-run, an
aggregation rule that *never* collapses warning-class states into a cleared
bucket, and a unit test pinning the mapping. Blast radius: `sev.ts` + ~10 call
sites; small diffs, large trust delta.

**C6 — SurfaceState exists (7-kind vocabulary, glyph+label+role built in) but
adoption is voluntary.** Evidence: 13 true consumers [SRC]; hand-rolled
loading/empty/error on Portfolio Lab (three states, one `__empty` costume
[SRC]), IC Book (three grammars in one region [SRC]), monitor desktop live lane
(renders `null`), Sector Review (loading renders as authoritative "No versioned
dossier exists" — P0 [SRC]), research ("No observed data" for never-run).
Change: adopt SurfaceState on every async panel; add kinds `not-run` and
`checking`; lint async panels for a loading representation. Blast radius: ~10
files; closes one P0.

**C7 — No overlay/keyboard utilities; each surface reinvents interaction
plumbing.** Evidence: three same-target window Escape listeners with no
topmost-overlay registry → one Esc collapses the whole Ask stack
(`use-modal-a11y.ts:62-66` + `Ask.tsx:151-153` [SRC]); palette keyboard
highlight leaves the listbox — measured 94px below the fold, scrollTop 0
[LIVE]; ARIA-shaped-but-not-behaved patterns ×4 (RoleViewSwitch radios, login
tabs, command dataset tabs, RV grid) with no roving-tabindex util [SRC];
focus-ring rule scoped to `.caos-enterprise-page` so chrome overlays fall to UA
outline [SRC]; `display:contents` focus target can't paint a ring
(`RVScreenerWorkbench.tsx:114` [SRC]). Change: shared overlay-stack manager
(topmost handles Esc), `useRovingTabs`, a listbox keyboard helper
(scrollIntoView on active change), focus-ring scope widened to `body`. Blast
radius: ~8 shared files + call sites; closes two confirmed chrome P1s.

**C8 — Keyboard efficiency stops at the flagship components.** Evidence: model
sheet (roving activedescendant grid [LIVE]), palette, profile tablist are
excellent; worklists are tab-stop deserts — 3–6 stops per row, ~900 for a
300-name book [SRC], no roving row focus, no j/k, gate reasons hover-only
(`title` attrs ×3 on RV [SRC]), "?" shortcut help advertised nowhere [SRC].
Touches: command, monitor, issuers, decisions, portfolios, RV. Change: DataTable
row-focus model (one stop per list, arrows within, Enter to open, keyed
actions), ActionReason for every gate reason, a visible shortcut affordance in
chrome. Blast radius: rides on C2's component; the analyst-persona multiplier.

**C9 — Chrome carries no durable delta; the PM starves.** Evidence: the only
notification channel is a 7s toast that marks itself seen server-side
(`Notifications.tsx:45-48` [SRC]); no badge on the Alert Monitor rail link;
decision briefs `defaultOpen={false}` on decision surfaces [SRC]; "/" is a
static redirect to /issuers — the PM pays two navigations every session, and
the VIEW toggle never informs landing [SRC]. Change: durable notification feed
(rail badge + inbox entry point, mark-seen on interaction only), role-aware
landing (pm → /command; last-route cookie), decision-brief defaults per role.
Blast radius: chrome + home; PM persona pass depends on it.

**C10 — Header/identity slots are overflow-fragile and title truth is scattered.**
Evidence: Report Studio identity crush — caveat cluster passed as ShellIdentity
`children` (the slot documented "first to be clipped") while the identity cell
is the only shrinkable one → "R…", "REFEREN…UNKNOWN" [PIX, root-caused SRC];
model tie-out chip clips to "✓ net lev t|" [PIX]; RouteHeading missing
portfolios/decisions (h1 falls back "CAOS") + names diverge from nav labels
[SRC]; triple-title stacks (issuers ×3 [SRC]); duplicated headings (pipeline
inspector, sponsors count ×2). Change: enforce the badges/children contract
(must-survive markers go in `badges`), add truncation guards + container-query
short forms, derive route titles from the nav registry. Blast radius: ~8 files.

**C11 — Affordance-truth drift: controls promise behavior that isn't wired.**
Evidence: upload's run-mode picker is metadata-only while completion copy
asserts "{mode} run queued" [SRC], and success auto-`router.push` yanks the
analyst off the settled per-file trust report [SRC]; issuers BatchBar advertises
"(Esc)" with no handler [SRC]; OPEN TOP CHANGE focuses the wrapper around the
entire workbench [SRC]; portfolios applies an invisible `ranking=` URL filter
with no chip [SRC] and silently substitutes `portfolios[0]` for an invalid
`?portfolio=` [SRC]; EDGAR import mounts without `onVaulted` so URL-vaulted docs
never advance the wizard [SRC]; settings' mode profile round-trip is dead
(uppercase write, lowercase-only read [SRC]). Change: an acceptance rule for the
execution session — *every control's claim is exercised once against its
effect* (the wiring gate); fix the ten instances. Blast radius: ~10 files of
small diffs; this cluster is why users stop trusting a tool.

**C12 — Traceability affordances are per-author opt-in.** Evidence: profile
tiles show ▸src only where `document_chunk_id` exists, silently [SRC]+[LIVE];
monitor live rows carry `evidence:{chunkIds,factIds}` and render none of it
[SRC]; portfolios inspector prints `source_ids.join(", ")` as dead text [SRC];
sector conclusions carry `source_ids` unrendered [SRC]; Deep-Dive evidence-trace
rail rows highlight but can't open; paper `rd-cite` chips sit outside Evidence
Sync [SRC]. Change: one `SourceRef` component (chip when resolvable, explicit
muted "no source" token when absent) + rule: any displayed conclusion renders
its source affordance or states its absence. Blast radius: ~8 surfaces;
this is design principle 3 made enforceable.

**C13 — Engine vocabulary crosses the display boundary unformatted.** Evidence:
`LTM_Q1_26` printed raw [PIX]; the same module named "CP-1 Financial Spreading"
(DAG) and "CP-1 CanonicalDataFoundation" (live event log) on one screen [SRC];
"observed-empty", "COMPOSITION ONLY · PERMISSIONS UNCHANGED", tape ids in user
copy; the Restricted tooltip describes a *compliance trading restriction* when
the status is the CP-5 QA gate — actively mis-teaching the one word analysts
must repeat to committees (`ProfileContent.tsx:216-217` [SRC]); raw ISO dates;
UTC-only meeting times edited local [SRC]. Change: display-boundary formatting
(period/date/module-name formatters), a copy pass with a glossary, fix the
Restricted tooltip first. Blast radius: wide but shallow.

**C14 — Governance actions lack a confirmation/undo tier.** Evidence: IC votes
are one-click, unconfirmable, irretractable on an immutable record [SRC];
"Ratify updates" blanket-ratifies every section with no confirm [SRC]; monitor
ack/resolve have no un-ack [SRC]; settings holdings drop replaces book positions
with no preview [SRC]; a failed thesis-affirm retry mints duplicate versions
[SRC] — while finalize-confirm, stress preview→persist, and the model's
arm-pattern show the convention exists. Change: an action-severity matrix in the
design docs + the Button primitive's confirm/arm API (C1); mutating-governance
actions get arm-or-confirm plus either undo or an explicit recorded-correction
path. Blast radius: ~8 call sites.

**Cross-cause cluster — fabricated assertions (calls out on its own because it
is the committee-trust killer):** masthead RUN #2641 / JUN 10 2026 hardcoded on
every deliverable incl. live published PDFs [PIX]+[SRC]; "N resolved · **0
orphaned**" hardcoded, "Clean export — CP-5 trace audit passed" unconditional,
READY-green on Restricted runs [SRC]+[PIX]; "US HY sleeve" appended to a
register showing French and UK issuers [SRC]+[PIX]; "Seven-section dossier"
constant; run-mode "queued" confirmation for a route that ignored it [SRC];
page-scope DEMO chip claiming live governance numbers are replay [SRC]. The
codebase *elsewhere* refuses fabrication (pipeline fail-open guards, model
honest-lineage discipline) — the norm exists; these instances escaped it. All
are Phase-0 fixes.

**Cause/finding ratio check:** 14 causes over ~150 findings; orphan bucket = 6
(§4 end) — small, as it should be.

---

## 4. Per-surface findings

Format: `[sev][cause][verify]` finding — file:line — fix sketch. Verify tags per
§ header. Lens tags: N#=Nielsen, E#=Enterprise principle, C=craft. All four
lenses were applied per surface; persona walks summarized per surface.

### Global chrome (29/40)
- [P1][C7][LIVE] ⌘K→type→Enter on /query drops the typed question — `Ask.tsx:132-136` dispatches a bare `caos:query-focus` Event with no payload; live test: composer empty AND unfocused — CustomEvent `{text}` + composer prefill consumption.
- [P1][C7][LIVE] Palette keyboard highlight scrolls out of view — `CommandPalette.tsx:160-171,204`; measured: active row 94px below listbox fold, scrollTop 0 — scrollIntoView on active change (listbox helper).
- [P1][C7][SRC] One Esc collapses the whole Ask stack from a nested CitationViewer — `use-modal-a11y.ts:62-66` + `Ask.tsx:151-153`, three same-target window listeners, stopPropagation can't suppress siblings — topmost-overlay registry.
- [P2][C7][SRC] "Skip to navigation" dead ≥1280px — targets `#concept-nav` inside `display:none` compact nav; rail's `#workspace-nav` referenced by nothing (`layout.tsx:47-52`, `WorkflowRail.tsx:27`) — retarget.
- [P2][C10][SRC] RouteHeading missing portfolios/decisions (h1 "CAOS") + names diverge from nav — derive from nav registry.
- [P2][C9][SRC] Notifications transient-only; 7s timer marks seen server-side (`Notifications.tsx:45-48,110`) — durable feed + interaction-only seen.
- [P2][C1][SRC] Ask "← Back" wipes the typed question (`Ask.tsx:544-551`) — retain text.
- [P2][C7][SRC] RoleViewSwitch: radio semantics, no roving/arrows (`RoleViewSwitch.tsx:22-46`) — roving or aria-pressed.
- [P2][C1] Ask action row sub-24px targets (view switcher ~20px contiguous; PIN/CSV/PDF ~21-22px; toast × ~20px) — Button primitive sizes.
- [P2][C2][SRC] Ask RV table centers numeric degree columns (`RelativeValueTable.tsx:314-315`) — right-align.
- [P2][C13] Alt+←/→ preventDefaults browser Back/Forward off-macOS (`ConceptHotkeys.tsx:70-81`) — platform-gate.
- [P3][C1] ShortcutHelp overlay off-canon (bg-black/50, z-50 literals); [P3][C14-adjacent] `caos-enter` 240ms vs 160 contract; [P3][C13] "Alt+K" literal vs platform-detected ⌘K; [P3][C7] chrome overlays outside focus-ring scope; [P3] Ask pill occlusion risk over bottom-right page controls (probe pending).
- Personas: analyst — the three P1s all hit the keyboard mid-task loop; PM — zero durable chrome delta; QA — no first-class governance path in palette (label-match only).
- Path to 35+: P1 trio → N3/N7 +2; durable feed → N1/E8 +1; help affordance → N10 2→3; skip-link+RoleViewSwitch → consistency +1. 29→36-37.

### Command Center (28/40)
- [P1][C2][PIX] QA/trust column clipped at reference width — `LiveCoverage.tsx:79` minWidth 760 vs ~690px slot (grid math `globals.css:857-866`); live screenshot cuts at "FRA|" — reorder QA before RV / shrink tracks.
- [P1][C11][SRC] "OPEN TOP CHANGE" never opens the top change — focuses `#ranked-changes` wrapping the whole workbench (`page.tsx:334-341,394`); computed top row unused — navigate to `issuerHref(rows[0])`.
- [P1][C5][SRC] Observed-empty decision cells painted success-green (`globals.css:219,224`) contradicting `DecisionHeader.tsx:61-63` — neutral surface for observed-empty.
- [P2][C5][SRC] Offline autonomy wears a DEMO provenance chip (`RankedChanges.tsx:71-74`) — offline kind, no origin chip.
- [P2][C11][SRC] Silent ack failure (no `.catch`, `RankedChanges.tsx:60-63`) — row-level error + retained state.
- [P2][C2][SRC] Positions table left-aligns numerics + per-cell "bp" (`CommandPortfolio.tsx:105,146-148`) — DataTable.
- [P2][C7][SRC] Dataset switcher tabs-in-name-only (no controls/panel/roving, `page.tsx:402-404`) — complete or demote.
- [P2][C2][SRC] Coverage worklist unsortable (sortable exists, unused — `LiveCoverage.tsx:80-95`) — enable on numeric columns.
- [P2][C12][SRC] "12 QA findings · 8 source gaps" dead text (`page.tsx:200-211`) — link to governance dataset.
- [P3]: toolbar heading static; sector truncate no title; smooth-scroll ignores reduced-motion; hardcoded "2026" tiebreak (`views.tsx:911` — orphan); governance headers no counts; "holdings not loaded" phrasing; funnel/digest/link target sizes (geometry: 8 real sub-24 no-exception = worklist ticker+name pairs [PIX]).
- Personas: analyst — primary action can't complete the surface's named task; 3 stops/row triage; PM — the one green-highlighted cell reports a coverage *gap*; QA — six-way governance split strong, queue items lack triage state.
- Path to 35+: clip+top-change+sort → N7 2→4, N8 3→4; observed-empty fix → E8/N1 +1; ack feedback → N9 3→4; keyboard rows → E1. 28→36.

### Pipeline (23/40)
- [P0][C11][LIVE] Deep-link/refresh with `?issuer=` mounts "0 runs · 23/23 modules", worklist empty forever — `page.tsx:110-127` early-return + every selection writes `issuer` to URL; live-confirmed with 4 runs present — fetch runs unconditionally + distinct not-loaded state.
- [P1][C10][SRC][PIX] QA clearance verdict invisible at default view — rendered only inside the collapsed MoreDrawer (`page.tsx:333`, `SubHeader.tsx:96-105`) — promote clearance + progress to identity badges.
- [P1][C3][SRC] Live runs can't be watched mid-flight — sim built only for `status==="complete"` (`useLivePipeline.ts:171-174`); animated DAG is demo-only — partial sim from persisted module rows.
- [P1][C3][SRC] Inspector dead-ends on Blocked live modules — payload line gated to pass/warning/held (`views.tsx:336`), reason string exists but unreachable — always render status + "why" link.
- [P1][C4][LIVE] Issuer identity is a raw UUID in header + worklist (`page.tsx:234,443`) — name resolver.
- [P2][C13][SRC] Two module vocabularies on one screen (taxonomy vs engine `module_name`) — map at display boundary.
- [P2][C5][SRC] Worklist severity-tags infra State but not Committee verdict; `queued` wears running color (`page.tsx:439-446`) — tag the decision column.
- [P2][C2][C4] Run history: no timestamps (created_at exists in DTO), no sort, silent `slice(0,20)`, ~2.5 visible rows — Executed column + disclosure.
- [P2][C11] No run/re-run affordance on the run surface (remediation loop always exits) — re-run secondary action.
- [P2][C7][SRC] Every ToggleGroup announces "Toggle options" (`atoms.tsx:95`) — ariaLabel prop.
- [P2][C8] QA gate module off-screen by default (1281px canvas in ~826px pane, no affordance) — auto-scroll to failing column.
- [P3]: consumer purple ×3 values (C14-token); event-log static running dot on complete runs; live events no timestamps; in-row uppercase page-tier buttons; ⛨ unicode amid StatusGlyph; 240ms enter.
- Personas: analyst can't kick/watch/diagnose on live; PM scan fails on every axis (drawer-hidden clearance, UUIDs, 2.5-row window, "0 runs" after deep-link); QA's gate column off-viewport. Strengths: honesty architecture (fail-open guards) is best-in-class — keep.
- Path to 35: P0 → N1 2→3; clearance+timestamps+names → E8/N2 +3 across H1/H2; mid-flight sim → N7 2→3; Blocked why → N9 3→4; sort/keyboard → H7 +1; vocabulary → H4 2→3. 23→35 requires all five P1s + the P2 set; achievable, largest single-surface lift in the plan.

### Deep-Dive (29/40)
- [P1][C3][SRC] Live tables lose numeric alignment — `adapt.ts:187-203` emits no `align`, `OutSections.tsx:29,37` defaults left — infer align per column.
- [P1][C3][SRC] Silent truncation of live output — slices 12/12/6/10 with no disclosure (`adapt.ts:176-253`); IssuerChat grounds on the truncated set — "+N more" footers.
- [P1][C5][LIVE] Layer chips greenwash — all-Restricted live run renders green "N ✓ cleared" (`page.tsx:645-651`; `sev.ts:39` Not-Reviewed→pass) — third aggregate bucket, never pass for Not-Reviewed.
- [P1][C5][LIVE] Open module pane hides QA gate state — Restricted module reads "● LIVE" (`page.tsx:773-789`) — "△ RESTRICTED" badge.
- [P1][C4][SRC] Pinned `?run=` indistinguishable from latest (`useLatestRun.ts:50-56`, no caveat kind) — pinned caveat variant.
- [P1][C13][SRC] Two affirmation verbs writing different records ("Note agreement" vs "Affirm thesis") distinguished by a 10px footnote — one affordance per state or explicit labels.
- [P2]: evidence chip first-click void (lazy import, no loading shell); scenario band always-on + run-ambiguous; sim controls on live issuers; flag severity color-only in lists (non-glyph Dot); evidence-trace rail rows can't open [C12]; `?run=` silently ignored on reference issuer; target-size candidates (layer toggles ~20px, chat ⌫, register rows py-[3px]); affirm partial-failure retry mints duplicate versions [C14].
- [P3]: reference caveat hidden <xl; "24/24 modules" vs gated chips; CAPSTACK 5.7x in %-column; chat Esc discards draft; SemanticVisualization fallback alignment.
- Personas: analyst can't share their working position (module never in URL) and the live third pane is a "not wired" card; PM — live whatChanged is a coverage count, brief collapsed; QA — pane never states gate state, rows past 12 dropped. Strengths: five-state caveat grammar, chart accessibleSummary+fallback, seeded-path evidence system [LIVE-confirmed E-12 modal with focus restore].
- Path to 35+: alignment+truncation → E10/H4 +2; greenwash+badge → H1/E8 +2 (the QA-persona pass hinges here); pinned label → +1 H1; affirm unification → H4/H5 +1; URL position → H7 3→4. 29→37.

### Model Builder (31/40)
- [P1][C13][SRC] Dual "checkpoint" vocabulary splits the defend-flow (local snapshots vs server immutable; the saved server checkpoint never appears in the CHECKPOINTS modal) — one surface, LOCAL/SERVER badges.
- [P1][C1][SRC] ⌘Z after a driver scrub reverts an unrelated (possibly off-screen) grid override — assumptions not in history, scrub blurs input (`page.tsx:185-201,604-611`; `AssumptionsPanel.tsx:118`) — unified history or scoped undo.
- [P2][C1][PIX] 58 driver inputs at 40×20px, 4px gaps, no spacing exception (geometry harness); hover ✕ at 12×12 — h-6 rows + 24px hit areas (adjudicated NOT an acceptable dense-terminal tradeoff: drag-scrub targets, adjacent-driver mis-scrub).
- [P2][C5][PIX] Breach rows color-only in downside table (`ScenarioPanel.tsx:76-78`) — reuse distress glyph.
- [P2][C10][PIX] Net-leverage tie-out chip clips mid-word ("✓ net lev t|") — the surface's single defensibility readout — short form + badges slot.
- [P2][C1][SRC] Inoperable EXPORT MODEL styled fully enabled (dead `disabled:` selector vs aria-disabled) — Button primitive.
- [P2][C3][C12] Live-issuer path has no evidence lane (V2 zero E-chips; on qa3 live issuers dead-end entirely — "Model authority unavailable" [LIVE]) — per-node origin chip minimum; V2 availability itself is an environment gate to verify in execution.
- [P2]: formula bar truncates with pointer-only recovery; checkpoint failure styled as quiet status; selected scenario tab uses primary class vs system's own aria-selected treatment.
- [P3]: latent fabricated "G-02" legend on live exports; text-[9px]×6; hardcoded selection rgba (tranche hue repurposed); `window.confirm` vs arm-pattern; negative % in critical-red; modified-driver state color-only at rest; CP-5 scope caveat buried; Ctrl+Y comment drift.
- Personas: analyst core loop genuinely excellent (paste, scrub, flash-trace [LIVE keyboard-confirmed]); QA audit on reference path best-in-app; PM's one committee confirmation is clipped.
- Path to 35+: checkpoint unification → H4 2→3, H6 3→4; ⌘Z scope → H3 3→4; driver floor + tie-out → C/H8; live evidence lane → E9 +1. 31→37.

### Report Studio (30/40)
- [P0][Fabrication][PIX][SRC] Masthead hardcodes "RUN #2641 · JUN 10, 2026" on every deliverable incl. live frozen/published/printed versions; same sheet shows authority "RUN: 35E4C87F" — derive from report DSL.
- [P0][Fabrication][SRC][PIX] Export audit fabricated: "0 orphaned" constant, "Clean export — CP-5 trace audit passed" unconditional, READY-green for Restricted runs (`panels.tsx:233,267,14-22,75`) — compute or remove; derive READY from committee status.
- [P1][C10][PIX][SRC] Identity crush at default width (caveat cluster in first-clipped slot; "R…", "REFEREN…UNKNOWN") — badges slot + drop the "PREVIEW · SOURCES ON · ZOOM" echo.
- [P1][C6][SRC] Draft-conflict/publish feedback renders only inside the closed drawer (`page.tsx:875`) — mirror errors at header save-state, role=alert.
- [P1][C3][SRC] Live/frozen model tables print raw unformatted floats (`live-builder.ts:23-25,123-157`) — route through fm/fx formatters.
- [P1][Fabrication][SRC] Fixture governance narrative asserted for any issuer ("held by CP-5 (QA-117 open)"; "Every figure… resolves" above rows with no evidence) — gate on actual report set.
- [P2]: disabled primary reads actionable (opacity-40 on accent fill); paper cites outside Evidence Sync [C12]; chair table unitless integers; model appendix 5.4px type in print; published-version history amputated to current run.
- [P3]: "APPROVAL: QA:" stutter; COLLAPSE controls ~16px; edit-affordance borrows 2L tranche hue + 120ms; fallback published version dumps JSON into prose.
- Personas: analyst export flow dead-ends silently (reasons in title attrs); PM trusts the stamp on the paper — the stamp is theater (P0); QA cannot trust any right-rail audit statement. Strengths: print pipeline, publish ladder, fixture-path table discipline — all keep.
- Path to 35+: two P0s + narrative gating → H4 2→4, N1/E8 +2 (trust restored is most of the delta); identity crush + feedback surfacing → H8/H9 +2; float formatting → E7 +1. 30→36.

### Monitor (26/40)
- [P1][C5][SRC] Page-level DEMO chip over-claims — asserts the whole surface is seeded replay while worklist/governance/control-plane are live; teaches users to discount real numbers — scope the chip to the tape; add LIVE+as-of to governance summary.
- [P1][C3][C12][SRC] Live alert rows never surface their carried evidence (`evidence:{chunkIds,factIds}` unrendered) while demo rows get Source chips — citation chips on live rows.
- [P1][C5][SRC] Live severity illegible — muted "N.Nσ" chip vs demo rows' banded Dot+Tag in the same panel — one severity grammar.
- [P1][C5][SRC] Governance "Stale sources" count won't reconcile with the queue that opens (aging+never-run combined vs split categories) — split the summary rows.
- [P1][C11][SRC] Stale selection survives dataset switch → header "Acknowledge selected (n)" enabled but dispatching to an unmounted listener — zero-count dispatch on unmount.
- [P2][C5][PIX] "REPLAY CRITICALS 2" is the page's largest critical-red numeral, one fixation from green "NO CRITICAL ALERT" — muted+glyph for replay counts (adjudicated P2: mitigations real).
- [P2][C6] Desktop live lane renders `null` for loading/offline/empty (phone triage has the state row) — SurfaceState line.
- [P2][C14] No un-ack/un-resolve path; assignee free text vs known analyst roster — datalist + recorded correction.
- [P3]: critical-filter toggle inert while tape collapsed; two batch-ack failure grammars; chart fallback table left-aligned numerics; axis label collision; formatImpact contract unhonored.
- Personas: analyst evidence dead-end + invisible row severity; PM 2-second answer works BUT the red fiction sits beside it; QA per-row lane trust exemplary, page-level trust contradicted. Strengths: replay honesty engineering, guarded-action grammar, per-item batch outcomes.
- Path to 35: DEMO scope + severity grammar + evidence chips → E8/E9/N4 +4 across H1/H2/H4; ack fixes → N1/N9 +2; un-ack → H3 2→3. 26→35.

### Query (28/40)
- [P1][C3][SRC] Grounded lane renders `JSON.stringify` of `{answer,sentences,citations}` in the primary region (server shape cross-verified) — cited-prose renderer.
- [P1][C3][SRC] Graph lane drops edges/caveats (GraphCanvas exists, wired only to Ask) — route through GraphCanvas.
- [P1][C3][SRC] Headline "Top N" counts the full array while the body slices 100, silently — "showing 100 of N".
- [P2][C1][LIVE] RUN QUERY native-disabled with no reason affordance (vs ActionReason elsewhere) — primitive swap.
- [P2][C12][SRC] Citation register silently caps at 20 — "+N more".
- [P2][C1] src chip ~16px, Unpin bare text — target floor.
- [P3]: text-lg/text-base off-token; "COMPOSITION ONLY" jargon chip [C13].
- Personas: analyst metric loop fast and defensible [LIVE: cited ranked table, honest "RANKED BY LEVEL, NOT CHANGE" caveat, source modal with chunk id]; grounded lane breaks the chain; QA: metric-lane authority chain genuinely auditable. Post-run composer path at 1280px needs a live check (flagged, not asserted).
- Path to 35+: grounded/graph renders → H8 2→3, E9 +2; count honesty → E8 +1; reason affordance + targets → H4/C +1. 28→36.

### Issuers (28/40)
- [P1][C2][SRC] ARIA grid: 9 cells/row vs 8 columnheaders (stretched-link cell) — role=presentation or restructure.
- [P1][C11][SRC] Batch failures undiagnosable — per-item errors collected then discarded ("3/5 succeeded") — expandable failure list.
- [P1][Fabrication][SRC][PIX] "· US HY sleeve" hardcoded against visible France/UK rows — derive or drop.
- [P2][C8] role=grid promises 2D nav that doesn't exist (~900 tab stops at 300 names) — DataTable row focus.
- [P2][C14] "Run pipeline (N)" instant, unconfirmed, cost-bearing — inline confirm.
- [P2][C11][SRC] "(Esc)" advertised, no handler — bind it.
- [P2][C10] Triple-title stack burns ~90px repeating the register name ×3 — collapse.
- [P3]: unnamed action columnheader; search-✕ ~16px; filter-dialog ×; UPLOAD at exactly 24px (floor).
- Personas: analyst — no search hotkey, Esc lies, failure triage forces full re-run; PM — the coverage register carries zero posture columns and the one posture claim is false; QA — lane trust absent per name. Strengths: four distinct empty/degraded states; batch idempotency; real filter/sort headers.
- Path to 35: grid fix + row focus + sort → H4/H7 +3; batch diagnosis → H9 2→4; posture columns → E2/PM +1; titles → H8 +1. 28→35.

### Issuer Profile (26/40)
- [P0][C4][LIVE][SRC][API] Authority contradiction — header chips assert the Restricted run; Atlas prints "Authority: Unavailable — no completed run", Brief "No timestamped completed run available"; root cause: badges read `latest_run`, panels read `latest_run.as_of_date`, and the backend returns `as_of_date:null` on completed runs — branch on run presence; backend stamps as-of (C4 Phase 0).
- [P1][C13][SRC] Restricted tooltip describes a compliance trading restriction; it is the CP-5 QA gate — correct the copy (analysts repeat this to committees).
- [P2][C12][LIVE][SRC] ▸src on some tiles, silently absent on others (chunk-id-gated) — explicit "no source" token.
- [P2][C14-token][SRC] Chart palette hardcodes status hues for series (warning-amber leverage line, success-green margin) + raw hex tooltip — categorical ramp tokens.
- [P2][C13][PIX] Raw `LTM_Q1_26` period tokens — display formatter.
- [P2][C13] "0 findings" (context) vs "Open findings 6" (QA) in one viewport — qualify labels.
- [P3]: 7 tiles in 6-col grid orphan row; ~12px src/vault/ratings links; no-ratings silence; ad-hoc font sizes ×5.
- Personas: PM — posture and its denial share the fold (P0); QA cannot audit authority; analyst 30s orient otherwise works. Strengths: worst-provenance tagging, FAB flags, keyboard sparkline with point review.
- Path to 35+: P0 + tooltip → H1 2→4, H2 2→3 (trust restored); src evenness → E9 +1; findings labels + periods → H4 2→3. 26→36.

### Decisions / IC Book (25/40)
- [P1][C4][SRC] Register renders raw `issuer_id`/`owner_id` while the issuer catalog is loaded in the same component — resolve names.
- [P1][C14][SRC] One-click irreversible votes on an immutable record (finalize gets a confirm; votes don't) — arm/confirm votes.
- [P1][C2][SRC] No sort control though `sort`/`direction` URL keys are consumed — header sort.
- [P2][C2][SRC] Blanket left alignment incl. Conviction %, votes, dates; % per cell — DataTable.
- [P2][C13][SRC] Meeting time displayed UTC-only, edited local — dual display.
- [P2][C6][SRC] Loading/error bare `<p>` beside SurfaceState-rendered empty — one grammar.
- [P2][C1] Gated buttons title-only reasons — ActionReason.
- [P2][C9] PM brief collapsed by default on the decision surface — role default.
- [P3]: ISO expiry inconsistency; full SHA as prose ×2; forward-only pagination.
- Personas: analyst can't re-sort and one stray click votes; PM's what-changed cells hidden; QA strongest (readiness blockers verbatim, frozen SHA, sourceHref deep-links everywhere). 
- Path to 35: names + sort + alignment → H2 2→3, H4 2→3, H7 2→3; vote confirm → H5/H3 +2; state grammar + reasons → H9 2→3. 25→35.

### Portfolios / Portfolio Lab (25/40)
- [P1][C11][SRC] Invalid `?portfolio=` silently substitutes `portfolios[0]` — a stale IC Book link renders a different book's holdings — not-found state + picker.
- [P1][C11][SRC] Invisible `ranking=` filter applied with no control/chip — filtered table reads as the whole book — removable chip or drop key.
- [P2][C6][SRC] Loading/observed-empty/error share one costume (`__empty`) — SurfaceState kinds.
- [P2][C1][SRC][PIX] Dead disabled selector → inert "Preview stress" renders full-opacity beside a correctly-dimmed sibling — fix selector via Button primitive.
- [P2][C2][SRC] Blanket right-align (text columns too); ragged price decimals; compact-$ mixed magnitudes per cell — DataTable columns.
- [P2][C1] "Inspect" ~13px bare-text target — row-level open.
- [P2][C7] Sort control aria-label announces the opposite of its visible state; no aria-sort — fix labels.
- [P2][C12][SRC] Inspector source ids dead text (sibling surface deep-links them) — SourceRef.
- [P2][C5] Narrow chrome claims "0 positions" during load (desktop shows "—") — same fallback.
- [P2] Single hardcoded stress scenario; no dismiss for stress preview panel [C14].
- [P3]: side-stripe accents contradicting the system's own ban note; no DecisionHeader brief on this surface.
- Personas: analyst drill dead-ends at unlinked ids; PM has no what-changed; QA lane isolation + stress fingerprints good. 
- Path to 35: substitution+filter truth → E8/N1 +3; alignment+targets+states → H4 2→3, H8 +1; source links → E9 +1; brief → PM +1. 25→35.

### Research (32/40)
- [P2][C2][SRC] Committee report tables left-aligned numerics (`.research-doc` blanket left + `:--` markers in the canned report) — emit `--:` + CSS numeric detection.
- [P2][C11][SRC] Post-completion context/finding link failure has no retry affordance (chain silently missing) — visible banner + retry.
- [P2][C14] No cancel for multi-minute real-spend runs (server dependency; flag) — stop-run endpoint.
- [P2][C1] EXPORT PDF ~22px bespoke button — primitive.
- [P3]: running view claims "live web research" in demo mode; "NO OBSERVED DATA" for never-run [C6]; off-token sizes ×2.
- Personas: strongest surface — durable-job lifecycle, honest truncation-as-integrity, prevResult retention. 
- Path to 35+: table alignment → E7 +1; retry visibility → H9; not-run kind → H2. 32→37.

### Sector Review (24/40)
- [P0][C6][SRC] Loading renders as authoritative observed-empty — "No versioned dossier exists… Request a refresh" while the fetch is in flight (action-inducing false empty) — loading kind before any assertion.
- [P1][C3][SRC] `review.posture` and per-section postures never rendered on the posture surface (only inside the collapsed compare drawer) — posture headStat + section chips.
- [P1][C2][SRC] Comparables table drops the entire numeric `metrics` payload — name selection undefendable — project metrics into aligned columns.
- [P1][C5][SRC] Same `early_warning` array, contradictory encodings on two tabs (badge-mapped vs all-amber) — one mapping.
- [P1][C14][SRC] One-click blanket ratification of every section, no confirm — confirm listing sections.
- [P2]: ratification-vs-freshness one unlabeled column; "Seven-section dossier" hardcode; risks always-amber; conclusions carry unrendered source_ids [C12]; "COMPOSITION ONLY" jargon.
- Personas: PM — the posture word is nowhere on the posture surface, and during load the page claims no review exists; analyst can't defend names numberless; QA can't read governance state at a glance.
- Path to 35: P0 + posture + metrics → H1 2→3, E2 +2, E9 +1; encodings + ratify confirm → H4 2→3, H5 2→3; source chips → E9. 24→35 needs the full P1 set; the surface is structurally sound underneath (URL state, honest error copy).

### Sector RV (27/40)
- [P1][C13][SRC] Methodology text teaches "Spread / YTW / DM pickup" on a loans-only DM-canonical desk — correct to DM-only.
- [P1][C7][SRC] Row focus can't paint (`display:contents` + focus-ring) and grid ARIA misnests rows/cells; virtualization can unmount focus — real row boxes, selection-follows-focus.
- [P1][C5][SRC] Pre-run wears a result costume (amber "NO ACTIONABLE CANDIDATE", "ACTIONABLE 0") — "Not yet screened" neutral.
- [P1][C2][SRC] DM/Pickup/Bid-Ask left-aligned, ragged decimals, "bp" per cell — on the DM-scanning surface — DataTable.
- [P1][Orphan][SRC] Compare view crashes on sparse candidate (unguarded `market_relative_value` access vs guarded siblings) — optional-chain.
- [P2]: gate reasons title-only ×3 [C1]; import slide-over hides its form behind a second collapsed disclosure; rank digits in accent [C14-token].
- Path to 35: alignment + focus + costume → H4/H7/E8 +4; YTW fix → E2 2→3; gate reasons → H6 2→3; crash → E10. 27→35.

### Sponsors (29/40)
- [P1][C11][SRC] Every sponsor selection wipes and refetches the register mid-read (context-patch → effect dep chain) — fetch once, ref the selection.
- [P2][C2][SRC] Net-lev/Gov-risk columns left-aligned — right-align.
- [P2][C1][SRC] Inert primary ignores clicks (half the disabled convention; wrong reason in zero state) — ActionReason with state-aware reason.
- [P2] Track record has no time axis (promise vs panel); gov-risk score unanchored (no scale); selected row shade-only [C5].
- [P3]: flags truncate no title; sponsor count ×2.
- Path to 35+: selection churn → E1/H1 +2; alignment + scale anchor → E7/E9 +2; time axis → E2 +1. 29→36.

### Settings (27/40)
- [P1][C11][SRC] Displayed "Active" query model can diverge from the model actually used (profile overwrite vs localStorage truth) — single source.
- [P1][C11][SRC] Mode profile round-trip dead (uppercase write, lowercase read) — cross-device follow silently broken — normalize (localStorage path unaffected — verified nuance).
- [P1][C1] Three save models coexist; immediate-saved controls still trip "unsaved changes" — exclude from dirty snapshot.
- [P1][C14][SRC] Holdings drag-drop replaces book positions, no preview/confirm (sibling import has preview→commit) — two-phase.
- [P2]: unknown key posture defaults "ready" green on fetch failure (tri-state); Outlook status with no action path; Portfolios tab hand-rolled buttons [C1].
- [P3]: 16px switch (label rescues — candidate); deprecated 3xs alias.
- Path to 35: save-model unification + round-trip → E4/H4 +3; key tri-state → E8 +1; holdings confirm → H5 2→3. 27→35.

### Upload (31/40)
- [P1][C11][SRC] Success auto-`router.push` to /pipeline defeats the surface's trust task — the settled per-file report (with zero-chunk warnings) is only reachable on error paths; return remounts a reset wizard — stay on result step, navigation by click.
- [P1][C11][SRC] Run-mode picker is a placebo confirmed by the UI ("{mode} ({code}) run queued" for an ignored mode) — label as metadata until wired.
- [P2][C11][SRC] EDGAR-only intake dead-ends (`onVaulted` unwired) — wire it.
- [P2] No scan verdict in the outcome contract on an MNPI surface — surface ClamAV per file.
- [P3]: pulse on active step (motion contract); text-white + tranche-hue drag tint; BACK/REMOVE/DISMISS target candidates; result CTA hierarchy.
- Path to 35+: result retention + mode truth → N1/N3/E8 +3; EDGAR + scan → +1. 31→36.

### Home / shell (29/40)
- [P1][C11-adjacent][SRC] Recovery words captured masked at signup with no confirm/reveal (passcode gets a confirm) — a typo silently corrupts the only self-service recovery — reveal toggle or confirm.
- [P2][C7][SRC] Login tablist ARIA-shaped, not behaved (pattern done correctly elsewhere in-app) — roving or demote.
- [P2][C1][SRC] Native-disabled submit with no reason (recover mode silently needs all three words) — ActionReason.
- [P2][C9][SRC] "/" persona-blind and memory-less (PM pays 2 navs/session; VIEW toggle ignored) — role-aware landing.
- [P2][C13] Recover mode never shows the stored hints it collected — show after email.
- [P3]: dev command leaks into prod failure card; unbranded "Loading…" auth gate; "e.g. Eric Gub" placeholder; stale comment; RETRY off-grammar.
- Path to 35+: recovery integrity → H5 2→3; landing → E1/PM +2; reasons + tabs → H4/H6 +1. 29→35.

### Orphan bucket (no parent cause — 6 findings)
RV compare null-crash (defensive one-off); hardcoded "2026" gap-sort tiebreak
(`command/views.tsx:911`); monitor stale-count vs governance-queue category
reconciliation; recovery-words-unverifiable (integrity one-off); Ask openWith
prefill drop on issuer-scoped panel (P3, needs confirm); post-run Query composer
reachability at 1280px (needs confirm). Bucket is small — the causes above
genuinely cover the findings.

---

## 5. The redesign plan

Dependency-ordered. Each phase: what changes → why before the next → findings
closed → surfaces touched → verification → rollback. All work fits the existing
design contract. Boundaries for the executing session: never `git add -A`
(parallel WIP), compare against origin/main, run impact analysis before editing
shared symbols, keep `turbopackFileSystemCacheForDev: false`.

### Phase 0 — Stop the bleed: fabrications, P0s, provenance data (est. small diffs, high review care)
**Changes:** (a) The fabrication cluster: derive report masthead run/date from
the report DSL; compute or delete "0 orphaned"/"trace audit passed"/READY;
gate fixture governance narratives; drop "US HY sleeve" and "Seven-section";
truthful run-mode copy; scope Monitor's DEMO chip to the tape. (b) The five
P0s: pipeline unconditional run fetch + not-loaded state; profile authority
branch on run presence; sector loading kind; (reports P0s are (a)).
(c) Backend provenance (pre-approved): stamp `as_of_date` (default completion
date) + return `completed_at` in run list DTOs; add issuer name/ticker to
run-shaped DTOs or ship a shared resolver; migration if schema requires.
(d) The two data-loss chrome P1s: palette CustomEvent text handoff; Esc
topmost-overlay registry (minimal version: newest-overlay-only handling).
**Why first:** wrong numbers and lost work outrank craft; C4's data is a
dependency of Phases 2-3 displays; tiny diffs — no primitives needed.
**Closes:** 5 P0s, fabrication cluster, chrome P1 #1/#3, C4's UUID/UNKNOWN
findings become one-line client fixes.
**Verify:** live drive of each P0 repro from this document (deep-link pipeline;
profile with Restricted run; sector slow-fetch throttle; publish a live report
and read its masthead; palette ⌘K→type→Enter on /query). Server: run suite in
`.venv311`; `alembic check` if migrated. Re-run axe (must stay 0).
**Rollback:** each item is an independent commit; revert per item. Backend DTO
additions are additive (nullable fields) — no client depends on absence.

### Phase 1 — The primitives: Button, DataTable, SurfaceState adoption, sev contract, interaction utils (C1, C2, C5, C6, C7)
**Changes:** `components/ui/Button` (tiers, 24px desktop floor + documented
dense exceptions, disabled-with-reason only, confirm/arm API), `ui/DataTable`
(typed columns → alignment/tabular/decimals/units-in-header/aria-sort/roving
row focus, virtualization-safe), SurfaceState `not-run`/`checking` kinds +
adoption on every async panel, `sev-presentation` module (Restricted/
Not-Reviewed/queued/observed-empty explicit; aggregate rule: warning never
collapses into cleared) with unit tests, overlay-stack manager + `useRovingTabs`
+ listbox helper, focus-ring scope to body. Migrate by cluster: first the dead-
selector and grammar-less buttons (56 files, mechanical), the 12 raw tables +
4 ARIA grids, the 10 hand-rolled state sites, the 4 ARIA-shaped controls.
**Why second:** every Phase-2/3 fix would otherwise re-implement these
per-surface — this is the structural change that stops the drift recurring
(the brief's core demand).
**Closes:** ~60 findings across C1/C2/C5/C6/C7 incl. deepdive greenwash,
monitor severity grammar, RV focus/alignment, IC Book/portfolio alignment
inversions, issuers grid model, palette scroll, RoleViewSwitch/login/command
tabs.
**Verify:** geometry harness re-run (undersized-no-exception count must drop to
the documented-exception list); axe 0; sev unit tests; per-cluster visual spot
checks vs the screenshot baseline in the triage evidence; `detect.mjs` stays
clean.
**Rollback:** primitives land behind additive components — call-site migration
is per-surface commits; revert any surface independently. No token/CSS removals
until all consumers migrate (aliases stay until Phase 4 cleanup).

### Phase 2 — Live-path parity (C3, C12)
**Changes:** adapter layer: per-column align inference, "+N more" truncation
disclosure, per-module QA badge threading (`liveStatus` → pane header + layer
aggregates via the Phase-1 sev contract); monitor live rows get severity bands
+ SourceRef evidence chips; pipeline mid-flight partial sim from persisted
module rows + Blocked-module reason row + re-run affordance; reports
live-builder float formatting through fm/fx; query grounded-lane cited-prose
renderer + graph-lane GraphCanvas routing + count honesty; `SourceRef`
component + "conclusion renders its source or states absence" rule applied
(profile tiles, portfolios inspector, sector conclusions, deepdive trace rail);
model V2 per-node origin chip (and verify V2 availability gating on real
stacks — on qa3 live issuers currently dead-end).
**Why third:** depends on Phase-1 primitives (DataTable, sev, SourceRef
pattern) and Phase-0 data (as-of, names).
**Closes:** ~25 findings; the deployed-reality quality gap that drives the
deepdive/monitor/pipeline/query/reports deltas.
**Verify:** the qa3 protocol from this triage: trigger keyless runs, walk each
surface against live Restricted runs; specifically re-drive: deepdive layer
chips on all-Restricted run (no green), module pane badge, monitor live row
with evidence chip opening the source, pipeline mid-flight view during a
running run, published live report masthead + formatted tables, grounded query
rendering prose.
**Rollback:** adapter changes are pure-frontend; per-surface commits.

### Phase 3 — Per-surface closes (C8, C10, C11, C13, C14 + surface P1/P2 sets)
**Changes:** worklist keyboard model everywhere DataTable landed (row focus,
sort, bulk); ActionReason for every gate reason; header/identity slot contract
(badges vs children) + clip guards + nav-registry titles; the wiring-gate
fixes (upload result retention + EDGAR + run-mode truth; issuers Esc + batch
failure list + confirm; portfolios substitution/filter truth; settings save
unification + round-trip + key tri-state + holdings two-phase; command
top-change navigation + ack feedback; sponsors selection churn; sector posture
rendering + comparables metrics + ratify confirm; decisions names/sort/vote
confirm/UTC-local; research retry banner; home recovery-word confirm +
role-aware landing (with C9's durable feed + badges); copy pass (Restricted
tooltip FIRST, period/date/module formatters, jargon list from §4)).
**Why fourth:** these are the symptom closes that Phases 0-2 made cheap and
non-recurring.
**Closes:** the remaining P1/P2 register (~50 findings).
**Verify:** per-surface: the §4 path-to-35 line is the checklist; each named
finding gets a live drive or test. The wiring gate: every control touched gets
its claim exercised once (the C11 acceptance rule).
**Rollback:** independent per-surface commits.

### Phase 4 — Polish + governance hardening (P3 register, C14-token)
**Changes:** off-token hex cleanup (chart palettes to categorical ramp tokens;
tranche-hue repurposing; text-[9px] → tokens; deprecated alias removal after
Phase-1 migration), motion contract (240ms→160ms enters; JS smooth-scroll
reduced-motion guard; pulse only-for-live sweep), remaining P3s, the orphan
bucket, plus process guards: lint rules (raw `<button>`/`<table>` outside
`ui/`, hex literals outside globals/charts allowlist, missing loading state on
async panels) and the sev/aggregation unit tests as CI gates — the "structural
change that stops the drift" made permanent.
**Verify:** `detect.mjs` clean; grep-gates zero; axe 0; geometry re-run.
**Rollback:** cosmetic; per-commit.

### Phase 5 — Re-score gate
**Changes:** none — measurement. Re-run the full instrument: fresh-context
critique per surface (the §8 method), axe, geometry harness, persona walks on
live runs.
**Gate:** every surface ≥35/40; zero P0; axe 0; three persona walks pass per
surface. Any surface <35 gets a named residual list and returns to Phase 3
scope. Honest-33 escape hatch: if a surface can't reach 35 without violating
the fixed contract, document the tension (none identified today — §7).

---

## 6. Rejected options

- **Full visual re-theme / new design language.** The token system, motion
  rules, and paper counterpoint measure strong (detector: 1 advisory across the
  whole tree; axe: 0). The problem is enforcement, not aesthetics. Re-theming
  would burn the budget where the evidence shows no defect.
- **Adopting an external component library (shadcn/Radix/AG-Grid etc.).** The
  density register, action grammar, and provenance chrome are bespoke and
  contract-fixed; retrofitting a general-purpose library means fighting its
  defaults everywhere the contract is specific (32px Panel, 10.5px mono
  actions, sev vocabulary). Radix-style *behavior* primitives were considered
  for the overlay/roving utilities specifically — rejected for now because the
  needed surface is small (3 utilities) and the app already has half of it
  (use-modal-a11y, model grid) to consolidate; revisit only if Phase-1 utility
  work exceeds a week.
- **Route/IA restructuring (merging the 18 into fewer surfaces).** The nav
  registry is single-sourced and drift-free (chrome strength [SRC]) and no
  finding traces to route structure; the IA change worth making is the
  role-aware landing (Phase 3), not consolidation.
- **Fixing findings surface-by-surface without the primitives.** That is what
  the last cycles did (98-finding frontend matrix, per-surface sweeps) — scores
  still landed 23–32 because each fix re-implemented conventions by hand. A
  flat fix list relabels the drift; it doesn't stop it.
- **Hard 24×24 floor on every control.** A dense terminal legitimately runs
  small controls; the honest read (per the brief) is floor-with-documented-
  exceptions: controls that take the SC 2.5.8 spacing exception are enumerated
  (geometry harness output), everything else meets 24px. Blanket 24px would
  cost the density that is the product's requirement.
- **Making model-sheet cells editable inputs (spreadsheet-parity).** The
  activedescendant display-grid + assumptions-drivers split is sound and
  keyboard-verified [LIVE]; per-cell inputs would trade a working a11y model
  for parity nobody asked for. The driver-input size fix suffices.
- **Demo-content removal.** The seeded showcase teaches the product and the
  replay honesty engineering is exemplary; the fix is scope (chip on the tape,
  not the page) and live-parity, not deletion.

## 7. Open tensions

1. **Density vs the 24px floor on the model drivers.** 58 scrub targets at
   40×20 [PIX]. Recommendation: take the 24px row (costs ~60px of internal
   scroll, no information); the adjacent-driver mis-scrub risk outweighs the
   density win. Decided in-plan (Phase 1); flagged because it is the one place
   the "dense terminal exception" argument was seriously entertained and
   rejected.
2. **Analyst-first landing vs the PM's two-navigation tax.** The contract says
   analyst wins conflicts; the PM persona fails its seconds-scan from cold
   every session. Recommendation: role-aware redirect honoring the existing
   VIEW toggle (analyst default unchanged — /issuers) — analyst loses nothing,
   so this is not a true contract conflict. If the user prefers a single
   deterministic landing for all roles, the PM walk stays failed at "arrive
   cold" and passes only after one navigation; state it rather than fake it.
3. **Seeded showcase on live surfaces.** Committee-trust argues for quarantine;
   product-teaching argues for presence. Recommendation (Phase 0/2): demo
   content only inside explicitly-bordered, chip-scoped panels; never a
   page-scope DEMO claim over live data; never fixture strings (run ids,
   dates, narratives) in deliverable or register chrome. This preserves both.
4. **"WCAG clean" vs actual keyboard quality.** axe reports 0 violations while
   four ARIA-shaped-but-not-behaved patterns and hover-only reasons ship [SRC].
   The success bar's axe gate stays necessary-not-sufficient; Phase 5 adds the
   persona keyboard walks as the real gate. No contract conflict — just naming
   that the automated gate alone would have called this system done.
5. **Scoring instrument depth.** This triage's 24–32 band vs the prior
   36/40 two-surface claim (§2). Standardize on this instrument (fresh-context
   isolated assessors + measured geometry + live-state probes) for the Phase-5
   gate so "≥35" means the same thing that "23–32" meant.

---

## 8. Appendix — method & evidence provenance

- **Stack:** isolated qa3 (frontend :3030 dev server rendering the working
  tree; backend :8030, `caos_qa3.db`, `CAOS_DEMO_SEED=1`, keyless). 4 seeded
  issuers; 4 live runs triggered via POST /api/runs — all completed
  `qa_status: Restricted` (expected keyless), giving live+degraded states on
  every surface. User's :3000/:8000 untouched.
- **Scores:** one fresh-context assessor agent per surface (core six + chrome)
  and per 3-surface batch (remaining twelve — token-cap mitigation, disclosed),
  each given the design contract, the four-lens spec, screenshots, and file
  paths — never the parent's hypotheses, detector output, or prior critiques.
  Assessment-B evidence (below) was gathered by deterministic instruments and
  joined only after each assessment returned (adapted from the impeccable
  dual-agent flow because subagents cannot attach the parent's preview stack;
  per-surface records carry the method note).
- **Instruments:** axe-core via `caos/frontend/scripts/a11y-axe.mjs`,
  BASE=:3030 — **0 violations, 18 routes, 0 scan errors**, tags
  wcag2a/wcag2aa/wcag21a/wcag21aa/wcag22aa, 1440×900. Rendered geometry:
  Playwright harness over all 18 routes — every interactive rect measured;
  SC 2.5.8 spacing-exception computed; headline results: model 58
  no-exception sub-24px targets (driver inputs), command 8 (worklist link
  pairs), all other routes 0–2 beyond the two 1×1 sr-only skip links (exempt
  by design). Impeccable detector (`detect.mjs`) over app+components: **1
  advisory** (4px radius off-scale) — no slop-class findings. Structural
  greps: raw `<button>` 85 files / 56 grammar-less; raw `<table>` 12;
  `text-right` 22 vs `tabular` 105; hex literals 47; `text-[9px]` ×11;
  `transition-caos` 73 files vs 2 stray durations.
- **Verification passes:** three fresh-context refute agents — system layer
  (10/10 confirmed with count corrections), core-six claims (12/12 confirmed),
  remaining-twelve claims (12/12 confirmed, one nuance) — plus parent live
  adjudications for every P0 and the chrome P1s. Three keyboard/interaction
  false alarms produced by synthetic event dispatch were caught by real-input
  retests and discarded (palette Enter, model-grid arrows, citation-modal
  focus) — no finding in this document rests on synthetic input.
- **Session evidence** (scratchpad, session-scoped): per-surface records,
  geometry JSONs, axe results, probe log, screenshots. This document is
  self-contained for execution; the scratchpad adds raw JSON detail only.
