# CAOS — Full-Application Audit: Fable 5 Planning Prompts

**Purpose.** A complete, grouped set of prompts to hand to **Claude Fable 5**.
Each prompt makes Fable author *one durable audit playbook* — a standalone
Markdown goal-prompt that **Sonnet 5 re-runs regularly** against the evolving
codebase. Fable plans **once**; Sonnet executes **on a schedule** (per-PR,
nightly, or pre-deploy). This mirrors the repo's existing review-matrix and
`STRESS_TEST_PLAN` conventions rather than inventing a new one.

- **Planner:** `claude-fable-5`, effort **`xhigh`** (one-time, capability-sensitive).
- **Executor:** `claude-sonnet-5`, effort **`high`** (repeatable, evidence-driven).
- **Where playbooks land:** `caos/docs/qa/playbooks/<DOMAIN>.md`.
- **Where run reports land:** `caos/docs/qa/reports/<DOMAIN>-<date>.md`.

---

## 1. Coverage map — the complete audit surface

Nine domains cover every application layer × every audit dimension. The table
shows the surface is *complete*; the grouping (§2) shows it is *minimal*.

| # | Fable playbook | Application surface | Audit dimensions folded in |
|---|---|---|---|
| 1 | **Engine & Financial Correctness** | `caos/server/engine/*` (deterministic credit math: periods, adjusted, capstructure, covenants, distress, downside, liquidity, metrics, scenario, Altman, CP-1…CP-3 spine) | Unit · contract · golden/regression · NaN/finite-guard · financial-plausibility |
| 2 | **Backend API, Data & Reliability** | `routes/*`, `main.py`, `database.py`, `migrations/`, executors, `ingest.py`, `seed.py`, `portfolio*`, `edgar.py` | Functional · integration · schema-validation · fault-isolation/resilience · migrations · retention/GDPR |
| 3 | **Security, Auth & Infra Hardening** | `identity.py`, `passwords.py`, `rate_limit.py`, `access_log.py`, `avscan.py`, `erase_analyst.py`, boot guards, `caos/deploy/*` (Caddy, oauth2-proxy, Docker, clamd), secrets | AuthN/AuthZ · injection/SSRF · headers · secrets/deps/SAST · container hardening · GDPR |
| 4 | **LLM / AI Safety, Grounding & Cost** | `engine/{llm_client,llm_safety,council,debate,synth,grounding,entailment,provenance,lineage}`, `deepresearch*`, model-tier routing, `budget.py` | Grounding/hallucination · prompt-injection · output-forgery · model routing · cost/budget · provenance |
| 5 | **Frontend Functional & E2E** | `caos/frontend/src/{app,components,lib}` (5 concepts), hooks (`lib/engine`), `caos/tests/frontend/e2e/*` | Component unit (vitest) · state/hooks · integration · Playwright E2E flows |
| 6 | **Design System, Accessibility & UX** | Same FE surface + `.impeccable.md` / Design Context + Report Studio paper output | WCAG 2.1 AA (axe) · colorblind-safe · keyboard/focus · reduced-motion · design-token fidelity · responsive |
| 7 | **Performance & Scalability** | `caos/tests/perf/*`, `caos/tests/stress/*`, `bench/`, scenario benchmark, graph-expansion measurement, FE bundle/render, DB queries | Latency budgets · load/stress · throughput · N+1/query cost · bundle size · regression thresholds |
| 8 | **Integration Seams & Contracts** | FE↔BE API parity (`tsconfig.sync.json`, `types/`), `caos/mcp/edgar`, external EDGAR + LLM providers | Contract/parity · type-sync drift · boundary faults · external-dependency behavior |
| 9 | **Code Health & Methodology Consistency** | Whole repo (fallow: dead-code, dupes, complexity, circular deps, arch boundaries) + `Modular OS/*` corpus + `docs/` | Maintainability · complexity gates · corpus-taxonomy drift · documentation drift |

**Optional consolidations** (if you want fewer Fable runs): merge **5+6** into a
single *Frontend* playbook, and/or merge **8** into **2**. Recommended default is
the nine above — 5/6 and 2/8 execute on different cadences and by different
skill lenses, so keeping them apart preserves coverage without real overlap.

---

## 2. The Playbook Contract (what every Fable prompt must produce)

Each prompt already embeds this. Stated once here so you can see the shared
shape. Every playbook Fable writes is a **self-adapting, re-runnable Sonnet
goal-prompt** with these six sections:

1. **Objective & stakes** — what "audited" means for this domain and the credit
   consequence of a miss.
2. **Scope discovery** — the *commands/globs* Sonnet runs each execution to find
   the current surface, so the playbook never rots against a frozen file list.
3. **Coverage checklist** — the exhaustive scenario/invariant/risk-class set.
   This is where completeness lives; it is the contract's core.
4. **Procedure** — exact commands, tools, suites, and the order where order
   matters.
5. **Evidence & reporting** — a dated report with a stable schema, explicit
   pass/fail gates, and adversarial verification of each non-trivial finding.
6. **Accepted-risk register** — a "never re-flag" list (seed it from
   `REVIEW_MATRIX_BACKEND.md`'s adjudicated register) so repeat runs stay signal.

---

## 3. The nine Fable 5 prompts

Copy one block at a time into Fable 5 (`xhigh`). Each is self-contained.

---

### Prompt 1 — Engine & Financial Correctness

```
I'm building the audit program for CAOS, an institutional leveraged-finance credit platform where a wrong number reaches an investment committee and real money moves on it. The deterministic engine (caos/server/engine) is the part that must never be wrong. I need a durable audit playbook that a Sonnet 5 agent will re-run every PR and pre-deploy — you author it once; you do not run the audit yourself.

Produce caos/docs/qa/playbooks/engine-correctness.md: a standalone, re-runnable Sonnet goal-prompt that guarantees complete correctness coverage of the deterministic credit math. Explore the engine and its tests first so the playbook reflects the real surface, not assumptions.

The playbook must have six sections: (1) Objective and the credit stakes of a wrong read; (2) Scope discovery — the commands/globs Sonnet runs each time to enumerate the current engine modules and their tests, so the playbook never goes stale; (3) a Coverage checklist that is genuinely exhaustive across: every divide/multiply on a CP-1-derived value gated by is_finite_number (the bool(NaN) trap named in CLAUDE.md), zero-denominator degradation, NaN/±inf ingress at every parse and store boundary, the CP-1/2/3 contract tests, golden-master regression against captured SEC facts, financial plausibility of leverage/coverage/EBITDA/Altman outputs, sign and unit correctness, and period-alignment math; (4) Procedure with the exact pytest/mypy/ruff invocations; (5) Evidence and reporting — a dated report with pass/fail gates and adversarial re-verification of any suspected miscompute; (6) an accepted-risk register seeded from the adjudicated list in caos/docs/qa/REVIEW_MATRIX_BACKEND.md.

Write the checklist as invariants to prove, not steps to perform, so Sonnet adapts as modules are added. The deliverable is the playbook file only — do not perform the audit, and don't add scaffolding the task doesn't need. Lead the playbook with its objective; keep it terse and technical.
```

---

### Prompt 2 — Backend API, Data & Reliability

```
I'm building the audit program for CAOS, a FastAPI + Postgres credit platform. Analysts drive runs, ingest filings, and persist models through the API; a dropped constraint, a bad migration, or a run that dies mid-flight corrupts a credit view. I need a durable audit playbook a Sonnet 5 agent re-runs every PR and pre-deploy — you author it once, you do not run the audit yourself.

Produce caos/docs/qa/playbooks/backend-api-data.md: a standalone, re-runnable Sonnet goal-prompt covering the API surface, data layer, and reliability. Explore routes/, main.py, database.py, migrations/, the executors, ingest.py, seed.py, and their tests first.

Six sections: (1) Objective and stakes; (2) Scope discovery — commands to enumerate current routes, Pydantic models, and migrations each run; (3) Coverage checklist spanning: request/response schema validation and mass-assignment safety, input caps and pagination limits, error-handler leakage (no stack/str(e) to client), parameterized queries, migration additivity and reversibility, executor fault isolation (CancelledError handling, orphan sweep, Postgres lease/re-claim/reap, concurrency caps), idempotent seed/ingest with size caps, retention and GDPR-erase completeness across id and email stamps, and the async worker claim/lease path on Postgres; (4) Procedure with exact pytest targets (including the Postgres-only worker leg) and how to spin the test DB; (5) Evidence and reporting — dated report, pass/fail gates, adversarial verification of any data-loss or fault-isolation gap; (6) accepted-risk register seeded from REVIEW_MATRIX_BACKEND.md (single-team IDOR, edge-secret-trust, on-host backup, etc.).

State invariants to prove, not steps. Deliverable is the playbook file only — do not run the audit, don't over-engineer it. Lead with the objective; keep it terse.
```

---

### Prompt 3 — Security, Auth & Infrastructure Hardening

```
I'm building the security audit program for CAOS, a self-hosted credit platform deployed as Caddy → oauth2-proxy (Google Workspace OIDC) → FastAPI → Postgres. The threat model is documented in caos/docs/SECURITY.md and AUDIT.md. I need a durable security playbook a Sonnet 5 agent re-runs every PR and pre-deploy — you author it once, you do not run the audit yourself.

Produce caos/docs/qa/playbooks/security-infra.md: a standalone, re-runnable Sonnet goal-prompt for the full security and infrastructure-hardening surface. Read SECURITY.md, AUDIT.md, the identity/auth/rate-limit/avscan modules, config boot guards, and caos/deploy/* first, plus the security job in .github/workflows/ci.yml so the playbook extends the existing gates rather than duplicating them.

Six sections: (1) Objective and the trust boundaries; (2) Scope discovery — commands to enumerate auth surfaces, deploy configs, and dependency manifests each run; (3) Coverage checklist spanning: edge-origin proof before cookie resolution, fail-closed identity when headers/cookie are absent, HMAC cookie integrity and SESSION_SECRET boot-refusal, profile-to-SSO binding and impersonation refusal, timing-equalized login/recover and token revocation, per-IP throttle and brute heuristics, SSRF guards on EDGAR fetches, path-traversal on upload/edgar, security headers, avscan fail-closed both directions, secrets scanning and dependency CVEs (pip-audit/npm-audit) and SAST (bandit), and container/deploy hardening (Caddyfile, oauth2-proxy.cfg, Dockerfile, clamd, non-root, least-privilege); (4) Procedure with exact scanner invocations and manual review steps; (5) Evidence and reporting — dated report, severity gates, refute-first adversarial verification of every candidate before it is filed; (6) accepted-risk register seeded from SECURITY.md and the REVIEW_MATRIX_BACKEND adjudicated list, so known-accepted items (XFF rate-key spoof, single-team IDOR) are never re-raised.

State invariants to prove. The deliverable is the playbook file only — assess and specify, do not exploit or change system state, and do not run the audit. Lead with the objective; keep it terse.
```

---

### Prompt 4 — LLM / AI Safety, Grounding & Cost

```
I'm building the AI-safety audit program for CAOS. The platform's conclusions are LLM-assisted (grounding, entailment, multi-model council/debate/synth, deep research), and every claim must trace to a source an analyst can click — a hallucinated metric in a committee memo is a firing offense. I need a durable playbook a Sonnet 5 agent re-runs every PR and pre-deploy — you author it once, you do not run the audit yourself.

Produce caos/docs/qa/playbooks/llm-safety-grounding.md: a standalone, re-runnable Sonnet goal-prompt for the AI/LLM lanes. Explore engine/{llm_client,llm_safety,council,debate,synth,grounding,entailment,provenance,lineage}, deepresearch*, the model-tier routing, and budget.py, plus their tests, first.

Six sections: (1) Objective and the grounding/cost stakes; (2) Scope discovery — commands to enumerate LLM call sites, prompts, and safety gates each run; (3) Coverage checklist spanning: every generated number traceable to provenance/lineage (no ungrounded facts entering the fact store), entailment/grounding gates on synth output, prompt-injection and output-forgery resistance in llm_safety, non-finite gating on model-returned values, per-lane fault isolation (council return_exceptions filtered, synth Blocked-gate, deterministic fallbacks in debate/nlquery), timeouts on every client (Anthropic/Gemini/OpenRouter), no-tools/no-writes invariant on model lanes, keyless degrade paths, model-tier routing correctness, and budget/cost caps that cannot be bypassed; (4) Procedure with exact test targets and how to run offline with keys unset; (5) Evidence and reporting — dated report, pass/fail gates, adversarial verification of any suspected ungrounded or injectable path; (6) accepted-risk register seeded from the REVIEW_MATRIX_BACKEND BE-4 notes (the two documented benign server-tools).

State invariants to prove. Deliverable is the playbook file only — specify, don't run the audit; don't over-build. Lead with the objective; keep it terse.
```

---

### Prompt 5 — Frontend Functional & E2E

```
I'm building the frontend audit program for CAOS, a Next.js 15 analyst UI of five dense workspaces (Command Center, Pipeline, Deep-Dive, Model Builder, Report Studio) over a FastAPI backend. Analysts do multi-window, numbers-heavy work; a broken run-state sync or a misrendered metric silently corrupts their read. I need a durable functional playbook a Sonnet 5 agent re-runs every PR — you author it once, you do not run the audit yourself.

Produce caos/docs/qa/playbooks/frontend-functional.md: a standalone, re-runnable Sonnet goal-prompt for frontend correctness. Explore caos/frontend/src/{app,components,lib}, the engine hooks in lib/engine, the vitest suites, and the Playwright e2e specs in caos/tests/frontend/e2e first.

Six sections: (1) Objective and stakes; (2) Scope discovery — commands to enumerate current routes, components, hooks, and e2e specs each run; (3) Coverage checklist spanning: component-level correctness and prop/state contracts, the engine hooks (useLiveRun, useModelEngine, usePortfolio, downside/anchor math) including numeric edge cases and no-alpha-concat guards, live run-state and cross-pane Evidence Sync behavior, loading/empty/error states for every data-backed view, and end-to-end user journeys (login, upload/ingest, deep-dive, model build, query, research run, settings) via Playwright; (4) Procedure with exact vitest and playwright invocations and how to point e2e at a running stack; (5) Evidence and reporting — dated report, pass/fail gates, adversarial verification of any flaky or state-corruption finding; (6) accepted-risk register for known demo/mock seams.

State behaviors to prove, not steps to script. Deliverable is the playbook file only — specify, don't run the audit. Lead with the objective; keep it terse.
```

---

### Prompt 6 — Design System, Accessibility & UX

```
I'm building the design-and-accessibility audit program for CAOS, a refined institutional credit terminal — a designed Bloomberg, not a raw one. The full design contract is in .impeccable.md and the Design Context in CLAUDE.md (dark single-mode, color-is-signal, tabular numerics, WCAG 2.1 AA, colorblind-safe, meaning never carried by color alone). I need a durable playbook a Sonnet 5 agent re-runs on a design cadence — you author it once, you do not run the audit yourself.

Produce caos/docs/qa/playbooks/design-a11y-ux.md: a standalone, re-runnable Sonnet goal-prompt for design-system fidelity, accessibility, and UX. Read .impeccable.md and the CLAUDE.md Design Context, then explore caos/frontend/src and the axe runners in caos/frontend/scripts (a11y-axe.mjs, a11y-query.mjs) first — the playbook must use the real axe-core runner, not regex heuristics.

Six sections: (1) Objective and the committee-ready brand stakes; (2) Scope discovery — commands to enumerate current views and run axe against each; (3) Coverage checklist spanning: WCAG 2.1 AA contrast (validate the small muted 9–12px labels specifically, 4.5:1 / 3:1 large), status and tranche meaning paired with glyph/label/position never color alone, full keyboard operability and visible focus rings including cross-pane Evidence Sync selection, prefers-reduced-motion honored everywhere (pulse only for live state), design-token adherence (the --caos surface ramp, borders, accent, seniority ramp), tabular-nums with aligned decimals, the 32px uppercase Panel header unit, responsive/dense-layout integrity, and the Report Studio light-paper tear-sheet as a deliberate print-ready counterpoint; (4) Procedure with exact axe-runner and build invocations; (5) Evidence and reporting — dated report, pass/fail gates, screenshots or axe output as evidence for each finding; (6) accepted-risk register (e.g. PERF-2 bundle, known design exceptions).

State the design invariants to prove. Deliverable is the playbook file only — assess and report, do not restyle the app. Lead with the objective; keep it terse.
```

---

### Prompt 7 — Performance & Scalability

```
I'm building the performance audit program for CAOS. Analysts run dense, multi-window sessions and dispatch expensive engine + LLM + retrieval pipelines; latency regressions and query-cost blowups degrade the desk experience and the deploy budget. I need a durable performance playbook a Sonnet 5 agent re-runs pre-deploy and nightly — you author it once, you do not run the audit yourself.

Produce caos/docs/qa/playbooks/performance.md: a standalone, re-runnable Sonnet goal-prompt for performance and scalability across the stack. Explore caos/tests/perf (smoke.py, scenario benchmark), caos/tests/stress, the bench/ graph-expansion and rerank measurements, next.config.js, and the DB access patterns first.

Six sections: (1) Objective and the latency/cost stakes; (2) Scope discovery — commands to enumerate current perf/stress/bench suites and endpoints each run; (3) Coverage checklist spanning: API endpoint latency budgets and percentiles (the perf-smoke percentile math), scenario-benchmark regression thresholds, graph-expansion recall/latency and rerank precision measurements, stress/load behavior under concurrency and the run-concurrency cap, N+1 and unbounded-query detection in the data layer, LLM-lane latency and timeout adherence, frontend bundle size and render/hydration cost, and clear regression gates versus a stored baseline; (4) Procedure with exact invocations (including perf-smoke --selftest and how to target a live deployment vs CI); (5) Evidence and reporting — dated report with numbers versus baseline, pass/fail thresholds, adversarial verification that a regression is real and not noise; (6) accepted-risk register for known-accepted perf items.

State the budgets and thresholds to hold, not steps. Deliverable is the playbook file only — measure and report, don't optimize the code. Lead with the objective; keep it terse.
```

---

### Prompt 8 — Integration Seams & Contracts

```
I'm building the integration-seam audit program for CAOS. The system spans a Next.js frontend, a FastAPI backend, an EDGAR MCP server, and external EDGAR + multi-provider LLM dependencies; the failures that hurt most are silent contract drift between the frontend's expected types and the API's actual responses, and unhandled faults at external boundaries. I need a durable playbook a Sonnet 5 agent re-runs every PR — you author it once, you do not run the audit yourself.

Produce caos/docs/qa/playbooks/integration-seams.md: a standalone, re-runnable Sonnet goal-prompt for the integration seams and contracts. Explore the FastAPI route response models, the frontend types/ and tsconfig.sync.json type-sync path, caos/mcp/edgar, and the external-call sites (edgar.py, the LLM clients) first.

Six sections: (1) Objective and the contract-drift stakes; (2) Scope discovery — commands to enumerate API endpoints, their response schemas, and the frontend types that mirror them each run; (3) Coverage checklist spanning: FE↔BE request/response parity for every data-backed view, type-sync drift between server schemas and frontend types, versioning/optional-field handling, the EDGAR MCP server contract and error surface, external-dependency fault handling (EDGAR rate limits/outages, LLM provider fallback and keyless degrade), retry/timeout/idempotency at each boundary, and graceful degradation when a dependency is down; (4) Procedure with exact commands to diff schemas against types and to exercise each seam; (5) Evidence and reporting — dated report, pass/fail gates, adversarial verification that a suspected drift actually breaks a real view; (6) accepted-risk register for by-design demo/mock seams.

State the contracts to hold, not steps. Deliverable is the playbook file only — specify, don't run the audit. Lead with the objective; keep it terse.
```

---

### Prompt 9 — Code Health & Methodology Consistency

```
I'm building the maintainability-and-methodology audit program for CAOS. Two things quietly rot a credit platform: code entropy (dead code, duplication, complexity, boundary violations) and drift between the 27-module Modular OS methodology corpus and the code that implements it. I need a durable playbook a Sonnet 5 agent re-runs weekly and pre-deploy — you author it once, you do not run the audit yourself.

Produce caos/docs/qa/playbooks/code-health-methodology.md: a standalone, re-runnable Sonnet goal-prompt for code health and methodology consistency. Explore .fallowrc.json and the fallow tooling, ruff.toml, the complexity/vulture/fallow gates in .github/workflows/ci.yml, the Modular OS/ corpus with its tools/check_module_consistency.py, and the docs/ tree first.

Six sections: (1) Objective and the entropy/drift stakes; (2) Scope discovery — commands to enumerate the current module taxonomy and changed-code surface each run; (3) Coverage checklist spanning: dead code and unused exports/deps (fallow), code duplication, cyclomatic complexity on changed functions (the C901 changed-only gate model), circular dependencies, architecture-boundary violations, lint cleanliness, the Modular OS taxonomy consistency (module_name agreement across schema filename, ACTIVE_PROMPT, CP-X route graph, onboarding doc), CP route-graph integrity, and documentation drift between docs/ claims and the live code/CI; (4) Procedure with the exact fallow, ruff, vulture, and check_module_consistency.py invocations, scoped changed-only where the CI does; (5) Evidence and reporting — dated report, pass/fail gates that never re-litigate the existing backlog (new-only, like CI), adversarial confirmation that a flagged item is truly dead/unused; (6) accepted-risk register for pre-existing offenders marked in-place.

State the health invariants to hold, not steps. Deliverable is the playbook file only — report, don't refactor. Lead with the objective; keep it terse.
```

---

## 4. How to run the program

1. **Plan (once, per domain).** Run each prompt in §3 through Fable 5 at `xhigh`.
   Fable writes nine playbooks under `caos/docs/qa/playbooks/`. Review and commit
   them — they are now stable assets.
2. **Execute (regularly).** Point Sonnet 5 (`high`) at a playbook as its goal
   prompt: *"Execute caos/docs/qa/playbooks/<domain>.md against the current
   working tree and write the dated report."* Wire the fast ones (1, 2, 5, 8, 9)
   into the PR loop, the heavier ones (3, 4, 6, 7) into nightly/pre-deploy.
3. **Re-plan (rarely).** Only re-run a Fable prompt when the domain's *shape*
   changes materially (a new subsystem, a new deploy topology). Routine code
   change is absorbed by each playbook's scope-discovery step — that is the point.

**Why this stays cheap:** Fable runs nine times, ever. Sonnet runs the playbooks
as often as you like. Each playbook self-discovers its surface and carries an
accepted-risk register, so repeat runs stay high-signal instead of re-flagging
adjudicated items.
