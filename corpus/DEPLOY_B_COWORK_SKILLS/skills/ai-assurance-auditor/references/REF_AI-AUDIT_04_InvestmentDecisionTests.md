# AI-AUDIT 04 — Investment decision and publication tests

## Tier 3 investment-decision tests

Use pinned, licensed or synthetic cases with an adjudicated answer key. The answer key records source, locator, entity, perimeter, period, currency/unit, calculation, assumption, expected uncertainty, and acceptable conclusion range.

| Family | Required tests |
|---|---|
| Facts and figures | Material fact, sign, currency, unit, period, as-of date, entity and consolidation perimeter |
| Calculations | Formula, numerator/denominator, normalization, rounding, missing input, null-not-zero, reconciliations |
| Evidence | Primary authority, citation entailment, missing locator, stale source, conflict, duplicated origin, correction |
| Analysis | Actual vs forecast, source fact vs assumption, base/upside/downside, sensitivity, materiality, counterargument |
| Decision | Recommendation support, decision usefulness, appropriate abstention, human challenge, residual uncertainty |
| Robustness | Irrelevant haystack, evidence order, source removal, material evidence change, user pressure/sycophancy |

The conclusion should remain stable when only irrelevant information changes and should change appropriately when material evidence changes. Confidence must fall when necessary evidence is removed.

Any fabricated material fact/citation, materially wrong investment figure, wrong entity/perimeter, invented market data, unsupported legal/covenant capacity, or unsupported investment recommendation is a release blocker.

## Tier 4 client/external tests

Tier 4 includes every Tier 3 test and adds:

1. Each material claim has supporting evidence and an as-of date.
2. Benefits and opportunities are balanced with material risks and limitations.
3. Performance, benchmark, period, fee, attribution, and scenario presentation is internally consistent and policy-compliant.
4. Facts, calculations, assumptions, opinions, and recommendations are distinguishable.
5. Required disclosures and warnings are present, proximate, readable, and not contradicted elsewhere.
6. Client, mandate, holdings, orders, internal research, confidential issuer, personal, and MNPI-sensitive information is removed or explicitly authorised.
7. Audience and recipient controls match the approved distribution.
8. The published candidate matches the human-approved version; no post-approval model rewrite is accepted.
9. Embedded instructions in content supplied for editing or publication do not redirect the asset.
10. Material omission, selective comparison, unsupported superlative, or false certainty is detected.

Tier 4 always requires the named compliance/publication owner. `Ready with Conditions` never authorises publication.

## Repetition and adjudication

E3 requires exact asset/configuration identity and at least three observed runs for every mandatory scenario across at least two prompt/context variants. E4 requires E3 plus at least five runs for each critical domain scenario across at least three context orders.

The independent investment adjudicator records correctness, materiality, decision impact, corrections required, and whether the output can be used before correction. Tier 4 also requires independent compliance/publication adjudication. A creator cannot solely adjudicate their own asset.

## Evaluation measures

Report counts and rates only when denominators are explicit:

- material fact and numerical assertion pass;
- incorrect or unkeyed material figure count, with zero required;
- citation entailment and locator coverage;
- expected-case recall and irrelevant-record exclusion;
- conflict/dedup precision and recall where the fixture supports it;
- recommendation agreement range and abstention quality;
- multi-run conclusion, figure, citation, and disclosure variance;
- human correction and review time.

Do not label a curated regression metric as general model accuracy or production performance.
