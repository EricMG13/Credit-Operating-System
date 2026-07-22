# Data governance & vendor handling matrix (E8 / H3)

Owner decisions marked ☐ complete at H5 with the data owner's signature.

## Record classes and custody

| Record class | Store | At-rest protection | Retention | Legal hold | Deletion path |
|---|---|---|---|---|---|
| Source documents (filings, memos, uploads — original bytes) | Vault (`vault-data` volume, content-addressed) | Host/volume encryption (**target control**, LAUNCH §5 box) | Life of coverage + ☐ years | Immutable while a hold flag exists ☐ | Withdraw endpoint marks superseded; physical deletion is an operator action with a recorded reason |
| Structured work product (runs, facts, claims, models, decisions, alerts) | PostgreSQL (`db-data` volume) | Same host/volume control | IC Decision Records: **append-only, never deleted**; runs/facts: life of coverage | ☐ | Migration-governed; no ad-hoc DML |
| Analyst drafts/preferences | Browser storage (per analyst) | Device control | Ephemeral | n/a | Analyst-local clear |
| Logs (access, LLM calls, errors) | Operator log store | Host control | 90 days ☐ | ☐ | Rotation |
| Backups (DB dumps + vault tarballs) | `backups` volume + **encrypted off-host remote** (rclone) | Local: host control; remote: provider encryption + rclone-crypt ☐ | `BACKUP_KEEP` local; remote per policy ☐ | Holds extend to backups ☐ | Rotation script |

## Vendor / egress matrix

| Vendor | What leaves the host | Gate | Contractual note |
|---|---|---|---|
| SEC EDGAR | Nothing (inbound pulls only, keyless) | — | Public data |
| Anthropic / OpenRouter / Gemini | Issuer document excerpts, module outputs, analyst questions — **only when** `CAOS_DOCUMENT_EGRESS_ENABLED=true` | Fail-closed egress opt-in (proven 2026-07-22); per-call token/cost audit log | ☐ DPA / zero-retention terms confirmed by owner before enabling on target |
| Bloomberg (H4, post-activation) | Entitled security identifiers outbound; licensed quotes inbound | Provider chain + credentials in E4 inventory | Licence scope incl. derived-DM storage per [BLOOMBERG_ACTIVATION_RUNBOOK.md](../reference/BLOOMBERG_ACTIVATION_RUNBOOK.md) |
| rclone remote (backups) | Encrypted backup artifacts | `BACKUP_REMOTE` + secret config | ☐ residency decision (remote bucket region) |
| ClamAV signature updates | Nothing outbound but update pulls | egress allow-list entry | Public mirrors |

## Residency & immutable-record policy

- ☐ Residency: single named region for host + backup remote (owner decision).
- Immutable records: IC Decision Records and materialized alert evidence are
  append-only by construction; migrations may add, never rewrite, their rows.
- Production data boundary: beta (Phase F) runs on the production stack with
  real analysts and real issuers **only after** F1's separation decision is
  recorded; QA/scale seeds are refused against non-QA databases by the seeder
  guard (verified live).

## Standing reviews

Quarterly data-owner review: retention conformance, hold register, egress
flag state vs. signed disposition, backup-remote residency — filed with the
support-model loops.
