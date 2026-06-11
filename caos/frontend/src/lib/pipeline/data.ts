// Pipeline Visualizer data — module taxonomy, CP-X route graph, sim plan,
// CP-5B drivers and run-mode templates (port of design bundle shared/data.js
// + shared/deal.js DRIVERS + concept-b.jsx RUN_MODES).
// Derived from Modular OS CP-X ROUTE GRAPH v2.2 (25 nodes, verbatim edges).

export interface ModuleDef {
  id: string;
  name: string;
  layer: string;
  desc: string;
}

export const MODULES: ModuleDef[] = [
  { id: "CP-0", name: "Source Readiness", layer: "L0", desc: "File classification · entity ID · gap & conflict logging · downstream readiness" },
  { id: "CP-X", name: "Execution Router", layer: "ORCH", desc: "Route plan · module readiness register · one-owner validation · limitation propagation" },
  { id: "CP-1", name: "Financial Spreading", layer: "L1", desc: "Normalization · coverage gates · derived periods · KPI calculation register" },
  { id: "CP-1A", name: "Business Profile", layer: "L1", desc: "Transaction summary · ownership register · operating model · credit translation" },
  { id: "CP-1B", name: "Earnings Assessment", layer: "L1", desc: "KPI dashboard · variance analysis · corporate actions · overall earnings view" },
  { id: "CP-1C", name: "Peer Benchmarking", layer: "L1", desc: "Peer universe · metric alignment · comps · implied EV · outlier register" },
  { id: "CP-2", name: "Fundamental Credit", layer: "L2", desc: "Drivers · Porter/PEST/SWOT · financial profile · issuer matrix · overall credit view" },
  { id: "CP-2B", name: "Downside Pathways", layer: "L2", desc: "Fragility map · stress transmission · downside sensitivity matrix" },
  { id: "CP-2C", name: "Catalyst Calendar", layer: "L2", desc: "Event risk register · probability-impact matrix · watchlist handoff" },
  { id: "CP-2D", name: "Sponsor & Governance", layer: "L2", desc: "Sponsor behavior flags · capital allocation risk · creditor alignment" },
  { id: "CP-2E", name: "Liquidity", layer: "L2", desc: "12-month liquidity bridge · months-to-empty · mitigants & constraints" },
  { id: "CP-2F", name: "Macro & Hedging", layer: "L2", desc: "Rate/FX exposure registers · unhedged floating · base-rate sensitivity" },
  { id: "CP-3", name: "Relative Value", layer: "L3", desc: "Scorecard · RV table · fundamental value matrix · final ranking" },
  { id: "CP-3B", name: "Instrument Selection", layer: "L3", desc: "Capital structure dashboard · recovery sensitivity · preference decision table" },
  { id: "CP-3C", name: "Portfolio Fit", layer: "L3", desc: "Sizing posture · risk budget flags · concentration & correlation register" },
  { id: "CP-3D", name: "Refinancing & LME", layer: "L3", desc: "Maturity wall · legal capacity for LME · vulnerability score · scenario map" },
  { id: "CP-4", name: "Legal & Covenants", layer: "L4", desc: "Covenant register · EBITDA definitions · leakage · aggressiveness score" },
  { id: "CP-4C", name: "Covenant Capacity", layer: "L4", desc: "Headroom table · debt/lien/priming capacity · nearest pressure point" },
  { id: "CP-5", name: "QA Clearance", layer: "L5", desc: "Citation/evidence audit · math & logic audit · consolidated issue log · clearance" },
  { id: "CP-5B", name: "Traceability", layer: "L5", desc: "Top-5 material drivers · source lineage register · auditability assessment" },
  { id: "CP-6A", name: "IC Debate", layer: "L6", desc: "Bull vs Bear adversarial debate · IC Chair evidence weighting · final memo" },
  { id: "CP-6E", name: "Portfolio Debate", layer: "L6", desc: "RV Trader vs Compliance · CIO weighting · final sizing posture" },
  { id: "CP-RENDER", name: "Render", layer: "INFRA", desc: "Committee-ready document assembly" },
  { id: "CP-EXTRACT", name: "Extract", layer: "INFRA", desc: "Structured export · master index" },
  { id: "CP-DB", name: "Persist", layer: "INFRA", desc: "Canonical state store" },
];

export const LAYERS = [
  { id: "L0", label: "Readiness" },
  { id: "ORCH", label: "Routing" },
  { id: "L1", label: "Base Build" },
  { id: "L2", label: "Synthesis" },
  { id: "L3", label: "Rel. Value" },
  { id: "L4", label: "Legal" },
  { id: "L5", label: "Governance" },
  { id: "L6", label: "Debate" },
  { id: "INFRA", label: "Export" },
];

// EDGES verbatim from CP-X ROUTE GRAPH v2.2
export const EDGES: [string, string][] = [
  ["CP-0", "CP-X"], ["CP-X", "CP-1"], ["CP-X", "CP-1A"],
  ["CP-1", "CP-1B"], ["CP-1", "CP-1C"], ["CP-1", "CP-2"], ["CP-1", "CP-2B"], ["CP-1", "CP-2E"], ["CP-1", "CP-3"], ["CP-1", "CP-3D"], ["CP-1", "CP-4"], ["CP-1", "CP-4C"], ["CP-1", "CP-6A"],
  ["CP-1A", "CP-2"], ["CP-1A", "CP-2D"], ["CP-1B", "CP-2"], ["CP-1B", "CP-2B"], ["CP-1C", "CP-2"], ["CP-1C", "CP-3"], ["CP-1C", "CP-6A"],
  ["CP-2", "CP-2B"], ["CP-2", "CP-2C"], ["CP-2", "CP-2D"], ["CP-2", "CP-2E"], ["CP-2", "CP-2F"], ["CP-2", "CP-3"], ["CP-2", "CP-6A"],
  ["CP-2B", "CP-3D"], ["CP-2B", "CP-6A"], ["CP-2B", "CP-6E"], ["CP-2C", "CP-6A"], ["CP-2D", "CP-6A"],
  ["CP-2E", "CP-3"], ["CP-2E", "CP-3D"], ["CP-2E", "CP-6A"], ["CP-2F", "CP-6A"],
  ["CP-3", "CP-3B"], ["CP-3", "CP-3C"], ["CP-3", "CP-6A"], ["CP-3", "CP-6E"], ["CP-3B", "CP-6A"], ["CP-3C", "CP-6A"], ["CP-3C", "CP-6E"],
  ["CP-3D", "CP-4"], ["CP-3D", "CP-6A"], ["CP-4", "CP-4C"], ["CP-4", "CP-6A"], ["CP-4C", "CP-6A"], ["CP-4C", "CP-6E"],
  ["CP-5B", "CP-5"], ["CP-6A", "CP-6E"], ["CP-6A", "CP-5B"], ["CP-6A", "CP-RENDER"], ["CP-6A", "CP-EXTRACT"],
  ["CP-6E", "CP-5B"], ["CP-6E", "CP-RENDER"], ["CP-6E", "CP-EXTRACT"],
  ["CP-EXTRACT", "CP-DB"],
];

export type SimOutcome = "pass" | "warning" | "held" | "blocked" | "idle";

export interface PlanStep {
  id: string;
  deps: string[];
  dur: number;
  outcome: SimOutcome;
  event: string;
}

// Simulated run plan: deps drawn from edges; dur in ticks; outcome on completion.
export const SIM_PLAN: PlanStep[] = [
  { id: "CP-0", deps: [], dur: 4, outcome: "pass", event: "CP-0 PASS — 14 files classified · 2 gaps logged (Q4-25 mgmt accounts, hedging register) · readiness 0.91" },
  { id: "CP-X", deps: ["CP-0"], dur: 2, outcome: "pass", event: "CP-X route plan locked — 21 modules in scope · CP-2F limitation propagated (no hedging register)" },
  { id: "CP-1", deps: ["CP-X"], dur: 6, outcome: "pass", event: "CP-1 PASS — 12 periods normalized · 41 KPIs registered · coverage gate GREEN" },
  { id: "CP-1A", deps: ["CP-X"], dur: 5, outcome: "pass", event: "CP-1A PASS — ownership register built · Kestrel Capital 68.4% control" },
  { id: "CP-1B", deps: ["CP-1"], dur: 4, outcome: "warning", event: "CP-1B WARNING — Q1-26 EBITDA bridge variance −4.2% vs sponsor model; conflict logged" },
  { id: "CP-1C", deps: ["CP-1"], dur: 5, outcome: "pass", event: "CP-1C PASS — 7-name peer universe · subject trades +61bps wide of median" },
  { id: "CP-2", deps: ["CP-1", "CP-1A", "CP-1B", "CP-1C"], dur: 6, outcome: "pass", event: "CP-2 PASS — overall credit view: B2/stable · pricing power MODERATE" },
  { id: "CP-2B", deps: ["CP-1", "CP-1B", "CP-2"], dur: 4, outcome: "pass", event: "CP-2B PASS — 3 downside pathways · auto OEM destocking = fastest transmission" },
  { id: "CP-2C", deps: ["CP-2"], dur: 3, outcome: "pass", event: "CP-2C PASS — 9 catalysts on calendar · refi window flagged Q3-26" },
  { id: "CP-2D", deps: ["CP-1A", "CP-2"], dur: 4, outcome: "warning", event: "CP-2D WARNING — sponsor behavior flag: 2 prior dividend recaps at portfolio cos" },
  { id: "CP-2E", deps: ["CP-1", "CP-2"], dur: 4, outcome: "pass", event: "CP-2E PASS — 19.3 months-to-empty under base · RCF 78% undrawn" },
  { id: "CP-2F", deps: ["CP-2"], dur: 3, outcome: "warning", event: "CP-2F WARNING — hedging register missing; floating exposure modeled from SFA only" },
  { id: "CP-3", deps: ["CP-1", "CP-1C", "CP-2", "CP-2E"], dur: 5, outcome: "pass", event: "CP-3 PASS — SSN ranked 2/7 on fundamental value matrix · +38bps excess spread" },
  { id: "CP-3B", deps: ["CP-3"], dur: 4, outcome: "pass", event: "CP-3B PASS — preference: 2L SSN over TLB · recovery delta acceptable at 6.0x stress" },
  { id: "CP-3C", deps: ["CP-3"], dur: 3, outcome: "pass", event: "CP-3C PASS — fits HY sleeve · concentration check OK (sector 6.1% post-add)" },
  { id: "CP-3D", deps: ["CP-1", "CP-2B", "CP-2E"], dur: 4, outcome: "pass", event: "CP-3D PASS — LME vulnerability 4/10 · 2027 wall refinanceable in current market" },
  { id: "CP-4", deps: ["CP-1", "CP-3D"], dur: 6, outcome: "pass", event: "CP-4 PASS — covenant aggressiveness 7.2/10 · J.Crew + Chewy blockers PRESENT, paths blocked" },
  { id: "CP-4C", deps: ["CP-1", "CP-4"], dur: 4, outcome: "warning", event: "CP-4C WARNING — $612M day-one incremental + RP capacity; priming risk MEDIUM-HIGH" },
  { id: "CP-6A", deps: ["CP-1", "CP-1C", "CP-2", "CP-2B", "CP-2C", "CP-2D", "CP-2E", "CP-2F", "CP-3", "CP-3B", "CP-3C", "CP-3D", "CP-4", "CP-4C"], dur: 7, outcome: "pass", event: "CP-6A PASS — IC verdict: CONSTRUCTIVE, bear case priced · greatest uncertainty: add-back realization" },
  { id: "CP-6E", deps: ["CP-2B", "CP-3", "CP-3C", "CP-4C", "CP-6A"], dur: 5, outcome: "pass", event: "CP-6E PASS — CIO sizing: 75bps initial, 125bps max · add-on-weakness posture" },
  { id: "CP-5B", deps: ["CP-6A", "CP-6E"], dur: 4, outcome: "pass", event: "CP-5B PASS — 5/5 material drivers fully traced · auditability STRONG" },
  { id: "CP-5", deps: ["CP-5B"], dur: 5, outcome: "warning", event: "CP-5 CONDITIONAL — 1 HIGH finding open (CP-1C citation E-44 unresolved) · export held" },
  { id: "CP-RENDER", deps: ["CP-5"], dur: 2, outcome: "held", event: "CP-RENDER HELD — awaiting CP-5 remediation of QA-117 before committee pack assembly" },
  { id: "CP-EXTRACT", deps: ["CP-5"], dur: 2, outcome: "held", event: "CP-EXTRACT HELD — structured export gated on clearance" },
  { id: "CP-DB", deps: ["CP-EXTRACT"], dur: 1, outcome: "idle", event: "" },
];

// CP-5B-02 Top-5 material credit drivers with lineage
export interface Driver {
  n: number;
  driver: string;
  lineage: string;
  conf: number;
  status: "verified" | "open";
  evs: string[];
}

export const DRIVERS: Driver[] = [
  { n: 1, driver: "EBITDA quality — add-backs 18.2% of adj. EBITDA", lineage: "D-01 p.214 → CP-1 calc register K-09 → CP-4C add-back analysis", conf: 0.92, status: "verified", evs: ["E-09", "E-87", "E-103"] },
  { n: 2, driver: "Customer concentration — top 3 OEMs = 38% revenue", lineage: "D-01 p.97 → CP-1A operating model → CP-2B fragility map F-2", conf: 0.95, status: "verified", evs: ["E-15", "E-31"] },
  { n: 3, driver: "Incremental debt capacity $612M day-one (priming risk)", lineage: "D-03 §4.09 → CP-4 incurrence register → CP-4C capacity register", conf: 0.97, status: "verified", evs: ["E-63", "E-64"] },
  { n: 4, driver: "FCF conversion 41% — capex-light vs peer median 33%", lineage: "D-04 p.31 → CP-1 KPI K-22 → CP-1C benchmark 04B", conf: 0.88, status: "verified", evs: ["E-22"] },
  { n: 5, driver: "Peer margin citation E-44 — page mismatch in OM Annex C", lineage: "D-01 Annex C → CP-1C metric alignment → CP-5 issue QA-117", conf: 0.41, status: "open", evs: ["E-44"] },
];

export const NODE_QA: Record<string, { id: string; sev: string; text: string }> = {
  "CP-1C": { id: "QA-117", sev: "HIGH", text: "Citation E-44 unresolved — peer EBITDA margin page mismatch (OM Annex C). Blocks CP-5 clearance." },
};

export const NODE_LIMITS: Record<string, string> = {
  "CP-2F": "Limitation L-04 propagated by CP-X: hedging register absent — floating-rate exposure modeled from SFA margins only. Consumers (CP-6A) flagged.",
};

/* ---------- CP-X run modes (route templates) ---------- */

export interface RunMode {
  k: string;
  label: string;
  runId: string;
  title: string;
  sub: string;
  drivers: number[] | null;
  plan: PlanStep[];
  complete: { sev: string; text: string } | null;
  done: { tag: string; text: string };
}

function scopedPlan(scope: string[], overrides: Record<string, Partial<PlanStep>> = {}): PlanStep[] {
  const ids = new Set(scope);
  return SIM_PLAN.filter((m) => ids.has(m.id)).map((m) => ({
    ...m,
    deps: m.deps.filter((d) => ids.has(d)),
    ...(overrides[m.id] || {}),
  }));
}

export const RUN_MODES: RunMode[] = [
  {
    k: "full", label: "COMMITTEE", runId: "RUN #2641", title: "SSN '31 new-issue review", sub: "CP-X route v2.2 · 21 analytical modules · J1 join",
    drivers: null, plan: SIM_PLAN, complete: null,
    done: { tag: "warning", text: "CLEARANCE: CONDITIONAL — QA-117 open · committee pack HELD" },
  },
  {
    k: "earnings", label: "EARNINGS", runId: "RUN #2647", title: "Q1-26 earnings update", sub: "delta route E-1 · 10 modules · registers inherited",
    drivers: [1, 4],
    done: { tag: "ok", text: "UPDATE CLEARED — thesis AFFIRMED · no committee action" },
    complete: { sev: "ok", text: "RUN COMPLETE — earnings update cleared · thesis AFFIRMED · next checkpoint Q3-26 cert" },
    plan: scopedPlan(["CP-0", "CP-X", "CP-1", "CP-1B", "CP-2", "CP-2E", "CP-5B", "CP-5", "CP-EXTRACT", "CP-DB"], {
      "CP-0": { dur: 3, event: "CP-0 PASS — Q1-26 10-Q + compliance certificate ingested · 2 files · readiness 0.98" },
      "CP-X": { event: "CP-X delta route locked — earnings template E-1 · 10 modules in scope · prior registers inherited read-only" },
      "CP-1": { dur: 5, event: "CP-1 PASS — Q1-26 actuals spread · 41 KPIs refreshed · covenant calc ties to cert (5.68x)" },
      "CP-1B": { event: "CP-1B WARNING — EBITDA bridge −4.2% vs sponsor model · cost-out phasing slips one quarter" },
      "CP-2": { dur: 4, event: "CP-2 PASS — credit view AFFIRMED B2/stable · earnings within thesis tolerance" },
      "CP-2E": { event: "CP-2E PASS — months-to-empty 19.3 → 20.1 · RCF 78% undrawn" },
      "CP-5B": { deps: ["CP-1B", "CP-2", "CP-2E"], event: "CP-5B PASS — drivers #1/#4 re-traced to Q1-26 cert (E-103) · lineage current" },
      "CP-5": { outcome: "pass", dur: 3, event: "CP-5 PASS — 0 new findings · QA-117 unaffected (CP-1C not in scope) · update cleared" },
      "CP-EXTRACT": { outcome: "pass", event: "CP-EXTRACT PASS — monitoring registers updated · trigger T-1 armed for Q3-26 cert" },
      "CP-DB": { outcome: "pass", event: "CP-DB — canonical state v2.2.1 committed" },
    }),
  },
  {
    k: "legal", label: "LEGAL", runId: "RUN #2652", title: "Covenant & docs deep-dive", sub: "route L-2 · 9 modules · conformed indenture v2",
    drivers: [3],
    done: { tag: "ok", text: "REGISTER PUBLISHED — covenant memo v2 distributed" },
    complete: { sev: "ok", text: "RUN COMPLETE — covenant register v2 published · aggressiveness 7.2/10 · priming watch ARMED" },
    plan: scopedPlan(["CP-0", "CP-X", "CP-1", "CP-3D", "CP-4", "CP-4C", "CP-5B", "CP-5", "CP-RENDER"], {
      "CP-0": { dur: 3, event: "CP-0 PASS — conformed indenture v2 + SFA amendment classified · controlling-doc check PASS" },
      "CP-X": { event: "CP-X route locked — legal template L-2 · 9 modules in scope · financial registers inherited read-only" },
      "CP-1": { dur: 3, event: "CP-1 PASS — EBITDA definition register synced to §1.01 · covenant calc basis confirmed" },
      "CP-3D": { event: "CP-3D PASS — LME vulnerability re-scored 4/10 → 5/10 · MFN sunset proximity flagged" },
      "CP-4": { dur: 7, event: "CP-4 PASS — 41 covenants registered · J.Crew/Chewy blockers PRESENT · uptier path open at 50.1% vote" },
      "CP-4C": { event: "CP-4C WARNING — $612M day-one capacity re-affirmed · RP builder basket $240M and growing" },
      "CP-5B": { deps: ["CP-3D", "CP-4", "CP-4C"], event: "CP-5B PASS — every covenant cite anchored to conformed indenture · doc lineage 100%" },
      "CP-5": { outcome: "pass", event: "CP-5 PASS — legal register cleared · 0 citation defects · memo released" },
      "CP-RENDER": { outcome: "pass", event: "CP-RENDER PASS — covenant memo v2 assembled · distributed legal + PM" },
    }),
  },
  {
    k: "rv", label: "RV", runId: "RUN #2655", title: "Relative value refresh", sub: "route R-1 · 10 modules · desk marks Jun 9",
    drivers: [4, 5],
    done: { tag: "ok", text: "RV REFRESH PUBLISHED — OVERWEIGHT affirmed" },
    complete: { sev: "ok", text: "RUN COMPLETE — RV refresh published · ATLF holds OVERWEIGHT · next sweep T+1" },
    plan: scopedPlan(["CP-0", "CP-X", "CP-1", "CP-1C", "CP-3", "CP-3B", "CP-3C", "CP-6E", "CP-5", "CP-EXTRACT"], {
      "CP-0": { dur: 2, event: "CP-0 PASS — market snapshot ingested · TRACE prints + desk runs Jun 9 · 7 peer marks refreshed" },
      "CP-X": { event: "CP-X route locked — RV template R-1 · 10 modules in scope · fundamental registers inherited read-only" },
      "CP-1": { dur: 2, event: "CP-1 PASS — KPI register loaded read-only · no re-spread required" },
      "CP-1C": { outcome: "warning", event: "CP-1C WARNING — peer set re-marked · E-44 still open → ex-E-44 band in force (+325–340bps)" },
      "CP-3": { event: "CP-3 PASS — SSN slips 2/7 → 3/7 on value matrix · HELX tightened 9bps" },
      "CP-3B": { event: "CP-3B PASS — preference unchanged: 2L SSN over TLB · recovery delta stable at 6.0x stress" },
      "CP-3C": { event: "CP-3C PASS — sizing headroom 50bps to max · sector concentration 6.1% unchanged" },
      "CP-6E": { event: "CP-6E PASS — CIO posture re-affirmed: add-on-weakness · standing order at +400bps" },
      "CP-5": { outcome: "pass", deps: ["CP-6E"], dur: 3, event: "CP-5 PASS — marks tie to TRACE within 0.1pt · spot-check audit clean" },
      "CP-EXTRACT": { outcome: "pass", event: "CP-EXTRACT PASS — RV table pushed to portfolio dashboard" },
    }),
  },
];

/* ---------- graph traversal ---------- */
export function ancestorsOf(id: string): Set<string> {
  const up = new Set<string>();
  const walk = (n: string) => EDGES.forEach(([a, b]) => { if (b === n && !up.has(a)) { up.add(a); walk(a); } });
  walk(id);
  return up;
}

export function descendantsOf(id: string): Set<string> {
  const down = new Set<string>();
  const walk = (n: string) => EDGES.forEach(([a, b]) => { if (a === n && !down.has(b)) { down.add(b); walk(b); } });
  walk(id);
  return down;
}
