# Cutover, abort, communications & hypercare run sheet (H3 / H7)

Names in ALL-CAPS are filled by the owner before the change window; the sheet
is rehearsed on prod-parity (including one forced abort) before go-live.

## Roles

| Role | Name |
|---|---|
| Deployer | ____ |
| Migration owner | ____ |
| Go/no-go chair | ____ |
| Rollback decision owner | ____ |
| Support rota (hypercare) | ____ |

## Timed sequence

| T | Step | Verify |
|---|---|---|
| T-2d | Freeze point: no merges to `main`; H0 manifest is the deployable | manifest digest recorded |
| T-1d | Fresh off-host DB+vault backup taken **and verified** (manifest slot `off_host_backup_verified`) | remote drill assertion passes |
| T-0 | Analyst notification: window, expected downtime, status channel | message sent |
| T+0 | Deploy by digest (LAUNCH_PHASE1 §4) — compose pull/load `caos-app@sha256:882efb…`, migrations run on boot under the advisory lock | app healthy |
| T+15m | LAUNCH_PHASE1 §5 checklist, every box | checklist archived |
| T+30m | Go/no-go: chair reviews §5 results + error stream | decision recorded |
| T+30m→T+3d | **Hypercare**: support rota watches G7 alerts + error logs; thresholds below | daily note in status channel |

## Abort / rollback (rehearse once before go-live)

Trigger: any §5 box unpassable, error threshold breached, or migration abort
threshold hit (recorded in the manifest rehearsal slot).

1. `docker compose down app` (edge serves the maintenance response).
2. Redeploy the **previous** recorded digest; if the schema moved, restore the
   T-1d backup into the live DB per DR_RUNBOOK (this is the one restore that
   overwrites live data — rollback owner's explicit call).
3. Verify §5 health/identity/durability boxes on the restored state.
4. Analyst notification: rollback + next window.

## Thresholds

- Error: any sustained 5xx above 0.5% of requests over 10 min, or any data
  integrity signal → rollback owner paged.
- Success: 3 days of hypercare with zero unexplained 5xx and no wrong-read
  reports → hypercare ends, evidence reviewed and archived (PD-09 bundle).
