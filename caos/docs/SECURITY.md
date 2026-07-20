# CAOS — Security Model & Trust Assumptions

How CAOS authenticates, authorizes, and protects data, and the boundaries of
its current threat model. Companion to [AUDIT.md](AUDIT.md). Last reviewed
2026-07-20; the release-specific evidence and blockers are in
[PRE_DEPLOYMENT_UPDATE_2026-07-20.md](qa/reports/PRE_DEPLOYMENT_UPDATE_2026-07-20.md).

## 0. 2026-07-20 release-security delta

- The request-policy path now uses a consolidated raw-ASGI
  `HTTPPolicyMiddleware`, removing the measured latency amplification of four
  stacked `BaseHTTPMiddleware` layers. Postgres pools are explicit and bounded
  per worker (20 persistent + 5 overflow by default); the intended two-worker
  maximum therefore reserves at most 50 application connections against the
  default 100-connection database budget. These are capacity protections, not
  substitutes for authorization or target telemetry.
- The current server+stress+cohort aggregate produced **2,594 passed / 15
  skipped** in the restricted lane. Seven AV fake-socket cases were sandbox
  denials; the entire nine-case AV file passed unrestricted, giving effective
  current evidence of **2,601 passed / 15 skipped**.
- Explicit `LIVE`/`REFERENCE` UI modes improve data-authority disclosure. They
  do not change storage custody: original bytes are vaulted; structured work
  product is in Postgres; unsaved drafts/preferences can be in browser storage;
  logs and recovery copies use operator-controlled stores.
- The application does not itself prove encryption at rest for the target DB,
  vault volume, logs, or backup media. Release remains blocked on the target's
  encryption, least privilege, retention/legal-hold, paired-backup freshness
  and alerting, and remote-only restore evidence (PD-08/L26).

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

**Single shared coverage desk by default; optional team isolation.**
`CAOS_TENANCY_ENABLED=false` keeps the original one-team workspace: issuers are
shared inside the admitted SSO group. When enabled, `team_id` plus the helpers in
[tenancy.py](../server/tenancy.py) scope the issuer-derived spine and make
unsupported aggregate lanes fail closed rather than leak cross-team rows. Null-team
issuers remain explicitly shared/global. This is tested, but target team assignment
and the complete route matrix must be re-proved by L26 before multi-team release.

**Runs are analyst-attributed.** Cross-analyst run sharing is a separate explicit
deployment choice and defaults off (`CAOS_CROSS_ANALYST_RUN_SHARING_ENABLED=false`).
Do not infer permission to read another analyst's work merely because both people
belong to the same team.

**Server roles are authoritative; UI role views are not.** `Analyst.role` is
resolved into the signed-in server identity. Read-only/viewer variants are rejected
by `require_write_role` on covered domain mutations. Committee requests require
analyst/admin and approval requires QA/admin, with separation-of-duties rules in
[committee.py](../server/routes/committee.py). The frontend `role_view` preference
only changes presentation and never grants authority. The mutation-role rollout is
substantial but must still be checked route-by-route at release; a legacy write route
without the server guard is an authorization defect, not an accepted UI convention.

**Remaining boundary:** CAOS does not yet implement arbitrary per-issuer ACLs or
licensed-data entitlements within one team. Before Bloomberg, multi-team MNPI, or
externally shared workspaces activate, define the entitlement source and either map
it to the team/issuer checks or add a narrower ACL. Until then those integrations
remain deployment-gated.

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
  (`MAX_UPLOAD_MB`, default 250), **magic-byte MIME sniff** (PDF / OOXML),
  and **path-traversal-safe storage** — the filename is sanitized and the
  storage key is UUID-prefixed, so a hostile filename can't escape the vault.
  `run_mode` is validated against an allow-list. The production Compose stack
  requires a **ClamAV scan**
  ([avscan.py](../server/avscan.py), `CLAMAV_HOST`) streams every upload to clamd
  before it is parsed or vaulted; a signature hit is rejected (422) and a
  configured-but-unreachable scanner **fails closed** (503); production startup
  also fails closed when no scanner host is configured. Local development may
  leave `CLAMAV_HOST` empty, where scanning is an explicit no-op.
- **Market price workbooks** ([market_xlsx.py](../server/market_xlsx.py),
  [market_import.py](../server/routes/market_import.py)) accept `.xlsx` only and
  are gated by `CAOS_MARKET_XLSX_V2_ENABLED` plus lineage v2. Preview scans and
  validates without writing. Commit requires the signed, analyst-bound preview
  token, re-scans and re-parses the same workbook bytes, and writes the raw
  workbook, immutable snapshot, normalized instruments, rejection ledger and
  lineage in one failure-cleaned transaction. The parser rejects macros,
  embedded/query/external content, unsafe ZIP members, expansion bombs,
  excessive workbook dimensions, ambiguous mappings, future/inconsistent
  market dates and required formula cells without finite cached values. It never
  calculates formulas or substitutes upload time for market as-of. Issuer links
  are exact FIGI matches or explicit analyst mappings only; fuzzy borrower-name
  matching is prohibited. New snapshots and source documents are analyst-owned,
  foreign identifiers return 404, and disabling the flag retains their evidence.
- **Document parsing** uses a spawned child process with a configured hard
  deadline; timed-out PDF/XLSX work is terminated rather than continuing in an
  unkillable thread. `openpyxl` remains read-only and package limits apply before
  workbook parsing. Scanned/empty documents vault with an explicit zero-chunk warning.
- **Report editing** ([ReportDoc.tsx](../frontend/src/components/reports/ReportDoc.tsx)):
  `contentEditable` leaves sanitize paste to plain text and cap length; React
  escapes rendered text, so analyst edits cannot inject markup.

## 5. Data custody, vault, backups & secrets

The document vault is **not** the only application store and must never be
described that way:

| Record class | Canonical location | Security/durability contract |
|---|---|---|
| Original uploaded documents and committed source workbooks | `CAOS_STORAGE_DIR` vault volume | AV/format/path guards before durable use; target volume encryption, access control, backup |
| Issuers, metadata, extracted chunks/lineage | Postgres in production | DB TLS/credentials/least privilege, encryption-at-rest proof, retention, backup |
| Runs, claims/evidence, facts, QA, alerts, decisions, models, reports, research jobs | Postgres | Server authz/tenancy, retention/legal hold, paired backup and restore |
| Session state | Secure signed cookie + analyst row | `Secure`/`HttpOnly`/`SameSite`, expiry and token-version revocation; secret rotation |
| UI preferences and unsaved chat/model/report/research state | Browser local/session storage | Principal-change clearing is implemented; this state is not a durable vault record and may be lost with the tab/profile |
| Access/application logs | Host/container log path | Operator-owned collection, redaction, access and retention |
| Backup copies | Local artifacts + optional rclone remote | Postgres dump and vault archive are one recovery set; encrypt, alert on age/failure, and prove remote-only restore |

SQLite is a local-development default; any deployed environment refuses it and
requires Postgres. The application does not itself encrypt the host's Docker volume
or Postgres data files. Full-disk/volume/database encryption and remote-backup
encryption are deployment controls and remain release blockers until proven on the
target host. Backup scripts and an rclone service demonstrate mechanism, not that a
fresh encrypted off-host recovery point exists.

Provider credentials are environment/Docker-secret inputs and are not committed.
`ANTHROPIC_API_KEY`, OpenRouter/Gemini credentials, database passwords, edge secret,
and backup credentials must be scoped and rotated operationally. Missing model keys
degrade eligible lanes to deterministic fixture behavior. More importantly,
`CAOS_DOCUMENT_EGRESS_ENABLED` defaults **false**: provider availability is not
permission to transmit issuer documents, analyst notes, or derived work product.
Activation requires data-classification, DPA/residency/retention, entitlement, and
approved-use evidence.

The 2026-07-18 scans found no confirmed committed credential; six archive findings
were documentation/config-name false positives. That is useful hygiene, not proof of
runtime secret safety. L18 and L26 own the release evidence.

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

## 8. Threat-model boundaries and release limits

- A compromised Caddy/oauth2-proxy host or stolen production secret remains outside
  the application's ability to contain; sole ingress, header stripping, secret
  storage, patching, and monitoring are host controls.
- Team tenancy exists, but arbitrary within-team per-issuer entitlements do not
  (see §2). Licensed market data and multi-team MNPI cannot activate without a
  policy-to-code entitlement map.
- Rate limits, queue caps, parser/upload caps, and provider timeouts exist. Most are
  process-local, so a two-worker deployment can multiply effective allowances;
  target capacity and edge controls must be calibrated to process topology.
- Browser storage is a non-authoritative convenience/recovery layer, not the vault.
  Unsaved work can be lost and must not be represented as committee-durable.
- Application-level encryption of Postgres/vault files is not provided. Target
  at-rest and backup encryption must be evidenced operationally.
- The indexed GitNexus PDG/taint layer was unavailable during the 2026-07-18 audit;
  absence of a reported taint flow was not counted as a security pass.

These boundaries are acceptable only for the approved internal deployment profile.
L26, G8, and G9 are non-waivable before release because they prove the actual target
configuration, storage custody, isolation, and recoverability.
