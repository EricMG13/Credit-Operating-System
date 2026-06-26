import { describe, expect, it } from "vitest";
import { cp1ToAnchor } from "./modelAnchor";
import type { ModuleDetailDTO } from "./types";

// Mirrors the canonical CP-1 payload the backend FixtureSynthesizer emits
// (caos/server/engine/fixtures.py), including the LTM_Q1_26 anchor figures.
const CP1: ModuleDetailDTO = {
  module_id: "CP-1",
  module_name: "CanonicalDataFoundation",
  owned_object: "canonical_financials",
  schema_family: "Nested",
  confidence: "Medium",
  qa_status: "Restricted",
  committee_status: "Restricted",
  validation_status: "Passed",
  limitation_flags: [],
  downstream_consumers: ["CP-2"],
  runtime_output: {
    normalized_financials: {
      revenue: { FY23: 2410, FY24: 2588, FY25: 2742, LTM_Q1_26: 2801 },
      adj_ebitda: { FY23: 358, FY24: 392, FY25: 415, LTM_Q1_26: 421 },
      net_debt_ltm: 2391,
      net_leverage_adj_ltm: 5.68,
      interest_coverage_ltm: 2.1,
    },
  },
  claims: [],
};

describe("cp1ToAnchor", () => {
  it("extracts the LTM anchor from a live CP-1 payload", () => {
    const a = cp1ToAnchor(CP1);
    expect(a).toEqual({
      ltmRevenue: 2801,
      ltmAdjEbitda: 421,
      netDebt: 2391,
      netLeverage: 5.68,
      intCov: 2.1,
    });
  });

  it("returns null for a non-CP-1 module", () => {
    expect(cp1ToAnchor({ ...CP1, module_id: "CP-0" })).toBeNull();
  });

  it("returns null when normalized_financials is absent (→ seeded fallback)", () => {
    expect(cp1ToAnchor({ ...CP1, runtime_output: {} })).toBeNull();
  });

  it("returns null when a required anchor figure is missing", () => {
    const partial: ModuleDetailDTO = {
      ...CP1,
      runtime_output: {
        normalized_financials: {
          revenue: { LTM_Q1_26: 2801 },
          adj_ebitda: { LTM_Q1_26: 421 },
          // net_debt_ltm and net_leverage_adj_ltm missing
        },
      },
    };
    expect(cp1ToAnchor(partial)).toBeNull();
  });

  it("tolerates a missing interest coverage (intCov → null, still live)", () => {
    const noCov: ModuleDetailDTO = {
      ...CP1,
      runtime_output: {
        normalized_financials: {
          revenue: { LTM_Q1_26: 2801 },
          adj_ebitda: { LTM_Q1_26: 421 },
          net_debt_ltm: 2391,
          net_leverage_adj_ltm: 5.68,
        },
      },
    };
    expect(cp1ToAnchor(noCov)?.intCov).toBeNull();
  });

  // #30: the anchor must work for non-ATLF period shapes, not just the fixture's
  // hardcoded LTM_Q1_26 key. EDGAR emits FY-only; reported emits Reported/ANNUALISED.
  it("anchors EDGAR FY-only shapes to the latest fiscal year", () => {
    const edgar: ModuleDetailDTO = {
      ...CP1,
      runtime_output: {
        normalized_financials: {
          revenue: { FY2023: 2410, FY2024: 2588, FY2025: 2742 },
          adj_ebitda: { FY2023: 358, FY2024: 392, FY2025: 415 },
          net_debt_ltm: 2391,
          net_leverage_adj_ltm: 5.68,
        },
      },
    };
    const a = cp1ToAnchor(edgar);
    expect(a?.ltmRevenue).toBe(2742); // FY2025, not FY2023
    expect(a?.ltmAdjEbitda).toBe(415);
  });

  it("anchors reported-disclosure single-period shapes", () => {
    const reported: ModuleDetailDTO = {
      ...CP1,
      runtime_output: {
        normalized_financials: {
          revenue: { Reported: 1200 },
          adj_ebitda: { ANNUALISED: 300 },
          net_debt_ltm: 900,
          net_leverage_adj_ltm: 3.0,
        },
      },
    };
    const a = cp1ToAnchor(reported);
    expect(a?.ltmRevenue).toBe(1200);
    expect(a?.ltmAdjEbitda).toBe(300);
  });
});
