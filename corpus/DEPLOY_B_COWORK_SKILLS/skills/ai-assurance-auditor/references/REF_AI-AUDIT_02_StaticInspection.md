# AI-AUDIT 02 — Static inspection

## Inspection principle

Static inspection proves that a control is present or absent. It does not prove the model will follow the control. Record E1 unless a separate deterministic validator supports E2.

## Lanes

### 1. Package and identity

- Valid asset type, frontmatter/manifest, unique routing description, version, file paths, references, platform limits, and no unresolved placeholders.
- No mixed versions, duplicate control authorities, broken relative paths, hidden secrets, unsupported capability claims, or stale instructions.

### 2. Purpose and human governance

- Purpose, permitted/prohibited uses, users, recipients, owners, human-review points, fallback, change control, expiry, monitoring, and incident route.
- High-impact decisions/actions cannot be delegated solely to model judgment.

### 3. Instruction integrity

- Priority and conflicts are clear; external content is untrusted; missing data stays missing; uncertainty and refusal boundaries are explicit.
- Critical controls are salient, repeated only when necessary, and cannot be disabled by target content.

### 4. Knowledge and retrieval

- Sources have authority, provenance, dates, locators, access boundaries, update owners, duplicate/conflict treatment, and poisoning controls.
- Private text is not leaked into public search or unauthorised outputs.

### 5. Data and privacy

- Inventory sensitivity, client/mandate segregation, information barriers, retention, logs, output recipients, model-data handling, and deletion policies.
- Flag client data, holdings/orders, confidential research, credentials, personal data, and MNPI-sensitive material.

### 6. Permissions and actions

- Map read/write/send/share/delete/export functions and the identity used downstream.
- Enforce least functionality, least privilege, least autonomy, parameter validation, downstream authorisation, human confirmation, rate limits, and audit logging.

### 7. Evidence and analytical contract

- Separate facts, calculations, assumptions, interpretations, and recommendations.
- Require source, locator, as-of date, entity/perimeter, currency/unit/period, conflicts, limitations, and confidence basis for material outputs.

### 8. Output and downstream handling

- Validate schemas, required disclosures, approved-version controls, safe rendering, no executable output handling, and no unique material result confined to chat.

### 9. Reliability and efficiency design

- Capability/source/tool failure, timeouts, retries, loop/budget caps, partial results, recovery, rollback, model updates, telemetry, and operator effort.
- Efficiency controls do not reduce evidence or safety requirements.

## Static finding record

For each issue record:

`finding_id | lane | control_id | artifact/locator | observed text/configuration | why it matters | evidence level | severity | required test or fix`

Do not silently edit the asset. The optimisation plan may provide replacement text or configuration as a proposed fix, clearly separated from the audited version.

## Capability map

Produce:

`User → AI asset → model → knowledge/source → connector/tool → downstream system → output → recipient → log/reviewer`

For each edge state data classification, permission, action, trust boundary, authorisation control, and evidence source.
