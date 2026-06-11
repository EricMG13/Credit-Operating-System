// Command Center data — portfolio posture, CP-MON email intelligence + alert
// stream, CP-SR sector board, coverage matrix, QA queue and source gaps
// (port of design bundle shared/data.js). ATLF demo content.

export interface PortfolioRow {
  code: string;
  name: string;
  sector: string;
  rating: string;
  inst: string;
  px: number;
  ytw: number;
  stw: number;
  dd: number;
  lev: number;
  cov: number;
  m2e: number;
  posture: "OVERWEIGHT" | "HOLD" | "UNDERWEIGHT" | "REDUCE";
  conv: number;
  qa: string;
  alerts: number;
  watch: boolean;
  spark: number[];
}

export const PORTFOLIO: PortfolioRow[] = [
  { code: "ATLF", name: "Atlas Forge Industrials", sector: "Industrials", rating: "B2 / B", inst: "SSN 8.250% '31", px: 96.4, ytw: 9.12, stw: 388, dd: -6, lev: 5.7, cov: 2.1, m2e: 19.3, posture: "OVERWEIGHT", conv: 4, qa: "conditional", alerts: 1, watch: false, spark: [371, 375, 380, 392, 401, 396, 390, 388] },
  { code: "MERF", name: "Meridian Foods Holdco", sector: "Cons. Staples", rating: "B1 / B+", inst: "TLB S+375 '30", px: 99.1, ytw: 8.41, stw: 351, dd: 2, lev: 4.9, cov: 2.6, m2e: 26.0, posture: "HOLD", conv: 3, qa: "clear", alerts: 0, watch: false, spark: [349, 350, 348, 352, 355, 353, 352, 351] },
  { code: "NWCF", name: "Northwind Cable & Fiber", sector: "Telecom", rating: "B3 / B−", inst: "SUN 6.500% '29", px: 81.2, ytw: 12.84, stw: 762, dd: 31, lev: 6.8, cov: 1.4, m2e: 11.2, posture: "REDUCE", conv: 4, qa: "clear", alerts: 3, watch: true, spark: [655, 668, 690, 701, 724, 738, 731, 762] },
  { code: "HELX", name: "Helios Specialty Chem", sector: "Chemicals", rating: "B2 / B", inst: "SSN 7.875% '30", px: 97.8, ytw: 8.66, stw: 342, dd: -3, lev: 5.2, cov: 2.3, m2e: 17.8, posture: "HOLD", conv: 3, qa: "clear", alerts: 0, watch: false, spark: [350, 348, 352, 349, 344, 346, 345, 342] },
  { code: "BLHP", name: "Brightline Health", sector: "Healthcare", rating: "B3 / B−", inst: "TLB S+450 '28", px: 93.6, ytw: 11.02, stw: 591, dd: 14, lev: 6.3, cov: 1.6, m2e: 9.7, posture: "UNDERWEIGHT", conv: 4, qa: "clear", alerts: 2, watch: true, spark: [540, 552, 548, 561, 570, 577, 580, 591] },
  { code: "CBMS", name: "Cobalt Marine Services", sector: "Energy Svcs", rating: "B2 / B", inst: "SSN 9.000% '29", px: 101.3, ytw: 8.52, stw: 367, dd: -9, lev: 4.1, cov: 3.0, m2e: 22.4, posture: "OVERWEIGHT", conv: 3, qa: "clear", alerts: 0, watch: false, spark: [398, 391, 384, 380, 377, 371, 372, 367] },
  { code: "VRSW", name: "Verita Software Group", sector: "Software", rating: "B2 / B", inst: "TLB S+400 '31", px: 99.8, ytw: 8.74, stw: 374, dd: -1, lev: 6.9, cov: 2.4, m2e: 28.1, posture: "OVERWEIGHT", conv: 4, qa: "clear", alerts: 0, watch: false, spark: [380, 381, 378, 377, 376, 374, 376, 374] },
  { code: "PGPK", name: "Pinegrove Packaging", sector: "Packaging", rating: "B1 / B+", inst: "SSN 6.750% '30", px: 98.9, ytw: 7.31, stw: 281, dd: 1, lev: 4.6, cov: 2.8, m2e: 24.6, posture: "HOLD", conv: 2, qa: "clear", alerts: 0, watch: false, spark: [284, 282, 283, 280, 279, 282, 280, 281] },
  { code: "SXAA", name: "Saxon Auto Aftermarket", sector: "Auto", rating: "B2 / B", inst: "SUN 7.250% '29", px: 95.2, ytw: 9.40, stw: 433, dd: 8, lev: 5.4, cov: 2.0, m2e: 15.5, posture: "HOLD", conv: 3, qa: "stale", alerts: 1, watch: false, spark: [410, 415, 412, 418, 421, 425, 428, 433] },
  { code: "QLMH", name: "Quill Media Holdings", sector: "Media", rating: "Caa1 / CCC+", inst: "SSN 10.500% '28", px: 74.8, ytw: 16.71, stw: 1148, dd: 52, lev: 7.4, cov: 1.1, m2e: 6.2, posture: "REDUCE", conv: 5, qa: "clear", alerts: 4, watch: true, spark: [980, 1004, 1011, 1043, 1066, 1090, 1096, 1148] },
];

export const EMAIL_TILES = { critical: 3, high: 11, medium: 27, low: 64, dedup: 19, unresolved: 2 };

export interface EmailRow {
  t: string;
  src: string;
  subj: string;
  issuer: string;
  signal: string;
  mat: number;
  sev: string;
  route: string;
  dedup: boolean;
}

export const EMAILS: EmailRow[] = [
  { t: "07:42", src: "Sell-side · BarrowCap Desk", subj: "NWCF — ad-hoc lender call announced for Thursday", issuer: "NWCF", signal: "LME / Liability Mgmt", mat: 94, sev: "critical", route: "CP-3D · CP-MON-H", dedup: false },
  { t: "07:51", src: "PR Newswire", subj: "Quill Media announces strategic review of broadcast assets", issuer: "QLMH", signal: "Asset Sale", mat: 91, sev: "critical", route: "CP-2C · CP-4", dedup: false },
  { t: "08:05", src: "IR · Brightline Health", subj: "Q1-26 earnings call rescheduled to May 21", issuer: "BLHP", signal: "Disclosure Timing", mat: 78, sev: "high", route: "CP-1B · CP-2D", dedup: false },
  { t: "08:13", src: "Bloomberg chat · HY desk", subj: "ATLF TLB quoted 99.0-99.5, two-way after sponsor headline", issuer: "ATLF", signal: "Price / Flow", mat: 71, sev: "high", route: "CP-3 · CP-MON-G", dedup: false },
  { t: "08:20", src: "Sell-side · Keene Research", subj: "Helios initiation: cautious on titanium dioxide pricing", issuer: "HELX", signal: "Sector / Pricing", mat: 55, sev: "medium", route: "CP-SR Chemicals", dedup: false },
  { t: "08:27", src: "Reuters", subj: "Saxon Auto supplier recall expands to EU programs", issuer: "SXAA", signal: "Operational Event", mat: 74, sev: "high", route: "CP-2B · CP-2C", dedup: false },
  { t: "08:31", src: "IR · Meridian Foods", subj: "Meridian completes Q1 bolt-on of Harvest Snacks ($85M)", issuer: "MERF", signal: "M&A / Bolt-on", mat: 49, sev: "medium", route: "CP-1A · CP-4C", dedup: true },
  { t: "08:44", src: "Lender portal", subj: "ATLF — Q1-26 compliance certificate posted (net 5.68x)", issuer: "ATLF", signal: "Covenant Reporting", mat: 83, sev: "high", route: "CP-4C · CP-1", dedup: false },
];

export interface AlertRow {
  sev: string;
  issuer: string;
  code: string;
  text: string;
  route: string;
}

export const ALERTS: AlertRow[] = [
  { sev: "critical", issuer: "NWCF", code: "MON-H-2214", text: "Lender call Thursday — co-op agreement chatter; CP-3D LME vulnerability re-scored 8/10 → 9/10", route: "CP-3D" },
  { sev: "high", issuer: "ATLF", code: "MON-H-2215", text: "Compliance cert posted: net leverage 5.68x vs 5.70x model — within tolerance, evidence E-103 attached", route: "CP-1" },
  { sev: "critical", issuer: "QLMH", code: "MON-H-2216", text: "Strategic review of broadcast assets — unrestricted-sub transfer risk; CP-4 leakage register re-opened", route: "CP-4" },
  { sev: "high", issuer: "SXAA", code: "MON-H-2217", text: "EU recall expansion — CP-2B pathway P2 (warranty cascade) probability raised to 35%", route: "CP-2B" },
  { sev: "medium", issuer: "BLHP", code: "MON-H-2218", text: "Earnings call rescheduled +9 days — disclosure-timing flag added to CP-2D governance register", route: "CP-2D" },
  { sev: "high", issuer: "QLMH", code: "MON-H-2219", text: "SSN '28 quoted down 2.1pts post-headline — RV dislocation vs CP-3 fair value band", route: "CP-3" },
  { sev: "medium", issuer: "HELX", code: "MON-H-2220", text: "TiO2 spot −3.8% w/w — CP-SR Chemicals early-warning threshold 2 of 3 tripped", route: "CP-SR" },
  { sev: "low", issuer: "MERF", code: "MON-H-2221", text: "Bolt-on closed ($85M, 6.1x) — funded from RCF; CP-4C basket usage updated", route: "CP-4C" },
  { sev: "high", issuer: "NWCF", code: "MON-H-2222", text: "Crossholder group retains counsel (2 sources, deduped) — temporal layer T0 confirmed", route: "CP-MON" },
  { sev: "medium", issuer: "ATLF", code: "MON-H-2223", text: "Sponsor (Kestrel) closes Fund VI at $4.2B — support capacity flag updated in CP-2D", route: "CP-2D" },
];

export interface SectorRow {
  sector: string;
  stance: "CONSTRUCTIVE" | "NEUTRAL" | "CAUTIOUS" | "NEGATIVE";
  ew: number;
  trend: string;
  reviewed: string;
  due: boolean;
}

export const SECTORS: SectorRow[] = [
  { sector: "Industrials", stance: "CONSTRUCTIVE", ew: 0, trend: "PMI 52.4 ↑ · destocking ending", reviewed: "May 28", due: false },
  { sector: "Telecom", stance: "NEGATIVE", ew: 3, trend: "fiber overbuild · ARPU −2.1%", reviewed: "Jun 02", due: false },
  { sector: "Healthcare", stance: "CAUTIOUS", ew: 2, trend: "labor cost +6% · reimbursement lag", reviewed: "May 14", due: true },
  { sector: "Chemicals", stance: "CAUTIOUS", ew: 2, trend: "TiO2 −3.8% w/w · energy input ↓", reviewed: "May 30", due: false },
  { sector: "Media", stance: "NEGATIVE", ew: 4, trend: "linear decay accel · ad soft", reviewed: "Jun 05", due: false },
  { sector: "Software", stance: "CONSTRUCTIVE", ew: 0, trend: "NRR stable 108% · pricing holds", reviewed: "May 22", due: false },
  { sector: "Packaging", stance: "NEUTRAL", ew: 1, trend: "volumes flat · resin pass-through", reviewed: "May 19", due: true },
  { sector: "Energy Svcs", stance: "CONSTRUCTIVE", ew: 1, trend: "dayrates firm · backlog 1.4x", reviewed: "Jun 01", due: false },
];

// Research view: coverage freshness (issuer × layer)
// states: fresh | aging | stale | running | blocked
const COVERAGE_CELLS: Record<string, string[]> = {
  L1: ["fresh", "fresh", "fresh", "fresh", "aging", "fresh", "fresh", "fresh", "stale", "fresh"],
  L2: ["fresh", "fresh", "running", "fresh", "aging", "fresh", "fresh", "aging", "stale", "running"],
  L3: ["fresh", "aging", "running", "fresh", "fresh", "fresh", "fresh", "aging", "stale", "fresh"],
  L4: ["fresh", "fresh", "fresh", "aging", "fresh", "fresh", "aging", "fresh", "blocked", "running"],
  L5: ["aging", "fresh", "fresh", "fresh", "fresh", "fresh", "fresh", "fresh", "stale", "fresh"],
  L6: ["fresh", "fresh", "aging", "fresh", "aging", "fresh", "fresh", "stale", "stale", "aging"],
};

export const COVERAGE = PORTFOLIO.map((p, i) => ({
  code: p.code,
  cells: Object.fromEntries(Object.entries(COVERAGE_CELLS).map(([l, arr]) => [l, arr[i]])) as Record<string, string>,
}));

export const QA_QUEUE = [
  { id: "QA-117", issuer: "ATLF", module: "CP-1C", sev: "HIGH", age: "2h", text: "Citation E-44 (peer EBITDA margin) unresolved — source page mismatch in OM Annex C" },
  { id: "QA-114", issuer: "SXAA", module: "CP-4", sev: "HIGH", age: "1d", text: "Covenant register cites superseded indenture draft — controlling-doc check failed" },
  { id: "QA-112", issuer: "QLMH", module: "CP-1B", sev: "MEDIUM", age: "1d", text: "Variance bridge math: D&A add-back double count $4.1M (0.9% of EBITDA)" },
  { id: "QA-109", issuer: "BLHP", module: "CP-2E", sev: "MEDIUM", age: "3d", text: "Months-to-empty uses pre-recall capex plan — refresh against May lender deck" },
  { id: "QA-105", issuer: "NWCF", module: "CP-5B", sev: "LOW", age: "4d", text: "Driver #4 lineage chain missing intermediate calc register reference" },
];

export const GAPS = [
  { issuer: "ATLF", doc: "Hedging register / swap confirms", impact: "CP-2F degraded — floating exposure modeled from SFA only", sev: "medium", requested: "Jun 04" },
  { issuer: "ATLF", doc: "Q4-25 management accounts", impact: "CP-1 derived-period bridge uses sponsor model figures", sev: "low", requested: "Jun 04" },
  { issuer: "QLMH", doc: "Unrestricted subsidiary financials", impact: "CP-4 leakage analysis incomplete — transfer capacity unbounded", sev: "high", requested: "Jun 06" },
  { issuer: "BLHP", doc: "May lender presentation", impact: "CP-2E liquidity bridge stale post-recall", sev: "medium", requested: "Jun 07" },
];
