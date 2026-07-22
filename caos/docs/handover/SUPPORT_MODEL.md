# Support model (H3)

## Intake

| Class | Channel | First response |
|---|---|---|
| Outage (site down, sign-in broken, data loss suspected) | page the platform owner (G7 alert channel) | 15 min during trading hours |
| Wrong read (a number an analyst can refute against the filing) | gap log (F3 process) + Head of Research | same day |
| Defect (broken control, failed upload/run) | issue tracker, `defect` label | 2 business days |
| Request (feature, new issuer class, export) | issue tracker, `request` label | weekly triage |

## Triage & release cadence

- Weekly triage of defects/requests (during Phase F this is the analyst-cohort
  session; post-transfer, the support owner chairs it).
- Wrong reads follow F4: reproduce → hand-verify → promote the case into the
  frozen golden set so the class can never regress silently.
- Releases: from `main` only, digest-pinned, through the LAUNCH_PHASE1
  checklist; no hotfix bypasses H0's freeze discipline — a hotfix is a new
  small candidate with the same manifest procedure.

## Handover-class loops (named owners post-transfer)

| Loop | Cadence | Owner (fill at H5) |
|---|---|---|
| L18 security review (full) | quarterly | ____ |
| L19/L22 restore + off-host drill review | quarterly | ____ |
| Dependabot decision sweep (L14) | monthly | ____ |
| Trivy re-scan vs rebuild trigger (SCAN_DISPOSITION standing condition) | monthly | ____ |
| Golden-set growth review (F4) | monthly | ____ |
