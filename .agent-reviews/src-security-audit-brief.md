# Context Brief — CAOS Source Security / Performance / Tech-Debt Audit

**Plan with:** `claude-fable-5` · **Execute the patches with:** `claude-opus-4-8`
**Recommended planning effort:** `xhigh`
**Delivery mode:** autonomous (long single run; user not watching)
**Deliverable of the planning run:** one Markdown triage specification (see §5). **No code is written in this run.**

This brief is the input to the *planning* model (Fable 5). Fable 5 reads the source, produces the triage spec, and stops. A later Opus 4.8 run consumes that spec and applies the patches. Keep the two phases separate.

---

## 1. Intent (why this exists)

CAOS is an institutional leveraged-finance credit platform: analysts push real financial data (EDGAR filings, extracted fundamentals, model outputs) through an extraction-and-analysis pipeline, and money rides on a correct read. The goal of this audit is a single, defensible answer to one question: **can this application handle enterprise-grade financial data under concurrent multi-user load without silent failures, memory leaks, or data cross-contamination between user sessions?** The triage spec is the artifact a security architect would take into a hardening sprint — it is the plan of record, not a discussion.

## 2. Role & objective

Act as the **Principal Security Architect** for CAOS. Map the systemic risk surface of the application source and produce a granular, prioritized Markdown triage specification that a separate Opus 4.8 execution run can work through top-to-bottom. Your output is *the assessment and the remediation plan* — you are not fixing anything in this run.

## 3. Scope — what `/src` maps to

The raw prompt says "the entire `/src` directory." In this repository that resolves to the CAOS application source, in two trees. Audit **both**; the risk vectors span them:

- **`caos/frontend/src/`** — Next.js 15 / React 19, ~224 TS/TSX files. Home of async promise rejections, React effect/observer memory leaks, and global client state.
- **`caos/server/`** — FastAPI, ~146 Python files. Home of the extraction pipeline, per-session data handling, module-global caches, and async request concurrency.

Out of scope: `Modular OS/` (prompt corpus, not runtime), `caos/tests/`, `**/vendor/`, `**/.venv*/`, generated migrations, and third-party dependencies. If you decide to narrow further, say so explicitly at the top of the spec with the reason.

## 4. Audit vectors

Assess the source against the three vectors below. The file pointers under each are **starting anchors to verify, not confirmed findings** — treat them as leads and confirm each against the actual code before it earns a row in the spec.

**1. Concurrency & State** — race conditions, unhandled async promise rejections, and global-state mutations that leak or corrupt across requests/sessions.
- Server leads: module-level mutable singletons/caches in `caos/server/engine/` (e.g. `locks.py`, `budget.py`, `embeddings.py`, any module-global dict not keyed by user/tenant), async handlers in `caos/server/routes/` (`autonomy.py`, `runs.py`, `research.py`, `chat.py`), `rate_limit.py`, `identity.py`, `access_log.py`. **Cross-session contamination** is the headline risk here: any process-global state that carries request- or user-scoped data between requests.
- Frontend leads: `lib/api.ts` and data-fetch paths (unhandled/`.catch`-less promises), React effects without cleanup and observers that are never disconnected (`lib/use-resize-observer.ts`, `lib/useVirtualScroll.ts`, `lib/evidence-sync.tsx`), global client state (`lib/responsive-context.ts`, context providers, any module-scoped mutable store).

**2. Data Integrity** — missing validation boundaries where malformed or hostile financial data could crash or silently poison the extraction pipeline.
- Leads: `caos/server/edgar.py`, `caos/server/routes/edgar.py`, `caos/server/engine/edgar_cp1.py`, `ingest.py`, `portfolio_ingest.py`, `caos/server/engine/factpack.py`, `metricengine.py`, `packer.py`, and the CP-1 numeric guard boundary in `caos/server/engine/periods.py`. Per the repo's engine convention, any divide/multiply on a CP-1-derived figure must gate its input through `engine.periods.is_finite_number(...)` first — a `NaN`/`inf`/`None` slipping past that guard is a data-integrity defect, not a style nit. Flag every unguarded arithmetic boundary and every external-data entry point (EDGAR payloads, uploads, LLM-extracted numbers) that reaches the engine without validation.

**3. Silent Failures** — swallowed exceptions and missing error-boundary fallbacks that turn a failure into a wrong-but-quiet result.
- Server leads: bare `except:` / `except Exception: pass` / log-and-continue blocks that discard errors on data-affecting paths.
- Frontend leads: promise chains that swallow rejection (`.catch(() => {})`), and route segments under `caos/frontend/src/app/` that lack an `error.tsx` fallback (root `error.tsx` and `global-error.tsx` exist — verify per-surface coverage for `command`, `deepdive`, `model`, `pipeline`, `reports`, `research`, `sector`, `query`, `issuers`, etc.).

## 5. Deliverable — the triage specification

One Markdown file. Group every finding into **strictly prioritized tiers so Opus can execute sequentially**:

- **Critical** — cross-session data contamination, unbounded memory growth under normal load, or malformed-data crashes of the extraction pipeline. Anything that produces a silently wrong financial read goes here.
- **High** — race conditions and unhandled rejections that degrade correctness under concurrency; swallowed exceptions on data paths.
- **Medium** — missing error boundaries, non-critical leaks, defensive-validation gaps at real system boundaries.

Order tiers Critical → High → Medium, and order findings within a tier by blast radius. Each finding is one row/block with exactly these fields:

1. **Location** — exact file path plus the functional logical block (function/class/method name, and line range if stable).
2. **Failure state** — one sentence naming the concrete exploit, leak, or failure (inputs/state → wrong output, crash, or cross-user leak). No hand-waving; a specific triggering condition.
3. **Patch instruction for Opus 4.8** — an explicit, highly technical directive: the exact guard, cleanup, validation boundary, error-boundary component, scoping change, or async fix to apply, and where. Precise enough to execute without re-deriving the analysis.

Do not include findings you could not confirm in the source. An empty tier is a valid and useful result.

## 6. Self-verification protocol (required)

Establish a method for checking your own work at an interval of every 5 files as you audit. Run this every 5-file interval: hand the batch of candidate findings to a **fresh-context verifier subagent** and have it check each finding against the actual source and against the core goal — enterprise financial-data integrity under concurrent multi-user load. The verifier's mandate is adversarial: **reject any finding that is hallucinated, that cannot be reproduced from the code, or that flags a standard language feature or framework guarantee as a bug** (e.g. normal Python GIL behavior, React StrictMode double-invocation, awaited promises, FastAPI's per-request dependency scoping). Only findings that survive verification enter the spec; drop the rest and note in a short verification log how many candidates were proposed versus confirmed per batch. Fresh-context verifier subagents outperform self-critique here — prefer them over re-reading your own notes.

## 7. Boundaries

- **Assess, don't fix.** The deliverable is the triage spec. Do not modify application source, do not apply patches, do not refactor. Writing the spec file is the only file you create.
- **No invented risk.** Trust framework and language guarantees; only flag validation gaps at genuine system boundaries (external APIs, file uploads, user input, LLM output). Precision over volume — a short spec of confirmed defects beats a long one padded with theoretical ones.
- **Operating autonomously.** The user is not watching in real time. For the reversible work of reading source and writing the spec, proceed without pausing to ask. Before ending the turn, check the last paragraph: if it is a plan, a question, or a promise ("I'll…"), do that work now instead. End only when the triage spec is complete.
- **Report grounded.** Before stating a finding is confirmed, point to the specific code that proves it. If a lead turned out to be a non-issue, say so; don't inflate the count.

---

## 8. Prompt to hand to Fable 5 (copy-paste)

> I'm hardening CAOS — an institutional leveraged-finance credit platform where analysts push real financial data through an extraction-and-analysis pipeline and money rides on a correct read — for enterprise multi-user deployment. The output goes to an Opus 4.8 run that will apply the fixes, so it has to be executable without re-deriving your analysis. With that in mind:
>
> Act as the Principal Security Architect and audit the CAOS application source across two trees — `caos/frontend/src/` (Next.js 15 / React 19) and `caos/server/` (FastAPI) — excluding `Modular OS/`, tests, vendored code, virtualenvs, and migrations. Produce one Markdown triage specification; do not write or apply any fix in this run.
>
> The question the audit must answer: can this app handle enterprise-grade financial data under concurrent multi-user load without silent failures, memory leaks, or data cross-contamination between user sessions? Assess against three vectors — (1) Concurrency & State: race conditions, unhandled async promise rejections, global-state mutations that leak across requests/sessions; (2) Data Integrity: missing validation boundaries where malformed financial data could crash or silently poison the extraction pipeline (including unguarded arithmetic on CP-1 figures that should pass through `engine.periods.is_finite_number` first); (3) Silent Failures: swallowed exceptions and missing error-boundary fallbacks.
>
> Deliver the spec grouped into strictly prioritized tiers — Critical, then High, then Medium — ordered so Opus can execute sequentially. Each finding gives: the exact file path and functional logical block; one sentence naming the concrete exploit/leak/failure state; and an explicit, highly technical patch instruction for Opus 4.8 (the exact guard, cleanup, scoping change, validation boundary, or error boundary to apply, and where).
>
> Establish a method for checking your own work at an interval of every 5 files as you audit. Run this every 5-file interval, verifying your work with fresh-context verifier subagents against the core enterprise data-integrity goal — reject any finding that is hallucinated, unreproducible from the code, or that flags a standard language/framework feature as a bug. Only confirmed findings enter the spec.
>
> Trust framework and language guarantees; validate only at real system boundaries. Precision over volume. You are operating autonomously — proceed through the read-and-write work without pausing, and end the turn only when the triage spec is complete.

**Effort:** run at `xhigh` — this is a wide, capability-sensitive analysis over ~380 files where a missed cross-session leak is the expensive failure. Drop to `high` if you want a faster first pass over a narrowed scope.
