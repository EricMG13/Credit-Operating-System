<!-- REF_CP-2C ScoringTaxonomy (T2 support) | 2026-06-22 | extracted from ACTIVE_PROMPT for the 8000-char cap (SEC8) -->
<reference module="CP-2C" name="Behavior Taxonomy, Evidence Labels & Scoring Rubric">

Authoritative for CP-2C sponsor-behavior classification (Step 4), evidence grading, and the governance scorecard (Step 9). Load alongside the CP-2C workflow.

## Sponsor Behavior Taxonomy
**A. Supportive / Creditor-Aligned:** Equity injection, deleveraging, voluntary paydown, non-subordinating refinance, transparent reporting, conservative acquisition funding, distribution suspension during stress, sponsor liquidity support without priority weakening.
**B. Neutral / Mixed:** Strategic acquisition with unclear funding, maturity extension with increased encumbrance, support plus simultaneous fees, adequate reporting with missing details, debt-funded growth with undisclosed leverage impact.
**C. Extraction-Oriented:** Dividend recap, debt-funded distribution, non-ordinary-course fees, related-party leakage, asset-sale proceeds distributed, leveraged acquisition then distributions, excess tax distributions, stressed share repurchases.
**D. Creditor-Adverse:** Uptier/priming, drop-down, non-pro-rata exchange, coercive exchange, sacred-rights amendments, unrestricted-subsidiary asset moves, stressed RP/investment capacity use, repeated waivers without deleveraging, collateral/guarantee release.
**E. Insufficient Information:** Sponsor identity only, generic reputation, unverified press, missing dates/detail, unclear funding, missing legal capacity, missing sponsor economics/vintage/ownership/control.

## Evidence Quality Labels
**High:** Primary source, dated, issuer-specific (OM, credit agreement, indenture, annual report, audited financials, signed amendment, restructuring agreement, filed ownership document).
**Medium:** Secondary source or module output citing primary evidence (CP-0 registry, CP-1A/CP-2 ownership, CP-3C sponsor-willingness, CP-4A capacity table, internal note with references).
**Low:** High-level summary, promotional, stale, incomplete, undated, non-primary without full support. Use only with limitation language.
**Insufficient:** Unsupported assertion, generic reputation, source missing claimed fact, unclear date, no issuer link, no source, claim from sponsor identity alone.

## Scoring Rubric (Downstream Scorecard Input)
Directional raw scores where evidence supports each dimension:
- **1** = creditor-favorable / conservative / transparent
- **3** = mixed / market-standard / monitor
- **5** = creditor-adverse / extraction-oriented / opaque
- **Not Scorable** = missing evidence

Dimensions: Leverage tolerance | Shareholder extraction risk | Acquisition appetite | Support behavior | Disclosure transparency | Creditor treatment / amendment behavior | Legal-capacity linkage | Reporting quality | Related-party leakage risk
Composite: require ≥4 dimensions supported; else Not Scorable → Risk Level = Insufficient Information (unless one clearly High-risk documented action).

</reference>
