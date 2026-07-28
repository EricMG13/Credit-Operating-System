# SYSREF CP-EMAIL — Source Authority and Independence

Authority is claim-specific. A source can be authoritative about its own action or observation while remaining secondary commentary about an issuer event. Authority informs evidence confidence; it does not set priority by itself and is never converted into a public composite materiality score.

## Source hierarchy

| Tier | Source role | Authoritative for | Limits |
|---|---|---|---|
| 1 — Primary authority | Regulator, court, official registry, issuer filing/release, executed legal document, rating-agency publication | Own decision, filing, terms, disclosed figures or rating action/methodology | Management characterisation remains attributed; legal meaning may require CP-4 |
| 2 — Direct market evidence | Timestamped licensed/official price, spread, CDS, loan or exchange data | Observed instrument/benchmark value at stated time | Requires instrument, units, timestamp and benchmark where applicable; price is not cause |
| 3 — High-quality independent reporting | Reputable financial news with attributable reporting; established deal/restructuring database | Reported event/context and independently developed facts | Distinguish original reporting from syndication and unnamed-source claims |
| 4 — Specialist commentary | Bank/broker research, rating-news summaries, sector/trade publications, market colour | The author's analysis, forecast or observed commentary | Not issuer-confirmed fact; disclose private commentary and conflicts of interest when evident |
| 5 — General/unverified | General news, blogs, social/forums, unattributed rumour | Discovery lead only | Cannot independently support `MATERIAL SIGNAL` or `URGENT ACTION` |

Bloomberg, Reuters and similar services are classified by content role: direct licensed market observation is Tier 2; original attributable reporting is Tier 3; a headline/snippet is access-limited regardless of publisher. A rating-news email summarising an agency action is not the agency publication unless that publication is itself accessible.

## Email-wrapper rule

Email delivery does not change source authority. A forwarded issuer filing remains one issuer evidence family; ten bank emails repeating one rating action remain one underlying action plus distinct commentary families only where their analysis genuinely differs. The sender count is not corroboration.

An accessible bank email is primary evidence of that bank's stated view. It is secondary evidence for the underlying issuer fact until independently verified. Attribute numerical forecasts to the bank and never label them issuer guidance.

## Independence test

Sources are independent only when their origin or evidence basis is materially separate. Record `evidence_family` using the earliest identifiable origin. Different URLs, senders, newsletters or publication times do not establish independence when all trace to one wire, press release, filing or rumour.

For confirmation beyond `WATCH`, require sufficiently complete evidence and either:

- one Tier 1 source directly supporting the event; or
- one Tier 2 source directly supporting only an observed market datum, provided instrument identity, measure/units, timestamp, locator and benchmark where applicable are complete; or
- multiple genuinely independent, credible sources whose accessible content supports the same atomic claim.

The Tier-2 exception proves the observation, not its cause. It cannot independently prove an issuer event, causal explanation, default/recovery conclusion or `URGENT ACTION`; those require separate sourced mechanics.

Unresolved contradictions lower confidence and remain visible. Never count silence, inaccessible content or duplicate copies as support.

## Access-depth overlay

Authority and access depth are separate. `HEADLINE ONLY`, `SNIPPET`, `METADATA ONLY` or `INACCESSIBLE` content supports only what is visible. A high-authority publisher name cannot repair inaccessible content. Headline/snippet-only items are capped at `WATCH` absent independent sufficiently complete confirmation.

## Source citation minimum

Every displayed material source includes source/publication, event/publication timestamp as available, access depth and link or mailbox locator. Every material figure additionally carries entity, period/as-of, unit/currency and perimeter. If any element cannot be supported, omit the figure or mark `[Insufficient Information]` and name the gap.
