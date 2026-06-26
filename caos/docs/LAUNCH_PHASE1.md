# CAOS — Phase-1 Launch Runbook (self-hosted Docker)

**Profile:** Durable internal pilot · **Target:** self-hosted Docker stack
(`caos/deploy/`) · **Ships from:** `main` (EDGAR engine stack + DM/loans
re-model integrated via #13/#14; trunk migrated 2026-06-16) · **Last updated:**
2026-06-17

Step-by-step instruction to stand CAOS up for the first real internal pilot —
3–5 credit analysts doing live work, data that survives restarts. Databricks is
no longer the target; this runs the same single-process app on any Linux host
with Docker. Companion docs: [deploy/README](../deploy/README.md) ·
[SECURITY](SECURITY.md) · [AUDIT](AUDIT.md).

> **Execution rule.** Do the steps in order. Every box in §5 (Post-deploy
> verification) must pass before you hand the URL to an analyst. If any box
> fails, stop and follow §7 (Rollback).

---

## 0. What Phase-1 is — and is not

**Is:** the lean engine slice (CP-0 → CP-1/1A/1B/1C → CP-2, peers, scenarios,
NL query, EDGAR covenant lane, CP-5 QA gate) as a **single container** — one
process serves `/api` (FastAPI) and the static Next.js UI at `/`. Durable:
**Postgres** for the DB, a **Docker volume** for the document vault,
**Anthropic** for live chat/synthesis, **EDGAR** on. **Demo seed OFF** — the
registry starts empty and analysts onboard their own issuers. Auth is provided
by **oauth2-proxy** (Google Workspace OIDC) behind **Caddy** (TLS), which
together reproduce the edge-auth trust model Databricks used to give us.

**Is not:** the multi-service agent/governance mesh in `V2_REDEPLOY_PLAN.md` /
`CAOS_Master_Blueprint.md` (Celery, pgvector, MS Graph, JWT, Redis) — that stack
does **not** exist and is not part of this launch. Treat those docs as
aspirational.

**Carried-forward limits** (accepted for an internal pilot — see §8): single-team
authorization, parts of Deep-Dive/Report Studio still render seeded mock overlaid
by live runs, dev-chain `npm audit` advisories.

---

## 1. Preconditions — code & quality gate

All green **before** you provision the host.

1. **The analytical stack is already integrated on `main`.** The EDGAR engine
   slice (CP-0 → CP-5C) and the DM/loans re-model were merged via #13 and #14
   (2026-06-15); the old `feat/edgar-cp1` lane is folded in and retired, and the
   `caos-app` branch was fast-forwarded into `main` (now the sole trunk). Just
   sync to the merged tip:
   ```bash
   cd caos
   git checkout main && git pull
   ```
   Confirm CI ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)) is
   green on `main`: frontend lint + `tsc --noEmit` + vitest + `next build`,
   and server pytest. (Green as of the `#13`/`#14` merge commits.)

2. **Re-run the gate locally** (mirrors CI; the image build also type-checks):
   ```bash
   cd caos/frontend && npm ci && npm run lint && npx tsc --noEmit && npm test && npx next build
   cd ../.. && caos/server/.venv/bin/python -m pytest caos/tests/server -q
   ```
   **Do not** run `npm audit fix --force` — it downgrades Next.js (AUDIT D-1).

3. **Host & access:**
   - A Linux host with **Docker Engine + Compose v2** (`docker compose version`).
   - A **DNS name** for the host with ports **80 + 443** reachable (Caddy
     auto-provisions a Let's Encrypt cert). Internal-only host with no public
     DNS → use `tls internal` per [Caddyfile](../deploy/Caddyfile).
   - A **Google Cloud OAuth 2.0 client** (Web application) for your Workspace.

---

## 2. Provision auth & config (one-time)

### 2.1 Google OAuth client
Google Cloud Console → **APIs & Services → Credentials → Create OAuth client ID
→ Web application**. Set the authorized redirect URI to
`https://<CAOS_DOMAIN>/oauth2/callback`. Capture the **Client ID** and
**Client Secret**.

### 2.2 EDGAR User-Agent
SEC fair-access **requires** a descriptive contact string or every request is
403-ed (the `/api/edgar` routes 503 until it's set), e.g.
`Atlas Credit Research research@atlas.example`. No key, no cost.

### 2.3 Fill in `.env`
```bash
cd caos/deploy
cp .env.example .env
openssl rand -base64 32        # → OAUTH2_PROXY_COOKIE_SECRET
```
Set in `.env`: `CAOS_DOMAIN`, `POSTGRES_PASSWORD` (long random),
`ANTHROPIC_API_KEY`, `EDGAR_USER_AGENT`, `CAOS_EMAIL_DOMAIN` (restricts sign-in
to your Workspace), `OAUTH2_PROXY_CLIENT_ID` / `_SECRET`, and the cookie secret.
**Never commit `.env`.**

> **Why these matter:** `CAOS_DEMO_SEED=false` + `ENVIRONMENT=production`
> (both fixed in the stack) mean the identity gate fails closed, no demo issuers
> are seeded, and state lives in the Postgres + vault volumes — external to the
> container, so rebuilds/restarts never wipe pilot work. Postgres self-migrates
> on boot (`alembic upgrade head`), so a fresh DB needs no manual schema step.

---

## 3. (Config is in the repo)

Unlike the old Databricks path, there is no `app.yaml` to hand-edit — the durable
profile is baked into [`deploy/docker-compose.yml`](../deploy/docker-compose.yml)
(demo seed off, Postgres `DATABASE_URL`, vault volume, EDGAR on) and the
[`deploy/Dockerfile`](../deploy/Dockerfile). Review them once; everything
deployment-specific is driven from `.env` (§2.3).

---

## 4. Build & deploy

```bash
cd caos/deploy
docker compose up -d --build
docker compose logs -f app      # expect: "CAOS starting (environment=production)"
```

Caddy provisions TLS on first request to `https://<CAOS_DOMAIN>`. The build
compiles the Next.js export and bakes it into the image, so there is no separate
frontend build step.

---

## 5. Post-deploy verification — launch checklist

Run every check. All must pass before the URL goes to analysts. `$APP` =
`https://<CAOS_DOMAIN>`.

- [ ] **Health.** `curl -s $APP/api/health` returns
  `{"status":"ok","version":"2.0.0","llm":"configured"}`. `llm:"configured"`
  confirms the Anthropic key is wired (not `demo-fallback`).
- [ ] **Sign-in works & is domain-restricted.** Visiting `$APP` redirects to
  Google; an in-domain account lands in CAOS; an out-of-domain account is denied.
- [ ] **Identity gate fails closed.** A request straight to the app, bypassing
  the proxy, is **401**:
  ```bash
  docker compose exec app python -c "import urllib.request as u; u.urlopen('http://127.0.0.1:8000/api/auth/me')"
  # → urllib.error.HTTPError: 401
  ```
- [ ] **Header spoofing is blocked.** A request to `$APP` carrying a forged
  `X-Forwarded-Email: attacker@evil.com` is **not** honored (Caddy strips it;
  oauth2-proxy sets identity from the session).
- [ ] **Edge credential enforced (W1).** `EDGE_PROXY_SECRET` is **required** in
  production — the app fails closed at boot without it. A direct, un-proxied hit
  to the app with forged identity but no edge secret is **401**:
  ```bash
  docker compose exec app python -c "import urllib.request as u; \
    u.urlopen(u.Request('http://127.0.0.1:8000/api/auth/me', headers={'X-Forwarded-Email':'a@evil.com'}))"
  # → HTTPError 401  (forged identity rejected: no valid X-Edge-Authorization)
  ```
  Then confirm the **legitimate path still works** (sign in at `$APP`, load a
  page). That proves oauth2-proxy forwards Caddy's `X-Edge-Authorization` to the
  app. If sign-in succeeds but every page 401s, the header is **not** passing
  through — inject it at oauth2-proxy instead of Caddy. The secret is required, so
  disabling it is not an option; the passthrough must be fixed.
- [ ] **Container hardening holds.** `docker compose ps` shows `app` and
  `oauth2-proxy` **healthy** under their read-only rootfs. If `app` crash-loops on
  a write outside `/vault` or `/tmp`, add that path to its `tmpfs:` list in
  `docker-compose.yml`.
- [ ] **Demo seed is OFF.** The issuer registry is **empty** on first load. App
  logs show **no** "CAOS_DEMO_SEED is on in production" warning.
- [ ] **DB durability.** Create an issuer, `docker compose restart app`, reload —
  it's still there. (`docker compose down && up -d` keeps it too; the `db-data`
  volume persists.)
- [ ] **Vault durability.** Upload a document, restart, confirm it's still
  attached and retrievable (`vault-data` volume).
- [ ] **EDGAR lane live.** `GET $APP/api/edgar/search?q=<issuer>&forms=10-K`
  returns filing pointers (not 503); `POST /api/edgar/vault-exhibit` returns
  `chunks_created > 0`, provenance `vaulted`.
- [ ] **Security headers.** A response carries `Content-Security-Policy`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and HSTS.
- [ ] **A real run produces evidence.** Onboard an issuer, attach a document,
  trigger a run; confirm CP-1 output with click-to-source citations and the
  CP-5 QA gate status.
- [ ] **Encryption at rest.** The host disk (or the cloud volume backing it) is
  encrypted — LUKS / cloud provider volume encryption / FileVault. The Postgres
  and vault data live on host-mounted Docker volumes, so at-rest protection is a
  host control, not an app one. TLS in transit is handled by Caddy.
- [ ] **Error monitoring reachable.** `docker compose logs app` streams; force a
  404 (`curl -s $APP/api/does-not-exist`) and confirm it's visible. Unhandled
  exceptions log with method/path/caller (`main.py` `log_unhandled`).
- [ ] **Performance smoke.** `python caos/tests/perf/smoke.py --url $APP/api/health`
  passes (p95 under threshold, no errors) at the expected concurrency.

---

## 6. Day-one expectations for the pilot team

- The workspace **starts empty** (demo seed off). Each analyst onboards their own
  issuers, attaches documents (upload or EDGAR-vault), and triggers runs.
- **Single team, shared workspace:** everyone can see and edit every issuer —
  there is no per-issuer access control (by design; SECURITY §2).
- Some Deep-Dive / Report Studio panels show **illustrative seeded values
  overlaid by live-run output**; the live numbers carry provenance and
  click-to-source (mock-vs-engine gap, AUDIT A-1).
- Chat and synthesis are **live** (Claude); EDGAR covenant retrieval is **on**.

---

## 7. Rollback / abort

1. **Roll back code:** `git checkout <last-good-commit> && docker compose up -d --build`.
2. **Config-only faults** (wrong DB URL, missing secret, EDGAR 503, OAuth
   redirect mismatch): fix `.env` / the OAuth client and
   `docker compose up -d` again. No data migration needed — schema self-applies.
3. **Data is safe:** Postgres and the vault live in named volumes external to the
   app container, so rebuilds/rollbacks never touch pilot data. **Back up first**
   (see [deploy/README](../deploy/README.md) Operations) — `pg_dump` + a vault
   tarball are the only durable state.
4. **Full stop:** `docker compose down` (volumes persist) or
   `docker compose down -v` (**destroys** DB + vault — intentional reset only).

---

## 8. Operational posture & known limits

| Ref | Item | Posture for the pilot |
|-----|------|-----------------------|
| S-4 | No per-issuer / row-level authorization | Acceptable — single coverage team, one workspace. |
| §1 | Header-based identity trusts the proxy | Safe **only** because the app has no published port and Caddy strips client `X-Forwarded-*`. Never publish the app port. |
| A-1 | Mock-vs-engine gap (some UI seeded, overlaid by live runs) | Trust the provenance/click-to-source numbers; flag any panel that lacks them. |
| DATA-1 | `metric_facts` run-derived rows | **Resolved** — each completed run prunes the issuer's older run rows to the latest (`test_retention.py`); seed facts kept. Fine at scale. |
| D-1 | `npm audit` advisories in the **dev/build** chain only | None ship in the static export; never `audit fix --force`. Runtime deps are scanned by Dependabot (`.github/dependabot.yml`). |
| ENC-1 | Encryption at rest | Host control — encrypt the host disk / cloud volume (LUKS / provider encryption). App data lives on host-mounted volumes; TLS in transit via Caddy. Verified in §5. |
| MON-1 | Error monitoring | Log-based: unhandled exceptions logged with context (`main.py` `log_unhandled`); watch `docker compose logs app`. No external APM — by design (no-paid-services). |
| PERF-1 | Performance | Single-process baseline checked by `caos/tests/perf/smoke.py` (p95 gate). Not load-characterised; sized for 3–5 analysts. |
| FB-1 | User feedback loop | Pilot feedback via the team channel + GitHub issues, triaged weekly into the backlog. |
| AB-1 | A/B testing | **N/A** for a single-team pilot — no traffic to split, no cohort metric. Add cohort flags only if a multi-cohort rollout becomes real. |
| SCALE-1 | Scale-out | Single process by design; the Postgres `SKIP LOCKED` run worker (`test_async_runs.py`) already supports horizontal app replicas when load requires. |
| — | On-host backups only | The `backup` service runs daily `pg_dump` + vault tarball with rotation (P7-1). **Copy `/backups` off-host** (rsync / object storage) for host-loss protection. |

---

## 9. Sign-off

Launch is complete when: CI green on `main` (§1) · OAuth client + `.env`
configured (§2) · stack deployed (§4) · **all §5 boxes checked** · backups
scheduled (§7) · pilot team briefed on §6.

| Role | Name | Sign-off |
|------|------|----------|
| Deploying engineer | | |
| Head of Research / QA (CP-5 gate owner) | | |
| PM / CIO | | |
