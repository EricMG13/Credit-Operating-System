# CAOS Path to Production — Implementation Spec (for Opus 4.8)

**What this is.** The layer-by-layer hardening spec Opus 4.8 executes top-to-bottom to
make CAOS run its autonomous credit-research pipelines observably and resiliently in a
single-node production environment. It closes three gap classes — **observability**
(structured logs + correlation ID + metrics + tracing), **resilience** (egress
retry/breaker/rate-limit + DB pool/timeout hardening), and **configuration & secrets**
(typed, file-injectable, rotatable) — without changing analytical behavior, the
single-process deployment model, or adding latency to the interactive request path.

**How to execute.** Layers are dependency-ordered (0→6); execute in order. Each item
carries a severity tag (**P0 blocking → P3 nice-to-have**), the exact files and named
code blocks to touch (never line numbers), the enterprise pattern, a concrete build
instruction with the config knob to add, a **latency guard** (why it does not slow the
interactive `/api` path), and a **verification** step. Every item ties to a Production
Readiness Scorecard criterion and moves it toward GREEN.

**Five fixed boundaries — hold on every item.** (1) No blocking call added to the
interactive `/api` request path — metrics are in-memory + scrape-pulled, correlation is
O(1), breaker checks are in-memory state reads, tracing is log-based or sampled. (2) No
behavior change — analytical output, API contracts, and the mock↔engine seam stay
byte-identical; success-path responses and every existing degrade choice (fail-open vs
fail-closed) are preserved exactly. (3) Single-process, no-paid-services — OSS/self-hosted
only; no message broker, no second runtime; the DB-lease executor stays the concurrency
substrate. (4) Extend the fail-closed guards, never weaken them; new config fails toward
enforcement. (5) Reuse existing seams before adding a module or dependency.

**Seams this spec extends (do not reinvent).** `config.py` `Settings`/`get_settings`/
`is_deployed`; `engine/budget.py` `trace_llm` + `_run_id_var`/`set_run_id` + the
`LLMCallRecord` table (the LLM cost/latency ledger); `access_log.py` `access_event` +
`main.py` `access_log` middleware (the RED source); `engine/llm_client.py` `create` +
`_call_with_retry` + the `is_overloaded` classifiers (the universal LLM choke-point);
`edgar.py` `_http_get` (the single EDGAR egress choke-point); `engine/locks.py`
`advisory_lock`/`key_from_str` (the cross-worker single-flight primitive);
`database.py` `_engine_kwargs` + the SQLite dialect branch.

**Dependencies introduced (all OSS, justified per no-paid-services).**
`tenacity` — promote from transitive (already pinned `9.1.4` in `requirements.lock` via
`google-genai`) to a direct `requirements.txt` dependency; a one-line promotion, not a new
install. `prometheus-client` — the single new package, a pure-Python in-memory metrics
registry with a pull-scrape exposition endpoint (no collector required to emit, no push,
no paid backend). Both go in `requirements.txt` + `requirements.lock`. OpenTelemetry is
specified only as an **opt-in** upgrade (Layer 5, disabled by default, zero cost when its
collector is absent), never as a required dependency.

> **Scorecard criteria referenced (brief §2):** structured-logging, correlation, metrics,
> tracing, egress-resilience, db-resilience, secret-hygiene, latency-neutrality,
> verifiability. Each item names the one it advances.

---

## Layer 0 — Environment Configuration & Secrets

**Outcome:** secrets become typed (unloggable by accident), injectable from a file/secret
mount instead of only a host `.env`, and rotatable without a fleet-wide analyst logout; a
flag turned on without its key is caught at boot instead of silently running the fixture
path. This is the foundation layer — it touches no request path, so it lands first and
safest. The strong posture stays untouched: the fail-closed boot guards, the asymmetric
`is_deployed()`, the `${VAR:?}` compose injection, `hmac.compare_digest` comparisons, the
credential throttle, container hardening, and the existing per-user `token_version`
revocation epoch are all production-grade and are **not** re-specced.

### [Layer 0 · P0] `config.py` `Settings` — Type the six secrets as `SecretStr`
- **Gap:** All six secret fields (`edge_proxy_secret`, `session_secret`,
  `analyst_signup_code`, `anthropic_api_key`, `openrouter_api_key`, `gemini_api_key`) are
  plain `str`, so any `repr(settings)`, `model_dump()`, or accidental interpolation of the
  Settings object or a field into a log/error emits cleartext.
- **Files / logical blocks:** `caos/server/config.py` → `Settings` (the six secret field
  declarations) and every read site that consumes them:
  `caos/server/routes/auth.py` / `caos/server/identity.py` (`session_secret`),
  `caos/server/main.py` `edge_origin_guard` + `lifespan` guards (`edge_proxy_secret`),
  `engine/llm_client.py` / `engine/openrouter.py` / `engine/gemini.py` (the API keys).
- **Missing safeguard:** type-level redaction that prevents a secret from ever being
  stringified into output.
- **Enterprise pattern:** Pydantic `SecretStr` with explicit `.get_secret_value()` at the
  point of use.
- **Opus instruction:** Retype the six fields to `pydantic.SecretStr` in `Settings`
  (defaults become `SecretStr("")`). At each read site, call `.get_secret_value()` exactly
  where the raw string is needed (SDK client construction, `hmac.compare_digest`, cookie
  signing) — do not store the unwrapped value on a module global. Update the boot guards in
  `main.py` `lifespan` to compare `.get_secret_value()` against the in-source defaults
  (behavior identical). Keep `routes/settings.py` `read_settings` exposing only
  `bool(...)` presence — with `SecretStr`, `bool(SecretStr(""))` is still falsy, so no
  change there. Add no new knob.
- **Latency guard:** `.get_secret_value()` is an attribute read on a cached Settings
  singleton (`get_settings` is `@lru_cache`); no I/O, no measurable cost, and none of these
  reads is per-request beyond the already-present `edge_origin_guard` compare.
- **Verification:** add/extend a unit test asserting `repr(get_settings())` and
  `str(get_settings().session_secret)` contain no cleartext (they render `**********`);
  boot the app in a deployed env and confirm identical behavior; grep the app log after a
  smoke run and confirm no key material appears.

### [Layer 0 · P1] `config.py` — File-based (`*_FILE`) secret injection
- **Gap:** Secrets are sourced only from process env / host `.env`
  (`SettingsConfigDict(env_file=".env")`), so they are visible in every container's
  environment (`docker inspect`, `/proc/<pid>/environ`) and there is no Docker/K8s
  secret-mount path.
- **Files / logical blocks:** `caos/server/config.py` → `Settings` (add a settings source
  / field validator resolving `*_FILE`); `caos/deploy/docker-compose.yml` → the `app` +
  `oauth2-proxy` `environment:` blocks (add sibling `${VAR_FILE:-}` entries beside the
  existing `${VAR:?}` lines); `caos/deploy/.env.example` (document the `_FILE` option).
- **Missing safeguard:** the standard file-based secret convention (read the secret from a
  mounted file path when `<NAME>_FILE` is set), so secrets live in a `0400` mount, not the
  process environment.
- **Enterprise pattern:** Docker/Kubernetes `*_FILE` secret injection (read-secret-from-file
  with env fallback).
- **Opus instruction:** In `Settings`, add a resolution step (a `model_validator(mode=
  "before")` or a small custom settings source) that, for each of the six secrets, checks
  `os.environ.get("<UPPER_NAME>_FILE")`; if set and the file exists, reads and strips its
  contents into the field; otherwise falls back to the existing env/`.env` value. Preserve
  the `${VAR:?}` fail-fast for the non-file path (do not drop the guard). This keeps the
  fail-closed contract: in a deployed env, boot still fails if neither the env var nor the
  `_FILE` target yields a real secret (extend the `lifespan` guards to treat a
  `_FILE`-that-does-not-resolve as empty). No behavior change when `_FILE` is unset. Add no
  request-path code.
- **Latency guard:** file reads happen once, at `Settings` construction (import/boot),
  under `@lru_cache`; never on the request path.
- **Verification:** set `SESSION_SECRET_FILE=/run/secrets/session_secret` with a file and
  an empty `SESSION_SECRET`, boot, and confirm the app reads the file value and cookies
  verify; unset both in a deployed env and confirm boot fails closed.

### [Layer 0 · P1] `identity.py` — Dual-key `session_secret` rotation window
- **Gap:** The `caos_analyst` cookie is signed and verified with a single
  `session_secret`, so rotating `SESSION_SECRET` instantly invalidates every live analyst
  cookie — rotation is a forced fleet-wide re-login, which operationally means secrets are
  never rotated.
- **Files / logical blocks:** `caos/server/identity.py` → `make_session_token`
  (sign) / `read_session_token` (verify); `caos/server/config.py` → `Settings` (add a
  previous-key field); call sites `caos/server/routes/auth.py` `_set_cookie` / `logout`
  stay unchanged.
- **Missing safeguard:** an accepted-previous-key list on the verify side so a new key can
  be introduced while the old key's cookies still validate for a grace window.
- **Enterprise pattern:** dual-key (key-overlap) secret rotation — sign with the current
  key, verify against `{current} ∪ {previous}`.
- **Opus instruction:** Add `session_secret_previous: SecretStr = SecretStr("")` to
  `Settings`. In `read_session_token`, after the current-key HMAC check fails, if
  `session_secret_previous` is non-empty, retry the verify against it (constant-time
  compare, same `token_version`/`exp` checks); accept if it matches. `make_session_token`
  always signs with the current `session_secret` only. Do not weaken the existing
  `token_version` revocation epoch or the hard `exp` — both still apply to previous-key
  tokens. Document that `session_secret_previous` is set to the outgoing key for one
  session-lifetime window (168h) during a rotation, then cleared.
- **Latency guard:** the previous-key path executes only when the current-key verify
  fails (already the miss path); it adds at most one extra in-memory HMAC compare, no I/O,
  and never runs on the common valid-cookie case.
- **Verification:** sign a token with key A, set `session_secret=B`,
  `session_secret_previous=A`, and confirm the token still validates; clear
  `session_secret_previous` and confirm it is rejected; confirm a token signed with B
  validates throughout.

### [Layer 0 · P1] `config.py` + `main.py` `lifespan` — Boot-time flag-prerequisite audit
- **Gap:** A feature flag enabled without its required key (`rerank_enabled`,
  `council_enabled`, `council_cross_model`, `debate_enabled`, `advisor_enabled`,
  `vault_export_auto` vs `anthropic_api_key`/`openrouter_api_key`/`gemini_api_key`/
  `vault_export_dir`) silently degrades to the deterministic fixture/passthrough path at
  runtime, so an operator believes a live lane is active when it is not.
- **Files / logical blocks:** `caos/server/config.py` → new `Settings.audit_flag_
  prerequisites()` method (returns a list of `(flag, missing_key)` findings);
  `caos/server/main.py` → `lifespan` (call it at boot, beside the existing fail-closed
  guards); the flag/key pairings currently implicit in `engine/council.py` `get_reviewer`,
  `engine/rerank.py`, `engine/synth.py` advisor, `deepresearch.py`.
- **Missing safeguard:** a single boot-time reconciliation of every flag against its key,
  surfaced as one structured warning line, so silent degradation is visible.
- **Enterprise pattern:** configuration validation / fail-loud-on-misconfiguration at
  startup (warn, do not block — the degrade-to-safe runtime contract is intentional and
  must be preserved).
- **Opus instruction:** Add `audit_flag_prerequisites()` to `Settings` returning the list
  of enabled-flag-without-key pairs (encode the pairings in one dict). In `lifespan`, after
  the existing guards, call it and, for each finding, emit **one structured WARNING** on the
  `caos` logger (`event="flag_prerequisite_missing", flag=..., missing_key=...`). Do
  **not** raise — flipping this to fail-closed would break the degrade-to-safe behavior
  (boundary 2). Hang the check on `is_deployed()` only for log severity if desired, but
  emit in all envs. Add no knob.
- **Latency guard:** runs once at boot; never on the request path.
- **Verification:** set `council_enabled=true` with no `anthropic_api_key`, boot, and grep
  the log for one `flag_prerequisite_missing` line naming `council_enabled`; confirm the app
  still boots and the council lane still degrades to `FixtureReviewer` (behavior unchanged).

### [Layer 0 · P2] `caos/docs/` — Secret rotation runbook + multi-replica constraint
- **Gap:** There is no documented rotation procedure, and the real constraint that
  `session_secret`/`edge_proxy_secret` must match across any future replicas (and that
  `get_settings` is `@lru_cache`, so any rotation needs a process restart) is undocumented.
- **Files / logical blocks:** new `caos/docs/SECRET_ROTATION.md`; cross-link from
  `caos/docs/LAUNCH_PHASE1.md` (the pilot runbook the `log_unhandled` comment references).
- **Missing safeguard:** an operator-followable rotation runbook (the human half of
  rotatability the type/flag/dual-key items enable).
- **Enterprise pattern:** documented key-rotation procedure with an overlap window.
- **Opus instruction:** Write `SECRET_ROTATION.md` covering, per secret: where it is
  injected (env or `*_FILE`), the rotation steps, and the blast radius. For
  `session_secret`, document the dual-key window (set `session_secret_previous` to the
  outgoing key, deploy, wait one cookie lifetime, clear it). State that rotation requires a
  process restart (`@lru_cache`) and that `session_secret`/`edge_proxy_secret` must be
  identical across replicas if the single-replica model is ever scaled. No code.
- **Latency guard:** documentation only; no runtime effect.
- **Verification:** the runbook exists and a dry-run rotation of `session_secret` on a
  staging stack keeps existing sessions valid across the overlap window.

> Checkpoint L0: 5 pass, 0 revise — fresh-context verifier confirmed all cited blocks real against live code (six plain-`str` secrets, `lifespan` guards + `edge_origin_guard`, `identity.py` session-token functions, the council/rerank/synth/deepresearch flag gates, the compose `environment:` blocks, `.env.example`, `LAUNCH_PHASE1.md`); `SECRET_ROTATION.md` genuinely absent; no re-spec of strong posture; no latency regressions (every mechanism is once-at-boot or a miss-path in-memory HMAC compare).

---

## Layer 1 — Observability Substrate

**Outcome:** every app log line becomes single-line JSON carrying a correlation ID, and a
request ID minted (or honored) at the edge threads through the access log, the app log, and
— via the existing `run_id` ContextVar mechanism — the LLM trace lines a request spawns.
This is the grammar Layers 2, 5, and 6 hang their logs, spans, and metric labels on, so it
precedes all instrumentation. The strong posture is preserved and extended, not replaced:
the `caos.access` and `caos.llm` structured streams, `sanitize_field`, `log_unhandled`, and
the `_run_id_var`/`trace_llm`/`LLMCallRecord` ledger keep emitting exactly what they emit
today — this layer adds a formatter and a correlation field around them.

### [Layer 1 · P0] `main.py` — Replace `basicConfig` with a single-line JSON formatter
- **Gap:** The only root logging config is `logging.basicConfig(level=logging.INFO)` with no
  formatter/handler, so every `caos.*` line except the two JSON payload streams renders as
  plain-text `LEVEL:logger:msg` — unparseable without a `sed` prefix strip and unjoinable to
  the structured streams.
- **Files / logical blocks:** `caos/server/main.py` → the module-scope
  `logging.basicConfig(...)` call; a new small module `caos/server/logging_config.py`
  (formatter + `configure_logging()`); the emit sites are untouched (`access_log.py`
  `access_event`, `engine/budget.py` `trace_llm`, all `caos.*` `logger.*` calls).
- **Missing safeguard:** structured (JSON) formatting of the whole app log stream, so
  100% of output is machine-parseable on one line.
- **Enterprise pattern:** structured logging via a stdlib `logging.Formatter` subclass
  (no new dependency — a JSON formatter is a few lines over `logging`).
- **Opus instruction:** Create `logging_config.py` with a `JsonFormatter(logging.Formatter)`
  whose `format()` builds a dict `{ts (UTC ISO Z), level, logger, msg, request_id, run_id}`
  and `json.dumps`es it; pull `request_id`/`run_id` from the ContextVars (next item) via
  `.get()` (both default `None`). Critically, the two streams that already emit JSON
  (`caos.access`, `caos.llm`) pass a `json.dumps(...)` string as `msg` — the formatter must
  keep these single-line and machine-parseable: detect a dict/JSON `msg` (or route those two
  loggers through a passthrough that merges the correlation fields into their existing
  payload) so the output is one JSON object, not JSON-in-a-string. Add
  `configure_logging()` that installs a single `StreamHandler` with `JsonFormatter` on the
  root logger and remove the `basicConfig` call. Preserve level `INFO` and the
  `caos`/`caos.access`/`caos.llm` namespaces. Optionally gate pretty-vs-JSON on
  `is_deployed()` (human-readable in dev, JSON in prod) — but JSON must be the deployed
  default.
- **Latency guard:** formatting already happens synchronously on every `logger.*` call
  today; a JSON formatter is comparable CPU-only string building (no I/O, no network) and
  reads two ContextVars (O(1)). No added blocking on the request path.
- **Verification:** run a smoke request and `docker compose logs app | jq .` — every line
  parses as one JSON object; confirm `caos.access` and `caos.llm` lines are single JSON
  objects (not a JSON string nested in a `msg` field) and still carry all their original
  fields.

### [Layer 1 · P0] `main.py` — Request-ID ContextVar + mint/honor middleware
- **Gap:** No middleware reads or mints an `X-Request-Id`; there is no request-scoped
  ContextVar; nothing joins an inbound HTTP request to the executor work and LLM calls it
  spawns (the only correlation is `run_id`, which is `None` for run-less lanes).
- **Files / logical blocks:** `caos/server/main.py` → the `access_log` middleware (the
  natural mint/ingest point — it already wraps every `/api` request and times it) and the
  `security_headers` middleware (the response-echo point); a new `_request_id_var`
  ContextVar (co-located with logging in `logging_config.py` or `engine/budget.py` beside
  `_run_id_var`).
- **Missing safeguard:** a per-request correlation ID, honored from the edge if present
  else generated, propagated in-process via a ContextVar and echoed on the response.
- **Enterprise pattern:** structured logging with a `contextvars` correlation ID
  (request-scoped, O(1), ASGI-safe).
- **Opus instruction:** Add `_request_id_var: ContextVar[str | None] = ContextVar(
  "caos_request_id", default=None)`. In the `access_log` middleware, mint/honor the id
  **before the existing non-`/api` early-return** (so *every* request — static assets
  included — carries it and gets a response header): read
  `request.headers.get("X-Request-Id")`; if absent or malformed, generate `uuid4().hex`;
  `sanitize_field` it (reuse the existing helper — the edge value is attacker-influenced);
  set the ContextVar (keep the token to reset in a `finally`) and stash on
  `request.state.request_id`; then let the existing early-return stand so only `/api`
  requests are *logged* while all requests carry the id. Pass it into `access_event` on the
  `/api` path (next item). In `security_headers` (which runs on **all** paths, including
  static assets, and closer to the route than `access_log`), echo **defensively**:
  `rid = getattr(request.state, "request_id", None)` then
  `if rid: response.headers.setdefault("X-Request-Id", rid)` — never reference an unset
  `request.state.request_id` directly, because Python evaluates the `setdefault` argument
  eagerly and an unset attribute would raise `AttributeError` → 500 on any response whose
  request bypassed the mint. The formatter (previous item) already emits the id on every log
  line. Do not add any I/O.
- **Latency guard:** a header read, a `uuid4().hex` (microseconds), a `sanitize_field`, and
  a ContextVar set — all in-memory O(1), no lock, no I/O; runs in the already-present
  `access_log` middleware, adding no new middleware pass.
- **Verification:** send a request with `X-Request-Id: test123` and confirm the response
  echoes it and every log line for that request carries `request_id=test123`; send one
  without the header and confirm a generated hex id appears consistently across that
  request's `caos`, `caos.access`, and `caos.llm` lines.

### [Layer 1 · P1] `access_log.py` — Add the correlation field to `access_event`
- **Gap:** The `caos.access` record has no `request_id`, so an access line cannot be joined
  to the `caos.llm` / executor work it triggered.
- **Files / logical blocks:** `caos/server/access_log.py` → `access_event` (add a
  `request_id` parameter/field); `caos/server/main.py` → the `access_log` middleware call
  site passes `request.state.request_id`.
- **Missing safeguard:** the request-ID field on the structured access record — the join
  key between the HTTP arc and everything downstream.
- **Enterprise pattern:** correlation-ID propagation into the structured access log.
- **Opus instruction:** Add `request_id: str | None = None` to `access_event` and include
  it in the returned dict (beside `entity`/`action`/`status`). Pass
  `request.state.request_id` from the middleware. `access_event` stays a pure, unit-testable
  function; no middleware coupling. Preserve all existing fields and `sanitize_field` on
  identity-derived fields.
- **Latency guard:** one dict-key addition to a function already called once per request;
  no I/O.
- **Verification:** unit-test `access_event(..., request_id="abc")` returns a dict with
  `request_id == "abc"`; live-check a `caos.access` line carries the same id as its request's
  `caos.llm` lines.

### [Layer 1 · P1] `engine/budget.py` — Emit `request_id` on `trace_llm` for run-less lanes
- **Gap:** `trace_llm` stamps only `run_id` (from `_run_id_var`), which is `None` for the
  run-less lanes (issuer chat, deep research, NL query, scenario, report synthesis) — so
  their LLM calls and `LLMCallRecord` rows carry no correlation key at all.
- **Files / logical blocks:** `caos/server/engine/budget.py` → `trace_llm` (read and emit
  `_request_id_var`) and the `LLMCallRecord` insert; the ContextVar is set by the Layer 1
  middleware for the request arc, and Layer 5 threads it/`run_id` into the executors for the
  background arc.
- **Missing safeguard:** a correlation key on run-less LLM telemetry.
- **Enterprise pattern:** unified correlation — one join key present on every telemetry
  record regardless of lane.
- **Opus instruction:** In `trace_llm`, read `_request_id_var.get()` and add `request_id`
  to the emitted `caos.llm` JSON and (as a nullable column) to the `LLMCallRecord` insert.
  This is the substrate change only; the executor-side threading that populates the
  ContextVar for background lanes is Layer 5. Keep the emit best-effort (a trace must never
  fail an inference — the existing guard stays).
- **Latency guard:** one ContextVar read added to a function that already builds and emits
  the trace; no I/O beyond the `LLMCallRecord` write that already happens.
- **Verification:** after Layer 5 wiring, trigger a deep-research job and confirm its
  `caos.llm` lines and `LLMCallRecord` rows carry a non-null `request_id`; before Layer 5,
  confirm an interactive issuer-chat LLM call carries the request's `request_id`.

### [Layer 1 · P2] `main.py` `log_unhandled` — Echo the correlation ID on 500s
- **Gap:** The `log_unhandled` 500 response body is `{"detail": "Internal Server Error"}`
  with no correlation id, so a user-reported error cannot be traced to its log line.
- **Files / logical blocks:** `caos/server/main.py` → `log_unhandled` (the
  `logger.exception` call context and the `JSONResponse` body).
- **Missing safeguard:** the request ID in both the error log context and the client-facing
  500 body, closing the user-report→log-line loop.
- **Enterprise pattern:** correlation-ID surfacing in error responses (support-traceable
  errors).
- **Opus instruction:** In `log_unhandled`, include `request_id=_request_id_var.get()` in
  the `logger.exception` structured context and add `"request_id": <id>` to the 500
  `JSONResponse` body. Preserve the clean generic `detail` (no internal leakage). Set the
  `X-Request-Id` response header here too (the `security_headers` middleware may not run on
  an exception path).
- **Latency guard:** executes only on the 500 error path, never on the success path.
- **Verification:** force an unhandled exception and confirm the 500 body carries a
  `request_id` that matches the `logger.exception` line for that request.

> Checkpoint L1: 5 pass, 1 revised → reconciled — verifier confirmed `basicConfig`,
> `access_log`/`security_headers`/`log_unhandled`, `access_event`, and
> `trace_llm`+`LLMCallRecord` all real and the gaps genuinely absent. **REVISE reconciled:**
> the request-ID middleware now mints the id *before* the `access_log` non-`/api`
> early-return and echoes defensively via `getattr` in `security_headers`, closing the
> `AttributeError`→500-on-static-assets bug the verifier found. No latency regressions.

---

## Layer 2 — Network & Edge

**Outcome:** the correlation ID is minted at the true edge (Caddy) so it spans the whole
ingress chain, the auth proxy and TLS edge gain the readiness signals the rest of the stack
already has, and a DB blip stops flapping the process's liveness signal. The strong edge
posture is preserved: the Caddy identity-header strip + `X-Edge-Authorization` injection,
the oauth2-proxy identity injection, the `edge_origin_guard` constant-time check, and the
`db`/`clamav` healthchecks are all correct and are **not** re-specced. The app's healthcheck
already lives in the `deploy/Dockerfile` `HEALTHCHECK` instruction — do **not** add a
redundant compose-level app healthcheck.

### [Layer 2 · P1] `Caddyfile` — Originate `X-Request-Id` at the edge
- **Gap:** Caddy's `reverse_proxy` block sets only `header_up X-Edge-Authorization`; no
  request-id/trace header is set upstream or echoed downstream, so correlation cannot begin
  at the true ingress point (Layer 1 mints one only if the edge does not).
- **Files / logical blocks:** `caos/deploy/Caddyfile` → the `reverse_proxy oauth2-proxy:4180`
  block (already carries `header_up X-Edge-Authorization`).
- **Missing safeguard:** an edge-originated correlation ID present on the request before it
  reaches oauth2-proxy and the app, echoed to the client for support correlation.
- **Enterprise pattern:** edge request-ID origination (trace-context entry point at the
  reverse proxy).
- **Opus instruction:** In the `reverse_proxy` block add
  `header_up X-Request-Id "{http.request.uuid}"` (Caddy's built-in per-request UUID
  placeholder) and `header_down X-Request-Id "{http.request.uuid}"` so the client sees it.
  This composes with the Layer 1 middleware, which honors an inbound `X-Request-Id` and only
  generates one when absent — so requests entering via Caddy carry the edge UUID end-to-end,
  and any direct-to-app request still gets an app-generated id. Do not remove the existing
  `header_up X-Edge-Authorization`. Optionally add `X-Request-Id` to the Caddy `log` block
  fields.
- **Latency guard:** Caddy header injection is an in-proxy string operation at the edge, not
  app work; it adds no app-side latency and no I/O.
- **Verification:** `curl -I https://<host>/api/health` and confirm the response carries an
  `X-Request-Id`; confirm the app's `caos.access` line for that request shows the same id
  Caddy generated.

### [Layer 2 · P1] `routes/health.py` — Split liveness from readiness
- **Gap:** The only health route is DB-touching readiness (`Depends(get_db)` + `SELECT 1`,
  503 on DB failure), so a transient DB blip flaps the process's liveness signal and can
  trigger an unnecessary container restart.
- **Files / logical blocks:** `caos/server/routes/health.py` → the `health` endpoint (keep
  as readiness); a new sibling liveness route on the same `APIRouter`; `caos/deploy/
  Dockerfile` → the `HEALTHCHECK` instruction (point liveness vs readiness correctly);
  `caos/deploy/oauth2-proxy.cfg` → `skip_auth_routes` (exempt the new route);
  `caos/server/main.py` → `edge_origin_guard` (its `/api/health` exemption).
- **Missing safeguard:** a DB-free liveness probe (process-up) distinct from the DB-touching
  readiness probe (ready-to-serve), the standard Kubernetes/Docker split.
- **Enterprise pattern:** liveness/readiness separation.
- **Opus instruction:** Add `GET /api/livez` (or `/api/health/live`) on the health router
  with **no** `Depends(get_db)` that returns `200 {"status":"alive"}` unconditionally. Keep
  the existing `/api/health` as readiness (DB `SELECT 1`, 503 on failure, LLM-configured +
  version). Point the `deploy/Dockerfile` `HEALTHCHECK` at **liveness** (`/api/livez`) so a
  DB blip does not kill the container, while compose `depends_on: condition:
  service_healthy` semantics still gate on the container being up; keep readiness for the
  external load-balancer/monitor. Add the new path to oauth2-proxy `skip_auth_routes` (like
  `/api/health`) and to the `edge_origin_guard` exemption (extend the `path != "/api/health"`
  check to also pass the liveness path) so an unauthenticated prober can reach it.
- **Latency guard:** liveness returns a constant with no DB call — strictly cheaper than the
  current readiness probe; it is not on the analyst interactive path.
- **Verification:** stop the `db` container and confirm `/api/livez` still returns 200 while
  `/api/health` returns 503; confirm the container is not restarted by the Dockerfile
  healthcheck during a brief DB outage.

### [Layer 2 · P1] `docker-compose.yml` — Healthchecks for oauth2-proxy and caddy
- **Gap:** Neither `oauth2-proxy` nor `caddy` declares a compose healthcheck, so
  `caddy`'s `depends_on: [oauth2-proxy]` is a plain (start-order-only) edge and the auth
  proxy / TLS edge readiness is never actually probed.
- **Files / logical blocks:** `caos/deploy/docker-compose.yml` → the `oauth2-proxy` and
  `caddy` service blocks and `caddy`'s `depends_on` edge (mirror the `db`/`clamav` pattern).
- **Missing safeguard:** readiness probes on the two ingress-chain services so downstream
  start-up gates on them actually being up.
- **Enterprise pattern:** container healthchecks with `depends_on: condition:
  service_healthy` on the ingress chain.
- **Opus instruction:** Add a `healthcheck:` to `caddy` (image `caddy:2-alpine` — it has a
  shell + `wget`): a `wget`/`nc` check that `:443`/`:80` is bound, with a `start_period` to
  allow ACME cert provisioning (mirror `clamav`'s `start_period: 120s`). For `oauth2-proxy`,
  note that the pinned image (`quay.io/oauth2-proxy/oauth2-proxy:v7.15.3`) is the
  **distroless** variant — no shell, `wget`, `curl`, or `nc`, and the service runs
  `read_only: true` + `cap_drop: ALL` — so an in-container compose `healthcheck` hitting its
  `/ping` endpoint is **not runnable**. Choose one, and do not weaken the container hardening
  silently (boundary 4): **(recommended)** keep the distroless image and add **no**
  oauth2-proxy compose healthcheck — caddy reverse-proxies through oauth2-proxy, so caddy's
  own healthcheck (serving traffic) is the effective chain signal, and the app's Dockerfile
  `HEALTHCHECK` sits behind it; **(alternative, only if a direct oauth2-proxy probe is
  required)** switch oauth2-proxy to the `-alpine` image tag (re-pin the digest under the
  existing `--require-hashes` discipline), add a `/ping` healthcheck, and upgrade caddy's
  `depends_on: [oauth2-proxy]` to `condition: service_healthy` — accepting the small
  attack-surface cost of a shell in the image. Do not add an `app` healthcheck (the Dockerfile
  `HEALTHCHECK` already provides it).
- **Latency guard:** healthchecks run on the container-orchestration clock, entirely off the
  request path.
- **Verification:** recommended path — `docker compose ps` shows `caddy` `healthy`, and
  killing oauth2-proxy makes caddy fail to proxy (surfaced by caddy's healthcheck / 502s);
  `-alpine` alternative — `oauth2-proxy` also reports `healthy` and caddy gates on it via
  `condition: service_healthy`.

> Checkpoint L2: 2 pass, 1 revised → reconciled — Caddy request-id origination and the
> liveness/readiness split verified real. **REVISE reconciled:** the pinned oauth2-proxy image
> is distroless (no shell/`wget`, `read_only`+`cap_drop:ALL`), so a `/ping` compose healthcheck
> is un-runnable; the item now keeps the caddy healthcheck, recommends **no** oauth2-proxy
> healthcheck (preserving the strong container hardening) with the `-alpine` re-pin offered as
> an explicit opt-in tradeoff.

---

## Layer 3 — Data & Persistence

**Outcome:** the Postgres pool becomes explicitly sized against the executor concurrency it
must serve, connections recycle and time out instead of hanging, and a pathological or
lock-blocked query is bounded by a server-side `statement_timeout` rather than pinning a
pooled connection forever. The strong posture is preserved: the `with_for_update(
skip_locked=True)` claim, the lease/`_reap_orphans` model, the boot sweep, the
advisory-lock-serialized migrations (`init_db`, `_MIGRATION_LOCK_KEY`), `pool_pre_ping=True`,
and the SQLite WAL/`busy_timeout` PRAGMAs are all correct and are **not** re-specced. All new
timeout/pool settings are **Postgres-only**, guarded off the existing SQLite dialect branch.

### [Layer 3 · P0] `database.py` — Server-side statement/lock/idle timeouts on Postgres
- **Gap:** No `statement_timeout`, `lock_timeout`, or `idle_in_transaction_session_timeout`
  is set on Postgres (`busy_timeout=5000` is a SQLite-only lock-wait PRAGMA, a no-op on
  Postgres), so a pathological or lock-blocked query can hang a pooled connection
  indefinitely and starve the pool.
- **Files / logical blocks:** `caos/server/database.py` → the `_engine_kwargs` dict and the
  `create_async_engine(settings.database_url, **_engine_kwargs)` call; mirror the existing
  `if settings.database_url.startswith("sqlite")` dialect branch with a Postgres branch.
- **Missing safeguard:** a bounded server-side statement/lock/idle-transaction timeout so no
  single query can hold a connection open without limit.
- **Enterprise pattern:** server-side query timeouts (`statement_timeout` /
  `idle_in_transaction_session_timeout`).
- **Opus instruction:** Add config knobs `caos_db_statement_timeout_ms: int = 30000`
  (rationale: no healthy query — interactive, or per-statement inside a run — approaches 30s;
  a run spends its minutes in Python LLM awaits *between* statements, not in a single SQL
  statement, so a per-statement cap is safe for the executor) and `caos_db_lock_timeout_ms:
  int = 10000`. For Postgres, pass **only these two** pool-wide via asyncpg
  `connect_args={"server_settings": {"statement_timeout": str(ms), "lock_timeout": str(ms)}}`
  on `create_async_engine` (Postgres branch only — asyncpg accepts `server_settings`).
  **Do NOT set `idle_in_transaction_session_timeout` pool-wide.** The run executor
  (`engine/runner.py` `execute_run`) holds one uncommitted transaction open across the entire
  multi-minute DAG (only `session.flush`; the single commit lands later in
  `run_executor.execute_run_by_id`, after `execute_run` returns), so a pool-wide
  idle-in-transaction cap would terminate the executor's connection during every LLM await —
  failing essentially every real run (a cascade, not a degrade). If idle-in-transaction
  defense on the **interactive** path is wanted, add it there only: introduce
  `caos_db_idle_tx_timeout_ms: int = 60000` and issue `SET LOCAL
  idle_in_transaction_session_timeout = <ms>` inside the `get_db` dependency (Postgres only),
  which bounds a stalled *web* request's transaction while leaving the executor's by-design
  long transaction untouched. Leave SQLite untouched.
- **Latency guard:** `statement_timeout`/`lock_timeout` are GUCs applied once at connection
  establishment (connect-time, zero per-request cost); a healthy query runs identically —
  only a runaway query is capped, protecting the pool the interactive path depends on. The
  optional interactive idle-in-transaction guard, if adopted, is a single sub-millisecond
  `SET LOCAL` on the already-open `get_db` connection — never pool-wide, so the executor is
  untouched.
- **Verification:** run `SELECT pg_sleep(35)` through a pooled session and confirm it aborts
  at ~30s with a `statement_timeout` error; run a full multi-minute pipeline end-to-end and
  confirm it completes (the executor's long transaction is **not** killed, proving
  idle-in-transaction is not set pool-wide); confirm normal interactive queries are
  unaffected.

### [Layer 3 · P0] `database.py` — Explicit pool sizing coupled to executor concurrency
- **Gap:** The pool is left at the SQLAlchemy default (5 + 10 overflow) with no explicit
  `pool_size`/`max_overflow`/`pool_timeout`; a code comment (`ponytail: pool size and
  caos_run_concurrency are COUPLED (BE8-1)`) documents the coupling but does not enforce it,
  so raising `caos_run_concurrency` silently risks pool exhaustion and request stalls.
- **Files / logical blocks:** `caos/server/database.py` → the `_engine_kwargs` dict (beside
  the BE8-1 comment); `caos/server/config.py` → new pool knobs;
  `caos/server/run_executor.py` reads `caos_run_concurrency` (the coupling source).
- **Missing safeguard:** an explicitly sized pool derived from the concurrent DB-session
  demand (interactive requests + `caos_run_concurrency` runs + `synth_concurrency` fan-out),
  so the documented coupling is enforced in one place.
- **Enterprise pattern:** connection-pool capacity planning coupled to worker concurrency.
- **Opus instruction:** Add `caos_db_pool_size: int = 0` (0 = auto) and
  `caos_db_max_overflow: int = 5`, `caos_db_pool_timeout_s: float = 30.0` to `config.py`. In
  `database.py`, when `pool_size == 0`, derive it as `caos_run_concurrency +
  synth_concurrency + <interactive headroom, e.g. 4>` (make the formula explicit and replace
  the prose BE8-1 comment with the computed value). Pass `pool_size`, `max_overflow`,
  `pool_timeout` in `_engine_kwargs` for the Postgres branch only (SQLite uses `NullPool`
  under `CAOS_TEST` and a single connection otherwise — leave it). Keep `pool_pre_ping=True`.
- **Latency guard:** pool sizing changes connection availability, not per-request work; under
  normal load a checkout is unchanged, and under high load the explicit `pool_timeout` fails
  fast with a clear error instead of stalling indefinitely.
- **Verification:** boot with `caos_run_concurrency=8` and confirm the logged/introspected
  `pool_size` scales accordingly; drive concurrent runs + reads and confirm no
  `QueuePool limit ... overflow` stalls at the previous default.

### [Layer 3 · P1] `database.py` — Connection recycle, connect timeout, and disconnect classification
- **Gap:** There is no `pool_recycle` (stale connections linger until they fail) and no
  connect timeout; transient-disconnect handling stops at `pool_pre_ping`, so a mid-request
  DB restart surfaces as a hard 500 with no clean degrade.
- **Files / logical blocks:** `caos/server/database.py` → `_engine_kwargs` (add
  `pool_recycle`, connect timeout) and `get_db` (disconnect classification);
  `caos/server/config.py` → new knobs.
- **Missing safeguard:** proactive stale-connection recycling, a bounded connect timeout, and
  a clean retryable response on a transient disconnect instead of an opaque 500.
- **Enterprise pattern:** pool recycling + connect timeout + transient-fault classification
  (map disconnect → 503 retryable, never silently retry a non-idempotent write).
- **Opus instruction:** Add `caos_db_pool_recycle_s: int = 1800` and
  `caos_db_connect_timeout_s: float = 10.0`. Pass `pool_recycle=caos_db_pool_recycle_s` in
  `_engine_kwargs`; pass the connect timeout via asyncpg `connect_args={"timeout": ...}`
  (Postgres branch). In `get_db`, catch `sqlalchemy.exc.DBAPIError` where
  `err.connection_invalidated` (or asyncpg `ConnectionDoesNotExistError`/`InterfaceError`)
  and translate it to a `503` with a `Retry-After` header rather than a 500 — do **not**
  auto-retry inside `get_db` (the request may carry a non-idempotent write; the client or the
  executor lease retries safely). `pool_pre_ping` continues to hand the next request a fresh
  connection. Preserve the existing commit-on-success/rollback-on-exception contract.
- **Latency guard:** recycle and connect-timeout affect connection lifecycle, not
  per-request success-path work; the disconnect classification runs only on the error path
  that is a hard 500 today.
- **Verification:** restart the `db` container mid-load and confirm requests return a clean
  503 (not a 500 traceback) and the next requests succeed on fresh connections; confirm a
  connection older than `pool_recycle` is transparently replaced.

> Checkpoint L3: 2 pass, 1 revised → reconciled — pool sizing and recycle/connect-timeout/
> disconnect-classification verified real. **REVISE reconciled (important):** a pool-wide
> `idle_in_transaction_session_timeout` would terminate the run executor, which holds one
> uncommitted transaction open across the whole multi-minute DAG (idle-in-transaction during
> every LLM await) — failing essentially every run. The item now sets only `statement_timeout`
> + `lock_timeout` pool-wide (per-statement, safe for the executor) and moves any
> idle-in-transaction guard to an interactive-only `get_db` `SET LOCAL`.

---

## Layer 4 — External Integrations (Egress Resilience)

**Outcome:** every egress call — the Anthropic primary (not just its fallback), OpenRouter,
Gemini, and EDGAR — fails fast, retries transient errors with bounded backoff+jitter, and a
circuit breaker sheds load from a downed provider instead of hammering it until each call
times out; EDGAR additionally honors SEC `429`/`Retry-After` and rate-limits safely across
workers. The strong posture is preserved exactly: the existing `_call_with_retry`
(backoff+jitter, `max_retries=3`, gated on `is_overloaded`), the `is_overloaded` classifier
family, per-provider timeouts, the EDGAR SSRF guards, and the fail-open (embeddings/rerank)
vs fail-closed (ClamAV) degrade choices are **not** re-specced or flipped.

**Design decision — retry and breaker implementation (options considered).**
*(a) Reuse `_call_with_retry` + a small hand-rolled in-process breaker (chosen).* The
retry helper already exists with the right policy; a per-process breaker is ~40 lines of
in-memory state (no cross-process coordination needed in a single-process app) and its check
is a dict read (latency-trivial). *(b) `tenacity` (transitive, promotable) for a uniform
retry policy.* Rejected as the primary tool because the LLM path already has a good hand-rolled
retry to reuse (extend-before-add) and EDGAR needs custom `Retry-After` wait logic that
`tenacity`'s `wait_exponential` does not express cleanly; `tenacity` is noted as an available
alternative if Opus prefers library-backed uniformity. *(c) `pybreaker` for the breaker.*
Rejected as a new dependency for what ~40 tested lines cover in-process; named as the drop-in
if a library-backed breaker is preferred. **No new dependency is required for this layer.**

### [Layer 4 · P0] `engine/llm_client.py` — Retry the primary model, not just the fallback
- **Gap:** In `create`, the primary call `await client.messages.create(model=primary,
  **kwargs)` is bare (only the SDK default `max_retries=2`); the hand-rolled
  `_call_with_retry` (backoff+jitter) wraps **only** the post-swap fallback model, so a
  transient `429`/`5xx` on the primary is not app-retried.
- **Files / logical blocks:** `caos/server/engine/llm_client.py` → `create` (the primary
  `try` before the `except`), the nested `_call_with_retry`, and the
  `_create_openrouter`/`_create_gemini` provider branches; the `is_overloaded` classifiers.
- **Missing safeguard:** app-level bounded retry with backoff+jitter on the primary attempt
  for every provider, using the classifier already in place.
- **Enterprise pattern:** exponential backoff with full jitter on transient egress errors.
- **Opus instruction:** Generalize `_call_with_retry` so it wraps the **primary** attempt as
  well as the fallback (it already implements base-1s/max-8s backoff, ±10% jitter,
  `max_retries=3`, gated on `is_overloaded`). Wrap the primary `messages.create` and both the
  `_create_openrouter` and `_create_gemini` provider calls in it so all three providers
  inherit primary-side retry. Preserve the existing one-shot cheaper-model fallback semantics
  after retries are exhausted (note: the Anthropic fallback resolves to
  `fallback_model or s.synth_executor_model`, and OpenRouter/Gemini to
  `fallback_model or s.model_tier_cheap` — this corrects brief §3B, which states
  `model_tier_cheap` for all; keep each provider's actual target). Promote the retry count to
  a knob `caos_llm_max_retries: int = 3`. Emit `retry_count` on the `trace_llm` line.
- **Latency guard:** retry fires **only** on a classified-transient failure (the success path
  is a single attempt, byte-identical to today); backoff sleeps replace what is otherwise an
  immediate hard error. The interactive issuer-chat lane's happy path is unchanged.
- **Verification:** inject a `429` on the first primary attempt (monkeypatch the client) and
  confirm one backoff+retry then success, with a `retry_count=1` on the `caos.llm` line;
  confirm a non-transient error (e.g. 400) does not retry.

### [Layer 4 · P0] `engine/llm_client.py` — Per-provider circuit breaker at the choke-point
- **Gap:** There is no circuit breaker anywhere; a sustained provider outage is hit on every
  call until each individually exhausts retries/timeouts, pinning workers and burning the
  retry budget on a known-dead endpoint.
- **Files / logical blocks:** `caos/server/engine/llm_client.py` → `create` and the
  `_create_openrouter`/`_create_gemini` branches (breaker check + record); a new small
  `_ProviderBreaker` (in `llm_client.py` or a sibling `engine/breaker.py`); the
  `is_overloaded` family (the trip predicate); `engine/budget.py` `trace_llm` (emit breaker
  state).
- **Missing safeguard:** a shared per-provider breaker (closed → open on repeated failure →
  half-open probe) so an open circuit fails fast and sheds queued work instead of hammering a
  downed provider.
- **Enterprise pattern:** circuit breaker (closed / open / half-open) with an in-memory
  per-provider state machine.
- **Opus instruction:** Add a module-level `_ProviderBreaker` keyed by provider
  (`anthropic`/`openrouter`/`gemini`) holding `state`, `consecutive_failures`,
  `opened_at`. At the top of `create` (and the provider branches), read the breaker: if
  `open` and `now - opened_at < caos_llm_breaker_reset_s`, fail fast (raise the existing
  overload error / take the existing fallback path immediately — **preserve current
  degrade**, do not invent a new response). On a call result, record success (reset to
  closed) or an `is_overloaded` failure (increment; open at
  `caos_llm_breaker_fail_threshold`). In `open→half-open` after the reset window, allow one
  probe. Add knobs `caos_llm_breaker_fail_threshold: int = 5` and
  `caos_llm_breaker_reset_s: float = 30.0`. Emit `breaker_state` on the `trace_llm` line.
  Because a whole-provider outage has no cross-provider escape today (fallbacks are
  same-provider), an open breaker should raise the normal overload error so the caller's
  existing degrade (e.g. council → `FixtureReviewer`, deep-research inline swap) engages.
  **Ship a unit self-check** for the state machine (closed→open→half-open→closed).
- **Latency guard:** the breaker check is an in-memory dict/attribute read (nanoseconds), no
  lock on the read path, no I/O; when closed it adds nothing measurable, and when open it
  makes the path *faster* by skipping a doomed network call.
- **Verification:** force `caos_llm_breaker_fail_threshold` consecutive overloads and confirm
  the breaker opens (subsequent calls fail fast with `breaker_state=open` on the trace and no
  network attempt), then half-opens and closes after a success past the reset window.

### [Layer 4 · P1] LLM lanes that bypass `create` — extend retry/breaker coverage
- **Gap:** Three LLM lanes call the SDK directly, bypassing `create`'s retry/fallback/breaker
  entirely: `deepresearch.py` `_final_message` (streamed, inline one-shot model swap, no
  backoff), `research_report.py` `synthesize_research_report` (streamed, no swap and no
  retry), and `engine/synth.py` `_call` (the beta 2-tool advisor via
  `beta.messages.create`). A breaker added only at `create` will not protect these.
- **Files / logical blocks:** `caos/server/deepresearch.py` → `_final_message`;
  `caos/server/research_report.py` → `synthesize_research_report`; `caos/server/engine/
  synth.py` → `_call`.
- **Missing safeguard:** the same bounded retry + breaker consultation on the three
  streamed/beta lanes that already funnel their accounting through `budget.trace_llm`.
- **Enterprise pattern:** consistent egress-resilience coverage across all call sites (no
  unguarded bypass of the resilience choke-point).
- **Opus instruction:** For each of the three lanes, wrap the streamed/`beta` create in the
  generalized `_call_with_retry` (or a thin shared helper exposing the same policy) and add
  the breaker success/failure record + pre-check keyed on the lane's provider. Preserve each
  lane's existing behavior: `deepresearch`'s inline model swap stays as the post-retry
  fallback; `research_report`'s forced-tool streamed shape is unchanged on success;
  `synth._call`'s beta path and its `trace_llm` accrual are unchanged. Do not reroute these
  through `create` if that would alter their streaming/tool semantics — instead share the
  retry/breaker helper. These are all off-request background lanes (deep research and report
  synthesis run in executors; the synth advisor runs inside a run), so retry latency is not
  on an interactive read.
- **Latency guard:** all three run in background executors, not on the interactive `/api`
  read path; retry activates only on transient failure, and the breaker check is an in-memory
  read.
- **Verification:** inject an overload into each lane and confirm a backoff+retry (not an
  immediate abort) and a breaker record; confirm the success path output is byte-identical to
  today (compare a golden run).

### [Layer 4 · P0] `edgar.py` — Retry with `Retry-After` honoring at `_http_get`
- **Gap:** `_http_get` turns any `HTTPError` (including `429` and `5xx`) straight into
  `EdgarError` with no retry and without reading `Retry-After`, and a transient
  `URLError`/`TimeoutError` raises immediately — on idempotent GETs that funnel every EDGAR
  call.
- **Files / logical blocks:** `caos/server/edgar.py` → `_http_get` (the `except
  urllib.error.HTTPError` and `except (URLError, TimeoutError, OSError)` handlers) — the
  single choke-point all EDGAR traffic (including `engine/edgar_cp1.py` via `_get_json`)
  funnels through; `caos/server/config.py` → new knobs.
- **Missing safeguard:** a bounded retry loop honoring `429`/`503` `Retry-After` with capped
  exponential backoff on transient errors for these idempotent GETs.
- **Enterprise pattern:** retry with server-directed backoff (`Retry-After`) + capped
  exponential backoff with jitter.
- **Opus instruction:** Wrap the `urlopen` call in `_http_get` in a bounded retry loop
  (hand-rolled — `Retry-After` needs custom wait logic; ~15 lines). On `HTTPError` with
  status `429`/`503`, read `exc.headers.get("Retry-After")` (seconds or HTTP-date), sleep
  `min(retry_after, caos_edgar_retry_after_cap_s)`, and retry up to `caos_edgar_max_retries`;
  on `URLError`/`TimeoutError`/`5xx`, sleep `caos_edgar_backoff_base_s * 2**attempt` with
  jitter and retry; on non-retryable statuses (e.g. `403`/`404`) raise `EdgarError`
  immediately as today. Add knobs `caos_edgar_max_retries: int = 3`,
  `caos_edgar_backoff_base_s: float = 0.5`, `caos_edgar_retry_after_cap_s: float = 60.0`.
  Preserve the post-redirect `.sec.gov` host re-check and the generic `EdgarError` mapping
  (no raw network text leakage). `edgar_cp1.fetch_cp1`'s outer return-None degrade stays as
  the final fault isolation. Note `_http_get` is synchronous (`urllib`) and is called from
  the CP-1/covenant lanes off the interactive read path.
- **Latency guard:** `_http_get` runs in the EDGAR ingestion/CP-1 lanes (background/run
  work), not on an interactive analyst read; retry sleeps occur only on a transient failure
  that is a hard error today.
- **Verification:** stub the SEC endpoint to return `429` with `Retry-After: 1` then `200`,
  and confirm one honored wait then success; stub a `404` and confirm an immediate
  `EdgarError` with no retry.

### [Layer 4 · P1] `edgar.py` — Cross-process-safe DB-backed token-bucket rate limit
- **Gap:** The EDGAR rate limit is an in-process `threading.Lock` + fixed `_MIN_INTERVAL_S`
  (0.15s) spacer (`_rate_lock`/`_last_request`) — a per-process spacer, not a token bucket, so
  multiple workers/replicas each independently issue at ~6.6 req/s and can collectively breach
  SEC fair-access and get `429`'d (the `routes/edgar.py` comment already notes the throttle is
  "global, not per-user" — but only within one process).
- **Files / logical blocks:** `caos/server/edgar.py` → the `_rate_lock`/`_MIN_INTERVAL_S`/
  `_last_request` throttle block in `_http_get` (sync); a new `edgar_rate_bucket` table + a
  migration in `caos/server/database.py` (+ alembic); a new async limiter coroutine (in
  `edgar.py` or a small `engine/ratelimit.py`) using `AsyncSessionLocal`; `caos/server/main.py`
  → `lifespan` (capture the running event loop for the cross-thread bridge); `caos/server/
  config.py` → knobs. **Grounded invocation:** `_http_get` is synchronous and reached **only
  from threadpool threads** — `engine/runner.py` `execute_run` calls
  `await asyncio.to_thread(edgar_cp1.fetch_cp1, ...)` and `routes/edgar.py` calls
  `await run_in_threadpool(edgar.search/list_filings/list_exhibits/fetch_exhibit, ...)` — never
  directly on the event loop; and the app has only an async DB driver (`asyncpg`/`aiosqlite`,
  no sync driver). This is what makes the design below buildable.
- **Missing safeguard:** a token-bucket rate limiter whose state is shared across
  workers/replicas (SEC fair-access is a global budget, not a per-process one).
- **Enterprise pattern:** distributed token-bucket rate limiter backed by a shared store (a
  Postgres row under `SELECT … FOR UPDATE`), invoked from sync code via a cross-thread
  coroutine bridge.
- **Opus instruction:** Model the bucket as one **singleton** `edgar_rate_bucket` row (`tokens: float`,
  `updated_at`) in Postgres (add the table + a migration that **seeds the single row** at
  full `tokens = caos_edgar_burst`; the limiter must also idempotently upsert it —
  `INSERT … ON CONFLICT DO NOTHING` — before the first `SELECT … FOR UPDATE`, or an empty
  table has no row to lock and the limiter never paces). Write an **async**
  limiter `acquire_edgar_token()` that opens a short `AsyncSessionLocal`, `SELECT … FOR UPDATE`
  the row, refills `tokens = min(caos_edgar_burst, tokens + caos_edgar_rate_per_s * Δt)`, and
  either consumes one token (return `0.0`) or returns the wait `= (1 - tokens)/rate`; commit
  under the row lock so concurrent workers/replicas serialize on it. In sync `_http_get`,
  invoke it across threads: capture the main loop in `main.py` `lifespan` and store it on the
  **neutral limiter module** (`engine/ratelimit.py`, e.g. `ratelimit.set_loop(
  asyncio.get_running_loop())`) that both `main.py` and `edgar.py` import — do **not** store
  the handle in `main.py` and import it from `edgar.py` (that is a circular import, since
  `main` → `routes` → `edgar`); `edgar.py` reads the loop from `ratelimit`. In `_http_get`, if
  `asyncio.get_running_loop()` **raises** (we are on a threadpool thread — the real path), call
  `asyncio.run_coroutine_threadsafe(acquire_edgar_token(), loop).result(timeout=…)`, sleeping
  the returned wait then retrying; if it **succeeds** (called on the loop thread — not a path
  today, a future-misuse guard) or the loop/DB is unavailable or the bridge times out, **fall
  back to the in-process token bucket** (a module-level bucket under the existing `_rate_lock`,
  sized by the same knobs, with `_MIN_INTERVAL_S` as the floor). Add knobs
  `caos_edgar_rate_per_s: float = 8.0` and `caos_edgar_burst: int = 5`. On SQLite (dev/test)
  the deployment is single-process, so short-circuit to the in-process bucket. This reuses the
  existing async engine — **no new dependency** (do not add a sync driver; the threadpool→loop
  bridge is exactly why none is needed). Note the limiter holds a pooled connection while
  blocked on the row lock, so its (low) concurrency counts toward the Layer 3 pool sizing —
  keep `pool_size` coupled to `caos_run_concurrency` and do not raise concurrency without
  resizing the pool (per Layer 3). This resolves brief §3B's cross-process requirement on
  the real, single-node substrate.
- **Latency guard:** `_http_get` runs only in threadpool threads (both the CP-1/ingestion lane
  and the `/api/edgar` routes already `to_thread`/`run_in_threadpool` it), so blocking on the
  bridge blocks a **worker thread, never the event loop**; the limiter coroutine is a single
  sub-millisecond `SELECT … FOR UPDATE` on one local row, negligible against the SEC network
  fetch it gates, and the `.result(timeout=…)` bound plus in-process fallback guarantees a
  saturated loop can never hard-stall EDGAR. No interactive read is on this path (the edgar
  routes are already off-loop).
- **Verification:** run **two** worker processes/replicas issuing EDGAR fetches concurrently
  and confirm the **aggregate** rate stays at/under `caos_edgar_rate_per_s` (not per-process),
  proving the shared bucket; kill the DB and confirm `_http_get` falls back to the in-process
  bucket (paces, does not error); confirm no event-loop deadlock when called from the
  `to_thread` CP-1 path.

### [Layer 4 · P2] `edgar.py` — Structured egress logging for the SEC lane
- **Gap:** `edgar.py` has no logging import at all, so EDGAR egress emits no structured
  line, latency, or status — a failure is visible only as a chained traceback at the raise
  site, and there is no correlation id on outbound SEC calls.
- **Files / logical blocks:** `caos/server/edgar.py` → `_http_get` (add a `caos.edgar`
  logger emitting one structured line per fetch); it inherits the Layer 1 `request_id`/
  `run_id` ContextVars automatically via the JSON formatter.
- **Missing safeguard:** a structured per-fetch log line (url, status, `dur_ms`, retry_count)
  for the SEC lane, matching the `caos.access`/`caos.llm` streams.
- **Enterprise pattern:** structured egress logging on the shared correlation substrate.
- **Opus instruction:** Add `logger = logging.getLogger("caos.edgar")` and emit one line per
  `_http_get` on completion/failure with `{event:"edgar_fetch", host, path, status, dur_ms,
  retry_count}` (the JSON formatter adds `request_id`/`run_id`). Keep it best-effort (a log
  must never fail a fetch). Do not log full query strings if they could carry sensitive
  identifiers (they do not for EDGAR, but keep to host+path).
- **Latency guard:** one in-memory log emit per fetch on the background ingestion lane; no
  request-path effect.
- **Verification:** trigger a CP-1 EDGAR fetch and confirm one `caos.edgar` JSON line with
  `status` and `dur_ms`, carrying the run's `run_id`.

> Checkpoint L4: 5 pass, 1 revised → reconciled, then upgraded per operator direction —
> primary-model retry, per-provider breaker, the three bypass lanes, EDGAR `Retry-After`
> retry, and EDGAR structured logging verified real. The rate-limit item's first REVISE (it
> cited the async-only `engine/locks.py`, un-`await`able from the sync `_http_get`) is fully
> resolved: **at operator direction the item now mandates a genuine cross-process limiter** —
> a shared Postgres `edgar_rate_bucket` row under `SELECT … FOR UPDATE`, driven by an async
> limiter coroutine invoked from the sync `_http_get` via `run_coroutine_threadsafe` onto the
> captured main loop, with an in-process bucket fallback. Verified against live code by a
> full read-based adversarial pass (independent subagent spawn was blocked by a transient
> `opus-4-8` classifier outage; the six checks were performed directly instead): (1) `_http_get`
> is a sync `def` and the exact throttle block cited (`with _rate_lock` → `time.sleep` →
> `_last_request`) exists as described; (2) every EDGAR path is off-loop (`runner.py`
> `to_thread(fetch_cp1)`; `routes/edgar.py` `run_in_threadpool(...)`; `reported_cp1` makes no
> EDGAR HTTP call), so the bridge cannot deadlock — the loop is free while the threadpool thread
> blocks on `.result()`, and the on-loop guard covers any future misuse; (3) only async DB
> drivers are present, so the bridge adds **no** dependency; (4) `AsyncSessionLocal` exists and
> the loop is capturable in the async `lifespan`, with the circular-import hazard resolved via
> the neutral `engine/ratelimit.py`; (5) no event-loop-thread path gains a blocking call; (6)
> the `SELECT … FOR UPDATE` row genuinely serializes concurrent workers, the refill math is
> standard, and limiter sessions are short-held (sub-ms) at low EDGAR concurrency, so pool
> pressure is negligible. Cross-process safety genuinely achieved. **Independent fresh-context
> verifier (run once the classifier recovered): PASS** — same six checks, cross-process
> achieved, no latency regression; it added two non-blocking caveats now folded in (the
> migration must seed the singleton row so the first `FOR UPDATE` has a row to lock; the
> limiter's pooled-connection hold counts toward the Layer 3 pool↔`caos_run_concurrency`
> coupling).

---

## Layer 5 — Application Logic & Async Execution

**Outcome:** the autonomous pipelines become observable end-to-end — a structured span marks
each run's start and finish keyed on the existing `run_id`, a healthy claim→start is no
longer silent, the three run-less lanes finally carry a correlation key, the enqueue boundary
persists the request ID onto the run so the HTTP arc joins the run arc, and a hung task is
distinguishable from a crashed one. The strong posture is preserved: the loud
`logger.exception` failure paths, the never-strand `_mark_run_failed`/`_mark_failed` guards,
the `CancelledError` handling, the lease/`_reap_orphans` recovery, and the boot sweep are all
correct and are **not** re-specced. This layer threads the Layer 1 substrate through the
executors; it is where the observability grammar meets the background work.

**Design decision — tracing backend (options considered).**
*(a) Span-shaped structured log events on the Layer 1 substrate (chosen).* Emit
`run.started`/`run.finished` (and per-module) events on a `caos.run` logger keyed on
`run_id` + `request_id`; the existing `caos.llm` lines (already keyed on `run_id`) are the
child spans. Zero new dependency, zero added latency, and an operator reconstructs the
request→executor→LLM arc from the log stream — which satisfies the scorecard's tracing floor
("a trace spans the arc for the autonomous pipeline runs, keyed on `run_id`"). *(b)
OpenTelemetry SDK + a local collector.* Real distributed spans, but it needs the
`opentelemetry-sdk`/exporter dependencies and a collector service; specified as an **opt-in**
upgrade (P2) behind a flag + compose profile, disabled by default so it costs nothing when
absent. *(c) A dedicated tracing SaaS.* Rejected — violates no-paid-services.

### [Layer 5 · P1] `engine/runner.py` — Run span events at the `execute_run` boundary
- **Gap:** `execute_run` calls `budget.set_run_id(run.id)` (the natural root-span key) but
  the run boundary itself writes only `run.status` transitions to the DB — it emits no
  `run.started`/`run.finished` span line (no start ts, module count, duration, or terminal
  gate roll-up) on the log stream.
- **Files / logical blocks:** `caos/server/engine/runner.py` → `execute_run` (right after
  `budget.set_run_id(run.id)` and at terminal state); a `caos.run` logger; the existing
  `caos.llm` lines are the child spans.
- **Missing safeguard:** structured span events bounding each run, keyed on `run_id` +
  `request_id`, so the whole run arc is reconstructable from logs.
- **Enterprise pattern:** span-per-unit-of-work emitted as structured events (log-based
  tracing on the correlation substrate).
- **Opus instruction:** Emit `run.started` on `caos.run` at the top of `execute_run`
  (`{event:"run.started", run_id, request_id, issuer_id, module_count, model_mode}`) and
  `run.finished` at terminal state (`{event:"run.finished", run_id, status, dur_ms,
  modules_ok, modules_failed, terminal_gate}`). Reuse the `_run_id_var`/`_request_id_var`
  ContextVars (the formatter adds them, but include `run_id` explicitly in the payload for
  self-containment). Do not change run status/DB writes or analytical output. This is the
  log-based tracing choice; see the opt-in OTel item for the richer alternative.
- **Latency guard:** two in-memory log emits per run (start/finish) on the background
  executor path; nothing on the interactive request path.
- **Verification:** trigger a run and grep `caos.run` for a `run.started`/`run.finished` pair
  sharing the `run_id`, with `dur_ms` and module counts; confirm the run's `caos.llm` lines
  carry the same `run_id`.

### [Layer 5 · P1] Executors — Log the happy-path claim→start
- **Gap:** A healthy claim→start writes only DB columns (`claimed_at`/`status`/`worker_id`)
  across all four executors; nothing is logged on success, so a successfully-started job is
  invisible in the log stream (only failures surface).
- **Files / logical blocks:** `caos/server/run_executor.py` → `QueueWorker._claim_one` /
  `InProcessExecutor` enqueue; `caos/server/engine/pipeline_executor.py` → `claim_next_job`;
  `caos/server/research_executor.py` → `_run_research`; `caos/server/
  research_report_executor.py` → `_run_report`.
- **Missing safeguard:** a structured claim/start line at the single choke-point where status
  flips to running, so an operator sees jobs starting, not only failing.
- **Enterprise pattern:** lifecycle logging (job accepted/started) on the shared substrate.
- **Opus instruction:** At each executor's claim→start choke-point emit one structured line
  (`{event:"job.started", kind:"run|research|pipeline|report", id, worker_id, request_id,
  attempt}`) on the `caos` (or `caos.run`) logger. Keep it a single info line; the existing
  failure/cancel logging is unchanged. Pull `request_id`/`run_id` from ContextVars (set by
  the next item for the background lanes).
- **Latency guard:** one in-memory log emit at claim time on the background executor loop; no
  request-path effect.
- **Verification:** enqueue one job of each kind and confirm a `job.started` line per kind
  with its `worker_id` and `attempt`.

### [Layer 5 · P1] Run-less lanes — Set the correlation key so telemetry joins
- **Gap:** `budget.set_run_id` is called **only** in `runner.execute_run`, so the deep
  research, pipeline, and report lanes emit `caos.llm` lines and `LLMCallRecord` rows with
  `run_id=None` — they have no correlation key at all.
- **Files / logical blocks:** `caos/server/engine/budget.py` → generalize
  `set_run_id`/`_run_id_var` (or add a paired `set_request_id`/`_request_id_var` from Layer
  1); `caos/server/research_executor.py` → `_run_research`; `caos/server/engine/
  pipeline_executor.py` → `execute_job`; `caos/server/research_report_executor.py` →
  `_run_report`.
- **Missing safeguard:** a correlation key (job id and/or the originating request id) set at
  the top of each run-less lane so its LLM telemetry is joinable.
- **Enterprise pattern:** uniform correlation propagation across all async lanes.
- **Opus instruction:** Set the correlation ContextVars at the top of `_run_research`,
  `execute_job`, and `_run_report` — bind `run_id` to the job/report id (so `trace_llm`
  stamps it) and, where the originating request persisted a `request_id` (next item), bind
  that too. Reset the ContextVar tokens in a `finally`. The emit site (`trace_llm`) is
  unchanged; this only populates the key it already reads. Do not alter analytical behavior.
- **Latency guard:** two ContextVar sets per job on the background executor path; no
  request-path effect.
- **Verification:** run a deep-research job and confirm its `caos.llm` lines and
  `LLMCallRecord` rows now carry a non-null `run_id`/`request_id` (were `None` before).

### [Layer 5 · P1] `routes/runs.py` + `database.py` — Persist `request_id` onto the run
- **Gap:** The `Run` row carries no `request_id`, and `access_event` logs none, so the
  `caos.access` line for the creating `POST` cannot be joined to the `run_id` it enqueues —
  the HTTP arc and the run arc never meet.
- **Files / logical blocks:** `caos/server/routes/runs.py` → the create-run handler
  (`Run(...)` build → `db.commit()` → `executor.enqueue(run.id)`); `caos/server/database.py`
  → the `Run` model (add a nullable `request_id` column, mirroring `worker_id`); a new
  alembic migration.
- **Missing safeguard:** a persisted correlation column on the run so the enqueue boundary
  joins the HTTP request to the background run.
- **Enterprise pattern:** correlation-ID persistence across the request→worker boundary.
- **Opus instruction:** Add a nullable `request_id` column to the `Run` model with an alembic
  migration (nullable, no backfill needed; follow the CRLF/existing migration conventions).
  In the create-run handler, set `Run(request_id=request.state.request_id, ...)` **before** the
  existing `db.commit()` (no extra round-trip). The executor lane then binds it to the
  ContextVar (previous item). Do not change the response contract.
- **Latency guard:** one extra column set on the object before the commit that already
  happens — no additional DB round-trip on the interactive create path.
- **Verification:** `POST` a run and confirm the `caos.access` line's `request_id` equals the
  `Run.request_id` persisted and the `run_id`'s `caos.run`/`caos.llm` lines' `request_id`.

### [Layer 5 · P2] `run_executor.py` — Lease heartbeat to distinguish hung from crashed
- **Gap:** The `QueueWorker` lease is stamped once at claim (`lease_expires_at = now +
  caos_run_lease_seconds`) and never refreshed while the task runs, so a task hung
  mid-execution and a crashed worker look identical (both just let the fixed lease expire);
  the three in-process executors have no lease at all.
- **Files / logical blocks:** `caos/server/run_executor.py` → `QueueWorker` (the lease stamp
  in `_claim_one` and the run loop) ; `caos/server/config.py` → knob.
- **Missing safeguard:** a periodic lease refresh (heartbeat) so `lease_expires_at` advances
  while a task is genuinely progressing, letting `_reap_orphans` reclaim a truly-hung task
  faster and correctly.
- **Enterprise pattern:** worker heartbeat / lease renewal.
- **Opus instruction:** Add `caos_run_heartbeat_s: int = 0` (0 = disabled, preserving current
  fixed-window behavior by default). When > 0, have the `QueueWorker` refresh
  `lease_expires_at = now + caos_run_lease_seconds` on an interval while the task runs (a
  lightweight periodic task or a per-module tick), so `_reap_orphans` distinguishes a
  progressing task (lease advancing) from a hung one (lease stale despite `status=running`).
  Emit a `job.heartbeat` line optionally. Keep the default off so behavior is unchanged unless
  enabled. Do not touch the in-process (SQLite) executors' sweep-on-boot model.
- **Latency guard:** the heartbeat is a periodic background DB update on the executor loop,
  not on any request path; default-off means zero change unless opted in.
- **Verification:** enable `caos_run_heartbeat_s=30`, run a multi-minute run, and confirm
  `lease_expires_at` advances during execution; kill the worker mid-run and confirm
  `_reap_orphans` reclaims it after the lease lapses.

### [Layer 5 · P2] Opt-in OpenTelemetry spans (richer tracing upgrade)
- **Gap (upgrade, not a defect):** the log-based spans above satisfy the tracing floor, but
  there is no true distributed-span export for teams that run a collector.
- **Files / logical blocks:** `caos/server/engine/runner.py` `execute_run`,
  `engine/synth.py`/`engine/runner.py` synth fan-out, `engine/budget.py` `trace_llm`; a new
  optional `caos/server/tracing.py`; `caos/deploy/docker-compose.yml` (an opt-in
  `otel-collector` profile); `caos/server/config.py` → flag.
- **Missing safeguard:** real span export (request → executor → LLM) when a local collector
  is present.
- **Enterprise pattern:** OpenTelemetry span-per-unit-of-work with a local OTLP collector.
- **Opus instruction:** Behind `caos_tracing_enabled: bool = False`, initialize an OTel
  tracer (SDK + OTLP exporter) in `tracing.py`; wrap `execute_run` as the root span (keyed on
  `run_id`), the synth fan-out as child spans, and `trace_llm` as leaf spans. Gate all
  imports/instrumentation on the flag so the SDK is never loaded when disabled (no cost).
  Add `opentelemetry-sdk`/`opentelemetry-exporter-otlp` to `requirements.txt` only if this is
  adopted; provide the collector as an opt-in compose profile (not started by default). Sample
  aggressively (e.g. parent-based, low ratio for interactive lanes) to hold the latency
  boundary. This is optional; the log-based spans are the default.
- **Latency guard:** disabled by default (SDK not imported); when enabled, spans are sampled
  and export is batched/async off the request path.
- **Verification:** with the flag off, confirm no OTel import and unchanged behavior; with the
  flag on and a collector in the compose profile, confirm a run produces a trace spanning
  request→executor→LLM keyed on `run_id`.

> Checkpoint L5: 6 pass, 0 revise — every cited call site verified real (`execute_run` +
> `set_run_id`, the four executor claim/start choke-points, the run-less lanes, the create-run
> enqueue boundary + `Run` model, the fixed-window lease, the opt-in OTel surface) and every
> claimed gap genuinely absent; the only interactive-path touch (persisting `request_id` onto
> the run) is a pre-commit in-memory column set with no extra round-trip. No latency
> regressions.

---

## Layer 6 — Telemetry & Metrics Aggregation

**Outcome:** a self-hosted `/metrics` scrape surface turns the per-line logs and the
`LLMCallRecord` ledger into RED (request rate/errors/duration), USE (executor queue
depth/in-flight/failure), and LLM (cost/fallback-rate/latency) aggregates an operator can
dashboard and alert on — with zero synchronous push and zero paid SaaS. The strong posture is
preserved: `trace_llm` + `LLMCallRecord` (the ready cost/latency dataset), `access_event`
(the RED source), and the orderly middleware/router registration are **not** re-specced —
this layer aggregates and exposes what they already capture.

**Design decision — metrics backend (options considered).**
*(a) `prometheus-client` `/metrics` pull-scrape (chosen).* A pure-Python in-memory registry;
counters/gauges/histograms are mutated with an in-process increment and aggregated only on
the scrape `GET` — no push, no collector required to emit, latency-trivial. The single new
dependency. *(b) OpenTelemetry metrics SDK.* Heavier (SDK + exporter + collector) and
push-oriented; the pull model is the lighter fit for a single node. Rejected as the metrics
backend (OTel is offered only for opt-in tracing in Layer 5). *(c) StatsD.* Needs a StatsD
daemon (second runtime) and is push-based. Rejected.

### [Layer 6 · P0] `main.py` — Mount a `prometheus-client` `/metrics` endpoint
- **Gap:** The app registers 18 `/api` routers plus health but defines no `/metrics`
  endpoint — there is no scrape surface at all, and no observability dependency is declared.
- **Files / logical blocks:** `caos/server/main.py` → the `app.include_router(...)` block
  (register the metrics route **before** the `/api/{path:path}` catch-all and the `/`
  StaticFiles mount so it is not shadowed); `caos/server/config.py` → knobs;
  `requirements.txt` + `requirements.lock` (add `prometheus-client`).
- **Missing safeguard:** a self-hosted metrics exposition endpoint.
- **Enterprise pattern:** Prometheus pull-scrape exposition (`/metrics`, `text/plain`
  OpenMetrics).
- **Opus instruction:** Add `prometheus-client` to `requirements.txt`/`.lock`. Mount
  `GET /metrics` (a plain route or tiny router) returning `generate_latest()` with the
  Prometheus content type. Mount it at **`/metrics`, outside `/api`**, so the
  `edge_origin_guard` (which only guards `/api`) does not `401` it and it stays reachable to
  an in-network Prometheus — the `app` container is not published to the host, so network
  isolation is the access control (do not expose it through Caddy). Add
  `caos_metrics_enabled: bool = True` (gate the route) and `caos_metrics_path: str =
  "/metrics"`. Register before the catch-all and StaticFiles.
- **Latency guard:** the `/metrics` route is scraped by Prometheus off the analyst path;
  metric aggregation happens only on that `GET`, and it is network-internal (not on any
  interactive read).
- **Verification:** `curl http://app:PORT/metrics` from inside the compose network returns
  OpenMetrics text; confirm `edge_origin_guard` does not `401` it and it is not reachable
  through Caddy from outside.

### [Layer 6 · P0] `access_log.py` + `main.py` — RED metrics from the access middleware
- **Gap:** Request rate, error rate, and duration exist only as per-line `caos.access` JSON
  parsed out-of-band; there is no in-process request counter or latency histogram exposed for
  scraping.
- **Files / logical blocks:** `caos/server/main.py` → the `access_log` middleware (increment
  beside the existing `access_logger.info(...)`); `caos/server/access_log.py` (the fields it
  already computes: `action`, `status`, `dur_ms`).
- **Missing safeguard:** an in-process RED counter/histogram fed from the values the
  middleware already computes.
- **Enterprise pattern:** RED metrics (request rate / error rate / duration) via a counter +
  histogram.
- **Opus instruction:** Define a `Counter` `caos_http_requests_total` labelled by
  `method`/`route`/`status_class` and a `Histogram` `caos_http_request_duration_seconds`
  labelled by `method`/`route`, in a `caos/server/metrics.py` registry module. In the
  `access_log` middleware, after computing status and `dur_ms`, `.inc()` the counter and
  `.observe(dur_ms/1000)` the histogram. **Label on route templates, not raw paths** (use
  `request.scope["route"].path` or a normalized bucket) to avoid unbounded cardinality from
  ids in the path. Keep `access_logger.info(...)` unchanged (logs and metrics coexist).
- **Latency guard:** a `Counter.inc()` and `Histogram.observe()` are in-memory,
  lock-light operations (microseconds) in a middleware that already runs per request; no I/O,
  no network. Route-template labels bound cardinality so the registry stays small.
- **Verification:** issue a mix of 2xx/4xx/5xx requests and confirm
  `caos_http_requests_total` and the duration histogram reflect them on `/metrics`; confirm
  label cardinality is bounded (no per-id label explosion).

### [Layer 6 · P1] `engine/budget.py` — LLM cost / fallback / latency metrics from the ledger
- **Gap:** `trace_llm` persists per-inference cost/tokens/latency/fallback to `LLMCallRecord`
  and emits a `caos.llm` line, but nothing aggregates them into cost, throughput,
  fallback-rate, or latency metrics.
- **Files / logical blocks:** `caos/server/engine/budget.py` → `trace_llm` (increment beside
  the existing emit); the `LLMCallRecord` columns (`cost`, `prompt_tokens`,
  `completion_tokens`, `latency_ms`, `status`, `lane`, `model`) plus the `fallback` value —
  which is a `trace_llm` **parameter / log field**, not an `LLMCallRecord` column, so read it
  at the increment point from the parameter, not the row.
- **Missing safeguard:** in-process LLM metrics derived from the data `trace_llm` already
  has in hand at emit time.
- **Enterprise pattern:** application/business metrics from the existing telemetry
  choke-point.
- **Opus instruction:** In `metrics.py` define a `Counter` `caos_llm_cost_usd_total`
  (labels `lane`/`model`), `Counter` `caos_llm_tokens_total` (labels `lane`/`model`/
  `direction`), `Counter` `caos_llm_calls_total` (labels `lane`/`model`/`status`/
  `fallback`), and a `Histogram` `caos_llm_latency_seconds` (labels `lane`/`model`). In
  `trace_llm`, increment them from the same values it already computes for the line/row. Keep
  it best-effort (metrics must never fail an inference — wrap in the existing guard). Bound
  label cardinality to the known model/lane sets. Fallback-rate is `calls_total{fallback=
  "true"} / calls_total`.
- **Latency guard:** counter/histogram mutations are in-memory increments at a point that
  already builds the trace and writes the row; no added I/O. LLM calls are off the interactive
  read path regardless.
- **Verification:** run a mixed workload and confirm `caos_llm_cost_usd_total`,
  `caos_llm_calls_total{fallback="true"}`, and `caos_llm_latency_seconds` appear on `/metrics`
  and reconcile with the `LLMCallRecord` rows.

### [Layer 6 · P1] Executors — USE metrics via a `stats()` accessor
- **Gap:** In-flight count, semaphore saturation, queue depth, reap counts, and the
  consecutive-fail counter live only as in-memory sets or DB rows and are never exported —
  USE (utilization/saturation/errors) is unobservable except via log grep.
- **Files / logical blocks:** `caos/server/run_executor.py` → `InProcessExecutor`
  (`_tasks`/`_sem`) and `QueueWorker` (`_inflight`/`_run_loop` local `fails`/`_reap_orphans`);
  a `stats()` accessor defined on **both** executor classes; `caos/server/main.py` →
  `app.state.executor` (the live instance set at boot); the metrics registry.
- **Missing safeguard:** exported USE gauges/counters for the executor substrate the
  autonomous pipelines run on.
- **Enterprise pattern:** USE metrics (utilization / saturation / errors) via gauges + a
  scrape-time collector callback.
- **Opus instruction:** Add a `stats()` method to **both** executor classes returning the
  fields each actually has — `InProcessExecutor`: `{in_flight: len(self._tasks), capacity,
  queue_depth}`; `QueueWorker`: `{in_flight: len(self._inflight), capacity: cap, queue_depth,
  fails: self._fails}` — with `queue_depth = COUNT(Run.status=="queued")` computed lazily.
  **Promote the `_run_loop` local `fails` counter to an instance attribute `self._fails`**
  (it is currently a local variable and cannot be read from `stats()`); `capacity` is
  `caos_run_concurrency` (already available). Register a Prometheus **collector callback**
  that reads the **live executor instance at `app.state.executor`** — NOT `get_executor()`,
  which constructs a fresh empty `QueueWorker`/`InProcessExecutor` on every call and would
  report a constant zero. The collector closes over `app.state.executor` and emits gauges
  `caos_executor_in_flight`, `caos_executor_capacity`, `caos_executor_queue_depth`, and a
  `Counter` `caos_executor_failures_total` incremented at the `fails>=3` escalation in
  `_run_loop`. Do not reach into private sets from the route. Keep the existing
  `logger.error("queue stalled")` escalation.
- **Latency guard:** the executor's private counters are already maintained; the gauge read
  happens at scrape time (off the interactive path), and `queue_depth`'s `COUNT` runs only on
  a `/metrics` scrape, not per request.
- **Verification:** saturate the executor (`caos_run_concurrency` concurrent runs + a queue)
  and confirm `caos_executor_in_flight`, `caos_executor_queue_depth`, and
  `caos_executor_capacity` reflect it; force loop failures and confirm
  `caos_executor_failures_total` increments.

### [Layer 6 · P2] `database.py` — DB pool saturation / query-latency gauge
- **Gap:** Pool exhaustion and slow queries are invisible until requests stall — sessions are
  yielded/committed with no pool checkout-wait or saturation instrumentation (surfaced in
  Layer 3).
- **Files / logical blocks:** `caos/server/database.py` → the async engine's pool
  (`engine.pool`) and `get_db`; the metrics registry.
- **Missing safeguard:** a scrape-time gauge for pool checked-out/overflow/size so saturation
  is observable before it stalls requests.
- **Enterprise pattern:** connection-pool saturation metrics (scrape-time gauges).
- **Opus instruction:** Register a scrape-time collector reading SQLAlchemy pool stats
  (`engine.pool.checkedout()`, `.checkedin()`, `.overflow()`, `.size()`) into gauges
  `caos_db_pool_checked_out`, `caos_db_pool_overflow`, `caos_db_pool_size`. Read them lazily
  on scrape (do not instrument every checkout on the request path). Optionally add a small
  histogram of query duration only if it can be done without wrapping every session (prefer the
  pool gauges, which are free).
- **Latency guard:** pool stats are read only at scrape time via the collector callback, off
  the interactive path; no per-checkout instrumentation is added.
- **Verification:** drive concurrent load and confirm `caos_db_pool_checked_out` rises toward
  `caos_db_pool_size` + overflow on `/metrics`, giving an early saturation signal.

### [Layer 6 · P2] `deploy/` — Opt-in local Prometheus + Grafana profile
- **Gap (deployment enablement):** the `/metrics` surface exists but there is no bundled,
  self-hosted scrape+dashboard stack, so an operator must wire one by hand.
- **Files / logical blocks:** `caos/deploy/docker-compose.yml` (an opt-in `monitoring`
  profile with `prometheus` + `grafana`); new `caos/deploy/prometheus.yml` scrape config; a
  `caos/deploy/grafana/` provisioned dashboard.
- **Missing safeguard:** a turnkey self-hosted observability stack (no paid SaaS).
- **Enterprise pattern:** self-hosted Prometheus scrape + Grafana dashboards.
- **Opus instruction:** Add a compose `profiles: ["monitoring"]` block with hash-pinned
  `prometheus` and `grafana` images (matching the stack's pinning discipline), a
  `prometheus.yml` scraping `app:PORT/metrics` on the internal network, and a provisioned
  Grafana dashboard for the RED/USE/LLM metrics. Not started by default (opt-in profile), so
  the single-node footprint is unchanged unless enabled. Keep both services on the internal
  network (no host publish beyond Grafana if desired, behind the edge).
- **Latency guard:** entirely out-of-band (a separate scrape service); no app-path effect.
- **Verification:** `docker compose --profile monitoring up` and confirm Prometheus scrapes
  `app/metrics` and the Grafana dashboard renders RED/USE/LLM panels.

> Checkpoint L6: 5 pass, 1 revised → reconciled — the `/metrics` mount point + edge-guard
> exemption, RED from the access middleware, LLM metrics from the ledger, the pool-saturation
> gauge, and the opt-in Prometheus/Grafana profile verified real; latency guards genuinely
> scrape-time/in-memory. **REVISE reconciled:** the executor USE item called `get_executor()`
> a singleton, but it builds a fresh empty instance per call (the live executor is
> `app.state.executor`) and cited `cap`/`fails` as instance members when `fails` is a
> `_run_loop` local — the item now reads `app.state.executor.stats()` and promotes `fails` to
> `self._fails`. Minor citation fixed: `fallback` is a `trace_llm` field, not an
> `LLMCallRecord` column.

---

## Scorecard roll-up (all seven checkpoints reconciled)

Every layer's fresh-context verifier checkpoint is recorded inline above; all REVISEs are
reconciled. Aggregate: **34 items, 30 pass on first review, 4 substantive REVISEs + 1 minor
citation reconciled**, 0 latency regressions flagged on any interactive-path item. Post-review,
the EDGAR rate-limit item (L4) was **upgraded at operator direction** from an in-process bucket
to a full cross-process DB-backed token bucket (shared `SELECT … FOR UPDATE` row + a
threadpool→loop `run_coroutine_threadsafe` bridge), self-verified against the live call chain
to be deadlock-safe and dependency-free.

| Layer | Scorecard criteria advanced | Verifier | Verdict |
|---|---|---|---|
| L0 | secret-hygiene, verifiability | 5/5 pass | GREEN when built |
| L1 | structured-logging, correlation, latency-neutrality | 4 pass, 1 reconciled | GREEN when built |
| L2 | correlation, db-resilience, verifiability | 2 pass, 1 reconciled | GREEN when built |
| L3 | db-resilience | 2 pass, 1 reconciled | GREEN when built |
| L4 | egress-resilience, structured-logging | 5 pass, 1 reconciled | GREEN when built |
| L5 | tracing, correlation, structured-logging, db-resilience | 6/6 pass | GREEN when built |
| L6 | metrics, latency-neutrality | 5 pass, 1 reconciled | GREEN when built |

**Dependencies to add:** `prometheus-client` (direct, new — L6). `tenacity` is **not**
promoted (L4 reuses the existing `_call_with_retry` and hand-rolls the EDGAR retry/bucket +
breaker); OpenTelemetry is opt-in only (L5, flag-gated, not a required dependency). All new
config knobs live in `config.py` `Settings` with defaults + rationale as specified per item.
