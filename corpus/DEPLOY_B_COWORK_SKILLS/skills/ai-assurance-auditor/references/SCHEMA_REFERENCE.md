# AI-AUDIT — output schema and QA

## Artifact identity

- Canonical `(B)`: `[AssetKey]_AI-AUDIT_[YYYYMMDD].md`
- Human `(A)`: `[AssetKey]_AI-AUDIT_[YYYYMMDD].docx`

Author `(B)` first. Validate it before making `(A)`. Word is a copy-only projection; no new finding, number, qualification, or decision may appear only in `(A)` or chat.

## Required YAML frontmatter

```yaml
audit_id: AIA-YYYYMMDD-NNN
asset_key: ExampleAsset
asset_name: Example Agent
asset_type: prompt|skill|declarative_agent|agent_package
asset_version: v1
asset_hash: sha256-or-unavailable
platform: Microsoft 365 Copilot
business_owner: name-or-role
governance_owner: name-or-role
risk_tier: 1|2|3|4
assurance_score: 0
recommendation: Ready for Governance Review|Ready with Conditions|Not Ready|Insufficient Evidence
highest_severity: None|Low|Medium|High|Critical
evidence_level_summary: E0|E1|E2|E3|E4|Mixed
analysis_date: YYYY-MM-DD
reassessment_due: YYYY-MM-DD|On Material Change|Not Set
limitation_flags: []
```

`asset_hash: unavailable` is permitted only with a limitation and cannot support E3/E4. Do not add a bot-authored approval field.

## Exact H2 sections

1. `## Audit Summary`
2. `## Scope, Tier & Asset Identity`
3. `## Assessment Scorecard`
4. `## Test Evidence & Findings`
5. `## Optimisation & Retest Plan`
6. `## Governance Decision Record`

Use each exactly once and in order.

## Required registers

### Audit Summary

State recommendation, tier, score, evidence maturity, highest severity, critical overrides, principal limitations, and required human reviewers.

### Scope, Tier & Asset Identity

Include asset/version register; file/source/configuration list; purpose and prohibited use; users/recipients; data/capability map; tier-trigger register; invalidated evidence.

### Assessment Scorecard

For every atomic control show: control ID, points available, effectiveness, evidence level/cap, credited effectiveness, points earned, test/evidence reference, and limitation. Show dimension totals, unrounded overall calculation, displayed integer, threshold, evidence floors, and override.

### Test Evidence & Findings

Include test register, unrun-test register, finding register, evidence references, conflicts/corrections, and security/investment/publication observations. Every test has expected and observed result.

### Optimisation & Retest Plan

Include P0–P3 plan, owner, dependency, exact retest, affected regression family, expected control effect, residual risk, and reassessment trigger.

### Governance Decision Record

Emit:

```text
Decision status: Pending Human Decision
Bot recommendation: [controlled recommendation]
Required reviewers: [roles]
Decision owner: [role]
Human decision: Not recorded by the Auditor
Conditions/restrictions: [if any]
```

The model never inserts `Approved` on behalf of a reviewer.

## Word projection order

Header → Audit Summary → Scope/Tier/Identity → Scorecard → Evidence/Findings → Optimisation/Retest → Governance Decision → one Audit Appendix containing detailed test, finding, evidence, limitation, and residual-risk registers.

## Validation checklist

- [ ] Asset identity is single, frozen, and consistent.
- [ ] Required fields parse and controlled values are exact.
- [ ] Tier triggers support the highest selected tier.
- [ ] Tier 4 inherits Tier 3.
- [ ] Control weights total 100; arithmetic recomputes.
- [ ] Evidence caps and floors are enforced.
- [ ] Critical override matches recommendation.
- [ ] Every finding/test/evidence reference resolves.
- [ ] Unrun tests remain unrun and affect evidence status.
- [ ] Six H2 sections occur exactly once and in order.
- [ ] Decision remains `Pending Human Decision`.
- [ ] `(A)` and `(B)` findings and numbers are identical.

If specialised validation/projection tooling is unavailable, disclose that limitation and return `Insufficient Evidence`; do not silently reuse a CP-module schema validator.
