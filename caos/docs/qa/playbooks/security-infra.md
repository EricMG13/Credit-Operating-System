# Security Audit Playbook — Edge, Identity, Infrastructure Hardening

## 1. Objective and trust boundaries

**Objective:** prove the CAOS security chain still holds end to end. You are a Sonnet 5
audit agent. Re-run this goal on every PR and before every deploy; scope the PR pass to
the delta but run the full gate pre-deploy. Assess and report only: do not exploit, fix,
probe production, or change repository, deployment, or data state. Scanners/tests may
use isolated temporary state; never use the live stack.

The self-hosted Docker stack is Caddy (TLS) → oauth2-proxy (Google Workspace OIDC) →
FastAPI → Postgres ([SECURITY.md](../../SECURITY.md), [AUDIT.md](../../AUDIT.md)). The app trusts
forwarded identity headers **only because** the edge is the sole network path and proves
itself with an injected secret; every invariant below defends that single assumption or
one of the input surfaces around it. A broken link means forged analyst identity on a
platform holding credit work product — committee-facing and MNPI-adjacent.

Trust boundaries to audit against:

- **B1 Internet → Caddy**: TLS termination; strips all client-supplied identity headers; injects `X-Edge-Authorization` from `EDGE_PROXY_SECRET` ([Caddyfile](../../../deploy/Caddyfile)).
- **B2 Caddy → oauth2-proxy**: the only identity setter — Google OIDC session → `X-Forwarded-User/-Email/-Preferred-Username` ([oauth2-proxy.cfg](../../../deploy/oauth2-proxy.cfg)). Only `GET /api/health` skips auth.
- **B3 proxy → app**: app publishes no port (the compose network named `internal`, no app `ports:`); [identity.py](../../../server/identity.py) trusts headers only after the edge-secret proof; signed `caos_analyst` cookie layers app identity on top.
- **B4 app → outbound**: EDGAR fetches (`*.sec.gov` only), LLM APIs, clamd. Fetched/uploaded content is untrusted input.
- **B5 analyst uploads → vault**: hostile-document surface (parse + optional ClamAV).

Rules of engagement: static/read-only analysis, scanners, and offline tests. Do not send
requests to a production host or start/stop/reconfigure the user's stack. If runtime proof
is required, mark it `BLOCKED — isolated QA stack required`; do not improvise against live.

## 2. Scope discovery — run fresh every audit

The surface moves; never audit from a stale list.

```bash
# Auth surface: routes, router mounts, edge exemptions, identity dependencies.
rg -n '@router\.(get|post|put|patch|delete)' caos/server/routes --glob '*.py'
rg -n 'include_router|Depends\((get_identity|get_write_identity)|skip_auth' \
  caos/server/main.py caos/server/routes caos/deploy/oauth2-proxy.cfg

# Read these security cores in full every run; do not trust old line numbers.
wc -l caos/server/{identity,passwords,rate_limit,access_log,avscan,config,main}.py \
  caos/server/routes/auth.py

# Headers the app reads vs headers the edge strips — these two lists must reconcile (§3.1)
rg -n -i 'x-forwarded|x-edge' caos/server --glob '*.py'
rg -n 'request_header|header_up' caos/deploy/Caddyfile

# Upload/AV/vault entrypoints: every caller-influenced parse or write must scan first.
rg -n -C 4 'UploadFile|File\(|avscan\.scan|ingest\.(extract|store|sniff_)|write_bytes\(' \
  caos/server --glob '*.py' --glob '!**/.venv*/**'

# Deploy/config files, including dotfiles, and dependency/secret-scan manifests.
find caos/deploy -maxdepth 1 -type f -print | sort
find caos -maxdepth 2 -type f \( -name 'Dockerfile*' -o -name '*compose*.yml' \
  -o -name '*compose*.yaml' -o -name 'requirements*.txt' -o -name 'requirements*.lock' \
  -o -name 'package.json' -o -name 'package-lock.json' -o -name '.dockerignore' \) -print | sort
ls .gitleaks.toml .gitleaksignore .github/workflows/ci.yml

# Outbound-fetch surface: any NEW urlopen/httpx/requests site needs an allowlist review (§3.7)
rg -n 'urlopen|httpx\.|requests\.(get|post)|urllib\.request|create_connection|fetch\(' \
  caos/server --glob '*.py' --glob '!**/.venv*/**' --glob '!**/tests/**'

# What CI already gates — this playbook EXTENDS the security job, never duplicates it
sed -n '/^  security:/,/^  [a-z]/p' .github/workflows/ci.yml
sed -n '/^  deploy-assets:/,/^  [a-z]/p' .github/workflows/ci.yml

# Diff scope for a PR run
git diff --name-only origin/main...HEAD -- caos .github .gitleaks.toml .gitleaksignore
```

Diff against the previous report. Every new route, header read, AV/vault path, outbound
fetch, deploy file, scanner exception, or dependency manifest enters scope.

## 3. Coverage checklist — invariants to prove

Each item is an invariant, not a step. PASS = cite the guard in current code; FAIL = a repro or a concrete gap.

**3.1 Edge origin & identity resolution**
- Edge-origin proof runs **before** cookie resolution: `identity.get_identity` checks `X-Edge-Authorization` (constant-time, bytes-mode `hmac.compare_digest`) before reading `caos_analyst` — a cookie can never bypass the proxy-origin proof. The `main.py` middleware enforces the same on every `/api/*` path except `/api/health`.
- Fail-closed identity: no cookie **and** no forwarded headers in a deployed context → 401. `config.is_deployed` counts ANY `ENVIRONMENT != "development"` (typo/unset fails closed). The permissive `local-dev` identity is unreachable when deployed.
- Header reconciliation: every identity-bearing header the app reads is stripped from clients in the [Caddyfile](../../../deploy/Caddyfile) (`X-Forwarded-User/-Email/-Preferred-Username/-Groups/-Access-Token`, `X-Edge-Authorization`). A new header read without a matching strip is HIGH.
- Middleware order is proved from FastAPI registration semantics and tests: the edge guard short-circuits before route/cookie resolution, and its 401 still carries the full security-header set.

**3.2 Cookie integrity & boot refusal**
- `caos_analyst` is HMAC-SHA256-signed (`make_session_token`); verify path rejects tampering, garbage, and — mandatorily — missing/expired `exp` (server-side, not just browser max-age). Signature compare is bytes-mode (non-ASCII cookie can't 500).
- All four credential/demo guards in `main.py` fail closed (`RuntimeError`, keyed on `is_deployed`): `SESSION_SECRET` unset/dev-default; `EDGE_PROXY_SECRET` unset; `ANALYST_SIGNUP_CODE` unset/public placeholder; `CAOS_DEMO_SEED` set. `config.require_sane_environment` also refuses production secrets with the dev sentinel, and `require_postgres_in_production` refuses deployed SQLite. Weakening any guard to warn-only is HIGH.
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
- `401`/`429` remain observable by those feeds; no auth lane changes wrong-credential responses to a status the brute heuristic ignores.

**3.6 SSRF — EDGAR fetches**
- Every fetched URL is validated: `https` + exact `www.sec.gov` host (or the fixed `data.sec.gov`/`efts.sec.gov` constants) + `/Archives/` path for filing docs + explicit userinfo (`@`) rejection; `_http_get` re-checks the **post-redirect** host ends `.sec.gov`. No user-controlled URL reaches any fetcher unvalidated; any new outbound fetch site (§2 grep) needs the same allowlist pattern.

**3.7 Path traversal — upload & EDGAR ingest**
- Stored filenames are sanitized (`[^A-Za-z0-9._-]` → `_`, `Path(...).name` strips directories) and keyed under a server-generated UUID prefix — a hostile filename cannot escape `CAOS_STORAGE_DIR`. Parser temp files use only a derived suffix; request text never chooses their directory or full path.
- Uploads: streaming size cap (413 before buffering past `MAX_UPLOAD_MB`), magic-byte MIME sniff, `run_mode` allow-list.
- EDGAR `file_name` and URL tail are display metadata only; all bytes enter the same `ingest.store` UUID/basename path. No request value is passed to `open`, `Path.write_*`, `FileResponse`, `tar`, or a shell as a path. Rollback deletion accepts only `<32-hex>/<basename>` and proves the resolved path remains under the vault root.

**3.8 Security headers**
- Every response, including edge-guard 401s, carries CSP (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'self'`; `unsafe-inline` is the accepted static-export exception), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS, `X-Frame-Options: SAMEORIGIN`, and the deny-by-default `Permissions-Policy`. No CORSMiddleware exists (same-origin single process) — its introduction is a finding.

**3.9 AV scan — fail-closed both directions**
- With `CLAMAV_HOST` set: signature hit → 422; unreachable/timeout/dropped/oversized-or-garbled reply → **503 fail-closed** (never a silent pass). Unset → documented no-op (accepted, opt-in `av` profile).
- Both ingestion directions are covered: every analyst file lane (documents, memos, portfolio files, model/market workbooks) and every fetched EDGAR exhibit calls `avscan.scan(content)` **before** parser/extractor and any persistent write. A new parse/vault path without that ordering is HIGH when ClamAV is configured.
- Deploy coherence: mounted [clamd.conf](../../../deploy/clamd.conf) keeps `StreamMaxLength`/`MaxScanSize`/`MaxFileSize` (300M) ≥ `MAX_UPLOAD_MB` (250), TCP socket exposed to the app, `LocalSocket` present (clamav 1.x crash-loops without it).

**3.10 Secrets, dependency CVEs, SAST**
- CI's security job is the baseline gate (pip-audit, bandit high/medium, `npm audit --audit-level=high`, gitleaks over full history with `.gitleaks.toml`). This audit re-runs them (§4) and adds what CI cannot: production-reachability triage of every new advisory (`D-1` is resolved; do not inherit its old dev-chain adjudication), lock coherence (`check_lock_sync.py` — prod installs the `.lock`, not the `.txt`), and review of any `.gitleaks.toml`/`.gitleaksignore` addition.
- No secret material in the repo or images: `.env` git-ignored, `ANTHROPIC_API_KEY`/secrets env-injected only, no secret baked into a Dockerfile layer.
- Scanner suppression is itself audited: no new Bandit `# nosec`, gitleaks fingerprint/path allowlist, npm override, or ignored CVE without a cited false-positive/reachability adjudication.

**3.11 Container & deploy hardening**
- [Dockerfile](../../../deploy/Dockerfile): base images digest-pinned (both stages); `pip install --require-hashes` from the lock; drops root (`USER caos`, uid 10001); `ENVIRONMENT=production` baked in; single exposed port; healthcheck hits only unauthenticated `/api/health`.
- [docker-compose.yml](../../../deploy/docker-compose.yml): app has **no `ports:`**; only Caddy publishes 80/443; every service is attached only to the intended compose network; `no-new-privileges` is universal; capabilities, writable mounts/tmpfs, memory/PID limits, and read-only roots are least-privilege and documented per service. Adding Docker socket, host network/PID/IPC, `privileged`, device mounts, or a broad host bind is HIGH.
- Every production image reference is immutable or its mutable-tag risk is explicitly adjudicated; record resolved digests and scan every release/service image for HIGH/CRITICAL OS-package CVEs.
- Effective runtime identity is non-root wherever the process does not require root. Prove the app's `USER caos`; inspect oauth2-proxy, Caddy, Postgres, backup, and clamd image/compose users. Any uid 0 process needs a current, narrow startup reason plus privilege drop/capability containment; “image default” is not proof. For clamd, verify the configured user can update signatures, create its socket/temp files, and read the mounted config without widening permissions.
- [Caddyfile](../../../deploy/Caddyfile): strip list intact (§3.1), edge secret injected via `header_up`, JSON access log on.
- [oauth2-proxy.cfg](../../../deploy/oauth2-proxy.cfg): Google provider + non-wildcard Workspace email domain + exact HTTPS redirect; `pass_user_headers = true`, `pass_access_token = false`, `set_xauthrequest = false`; cookie `secure`/`httponly`/`samesite=lax`/`168h`; `skip_auth_routes` is exactly `GET=^/api/health$` — any widening is HIGH.
- `backup.sh`, `restore_drill.sh`, and new deploy scripts pass shellcheck; backup mounts are least-privilege and vault is read-only; compose validates with `--no-interpolate`; the Caddyfile validates. Review `.env.example` and `.dockerignore` so secrets cannot enter the build context.

## 4. Procedure

Before scanning, read in full and in this order: [SECURITY.md](../../SECURITY.md),
[AUDIT.md](../../AUDIT.md), `identity.py`, `routes/auth.py`, `passwords.py`,
`rate_limit.py`, `access_log.py`, `avscan.py`, `config.py`, the boot/middleware sections
of `main.py`, EDGAR/ingest fetch-write paths, every file under `caos/deploy/` (including
`.env.example`), and the `security`/`deploy-assets` jobs in `.github/workflows/ci.yml`.
Then read §6, [REVIEW_MATRIX_BACKEND.md](../REVIEW_MATRIX_BACKEND.md) BE-7 plus its
adjudicated register, and [REVIEW_MATRIX_SECURITY.md](../REVIEW_MATRIX_SECURITY.md).
Background: [reference/security-and-hardening.md](../../reference/security-and-hardening.md).

Scanners — pin the CI versions so a local pass predicts the CI gate:

Use the current commit's passing `security`, `deploy-assets`, `lock`, and `image` CI jobs
as evidence when available. Otherwise run the exact equivalent commands below; do not
run both merely to duplicate work. Run from repo root and install scanner tools only in
an isolated temporary venv.

```bash
# Python deps vs live OSV data + Python SAST. Local .venvs are excluded because
# CI checks out a clean tree and does not scan installed third-party packages.
SEC_TOOLS="${TMPDIR:-/tmp}/caos-security-tools-2.7.3-1.7.10"
caos/server/.venv311/bin/python -m venv "$SEC_TOOLS"
"$SEC_TOOLS/bin/python" -m pip install pip-audit==2.7.3 bandit==1.7.10
"$SEC_TOOLS/bin/pip-audit" -r caos/server/requirements.txt
# Extension beyond CI: the image installs requirements.lock, including transitive extras.
"$SEC_TOOLS/bin/pip-audit" -r caos/server/requirements.lock
"$SEC_TOOLS/bin/bandit" -r caos/server caos/scripts \
  -x 'caos/server/.venv,caos/server/.venv311' \
  --severity-level high --confidence-level medium

# Frontend dependency tree from the lockfile
(cd caos/frontend && npm audit --audit-level=high)

# Secret scan: full history, redacted output, read-only repo mount
docker run --rm -v "$PWD:/repo:ro" ghcr.io/gitleaks/gitleaks:v8.18.4 \
  detect --source=/repo --config=/repo/.gitleaks.toml --redact --no-banner

# Lock/deploy gates already present in CI
python3 caos/scripts/check_lock_sync.py
shellcheck caos/deploy/*.sh caos/scripts/*.sh
docker compose -f caos/deploy/docker-compose.yml config -q --no-interpolate

# Playbook extension: parse the actual Caddyfile without starting a server
docker run --rm \
  -e CAOS_DOMAIN=caos-audit.invalid -e EDGE_PROXY_SECRET=audit-placeholder \
  -v "$PWD/caos/deploy/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine \
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Pre-deploy only: inspect the already-built release image; do not build/pull/start a stack
for this audit. Set `CAOS_IMAGE` to the exact release digest. If the image or Trivy is
unavailable, mark this gate `BLOCKED`, never silently skip it.

```bash
docker image inspect --format \
  'user={{json .Config.User}} entrypoint={{json .Config.Entrypoint}} health={{json .Config.Healthcheck}}' \
  "$CAOS_IMAGE"
trivy version
trivy image --scanners vuln --severity HIGH,CRITICAL --exit-code 1 "$CAOS_IMAGE"
docker compose -f caos/deploy/docker-compose.yml config --images
docker compose -f caos/deploy/docker-compose.yml config --images | sort -u | \
  while IFS= read -r image; do
    docker image inspect --format \
      'tags={{json .RepoTags}} user={{json .Config.User}} entrypoint={{json .Config.Entrypoint}}' \
      "$image" || exit 1
    trivy image --scanners vuln --severity HIGH,CRITICAL --exit-code 1 "$image" || exit 1
  done
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
  caos/tests/server/test_api.py \
  caos/tests/server/test_audit_p0_fixes.py \
  caos/tests/server/test_security_headers.py \
  caos/tests/server/test_avscan.py \
  caos/tests/server/test_edgar.py \
  caos/tests/server/test_ingest_markitdown.py \
  caos/tests/server/test_vault_memo.py -q
```

Also capture proof from the current CI `server` Postgres leg that
`test_secret_log_hygiene.py` ran and did not skip; do not start a database solely for this
playbook.

Manual review steps, in order:

1. §2 discovery; list every changed file intersecting the surface.
2. Route-gate sweep: map every route to `Depends(get_identity)` or an adjudicated exception (`health.py`; `auth.py` login lanes, which self-guard).
3. Read the four credential/demo guards plus both `config.py` environment/database guards verbatim; confirm they raise, key on the fail-closed predicate, and execute before DB/app startup.
4. Reconcile the header read-list vs the Caddyfile strip-list (§3.1 greps).
5. Any new `hmac`/secret comparison: constant-time and bytes-mode, or finding.
6. Any new outbound fetch: allowlist + post-redirect re-check, or finding.
7. Trace every `UploadFile`, `avscan.scan`, persistent file-write, and `ingest.store` caller; prove scan-before-parse/write for all upload and EDGAR lanes and prove every filename remains data, never a path.
8. Walk §3.11 against every current deploy file, including `.env.example`; record each service's effective user, capabilities, writable paths, network exposure, and root justification.
9. Review all scanner suppression/allowlist diffs and dependency advisory reachability; never run an automatic `audit fix`.
10. Confirm CI retains all four security scanners plus lock, image-build, shellcheck, and compose-validation gates. A deleted/weakened gate is HIGH.

## 5. Evidence and reporting

Write `caos/docs/qa/audits/security-infra-YYYY-MM-DD.md`:

- **Header**: date, branch, commit, scanner versions, test counts.
- **Gate table** — all must PASS:
  1. Current-commit CI evidence or local §4 scanners clean; every exception adjudicated against §6.
  2. Auth/identity test leg green.
  3. Route-gate sweep: zero ungated routes.
  4. Credential/demo plus environment/database boot guards present and fail-closed.
  5. Header strip-list ⊇ header read-list.
  6. SSRF, path containment, and scan-before-parse/store hold in both ingestion directions.
  7. Deploy files match §3.11; effective users/root carve-outs and writable paths are evidenced.
  8. CI security/deploy/image jobs are intact; pre-deploy release-image CVE scan passes.
- **Findings**: severity, `file:line`, invariant broken (§3 reference), failure scenario, suggested fix. Severity gates: **HIGH** = identity forgery / auth bypass / SSRF / secret exposure / a fail-closed guard weakened — blocks merge and deploy. **MED** = defense-in-depth regression with compensating control — blocks deploy until adjudicated. **LOW** = hygiene/doc-rot — filed, never blocking.
- **Refute-first adversarial verification, every candidate before it is filed**: attempt to prove the finding wrong — re-read the guard and its callers, check §6 and both review matrices for prior adjudication, and write the concrete failure scenario (inputs → wrong outcome). Agent severity inflation is the documented failure mode in this repo; a finding that survives no refutation attempt is reported **UNVERIFIED**, never HIGH. Do not build live exploits — a failure *scenario* argued from code is the required standard of proof.
- File one line per confirmed finding in the tracker the team uses at the time; link the dated report.

## 6. Accepted-risk register — never re-flag

Seeded from [SECURITY.md](../../SECURITY.md) §2/§8 and the REVIEW_MATRIX_BACKEND
adjudicated-accepted register. Re-flag one only if its stated trigger occurs.

| Risk | Why accepted | Re-flag trigger |
|---|---|---|
| Single-team IDOR — no per-issuer/row authz | One trusted coverage team per deploy; roles-lite is the E2 posture | Multi-user entitlement-restricted (Bloomberg/MNPI) data, or multi-tenancy |
| XFF rate-key spoof | First XFF hop may be caller-supplied; the global bucket is the brute-force backstop | App exposed without the edge, or XFF becomes an authorization input |
| Global login-bucket self-DoS | Bounded fail-closed tradeoff against distributed credential spray | External/self-service population where one source can deny all logins |
| Edge-secret / forwarded-header trust (S-3) | Edge is the sole network path; Caddy strips identity headers, oauth2-proxy re-sets them, edge proof is enforced | App port published, bypass route added, or secret/header forwarding removed |
| Compromised edge proxy | Explicit threat-model non-goal (SECURITY.md §8) | Threat model expands |
| In-process limiter/advisory-lock scale | Shipped default is one worker/one app container | `WEB_CONCURRENCY > 1` or app replicas > 1 |
| CSP `unsafe-inline` script/style | Static export cannot carry per-request nonces | SSR/nonce-capable serving |
| Register 409 confirms email existence | Throttled, invite-code-gated; accepted UX tradeoff | External/self-serve signup |
| On-host backup (`backup.sh`) | Pilot posture; off-host is a deploy-phase item | Production data beyond the pilot |
| EDGAR in-process throttle | Same single-process scale assumption | `WEB_CONCURRENCY > 1` or app replicas > 1 |
| No-OCR / limited advanced OCR | Historical REVIEW_MATRIX_BACKEND non-goal; missing richer OCR is a quality/backlog item, not a security finding | OCR subprocess introduces an unsafe path/command boundary |
| ClamAV off by default | Single trusted team; opt-in `av` profile documented and fail-closed once enabled | Team growth or untrusted upload sources |
| `EdgarError → 502 str(exc)` | Curated domain-error messages, deliberately analyst-facing | — |
| Demo/mock seams; PERF-2 bundle size | Phase-1 by design | — |

Anything already marked Fixed/Resolved in AUDIT.md or the review matrices is prior art:
verify the fix is still present, cite it, and do not re-file the original finding.
`D-1` is resolved; do not grandfather future npm advisories. Re-adjudicate new findings
for production reachability instead of running `npm audit fix --force`.
