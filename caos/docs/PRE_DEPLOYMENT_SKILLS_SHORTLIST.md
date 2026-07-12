# Pre-Deployment — Skills & Checks Shortlist

> **Purpose:** the skills and checks to run **before** working the
> [PRE_DEPLOYMENT_PLAN](PRE_DEPLOYMENT_PLAN.md) A–H checklist, to remediate
> outstanding faults. Ordered by tier. Grounded **2026-07-11** against `main`
> (`origin/main` @ `6bf73a1a`); prior grounding 2026-07-08.
>
> Skills are invoked with the `Skill` tool (or `/name`). Checks are commands.
> Reference: run the server suite on `.venv311` (py3.11 prod-parity), never the
> py3.9 `.venv` (missing pgvector); clear `ANTHROPIC_API_KEY` for offline QA.

> ✅ **Status 2026-07-11 — Tier 0 is COMPLETE.** The 07-08 branch merged (PRs
> #131/#151) and the pre-production audit (P0/P1/P2) shipped, so all A0 deploy
> blockers cleared (5/6; only A0-6 local dev-venv drift remains). `main` boots,
> migrates on pgvector Postgres, installs from the lock, and the suite is green
> (**1369 pass / 2 skip** on `.venv311`). **Start at Tier 1** to verify the
> consolidated trunk, then Tier 2 for the phase gates. Tier 0 is kept below for
> history.

---

## The one root cause *(resolved)*

Every Tier-0 fault was the same mistake: **features committed ahead of their
still-uncommitted implementation files** (41 uncommitted `.py`; two features —
C3 autonomy DAG, D2 RAG lane — intertwined with committed references). It was
cleared the way the tier predicted: the WIP landed coherently via PRs #131/#151
and the existing guards (`check_lock_sync.py`, `test_migrations.py`) now bite on
a clean trunk. **Lesson for the phase gates: never commit a reference ahead of
the file it points to** — the guard only catches it once someone runs it on a
clean checkout.

---

## Tier 0 — Unblock the branch (A0). ✅ DONE 2026-07-11.

*All items below cleared via the #131/#151 merge + pre-prod audit. Kept for
history and as the clean-tree recipe to re-run before any future deploy cut.
Only A0-6 (local py3.9 `.venv` drift) remains — dev-env only, not a blocker.*

| # | Fault (plan ref) | Skill / check to run | Why |
|---|---|---|---|
| 0.1 | 41 files WIP, working tree red (A0-1/2/5) | **`confidence-review`** skill on the uncommitted diff *(mandated by session hook)* | Enumerate what's half-done before you freeze it into commits — the 3 red tests are unfinished case-normalization. |
| 0.2 | Commit the C3+D2 WIP so committed refs resolve (A0-1/2) | **`commit`** project skill (stage explicit paths, parallel-WIP-safe) + **`gitnexus detect_changes`** before each commit | `main.py`/`0033` already reference untracked `autonomy.py`/`pipeline_executor.py`/`0031`/`0032`. Land them as coherent feature commits (autonomy DAG; RAG lane), not one blob. |
| 0.3 | pgvector imported, not declared (A0-3) | **check:** add `pgvector` to `requirements.txt` + `requirements.lock`; then `python caos/scripts/check_lock_sync.py`. **Skill:** `postgres-best-practices` to extend the guard to catch import↔lock drift, not just txt↔lock | Same class as the google-genai lock bug. A clean `pip install -r requirements.lock` must import `database.py`. |
| 0.4 | Prod DB can't run the vector migration (A0-4) | **check:** swap deploy Postgres to a pgvector image (`pgvector/pgvector:pg18`) + add `CREATE EXTENSION IF NOT EXISTS vector`. **Skill:** `postgres-best-practices` on `0030` (HNSW params, extension bootstrap) | Stock `postgres:18-alpine` has no pgvector; the HNSW `vector_cosine_ops` index fails on a fresh DB. |
| 0.5 | **Clean-tree gate** (A0 exit) | **checks, in a throwaway checkout** (not the working tree): `git clone`/`worktree add` the target ref → `pip install -r requirements.lock` → `alembic upgrade head` on an empty pgvector Postgres → `python -c "import main"` → `pytest caos/tests/server` on `.venv311` | The working tree masks A0-1..4. Only a clean tree proves boot+migrate+install. This is the real A0 exit gate. |
| 0.6 | py3.9 `.venv` can't collect (A0-6) | **check:** `caos/server/.venv/bin/pip install pgvector` (once 0.3 lands) or retire the py3.9 venv | Parallel agents on `.venv` hit 45 false collection errors. |

**Tier 0 exit = Phase A0 exit:** fresh checkout boots, migrates on empty pgvector
DB, installs from the lock, full suite green on `.venv311`. **✅ Met 2026-07-11.**

---

## Tier 1 — Verify each merge into `main` (standing pre-merge gate)

The 07-08 consolidation (autonomy DAG, RAG lane, ResponsiveShell, pgvector/rerank)
already merged and got the P0/P1/P2 pre-prod audit. **This tier is now the
standing gate for the *next* merges:** A3 `feat/covenant-frontend`, the dependabot
major bumps (#141 typescript→7, #139/#140 vitest→4), and any new LLM lane.

| Fault / surface | Skill | Why |
|---|---|---|
| Correctness of the 12-commit + WIP diff vs `origin/main` | **`/code-review high`** (or `ultra` for the cloud multi-agent pass) | Broad correctness net on the largest delta since 07-03. |
| New LLM lanes (autonomy Sentinel→…→Reporter, RAG `queryanswer`) must keep the fault-isolation invariant (a timeout/5xx never aborts a run; **no LLM lane has tools/writes**) | **`adversarial-reviewer`** on `engine/{autonomy,sentinel,anomaly,analyst,reporter}.py` + `queryanswer.py` | New lanes are the highest-risk new code; the invariant is load-bearing (see memory `caos-llm-fault-isolation`). |
| New endpoints (`/api/autonomy/*`, RAG answer), new untrusted-doc paths (memo chunking), pgvector surface | **`/security-review`** (E5 dry-run) + **`owasp-security`** | Every new route/lane widens the attack surface before the E-phase formal gate. |
| Vector store, HNSW index, migration chain, RAG SQL | **`postgres-best-practices`** | pgvector is new to the stack; index/query/migration hygiene. |
| `is_finite_number` guard on any new CP-1-derived math in the lanes | **check:** grep new/changed engine files per CLAUDE.md engine invariant (B3) | NaN/inf/0-denom must degrade to `None`, not poison the payload. |

---

## Tier 2 — Quality sweeps (before the Phase C / E / H gates)

| Fault / surface | Skill / check | Why |
|---|---|---|
| `ResponsiveShell`/`SubHeader` touched all 10 surfaces — unused exports, dead files, circular deps, dup after the refactor | **`fallow`** (JS/TS health, changed-code risk) | Big refactor = cleanup opportunities + regression risk; free static pass. |
| a11y regressions on changed routes (all surfaces migrated; Monitor inbox once wired) | **check:** `node caos/frontend/scripts/a11y-axe.mjs` (real axe, not the regex scanner) | Plan's monthly a11y loop + per-UI-phase gate; memory: regex scanner = false positives. |
| Autonomy DAG is ~15 new files — over-engineering risk before it calcifies | **`ponytail-audit`** (or `/ponytail-review` on the WIP diff) | Question the DAG's surface area while it's still cheap to trim. |
| Missing querygraph regression test (A1); coverage for the new lanes | **`senior-qa`** / **`tdd-guide`** | A1 cap (`_GATE_NODE_CAP=300`) has no assertion; autonomy/RAG need node-count + fault-isolation tests. |
| Concept-link + Monitor E2E once the frontend is wired (C6) | **`playwright-pro`** (auth once via storageState — memory `caos-e2e-and-fallow-ci`) | Same-number-everywhere + alert round-trip. |

---

## Run order (TL;DR)

```
Tier 0  ✅ DONE — clean-tree gate met 2026-07-11 (A0 cleared)
Tier 1  /code-review high → adversarial-reviewer → /security-review →
        postgres-best-practices                                    ← per next merge (A3, majors)
Tier 2  fallow → a11y-axe → ponytail-audit → senior-qa → playwright-pro   ← phase gates
```

Tier 0 is green, so the A–H program plan resumes now at **A1** (add the querygraph
cap regression test), **A3** (covenant-frontend merge — run Tier 1 on it),
**A5** (triage the 12 dependabot PRs — auto-merge safe, verify fastapi/alembic,
hold the majors), **A6** (branch/worktree cleanup — 59 local branches),
**A7** (tracker sweep + refresh the stale `AUDIT.md` header to 1369 tests).
Then C-phase: wire the Monitor frontend to the merged autonomy engine + build the
`AlertSink`/`EmailSink` seam (C3), and the market-data quote store (C5).
