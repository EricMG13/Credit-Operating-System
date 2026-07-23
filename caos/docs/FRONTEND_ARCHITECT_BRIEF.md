# Frontend Architecture Review — Execution Context for Fable 5

> **What this file is.** A self-contained context pack. You (Fable 5) are the **Principal Product Architect *and* the Principal Designer** of this application — you hold full authority over its UX and UI. Read this whole file, then own the mission below. Everything you need — product goal, the immutable brand law, the exact evaluation commands, the real file map, a proven output shape, and a self-check protocol — is here. You are not filling in a template; you are deciding what this product's front end should *be*. **"Redesign" throughout means information architecture, interaction, hierarchy, and AI-wiring — *not* re-theming: the CAOS dark-terminal visual system and its tokens are fixed (§3a), and the theming layer already passes (§2d).** Do **not** write application code — your deliverable is a Markdown implementation specification that **Opus 4.8** executes.
>
> **Repo root:** `/Users/ericguei/Claude/Projects/Credit Operating System`
> **Frontend root:** `caos/frontend/` (Next.js 16, App Router, `src/app/…`)
> **Write your spec to:** `caos/docs/FRONTEND_IMPLEMENTATION_SPEC.md`

---

## 0. The Mission

**Outcome you own:** a leveraged-loan credit analyst opens this application and it makes them materially better at their job — faster to a defensible credit view, and in possession of proprietary signal a Bloomberg terminal will not give them. Everything below serves that one outcome.

CAOS is meant to be an **AI-powered credit-research operating system for leveraged-loan analysis**. The front end must not merely support research and monitoring — it must **actively use AI to expand analyst capability, drive proprietary insight, and improve institutional judgment**. Today it falls short of that on two fronts, and your job is to specify the redesign that closes both:

1. **Current-state design integrity.** The existing surfaces underperform against the Impeccable evaluators and don't yet feel like one committee-ready instrument. Decide the redesign — information architecture, interaction model, hierarchy, component design, what to cut and what to deepen — that raises **every user-facing surface, and the app as a whole, to ≥36 on the Impeccable 40-point critique scale (the Excellent band — see §2)**.
2. **Net-new material value.** Name and specify the capabilities that are *missing entirely* and would create real leverage for a credit analyst — the things that would make this the analyst's primary instrument rather than one more dashboard.

**Your design authority is full, inside four fixed boundaries.** You decide the UX and UI — layout, navigation, flows, states, motion, what each surface becomes, which net-new capabilities to build and how they look and behave. You do **not** get to move these four posts, and every decision must survive them:
- **The brand/token law (§3a) is immutable.** Design *within* the CAOS dark-institutional-terminal system and its exact `--caos-*` tokens; do not invent a new palette, a new type system, or a new theme. Report Studio's light paper theme is likewise fixed.
- **WCAG 2.1 AA is non-negotiable** — including status/meaning never carried by color alone, and full keyboard operability.
- **Every feature must earn its place in credit research.** If you cannot state in one line how a thing helps an analyst reach or defend a credit conclusion, it does not go in the spec. This is the guard against designing a generic SaaS product.
- **Respect the mock↔engine seam (§1, §5).** Wire surfaces to the data that actually exists; never specify fabricated data or a lane the backend can't feed.

**Deliverable.** A single Markdown spec that Opus 4.8 can execute top-to-bottom, **grouped strictly by execution severity (P0→P3)**. Each item states the gap in one sentence, points at real files and named functional blocks (**never guessed line numbers**), gives Opus an explicit, technical build instruction, names the Impeccable rule and the credit-market payoff it serves. §6 gives a proven item shape — use it as a scaffold and adapt it to what each finding actually needs; it is a floor for completeness, not a cage. As you go, run the self-check in §7.

---

## 0.1 How to work — operating guide (written for how Fable 5 performs best)

Read this before you start; it is calibrated to how you specifically do your best work.

- **Design first, then decompose. Don't wait for permission.** You have the goal, the constraints, and the map. When you have enough to decide, decide — pick the redesign direction and specify it. Give a recommendation, not an exhaustive survey of options you won't pursue. Re-deriving what this file already establishes, or re-litigating a settled constraint, is wasted motion.
- **Start at the hardest surface, not the easiest.** Command Center and Monitor (mock, and farthest from the "AI-powered" goal — §5) are where the design problem is real. Scope them first, decide the hard calls there, and the rest of the app follows the pattern you set.
- **For each surface, commit to a direction — but generate options first where the design space is wide.** Where a surface could plausibly go several ways, briefly lay out 2–4 concrete directions (each: what changes, why it serves the analyst, one line of rationale), pick one, and specify only that one in depth. Don't hand Opus a menu; hand Opus a decision with its reasoning.
- **Lead every writeup with the outcome.** The first sentence of any section, and of the final report, answers "what should change and why does the analyst care" — the TLDR a PM would ask for. Supporting detail comes after. Readability beats brevity: complete sentences, spelled-out terms, no arrow-chains or invented shorthand. Opus (and the user) read this cold. (This brief itself uses compressed shorthand — arrows, `A→B` chains — for density; that is a note-taking register, not a model for your deliverable. Write the spec in full prose as if the reader has none of this context.)
- **Ground every claim in evidence.** Before asserting a surface scores X, a file contains Y, or a lane is unwired, point to the thing — a `detect.mjs` result, a snapshot, a `grep`/read. A path or a score you didn't verify is a defect, not a finding. If you reasoned from the detector + rubric without rendering a page, say so; don't claim a browser overlay or a score you didn't produce.
- **State boundaries, then stay inside them.** Your remit is a *spec*, not code and not fabricated features. Don't specify capabilities the backend can't feed, don't invent tokens or dependencies, and don't let "full design authority" drift into a redesign that abandons the CAOS aesthetic — authority is over *how the fixed system is used*, not over the system.
- **Delegate verification to fresh-context sub-agents, and keep working while they run.** Your self-check (§7) is strongest when a separate agent that has *not* seen your reasoning audits it — fresh eyes catch hallucinated paths and non-credit features that self-review rationalizes. Fan these out asynchronously at each checkpoint; don't block on the slowest one.
- **Keep a working memory file.** As you scope surfaces, record decisions and their rationale (e.g. a short `caos/docs/.frontend-spec-notes.md`): which direction you chose per surface and why, which features you rejected as non-credit and why. It keeps the spec internally consistent across 14 surfaces and gives your checkpoints something to audit against.
- **De-prescription is deliberate.** This brief tells you the goal, the constraints, and the map — not a step list — on purpose. Fill the gaps with judgment; that is the job you were given.

---

## 1. Product goal, users, and what "material leverage" means

**CAOS — Credit Agent OS.** An institutional leveraged-finance credit-analysis platform. Five core concepts (Command Center, Pipeline, Deep-Dive, Model Builder, Report Studio) over a FastAPI engine; the analytical methodology is a 27-module "Modular OS" prompt corpus. First deployment is **leveraged loans only**; the canonical spread metric is **discount margin (DM)** — not STW/Z-spread/YTW.

**Primary user — the buy-side credit analyst.** Builds a defensible credit view they can defend to an investment committee. Work is dense, multi-window, numbers-heavy; a wrong read costs money. Secondary personas: **PM/CIO** (scans Command Center for posture and "what changed") and **Head of Research / QA** (coverage health, the CP-5 QA gate, governance). Users are specialists who value **precision over hand-holding**.

**"Material leverage for a credit analyst"** means capability that measurably shortens the path from raw disclosure → defensible committee view, or surfaces proprietary signal a Bloomberg terminal will not. Concretely, credit-market-valuable levers include: covenant/RP-basket/cross-default extraction and domino mapping; recovery-waterfall and EV-at-distress modeling; relative-value vs peers on DM/leverage/coverage percentiles; "what changed" since last read (rating actions, filings, spread moves); evidence-linked citations one click from every number; scenario/leverage-shock stress; sponsor track-record. **These are candidates, not a shopping list** — spec any of them only after confirming a live data lane in §5 (some are already wired, e.g. the covenant register; others are not). No lane → not in this spec (see the §6 P3 gate). **Anti-pattern to reject: generic SaaS dashboard features** (activity feeds, gamification, social, vanity KPIs) with no credit-research payoff. Every proposed feature must answer: *"How does this help an analyst reach or defend a credit conclusion?"*

**The mock↔engine seam (critical context).** CAOS has two halves: the Modular OS methodology and a **deterministic engine slice** that emits real output. The UI is **seeded mock overlaid by live runs** — surfaces "prefer live, static fallback": on no run / no backend / any error they return `EMPTY` and fall back to seeded constants. Some surfaces are **fully wired to the engine**; **Command Center and Monitor are still Phase-2 mock** (no engine calls). Do not propose "add AI" to a surface that already has a live lane; instead propose wiring the mock surfaces and *deepening* the AI lanes that exist. Know which is which before you write (§4, §5).

---

## 2. The Impeccable deterministic rule scale (the ≥36 target)

There are **two** Impeccable evaluators. The mission's **≥36** bar refers to the **critique** total.

### 2a. `/impeccable critique <target>` → 40-point Nielsen-heuristic score  ← **this is the ≥36 scale**
Scores each of Nielsen's 10 usability heuristics **0–4** (40 max). Rating bands:

| Range | Band | Meaning |
|---|---|---|
| **36–40** | **Excellent** | **The target — minor polish only; genuinely committee-ready** |
| 28–35 | Good | Solid foundation, weak areas remain — *not yet the bar* |
| 20–27 | Acceptable | Significant work needed |
| 12–19 | Poor | Major UX overhaul |
| 0–11 | Critical | Redesign |

> "Most real interfaces score 20–32. A 4 means *genuinely excellent*." **≥36 is a demanding bar: it means every surface must land 4s on most of the ten heuristics with no soft dimension anywhere — essentially no gaps left.** That is deliberately harder than the earlier ≥32 target; a surface at 33–35 is close but not done, and your spec must name what specifically moves it the last few points. The 10 heuristics, each a lever Opus can move:
> 1. Visibility of system status (loading, run progress, "what changed", active location)
> 2. Match system ↔ real world (desk vocabulary: DM, leverage, coverage — not tech jargon)
> 3. User control & freedom (undo, cancel, escape long runs, clear filters)
> 4. Consistency & standards (shared shell, tokens, one interaction grammar)
> 5. Error prevention (confirm destructive, constrain inputs, smart defaults)
> 6. Recognition over recall (visible options, labeled glyphs, recent/history)
> 7. Flexibility & efficiency (keyboard shortcuts, bulk actions, power paths)
> 8. Aesthetic & minimalist design (every element earns its pixel; density *organized*)
> 9. Error recovery (plain-language, actionable, non-destructive)
> 10. Help & documentation (contextual, task-focused, in-place)

Critique also produces: an **AI-slop verdict**, an **8-item cognitive-load checklist** (≤4 items per group; ≤4 visible options per decision point), a **persona red-flag pass** (Alex power-user, Sam a11y, Riley stress-tester most relevant here — data-heavy/analytics ⇒ Alex + Sam), and **P0–P3 severity** per issue.

### 2b. `/impeccable audit <target>` → 20-point technical score
Scores 5 dimensions **0–4** (20 max): **Accessibility, Performance, Responsive, Theming, Anti-Patterns**. Bands: 18–20 Excellent · 14–17 Good · 10–13 Acceptable · 6–9 Poor · 0–5 Critical. This is the code-level companion to critique — use it to justify the *technical* instructions you hand Opus (WCAG AA 4.5:1 contrast, 44×44px touch targets, token usage, no hard-coded color, no layout-property animation).

### 2c. The deterministic detector (run this directly)
Both evaluators run a bundled, no-network detector that flags AI-slop tells and quality issues:

```bash
node .claude/skills/impeccable/scripts/detect.mjs --json <markup-target>   # exit 0 = clean, 2 = findings
```
Pass **markup files/dirs** (`.tsx`/`.html`), **not** CSS-only files. This is your objective, reproducible signal — cite its output.

### 2d. MEASURED BASELINE (already run for you — 2026-07-08)

I ran the deterministic detector across `caos/frontend/src/` and read the persisted critique snapshots (`.impeccable/critique/`). **Use these as your starting numbers; re-score only if you touch a surface.** The headline: against the **≥36** bar, **no surface currently passes** — the whole app is a redesign target, not a polish pass. (Redesign of *IA / interaction / AI-wiring* — the theming layer already passes the detector, so this is not a re-theme; §3a holds.)

**Latest 40-pt critique scores per surface (from `.impeccable/critique/`, dated 2026-07-03…07-05):**

| Surface | 40-pt total | P0 | P1 | gap to ≥36 |
|---|---|---|---|---|
| Deep-Dive | **35** | 0 | 1 | −1 (closest; still not there) |
| Command Center | 31 | 0 | 0 | −5 |
| Query | 31 | 0 | 3 | −5 |
| Report Studio | 31 | 0 | 0 | −5 |
| Issuer Profile | 31 | 0 | 2 | −5 |
| Monitor | 28 | 0 | 2 | −8 |
| Model Builder | 28 | **1** | 4 | −8, carries a **P0** |
| **Whole frontend (2026-07-05)** | **26** | 0 | 3 | **−10** |

> **Zero surfaces clear 36.** Deep-Dive (35) is one point short; the pack sits 28–31; the whole-app critique is **26** (−10 from bar). Sector Review / Sector RV / Deep Research / Settings / Upload have **no recent snapshot** — critique those fresh. Model Builder carries a **P0** — highest-priority single fix. The ≥36 bar means even the "good" surfaces (31) need a real second push, not a touch-up.
>
> **Two guardrails on how you use these numbers:** (1) **The table gives per-surface *totals* only, not the per-heuristic 0–4 breakdown.** Before you claim a specific heuristic is the one sitting at 3 (and name the move to 4), open that surface's persisted snapshot in `.impeccable/critique/` for its per-heuristic scores, or re-run `/impeccable critique` — do not assert a heuristic score you have not seen. (2) **≥36 is the measurable proxy, not the objective.** The objective is a surface that genuinely makes the analyst better; move heuristics by making the surface *actually* better (real live status, real error recovery, real power paths), never by bolting on rubric-satisfying chrome to nudge a number. If a change wouldn't help an analyst, it doesn't earn its point.

**Deterministic detector result (whole `src/`): 25 findings, ALL `severity: advisory`, 0 warning/critical.**
- Breakdown: `design-system-color` ×20, `design-system-radius` ×5.
- **20 of 25 are in `caos/frontend/src/app/globals.css`** — i.e. the literal color values inside the `--caos-*` **token definitions themselves** (near-certain false positives; a token file must contain literal colors). Verify, then mostly ignore.
- Only ~5 findings touch real markup: a `border-radius: 0.5rem` in `src/app/global-error.tsx` (line ~35) outside the DESIGN.md radius scale, and one advisory each in `components/deepdive`, `components/pipeline`, `components/query`.
- **No AI-slop tells fired** — no gradient-text, glassmorphism, hero-metric, side-stripe borders, or identical-card-grid antipatterns anywhere.

**STRATEGIC IMPLICATION (weight your spec accordingly):** the **code-level anti-pattern / theming layer already passes** — reaching ≥36 is **not** a slop-removal job. The deficit lives in two places, and your P0/P1 items should concentrate there:
1. **The heuristic/UX layer** (critique 40-pt): surfaces lose points on system-status visibility, error prevention/recovery, flexibility & efficiency (keyboard/power paths for Alex), and help/documentation — *not* aesthetics. To reach the Excellent band these must be pushed to 4 (near-perfect), not merely made "good" — that is where the last −5 to −10 points live.
2. **The AI-leverage layer**: Command Center and Monitor are still mock (§5) while a live backend autonomy DAG + RAG lane sit unwired — the single biggest lever for both the ≥36 goal (real live system-status/feedback is worth multiple heuristic points) and the "material leverage" goal.

---

## 3. Running the baseline (do this first, before writing the spec)

The mission requires the audit/critique output as your baseline. Mechanics:

1. **`/impeccable` is a Claude Code skill** (invoked as `/impeccable audit <target>` and `/impeccable critique <target>`). Setup runs once per session:
   ```bash
   node .claude/skills/impeccable/scripts/context.mjs        # prints project PRODUCT.md / Design Context
   ```
   The project's design law lives in `CLAUDE.md` under **## Design Context** (reproduced in §3a below) — that is your register reference.
2. **Targets are the per-surface source files** — prefer the source path over a dev-server URL (ports drift, paths don't). Use the `page.tsx` (and its primary component) for each surface in §4. For a whole-surface read, pass the surface's component directory.
3. **Run the detector per surface** (`detect.mjs --json`) and record counts + rule names + file locations. If browser automation/overlay is unavailable to you, that is an accepted fallback — the CLI scan + the rubric reasoning are sufficient to set your baseline; say so explicitly rather than claiming an overlay exists.
4. **Critique persists a snapshot** under `.impeccable/critique/` and tracks a per-slug trend. Prior runs exist (a 2026-07-04 sweep chased an **earlier, lower ≥32 bar**, e.g. Monitor 20→28→…; that target is now superseded by ≥36 and the persisted scores in §2d are the honest current state); read any existing snapshot for the surface before re-scoring so your baseline reflects the *current* tree, and note the delta.

> **Efficiency note.** You do not need a live browser to set a defensible baseline. Read the source, run `detect.mjs`, score against the §2a/§2b rubrics, and cite concretely (file + rule + heuristic). Only escalate to browser overlay if a claim genuinely needs rendered evidence.

### 3a. CAOS Design Context — the design law Opus MUST obey (condensed, authoritative)

**Aesthetic:** a *refined institutional terminal — a designed Bloomberg, not a raw one.* Calm institutional authority + trading-desk alertness + confident clarity + trust-through-transparency. Copy is terse, technical, exact — label like a desk, not a brochure. **No marketing language, no emoji in product chrome.**

**Dark workspace, single mode. Exact tokens (`caos/frontend/src/app/globals.css`, mapped in `tailwind.config.js`):**
- Surfaces ramp `--caos-bg #0a0a0f` → `--caos-panel #11131d` → `--caos-elevated #1d2030`
- Hairline borders `--caos-border #34384a`; text `#e6e6ef`, muted `#a1a1b5`; accent blue `#63a1ff`
- **Color is signal, never decoration:** warning `#f5a524`, critical `#ef4444`, success `#22c55e`, idle `#3f3f46`
- Categorical seniority/tranche ramp (1L teal, 2L blue, unsec amber, sub purple, equity slate) — distinct hues, **no lightness banding**

**Type:** Inter (sans) + JetBrains Mono (mono); all numerics `tabular-nums` with aligned decimals (`.tabular`); small 9–12px uppercase letter-spaced labels; the **32px uppercase `<Panel>` header is the structural unit**.

**Motion:** 160ms ease-out (`.transition-caos`); pulse **only** for live/running state; always honor `prefers-reduced-motion`.

**Report Studio is a deliberate counterpoint:** a **light "paper" tear-sheet** (ink on cream, monospace mastheads, print-ready) — looks like a filed institutional document. Do not dark-theme it.

**Accessibility (hard requirement):** WCAG 2.1 AA, colorblind-safe. Text ≥4.5:1 (3:1 large/bold) — validate the small muted labels specifically. **Status and tranche meaning is never carried by color alone** — pair every semantic color with a glyph, label, or position. Honor reduced-motion everywhere; every interactive surface (incl. cross-pane Evidence Sync selection) is keyboard-operable with a visible focus ring. (Verify with the real runner: `node caos/frontend/scripts/a11y-axe.mjs` — axe-core, not regex.)

**Anti-references / absolute bans (match-and-refuse — if Opus is about to write one, restructure):** not a friendly consumer-SaaS dashboard (oversized type, pastel cards, illustrative art, generous empty space); not a raw unstyled terminal dump (density must be *organized*); no decorative gradients/glow/skeuomorphism. Plus the Impeccable universal bans: **side-stripe borders** (>1px colored left/right accent), **gradient text** (`background-clip:text` + gradient), **glassmorphism as default**, the **hero-metric template** (big number + label + gradient), **identical card grids**, **tiny uppercase tracked eyebrows on every section**, **numbered 01/02/03 section markers as scaffolding**, and **text that overflows its container** at any breakpoint. Cards are the lazy answer — nested cards are always wrong.

**Design principles (tie every instruction back to one):** (1) density with hierarchy; (2) color is signal not decoration; (3) show your work — every conclusion one interaction from its evidence; (4) motion only for life; (5) committee-ready by default.

---

## 4. Frontend architecture map (real paths — use these, do not invent)

> Actual app dir is **`caos/frontend/src/app/`**. Root `src/app/page.tsx` is a client redirect to `/issuers`. Root `src/app/layout.tsx` wraps everything: `AuthProvider → NotificationProvider → IssuerProfileOverlayProvider → AskProvider`, mounts `ConceptHotkeys`, a skip-link, the `<main>` landmark + `RouteHeading`, `GlobalIssuerSearch`, `AskLauncher`, `IssuerProfileOverlay`; imports `globals.css`.

### Surfaces (the "concepts") — 14 routes

| Surface | Route / page file | Primary components |
|---|---|---|
| **Command Center** | `caos/frontend/src/app/command/page.tsx` | `components/command/` — `views.tsx`, `SectorRV.tsx`, `LiveCoverage.tsx`, `NlQuery.tsx`, `CitationViewer.tsx` |
| **Pipeline** | `caos/frontend/src/app/pipeline/page.tsx` | `components/pipeline/views.tsx`, `atoms.tsx` |
| **Deep-Dive** | `caos/frontend/src/app/deepdive/page.tsx` | `components/deepdive/` — `tabs.tsx`, `rails.tsx`, `OutputRegister.tsx`, `IssuerChat.tsx`, `ModuleCharts.tsx`, `OutSections.tsx` |
| **Model Builder** | `caos/frontend/src/app/model/page.tsx` | `components/model/ModelSheet.tsx`, `AssumptionsPanel.tsx`, `ScenarioPanel.tsx` |
| **Report Studio** | `caos/frontend/src/app/reports/page.tsx` | `components/reports/ReportDoc.tsx`, `panels.tsx`, `EvidenceModal.tsx`, `ExportToVaultButton.tsx` |
| **Issuer Universe / Directory** | `caos/frontend/src/app/issuers/page.tsx` | inline table/grid |
| **Issuer Profile** | `caos/frontend/src/app/issuers/profile/page.tsx` → `ProfileContent.tsx` | `src/app/issuers/profile/ProfileContent.tsx` (also mounts as an overlay via `IssuerProfileOverlay`) |
| **Monitor** | `caos/frontend/src/app/monitor/page.tsx` | reuses `components/command/views.tsx` (`AlertFeed`, `EmailIntel`) + `components/pipeline/atoms.tsx` |
| **Query** | `caos/frontend/src/app/query/page.tsx` | `components/query/` — `GraphCanvas`, `ScatterCanvas`, `RelativeValueTable`, `AiAnswer`, `EvidenceDock`, `InsightFeed`, `LineageFlow`, `ReportRail`, `WatchlistEditor`, `VaultMemoUpload`, `GroupLauncher` |
| **Deep Research** | `caos/frontend/src/app/research/page.tsx` | `components/research/ReportPane.tsx`, `ReportBody.tsx` |
| **Sector Review** | `caos/frontend/src/app/sector/page.tsx` | `components/sector/SectorReviewWorkspace.tsx` |
| **Sector Relative Value** | `caos/frontend/src/app/sector-rv/page.tsx` | reuses command RV views + `lib/command/rvdata.ts` |
| **Settings** | `caos/frontend/src/app/settings/page.tsx` | `components/settings/PortfoliosPanel.tsx` |
| **Upload / Ingest** | `caos/frontend/src/app/upload/page.tsx` | `components/upload/UploadWizard.tsx`, `steps.tsx`, `EdgarImport.tsx` |

Utility routes (not concepts, but part of the a11y/error-recovery surface): `src/app/error.tsx`, `global-error.tsx`, `not-found.tsx`.

### Shared shell / layout primitives (`caos/frontend/src/components/shared/`)
- `ResponsiveShell.tsx` — breakpoint-aware page chrome; desktop passthrough, collapses/stacks < 1024px; renders `SubHeader`.
- `SubHeader.tsx` — the 40px sub-header strip (identity | contextual controls | primary action); collapses controls into a "⋯ More" popover < 1280px.
- `PageSubHeader.tsx` — simpler back-link + `ConceptNav` + children (used by pages not on ResponsiveShell, e.g. research).
- `ConceptNav.tsx` — concept switcher (seven concept chips, inline-SVG glyphs; `compact` labels only the active chip).
- `Panel.tsx` — core panel/card primitive (the 32px uppercase header unit). `RailShell.tsx` — collapsible side-rail chrome. `MoreDrawer.tsx` — overflow drawer for narrow layouts.
- Other primitives: `StatCard.tsx`, `headStat.tsx`, `SectionHeader.tsx`, `TextInput.tsx`, `CloseButton.tsx`, `CollapseButton.tsx`, `StatusGlyph.tsx`, `FlashOnChange.tsx`, `TableColumnFilter.tsx`, toggles (`AiModeToggle`, `ModelModeToggle`, `ScopeToggle`), shared class tokens in `styles.ts` (`labelCls`, `INPUT_BASE`). Charts: `components/charts/G2Chart.tsx` + color tokens in `lib/chart-colors.ts`. **There is no `components/ui` / `components/primitives` dir — extend `shared/`.**

**Shell-migration status:** 10 surfaces on `ResponsiveShell`+`SubHeader` (command, deepdive, issuers, issuers/profile, model, pipeline, query, reports, sector-rv, sector-via-workspace); research + settings wear the SubHeader strip only; **Monitor and Upload still hand-roll a header with bare `ConceptNav`** — an obvious Consistency (heuristic 4) gap.

### Data seam
Single API client: **`caos/frontend/src/lib/api.ts`** — one axios instance (same-origin `/api`, proxied to FastAPI `:8000` in dev via `next.config.js`), ~65 typed calls (`getIssuers`, `getIssuerProfile`, `getPortfolio`, `listRuns`, `getSavedModel`/`saveModel`, `nlQuery`/`queryAnswer`/`queryCapabilities`, `deepResearch`/`getResearchStatus`, `getSectorReview`/`getSectorSignals`, `uploadDocument`/`uploadVaultMemo`, `getAnalystSettings`/`getSettings`, auth `getMe`/`login`/`register`). It attaches `X-Model-Mode`/`X-Query-Model` headers and fires `caos:auth-lost` on 401. Live-engine reads are hooks under `src/lib/engine/` (`useLiveRun.ts`, `useLatestRun.ts`, `useModelEngine.ts`, `usePortfolio.ts`) and `src/lib/pipeline/useLivePipeline.ts` — all "**prefer live, static fallback**". Seed/mock data: `src/lib/command/data.ts` (+ `market-data.json`, `rvdata.ts`, `coverage.ts`, `stats.ts`), `src/lib/pipeline/data.ts` (`MODULES`, `SIM_PLAN`, `RUN_MODES`) + `sim.ts`/`sim-engine.ts`, `src/lib/issuers.ts` (`DEMO_UNIVERSE`), static outputs under `src/lib/deepdive/` and `src/lib/reports/`. The bespoke live showcase keys off `ATLF_REFERENCE_ISSUER_ID` (`src/lib/engine/types.ts`).

---

## 5. Data-source classification (know before you spec)

**Fully live / real-data (static fallback):** Issuer Universe (`getIssuers`), Issuer Profile (`getIssuerProfile`), Query (`nlQuery`/`queryAnswer`), Deep Research (`deepResearch`), Sector Review (`getSectorReview`), Settings, Upload. Deep-Dive / Model Builder / Report Studio / Pipeline are live via `useLiveRun`/`useModelEngine`/`useLivePipeline`/`listRuns` but keyed to `ATLF_REFERENCE_ISSUER_ID`, falling back to seed when no run exists.

**Mock / Phase-2 (no or peripheral engine):**
- **Monitor** — *no `api`/engine calls at all*; renders from `lib/command/data.ts` + `lib/pipeline/data.ts` + a local `useSimRun`.
- **Command Center** — most panels (COVERAGE, GAPS, QA_QUEUE, sim alerts, sector board) are static seed; only live touch is `usePortfolio()` (a `GET /api/portfolio` rollup that itself falls back to mock). Effectively Phase-2 mock.
- **Sector Relative Value** — static `lib/command/rvdata.ts` + `PORTFOLIO` seed + peripheral `usePortfolio()`.

> **Strategic read for Vector 1 vs Vector 2:** the *design integrity* gap is broad (consistency across 14 surfaces, two un-migrated headers, a11y on muted labels, keyboard/power-paths for Alex). The *AI-leverage* gap concentrates where the engine is already rich but the UI is mock — **Command Center and Monitor are the highest-leverage places to convert seeded panels into live, AI-driven "what changed / why it matters" surfaces**, because the backend autonomy DAG (Sentinel→Anomaly→Analyst→Reporter, `GET /api/autonomy/draft`) and RAG-answer lane already exist and are *unwired to the frontend*. Confirm this against the live code before you spec it — do not assume.

---

## 6. Output specification — how to write `FRONTEND_IMPLEMENTATION_SPEC.md`

Produce ONE Markdown file, **grouped strictly by execution severity** so Opus works sequentially top-to-bottom. Use exactly these severity groups, in order:

```
# CAOS Frontend Implementation Spec (for Opus 4.8)

## P0 — Blocking / correctness / a11y AA violations   (do first)
## P1 — Major: design-integrity + AI-leverage gaps that hold surfaces < 36
## P2 — Minor: polish, consistency, efficiency accelerators
## P3 — Net-new material value (build after the base is ≥36 everywhere)
#      GATE: every P3 item must name a live backing lane, or be tagged BACKEND-BLOCKED (see rules below)
```

Within each group, order items by surface using the recommended surface sequence in §7. **Every item follows this shape — adapt it to what the finding needs; it's a completeness floor, not a rigid form:**

```markdown
### [P?] <Surface> — <Short title>
- **Gap (1 sentence):** <one sentence, concrete, no hedging>.
- **Files / logical blocks:** `caos/frontend/src/app/<surface>/page.tsx` → <the function/JSX block, named — NOT a line number>; `components/<...>`.
- **Impeccable rule(s) satisfied:** critique heuristic #<n> "<name>" and/or audit dimension <a11y|perf|responsive|theming|anti-pattern>; cite the token/threshold (e.g. "muted label #a1a1b5 on --caos-panel fails 4.5:1 → bump to #c9c9d6").
- **Opus instruction (technical):** <exact, imperative build/refactor steps — components to add/extend under `shared/`, props & UX state machine (loading/empty/error/live states), which `--caos-*` tokens, which `api.ts` call or `lib/engine/*` hook to wire, keyboard/reduced-motion/focus-ring requirements, and the specific anti-ban to avoid>.
- **Credit-market payoff:** <one line — how this helps the analyst reach/defend a credit conclusion; if you can't state one, cut the item>.
```

**Rules for the spec:**
- **Reuse before invent.** Extend `shared/` primitives and existing tokens; never introduce a new color, a `components/ui` dir, or a dependency a few lines of existing code cover. If a surface needs a new primitive, specify it as an addition to `shared/`.
- **State logic is mandatory.** For any AI/live surface, specify all four UX states — *loading* (pulse only, reduced-motion crossfade), *empty* (desk-worthy empty state, not "No results"), *error* (plain-language, non-destructive, retry), *live* (FlashOnChange on delta). This is how you move heuristics 1, 5, 9 toward 4.
- **No line numbers.** Name the function, component, JSX region, or CSS rule.
- **Tie every instruction to a rule and a payoff.** An item with no Impeccable rule *or* no credit-market payoff does not belong in the spec.
- **Preserve Report Studio's light paper theme** — flag it explicitly so Opus does not dark-theme it.
- **Respect the mock↔engine seam** — when specifying "wire to engine", name the exact `api.ts` call / `lib/engine` hook and the fallback behavior; do not tell Opus to fabricate data.
- **P3 net-new hard gate (this is where fabrication is most tempting).** A net-new feature may be specified *only if* you can name an existing `api.ts` call or `lib/engine`/`lib/*` hook that can feed it. If no live lane exists, you have two honest options — **cut the item**, or specify it and tag it **`⚠ BACKEND-BLOCKED — requires <named endpoint>; out of frontend scope`** so Opus never wires a UI against data the engine cannot produce. Never spec an AI surface whose backing lane is imaginary; Opus is the code executor and will build exactly what you describe.

---

## 7. Self-check protocol (verify as you go)

Verification is a tool in service of the outcome, not a gate you march through — use it as much as each surface needs. The rhythm the user asked for is **a fresh-context sub-agent check after roughly every 3 surfaces**; treat that as the default cadence and the sequence below as a *suggestion*, not a mandated order — resequence to fit the design problem. Dispatch verifiers **asynchronously and keep specifying other surfaces while they run** (don't block on the slowest); **reconcile every REVISE before you declare the spec done (§8)** — that reconciliation is the gate, not mid-stream progress.

Suggested surface order (highest strategic leverage first, so early checks catch the biggest risks):

1. Command Center → 2. Monitor → 3. Query · **[CHECKPOINT A]**
4. Deep-Dive → 5. Model Builder → 6. Report Studio · **[CHECKPOINT B]**
7. Pipeline → 8. Issuer Profile → 9. Issuer Universe · **[CHECKPOINT C]**
10. Sector Review → 11. Sector RV → 12. Deep Research · **[CHECKPOINT D]**
13. Settings → 14. Upload → (shell/global: ResponsiveShell/SubHeader/ConceptNav consistency) · **[CHECKPOINT E]**

**At each checkpoint, dispatch a verification subagent** (the general-purpose or Explore agent) with this charge — do **not** self-approve:

> "Review the last 3 surface specs in `caos/docs/FRONTEND_IMPLEMENTATION_SPEC.md` (`<surface names>`). For each item verify: (1) **the file path and component actually exist** in `caos/frontend/src/` — flag any hallucinated path; (2) the **Impeccable rule cited is real and correctly applied** (§2/§3 of the brief) and would plausibly move the surface toward ≥36; (3) the **credit-market payoff is genuine for a leveraged-loan analyst**, not a generic SaaS feature — flag anything that fails the test *'how does this help reach/defend a credit conclusion?'*; (4) the **Opus instruction reuses existing `shared/` primitives and `--caos-*` tokens** rather than inventing new ones or a new dependency; (5) no item **violates an absolute ban** (§3a). Return a table: item → PASS / REVISE (with the specific defect). Be adversarial; assume features are hallucinated until proven."

Reconcile every REVISE before you declare the spec done (§8) — not necessarily before the next surface. Record each check's verdict inline in the spec (a short `> Checkpoint A: N pass, M revised — <what changed>` note) so the audit trail is visible.

**Anti-hallucination guardrails (apply continuously):**
- Before citing any file/component/hook/`api.ts` call, confirm it exists (`grep`/read). A path you did not verify is a defect.
- Before proposing a net-new feature, name the credit-market payoff in one line. No payoff → cut it.
- Do not claim a browser overlay or a score you did not actually produce; if you reasoned from `detect.mjs` + rubric without rendering, say so.
- Prefer *deepening existing AI lanes* (RAG answer, autonomy draft, deep research, council) over bolting on new AI theater. Verify the lane exists before you spec around it.

---

## 8. Definition of done

- `caos/docs/FRONTEND_IMPLEMENTATION_SPEC.md` exists, severity-grouped P0→P3; every item carries the §6 fields that apply to it (gap · files · rule · instruction · payoff), adapted to the finding — gate on the *information* being present, not on literal template conformance; every path verified; every checkpoint recorded.
- Every P0/P1 item names the Impeccable rule it satisfies and would move its surface toward the **≥36 critique / ≥18 audit** targets.
- Every net-new (P3) item states a concrete leveraged-loan-analyst payoff.
- No item invents a token, a `components/ui` dir, a dependency, or a data source; Report Studio's light theme is preserved; no absolute ban is introduced.
- The spec is executable by Opus **top-to-bottom without further clarification** — file paths and functional blocks, not line numbers.
