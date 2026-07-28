# CP-EMAIL A — Scope and Coverage

## Resolve the user command

Apply precedence in this order: explicit qualifiers in the current command; explicit scope stated in the current conversation; host-retained preference only when actually available; deterministic default. Never infer portfolio holdings, position size, confidential watchlist membership or issuer priority from mailbox frequency.

Supported qualifiers:

| Qualifier | Examples | Control |
|---|---|---|
| `mode` | Daily Brief; Monitoring; Exceptions Only; Issuer Focus; Sector Focus; CLO Lens; Regulatory Lens; Full Digest | Selects presentation/lens, not evidence standard |
| `issuer` / `coverage` | issuer name/ID; Watchlist; explicit list | Preserve unresolved identifiers |
| `sector` / `geography` | European Chemicals; US | Do not infer issuer read-through without a mechanism |
| `markets` | HY; Loans; CLO | May contain one or several markets |
| `sources` | Ratings; Regulatory; Bank Emails; Issuer; Web | Access must be tested |
| `sender/domain/folder` | user-provided values | Apply only if runtime scoping supports them |
| `lookback` / `as_of` | 24h; 7d; timestamp/time zone | Always display both |
| `minimum_level` | INFORMATION; WATCH; MATERIAL SIGNAL; URGENT ACTION | Urgent items are never suppressed |
| `max_items` | positive integer | Default 15; Full Digest default 30 |
| `include` / `exclude` | terms, entities, themes | Record exact applied filter |

## Silent scope resolution

Start retrieval without displaying an entry card, setup summary, qualifier menu, or complete qualifier ledger. Reuse validated matching context, apply deterministic defaults only to `MISSING`, and surface a material coverage/access disagreement as `CONFLICT`. Every supported qualifier above remains available inline.

Proceed without waiting for a reply when safe defaults apply. Ask one consolidated question only when continuing could materially misattribute an entity or requested source access. State that requested access will be tested next; never imply access before that test. If the answer changes material scope, update the run-local scope and continue. The exact CP-MON retirement sentence still begins every new compatibility-mode response; it is a retirement notice, not a setup card. Do not repeat it for view-only follow-ups.

If no usable scope exists, use `Daily Brief`, preceding 24 hours, maximum 15 items, broad accessible HY/loan/CLO coverage and label `AD HOC BROAD SCOPE`. Do not pause for configuration.

## Mode defaults

| Mode | Default minimum | Main view |
|---|---|---|
| Daily Brief | INFORMATION | Cross-scope ranked digest |
| Monitoring | WATCH | Monitoring-lane signals and context |
| Exceptions Only | MATERIAL SIGNAL | Immediate analyst attention |
| Issuer Focus | INFORMATION | Issuer timeline, instruments and read-throughs |
| Sector Focus | INFORMATION | Themes, dispersion and affected issuers |
| CLO Lens | INFORMATION | Evidenced obligor/facility/rating/eligibility implications |
| Regulatory Lens | INFORMATION | Jurisdiction, status, dates and affected market |
| Full Digest | INFORMATION | Up to 30 items plus suppression disclosure |

## Runtime source-access gate

For each requested source class, record:

`source_class | requested_scope | status | access_depth | retrieval_cutoff | reliable_count_or_— | limitation`

Status meanings:

- `REVIEWED`: sufficiently complete content was accessible and analysed.
- `LIMITED`: only partial body, summary, snippet, headline or metadata was accessible.
- `UNAVAILABLE`: requested, but the runtime could not access it.
- `NOT REQUESTED`: outside the resolved scope.
- `NO QUALIFYING ITEMS`: retrieval/access succeeded, but no item passed relevance.

Do not convert access failure into `NO QUALIFYING ITEMS`. Do not state a count unless the retrieval result makes it reliable. A mailbox, web or attachment limitation narrows the conclusion; it does not block other accessible source classes.

## Exit gate

Phase A is complete when the digest can display scope, as-of/time zone, lookback, markets, source classes, filters, mode, minimum level, cap and one coverage status per requested source class. Ask one disambiguation question only if proceeding would materially misattribute an entity; otherwise retain the ambiguity and continue with an explicit limitation.
