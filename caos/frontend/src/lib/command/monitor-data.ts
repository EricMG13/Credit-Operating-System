// Monitor and governance authored fixtures. Kept separate from the large
// portfolio sleeve so alert/intake surfaces do not download every position.

export const EMAIL_TILES = { critical: 3, high: 11, medium: 27, low: 64, dedup: 19, unresolved: 2 };

// Single source for the day's message total: the sum of the four SEVERITY tiles
// (critical/high/medium/low). Deduped/unresolved are meta-tiles, not part of the
// classified total. The sub-header "Msgs today" stat and the tile strip both read
// this, so they can never diverge (the old header hard-coded 105 while accruing
// tiles drifted to 117 — a credibility defect on an "audited numbers" brand).
export const EMAIL_TOTAL =
  EMAIL_TILES.critical + EMAIL_TILES.high + EMAIL_TILES.medium + EMAIL_TILES.low; // 105

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
  from: string;
  to: string;
  body: string;
}

export const EMAILS: EmailRow[] = [
  {
    t: "07:42", src: "Sell-side · BarrowCap Desk", subj: "NWCF — ad-hoc lender call announced for Thursday", issuer: "NWCF", signal: "LME / Liability Mgmt", mat: 94, sev: "critical", route: "CP-3D · CP-MON-H", dedup: false,
    from: "lev.desk@barrowcap.com", to: "credit-intake@caos.fund",
    body: "Team —\n\nNorthwind Coil Fabrication (NWCF) just noticed an ad-hoc lender call for Thursday 14:00 ET. No agenda circulated, but two accounts tell us a co-op agreement is already being papered among holders of ~55% of the TLB.\n\nAdvisors: company has PJT + Kirkland engaged; an ad hoc group has organized with Gibson Dunn. Sponsors' counsel has been asking about non-pro-rata uptier mechanics under the 2021 credit agreement (50.1% amendment threshold, no Serta blocker).\n\nPaper closed 84.5-85.5 yesterday, down ~3 points on the week. We'd expect the call to address liquidity runway into the December interest payment.\n\nHappy to walk through positioning — desk is axed both ways.\n\nBarrowCap Leveraged Desk\n(Distribution: institutional clients only)",
  },
  {
    t: "07:51", src: "PR Newswire", subj: "Quill Media announces strategic review of broadcast assets", issuer: "QLMH", signal: "Asset Sale", mat: 91, sev: "critical", route: "CP-2C · CP-4", dedup: false,
    from: "press@quillmediaholdings.com", to: "credit-intake@caos.fund",
    body: "FOR IMMEDIATE RELEASE\n\nNEW YORK — Quill Media Holdings today announced that its Board of Directors has initiated a strategic review of the company's broadcast asset portfolio, including potential divestitures of its 23 regional stations.\n\nThe company has retained Moelis & Company as financial advisor. \"We are committed to maximizing value for all stakeholders as audiences continue to shift to our digital platforms,\" said CEO Dana Whitfield.\n\nThe review is expected to conclude by Q4 2026. The company noted that any transaction structure remains under consideration, including transfers of assets to unrestricted subsidiaries to facilitate a tax-efficient separation.\n\nQuill Media Holdings (Caa1/CCC+) had $2.1B of funded debt as of Q1-26, including the Senior Secured Term Loan (S+550) due 2028.\n\nMedia contact: press@quillmediaholdings.com",
  },
  {
    t: "08:05", src: "IR · Brightline Health", subj: "Q1-26 earnings call rescheduled to May 21", issuer: "BLHP", signal: "Disclosure Timing", mat: 78, sev: "high", route: "CP-1B · CP-2D", dedup: false,
    from: "investor.relations@brightlinehealth.com", to: "credit-intake@caos.fund",
    body: "Dear Investor,\n\nBrightline Health is rescheduling its Q1-2026 earnings conference call from May 12 to May 21, 2026 at 8:30 AM ET.\n\nThe additional time will allow the company to complete its review of reimbursement receivables in connection with the previously disclosed payor dispute. The company does not expect a material change to previously issued FY-26 guidance, but notes the review is ongoing.\n\nDial-in details and the updated presentation will be posted to the investor portal on May 19.\n\nWe apologize for any inconvenience.\n\nInvestor Relations\nBrightline Health, Inc.",
  },
  {
    t: "08:13", src: "Bloomberg chat · HY desk", subj: "ATLF TLB quoted 99.0-99.5, two-way after sponsor headline", issuer: "ATLF", signal: "Price / Flow", mat: 71, sev: "high", route: "CP-3 · CP-MON-G", dedup: false,
    from: "IB-CHAT capture · hy-loans room", to: "credit-intake@caos.fund",
    body: "[08:13:02] DEALER-4: ATLF TLB 99.0-99.5 here, two way\n[08:13:09] DEALER-4: seeing better buyers post the Kestrel headline, sponsor reiterating no dividend recap this year\n[08:13:41] ACCT-12: what size trades 99.25?\n[08:13:55] DEALER-4: 15mm no problem, more with a little time\n[08:14:30] DEALER-7: we printed 10mm at 99.125 earlier, flow balanced\n[08:15:02] ACCT-12: ok. keep us in the loop if RP basket chatter firms up\n\n— Captured by CP-MON email/chat intake · room hy-loans · counterparty names masked per compliance policy",
  },
  {
    t: "08:20", src: "Sell-side · Keene Research", subj: "Helios initiation: cautious on titanium dioxide pricing", issuer: "HELX", signal: "Sector / Pricing", mat: 55, sev: "medium", route: "CP-SR Chemicals", dedup: false,
    from: "research.distribution@keene.com", to: "credit-intake@caos.fund",
    body: "Keene Research — Specialty Chemicals\nInitiating coverage: Helios Specialty Chem (HELX) — CAUTIOUS\n\nWe initiate on Helios 1L TLB '30 with a cautious stance. Key points:\n\n• TiO2 spot pricing down 3.8% w/w and 11% YTD; Chinese capacity additions running ahead of demand recovery.\n• Helios contracts reprice ~40% of volume in H2-26 — we model a 180bps gross margin headwind at current spot.\n• Liquidity remains adequate (months-to-empty ~18) but FCF turns negative below $2,450/t TiO2.\n• At 342bps DM, valuation does not compensate for the pricing cycle; we prefer coated-paper-exposed comps.\n\nFull 28-page initiation attached.\n\nKeene Research Distribution",
  },
  {
    t: "08:27", src: "Reuters", subj: "Saxon Auto supplier recall expands to EU programs", issuer: "SXAA", signal: "Operational Event", mat: 74, sev: "high", route: "CP-2B · CP-2C", dedup: false,
    from: "newswire@reuters.com", to: "credit-intake@caos.fund",
    body: "FRANKFURT (Reuters) — The safety recall affecting brake actuator assemblies supplied by Saxon Auto Aftermarket has been expanded to cover European OEM programs, German regulator KBA said on Tuesday.\n\nThe expansion adds an estimated 410,000 units to the 1.2 million already covered in North America. Saxon said it is cooperating with regulators and that root-cause analysis points to a sub-supplier's seal compound.\n\nTwo OEM customers have initiated commercial discussions regarding cost recovery, according to people familiar with the matter. Saxon's warranty reserve stood at $38M at year-end against analyst estimates of $60-90M total exposure if the EU expansion proceeds at the same per-unit cost as the U.S. campaign.\n\nSaxon's senior secured term loan (S+325) due 2029 traded down 1.3 points following the headline.\n\n(Reporting by Reuters Frankfurt automotive desk)",
  },
  {
    t: "08:31", src: "IR · Meridian Foods", subj: "Meridian completes Q1 bolt-on of Harvest Snacks ($85M)", issuer: "MERF", signal: "M&A / Bolt-on", mat: 49, sev: "medium", route: "CP-1A · CP-4C", dedup: true,
    from: "ir@meridianfoods.com", to: "credit-intake@caos.fund",
    body: "Meridian Foods Investor Update\n\nMeridian Foods today completed its previously announced acquisition of Harvest Snacks for $85 million in cash, representing approximately 6.1x LTM EBITDA including identified synergies.\n\nThe transaction was funded with a draw under the revolving credit facility. Pro forma net leverage is 4.4x, within the company's 4.0-4.5x target range. Management expects to repay the RCF draw from free cash flow within four quarters.\n\nHarvest Snacks adds $14M of LTM EBITDA in the better-for-you snacking category and is expected to be accretive to margins in year one.\n\n[CP-MON-F note: deduplicated against PR Newswire release received 08:29 — IR version retained as primary source.]",
  },
  {
    t: "08:44", src: "Lender portal", subj: "ATLF — Q1-26 compliance certificate posted (net 5.68x)", issuer: "ATLF", signal: "Covenant Reporting", mat: 83, sev: "high", route: "CP-4C · CP-1", dedup: false,
    from: "noreply@intralinks-portal.com", to: "credit-intake@caos.fund",
    body: "Atlas Forge Industrials — Lender Portal Notification\n\nA new document has been posted to the Atlas Forge Industrials workspace:\n\nDocument: Q1-2026 Compliance Certificate\nPosted: 08:44 ET\nPeriod: Quarter ended March 31, 2026\n\nKey figures (as certified by the CFO):\n• Consolidated Net Leverage Ratio: 5.68x (covenant: ≤ 6.25x)\n• LTM Adjusted EBITDA: $421M (add-backs $41M, 18.2% of adjusted)\n• Liquidity: $312M (RCF 78% undrawn + balance sheet cash)\n• Fixed Charge Coverage: 2.1x\n\nNo defaults or events of default are certified to exist.\n\n[CP-MON routing: certificate auto-fetched and queued for CP-1 covenant tie-out against model M-118; evidence id E-103 assigned.]",
  },
];

interface AlertRow {
  sev: string;
  issuer: string;
  code: string;
  text: string;
  route: string;
  // Index into EMAILS of the intake message that triggered this alert, when one
  // exists. Lets the alert row open the SAME EmailWindow the intake tape uses,
  // so a critical re-score is one click from the message that fired it (design
  // principle #3). Undefined = a derived/synthetic alert (e.g. a price move with
  // no dedicated email) — the source chip renders disabled with a reason.
  sourceEmail?: number;
}

export const ALERTS: AlertRow[] = [
  { sev: "critical", issuer: "NWCF", code: "MON-H-2214", text: "Lender call Thursday — co-op agreement chatter; CP-3D LME vulnerability re-scored 8/10 → 9/10", route: "CP-3D", sourceEmail: 0 },
  { sev: "high", issuer: "ATLF", code: "MON-H-2215", text: "Compliance cert posted: net leverage 5.68x vs 5.70x model — within tolerance, evidence E-103 attached", route: "CP-1", sourceEmail: 7 },
  { sev: "critical", issuer: "QLMH", code: "MON-H-2216", text: "Strategic review of broadcast assets — unrestricted-sub transfer risk; CP-4 leakage register re-opened", route: "CP-4", sourceEmail: 1 },
  { sev: "high", issuer: "SXAA", code: "MON-H-2217", text: "EU recall expansion — CP-2B pathway P2 (warranty cascade) probability raised to 35%", route: "CP-2B", sourceEmail: 5 },
  { sev: "medium", issuer: "BLHP", code: "MON-H-2218", text: "Earnings call rescheduled +9 days — disclosure-timing flag added to CP-2D governance register", route: "CP-2D", sourceEmail: 2 },
  // No dedicated intake email — this RV dislocation is derived from the CP-3 fair
  // value band moving against the post-headline quote, not a single message.
  { sev: "high", issuer: "QLMH", code: "MON-H-2219", text: "TLB '28 quoted down 2.1pts post-headline — RV dislocation vs CP-3 fair value band", route: "CP-3" },
  { sev: "medium", issuer: "HELX", code: "MON-H-2220", text: "TiO2 spot −3.8% w/w — CP-SR Chemicals early-warning threshold 2 of 3 tripped", route: "CP-SR", sourceEmail: 4 },
  { sev: "low", issuer: "MERF", code: "MON-H-2221", text: "Bolt-on closed ($85M, 6.1x) — funded from RCF; CP-4C basket usage updated", route: "CP-4C", sourceEmail: 6 },
  // Deduped multi-source event — the NWCF lender-call email carries the ad hoc
  // group / crossholder counsel detail this alert confirms.
  { sev: "high", issuer: "NWCF", code: "MON-H-2222", text: "Crossholder group retains counsel (2 sources, deduped) — temporal layer T0 confirmed", route: "CP-MON", sourceEmail: 0 },
  // The ATLF HY-desk chat is the message that carries the Kestrel/sponsor line.
  { sev: "medium", issuer: "ATLF", code: "MON-H-2223", text: "Sponsor (Kestrel) closes Fund VI at $4.2B — support capacity flag updated in CP-2D", route: "CP-2D", sourceEmail: 3 },
];

// Critical items in the ROUTED alert stream — distinct from EMAIL_TILES.critical
// (which counts intake emails ≥ 90 mat.). The sub-header labels this "Critical
// alerts" so the two "critical" figures on the surface read as different things.
export const CRITICAL_ALERTS = ALERTS.filter((a) => a.sev === "critical").length; // 2

// Feed issuers that exist in the issuer register and therefore resolve to a real
// profile. The other six names in this seeded feed are illustrative only — an
// accent link on them dead-ends in "Issuer not found" (worst on the two
// CRITICALs), so the UI renders non-members as plain text instead of a link.
// ponytail: static authored set for static authored data; swap for a directory
// lookup if the feed ever carries live issuers.
export const FEED_LINKABLE_ISSUERS: ReadonlySet<string> = new Set(["ATLF"]);

// Demo-sim only: a synthetic "accrued today" count animated off the sim tick —
// NOT real data. Single-sourced so Command + Monitor never diverge.
const SIM_ALERT_ACCRUAL_EVERY = 5;
const SIM_ALERT_BASELINE = 2;
export function simAlertsToday(tick: number, active: boolean): number {
  return active ? Math.min(ALERTS.length, Math.floor(tick / SIM_ALERT_ACCRUAL_EVERY) + SIM_ALERT_BASELINE) : ALERTS.length;
}

// One CP-5 QA-gate item. The live derivation (lib/command/qa.ts) emits this shape
// from exact findings, with a run-gate fallback only when a run has no findings.
export interface QaQueueItem {
  id: string;
  key?: string;
  issuer: string;
  module: string;
  sev: "HIGH" | "MEDIUM" | "LOW";
  age: string;
  text: string;
}

export const QA_QUEUE: QaQueueItem[] = [
  { id: "QA-117", issuer: "ATLF", module: "CP-1C", sev: "HIGH", age: "2h", text: "Citation E-44 (peer EBITDA margin) unresolved — source page mismatch in CIM Annex C" },
  { id: "QA-114", issuer: "SXAA", module: "CP-4", sev: "HIGH", age: "1d", text: "Covenant register cites superseded credit agreement draft — controlling-doc check failed" },
  { id: "QA-112", issuer: "QLMH", module: "CP-1B", sev: "MEDIUM", age: "1d", text: "Variance bridge math: D&A add-back double count $4.1M (0.9% of EBITDA)" },
  { id: "QA-109", issuer: "BLHP", module: "CP-2E", sev: "MEDIUM", age: "3d", text: "Months-to-empty uses pre-recall capex plan — refresh against May lender deck" },
  { id: "QA-105", issuer: "NWCF", module: "CP-5B", sev: "LOW", age: "4d", text: "Driver #4 lineage chain missing intermediate calc register reference" },
];

// One CP-0 source-gap row. The live derivation (lib/command/gaps.ts) emits the
// same shape from real run gap logs so GapsList can prefer live over this seed.
export interface GapItem {
  issuer: string;
  doc: string;
  impact: string;
  sev: "high" | "medium" | "low";
  requested: string;
}

export const GAPS: GapItem[] = [
  { issuer: "ATLF", doc: "Hedging register / swap confirms", impact: "CP-2F degraded — floating exposure modeled from SFA only", sev: "medium", requested: "Jun 04" },
  { issuer: "ATLF", doc: "Q4-25 management accounts", impact: "CP-1 derived-period bridge uses sponsor model figures", sev: "low", requested: "Jun 04" },
  { issuer: "QLMH", doc: "Unrestricted subsidiary financials", impact: "CP-4 leakage analysis incomplete — transfer capacity unbounded", sev: "high", requested: "Jun 06" },
  { issuer: "BLHP", doc: "May lender presentation", impact: "CP-2E liquidity bridge stale post-recall", sev: "medium", requested: "Jun 07" },
];
