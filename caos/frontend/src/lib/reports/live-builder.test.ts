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

  it("adapts table, text, and flag modules with deterministic defaults", () => {
    const reports = buildLiveReports({
      issuerId: "issuer-x",
      runId: "run-x",
      liveStatus: {},
      liveOuts: {
        "CP-2": {
          kpis: [{ l: "Risk", v: "High", sev: "warning" }],
          sections: [
            { type: "table", title: "Auto aligned", cols: ["Label", "Value"], rows: [["A", "1"]] },
            { type: "table", title: "Explicit", cols: ["A"], align: [0], rows: [["B"]] },
            { type: "flags", title: "Flags", items: [
              { sev: "critical", text: "First", ev: ["E-2", "E-2"] },
              { sev: "ok", text: "Second" },
            ] },
          ],
        },
        "CP-1": {
          kpis: [],
          sections: [{ type: "text", title: "Narrative", body: "Desk note" }],
        },
      },
    });

    expect(reports[0].subtitle).toContain("as-of unavailable");
    expect(reports[0].sections[0]).toMatchObject({ rows: expect.arrayContaining([
      ["As of", "Unavailable"], ["Committee status", "Unavailable"],
    ]) });
    expect(reports[0].srcs).toEqual([{ chip: "CP-1", ev: [] }, { chip: "CP-2", ev: ["E-2"] }]);
    expect(reports[0].sections).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "CP-2 · HEADLINE OUTPUTS", sub: "QA Not Reviewed", rows: [{ cells: ["Risk", "High", "WARNING"] }] }),
      expect.objectContaining({ title: "Auto aligned", align: [0, 1] }),
      expect.objectContaining({ title: "Explicit", align: [0] }),
      expect.objectContaining({ title: "Narrative", body: "Desk note" }),
      expect.objectContaining({ title: "Flags", rows: [
        { cells: ["CRITICAL", "First", "E-2, E-2"] },
        { cells: ["OK", "Second", ""] },
      ] }),
    ]));
    expect(buildLiveReports({ issuerId: "x", runId: "", liveStatus: {}, liveOuts: { "CP-1": { kpis: [], sections: [] } } })).toEqual([]);
    expect(buildLiveReports({ issuerId: "x", runId: "run", liveStatus: {}, liveOuts: {} })).toEqual([]);
  });

  it("renders a defensive frozen model without trusting malformed cells", () => {
    const report = reportFromVersion({
      id: "defensive-model",
      run_id: "run-1",
      created_at: "invalid-event-time",
      payload: {
        model: {
          payload: {
            reporting_currency: " ",
            reporting_unit: 42,
            debt_instruments: [null, "bad", {}, { instrument_id: 7, currency: "USD" }, { instrument_id: "tlb", currency: " " }],
            overrides: [
              null,
              "bad",
              { node_id: "node-null", value_type: "null", value: 99, reason: null, scope: Number.NaN, source: " ", expires_at: null },
              { node_id: "node-invalid-date", value: Number.POSITIVE_INFINITY, reason: "Audit", scope: "draft", source: "Analyst", expires_at: "not-a-date" },
              { node_id: "node-empty-expiry", value: 3, reason: "No expiry", scope: "draft", source: "Analyst", expires_at: "" },
              { value: "string value", reason: undefined, scope: undefined, source: undefined, expires_at: 123 },
              { value: "second unnamed", reason: "sort fallback", scope: "draft", source: "analyst" },
            ],
          },
          calculation: {
            periods: [
              null,
              "bad",
              {},
              { instruments: [{}] },
              {
                period_key: "FY27",
                label: undefined,
                revenue: Number.NaN,
                adjusted_ebitda: "110",
                cash_interest: null,
                total_debt: Number.POSITIVE_INFINITY,
                net_debt: 90,
                gross_leverage: undefined,
                net_leverage: 2,
                interest_coverage: false,
                free_cash_flow: 5,
                nodes: [null, "bad", {}, { node_id: 4 }, { node_id: "node-null", formula: "  ", original_value: null }],
                instruments: [
                  null,
                  "bad",
                  {
                    instrument_id: "tlb", opening_balance: "100", closing_balance: null,
                    average_balance: Number.NaN, benchmark_interest: 1, margin_interest: undefined,
                    coupon_interest: false, fees: 0, pik_interest: Number.POSITIVE_INFINITY,
                    hedge_effect: null, fx_effect: "0", cash_interest: 2,
                    debt_reporting_currency: 90, rollforward_residual: Number.NaN,
                  },
                ],
              },
            ],
            gaps: "not-an-array",
            warnings: null,
          },
        },
      },
    });

    const identity = report.sections.find((section) => section.title?.includes("FROZEN IDENTITY"));
    const model = report.sections.find((section) => section.title?.includes("CALCULATION"));
    const debt = report.sections.find((section) => section.title?.includes("DEBT SCHEDULE"));
    const overrides = report.sections.find((section) => section.title?.includes("OVERRIDE LEDGER"));
    expect(identity).toMatchObject({ rows: expect.arrayContaining([
      ["Reporting currency", "Unavailable"], ["Reporting unit", "Unavailable"],
      ["Availability", "UNKNOWN"], ["Model origin", "UNKNOWN"],
      ["Model input origins", "unknown"], ["Model analyst override", "NO"],
    ]) });
    expect(model).toMatchObject({ rows: expect.arrayContaining([
      { cells: ["FY27", "", "", "", "", "", 90, "", 2, "", 5] },
    ]) });
    expect(debt).toMatchObject({ rows: expect.arrayContaining([
      { cells: ["FY27", "tlb", "Unavailable", "", "", "", 1, "", "", 0, "", "", "", 2, 90, ""] },
    ]) });
    expect(overrides).toMatchObject({ rows: expect.arrayContaining([
      { cells: ["ACTIVE AT REPORT EVENT", "node-empty-expiry", 3, "No expiry", "draft", "Analyst", "No expiry", "No formula (input)", "Unavailable"] },
      { cells: ["STATUS UNKNOWN", "node-invalid-date", "Unavailable", "Audit", "draft", "Analyst", "not-a-date", "No formula (input)", "Unavailable"] },
      { cells: ["ACTIVE AT REPORT EVENT", "node-null", "NULL", "NULL", "Unavailable", "Unavailable", "NULL", "No formula (input)", "NULL"] },
    ]) });
  });

  it("caps the frozen override audit ledger and records the omitted count", () => {
    const overrides = Array.from({ length: 501 }, (_, index) => ({
      node_id: `node-${String(index).padStart(3, "0")}`,
      value: index,
      reason: "review",
      scope: "draft",
      source: "analyst",
      expires_at: undefined,
    }));
    const report = reportFromVersion({
      id: "override-cap",
      run_id: "run-1",
      created_at: "2026-07-14T00:00:00Z",
      payload: { model: { payload: { reporting_currency: "usd", reporting_unit: " dollars ", overrides }, calculation: { periods: [] } } },
    });
    const ledger = report.sections.find((section) => section.title?.includes("OVERRIDE LEDGER"));
    expect(ledger).toMatchObject({ t: "table" });
    if (ledger?.t !== "table") throw new Error("override ledger missing");
    expect(ledger.rows).toHaveLength(501);
    expect(ledger.rows.at(-1)?.cells).toContain("1 additional overrides remain in the frozen payload");
  });

  it("uses immutable document fallbacks and skips malformed frozen module rows", () => {
    const report = reportFromVersion({
      id: "fallback-1",
      run_id: "run-1",
      status: "preview",
      created_at: "2026-07-14",
      payload: {
        composition: { rendered_report: { title: "invalid because sections are absent" } },
        document: {
          issuer_id: "issuer-9",
          run_id: "run-9",
          as_of_date: null,
          committee_status: undefined,
          sections: [null, "bad", { module_id: "CP-1", module_name: "Normalization", summary: { status: "frozen" } }, {}],
        },
      },
    });
    expect(report).toMatchObject({
      id: "fallback-1",
      title: "Published IC Credit Memo",
      file: "issuer-9-fallback-1",
      srcs: [],
    });
    expect(report.sections).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "CP-1 · Normalization", body: expect.stringContaining("frozen") }),
      expect.objectContaining({ title: "MODULE · Frozen output", body: "{}" }),
    ]));

    const empty = reportFromVersion({
      id: "fallback-empty",
      run_id: "run-1",
      created_at: "2026-07-14",
      payload: { composition: "invalid", document: "invalid", model: "invalid" },
    });
    expect(empty.file).toBe("issuer-fallback-empty");
    expect(empty.sections[0]).toMatchObject({ rows: expect.arrayContaining([
      ["Issuer", "Unavailable"], ["Run", "Unavailable"],
    ]) });
  });

  it("labels reviewed previews and tolerates non-object calculations", () => {
    const reviewed = buildLiveReports({ issuerId: "issuer-1", runId: "run-1", liveStatus: {}, liveOuts: { "CP-1": { kpis: [], sections: [] } } })[0];
    const preview = reportFromVersion({
      id: "preview-1",
      run_id: "run-1",
      status: "preview",
      created_at: "2026-07-14",
      payload: { composition: { reviewed_report: reviewed, rendered_report: { ...reviewed, title: "ignored" } }, model: { calculation: "invalid" } },
    });
    expect(preview.title).toContain("frozen preview");
    expect(preview.title).not.toContain("ignored");

    const noCalculation = reportFromVersion({
      id: "no-calculation",
      run_id: "run-1",
      created_at: "",
      payload: { document: {}, model: { calculation: null } },
    });
    expect(noCalculation.sections).toHaveLength(1);

    const noPayloadOrPeriods = reportFromVersion({
      id: "no-payload-or-periods",
      run_id: "run-1",
      created_at: "2026-07-14",
      payload: { document: {}, model: { payload: null, calculation: { periods: "invalid" } } },
    });
    expect(noPayloadOrPeriods.sections).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "MODEL ENGINE V2 · FROZEN IDENTITY" }),
    ]));
  });
});
