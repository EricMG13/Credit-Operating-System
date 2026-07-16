// AUTO-PORTED from the Credit OS design bundle (shared/step-outputs-l1/l2/l3/l456.js).
// ATLF demo data — replace with live module outputs when CP backend persistence lands.
import { PEER_CREDIT_METRIC_ROWS } from "./module-outputs";
import type { OutSection, OutFlag } from "./module-outputs";

export interface StepOutput { ref?: string; out?: string; sections: OutSection[] }

const T = (title: string, cols: string[], align: number[], rows: string[][]): OutSection => ({ type: "table", title, cols, align, rows });
const X = (title: string, body: string, ev?: string[]): OutSection => ({ type: "text", title, body, ev });
const F = (title: string, items: OutFlag[]): OutSection => ({ type: "flags", title, items });

// ── from step-outputs-l1.js ──
const O0: Record<string, StepOutput> = {
    /* ================= CP-0 · DocumentIntakeManager ================= */
    "CP-0:File Classification": { ref: "REF_CP-0_A", out: "File classification register", sections: [
      T("CP-0-A · File classification register (14 files)", ["ID", "File", "Class", "Pages", "Status"], [0,0,0,1,0], [
        ["D-01", "Confidential Info Memo — 2L TL '31", "CIM", "412", "CLASSIFIED"],
        ["D-02", "Senior Facilities Agreement (conformed)", "SFA", "287", "CLASSIFIED"],
        ["D-03", "2L Credit Agt (executed, final)", "CRED AGT", "231", "CLASSIFIED"],
        ["D-04", "FY23–FY25 Audited Financial Statements", "AUDIT", "104", "CLASSIFIED"],
        ["D-05", "Q1-26 Compliance Certificate", "COVENANT", "9", "CLASSIFIED"],
        ["D-06", "Lender Presentation (May-26)", "LP", "48", "CLASSIFIED · MNPI"],
        ["D-07", "Sponsor Model Extract (FY26E bridge)", "MODEL", "14", "CLASSIFIED · MNPI"],
        ["S-01–S-07", "Supporting exhibits — org chart, plant list, insurance, tax structure, contracts index, IT, ESG", "SUPPORT", "96", "CLASSIFIED"],
      ]),
      X("Classification note", "All 14 files typed on first pass with zero unclassifiable or corrupted items. The two MNPI files (D-06, D-07) were flagged at intake and routed only to walled consumers (CP-1B, CP-2D)."),
    ]},
    "CP-0:Entity Identification": { ref: "REF_CP-0_B", out: "Entity register", sections: [
      T("CP-0-B · Entity register", ["Entity", "Role", "Jurisdiction", "Perimeter"], [0,0,0,0], [
        ["Atlas Forge Intermediate Holdings, Inc.", "Issuer / covenant reporting entity", "Delaware", "RESTRICTED"],
        ["Atlas Forge Industrials LLC", "Principal operating company · guarantor", "Delaware", "RESTRICTED"],
        ["Hartwell Precision, Inc.", "Subsidiary guarantor (2023 bolt-on)", "Ohio", "RESTRICTED"],
        ["Atlas Forge de México S. de R.L.", "Non-guarantor operating subsidiary", "Mexico", "RESTRICTED · NON-GUAR"],
        ["Kestrel Capital Fund V, L.P.", "Sponsor — 68.4% control", "Delaware", "OUTSIDE GROUP"],
      ]),
      X("Perimeter note", "One canonical entity key established (Atlas Forge Intermediate Holdings). No unrestricted subsidiaries exist at close — relevant to CP-4's transfer-basket analysis. Every downstream module cites this register."),
    ]},
    "CP-0:Document Mapping": { ref: "REF_CP-0_C", out: "Document-to-module map", sections: [
      T("CP-0-C · Document-to-module routing", ["Doc", "Primary consumers", "Secondary"], [0,0,0], [
        ["D-01 CIM", "CP-1 · CP-1A · CP-1C", "CP-2 · CP-3B"],
        ["D-02 SFA", "CP-4 · CP-4C", "CP-1 (definitions) · CP-2F"],
        ["D-03 Credit Agt", "CP-4 · CP-4C", "CP-3B · CP-3D"],
        ["D-04 Audits", "CP-1 · CP-2E", "CP-1C · CP-5B"],
        ["D-05 Compliance Cert", "CP-1 · CP-4C", "CP-2E"],
        ["D-06 Lender Pres (MNPI)", "CP-2D", "CP-1B"],
        ["D-07 Sponsor Model (MNPI)", "CP-1B", "CP-1 (derived period only)"],
      ]),
    ]},
    "CP-0:Quality Assignment": { ref: "REF_CP-0_D", out: "Quality grade register", sections: [
      T("CP-0-D · Quality assignment", ["Doc", "Grade", "Rationale"], [0,0,0], [
        ["D-01 CIM", "A", "Executed offering document, counsel-reviewed, conformed"],
        ["D-02 SFA / D-03 Credit Agt", "A", "Executed legal documents — controlling authority"],
        ["D-04 Audits", "A", "Audited, unqualified opinion, three fiscal years"],
        ["D-05 Compliance Cert", "A", "Officer-certified covenant calculations"],
        ["D-06 Lender Presentation", "B", "Sponsor-prepared marketing material · MNPI handling"],
        ["D-07 Sponsor Model", "C", "Unaudited, sponsor-authored — [Analyst estimate] use only"],
      ]),
    ]},
    "CP-0:Content-Module Mapping": { ref: "REF_CP-0_E", out: "Content anchor register", sections: [
      T("CP-0-E · Section-level anchors (sample of 312)", ["Anchor", "Content", "Routed to"], [0,0,0], [
        ["D-01 p.97–99", "Business — segments, customers, aftermarket", "CP-1A"],
        ["D-01 p.214", "Adjusted EBITDA reconciliation", "CP-1 · CP-4C"],
        ["D-01 Annex C", "Industry & peer data", "CP-1C"],
        ["D-03 §4.07 / §4.09", "RP baskets · incremental debt", "CP-4C"],
        ["D-04 p.31 / p.44", "Cash flows · liquidity disclosure", "CP-1 · CP-2E"],
        ["D-04 p.58", "Restructuring charges note FY22–25", "CP-1 · CP-4C"],
        ["D-05 p.3", "Covenant ratio calculations", "CP-1 · CP-4C"],
      ]),
      X("Coverage", "312 content anchors registered to the master index. Every E-xx citation issued downstream must resolve to one of these anchors — unanchored extraction is a prohibited behavior."),
    ]},
    "CP-0:Gap Logging": { ref: "REF_CP-0_F", out: "Gap log", sections: [
      F("CP-0-F · Gap log", [
        { sev: "warning", text: "G-01 — Hedging register / swap confirmations not provided. Affected: CP-2F (degraded mode), CP-6A (macro weighting). Limitation L-04 attached. Re-requested Jun 04; no response at route time." },
        { sev: "low", text: "G-02 — Q4-25 management accounts missing. Affected: CP-1 (derived period), CP-1B (quarterly comparability). Degraded-mode instruction: construct Q4-25 from sponsor model at [Analyst estimate] status.", ev: ["E-58"] },
      ]),
      X("Disposition", "Neither gap blocks the route. Both carry explicit degraded-mode instructions and re-request dates; both surface as limitations on every affected output object rather than being silently absorbed."),
    ]},
    "CP-0:Conflict Logging": { ref: "REF_CP-0_G", out: "Conflict log", sections: [
      T("CP-0-G · Intake tie-out checks", ["Check", "Result"], [0,0], [
        ["CIM summary financials vs audited statements", "TIE — within 0.3% on every line"],
        ["Compliance cert covenant EBITDA vs SFA definition", "TIE — $421.4M reproduces"],
        ["Lender presentation KPIs vs audit", "2 presentational variances — non-conflicting, noted"],
        ["Sponsor model basis vs audited presentation", "DIVERGENT — escalated to CP-1 definition register"],
      ]),
      X("Conflict count", "0 unresolved conflicts at intake. The sponsor-model basis divergence is logged for CP-1's definition conflict register rather than reconciled silently here."),
    ]},
    "CP-0:File Quality Risk": { ref: "REF_CP-0_H", out: "File quality risk assessment", sections: [
      T("CP-0-H · Quality risk by analytical surface", ["Surface", "Coverage", "Risk"], [0,0,0], [
        ["Historical financials", "Grade A (audits + CIM)", "LOW"],
        ["Legal / covenant analysis", "Grade A (executed docs)", "LOW"],
        ["Current-quarter earnings", "Grade A (cert) + B (LP)", "LOW"],
        ["Forward projections", "Grade C only (sponsor model)", "ELEVATED — quarantined to upside case"],
        ["Hedging posture", "NOT COVERED (G-01)", "ELEVATED — degraded mode"],
      ]),
    ]},
    "CP-0:Downstream Readiness": { ref: "REF_CP-0_I", out: "Readiness score + register", sections: [
      T("CP-0-I · Readiness by layer", ["Layer", "Modules", "Readiness", "Blockers"], [0,0,0,0], [
        ["L1 Base", "CP-1 · 1A · 1B · 1C", "READY", "none"],
        ["L2 Synthesis", "CP-2 · 2B · 2C · 2D · 2E · 2F", "READY*", "CP-2F degraded (G-01)"],
        ["L3 Relative value", "CP-3 · 3B · 3C · 3D", "READY", "none"],
        ["L4 Legal", "CP-4 · 4C", "READY", "none"],
        ["L5–L6 Governance / debate", "CP-5 · 5B · 6A · 6E", "READY", "gated on upstream"],
      ]),
      X("Score", "Composite readiness 0.91 against the 0.85 full-run threshold — full run authorized. The only scope deviation is CP-2F's degraded mode."),
    ]},
    "CP-0:Master Index Update": { ref: "REF_CP-0_J", out: "Master index", sections: [
      T("CP-0-J · Master index summary", ["Field", "Value"], [0,1], [
        ["Documents registered", "14"], ["Content anchors", "312"], ["Entities", "5"],
        ["Open gaps", "2 (G-01, G-02)"], ["Unresolved conflicts", "0"], ["Index version", "v1.0 · RUN #2641"],
      ]),
      X("Note", "The master index is the single addressable map for the run: every downstream citation, lineage chain and QA audit resolves against it."),
    ]},
    "CP-0:Export Assembly": { ref: "REF_CP-0_K", out: "Intake export package", sections: [
      T("CP-0-K · Export package contents", ["Component", "Status"], [0,0], [
        ["Document map + quality grades", "ASSEMBLED"], ["Entity register", "ASSEMBLED"],
        ["Content anchor index (312)", "ASSEMBLED"], ["Gap / conflict logs", "ASSEMBLED"],
        ["Readiness score + degraded-mode instructions", "ASSEMBLED"], ["Handoff to CP-X", "DELIVERED 09:14 ET"],
      ]),
    ]},

    /* ================= CP-X · Orchestrator ================= */
    "CP-X:Route Plan Source Gate": { ref: "REF_CP-X · TX.1", out: "Gate decision", sections: [
      T("TX.1 · Gate criteria", ["Criterion", "Threshold", "Actual", "Result"], [0,1,1,0], [
        ["CP-0 readiness score", "≥ 0.85", "0.91", "PASS"],
        ["Grade-A coverage of thesis-critical claims", "100%", "100%", "PASS"],
        ["Blocking gaps", "0", "0", "PASS"],
        ["Non-blocking gaps w/ instructions", "—", "2", "CARRIED"],
      ]),
      X("Decision", "READY WITH LIMITATIONS — full run authorized on route template v2.2 (new-issue committee review). G-01 carried as limitation L-04 rather than a blocker."),
    ]},
    "CP-X:Module Execution Sequence": { ref: "REF_CP-X · TX.2", out: "Execution sequence", sections: [
      T("TX.2 · 8-wave sequence", ["Wave", "Modules", "Gate condition"], [0,0,0], [
        ["W1", "CP-0", "source readiness ≥ 0.85"],
        ["W2", "CP-X", "route plan locked"],
        ["W3", "CP-1 · CP-1A", "CP-0 PASS"],
        ["W4", "CP-1B · CP-1C", "CP-1 coverage gate GREEN"],
        ["W5", "CP-2", "L1 complete"],
        ["W6", "CP-2B–CP-2F · CP-3 · CP-3D", "CP-2 view published"],
        ["W7", "CP-3B · CP-3C · CP-4 · CP-4C", "CP-3 ranking + legal docs gated"],
        ["W8", "CP-6A → CP-6E → CP-5B → CP-5", "J1 join — all upstream complete"],
      ]),
    ]},
    "CP-X:Module Readiness Register": { ref: "REF_CP-X · TX.3", out: "Readiness register", sections: [
      T("TX.3 · Module readiness at route time", ["Module group", "Count", "Status"], [0,1,0], [
        ["L1 base (CP-1 family)", "4", "GREEN"],
        ["L2 synthesis (CP-2 family)", "6", "GREEN — CP-2F degraded"],
        ["L3 relative value (CP-3 family)", "4", "GREEN"],
        ["L4 legal (CP-4 / 4C)", "2", "GREEN"],
        ["L5–L6 governance / debate", "5", "GREEN — gated on J1"],
      ]),
    ]},
    "CP-X:One-Owner-Per-Object Validation": { ref: "REF_CP-X · TX.4", out: "Ownership validation", sections: [
      T("TX.4 · Object ownership (material objects)", ["Object class", "Owner", "Consumers"], [0,0,0], [
        ["Normalized financials + KPI register", "CP-1", "all L2/L3 modules"],
        ["Covenant capacity math", "CP-4C", "CP-3B · CP-3D · CP-6A"],
        ["Recovery waterfall", "CP-3B", "CP-3C · CP-6E"],
        ["Fair-value band", "CP-3", "CP-6A · CP-6E"],
        ["Liquidity bridge / months-to-empty", "CP-2E", "CP-2B · CP-3D"],
      ]),
      X("Result", "0 ownership collisions. Consumers reference owned objects by ID; recomputation of another module's object is a prohibited behavior and none was detected."),
    ]},
    "CP-X:Source-to-Module Routing Map": { ref: "REF_CP-X · TX.5", out: "Routing map", sections: [
      T("TX.5 · Routing with MNPI walls", ["Source", "Routed to", "Wall"], [0,0,0], [
        ["D-01 / D-04 / D-05 (grade A)", "all analytical modules", "none"],
        ["D-02 / D-03 (legal)", "CP-4 · CP-4C (+ ref by CP-3B/3D)", "none"],
        ["D-06 lender presentation", "CP-2D · CP-1B", "MNPI — walled"],
        ["D-07 sponsor model", "CP-1B · CP-1 (derived period)", "MNPI — walled"],
        ["MKT — LoanX / dealer runs", "CP-1C · CP-3 · CP-3C", "public side"],
      ]),
    ]},
    "CP-X:Limitation Propagation Register": { ref: "REF_CP-X · TX.6", out: "Limitation register", sections: [
      F("TX.6 · Propagated limitations", [
        { sev: "warning", text: "L-04 (from G-01): hedging register absent — attaches to every CP-2F output object; CP-6A instructed to weight macro claims as upper-bound estimates." },
        { sev: "low", text: "G-02 instruction: CP-1 derived Q4-25 carries [Analyst estimate] status; CP-1B caveats quarterly comparisons crossing the period.", ev: ["E-58"] },
      ]),
    ]},
    "CP-X:Route Plan Summary": { ref: "REF_CP-X · TX.7", out: "Route plan summary", sections: [
      X("TX.7 · Summary", "Full run authorized, status READY WITH LIMITATIONS. 24 modules sequenced across 8 waves on route template v2.2; one-owner validation clean; J1 join holds the debate layer until every analytical feeder lands. CP-2F degraded mode is the only scope deviation. Expected wall-clock ≈ 46 minutes at current concurrency."),
    ]},

    /* ================= CP-1 · FinancialSpreading ================= */
    "CP-1:Source Register (file gate)": { ref: "REF_CP-1_01 · T4.1", out: "Source register + gate decision", sections: [
      T("T4.1 · Admitted sources", ["Doc", "Role in spreading", "Grade", "Decision"], [0,0,0,0], [
        ["D-04 Audits FY23–25", "Primary basis — all statements", "A", "ADMITTED"],
        ["D-01 CIM financials", "LTM + adjustment detail", "A", "ADMITTED"],
        ["D-05 Compliance cert", "Covenant EBITDA + ratios", "A", "ADMITTED"],
        ["D-07 Sponsor model", "Derived Q4-25 only", "C", "ADMITTED · RESTRICTED"],
      ]),
      X("Gate decision", "PASS — three audited fiscal years plus LTM at quarterly grain available. No statement absent; no period requires interpolation beyond the registered Q4-25 derivation."),
    ]},
    "CP-1:Entity / Period Key": { ref: "REF_CP-1_02 · T4.2", out: "Entity / period key", sections: [
      T("T4.2 · Key", ["Field", "Value"], [0,0], [
        ["Entity", "Atlas Forge Intermediate Holdings, Inc. (consolidated)"],
        ["Fiscal year end", "December 31"],
        ["Periods", "12 — FY23, FY24, FY25 quarterly + LTM Q1-26"],
        ["Grain", "Quarterly"],
        ["Currency", "USD millions"],
        ["Basis", "US GAAP, audited; LTM per CIM/cert"],
      ]),
    ]},
    "CP-1:Normalization Register": { ref: "REF_CP-1_03 · T4.3", out: "Normalization register", sections: [
      T("T4.3 · Normalization adjustments", ["Adjustment", "Treatment", "Impact ($M)"], [0,0,1], [
        ["Hartwell acquisition (Jun-23)", "Pro-forma included from acquisition date only — no full-year restatement", "—"],
        ["FX translation (EUR / MXN ops)", "Constant-rate KPI series built alongside reported", "±4.1 rev / qtr"],
        ["53-week FY24", "Week-53 revenue normalized out of growth rates", "−12.0 rev"],
        ["Discontinued line (legacy castings, FY23)", "Excluded from continuing-ops series", "−18.2 rev · −1.1 EBITDA"],
        ["Operating lease classification", "ASC 842 treatment preserved; leases excluded from debt for covenant series", "84.0 leases"],
      ]),
      X("Tie-out", "Normalized series ties to audited financials within 0.3% on every line; each adjustment carries an audit-trail reference in the calc register."),
    ]},
    "CP-1:Income Statement Coverage": { ref: "REF_CP-1_04 · T4.4", out: "Income statement (all periods)", sections: [
      T("T4.4 · Income statement ($M)", ["", "FY23", "FY24", "FY25", "LTM Q1-26"], [0,1,1,1,1], [
        ["Revenue", "2,410", "2,588", "2,742", "2,801"],
        ["Cost of goods sold", "(1,832)", "(1,959)", "(2,068)", "(2,110)"],
        ["Gross profit", "578", "629", "674", "691"],
        ["Gross margin", "24.0%", "24.3%", "24.6%", "24.7%"],
        ["SG&A + other opex", "(260)", "(300)", "(333)", "(347)"],
        ["Reported EBITDA", "318", "329", "341", "344"],
        ["Add-backs (per CIM reconciliation)", "40", "63", "74", "77"],
        ["Adjusted EBITDA", "358", "392", "415", "421"],
        ["D&A", "(128)", "(131)", "(134)", "(136)"],
        ["EBIT (reported)", "190", "198", "207", "208"],
        ["Interest expense", "(188)", "(192)", "(195)", "(196)"],
        ["Pre-tax income", "2", "6", "12", "12"],
        ["Tax", "(1)", "(2)", "(4)", "(4)"],
        ["Net income", "1", "4", "8", "8"],
      ]),
      X("Coverage note", "Full coverage at quarterly grain, all periods. The add-back bridge is preserved as separate lines — reported vs adjusted EBITDA never netted.", ["E-09"]),
    ]},
    "CP-1:Cash Flow Statement Coverage": { ref: "REF_CP-1_05 · T4.5", out: "Cash flow statement (all periods)", sections: [
      T("T4.5 · Cash flow statement ($M)", ["", "FY23", "FY24", "FY25", "LTM Q1-26"], [0,1,1,1,1], [
        ["OCF before working capital", "252", "278", "301", "308"],
        ["Working capital change", "(14)", "(12)", "(14)", "(15)"],
        ["Operating cash flow", "238", "266", "287", "293"],
        ["Capex — maintenance", "[null — not disclosed]", "[null]", "[null]", "[null]"],
        ["Capex — growth", "[null — not disclosed]", "[null]", "[null]", "[null]"],
        ["Capex — total", "(96)", "(108)", "(118)", "(121)"],
        ["Levered free cash flow", "142", "158", "169", "172"],
        ["Acquisitions (Hartwell)", "(210)", "—", "—", "—"],
        ["Disposals", "6", "2", "3", "3"],
        ["Debt issuance / (repayment), net", "192", "232", "(18)", "(18)"],
        ["Dividends / equity buyback", "—", "—", "—", "—"],
        ["Net cash change", "130", "25", "26", "12"],
        ["Cash taxes paid", "(31)", "(36)", "(41)", "(42)"],
        ["Cash interest paid", "(181)", "(188)", "(193)", "(196)"],
      ]),
      X("Coverage note", "Maintenance/growth capex split not disclosed — stored null per template, total capex carried; flagged to CP-2 (impact: capex-flexibility assessment uses analyst split). Cash interest paid (CFS) runs $0–3M below IS interest expense — PIK-free structure confirmed.", ["E-22"]),
    ]},
    "CP-1:Balance Sheet Coverage": { ref: "REF_CP-1_06 · T4.6", out: "Balance sheet (all periods)", sections: [
      T("T4.6 · Balance sheet ($M)", ["", "FY23", "FY24", "FY25", "LTM Q1-26"], [0,1,1,1,1], [
        ["Cash & equivalents", "121", "146", "172", "184"],
        ["Accounts receivable", "398", "418", "441", "452"],
        ["Inventory", "372", "381", "396", "401"],
        ["Net PP&E", "902", "894", "881", "876"],
        ["Goodwill & intangibles", "1,588", "1,571", "1,544", "1,538"],
        ["Total assets", "3,556", "3,584", "3,611", "3,628"],
        ["Gross debt (ex-leases)", "2,513", "2,517", "2,552", "2,575"],
        ["Operating leases", "88", "86", "85", "84"],
        ["Net debt", "2,392", "2,371", "2,380", "2,391"],
        ["Shareholders' equity (deficit)", "(184)", "(178)", "(196)", "(202)"],
      ]),
      X("Coverage note", "Full coverage all periods; the net debt build reconciles to the facility-level schedule consumed by CP-3B. Negative book equity is LBO-structural (goodwill amortization + dividend at 2021 close), not a deterioration signal."),
    ]},
    "CP-1:Normalized Financials Table": { ref: "REF_CP-1_07 · T4.7", out: "Normalized financials (canonical)", sections: [
      T("T4.7 · Normalized financials ($M)", ["", "FY23", "FY24", "FY25", "LTM Q1-26"], [0,1,1,1,1], [
        ["Revenue", "2,410", "2,588", "2,742", "2,801"],
        ["Adj. EBITDA", "358", "392", "415", "421"],
        ["Adj. EBITDA margin", "14.9%", "15.1%", "15.1%", "15.0%"],
        ["Reported EBITDA (pre add-back)", "318", "329", "341", "344"],
        ["Capex", "(96)", "(108)", "(118)", "(121)"],
        ["Free cash flow", "142", "158", "169", "172"],
        ["Net debt", "2,392", "2,371", "2,380", "2,391"],
        ["Net leverage (adj.)", "6.7x", "6.0x", "5.7x", "5.7x"],
        ["Interest coverage", "1.9x", "2.0x", "2.1x", "2.1x"],
      ]),
      X("Status", "Canonical table — these are the figures every downstream module consumes. Any module quoting different values is a CP-5 consistency defect.", ["E-103"]),
    ]},
    "CP-1:Derived Period Register": { ref: "REF_CP-1_08 · T4.8", out: "Derived period register", sections: [
      T("T4.8 · Derived periods", ["Period", "Method", "Status"], [0,0,0], [
        ["Q4-25", "FY25 audited less reported Q1–Q3, cross-checked to sponsor model phasing", "[Analyst estimate] — gap G-02"],
      ]),
      X("Caveat", "Q4-25 management accounts were not provided. The derived quarter is flagged to CP-1B so quarterly variance work does not over-read the period; annual figures are unaffected (audited).", ["E-58"]),
    ]},
    "CP-1:Calc Register + KPI Build": { ref: "REF_CP-1_09 · T4.9/T4.10", out: "Calculation register — 41 KPIs", sections: [
      T("T4.9 · Calc register (material KPIs of 41)", ["ID", "KPI", "Definition", "LTM"], [0,0,0,1], [
        ["K-01", "Net leverage (adj.)", "Net debt ÷ adj. EBITDA", "5.68x"],
        ["K-04", "Secured leverage", "Secured debt ÷ covenant EBITDA (SFA)", "4.68x"],
        ["K-09", "Covenant EBITDA", "Per SFA §1.01 — add-backs capped 25% / 24mo", "$421.4M"],
        ["K-14", "Adj. EBITDA margin", "Adj. EBITDA ÷ revenue", "15.0%"],
        ["K-22", "FCF conversion", "(OCF − capex) ÷ adj. EBITDA", "41%"],
        ["K-31", "Interest coverage", "Adj. EBITDA ÷ cash interest", "2.1x"],
        ["K-36", "Aftermarket mix", "A&S revenue ÷ total revenue", "23.4%"],
      ]),
      X("Build note", "41 KPIs registered with formula, inputs and calc references. Every downstream figure resolves to this register — ad-hoc math is a prohibited behavior.", ["E-22", "E-103"]),
    ]},
    "CP-1:Definition Conflict Register": { ref: "REF_CP-1_10 · T4.11", out: "Definition conflict register", sections: [
      T("T4.11 · Definition conflicts", ["#", "Conflict", "Divergence", "Disposition"], [0,0,1,0], [
        ["DC-1", "EBITDA add-back cap: SFA 25% / 24mo vs 2L Credit Agt uncapped", "$14.2M", "Both series carried — covenant calcs use controlling doc per facility"],
        ["DC-2", "Sponsor model EBITDA basis vs audited presentation", "$8.6M", "Model basis quarantined to [Sponsor view]; not reconciled silently"],
      ]),
      X("Note", "Conflicts are logged, not averaged. DC-1 is thesis-relevant: credit agreement grower baskets key off the larger, uncapped figure — handed to CP-4C.", ["E-09", "E-103"]),
    ]},
    "CP-1:Evidence→Risk→Credit Narrative": { ref: "REF_CP-1_11", out: "Analytical narrative by dimension", sections: [
      X("Leverage trajectory", "Evidence: net leverage 6.7x → 5.68x over nine quarters on EBITDA growth, not debt paydown (net debt flat at ~$2.4B). Risk mechanic: deleveraging is entirely earnings-dependent. Credit implication: any EBITDA stress re-rates leverage immediately — there is no amortization cushion."),
      X("Coverage & cash-flow quality", "Evidence: interest coverage 2.1x and FCF conversion 41% (K-22), with working capital consuming only ~$14M/yr. Risk mechanic: thin coverage but genuine cash generation; capex is light (4.3% of revenue). Credit implication: debt service is funded from operations with headroom; the +100bps rate channel (CP-2F) is the main coverage threat.", ["E-22"]),
      X("Earnings quality", "Evidence: $76.6M of add-backs = 18.2% of adj. EBITDA; 'one-time' charges recurred in 3 of the last 4 years (D-04 p.58). Risk mechanic: presented EBITDA overstates run-rate cash earnings if add-backs are structural. Credit implication: a $35M haircut to base EBITDA is defensible — adopted by the IC Chair in CP-6A.", ["E-09", "E-87"]),
      X("Data quality & definitions", "Evidence: gap G-02 (derived Q4-25) and conflicts DC-1/DC-2. Risk mechanic: comparability noise in quarterly series; basket capacity keys off the uncapped credit agreement definition. Credit implication: covenant capacity is larger than SFA-basis intuition suggests — quantified by CP-4C at $612M.", ["E-58"]),
    ]},
    "CP-1:Gaps + Downstream Readiness": { ref: "REF_CP-1_12 · T4.12", out: "Coverage gate + readiness", sections: [
      T("T4.12 · Downstream readiness", ["Consumer", "Requires", "Status"], [0,0,0], [
        ["CP-1B / CP-1C", "KPI register + quarterly series", "GREEN — Q4-25 caveat attached"],
        ["CP-2 family", "Normalized table + narrative", "GREEN"],
        ["CP-3B", "Debt schedule + claims", "GREEN"],
        ["CP-4C", "Covenant EBITDA series (both bases)", "GREEN"],
      ]),
      X("Coverage gate", "GREEN — all three statements present at quarterly grain FY23–LTM. G-02 is the only open item; all 11 downstream consumers cleared to start."),
    ]},

    /* ================= CP-1A · CompanyProfile ================= */
    "CP-1A:Source Basis Establishment": { ref: "REF_CP-1A_01", out: "Source basis register", sections: [
      T("Source basis", ["Source", "Use", "Authority"], [0,0,0], [
        ["D-01 CIM — Business (p.85–112)", "Segments, customers, footprint, installed base", "PRIMARY"],
        ["D-04 Audits — segment notes", "Segment revenue / profit verification", "PRIMARY"],
        ["D-06 Lender presentation", "Color only — every claim cross-checked to grade A", "SECONDARY"],
      ]),
    ]},
    "CP-1A:Source Classification": { ref: "REF_CP-1A_02", out: "Factual vs promotional split", sections: [
      T("Classification", ["Content", "Class", "Handling"], [0,0,0], [
        ["CIM risk factors, audit notes, contract terms", "FACTUAL", "Drives the record"],
        ["Market-share and TAM claims (LP p.8–14)", "PROMOTIONAL", "[Sponsor view] label, excluded from credit record"],
        ["Cost-out program targets (LP / model)", "PROMOTIONAL", "Carried only as upside case via CP-1B"],
      ]),
    ]},
    "CP-1A:Transaction Summary": { ref: "REF_CP-1A_03", out: "Transaction summary", sections: [
      T("Subject transaction", ["Field", "Value"], [0,0], [
        ["Instrument", "$900M 2nd Lien Term Loan due 2031"],
        ["Margin / OID", "S+425 · issued at 99.41 (May-26)"],
        ["Use of proceeds", "Refinance 2L bridge ($860M) + general corporate purposes"],
        ["Pro forma net leverage", "5.68x total · 4.68x secured (1L)"],
        ["Context", "Fifth capital-structure event since 2021 LBO"],
      ]),
    ]},
    "CP-1A:Business Description": { ref: "REF_CP-1A_04", out: "Credit-relevant issuer description", sections: [
      X("Description", "Engineered metal components for industrial OEMs: drivetrain assemblies, fluid-system housings and aftermarket replacement parts. 14 plants (9 US, 4 EU, 1 MX), ~8,400 employees, #1 or #2 share in 7 of 9 core product lines. The credit-relevant core is the 1.9M-unit installed base feeding Aftermarket & Services at 44% of gross profit."),
      T("Segments", ["Segment", "Revenue mix", "Gross profit mix", "Character"], [0,1,1,0], [
        ["Drivetrain", "46%", "38%", "OEM-cyclical, top-3 concentrated"],
        ["Fluid Systems", "31%", "18%", "OEM, shorter cycles"],
        ["Aftermarket & Services", "23%", "44%", "Recurring, contract-locked, 92% renewal"],
      ]),
    ]},
    "CP-1A:Ownership Register": { ref: "REF_CP-1A_05", out: "Ownership register", sections: [
      T("Ownership", ["Holder", "Stake", "Notes"], [0,1,0], [
        ["Kestrel Capital Fund V", "68.4%", "Control — drag rights, 6 of 7 board seats"],
        ["Co-invest vehicles (3 LPs)", "22.4%", "Passive, Kestrel-managed"],
        ["Management rollover", "9.2%", "CEO/CFO/COO — vested at 2021 close"],
      ]),
    ]},
    "CP-1A:Operating Model": { ref: "REF_CP-1A_06", out: "Operating model", sections: [
      X("Model", "Build-to-print and engineered-spec components manufactured across 14 plants; 71% of COGS is pass-through-indexed steel and alloys with a 60–90 day lag. Aftermarket attaches to the 1.9M-unit installed base under multi-year service agreements (avg. 7-year initial term) renewing at 92.4% by revenue with CPI-or-3% escalators.", ["E-12", "E-31"]),
      T("Operating economics", ["Driver", "Value", "Credit relevance"], [0,0,0], [
        ["Indexed COGS share", "71%", "Margin protection, lagged"],
        ["Installed base", "1.9M units", "Aftermarket annuity feedstock"],
        ["Contract renewal rate", "92.4%", "Revenue visibility"],
        ["Top-10 customer tenure", ">18 yrs", "Switching-cost evidence"],
      ]),
    ]},
    "CP-1A:History / Timeline": { ref: "REF_CP-1A_07", out: "History & transaction timeline", sections: [
      T("Timeline", ["Date", "Event", "Consideration", "Multiple"], [0,0,1,1], [
        ["Nov 2021", "LBO by Kestrel Capital Fund V", "$2,150M EV", "7.9x"],
        ["Jun 2023", "Bolt-on: Hartwell Precision (aero brackets)", "$210M", "6.4x"],
        ["Mar 2024", "Repricing + $250M incremental TLB", "—", "—"],
        ["May 2026", "2L TL $900M — refinance 2L bridge + GCP", "—", "—"],
      ]),
      X("Pattern", "Four capital-structure events in 4.5 years — steady re-leveraging at flat net debt. The history reads as a sponsor managing leverage to a ceiling, not amortizing toward exit."),
    ]},
    "CP-1A:Credit Translation": { ref: "REF_CP-1A_08", out: "Credit translation", sections: [
      F("Evidence → Risk Mechanic → Credit Implication", [
        { sev: "ok", text: "Installed-base annuity (1.9M units, 92% renewal, 44% of GP) → recurring high-margin cash flow insensitive to OEM cycles → core credit support; floors EBITDA in CP-2B stress paths.", ev: ["E-12", "E-31"] },
        { sev: "warning", text: "Top-3 OEMs at 38% of revenue, Meridian platform 14% repricing Q2-27 → volume and price risk concentrate into Drivetrain → primary downside transmission channel (CP-2B P1).", ev: ["E-15"] },
        { sev: "warning", text: "60–90 day pass-through lag on 71% of COGS → input spikes create 1–2 quarter margin gaps → noise risk around covenant test dates, not structural erosion.", ev: ["E-31"] },
      ]),
    ]},
    "CP-1A:Gaps Ledger": { ref: "REF_CP-1A_09", out: "Gaps ledger", sections: [
      X("Ledger", "No descriptive gaps — org chart, segment detail and plant footprint all source-supported. MX facility carve-out detail (transfer pricing, local debt capacity) noted as thin but non-material to the guarantor analysis."),
    ]},
    "CP-1A:Module Summary": { ref: "REF_CP-1A_10", out: "Module summary", sections: [
      X("Summary", "A scaled, defensible industrial franchise: genuine switching costs (qualified-vendor status, >18-year customer tenure) and an annuity-grade aftermarket, attached to a concentrated OEM book and a sponsor with a re-leveraging pattern. Descriptive facts handed clean to CP-2; concentration mechanics handed to CP-2B."),
    ]},

    /* ================= CP-1B · EarningsMonitor ================= */
    "CP-1B:File Gate & Source Validation": { ref: "REF_CP-1B_01", out: "Gate decision", sections: [
      T("Gate", ["Source", "Status"], [0,0], [
        ["Q1-26 interim financials (CIM-extracted)", "ADMITTED — grade A"],
        ["D-05 compliance certificate", "ADMITTED — grade A"],
        ["D-07 sponsor model", "ADMITTED — comparison basis only, grade C"],
        ["Q4-25 management accounts", "ABSENT — derived period inherited from CP-1 (G-02)"],
      ]),
    ]},
    "CP-1B:Issuer / Period Scope": { ref: "REF_CP-1B_02", out: "Scope", sections: [
      T("Scope", ["Field", "Value"], [0,0], [
        ["Window", "Q2-25 → Q1-26 (4 quarters)"],
        ["Baseline", "CP-1 normalized history — same entity key, same definitions"],
        ["Restatements", "None"],
      ]),
    ]},
    "CP-1B:Definition Inheritance": { ref: "REF_CP-1B_03", out: "Inheritance confirmation", sections: [
      X("Confirmation", "All KPI definitions inherited from the CP-1 calc register unchanged (K-01 through K-41). Margins, leverage and FCF conversion are computed identically to history, so the variances reported below are real rather than definitional."),
    ]},
    "CP-1B:Summary Top Sheet": { ref: "REF_CP-1B_04", out: "Top sheet", sections: [
      T("Q1-26 top sheet", ["Metric", "Q1-26", "vs Q1-25", "Read"], [0,1,1,0], [
        ["Revenue", "$715M", "+3.9%", "in line"],
        ["Adj. EBITDA", "$108M", "+4.9%", "in line"],
        ["Margin", "15.1%", "+10bps", "stable"],
        ["Book-to-bill", "1.06x", "+0.04x", "supportive"],
        ["Net leverage", "5.68x", "−0.3x", "deleveraging on EBITDA"],
      ]),
    ]},
    "CP-1B:Financial Performance Table": { ref: "REF_CP-1B_05", out: "Quarterly performance", sections: [
      T("Performance (quarterly, $M)", ["", "Q2-25", "Q3-25", "Q4-25*", "Q1-26"], [0,1,1,1,1], [
        ["Revenue", "688", "701", "697", "715"],
        ["Adj. EBITDA", "103", "106", "104", "108"],
        ["Margin", "15.0%", "15.1%", "14.9%", "15.1%"],
        ["Levered FCF", "41", "44", "42", "45"],
      ]),
      X("Note", "* Q4-25 is the derived period (G-02). Revenue compounds ~1.3% sequentially with margin pinned in a 14.9–15.1% band."),
    ]},
    "CP-1B:KPI Dashboard": { ref: "REF_CP-1B_06", out: "KPI dashboard", sections: [
      T("KPI dashboard", ["", "Q2-25", "Q3-25", "Q4-25*", "Q1-26"], [0,1,1,1,1], [
        ["Orders / book-to-bill", "1.02x", "1.04x", "0.98x", "1.06x"],
        ["Aftermarket mix (rev)", "22.4%", "22.8%", "23.1%", "23.4%"],
        ["Realized price vs input inflation", "+30bps", "+40bps", "+30bps", "+40bps"],
        ["Interest coverage", "2.0x", "2.1x", "2.1x", "2.1x"],
      ]),
      X("Read", "Aftermarket mix grinding up (+100bps over 4 quarters) is the single most thesis-supportive operational trend on the dashboard."),
    ]},
    "CP-1B:Variance Analysis": { ref: "REF_CP-1B_07", out: "Variance vs sponsor model", sections: [
      T("Q1-26 vs sponsor model ($M)", ["Line", "Model", "Actual", "Δ", "Driver"], [0,1,1,1,0], [
        ["Revenue", "722.0", "715.0", "−1.0%", "Fluid Systems volume"],
        ["Adj. EBITDA", "112.7", "108.0", "−4.2%", "volume (−3.1) + cost-out phasing (−1.6)"],
        ["Margin", "15.6%", "15.1%", "−50bps", "absorption"],
      ]),
      X("Disposition", "Conflict logged to CP-5; the sponsor model is demoted to upside case. CP-1 normalized actuals remain the base for all downstream stress and valuation work.", ["E-58"]),
    ]},
    "CP-1B:Corporate Actions": { ref: "REF_CP-1B_08", out: "Corporate actions register", sections: [
      T("Actions in window", ["Date", "Action", "Cash impact"], [0,0,1], [
        ["May 2026", "$900M 2L TL issuance — refinance 2L bridge", "+$28M net (fees, OID)"],
        ["Mar 2026", "Hartwell earnout settlement agreed", "−$24M (committed, H2-26)"],
      ]),
    ]},
    "CP-1B:Comparative Evaluation": { ref: "REF_CP-1B_09", out: "Peer-relative read", sections: [
      X("Evaluation", "Against the CP-1C universe's Q1 prints: ATLF's +3.9% revenue growth is middle-of-pack (peer range −1% to +7%), while its margin stability (±20bps band) is top-quartile — Karst and Tarn both printed >100bps of margin compression. No peer-relative deterioration detected."),
    ]},
    "CP-1B:Conflict Log": { ref: "REF_CP-1B_10", out: "Conflict log", sections: [
      F("Conflicts", [
        { sev: "warning", text: "C-1: Sponsor-model FY26E phasing vs Q1-26 actuals (−4.2%). Escalated to CP-5; model reclassified as upside case. Resolution requires two consecutive quarters within ±2% of model.", ev: ["E-58"] },
      ]),
    ]},
    "CP-1B:Monitoring Assessment": { ref: "REF_CP-1B_11", out: "Monitoring assessment", sections: [
      T("Watch items → next print (Jul 28)", ["Item", "Threshold", "Routed to"], [0,0,0], [
        ["Add-back realization (first print)", "< $30M run-rate → T-1 trips", "CP-6A re-vote"],
        ["Fluid Systems volume", "second consecutive miss", "CP-2B P1 refresh"],
        ["Book-to-bill", "< 0.95x", "CP-2B flag"],
      ]),
    ]},
    "CP-1B:Gaps & Limitations Ledger": { ref: "REF_CP-1B_12", out: "Gaps ledger", sections: [
      X("Ledger", "Q4-25 derived-period caveat (G-02) is the only open limitation. Quarterly comparisons crossing that period are flagged in-table; annual and LTM figures are unaffected."),
    ]},
    "CP-1B:Overall Earnings View": { ref: "REF_CP-1B_13", out: "Overall earnings view", sections: [
      X("View", "Earnings trajectory intact: +6.2% LTM EBITDA growth, book-to-bill 1.06x, realized price (+180bps) running ahead of input inflation (+140bps), aftermarket mix rising. The sponsor model runs hot — use CP-1 normalized actuals as the base and treat the model as upside. The Jul 28 print is the next thesis checkpoint."),
    ]},

    /* ================= CP-1C · PeerBenchmarking ================= */
    "CP-1C:Peer Discovery Gate": { ref: "REF_CP-1C_00", out: "Discovery decision", sections: [
      T("Candidate screen", ["Candidate", "Decision", "Reason"], [0,0,0], [
        ["Forgeline · Karst · Veldt · Ironvale · Cascadia · Tarn", "KEPT (6)", "single-B engineered components, comparable scale"],
        ["Meridian Industrial (customer)", "DROPPED", "customer of subject — conflict"],
        ["2 diversified industrials", "DROPPED", "conglomerate mix, not comparable"],
        ["1 auto-pure supplier", "DROPPED", "end-market mismatch"],
      ]),
    ]},
    "CP-1C:Peer Data Gate": { ref: "REF_CP-1C_01", out: "Data sufficiency", sections: [
      T("Sufficiency by metric", ["Metric", "Coverage", "Source"], [0,0,0], [
        ["EBITDA margin / growth", "7 of 7", "public filings + CIM Annex C"],
        ["Net leverage", "7 of 7", "filings"],
        ["FCF conversion", "7 of 7", "filings"],
        ["DM (market)", "7 of 7", "LoanX / desk runs Jun 8"],
      ]),
      X("Decision", "PASS — full metric set available for all seven names. The CIM Annex C anchor later proved mismatched (see Metric Alignment Register)."),
    ]},
    "CP-1C:Peer Universe Register": { ref: "REF_CP-1C_02", out: "Peer universe", sections: [
      T("Universe (7 names)", ["Name", "Rating", "Revenue", "Why comparable"], [0,0,1,0], [
        ["Atlas Forge (subject)", "B2 / B", "$2.8B", "—"],
        ["Forgeline Industries", "B2 / B", "$2.1B", "forged components, OEM/aftermarket"],
        ["Karst Components", "B3 / B−", "$1.6B", "machined parts, higher leverage"],
        ["Veldt Precision", "B1 / B+", "$2.4B", "precision metal, best-in-cohort margins"],
        ["Ironvale Group", "B2 / B", "$3.1B", "industrial metal platforms"],
        ["Cascadia Metalworks", "B2 / B", "$1.9B", "metal forming, unsecured structure"],
        ["Tarn Engineered Sys", "B3 / CCC+", "$1.5B", "distressed outlier — context only"],
      ]),
    ]},
    "CP-1C:Metric Alignment Register": { ref: "REF_CP-1C_03", out: "Alignment register", sections: [
      T("Alignment to CP-1 definitions", ["Metric", "Alignment action", "Status"], [0,0,0], [
        ["EBITDA (peers)", "Re-stated to subject's adj. definition where add-back detail disclosed", "ALIGNED (5 of 6)"],
        ["Peer margin set (Annex C)", "Cited CIM Annex C p.388 — anchor mismatched", "OPEN — QA-117"],
        ["Leverage", "Net debt standardized ex-leases", "ALIGNED"],
        ["FCF conversion", "K-22 formula applied uniformly", "ALIGNED"],
      ]),
      F("Open item", [
        { sev: "critical", text: "E-44: p.388 of the conformed CIM contains the auditor consent letter, not the peer margin table (expected p.391 of prior draft). Benchmark conclusions carried ex-E-44 until re-anchored — QA-117 (HIGH).", ev: ["E-44"] },
      ]),
    ]},
    "CP-1C:Operating Benchmark": { ref: "REF_CP-1C_04A", out: "Operating benchmark", sections: [
      T("4A · Operating benchmark", ["Peer", "EBITDA mgn", "Rev growth (LTM)", "Aftermkt mix"], [0,1,1,1], [
        ["Atlas Forge (subject)", "15.0%", "+4.1%", "23.4%"],
        ["Veldt Precision", "16.2%", "+5.2%", "27%"],
        ["Ironvale Group", "14.1%", "+3.0%", "19%"],
        ["Forgeline Industries", "13.8%", "+2.2%", "16%"],
        ["Cascadia Metalworks", "13.2%", "+1.4%", "14%"],
        ["Karst Components", "12.1%", "−0.8%", "11%"],
        ["Tarn Engineered Sys", "11.4%", "−3.1%", "9%"],
      ]),
      X("Read", "Subject ranks 2nd on margin (64th percentile incl. outlier) and 2nd on aftermarket mix — the operational basis for the better-than-cohort credit view."),
    ]},
    "CP-1C:Cash Flow & Capital Intensity": { ref: "REF_CP-1C_04B", out: "Cash flow benchmark", sections: [
      T("4B · Cash flow & capital intensity", ["Peer", "Capex % rev", "FCF conversion"], [0,1,1], [
        ["Atlas Forge (subject)", "4.3%", "41%"],
        ["Veldt Precision", "3.9%", "38%"],
        ["Ironvale Group", "5.1%", "33%"],
        ["Forgeline Industries", "5.6%", "31%"],
        ["Cascadia Metalworks", "6.2%", "29%"],
        ["Karst Components", "6.8%", "27%"],
        ["Tarn Engineered Sys", "7.4%", "22%"],
      ]),
      X("Read", "Second-lightest capex and top-quartile FCF conversion — the clearest fundamental edge over the peer set.", ["E-22"]),
    ]},
    "CP-1C:Credit Metric Benchmark": { ref: "REF_CP-1C_04C", out: "Credit metric benchmark", sections: [
      T("4C · Credit metric benchmark", ["Peer", "Rating", "Net lev", "EBITDA mgn", "FCF conv", "DM"], [0,0,1,1,1,1], PEER_CREDIT_METRIC_ROWS),
    ]},
    "CP-1C:Summary Statistics": { ref: "REF_CP-1C_04D", out: "Summary statistics", sections: [
      T("4D · Summary statistics (ex-Tarn)", ["Metric", "Subject", "B2 median", "Percentile"], [0,1,1,1], [
        ["Net leverage", "5.7x", "5.5x", "38th"],
        ["EBITDA margin", "15.0%", "13.9%", "64th"],
        ["FCF conversion", "41%", "31%", "92nd"],
        ["DM", "+388", "+327", "+61bps wide"],
      ]),
    ]},
    "CP-1C:Outlier Register": { ref: "REF_CP-1C_05", out: "Outlier register", sections: [
      X("Register", "Tarn Engineered (B3 / CCC+, +577bps, negative growth) excluded from median computation as a distressed outlier; retained in tables for context. No other exclusions. Sensitivity: including Tarn widens the median DM to +341 and flatters the subject's relative position — the conservative ex-Tarn basis is carried."),
    ]},
    "CP-1C:Public Trading Comps": { ref: "REF_CP-1C_06A", out: "Trading comps", sections: [
      T("6A · Public trading comps", ["Comp", "EV/EBITDA", "EBITDA mgn", "Note"], [0,1,1,0], [
        ["Listed precision components A", "10.4x", "17.1%", "scale premium"],
        ["Listed industrial platforms B", "9.5x", "14.8%", "closest mix"],
        ["Listed metal forming C", "8.9x", "13.0%", "lower aftermarket"],
      ]),
    ]},
    "CP-1C:Transaction Comps": { ref: "REF_CP-1C_06B", out: "Transaction comps", sections: [
      T("6B · Transaction comps (thin set)", ["Transaction", "Date", "EV/EBITDA"], [0,0,1], [
        ["Hartwell Precision (subject's bolt-on)", "Jun-23", "6.4x"],
        ["Sector take-private (sponsor-led)", "Sep-24", "7.8x"],
      ]),
      X("Limitation", "Two clean datapoints only — used directionally for the implied-EV cross-check and flagged as a limitation; no multiple conclusions drawn from this set alone."),
    ]},
    "CP-1C:Implied EV": { ref: "REF_CP-1C_06C", out: "Implied EV cross-check", sections: [
      T("6C · Implied EV vs claims ($M)", ["Basis", "Multiple", "EV", "Coverage of $3,270M debt"], [0,1,1,1], [
        ["Trading comps — low", "8.9x", "3,747", "1.15x"],
        ["Trading comps — mid", "9.5x", "4,000", "1.22x"],
        ["LBO entry (2021)", "7.9x", "3,326", "1.02x"],
        ["Break-even on total debt", "7.8x", "3,270", "1.00x"],
      ]),
      X("Read", "An equity cushion exists at trading multiples; it erodes to zero at ~7.8x — context for CP-3B's recovery work, where stressed multiples of 5.0–6.0x are the relevant range."),
    ]},
    "CP-1C:Peer Interpretation & Credit Translation": { ref: "REF_CP-1C_07", out: "Credit translation", sections: [
      X("Translation", "Evidence: +61bps wide of the B2 median with 92nd-percentile FCF conversion and 64th-percentile margin. Risk mechanic: the market prices ATLF as an average B2 while operating fundamentals screen better-than-cohort; the discount plausibly reflects documentation aggressiveness (CP-4) and sponsor history (CP-2D), not operations. Credit implication: positive carry vs fundamentals — the spread compensates risks that are monitorable (baskets, certificates) rather than structural."),
    ]},
    "CP-1C:Gaps & Limitations Ledger": { ref: "REF_CP-1C_08", out: "Gaps ledger", sections: [
      X("Ledger", "Two limitations carried on conclusions: (1) E-44 anchor mismatch (QA-117, HIGH) — margin-set conclusions published ex-E-44; (2) thin transaction-comp set — directional use only. Neither is papered over; both appear wherever the affected figures are quoted."),
    ]},
    "CP-1C:Overall Peer Benchmarking View": { ref: "REF_CP-1C_09", out: "Overall view", sections: [
      X("View", "Subject screens cheap: +61bps wide of the B2 median with top-quartile FCF conversion and above-median margin. Ex-E-44 the gap compresses to +20–25bps — still positive carry against fundamentals. Rank basis handed to CP-3 for the fair-value band and final ranking.", ["E-71"]),
    ]},
  };

// ── from step-outputs-l2.js ──
const O1: Record<string, StepOutput> = {
    /* ================= CP-2 · FundamentalCreditSynthesizer ================= */
    "CP-2:Source Gate & Readiness": { ref: "REF_CP-2_01", out: "Source register + module status", sections: [
      T("Feeder status", ["Feeder", "Output consumed", "Status"], [0,0,0], [
        ["CP-1", "Normalized financials + 41-KPI register", "GREEN"],
        ["CP-1A", "Business / ownership / operating model", "GREEN"],
        ["CP-1B", "Q1-26 print + variance analysis", "GREEN"],
        ["CP-1C", "Peer benchmarks (ex-E-44 basis)", "GREEN — limitation noted"],
      ]),
      X("Status", "READY — CP-2 consumes published outputs only; no raw-document re-extraction performed."),
    ]},
    "CP-2:Company Description": { ref: "REF_CP-2_02", out: "Credit-relevant issuer description", sections: [
      X("Description", "Scaled engineered-components platform serving industrial OEMs across Drivetrain (46% of revenue), Fluid Systems (31%) and Aftermarket & Services (23% of revenue, 44% of gross profit). The credit rests on the aftermarket annuity: a 1.9M-unit installed base under multi-year contracts renewing at 92%, generating recurring high-margin cash flow that is structurally less cyclical than the OEM book it attaches to. 14 plants; 71% of COGS pass-through-indexed with a 60–90 day lag."),
    ]},
    "CP-2:Ownership & Group Structure": { ref: "REF_CP-2_03", out: "Ownership / governance assessment", sections: [
      X("Assessment", "Kestrel Capital Fund V controls 68.4% with 6 of 7 board seats; management rolled 9.2%. The covenant group is clean — no unrestricted subsidiaries at close, full guarantor coverage at 87% of EBITDA, and no orphaned value outside the restricted perimeter. Governance risk is therefore concentrated in financial policy (CP-2D), not structure."),
    ]},
    "CP-2:Revenue Drivers & Pricing Power": { ref: "REF_CP-2_04A", out: "Revenue durability assessment", sections: [
      T("Revenue drivers", ["Driver", "Share", "Durability read"], [0,1,0], [
        ["OEM long-term agreements (indexed)", "71% of OEM rev", "visible, price-protected, volume-cyclical"],
        ["Aftermarket service contracts", "23% of rev", "recurring — 92% renewal, CPI-or-3% escalators"],
        ["Spot / short-cycle orders", "~9% of rev", "cyclical swing factor"],
      ]),
      X("Assessment", "Evidence: indexed LTAs and contract-locked aftermarket. Risk mechanic: price is protected mechanically but volume is not — top-3 OEM concentration (38%) caps realized pricing power on the Drivetrain book. Credit implication: revenue durability MODERATE-PLUS; visibility is good, cyclicality is concentrated and mapped (CP-2B P1).", ["E-31", "E-15"]),
    ]},
    "CP-2:Cost Structure & Margin Resilience": { ref: "REF_CP-2_04B", out: "Margin resilience assessment", sections: [
      T("Cost structure", ["Bucket", "Share of COGS", "Flexibility"], [0,1,0], [
        ["Steel / alloys (indexed pass-through)", "71%", "protected, 60–90d lag"],
        ["Direct labor", "17%", "semi-variable — plant-level flex"],
        ["Freight, energy, other", "12%", "partially contracted"],
      ]),
      X("Assessment", "Margin held a 14.9–15.1% band through the FY22–24 input-cost spike cycle — the lag produces quarter noise, not erosion. Fixed-cost absorption across 14 plants is the real margin risk under volume decline (−12% volume ≈ −18% EBITDA per CP-2B). Margin stability: AVERAGE-PLUS with a defined failure mode."),
    ]},
    "CP-2:Capital Intensity & FCF Conversion": { ref: "REF_CP-2_04C", out: "FCF conversion assessment", sections: [
      X("Assessment", "Evidence: capex 4.3% of revenue (maintenance ≈ 2.9% analyst split), FCF conversion 41% (K-22), working capital consuming ~$14M/yr. Risk mechanic: capex-light model converts EBITDA to cash at top-quartile rates and roughly $25M of capex is deferrable in stress. Credit implication: FCF durability is the strongest quantitative support in the credit — debt service funds from operations with headroom at current rates.", ["E-22"]),
    ]},
    "CP-2:Porter Five Forces": { ref: "REF_CP-2_05A", out: "Porter — credit-translated", sections: [
      T("Five forces — credit translation", ["Force", "Assessment", "Credit implication"], [0,0,0], [
        ["Buyer power", "HIGH", "top-3 OEMs 38% of rev; Meridian repricing Q2-27 is the live PD/margin channel"],
        ["Supplier power", "LOW", "commodity inputs, indexed pass-through — margin protected mechanically"],
        ["Threat of new entrants", "LOW", "qualified-vendor lock-in, >18-yr tenure — protects revenue visibility and recovery value"],
        ["Threat of substitutes", "LOW", "engineered-spec parts; redesign cost exceeds savings — installed base defensible"],
        ["Competitive rivalry", "MODERATE", "consolidated niches; price rivalry concentrated in short-cycle spot work (~9% of rev)"],
      ]),
      X("Per-force narrative", "Buyer power is the only force with a material credit channel: Evidence — 38% top-3 concentration and a scheduled platform repricing (Q2-27). Risk mechanic — a single negotiation can reprice ~14% of revenue; OEM destocking transmits volume shock in 1–2 quarters. Credit implication — primary downside pathway (CP-2B P1) and a named monitoring trigger (T-3). The remaining four forces are credit-supportive: they underpin margin durability, the aftermarket annuity, and recovery-relevant franchise value, and none introduces an independent PD/LGD channel.", ["E-15"]),
    ]},
    "CP-2:PEST Analysis": { ref: "REF_CP-2_05B", out: "PEST — credit-translated (material factors only)", sections: [
      T("PEST (material factors)", ["Factor", "Materiality", "Credit translation"], [0,0,0], [
        ["Economic — base rates", "MATERIAL", "61% floating (modeled unhedged): +100bps ≈ −$12.1M FCF — coverage channel"],
        ["Economic — industrial cycle", "MATERIAL", "OEM destocking is the P1 trigger; monitored via order data"],
        ["Political — reshoring incentives", "MINOR +", "US footprint (9 plants) modestly advantaged"],
        ["Tech / Social / Regulatory", "IMMATERIAL", "skipped with statement — no PD/LGD/liquidity channel identified"],
      ]),
    ]},
    "CP-2:SWOT Analysis": { ref: "REF_CP-2_05C", out: "SWOT — credit-translated", sections: [
      T("SWOT (credit-translated)", ["Quadrant", "Items"], [0,0], [
        ["Strengths (credit-supportive)", "aftermarket annuity (44% GP, 92% renewal) · 41% FCF conversion · indexed COGS"],
        ["Weaknesses (credit-constraining)", "add-backs 18.2% of adj. EBITDA · top-3 OEM 38% · thin coverage (2.1x)"],
        ["Opportunities (quality improvers)", "add-back realization → real deleveraging to ~4.9x FY27 · aftermarket mix shift"],
        ["Threats (quality weakeners)", "destocking + MFN-sunset sequencing · sponsor recap in 2027-28 window · Meridian repricing"],
      ]),
    ]},
    "CP-2:Key Strengths & Weaknesses": { ref: "REF_CP-2_06", out: "Top strengths / weaknesses", sections: [
      T("Net assessment", ["#", "Strengths", "Weaknesses"], [0,0,0], [
        ["1", "Aftermarket annuity — recurring, contract-locked, 44% of GP", "EBITDA quality — 18.2% add-backs, recurrence pattern"],
        ["2", "FCF conversion 41% — top-quartile, capex-light", "OEM concentration — top-3 at 38%, Meridian 14%"],
        ["3", "Indexed cost base — margin protected through cycles", "Documentation — $612M capacity + MFN sunset (CP-4)"],
      ]),
      X("Balance", "Two durable strengths against two structural weaknesses plus a documentation overhang — neither side dominant; the balance prices as a mid-B2 with above-median fundamentals."),
    ]},
    "CP-2:Financial Profile & Credit Quality": { ref: "REF_CP-2_07", out: "9-dimension scorecard + synthesis", sections: [
      T("9-dimension financial profile", ["Dimension", "Rating", "Basis"], [0,0,0], [
        ["Scale / market position", "Strong", "$2.8B revenue · #1-2 in 7 of 9 lines"],
        ["Competitive advantage", "Strong", "qualified-vendor lock-in, installed base"],
        ["Business diversification", "Average", "3 segments but top-3 customers 38%"],
        ["Cost and capex flexibility", "Average", "indexed COGS; capex split undisclosed (null)"],
        ["Margin stability", "Strong", "14.9–15.1% band through input spike"],
        ["Free cash flow stability", "Strong", "41% conversion, low WC drag"],
        ["Refinance / market access", "Average", "May-26 issue priced inside talk; no near wall"],
        ["Liquidity position", "Strong", "19.3 months-to-empty, 78% RCF undrawn"],
        ["Financial policy / governance", "Weak", "sponsor recap record, RP pre-positioning, add-back presentation"],
      ]),
      X("Synthesis", "Five Strong / three Average / one Weak — composite lands mid-B2, consistent with agency ratings. The single Weak dimension (financial policy) is also the one the documents amplify (CP-4C capacity), which is why governance carries disproportionate monitoring weight."),
    ]},
    "CP-2:Outlook, Tailwinds & Headwinds": { ref: "REF_CP-2_08", out: "Outlook", sections: [
      T("12–18 month outlook", ["Direction", "Items"], [0,0], [
        ["Tailwinds", "order book 1.06x · aftermarket mix +100bps/yr · realized price > input inflation · reshoring (minor)"],
        ["Headwinds", "Meridian repricing Q2-27 · cost-out phasing risk into FY26 add-back test · rate resets on 61% floating"],
      ]),
      X("Outlook", "STABLE. The order book supports low-single-digit growth; the binding uncertainty is not demand but proof of add-back realization at the Q3-26 certificate."),
    ]},
    "CP-2:Qualitative Downside Scenario": { ref: "REF_CP-2_09", out: "Issuer-specific downside scenario", sections: [
      X("Scenario", "An OEM destocking cycle hits Drivetrain (−12% volume over two quarters) while 'one-time' restructuring charges recur, compressing reported and adjusted EBITDA simultaneously — quality risk and volume risk arriving together. Absorption deleverage takes EBITDA toward $345M; leverage prints near 6.9x against a 5.7x entry assumption; and the open MFN window makes a priming incremental rational for the sponsor exactly when bondholders are weakest. Quantified by CP-2B as pathway P1; sequencing risk priced via CP-6E sizing."),
    ]},
    "CP-2:Materiality Filter": { ref: "REF_CP-2_10", out: "Ranked material drivers", sections: [
      T("Materiality ranking (23 candidates → 6 material)", ["Rank", "Driver", "Channel"], [0,0,0], [
        ["1", "EBITDA quality / add-backs (18.2%)", "PD + leverage measurement"],
        ["2", "OEM concentration / Meridian", "PD — volume transmission"],
        ["3", "Documentation capacity ($612M + MFN)", "LGD — priming / leakage"],
        ["4", "FCF conversion 41%", "PD mitigant"],
        ["5", "Rate exposure (61% floating, L-04)", "coverage"],
        ["6", "Sponsor financial policy", "LGD + event risk"],
      ]),
      X("Dropped", "17 immaterial factors dropped with statement (FX translation, single-plant items, ESG ratings drift, pension de-minimis) — kept out of the issuer matrix to preserve decision focus."),
    ]},
    "CP-2:Issuer Matrix": { ref: "REF_CP-2_11", out: "Issuer matrix", sections: [
      T("Issuer matrix (6 material factors)", ["Factor", "Assessment", "Trend", "Weight"], [0,0,0,1], [
        ["Aftermarket annuity (44% GP)", "STRENGTH — contract-locked, 92% renewal", "stable", "high"],
        ["EBITDA quality / add-backs", "WEAKNESS — 18.2% of adj. EBITDA", "improving", "high"],
        ["OEM concentration (top-3 38%)", "WEAKNESS — Meridian repricing Q2-27", "stable", "high"],
        ["FCF conversion 41%", "STRENGTH — capex-light vs peers", "stable", "med"],
        ["Input cost pass-through (60–90d lag)", "NEUTRAL — margin noise, not erosion", "stable", "med"],
        ["Sponsor financial policy", "WEAKNESS — recap history at Kestrel", "watch", "med"],
      ]),
    ]},
    "CP-2:Monitoring Triggers": { ref: "REF_CP-2_12", out: "Observable trigger table", sections: [
      T("Standing triggers", ["ID", "Trigger", "Observable", "On trip"], [0,0,0,0], [
        ["T-1", "Add-back realization < $30M", "Q3-26 compliance certificate", "CP-6A re-vote"],
        ["T-2", "Incremental raise > $200M in MFN window", "facility notices / LoanX", "CP-3B re-rank + CP-6E review"],
        ["T-3", "Meridian repricing terms", "Q2-27 disclosure", "CP-2B P1 refresh"],
        ["T-4", "RP basket activation", "covenant certificate / notices", "posture change — CP-2D + CP-6E"],
      ]),
    ]},
    "CP-2:Overall Credit View": { ref: "REF_CP-2_13", out: "Synthesis narrative", sections: [
      X("Overall credit view", "A fundamentally sound B2: durable aftermarket economics and genuine FCF offset by aggressive EBITDA presentation and customer concentration. Deleveraging to ~4.9x by FY27 is credible on realized add-backs alone; the binding risks are documentation-enabled releveraging (CP-4C) and the Meridian contract cycle. No new data — synthesis of steps 1–12 only.", ["E-22", "E-09"]),
    ]},

    /* ================= CP-2B · DownsidePathways ================= */
    "CP-2B:Source Gate & Baseline": { ref: "REF_CP-2B_01", out: "Baseline lock", sections: [
      T("Baseline", ["Field", "Value"], [0,0], [
        ["EBITDA baseline", "$421M LTM adj. (CP-1 normalized actuals)"],
        ["Excluded", "Sponsor model — prohibited from stress arithmetic"],
        ["Liquidity input", "CP-2E bridge (+$96M / 12mo)"],
      ]),
    ]},
    "CP-2B:Business Model Snapshot": { ref: "REF_CP-2B_02", out: "Stress-relevant snapshot", sections: [
      X("Snapshot", "Stress-relevant mechanics: 46% Drivetrain exposure with top-3 OEMs at 38% of revenue; operating leverage across 14 plants (fixed-cost absorption is the amplifier); 60–90 day pass-through lag (timing exposure); aftermarket buffer at 44% of gross profit (the damper). The model stresses volume and lag — price is mechanically protected."),
    ]},
    "CP-2B:Fragility Map": { ref: "REF_CP-2B_03", out: "Fragility map", sections: [
      T("Fragility map", ["ID", "Fragility", "Early indicator"], [0,0,0], [
        ["F-1", "Absorption deleverage — fixed plant costs vs volume", "plant utilization < 78%"],
        ["F-2", "OEM concentration — top-3 at 38%", "OEM order intake (monthly)"],
        ["F-3", "Pass-through lag — 60–90d margin gap", "alloy index vs realized price spread"],
        ["F-4", "Covenant-capacity interaction — stress meets open baskets", "incremental raise notices in MFN window"],
      ]),
    ]},
    "CP-2B:Stress Transmission Table": { ref: "REF_CP-2B_04", out: "Transmission mechanics", sections: [
      T("Transmission", ["Shock", "Mechanics", "EBITDA effect"], [0,0,1], [
        ["Drivetrain volume −10%", "absorption deleverage ≈ 1.4x multiplier", "−14%"],
        ["Alloy spike +20% (lagged)", "1–2 qtr margin gap, recovers", "−4% (2 qtrs)"],
        ["Aftermarket attrition −5pp renewal", "slow bleed — contract roll-off", "−3% / yr"],
        ["Warranty cascade (SXAA read-across)", "accrual build + margin compression", "−9% (3 qtrs)"],
      ]),
    ]},
    "CP-2B:Downside Pathway Register": { ref: "REF_CP-2B_05", out: "Pathway register", sections: [
      T("Pathways", ["Path", "Trigger", "Transmission", "EBITDA impact", "Prob."], [0,0,0,1,1], [
        ["P1", "OEM destocking cycle", "Drivetrain volumes −12% over 2 qtrs; absorption deleverage", "−18%", "25%"],
        ["P2", "Warranty / recall cascade", "Aftermarket margin compression + accrual build over 3 qtrs", "−9%", "35%"],
        ["P3", "Alloy input spike > pass-through lag", "60–90 day margin gap; recovers within 2 qtrs", "−6%", "30%"],
      ]),
    ]},
    "CP-2B:Downside Sensitivity Matrix": { ref: "REF_CP-2B_06", out: "Sensitivity matrix", sections: [
      T("EBITDA outcomes ($M) — volume shock × cost-out delivery", ["Volume shock", "Cost-out 0%", "Cost-out 50%", "Cost-out 100%"], [0,1,1,1], [
        ["−5%", "392", "401", "410"],
        ["−10%", "362", "371", "380"],
        ["−15%", "345", "354", "363"],
      ]),
      X("Read", "Leverage holds under 7.0x in all but the corner case (−15% volume, zero cost-out → 6.93x). No cell breaches liquidity inside 12 months."),
    ]},
    "CP-2B:Monitoring Sensitivity Flags": { ref: "REF_CP-2B_07", out: "Early-warning flags", sections: [
      T("Flags wired to CP-MON", ["Flag", "Threshold", "Cadence"], [0,0,0], [
        ["OEM order intake", "−8% y/y for 2 months", "monthly"],
        ["Drivetrain book-to-bill", "< 0.95x", "quarterly"],
        ["Distributor inventory", "> 11 weeks", "monthly survey"],
      ]),
    ]},
    "CP-2B:Cross-Module Handoff Register": { ref: "REF_CP-2B_08", out: "Handoff register", sections: [
      T("Handoffs", ["Output", "Consumer", "Use"], [0,0,0], [
        ["P1 pathway", "CP-3D", "stress-coincidence scenario (vulnerability re-rate)"],
        ["Sensitivity grid", "CP-3B", "stressed-EBITDA axis of recovery table"],
        ["Pathway probabilities", "CP-6A", "bear-case weighting inputs"],
      ]),
    ]},
    "CP-2B:Gaps Ledger": { ref: "REF_CP-2B_09", out: "Gaps ledger", sections: [
      X("Ledger", "No module-specific gaps. Inherits the G-02 derived-period caveat on quarterly granularity only; annual stress arithmetic unaffected."),
    ]},
    "CP-2B:Overall Downside Pathway View": { ref: "REF_CP-2B_10", out: "Overall downside view", sections: [
      X("View", "No pathway breaks liquidity: P1 (worst) still leaves 14 months-to-empty and springing-covenant headroom. The danger is sequencing — P1 arriving while the 12-month MFN sunset is open invites a priming incremental at the bottom of the cycle. That interaction, not any single pathway, is what CP-6E prices via staged sizing.", ["E-77", "E-64"]),
    ]},

    /* ================= CP-2C · CatalystCalendar ================= */
    "CP-2C:Source Gate & Calendar Scope": { ref: "REF_CP-2C_01", out: "Scope", sections: [
      T("Scope", ["Field", "Value"], [0,0], [
        ["Window", "12 months forward (Jun-26 → Jun-27)"],
        ["Event classes", "issuer · sponsor · sector · documentation"],
        ["Sources", "filing calendars, facility docs, fund communications, OEM schedules"],
      ]),
    ]},
    "CP-2C:Event Source Register": { ref: "REF_CP-2C_02", out: "Event source register", sections: [
      T("Sources", ["Source", "Events derived", "Anchor"], [0,1,0], [
        ["Compliance calendar (D-02/D-03)", "4", "certificate due dates §5.01"],
        ["Earnings calendar", "3", "issuer IR schedule"],
        ["Kestrel fund communications", "1", "D-06 p.12 / LP letter"],
        ["Sector OEM reporting", "1", "Meridian platform schedule"],
      ]),
    ]},
    "CP-2C:Catalyst Calendar": { ref: "REF_CP-2C_03 · T5.2", out: "Catalyst calendar", sections: [
      T("Calendar (next 12 months)", ["Date", "Event", "Prob.", "Impact", "Route"], [0,0,1,0,0], [
        ["Jul 28, 2026", "Q2-26 earnings + first add-back realization print", "100%", "HIGH", "CP-1B · CP-6A"],
        ["Sep 2026", "RCF extension / repricing window opens", "70%", "MED", "CP-3D"],
        ["Oct 2026", "Q3-26 compliance certificate (add-back test)", "100%", "HIGH", "CP-1 · T-1"],
        ["Q4 2026", "Kestrel Fund V exit-window commentary", "40%", "MED", "CP-2D"],
        ["Q2 2027", "Meridian-platform contract repricing", "100%", "HIGH", "CP-2B P1"],
      ]),
    ]},
    "CP-2C:Event Risk Register": { ref: "REF_CP-2C_04 · T5.3", out: "Event risk register", sections: [
      T("Risk register (9 events)", ["Event", "Direction", "Mechanism"], [0,0,0], [
        ["Q3-26 certificate", "two-sided", "proves / disproves deleveraging math"],
        ["Meridian repricing", "negative skew", "~14% of revenue repriced at once"],
        ["MFN sunset (Jun-27)", "negative", "removes yield protection — capacity becomes free"],
        ["RCF extension", "modest negative", "+25–50bps cost; failure would be a red flag"],
        ["Kestrel exit posture", "two-sided", "IPO path positive; recap path negative"],
      ]),
    ]},
    "CP-2C:Probability-Impact Matrix": { ref: "REF_CP-2C_05 · T5.4", out: "Probability-impact matrix", sections: [
      T("Matrix", ["Quadrant", "Events"], [0,0], [
        ["High prob · high impact", "Q3-26 certificate · Meridian repricing · Q2-26 print"],
        ["High prob · med impact", "RCF extension window · MFN sunset approach"],
        ["Low prob · high impact", "Kestrel recap activation (T-4)"],
        ["Low prob · med impact", "exit-window commentary"],
      ]),
    ]},
    "CP-2C:Monitoring Priority Table": { ref: "REF_CP-2C_06 · T5.5", out: "Priority table", sections: [
      T("Priorities", ["Rank", "Item", "Cadence"], [0,0,0], [
        ["1", "Certificate prints (add-back test)", "quarterly — hard dates"],
        ["2", "OEM order data / destocking signals", "monthly"],
        ["3", "RP-basket and incremental notices", "event-driven"],
      ]),
    ]},
    "CP-2C:Watchlist Handoff Register": { ref: "REF_CP-2C_07 · T5.6", out: "Handoff register", sections: [
      T("Handoffs", ["Trigger", "Consumer", "Action"], [0,0,0], [
        ["T-1 certificate miss", "CP-6A", "forced re-vote"],
        ["Meridian terms", "CP-2B", "P1 refresh with actual pricing"],
        ["Kestrel exit signals", "CP-2D", "posture review"],
      ]),
    ]},
    "CP-2C:Gaps & Limitations Ledger": { ref: "REF_CP-2C_08 · T5.7", out: "Gaps ledger", sections: [
      X("Ledger", "Probabilities stated without basis were re-labeled [Analyst estimate] following QA-121 — resolved in-run. No open items."),
    ]},
    "CP-2C:Overall Catalyst View": { ref: "REF_CP-2C_09", out: "Overall catalyst view", sections: [
      X("View", "Event risk front-loads into H2-26 reporting. The Q3-26 certificate is the thesis-defining print — wired to trigger T-1 and a CP-6A re-vote if add-back realization lands under $30M. Every calendar entry routes to a named module action rather than passive watching."),
    ]},

    /* ================= CP-2D · Sponsor & Governance ================= */
    "CP-2D:Source Register & Readiness": { ref: "REF_CP-2D_01", out: "Gate decision", sections: [
      T("Sources", ["Source", "Use", "Handling"], [0,0,0], [
        ["CP-1A ownership register", "control structure", "—"],
        ["D-06 lender presentation", "sponsor overview, fund detail", "MNPI — walled"],
        ["Kestrel fund communications", "Fund VI close, portfolio record", "public + LP letter"],
      ]),
      X("Status", "READY — all governance-relevant sources admitted."),
    ]},
    "CP-2D:Ownership & Control Register": { ref: "REF_CP-2D_02", out: "Control register", sections: [
      T("Control", ["Holder", "Stake", "Rights"], [0,1,0], [
        ["Kestrel Fund V", "68.4%", "drag, 6/7 board seats, exit control"],
        ["Co-invest vehicles", "22.4%", "passive — Kestrel-managed"],
        ["Management rollover", "9.2%", "tag rights only"],
      ]),
    ]},
    "CP-2D:Governance Register": { ref: "REF_CP-2D_03", out: "Governance register", sections: [
      T("Governance", ["Dimension", "Finding"], [0,0], [
        ["Board independence", "1 of 7 — single independent chairs audit committee"],
        ["Reporting cadence", "monthly lender packages + quarterly calls — above market"],
        ["Auditor", "Big-4, unqualified, no disagreements disclosed"],
        ["Related-party items", "sponsor management fee $7.3M/yr (add-back line)"],
      ]),
    ]},
    "CP-2D:Behavior Flag Register": { ref: "REF_CP-2D_04", out: "Behavior flags", sections: [
      F("Flags", [
        { sev: "warning", text: "Dividend-recap history: two Fund IV portfolio companies executed recaps within 24 months of a refinancing window — pattern, not anecdote." },
        { sev: "warning", text: "RP basket pre-positioning: builder already $240M with no stated use (credit agreement §4.07 + certificate) — capacity built before need." },
        { sev: "low", text: "Fund VI close $4.2B (Jun-26) — support-capacity positive offset; industrials 38% of deployment.", ev: ["E-91"] },
      ]),
    ]},
    "CP-2D:Capital Allocation Risk Table": { ref: "REF_CP-2D_05", out: "Capital allocation assessment", sections: [
      T("Allocation record", ["Action", "Evidence", "Read"], [0,0,0], [
        ["Bolt-on M&A", "Hartwell at 6.4x vs 7.9x platform entry", "disciplined — accretive"],
        ["Dividends to date", "none at ATLF since 2021 close", "neutral"],
        ["Releveraging events", "4 capital-structure events in 4.5 yrs at flat net debt", "manages to a leverage ceiling"],
        ["Peer-portfolio recaps", "2 of 2 Fund IV exits preceded by recap", "extraction pattern"],
      ]),
    ]},
    "CP-2D:Acquisition Appetite Table": { ref: "REF_CP-2D_06", out: "Acquisition appetite", sections: [
      T("Appetite", ["Factor", "Read"], [0,0], [
        ["Fund VI dry powder", "$4.2B fresh, industrials-focused — HIGH appetite"],
        ["Platform posture", "stated bolt-on strategy in LP"],
        ["Funding path", "existing baskets sufficient for ≤$300M deals (CP-4C)"],
        ["Integration record", "Hartwell integrated on plan — execution competent"],
      ]),
    ]},
    "CP-2D:Disclosure Quality Log": { ref: "REF_CP-2D_07", out: "Disclosure quality", sections: [
      X("Grade B+", "Monthly lender packages, quarterly calls, covenant detail above market norm. Deductions: sponsor-model optimism (−4.2% Q1 variance), selective KPI presentation in the LP, and the capex-split nondisclosure. Disclosure is institutional-grade and partially offsets policy risk."),
    ]},
    "CP-2D:Creditor Alignment Table": { ref: "REF_CP-2D_08", out: "Creditor alignment", sections: [
      T("Alignment", ["Horizon", "Sponsor incentive", "Creditor alignment"], [0,0,0], [
        ["0–18 months", "grow EBITDA, prove deleveraging for exit story", "ALIGNED"],
        ["2027–28 (exit window)", "maximize equity value — recap or sale", "DIVERGENT — extraction risk"],
        ["Distress scenario", "preserve option value — LME-capable docs", "ADVERSE — 2L is target class"],
      ]),
    ]},
    "CP-2D:Sponsor Risk Assessment": { ref: "REF_CP-2D_09", out: "Composite assessment", sections: [
      X("Assessment", "MODERATE-HIGH. Kestrel is a competent operator (Hartwell integration, institutional reporting) with an extractive financial-policy record (recap pattern, RP pre-positioning). The risk is behavioral and documentation-enabled, not operational — which makes it monitorable: basket activation and certificate behavior are observable tells."),
    ]},
    "CP-2D:Cross-Module Handoff Register": { ref: "REF_CP-2D_10", out: "Handoff register", sections: [
      T("Handoffs", ["Output", "Consumer"], [0,0], [
        ["RP-activation trigger (T-4)", "CP-2 · CP-6E"],
        ["Fund VI support capacity", "CP-3D sponsor-willingness table"],
        ["Recap pattern evidence", "CP-6A bear file"],
      ]),
    ]},
    "CP-2D:Gaps Ledger": { ref: "REF_CP-2D_11", out: "Gaps ledger", sections: [
      X("Ledger", "No gaps. LP-letter detail on Fund VI deployment pace noted as desirable but non-blocking."),
    ]},
    "CP-2D:Overall Governance View": { ref: "REF_CP-2D_12", out: "Overall governance view", sections: [
      X("View", "Kestrel is a competent operator with an extractive financial-policy record; institutional-grade disclosure partially offsets. Treat any RP-basket activation as a posture-changing event (T-4). Alignment is good near-term and divergent precisely in the 2027–28 window where documentation capacity peaks (post-MFN-sunset).", ["E-91"]),
    ]},

    /* ================= CP-2E · Liquidity ================= */
    "CP-2E:Source Register & Module Status": { ref: "REF_CP-2E_01", out: "Gate decision", sections: [
      T("Sources", ["Source", "Use"], [0,0], [
        ["D-04 p.44 liquidity disclosure", "cash + RCF availability"],
        ["D-02 SFA schedules", "commitments, LC carve-out, springing test"],
        ["CP-1 cash flow build", "12-month forward FCF"],
      ]),
      X("Status", "READY — no limitations.", ["E-77"]),
    ]},
    "CP-2E:Beginning Liquidity Register": { ref: "REF_CP-2E_02", out: "Beginning liquidity", sections: [
      T("Beginning liquidity (Apr-26, $M)", ["Component", "Amount", "Accessibility"], [0,1,0], [
        ["Cash & equivalents", "184", "fully accessible — no trapped-cash findings"],
        ["RCF commitment", "250", "—"],
        ["Drawn", "(120)", "—"],
        ["Letters of credit", "(12)", "carve-out"],
        ["RCF available", "195", "conditions precedent verified — no draw-stoppers"],
        ["Total accessible", "379", ""],
      ]),
    ]},
    "CP-2E:Mandatory Cash Uses Register": { ref: "REF_CP-2E_03", out: "Mandatory uses", sections: [
      T("Mandatory uses — 12 months ($M)", ["Use", "Amount", "Timing"], [0,1,0], [
        ["Cash interest", "(196)", "quarterly floating — 1L TLB + 2L TL"],
        ["TLB amortization (1%)", "(18)", "quarterly"],
        ["Hartwell earnout", "(24)", "H2-26"],
        ["Maturities", "—", "none inside 24 months"],
      ]),
    ]},
    "CP-2E:WC & Capex Pressure Table": { ref: "REF_CP-2E_04", out: "WC / capex pressure", sections: [
      T("Pressure items ($M)", ["Item", "Amount", "Note"], [0,1,0], [
        ["Working-capital trough (Q3 seasonal)", "(43)", "recovers Q4 — pattern stable 4 years"],
        ["Capex (12mo fwd)", "(121)", "≈ $25M deferrable in stress"],
      ]),
    ]},
    "CP-2E:12-Month Liquidity Bridge": { ref: "REF_CP-2E_05", out: "Liquidity bridge", sections: [
      T("Bridge ($M)", ["", "Amount"], [0,1], [
        ["Beginning cash (Apr-26)", "184"],
        ["RCF availability (undrawn, net LCs)", "195"],
        ["FCF before debt service (12mo fwd)", "+178"],
        ["Cash interest", "(196)"],
        ["Mandatory amortization (TLB 1%)", "(18)"],
        ["Bolt-on / earnout commitments", "(24)"],
        ["Working capital & seasonality trough", "(43)"],
        ["Ending liquidity (12mo)", "276"],
      ]),
      X("Net", "Bridge nets +$96M over 12 months from $379M beginning accessible liquidity.", ["E-77"]),
    ]},
    "CP-2E:Months to Empty Result": { ref: "REF_CP-2E_06", out: "Months-to-empty", sections: [
      T("Months-to-empty", ["Case", "MTE", "Basis"], [0,1,0], [
        ["Base", "19.3 mo", "CP-1 forward FCF, full RCF access"],
        ["CP-2B P1 stress", "14.0 mo", "EBITDA −18%, WC drag, springing test untested"],
        ["P1 + RCF unavailable (theoretical)", "9.1 mo", "cash-only — not a modeled scenario"],
      ]),
      X("Rule note", "Calculated only because both inputs (burn rate, accessible liquidity) are source-supported, per module calculation rules.", ["E-77"]),
    ]},
    "CP-2E:Mitigants & Constraints Table": { ref: "REF_CP-2E_07", out: "Mitigants / constraints", sections: [
      T("Mitigants & constraints", ["Type", "Item", "Value"], [0,0,0], [
        ["Mitigant", "Capex deferability", "≈ $25M"],
        ["Mitigant", "Receivables facility option (uncommitted)", "≈ $60M est."],
        ["Constraint", "Springing 1L leverage test", "trips above 40% RCF utilization (now 22%)"],
        ["Constraint", "LC carve-out", "$12.4M of RCF"],
      ]),
    ]},
    "CP-2E:Liquidity Risk Level + Narrative": { ref: "REF_CP-2E_08", out: "Risk level", sections: [
      X("ADEQUATE", "Strong headline liquidity with the springing covenant comfortably untested. The only path to pressure runs through P1-scale EBITDA stress sustained for 3+ quarters — and even there, months-to-empty stays in double digits. Liquidity is not the binding risk in this credit; documentation is."),
    ]},
    "CP-2E:Gaps Ledger": { ref: "REF_CP-2E_09", out: "Gaps ledger", sections: [
      X("Ledger", "No gaps. Intercompany cash-pooling detail at the MX subsidiary noted as a minor opacity — non-material (MX is <4% of group cash)."),
    ]},
    "CP-2E:Overall Liquidity View": { ref: "REF_CP-2E_10", out: "Overall liquidity view", sections: [
      X("View", "Liquidity is a strength: 19.3 months-to-empty under base, 14.0 under the CP-2B P1 stress. No maturity inside 24 months; springing covenant tests only above 40% RCF utilization (currently 22%).", ["E-77"]),
    ]},

    /* ================= CP-2F · Macro & Hedging ================= */
    "CP-2F:Source Register & Module Status": { ref: "REF_CP-2F_01", out: "Gate decision", sections: [
      F("Status", [
        { sev: "warning", text: "READY WITH LIMITATIONS — hedging register / swap confirms not provided (G-01). Module executes in degraded mode; every output object stamped L-04. Floating exposure modeled from SFA margins only." },
      ]),
    ]},
    "CP-2F:Debt & Rate Exposure Register": { ref: "REF_CP-2F_02", out: "Rate exposure register", sections: [
      T("Exposure register", ["Instrument", "Balance ($M)", "Basis", "Modeled hedge"], [0,1,0,0], [
        ["RCF (drawn)", "120", "SOFR + 350", "none"],
        ["Term Loan B", "1,850", "SOFR + 375", "unknown — register missing"],
        ["2L TL '31", "900", "S+425 (floating)", "n/a"],
        ["Sub Notes '32", "400", "Fixed 10.00%", "n/a"],
      ]),
      X("Summary", "61% floating share before any undisclosed hedges — flagged with (*) wherever quoted."),
    ]},
    "CP-2F:Hedging Register": { ref: "REF_CP-2F_03", out: "Hedging register", sections: [
      T("Hedging register", ["Instrument", "Notional", "Rate", "Maturity"], [0,1,1,0], [
        ["[Insufficient Information]", "—", "—", "—"],
      ]),
      X("Disposition", "Not producible: swap confirmations and the hedging policy were not provided (gap G-01). Per prohibited-behavior rules the register is marked [Insufficient Information] rather than assumed — no synthetic hedge book is constructed. Re-requested Jun 04."),
    ]},
    "CP-2F:Unhedged Floating Exposure": { ref: "REF_CP-2F_04", out: "Unhedged exposure (upper bound)", sections: [
      T("Unhedged floating exposure*", ["Measure", "Value"], [0,1], [
        ["Floating-rate debt", "$1,970M"],
        ["Share of gross debt", "61%"],
        ["Treatment", "fully unhedged (upper bound) — L-04"],
      ]),
    ]},
    "CP-2F:+100bps Rate Sensitivity": { ref: "REF_CP-2F_05", out: "Rate sensitivity", sections: [
      T("Base-rate sensitivity (annualized)", ["Shift", "Interest Δ", "FCF impact", "Coverage"], [0,1,1,1], [
        ["+50bps", "+$9.9M", "−$6.1M", "2.05x"],
        ["+100bps", "+$19.7M", "−$12.1M", "2.0x"],
        ["+200bps", "+$39.4M", "−$24.2M", "1.9x"],
      ]),
      X("Bound note", "Figures are upper bounds on the fully-unhedged assumption — any undisclosed hedges reduce them. −$12.1M at +100bps equals 7% of LTM FCF."),
    ]},
    "CP-2F:FX Exposure Register": { ref: "REF_CP-2F_06", out: "FX register", sections: [
      T("FX exposure", ["Pair", "Revenue", "Cost", "Net"], [0,1,1,0], [
        ["USD (functional)", "84%", "81%", "—"],
        ["EUR (4 plants)", "12%", "13%", "naturally hedged"],
        ["MXN (1 plant)", "4%", "6%", "translation-only, minor"],
      ]),
      X("Read", "FX risk LOW — no debt-currency mismatch (all USD), no material transactional gap."),
    ]},
    "CP-2F:Commodity & Inflation Table": { ref: "REF_CP-2F_07", out: "Commodity / inflation sensitivity", sections: [
      T("Commodity exposure", ["Input", "COGS share", "Mechanism", "Net exposure"], [0,1,0,0], [
        ["Steel / alloys", "71%", "indexed pass-through, 60–90d lag", "timing only"],
        ["Energy", "6%", "partially contracted", "minor"],
        ["Freight", "5%", "spot + contract mix", "minor"],
      ]),
      X("Read", "Inflation is a timing exposure, not a level exposure — quantified at −4% EBITDA for 2 quarters under a +20% alloy spike (CP-2B P3).", ["E-31"]),
    ]},
    "CP-2F:Macro Sensitivity Summary": { ref: "REF_CP-2F_08", out: "Macro summary", sections: [
      T("Channel ranking", ["Channel", "Severity", "Status"], [0,0,0], [
        ["Base rates (61% floating*)", "DOMINANT — −$12.1M / +100bps", "L-04 upper bound"],
        ["Commodity (lagged pass-through)", "SECOND-ORDER", "modeled, recovers"],
        ["FX", "MINOR", "naturally hedged"],
      ]),
    ]},
    "CP-2F:Gaps Ledger": { ref: "REF_CP-2F_09", out: "Gaps ledger", sections: [
      X("Ledger", "G-01 open — swap confirms re-requested Jun 04, no response at run time. Resolution re-rates the sensitivity table and lifts L-04 from CP-6A's macro weighting."),
    ]},
    "CP-2F:Overall Macro / Hedging View": { ref: "REF_CP-2F_10", out: "Overall macro view", sections: [
      X("View", "Rate sensitivity is the dominant macro channel — real but bounded above by the unhedged assumption. The credit is structurally insulated on commodities (pass-through) and FX (natural hedge). The view carries the L-04 caveat until G-01 resolves; a confirmed hedge book covering ≥50% of the TLB would move the macro assessment from WATCH to NEUTRAL."),
    ]},
  };

// ── from step-outputs-l3.js ──
const O2: Record<string, StepOutput> = {
    /* ================= CP-3 · RelativeValue ================= */
    "CP-3:Source Register + Execution Mode": { ref: "REF_CP-3_01 · T3.1", out: "Gate + execution mode", sections: [
      T("Sources", ["Input", "Status"], [0,0], [
        ["CP-1C benchmarks (ex-E-44 basis)", "GREEN — limitation carried"],
        ["CP-2 credit view (B2 / STABLE)", "GREEN"],
        ["MKT — LoanX marks + dealer runs (Jun 8)", "GREEN"],
      ]),
      X("Mode", "Full-stack execution — fundamental scorecard, fair-value band and final ranking all produced.", ["E-71"]),
    ]},
    "CP-3:Fundamental Credit Summary": { ref: "REF_CP-3_02", out: "Fundamental summary", sections: [
      X("Summary", "Mid-B2 with positive trajectory: genuine FCF (41% conversion), credible deleveraging to ~4.9x FY27 on realized add-backs, liquidity a strength. Standing deductions: EBITDA quality (18.2% add-backs), top-3 OEM concentration, and the documentation overhang quantified by CP-4C. The credit improves on proof — the Q3-26 certificate is the catalyst that converts presentation into fact."),
    ]},
    "CP-3:Issuer / Security Scorecard": { ref: "REF_CP-3_03 · T3.3", out: "Scorecard — 71/100", sections: [
      T("Scorecard", ["Component", "Score", "Basis"], [0,1,0], [
        ["Cash flow quality", "17 / 20", "41% conversion, low WC drag"],
        ["Business durability", "15 / 20", "aftermarket annuity vs OEM concentration"],
        ["Leverage & coverage", "12 / 20", "5.7x / 2.1x — mid-single-B"],
        ["Liquidity", "13 / 15", "19.3 MTE, no near wall"],
        ["Documentation", "9 / 15", "7.2/10 aggressiveness, MFN sunset"],
        ["Sponsor / governance", "5 / 10", "recap record, RP pre-positioning"],
        ["Composite", "71 / 100", "actionable band: ≥ 65"],
      ]),
    ]},
    "CP-3:Override Review": { ref: "REF_CP-3_04 · T3.4", out: "Override register", sections: [
      X("Register", "Empty — no analyst overrides applied to model scores. The scorecard output is carried as computed. (Override policy: any manual adjustment requires a written basis and CP-5 notification; none invoked this run.)"),
    ]},
    "CP-3:Relative Value Table": { ref: "REF_CP-3_05 · T3.5", out: "Relative value table", sections: [
      T("RV table", ["Instrument", "DM", "Fair band", "Excess", "Rank"], [0,1,1,1,1], [
        ["ATLF 2L TL '31 (subject)", "+388", "+325–340", "+48–63", "2"],
        ["Veldt Precision TLB '30", "+291", "+285–300", "−9–+6", "5"],
        ["Ironvale TLB '29", "+327", "+310–325", "+2–17", "4"],
        ["Forgeline TLB '30", "+352", "+330–345", "+7–22", "3"],
        ["Karst TLB '29", "+459", "+470–495", "−36–−11", "6"],
        ["Cascadia 2L TL '30", "+341", "+280–300", "+41–61", "1*"],
      ]),
      X("Band note", "The fair band leans on E-44; the ex-E-44 construction (sector beta regression) still shows +20–25bps cheap. Both bands carried until QA-117 resolves.", ["E-71", "E-44"]),
    ]},
    "CP-3:Fundamental Value Matrix": { ref: "REF_CP-3_06 · T3.6", out: "Value matrix", sections: [
      T("Matrix — fundamentals × valuation", ["Quadrant", "Names"], [0,0], [
        ["Cheap / improving", "ATLF (subject) · Cascadia*"],
        ["Cheap / deteriorating", "Karst"],
        ["Fair / stable", "Ironvale · Forgeline"],
        ["Rich / strong", "Veldt"],
      ]),
      X("Note", "* Cascadia plots cheaper only on a recovery adjustment (thinner collateral coverage) the IC has historically discounted; on a like-for-like recovery basis the subject is the cheapest improving credit in the set."),
    ]},
    "CP-3:Final Ranking": { ref: "REF_CP-3_07 · T3.7", out: "Final ranking", sections: [
      T("Final ranking", ["Rank", "Name", "Basis"], [1,0,0], [
        ["1*", "Cascadia 2L TL '30", "recovery-adjusted — discounted by IC"],
        ["2", "ATLF 2L TL (subject)", "carry + deleveraging, monitorable risks"],
        ["3", "Forgeline TLB '30", "fair-to-cheap, lower beta"],
        ["4", "Ironvale TLB '29", "fair"],
        ["5", "Veldt Precision TLB '30", "rich — quality priced"],
        ["6", "Karst TLB '29", "cheap for a reason — deteriorating"],
      ]),
      X("Robustness", "Dropping the contested E-44 margin set moves the subject from 2 to 3 of 7 — still inside the actionable band."),
    ]},
    "CP-3:Security Selection Conclusions": { ref: "REF_CP-3_08", out: "Selection conclusions", sections: [
      X("Conclusions", "Within the ATLF structure, the 2L TL is the expression: +210bps of spread pickup over the TLB for an acceptable recovery delta at the 6.0x stress point (CP-3B). Sub notes rejected on priming exposure and thin covenant protection. Hold-to-maturity math clears the hurdle at +388 even with zero spread tightening — conviction is carry plus deleveraging, not convergence."),
    ]},
    "CP-3:Monitoring Triggers": { ref: "REF_CP-3_09 · T3.9", out: "RV triggers", sections: [
      T("Triggers", ["Trigger", "Threshold", "Action"], [0,0,0], [
        ["Spread tightening", "through +300", "exit — thesis complete"],
        ["Peer-set rating migration", "any notch move", "re-rank universe"],
        ["Mark refresh", "weekly", "desk runs + LoanX"],
      ]),
    ]},
    "CP-3:Gaps Ledger": { ref: "REF_CP-3_10", out: "Gaps ledger", sections: [
      X("Ledger", "E-44 dependency carried as the single limitation; both fair-value bands (with and ex-E-44) published side by side wherever the band is quoted."),
    ]},
    "CP-3:Final Credit / RV View": { ref: "REF_CP-3_11", out: "Final view", sections: [
      X("View", "Rank 2 of 7. The position pays +48–63bps over model (+20–25 ex-E-44) for risks that are monitorable rather than structural. Conviction is carry plus deleveraging; the Q3-26 certificate is the proof point that would close the band.", ["E-71"]),
    ]},

    /* ================= CP-3B · InstrumentSelection / Recovery ================= */
    "CP-3B:Instrument Data Gate": { ref: "REF_CP-3B · T3B.1", out: "Gate decision", sections: [
      T("Instrument verification", ["Instrument", "Terms verified vs", "Status"], [0,0,0], [
        ["RCF $250M · TLB $1,850M", "D-02 SFA schedules", "VERIFIED"],
        ["2L TL $900M S+425 '31", "D-03 credit agreement", "VERIFIED"],
        ["Sub Notes $400M 10.00% '32", "D-03 + CIM description", "VERIFIED"],
      ]),
      X("Tie-out", "Claims totals tie to CP-1 net debt within rounding. Gate PASS."),
    ]},
    "CP-3B:Capital Structure Dashboard": { ref: "REF_CP-3B · T3B.2", out: "Capital structure dashboard", sections: [
      T("Capital structure ($M)", ["Class", "Rate", "Amount", "Leverage through"], [0,0,1,1], [
        ["RCF (drawn)", "S+350", "120", "—"],
        ["Term Loan B (1L)", "S+375", "1,850", "4.68x (secured)"],
        ["2L TL '31 (subject)", "S+425", "900", "5.7x"],
        ["Sub Notes '32", "10.00%", "400", "6.6x"],
        ["Total debt", "", "3,270", "6.6x gross · 5.68x net (adj.)"],
      ]),
    ]},
    "CP-3B:Instrument Matrix": { ref: "REF_CP-3B · T3B.3", out: "Instrument matrix", sections: [
      T("Matrix", ["Dimension", "TLB (1L)", "2L TL", "Subs"], [0,0,0,0], [
        ["Spread / yield", "S+375 (~+340)", "+388", "+545"],
        ["Recovery @ 6.0x stress", "100%", "21%", "0%"],
        ["Covenant protection", "springing only", "full package", "thin"],
        ["Liquidity (trading)", "good", "good — $4.2M avg print", "poor"],
        ["Spread per risk unit", "baseline", "BEST", "worst"],
      ]),
    ]},
    "CP-3B:Structural Positioning Log": { ref: "REF_CP-3B · T3B.4", out: "Positioning log", sections: [
      X("Positioning", "The 2L TL sits behind $1,970M of 1L claims with full guarantor coverage (87% of EBITDA) and second-lien collateral on substantially all assets — and structurally ahead of a $400M sub-notes cushion. Non-guarantor leakage is limited to the MX subsidiary (<4% of EBITDA). The position is conventional; the risk is documentary (priming), not structural."),
    ]},
    "CP-3B:Legal / Covenant / LME Overlay": { ref: "REF_CP-3B · T3B.5", out: "LME overlay", sections: [
      F("Overlay findings", [
        { sev: "warning", text: "Priming exposure: $612M of day-one incremental capacity is incurrable pari or senior to the 2L (CP-4C). MFN protects pari raises only and sunsets Jun-27 — recovery assumptions degrade if capacity is used.", ev: ["E-63", "E-64"] },
        { sev: "ok", text: "No J.Crew / Chewy paths: no unrestricted-sub transfer basket, no automatic guarantee release — asset-stripping LME variants are blocked." },
      ]),
      X("Treatment", "LME risk is priced via the preference decision and CP-6E sizing, not excluded. A primed waterfall variant (+$400M 1L) cuts the 6.0x-stress 2L recovery from 21% to ~8% — the quantified cost of the open capacity."),
    ]},
    "CP-3B:Recovery Sensitivity Table": { ref: "REF_CP-3B · T3B.6", out: "Recovery sensitivity grid", sections: [
      T("2L recovery — exit multiple × stressed EBITDA (% of par)", ["EBITDA", "5.0x", "5.5x", "6.0x", "6.5x", "7.0x", "7.5x"], [0,1,1,1,1,1,1], [
        ["$421M (LTM adj.)", "16", "40", "63", "86", "100", "100"],
        ["$360M (base stress)", "0", "9", "29", "49", "69", "89"],
        ["$295M (severe)", "0", "0", "0", "13", "30", "46"],
      ]),
      X("Cliff", "The cliff sits below 5.5x on stressed EBITDA, where 1L claims ($1,970M) consume the estate before the 2L attaches. Scenario anchors: base distress 5.5x × $360M → 2L 22%; severe 5.0x × $295M → 0%."),
    ]},
    "CP-3B:Compensation Cross-Check": { ref: "REF_CP-3B · T3B.7", out: "Compensation cross-check", sections: [
      T("Cross-check", ["Input", "Value"], [0,1], [
        ["Probability-weighted LGD (base-distress weights)", "~62% of par"],
        ["Annual default probability (B2 cohort)", "~2.4%"],
        ["Required spread for LGD", "~248bps"],
        ["Actual DM", "+388bps"],
        ["Excess compensation", "~140bps"],
      ]),
      X("Result", "PASS — at +388 the 2L compensates modeled loss-given-default with ~140bps of excess spread. Market-implied 2L recovery at px 96.4 ≈ 38% — wide of model in severe only."),
    ]},
    "CP-3B:Preference Decision Table": { ref: "REF_CP-3B · T3B.8", out: "Preference decision", sections: [
      T("Decision", ["Criterion", "TLB", "2L TL", "Subs"], [0,0,0,0], [
        ["Spread pickup vs 1L", "—", "+210bps", "+370bps"],
        ["Recovery delta @ 6.0x", "—", "−79pp", "−100pp"],
        ["Covenant package", "springing only", "full", "thin"],
        ["Priming exposure", "protected (1L)", "accepted — priced", "unprotected"],
        ["Verdict", "defensive option", "SELECTED", "rejected"],
      ]),
    ]},
    "CP-3B:Ranking & Trade-Off Summary": { ref: "REF_CP-3B", out: "Trade-off summary", sections: [
      X("Summary", "2L TL > TLB > Subs. The 2L's recovery cliff below 5.5x stressed is the accepted risk, paid for by +210bps over the TLB. The subs' extra +160bps does not compensate first-loss positioning plus priming exposure with no MFN protection — rejected. TLB retained as the defensive rotation if T-2 (incremental raise) trips."),
    ]},
    "CP-3B:Monitoring Triggers": { ref: "REF_CP-3B · T3B.10", out: "Instrument triggers", sections: [
      T("Triggers", ["Trigger", "Signal", "Action"], [0,0,0], [
        ["1L incremental raise", "facility notice / LoanX", "re-run waterfall, re-test preference"],
        ["Sub notes repurchase < 85", "LoanX marks", "LME-posture tell — escalate to CP-3D"],
        ["1L 1L TLB / 2L TL price decoupling", "weekly marks", "re-test relative preference"],
      ]),
    ]},
    "CP-3B:Gaps Ledger": { ref: "REF_CP-3B · T3B.11", out: "Gaps ledger", sections: [
      X("Ledger", "No instrument-level gaps. Lease ($84M) and pension (de-minimis) claims modeled from audit notes at $61M combined priority-adjusted — immaterial to attachment points."),
    ]},
    "CP-3B:Overall Instrument Preference View": { ref: "REF_CP-3B", out: "Overall preference view", sections: [
      X("View", "2L TL preferred over the TLB: +210bps of spread pickup for an acceptable recovery delta at the 6.0x stress point. Sub notes rejected on priming exposure and thin covenant protection. The preference stands under both fair-value bands and both waterfall variants short of an actual priming event."),
    ]},

    /* ================= CP-3C · PortfolioFit ================= */
    "CP-3C:Portfolio Input Gate": { ref: "REF_CP-3C · T3C.1", out: "Gate decision", sections: [
      T("Inputs", ["Input", "As-of", "Status"], [0,0,0], [
        ["Portfolio snapshot", "Jun 8 (T+1)", "LOADED"],
        ["Limit framework v4.1", "current", "LOADED"],
        ["Proposed sizing range", "75–125bps", "from CP-6E draft"],
      ]),
    ]},
    "CP-3C:Portfolio Fit Register": { ref: "REF_CP-3C · T3C.2", out: "Fit register", sections: [
      T("Hard limits at initial size (75bps)", ["Constraint", "Limit", "Post-add", "Status"], [0,1,1,0], [
        ["Single issuer", "150bps", "75bps", "PASS"],
        ["Industrials sector", "8.0%", "6.1%", "PASS"],
        ["Sponsor (Kestrel) aggregate", "4.0%", "2.2%", "PASS"],
        ["B3-or-below bucket", "15.0%", "13.7%", "PASS — 91% utilized"],
      ]),
    ]},
    "CP-3C:Position Sizing Posture Table": { ref: "REF_CP-3C · T3C.3", out: "Sizing posture", sections: [
      T("Posture", ["Size", "Budget effect", "Read"], [0,0,0], [
        ["75bps initial", "headroom preserved in every budget", "supported"],
        ["100bps", "B3 bucket 94% utilized", "requires headroom check"],
        ["125bps max", "B3 bucket 97% utilized", "binds — same-day re-test required"],
      ]),
    ]},
    "CP-3C:Risk Budget Flags": { ref: "REF_CP-3C · T3C.4", out: "Budget flags", sections: [
      F("Flags", [
        { sev: "warning", text: "B3-or-below quality bucket at 91% utilization is the binding flag — max sizing requires a same-day headroom re-test. Encoded into the CP-6E sizing constraint." },
        { sev: "ok", text: "All other budgets (issuer, sector, sponsor, correlation) pass with material headroom." },
      ]),
    ]},
    "CP-3C:Concentration & Correlation Register": { ref: "REF_CP-3C · T3C.5", out: "Concentration register", sections: [
      T("Register", ["Constraint", "Limit", "Post-add", "Headroom", "Status"], [0,1,1,1,0], [
        ["Single issuer", "150bps", "75bps", "75bps", "PASS"],
        ["Industrials sector", "8.0%", "6.1%", "1.9%", "PASS"],
        ["B3-or-below bucket", "15.0%", "13.7%", "1.3%", "WATCH — 91% utilized"],
        ["Auto/industrial correlation cluster", "16.0%", "14.0%", "2.0%", "PASS"],
        ["Sponsor (Kestrel) aggregate", "4.0%", "2.2%", "1.8%", "PASS"],
      ]),
      X("Watched pair", "SXAA is the monitored overlap (same OEM exposure class) — no concurrent adds ruled by the CIO."),
    ]},
    "CP-3C:Liquidity & Implementation": { ref: "REF_CP-3C · T3C.6", out: "Implementation feasibility", sections: [
      X("Feasibility", "Two-way desk markets 96.25/96.75 and $4.2M average LoanX clip support building 75bps inside ~2 weeks without moving the price. Standing limit order at +400bps captures weakness. Exit liquidity adequate for a 75bps position; 125bps would take ~4 weeks to unwind in stress — acceptable for a hold-to-maturity thesis.", ["E-71"]),
    ]},
    "CP-3C:Downside Budget & Recovery Sensitivity": { ref: "REF_CP-3C · T3C.7", out: "Downside budget", sections: [
      T("Budget consumption", ["Case", "Position loss", "Quarterly budget use"], [0,1,1], [
        ["Severe stress (21% recovery)", "−59pts on 125bps", "9bps of 15bps allowance"],
        ["Base distress (38% mkt-implied)", "−36pts on 125bps", "5.6bps"],
        ["Spread +100 mark-to-market", "−4.2pts", "0.7bps"],
      ]),
    ]},
    "CP-3C:Monitoring / Add-Trim Triggers": { ref: "REF_CP-3C · T3C.8", out: "Add/trim wiring", sections: [
      T("Wiring (mirrors CP-6E)", ["Direction", "Trigger"], [0,0], [
        ["Add", "T-1 pass (≥$30M add-backs realized) + same-day bucket headroom"],
        ["Add", "spread > +425 with thesis intact"],
        ["Trim", "RP-basket activation (T-4)"],
        ["Trim", "CP-3 re-rank below 4 of 7 · cluster breach > 15%"],
      ]),
    ]},
    "CP-3C:Gaps Ledger": { ref: "REF_CP-3C · T3C.9", out: "Gaps ledger", sections: [
      X("Ledger", "No gaps. Portfolio snapshot staleness (T+1) is a standard operating limitation — bucket utilization re-tested on trade date by rule."),
    ]},
    "CP-3C:Overall Portfolio Fit View": { ref: "REF_CP-3C", out: "Overall fit view", sections: [
      X("View", "Initial 75bps fits all budgets. The binding constraint at max size (125bps) is the B3-or-below bucket — any add requires a same-day bucket headroom check, encoded in the CP-6E sizing constraint."),
    ]},

    /* ================= CP-3D · Refinancing & LME ================= */
    "CP-3D:Source Register & Module Status": { ref: "REF_CP-3D · T3D.1", out: "Gate decision", sections: [
      T("Inputs", ["Input", "Status"], [0,0], [
        ["Facility schedules (D-02/D-03)", "GREEN"],
        ["CP-2E liquidity outputs", "GREEN"],
        ["CP-4C capacity registers", "GREEN"],
      ]),
    ]},
    "CP-3D:Maturity Wall Register": { ref: "REF_CP-3D · T3D.2", out: "Maturity wall", sections: [
      T("Wall ($M)", ["Year", "Instrument", "Amount", "Path assessment"], [0,0,1,0], [
        ["2027", "RCF commitment expiry", "250", "extend H2-26 — relationship banks, likely +25–50bps"],
        ["2029", "Term Loan B", "1,850", "refinanceable in current market at ~SOFR+400"],
        ["2031", "2L TL (subject)", "900", "inside refi horizon post-deleveraging"],
        ["2032", "Sub Notes", "400", "candidate for discounted repurchase if px < 85"],
      ]),
    ]},
    "CP-3D:Liquidity / Market Access Table": { ref: "REF_CP-3D · T3D.3", out: "Market access", sections: [
      T("Access channels", ["Channel", "Evidence", "Status"], [0,0,0], [
        ["Lev loan primary", "May-26 2L TL priced inside talk at 99.41", "OPEN"],
        ["Loan market", "TLB trades 99.1–99.6", "OPEN"],
        ["RCF banks", "5-bank group, all retained since 2021", "SUPPORTIVE"],
      ]),
    ]},
    "CP-3D:Legal Capacity for LME": { ref: "REF_CP-3D · T3D.4", out: "LME capacity assessment", sections: [
      T("Capacity elements", ["Element", "Finding"], [0,0], [
        ["Incremental debt", "$612M day-one, pari or senior to 2L"],
        ["Amendment threshold", "50.1% for non-money terms — uptier-enabling"],
        ["MFN protection", "pari only · sunsets Jun-27"],
        ["J.Crew / Chewy blockers", "PRESENT — drop-down / release paths blocked"],
      ]),
      X("Assessment", "Uptier path OPEN: the capacity is real and is priced via sizing, not exclusion. The binding protection for the 2L today is economics (no distress motive), not documents.", ["E-63", "E-64"]),
    ]},
    "CP-3D:Sponsor Willingness Table": { ref: "REF_CP-3D · T3D.5", out: "Sponsor willingness", sections: [
      T("Willingness", ["Factor", "Read"], [0,0], [
        ["Fund VI capacity ($4.2B, Jun-26)", "follow-on equity available — support-positive"],
        ["Recap record (2 of 2 Fund IV exits)", "support conditional on equity value, not creditor protection"],
        ["Platform status", "largest industrials position — reputational stake in avoiding default"],
      ]),
      X("Net", "MODERATE-HIGH willingness to support the enterprise; LOW willingness to protect any specific creditor class.", ["E-91"]),
    ]},
    "CP-3D:Refinancing Path Table": { ref: "REF_CP-3D · T3D.6", out: "Refi paths", sections: [
      T("Paths", ["Instrument", "Path", "Risk"], [0,0,0], [
        ["RCF (2027)", "extend H2-26 at +25–50bps", "LOW"],
        ["TLB (2029)", "refi at ~SOFR+400 on current fundamentals", "LOW-MED — cycle-dependent"],
        ["2L TL (2031)", "refi post-deleveraging; 101 soft-call lapsed — par-prepayable", "MED"],
        ["Subs (2032)", "discounted repurchase if px < 85", "opportunistic"],
      ]),
    ]},
    "CP-3D:Vulnerability Score Table": { ref: "REF_CP-3D · T3D.7", out: "Vulnerability score", sections: [
      T("Score build — 4 / 10", ["Factor", "Score", "Basis"], [0,1,0], [
        ["Maturity proximity", "1 / 10", "nothing inside 24 months"],
        ["Cash flow adequacy", "2 / 10", "real FCF, 19.3 MTE"],
        ["Market access", "2 / 10", "both channels open"],
        ["Legal LME capacity", "8 / 10", "uptier path open — dominates the blend"],
        ["Sponsor behavior", "6 / 10", "recap pattern"],
        ["Composite (weighted)", "4 / 10", "capacity-driven, not distress-driven"],
      ]),
    ]},
    "CP-3D:Creditor Class Exposure Table": { ref: "REF_CP-3D · T3D.8", out: "Class exposure", sections: [
      T("Exposure by class", ["Class", "LME exposure", "Mechanism"], [0,0,0], [
        ["TLB (1L)", "LOW", "protected by lien priority + springing covenant"],
        ["2L TL (subject)", "HIGH — target class", "priming capacity lands directly above"],
        ["Sub Notes", "STRUCTURAL", "first-loss; repurchase-at-discount candidate"],
      ]),
    ]},
    "CP-3D:Monitoring Triggers": { ref: "REF_CP-3D · T3D.9", out: "Refi triggers", sections: [
      T("Triggers", ["Trigger", "Threshold", "Action"], [0,0,0], [
        ["TLB price", "< 97", "refi-risk tell — re-score vulnerability"],
        ["RCF extension", "terms worse than +50bps", "re-score market access"],
        ["Amendment solicitation", "any", "immediate LME posture review"],
      ]),
    ]},
    "CP-3D:Scenario Map (base / stress / LME)": { ref: "REF_CP-3D · T3D.10", out: "Scenario map", sections: [
      T("Scenarios", ["Scenario", "Mechanics", "2L outcome"], [0,0,0], [
        ["Base", "RCF extended H2-26; TLB refi 2028-29; deleveraging to 4.9x", "par — refi or call 2028+"],
        ["Stress", "P1 hits as 2029 TLB approach opens — vulnerability re-rates 7/10", "spread +150–250; covenant pressure"],
        ["LME", "post-sunset uptier: $612M priming raise, 50.1% amendment", "recovery −13pp at 6.0x stress; px low 80s"],
      ], ),
      X("Note", "The LME scenario requires both motive (stress) and the open window (post Jun-27) — the sequencing watched by trigger T-2.", ["E-63"]),
    ]},
    "CP-3D:Gaps Ledger": { ref: "REF_CP-3D · T3D.11", out: "Gaps ledger", sections: [
      X("Ledger", "No gaps. Private-side amendment history unavailable but non-blocking for the vulnerability score."),
    ]},
    "CP-3D:Overall Refinancing / LME View": { ref: "REF_CP-3D", out: "Overall view", sections: [
      X("View", "Vulnerability 4/10 today: no near wall, real FCF, open market access. But legal capacity for an uptier exists ($612M incremental + open RP paths) — vulnerability re-rates to 7/10 if P1 stress coincides with the 2029 TLB approach. Capacity-driven risk, watched at the 2028–29 window.", ["E-64"]),
    ]},
  };

// ── from step-outputs-l456.js ──
const O3: Record<string, StepOutput> = {
    /* ================= CP-4 · Legal & Covenants ================= */
    "CP-4:Source Gate + Module Status": { ref: "REF_CP-4 · T4.1", out: "Gate decision", sections: [
      T("Admitted documents", ["Doc", "Authority", "Status"], [0,0,0], [
        ["D-02 SFA (executed, conformed)", "controls bank debt", "ADMITTED"],
        ["D-03 2L Credit Agt (executed)", "controls the 2L loan", "ADMITTED"],
        ["Intercreditor agreement", "lien priority + standstill", "ADMITTED"],
        ["CIM covenant summary", "navigation only — never authority", "REFERENCE"],
      ]),
    ]},
    "CP-4:Controlling Document Register": { ref: "REF_CP-4 · T4.2", out: "Controlling register", sections: [
      T("Controlling text", ["Provision area", "Controls", "Summary conflicts found"], [0,0,0], [
        ["2L covenants, RP, incremental", "D-03 Credit Agt", "1 — CIM understates reclassification headroom"],
        ["Bank covenants, springing test", "D-02 SFA", "1 — CIM omits LC carve-out detail"],
        ["Lien priority / remedies standstill", "Intercreditor", "0"],
      ]),
      X("Rule", "Where summaries conflict with executed text, executed text controls — both instances resolved against the executed documents and noted."),
    ]},
    "CP-4:Covenant Feature Register": { ref: "REF_CP-4 · T4.3", out: "Feature register — 41 provisions", sections: [
      T("Register (material provisions of 41)", ["Ref", "Provision", "Feature class", "Agg."], [0,0,0,1], [
        ["§4.09(b)(14)", "Incremental debt — freebie + ratio + reclass", "capacity", "9"],
        ["§4.09(d)", "MFN 50bps · pari-only · 12mo sunset", "protection decay", "8"],
        ["§1.01 'Consolidated EBITDA'", "uncapped add-backs (credit agreement)", "definition", "8"],
        ["§4.07", "RP — builder + starter baskets", "leakage", "7"],
        ["§4.12 / §10.02", "liens + collateral release mechanics", "security", "4"],
        ["§9.02", "amendments — 50.1% non-money terms", "remedies", "7"],
        ["§5.01", "reporting — monthly lender package", "information", "2"],
      ]),
    ]},
    "CP-4:EBITDA, Definitions & Ratio Mechanics": { ref: "REF_CP-4", out: "Definition mechanics", sections: [
      T("Definition comparison", ["Element", "SFA (bank)", "Credit Agt (notes)"], [0,0,0], [
        ["Cost-saving add-backs", "capped 25% of EBITDA / 24mo", "UNCAPPED"],
        ["Run-rate window", "24 months", "36 months"],
        ["Covenant EBITDA (LTM)", "$421.4M", "$435.6M"],
        ["Divergence", "—", "+$14.2M feeds every grower basket"],
      ]),
      X("Mechanics", "Definitional looseness is the document's core aggression: the uncapped credit agreement definition inflates every grower basket and ratio test mechanically with each 'one-time' charge. Evidence → mechanic → implication: recurring charges (3 of last 4 years) → permanent basket inflation → capacity grows precisely when earnings quality falls.", ["E-09", "E-103"]),
    ]},
    "CP-4:Debt Incurrence, Incremental & MFN": { ref: "REF_CP-4", out: "Incurrence stack", sections: [
      T("Incurrence stack ($M)", ["Basket", "Capacity", "Ranking permitted"], [0,1,0], [
        ["Freebie (greater of $150M / 35% EBITDA)", "150", "pari or senior to 2L"],
        ["Ratio capacity (5.25x secured test @ 4.68x)", "310", "pari or senior to 2L"],
        ["Reclassification headroom", "155", "pari or senior to 2L"],
        ["Total day-one", "612", ""],
      ]),
      X("MFN", "MFN at 50bps protects pari incremental raises only and sunsets June 2027 — after which a priming or pari raise carries no yield protection for 2L lenders.", ["E-63", "E-64"]),
    ]},
    "CP-4:Leakage, RP, Investments & Transfers": { ref: "REF_CP-4", out: "Leakage analysis", sections: [
      T("Leakage paths ($M)", ["Path", "Capacity today", "Note"], [0,1,0], [
        ["RP builder basket (§4.07)", "240", "pre-positioned — no stated use"],
        ["RP starter + general baskets", "70", "usable day-one"],
        ["Investment baskets", "185", "permits unrestricted-sub designation"],
        ["Unrestricted-sub transfer basket", "ABSENT", "J.Crew-style drop-down blocked"],
      ]),
    ]},
    "CP-4:Collateral, Guarantees & Subordination": { ref: "REF_CP-4", out: "Security package", sections: [
      T("Package", ["Element", "Finding"], [0,0], [
        ["Guarantor coverage", "87% of EBITDA — all material domestic subs"],
        ["Collateral", "second lien on substantially all assets"],
        ["Non-guarantor pockets", "MX subsidiary only (<4% EBITDA)"],
        ["Automatic release triggers", "none beyond customary (Chewy blocked)"],
      ]),
      X("Read", "The structural floor of the credit — coverage and collateral are market-standard-or-better and offset part of the capacity aggression."),
    ]},
    "CP-4:EoD, Remedies & Amendment Risk": { ref: "REF_CP-4", out: "Remedies assessment", sections: [
      X("Assessment", "Events of default are conventional (cross-acceleration at $40M, judgment at $50M). Sacred rights are limited to money terms: amendments to covenants, collateral and ranking-adjacent provisions pass at 50.1% — uptier-enabling architecture, standard for the 2026 vintage but live given the open capacity. The intercreditor imposes a 120-day standstill on 2L remedies — registered for CP-3B's recovery timing."),
    ]},
    "CP-4:PD vs LGD / Recovery Translation": { ref: "REF_CP-4 · T4.9", out: "PD/LGD translation", sections: [
      X("Translation", "This document set shifts risk from PD to LGD. Default is not made nearer (no maintenance covenant to trip; liquidity strong), but the creditor's position at default is erodible: priming capacity degrades the 2L's attachment point and leakage baskets can move value out before a restructuring. Quantified: a used $612M capacity cuts 6.0x-stress recovery from 21% to ~8% (CP-3B overlay)."),
    ]},
    "CP-4:Market Norm Comparison": { ref: "REF_CP-4 · T4.10", out: "Norm comparison", sections: [
      T("vs 2026 single-B norm set", ["Dimension", "Subject", "Market norm"], [0,1,1], [
        ["Add-back treatment", "uncapped (credit agreement)", "25–30% cap typical"],
        ["Day-one capacity / EBITDA", "1.45x", "0.9–1.1x"],
        ["MFN sunset", "12 months", "18–24 months"],
        ["Guarantor coverage", "87%", "80–85%"],
        ["Composite aggressiveness", "7.2 / 10", "6.1 / 10"],
      ]),
    ]},
    "CP-4:Aggressiveness Score": { ref: "REF_CP-4 · T4.11", out: "Aggressiveness score", sections: [
      T("Score build — 7.2 / 10 (Aggressive)", ["Component", "Score", "Driver"], [0,1,0], [
        ["Definitions", "8", "uncapped add-backs"],
        ["Capacity", "9", "$612M day-one + reclassification"],
        ["Protection decay", "8", "12-month MFN sunset"],
        ["Leakage", "7", "$310M RP usable today"],
        ["Security / guarantees", "4", "full coverage — offsetting"],
        ["Reporting", "2", "above-market disclosure"],
      ]),
      X("Verdict", "Top-quartile aggressive vs the 2026 single-B norm of 6.1 — driven by definitions and capacity, partially offset by the security package and the absence of an unrestricted-sub transfer basket."),
    ]},
    "CP-4:Red Flags & Monitoring Triggers": { ref: "REF_CP-4 · T4.12", out: "Red flags", sections: [
      F("Red flags → standing triggers", [
        { sev: "critical", text: "MFN sunset Jun-27: any incremental raise above $200M inside the window trips T-2 → CP-3B re-rank + CP-6E sizing review.", ev: ["E-64"] },
        { sev: "warning", text: "RP capacity pre-positioned ($240M builder): any activation trips T-4 → posture change at CP-2D and CP-6E.", ev: ["E-63"] },
      ]),
    ]},
    "CP-4:Gaps Ledger": { ref: "REF_CP-4 · T4.13", out: "Gaps ledger", sections: [
      X("Ledger", "No documentation gaps — full executed set provided. The intercreditor's 120-day standstill detail registered for CP-3B recovery timing assumptions."),
    ]},
    "CP-4:Overall Legal Credit View": { ref: "REF_CP-4", out: "Overall legal view", sections: [
      X("View", "An aggressive but not pathological document set: capacity ($612M day-one) and definitional looseness (uncapped add-backs) are the risks; full collateral/guarantee coverage and the absence of J.Crew/Chewy paths are the protections. The single most consequential date in the document set is the MFN sunset, June 2027."),
    ]},

    /* ================= CP-4C · Covenant Capacity ================= */
    "CP-4C:Source Gate + Module Status": { ref: "REF_CP-4C · T4C.1", out: "Gate decision", sections: [
      T("Inputs", ["Input", "Status"], [0,0], [
        ["CP-4 covenant feature register", "GREEN"],
        ["D-05 Q1-26 certificate (live ratios)", "GREEN"],
        ["CP-1 covenant EBITDA series (both bases)", "GREEN"],
      ]),
      X("Status", "READY.", ["E-103"]),
    ]},
    "CP-4C:Controlling Capacity Source Map": { ref: "REF_CP-4C · T4C.2", out: "Capacity source map", sections: [
      T("Source map", ["Capacity figure", "Controlling clause", "Cross-checks"], [0,0,0], [
        ["Incremental $612M", "Credit Agt §4.09(b)(14)", "SFA cross-default — not binding"],
        ["RP $240M builder", "Credit Agt §4.07(a)(iii)", "certificate build verified"],
        ["Springing test", "SFA §7.11", "trips > 40% RCF utilization"],
      ]),
    ]},
    "CP-4C:Definition & Ratio Mechanics Register": { ref: "REF_CP-4C · T4C.3", out: "Ratio mechanics", sections: [
      T("Live ratios (Q1-26 certificate)", ["Ratio", "Tested", "Ceiling", "Gap"], [0,1,1,1], [
        ["Consolidated Secured Leverage", "4.68x", "5.25x (incurrence)", "0.57x"],
        ["Total Net Leverage", "5.68x", "no maintenance test", "—"],
        ["Springing 1L test", "untested", "7.10x at >40% util.", "28% headroom"],
      ]),
      X("Note", "The 0.57x secured gap is what prices into $310M of ratio capacity.", ["E-103"]),
    ]},
    "CP-4C:Headroom Table": { ref: "REF_CP-4C · T4C.4", out: "Headroom table", sections: [
      T("Headroom", ["Dimension", "Current", "Constraint", "Headroom"], [0,1,0,1], [
        ["Secured leverage", "4.68x", "5.25x incurrence", "0.57x ≈ $310M"],
        ["RCF utilization", "22%", "40% springing trigger", "28pp"],
        ["RP builder build-rate", "$240M", "50% of CNI accrual", "+$45M/yr"],
      ]),
    ]},
    "CP-4C:Capacity Register": { ref: "REF_CP-4C · T4C.5", out: "Capacity register", sections: [
      T("Day-one debt capacity ($M)", ["Component", "Amount", "Basis"], [0,1,0], [
        ["Freebie basket", "150", "greater of $150M / 35% × $421M"],
        ["Ratio capacity", "310", "to 5.25x secured at 4.68x current"],
        ["Reclassification headroom", "155", "basket migration mechanics"],
        ["Total — pari or senior to 2L TL", "612", ""],
      ]),
      X("Note", "Incurrable senior or pari passu to the 2L TL — the figure consumed by CP-3B's LME overlay and CP-3D's vulnerability work.", ["E-63"]),
    ]},
    "CP-4C:Debt / Lien / Priming Analysis": { ref: "REF_CP-4C · T4C.6", out: "Priming analysis", sections: [
      X("Analysis", "Priming risk MEDIUM-HIGH. The full $612M is incurrable pari or senior to the 2L; inside the MFN window a pari raise must price within 50bps (or ratchet the 2L margin), but after June 2027 it can also price freely. The 2L is the natural priming victim: 1L lenders are protected by lien priority, subs are too small to matter. Watch: any incremental notice during stress (T-2).", ["E-63"]),
    ]},
    "CP-4C:RP / Leakage Analysis": { ref: "REF_CP-4C · T4C.7", out: "RP / leakage analysis", sections: [
      T("RP capacity today ($M)", ["Basket", "Amount", "Status"], [0,1,0], [
        ["Builder (CNI accrual since close)", "240", "pre-positioned, no stated use"],
        ["Starter", "45", "day-one"],
        ["General RP", "25", "day-one"],
        ["Total usable today", "310", "no ratio test required ≤ $240M"],
      ]),
      X("Read", "Enough for a meaningful dividend without amendment — the behavioral signal (pre-positioning) matters as much as the number; fed to CP-2D."),
    ]},
    "CP-4C:Add-Back Inflation Analysis": { ref: "REF_CP-4C · T4C.8", out: "Add-back inflation analysis", sections: [
      T("Add-back composition (LTM, $M)", ["Component", "Amount"], [0,1], [
        ["Cost savings (plant closures, run-rate)", "41.2"],
        ["Transaction / integration costs", "18.7"],
        ["Non-recurring operational items", "9.4"],
        ["Sponsor management fees", "7.3"],
        ["Total — 18.2% of adj. EBITDA", "76.6"],
      ]),
      X("Inflation mechanics", "Add-backs feed every grower basket — capacity inflates mechanically with each 'one-time' charge. CP-1's recurrence finding (charges in 3 of the last 4 years, avg $25.6M) makes the inflation structural, not episodic.", ["E-09", "E-87"]),
    ]},
    "CP-4C:Leakage & Basket Flags": { ref: "REF_CP-4C · T4C.9", out: "Basket flags", sections: [
      F("Flags", [
        { sev: "warning", text: "Builder-basket pre-positioning — capacity built before need; behavioral signal routed to CP-2D." },
        { sev: "warning", text: "Grower-basket linkage to uncapped add-back EBITDA — mechanical inflation; every certificate that adds charges adds capacity." },
      ]),
    ]},
    "CP-4C:Nearest Pressure Point": { ref: "REF_CP-4C", out: "Nearest pressure point", sections: [
      X("MFN sunset — June 2027", "After the sunset, a priming or pari incremental raise carries no yield protection for 2L lenders. Combined with $612M of open capacity and a 50.1% amendment threshold, this is the single most consequential date in the document set. All capacity-related triggers (T-2) reference it.", ["E-64"]),
    ]},
    "CP-4C:Capacity Risk Priority Matrix": { ref: "REF_CP-4C · T4C.11", out: "Priority matrix", sections: [
      T("Priority matrix", ["Rank", "Risk", "Character", "Trigger"], [0,0,0,0], [
        ["1", "MFN sunset (Jun-27)", "time-bound — protection decays on a date", "T-2"],
        ["2", "RP activation", "behavioral — sponsor's tell", "T-4"],
        ["3", "Add-back inflation", "gradual — grows with each certificate", "T-1"],
      ]),
    ]},
    "CP-4C:Gaps Ledger": { ref: "REF_CP-4C · T4C.12", out: "Gaps ledger", sections: [
      X("Ledger", "No gaps. Capacity math reproducible end-to-end from registered clause cites — every figure resolves to an credit agreement or SFA section."),
    ]},
    "CP-4C:Overall Covenant Capacity View": { ref: "REF_CP-4C", out: "Overall capacity view", sections: [
      X("View", "Capacity is the credit's defining legal feature: $612M of day-one debt and $310M of leakage, all real and all priced via sizing and triggers rather than exclusion. Nearest pressure point: MFN sunset June 2027."),
    ]},

    /* ================= CP-5 · QA & Governance ================= */
    "CP-5:Input Module Register": { ref: "REF_CP-5 · T5.1", out: "Input register", sections: [
      T("Audit inputs", ["Field", "Value"], [0,1], [
        ["Module outputs registered", "21"],
        ["Version hashes verified", "21 / 21"],
        ["Stale versions in consumption graph", "0"],
        ["Citations to audit", "1,142"],
      ]),
    ]},
    "CP-5:Citation & Evidence Audit": { ref: "REF_CP-5 · T5.2", out: "Citation audit", sections: [
      T("Audit results", ["Check", "Result"], [0,0], [
        ["Citations resolved against source vault", "1,141 of 1,142"],
        ["Fabricated / orphaned citations", "0"],
        ["Anchor mismatches", "1 — E-44 (HIGH)"],
        ["[Analyst estimate] labels verified", "4 of 4 properly flagged"],
      ]),
      F("Finding", [
        { sev: "critical", text: "QA-117 (HIGH): CP-1C cites CIM Annex C p.388 for the peer margin set; p.388 contains the auditor consent letter. Anchor must be re-mapped to conformed p.391 before clearance.", ev: ["E-44"] },
      ]),
    ]},
    "CP-5:Math / Logic / Definition Audit": { ref: "REF_CP-5 · T5.3", out: "Math audit", sections: [
      X("Result — CLEAN", "Every calc-register figure recomputed independently: 0 math defects and 0 definitional drift instances across 41 KPIs, the recovery grid, the liquidity bridge and all capacity math. The CP-3 rounding inconsistency (QA-122, LOW) was corrected in-run and re-verified."),
    ]},
    "CP-5:Legal / Structural Claim Audit": { ref: "REF_CP-5 · T5.4", out: "Legal claim audit", sections: [
      X("Result — CLEAN", "All legal claims traced to executed-document clauses: the $612M capacity build, MFN mechanics, amendment thresholds and ranking statements verified verbatim against the credit agreement and SFA. No claim rests on a CIM summary."),
    ]},
    "CP-5:RV / Market Claim Audit": { ref: "REF_CP-5 · T5.5", out: "Market claim audit", sections: [
      X("Result — CLEAN", "Market claims verified against LoanX marks and desk runs: +388 DM, 96.40 last mark, and the fair-band regression inputs all reproduce. The dual-band (with / ex-E-44) presentation verified as consistent everywhere quoted.", ["E-71"]),
    ]},
    "CP-5:Consistency & Version Audit": { ref: "REF_CP-5 · T5.6", out: "Consistency audit", sections: [
      X("Result — CLEAN", "Cross-module consistency clean after the QA-122 rounding fix: every module quotes identical figures for EBITDA ($421M adj. / $421.4M covenant), leverage (5.68x), and capacity ($612M). Version graph linear — no module consumed a superseded output."),
    ]},
    "CP-5:Committee-Readiness Audit": { ref: "REF_CP-5 · T5.7", out: "Readiness audit", sections: [
      F("Result", [
        { sev: "warning", text: "Pack HELD. Clearance policy bars committee assembly while any HIGH citation defect is open (QA-117). All non-citation readiness criteria pass: debate complete, sizing decided, triggers armed." },
      ]),
    ]},
    "CP-5:Export & Evidence Trace Audit": { ref: "REF_CP-5 · T5.8", out: "Export audit", sections: [
      X("Result — CLEAN", "All 1,142 citations resolve to registered E-ids; master-index hashes match; appendix structure (HANDOFF_JSON, EVIDENCE_TRACE, QA_VALIDATION, EXPORT_MANIFEST, GAPS) validates against schema."),
    ]},
    "CP-5:Consolidated Issue Log": { ref: "REF_CP-5 · T5.9", out: "Issue log", sections: [
      T("Issue log", ["ID", "Sev", "Module", "Finding", "Status"], [0,0,0,0,0], [
        ["QA-117", "HIGH", "CP-1C", "E-44 anchored to wrong page (CIM Annex C)", "OPEN"],
        ["QA-121", "LOW", "CP-2C", "probability without basis — re-labeled [Analyst estimate]", "RESOLVED"],
        ["QA-122", "LOW", "CP-3", "RV table rounding inconsistent with CP-1C register", "RESOLVED"],
      ]),
    ]},
    "CP-5:Remediation Priority Map": { ref: "REF_CP-5 · T5.10", out: "Remediation map", sections: [
      F("Map", [
        { sev: "critical", text: "R-1 (blocks committee pack): re-anchor E-44 to conformed CIM p.391 → re-run CP-1C metric alignment → refresh CP-3 RV table → refresh CP-6A weighting row 3. Estimated 40 minutes of module time.", ev: ["E-44"] },
      ]),
    ]},
    "CP-5:Clearance Decision": { ref: "REF_CP-5 · T5.11", out: "Clearance decision", sections: [
      X("CONDITIONAL", "One HIGH citation defect open; math, legal, market and consistency audits clean across all 24 modules. CP-RENDER and CP-EXTRACT held until remediation R-1 lands; debate verdict stands ex-E-44; no other gating findings. No override path short of remediation."),
    ]},

    /* ================= CP-5B · Traceability ================= */
    "CP-5B:Source Register & Readiness": { ref: "REF_CP-5B · T5B.1", out: "Gate decision", sections: [
      T("Inputs", ["Input", "Status"], [0,0], [
        ["Committee-pack figure set", "LOADED"],
        ["Master evidence index (CP-0)", "LOADED — v1.0"],
        ["Calc register (CP-1)", "LOADED — 41 KPIs"],
      ]),
    ]},
    "CP-5B:Top-5 Material Credit Drivers": { ref: "REF_CP-5B · T5B.2", out: "Driver selection", sections: [
      T("Drivers (by decision-weight)", ["#", "Driver", "Why material"], [0,0,0], [
        ["1", "EBITDA quality — add-backs 18.2%", "decides real leverage; T-1 keys off it"],
        ["2", "Top-3 OEM concentration 38%", "primary downside transmission"],
        ["3", "$612M day-one incremental capacity", "decides LGD; priming channel"],
        ["4", "FCF conversion 41%", "principal PD mitigant"],
        ["5", "Peer margin citation E-44", "supports the RV entry signal — contested"],
      ]),
    ]},
    "CP-5B:Traceability Map": { ref: "REF_CP-5B · T5B.3", out: "Traceability map", sections: [
      X("Map", "Drawn figure-by-figure: every committee-pack number resolves to (producing module → calc-register entry → source anchor). 100% of pack figures covered; no orphan numbers. The map is the artifact a regulator or IC member would use to challenge any figure."),
    ]},
    "CP-5B:Source Lineage Register": { ref: "REF_CP-5B · T5B.4", out: "Lineage register", sections: [
      T("Lineage (top-5 drivers)", ["#", "Driver", "Chain", "Conf"], [0,0,0,1], [
        ["1", "Add-backs 18.2%", "D-01 p.214 → CP-1 K-09 → CP-4C add-back analysis", "92%"],
        ["2", "OEM concentration 38%", "D-01 p.97 → CP-1A operating model → CP-2B F-2", "95%"],
        ["3", "$612M capacity", "D-03 §4.09 → CP-4 incurrence reg → CP-4C capacity reg", "97%"],
        ["4", "FCF conversion 41%", "D-04 p.31 → CP-1 K-22 → CP-1C benchmark 04B", "88%"],
        ["5", "Peer margin set", "D-01 Annex C → CP-1C alignment → CP-5 QA-117", "41%"],
      ]),
    ]},
    "CP-5B:Calculation & Assumption Register": { ref: "REF_CP-5B · T5B.5", out: "Assumption register", sections: [
      T("[Analyst estimate] labels in pack", ["Assumption", "Where used", "Basis"], [0,0,0], [
        ["Derived Q4-25 quarter", "CP-1 / CP-1B series", "FY25 audited less Q1–Q3 (G-02)"],
        ["Catalyst probabilities (2)", "CP-2C calendar", "analyst judgment — labeled per QA-121"],
        ["Maintenance-capex split (2.9%)", "CP-2 flexibility view", "analyst split — disclosure null"],
      ]),
    ]},
    "CP-5B:Weak-Lineage Flags": { ref: "REF_CP-5B · T5B.6", out: "Weak-lineage flags", sections: [
      F("Flags", [
        { sev: "warning", text: "Driver #5's chain terminates at a mismatched anchor (E-44, conf 41%) — flagged weak until re-anchored; remediation owned by CP-5 R-1. Remaining four drivers trace to grade-A sources within three hops.", ev: ["E-44"] },
      ]),
    ]},
    "CP-5B:Auditability Assessment": { ref: "REF_CP-5B · T5B.7", out: "Auditability assessment", sections: [
      X("STRONG", "Four of five material chains reach grade-A sources within three hops (avg 3.0); every figure in the committee pack resolves to a registered evidence ID and a calc-register reference. Reconstruction time for any material number is under two minutes from the master index."),
    ]},
    "CP-5B:Gaps Ledger": { ref: "REF_CP-5B · T5B.8", out: "Gaps ledger", sections: [
      X("Ledger", "No new gaps. The E-44 weak chain is owned by CP-5 remediation R-1 and not re-logged here."),
    ]},
    "CP-5B:Overall Traceability View": { ref: "REF_CP-5B", out: "Overall traceability view", sections: [
      X("View", "Auditability STRONG — the run's decisions are reconstructible end-to-end. The single weak chain (E-44) is contained: it affects the RV band's width, not the existence of the cheapness signal, and is already on the remediation map."),
    ]},

    /* ================= CP-6A · IC Debate ================= */
    "CP-6A:IC Debate Source Gate": { ref: "REF_CP-6A", out: "Gate decision", sections: [
      T("J1 join — feeder status", ["Feeder", "Status"], [0,0], [
        ["CP-2 credit view · CP-2B pathways", "LANDED"],
        ["CP-3 RV (dual band) · CP-3B preference", "LANDED"],
        ["CP-4 / 4C legal + capacity", "LANDED"],
        ["CP-2F macro", "LANDED — L-04 surfaced to Chair"],
      ]),
    ]},
    "CP-6A:Pre-Debate Thesis Map": { ref: "REF_CP-6A", out: "Thesis map", sections: [
      X("Contested ground (5 claims)", "1) EBITDA quality — are add-backs structural or transitional? 2) Documentation — does $612M capacity + MFN sunset change expected recovery? 3) Aftermarket durability — does the annuity floor EBITDA in stress? 4) RV signal — is +48–63bps real given E-44? 5) Macro — is the unhedged rate exposure a coverage threat? No strawmen: each claim has evidence on both sides registered before argument."),
    ]},
    "CP-6A:Bull Opening Statement": { ref: "REF_CP-6A", out: "Bull opening — 3 claims", sections: [
      T("Bull claims", ["#", "Claim", "Evidence"], [0,0,0], [
        ["1", "Annuity-grade aftermarket: 44% of GP, 92% renewal — floors stress EBITDA", "E-12 · E-31"],
        ["2", "Top-quartile FCF conversion (41%) funds debt service with headroom", "E-22"],
        ["3", "+48–63bps cheap to model at entry — paid to wait", "E-71"],
      ]),
    ]},
    "CP-6A:Bear Cross-Examination": { ref: "REF_CP-6A · T6A.4", out: "Bear cross — 4 attacks", sections: [
      T("Bear attacks", ["#", "Attack", "Evidence"], [0,0,0], [
        ["1", "Add-backs are structural: charges recurred 3 of last 4 years — real leverage is ~6.3x", "E-87 · E-09"],
        ["2", "$612M priming capacity + MFN sunset = recovery erosion when it matters", "E-63 · E-64"],
        ["3", "Sponsor recap record — RP basket pre-positioned at $240M", "E-91"],
        ["4", "The RV signal leans on a broken citation (E-44)", "E-44"],
      ]),
    ]},
    "CP-6A:Bull Defense": { ref: "REF_CP-6A", out: "Bull defense + concession", sections: [
      X("Defense", "Defended (1): recurrence average is $25.6M vs $76.6M presented — a haircut, not a disqualification; the certificate test (T-1) arbitrates within two quarters. Defended (2): capacity needs motive — no maturity wall before 2029, and the springing covenant constrains 1L raises in stress. Defended (3): pre-positioning is watched (T-4), and Fund VI argues for support. CONCEDED (4): the RV claim is restated on the ex-E-44 band (+20–25bps) — concession registered in the resolution matrix, not buried.", ["E-44"]),
    ]},
    "CP-6A:Chair Evidence Weighting": { ref: "REF_CP-6A · T6A.6", out: "Evidence weighting", sections: [
      T("Weighting (bull / bear)", ["Claim", "Bull", "Bear", "Verdict"], [0,1,1,0], [
        ["EBITDA quality", "35", "65", "BEAR — haircut base by $35M"],
        ["Documentation / recovery", "25", "75", "BEAR — price via sizing"],
        ["Aftermarket durability", "80", "20", "BULL — annuity holds"],
        ["RV signal", "50", "50", "SPLIT — pending QA-117"],
        ["Macro / rates", "45", "55", "CAVEATED — L-04 upper bound"],
      ]),
    ]},
    "CP-6A:Debate Resolution Matrix": { ref: "REF_CP-6A · T6A.7", out: "Resolution matrix", sections: [
      T("Resolution", ["Claim", "Resolution", "Carried into"], [0,0,0], [
        ["EBITDA quality", "bear — $35M haircut adopted", "CP-6E sizing base"],
        ["Documentation", "bear — staged sizing + T-2/T-4", "CP-6E constraint"],
        ["Aftermarket", "bull — stress floor confirmed", "CP-2B parameters"],
        ["RV signal", "split — ex-E-44 band governs entry", "CP-6E entry rule"],
        ["Macro", "carried w/ caveat until G-01 resolves", "monitoring"],
      ]),
    ]},
    "CP-6A:Action Bias Determination": { ref: "REF_CP-6A", out: "Action bias", sections: [
      X("CONSTRUCTIVE — add on weakness", "The bear case is real but priced at +388: haircut the base case by $35M of EBITDA, size below max, and let carry plus deleveraging do the work. The bias is conditional — it reverses if T-1 fails at the Q3-26 certificate."),
    ]},
    "CP-6A:Single Greatest Uncertainty": { ref: "REF_CP-6A", out: "Greatest uncertainty", sections: [
      X("Add-back realization", "If the Q3-26 certificate shows under $30M realized, base-case deleveraging fails and the position reverts to a 6.9x credit bought at a 5.7x price — trigger T-1 forces the re-vote. Everything else in the debate is priced; this is the one input that changes the thesis rather than the size.", ["E-103"]),
    ]},
    "CP-6A:IC Chair Final Memo": { ref: "REF_CP-6A", out: "Chair memo", sections: [
      X("Memo", "CONSTRUCTIVE at a price. The franchise is better than the documents, and the spread pays for the difference — for now. Haircut base EBITDA by $35M; treat the credit agreement, not the income statement, as the real risk; let the Q3-26 certificate decide the upgrade to max size. Verdict stands ex-E-44; pack release gated on QA-117 remediation."),
    ]},
    "CP-6A:Gaps Ledger": { ref: "REF_CP-6A · T6A.11", out: "Gaps ledger", sections: [
      X("Ledger", "One debate-level gap: hedging posture unknown (L-04) — flagged as unresolvable until G-01 lands rather than argued past. Macro claims carry upper-bound labeling in the weighting."),
    ]},

    /* ================= CP-6E · Sizing Debate ================= */
    "CP-6E:Portfolio Debate Source Gate": { ref: "REF_CP-6E", out: "Gate decision", sections: [
      T("Inputs", ["Input", "Status"], [0,0], [
        ["CP-6A verdict (CONSTRUCTIVE, $35M haircut)", "LANDED"],
        ["CP-3C fit register + budget flags", "LANDED"],
        ["Live limit utilization (Jun 8 snapshot)", "LANDED — T+1"],
      ]),
    ]},
    "CP-6E:Pre-Debate Portfolio Thesis Map": { ref: "REF_CP-6E", out: "Sizing thesis map", sections: [
      X("The sizing question", "Carry-adjusted return clears the hurdle at any size — the contest is between conviction (max now at +388) and constraints: B3-bucket utilization at 91%, the E-44-dependent entry band, and SXAA correlation overlap. Three contested points, each with a named owner."),
    ]},
    "CP-6E:RV Trader's Pitch": { ref: "REF_CP-6E", out: "Trader pitch", sections: [
      T("Pitch — max size now", ["#", "Argument"], [0,0], [
        ["1", "+388 entry clears hurdle hold-to-maturity with zero tightening assumed"],
        ["2", "two-way depth ($4.2M avg prints) supports the build inside 2 weeks"],
        ["3", "catalyst calendar is front-loaded — being underweight into Jul 28 wastes the entry"],
      ]),
      X("Basis", "Live marks Jun 8: 96.25/96.75 two-way.", ["E-71"]),
    ]},
    "CP-6E:Compliance Officer's Attack": { ref: "REF_CP-6E · T6E.4", out: "Compliance attack", sections: [
      T("Attack — 3 fronts", ["#", "Objection"], [0,0], [
        ["1", "B3-or-below bucket at 91% utilization — max size leaves 0.3% headroom for the whole book"],
        ["2", "entry band leans on open E-44 — sizing off a contested signal"],
        ["3", "SXAA correlation overlap — same OEM exposure class, cluster at 14% of 16%"],
      ]),
    ]},
    "CP-6E:RV Trader's Defense": { ref: "REF_CP-6E", out: "Trader defense", sections: [
      X("Defense + proposal", "Concedes staging; proposes the standing constraint adopted into the decision: 75bps now at +388 or wider, max gated on T-1 plus a same-day bucket re-test, standing limit at +400, and no concurrent SXAA adds. The defense converts each objection into a wired rule rather than a debate point."),
    ]},
    "CP-6E:CIO Evidence Weighting": { ref: "REF_CP-6E · T6E.6", out: "CIO weighting", sections: [
      T("Weighting", ["Contested point", "Ruling basis", "Outcome"], [0,0,0], [
        ["Bucket constraint", "hard limit — compliance upheld", "75bps initial"],
        ["Entry validity", "split — ex-E-44 band governs", "size off +20–25bps cheap"],
        ["Correlation", "managed — rule, not block", "no concurrent SXAA adds"],
      ]),
    ]},
    "CP-6E:Allocation Decision Matrix": { ref: "REF_CP-6E · T6E.7", out: "Decision matrix", sections: [
      T("Matrix", ["Contested point", "RV Trader", "Compliance", "CIO ruling"], [0,0,0,0], [
        ["Size at max immediately (+388 entry)", "carry clears hurdle hold-to-maturity", "B3 bucket 91% utilized", "start 75bps — max requires bucket headroom check"],
        ["RV signal validity", "+48–63bps cheap vs fair band", "band leans on open E-44", "size off ex-E-44 band until QA-117 clears"],
        ["Correlation with auto/industrial cluster", "different end-market mix vs SXAA", "cluster at 14% of 16% limit", "no concurrent adds with SXAA; monitor weekly"],
      ]),
      X("Audit note", "This matrix is the artifact CP-5 audits for decision traceability — every ruling cites its evidence."),
    ]},
    "CP-6E:Final Sizing Posture": { ref: "REF_CP-6E", out: "Sizing posture", sections: [
      T("Posture", ["Parameter", "Value"], [0,0], [
        ["Initial", "75bps at +388 or wider"],
        ["Maximum", "125bps — gated on T-1 + same-day bucket re-test"],
        ["Standing order", "limit at +400bps"],
        ["Posture", "ADD-ON-WEAKNESS"],
      ]),
    ]},
    "CP-6E:Exact Portfolio Constraint": { ref: "REF_CP-6E", out: "Binding constraint", sections: [
      X("B3-or-below bucket", "The binding constraint is the quality bucket at 91% utilization — not issuer, sector, sponsor or correlation limits. Any add must re-test the bucket on trade date; the rule is encoded in the sizing decision and mirrored in CP-3C's add/trim wiring."),
    ]},
    "CP-6E:CIO Final Memo": { ref: "REF_CP-6E", out: "CIO memo", sections: [
      X("Memo", "Approve 75bps initial at +388 or wider; standing limit order at +400bps. Path to 125bps max is gated on the Q3-26 add-back certificate (T-1) and same-day B3-bucket headroom. Trim on RP-basket activation (T-4) or CP-3 re-rank below 4/7. The position is sized so that being wrong costs a quarter's carry, not the year's budget."),
    ]},
    "CP-6E:Gaps Ledger": { ref: "REF_CP-6E · T6E.11", out: "Gaps ledger", sections: [
      X("Ledger", "No sizing-level gaps. Bucket utilization is T+1 stale by construction — re-tested on trade date by rule."),
    ]},
  };

export const STEP_OUTPUTS: Record<string, StepOutput> = { ...O0, ...O1, ...O2, ...O3 };
