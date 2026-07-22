# Accepted-risk register (H3) — for H5 signature

Each row is a deliberate, recorded acceptance. Sign-off column completes at H5.
**Pre-filled 2026-07-22 (name + date, DRAFT):** tick each `☐`→`☑` to accept the
row, or strike a row you do not accept, then commit — the commit is the
signature. Rows tied to target controls (8, 9, 10) may wait until the target
host is named.

| # | Risk | Decision & rationale | Compensating control | Owner sign-off |
|---|---|---|---|---|
| 1 | 66 HIGH/CRITICAL OS CVEs in the app image, **all with no fixed version** in Debian trixie | Accept with monitoring — no upgrade exists; exposure bounded by runtime posture | [SCAN_DISPOSITION.md](../qa/release/strict-h0-3b66da67adea/SCAN_DISPOSITION.md): non-root, deny-by-default context, ClamAV-before-parse, rebuild trigger on any parser-group fix | ☑ Eric Guei, 2026-07-22 |
| 2 | Team-shared mutation scope ("IDOR" within one team) | By design for a single-team pilot deployment — all analysts are one desk | Roles-lite write gates; audit trail (E3) post-freeze; revisit at multi-team | ☑ Eric Guei, 2026-07-22 |
| 3 | Cross-worker rate limiter and locks assume ≤2 processes on one host | Envelope enforced at boot (`WEB_CONCURRENCY≤2`); scaling beyond requires re-design | Boot guard + capacity artifact | ☑ Eric Guei, 2026-07-22 |
| 4 | Phase-1 market data is fixed/manual (Bloomberg deferred to H4 activation) | Product decision RT-2026-07-22-788/789 | Provenance labels on every RV surface; manual XLSX lane; [BLOOMBERG_ACTIVATION_RUNBOOK.md](../reference/BLOOMBERG_ACTIVATION_RUNBOOK.md) | ☑ Eric Guei, 2026-07-22 |
| 5 | Email alert transport not built (in-app delivery only) | Allowed-outstanding item #1; render-intent contract frozen and proven | [EMAILSINK_SPEC.md](../reference/EMAILSINK_SPEC.md); Monitor in-app inbox is the live channel | ☑ Eric Guei, 2026-07-22 |
| 6 | Scanned-PDF ingestion depends on the OCR fallback chain; no-OCR hosts produce 0 chunks | OCR lane shipped (D1) with provenance stamps; hosts must install the OCR dependency per deploy image | D1 golden + provenance visible to the analyst | ☑ Eric Guei, 2026-07-22 |
| 7 | CP-SR sector dashboards deferred post-pilot (S0–S5) | RT-790/791; honest unavailable states shipped | CP_SR_IMPLEMENTATION_PLAN.md ready for pickup | ☑ Eric Guei, 2026-07-22 |
| 8 | oauth2-proxy container reports Up (no upstream healthcheck) | Upstream image limitation | External G7 probe covers the sign-in path end-to-end | ☐ (target — G7) Eric Guei, ______ |
| 9 | Availability/RPO/RTO: single-host stack; RPO = backup interval (default daily + off-host sync), RTO = restore-drill time | Pilot-scale decision; DR rehearsed | [DR_RUNBOOK.md](../reference/DR_RUNBOOK.md), G8 drill evidence | ☐ (target — measured RPO/RTO) Eric Guei, ______ |
| 10 | E2 roles-lite: legacy read routes ungated by role (writes gated); no admin UI panel yet | Single-team pilot; write-path is the money path | `require_write_role` on mutating handlers; procedure in ADMIN_GUIDE | ☑ Eric Guei, 2026-07-22 |
