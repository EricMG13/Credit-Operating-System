import { describe, expect, it } from "vitest";
import { buildLiveReports, reportFromVersion } from "./live-builder";

describe("live Report Studio composition", () => {
  it("builds only from the selected live run modules and carries evidence", () => {
    const reports = buildLiveReports({
      issuerId: "issuer-1", runId: "run-1", asOf: "2026-06-30", committeeStatus: "Committee Ready",
      liveStatus: { "CP-1": "Passed" },
      liveOuts: { "CP-1": { kpis: [{ l: "Net leverage", v: "5.2x" }], sections: [{ type: "text", title: "Credit view", body: "Deleveraging continues.", ev: ["E-1"] }] } },
    });
    expect(reports).toHaveLength(1);
    expect(reports[0].id).toBe("live-committee-pack:run-1");
    expect(reports[0].subtitle).toContain("run run-1");
    expect(reports[0].srcs[0]).toEqual({ chip: "CP-1", ev: ["E-1"] });
    expect(JSON.stringify(reports[0])).not.toContain("Atlas Forge");
  });

  it("restores the exact rendered report stored in an immutable version", () => {
    const rendered = buildLiveReports({ issuerId: "issuer-1", runId: "run-1", liveStatus: {}, liveOuts: { "CP-1": { kpis: [], sections: [{ type: "text", title: "View", body: "Frozen" }] } } })[0];
    const report = reportFromVersion({ id: "version-1", run_id: "run-1", created_at: "2026-07-13", payload: { composition: { rendered_report: rendered } } });
    expect(report.id).toBe("version-1");
    expect(report.title).toContain("published");
    expect(report.sections).toEqual(rendered.sections);
  });

  it("appends the exact frozen v2 model and debt schedule without recalculation", () => {
    const rendered = buildLiveReports({ issuerId: "issuer-1", runId: "run-1", liveStatus: {}, liveOuts: { "CP-1": { kpis: [], sections: [] } } })[0];
    const report = reportFromVersion({
      id: "version-v2",
      run_id: "run-1",
      created_at: "2026-07-14",
      payload: {
        composition: { rendered_report: rendered },
        model: {
          engine_version: "2.0.0",
          source_fingerprint: "source-hash",
          input_fingerprint: "input-hash",
          calculation_hash: "calculation-hash",
          draft_revision: 3,
          payload: {
            reporting_currency: "GBP",
            reporting_unit: "millions",
            debt_instruments: [{ instrument_id: "tlb-1", currency: "GBP" }],
            overrides: [
              {
                node_id: "calc:FY2026:adjusted_ebitda", value_type: "number", value: 110,
                reason: "IC EBITDA bridge", scope: "draft", source: "Analyst bridge",
                expires_at: "2026-12-31T00:00:00Z",
              },
              {
                node_id: "input:FY2026:cash", value_type: "number", value: 20,
                reason: "Expired cash check", scope: "draft", source: "Prior review",
                expires_at: "2026-07-13T00:00:00Z",
              },
            ],
          },
          authority: { origin: "imported", model_input_origins: ["imported", "analyst"], analyst_override: true },
          calculation: { status: "partial", gaps: ["FY2026: cash flow inputs required"], warnings: ["Manual debt override"], periods: [{
            period_key: "FY2026", label: "FY26e", revenue: 800,
            adjusted_ebitda: 110, cash_interest: 16.6, total_debt: 190,
            net_debt: 170, gross_leverage: 190 / 110, net_leverage: 170 / 110,
            interest_coverage: 110 / 16.6, free_cash_flow: 66.4,
            nodes: [
              {
                node_id: "calc:FY2026:adjusted_ebitda",
                formula: "reported_ebitda + adjustments", original_value: 110,
              },
              { node_id: "input:FY2026:cash", formula: null, original_value: 20 },
            ],
            instruments: [{
              instrument_id: "tlb-1", opening_balance: 200, closing_balance: 190,
              average_balance: 195, benchmark_interest: 9.75, margin_interest: 5.85,
              coupon_interest: 0, fees: 1, pik_interest: 0, hedge_effect: 0,
              fx_effect: 0, cash_interest: 16.6, debt_reporting_currency: 190,
              rollforward_residual: 0,
            }],
          }] },
        },
      },
    });
    const identity = report.sections.find((section) => (section.title ?? "").includes("FROZEN IDENTITY"));
    const model = report.sections.find((section) => (section.title ?? "").includes("CALCULATION"));
    const debt = report.sections.find((section) => (section.title ?? "").includes("DEBT SCHEDULE"));
    const ledger = report.sections.find((section) => (section.title ?? "").includes("AVAILABILITY LEDGER"));
    const overrides = report.sections.find((section) => (section.title ?? "").includes("OVERRIDE LEDGER"));
    expect(identity).toMatchObject({ t: "profile", rows: expect.arrayContaining([
      ["Calculation hash", "calculation-hash"],
      ["Reporting currency", "GBP"],
      ["Reporting unit", "millions"],
      ["Availability", "PARTIAL"],
      ["Model origin", "IMPORTED"],
      ["Model analyst override", "YES"],
    ]) });
    expect(ledger).toMatchObject({ t: "table", rows: [
      { cells: ["GAP", "FY2026: cash flow inputs required"] },
      { cells: ["WARNING", "Manual debt override"] },
    ] });
    expect(model).toMatchObject({
      t: "table", title: "MODEL ENGINE V2 · CALCULATION · GBP MILLIONS",
      rows: [expect.objectContaining({ cells: expect.arrayContaining(["FY2026", 110, 190]) })],
    });
    expect(debt).toMatchObject({
      t: "table", title: "MODEL ENGINE V2 · DEBT SCHEDULE · MILLIONS · REPORTING CURRENCY GBP",
      cols: expect.arrayContaining(["Currency", "Debt (GBP millions)"]),
      rows: [expect.objectContaining({ cells: expect.arrayContaining(["tlb-1", "GBP", 195, 9.75, 190]) })],
    });
    expect(overrides).toMatchObject({
      t: "table",
      rows: [
        { cells: [
          "ACTIVE AT REPORT EVENT", "calc:FY2026:adjusted_ebitda", 110,
          "IC EBITDA bridge", "draft", "Analyst bridge", "2026-12-31T00:00:00Z",
          "reported_ebitda + adjustments", 110,
        ] },
        { cells: [
          "INACTIVE AT REPORT EVENT", "input:FY2026:cash", 20,
          "Expired cash check", "draft", "Prior review", "2026-07-13T00:00:00Z",
          "No formula (input)", 20,
        ] },
      ],
    });
  });

  it("keeps insufficient-input identity and gaps visible when no model periods exist", () => {
    const report = reportFromVersion({
      id: "version-insufficient",
      run_id: "run-1",
      created_at: "2026-07-14",
      payload: {
        composition: { reviewed_report: {
          id: "live-committee-pack", title: "Live IC Credit Memo", file: "issuer-1-memo",
          subtitle: "issuer-1 · run run-1", icon: "document", srcs: [], sections: [],
        } },
        model: {
          engine_version: "2.0.0", source_fingerprint: "source-hash",
          input_fingerprint: "input-hash", calculation_hash: "insufficient-hash",
          draft_revision: 1,
          payload: { reporting_currency: "GBP", reporting_unit: "millions" },
          authority: { origin: "live", model_input_origins: ["live"], analyst_override: false },
          calculation: {
            status: "insufficient_inputs",
            gaps: ["No forecast periods are available"], warnings: [], periods: [],
          },
        },
      },
    });

    expect(report.sections).toEqual([
      expect.objectContaining({
        t: "profile", title: "MODEL ENGINE V2 · FROZEN IDENTITY",
        rows: expect.arrayContaining([
          ["Calculation hash", "insufficient-hash"],
          ["Reporting currency", "GBP"],
          ["Reporting unit", "millions"],
          ["Availability", "INSUFFICIENT_INPUTS"],
        ]),
      }),
      expect.objectContaining({
        t: "table", title: "MODEL ENGINE V2 · AVAILABILITY LEDGER",
        rows: [{ cells: ["GAP", "No forecast periods are available"] }],
      }),
    ]);
    expect(report.sections.some((section) => (section.title ?? "").includes("CALCULATION"))).toBe(false);
  });
});
