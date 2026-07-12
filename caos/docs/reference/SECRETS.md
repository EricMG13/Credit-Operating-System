# Secrets Runbook — CAOS (E4)

Written 2026-07-12. One row per secret the deployed stack consumes: where it
lives, what reads it, how to rotate, and the blast radius of a leak. The
"never in logs" property is enforced by
`caos/tests/server/test_secret_log_hygiene.py` (CI, offline): the app is
booted with sentinel values in every secret and the captured application log
stream must never contain any of them.

Boot posture: production boots **fail closed** without `SESSION_SECRET`,
`EDGE_PROXY_SECRET`, and `ANALYST_SIGNUP_CODE` (guards in `main.py:47-87`,
tested in `test_audit_p0_fixes.py`). Never weaken those guards to "warn".

## Inventory

| Secret | Consumed by | Purpose | Rotation procedure | Leak blast radius |
|---|---|---|---|---|
| `SESSION_SECRET` | FastAPI app (`main.py` guard; analyst-profile cookie signing) | Signs the in-app analyst identity cookie | Generate (`python -c "import secrets;print(secrets.token_urlsafe(32))"`), update `caos/deploy/.env`, `docker compose up -d app`. All analysts re-select their profile (sessions invalidate — that is the point). | Forged analyst identity **inside** the OAuth boundary (single-team workspace) — low, but rotate immediately. |
| `EDGE_PROXY_SECRET` | Caddy (injects header) + FastAPI (constant-time check) | Proves a request traversed the edge proxy; blocks direct-to-app forwarded-identity spoofing | Generate a new value, update **both** consumers in `.env` (compose passes it to caddy + app), `docker compose up -d caddy app` in one deploy. | Bypass of forwarded-identity trust if an attacker can also reach the app port — rotate + check firewalling. |
| `ANALYST_SIGNUP_CODE` | FastAPI (profile creation gate) | Gates new analyst-profile creation | Pick a new private value, update `.env`, restart app, tell the team out-of-band. Existing profiles unaffected. | Unwanted profile creation inside the OAuth boundary — nuisance-level; rotate. |
| `POSTGRES_PASSWORD` | Postgres + app `DATABASE_URL` | DB auth | `ALTER USER caos WITH PASSWORD '<new>'`, update `.env` (both the var and any inlined `DATABASE_URL`), restart app. Verify backups still restore (`restore_drill`, G1). | Full data access for anyone who can reach the DB port (compose network only) — rotate + audit. |
| `OAUTH2_PROXY_CLIENT_SECRET` | oauth2-proxy | OIDC client credential (Google) | Rotate in the Google Cloud console (create new credential, update `.env`, restart oauth2-proxy, then delete old). | Phishable OAuth client — rotate at provider; sessions unaffected. |
| `OAUTH2_PROXY_COOKIE_SECRET` | oauth2-proxy | Encrypts the proxy session cookie | Generate per oauth2-proxy docs (32-byte base64), update `.env`, restart proxy. All users re-login. | Session cookie forgery at the edge — rotate immediately. |
| `ANTHROPIC_API_KEY` | app LLM lanes | Anthropic API | Rotate in the Anthropic console; update `.env`; restart app. Keyless boot degrades to fixture/deterministic lanes — the app stays up during rotation. | Token spend + prompt exfiltration on the vendor account — rotate at vendor, check usage logs. |
| `OPENROUTER_API_KEY` | app LLM lanes (DEFAULT hybrid) | OpenRouter/DeepSeek | Same pattern as Anthropic. | Same. |
| `GEMINI_API_KEY` | app LLM lanes (optional) | Gemini | Same pattern. | Same. |
| `BACKUP_SYNC_CMD` | `backup.sh` off-host sync hook | May embed remote credentials (rsync target, object-store key) | Treat any credential inside the command as its own secret: rotate at the remote, update `.env`. Never echo the command in cron logs. | Off-host backup destination compromise — rotate remote creds, verify backup integrity. |
| *(future, C5)* Bloomberg credentials | Settings → Market Data (admin-gated) | Market-data entitlement | Enters the inventory when C5 lands: stored server-side, masked in UI, admin-only under E2, never logged (extend the sentinel test). | Entitlement misuse — vendor-side rotation. |

Non-secrets deliberately excluded: `EDGAR_USER_AGENT` (contact string, not a
credential), model names, ports.

## Rules

1. **Never log a secret value.** The sentinel test is the guard; if you add
   a new secret, add it to the sentinel list in
   `test_secret_log_hygiene.py` in the same PR.
2. **`.env` is the only home** on the host (`caos/deploy/.env`, mode 600,
   never committed — `.env.example` carries names only). No secrets in
   compose files, code, or docs.
3. **Rotation is a deploy, not an edit** — every rotation ends with the
   affected container(s) restarted and a smoke check (login + one run).
4. gitleaks runs per-PR in CI (`security` job) and blocks committed secrets;
   treat any hit as a rotation event for that secret, not just a revert.
