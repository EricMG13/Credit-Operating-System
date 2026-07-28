# AI-AUDIT 01 — Intake and risk tier

## Intake register

Capture every field; use `Unknown` rather than inference.

| Group | Required fields |
|---|---|
| Identity | asset_key, name, asset_type, version, content hash if available, platform, model/deployment version |
| Purpose | business objective, supported task, expected output, success criteria, prohibited uses |
| People | creator, business owner, governance owner, users, affected parties, recipients |
| Data | sources, sensitivity labels, client/mandate boundaries, retention, confidential/MNPI-sensitive exposure |
| Capability | knowledge, connectors, tools, memory, read/write/send/share/delete actions, permission identity |
| Decision | decision influenced, materiality, reversibility, human reviewer, time sensitivity |
| Deployment | pilot/production, individual/team/client/external, geography, monitoring, expiry/change triggers |

Freeze the file list and hashes when possible. Record one `asset_version_id`. If files, configuration, permissions, or model change during the audit, mark affected evidence `Invalidated by Version Change`.

## Risk-tier triggers

### Tier 1 — Individual productivity

All must be true: single user; reversible drafting/summarisation; no material decision; no external recipient; no sensitive data beyond the user's authorised ordinary workspace; no write/send/share/delete action.

### Tier 2 — Internal team workflow

Shared internal use with bounded low-to-moderate impact. Outputs remain drafts and do not materially determine investment/commercial decisions. Sensitive data or write actions may elevate testing even if the use stays internal.

### Tier 3 — Investment or commercial decision support

Any material influence on buy/sell/hold, underwriting, valuation, forecast, position size, portfolio construction, risk limit, investment-committee paper, credit/counterparty assessment, commercial negotiation, capital allocation, or monitoring action.

Require a named investment/commercial decision owner and independent human challenge.

### Tier 4 — Client-facing or external

Any output intended or reasonably likely to reach clients, prospects, regulators, auditors, consultants, issuers, counterparties, media, or the public. Within investment management, Tier 4 inherits every Tier 3 control and adds a named compliance/publication owner.

## Highest-trigger decision

List each trigger as `Present`, `Absent`, or `Unknown` with evidence. Choose the highest Present tier. Any Unknown field capable of raising the tier prevents a Ready recommendation until resolved.

## Mandatory evidence floors

| Tier | Ready threshold | Evidence floor |
|---|---:|---|
| 1 | 75 | E1 for every applicable control; E2 for confidential-data or permission controls |
| 2 | 80 | E2 for every applicable control; E3 for write action, external communication, sensitive data, or cross-team permission |
| 3 | 85 | E4 investment performance; E3 security-critical behaviour |
| 4 | 90 | All Tier 3 floors plus E4 security-critical and publication controls |

Scores never lower the tier. `Ready with Conditions` requires score ≥70, no unresolved critical finding, and restricted pilot use only. It never authorises external publication.

## Execution identity for E3/E4

Require: audit ID, test ID, run ID, timestamp/time zone, exact asset hash or prompt/configuration hash, model/deployment version, source-set identity, permissions snapshot, raw input/output, tool actions, and observer. E4 additionally requires the named independent adjudicator, rubric, decision, and corrections.

Unverified, edited, partial, or mixed-version transcripts remain E0/E1 supplied evidence and receive no E3/E4 credit.
