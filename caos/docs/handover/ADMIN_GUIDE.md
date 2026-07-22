# CAOS admin guide (H3)

One page; every section links the canonical runbook rather than duplicating it.

## Deploy

- Stack: Caddy → oauth2-proxy → FastAPI app → PostgreSQL (pgvector), ClamAV,
  backup + backup-sync sidecars. Compose file:
  [caos/deploy/docker-compose.yml](../../deploy/docker-compose.yml).
- Deploy procedure, preconditions, and the full post-deploy checklist:
  [LAUNCH_PHASE1.md](../LAUNCH_PHASE1.md) (§4 build/deploy, §5 verification —
  every box, no skips).
- The release is consumed **by digest**: the H0 manifest and compose override
  pin `caos-app@sha256:882efb398526…` plus all third-party digests —
  [strict-h0-cda106dc3973](../qa/release/strict-h0-cda106dc3973/RELEASE_MANIFEST.json)
  and its `docker-compose.digests.yml`. The target never builds from source.
- Rollback: redeploy the previous recorded digest pair (app + schema
  compatibility decision in the manifest). Procedure:
  [LAUNCH_PHASE1.md §7](../LAUNCH_PHASE1.md).

## Environment & secrets

- Inventory (names, storage, rotation — never values):
  [reference/SECRETS.md](../reference/SECRETS.md).
- Boot is fail-closed: missing/weak `EDGE_PROXY_SECRET`, `SESSION_SECRET`,
  `ANALYST_SIGNUP_CODE`, missing `CLAMAV_HOST`, or SQLite-in-production all
  refuse startup with a named error (verified live 2026-07-22, C3 evidence).
- Model-provider keys activate nothing by themselves:
  `CAOS_DOCUMENT_EGRESS_ENABLED=true` is the explicit issuer-data egress
  opt-in ([MODEL_PROVIDER_ACTIVATION_EVIDENCE_2026-07-22.md](../qa/MODEL_PROVIDER_ACTIVATION_EVIDENCE_2026-07-22.md)).

## Feature flags (C14 disposition)

All 13 flag states are recorded in the release manifest; every C14 wave flag
ships **off**. Flip only with a recorded decision; `CAOS_ALERT_RULES_V1_ENABLED`
has a rehearsed on→observe→off rollback
([C3_LIVE_OPERATION_EVIDENCE_2026-07-22.md](../qa/C3_LIVE_OPERATION_EVIDENCE_2026-07-22.md)).

## Backup / restore / DR

- Local cycle + scripted scratch-target drill: `caos/deploy/backup.sh`,
  `restore_drill.sh` (drill every `BACKUP_RESTORE_DRILL_EVERY` cycles).
- Off-host: `backup_sync.sh` (rclone upload + remote-download drill every
  `BACKUP_REMOTE_RESTORE_DRILL_EVERY` syncs). Configure `BACKUP_REMOTE` +
  rclone secret before go-live; the H gate requires one remote-only restore
  with local copies deleted.
- Full DR walkthrough: [reference/DR_RUNBOOK.md](../reference/DR_RUNBOOK.md).

## Scaling & capacity

- Envelope: **two** uvicorn workers max (`WEB_CONCURRENCY≤2`, enforced at
  boot), bounded DB pool, 4g app memory limit. Measured profile:
  [qa/perf/PRE_DEPLOYMENT_CAPACITY_2026-07-22.md](../qa/perf/PRE_DEPLOYMENT_CAPACITY_2026-07-22.md)
  and the 300-user fault-remediation history in `qa/perf/`.
- Scale only after re-running L25 on the new envelope.

## Roles & access

- Identity: Google OAuth (oauth2-proxy, domain-restricted) → forwarded
  principal → in-app analyst profile (invite-code registration).
- Roles-lite: `Analyst.role` column gates mutating routes via
  `require_write_role`; assignment procedure = update the analyst row (admin
  UI panel is E2's remaining scope; until then, a recorded SQL change by the
  platform owner is the procedure).

## Monitoring

[MONITORING_INVENTORY.md](MONITORING_INVENTORY.md) — health endpoints, log
streams, the G7 external-probe requirement, and alert-delivery expectations.
