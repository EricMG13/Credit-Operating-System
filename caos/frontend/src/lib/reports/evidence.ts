// E-xx evidence registry for the Report Studio source viewer
// (port of design bundle shared/deal-modules.js EVIDENCE — entries cited by the 5 reports).

export interface EvidenceExcerpt {
  t: string;
  hit?: boolean;
}

export interface EvidenceEntry {
  doc: string; // D-xx or "MKT"
  page: number | null;
  section: string;
  status: "verified" | "open";
  conf: number;
  module: string;
  qa?: string;
  excerpt: EvidenceExcerpt[];
}

export const EVIDENCE: Record<string, EvidenceEntry> = {
  "E-09": {
    doc: "D-01", page: 214, section: "Summary Historical Financials — Adjustments to EBITDA", status: "verified", conf: 0.93, module: "CP-1",
    excerpt: [
      { t: "The following table sets forth a reconciliation of net income to EBITDA and Adjusted EBITDA for the periods presented. Management believes Adjusted EBITDA provides investors with useful supplemental information regarding underlying operating performance." },
      { t: "Adjustments for the twelve months ended March 31, 2026 comprise: (i) $41.2 million of cost savings related to announced plant closures and footprint actions, a portion of which is reflected in run-rate results; (ii) $18.7 million of transaction, integration and advisory costs; (iii) $9.4 million of non-recurring operational items, including $4.1 million of warranty settlements; and (iv) $7.3 million of sponsor management fees.", hit: true },
      { t: "Aggregate adjustments of $76.6 million represent 18.2% of Adjusted EBITDA of $421.0 million for the LTM period." },
    ],
  },
  "E-12": {
    doc: "D-01", page: 97, section: "Business — Aftermarket & Services", status: "verified", conf: 0.95, module: "CP-1A",
    excerpt: [
      { t: "Our Aftermarket & Services segment supplies replacement components, remanufacturing and field services to an installed base of approximately 1.9 million units across more than 40 end markets." },
      { t: "For the twelve months ended March 31, 2026, Aftermarket & Services represented 23.4% of net revenue and approximately 44% of consolidated gross profit. Approximately 87% of segment revenue is generated under multi-year service agreements, which have historically renewed at rates in excess of 92%.", hit: true },
    ],
  },
  "E-15": {
    doc: "D-01", page: 99, section: "Business — Customers", status: "verified", conf: 0.95, module: "CP-1A",
    excerpt: [
      { t: "We maintain long-standing relationships with leading industrial OEMs, with average tenure among our top ten customers exceeding 18 years." },
      { t: "For the twelve months ended March 31, 2026, our three largest customers represented approximately 38% of net revenue, and our largest customer platform (Meridian) represented approximately 14% of net revenue. The Meridian platform agreement is subject to scheduled repricing in the second quarter of fiscal 2027.", hit: true },
      { t: "No other customer represented more than 5% of net revenue for the period." },
    ],
  },
  "E-22": {
    doc: "D-04", page: 31, section: "Consolidated Statements of Cash Flows — FY2025", status: "verified", conf: 0.91, module: "CP-1",
    excerpt: [
      { t: "Net cash provided by operating activities was $287.4 million for fiscal 2025, compared with $266.1 million in fiscal 2024." },
      { t: "Purchases of property, plant and equipment were $118.3 million (4.3% of net revenue), yielding free cash flow of $169.1 million — a conversion of 41% of Adjusted EBITDA, computed per the CP-1 calculation register K-22.", hit: true },
    ],
  },
  "E-31": {
    doc: "D-01", page: 98, section: "Business — Contracted Revenue & Renewal Rates", status: "verified", conf: 0.92, module: "CP-1A",
    excerpt: [
      { t: "Long-term agreements (LTAs) governing approximately 71% of OEM revenue include raw-material indexation mechanisms that adjust selling prices for changes in steel and alloy input costs, typically with a 60-to-90 day lag." },
      { t: "Aftermarket service agreements average 7 years in initial term. Over the last five fiscal years, renewal rates have averaged 92.4% by revenue, with pricing escalators of CPI or 3%, whichever is greater.", hit: true },
    ],
  },
  "E-44": {
    doc: "D-01", page: 388, section: "Annex C — Industry & Peer Data (UNRESOLVED)", status: "open", conf: 0.41, module: "CP-1C",
    qa: "QA-117 (HIGH): CP-1C cites 'Annex C, p.388' for the peer EBITDA margin set, but p.388 in the conformed OM contains the auditor consent letter. The peer table appears at p.391 of the prior draft. Citation must be re-anchored to the conformed document before clearance.",
    excerpt: [
      { t: "[p.388 — conformed OM] CONSENT OF INDEPENDENT REGISTERED PUBLIC ACCOUNTING FIRM. We hereby consent to the inclusion in this Offering Memorandum of our report dated February 12, 2026…", hit: true },
      { t: "[expected content — peer margin benchmark table] Not present at the cited anchor. CP-5 remediation: re-extract Annex C table coordinates from conformed OM and re-run CP-1C metric alignment." },
    ],
  },
  "E-58": {
    doc: "D-07", page: 6, section: "Sponsor Model Extract — EBITDA Bridge FY26E", status: "verified", conf: 0.61, module: "CP-1B",
    excerpt: [
      { t: "[Source grade C — sponsor-prepared, unaudited] FY26E bridge: FY25 Adj. EBITDA $415M → volume/mix +$22M → pricing net of inflation +$14M → cost-out program +$38M → FY26E $489M." },
      { t: "CP-1B variance: Q1-26 actuals track $108M vs model $112.7M (−4.2%). Shortfall concentrated in Fluid Systems volume (−$3.1M) and cost-out phasing (−$1.6M). Conflict logged; model treated as upside case only.", hit: true },
    ],
  },
  "E-63": {
    doc: "D-03", page: 162, section: "Indenture §4.09(b)(14) — Incremental Debt Capacity", status: "verified", conf: 0.97, module: "CP-4",
    excerpt: [
      { t: "…(14) Indebtedness in an aggregate principal amount not to exceed the greater of $150.0 million and 35% of Consolidated EBITDA, plus unlimited additional amounts so long as, on a pro forma basis, the Consolidated Secured Leverage Ratio does not exceed 5.25 to 1.00…", hit: true },
      { t: "CP-4C capacity register: freebie $150M (grower to $147M ≈ 35% × $421M) + ratio capacity $310M at current Secured Leverage of 4.68x + reclassification headroom $155M = $612M day-one, incurrable senior or pari to the 2L SSN." },
    ],
  },
  "E-64": {
    doc: "D-03", page: 164, section: "Indenture §4.09(d) — MFN Protection & Sunset", status: "verified", conf: 0.96, module: "CP-4",
    excerpt: [
      { t: "…provided that, with respect to any Incremental Equivalent Debt incurred under clause (b)(14) that is secured on a pari passu basis and incurred within 12 months of the Issue Date, the All-in Yield shall not exceed the All-in Yield of the Notes by more than 50 basis points unless the interest rate on the Notes is increased accordingly…", hit: true },
      { t: "Translation: MFN protection applies only to pari incremental debt and only for 12 months. After June 2027, a priming or pari raise carries no yield protection for SSN holders." },
    ],
  },
  "E-71": {
    doc: "MKT", page: null, section: "Desk Marks & TRACE Prints — Jun 8, 2026", status: "verified", conf: 0.84, module: "CP-1C",
    excerpt: [
      { t: "ATLF 8.250% '31 last TRACE print 96.40 (Jun 8, 14:21 ET), $4.2M institutional. Two-way desk markets 96.25 / 96.75. Z-spread +388bps; STW +388bps at the print." },
      { t: "CP-1C fair-value band construction: B2 industrial 2L cohort regression (margin, FCF conversion, leverage, docs score) implies +325–340bps for the subject's fundamental profile — subject trades +48–63bps cheap to model.", hit: true },
    ],
  },
  "E-77": {
    doc: "D-04", page: 44, section: "Liquidity & Capital Resources", status: "verified", conf: 0.88, module: "CP-2E",
    excerpt: [
      { t: "As of March 31, 2026, we had $184.3 million of cash and cash equivalents and $195.0 million of undrawn availability under our Revolving Credit Facility, net of $12.4 million of outstanding letters of credit." },
      { t: "CP-2E months-to-empty: base case 19.3 months (bridge +$96M over 12 months). Under CP-2B pathway P1 (Drivetrain −12% over 2 quarters), months-to-empty compresses to 14.0 with the springing covenant untested.", hit: true },
    ],
  },
  "E-87": {
    doc: "D-04", page: 58, section: "Notes to Financials — Restructuring & Other Charges (FY22–FY25)", status: "verified", conf: 0.9, module: "CP-1",
    excerpt: [
      { t: "Restructuring and other charges were $31.2 million, $28.7 million, $9.1 million and $33.4 million for fiscal years 2022 through 2025, respectively, primarily comprising severance, facility exit costs and third-party consulting fees." },
      { t: "CP-1 observation: 'one-time' operational charges have recurred in 3 of the last 4 fiscal years, averaging $25.6M (≈ 6% of EBITDA) — supporting the bear adjustment that a portion of add-backs is structural.", hit: true },
    ],
  },
  "E-91": {
    doc: "D-06", page: 12, section: "Lender Presentation — Sponsor Overview", status: "verified", conf: 0.79, module: "CP-2D",
    excerpt: [
      { t: "Kestrel Capital Partners closed Fund VI at $4.2 billion in June 2026 (vs $3.1B Fund V), with industrials representing its largest sector allocation at 38% of deployed capital." },
      { t: "CP-2D translation: fresh fund capacity is a support-positive (follow-on equity available); offset by Kestrel's record of dividend recapitalizations at two Fund IV portfolio companies within 24 months of a refinancing window.", hit: true },
    ],
  },
  "E-103": {
    doc: "D-05", page: 3, section: "Q1-26 Compliance Certificate — Covenant Calculations", status: "verified", conf: 0.98, module: "CP-1",
    excerpt: [
      { t: "The undersigned, as an Authorized Officer of Atlas Forge Intermediate Holdings, Inc., hereby certifies that as of the Fiscal Quarter ended March 31, 2026: (a) Consolidated First Lien Net Leverage Ratio: 4.68:1.00; (b) Consolidated Total Net Leverage Ratio: 5.68:1.00; (c) no Default or Event of Default has occurred and is continuing.", hit: true },
      { t: "Covenant EBITDA of $421.4M includes $41.0M of run-rate cost savings under SFA §1.01 'Consolidated EBITDA' clause (k) — confirming the realization claimed for closed-plant actions within the capped SFA definition." },
    ],
  },
};
