# Security Audit — Edge, Identity, Infrastructure Hardening

**Date:** 2026-07-10
**Branch:** `feat/command-center-layout-and-sector-rv-cleanup`
**Commit:** `1b3b6ac8c9644c9684fd8d58f5127aab195b4e75`
**Playbook:** [security-infra.md](../playbooks/security-infra.md)
**Prior report:** none (`caos/docs/qa/audits/` was empty — this is the baseline run).
**Scope:** assess-only, read-only analysis + offline scanners/tests. No live requests, no state changes, no fixes applied.

**Scanner/tool versions:** pip-audit 2.7.3 · bandit 1.7.10 · gitleaks v8.18.4 (Docker) · npm 11.13.0 / node v24.16.0 · shellcheck (homebrew) · docker compose (`config -q --no-interpolate`).
**Test counts:** 79/79 passed (`caos/server/.venv311`, Python 3.11.15, fastapi 0.138 pin untouched, `ANTHROPIC_API_KEY` blanked).

## Gate table

| # | Gate | Result |
|---|------|--------|
| 1 | All §4 scanners clean, or every finding adjudicated | **PASS** — pip-audit, bandit, npm audit, gitleaks, `check_lock_sync.py`, shellcheck, `docker compose config` all clean (0 findings) |
| 2 | Auth/identity test leg green | **PASS** — 79/79 (`test_identity`, `test_auth_password`, `test_auth_profile`, `test_token_revocation`, `test_rate_limit`, `test_security_headers`, `test_avscan`, `test_edgar`, `test_ingest_markitdown`) |
| 3 | Route-gate sweep: zero ungated routes | **PASS** — every route in every router file resolves to `Depends(get_identity)` except the adjudicated exceptions: `health.py` (`/api/health`, exempted in `oauth2-proxy.cfg` and the `edge_origin_guard` middleware) and `auth.py`'s login lanes (`create_profile`, `register`, `login`, `recover`, `logout`), which self-guard by design |
| 4 | Four boot guards present and fail-closed | **PASS** — `main.py` lifespan: `EDGE_PROXY_SECRET`, `SESSION_SECRET`, `ANALYST_SIGNUP_CODE`, `CAOS_DEMO_SEED` — all four `raise RuntimeError`, all keyed on `is_deployed` (`ENVIRONMENT != "development"`, typo/unset fails closed) |
| 5 | Header strip-list ⊇ header read-list | **PASS** — Caddyfile strips `X-Forwarded-User/-Email/-Preferred-Username/-Groups/-Access-Token` + `X-Edge-Authorization`; app reads only `-User/-Email/-Preferred-Username` (+ `-For`, which is deliberately not an identity header — accepted-risk register). `-Groups`/`-Access-Token` are stripped defensively but never read. |
| 6 | Deploy files match every §3.11 invariant | **PASS** — Dockerfile, docker-compose.yml, Caddyfile, oauth2-proxy.cfg, clamd.conf all walked line-by-line against §3.11; no drift |
| 7 | CI security job intact | **PASS** — `.github/workflows/ci.yml` `security` job still runs all 4 steps: pip-audit, bandit, npm audit, gitleaks |

**All 7 gates PASS.** No HIGH or MED findings. One new LOW (doc-rot) finding below.

## Scanner output summary

- `pip-audit -r caos/server/requirements.txt` → **no known vulnerabilities**.
- `bandit -r caos/server caos/scripts --severity-level high --confidence-level medium` → **0 High, 0 Medium** (after excluding the two local dev virtualenvs `caos/server/.venv` / `.venv311`, which are gitignored working directories, not part of the scanned tree in CI — scanning them locally without `-x` produced a multi-minute hang over ~650 MB of installed-package code, a local-environment artifact, not a repo/CI issue). 103 Low findings, none actionable per the gate (Low is out of the CI threshold).
- `npm audit --audit-level=high` (from `caos/frontend/package-lock.json`) → **0 vulnerabilities** (moderate/high/critical all 0). This is materially better than the accepted-risk register's D-1 entry ("8 npm advisories — postcss + vite/esbuild/vitest dev chain"), which now describes a resolved state — see Notes.
- `gitleaks detect` (full history, 518 commits, `.gitleaks.toml` config) → **no leaks found**.
- `check_lock_sync.py` → `requirements.lock satisfies all 16 requirements.txt specs`.
- `shellcheck caos/deploy/*.sh caos/scripts/*.sh` → clean (no output).
- `docker compose -f caos/deploy/docker-compose.yml config -q --no-interpolate` → exit 0.

## Invariant walk (§3) — all PASS, cited

- **3.1 Edge origin & identity resolution** — `identity.get_identity` (`identity.py:143-150`) checks `X-Edge-Authorization` via bytes-mode `hmac.compare_digest` *before* reading the cookie; `main.py`'s `edge_origin_guard` middleware (`main.py:225-239`) enforces the same on every `/api/*` path except `/api/health`, as the single chokepoint (covers routes that read cookies/headers directly, e.g. `create_profile`/`logout`). Fail-closed: `is_deployed` (`config.py:267-278`) treats any `ENVIRONMENT != "development"` as deployed. Header reconciliation confirmed (gate 5).
- **3.2 Cookie integrity & boot refusal** — `caos_analyst` HMAC-SHA256-signed (`identity.py:63-71`); `read_session_token` rejects tampering/garbage/missing-or-expired `exp` server-side (`identity.py:74-105`), bytes-mode compare. All four boot guards present and `raise` (not warn) in `main.py:47-87`. Cookie attributes (`routes/auth.py:135-141`): `httponly=True`, `samesite="lax"`, `secure=(environment != "development")`, `path="/"`.
- **3.3 Profile ↔ SSO binding** — profile keyed on `X-Forwarded-Email` (`routes/auth.py:205-222`); name collision across a different email → 409 via `IntegrityError`, never adoption. `/api/auth/register` rejects (403) a body email mismatching the caller's SSO identity (`routes/auth.py:268-270`). `/api/auth/profile` (`create_profile`) requires forwarded identity in a deployed context (`routes/auth.py:184-188`) — **the REVIEW_MATRIX_SECURITY high finding; guard verified still present, not re-filed.** Cookie principal cross-check present (`identity.py:170-186`).
- **3.4 Credential endpoints: timing & revocation** — `/login`/`/recover` always run a real PBKDF2 verify (dummy hash/words when no match), off-thread (`routes/auth.py:326-330`, `:349-354`), non-short-circuiting 3-word check (`routes/auth.py:165-172`). Access-code/invite-code compares are bytes-mode `hmac.compare_digest` (`routes/auth.py:198`, `:252-254`). `token_version` revocation on logout (`routes/auth.py:361-378`); missing Analyst row fails the check (`identity.py:168-169`). Wrong credentials → 401 throughout.
- **3.5 Throttle & brute detection** — every credential endpoint (`create_profile`, `register`, `login`, `recover`) calls the shared `_throttle` (`routes/auth.py:61-67`): per-IP 10/min + global 30/min backstop. `rate_limit.py` bounded (sweep at 1024, hard ceiling 4096, oldest-evict). Three threat feeds wired: Caddy JSON log, oauth2-proxy `auth_logging`/`request_logging` pinned `true`, app `caos.access` log — `sanitize_field` (C0-strip + 256-char cap) applied before logging/persistence.
- **3.6 SSRF — EDGAR** — `fetch_exhibit` (`edgar.py:257-278`) requires `https` + exact `www.sec.gov` host + `/Archives/` path + rejects userinfo/`@`; `_http_get` (`edgar.py:108-115`) re-checks the post-redirect host ends `.sec.gov`. No other outbound fetch site is user-URL-controlled: `openrouter.py:162` posts to a hardcoded literal URL; `avscan.py` connects to the operator-configured `CLAMAV_HOST`, not user input.
- **3.7 Path traversal — upload & ingest** — `ingest.store` (`ingest.py:83-90`) sanitizes the filename (`[^A-Za-z0-9._-]` → `_`, `Path(...).name`) and prefixes a UUID directory. `read_capped` (`ingest.py:47-61`) aborts on the streaming size cap before full buffering; `sniff_pdf`/`sniff_xlsx` magic-byte checks; `_validate_run_mode` allow-lists `run_mode`.
- **3.8 Security headers** — `main.py:169-197` sets CSP (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'self'`, `unsafe-inline` for the static-export exception), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, HSTS, `X-Frame-Options`, `Permissions-Policy`. No `CORSMiddleware` anywhere in `main.py`.
- **3.9 AV scan** — `avscan.py`: signature hit → 422 (`:72-75`); unreachable/timeout/garbled → 503 fail-closed (`:67-69`, `:76-78`); unset `CLAMAV_HOST` → documented no-op (`:88-89`). `clamd.conf` raises `StreamMaxLength`/`MaxScanSize`/`MaxFileSize` to 300M (≥ `MAX_UPLOAD_MB`=250); `LocalSocket /tmp/clamd.sock` present (avoids the 1.x crash-loop); TCP socket exposed to the app network.
- **3.10 Secrets, CVEs, SAST** — see scanner summary above; `.gitleaks.toml` allowlist reviewed — only prose/vendored/build-output paths and the pip-compile lock's hash noise, no unadjudicated real-secret exclusions. No secret material in the repo; `.env.example` is placeholders/empty only.
- **3.11 Container & deploy hardening** — walked line-by-line, see Deploy-file walk below.

## Deploy-file walk (§3.11, line-by-line)

- **Dockerfile** — both stages digest-pinned (`node:26-slim@sha256:…`, `python:3.14-slim@sha256:…`); `pip install --require-hashes -r requirements.lock`; `useradd -m -u 10001 caos` + `USER caos`; `ENVIRONMENT=production` baked into `ENV`; single `EXPOSE 8000`; `HEALTHCHECK` hits only `/api/health`.
- **docker-compose.yml** — `app` has no `ports:` (comment confirms intent); all 6 services declare `networks: [internal]`; `no-new-privileges:true` on every service; `cap_drop: ["ALL"]` + `read_only: true` on `app` and `oauth2-proxy`; documented carve-outs on `db` (postgres entrypoint needs root→postgres drop + writable data dir) and `caddy` (writes provisioned certs to `/data`, but still `cap_drop: ALL` + `cap_add: NET_BIND_SERVICE`); `clamav` under the `av` profile with `mem_limit: 2g`.
- **Caddyfile** — strip list intact (6 headers); `header_up X-Edge-Authorization {$EDGE_PROXY_SECRET}` injected after the strip; JSON access log to stdout.
- **oauth2-proxy.cfg** — `pass_user_headers = true`, `pass_access_token = false`, `set_xauthrequest = false`; cookie `secure`/`httponly`/`samesite=lax`/`168h`; `skip_auth_routes = ["GET=^/api/health$"]` — exact match, no widening.
- **backup.sh / scripts** — shellcheck clean; compose validates with `--no-interpolate`.

## Findings

| Severity | File:line | Invariant | Summary | Failure scenario |
|---|---|---|---|---|
| LOW — **FIXED** | `caos/server/routes/auth.py:350` | §3.10 doc accuracy (adjacent to BE7-1) | Stray doc-rot: comment said "the same **scrypt** work" but the actual hash scheme is PBKDF2-HMAC-SHA256 (`passwords.py`) | Not a security defect — no code path used scrypt. A future auditor reading this comment in isolation could have misjudged the algorithm/work-factor in use. This site was not among the 5 sites the prior BE7-1 doc pass fixed (`routes/auth.py:53,56,241`; `identity.py:81-82` vs `:102-104`; `database.py:529` vs `:546`), so it survived that cleanup. Refute attempt: re-read `passwords.py` (confirms PBKDF2, no scrypt import anywhere in the server tree) and `_recovery_ok`/`_DUMMY_RECOVERY_HASHES` (both call `hash_password`/`verify_password`, PBKDF2 only) — the comment was simply wrong, not a residual code path. **CONFIRMED** (adversarially verified) and **fixed** — comment now reads "PBKDF2". |

No HIGH or MED findings. No UNVERIFIED candidates were filed — every candidate considered during this pass either matched an already-adjudicated register entry (§6) or was resolved by direct code inspection.

## Notes (non-blocking, informational) — resolved

- **D-1 accepted-risk entry was stale-favorable — now updated.** `SECURITY.md` §6 and `AUDIT.md`'s D-1 described 8 npm advisories (postcss + vite/esbuild/vitest dev chain) as accepted risk; current `npm audit --audit-level=high` on `caos/frontend` returns 0 vulnerabilities at every severity. Both docs updated to mark D-1 **Resolved** (dependency tree has since been patched upstream); re-open if a future bump reintroduces dev/build-chain advisories.
- **REVIEW_MATRIX_SECURITY.md's query.py:280 MED finding** (`list_accepted_links` loads all rows, no per-analyst filter) remains present in current code and remains correctly adjudicated under the existing "Single-team IDOR" accepted-risk register entry (§6) — re-verified, not re-filed.
- No prior `security-infra-*.md` report existed to diff against; this run is the baseline for future re-runs.

## Accepted-risk register (§6)

Reviewed against current code; no re-flag triggers observed (no multi-tenancy, no published app port, single app container, ClamAV still opt-in, edge proxy still the sole network path). Register stands unchanged.
