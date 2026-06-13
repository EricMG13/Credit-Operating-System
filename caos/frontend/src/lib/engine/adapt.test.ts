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
