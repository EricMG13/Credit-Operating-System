# CAOS — Agent Guide

Guidance for AI coding agents (Claude Code, Codex, and peers) working in this
repository. This is the single canonical source: `AGENTS.md` is a symlink to
`CLAUDE.md`, so the two never drift.

## Project

**CAOS — Credit Agent OS**: an institutional leveraged-finance credit analysis
platform. A five-concept Next.js 15 analyst UI (Command Center, Pipeline,
Deep-Dive, Model Builder, Report Studio) backed by a FastAPI service, deployed
as a self-hosted Docker stack (Caddy → oauth2-proxy → FastAPI → Postgres). The analytical methodology is the 27-module
"Modular OS" prompt corpus under `Modular OS/`. The app lives under `caos/`
(`frontend/` Next.js, `server/` FastAPI). See [caos/README.md](caos/README.md)
and [caos/docs/](caos/docs/) for architecture and current build status.

The full design reference also lives in [.impeccable.md](.impeccable.md); the
Design Context below is kept in sync with it.

## Engine conventions

**Guard CP-1 figures with `is_finite_number` before dividing/multiplying.** Any
engine computation that divides or multiplies a CP-1-derived value (leverage, net
debt, EBITDA, coverage) must gate the input through
`engine.periods.is_finite_number(x)` first. A plain `isinstance(x, (int, float))`
check passes a `NaN` (and `bool(NaN)` is `True`), so a NaN slips past the guard
and poisons the divide — leaking `NaN` into the payload (silent wrong reads
downstream) or crashing on a zero denominator. `is_finite_number` rejects
`NaN`/`±inf` while accepting `bool`/`0`. Also guard a denominator that can reach
`0` (e.g. `ebitda * (1 - pct)` when `pct → 1`) — return `None`/degrade rather than
divide. This pattern recurs across CP-2B/2E/2F/3B/3D and the Altman score.

## Red-team decision gate

Before committing to an architecture, interface, or rollout plan, record a
critic pass in [.agent-reviews/redteam.md](.agent-reviews/redteam.md). Fix and
verify each high-impact objection, or document why the risk is accepted.

## Design Context

### Users

When trade-offs force a choice, **optimize for the buy-side credit analyst** —
the person doing the deep work in Deep-Dive, Model Builder, and Report Studio,
building a defensible credit view they can stand behind in front of an
investment committee. Secondary personas: the **PM / CIO** (scans the Command
Center for posture and "what changed") and the **Head of Research / QA** (owns
coverage health, the CP-5 QA gate, governance). All work is dense, multi-window,
numbers-heavy, and money is behind a wrong read; users are specialists who value
precision over hand-holding.

### Brand Personality

**Precise, defensible, alert.** The interface should evoke four layered feelings
at once: **calm institutional authority** (committee-ready, no noise),
**trading-desk alertness** (live state and "what changed" feel immediate),
**confident clarity** (dense complexity made legible), and **trust through
transparency** (every number one click from its source). Copy is terse,
technical, and exact — label like a desk, not a brochure. No marketing language,
no emoji in product chrome.

### Aesthetic Direction

**A refined institutional terminal — a *designed* Bloomberg, not a raw one.**
Hold the dense, dark credit-desk feel while making every pixel intentional.
Inherit the established system (do not reinvent it):

- **Dark workspace, single mode.** Surfaces ramp `--caos-bg #0a0a0f` →
  `--caos-panel #11131d` → `--caos-elevated #1d2030`; hairline borders
  `--caos-border #34384a`; text `#e6e6ef`, muted `#a1a1b5`; accent blue
  `#63a1ff`.
- **Color is signal, never decoration:** warning `#f5a524`, critical `#ef4444`,
  success `#22c55e`, idle `#3f3f46`. Categorical seniority/tranche ramp (1L teal,
  2L blue, unsec amber, sub purple, equity slate) — distinct hues, no lightness
  banding.
- **Type:** Inter (sans) + JetBrains Mono (mono); all numerics `tabular-nums`
  with aligned decimals (`.tabular`); small (9–12px) uppercase letter-spaced
  labels; the 32px uppercase `<Panel>` header is the structural unit.
- **Motion:** 160ms ease-out (`.transition-caos`); pulse only for live/running
  state; always honor `prefers-reduced-motion`.
- **Output (Report Studio)** is a deliberate counterpoint: a light "paper"
  tear-sheet (ink on cream, monospace mastheads, print-ready) — looks like a
  filed institutional document.

**Anti-references:** not a friendly consumer SaaS dashboard (oversized type,
pastel cards, illustrative art, generous empty space); not a raw unstyled
terminal dump (density must always be *organized*); no decorative gradients,
glow, or skeuomorphism.

### Accessibility & Inclusion

**WCAG 2.1 AA, colorblind-safe.** Text meets 4.5:1 contrast (3:1 for large/bold);
validate the small muted labels specifically. **Status and tranche meaning is
never carried by color alone** — pair every semantic color with a glyph, label,
or position. Honor `prefers-reduced-motion` everywhere; all interactive surfaces
(including the cross-pane Evidence Sync selection) are keyboard-operable with a
visible focus ring.

### Design Principles

1. **Density with hierarchy** — earn density with grouping and rhythm, never raw
   cramming.
2. **Color is signal, not decoration** — reserve hue for status, seniority, and
   selection.
3. **Show your work** — every conclusion stays one interaction from its evidence.
4. **Motion only for life** — animate what is genuinely live; degrade gracefully
   under reduced-motion.
5. **Committee-ready by default** — when in doubt, choose what would survive
   investment-committee scrutiny. Polish means *intentional*, not *ornamented*.

## Working Conventions

- **Parallel WIP Git Staging**: Stage explicit paths only (never use wildcard `git add -A` or `git add .` unless you are sure no user changes are present). Only stage and commit files modified by the agent, preserving the user's parallel work-in-progress.
- **Git Branch Comparisons**: For `detect_changes()` and general diffs, compare against `origin/main` as the default branch/base reference, as local `main` might be stale or shallow.
- **Turbopack Dev Cache**: Ensure `turbopackFileSystemCacheForDev: false` remains in `next.config.js` to prevent persistent development server cache crashes and high disk write overhead.
- **Accessibility Verification**: Use the local axe-core runner `node caos/frontend/scripts/a11y-axe.mjs` for actual accessibility validation rather than relying on static regex-based audits which are prone to false positives.
- **FastAPI Server Environment**: Execute the server suite and check scripts using the designated virtual environment path: `/Users/ericguei/Claude/Projects/Credit Operating System/caos/server/.venv/bin/python` or `.venv311`. Do not downgrade the FastAPI `0.138` package pin.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Credit-Operating-System** (10824 symbols, 19150 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/Credit-Operating-System/context` | Codebase overview, check index freshness |
| `gitnexus://repo/Credit-Operating-System/clusters` | All functional areas |
| `gitnexus://repo/Credit-Operating-System/processes` | All execution flows |
| `gitnexus://repo/Credit-Operating-System/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
