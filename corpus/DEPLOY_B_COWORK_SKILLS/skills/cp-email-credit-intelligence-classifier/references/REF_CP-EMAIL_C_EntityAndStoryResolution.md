# CP-EMAIL C — Entity and Story Resolution

## Entity perimeter

Resolve only with evidence available in the run. Prefer exact stable identifiers (LEI, CIK, ISIN/CUSIP/FIGI or source-specific issuer/obligor ID), then legal/display names, borrower/instrument references, parent-subsidiary relationships and context. Construct a run-local entity record:

`entity_id_or_unresolved | display_name | legal/borrower name | aliases used | parent | operating entity | finance subsidiary | instrument IDs | sector | geography | resolution basis | confidence/reason`

Distinguish issuer/parent, borrower, guarantor, operating company and finance subsidiary. Do not attribute Ford Credit debt or liquidity to Ford industrial, for example, without an evidenced perimeter bridge. Do not turn sector commentary into an issuer event unless the story states the issuer or the digest provides an explicit, sourced read-through mechanism.

When several candidates remain, keep `UNRESOLVED` or ask one concise question before assigning `MATERIAL SIGNAL` or `URGENT ACTION`. Scope relevance cannot compensate for ambiguous identity.

## Atomic claims

Break every candidate item into claims that can be independently supported:

`claim_id | subject/entity | predicate/event | amount/value | period/date | unit/currency | perimeter | event_status | source_id | locator | extraction_class`

Keep source facts, source characterisations, management language, calculations and analyst inferences distinct. Every material figure requires entity, period/as-of, unit/currency, perimeter and locator. Missing fields stay null or `[Insufficient Information]`; null is never zero. Retain conflicting figures with their statement/source roles and do not average them.

## Story clustering

Merge exact duplicates, forwarded copies, syndicated versions and semantically equivalent reports only when they describe the same entity, event, status and economic facts. A cluster retains:

- earliest reliable event timestamp and highest-authority accessible source;
- all materially distinct atomic claims and source locators;
- supporting, conflicting and merely repeating sources;
- origin/evidence-family lineage;
- access depth for each member;
- correction and status history.

Split a cluster when later information changes the entity, event status, amount, date, affected instrument or creditor mechanism. Similar headlines are not sufficient to merge different issuers or different legs of one financing.

## Newness and temporal handling

Assign one label:

- `FIRST SEEN`: an explicit prior-digest/source-history comparison basis was accessible and searched through its disclosed cut-off, and no earlier version was found. Name that basis and cut-off.
- `SUBSTANTIVE UPDATE`: status, amount, date, entity, instrument or implication materially changed.
- `REPEAT`: no material new fact; suppress from ranked cards unless repetition itself matters.
- `CORRECTION`: a prior claim is explicitly corrected; surface the correction and affected conclusion.
- `STALE RESURFACING`: old information reappears without a substantive update; suppress unless resurfacing changes market/credit relevance.
- `NOT TESTED`: no adequate prior comparison basis was available or searched; do not claim novelty. This is mandatory when the run has only the current retrieval window.

Publication recency does not make an old event new. `FIRST SEEN` means first within the disclosed comparison basis, never first ever. Display the basis used for comparisons; no accessible prior digest/history means durable delta status was `NOT TESTED`.

## Exit gate

Every promoted candidate must have a cluster ID, resolved or explicitly unresolved subject, atomic claims, source family, access depth, event/publication times where available, newness label and visible conflict/correction status.
