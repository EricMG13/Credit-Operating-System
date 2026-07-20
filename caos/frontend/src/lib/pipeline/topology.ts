// Shared CP-X catalog and graph topology. This module is deliberately free of
// seeded runs, reference fixtures, timers, and React hooks so Live mode can
// render the route without evaluating the Reference replay runtime.

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
  { id: "CP-2G", name: "ESG Credit Risk", layer: "L2", desc: "Issuer-specific transition/social transmission · linked-debt mechanics · credit materiality" },
  { id: "CP-3", name: "Relative Value", layer: "L3", desc: "Scorecard · RV table · fundamental value matrix · final ranking" },
  { id: "CP-3B", name: "Instrument Selection", layer: "L3", desc: "Capital structure dashboard · recovery sensitivity · preference decision table" },
  { id: "CP-3C", name: "Portfolio Fit", layer: "L3", desc: "Sizing posture · risk budget flags · concentration & correlation register" },
  { id: "CP-3D", name: "Refinancing & LME", layer: "L3", desc: "Maturity wall · legal capacity for LME · vulnerability score · scenario map" },
  { id: "CP-4", name: "Legal & Covenants", layer: "L4", desc: "Covenant register · EBITDA definitions · leakage · aggressiveness score" },
  { id: "CP-4D", name: "Restricted Group & Guarantees", layer: "L4", desc: "Entity perimeter · guarantee/security map · structural priority · leakage and priming exposure" },
  { id: "CP-4C", name: "Covenant Capacity", layer: "L4", desc: "Headroom table · debt/lien/priming capacity · nearest pressure point" },
  { id: "CP-5", name: "QA Clearance", layer: "L5", desc: "Citation/evidence audit · math & logic audit · consolidated issue log · clearance" },
  { id: "CP-5B", name: "Traceability", layer: "L5", desc: "Decision-relevant drivers · source lineage register · auditability assessment" },
  { id: "CP-6A", name: "IC Debate", layer: "L6", desc: "Bull vs Bear adversarial debate · IC Chair evidence weighting · final memo" },
  { id: "CP-6E", name: "Portfolio Debate", layer: "L6", desc: "RV Trader vs Compliance · CIO weighting · final sizing posture" },
  { id: "CP-RENDER", name: "Render", layer: "INFRA", desc: "Committee-ready document assembly" },
  { id: "CP-EXTRACT", name: "Extract", layer: "INFRA", desc: "Structured export · master index" },
  { id: "CP-DB", name: "Persist", layer: "INFRA", desc: "Canonical state store" },
];

export const EDGES: [string, string][] = [
  ["CP-0", "CP-X"], ["CP-X", "CP-1"], ["CP-X", "CP-1A"],
  ["CP-1", "CP-1B"], ["CP-1", "CP-1C"], ["CP-1", "CP-2"], ["CP-1", "CP-2B"], ["CP-1", "CP-2E"], ["CP-1", "CP-3"], ["CP-1", "CP-3D"], ["CP-1", "CP-4"], ["CP-1", "CP-4C"], ["CP-1", "CP-6A"],
  ["CP-1A", "CP-2"], ["CP-1A", "CP-2D"], ["CP-1B", "CP-2"], ["CP-1B", "CP-2B"], ["CP-1C", "CP-2"], ["CP-1C", "CP-3"], ["CP-1C", "CP-6A"],
  ["CP-2", "CP-2B"], ["CP-2", "CP-2C"], ["CP-2", "CP-2D"], ["CP-2", "CP-2E"], ["CP-2", "CP-2F"], ["CP-2", "CP-3"], ["CP-2", "CP-6A"],
  ["CP-1", "CP-2G"], ["CP-1A", "CP-2G"], ["CP-2", "CP-2G"], ["CP-2G", "CP-6A"],
  ["CP-2B", "CP-3D"], ["CP-2B", "CP-6A"], ["CP-2B", "CP-6E"], ["CP-2C", "CP-6A"], ["CP-2D", "CP-6A"],
  ["CP-2E", "CP-3"], ["CP-2E", "CP-3D"], ["CP-2E", "CP-6A"], ["CP-2F", "CP-6A"],
  ["CP-3", "CP-3B"], ["CP-3", "CP-3C"], ["CP-3", "CP-6A"], ["CP-3", "CP-6E"], ["CP-3B", "CP-6A"], ["CP-3C", "CP-6A"], ["CP-3C", "CP-6E"],
  ["CP-3D", "CP-4"], ["CP-3D", "CP-6A"], ["CP-1", "CP-4D"], ["CP-1A", "CP-4D"], ["CP-4", "CP-4D"], ["CP-4D", "CP-4C"], ["CP-4D", "CP-6A"], ["CP-4", "CP-4C"], ["CP-4", "CP-6A"], ["CP-4C", "CP-6A"], ["CP-4C", "CP-6E"],
  ["CP-5B", "CP-5"], ["CP-6A", "CP-6E"], ["CP-6A", "CP-5B"], ["CP-6A", "CP-RENDER"], ["CP-6A", "CP-EXTRACT"],
  ["CP-6E", "CP-5B"], ["CP-6E", "CP-RENDER"], ["CP-6E", "CP-EXTRACT"], ["CP-EXTRACT", "CP-DB"],
];
