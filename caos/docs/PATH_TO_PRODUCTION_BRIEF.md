# Path to Production — Execution Context for Fable 5

> **What this file is.** A self-contained context pack. You (Fable 5) are the
> **Principal DevOps & Systems Architect** for this application — you hold full
> authority over its production-hardening architecture: observability, resilience,
> and configuration/secrets posture. Read this whole file, then own the mission
> below. Everything you need — the production goal, the immutable operating
> constraints, a measured baseline of what already exists versus what is missing
> (already run for you against the live code — §3), the real deployment topology
> and file map, a proven output shape, and a per-layer self-check protocol — is
> here. You are not filling in a template; you are deciding what this system's
> production architecture should *be*. **"Harden" throughout means adding the
> production safeguards a hostile, always-on environment demands — structured
> observability, egress resilience, secure config — *without* changing the
> application's behavior, its single-process deployment model, or its analytical
> output.** Do **not** write the hardening code — your deliverable is a Markdown
> implementation specification that **Opus 4.8** executes.
>
> **Repo root:** `/home/user/Credit-Operating-System`
> **Server root:** `caos/server/` (FastAPI, single process — `main.py` serves `/api` + the built UI)
> **Deploy root:** `caos/deploy/` (Caddy → oauth2-proxy → app → Postgres, docker-compose)
> **Write your spec to:** `caos/docs/PATH_TO_PRODUCTION_SPEC.md`

---

## 0. The Mission

**Outcome you own:** CAOS runs autonomous credit-research pipelines — multi-minute,
LLM-backed, off-request background jobs (run executor, deep research, the
Sentinel→Anomaly→Analyst→Reporter autonomy cycle) — reliably and *observably* in a
production enterprise environment. When one of those pipelines is slow, degraded,
or failing at 3am, an on-call operator must be able to see **which request, which
run, which external call, and which layer** is at fault from the telemetry alone,
and the system must **degrade gracefully rather than cascade** when a third-party
API rate-limits, a database connection drops, or a provider overloads. Everything
below serves that one outcome.

CAOS is **already well past rapid-prototype in several dimensions** — it ships
fail-closed boot guards, a hardened container stack (non-root, `cap_drop: ALL`,
read-only rootfs, hash-pinned images), a structured access log, a per-inference LLM
cost ledger, and a DB-lease-based async executor with orphan reaping. **This is not
a greenfield instrumentation job; it is a gap-closure job.** Your value is in being
*surgical and honest*: name the specific safeguards that are genuinely missing,
grounded in the measured baseline (§3), and leave the strong existing posture
alone. A spec that tells Opus to "add logging" where structured logging already
exists is a defect.

The mission has three gap classes, and your spec closes all three:

1. **Observability.** Where are structured logging, telemetry/metrics, and
   distributed tracing missing? (Today: two JSON log *streams* exist; the rest of
   the app log is plain text with no correlation ID; there is **zero** metrics
   emission and **zero** distributed tracing — §3A.)
2. **Resilience.** Which third-party API calls and database queries lack retry
   logic, circuit breakers, or rate-limit handling? (Today: one hand-rolled
   backoff loop guards only the LLM *fallback* model; OpenRouter, Gemini,
   embeddings, and EDGAR have no retry at all; the DB pool is entirely
   default-sized with no statement timeout — §3B.)
3. **Environment Configuration.** Are secrets, environment variables, and
   configuration flags structured securely and scalably? (Today: fail-closed
   guards and `:?`-required injection are strong; secrets are plain `str` (no
   `SecretStr`), live only in a host `.env` with no secret manager, and have no
   rotation path — §3C.)

**Your architectural authority is full, inside five fixed boundaries.** You decide
the instrumentation architecture, the resilience patterns, the config
restructuring, and the sequence. You do **not** get to move these five posts, and
every decision must survive them:

- **No unnecessary latency on the core request path.** This is the hardest
  constraint and the one most easily violated by "add observability." The
  interactive `/api` lanes (issuer chat, NL-query translate, reads) must not gain
  a single blocking call. Metrics must be in-memory and scrape-pulled (never a
  synchronous push per request); correlation-ID work must be O(1); tracing must be
  cheap or sampled; a circuit-breaker check must be an in-memory state read, not a
  network round-trip. Every item you spec states its **latency guard** (§5). An
  instrumentation change that adds measurable p50 latency to an interactive read is
  a failed item, not a feature.
- **No behavior change.** Analytical output, run results, API contracts, and the
  mock↔engine seam stay byte-identical. You are wrapping the system in production
  safeguards, not re-architecting it.
- **Respect the single-process, no-paid-services design.** The deployment is one
  FastAPI process behind Caddy+oauth2-proxy, with a Postgres-backed in-process
  executor — *by design* (`server/main.py` docstring; the `log_unhandled` comment
  states "no external APM, by design (no-paid-services)"). Prefer
  **self-hostable / OSS** observability (the OpenTelemetry SDK with a local
  collector or a Prometheus-scrape endpoint + local Grafana) over any paid SaaS
  APM. Do **not** introduce a message broker, a distributed queue, or a second
  runtime; the DB-lease executor is the concurrency substrate.
- **Preserve the fail-closed guards.** The boot guards in `server/main.py`
  `lifespan` and the `is_deployed()` asymmetry in `server/config.py` are a genuine
  strength — extend that posture, never weaken it. New config must fail *toward*
  enforcement.
- **Spec, not code.** Your remit is the Markdown specification. Do not write the
  hardening code, do not fabricate a file or a call site, and do not spec a
  safeguard against a component that does not exist. Every path you cite must be
  real (the baseline in §3 is your verified starting set; confirm anything you add).

**Deliverable.** A single Markdown spec that Opus 4.8 can execute top-to-bottom,
**grouped strictly by system layer**, layers ordered for **dependency-correct
sequential execution** (§4). Each item states the gap in one sentence, points at
real files and named functional blocks (**never guessed line numbers**), names the
missing safeguard in one sentence, names the enterprise pattern, gives Opus an
explicit technical build instruction, and states its latency guard. §5 gives the
proven item shape. As you go, run the per-layer self-check in §7.

---

## 0.1 How to work — operating guide (written for how Fable 5 performs best)

Read this before you start; it is calibrated to how you specifically do your best
work.

- **Decide the architecture, then decompose. Don't wait for permission.** You have
  the goal, the constraints, and a measured baseline. When you have enough to
  decide a pattern (e.g. "correlation ID via a `contextvars` token set in
  middleware, injected into a JSON log formatter"), decide it and specify it. Give
  a recommendation, not an exhaustive survey of every tracing backend. Re-deriving
  what §3 already establishes is wasted motion.
- **Start at the foundation layer, not the easiest.** The observability substrate
  (structured JSON logging + a request/run correlation ID — Layer 1) is the
  dependency every later layer's instrumentation builds on: you cannot add
  meaningful executor spans or metric labels until there is a correlation key to
  hang them on. Specify Layers 0–1 first and the rest inherits the grammar you set.
- **For each layer, commit to a pattern — but generate options first where the
  design space is wide.** Where a layer could plausibly go several ways (e.g.
  metrics via the OpenTelemetry SDK's metrics API vs a `prometheus-client`
  `/metrics` endpoint), briefly lay out 2–3 concrete options — each with its
  latency cost, its operational weight, and one line of rationale — pick one, and
  specify only that one in depth. Hand Opus a decision with its reasoning, not a
  menu.
- **Lead every writeup with the outcome.** The first sentence of any section, and
  of the final report, answers "what should change and why does the operator care."
  Supporting detail comes after. Readability beats brevity: complete sentences,
  spelled-out terms, no arrow-chains or invented shorthand. Opus (and the user)
  read this cold.
- **Ground every claim in evidence.** The baseline in §3 was produced by reading
  the live code (file + block cited). Before you assert a new gap or cite a call
  site not in §3, open the file and confirm it. A path or a posture you did not
  verify is a defect, not a finding.
- **State boundaries, then stay inside them.** Your remit is a *spec*, and the
  five boundaries in §0 are load-bearing. The latency boundary especially: for
  every safeguard, ask "does this touch the interactive request path, and if so, is
  it non-blocking?" If you cannot answer, that item is not ready.
- **Delegate verification to fresh-context sub-agents, and keep working while they
  run.** Your self-check (§7) is strongest when a separate agent that has *not*
  seen your reasoning audits a completed layer — fresh eyes catch hallucinated call
  sites, mis-applied patterns, and latency regressions that self-review
  rationalizes. Dispatch these at each layer boundary; don't block on the slowest.
- **Keep a working memory file.** As you scope layers, record decisions and their
  rationale (a short `caos/docs/.p2p-spec-notes.md`): which pattern you chose per
  layer and why, which candidate safeguards you rejected as redundant with existing
  posture and why. It keeps the spec internally consistent across seven layers and
  gives your checkpoints something to audit against.
- **De-prescription is deliberate.** This brief gives you the goal, the
  constraints, the baseline, and the map — not a step list. Fill the gaps with
  judgment; that is the job.

---

## 1. System context — what CAOS is and what "production-ready" means here

**CAOS — Credit Agent OS.** An institutional leveraged-finance credit-analysis
platform. One FastAPI process (`caos/server/main.py`) serves the JSON API under
`/api` and the built Next.js static export at `/`. The analytical work is a
27-module "Modular OS" methodology executed by a deterministic engine
(`caos/server/engine/`), much of it LLM-backed (Anthropic, with OpenRouter/DeepSeek
and Gemini as alternate provider tiers).

**The autonomous pipelines are the reliability target.** Four background executors,
started in `main.py` `lifespan`, run multi-minute work off the request thread:
- **Run executor** (`run_executor.py`) — the module pipeline per issuer; DB-lease
  claimed, orphan-reaped.
- **Research executor** (`research_executor.py`) — durable Deep Research jobs the
  client polls.
- **Pipeline executor** (`engine/pipeline_executor.py`) — the autonomy cycle
  (Sentinel→Anomaly→Analyst→Reporter), claimed via `SELECT FOR UPDATE SKIP LOCKED`.
- **Research-report executor** (`research_report_executor.py`) — durable issuer
  research-report synthesis.

These are where "runs reliably in production" is won or lost: they cross the
request→worker boundary, fan out concurrent LLM calls, and depend on external
providers and the database for minutes at a time.

**Deployment topology (`caos/deploy/`).** `Caddy (TLS :443)` → `oauth2-proxy (OIDC
auth, injects X-Forwarded-* identity + X-Edge-Authorization)` → `app (FastAPI, not
published to host)` → `db (pgvector/Postgres 18)`. An opt-in `clamav` sidecar scans
uploads; a `backup` sidecar dumps Postgres + the vault daily. The app is a single
replica by design.

**"Production-ready" for CAOS means, concretely:** (1) every log line an operator
needs to triage an incident is structured and carries a correlation ID that joins
an inbound request to the background work and external calls it spawned; (2) every
egress call (LLM providers, EDGAR, database) fails fast, retries transient errors
with backoff, and trips a breaker rather than hammering a downed dependency or
pinning a worker; (3) secrets are typed, injected, and rotatable without leaking or
requiring a scavenger hunt; (4) none of the above adds latency to the interactive
analyst experience. It does **not** mean multi-region, autoscaling, or a paid
observability platform — those are out of scope for this single-node internal
production pilot.

---

## 2. The production-readiness bar (the objective proxy)

The mission's objective is operator-grade reliability and observability. The
measurable proxy — the equivalent of a rubric score — is the **Production Readiness
Scorecard** below. Your spec must move **every layer to GREEN** by the criteria
here. Like any proxy, it is the *floor*, not the objective: move a criterion to
GREEN by making the system genuinely more operable under failure, never by adding
telemetry chrome that satisfies a checkbox without helping an on-call operator.

**Per-layer target — every layer GREEN:**

| Criterion | GREEN means (the pass bar) |
|---|---|
| **Structured logging** | 100% of app log output is single-line JSON, parseable without a `sed` prefix strip; no plain-text `basicConfig` stream remains. |
| **Correlation** | Every inbound `/api` request and every background job carries a correlation ID present in **every** log line, metric label, and span it produces; the run-arc join key already exists (`run_id`) and is extended, not replaced. |
| **Metrics** | A self-hosted scrape surface exposes RED (request rate / error rate / duration) for HTTP and USE (executor queue depth / in-flight / failure rate) for the pipelines, plus LLM cost / fallback-rate / latency derived from the existing ledger — no paid SaaS. |
| **Tracing** | A trace spans the request → executor → LLM-call arc for at least the autonomous pipeline runs, keyed on the existing `run_id`. |
| **Egress resilience** | Every external call (Anthropic primary + fallback, OpenRouter, Gemini, embeddings, EDGAR) has a bounded timeout, a bounded retry with backoff+jitter on transient errors, and a circuit breaker; EDGAR additionally honors SEC 429/`Retry-After` and a cross-process-safe rate limit. |
| **DB resilience** | The Postgres pool is explicitly sized and coupled to `caos_run_concurrency`, with `pool_recycle`, a connect timeout, and a server-side `statement_timeout`; transient-disconnect handling beyond `pool_pre_ping` is specified. |
| **Secret hygiene** | Secrets are typed (`SecretStr`), injected via a file-based/secret-manager path (not just host env), with a documented rotation runbook and a dual-key grace window for `session_secret`. |
| **Latency neutrality** | Every instrumentation item is non-blocking on the interactive request path; the aggregate added p50 on a core read is negligible (target < ~2ms, and zero synchronous network calls). |
| **Verifiability** | Each item names how Opus proves it works (a log line to grep, a metric to scrape, a failure to inject) — no unfalsifiable "added logging". |

**A layer is GREEN only when every applicable criterion above is met for the
components in that layer.** Record each layer's scorecard verdict inline in the
spec (§7).

---

## 3. MEASURED BASELINE (already run for you — 2026-07-08)

Three fresh-context sub-agents read the live server, deploy stack, and config and
produced the inventory below (file + block cited, no line numbers). **Use these as
your starting facts; re-verify only if you extend beyond them.** The honest headline:
**the security, container-hardening, and config-guard posture is already strong;
the gaps concentrate in three places — a plain-text app log with no correlation ID,
zero metrics/tracing, and near-total absence of egress retry/breaker logic.**

### 3A. Observability — what exists (strong) vs. gaps

**Strong (do not "fix"):**
- **The access log is genuinely structured.** `main.py` `access_log` middleware →
  `access_log.py` `access_event` emits one JSON payload per `/api` request on the
  `caos.access` logger (`entity, action, status, volume, source, dur_ms`), with
  header values sanitized against log-forging (`sanitize_field`).
- **A second structured stream: the LLM trace.** `engine/budget.py` `trace_llm`
  emits per-inference JSON on `caos.llm` (`run_id, lane, model, fallback,
  input/output tokens, stop_reason, ms`) **and** writes an `LLMCallRecord` row —
  a queryable cost/tokens/latency ledger.
- **Broad, namespaced loggers:** ~48 modules construct `caos.*` loggers (~109 call
  sites); executors log failures and terminal states well; `log_unhandled` captures
  every unhandled exception with request context.
- **Health is a real readiness probe:** `routes/health.py` `health` runs `SELECT 1`,
  returns 503 on DB failure, reports LLM-configured + version.

**Gaps (your Observability targets):**
- **The app log is plain text.** `main.py` module scope has the *only* logging
  config: `logging.basicConfig(level=logging.INFO)` — no formatter, no handler. Only
  the `caos.access` and `caos.llm` *payloads* are JSON; every other `caos.*` line is
  an unstructured string wrapped in `LEVEL:logger:msg`.
- **No request/correlation ID.** There is no `X-Request-Id`, no request-scoped
  `ContextVar`, no middleware assigning a per-request id. The only correlation is
  `run_id` (`engine/budget.py` `_run_id_var`, set in `engine/runner.py` `execute_run`
  via `budget.set_run_id`) — and it covers **only runs**; run-less lanes (issuer
  chat, deep research, NL query, scenario) trace with `run_id=None`. Nothing joins an
  inbound HTTP request to the executor work and LLM calls it spawns.
- **Zero metrics.** No OpenTelemetry, Prometheus, or StatsD anywhere;
  `requirements.lock` carries no observability dependency; no `/metrics` endpoint; no
  RED/USE aggregates (the data exists per-line in `caos.access`/`caos.llm` and in
  `LLMCallRecord`, but nothing aggregates or exposes it).
- **Zero distributed tracing.** No spans, no tracer, no context propagation. Highest-
  value span points: `engine/runner.py` `execute_run` (root span for the async run
  arc — `run_id` already exists as the key), the multi-module synth fan-out
  (`engine/synth.py`), and the universal LLM choke-point `engine/budget.py`
  `trace_llm` (already holds model/latency/tokens).
- **Happy-path job start is silent.** Executors log failures loudly but the
  claim→start of a healthy run/job lands only in DB columns (`claimed_at`, `status`),
  not the log stream; no aggregate job metrics; no heartbeat to detect a *hung* (vs
  crashed) task.

### 3B. Resilience — what exists vs. gaps

**Strong (do not "fix"):**
- **Concurrency backpressure exists:** `synth_concurrency` (default 4) via an
  `asyncio.Semaphore` in `engine/runner.py`; `caos_run_concurrency` (default 2) in
  `run_executor.py` (`InProcessExecutor` / `QueueWorker._run_loop`);
  `caos_research_concurrency` in the research executors.
- **Timeouts are present everywhere:** every LLM client is built with
  `timeout=caos_llm_timeout_s` (120s); EDGAR uses `urllib` with `edgar_timeout_s`
  (30s); ClamAV uses socket timeouts.
- **DB claim safety + orphan recovery:** `run_executor.py` `_claim_one` uses
  `with_for_update(skip_locked=True)`; lease model (`caos_run_lease_seconds`,
  `caos_run_max_attempts`) with `_reap_orphans`; boot-time sweep of stranded rows;
  `pool_pre_ping=True`; boot migrations serialized by a Postgres advisory lock.
- **Graceful degradation is a real pattern:** rerank and embeddings fail *open*
  (passthrough / mock); the LLM seam falls back to a cheaper model on overload;
  ClamAV fails *closed* (503).

**Gaps (your Resilience targets):**
- **The Anthropic primary call is bare.** `engine/llm_client.py` `create` issues a
  plain `client.messages.create(model=primary)` with no app-level retry (only the
  SDK's default `max_retries=2`); the hand-rolled `_call_with_retry` (backoff+jitter,
  gated on `is_overloaded`) guards **only the cheaper fallback model**. A transient
  429/5xx on the primary is not app-retried.
- **OpenRouter, Gemini, embeddings have no retry loop.** `engine/openrouter.py`
  `call` (single `httpx` post + `raise_for_status`), `engine/gemini.py` `call`, and
  `engine/embeddings.py` `get_embeddings` have timeout only — no backoff, no breaker,
  no rate-limit handling. (There is a single same-provider cheaper-model swap on
  overload — `fb = fallback_model or s.model_tier_cheap`, which resolves to an
  OpenRouter/Gemini id and *does* fire — but it is one shot, not a
  retry-with-backoff loop.)
- **No circuit breaker anywhere** — all providers and the DB. A downed provider is
  hit on every call until each times out.
- **EDGAR has no retry and a weak rate limit.** `edgar.py` `_http_get` turns any
  `HTTPError` (including 429) straight into `EdgarError` — no retry, no `Retry-After`
  honoring. Its rate limit is an in-process `threading.Lock` + fixed `0.15s` spacer
  (`_MIN_INTERVAL_S`), which is **not multi-worker/cross-process safe** and is a
  spacer, not a token bucket.
- **The DB pool is entirely default-sized.** `database.py` sets only
  `pool_pre_ping=True`; `pool_size`/`max_overflow`/`pool_recycle`/`pool_timeout`/
  connect-timeout are all defaults, and there is **no `statement_timeout`** on
  Postgres (the SQLite `busy_timeout=5000` PRAGMA is a lock-wait, not a statement
  timeout, and is no-op on Postgres). No transient-disconnect retry beyond
  `pool_pre_ping`. A code comment already flags that `pool_size` and
  `caos_run_concurrency` are coupled but unsized.
- **No retry/breaker library is *used* by the app code.** `tenacity 9.1.4` is
  already in `requirements.lock` (transitively, via `google-genai`) but is imported
  nowhere in `caos/server/`; `backoff`/`pybreaker` are absent. The only retry logic
  is the one hand-rolled LLM fallback loop — so adopting `tenacity` for egress means
  promoting an already-present transitive dependency to a direct one, not adding a
  new package.

### 3C. Environment Configuration & Secrets — what exists vs. gaps

**Strong (do not "fix"):**
- **Fail-closed boot guards** in `main.py` `lifespan` raise `RuntimeError` under
  `is_deployed()` when `edge_proxy_secret` is empty, `session_secret`/
  `analyst_signup_code` are the in-source defaults, or `caos_demo_seed` is on;
  `is_deployed()` (`config.py`) is asymmetric (anything `!= "development"` → deployed)
  so a typo'd/unset `ENVIRONMENT` fails *toward* enforcement.
- **No secret leakage:** grep finds no secret interpolated into a log/error/response;
  `routes/settings.py` `read_settings` exposes only presence booleans
  (`bool(gemini_api_key)`); `edge_proxy_secret` is compared with
  `hmac.compare_digest`.
- **Deploy injection is `:?`-fail-fast:** every required secret in
  `deploy/docker-compose.yml` uses `${VAR:?...}`, so compose refuses to start blank;
  `.env` is git-ignored (only `.env.example` tracked); images are hash-pinned and
  installed with `--require-hashes`.
- **Feature flags degrade-to-safe:** ~15 boolean gates default off; each consumer
  re-checks its prerequisite key and falls back (e.g. `engine/council.py` `get_reviewer`
  → `FixtureReviewer` without a key).

**Gaps (your Configuration targets):**
- **Secrets are plain `str`, not `SecretStr`.** In `config.py` all six secrets are
  ordinary strings — safety today is by-discipline, not by-type; nothing structurally
  prevents a future log/error from interpolating one.
- **No secret manager.** Secrets live only in the host `.env` and are visible in each
  container's environment (`docker inspect`, `/proc/<pid>/environ`); no Vault / cloud
  secrets / SOPS / file-based `*_FILE` injection. `oauth2-proxy` and `caddy` also lack
  healthchecks (only `db` and `clamav` have compose-level healthchecks; `app`'s is the
  `HEALTHCHECK` instruction in `deploy/Dockerfile`, not a compose block — so don't add
  a redundant one).
- **No flag-prerequisite boot audit.** A flag turned on without its key silently runs
  the fixture/deterministic path (e.g. `council_enabled=true` with no key → a clean-
  looking run with no findings); the knowledge is spread across `engine/*.py`, with no
  single boot-time warning.
- **No rotation path.** `get_settings()` is `@lru_cache` (process-cached) so rotating
  any secret needs a restart; rotating `session_secret` is a hard logout for every
  analyst (no dual-key overlap — it signs the `caos_analyst` cookie in `routes/auth.py`);
  the multi-replica constraint (`session_secret`/`edge_proxy_secret` must match across
  replicas) is real but undocumented.

---

## 4. System-layer map — the sequential execution order

Group the spec **strictly by these seven layers, in this order**. The order is
dependency-correct: each layer's safeguards presuppose the ones before it (you
cannot label a metric or a span without the correlation ID from Layer 1; you cannot
instrument the executors meaningfully before the substrate exists). Opus executes
top-to-bottom.

| # | Layer | Scope & primary files | Why here |
|---|---|---|---|
| **0** | **Environment Configuration & Secrets** | `server/config.py` (`Settings`, `get_settings`, `is_deployed`); `deploy/docker-compose.yml`, `deploy/.env.example`; `routes/auth.py` (session-secret rotation) | Foundation — typing, flag-prerequisite audit, and secret injection underpin every later layer; touches no request path, safest to land first. |
| **1** | **Observability Substrate** | `server/main.py` (`basicConfig`, `access_log` middleware); a new logging-config + correlation-ID module; `engine/budget.py` (`_run_id_var`) | The correlation ID + JSON formatter are the grammar every later layer's logs, metrics, and spans hang on. Must precede all instrumentation. |
| **2** | **Network & Edge** | `deploy/Caddyfile`, `deploy/oauth2-proxy.cfg`, `deploy/docker-compose.yml`; `main.py` middlewares; `routes/health.py` | Request-ID origination at the edge, healthchecks on the ingress chain, liveness/readiness split — the outermost observable surface. |
| **3** | **Data & Persistence** | `server/database.py` (`create_async_engine`, `get_db`); `run_executor.py`, `engine/locks.py` | Pool sizing, `pool_recycle`, connect + statement timeouts, transient-disconnect handling — the shared dependency under every pipeline. |
| **4** | **External Integrations (Egress Resilience)** | `engine/llm_client.py`, `engine/openrouter.py`, `engine/gemini.py`, `engine/embeddings.py`, `engine/rerank.py`, `llm.py`, `deepresearch.py`, `research_report.py`, `engine/synth.py`; `edgar.py`, `engine/edgar_cp1.py`; `avscan.py` | Retry/backoff/breaker/rate-limit for every third-party call — the dependencies most likely to fail in production. |
| **5** | **Application Logic & Async Execution** | `engine/runner.py` (`execute_run`, synth `Semaphore`), `run_executor.py`, `research_executor.py`, `engine/pipeline_executor.py`, `research_report_executor.py`, `engine/synth.py` | Distributed-trace spans across the request→executor→LLM arc, job start/heartbeat logging, per-run correlation — where the autonomous pipelines become observable. |
| **6** | **Telemetry & Metrics Aggregation** | new `/metrics` (or OTel exporter) surface in `main.py`; `engine/budget.py` (`trace_llm`, `LLMCallRecord`); executor loops | The scrape endpoint + RED/USE + LLM cost/fallback metrics that turn the per-line logs and the ledger into dashboards and alerts. |

> **Cross-cut note.** Observability is spread across Layers 1, 5, and 6 on purpose:
> Layer 1 builds the substrate (structured logs + correlation ID), Layer 5 threads
> it through the pipelines (spans + job logs), Layer 6 aggregates it (metrics
> surface). Resilience is Layers 3–4; Configuration is Layer 0. This keeps the
> "group strictly by system layer" requirement while sequencing the observability
> work in dependency order.

**Relevant config knobs already present** (extend these; do not duplicate):
`caos_llm_timeout_s`, `synth_concurrency`, `caos_run_concurrency`,
`caos_run_lease_seconds`, `caos_run_max_attempts`, `edgar_timeout_s`,
`clamav_timeout_s`, `run_token_budget`. New knobs you introduce belong in
`config.py` `Settings` with the same inline-rationale style and safe defaults.

---

## 5. Output specification — how to write `PATH_TO_PRODUCTION_SPEC.md`

Produce ONE Markdown file, grouped strictly by the seven layers of §4, in order, so
Opus works sequentially top-to-bottom:

```
# CAOS Path to Production — Implementation Spec (for Opus 4.8)

## Layer 0 — Environment Configuration & Secrets
## Layer 1 — Observability Substrate
## Layer 2 — Network & Edge
## Layer 3 — Data & Persistence
## Layer 4 — External Integrations (Egress Resilience)
## Layer 5 — Application Logic & Async Execution
## Layer 6 — Telemetry & Metrics Aggregation
```

Within each layer, order items by severity (**P0 blocking → P3 nice-to-have**) as a
tag on each item, but keep them under their layer heading. **Every item follows this
shape — adapt it to what the finding needs; it is a completeness floor, not a rigid
form:**

```markdown
### [Layer N · P?] <Component> — <Short title>
- **Gap (1 sentence):** <one sentence, concrete, no hedging>.
- **Files / logical blocks:** `caos/server/<file>.py` → `<function/class/block name>` (NOT a line number); `caos/deploy/<file>`.
- **Missing safeguard (1 sentence):** <the specific production safeguard that is absent>.
- **Enterprise pattern:** <the named standard pattern — e.g. "exponential backoff with full jitter", "circuit breaker (closed/open/half-open)", "structured logging with a contextvars correlation ID", "OpenTelemetry span per unit of work", "token-bucket rate limiter", "pydantic SecretStr + file-based secret injection">.
- **Opus instruction (technical):** <exact, imperative build steps — the module/function to add or wrap, the config knob to introduce in `config.py` (name + default + rationale), where it is wired, the failure classification it keys on, the fallback/degrade behavior, and the exact log field / metric name / span name it emits>.
- **Latency guard:** <one line — why this does NOT add blocking latency to the interactive request path; if it touches that path, state the non-blocking mechanism (in-memory read, background flush, sampling) and the bound>.
- **Verification:** <one line — how Opus proves it works: the log line to grep, the metric to scrape, the fault to inject (kill the DB, force a 429), the expected degraded response>.
```

**Rules for the spec:**
- **Extend before you add.** Reuse the existing seams — route new LLM resilience
  through `engine/llm_client.py` `create` (the universal choke-point), new metrics
  and spans through `engine/budget.py` `trace_llm` (already holds the data), new
  correlation through the existing `run_id` `ContextVar` pattern. Introduce a new
  module only when no seam fits, and say why. Do not add a dependency that a few
  lines over an existing seam would cover; when you do add one (e.g. `tenacity`,
  `prometheus-client`, `opentelemetry-sdk`), name it, justify it against the
  no-paid-services constraint, and note it belongs in `requirements.txt` +
  `requirements.lock` (note: `tenacity` is already in `requirements.lock`
  transitively via `google-genai`, so adopting it is a one-line promotion to a
  direct `requirements.txt` dependency, not a new install).
- **The latency guard is mandatory on every item.** An item without a credible
  latency guard does not belong in the spec. This is the boundary most likely to be
  violated.
- **No line numbers.** Name the function, class, middleware, or config field.
- **Don't re-spec strong posture.** If §3 marks something strong (fail-closed guards,
  the access log, container hardening, DB claim safety), do not write an item that
  re-implements it. If you believe §3 mis-marked something, say so with evidence.
- **Preserve behavior and the seam.** When wrapping a call in retry/breaker logic,
  the success-path response and the degrade behavior stay identical; name the
  fallback explicitly (fail-open vs fail-closed) and match the existing choice for
  that call site (e.g. rerank/embeddings fail open, ClamAV fails closed).
- **Prefer self-hosted/OSS for observability** and say so per item; never spec a paid
  APM. If you choose OpenTelemetry, target a local collector; if Prometheus, a local
  scrape + Grafana.
- **Tie every item to a Scorecard criterion (§2) and a layer (§4).** An item that
  moves no criterion toward GREEN does not belong in the spec.

---

## 6. Self-check protocol (verify at every layer boundary)

The raw mandate is explicit: *check your own work at an interval of every distinct
system layer, verifying with sub-agents against the enterprise observability goal
and ensuring the proposed architecture introduces no unnecessary latency.* This
section operationalizes that.

**Cadence: one fresh-context verification sub-agent per completed layer** (seven
checkpoints total). Verification is a tool in service of the outcome, not a gate you
march through — but the latency and reality checks below are non-negotiable.
Dispatch each verifier **asynchronously and keep specifying the next layer while it
runs**; **reconcile every REVISE before you declare the spec done (§8)** — that
reconciliation is the gate, not mid-stream progress.

**At each layer boundary, dispatch a verification sub-agent** (the general-purpose or
Explore agent) with this charge — do **not** self-approve:

> "Review the just-completed `## Layer <N> — <name>` section of
> `caos/docs/PATH_TO_PRODUCTION_SPEC.md`. For each item verify, against the live
> code in `caos/server/` and `caos/deploy/`: (1) **the file path and named block
> actually exist** — flag any hallucinated path or call site; (2) the **missing
> safeguard is genuinely absent** (not already present in the code — cross-check the
> baseline in `PATH_TO_PRODUCTION_BRIEF.md` §3, and re-read the file if in doubt) —
> flag any item that re-specs existing posture; (3) the **enterprise pattern named
> is real, standard, and correctly applied** to this failure mode; (4) the **latency
> guard is credible** — if the item touches the interactive `/api` request path
> (issuer chat, NL-query, reads), confirm the mechanism is genuinely non-blocking
> (in-memory read, background flush, sampling) and flag any synchronous network
> call, lock, or blocking I/O added to that path as a **LATENCY REGRESSION**; (5)
> the item **serves the enterprise observability/resilience goal** — an operator
> could triage a real incident with it, or the system degrades instead of cascading
> — flag telemetry-chrome that satisfies a checkbox without operational value; (6)
> the **Opus instruction is executable** — concrete enough to build without further
> clarification, with the config knob, wiring point, and emitted field/metric/span
> named. Return a table: item → PASS / REVISE (with the specific defect). Be
> adversarial; assume a cited call site is hallucinated and a latency guard is wrong
> until proven otherwise."

Record each checkpoint's verdict inline under its layer heading (a short
`> Checkpoint L<N>: K pass, M revised — <what changed>` note) so the audit trail is
visible. Reconcile every REVISE before §8.

**Continuous guardrails (apply as you write, not only at checkpoints):**
- Before citing any file/block/config field, confirm it exists (it is in §3, or you
  read it). A path you did not verify is a defect.
- For every item, answer the latency question explicitly before moving on: does it
  touch the interactive request path, and if so, what makes it non-blocking?
- Prefer extending an existing seam (`llm_client.create`, `budget.trace_llm`, the
  `run_id` `ContextVar`, the `config.py` `Settings`) over a new module or dependency;
  justify every new dependency against no-paid-services.
- Match the existing degrade choice per call site (fail-open vs fail-closed); never
  silently flip one.

---

## 7. Definition of done

- `caos/docs/PATH_TO_PRODUCTION_SPEC.md` exists, grouped strictly by the seven
  layers of §4 in sequential order, each item carrying the §5 fields that apply
  (gap · files · missing safeguard · enterprise pattern · Opus instruction · latency
  guard · verification), adapted to the finding — gate on the *information* being
  present, not literal template conformance.
- Every item names a real file + block (no line numbers, no hallucinated paths),
  ties to a §2 Scorecard criterion and its §4 layer, and moves that criterion toward
  GREEN.
- Every item that touches the interactive `/api` request path states a credible
  non-blocking latency guard; no item introduces a synchronous external call, lock,
  or blocking I/O to that path.
- Every external-call and DB item specifies timeout + retry/backoff + breaker (and,
  for EDGAR, SEC 429/`Retry-After` + cross-process rate limit) with the fallback
  behavior (open vs closed) matched to the existing call site.
- Every new dependency and config knob is named, justified against the
  single-process / no-paid-services constraints, and placed (`requirements.txt` +
  `requirements.lock`; `config.py` `Settings` with default + rationale).
- No item re-specs the strong existing posture flagged in §3 (fail-closed guards,
  the structured access log, container hardening, DB claim safety, graceful-degrade
  seams); any disagreement with §3 is stated with evidence.
- All seven layer checkpoints are recorded inline, and every REVISE is reconciled.
- The spec is executable by Opus **top-to-bottom without further clarification** —
  real file paths and named functional blocks, dependency-correct layer order,
  behavior-preserving throughout.
