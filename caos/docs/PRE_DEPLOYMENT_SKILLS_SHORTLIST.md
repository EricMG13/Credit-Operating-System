# Pre-Deployment Skills Shortlist

**Date:** 2026-07-11 · **Lens:** of the Claude Code skills available in this
workspace, which ones should actually run **before a CAOS deploy** (the
Phase-1 Docker launch in [LAUNCH_PHASE1.md](LAUNCH_PHASE1.md), or any redeploy
after it). Companion to [LAUNCH_PHASE1.md](LAUNCH_PHASE1.md) §1/§5,
[SECURITY.md](SECURITY.md), [AUDIT.md](AUDIT.md), and
[reference/security-checklist.md](reference/security-checklist.md).

This is a **shortlist**, not a catalog review — see
[AGENT_SKILLS_REVIEW.md](AGENT_SKILLS_REVIEW.md) /
[FINANCE_SKILLS_REVIEW.md](FINANCE_SKILLS_REVIEW.md) /
[TOOLING_REVIEW.md](TOOLING_REVIEW.md) for external-tooling fit to the CAOS
*product*, and the
[2026-06-18 toolkit review](../../reports/2026-06-18-claude-code-toolkit-plugin-review.md)
for the full dev-toolkit adopt/skip pass. This doc only answers: *of the
skills already in hand, which ones earn a place in the sequence between
"code is written" and "URL goes to analysts"?*

Two skill populations show up in this workspace: **project-vendored** (checked
into `.claude/skills` / `.agents/skills`, pinned in
[`skills-lock.json`](../../skills-lock.json) — travels with the repo, anyone
working on CAOS has it) and **session-level** (available to whichever agent
session is running, not pinned to the repo, so a CI job or a fresh session may
not have it). The verdicts below don't discriminate on population, but the
table flags it — project-vendored skills are the ones safe to treat as always
available.

## Verdict at a glance

| Skill | Population | Verdict | Run when |
|---|---|---|---|
| **security-review** | session | **Gate** | Every PR touching `server/` (auth, routes, engine, ingestion, EDGAR) before merge to `main`. |
| **code-review** | session | **Gate** | Every PR — correctness bugs + reuse/simplification on the diff, before merge. |
| **verify** | session | **Gate** | Before merging any change with runtime surface — drives the actual flow instead of trusting typecheck/tests alone. |
| **fallow** | project | **Gate** | Before opening a PR — quality/duplication/circular-deps/complexity on changed code; sub-second, zero-config, no excuse to skip. |
| **outstanding** | project | **Gate (pre-launch only)** | Immediately before running LAUNCH_PHASE1 §1 — reconciles the QA tracker against live code so §1's "all green" claim is actually true. |
| GitNexus `impact()` / `detect_changes()` (not a Skill — mandatory per this file's own CLAUDE.md) | project | **Gate (already enforced)** | Before editing any symbol / before every commit. Cited for completeness, not re-litigated here. |
| **run** | session | **Recommended** | After a UI-affecting change, before PR — actually load Command Center/Deep-Dive/Model Builder/Report Studio in a browser. LAUNCH_PHASE1 §5 does this manually *post*-deploy; `run` does the same thing pre-merge, when a failure is still cheap to fix. |
| **review** | session | **Recommended** | On the opened PR, as a second pass independent of `code-review` (reviews the GitHub PR surface, not the local working diff). |
| **web-design-guidelines** | project | **Recommended** | Any Command Center / Deep-Dive / Model Builder / Report Studio change — WCAG 2.1 AA + colorblind-safe status encoding is a stated Design Context requirement, not optional polish. |
| **impeccable** | project | **Recommended** | Same trigger as above, once the change is more than a token/copy tweak — full audit against `.impeccable.md`. |
| **vercel-react-best-practices** | project | **Optional** | Perf-sensitive surfaces (Model Builder scenario grids, Pipeline tables) — not every PR. |
| **simplify** | session | **Optional** | Cleanup pass after a feature lands, before the PR goes up. Quality only — never a substitute for `code-review`. |
| **writing-guidelines** | project | **Optional** | Report Studio copy / analyst-facing strings — terse, technical, no marketing language, per Design Context. |
| **vercel-composition-patterns** | project | **Skip (default)** | Component-API shape guidance, not a check — pull in only when actively refactoring a component's public surface. |
| **commit** | project | **Utility** | Not a gate — the safe-staging mechanic for landing the changes the gates above approved. |
| `session-start-hook`, `refresh-preview`, `deep-research`, `dataviz`, `artifact-design`, `update-config`, `keybindings-help`, `loop`, `claude-api`, `init`, `fewer-permission-prompts` | mixed | **Skip** | Dev-environment or meta-harness tooling — no signal on deploy readiness. |

---

## Gate tier — why these four block

### security-review
[SECURITY.md](SECURITY.md) is the actual threat model to hold code
against — edge SSO, the fail-closed identity gate, cookie HMAC integrity,
brute-force throttling. `security-review` operationalizes it on **the pending
diff** before it ships, rather than relying on the model having read
SECURITY.md at some earlier point. Treat as non-negotiable for any PR touching
[`routes/auth.py`](../server/routes/auth.py), [`identity.py`](../server/identity.py),
[`access_log.py`](../server/access_log.py), the ingestion path
([`routes/ingestion.py`](../server/routes/ingestion.py) — untrusted-document
surface, TOOLING_REVIEW §1 caveat), or the EDGAR fetch
([`edgar.py`](../server/edgar.py), [`routes/edgar.py`](../server/routes/edgar.py) —
server-side fetch, SSRF surface per
[reference/security-checklist.md](reference/security-checklist.md)).

### code-review
Independent correctness pass on the diff. This repo's CLAUDE.md already makes
GitNexus `impact()`/`detect_changes()` mandatory around every symbol edit and
commit — that's blast-radius awareness, not a correctness read. `code-review`
is the "is this actually right" pass GitNexus doesn't do.

### verify
LAUNCH_PHASE1 §1's gate is `lint + tsc --noEmit + vitest + next build +
pytest` — all necessary, none of it proves a feature works end-to-end in a
browser or a live API call. `verify` is the difference between "typechecks"
and "renders the right numbers with the right evidence trace" — the thing
CP-5B lineage and Evidence Sync exist to guarantee in the first place.

### fallow
Free, sub-second, zero-config static pass — quality, changed-code risk,
duplication, circular dependencies, complexity, architecture-boundary
violations. Already the vendored `fallow-rs/fallow-skills` package per
[`skills-lock.json`](../../skills-lock.json), so there's no cost reason to skip
it on any PR.

## Pre-launch special case — outstanding

LAUNCH_PHASE1 §1 says "all green **before** you provision the host" and points
at CI plus a local re-run of the same lint/type/test gate. Neither check
whether the **QA tracker**
([qa/CAOS_QUALITY_VALIDATION_TRACKER.xlsx](qa/CAOS_QUALITY_VALIDATION_TRACKER.xlsx),
[qa/FEATURE_TRACKER.csv](qa/FEATURE_TRACKER.csv)) actually matches what's in
the code — a tracker can drift stale in either direction (claims coverage that
since regressed, or lists finished work as still outstanding). Run
`outstanding` immediately before §1 so the launch gate is reconciled against
live code, not against the tracker's last edit.

## Sequencing

1. **While coding:** `fallow` (continuous — it's cheap) + GitNexus `impact()`
   before touching any symbol (already mandatory, this file's CLAUDE.md).
2. **Before opening a PR:** `code-review`, `verify` on the changed flow,
   `web-design-guidelines` / `impeccable` if the change touches the analyst
   UI, `simplify` as a last cleanup pass.
3. **On the PR:** `security-review` if the diff touches auth/ingestion/EDGAR,
   `review` as an independent second pass, GitNexus `detect_changes()` to
   confirm the actual blast radius matches what was intended.
4. **Immediately before LAUNCH_PHASE1 §1:** `outstanding`, then the manual
   lint/tsc/vitest/build/pytest gate exactly as written there.
5. **After deploy:** LAUNCH_PHASE1 §5's checklist stays manual — none of the
   above skills replace hitting the live URL.

## Net

Four skills earn a hard gate — `security-review`, `code-review`, `verify`,
`fallow` — because each checks something LAUNCH_PHASE1's existing lint/type/test
gate structurally cannot: security posture against the actual threat model,
independent correctness review, real end-to-end behavior, and code-health
drift. `outstanding` adds a one-time pre-launch reconciliation step. `run` and
`review` are strong recommends for UI changes and opened PRs respectively.
Everything else is either situational (`vercel-react-best-practices`,
`writing-guidelines`), a quality-not-correctness pass that never substitutes
for the gate tier (`simplify`, `vercel-composition-patterns`), or
dev-environment/meta tooling with no bearing on deploy readiness. Nothing here
replaces LAUNCH_PHASE1 §1/§5 — it tightens what happens *before* that runbook
starts.
