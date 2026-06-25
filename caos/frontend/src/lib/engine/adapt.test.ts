import { describe, expect, it } from "vitest";
import { adaptModule } from "./adapt";
import type { ModuleDetailDTO } from "./types";

// Mirrors the canonical CP-1 payload the backend FixtureSynthesizer emits
// (caos/server/engine/fixtures.py) — the adapter must turn it into the
// {kpis, sections} shape the deep-dive renderer consumes.
const CP1: ModuleDetailDTO = {
  module_id: "CP-1",
  module_name: "CanonicalDataFoundation",
  owned_object: "canonical_financials",
  schema_family: "Nested",
  confidence: "Medium",
  qa_status: "Restricted",
  committee_status: "Restricted",
  validation_status: "Passed",
  limitation_flags: ["Q4-25 is a derived period (G-02)"],
  downstream_consumers: ["CP-2"],
  runtime_output: {
    periods_normalized: 12,
    kpis_registered: 41,
    coverage_gate: "GREEN",
    normalized_financials: {
      revenue: { FY23: 2410, FY24: 2588, FY25: 2742 },
      adj_ebitda: { FY23: 358, FY24: 392, FY25: 415 },
      net_leverage_adj_ltm: 5.68,
    },
    definition_conflicts: [{ id: "DC-1", text: "SFA caps add-backs; indenture uncapped." }],
  },
  claims: [
    {
      claim_id: "C-13",
      claim_text: "EBITDA definition diverges between the SFA and the indenture.",
      evidence: [{
        evidence_id: "E-103", extraction_type: "quoted_text", lineage_class: "Conflicting",
        source_locator: "D-02 vs D-03", confidence: "Medium", document_chunk_id: "chunk-xyz",
      }],
    },
  ],
};

describe("adaptModule", () => {
  it("surfaces net leverage as a KPI for CP-1", () => {
    const out = adaptModule(CP1);
    const leverage = out.kpis.find((k) => k.l.toLowerCase().includes("leverage"));
    expect(leverage?.v).toContain("5.68");
  });

  it("renders the normalized-financials table with all periods", () => {
    const out = adaptModule(CP1);
    const table = out.sections.find((s) => s.type === "table");
    expect(table).toBeTruthy();
    if (table && table.type === "table") {
      expect(table.cols).toEqual(["", "FY23", "FY24", "FY25"]);
      expect(table.rows[0][0]).toBe("Revenue");
    }
  });

  it("turns each claim into a flag carrying its E-xx chips, warning on Conflicting", () => {
    const out = adaptModule(CP1);
    const claims = out.sections.find((s) => s.title.includes("Evidence-traced"));
    expect(claims && claims.type === "flags").toBe(true);
    if (claims && claims.type === "flags") {
      expect(claims.items[0].ev).toEqual(["E-103"]);
      expect(claims.items[0].sev).toBe("warning");
    }
  });

  it("adapts CP-0 document_map into a table and gaps into flags", () => {
    const cp0: ModuleDetailDTO = {
      ...CP1, module_id: "CP-0", module_name: "SourceReadiness", qa_status: "Passed",
      committee_status: "Committee Ready", confidence: "High", claims: [],
      runtime_output: {
        readiness_score: 0.91, files_classified: 14, gaps_logged: 2, unresolved_conflicts: 0,
        document_map: [{ doc: "D-01", name: "Offering Memorandum", type: "OM", grade: "A" }],
        gap_log: [{ id: "G-02", severity: "low", text: "Q4-25 accounts missing" }],
      },
    };
    const out = adaptModule(cp0);
    const table = out.sections.find((s) => s.type === "table");
    expect(table && table.type === "table" && table.rows[0][0]).toBe("D-01");
    expect(out.kpis.find((k) => k.l === "Readiness")?.v).toBe("0.91");
  });

  it("falls back to a QA-status KPI when there is nothing scalar to show", () => {
    const bare: ModuleDetailDTO = {
      ...CP1, module_id: "CP-2", module_name: "X", runtime_output: {}, claims: [],
    };
    const out = adaptModule(bare);
    expect(out.kpis[0].l).toBe("QA status");
    expect(out.kpis[0].v).toBe("Restricted");
  });
});

// The generic adapter renders ANY module the engine persists (not just CP-0/CP-1)
// — exercised with the real CP-2B downside-pathway shape (scalars + an
// object-array of scenarios + a noisy-id object-array).
describe("adaptModule — generic shapes", () => {
  const CP2B: ModuleDetailDTO = {
    ...CP1, module_id: "CP-2B", module_name: "DownsidePathway", qa_status: "Passed", claims: [],
    runtime_output: {
      current_net_leverage: 5.68,
      breach_threshold_x: 7.0,
      fragility: "MODERATE",
      waterfall_basis: "absolute-priority waterfall vs $2105M distressed EV (5x LTM EBITDA)",
      seniority_order: ["SSN", "2L"],
      scenarios: [
        { ebitda_shock_pct: 10, stressed_net_leverage: 6.31, stressed_interest_coverage: 1.89 },
        { ebitda_shock_pct: 20, stressed_net_leverage: 7.1, stressed_interest_coverage: 1.68 },
      ],
      flags: [{ id: "F-1", text: "covenant headroom thins below a 20% shock", severity: "warning" }],
      tranches: [{ code: "SSN", amount_musd: 900, chunk_id: "abc-123" }],
    },
  };

  it("surfaces scalars (incl. short strings) as KPIs, skips long strings", () => {
    const out = adaptModule(CP2B);
    const labels = out.kpis.map((k) => k.l);
    expect(out.kpis.find((k) => k.l.includes("Current net leverage"))?.v).toBe("5.68");
    expect(out.kpis.find((k) => k.l === "Fragility")?.v).toBe("MODERATE");
    expect(labels.some((l) => l.toLowerCase().includes("waterfall"))).toBe(false); // long string → not a KPI
  });

  it("renders an object-array as a table and drops opaque id/chunk columns", () => {
    const out = adaptModule(CP2B);
    const scen = out.sections.find((s) => s.type === "table" && s.title === "Scenarios");
    expect(scen && scen.type === "table" && scen.rows.length).toBe(2);
    const tranches = out.sections.find((s) => s.type === "table" && s.title === "Tranches");
    // chunk_id is filtered out of the columns
    expect(tranches && tranches.type === "table" && tranches.cols.some((c) => /chunk/i.test(c))).toBe(false);
  });

  it("renders a {text, severity} array as flags, a long string as a note, and a scalar array as text", () => {
    const out = adaptModule(CP2B);
    const flags = out.sections.find((s) => s.type === "flags");
    expect(flags && flags.type === "flags" && flags.items[0].text).toContain("F-1");
    expect(flags && flags.type === "flags" && flags.items[0].sev).toBe("warning");
    const basis = out.sections.find((s) => s.type === "text" && s.title.toLowerCase().includes("waterfall"));
    expect(basis && basis.type === "text" && basis.body).toContain("distressed EV");
    const order = out.sections.find((s) => s.type === "text" && s.title === "Seniority order");
    expect(order && order.type === "text" && order.body).toBe("SSN, 2L");
  });

  it("recurses one level into a nested debate object: narrative as a note, points as a table", () => {
    const cp6a: ModuleDetailDTO = {
      ...CP1, module_id: "CP-6A", module_name: "ICDebate", qa_status: "Passed", claims: [],
      runtime_output: {
        participants: { bull: "Bull Advocate", bear: "Bear Advocate", chair: "IC Chair" },
        bull_case: {
          advocate: "Bull Advocate",
          narrative: "Bull Advocate: Adjusted EBITDA grew and refinancing risk is low across the structure.",
          points: [{ point: "EBITDA grew 1.4% YoY", source: "CP-1B", weight: 1 }],
        },
        verdict: { lean: "balanced", score: 0 },
      },
    };
    const out = adaptModule(cp6a);
    const narr = out.sections.find((s) => s.type === "text" && /Bull case · Narrative/i.test(s.title));
    expect(narr && narr.type === "text" && narr.body).toContain("Adjusted EBITDA grew");
    const pts = out.sections.find((s) => s.type === "table" && /Bull case · Points/i.test(s.title));
    expect(pts && pts.type === "table" && pts.rows[0][0]).toContain("EBITDA grew");
  });
});
