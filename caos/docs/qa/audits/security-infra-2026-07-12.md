# Security Audit — E5 pass, 2026-07-12

**Date:** 2026-07-12
**Branch:** `main`
**Commit:** `14cb9c530825b1c300da3f38ee4fdfe4e4fa4d04`
**Playbook:** [security-infra.md](../playbooks/security-infra.md)
**Prior report:** [security-infra-2026-07-10.md](security-infra-2026-07-10.md)
**Scope:** (1) full playbook gate re-run against `origin/main` — the deployable
line; (2) a diff-focused review of the largest pending change since the prior
gate — the in-flight `feat/design-rebuild-p1` branch (new `alert_states`
table/route, settings.workspace field, and ~30 new frontend shell components)
— to satisfy the plan's "cover new mutating routes" intent ahead of that
branch's own merge, since its own PR will need this review regardless.
No live requests, no state changes, no fixes applied.

**Scanner/tool versions:** pip-audit 2.7.3 · bandit 1.7.10 · npm 11.13.0/node
v24 · gitleaks 8.30.1 (local; CI pins v8.18.4 via Docker — see the gitleaks
note below, this is a version-drift caveat, not a new gap). Route-gate sweep
via a real `ast`-based parser this run (not regex) after an initial
regex-based pass produced false "ungated" hits on routes with nested
`Depends(get_db, scope=...)` calls in their signature.

## Gate table

| # | Gate | Result |
|---|------|--------|
| 1 | Scanners clean or adjudicated | **PASS** — pip-audit 0 known vulns; bandit 0 High (1 pre-existing Medium, adjudicated below); npm audit 0 vulns; gitleaks 0 real findings (2 false-positive matches on prose, see note) |
| 2 | Auth/identity test leg green | **PASS** — 75/75 (`test_identity`, `test_auth_password`, `test_auth_profile`, `test_token_revocation`, `test_rate_limit`, `test_security_headers`, `test_avscan`, `test_edgar`, `test_gdpr_erase`) |
| 3 | Route-gate sweep: zero *new* ungated routes | **PASS** — AST-accurate sweep (not regex) over every `routes/*.py` file: only `health.py`'s `/api/health` and `auth.py`'s 5 self-guarding login lanes (`create_profile`, `register`, `login`, `recover_login`, `logout`) lack `get_identity` — identical set to the 2026-07-10 baseline, both already adjudicated by design there |
| 4 | Four boot guards present and fail-closed | **PASS** — unchanged since 2026-07-10; re-confirmed present in `main.py` lifespan (`EDGE_PROXY_SECRET`, `SESSION_SECRET`, `ANALYST_SIGNUP_CODE`, `CAOS_DEMO_SEED`) |
| 5 | Diff review: new mutating routes / LLM surfaces | **PASS** — see §Diff review below |
| 6 | CI security job intact | **PASS** — `.github/workflows/ci.yml` `security` job unchanged: pip-audit, bandit, npm audit, gitleaks all still wired |

**All 6 gates PASS.** No new HIGH or MED findings since the 2026-07-10 baseline.

## Scanner output summary

- `pip-audit -r caos/server/requirements.txt` → **no known vulnerabilities**.
- `bandit -r caos/server caos/scripts -x "*/.venv*" --severity-level high --confidence-level medium` → **0 High**. One pre-existing Medium/High-confidence finding unrelated to any change since 07-10: `edgar.py:108` (`urlopen`, B310) — already mitigated in the same function (post-redirect host allow-list against `*.sec.gov`, documented inline as "Defense-in-depth ... an open redirect on sec.gov could otherwise bounce it to an internal address"). No action; consistent with the 2026-07-10 acceptance.
- `npm audit --audit-level=high` (`caos/frontend`) → **0 vulnerabilities**.
- `gitleaks detect --config=.gitleaks.toml` (local v8.30.1) → 2 matches in `caos/docs/QA_FULL_SWEEP.md` (lines 270, 503), both the literal prose "council/debate off" mis-scored as a `generic-api-key` by newer entropy heuristics — manually confirmed not a secret. CI's pinned v8.18.4 (older, different entropy tuning) is the gate of record and has been green on this file across every recent PR run; this is a local-tool-version artifact, not a new leak. No `.gitleaks.toml` allowlist change made — the false positive doesn't reproduce on the pinned CI version, so widening the allowlist isn't warranted.

## Diff review — `feat/design-rebuild-p1` (largest pending change)

Independent agent-driven review of the branch's full diff (64 files) plus its
in-progress uncommitted changes, focused on the new surfaces: `routes/alerts.py`
(new — `POST/GET /api/alerts/state`), `routes/settings.py`'s new `workspace`
field, the `alert_states` migration, and ~30 new frontend components.

**Zero high-confidence findings.** Notable, already-consistent-with-existing-
patterns observations (not new gaps):

- `routes/alerts.py` sits behind `get_identity`, rate-limits writes, validates
  `state` against an allow-list, caps string lengths via Pydantic — same
  shape as the existing `routes/qa.py` (`AnalystQaFlag`) pattern. It has no
  per-issuer/tenancy scoping (any authenticated caller can upsert/list any
  `alert_key`), but `AlertState` carries no FK to scope against and this
  mirrors the codebase's existing, already-accepted single-shared-team trust
  model (SECURITY.md §2) — not a deviation introduced by this branch.
- `routes/settings.py`'s new `workspace` dict: capped at 100KB, written only
  to `db.get(Analyst, caller.id)` — never cross-user.
- `role_view` is validated against an enum and is presentation-only,
  confirmed never branched on server-side for authorization (the branch's
  own commit messages call this out explicitly — RT-2026-07-11-61).
- New frontend components: no `dangerouslySetInnerHTML`/`eval`, all
  user-influenced strings rendered as plain React children (auto-escaped);
  no downstream non-React consumer (email render, markdown-to-HTML) reads
  `AlertState.note`/`assignee`.

This review is a courtesy pass ahead of that branch's own merge — it does
not substitute for a fresh review at the branch's actual PR if further
commits land before merge.

## Accepted-risk register (unchanged from 2026-07-10)

No new entries this pass. Carried forward: single-team shared-mutation
authorization model (by design, SECURITY.md §2 — E2 roles-lite tracked
separately); `edgar.py` urlopen B310 (mitigated inline, see above).

## Residual for the next pass

- Re-run this playbook at the actual E-phase exit once E2 (roles-lite) lands
  — it meaningfully changes the authorization surface this gate table
  checks. Also re-run once `feat/design-rebuild-p1`'s `alert_states` /
  `routes/alerts.py` merge — confirm whether that surface is the same
  concept as PRE_DEPLOYMENT_PLAN's C3-seam Monitor alert seam or a separate
  workstream before assuming C3-seam's own scope is reduced by it.
- `.gitleaks.toml` allowlist: no change needed now, but if CI's pinned
  gitleaks version is ever bumped, re-check `QA_FULL_SWEEP.md` against the
  new version before assuming it stays clean.
