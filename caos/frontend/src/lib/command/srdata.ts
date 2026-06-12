// CP-SR sector review analysis data — backs the Sector Review window opened
// from the Sector Review Board in Concept A. Per-sector thesis, drivers,
// spread moves across selectable timeframes, and the issuers impacted by the
// sector view (held names + monitored peers).

export const TIMEFRAMES = ["1W", "1M", "3M", "6M", "YTD", "1Y"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

// US Leveraged Loan index STW move (bps) per timeframe — comparison baseline.
export const INDEX_MOVE: number[] = [-4, -12, 18, 9, 6, -22];

// Idiosyncratic drift scales with window length.
const IDIO_SCALE = [0.25, 0.5, 1, 1.25, 1, 1.5];

export interface ImpactedIssuer {
  code: string;
  name: string;
  held: boolean; // in the portfolio sleeve vs monitored peer
  beta: number; // sensitivity to the sector spread move
  idio: number; // idiosyncratic bps drift (scaled by timeframe)
  impact: string; // how the sector view transmits to this credit
}

// A knowledge refresh needs no new file uploads: CP-SR scans what is already
// in the document vault AND searches external sources (newswires, sell-side
// distribution, filings, pricing services).
export interface KnowledgeSource {
  kind: "external" | "vault";
  name: string;
  detail: string;
}

export interface SectorReviewData {
  sector: string;
  thesis: string;
  drivers: string[];
  newFinding: string; // appended to drivers by a knowledge refresh
  stw: number[]; // sector STW move (bps) per timeframe
  dispersion: number[]; // intra-sector dispersion (bps) per timeframe
  issuers: ImpactedIssuer[];
  sources: KnowledgeSource[]; // retrieved by the refresh search
}

/** Issuer ΔSTW (bps) for a timeframe index. */
export function issuerMove(s: SectorReviewData, i: ImpactedIssuer, tf: number): number {
  return Math.round(i.beta * s.stw[tf] + i.idio * IDIO_SCALE[tf]);
}

export const SECTOR_REVIEWS: Record<string, SectorReviewData> = {
  Industrials: {
    sector: "Industrials",
    thesis:
      "Constructive. PMI back above 50 (52.4) with channel destocking largely complete; pricing holds while input costs fade. Capex discipline keeps FCF conversion above the cross-sector median — favour capital-structure simplicity over cyclical beta.",
    drivers: [
      "PMI 52.4 ↑ third consecutive month above 50",
      "Destocking ending — distributor inventories back to 1.8 months",
      "Steel + freight input costs −6% YTD, margin tailwind into H2",
    ],
    newFinding: "Q2 channel checks: aftermarket order books +4% q/q — earlier than modeled",
    stw: [-3, -9, -21, -14, -18, -36],
    dispersion: [18, 24, 31, 36, 33, 44],
    issuers: [
      { code: "ATLF", name: "Atlas Forge Industrials", held: true, beta: 1.1, idio: -4, impact: "Engineered-components mix tracks PMI with a one-quarter lag; add-back realization is the idio risk, not the cycle" },
      { code: "KMWX", name: "Kestrel Machine Works", held: false, beta: 0.9, idio: 2, impact: "Shorter-cycle peer — first to confirm or refute the destocking-end signal" },
      { code: "NBCV", name: "Northbay Conveyor", held: false, beta: 1.3, idio: 6, impact: "Warehouse-capex exposure; order intake is the early-warning proxy for the sector board" },
    ],
    sources: [
      { kind: "external", name: "ISM / S&P Global", detail: "May PMI release + new-orders subindex" },
      { kind: "external", name: "Keene Research", detail: "Industrials distributor channel checks (Jun 09)" },
      { kind: "external", name: "Reuters", detail: "steel & freight input cost wire — weekly series" },
      { kind: "vault", name: "ATLF Q1-26 compliance certificate", detail: "vault E-103 · covenant calc 5.68x" },
      { kind: "vault", name: "ATLF lender presentation", detail: "vault D-06 · aftermarket mix disclosure" },
    ],
  },
  Telecom: {
    sector: "Telecom",
    thesis:
      "Negative. Fiber overbuild keeps returns below cost of capital in contested footprints; ARPU −2.1% with promo intensity rising. Liability-management risk is the dominant driver of spread outcomes — document quality beats fundamentals here.",
    drivers: [
      "Fiber overbuild — 38% of footprints now 2+ gigabit competitors",
      "ARPU −2.1% y/y; promo intensity rising into H2",
      "LME pipeline building: three capital structures in advisor processes",
    ],
    newFinding: "NWCF lender call confirms co-op group at ~55% of TLB — uptier path live",
    stw: [8, 25, 64, 88, 71, 102],
    dispersion: [40, 62, 98, 121, 104, 150],
    issuers: [
      { code: "NWCF", name: "Northwind Cable & Fiber", held: true, beta: 1.4, idio: 25, impact: "Thursday lender call + co-op chatter — CP-3D LME vulnerability 9/10; non-pro-rata uptier viable at 50.1%" },
      { code: "MRDN", name: "Meridian Telecom Holdings", held: false, beta: 0.8, idio: -3, impact: "UK altnet consolidation candidate; spread tracks sector but M&A is the swing factor" },
      { code: "FBRC", name: "FiberCo Regional", held: false, beta: 1.1, idio: 8, impact: "Overbuild-exposed footprint overlaps NWCF in 6 of 11 markets — read-across name" },
    ],
    sources: [
      { kind: "external", name: "BarrowCap Desk", detail: "NWCF lender-call note (07:42 intake)" },
      { kind: "external", name: "Fiber Broadband Assn", detail: "overbuild footprint database — Q2 update" },
      { kind: "external", name: "Bloomberg", detail: "altnet consolidation wire + TLB quote runs" },
      { kind: "vault", name: "NWCF credit agreement", detail: "vault D-02 · 50.1% amendment threshold, no Serta blocker" },
    ],
  },
  Healthcare: {
    sector: "Healthcare",
    thesis:
      "Cautious. Labor cost +6% y/y outruns reimbursement catch-up by 12–18 months; payor disputes extend receivable cycles. Prefer scaled platforms with payor diversification; avoid single-state Medicaid concentration.",
    drivers: [
      "Clinical labor +6% y/y; agency usage normalizing but base wages sticky",
      "Reimbursement lag 12–18 months across commercial book",
      "Payor disputes extending DSO — receivables quality the new differentiator",
    ],
    newFinding: "BLHP payor-dispute review scope confirmed at 2 payors / $41M receivables",
    stw: [5, 18, 42, 55, 38, 60],
    dispersion: [33, 51, 77, 92, 80, 115],
    issuers: [
      { code: "BLHP", name: "Brightline Health", held: true, beta: 1.3, idio: 18, impact: "Earnings call pushed +9 days on receivable review — disclosure-timing flag in CP-2D; watch the May 21 print" },
      { code: "CRPT", name: "CarePoint Clinics", held: false, beta: 0.9, idio: 4, impact: "Same commercial-payor mix; confirms whether the dispute pattern is systemic or BLHP-specific" },
    ],
    sources: [
      { kind: "external", name: "CMS", detail: "final inpatient rate notice FY-27" },
      { kind: "external", name: "Keene Research", detail: "payor-mix deep dive (May 30)" },
      { kind: "external", name: "IR · Brightline Health", detail: "call-reschedule notice (08:05 intake)" },
      { kind: "vault", name: "BLHP lender presentation", detail: "vault D-06 · receivable aging schedule" },
    ],
  },
  Chemicals: {
    sector: "Chemicals",
    thesis:
      "Cautious. TiO2 spot −3.8% w/w with Chinese capacity running ahead of demand; energy input relief only partly offsets. Contract repricing windows in H2 are the catalyst — names with >35% H2 repricing exposure carry the spread risk.",
    drivers: [
      "TiO2 spot −3.8% w/w, −11% YTD on Chinese capacity additions",
      "Energy inputs ↓ — partial gross-margin offset (~60bps)",
      "H2-26 contract repricing windows concentrate the earnings risk",
    ],
    newFinding: "CP-SR threshold 2-of-3 tripped — TiO2 early-warning now armed weekly",
    stw: [4, 11, 28, 19, 24, 33],
    dispersion: [22, 30, 45, 52, 47, 66],
    issuers: [
      { code: "HELX", name: "Helios Specialty Chem", held: true, beta: 1.2, idio: 6, impact: "~40% of volume reprices H2-26; FCF turns negative below $2,450/t TiO2 — CP-2B pathway armed" },
      { code: "AURC", name: "Aurora Chemicals SA", held: false, beta: 0.9, idio: -2, impact: "Coatings-weighted peer with earlier repricing — leading indicator for HELX contract outcomes" },
      { code: "TIOG", name: "Tioga Pigments", held: false, beta: 1.4, idio: 12, impact: "Pure-play TiO2 — highest beta to the spot price signal on the board" },
    ],
    sources: [
      { kind: "external", name: "TZMI / pricing service", detail: "TiO2 weekly spot assessment" },
      { kind: "external", name: "Keene Research", detail: "HELX initiation — repricing exposure model" },
      { kind: "external", name: "Customs data", detail: "Chinese TiO2 export volumes — monthly" },
      { kind: "vault", name: "HELX offering memorandum", detail: "vault D-01 · contract repricing windows §3.2" },
    ],
  },
  Media: {
    sector: "Media",
    thesis:
      "Negative. Linear decay accelerating (−9% y/y) with ad soft outside political; digital transitions consume cash before they return it. Structure risk dominates: unrestricted-sub transfers and asset-sale leakage are the spread events, not earnings.",
    drivers: [
      "Linear decay accelerated to −9% y/y; cord-cutting cohort widening",
      "Ad market soft ex-political; local inventory pricing −4%",
      "Asset-sale / unsub transfer risk re-rating CCC cohort documents",
    ],
    newFinding: "QLMH strategic review names unrestricted-sub transfer as a structure option — CP-4 leakage register re-opened",
    stw: [12, 38, 96, 132, 110, 167],
    dispersion: [55, 84, 140, 171, 150, 210],
    issuers: [
      { code: "QLMH", name: "Quill Media Holdings", held: true, beta: 1.5, idio: 40, impact: "Broadcast strategic review — leakage risk to SSN collateral; CP-4 register re-opened, RV dislocated 2.1pts" },
      { code: "BCNB", name: "Beacon Broadcast", held: false, beta: 1.1, idio: 10, impact: "Station-sale comps set the recovery marks CP-3B uses for QLMH collateral" },
      { code: "HLCP", name: "Halcyon Publishing", held: false, beta: 0.7, idio: -5, impact: "Digital-weighted survivor — funds the relative-value short leg vs linear-heavy names" },
    ],
    sources: [
      { kind: "external", name: "PR Newswire", detail: "QLMH strategic-review release (07:51 intake)" },
      { kind: "external", name: "Nielsen / ad-spend trackers", detail: "linear decay + local inventory pricing" },
      { kind: "external", name: "Station-sale comps", detail: "broadcast M&A multiples — trailing 12m" },
      { kind: "vault", name: "QLMH SSN indenture", detail: "vault D-03 · unsub transfer & leakage covenants" },
    ],
  },
  Software: {
    sector: "Software",
    thesis:
      "Constructive. NRR stable at 108% across the cohort with pricing power holding; rate-driven multiple noise creates entry points in capital structures with real FCF. Watch seat-based models for AI-substitution drag in renewals.",
    drivers: [
      "NRR stable 108% · churn flat across Q1 prints",
      "Pricing holds — list increases sticking without discount creep",
      "AI seat-substitution a watch item in 2027 renewal cohorts",
    ],
    newFinding: "Cohort renewal data: seat-based NRR −1.8pts vs usage-based — substitution signal early but real",
    stw: [-2, -6, -12, -9, -11, -19],
    dispersion: [15, 20, 28, 33, 29, 41],
    issuers: [
      { code: "VRSW", name: "Verita Software Group", held: true, beta: 1.0, idio: -2, impact: "Usage-based pricing insulates from seat substitution; spread compresses with the cohort" },
      { code: "LDGR", name: "Ledgerline SaaS", held: false, beta: 1.2, idio: 5, impact: "Seat-based renewal cohort peaks 2027 — the test case for the AI-substitution thesis" },
    ],
    sources: [
      { kind: "external", name: "Cohort renewal trackers", detail: "NRR / churn across Q1 prints" },
      { kind: "external", name: "Sell-side aggregate", detail: "seat-based vs usage-based pricing surveys" },
      { kind: "vault", name: "VRSW interim report", detail: "vault D-IR · NRR 108% disclosure" },
    ],
  },
  Packaging: {
    sector: "Packaging",
    thesis:
      "Neutral. Volumes flat with resin pass-through mechanics functioning; spread story is carry, not compression. Substrate mix shifts (glass→PET) reward converters with flexible lines.",
    drivers: [
      "Volumes flat q/q — consumer destocking offset by food & bev resilience",
      "Resin pass-through lag at 45 days — neutral at current futures curve",
      "Glass→PET substrate shift rewards flexible converters",
    ],
    newFinding: "Resin futures backwardation steepened — pass-through turns a modest H2 tailwind",
    stw: [1, 3, 7, 4, 6, 9],
    dispersion: [12, 16, 22, 25, 23, 30],
    issuers: [
      { code: "PGPK", name: "Pinegrove Packaging", held: true, beta: 1.0, idio: 1, impact: "Carry position — pass-through mechanics tested and holding; no catalyst either way" },
      { code: "CRTW", name: "Crateworks Industrial", held: false, beta: 1.1, idio: 3, impact: "Industrial end-market mix makes it the cross-check against the Industrials board signal" },
    ],
    sources: [
      { kind: "external", name: "Resin futures curve", detail: "pass-through lag model inputs" },
      { kind: "external", name: "Trade press", detail: "glass→PET substrate shift volumes" },
      { kind: "vault", name: "PGPK pricing sheet", detail: "vault D-PX · contract pass-through mechanics" },
    ],
  },
  "Energy Svcs": {
    sector: "Energy Svcs",
    thesis:
      "Constructive. Offshore dayrates firm with 1.4x book-to-bill; contract cover through 2027 de-risks the cohort. Discipline on newbuilds keeps supply rational — spread compression has room.",
    drivers: [
      "Dayrates firm — 6th consecutive quarter of sequential gains",
      "Backlog 1.4x book-to-bill; contract cover into 2027",
      "No speculative newbuild orders — supply side rational",
    ],
    newFinding: "Two FPSO awards pulled forward to Q3 — CBMS backlog read-through positive",
    stw: [-4, -11, -26, -19, -23, -41],
    dispersion: [20, 27, 38, 44, 40, 55],
    issuers: [
      { code: "CBMS", name: "Cobalt Marine Services", held: true, beta: 1.1, idio: -5, impact: "Backlog quality + 2027 contract cover — overweight thesis compounds with sector compression" },
      { code: "GTDM", name: "Gulf Tide Marine", held: false, beta: 1.3, idio: 4, impact: "Spot-exposed peer — first derivative on dayrate momentum the board tracks" },
    ],
    sources: [
      { kind: "external", name: "Rig & dayrate trackers", detail: "offshore dayrate series — 6 quarters" },
      { kind: "external", name: "Upstream wire", detail: "FPSO award pipeline — Q3 pull-forwards" },
      { kind: "vault", name: "CBMS interim report", detail: "vault D-IR · backlog 1.4x book-to-bill" },
    ],
  },
};
