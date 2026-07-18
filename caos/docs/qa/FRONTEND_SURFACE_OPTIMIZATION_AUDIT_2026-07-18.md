# Frontend surface optimization audit — 2026-07-18

## Scope and method

This audit covers every production frontend route in the CAOS static build. It combines:

- cold-cache Playwright measurements on a desktop profile and a constrained 390 × 844 mobile profile (4× CPU slowdown, 150 ms latency, 1.6 Mbps down, 0.75 Mbps up);
- the 136-case enterprise layout matrix across desktop, laptop, 1100 px, tablet, 900 px, 700 px, phone, and 200% zoom;
- axe-core checks on every route at 1440 × 900 and 390 × 844;
- the complete Vitest suite, production build, lint, and Impeccable anti-pattern detector;
- source review for bundle boundaries, layout reads and writes, motion, images, tokens, hard-coded values, and persistent shell behavior.

The audit optimizes for the buy-side analyst: dense information remains available, navigation semantics are unchanged, and deferred work is limited to code that is not needed for the current surface.

## Outcome

**18 / 20 — Good**

| Dimension | Score | Evidence |
| --- | ---: | --- |
| Accessibility | 4 / 4 | All route/viewport axe checks passed with no violations, overflow, or clipped controls. Focus, reduced-motion, non-color status, and keyboard patterns remain present. |
| Performance | 3 / 4 | Desktop median JavaScript fell 63.3%, median requests fell 74.3%, and median task time fell 42.4%. The shared context strip no longer contributes cold-load CLS; Report Studio still produces a 433 ms constrained-mobile TBT, and route-local loading-to-content transitions remain visible in the constrained lab. |
| Responsive behavior | 4 / 4 | 136 / 136 layout cases passed across eight workspace/zoom profiles. |
| Theming | 4 / 4 | The CAOS token system is consistently used. Ordinary interface text now has no undocumented hover-color duplicate; remaining hard-coded values are intentional canvas, print, and self-contained error-surface exceptions. |
| Anti-patterns | 3 / 4 | The product remains a distinctive institutional terminal with disciplined signal color and density. One citation block uses the prohibited decorative side-stripe pattern. |

Anti-pattern verdict: **PASS**. There are no decorative gradients, default glass cards, oversized marketing typography, card-grid monotony, or gratuitous animation.

## Optimizations completed

1. Disabled automatic Next.js prefetch on the two persistent global navigation surfaces. The rail and concept navigation previously caused an initial desktop visit to fetch large portions of the application before the analyst expressed intent.
2. Deferred ExcelJS and the model export implementation until the analyst selects Export. The issuer profile request now runs concurrently with that dynamic import.
3. Added `scripts/performance-audit.mjs`, a repeatable all-route performance harness that records FCP, LCP, CLS, TBT, payload, request count, DOM size, heap, and browser task/style/layout durations.
4. Reserved invariant collapsed geometry for the shared analysis-context strip across resolving, ready, and unavailable states. The hook now publishes a presentation-only failure event so that the stable row cannot remain misleadingly busy.
5. Removed the two ordinary-interface `#f2f2f7` hover literals; row/background interaction remains expressed through the existing CAOS surface tokens.

### Before and after

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Desktop median JavaScript | 3438.5 KB | 1262.4 KB | −63.3% |
| Desktop median encoded payload | 3664.9 KB | 1417.6 KB | −61.3% |
| Desktop median requests | 144 | 37 | −74.3% |
| Desktop median task duration | 286.1 ms | 164.8 ms | −42.4% |
| Desktop median TBT | 3 ms | 0 ms | −100% |
| Constrained-mobile median TBT | 80 ms | 56 ms | −30.0% |
| Model constrained-mobile JavaScript | 2248.7 KB | 1336.1 KB | −40.6% |
| Model constrained-mobile TBT | 229 ms | 47 ms | −79.5% |
| Report Studio desktop JavaScript | 4733.6 KB | 2559.3 KB | −45.9% |

Desktop ready time, FCP, and LCP remained effectively flat; this pass removes speculative transfer and execution without delaying the visible current route. The constrained-mobile median payload is unchanged because the desktop rail is absent at that breakpoint; the Model export split is the targeted mobile improvement.

## Findings

### Resolved P1 — asynchronous analysis context caused cold-load layout shift

**Where:** `src/components/shared/AnalysisContextStrip.tsx`, `src/lib/analysis-workbench.ts`

`AnalysisContextStrip` previously rendered nothing until asynchronous context settled, then inserted a 49 px disclosure above the route body. It now renders the same collapsed geometry from first paint through ready or unavailable state, with non-wrapping responsive summary content. The existing independent ownership reload remains intact.

The targeted constrained-mobile rerun contains no context-strip layout-shift source. Total route CLS also fell despite unrelated async content transitions: `/command` 0.110 → 0.055, `/decisions` 0.105 → 0.050, `/portfolios` 0.125 → 0.071, `/sector` 0.216 → 0.166, `/sponsors` 0.253 → 0.198, and `/issuers` 0.324 → 0.150.

### P2 — Report Studio exceeds the constrained-mobile main-thread budget

**Where:** `src/app/reports/page.tsx:84`, `src/components/reports/ReportDoc.tsx:293`

Report Studio records 433 ms TBT and 1,068 DOM nodes on the constrained-mobile profile. The light paper document is intentionally rich, but it is the only audited route above a 200 ms TBT budget after optimization.

**Systemic fix:** profile the initial paper document render, then defer below-fold report sections or isolate expensive editor/document work behind the active pane. Preserve print output and evidence navigation. Use `$impeccable optimize`.

### P2 — citation presentation uses a decorative side stripe

**Where:** `src/components/command/CitationViewer.tsx:68`

The citation excerpt uses `border-l-2 ... pl-2.5` as a visual accent. It is the only detected instance of the generic side-stripe text pattern and is not needed to communicate status or hierarchy.

**Fix:** use spacing, a quiet surface, and source metadata hierarchy instead of the accent stripe. Use `$impeccable quieter` or `$impeccable polish`.

### Resolved P3 — two hover colors duplicated the text token

**Where:** `src/app/issuers/page.tsx:625`, `src/components/command/views.tsx:320`

Both ordinary interface surfaces previously used `hover:text-[#f2f2f7]` instead of the CAOS text/surface system. The duplicate literals are removed; row hover surfaces continue to communicate interaction without introducing a second primary-text value.

The remaining literal colors are justified chart-canvas, paper/print, or standalone error-surface values.

## Positive findings

- Data-heavy grids are virtualized where their scale warrants it.
- G2 charting, Markdown rendering, and Excel export are split from unrelated initial routes.
- No raster image payload or avoidable image optimization issue exists in the application shell.
- Resize and scroll observers use passive listeners, requestAnimationFrame batching, or guarded chart updates; no read/write layout-thrashing loop was found.
- Live-state motion is narrowly scoped and disabled under `prefers-reduced-motion`.
- Status and tranche semantics use labels, glyphs, or position rather than color alone.
- Report Studio's paper palette is a deliberate output-mode exception, not accidental theme drift.

## Verification

- Production build: all 19 application routes plus the not-found surface generated.
- Vitest: 1,442 / 1,442 tests passed across 559 suites.
- Enterprise layout matrix: 136 / 136 cases passed, 0 failures.
- axe-core: all 36 route/viewport checks passed, 0 violations and 0 layout failures.
- Impeccable detector: 0 findings.
- ESLint: passed.

Re-run `node scripts/performance-audit.mjs` against a production build to maintain the baseline, and re-run `$impeccable audit` after the remaining findings are addressed.
