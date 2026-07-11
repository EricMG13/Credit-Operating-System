# Security Audit Playbook — Edge, Identity, Infrastructure Hardening

Goal-prompt for a Sonnet agent. Re-run on every PR touching `caos/server/` auth/config,
`caos/deploy/`, or `.github/workflows/ci.yml`, and before every deploy.
**Assess and specify only** — you do not exploit, do not probe a live deployment, and do
not change system state. Report findings; fix nothing unless instructed.

## 1. Objective and trust boundaries

Prove the CAOS security chain still holds end to end. The stack is
Caddy (TLS) → oauth2-proxy (Google Workspace OIDC) → FastAPI → Postgres, self-hosted
Docker ([SECURITY.md](../../SECURITY.md), [AUDIT.md](../../AUDIT.md)). The app trusts
forwarded identity headers **only because** the edge is the sole network path and proves
itself with an injected secret; every invariant below defends that single assumption or
one of the input surfaces around it. A broken link means forged analyst identity on a
platform holding credit work product — committee-facing and MNPI-adjacent.

Trust boundaries to audit against:

- **B1 Internet → Caddy**: TLS termination; strips all client-supplied identity headers; injects `X-Edge-Authorization` from `EDGE_PROXY_SECRET` ([Caddyfile](../../../deploy/Caddyfile)).
- **B2 Caddy → oauth2-proxy**: the only identity setter — Google OIDC session → `X-Forwarded-User/-Email/-Preferred-Username` ([oauth2-proxy.cfg](../../../deploy/oauth2-proxy.cfg)). Only `GET /api/health` skips auth.
- **B3 proxy → app**: app publishes no port (compose `internal` network, no `ports:`); [identity.py](../../../server/identity.py) trusts headers only after the edge-secret proof; signed `caos_analyst` cookie layers app identity on top.
- **B4 app → outbound**: EDGAR fetches (`*.sec.gov` only), LLM APIs, clamd. Fetched/uploaded content is untrusted input.
- **B5 analyst uploads → vault**: hostile-document surface (parse + optional ClamAV).

Rules of engagement: read-only analysis, static scanners, and the offline test suite.
No live requests against a production host; runtime verification, if demanded, uses the
isolated QA stack convention (`:8010`, throwaway DB), never the user's running stack.

## 2. Scope discovery — run fresh every audit

The surface moves; never audit from a stale list.

```bash
# Auth surface: every route + its identity gate. Any route file line NOT using
# Depends(get_identity) (except health.py and auth.py's login lanes) enters scope.
grep -rn "@router\.\(get\|post\|put\|patch\|delete\)" caos/server/routes/*.py
grep -L "get_identity" caos/server/routes/*.py
grep -n "include_router\|skip_auth" caos/server/main.py caos/deploy/oauth2-proxy.cfg

# Identity/auth core (fixed set — read all of it, it is small):
#   identity.py routes/auth.py passwords.py rate_limit.py access_log.py avscan.py
#   config.py main.py (lifespan boot guards + header/edge middleware)

# Headers the app reads vs headers the edge strips — these two lists must reconcile (§3.1)
grep -rn "x-forwarded\|x-edge" caos/server/*.py caos/server/routes/*.py -i
grep -n "request_header" caos/deploy/Caddyfile

# Deploy configs and dependency manifests
ls caos/deploy/    # Caddyfile oauth2-proxy.cfg docker-compose.yml Dockerfile clamd.conf backup.sh .env.example
ls caos/server/requirements.txt caos/server/requirements.lock caos/frontend/package-lock.json .gitleaks.toml

# Outbound-fetch surface: any NEW urlopen/httpx/requests site needs an allowlist review (§3.7)
grep -rn "urlopen\|httpx\.\|requests\.get\|create_connection" caos/server/*.py caos/server/engine/*.py | grep -v test

# What CI already gates — this playbook EXTENDS the security job, never duplicates it
sed -n '/^  security:/,/^  [a-z]/p' .github/workflows/ci.yml

# Diff scope for a PR run
git diff --name-only origin/main...HEAD
```

Diff this inventory against the previous audit report; every new route, header read,
outbound fetch, deploy file, or manifest change enters scope.

## 3. Coverage checklist — invariants to prove

Each item is an invariant, not a step. PASS = cite the guard in current code; FAIL = a repro or a concrete gap.

**3.1 Edge origin & identity resolution**
- Edge-origin proof runs **before** cookie resolution: `identity.get_identity` checks `X-Edge-Authorization` (constant-time, bytes-mode `hmac.compare_digest`) before reading `caos_analyst` — a cookie can never bypass the proxy-origin proof. The `main.py` middleware enforces the same on every `/api/*` path except `/api/health`.
- Fail-closed identity: no cookie **and** no forwarded headers in a deployed context → 401. `config.is_deployed` counts ANY `ENVIRONMENT != "development"` (typo/unset fails closed). The permissive `local-dev` identity is unreachable when deployed.
- Header reconciliation: every identity-bearing header the app reads is stripped from clients in the [Caddyfile](../../../deploy/Caddyfile) (`X-Forwarded-User/-Email/-Preferred-Username/-Groups/-Access-Token`, `X-Edge-Authorization`). A new header read without a matching strip is HIGH.

**3.2 Cookie integrity & boot refusal**
- `caos_analyst` is HMAC-SHA256-signed (`make_session_token`); verify path rejects tampering, garbage, and — mandatorily — missing/expired `exp` (server-side, not just browser max-age). Signature compare is bytes-mode (non-ASCII cookie can't 500).
- All four boot guards present in `main.py` lifespan and fail-closed (`RuntimeError`, keyed on `is_deployed`): `SESSION_SECRET` unset/dev-default; `EDGE_PROXY_SECRET` unset; `ANALYST_SIGNUP_CODE` unset/`131113`; `CAOS_DEMO_SEED` set. Weakening any guard to warn-only is HIGH.
- Cookie attributes: `httponly`, `samesite=lax`, `secure` on any non-development environment, `path=/`.

**3.3 Profile ↔ SSO binding & impersonation refusal**
- Behind SSO the profile is keyed on the verified `X-Forwarded-Email`: a caller resolves only to their own profile; a display name held by another email → 409, never adoption.
- `/api/auth/register` rejects (403) a body email that differs from the caller's `X-Forwarded-Email` — no seeding a row a colleague would silently adopt.
- `/api/auth/profile` (`create_profile`) requires forwarded identity in a deployed context (401 when absent) — the REVIEW_MATRIX_SECURITY high finding; verify the guard is still there, do not re-file it.
- Cookie principal cross-check: a valid cookie whose email differs from THIS request's `x-forwarded-email` is ignored (falls through to proxy identity) — the 30-day app cookie can't outlive-impersonate past the 7-day SSO session.

**3.4 Credential endpoints: timing & revocation**
- `/login` and `/recover` are timing-equalized: dummy PBKDF2 verify when no account matches; recovery verifies all three words non-short-circuit; hashing runs off-thread (event loop can't be pegged). Access-code/invite-code compares are constant-time bytes-mode.
- Revocation: cookies carry `token_version` (`"v"`); logout bumps the row, invalidating every outstanding token; a missing Analyst row (GDPR-erased) fails the check. Wrong credentials return 401 (not 403) so the access-log brute heuristic sees them.

**3.5 Throttle & brute detection**
- Every credential endpoint shares `_throttle`: per-source-IP cap (10/min) **plus** the global bucket (30/min) — the un-spoofable backstop against XFF rotation. The limiter's memory is bounded (sweep threshold + hard ceiling with oldest-evict under key spray).
- The three threat-detection feeds stay wired: Caddy JSON access log, oauth2-proxy `auth_logging`/`request_logging` (pinned `true` in cfg, not defaults), and the app's `caos.access` structured log. Attacker-influenced fields pass `sanitize_field` (C0-strip + length cap) before logging or persistence — no log forging.

**3.6 SSRF — EDGAR fetches**
- Every fetched URL is validated: `https` + exact `www.sec.gov` host (or the fixed `data.sec.gov`/`efts.sec.gov` constants) + `/Archives/` path for filing docs + explicit userinfo (`@`) rejection; `_http_get` re-checks the **post-redirect** host ends `.sec.gov`. No user-controlled URL reaches any fetcher unvalidated; any new outbound fetch site (§2 grep) needs the same allowlist pattern.

**3.7 Path traversal — upload & EDGAR ingest**
- Stored filenames are sanitized (`[^A-Za-z0-9._-]` → `_`, `Path(...).name` strips directories) and keyed under a server-generated UUID prefix — a hostile filename cannot escape `CAOS_STORAGE_DIR`. Temp-file suffixes derive from the sanitized name only.
- Uploads: streaming size cap (413 before buffering past `MAX_UPLOAD_MB`), magic-byte MIME sniff, `run_mode` allow-list.

**3.8 Security headers**
- Every response carries CSP (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'self'`; `unsafe-inline` is the accepted static-export exception), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS. No CORSMiddleware exists (same-origin single process) — its introduction is a finding.

**3.9 AV scan — fail-closed both directions**
- With `CLAMAV_HOST` set: signature hit → 422; unreachable/timeout/dropped/oversized-or-garbled reply → **503 fail-closed** (never a silent pass). Unset → documented no-op (accepted, opt-in `av` profile).
- Deploy coherence: mounted [clamd.conf](../../../deploy/clamd.conf) keeps `StreamMaxLength`/`MaxScanSize`/`MaxFileSize` (300M) ≥ `MAX_UPLOAD_MB` (250), TCP socket exposed to the app, `LocalSocket` present (clamav 1.x crash-loops without it).

**3.10 Secrets, dependency CVEs, SAST**
- CI's security job is the baseline gate (pip-audit, bandit high/medium, `npm audit --audit-level=high`, gitleaks over full history with `.gitleaks.toml`). This audit re-runs them (§4) and adds what CI can't: triage of NEW advisories against the D-1 rule (dev/build-chain-only advisories are accepted; anything reachable from the production static export or server runtime is not), lock coherence (`check_lock_sync.py` — prod installs the `.lock`, not the `.txt`), and a diff review of any `.gitleaks.toml` allowlist addition (unadjudicated allowlist growth is a finding).
- No secret material in the repo or images: `.env` git-ignored, `ANTHROPIC_API_KEY`/secrets env-injected only, no secret baked into a Dockerfile layer.

**3.11 Container & deploy hardening**
- [Dockerfile](../../../deploy/Dockerfile): base images digest-pinned (both stages); `pip install --require-hashes` from the lock; drops root (`USER caos`, uid 10001); `ENVIRONMENT=production` baked in; single exposed port; healthcheck hits only unauthenticated `/api/health`.
- [docker-compose.yml](../../../deploy/docker-compose.yml): app has **no `ports:`** (reachable only via the proxy chain); all services on the `internal` network; `no-new-privileges` everywhere; `cap_drop: ALL` + `read_only` on app/oauth2-proxy (Caddy and Postgres carve-outs are documented); clamav under the `av` profile with `mem_limit`; only Caddy publishes 80/443.
- [Caddyfile](../../../deploy/Caddyfile): strip list intact (§3.1), edge secret injected via `header_up`, JSON access log on.
- [oauth2-proxy.cfg](../../../deploy/oauth2-proxy.cfg): `pass_user_headers = true`, `pass_access_token = false`, `set_xauthrequest = false`; cookie `secure`/`httponly`/`samesite=lax`/`168h`; `skip_auth_routes` is exactly `GET=^/api/health$` — any widening is HIGH.
- `backup.sh` and any new deploy script pass shellcheck (CI `deploy-assets` job); compose validates with `--no-interpolate`.

## 4. Procedure

Read order: [SECURITY.md](../../SECURITY.md) → [AUDIT.md](../../AUDIT.md) → §6 register →
[REVIEW_MATRIX_BACKEND.md](../REVIEW_MATRIX_BACKEND.md) (BE-7 group + adjudicated register) →
[REVIEW_MATRIX_SECURITY.md](../REVIEW_MATRIX_SECURITY.md). Background:
[reference/security-and-hardening.md](../../reference/security-and-hardening.md).

Scanners — pin the CI versions so a local pass predicts the CI gate:

```bash
# Python deps vs live OSV data
pip install pip-audit==2.7.3 bandit==1.7.10
pip-audit -r caos/server/requirements.txt

# Python SAST (server + scripts; tests out of scope)
bandit -r caos/server caos/scripts --severity-level high --confidence-level medium

# Frontend deps straight from the lockfile
cd caos/frontend && npm audit --audit-level=high && cd -

# Secret scan, full history, repo allowlist
docker run --rm -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:v8.18.4 \
  detect --source=/repo --config=/repo/.gitleaks.toml --redact --no-banner

# Lock coherence + deploy lint (mirrors CI lock + deploy-assets jobs)
python caos/scripts/check_lock_sync.py
shellcheck caos/deploy/*.sh caos/scripts/*.sh
docker compose -f caos/deploy/docker-compose.yml config -q --no-interpolate
```

Offline test legs for the §3 invariants (interpreter: `caos/server/.venv311/bin/python`,
prod-parity — never downgrade the fastapi 0.138 pin; run from the repo root; conftest
provisions a throwaway SQLite DB and blanks LLM keys):

```bash
caos/server/.venv311/bin/python -m pytest \
  caos/tests/server/test_identity.py \
  caos/tests/server/test_auth_password.py \
  caos/tests/server/test_auth_profile.py \
  caos/tests/server/test_token_revocation.py \
  caos/tests/server/test_rate_limit.py \
  caos/tests/server/test_security_headers.py \
  caos/tests/server/test_avscan.py \
  caos/tests/server/test_edgar.py \
  caos/tests/server/test_ingest_markitdown.py -q
```

Manual review steps, in order:

1. §2 discovery; list every changed file intersecting the surface.
2. Route-gate sweep: map every route to `Depends(get_identity)` or an adjudicated exception (`health.py`; `auth.py` login lanes, which self-guard).
3. Read the four boot guards in `main.py` lifespan verbatim; confirm all raise (not warn) and key on `is_deployed`.
4. Reconcile the header read-list vs the Caddyfile strip-list (§3.1 greps).
5. Any new `hmac`/secret comparison: constant-time and bytes-mode, or finding.
6. Any new outbound fetch: allowlist + post-redirect re-check, or finding.
7. Walk §3.11 against the current deploy files line by line — config drift is the likeliest regression class here (no test covers these files beyond lint).
8. Confirm the CI security job still contains all four scanner steps (a deleted step is itself a HIGH finding).

## 5. Evidence and reporting

Write `caos/docs/qa/audits/security-infra-YYYY-MM-DD.md`:

- **Header**: date, branch, commit, scanner versions, test counts.
- **Gate table** — all must PASS:
  1. All §4 scanners clean, or every finding adjudicated against §6 / D-1.
  2. Auth/identity test leg green.
  3. Route-gate sweep: zero ungated routes.
  4. Four boot guards present and fail-closed.
  5. Header strip-list ⊇ header read-list.
  6. Deploy files match every §3.11 invariant.
  7. CI security job intact.
- **Findings**: severity, `file:line`, invariant broken (§3 reference), failure scenario, suggested fix. Severity gates: **HIGH** = identity forgery / auth bypass / SSRF / secret exposure / a fail-closed guard weakened — blocks merge and deploy. **MED** = defense-in-depth regression with compensating control — blocks deploy until adjudicated. **LOW** = hygiene/doc-rot — filed, never blocking.
- **Refute-first adversarial verification, every candidate before it is filed**: attempt to prove the finding wrong — re-read the guard and its callers, check §6 and both review matrices for prior adjudication, and write the concrete failure scenario (inputs → wrong outcome). Agent severity inflation is the documented failure mode in this repo; a finding that survives no refutation attempt is reported **UNVERIFIED**, never HIGH. Do not build live exploits — a failure *scenario* argued from code is the required standard of proof.
- File one line per confirmed finding in the tracker the team uses at the time; link the dated report.

## 6. Accepted-risk register — never re-flag

Seeded from [SECURITY.md](../../SECURITY.md) §2/§8 and the REVIEW_MATRIX_BACKEND
adjudicated-accepted register. Re-flag one only if its stated trigger occurs.

| Risk | Why accepted | Re-flag trigger |
|---|---|---|
| Single-team IDOR — no per-issuer/row authz | One trusted coverage team per deploy; roles-lite is the E2 posture | Multi-user entitlement-restricted (Bloomberg/MNPI) data, or multi-tenancy |
| XFF rate-key spoof; global login-bucket self-DoS | First XFF hop is caller-supplied by nature; global bucket is the backstop; limiter is best-effort behind the edge | App exposed without the edge proxy |
| Forwarded-header trust (S-3) | Edge is the sole network path; Caddy strips + re-injects; edge-secret proof enforced | Any path that publishes the app port |
| Compromised edge proxy | Explicit threat-model non-goal (SECURITY.md §8) | Threat model expands |
| Limiter + advisory locks assume ONE process | Single app container by design | Replicas > 1 (BE8-1) |
| CSP `unsafe-inline` script/style | Static export cannot carry per-request nonces | SSR/nonce-capable serving |
| npm dev-chain advisories (D-1: vite/esbuild/vitest, postcss) | Build-time only; `npm ls --omit=dev` proves none ship in the export; `npm audit fix --force` would downgrade Next — do not run | An advisory reachable from the shipped export or server runtime |
| Register 409 confirms email existence | Throttled, invite-code-gated; accepted UX tradeoff | External/self-serve signup |
| On-host backup (`backup.sh`) | Pilot posture; off-host is a deploy-phase item | Production data beyond the pilot |
| EDGAR in-process throttle | Same single-process scale assumption | Replicas > 1 |
| ClamAV off by default | Single trusted team; opt-in `av` profile documented and fail-closed once enabled | Team growth or untrusted upload sources |
| `EdgarError → 502 str(exc)` | Curated domain-error messages, deliberately analyst-facing | — |
| Demo/mock seams; PERF-2 bundle size | Phase-1 by design | — |

Anything already marked Fixed/Resolved in AUDIT.md or the review matrices is prior art:
verify the fix is still present, cite it, and do not re-file the original finding.
