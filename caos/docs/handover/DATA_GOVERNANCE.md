# Data governance & vendor handling matrix (E8 / H3)

Owner decisions marked ☐ complete at H5 with the data owner's signature.

**Proposed defaults drafted 2026-07-22 (PROPOSED — not signed).** Retention and
legal-hold cells below carry industry-standard defaults for leveraged-finance
records, marked `PROPOSED` for the data owner to confirm or override, then sign.
Two cells are **facts I cannot supply and must not guess** — left `OWNER SUPPLY`:
the vendor **DPA / zero-retention status** (a contract fact) and the **residency
region** (where you actually deploy). Confirming a `PROPOSED` value = change it if
wrong, then it stands; the H5 Data-owner signature ratifies the whole matrix.

## Record classes and custody

| Record class | Store | At-rest protection | Retention | Legal hold | Deletion path |
|---|---|---|---|---|---|
| Source documents (filings, memos, uploads — original bytes) | Vault (`vault-data` volume, content-addressed) | Host/volume encryption (**target control**, LAUNCH §5 box) | Life of coverage + **PROPOSED 7 years** (SEC/tax record standard) | PROPOSED: hold flag suspends all deletion until released; immutable meanwhile | Withdraw endpoint marks superseded; physical deletion is an operator action with a recorded reason |
| Structured work product (runs, facts, claims, models, decisions, alerts) | PostgreSQL (`db-data` volume) | Same host/volume control | IC Decision Records: **append-only, never deleted**; runs/facts: life of coverage + **PROPOSED 7 years** | PROPOSED: hold suspends any purge of the held issuer's rows | Migration-governed; no ad-hoc DML |
| Analyst drafts/preferences | Browser storage (per analyst) | Device control | Ephemeral | n/a | Analyst-local clear |
| Logs (access, LLM calls, errors) | Operator log store | Host control | **PROPOSED 90 days** rolling | PROPOSED: held logs exempt from rotation while a related hold is open | Rotation |
| Backups (DB dumps + vault tarballs) | `backups` volume + **encrypted off-host remote** (rclone) | Local: host control; remote: provider encryption + **PROPOSED rclone-crypt on** | Local `BACKUP_KEEP=7` cycles; remote **PROPOSED 7 years** (matches source class) | PROPOSED: holds propagate — a held backup is exempt from expiry | Rotation script |

## Vendor / egress matrix

| Vendor | What leaves the host | Gate | Contractual note |
|---|---|---|---|
| SEC EDGAR | Nothing (inbound pulls only, keyless) | — | Public data |
| Anthropic / OpenRouter / Gemini | Issuer document excerpts, module outputs, analyst questions — **only when** `CAOS_DOCUMENT_EGRESS_ENABLED=true` | Fail-closed egress opt-in (proven 2026-07-22); per-call token/cost audit log | **OWNER SUPPLY**: confirm each provider's DPA / zero-retention terms (a contract fact) before egress is enabled on the target — the gate stays fail-closed until then |
| Bloomberg (H4, post-activation) | Entitled security identifiers outbound; licensed quotes inbound | Provider chain + credentials in E4 inventory | Licence scope incl. derived-DM storage per [BLOOMBERG_ACTIVATION_RUNBOOK.md](../reference/BLOOMBERG_ACTIVATION_RUNBOOK.md) |
| rclone remote (backups) | Encrypted backup artifacts | `BACKUP_REMOTE` + secret config | **OWNER SUPPLY**: remote bucket region (see residency below) |
| ClamAV signature updates | Nothing outbound but update pulls | egress allow-list entry | Public mirrors |

## Residency & immutable-record policy

- **OWNER SUPPLY** — Residency: single named region for host + backup remote
  (e.g. `eu-west-1`). A fact about where you operate; the standing quarterly
  review checks conformance once set.
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
