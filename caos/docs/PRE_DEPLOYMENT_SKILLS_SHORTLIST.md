# Pre-Deployment — Skills & Checks Shortlist

> **Purpose:** the skills, workflows, and checks to run while working the
> [PRE_DEPLOYMENT_PLAN](PRE_DEPLOYMENT_PLAN.md) A–H program, organized by
> when they apply (every change vs. a specific phase-exit gate) rather than
> by the now-resolved 2026-07-08 branch-recovery tiers the prior version of
> this document used. Cadences/mechanisms for anything recurring live in
> [PRE_DEPLOYMENT_QA_LOOPS.md](PRE_DEPLOYMENT_QA_LOOPS.md) — this document
> only says *which* skill to reach for, not *how often*.

---

## Ground truth (reconciled 2026-07-11 against `origin/main@313ebac`)

**Three skill roots exist:**

- `.agents/skills/` — canonical, 26 skill directories with real content.
- `.claude/skills/` — 6 real directories (`commit`, `fable-5-prompter`,
  `gitnexus`, `impeccable`, `outstanding`, `refresh-preview`) + 22 symlinks
  into `.agents/skills/`. **This is the skill root Claude Code sessions read
  from.**
- `.github/skills/` — 53 entries, all symlinks into `.agents/skills/` (a
  different consumption path, not used by Claude Code sessions directly).

**8 dangling symlinks in `.claude/skills/`** (targets removed by the
2026-07-08 skills audit that trimmed the catalog 53→27; confirmed this
session — `find .claude/skills -maxdepth 1 -type l -exec sh -c 'test -e "$1"
|| echo DANGLING: $1' _ {} \;`): `error-model-validation-architect`,
`openrouter-typescript-sdk`, `implement-feature`, `critique`,
`codebase-audit`, `compose-ui-test-server`, `distill`,
`security-best-practices`. PR #124 (open, draft) already restores
`security-best-practices`'s target — decide restore-vs-remove per symlink
under the master plan's **A6b** item; do not treat these as callable until
that lands.

**Corrected against the prior version of this document** — three names it
listed as "run this" or left ambiguous actually **exist as real skill
directories**: `adversarial-reviewer`, `senior-qa`, `playwright-pro` (all in
`.agents/skills/`). Same goes for `senior-security` (see "Confirmed-present
skills" below). **Re-checked this session: none of the four has a
`.claude/skills/` entry** — each is absent both from the 6 real directories
and the 22-symlink list above (confirmed directly: `test -e
.claude/skills/<name>` fails for all four; none appears in a live
Skill-tool listing either) — **so none is reachable by a Claude Code
session in this repo today**, only by reading the file directly at its
`.agents/skills/<name>/SKILL.md` path. Every Tier-P/Tier-G/run-order
reference to these four below is therefore aspirational pending a fix
(add the missing `.claude/skills/<name> -> ../../.agents/skills/<name>`
symlinks — a distinct gap from the 8 *dangling* symlinks below, since these
four never had a `.claude/skills/` entry to begin with). **Genuinely
absent** (do not reference these — they were named in an earlier draft of
this program and never existed as skills): `confidence-review` (a
practice/report-writing convention — see the loop doc's L16 — not an
installed skill), `ponytail-audit`/`ponytail-review`, `tdd-guide`,
`superpowers:writing-plans` (no plugin/marketplace config exists anywhere in
the repo; its *output* convention — writing plans to
`docs/superpowers/plans/` — is real and kept, just not as a named skill;
use the built-in plan-mode workflow instead), and `code-reviewer` (never
existed under any skill root, and is not the same skill as the correctly
named built-in `/code-review`, which this document already uses
correctly elsewhere).

**`outstanding` project skill is internally stale**: its own `SKILL.md`
still cites the retired py3.9 `.venv` and a "~317 pass" baseline — refresh
under **A6b**; until then, trust this document's and the master plan's own
numbers (1393 pass / 2 skip, this session, on `.venv311`) over anything
`outstanding` reports.

**Env preamble for every check below:** build and use
`caos/server/.venv311` (python3.11, hashed `requirements.lock` +
`requirements-dev.txt`) — never a py3.9 venv, none should exist in a fresh
container. `caos/tests/server/conftest.py` force-blanks
`ANTHROPIC_API_KEY`/`GEMINI_API_KEY`/`OPENROUTER_API_KEY` for offline runs;
export `CAOS_TEST_LIVE=1` only if you deliberately want the live-key lane.

---

## Tier P — every change (per-PR discipline)

| Step | Tool | Why |
|---|---|---|
| 1 | GitNexus `impact` (before editing a symbol) | Blast-radius check — CLAUDE.md-mandated, non-negotiable. |
| 2 | Edit | — |
| 3 | GitNexus `detect_changes` (before committing) | Confirms the diff only touches expected symbols/flows. |
| 4 | `commit` skill | Stages explicit paths, never `git add -A` — safe alongside the user's parallel WIP in this tree. |
| 5 | `/code-review` (+ `adversarial-reviewer` skill specifically for engine or LLM-lane diffs) | Correctness + reuse/simplification pass; `adversarial-reviewer` for the load-bearing invariant surfaces (fault isolation, no-tools-writes). |
| 6 | `verify` skill | Exercises the changed runtime surface end-to-end, not just tests/typecheck — skip only for diffs with no runtime surface (docs/tests-only). |

## Tier G — gate-specific skills, checks, and playbooks

Cross-reference: the loop doc's §6 table gives cadence/artifact-path detail
for every playbook cited below; this table is "what to reach for," that one
is "how often and where the report lands."

| Gate | Skills / checks | Playbooks (loop doc §6) |
|---|---|---|
| **A exit** (trunk consolidation) | `fallow` (full sweep, not just changed-only — dead code/dupes/circular-deps after the branch-cleanup churn); `outstanding` skill **only after A6b refreshes it**; manual tracker sweep (L15) | `code-health-methodology.md` |
| **B exit** (engine certification) | `adversarial-reviewer` on new engine invariant tests (B2/B4); `senior-qa` for the B1/B5 test-authoring itself (golden E2E + corpus property assertions); `postgres-best-practices` if B5's capture pipeline touches SQL | `engine-correctness.md` |
| **C exit** (all concepts live) | `playwright-pro` for C6's concept-link suite + Monitor e2e once C3-seam lands; `impeccable` for any UI surface touched (Command board, Monitor inbox, Settings Market Data section) — covers the CLAUDE.md design-token conformance (dark workspace ramp, tabular-nums, 32px Panel header, `prefers-reduced-motion`); `.claude/workflows/caos-review-sweep.js` (`args: {plan: 'seam'}`) for the C3-seam/C5 integration-seams review at pickup and at gate; `adversarial-reviewer` + `llm-safety-grounding` playbook specifically for C3-seam's new autonomy-driven alert surface (it's a new LLM-adjacent lane — the fault-isolation invariant must hold) | `frontend-functional.md`, `design-a11y-ux.md`, `integration-seams.md`, `llm-safety-grounding.md` |
| **D exit** (ingestion breadth) | `senior-qa` for D3's table-driven robustness matrix; no dedicated security/perf skill needed here beyond Tier P | (none dedicated — D-work is covered by the per-PR loops) |
| **E exit** (enterprise hardening) | `/security-review` (full diff since last gate — this is the formal E5 pass, distinct from the per-PR CI security job); `senior-security` skill for the E2 roles-lite threat model (forged-role/cookie-tamper test design) and E3 audit-log design; `postgres-best-practices` for E3's `audit_log` migration and E1's DB-pool sizing; `owasp-security` as a cross-check against OWASP Top 10:2025 / ASVS 5.0 during the E5 pass | `backend-api-data.md`, `security-infra.md` |
| **G/H exit** (ops readiness, gate) | `postgres-best-practices` for G5-adjacent migration safety re-checks; no dedicated skill for G1/G3/G4 (these are scripting/runbook work, not review-skill work) — use `verify` after writing `restore_drill.sh` and the DR runbook to confirm they actually execute | `performance.md` (G3), the restore-drill loop (L19) |

## Skills/references dropped or replaced from the prior version

| Prior name | Disposition |
|---|---|
| `confidence-review` | Never existed as a skill. Replaced by: "confidence audit" as a named **practice**, not a tool call — a fresh-context review thread combining `/code-review high` + `adversarial-reviewer` + independent verifier agents (the pattern behind `caos/docs/qa/reports/confidence-audit-2026-07-11.md`). See loop doc L16. |
| `ponytail-audit` / `ponytail-review` | Never existed as a skill (only appeared in an unrelated plugin-capability review doc). If a surface-area trim is wanted (e.g. reviewing whether C3-seam's watch-rule model over-engineers its DAG), use the built-in `simplify` skill instead. |
| `tdd-guide` | Never existed as a skill. TDD-by-default is already stated as program policy in the master plan §13 ("Ways of working") — no tool needed to invoke it, it's a practice discipline for whoever picks up an engine/API item. |
| `superpowers:writing-plans` | No `superpowers` plugin or marketplace config exists anywhere in this repo (`.claude/settings.json` has only the two PreToolUse hooks; no `.mcp.json`, no plugins block). The *convention* it named — write L-item implementation plans at pickup time, output to `docs/superpowers/plans/` — is real and preserved (an existing plan there,
`2026-07-06-command-center-refinement.md`, shows the pattern); use the
built-in Claude Code plan-mode workflow to produce it, not a named skill. |
| Tier-0/1/2 framing (A0-branch-recovery tiers) | Dropped entirely — the 2026-07-08 A0 incident it was built around is resolved (master plan §15). Its one durable lesson — never commit code that references still-uncommitted implementation files — is now a line in master plan §13, not a tooling tier. |

## Confirmed-present skills not previously listed

`senior-security` (real directory in `.agents/skills/` — but, like
`adversarial-reviewer`/`senior-qa`/`playwright-pro` above, **not** currently
reachable via `.claude/skills/`; see "Ground truth" above), GitNexus's own
sub-skills (impact analysis, exploring, debugging, refactoring, CLI — see
`.claude/skills/gitnexus/`), and the saved workflow
`.claude/workflows/caos-review-sweep.js` (item-by-item review sweep +
adversarial verify + matrix synthesis; `args.plan: fe | be | security | perf
| seam` → writes `caos/docs/qa/REVIEW_MATRIX_*.md`) — this is the mechanism
behind several `MANUAL` loop rows in the loop doc, not a bespoke one-off.

## Run order (TL;DR, per gate)

```
Every change   impact → edit → detect_changes → commit → /code-review
               (+ adversarial-reviewer on engine/LLM diffs) → verify

A exit         fallow (full) → tracker sweep (L15) → outstanding (post-A6b)

B exit         adversarial-reviewer (B2/B4 tests) → senior-qa (B1/B5 authoring)
               → engine-correctness playbook

C exit         playwright-pro (C6) → impeccable (UI surfaces) →
               caos-review-sweep --plan=seam (C3-seam/C5) →
               adversarial-reviewer + llm-safety-grounding playbook (C3-seam)
               → frontend-functional + design-a11y-ux playbooks

D exit         senior-qa (D3 matrix) — otherwise per-PR loops only

E exit         /security-review (full) → senior-security (E2/E3 design) →
               postgres-best-practices (E1/E3) → owasp-security cross-check
               → backend-api-data + security-infra playbooks

G/H exit       verify (restore_drill.sh, DR runbook) → postgres-best-practices
               (migration re-check) → performance playbook (G3)
```
