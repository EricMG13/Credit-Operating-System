# Playbook: Design · Accessibility · UX Audit

Re-runnable goal-prompt for a Sonnet agent. Run on the design cadence (or after any
frontend-visible merge). **Assess and report only — do not restyle the app, do not
edit frontend source. Your only writes are the dated report + evidence artifacts.**

Read first, every run: [.impeccable.md](../../../../.impeccable.md) (design contract),
the Design Context in [CLAUDE.md](../../../../CLAUDE.md), and
[globals.css](../../../frontend/src/app/globals.css) (live token source — tokens below
are a snapshot; the CSS wins if they drift).

---

## 1. Objective

Prove that CAOS still reads as a **refined institutional terminal — a designed
Bloomberg, not a raw one** — and that it is WCAG 2.1 AA, colorblind-safe, and fully
keyboard-operable. The stakes are brand-existential: every surface must survive
investment-committee scrutiny. Money sits behind every number on screen; a label an
analyst can't read, a status only color can decode, or a live-pulse that fires on a
dead panel each erode the *precise, defensible, alert* posture the product sells.
Density is the product — but density without hierarchy is a failure, not a style.

### Design invariants to prove (each gets a PASS/FAIL in the report)

| # | Invariant |
|---|-----------|
| I1 | Zero axe-core WCAG 2.x A/AA violations on every route and scripted interactive state. |
| I2 | Text contrast ≥ 4.5:1 (≥ 3:1 large/bold ≥ 18.66px bold or 24px) — including the 9–12px uppercase muted labels (`--caos-muted #a1a1b5` on `--caos-panel #11131d` and `--caos-elevated #1d2030`). |
| I3 | Status (warning/critical/success/idle) and tranche (1L/2L/unsec/sub/eq) meaning is never color-alone — every semantic hue pairs with a glyph, text label, or position. |
| I4 | Every interactive surface is keyboard-reachable with a visible focus ring (`--focus-ring` via `.focus-ring:focus-visible`), including cross-pane Evidence Sync: focusing an `EvChip` publishes the highlight without a mouse. |
| I5 | `prefers-reduced-motion: reduce` kills every animation (`.caos-running`, `.caos-enter`, `.caos-flash`) and the transform channel of `.transition-caos`; pulse appears only on genuinely live/running state. |
| I6 | Workspace surfaces sit on the token ramp `#0a0a0f → #11131d → #1d2030`, borders `#34384a`, accent `#63a1ff`, tranche ramp `1L #2dd4bf / 2L #4f8cff / unsec #f5a524 / sub #a855f7 / eq #64748b` — no off-token hexes, no gradients/glow, no lightness banding in the tranche ramp. |
| I7 | All numerics are mono `tabular-nums` with aligned decimals (`.tabular`); labels are 9–12px uppercase letter-spaced. |
| I8 | The 32px uppercase `<Panel>` header (`h-8` in [Panel.tsx](../../../frontend/src/components/shared/Panel.tsx)) is the structural unit — no ad-hoc panel chrome. |
| I9 | Dense layouts hold at desk widths: no overflow clipping, truncated numerals, or collapsed hierarchy at 1440×900 and the sub-lg (~900px) breakpoint (slide-over/drawer paths work). |
| I10 | Report Studio (`/reports`) remains the deliberate light-paper counterpoint: ink `#16161e` on cream `#f7f5ee`, paper tokens (`--paper-*`), monospace mastheads, `@media print` intact — a document, not a screenshot of the app. |

---

## 2. Scope discovery

Never trust a hardcoded route list — derive it, then hand it to the axe runner
(the runner's built-in default is stale: it misses `/sector`, `/sector-rv`,
`/issuers/profile`).

```bash
cd caos/frontend
ROUTES=$(find src/app -name page.tsx \
  | sed 's|src/app||; s|/page.tsx||; s|^$|/|' | sort | paste -sd, -)
echo "$ROUTES"   # record this list in the report; diff it against the previous report's list
```

Interactive states are scope too — axe on a landing state misses dropdowns,
overlays, slide-overs. Minimum state set: the scripted Query states
(`scripts/a11y-query.mjs` covers command-bar dropdown, model overlay
ACCEPT/UNDO, sub-lg evidence slide-over), plus a manual pass on: Deep-Dive
Evidence Sync chips, `IssuerProfileOverlay`, `GlobalIssuerSearch`, `MoreDrawer`,
Ask panel. New overlays/drawers found while walking → add to the report's scope
table and flag as an unscripted-state gap.

---

## 3. Coverage checklist

Work every row; each maps to invariants and lands in the report.

- **Contrast (I2).** Run the axe sweep (catches rendered failures), then the token
  math in §4.3 (catches design-level drift axe can't see when a token isn't on a
  scanned page). Validate the small muted labels specifically — they sit nearest
  the 4.5:1 line. Idle `#3f3f46` is a non-text hue; if you find it carrying text,
  that's a FAIL, not an exception.
- **Color-alone meaning (I3).** On `/command`, `/monitor`, `/pipeline`, `/deepdive`,
  and any tranche/capital-structure view: for each status dot, severity chip,
  tranche band — name the redundant non-color cue (glyph / text label / position).
  Simulate: Playwright `page.emulateMedia({ forcedColors: 'active' })` and a
  grayscale screenshot pass; meaning must survive both.
- **Keyboard + focus (I4).** Full Tab-walk of at least `/command`, `/deepdive`,
  `/query`, `/reports`: every stop shows a visible ring; no traps; `Escape` closes
  overlays; `GlobalIssuerSearch` and Query tablist are arrow-key operable.
  Evidence Sync: Tab to an `E-xx` chip in Deep-Dive
  ([tabs.tsx](../../../frontend/src/components/deepdive/tabs.tsx),
  [OutputRegister.tsx](../../../frontend/src/components/deepdive/OutputRegister.tsx));
  focusing it must light the same id in the other pane
  ([evidence-sync.tsx](../../../frontend/src/lib/evidence-sync.tsx) store).
  Screenshot the cross-pane highlight as evidence.
- **Motion (I5).** Probe in §4.4. Also verify the inverse: `.caos-running` pulse
  appears **only** where state is genuinely live/running — a pulse on static
  content is a brand FAIL even though axe can't see it.
- **Token adherence (I6).** Drift grep in §4.5; then spot-inspect computed
  background/border colors of one panel per route against the ramp.
- **Typography (I7).** Sample numeric cells (DM, leverage, coverage) on
  `/command`, `/sector-rv`, `/deepdive`: computed `font-variant-numeric` must
  include `tabular-nums`, decimals aligned; labels 9–12px uppercase.
- **Panel unit (I8).** Confirm `<Panel>` header renders 32px (`h-8`) uppercase;
  grep views for hand-rolled panel headers bypassing the component.
- **Responsive density (I9).** Re-screenshot key views at 1440×900 and ~900px:
  slide-over/drawer replaces rails, nothing clips, numerals never truncate.
- **Paper counterpoint (I10).** `/reports`: tear-sheet uses `--paper-*` tokens,
  dark chrome stays dark around it; `@media print` in globals.css still produces
  a print-ready document (Playwright `page.emulateMedia({ media: 'print' })`).

---

## 4. Procedure

Run against the **isolated QA stack** (never the user's :3000/:8000 dev servers).

### 4.1 Boot

Use `.claude/launch.json` configs `qa-backend` (:8010) + `qa-frontend` (:3010)
via `preview_start` if available; otherwise the bash equivalents (backgrounded):

```bash
cd caos/server && PORT=8010 HOST=127.0.0.1 ENVIRONMENT=development \
  DATABASE_URL="sqlite+aiosqlite:///$PWD/data/caos_qa.db" \
  SESSION_SECRET='qa-fixed-secret-do-not-change' ANTHROPIC_API_KEY= \
  .venv/bin/python run.py &
cd caos/frontend && NEXT_PUBLIC_API_URL=http://localhost:8010 \
  NEXT_DIST_DIR=.next-qa PORT=3010 npm run dev &
```

Wait until `curl -s http://localhost:3010` returns HTML. Both axe runners log in
themselves (POST `/api/auth/profile`, code `131113` / `$ANALYST_SIGNUP_CODE`).

### 4.2 axe sweeps (the real scanner — never regex heuristics)

```bash
cd caos/frontend
mkdir -p ../docs/qa/reports
BASE=http://localhost:3010 ROUTES="$ROUTES" node scripts/a11y-axe.mjs \
  > ../docs/qa/reports/axe-$(date +%F).json          # WCAG 2.0/2.1/2.2 A+AA, all routes
BASE=http://localhost:3010 node scripts/a11y-query.mjs \
  > ../docs/qa/reports/axe-query-$(date +%F).json    # Query interactive states; exits 1 on any violation
```

### 4.3 Token contrast math (design-level, catches drift axe misses)

First re-read the `--caos-*` / `--tranche-*` / `--paper-*` values from
`globals.css` and update the pairs if they moved. Then:

```bash
node -e '
const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const R=(a,b)=>{const[x,y]=[L(a),L(b)].sort((p,q)=>q-p);return(x+.05)/(y+.05)};
const pairs=[  // [fg, bg, min]
 ["#e6e6ef","#11131d",4.5],["#e6e6ef","#1d2030",4.5],          // body text
 ["#a1a1b5","#11131d",4.5],["#a1a1b5","#1d2030",4.5],          // muted 9-12px labels — the critical pair
 ["#63a1ff","#0a0a0f",4.5],["#63a1ff","#11131d",4.5],          // accent as text
 ["#f5a524","#11131d",4.5],["#ef4444","#11131d",4.5],["#22c55e","#11131d",4.5], // semantic as text
 ["#2dd4bf","#11131d",3],["#4f8cff","#11131d",3],["#a855f7","#11131d",3],["#64748b","#11131d",3], // tranche marks (1.4.11 non-text)
 ["#16161e","#f7f5ee",4.5],["#5c5c66","#f7f5ee",4.5],["#5b4bb0","#f7f5ee",4.5], // paper ink/meta/AI-marker
];
let fail=0;for(const[f,b,m]of pairs){const r=R(f,b);if(r<m)fail++;console.log(r<m?"FAIL":"pass",f,"on",b,r.toFixed(2),"(min "+m+")")}
process.exit(fail?1:0);'
```

2026-07 baseline: all pass (muted/panel = 7.30). Any FAIL is a token regression.

### 4.4 Reduced-motion + focus-ring probe

```bash
cat > /tmp/caos-motion-probe.mjs <<'EOF'
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:3010';
const b = await chromium.launch(); const p = await b.newPage();
await p.request.post(BASE+'/api/auth/profile',{data:{code:process.env.ANALYST_SIGNUP_CODE||'131113',name:'A11y Bot'}});
await p.emulateMedia({ reducedMotion: 'reduce' });
for (const route of ['/command','/monitor','/pipeline']) {
  await p.goto(BASE+route,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(800);
  const anims = await p.evaluate(()=>[...document.querySelectorAll('.caos-running,.caos-enter,.caos-flash')]
    .map(e=>getComputedStyle(e).animationName).filter(n=>n!=='none'));
  console.log(route, anims.length===0 ? 'REDUCED-MOTION PASS' : 'FAIL '+JSON.stringify(anims));
}
await p.keyboard.press('Tab');   // first stop must show a ring
console.log('focus:', await p.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e);
  return {el:e.tagName+'.'+e.className, outline:s.outlineStyle, ring:s.boxShadow!=='none'};}));
await b.close();
EOF
cd caos/frontend && BASE=http://localhost:3010 node /tmp/caos-motion-probe.mjs
```

Extend the same page object for the manual walks: grayscale/forced-colors pass
(I3), Tab-walks with `page.screenshot()` at each proof point (I4), 900px viewport
re-checks (I9), `emulateMedia({media:'print'})` on `/reports` (I10).

### 4.5 Token drift ratchet

```bash
cd caos/frontend
grep -rEn '#[0-9a-fA-F]{6}\b' src --include='*.tsx' --include='*.ts' \
  | grep -vE '\.test\.|/charts/|paper|globals' | sort > /tmp/hex-now.txt
```

Diff `/tmp/hex-now.txt` against the previous report's appendix. Chart/paper code
uses px/hex literals **by design** (see the comment in globals.css) — exempt.
Every *new* literal elsewhere must map to an existing token or is a FAIL.

### 4.6 Teardown

Stop both QA servers you started; delete nothing else.

---

## 5. Evidence and reporting

Write `caos/docs/qa/reports/design-a11y-ux-YYYY-MM-DD.md`; screenshots in
`caos/docs/qa/reports/shots-YYYY-MM-DD/`. **No finding without evidence; no PASS
without an artifact.** Every row cites either an axe JSON node (`id`, `target`,
route/state) or a screenshot path. Findings that reproduce a register entry (§6)
are marked `accepted-risk`, not FAIL.

Report skeleton:

```markdown
# Design/A11y/UX Audit — YYYY-MM-DD
Commit: <git rev-parse --short HEAD>   Stack: :3010/:8010   Routes: <n> (list)
## Gate summary
| Gate | Invariant | Result | Evidence |
|------|-----------|--------|----------|
| G1 axe: 0 violations, all routes+states | I1 | PASS/FAIL | axe-*.json |
| G2 token contrast math all pass         | I2 | ...
| G3 no color-alone meaning               | I3 |
| G4 keyboard + focus ring + Evidence Sync| I4 |
| G5 reduced-motion probe                 | I5 |
| G6 token drift ratchet clean            | I6 |
| G7 tabular numerics + label type        | I7 |
| G8 Panel unit intact                    | I8 |
| G9 1440×900 + ~900px integrity          | I9 |
| G10 paper tear-sheet + print            | I10 |
## Findings
| ID | Sev (critical/serious/moderate/minor) | Invariant | Route/state | What | Evidence | Status (new/regression/accepted-risk) |
## Deltas vs previous report   (routes added/removed, gates flipped, hex-drift diff)
## Appendix: route list · hex-literal list · raw ratio output
```

Severity: `critical` = meaning lost (color-alone, contrast fail on a reading
surface, keyboard-unreachable action); `serious` = axe serious or contract breach
on a core view; `moderate` = off-token drift, motion/typography breaches;
`minor` = polish. Overall verdict FAILs if any gate fails with a non-accepted
finding. The audit fixes nothing — file findings, hand the report back.

---

## 6. Accepted-risk register

Do not re-report these. A new acceptance requires user sign-off — add it here,
dated, with rationale.

| ID | Accepted risk | Rationale | Source |
|----|--------------|-----------|--------|
| AR-1 | PERF-2: `/deepdive` first-load JS ~643 kB (`/reports` ~561 kB) | Performance backlog, not design; do not fail this audit on bundle weight | [AUDIT.md](../../AUDIT.md) PERF-2 |
| AR-2 | Idle `#3f3f46` fails text contrast | Non-text status hue by design; FAIL only if found carrying text/glyph meaning | .impeccable.md |
| AR-3 | `/reports` is light-on-cream while the workspace is dark | Deliberate paper counterpoint (I10) — audit it against `--paper-*`, not the dark ramp | .impeccable.md |
| AR-4 | Hex/px literals in chart + paper rendering code | Charts/paper consume literals directly; exempt from the drift ratchet | globals.css comment |
| AR-5 | Demo/mock data visible on some views (Command/Monitor seams) | Mock-vs-engine seam is a product phase, not a design defect | REVIEW_MATRIX_BACKEND.md |
| AR-6 | Monitor residuals: two-clock day; no alert→email link | Known open UX critique items, tracked separately | Monitor critique (PR #110 residuals) |
