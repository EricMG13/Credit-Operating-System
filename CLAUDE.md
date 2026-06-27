# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**CAOS — Credit Agent OS**: an institutional leveraged-finance credit analysis
platform. A five-concept Next.js 15 analyst UI (Command Center, Pipeline,
Deep-Dive, Model Builder, Report Studio) backed by a FastAPI service, deployed
as a single Databricks App. The analytical methodology is the 27-module
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
  `--caos-panel #12121a` → `--caos-elevated #1a1a24`; hairline borders
  `--caos-border #262633`; text `#e6e6ef`, muted `#8a8a9a`; accent blue
  `#4f8cff`.
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
