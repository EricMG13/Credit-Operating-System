# Red-Team Decision Log

Before committing to an architecture, interface, or rollout plan, run a critic pass here first.

## Current Decision

Adopt this repository-local Markdown log, linked from `AGENTS.md`, as the red-team gate for future architecture, interface, and rollout commitments.

## Protocol

1. Builder records the proposed decision and evidence.
2. Critic argues why it is wrong, with one objection per row.
3. Builder fixes and verifies every high-impact weakness, or marks it accepted with a concrete reason.
4. Critic may reopen any unsupported answer.
5. Stop when no high-impact objection remains, or when the same objections repeat for two rounds without new evidence.
6. Do not paste secrets or confidential raw data into this log; reference files, commands, or sanitized excerpts.

## Objections

| ID | Date | Decision / Plan | Objection | Impact | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| RT-2026-07-02-01 | 2026-07-02 | Use `.agent-reviews/redteam.md` as the red-team gate | A hidden repo-local log is easy to miss, so future architecture/interface/rollout work could bypass the critic loop. | High | Resolved | `AGENTS.md` now links to this file in "Red-team decision gate". |
| RT-2026-07-02-02 | 2026-07-02 | Use `.agent-reviews/redteam.md` as the red-team gate | The first log row put `Accepted` under Impact, so the ledger did not actually record objection impact separately from status. | High | Resolved | This table now has separate `Impact` and `Status` fields with concrete values. |
| RT-2026-07-02-03 | 2026-07-02 | Use `.agent-reviews/redteam.md` as the red-team gate | A decision log can tempt agents to paste sensitive plans, data, or secrets directly into review evidence. | Medium | Resolved | Protocol item 6 requires file/command references or sanitized excerpts instead of secrets/raw confidential data. |
| RT-2026-07-02-04 | 2026-07-02 | Use `.agent-reviews/redteam.md` as the red-team gate | No product architecture, interface, or rollout proposal was supplied yet, so this pass cannot approve any substantive CAOS change. | Low | Accepted | The current decision is only the review gate itself; future concrete proposals must add their own objections. |

## Resolved Objections

- RT-2026-07-02-01: Discoverability gap fixed by linking this log from `AGENTS.md`.
- RT-2026-07-02-02: Malformed impact/status evidence fixed by replacing the initial row with explicit `Impact` and `Status` columns.
- RT-2026-07-02-03: Evidence-handling risk fixed by adding a no-secrets protocol rule.

## Accepted Objections

- RT-2026-07-02-04: No substantive CAOS proposal exists in this turn. Accepted because the decision under review is only the gate.

## Critic Reopen Check

Round 2 did not reopen RT-2026-07-02-01 or RT-2026-07-02-02 because the current files contain direct evidence for both fixes. No high-impact objection remains open.

## Stalemate

None.
