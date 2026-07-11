# CAOS — self-hosted Docker stack

Runs CAOS on a single Linux box with Docker, replacing the Databricks App.
One container serves the API + UI; Postgres holds state; oauth2-proxy provides
the edge auth that Databricks used to give us; Caddy terminates TLS.

```
Caddy (TLS, :443)  →  oauth2-proxy (auth)  →  app (FastAPI + UI)  →  db (Postgres)
                                                      │
                                                   vault volume
```

All five services (db, app, oauth2-proxy, caddy, backup — plus the opt-in
clamav profile) are free / OSS. Only the Anthropic API carries usage cost
(and is optional — without a key, chat/synthesis fall back to demo replies).

## Prerequisites

- A Linux host with **Docker Engine + Compose v2** (`docker compose version`).
- A **DNS name** pointing at the host, ports **80 + 443** reachable (for Caddy's
  Let's Encrypt cert). Internal-only? See the note in [Caddyfile](Caddyfile).
- A **Google Cloud OAuth client** (Web application) for your Workspace, with
  authorized redirect URI `https://<CAOS_DOMAIN>/oauth2/callback`.

## Quick start

```bash
cd caos/deploy
cp .env.example .env
# Fill in: CAOS_DOMAIN, POSTGRES_PASSWORD (URL-safe charset), ANTHROPIC_API_KEY,
# EDGAR_USER_AGENT, CAOS_EMAIL_DOMAIN, OAUTH2_PROXY_CLIENT_ID / _SECRET, plus the
# three app secrets production refuses to boot without:
python -c "import secrets;print(secrets.token_urlsafe(32))"   # → EDGE_PROXY_SECRET
python -c "import secrets;print(secrets.token_urlsafe(32))"   # → SESSION_SECRET
# ANALYST_SIGNUP_CODE → pick a PRIVATE code (placeholders are refused at boot)
openssl rand -base64 32      # → OAUTH2_PROXY_COOKIE_SECRET

docker compose up -d --build
docker compose logs -f app   # watch boot: "CAOS starting (environment=production)"
```

The app self-migrates on boot (`alembic upgrade head`), so a fresh Postgres
needs no manual schema step. Open `https://<CAOS_DOMAIN>` — you'll be sent
through Google sign-in, then into CAOS.

## Verify

```bash
# Health (open route) — expect status ok, llm "configured" if the key is set.
curl -s https://$CAOS_DOMAIN/api/health

# Identity gate fails closed: a request that bypasses the proxy and sends no
# identity must be 401 (run against the app container directly, not the domain).
docker compose exec app python -c "import urllib.request as u; \
  print(u.urlopen('http://127.0.0.1:8000/api/auth/me').status)"   # → HTTPError 401
```

In the browser, confirm: empty issuer registry (demo seed off), an upload
survives `docker compose restart app`, and EDGAR search returns pointers.

## Operations

| Task | Command |
|------|---------|
| Update to a new build | `git pull && docker compose up -d --build` |
| Restart the app only | `docker compose restart app` |
| Tail logs | `docker compose logs -f app` |
| Inspect backups | `docker compose exec backup ls -lh /backups` |
| Ad-hoc DB dump (same format as the service) | `docker compose exec db pg_dump -U caos -Fc caos > caos-$(date +%F).dump` |
| Stop everything | `docker compose down` (volumes persist; `down -v` destroys DB, vault **and backups**) |

Backups are AUTOMATED: the `backup` service writes a daily `pg_dump -Fc`
(pg_restore-able) + a vault tarball to the `backups` volume with rotation — no
cron needed on the host. Copy `/backups` OFF the host (rsync / object storage)
for host-loss protection; the restore drill lives in
[LAUNCH_PHASE1](../docs/LAUNCH_PHASE1.md) Operations. (An earlier version of
this table predated the backup service and taught a plain-SQL dump — that
format needs `psql`, not `pg_restore`; prefer `-Fc` so drills and recovery use
one path.)

## Security notes

- The `app` service has **no published port**; it is reachable only via
  oauth2-proxy on the internal network. Do not add a `ports:` mapping to it.
- Caddy strips client-supplied `X-Forwarded-*` so identity can't be spoofed;
  oauth2-proxy sets them from the authenticated session. This reproduces the
  Databricks edge trust model (SECURITY.md §1) — keep both halves.
- `ENVIRONMENT=production` keeps the app's identity gate failing closed even if
  it were ever reached directly.
- Carried-forward limits (single-team authz, mock-vs-engine overlay) are
  unchanged from the platform build — see [../docs/LAUNCH_PHASE1.md](../docs/LAUNCH_PHASE1.md) §8.
