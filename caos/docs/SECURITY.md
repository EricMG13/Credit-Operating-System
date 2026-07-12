# CAOS — Security Model & Trust Assumptions

How CAOS authenticates, authorizes, and protects data, and the boundaries of
its current threat model. Companion to [AUDIT.md](AUDIT.md). Last reviewed
2026-06-22.

## 1. Authentication & identity

**Two layers: edge SSO (network gate) + in-app profile (app identity).** On the
self-hosted stack ([LAUNCH_PHASE1](LAUNCH_PHASE1.md)) every request is first
authenticated at the edge by **oauth2-proxy** (Google Workspace OIDC) behind
**Caddy** (TLS); the verified identity arrives as forwarded headers
(`X-Forwarded-User`, `X-Forwarded-Email`, `X-Forwarded-Preferred-Username`). On
top of that, each analyst holds a **code-gated in-app profile**
([routes/auth.py](../server/routes/auth.py)): a shared access code mints a named
profile whose id is stamped on every run and whose initials show across the UI.
The profile is the app-level identity, surfaced by
[identity.py](../server/identity.py) and reflected at `/api/auth/me` (`source` =
`profile` | `proxy` | `local`).

**Profile bound to the verified SSO identity.** When `X-Forwarded-Email` is
present, the profile is keyed on it: a caller can only ever resolve to their own
profile (rename allowed, impersonation not — a display name already held by
another email is refused). So the self-chosen name can't diverge from the
verified person. The access log ([access_log.py](../server/access_log.py)) keeps
using the verified `X-Forwarded-*` identity as the security principal.

**Cookie integrity (S-5).** The profile rides a `caos_analyst` cookie signed
(HMAC-SHA256) with `SESSION_SECRET`. **Production refuses to start** if
`SESSION_SECRET` is unset or the dev default ([main.py](../server/main.py)) —
otherwise the public default would let anyone forge a login cookie. The
edge-origin check (below) runs *before* cookie resolution, so a cookie cannot be
used to bypass the proxy-origin proof. Brute-forcing the access code is throttled
per source IP and a wrong code returns 401 (so the access-log brute heuristic
catches it).

**Fail-closed gate.** A request with no profile cookie and no identity headers
means the edge was bypassed. [identity.py](../server/identity.py) rejects it (401)
whenever `ENVIRONMENT` is anything other than `development` (`config.is_deployed`)
— a typo or unset value fails closed, and the Docker stack bakes in
`ENVIRONMENT=production`. So the gate fails closed in production. The permissive
local-dev identity (`local-dev`) is returned **only** for genuine local runs
(`ENVIRONMENT=development`).

**Trust assumption (S-3).** In production the app *trusts* the `X-Forwarded-*`
headers. This is safe **only because the auth proxy is the sole network path to
the app** — Caddy strips any client-supplied `X-Forwarded-*` and oauth2-proxy
re-sets them from the verified session, and the app container publishes no port a
client could reach directly (both verified in [LAUNCH_PHASE1](LAUNCH_PHASE1.md)
§5). **If CAOS is ever exposed on a path that bypasses the proxy, header-based
identity becomes spoofable (impersonation) — never publish the app port.**

**Edge-origin proof (`EDGE_PROXY_SECRET` / `X-Edge-Authorization`).** Network
isolation is additionally *enforced*, not just assumed: Caddy strips any
client-supplied `X-Edge-Authorization` and injects the shared
`EDGE_PROXY_SECRET` on every proxied request ([Caddyfile](../deploy/Caddyfile));
an app-level middleware ([main.py](../server/main.py)) rejects every deployed
`/api/*` request (except `/api/health`) whose header does not match
(constant-time compare). Production **refuses to start** without the secret. So
a rogue container on the internal network hitting `app:8000` directly with
forged identity headers is denied even though it is "inside" the network. This
section is the reference the Caddyfile / compose / config comments cite.

## 2. Authorization

**Single-team model — by design (S-4).** Every authenticated analyst can read
and write every issuer, run, and document. There is **no row-level / per-issuer
authorization**. This is a deliberate fit for the intended use (one coverage
team sharing one workspace), not an oversight.

**If the threat model expands to multiple tenants / least-privilege**, add:
an ownership/ACL column on `issuers` (and cascade to runs/documents), a
`Depends`-level check that the caller may access the requested `issuer_id` in
each route ([issuers.py](../server/routes/issuers.py),
[runs.py](../server/routes/runs.py), [ingestion.py](../server/routes/ingestion.py)),
and tenant scoping on every query. Until that requirement is real, it is left
unbuilt rather than guessed.

## 3. Transport & response headers

Single process: FastAPI serves the JSON API and the static Next.js export on the
same origin (no CORS surface). A middleware in [main.py](../server/main.py) sets,
on every response:

- **Content-Security-Policy** — `default-src 'self'` with `'unsafe-inline'` for
  script/style (a static export cannot carry a per-request nonce), `object-src
  'none'`, `base-uri`/`form-action`/`frame-ancestors 'self'`, and
  `connect`/`img`/`font 'self'`. Relax `frame-ancestors` only if the app must be
  embedded cross-origin.
- **X-Content-Type-Options: nosniff**, **Referrer-Policy:
  strict-origin-when-cross-origin**, **Strict-Transport-Security** (HSTS).

TLS is terminated at the edge proxy (Caddy on the self-hosted stack).

## 4. Input handling

- **Uploads** ([ingest.py](../server/ingest.py)): incremental **size cap**
  (`MAX_UPLOAD_MB`, default 250), **magic-byte MIME sniff** (PDF / OOXML / OLE),
  and **path-traversal-safe storage** — the filename is sanitized and the
  storage key is UUID-prefixed, so a hostile filename can't escape the vault.
  `run_mode` is validated against an allow-list. An **optional ClamAV scan**
  ([avscan.py](../server/avscan.py), `CLAMAV_HOST`) streams every upload to clamd
  before it is parsed or vaulted; a signature hit is rejected (422) and a
  configured-but-unreachable scanner **fails closed** (503). Off by default
  (single trusted coverage team); enable it via the `av` compose profile when the
  team or the data sensitivity grows. This is the control this section previously
  conditioned upload-safety on — it is now built and wired, gated to opt-in.
- **Document parsing** is best-effort and exception-swallowing (`pypdf`,
  `openpyxl` read-only) — hostile/scanned files vault without crashing the app.
  Parsing untrusted documents is an inherent surface, bounded by the size cap.
- **Report editing** ([ReportDoc.tsx](../frontend/src/components/reports/ReportDoc.tsx)):
  `contentEditable` leaves sanitize paste to plain text and cap length; React
  escapes rendered text, so analyst edits cannot inject markup.

## 5. Data & secrets

- DB is SQLite by default (ephemeral) or Postgres via `DATABASE_URL` (the
  self-hosted stack runs Postgres). Documents live in a local vault dir / Docker
  volume (`CAOS_STORAGE_DIR`).
- `ANTHROPIC_API_KEY` is read from the environment (injected from the deploy's
  `.env`, never committed); absent,
  chat and synthesis degrade to deterministic demo/fixture output. **No secrets,
  databases, or vault contents are committed** (`.gitignore` covers them).

## 6. Dependencies

`npm audit --audit-level=high` on the current lockfile returns 0 vulnerabilities
at every severity (last checked 2026-07-10). Historically, advisories here were
confined to the **dev/build toolchain** (vitest → vite → esbuild); `npm ls
--omit=dev` confirms none ship in the production static export, and the project
runs tests headlessly (no exposed dev server). Tracked in [AUDIT.md](AUDIT.md) D-1
(now Resolved).

## 7. Demo seed

`CAOS_DEMO_SEED` seeds 3 demo issuers + the ATLF reference deal on boot —
idempotent (skipped once the registry is non-empty). In any deployed context the
app **refuses to boot** with the seed enabled ([main.py](../server/main.py)
fail-closed guard — it no longer merely warns). The self-hosted stack fixes it
**`false`**; leave it unset for any real (non-demo) deployment.

## 8. Threat-model boundaries (explicit non-goals today)

- Multi-tenant isolation / per-issuer authorization (see §2).
- Defense against a compromised edge proxy or a deployment that bypasses it
  (see §1).
- Rate limiting / abuse controls beyond the upload size cap.

These are conscious boundaries for a single-team internal tool, recorded so a
future multi-tenant or external-exposure requirement starts from a clear baseline.
