# CP-EMAIL D — Classification and Ranking

## Intelligence relevance gate

Admit an item only when it is relevant to the resolved HY, leveraged-loan or CLO scope through one or more evidenced categories: issuer financial/operating development; financing/refinancing/LME/restructuring; rating action/methodology; covenant/legal/court/regulatory; governance/sponsor; market pricing/flow/technical; sector/macro with a creditor pathway; loan/CLO obligor, facility, rating or eligibility implication; or a correction/contradiction to prior reporting.

Reject or demote generic macro headlines, equity-only commentary, marketing material and distant sector news without a mechanism to cash flow, leverage, liquidity, debt service, refinancing, covenant capacity, default probability, recovery, security value or CLO collateral behaviour.

## Evidence-to-impact chain

For every promoted story, state:

`observable evidence -> risk mechanic -> creditor implication`

Allowed channels include revenue, margin, cash conversion, FCF, leverage/capital structure, liquidity, debt service, refinancing, covenant, legal/structural priority, governance/sponsor, default probability, recovery/LGD, relative value/market access and CLO collateral/eligibility. A channel label without a causal explanation is incomplete.

## Priority assignment

| Level | Binding meaning | Evidence behaviour |
|---|---|---|
| `URGENT ACTION` | Immediate analyst review because default, liquidity, legal, covenant, recovery or time-critical refinancing consequences may be present | Authoritative sufficiently complete source or strong independent confirmation; conflicts displayed prominently |
| `MATERIAL SIGNAL` | Likely to change the credit view, monitoring intensity or required analytical work | Resolved entity/event plus sourced creditor mechanism |
| `WATCH` | Credible early development approaching a monitoring threshold | May include clearly labelled limited evidence or rumour |
| `INFORMATION` | Useful market, sector, regulatory or issuer context without a claimed credit-view change | Relevant and sourced |

A `HEADLINE ONLY`/`SNIPPET` item or single-source `RUMOUR` cannot exceed `WATCH` without independent sufficiently complete confirmation. Repetition from one evidence family is not confirmation. High apparent impact cannot repair weak evidence. Authority and impact remain separate.

A complete Tier-2 direct-market source may independently establish only its own observed market fact above the `WATCH` ceiling when instrument identity, measure/units, observation timestamp, source locator and benchmark (where applicable) are present. It cannot by itself establish the cause of the move, an issuer event, default probability, recovery outcome or `URGENT ACTION`; those conclusions require separately supported mechanics.

## Monitoring hierarchy

Within evidence limits, prioritise:

1. Liquidity exhaustion, covenant breach, debt-service incapacity, near-term refinancing failure, default/LME escalation and legal/structural deterioration affecting priming or recovery.
2. EBITDA/FCF deterioration that impairs deleveraging, market access or covenant headroom.
3. Material ratings, regulatory, operational or governance events with an explicit creditor pathway.
4. Earlier pressure and sector/macro read-throughs that warrant observation.

Sponsor identity without documented action is not a material signal. Missing disclosure is a coverage gap unless a source establishes that the absence itself has a creditor consequence.

## Ordinal ordering

First order by priority band. Within a band use, in order:

1. immediacy of required analyst action;
2. expected creditor impact;
3. direct relevance to explicit scope;
4. novelty/magnitude of update;
5. evidence confidence and independence;
6. breadth of affected instruments/issuers;
7. recency.

Penalise stale resurfacing, duplicates, limited access, unresolved identity, single-source rumour and missing market timestamp/benchmark. Apply per-issuer and per-source diversity only after all urgent items are preserved. User priority may raise relevance, never confidence or priority past the evidence ceiling. Do not display a composite numerical materiality score.

After applying the rubric, break any remaining exact tie deterministically by earliest event timestamp, then canonical cluster ID. Assign `item-1`, `item-2`, and so on once per run. Those handles and ranks are immutable for the run; filtering, grouping and expansion preserve them rather than renumbering. A new retrieval run creates a new ranking and run ID.

## Synthesis gate

Sector, CLO or regulatory synthesis requires more than a headline list: at least one explicit mechanism and adequate supporting evidence. Clearly distinguish a direct effect from an inferred read-through. Facility-level CLO implications require evidenced obligor/facility/rating/eligibility facts; issuer news alone is insufficient.
