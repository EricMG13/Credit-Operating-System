# CAOS — Security Model & Trust Assumptions

How CAOS authenticates, authorizes, and protects data, and the boundaries of
its current threat model. Companion to [AUDIT.md](AUDIT.md). Last reviewed
2026-06-14.

## 1. Authentication & identity

**Platform-managed, edge-terminated.** CAOS has no in-app login. On Databricks
Apps every request is authenticated at the platform edge (workspace OAuth); the
verified identity arrives as forwarded headers (`X-Forwarded-User`,
`X-Forwarded-Email`, `X-Forwarded-Preferred-Username`), surfaced by
[identity.py](../server/identity.py) and reflected at `/api/auth/me`.

**Fail-closed gate.** A request with no identity headers means the platform edge
was bypassed. [identity.py](../server/identity.py) rejects it (401) when either
`ENVIRONMENT == "production"` **or** `DATABRICKS_APP_PORT` is set — and the
platform always injects `DATABRICKS_APP_PORT`, so the gate fails closed on the
platform even if `ENVIRONMENT` was left unset. The permissive local-dev identity
(`local-dev`) is returned **only** for genuine local runs (no port, non-prod).

**Trust assumption (S-3).** In production the app *trusts* the `X-Forwarded-*`
headers. This is safe **only because the Databricks edge is the sole network
path to the app** — the platform sets these headers and a client cannot reach
the app directly to spoof them. **If CAOS is ever exposed on a network path that
bypasses the edge, header-based identity becomes spoofable (impersonation).**
Any non-Databricks deployment must put an equivalent authenticating proxy in
front and strip/replace client-supplied `X-Forwarded-*` headers.

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

TLS is terminated at the Databricks edge.

## 4. Input handling

- **Uploads** ([ingest.py](../server/ingest.py)): incremental **size cap**
  (`MAX_UPLOAD_MB`, default 250), **magic-byte MIME sniff** (PDF / OOXML / OLE),
  and **path-traversal-safe storage** — the filename is sanitized and the
  storage key is UUID-prefixed, so a hostile filename can't escape the vault.
  `run_mode` is validated against an allow-list.
- **Document parsing** is best-effort and exception-swallowing (`pypdf`,
  `openpyxl` read-only) — hostile/scanned files vault without crashing the app.
  Parsing untrusted documents is an inherent surface, bounded by the size cap.
- **Report editing** ([ReportDoc.tsx](../frontend/src/components/reports/ReportDoc.tsx)):
  `contentEditable` leaves sanitize paste to plain text and cap length; React
  escapes rendered text, so analyst edits cannot inject markup.

## 5. Data & secrets

- DB is SQLite by default (ephemeral) or Lakebase/Postgres via `DATABASE_URL`.
  Documents live in a local vault dir or a Unity Catalog Volume
  (`CAOS_STORAGE_DIR`).
- `ANTHROPIC_API_KEY` is read from the environment / a Databricks secret; absent,
  chat and synthesis degrade to deterministic demo/fixture output. **No secrets,
  databases, or vault contents are committed** (`.gitignore` covers them).

## 6. Dependencies

`npm audit` advisories are confined to the **dev/build toolchain** (vitest →
vite → esbuild); `npm ls --omit=dev` confirms none ship in the production static
export, and the project runs tests headlessly (no exposed dev server). Tracked
in [AUDIT.md](AUDIT.md) D-1.

## 7. Demo seed

`CAOS_DEMO_SEED` (on in [app.yaml](../server/app.yaml) for the POC) seeds 3 demo
issuers + the ATLF reference deal on boot — idempotent (skipped once the registry
is non-empty), and the app logs a WARNING when it runs in production. **Set it
`false` for any real (non-demo) deployment.**

## 8. Threat-model boundaries (explicit non-goals today)

- Multi-tenant isolation / per-issuer authorization (see §2).
- Defense against a compromised Databricks edge or a deployment that bypasses it
  (see §1).
- Rate limiting / abuse controls beyond the upload size cap.

These are conscious boundaries for a single-team internal tool, recorded so a
future multi-tenant or external-exposure requirement starts from a clear baseline.
