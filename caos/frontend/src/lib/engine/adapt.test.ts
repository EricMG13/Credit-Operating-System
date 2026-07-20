import { describe, expect, it } from "vitest";
import { adaptModule, humanize } from "./adapt";
import type { ModuleDetailDTO } from "./types";

describe("humanize — engine keys → analyst labels", () => {
  it("uppercases finance acronyms instead of title-casing them", () => {
    expect(humanize("ebitda_growth_pct")).toBe("EBITDA growth %");
    expect(humanize("fcf_conversion")).toBe("FCF conversion");
    expect(humanize("ev_multiple")).toBe("EV multiple");
  });
  it("re-glues a quarter to its year instead of leaving the raw key", () => {
    expect(humanize("ltm_q1_26")).toBe("LTM Q1-26");
    expect(humanize("q3_25_actual")).toBe("Q3-25 actual");
  });
  it("keeps the existing musd/pct/first-letter handling", () => {
    expect(humanize("net_debt_musd")).toBe("Net debt $M");
    expect(humanize("revenue")).toBe("Revenue");
  });
});

describe("adaptModule — empty live figures", () => {
  it("never renders a dangling unit suffix on a missing leverage figure", () => {
    const thin = {
      module_id: "CP-1", module_name: "CanonicalDataFoundation",
      owned_object: "canonical_financials", schema_family: "Nested",
      confidence: "Low", qa_status: "Restricted", committee_status: "Restricted",
      validation_status: "Passed", limitation_flags: [], downstream_consumers: [],
      runtime_output: { financials: {} },
    } as unknown as ModuleDetailDTO;
    const out = adaptModule(thin);
    const lev = out.kpis.find((k) => /leverage/i.test(k.l));
    // A "—" leverage figure is filtered out of the header entirely — never
    // rendered as "—" (blank placeholder) and never "—x" (dangling suffix).
    expect(lev).toBeUndefined();
    expect(out.kpis.some((k) => k.v === "—")).toBe(false);
  });
});

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

// ── mock↔live seam guard ─────────────────────────────────────────────────────
// The CP1 fixture above mirrors the DEMO payload (fixtures.py), which pre-counts
// periods_normalized / kpis_registered / coverage_gate. A LIVE LLM-synth or EDGAR
// CP-1 carries normalized_financials but NOT those pre-counted summary keys, and a
// LIVE CP-0 carries gap_log but not gaps_logged. Adapting only the demo shape hid a
// seam where every live issuer's header rendered those KPIs as "—". These pin the
// LIVE shape: the derivable counts must resolve from the emitted lists, not "—".
const base = {
  module_name: "X", owned_object: "x", schema_family: "Nested",
  confidence: "Medium", qa_status: "Passed", committee_status: "Committee Ready",
  validation_status: "Passed", limitation_flags: [], downstream_consumers: [], claims: [],
};

describe("adaptModule — LIVE-shaped payloads (mock↔live seam)", () => {
  it("CP-1: derives 'Periods normalized' from live normalized_financials, not '—'", () => {
    const live = { ...base, module_id: "CP-1", runtime_output: {
      basis: "reported_gaap_xbrl",
      normalized_financials: {
        revenue: { FY22: 2400, FY23: 2588, FY24: 2742 },  // 3 periods, no periods_normalized key
        adj_ebitda: { FY22: 350, FY23: 392, FY24: 415 },
        net_leverage_adj_ltm: 5.76,
      },
    } } as unknown as ModuleDetailDTO;
    const periods = adaptModule(live).kpis.find((k) => /periods normalized/i.test(k.l));
    expect(periods?.v).toBe("3");  // derived from the 3 revenue periods, not "—"
  });

  it("CP-0: derives 'Gaps logged' from live gap_log, not '—'", () => {
    const live = { ...base, module_id: "CP-0", runtime_output: {
      readiness_score: 82, files_classified: 5,
      gap_log: [{ id: "G-01", text: "x" }, { id: "G-02", text: "y" }],  // 2 gaps, no gaps_logged key
      document_map: [{ doc: "D-01", name: "10-K", type: "Filing", grade: "A" }],
    } } as unknown as ModuleDetailDTO;
    const gaps = adaptModule(live).kpis.find((k) => /gaps logged/i.test(k.l));
    expect(gaps?.v).toBe("2");  // derived from the 2 gap_log entries, not "—"
  });

  it("CP-1: shows live interest coverage and drops demo-only KPIs that have no live source", () => {
    const live = { ...base, module_id: "CP-1", runtime_output: {
      basis: "reported_gaap_xbrl",
      normalized_financials: {
        revenue: { FY22: 2400, FY23: 2588, FY24: 2742 },
        adj_ebitda: { FY22: 350, FY23: 392, FY24: 415 },
        net_leverage_adj_ltm: 5.76,
        interest_coverage_ltm: 2.4,        // live-emitted (edgar_cp1.py / synth.py)
        // no coverage_gate / kpis_registered (demo-fixture-only summary keys)
      },
    } } as unknown as ModuleDetailDTO;
    const kpis = adaptModule(live).kpis;
    expect(kpis.find((k) => /interest coverage/i.test(k.l))?.v).toBe("2.4x");
    expect(kpis.some((k) => k.v === "—")).toBe(false);                          // no blank placeholders
    expect(kpis.some((k) => /coverage gate|kpis registered/i.test(k.l))).toBe(false);
  });

  it("CP-1: labels a non-US reported-disclosure issuer in its own currency, not '$M'", () => {
    // reported_cp1.py carries the £/€/$ symbol in runtime_output.currency; a £ issuer
    // (VMO2 etc.) must NOT render its figures under a hardcoded "$M".
    const live = { ...base, module_id: "CP-1", runtime_output: {
      basis: "reported_disclosure", currency: "£",
      normalized_financials: { revenue: { H1: 2742 }, adj_ebitda: { H1: 415 }, net_leverage_adj_ltm: 4.38 },
    } } as unknown as ModuleDetailDTO;
    const table = adaptModule(live).sections.find((s) => s.type === "table");
    expect(table?.title).toContain("£M");
    expect(table?.title).not.toContain("$M");
  });

  it("CP-1: defaults to $M when no currency is supplied (EDGAR / demo)", () => {
    const live = { ...base, module_id: "CP-1", runtime_output: {
      basis: "reported_gaap_xbrl",
      normalized_financials: { revenue: { FY24: 2742 }, adj_ebitda: { FY24: 415 }, net_leverage_adj_ltm: 5.76 },
    } } as unknown as ModuleDetailDTO;
    const table = adaptModule(live).sections.find((s) => s.type === "table");
    expect(table?.title).toContain("$M");
  });
});

describe("adaptModule — CP-5B live driver register", () => {
  it("keeps the disclosed selection basis and evidence chips on each persisted driver", () => {
    const live = { ...base, module_id: "CP-5B", runtime_output: {
      claims_traced: 17,
      weak_lineage_flags: 1,
      orphan_claims: 0,
      auditability: "QUALIFIED",
      selection_basis: "Decision-proximity plus module diversity; not a market-materiality score.",
      driver_register: [{
        rank: 1,
        driver: "Incremental capacity is open.",
        module_id: "CP-4C",
        claim_id: "C-4C",
        lineage: "Credit Agreement §4.09 → CP-4C · C-4C",
        confidence: 0.75,
        status: "open",
        evidence_ids: ["E-4C"],
        qa_findings: ["QA-CAP"],
      }],
    } } as unknown as ModuleDetailDTO;

    const out = adaptModule(live);
    expect(out.kpis.find((k) => k.l === "Decision drivers")?.v).toBe("1");
    expect(out.sections.find((s) => s.title.includes("Selection basis"))).toMatchObject({
      type: "text",
      body: expect.stringContaining("not a market-materiality score"),
    });
    const register = out.sections.find((s) => s.title.includes("Decision-relevant driver lineage"));
    expect(register?.type).toBe("flags");
    if (register?.type === "flags") {
      expect(register.items[0]).toMatchObject({ sev: "warning", ev: ["E-4C"] });
      expect(register.items[0].text).toContain("QA QA-CAP");
    }
  });

  it("discloses an empty persisted register and degrades malformed driver fields honestly", () => {
    const empty = adaptModule({
      ...base, module_id: "CP-5B", runtime_output: { driver_register: [] },
    } as unknown as ModuleDetailDTO);
    expect(empty.sections.find((section) => section.title.includes("Driver register state"))).toMatchObject({
      type: "text",
      body: expect.stringContaining("No persisted analytical claims"),
    });

    const malformed = adaptModule({
      ...base, module_id: "CP-5B", runtime_output: { driver_register: [{}] },
    } as unknown as ModuleDetailDTO);
    const register = malformed.sections.find((section) => section.title.includes("Decision-relevant driver lineage"));
    expect(register?.type).toBe("flags");
    if (register?.type === "flags") {
      expect(register.items[0]).toMatchObject({ sev: "ok", ev: undefined });
      expect(register.items[0].text).toContain("Unnamed driver");
      expect(register.items[0].text).toContain("confidence unavailable");
      expect(register.items[0].text).not.toContain(" · QA ");
    }
  });
});

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

  it("maps low and clean claim lineage and every QA fallback severity", () => {
    const claims = [
      { claim_id: "C-low", claim_text: "Source is insufficient.", evidence: [{ evidence_id: "E-low", extraction_type: "text", lineage_class: "Insufficient Information", source_locator: null, confidence: "Low", document_chunk_id: null }] },
      { claim_id: "C-ok", claim_text: "Source is direct.", evidence: [{ evidence_id: "E-ok", extraction_type: "text", lineage_class: "Direct", source_locator: null, confidence: "High", document_chunk_id: null }] },
    ];
    const withClaims = adaptModule({
      ...CP1, module_id: "CP-2", runtime_output: { score: 1 }, claims,
    });
    const section = withClaims.sections.find((candidate) => candidate.title.includes("Evidence-traced"));
    expect(section?.type === "flags" ? section.items.map((item) => item.sev) : []).toEqual(["low", "ok"]);

    const fallback = (qa_status: string) => adaptModule({
      ...CP1, module_id: "CP-2", runtime_output: {}, claims: [], qa_status,
    }).kpis[0];
    expect(fallback("Blocked").sev).toBe("critical");
    expect(fallback("Passed").sev).toBe("ok");
    expect(fallback("Not Reviewed").sev).toBeUndefined();
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

  it("infers alignment only from finite numeric schema values, never digit-bearing identifiers, dates, or ratings", () => {
    const detail = {
      ...CP1, module_id: "CP-2E", module_name: "RelativeValue", qa_status: "Passed", claims: [],
      runtime_output: {
        live_register: [
          { cusip: "123456789", as_of_date: "2026-07-17", rating: "B2", module_code: "CP-2E", amount_musd: 125, spread_bps: 450 },
          { cusip: "987654321", as_of_date: "2026-07-18", rating: "B3", module_code: "CP-2E", amount_musd: 150, spread_bps: 475 },
        ],
      },
    } as unknown as ModuleDetailDTO;
    const table = adaptModule(detail).sections.find((section) => section.type === "table" && section.title === "Live register");
    expect(table).toMatchObject({
      type: "table",
      cols: ["Cusip", "As of date", "Rating", "Module code", "Amount $M", "Spread bps"],
      align: [0, 0, 0, 0, 1, 1],
    });
  });

  it("retains exact overflow rows and flags rather than silently slicing persisted adverse data", () => {
    const detail = {
      ...CP1, module_id: "CP-2E", module_name: "RelativeValue", qa_status: "Restricted", claims: [],
      runtime_output: {
        live_register: Array.from({ length: 14 }, (_, index) => ({ measure: index + 1, rating: "B2" })),
        live_flags: Array.from({ length: 14 }, (_, index) => ({ id: `F-${index + 1}`, text: `Flag ${index + 1}`, severity: "warning" })),
      },
    } as unknown as ModuleDetailDTO;
    const out = adaptModule(detail);
    const table = out.sections.find((section) => section.type === "table" && section.title === "Live register") as (typeof out.sections[number] & { overflowRows?: string[][] }) | undefined;
    const flags = out.sections.find((section) => section.type === "flags" && section.title === "Live flags") as (typeof out.sections[number] & { overflowItems?: unknown[] }) | undefined;
    expect(table?.type === "table" ? table.rows : []).toHaveLength(12);
    expect(table?.overflowRows).toHaveLength(2);
    expect(flags?.type === "flags" ? flags.items : []).toHaveLength(12);
    expect(flags?.overflowItems).toHaveLength(2);
  });
});

describe("adaptModule — CP-4C covenant register", () => {
  const cp4c = (rt: Record<string, unknown>): ModuleDetailDTO => ({
    ...CP1, module_id: "CP-4C", module_name: "CovenantCapacityCalculator",
    qa_status: "Passed", claims: [], runtime_output: rt,
  });

  it("orders the register KPIs and flags an add-back breach in text and severity", () => {
    const out = adaptModule(cp4c({
      covenant_structure: "cov-lite",
      current_net_leverage: 5.68,
      rp_basket_musd: 150,
      cross_default_musd: 50,
      addback_cap_pct: 0.25,
      addback_audit: { disclosed_addback_pct: 0.28, cap_pct: 0.25, utilization_pct: 112, breach: true },
      calculations: [],
    }));
    expect(out.kpis.map((k) => k.l)).toEqual([
      "Structure", "Net leverage", "RP / builder basket", "Cross-default trips at", "Add-back cap",
    ]);
    const cap = out.kpis.find((k) => k.l === "Add-back cap")!;
    expect(cap.v).toContain("25% of EBITDA");
    expect(cap.v).toContain("112% used");
    expect(cap.v).toContain("BREACH");   // breach is text, not color alone
    expect(cap.sev).toBe("critical");
    expect(out.kpis.find((k) => k.l === "RP / builder basket")!.v).toBe("$150M");
    expect(out.kpis.find((k) => k.l === "Cross-default trips at")!.v).toBe("$50M");
  });

  it("drops absent terms instead of rendering dashes (cov-lite sparse extraction)", () => {
    const out = adaptModule(cp4c({ covenant_structure: "cov-lite", calculations: [] }));
    expect(out.kpis.map((k) => k.l)).toEqual(["Structure"]);
    expect(out.kpis[0].sev).toBeUndefined();
  });

  it("warns (not critical) at high utilization below the cap", () => {
    const out = adaptModule(cp4c({
      covenant_structure: "maintenance",
      addback_cap_pct: 0.25,
      addback_audit: { utilization_pct: 88, breach: false },
      calculations: [],
    }));
    const cap = out.kpis.find((k) => k.l === "Add-back cap")!;
    expect(cap.sev).toBe("warning");
    expect(cap.v).not.toContain("BREACH");
  });
});

describe("adaptModule — CP-4D / CP-2G closed registers", () => {
  it("renders the complete CP-4D structural register without the generic 12-row truncation", () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({
      finding_id: `F-${i + 1}`, claim_or_tranche: `Tranche ${i + 1}`,
      priority_label: "Insufficient Information", evidence_ids: [`chunk-${i + 1}`],
    }));
    const detail = {
      ...CP1, module_id: "CP-4D", module_name: "RestrictedGroupGuaranteeMap",
      owned_object: "structural_priority_map", qa_status: "Restricted", claims: [],
      runtime_output: {
        module_status: "Completed with Limitations", status_basis: "Security schedule incomplete.",
        source_gate_register: [{ source: "Credit agreement", status: "Partial" }],
        structural_priority: rows, gaps: [{ gap_id: "GAP-1", missing_item: "Security schedule" }],
        overall_structural_view: "Insufficient Information pending the security schedule.",
      },
    } as unknown as ModuleDetailDTO;
    const out = adaptModule(detail);
    const table = out.sections.find((s) => s.type === "table" && /Structural priority/.test(s.title));
    expect(table && table.type === "table" ? table.rows : []).toHaveLength(15);
    expect(out.kpis.find((k) => k.l === "Module status")?.v).toBe("Completed with Limitations");
  });

  it("renders a Blocked CP-2G as blocked with its explicit gap, never a clean empty view", () => {
    const detail = {
      ...CP1, module_id: "CP-2G", module_name: "ESGSustainabilityCreditRisk",
      owned_object: "esg_credit_risk", qa_status: "Blocked", claims: [],
      runtime_output: {
        module_status: "Blocked", status_basis: "No issuer-specific source was retrieved.",
        source_register: [], gaps: [{ gap_id: "GAP-1", missing_item: "ESG disclosure" }],
        overall_credit_view: "Insufficient Information — no finding generated.",
      },
    } as unknown as ModuleDetailDTO;
    const out = adaptModule(detail);
    expect(out.kpis.find((k) => k.l === "Module status")?.sev).toBe("critical");
    expect(out.sections.some((s) => s.type === "table" && /Gaps/.test(s.title))).toBe(true);
  });

  it("marks an ordinary completed specialized register as clean", () => {
    const detail = {
      ...CP1, module_id: "CP-2G", module_name: "ESGSustainabilityCreditRisk", claims: [],
      runtime_output: { module_status: "Completed", source_register: [] },
    } as unknown as ModuleDetailDTO;
    expect(adaptModule(detail).kpis.find((kpi) => kpi.l === "Module status")?.sev).toBe("ok");
  });
});
