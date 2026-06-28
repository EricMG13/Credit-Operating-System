# CAOS Fault Log

Phase-0 triage ledger. CRIT/HIGH block phase exit; MED/LOW stay tracked.

## Severity

| Class | Severity | Meaning |
| --- | --- | --- |
| Correctness | CRIT | Wrong number reaches a committee-facing surface. |
| Correctness | HIGH | Number degrades silently: mock masks failure, NaN leak, silent module gate. |
| Correctness | MED | Right number, wrong or missing provenance/label. |
| Correctness | LOW | Cosmetic or format issue. |
| Resilience | CRIT | Whole app down for all users. |
| Resilience | HIGH | Subsystem DoS, money, or data-loss risk. |
| Resilience | MED | One session degrades but recovers. |
| Resilience | LOW | Cosmetic or extreme-input issue. |

## Convention

Each confirmed fault gets: `id`, class, severity, status, owner, file pointer,
repro, fix, verification. Do not close CRIT/HIGH without a rerun named in
verification.

## Open

| ID | Class | Sev | Status | Fault | Pointer | Verification |
| --- | --- | --- | --- | --- | --- | --- |
## Closed

| ID | Class | Sev | Closed | Fault | Verification |
| --- | --- | --- | --- | --- | --- |
| FL-003 | Correctness | HIGH | 2026-06-28 | Phase-0 golden-master runner availability checked at entry. | `server/.venv/bin/python -m pytest tests/server/golden/test_golden_cp1.py -q` -> 2 passed. |
| FL-004 | Correctness | HIGH | 2026-06-28 | Deep-Dive live run with a missing module could fall back to seeded ATLF output. | `npm test -- ModuleView.test.tsx` -> 1 passed. |
| FL-001 | Correctness | HIGH | 2026-06-28 | Engine surface freeze was not declared; in-flight `.goal/` refinements needed land/defer status. | `caos/docs/qa/ENGINE_FREEZE_PHASE0.md`; `npx tsc --noEmit` -> passed. |
| FL-000 | Correctness | HIGH | 2026-06-28 | Phase-0 silent mock audit was incomplete; issuer-scoped Deep-Dive, Model Builder, Report Studio, rails, and chat could render ATLF seeded output instead of no-data. | `npx tsc --noEmit` -> passed; `npm test -- ModuleView.test.tsx` -> 1 passed. |
| FL-002 | Correctness | MED | 2026-06-28 | VMO2 golden fixture was missing from the sealed set. | `server/.venv/bin/python -m pytest tests/server/golden/test_golden_cp1.py -q` -> 3 passed. |
