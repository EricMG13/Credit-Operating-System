# Monitoring inventory (H3 / G7)

## In-stack signals (live today)

| Signal | Where | What it tells you |
|---|---|---|
| `GET /api/health` | app, behind edge | `status`, `db`, `llm` (configured vs demo-fallback), per-worker-pool `runs/research/autonomy/reports` state |
| Container healthchecks | `docker compose ps` | app has a HEALTHCHECK; db/clamav have theirs; oauth2-proxy ships none (shows Up, never "healthy" — known) |
| Structured access log | `caos.access` logger | JSON per request: entity, action, status, volume, source, duration |
| LLM call log | `caos.llm` logger | JSON per model call: lane, model, tokens, cost, stop reason, latency |
| Unhandled exceptions | `log_unhandled` (main.py) | method/path/caller for every 500 |
| Backup health files | `/backups/.caos-backup-ok|failed`, sync twins under `/restore` | last cycle result; a failed marker flips the backup container unhealthy |

## G7 requirement — external, CAOS-independent probe (owner action)

The notification path must not depend on CAOS itself. Configure on a separate
vantage (uptime service or a cron on another host):

1. HTTPS probe of `https://<CAOS_DOMAIN>/api/health` (expect 200 + `"status":"ok"`)
   every minute; alert on 2 consecutive failures.
2. Certificate/DNS expiry watch on the domain.
3. Management-plane probe on the host: `docker compose ps --format json`
   asserting app+db+clamav healthy, disk ≥20% free, backup ok-file fresher
   than `BACKUP_INTERVAL_SECONDS × 2`.
4. Delivery: the enterprise paging/mail channel; test an induced failure and
   record acknowledgement (the H3 package stores that evidence).

Store sanitized probe config + one alert-delivery proof in this directory
when configured (per L21).

## Error-rate alerting via Monitor (G2, dogfood)

Once the C3 flag is enabled on the target, a watch rule over the app's own
5xx/log signal is the dogfood path (plan §G2); until then the external probe
above is the alerting spine.
