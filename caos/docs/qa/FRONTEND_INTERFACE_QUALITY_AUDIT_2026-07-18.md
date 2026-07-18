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

**Overall score: 82 / 100 — strong desktop system, material narrow-screen
exceptions.**

| Severity | Count |
| --- | ---: |
| Critical | 0 |
| High | 1 |
| Medium | 4 |
| Low | 2 |
| **Total** | **7** |

The highest-impact issue is not a WCAG failure: Deep-Dive deliberately becomes
read-only below the desktop breakpoint and removes the core authoring,
evidence-sync, simulation, chat, QA, and export workflow. The next priorities
are narrow panel-header collisions, incomplete 44px coarse-pointer targets,
Report Studio's 417ms constrained-phone total blocking time, and route-state
layout shifts on Sponsors and Sector Review.

Accessibility fundamentals are notably strong. Axe reported zero A/AA
violations across 18 routes at desktop and phone widths, with no scan errors,
document overflow, or clipped controls. The eight-profile layout gate passed all
136 cases, including 200% zoom. Those automated gates do not detect visual
overlap, hit-target comfort above the WCAG minimum, or functionality removed by
breakpoint; direct visual and coarse-pointer checks found the exceptions below.

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

### Medium-severity issues

#### AUD-02 — Shared panel headers collide with tab lists on phones

- **Location:** `caos/frontend/src/components/shared/Panel.tsx:50-72`;
  callers at `src/app/command/page.tsx:415-422` and
  `src/app/monitor/page.tsx:267-270`
- **Severity:** Medium
- **Category:** Responsive design
- **Description:** `Panel` fixes its header at 32px and keeps the title and
  `right` slot on one non-wrapping row. Command and Monitor place four/three
  dataset tabs in that slot. At 390px the tabs paint over or clip “Live
  Coverage” and “Alert triage · autonomy routing.”
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
- **Description:** A real `hasTouch`/`isMobile` 390×844 check found 57 visible
  route instances below 44px across seven representative routes after excluding
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

## Patterns and systemic issues

- **Narrow behavior is verified structurally, not visually.** The layout gate
  detects document overflow and missing composition slots, but not overlap,
  obscured headings, or breakpoint-level capability loss.
- **Touch behavior has two standards.** Critical actions tagged
  `.caos-target` get a 44px height on coarse pointers; shared actions and
  micro-controls retain their 24-30px desktop boxes. The primitives need one
  explicit coarse-pointer contract.
- **Async state geometry is the remaining performance seam.** Desktop is stable,
  but slower phone transitions still recompose whole workbenches.
- **Theme exceptions are controlled.** Literal colors are concentrated in chart
  palettes, the deliberate paper output, and standalone fatal-error surfaces;
  ordinary workspace surfaces consistently use CAOS tokens.

## Positive findings

- Axe found **0 violations**, **0 scan errors**, and **0 layout failures** across
  36 route/viewport scans.
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

1. **Immediate:** Restore a task-complete narrow Deep-Dive path (AUD-01).
2. **Short term:** Fix shared narrow panel headers and establish the coarse
   pointer target contract (AUD-02, AUD-03).
3. **Medium term:** Reduce Report Studio's initial render cost and stabilize
   Sponsors/Sector loading geometry (AUD-04, AUD-05).
4. **Long term:** Remove the decorative citation stripe and the isolated width
   animation (AUD-06, AUD-07).

## Suggested commands for fixes

- Use `/adapt` for AUD-01, AUD-02, AUD-03, and the narrow-state portion of
  AUD-05.
- Use `/arrange` for the shared Panel heading/tab relationship in AUD-02.
- Use `/normalize` for the target primitive contract and citation treatment in
  AUD-03/AUD-06.
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
- `node scripts/validate-enterprise-layout.mjs`: 136 checks, zero failures.
- `node scripts/performance-audit.mjs`: production static export, desktop and
  constrained-phone profiles, zero scan errors.
- Visual evidence covered Directory, Command, Deep-Dive, Model, Report Studio,
  and Monitor at desktop and 390px.

The browser runs use deterministic local API fixtures, so they verify rendered
reference, empty, loading, and offline surfaces without mutating production
data. They do not replace a live-backend audit of every populated editor state
or testing on physical iOS/Android hardware.
