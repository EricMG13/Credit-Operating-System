# Surface Triage & Redesign Brief

## What this file is

You are the design authority for CAOS's entire analyst-facing surface area. This
file is your complete context pack: it defines the mission, the review lens, the
measured baseline, the scope map, and the shape of the deliverable. Read it in
full before touching anything else.

Your deliverable is **one plan document** — `caos/docs/SURFACE_REDESIGN_PLAN.md`.
You do not write or modify product code in this session. The plan is the artifact;
someone else executes it.

Full-stack and layout redesign are **pre-approved**. You do not need to ask
permission to propose backend changes, API/payload reshaping, route restructuring,
or ground-up layout rebuilds. Propose whatever the evidence justifies.

---

## The mission

**Establish, from evidence, what is actually wrong with all 18 CAOS surfaces — and
produce a plan that a separate session could execute to reach ≥35/40 on every one.**

This decomposes into three workstreams, in dependency order:

1. **Triage** — score and diagnose each surface against the review lens below.
   Honest scores. A 4 means genuinely excellent, not "shipped."
2. **Root-cause** — collapse the per-surface findings into the small number of
   systemic causes that produce them. Eighteen surfaces with inconsistent button
   sizes is one cause, not eighteen findings.
3. **Plan** — a dependency-ordered, executable remediation plan addressing causes
   before symptoms, with the redesign scope each cause actually requires.

The plan's value is in workstream 2. A flat list of 200 per-surface findings is a
failed deliverable; it is what a linter produces. The plan must say *why* the
surfaces drifted and what structural change stops the drift.

---

## How to work

**Decide, then decompose.** Resolve the review lens and the systemic hypotheses
first, then fan out. Do not start by opening 18 files and seeing what you notice.

**Start at the hard foundation.** The design-system layer (`shared/`, tokens,
`globals.css`) is upstream of every surface. Characterize it before you score the
surfaces it produces — otherwise you will write the same finding 18 times and
misattribute a system defect to a page.

**Ground every claim in a tool result.** Every score, every finding, every baseline
number in your plan traces to a file you read, a command you ran, or a rendered
page you inspected. If you did not verify it, do not assert it. Prior review
documents in this repo are **inputs to be re-verified, not facts** — see the
baseline section for why.

**Delegate the scoring to fresh-context subagents.** The `impeccable` skill's
critique flow mandates two isolated assessments per target (design review, and
detector/browser evidence) that must not see each other's output. Honor that. A
subagent that already read your hypotheses will confirm your hypotheses.

**Measure the physical things physically.** Button target sizes and table
alignment are rendered-geometry facts. Source-reading them produces false
positives. Use the real axe runner and the real browser.

**State boundaries and stay inside them.** You write one plan document. You do not
edit product code, do not stage or commit, and do not run the fixes. The working
tree is dirty with the user's parallel work — leave it alone.

**Lead with the outcome.** When you report, the first sentence answers "what is
actually wrong with CAOS." Detail follows for whoever wants it.

**Keep a working-memory file.** Eighteen surfaces will not fit comfortably in one
context. Write per-surface findings to disk as you go (scratchpad is fine), and
synthesize from the files rather than from memory.

---

## System context

CAOS (Credit Agent OS) is an institutional leveraged-finance credit analysis
platform: a Next.js 16 analyst UI over a FastAPI service, self-hosted behind
Caddy → oauth2-proxy → FastAPI → Postgres.

The design contract is already written and is **not up for renegotiation**. Read
both before scoring anything:

- [PRODUCT.md](../../PRODUCT.md) — register, users, purpose, brand, principles.
- [.impeccable.md](../../.impeccable.md) and the Design Context section of
  [CLAUDE.md](../../CLAUDE.md) — the token ramp, type system, motion rules,
  seniority palette, and anti-references.

What is fixed: the dark single-mode workspace, the `--caos-*` token ramp, Inter +
JetBrains Mono, `tabular-nums` numerics, the 32px uppercase `<Panel>` header as the
structural unit, colour-as-signal, the light "paper" Report Studio counterpoint,
and the anti-references (no consumer-SaaS pastel cards, no decorative gradients, no
raw terminal dump).

What is open: everything else — layout, IA, route structure, component anatomy,
information hierarchy, backend payload shape.

"Done well" here means a buy-side credit analyst can build a credit view they will
defend in front of an investment committee, and every number on screen is one
interaction from its evidence.

---

## The review lens

Score and diagnose each surface through four lenses. All four are required; a
surface reviewed through only one is not triaged.

### 1. Nielsen heuristics — the score of record (0–4 × 10 = /40)

Use the `impeccable` skill's critique flow and its `Heuristics Scoring Guide`.
This produces the /40 that the success bar is stated in.

### 2. Core Enterprise UX Principles

No repo document defines these — **this section is the definition**. This is the
lens for data-dense professional tooling, and it is where CAOS is most likely to
fail in ways Nielsen alone will not surface:

1. **Task efficiency over novice discoverability.** The primary user is an expert
   doing this all day. Optimize the hundredth run, not the first.
2. **Density with hierarchy.** Density is the requirement; unstructured density is
   the failure. Grouping and rhythm must earn it.
3. **Cross-surface consistency.** One control means one appearance, one size, one
   behaviour, everywhere. Drift here is a system defect, never a page defect.
4. **Error prevention over error messaging.** Money is behind a wrong read.
   Prevent the wrong input; don't explain it afterward.
5. **Progressive disclosure.** Depth on demand. Everything at once is a dump.
6. **Keyboard-first operability.** Every primary action reachable without a mouse,
   with a visible focus ring.
7. **Tabular scannability.** See the alignment contract below.
8. **State transparency.** Live, stale, loading, partial, failed, offline, and
   observed-empty must be visually distinct — never collapsible into each other.
9. **Traceability.** Every conclusion one interaction from its evidence.
10. **Graceful degradation under real data.** Long issuer names, nulls, absent
    periods, 500-row tables, blocked upstream modules.

### 3. Persona requirements

Walk the primary task on each surface as each of CAOS's three real personas —
these are from PRODUCT.md, not invented. Report specific red flags, not generic
concerns:

- **Buy-side credit analyst (primary).** Deep work in Deep-Dive, Model Builder,
  Report Studio. Maps to impeccable's "Impatient Power User" archetype: skips
  onboarding, wants keyboard paths and bulk actions, abandons anything patronizing.
  **When personas conflict, this one wins.**
- **PM / CIO.** Scans Command Center for posture and "what changed." Needs the
  delta legible in seconds without drilling.
- **Head of Research / QA.** Owns coverage health, the CP-5 QA gate, governance.
  Needs to audit *why* a number is what it is and whether the lane was trustworthy.

### 4. Craft specifics the user named explicitly

These three must appear as first-class findings, per surface, with measured evidence:

- **Button target sizes.** WCAG 2.2 SC 2.5.8 floor is 24×24 CSS px (AA); 44×44 is
  the enhanced/touch bar. A dense terminal UI legitimately uses small controls —
  the honest read is that undersized targets are acceptable *only* via the spacing
  exception, and you must say which controls take the exception and which are just
  small. Measure rendered rects; do not infer from classNames.
- **Table text alignment.** The contract: numerics right-aligned with
  `tabular-nums` and aligned decimals; text left-aligned; each header aligned to
  its own column's data; units in the header, not repeated in cells. Report every
  table that breaks it.
- **Design-guideline conformance.** Every deviation from the fixed design contract
  above — off-token colours, ad-hoc type sizes, motion outside the 160ms/live-only
  rule, colour-only status encoding.

---

## The success bar

The plan must show a credible, evidenced path to all four:

- **≥35/40** Nielsen critique score on every one of the 18 surfaces.
- **Zero P0** findings remaining.
- **WCAG 2.1 AA clean** measured by `node caos/frontend/scripts/a11y-axe.mjs` —
  the real axe-core runner, not a regex scan.
- **Persona walk passes** for all three personas on each surface's primary task.

"Credible path" means: for each surface currently below 35, the plan names which
specific findings, once fixed, move which specific heuristics, and to what. A plan
that asserts "this will reach 35" without that mapping has not met the bar.

If a surface cannot reach 35 without a change the design contract forbids, say so
plainly and name the tension. An honest 33 with a stated reason is worth more than
a fabricated 35.

---

## Measured baseline

Verified by inspection on 2026-07-17, branch `codex/112`. Re-verify anything you
intend to build on — the tree is moving.

**What exists and is strong** (do not re-spec it):

- The token system, type scale, and Design Context are written, coherent, and
  enforced in `globals.css`. `PRODUCT.md` and `.impeccable.md` both exist — the
  impeccable `init`/`teach` flow is **not** needed; do not divert into it.
- `.impeccable/critique/` holds prior per-surface critique snapshots. Prior review
  artifacts live in `.agent-reviews/`.
- `caos/frontend/scripts/a11y-axe.mjs` is a real, working axe-core runner.
- `shared/` contains ~40 genuine shared components (`Panel`, `SubHeader`,
  `StatusGlyph`, `RecoveryState`, `SurfaceState`, `TableColumnFilter`,
  `AnalysisWorkbench`, `CommandPalette`, `ConceptNav`).

**What is missing or broken — these are your lead hypotheses, and they are measured:**

- **There is no shared `Button` primitive.** No `components/ui/` directory exists.
  `shared/` has only `CloseButton.tsx` and `CollapseButton.tsx` — two
  special-cases, no general button. **117 files use a raw `<button>` element.**
  This is the near-certain structural cause of the button-size inconsistency the
  user reports. Verify it, then treat it as a cause, not a finding.
- **There is no shared `Table` primitive.** **12 non-test files render a raw
  `<table>`**, each with its own alignment decisions. `text-right` appears in 22
  files while `tabular` appears in 111 — those two numbers should track each other
  and do not. This is the likely structural cause of the table-alignment drift.
- **`shared/styles.ts` contains exactly one recipe** (`labelCls`). The shared-style
  layer is close to nonexistent, so consistency currently depends on every author
  remembering the convention.

**The prior review record contradicts itself. This is your single most important
input.** Three artifacts in `.agent-reviews/`, all dated **2026-07-13**, all
describing the same estate:

| Artifact | Verdict | Scope | Method |
|---|---|---|---|
| `impeccable-final-2026-07-13.md` | **36/40 — PASS** | Workbench + Atlas (2 surfaces) | not stated |
| `impeccable-remaining-surfaces-release-2026-07-13.md` | **36/40 — PASS** | "remaining surfaces" | self-declared **single-context** |
| `adversarial-all-surfaces-redesign-2026-07-13.md` | **BLOCK — 6.0/10** | 13 surfaces + global ASK | adversarial, multi-persona |

Same day, same system, opposite conclusions. Three things about this are load-bearing:

1. **The passing runs were methodologically degraded.** The release-gate doc states
   its method as "single-context design review." The impeccable critique flow's
   Hard Invariants require Assessment A and Assessment B to run as **two isolated
   sub-agents**, and state that a single-context run is *not permitted* except when
   no sub-agent tool exists — and that any degraded run must open with a
   `⚠️ DEGRADED: single-context` banner. **Neither passing doc carries the banner.**
2. **The gate was lower than the one you are held to.** That doc clears a "required
   **34/40** release threshold." Your bar is 35. A 36/40 against a 34 gate by a
   degraded method is not evidence the surfaces are fine.
3. **A later, deeper critique of the same system landed at 24/40**, attributed to a
   sharper instrument rather than a regression.

The adversarial BLOCK is the artifact that used the stronger method and is the one
that most likely describes reality. **Read it in full before you score anything.**
It already contains a "Shared target contract" (8 contracts) and drafted per-surface
redesigns — do not re-derive them from scratch, and do not inherit them either.

Its central claim is a **hypothesis for you to test first**, because if true it
relocates the whole mission: *the failure is not panels, labels, or density — it is
that mature-looking surfaces combine different authority levels and state owners,
breaking truth, context, version, persistence, and finalization contracts at the
boundaries between surfaces.* If that holds, your systemic causes are contract
breaks between surfaces, and the button/table findings are real but secondary.
If it does not hold, say so and show why.

**Re-score from zero regardless.** Every prior number is a claim to test, not a
baseline to build on.

**Tree state:** branch `codex/112`, heavily dirty with the user's in-flight
parallel work across frontend and server. Review the working tree as it stands —
that is what the user sees. Do not stash, revert, restore, or clean.

---

## Scope and file map

### The 18 surfaces (all in scope)

| Route | Page file |
|---|---|
| Home / shell | `caos/frontend/src/app/page.tsx` |
| Command Center | `caos/frontend/src/app/command/page.tsx` |
| Pipeline | `caos/frontend/src/app/pipeline/page.tsx` |
| Deep-Dive | `caos/frontend/src/app/deepdive/page.tsx` |
| Model Builder | `caos/frontend/src/app/model/page.tsx` |
| Report Studio | `caos/frontend/src/app/reports/page.tsx` |
| Monitor | `caos/frontend/src/app/monitor/page.tsx` |
| Query | `caos/frontend/src/app/query/page.tsx` |
| Issuers | `caos/frontend/src/app/issuers/page.tsx` |
| Issuer Profile | `caos/frontend/src/app/issuers/profile/page.tsx` |
| Decisions | `caos/frontend/src/app/decisions/page.tsx` |
| Portfolios | `caos/frontend/src/app/portfolios/page.tsx` |
| Research | `caos/frontend/src/app/research/page.tsx` |
| Sector | `caos/frontend/src/app/sector/page.tsx` |
| Sector RV | `caos/frontend/src/app/sector-rv/page.tsx` |
| Sponsors | `caos/frontend/src/app/sponsors/page.tsx` |
| Settings | `caos/frontend/src/app/settings/page.tsx` |
| Upload | `caos/frontend/src/app/upload/page.tsx` |

Plus the **global chrome** that is not a route but is on every surface: the Ask ⌘K
launcher (`shared/Ask.tsx`), `shared/CommandPalette.tsx`, `shared/ConceptNav.tsx`,
`shared/SubHeader.tsx`, `shared/MoreDrawer.tsx`.

### The system layer (review first)

- `caos/frontend/src/app/globals.css` — tokens, ramp, type scale.
- `caos/frontend/src/components/shared/` — the ~40 shared components + `styles.ts`.
- `caos/frontend/src/components/charts/` — the G2 chart layer.

### Execution order

0. **The prior record.** Read `.agent-reviews/adversarial-all-surfaces-redesign-2026-07-13.md`
   in full, plus the two contradicting release-gate docs. Resolve which describes
   reality. This frames everything after it — see the baseline section.
1. **System layer.** Tokens, `shared/`, chart layer. Establish what the design
   system actually guarantees vs. what it merely documents. Everything downstream
   depends on this.
2. **Global chrome.** Ask ⌘K, CommandPalette, ConceptNav, SubHeader — they appear
   on all 18, so their defects are 18× weighted.
3. **The six core concepts.** Command, Pipeline, Deep-Dive, Model, Reports,
   Monitor. These carry the primary persona's work.
4. **The remaining twelve.**
5. **Synthesis.** Root-cause collapse, then the plan.

### Tooling

- Real a11y: `node caos/frontend/scripts/a11y-axe.mjs` (axe-core). The regex-based
  scanner in some skills produces false positives — do not use it for the gate.
- Live surfaces: bring up the isolated QA stack (`:3010` frontend, `:8010` server
  against `caos_qa.db`) rather than the user's `:8000`/`:3000`. Never point a
  review at the user's running dev server.
- Skills worth loading: `impeccable` (critique / audit / layout / polish / typeset
  / harden are the relevant sub-commands), `a11y-audit`, `web-design-guidelines`.
  Load the impeccable sub-command reference file for whichever sub-command you run;
  the skill's flow is defined there, not in `SKILL.md`.

---

## Output specification

One file: **`caos/docs/SURFACE_REDESIGN_PLAN.md`**. Nothing else. No code, no
scaffolding, no working-tree changes outside your scratchpad and this one document.

Structure it as:

1. **Verdict** — three to five sentences. What is actually wrong with CAOS's
   surfaces, and what the plan does about it. Written so the user can stop reading
   after this and still know the answer.
2. **Score table** — 18 rows + global chrome. Current /40, target /40, the delta
   drivers, and the P0 count. This is the triage output.
3. **Systemic causes** — the small set of root causes, ranked by how many findings
   each explains. Each cause states: the evidence, the surfaces it touches, the
   structural change that eliminates it, and the blast radius of that change.
4. **Per-surface findings** — grouped by surface, each finding tagged P0/P1/P2/P3,
   with file:line, the lens it violates, the measured evidence, and the parent
   cause from §3. Findings with no parent cause are their own bucket — that bucket
   being large is itself a finding.
5. **The redesign plan** — dependency-ordered phases. Each phase: what changes, why
   this phase precedes the next, which findings it closes, which surfaces it
   touches, how it is verified, and how it is rolled back. Layout and backend
   changes are in scope and should be proposed where warranted.
6. **Rejected options** — what you considered and did not propose, with the reason.
   A plan with no rejected options was not a decision.
7. **Open tensions** — where the design contract, the personas, or the success bar
   genuinely conflict, and your recommendation.

Severity means: **P0** = wrong number, lost work, inaccessible to a keyboard or
screen-reader user, or a state that can be misread as a different state. **P1** =
the primary persona's task is materially slower or less defensible. **P2** = craft
and consistency. **P3** = polish.

---

## Self-check protocol

At the end of the system layer, at the end of the six core concepts, and before
writing the plan:

- **Dispatch a fresh-context verifier subagent.** Give it your findings and the
  file paths, not your reasoning. Ask it to refute — to find the findings that do
  not reproduce. Findings that do not survive get deleted, not softened.
- **Audit each claim against a tool result from this session.** Every number in the
  plan — every score, every count, every measured rect — must trace to something
  you actually ran. Anything you cannot trace comes out.
- **Check the cause/finding ratio.** If you have more than ~15 systemic causes, you
  have not synthesized; you have relabelled the findings.

Fresh-context verification beats self-critique here. You will have read these files
for hours and will have stopped seeing them.

---

## Definition of done

- [ ] All 18 surfaces + global chrome triaged against all four lenses.
- [ ] The system layer characterized before the surfaces were scored.
- [ ] Button target sizes measured from rendered geometry, not inferred from source.
- [ ] Table alignment audited against the stated contract, every table.
- [ ] Each of the three personas walked on each surface's primary task.
- [ ] `a11y-axe.mjs` run for real; results in the plan.
- [ ] The 07-13 contradiction (two 36/40 PASSes vs. one BLOCK at 6.0/10) resolved
      with evidence — which one describes reality, and why the other was wrong.
- [ ] The adversarial doc's "contract breaks at surface boundaries" hypothesis
      explicitly tested and either adopted as the lead cause or refuted with cause.
- [ ] Findings collapsed to systemic causes; the causes are ranked and evidenced.
- [ ] Every surface below 35/40 has a named path to 35.
- [ ] At least one fresh-context verifier pass run; refuted findings removed.
- [ ] `caos/docs/SURFACE_REDESIGN_PLAN.md` written, matching the output spec.
- [ ] `git status` shows exactly one new file and no product-code modifications.

## Fixed boundaries

- The plan is the deliverable. **Do not implement it.** Do not write, edit, or
  refactor product code.
- Do not stage, commit, push, stash, or clean. The tree carries the user's parallel
  work.
- Do not touch the user's running dev server or database.
- Do not renegotiate the design contract in PRODUCT.md / .impeccable.md.
- Proceed without asking. Pause only for a genuine scope change or a decision only
  the user can make.
