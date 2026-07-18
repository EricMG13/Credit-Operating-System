# Frontend interface quality audit — 2026-07-18

## Anti-patterns verdict

**PASS — this does not look AI-generated.** The interface has a specific,
recognizable point of view: a dense institutional credit terminal with a filed
paper counter-surface. Signal color is disciplined; there are no decorative
gradients, glowing glass cards, hero-metric templates, generic icon-card grids,
or bounce/elastic motion. Inter and JetBrains Mono are deliberate CAOS design
requirements, not default font choices, and the dark palette serves the trading
desk use case rather than imitating a generic neon dashboard.

Two tells remain. The citation viewer uses the generic decorative left-stripe
pattern, and some narrow data panels retain desktop-style boxed chrome after
their heading/action relationship has broken down. Neither makes the product as
a whole feel generated, but both weaken its otherwise intentional design.

## Executive summary

**Overall score: 75 / 100 — strong desktop system, material narrow-screen and
semantic-structure exceptions.**

| Severity | Count |
| --- | ---: |
| Critical | 0 |
| High | 2 |
| Medium | 6 |
| Low | 4 |
| **Total** | **12** |

The two highest-impact issues are not WCAG failures: Deep-Dive and Model Builder
deliberately become read-only below the desktop breakpoint and remove their core
analytical workflows. The next priorities are narrow panel-header collisions,
the global Ask launcher obscuring phone controls, incomplete 44px
coarse-pointer targets, duplicate/nested main landmarks, Report Studio's 417ms
constrained-phone total blocking time, and route-state layout shifts on
Sponsors and Sector Review.

Accessibility fundamentals are notably strong. Axe reported zero A/AA
violations across 18 routes at desktop and phone widths, with no scan errors,
document overflow, or clipped controls. The eight-profile layout gate passed all
136 cases, including 200% zoom. An additional axe best-practice pass did find
landmark, heading-order, and empty-header defects. The WCAG-only gates also do
not detect visual overlap, hit-target comfort above the WCAG minimum, or
functionality removed by breakpoint; direct visual and coarse-pointer checks
found the exceptions below.

## Detailed findings by severity

### Critical issues

None found.

### High-severity issues

#### AUD-01 — Deep-Dive removes its core workflow below 1024px

- **Location:** `caos/frontend/src/app/deepdive/page.tsx:593-606`
- **Severity:** High
- **Category:** Responsive design
- **Description:** The `lg:hidden` compact surface is explicitly read-only and
  states that module authoring, evidence synchronization, layouts, simulation,
  issuer chat, QA actions, and exports require a desktop-width workspace.
- **Impact:** The primary buy-side analyst can inspect posture but cannot advance
  the credit work from a phone or sub-1024px workspace. This is loss of core
  functionality, not a density compromise.
- **WCAG / standard:** Frontend-design responsive principle: adapt critical
  functionality rather than hiding it. No direct WCAG criterion is asserted.
- **Recommendation:** Preserve a sequential narrow workflow: module selector,
  evidence register, analysis body, decision/QA actions, and export can become
  full-width steps or drawers. Keep simulation visualization simplified, but
  retain its controls and results.
- **Suggested command:** `/adapt`

#### AUD-08 — Model Builder removes its core workflow below 1024px

- **Location:** `caos/frontend/src/app/model/page.tsx:915-955`
- **Severity:** High
- **Category:** Responsive design
- **Description:** Model Builder substitutes a compact read-only summary for
  the full workspace below `lg`. Its own narrow-state copy confirms that cell
  editing, formulas, multi-cell paste, assumptions, scenarios, undo/redo,
  checkpoint restore, and export require a desktop-width workspace.
- **Impact:** The primary analyst cannot maintain or advance the credit model
  from a phone, tablet portrait view, or narrow split-screen. This removes the
  route's principal task rather than adapting it.
- **WCAG / standard:** Frontend-design responsive principle: preserve critical
  functionality through sequential layouts, drawers, or progressive disclosure.
  No direct WCAG criterion is asserted.
- **Recommendation:** Retain a narrow sequential editor: section/period picker,
  formula and override editor, assumption/scenario steps, undo/redo, checkpoint,
  and export. The dense grid can become a focused row/period editor without
  removing model authority or mutation controls.
- **Suggested command:** `/adapt`

### Medium-severity issues

#### AUD-02 — Shared panel headers collide with tab lists on phones

- **Location:** `caos/frontend/src/components/shared/Panel.tsx:50-72`;
  callers at `src/app/command/page.tsx:415-422`,
  `src/app/monitor/page.tsx:267-270`, `src/app/issuers/page.tsx:430-458`, and
  `src/app/pipeline/page.tsx:630-651`
- **Severity:** Medium
- **Category:** Responsive design
- **Description:** `Panel` fixes its header at 32px and keeps the title and
  `right` slot on one non-wrapping row. At 390px, Command's dataset tabs obscure
  “Live Coverage”; Monitor's tabs force “Alert triage · autonomy routing” into
  three lines inside 32px; the Directory search forces “Issuer Register ·
  coverage universe” into three lines; and Pipeline's “Execution Graph · CP-X
  route plan” overflows into the graph legend.
- **Impact:** Analysts lose the panel's identity exactly where context is most
  important, and controls appear detached from the data they change.
- **WCAG / standard:** WCAG 1.4.10 reflow intent; CAOS density-with-hierarchy
  principle. Automated overflow checks pass because the collision remains
  inside the panel bounds.
- **Recommendation:** Give `Panel` a narrow header contract: stack or move the
  `right` slot below the heading, allow an auto-height header, and keep the tab
  strip horizontally scrollable with an unobscured label.
- **Suggested command:** `/arrange` or `/adapt`

#### AUD-03 — Coarse-pointer target sizing is only partially applied

- **Location:** action grammar at `caos/frontend/src/app/globals.css:344-382`;
  coarse-pointer rule at `globals.css:851-856`; drawer trigger at
  `src/components/shared/MoreDrawer.tsx:132-143`; report citations at
  `globals.css:660-685`
- **Severity:** Medium
- **Category:** Accessibility / Responsive design
- **Description:** A real `hasTouch`/`isMobile` 390×844 check found 125 visible
  route instances below 44px across all 17 authenticated routes after excluding
  visually hidden skip links. Common cases are 30px page actions, 24px panel
  drawer triggers/citations, 24px filter buttons, and controls whose height is
  expanded to 44px while width remains 24-39px. The `.caos-target` coarse rule
  changes only `min-height` and is not attached to all actions.
- **Impact:** Dense actions are harder to acquire reliably on a phone, especially
  for one-handed triage and closely spaced tabs/filters.
- **WCAG / standard:** 44×44 audit target from the interaction/responsive
  guidance. Most measured controls still meet WCAG 2.2 2.5.8's 24px
  minimum/spacing exception, so this is not counted as an axe-confirmed AA
  failure.
- **Recommendation:** Centralize a coarse-pointer hit-area contract on the
  shared action, icon-button, panel-trigger, filter, and evidence-chip
  primitives. Expand the hit box without enlarging the visible terminal chrome
  where density matters.
- **Suggested command:** `/normalize` then `/adapt`

#### AUD-04 — Report Studio blocks the constrained phone main thread

- **Location:** `caos/frontend/src/app/reports/page.tsx:901-934` and
  `src/components/reports/ReportDoc.tsx:293`
- **Severity:** Medium
- **Category:** Performance
- **Description:** The production constrained-phone profile (390×844, 4× CPU,
  150ms latency, 1.6Mbps down) records 417ms TBT, a 391ms longest task, 1,069 DOM
  nodes, 534ms script time, and 133ms layout time. It is the only tested route
  above a 200ms TBT budget; desktop TBT remains 19ms.
- **Impact:** Opening a committee document on a slower device produces a
  perceptible interaction freeze and delays evidence access.
- **WCAG / standard:** Web performance responsiveness budget; no WCAG violation.
- **Recommendation:** Profile the initial paper render, defer below-fold
  sections, and avoid mounting inactive compose/lineage work until requested.
  Preserve print completeness and citation navigation.
- **Suggested command:** `/impeccable` with its optimize workflow

#### AUD-05 — Async route states create visible mobile layout shift

- **Location:** `caos/frontend/src/app/sponsors/page.tsx:135-145` and
  `src/components/sector/SectorReviewDossier.tsx:177-190`
- **Severity:** Medium
- **Category:** Performance / Responsive design
- **Description:** In the same production constrained-phone lab, Sponsors
  records CLS 0.198 and Sector Review 0.166. The loading/offline transition
  changes toolbar, decision/workbench, and finalization geometry. Both exceed
  the 0.10 “good” Core Web Vitals threshold.
- **Impact:** Content and final actions visibly jump while the analyst is
  orienting or reaching for controls, increasing error risk in dense layouts.
- **WCAG / standard:** Core Web Vitals CLS guidance; WCAG 2.2.2 is not asserted.
- **Recommendation:** Reserve stable route-state geometry and keep finalization
  height/toolbar composition invariant across loading, ready, empty, and
  offline states.
- **Suggested command:** `/impeccable` with its optimize workflow, then `/adapt`

#### AUD-09 — The fixed Ask launcher obscures phone controls

- **Location:** `caos/frontend/src/components/shared/Ask.tsx:263-277`; affected
  controls include `src/app/command/page.tsx:52-53`,
  `src/app/issuers/profile/ProfileContent.tsx:156-157`,
  `src/components/decisions/ICBookWorkbench.tsx:446`, and
  `src/app/settings/page.tsx:516-524`
- **Severity:** Medium
- **Category:** Responsive design / Interaction
- **Description:** The 118×44px fixed Ask chip has route-specific bottom offsets
  but no collision-avoidance or shared content inset. At 390×844 it physically
  overlaps two Command dataset tabs, the IC Book portfolio selector, both
  Issuer Profile hand-off links, and the Settings navigation-warning switch.
  It also covers part of focusable Report/Pipeline scroll regions.
- **Impact:** Part of each covered target is untappable and its label can be
  obscured. Because the launcher is global and high-z-index, the failure recurs
  as analysts scroll different route content under it.
- **WCAG / standard:** WCAG 1.4.10 reflow intent and 2.5.8 target-spacing intent;
  CAOS density-with-hierarchy principle. This was confirmed geometrically, not
  reported by axe.
- **Recommendation:** Reserve a shared bottom/right interaction inset in every
  scroll owner or dock Ask into narrow chrome. Include the finalization bar and
  safe-area inset in the position contract; verify with hit-testing, not only
  document overflow.
- **Suggested command:** `/adapt`

#### AUD-10 — Three workbenches nest a second main landmark

- **Location:** root main at `caos/frontend/src/app/layout.tsx:43-46`; nested
  mains at `src/components/query/QueryInvestigationWorkbench.tsx:620-654`,
  `src/components/sector/SectorReviewDossier.tsx:187-217`, and
  `src/components/rv/RVScreenerWorkbench.tsx:293-329`
- **Severity:** Medium
- **Category:** Accessibility
- **Description:** Query, Sector Review, and RV Screener each render a `<main>`
  inside the root layout's `<main>`. Axe best-practice reports
  `landmark-main-is-top-level`, `landmark-no-duplicate-main`, and
  `landmark-unique` on all three routes at desktop and phone widths.
- **Impact:** Screen-reader landmark navigation announces duplicate, unnamed
  main regions and does not provide a stable top-level page structure on three
  major analytical surfaces.
- **WCAG / standard:** WCAG 1.3.1 structure intent; WAI landmark practice that a
  document has one non-nested main landmark.
- **Recommendation:** Keep the root `<main>` as the sole main landmark. Render
  route workbench roots as `section`/`div` with a specific accessible label.
- **Suggested command:** `/normalize`

### Low-severity issues

#### AUD-06 — Citation excerpt uses a decorative side stripe

- **Location:** `caos/frontend/src/components/command/CitationViewer.tsx:68`
- **Severity:** Low
- **Category:** Anti-pattern / Theming
- **Description:** The excerpt uses `border-l-2 ... pl-2.5` as a decorative
  accent rather than a semantic status or structural rule.
- **Impact:** It introduces a generic AI-era quotation treatment into an
  otherwise precise institutional evidence surface.
- **WCAG / standard:** Frontend-design anti-pattern guidance; no WCAG violation.
- **Recommendation:** Use source metadata, measure, and a quiet surface change
  to establish hierarchy without the accent stripe.
- **Suggested command:** `/normalize` or `/impeccable`

#### AUD-07 — One posture bar animates width

- **Location:** `caos/frontend/src/components/command/views.tsx:76`
- **Severity:** Low
- **Category:** Performance / Motion
- **Description:** The posture distribution uses a 160ms `transition-[width]`,
  which triggers layout work. Reduced motion is correctly honored.
- **Impact:** The isolated cost is small, but it breaks the system's otherwise
  compositor-friendly motion discipline.
- **WCAG / standard:** Frontend-design motion guidance: animate transform and
  opacity, not layout properties.
- **Recommendation:** Render stable segment widths or animate an inner element
  with `scaleX` and the correct transform origin.
- **Suggested command:** `/animate`

#### AUD-11 — Route heading order skips from h1 to h3

- **Location:** `caos/frontend/src/components/shared/SurfaceState.tsx:85`,
  `src/components/model/ScenarioNetworkPanel.tsx:35-37`, and Portfolio Lab's
  sector-concentration visualization
- **Severity:** Low
- **Category:** Accessibility
- **Description:** Axe best-practice reports `heading-order` on Deep-Dive,
  Model Builder, Portfolio Lab, Sector Review, and RV Screener in rendered
  desktop/phone states. The common empty/loading state emits `h3` directly
  beneath the route-level `h1`; Deep-Dive's scenario network and Portfolio
  Lab's concentration panel do the same in populated desktop layouts.
- **Impact:** Screen-reader heading traversal implies missing sections and makes
  route hierarchy less predictable, particularly in empty or offline states.
- **WCAG / standard:** WCAG 1.3.1 structure intent; axe best-practice
  `heading-order` (moderate impact).
- **Recommendation:** Give shared state/visualization components a contextual
  heading level, default route sections to `h2`, and reserve `h3` for a real
  nested subsection.
- **Suggested command:** `/normalize`

#### AUD-12 — Four data tables expose empty column headers

- **Location:** `caos/frontend/src/app/issuers/page.tsx:521-545` and
  `src/components/reports/ReportDoc.tsx:111-145`
- **Severity:** Low
- **Category:** Accessibility
- **Description:** Axe best-practice reports one empty Directory grid header
  (the select column) and three empty first-column headers in Report Studio's
  Financials, Balance Sheet, and Credit Metrics tables. Report row labels are
  rendered as `td`, so the blank first header does not establish a row-header
  relationship either.
- **Impact:** Assistive table navigation reaches unnamed columns; in the report
  tables, a numeric cell's line-item context is less explicit than the visual
  layout suggests.
- **WCAG / standard:** WCAG 1.3.1 table-relationship intent; axe best-practice
  `empty-table-header` (minor impact).
- **Recommendation:** Name the Directory select/action column and use a visible
  or visually hidden “Line item” header plus `th scope="row"` for report row
  labels.
- **Suggested command:** `/normalize`

## Patterns and systemic issues

- **Narrow behavior is verified structurally, not visually.** The layout gate
  detects document overflow and missing composition slots, but not overlap,
  obscured headings, or breakpoint-level capability loss.
- **Two core workbenches use capability amputation as responsive behavior.**
  Deep-Dive and Model Builder both replace the primary analyst workflow with a
  status-only read view below 1024px.
- **Touch behavior has two standards.** Critical actions tagged
  `.caos-target` get a 44px height on coarse pointers; shared actions and
  micro-controls retain their 24-30px desktop boxes. The primitives need one
  explicit coarse-pointer contract.
- **Global overlays and route scroll owners do not share geometry.** Ask has
  fixed route-specific offsets, but route controls have no matching exclusion
  zone, so valid local layouts are still obscured by global chrome.
- **The WCAG-only axe gate omits useful structural rules.** Duplicate main
  landmarks, heading-order gaps, and empty table headers all pass the current
  production accessibility command unless best-practice rules are run too.
- **Async state geometry is the remaining performance seam.** Desktop is stable,
  but slower phone transitions still recompose whole workbenches.
- **Theme exceptions are controlled.** Literal colors are concentrated in chart
  palettes, the deliberate paper output, and standalone fatal-error surfaces;
  ordinary workspace surfaces consistently use CAOS tokens.

## Positive findings

- Axe found **0 violations**, **0 scan errors**, and **0 layout failures** across
  36 route/viewport scans.
- The expanded route audit found **0 missing focus indicators** across the first
  24 keyboard stops on each of 17 phone routes, **0 positive tabindex** values,
  and **0 page-level horizontal-overflow routes**.
- The responsive gate passed **136 / 136** cases across desktop, laptop, 1100px,
  tablet, 900px, 700px, phone, and 200% zoom.
- Focus rings, skip links, modal focus management, scroll-region focusability,
  semantic labels, and non-color status cues are implemented systematically.
- Reduced-motion handling covers live pulse, entrances, change flashes, drawer
  motion, and the one width transition.
- Report Studio's paper mode is a purposeful committee-output counterpoint, not
  accidental theme drift.
- There is no decorative gradient/glow language, no generic hero dashboard, and
  no raster-image optimization debt in the workspace shell.
- Production build, ESLint, and all **1,442 tests in 235 files** pass.

## Recommendations by priority

1. **Immediate:** Restore task-complete narrow paths for Deep-Dive and Model
   Builder (AUD-01, AUD-08).
2. **Short term:** Fix shared narrow panel headers, reserve space for the Ask
   launcher, and establish the coarse-pointer target contract (AUD-02, AUD-09,
   AUD-03).
3. **Medium term:** Correct the duplicated main landmarks, reduce Report
   Studio's initial render cost, and stabilize Sponsors/Sector loading geometry
   (AUD-10, AUD-04, AUD-05).
4. **Long term:** Repair heading/table semantics, remove the decorative citation
   stripe, and replace the isolated width animation (AUD-11, AUD-12, AUD-06,
   AUD-07).

## Suggested commands for fixes

- Use `/adapt` for AUD-01, AUD-02, AUD-03, AUD-08, AUD-09, and the narrow-state
  portion of AUD-05.
- Use `/arrange` for the shared Panel heading/tab relationship in AUD-02.
- Use `/normalize` for the target primitive contract, citation treatment,
  landmarks, heading levels, and table semantics in AUD-03/AUD-06/AUD-10/
  AUD-11/AUD-12.
- Use `/impeccable` for the performance optimization passes in AUD-04/AUD-05.
- Use `/animate` for AUD-07.
- Re-run `/audit` after remediation, retaining the real axe runner, 136-case
  layout matrix, coarse-pointer measurement, screenshots, and production lab.

## Verification and limits

- `npm run build`: passed; 20 static pages generated.
- `npm run lint`: passed.
- `npm test -- --reporter=dot`: 235 files / 1,442 tests passed.
- `BYPASS_AUTH=1 VIEWPORTS=1440x900,390x844 node scripts/a11y-axe.mjs`:
  36 scans, zero violations/errors/layout failures.
- Axe `best-practice` pass at 1440×900 and 390×844: duplicate/nested main
  landmarks on three routes, heading-order defects on five rendered route
  states, and four empty table headers; zero scan errors.
- `node scripts/validate-enterprise-layout.mjs`: 136 checks, zero failures.
- `node scripts/performance-audit.mjs`: production static export, desktop and
  constrained-phone profiles, zero scan errors.
- Rendered 17 authenticated routes at 1440×900 and a real
  `hasTouch`/`isMobile` 390×844 context. Captured pre-focus phone screenshots for
  all 17 and inspected Directory, Command, IC Book, Deep-Dive, Model, Profile,
  Pipeline, Portfolio, Query, Report Studio, Research, Monitor, Sector, RV,
  Sponsors, Settings, and Upload.
- Stateful browser validators passed Command, Monitor, and Issuer Profile at
  desktop/tablet/phone. The IC Book product workflow passed finalize → history
  row activation → confirmed dissent → reopen in a diagnostic using the current
  `role=row` interaction contract. The checked-in `verify:ic-book` harness is
  stale: it still expects the history row to be a button and omits the new
  dissent-confirmation step.
- Final desktop/phone console confirmation across all 17 routes found zero page
  exceptions, hydration warnings, or scan errors. Remaining console/network
  entries were expected unimplemented fixture endpoints and aborted Next link
  prefetches during route changes.

The browser runs use deterministic local API fixtures, so they verify rendered
reference, empty, loading, offline, and selected stateful surfaces without
mutating production data. Some screenshots therefore include deliberate 404 /
offline fixture states; these were not counted as product service failures.
They do not replace a live-backend audit of every populated editor state or
testing on physical iOS/Android hardware.
