// ATLF demo deal data for the Report Studio (port of design bundle shared/deal.js
// + module taxonomy from shared/data.js). Replace with live module outputs once
// CP-RENDER persistence lands (see docs/REMEDIATION_PLAN.md).

import { MODULES } from "@/lib/pipeline/data";

// Derived from the canonical module taxonomy (single source of truth).
export const MODULE_NAMES: Record<string, string> = Object.fromEntries(
  MODULES.map((m) => [m.id, m.name])
);

export const DEAL = {
  code: "ATLF",
  name: "Atlas Forge Industrials",
  sponsor: "Kestrel Capital Partners (Fund V, 68.4%)",
  rating: "B2 (stable) / B (stable)",
  sector: "Industrials — Engineered Components",
  deal: "2L TL '31 — new issue review",
  ebitda: 421,
  netLev: 5.68,
};

export interface DealDoc {
  id: string;
  name: string;
  type: string;
  pages: number;
  grade: "A" | "B" | "C";
  date: string;
  mnpi: boolean;
}

export const DOCS: DealDoc[] = [
  { id: "D-01", name: "Confidential Info Memo (2L TL '31)", type: "CIM", pages: 412, grade: "A", date: "May 2026", mnpi: false },
  { id: "D-02", name: "Senior Facilities Agreement", type: "SFA", pages: 386, grade: "A", date: "Mar 2024", mnpi: false },
  { id: "D-03", name: "2L Credit Agt (final)", type: "Credit Agt", pages: 298, grade: "A", date: "May 2026", mnpi: false },
  { id: "D-04", name: "FY23–FY25 Audited Financials", type: "Audit", pages: 214, grade: "A", date: "Feb 2026", mnpi: false },
  { id: "D-05", name: "Q1-26 Compliance Certificate", type: "Covenant", pages: 9, grade: "A", date: "Jun 2026", mnpi: false },
  { id: "D-06", name: "Lender Presentation", type: "LP", pages: 64, grade: "B", date: "May 2026", mnpi: true },
  { id: "D-07", name: "Sponsor Model (extract)", type: "Model", pages: 12, grade: "C", date: "May 2026", mnpi: true },
];

export interface DebatePoint {
  text: string;
  ev: string[];
}

export interface DebateRound {
  // CP-6A personas (Bull/Bear/Chair) + CP-6E personas (RV Trader/Compliance/CIO)
  who: "BULL" | "BEAR" | "CHAIR" | "RV" | "COMPLIANCE" | "CIO";
  phase: string;
  points: DebatePoint[];
}

export interface DebateWeight {
  claim: string;
  /** weight to the "pro" side (bull / RV trader), 0–1 */
  bull: number;
  /** weight to the "con" side (bear / compliance), 0–1 */
  bear: number;
  verdict: string;
  /** which side the chair/CIO landed on — drives the verdict color */
  lean: "pro" | "con" | "split";
  ev: string;
}

export interface DebateData {
  thesis: string;
  rounds: DebateRound[];
  weighting: DebateWeight[];
  bias: string;
  uncertainty: string;
  memo: string;
}

export const DEBATE: DebateData = {
  thesis:
    "Long 2L TL '31 at 96.4 (+388bps DM). Engineered-components platform with sticky aftermarket mix (44% of gross profit), 5.7x net leverage through the 2L TL, sponsor equity cushion ≈ 42% of capitalization at entry multiple.",
  rounds: [
    { who: "BULL", phase: "Opening Statement", points: [
      { text: "Aftermarket revenue (44% of GP) is contract-locked with 92% renewal — recurring stream covers fixed charges 1.6x on its own.", ev: ["E-12", "E-31"] },
      { text: "FCF conversion 41% vs peer median 33%; deleveraging path to 4.9x by FY27 without multiple expansion.", ev: ["E-22", "E-58"] },
      { text: "At +388bps the 2L TL prices a B3 outcome; CP-1C fair-value band implies +325–340bps for the fundamental profile.", ev: ["E-44", "E-71"] },
    ] },
    { who: "BEAR", phase: "Cross-Examination", points: [
      { text: "Adj. EBITDA includes $76.6M add-backs (18.2%) — synergy and 'one-time' operational items recur in 3 of last 4 years. Real leverage nearer 6.9x.", ev: ["E-09", "E-87"] },
      { text: "Top-3 OEM concentration at 38%; Meridian-platform contract (14% of revenue) reprices Q2-27 amid OEM insourcing pressure.", ev: ["E-15"] },
      { text: "CP-4C: $612M day-one incremental capacity, MFN sunset at 12 months, RP builder basket already at $240M — priming and leakage paths are open.", ev: ["E-63", "E-64"] },
      { text: "The +61bps 'cheapness' vs peers leans on citation E-44, which is the open QA-117 finding. Strike it and the RV case thins to +20bps.", ev: ["E-44"] },
    ] },
    { who: "BULL", phase: "Defense", points: [
      { text: "Add-back realization is auditable: $41M of the $76.6M is closed-plant savings already in Q1-26 run-rate (compliance cert confirms 5.68x covenant calc).", ev: ["E-103"] },
      { text: "Concentration is mitigated by 7-year LTAs with cost pass-through; CP-2B stress case still shows 14 months-to-empty.", ev: ["E-31", "E-77"] },
      { text: "Concede E-44 dependency — re-run CP-1C ex-E-44 still shows +20–25bps excess vs sector beta; thesis is carry + deleveraging, not spread convergence alone.", ev: [] },
    ] },
  ] as DebateRound[],
  weighting: [
    { claim: "EBITDA quality / true leverage", bull: 0.35, bear: 0.65, verdict: "BEAR — haircut adj. EBITDA by $35M in base case", lean: "con", ev: "E-09 · E-87 · E-103" },
    { claim: "Aftermarket stickiness & FCF", bull: 0.8, bear: 0.2, verdict: "BULL — strongest evidenced claim in record", lean: "pro", ev: "E-12 · E-22 · E-31" },
    { claim: "RV cheapness vs peers", bull: 0.45, bear: 0.55, verdict: "SPLIT — pending QA-117; use ex-E-44 band", lean: "split", ev: "E-44 (open)" },
    { claim: "Documentation / priming risk", bull: 0.25, bear: 0.75, verdict: "BEAR — capacity is real; price it via sizing, not exclusion", lean: "con", ev: "E-63 · E-64" },
    { claim: "Sponsor alignment", bull: 0.55, bear: 0.45, verdict: "NEUTRAL — Fund VI close supports, recap history offsets", lean: "split", ev: "E-91" },
  ],
  bias: "CONSTRUCTIVE — add on weakness",
  uncertainty:
    "Sustainability of the $41M closed-plant savings inside the add-back stack: if Q3-26 run-rate slips, true leverage re-rates to ~6.4x and the deleveraging narrative fails.",
  memo:
    "The Chair finds the bear case on EBITDA quality persuasive but fully priced at +388bps; the bull case on aftermarket durability survives cross-examination intact. Initiate at modest size with hard add/trim triggers tied to add-back realization (Q3-26 compliance cert) and resolution of QA-117. Escalate to IC re-vote if Meridian-platform contract renewal terms degrade.",
};

// CP-6E Portfolio Debate — same adversarial shape as CP-6A (DEBATE), but the
// personas are RV Trader (pro) vs Compliance (con) with the CIO as chair, and
// the contest is sizing/posture rather than the credit verdict. Sourced from the
// CP-6E workflow step outputs (RV pitch / compliance attack / RV defense / CIO
// weighting + allocation matrix + final memo).
export const DEBATE_6E: DebateData = {
  thesis:
    "Carry-adjusted return on the 2L TL '31 clears the hurdle at any size — the contest is conviction (max now at +388 DM) vs constraints: the B3-or-below quality bucket at 91% utilization, the E-44-dependent entry band, and SXAA correlation overlap. Three contested points, each with a named owner.",
  rounds: [
    { who: "RV", phase: "Trader's Pitch — max size now", points: [
      { text: "+388 entry clears the hurdle hold-to-maturity with zero tightening assumed.", ev: [] },
      { text: "Two-way depth ($4.2M avg prints) supports building the full position inside two weeks — live marks Jun 8 at 96.25 / 96.75.", ev: ["E-71"] },
      { text: "The catalyst calendar is front-loaded — being underweight into the Jul 28 print wastes the entry.", ev: [] },
    ] },
    { who: "COMPLIANCE", phase: "Compliance Attack", points: [
      { text: "B3-or-below bucket at 91% utilization — max size leaves 0.3% headroom for the entire book.", ev: [] },
      { text: "The entry band leans on the open E-44 finding — this is sizing off a contested signal.", ev: ["E-44"] },
      { text: "SXAA correlation overlap — same OEM exposure class; the cluster sits at 14% of the 16% limit.", ev: [] },
    ] },
    { who: "RV", phase: "Trader's Defense", points: [
      { text: "Concede staging — propose the standing constraint: 75bps now at +388 or wider, max gated on T-1 plus a same-day bucket re-test.", ev: [] },
      { text: "Standing limit order at +400bps; no concurrent SXAA adds.", ev: [] },
      { text: "Each objection converts into a wired rule rather than a debate point.", ev: [] },
    ] },
  ],
  weighting: [
    { claim: "Size at max immediately (+388 entry)", bull: 0.35, bear: 0.65, verdict: "COMPLIANCE — start 75bps; max requires a bucket-headroom check", lean: "con", ev: "E-71" },
    { claim: "RV signal validity", bull: 0.45, bear: 0.55, verdict: "SPLIT — size off the ex-E-44 band (+20–25bps) until QA-117 clears", lean: "split", ev: "E-44 (open)" },
    { claim: "Correlation with auto/industrial cluster", bull: 0.5, bear: 0.5, verdict: "MANAGED — no concurrent SXAA adds; monitor weekly", lean: "split", ev: "—" },
  ],
  bias: "ADD-ON-WEAKNESS — 75bps initial, 125bps max",
  uncertainty:
    "Whether the B3-or-below bucket frees up before the entry window closes — at 91% utilization the path to max size depends on book-level turnover, not the credit itself.",
  memo:
    "Approve 75bps initial at +388 or wider; standing limit order at +400bps. The path to the 125bps max is gated on the Q3-26 add-back certificate (trigger T-1) and same-day B3-bucket headroom. Trim on RP-basket activation (T-4) or a CP-3 re-rank below 4/7. The position is sized so that being wrong costs a quarter's carry, not the year's budget.",
};

export const COVENANTS = [
  { ref: "2L Credit Agt §4.09(b)(1)", name: "Ratio Debt", agg: 8, headroom: "$310M ratio + $150M freebie", flag: "critical", clause: "…may Incur Indebtedness if the Fixed Charge Coverage Ratio … would be at least 2.00 to 1.00, determined on a pro forma basis (including a pro forma application of the net proceeds therefrom)…", read: "Open ratio basket. Pro-forma EBITDA includes uncapped 'expected cost savings' (24-month realization window) — effective capacity well above headline." },
  { ref: "2L Credit Agt §4.09(b)(14)", name: "Incremental / Freebie", agg: 9, headroom: "$612M day-one", flag: "critical", clause: "…the greater of $150.0 million and 35% of Consolidated EBITDA, plus unlimited amounts subject to 5.25x Secured Leverage…", read: "Grower freebie + ratio capacity = $612M day-one priming capacity ahead of the 2L TL. MFN protection sunsets after 12 months." },
  { ref: "2L Credit Agt §4.07(a)", name: "Restricted Payments", agg: 7, headroom: "$240M usable today", flag: "warning", clause: "…50% of Consolidated Net Income builder, plus the Available Amount, plus a starter basket of the greater of $100.0 million and 22.5% of Consolidated EBITDA…", read: "Builder at $240M and growing; no leverage governor on starter basket. Dividend recap possible without amendment by FY27." },
  { ref: "2L Credit Agt §4.15 / def. 'Unrestricted Subsidiary'", name: "Asset Transfer (J.Crew)", agg: 3, headroom: "Blocked", flag: "ok", clause: "…the Issuer may designate any Restricted Subsidiary as an Unrestricted Subsidiary if such designation would not cause a Default; provided that no Material Intellectual Property may be transferred…", read: "J.Crew blocker PRESENT and well-drafted ('Material IP' broadly defined). Chewy-style guarantee-release also blocked via §10.04 amendment." },
  { ref: "SFA §7.02 (springing)", name: "Financial Covenant", agg: 4, headroom: "28% EBITDA cushion", flag: "ok", clause: "…First Lien Net Leverage shall not exceed 7.10:1.00, tested only when RCF utilization (excl. LCs) exceeds 40%…", read: "Springing only; current utilization 22%. Cushion vs covenant ≈ 28% of EBITDA — not a near-term default vector." },
  { ref: "2L Credit Agt §2.05 (soft-call)", name: "Soft-Call / Prepayment", agg: 2, headroom: "101 soft-call to Nov-26", flag: "ok", clause: "…the Loans may be voluntarily prepaid at any time; provided that any prepayment on or prior to the date six months after the Closing Date shall be accompanied by a 1.00% prepayment premium (101 soft-call)…", read: "101 soft-call lapses six months after close; par-prepayable thereafter. Repricing / refi risk is the trade-off for loan format — monitor primary-market spreads for a repricing trigger." },
];

export const CAPACITY = {
  nearest:
    "RP builder basket — usable $240M today; crosses $300M (≈ one full turn of dividend) at FY26 year-end on current CNI build",
  incDebt: 612,
  rpToday: 240,
  addback: 76.6,
  addbackPct: 18.2,
};

// CP-3B-06 Recovery sensitivity — claims ($M) and scenario EVs
export const CAPSTACK = [
  { cls: "RCF (drawn)", key: "1l", claim: 120, rate: "S+350" },
  { cls: "Term Loan B", key: "1l", claim: 1850, rate: "S+375" },
  { cls: "2nd Lien Term Loan", key: "2l", claim: 900, rate: "S+425" },
  { cls: "Subordinated Notes", key: "sub", claim: 400, rate: "10.00%" },
  { cls: "Sponsor Equity", key: "eq", claim: 1640, rate: "—" },
];

export const RECOVERY = [
  { scen: "Upside", mult: "7.5x", ebitda: 421, ev: 3158, note: "strategic sale; aftermarket re-rated" },
  { scen: "Base distress", mult: "6.0x", ebitda: 360, ev: 2160, note: "cyclical downturn; add-backs 50% realized" },
  { scen: "Severe", mult: "5.0x", ebitda: 295, ev: 1475, note: "OEM loss + destocking; LME attempted" },
];

export const SIZING = {
  decision: "INITIATE — 2L TL '31",
  initial: "75bps of NAV",
  max: "125bps",
  entry: "≤ 96.75 / ≥ +380bps",
  constraint: "Single-issuer limit 150bps; B3-or-below bucket at 91% utilization — max size requires bucket headroom check at add.",
  addTriggers: [
    "Q3-26 compliance cert shows ≥ $38M add-back realization",
    "QA-117 resolved with E-44 re-verified",
    "DM ≥ +420bps on no new fundamental information",
  ],
  trimTriggers: [
    "Meridian-platform renewal priced > 200bps concession",
    "RP basket usage announced > $150M",
    "Months-to-empty < 12 on CP-2E refresh",
  ],
};

export const TRIGGERS = [
  { id: "T-1", text: "Add-back realization < $30M at Q3-26 cert", owner: "CP-1 → CP-6A re-vote", sev: "critical" },
  { id: "T-2", text: "Incremental raise > $200M inside 12-month MFN sunset", owner: "CP-4C → CP-3B re-rank", sev: "critical" },
  { id: "T-3", text: "Top-3 OEM concentration > 42% on any quarter", owner: "CP-2B pathway P1", sev: "warning" },
  { id: "T-4", text: "Sponsor announces dividend recap exploration", owner: "CP-2D → CP-6E sizing review", sev: "warning" },
];
