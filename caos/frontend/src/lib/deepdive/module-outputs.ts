// AUTO-PORTED from the Credit OS design bundle (shared/deal-modules.js).
// ATLF demo data — replace with live module outputs when CP backend persistence lands.
/* eslint-disable */

export interface OutFlag { sev: string; text: string; ev?: string[] }
export type OutSection =
  | { type: "table"; title: string; cols: string[]; align?: number[]; rows: string[][] }
  | { type: "text"; title: string; body: string; ev?: string[] }
  | { type: "flags"; title: string; items: OutFlag[] };
export interface ModuleOutput { kpis: { l: string; v: string; sev?: string }[]; sections: OutSection[] }

export const PEER_CREDIT_METRIC_ROWS = [
  ["Atlas Forge (subject)", "B2 / B", "5.7x", "15.0%", "41%", "+388"],
  ["Forgeline Industries", "B2 / B", "5.9x", "13.8%", "31%", "+352"],
  ["Karst Components", "B3 / B−", "6.4x", "12.1%", "27%", "+459"],
  ["Veldt Precision", "B1 / B+", "4.8x", "16.2%", "38%", "+291"],
  ["Ironvale Group", "B2 / B", "5.5x", "14.1%", "33%", "+327"],
  ["Cascadia Metalworks", "B2 / B", "5.2x", "13.2%", "29%", "+341"],
  ["Tarn Engineered Sys", "B3 / CCC+", "7.1x", "11.4%", "22%", "+577"],
];

export const MODULE_OUTPUTS: Record<string, ModuleOutput> = {
    "CP-1": {
      kpis: [
        { l: "Periods normalized", v: "12" }, { l: "KPIs registered", v: "41" },
        { l: "Coverage gate", v: "GREEN", sev: "ok" }, { l: "Definition conflicts", v: "2", sev: "warning" },
      ],
      sections: [
        { type: "table", title: "CP-1-07 · Normalized financials ($M)", cols: ["", "FY23", "FY24", "FY25", "LTM Q1-26"], align: [0,1,1,1,1], rows: [
          ["Revenue", "2,410", "2,588", "2,742", "2,801"],
          ["Adj. EBITDA", "358", "392", "415", "421"],
          ["Adj. EBITDA margin", "14.9%", "15.1%", "15.1%", "15.0%"],
          ["Reported EBITDA (pre add-back)", "318", "329", "341", "344"],
          ["Capex", "(96)", "(108)", "(118)", "(121)"],
          ["Free cash flow", "142", "158", "169", "172"],
          ["Net debt", "2,392", "2,371", "2,380", "2,391"],
          ["Net leverage (adj.)", "6.7x", "6.0x", "5.7x", "5.68x"],
          ["Interest coverage", "1.9x", "2.0x", "2.1x", "2.1x"],
        ]},
        { type: "flags", title: "CP-1-10 · Definition conflict register", items: [
          { sev: "warning", text: "EBITDA definition: SFA caps cost-saving add-backs at 25% (24mo); 2L Credit Agt is uncapped — covenant calcs diverge by $14.2M.", ev: ["E-09", "E-103"] },
          { sev: "warning", text: "Derived Q4-25 period constructed from sponsor model — Q4-25 management accounts not provided (gap G-02).", ev: ["E-58"] },
        ]},
        { type: "text", title: "CP-1-12 · Coverage gate & downstream readiness", body: "All three statements covered FY23–LTM at quarterly grain. Calculation register complete for 41 KPIs; tie-out to audited financials within 0.3% on every line. Downstream readiness: GREEN for all consumers; CP-1B inherits the Q4-25 derived-period caveat." },
      ],
    },
    "CP-1A": {
      kpis: [
        { l: "Control", v: "Kestrel 68.4%" }, { l: "Mgmt rollover", v: "9.2%" },
        { l: "Co-invest", v: "22.4%" }, { l: "Segments", v: "3" },
      ],
      sections: [
        { type: "table", title: "CP-1A-07 · History & transaction timeline", cols: ["Date", "Event", "Consideration", "Multiple"], align: [0,0,1,1], rows: [
          ["Nov 2021", "LBO by Kestrel Capital Fund V", "$2,150M EV", "7.9x"],
          ["Jun 2023", "Bolt-on: Hartwell Precision (aero brackets)", "$210M", "6.4x"],
          ["Mar 2024", "Repricing + $250M incremental TLB", "—", "—"],
          ["May 2026", "2L TL $900M — refinance 2L bridge + GCP", "—", "—"],
        ]},
        { type: "text", title: "CP-1A-06 · Operating model", body: "Engineered metal components for industrial OEMs across 3 segments: Drivetrain (46% rev), Fluid Systems (31%), Aftermarket & Services (23% rev / 44% gross profit). 14 plants (9 US, 4 EU, 1 MX); 71% of COGS is pass-through-indexed steel and alloys with 60–90 day lag. Aftermarket attaches to a 1.9M-unit installed base with 92% contract renewal." },
        { type: "flags", title: "CP-1A-08 · Credit translation", items: [
          { sev: "ok", text: "Installed-base aftermarket annuity is the core credit support — recurring, high-margin, contract-locked.", ev: ["E-12", "E-31"] },
          { sev: "warning", text: "Top-3 OEM relationships (38% of revenue) concentrate volume risk into Drivetrain.", ev: ["E-15"] },
        ]},
      ],
    },
    "CP-1B": {
      kpis: [
        { l: "LTM EBITDA growth", v: "+6.2%", sev: "ok" }, { l: "vs sponsor model", v: "−4.2%", sev: "warning" },
        { l: "Book-to-bill (Q1-26)", v: "1.06x" }, { l: "Corporate actions", v: "2" },
      ],
      sections: [
        { type: "table", title: "CP-1B-06 · KPI dashboard (quarterly)", cols: ["", "Q2-25", "Q3-25", "Q4-25*", "Q1-26"], align: [0,1,1,1,1], rows: [
          ["Revenue ($M)", "688", "701", "697", "715"],
          ["Adj. EBITDA ($M)", "103", "106", "104", "108"],
          ["Margin", "15.0%", "15.1%", "14.9%", "15.1%"],
          ["Orders / book-to-bill", "1.02x", "1.04x", "0.98x", "1.06x"],
          ["Aftermarket mix (rev)", "22.4%", "22.8%", "23.1%", "23.4%"],
        ]},
        { type: "flags", title: "CP-1B-07 · Variance analysis", items: [
          { sev: "warning", text: "Q1-26 EBITDA bridge lands −4.2% below sponsor model — shortfall concentrated in Fluid Systems volume; conflict logged to CP-5.", ev: ["E-58"] },
          { sev: "ok", text: "Pricing actions held: +180bps realized price vs +140bps input inflation in Q1-26." },
        ]},
        { type: "text", title: "CP-1B-13 · Overall earnings view", body: "Earnings trajectory is intact but the sponsor model runs hot. Use CP-1 normalized actuals as the base; treat the model as upside. * Q4-25 is a derived period (gap G-02)." },
      ],
    },
    "CP-1C": {
      kpis: [
        { l: "Peer universe", v: "7 names" }, { l: "Subject vs median DM", v: "+61bps", sev: "ok" },
        { l: "Margin percentile", v: "64th" }, { l: "Outliers excluded", v: "1" },
      ],
      sections: [
        { type: "table", title: "CP-1C-04C · Credit metric benchmark", cols: ["Peer", "Rating", "Net lev", "EBITDA mgn", "FCF conv", "DM"], align: [0,0,1,1,1,1], rows: PEER_CREDIT_METRIC_ROWS},
        { type: "flags", title: "CP-1C-05 · Outlier register & open items", items: [
          { sev: "critical", text: "Citation E-44 (peer margin set, CIM Annex C) — page mismatch under QA-117. Benchmark conclusions carried ex-E-44 until re-verified.", ev: ["E-44"] },
          { sev: "low", text: "Tarn Engineered excluded from median (distressed outlier, +577bps)." },
        ]},
        { type: "text", title: "CP-1C-09 · Overall peer benchmarking view", body: "Subject screens cheap: +61bps wide of the B2 median with top-quartile FCF conversion and above-median margin. Ex-E-44 the gap compresses to +20–25bps — still positive carry vs fundamentals." },
      ],
    },
    "CP-2": {
      kpis: [
        { l: "Overall credit view", v: "B2 / STABLE", sev: "ok" }, { l: "Pricing power", v: "MODERATE" },
        { l: "Material factors", v: "6" }, { l: "Monitoring triggers set", v: "4" },
      ],
      sections: [
        { type: "table", title: "CP-2-11 · Issuer matrix (material factors)", cols: ["Factor", "Assessment", "Trend", "Weight"], align: [0,0,0,1], rows: [
          ["Aftermarket annuity (44% GP)", "STRENGTH — contract-locked, 92% renewal", "stable", "high"],
          ["EBITDA quality / add-backs", "WEAKNESS — 18.2% of adj. EBITDA", "improving", "high"],
          ["OEM concentration (top-3 38%)", "WEAKNESS — Meridian repricing Q2-27", "stable", "high"],
          ["FCF conversion 41%", "STRENGTH — capex-light vs peers", "stable", "med"],
          ["Input cost pass-through (60–90d lag)", "NEUTRAL — margin noise, not erosion", "stable", "med"],
          ["Sponsor financial policy", "WEAKNESS — recap history at Kestrel", "watch", "med"],
        ]},
        { type: "text", title: "CP-2-13 · Overall credit view", body: "A fundamentally sound B2: durable aftermarket economics and genuine FCF offset by aggressive EBITDA presentation and customer concentration. Deleveraging to ~4.9x by FY27 is credible on realized add-backs alone; the binding risks are documentation-enabled releveraging (CP-4C) and the Meridian contract cycle.", ev: ["E-22", "E-09"] },
      ],
    },
    "CP-2B": {
      kpis: [
        { l: "Pathways modeled", v: "3" }, { l: "Fastest transmission", v: "2 quarters", sev: "warning" },
        { l: "Worst EBITDA impact", v: "−18%", sev: "warning" }, { l: "Stress M2E", v: "14.0mo" },
      ],
      sections: [
        { type: "table", title: "CP-2B-05 · Downside pathway register", cols: ["Path", "Trigger", "Transmission", "EBITDA impact", "Prob."], align: [0,0,0,1,1], rows: [
          ["P1", "OEM destocking cycle", "Drivetrain volumes −12% over 2 qtrs; absorption deleverage", "−18%", "25%"],
          ["P2", "Warranty / recall cascade (SXAA read-across)", "Aftermarket margin compression + accrual build over 3 qtrs", "−9%", "35%"],
          ["P3", "Alloy input spike > pass-through lag", "60–90 day margin gap; recovers within 2 qtrs", "−6%", "30%"],
        ]},
        { type: "text", title: "CP-2B-10 · Overall downside view", body: "No pathway breaks liquidity: P1 (worst) still leaves 14 months-to-empty and springing-covenant headroom. The danger is sequencing — P1 arriving while the 12-month MFN sunset is open invites a priming incremental at the bottom of the cycle.", ev: ["E-77", "E-64"] },
      ],
    },
    "CP-2C": {
      kpis: [
        { l: "Catalysts on calendar", v: "9" }, { l: "Next event", v: "Jul 28 · Q2-26" },
        { l: "Refi window", v: "Q3-26", sev: "warning" }, { l: "Watchlist handoffs", v: "3" },
      ],
      sections: [
        { type: "table", title: "CP-2C-03 · Catalyst calendar (next 12 months)", cols: ["Date", "Event", "Prob.", "Impact", "Route"], align: [0,0,1,0,0], rows: [
          ["Jul 28, 2026", "Q2-26 earnings + first add-back realization print", "100%", "HIGH", "CP-1B · CP-6A"],
          ["Sep 2026", "RCF extension / repricing window opens", "70%", "MED", "CP-3D"],
          ["Oct 2026", "Q3-26 compliance certificate (add-back test)", "100%", "HIGH", "CP-1 · T-1"],
          ["Q4 2026", "Kestrel Fund V exit-window commentary", "40%", "MED", "CP-2D"],
          ["Q2 2027", "Meridian-platform contract repricing", "100%", "HIGH", "CP-2B P1"],
        ]},
        { type: "text", title: "CP-2C-09 · Overall catalyst view", body: "Event risk is front-loaded into H2-26 reporting. The Q3-26 certificate is the thesis-defining print — it is wired to trigger T-1 and a CP-6A re-vote if add-back realization lands under $30M." },
      ],
    },
    "CP-2D": {
      kpis: [
        { l: "Sponsor behavior flags", v: "2", sev: "warning" }, { l: "Disclosure quality", v: "B+" },
        { l: "Creditor alignment", v: "MODERATE" }, { l: "Board independence", v: "1 of 7" },
      ],
      sections: [
        { type: "table", title: "CP-2D-04 · Sponsor behavior flags", cols: ["Flag", "Evidence", "Severity"], align: [0,0,0], rows: [
          ["Dividend recap history — 2 prior Kestrel portfolio cos within 24mo of refi", "Fund V portfolio review", "WARNING"],
          ["RP basket pre-positioning — builder already $240M with no stated use", "Credit Agt §4.07 + cert", "WARNING"],
          ["Fund VI close $4.2B — support capacity positive offset", "Jun-26 press / LP letter", "INFO"],
        ]},
        { type: "text", title: "CP-2D-12 · Overall governance view", body: "Kestrel is a competent operator with an extractive financial-policy record. Disclosure cadence is institutional-grade (monthly lender reporting), which partially offsets. Treat any RP-basket activation as a posture-changing event (T-4).", ev: ["E-91"] },
      ],
    },
    "CP-2E": {
      kpis: [
        { l: "Months-to-empty (base)", v: "19.3", sev: "ok" }, { l: "RCF undrawn", v: "78%" },
        { l: "12-mo bridge", v: "+$96M", sev: "ok" }, { l: "Springing test headroom", v: "28%" },
      ],
      sections: [
        { type: "table", title: "CP-2E-05 · 12-month liquidity bridge ($M)", cols: ["", "Amount"], align: [0,1], rows: [
          ["Beginning cash (Apr-26)", "184"],
          ["RCF availability (undrawn, net LCs)", "195"],
          ["FCF before debt service (12mo fwd)", "+178"],
          ["Cash interest", "(196)"],
          ["Mandatory amortization (TLB 1%)", "(18)"],
          ["Bolt-on / earnout commitments", "(24)"],
          ["Working capital & seasonality trough", "(43)"],
          ["Ending liquidity (12mo)", "276"],
        ]},
        { type: "text", title: "CP-2E-10 · Overall liquidity view", body: "Liquidity is a strength: 19.3 months-to-empty under base, 14.0 under the CP-2B P1 stress. No maturity inside 24 months; springing covenant tests only above 40% RCF utilization (currently 22%).", ev: ["E-77"] },
      ],
    },
    "CP-2F": {
      kpis: [
        { l: "Floating-rate share", v: "61%*", sev: "warning" }, { l: "Confirmed hedges", v: "NONE", sev: "warning" },
        { l: "+100bps base rate", v: "−$12.1M FCF" }, { l: "FX mismatch", v: "LOW" },
      ],
      sections: [
        { type: "flags", title: "Propagated limitation", items: [
          { sev: "warning", text: "L-04: hedging register / swap confirms not provided — floating exposure modeled from SFA margins only (*). All figures on this tab carry the limitation downstream to CP-6A." },
        ]},
        { type: "table", title: "CP-2F-02 · Debt rate exposure register", cols: ["Instrument", "Balance ($M)", "Basis", "Modeled hedge"], align: [0,1,0,0], rows: [
          ["RCF (drawn)", "120", "SOFR + 350", "none"],
          ["Term Loan B", "1,850", "SOFR + 375", "unknown — register missing"],
          ["2L TL '31", "900", "S+425 (floating)", "n/a"],
          ["Sub Notes '32", "400", "Fixed 10.00%", "n/a"],
        ]},
        { type: "text", title: "CP-2F-10 · Overall macro view", body: "Rate sensitivity is the dominant macro channel: each +100bps costs ~$12.1M FCF (7% of LTM FCF) if truly unhedged. Commodity exposure is structurally pass-through with a 60–90 day lag. Resolution of gap G-01 (swap confirms) would likely improve this view." },
      ],
    },
    "CP-3": {
      kpis: [
        { l: "Final ranking", v: "2 of 7", sev: "ok" }, { l: "Excess spread", v: "+38bps", sev: "ok" },
        { l: "Scorecard", v: "71 / 100" }, { l: "Fair value band", v: "+325–340" },
      ],
      sections: [
        { type: "table", title: "CP-3-05 · Relative value table", cols: ["Instrument", "DM", "Fair band", "Excess", "Rank"], align: [0,1,1,1,1], rows: [
          ["ATLF 2L TL '31 (subject)", "+388", "+325–340", "+48–63", "2"],
          ["Veldt Precision TLB '30", "+291", "+285–300", "−9–+6", "5"],
          ["Ironvale TLB '29", "+327", "+310–325", "+2–17", "4"],
          ["Forgeline TLB '30", "+352", "+330–345", "+7–22", "3"],
          ["Karst TLB '29", "+459", "+470–495", "−36–−11", "6"],
          ["Cascadia 2L TL '30", "+341", "+280–300", "+41–61", "1*"],
        ]},
        { type: "text", title: "CP-3-08 · Security selection conclusions", body: "Subject ranks 2/7 on the fundamental value matrix; Cascadia ranks above only on an unsecured-recovery adjustment the IC has historically discounted. Conviction is carry + deleveraging, not convergence: hold-to-maturity math clears the hurdle at +388 even with zero spread tightening.", ev: ["E-71", "E-44"] },
      ],
    },
    "CP-3C": {
      kpis: [
        { l: "Sleeve fit", v: "PASS", sev: "ok" }, { l: "Sector post-add", v: "6.1%" },
        { l: "B3-or-below bucket", v: "91%", sev: "warning" }, { l: "Correlation cluster", v: "14%" },
      ],
      sections: [
        { type: "table", title: "CP-3C-05 · Concentration & correlation register", cols: ["Constraint", "Limit", "Post-add", "Headroom", "Status"], align: [0,1,1,1,0], rows: [
          ["Single issuer", "150bps", "75bps", "75bps", "PASS"],
          ["Industrials sector", "8.0%", "6.1%", "1.9%", "PASS"],
          ["B3-or-below bucket", "15.0%", "13.7%", "1.3%", "WATCH — 91% utilized"],
          ["Auto/industrial correlation cluster", "16.0%", "14.0%", "2.0%", "PASS"],
          ["Sponsor (Kestrel) aggregate", "4.0%", "2.2%", "1.8%", "PASS"],
        ]},
        { type: "text", title: "CP-3C-10 · Overall portfolio fit view", body: "Initial 75bps fits all budgets. The binding constraint at max size (125bps) is the B3-or-below bucket — any add requires a same-day bucket headroom check, encoded in the CP-6E sizing constraint." },
      ],
    },
    "CP-3D": {
      kpis: [
        { l: "LME vulnerability", v: "4 / 10", sev: "ok" }, { l: "Nearest maturity", v: "2027 RCF" },
        { l: "Refi need by 2029", v: "$1,970M" }, { l: "Legal LME capacity", v: "OPEN", sev: "warning" },
      ],
      sections: [
        { type: "table", title: "CP-3D-02 · Maturity wall & refinancing register", cols: ["Year", "Instrument", "Amount ($M)", "Path assessment"], align: [0,0,1,0], rows: [
          ["2027", "RCF commitment expiry", "250", "Extend H2-26 — relationship banks, likely +25–50bps"],
          ["2029", "Term Loan B", "1,850", "Refinanceable in current market at ~SOFR+400"],
          ["2031", "2L TL (subject)", "900", "Inside refi horizon post-deleveraging"],
          ["2032", "Sub Notes", "400", "Candidate for discounted repurchase if px < 85"],
        ]},
        { type: "text", title: "CP-3D-12 · Overall refinancing & LME view", body: "Vulnerability 4/10: no near wall, real FCF, open market access. But legal capacity for an uptier exists ($612M incremental + open RP paths) — vulnerability re-rates to 7/10 if P1 stress coincides with the 2029 TLB approach.", ev: ["E-63", "E-64"] },
      ],
    },
    "CP-0": {
      kpis: [
        { l: "Files classified", v: "14" }, { l: "Gaps logged", v: "2", sev: "warning" },
        { l: "Unresolved conflicts", v: "0", sev: "ok" }, { l: "Downstream readiness", v: "0.91", sev: "ok" },
      ],
      sections: [
        { type: "table", title: "CP-0-C/D · Document map & quality assignment", cols: ["Doc", "Name", "Type", "Grade", "Handling"], align: [0,0,0,0,0], rows: [
          ["D-01", "Confidential Info Memo (2L TL '31)", "CIM", "A", "—"],
          ["D-02", "Senior Facilities Agreement", "SFA", "A", "—"],
          ["D-03", "2L Credit Agt (final)", "Credit Agt", "A", "—"],
          ["D-04", "FY23–FY25 Audited Financials", "Audit", "A", "—"],
          ["D-05", "Q1-26 Compliance Certificate", "Covenant", "A", "—"],
          ["D-06", "Lender Presentation", "LP", "B", "MNPI"],
          ["D-07", "Sponsor Model (extract)", "Model", "C", "MNPI"],
        ]},
        { type: "flags", title: "CP-0-F/G · Gap & conflict log", items: [
          { sev: "warning", text: "G-01: hedging register / swap confirms not provided — CP-2F routed in degraded mode (limitation L-04)." },
          { sev: "low", text: "G-02: Q4-25 management accounts missing — CP-1 instructed to construct derived period from sponsor model.", ev: ["E-58"] },
          { sev: "ok", text: "Conflict log: 0 unresolved — CIM vs audit tie-outs within tolerance at intake." },
        ]},
        { type: "text", title: "CP-0-I · Downstream readiness", body: "Readiness 0.91 — all 21 analytical modules routable. Two gaps logged with degraded-mode instructions attached; neither is blocking. Master index updated; intake export assembled for CP-X." },
      ],
    },
    "CP-X": {
      kpis: [
        { l: "Modules in scope", v: "21" }, { l: "Execution waves", v: "8" },
        { l: "Limitations propagated", v: "1", sev: "warning" }, { l: "Ownership collisions", v: "0", sev: "ok" },
      ],
      sections: [
        { type: "table", title: "CP-X-02 · Module execution sequence", cols: ["Wave", "Modules", "Gate condition"], align: [0,0,0], rows: [
          ["W1", "CP-0", "source readiness ≥ 0.85"],
          ["W2", "CP-X", "route plan locked"],
          ["W3", "CP-1 · CP-1A", "CP-0 PASS"],
          ["W4", "CP-1B · CP-1C", "CP-1 coverage gate GREEN"],
          ["W5", "CP-2", "L1 complete"],
          ["W6", "CP-2B–CP-2F · CP-3 · CP-3D", "CP-2 view published"],
          ["W7", "CP-3B · CP-3C · CP-4 · CP-4C", "CP-3 ranking + legal docs gated"],
          ["W8", "CP-6A → CP-6E → CP-5B → CP-5", "J1 join — all upstream complete"],
        ]},
        { type: "flags", title: "CP-X-06 · Limitation propagation register", items: [
          { sev: "warning", text: "L-04 (from G-01): hedging register absent — CP-2F runs on SFA margins only; consumers CP-6A flagged to weight macro claims accordingly." },
          { sev: "low", text: "G-02 instruction: CP-1 derived Q4-25 carries [Analyst estimate] status; CP-1B told to caveat quarterly comparisons.", ev: ["E-58"] },
        ]},
        { type: "text", title: "CP-X-07 · Route plan summary", body: "Full run authorized — status READY WITH LIMITATIONS. 21 modules sequenced across 8 waves with one-owner validation clean; CP-2F degraded mode is the only scope deviation. Route template v2.2, J1 join before governance layer." },
      ],
    },
    "CP-5": {
      kpis: [
        { l: "Modules audited", v: "21" }, { l: "Citation defects", v: "1 HIGH", sev: "warning" },
        { l: "Math / logic defects", v: "0", sev: "ok" }, { l: "Clearance", v: "CONDITIONAL", sev: "warning" },
      ],
      sections: [
        { type: "table", title: "CP-5-09 · Consolidated issue log", cols: ["ID", "Sev", "Module", "Finding", "Status"], align: [0,0,0,0,0], rows: [
          ["QA-117", "HIGH", "CP-1C", "Citation E-44 — peer EBITDA margin set anchored to wrong page (CIM Annex C)", "OPEN"],
          ["QA-121", "LOW", "CP-2C", "Catalyst probability stated without basis — re-labeled [Analyst estimate]", "RESOLVED"],
          ["QA-122", "LOW", "CP-3", "RV table rounding (1dp) inconsistent with CP-1C alignment register", "RESOLVED"],
        ]},
        { type: "flags", title: "CP-5-10 · Remediation priority map", items: [
          { sev: "critical", text: "R-1 (blocks committee pack): re-anchor E-44 to conformed CIM p.391, re-run CP-1C metric alignment, then refresh CP-3 RV table and CP-6A weighting row 3.", ev: ["E-44"] },
        ]},
        { type: "text", title: "CP-5-11 · Clearance decision", body: "CONDITIONAL — one HIGH citation defect open; math, legal, market and consistency audits clean across all 21 modules. CP-RENDER and CP-EXTRACT held until QA-117 remediation lands; no other gating findings." },
      ],
    },
    "CP-5B": {
      kpis: [
        { l: "Drivers traced", v: "5 / 5" }, { l: "Avg lineage hops", v: "3.0" },
        { l: "Auditability", v: "STRONG", sev: "ok" }, { l: "Weak-lineage flags", v: "1", sev: "warning" },
      ],
      sections: [
        { type: "table", title: "CP-5B-04 · Source lineage register (top-5 drivers)", cols: ["#", "Material driver", "Lineage chain", "Conf"], align: [0,0,0,1], rows: [
          ["1", "EBITDA quality — add-backs 18.2%", "D-01 p.214 → CP-1 calc reg K-09 → CP-4C add-back analysis", "92%"],
          ["2", "Top-3 OEM concentration 38%", "D-01 p.97 → CP-1A operating model → CP-2B fragility F-2", "95%"],
          ["3", "$612M day-one incremental capacity", "D-03 §4.09 → CP-4 incurrence reg → CP-4C capacity reg", "97%"],
          ["4", "FCF conversion 41%", "D-04 p.31 → CP-1 KPI K-22 → CP-1C benchmark 04B", "88%"],
          ["5", "Peer margin citation E-44", "D-01 Annex C → CP-1C alignment → CP-5 issue QA-117", "41%"],
        ]},
        { type: "flags", title: "CP-5B-06 · Missing-citation & weak-lineage flags", items: [
          { sev: "warning", text: "Driver #5 lineage terminates at a mismatched anchor — E-44 unresolved under QA-117; treated as weak lineage until re-anchored.", ev: ["E-44"] },
        ]},
        { type: "text", title: "CP-5B-09 · Overall traceability view", body: "Four of five material drivers trace to grade-A sources within three hops; every figure in the committee pack resolves to a registered evidence ID. Auditability STRONG — the single weak chain is already on the CP-5 remediation map." },
      ],
    },
    "CP-6E": {
      kpis: [
        { l: "Initial size", v: "75bps" }, { l: "Max size", v: "125bps" },
        { l: "Posture", v: "ADD-ON-WEAKNESS", sev: "ok" }, { l: "Binding constraint", v: "B3 bucket", sev: "warning" },
      ],
      sections: [
        { type: "table", title: "CP-6E-07 · Allocation decision matrix", cols: ["Contested point", "RV Trader", "Compliance", "CIO ruling"], align: [0,0,0,0], rows: [
          ["Size at max immediately (+388 entry)", "carry clears hurdle hold-to-maturity", "B3-or-below bucket 91% utilized", "start 75bps — max requires bucket headroom check"],
          ["RV signal validity", "+48–63bps cheap vs fair band", "band leans on open E-44", "size off ex-E-44 band (+20–25bps) until QA-117 clears"],
          ["Correlation with auto/industrial cluster", "different end-market mix vs SXAA", "cluster at 14% of 16% limit", "no concurrent adds with SXAA; monitor weekly"],
        ]},
        { type: "text", title: "CP-6E-10 · CIO final memo", body: "Approve 75bps initial at +388 or wider; standing limit order at +400bps. Path to 125bps max is gated on the Q3-26 add-back certificate (trigger T-1) and same-day B3-bucket headroom. Trim on RP-basket activation (T-4) or CP-3 re-rank below 4/7." },
      ],
    },
    "CP-3B": {
      kpis: [
        { l: "Preference", v: "2L TL over TLB", sev: "ok" }, { l: "Recovery @ 6.0x stress", v: "21%" },
        { l: "Comp cross-check", v: "PASS", sev: "ok" }, { l: "Monitoring triggers", v: "3" },
      ],
      sections: [],
    },
    "CP-4": {
      kpis: [
        { l: "Aggressiveness", v: "7.2 / 10", sev: "warning" }, { l: "Covenants registered", v: "41" },
        { l: "J.Crew / Chewy paths", v: "BLOCKED", sev: "ok" }, { l: "Red flags", v: "2", sev: "warning" },
      ],
      sections: [],
    },
    "CP-4C": {
      kpis: [
        { l: "Day-one capacity", v: "$612M", sev: "warning" }, { l: "Springing headroom", v: "28%" },
        { l: "RP builder basket", v: "$240M", sev: "warning" }, { l: "Nearest pressure point", v: "MFN Jun-27" },
      ],
      sections: [],
    },
    "CP-6A": {
      kpis: [
        { l: "IC verdict", v: "CONSTRUCTIVE", sev: "ok" }, { l: "Claims weighted", v: "5" },
        { l: "Action bias", v: "ADD on weakness" }, { l: "Greatest uncertainty", v: "add-back realization", sev: "warning" },
      ],
      sections: [],
    },
  };
