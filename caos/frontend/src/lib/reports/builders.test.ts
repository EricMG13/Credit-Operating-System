import { describe, expect, it } from "vitest";
import { buildReferenceReport, buildReports, type Report, type Section } from "./builders";
import { ROWS } from "@/components/model/rows";

function reportById(id: string): Report {
  const report = buildReports().find((candidate) => candidate.id === id);
  if (!report) throw new Error("Missing report " + id);
  return report;
}

function flattenSections(sections: Section[]): Section[] {
  return sections.flatMap((section) => section.t === "cols"
    ? [section, ...section.items.flatMap((column) => flattenSections(column))]
    : [section]);
}

function tableIn(report: Report, title: string): Extract<Section, { t: "table" }> {
  const section = flattenSections(report.sections).find((candidate) => candidate.t === "table" && candidate.title === title);
  if (!section || section.t !== "table") throw new Error("Missing table " + title);
  return section;
}

function chartIn(report: Report, title: string): Extract<Section, { t: "chart" }> {
  const section = flattenSections(report.sections).find((candidate) => candidate.t === "chart" && candidate.title === title);
  if (!section || section.t !== "chart") throw new Error("Missing chart " + title);
  return section;
}

describe("committee deliverable inventory", () => {
  it("preserves the six stable ids and appends three decision-specific papers", () => {
    expect(buildReports().map((report) => report.id)).toEqual([
      "snapshot", "earnings", "memo", "scenario", "covenant", "trade", "monitor", "evidence", "model",
    ]);
  });

  it("returns the exact canonical report for every deliverable id", () => {
    const reports = buildReports();
    for (const report of reports) {
      expect(JSON.stringify(buildReferenceReport(report.id))).toBe(JSON.stringify(report));
    }
  });

  it("falls back to the canonical Credit Snapshot for an unknown or absent id", () => {
    const snapshot = buildReports()[0];
    expect(JSON.stringify(buildReferenceReport(undefined))).toBe(JSON.stringify(snapshot));
    expect(JSON.stringify(buildReferenceReport("unknown"))).toBe(JSON.stringify(snapshot));
  });
});

describe("credit snapshot two-page contract", () => {
  const snapshot = reportById("snapshot");

  it("restores the original snapshot first and retains the decision view second", () => {
    expect(snapshot.sections[0]).toMatchObject({ t: "cols", page: "Page 1: Original Snapshot" });
    const titles = flattenSections(snapshot.sections).map((section) => section.title);
    expect(titles).toContain("COMPANY PROFILE");
    expect(titles).toContain("TRANSACTION SUMMARY AND NEW DEBT ISSUES");
    expect(titles).toContain("CAPITAL STRUCTURE");
    expect(titles).toContain("FINANCIALS");
    expect(titles).toContain("INVESTMENT THESIS");
    expect(titles).toContain("DECISION AT A GLANCE");
    expect(titles).toContain("NEXT DECISION POINTS");
    expect(titles).not.toContain("FULL MODEL");
    expect(new Set(snapshot.sections.map((section) => section.page))).toEqual(new Set([
      "Page 1: Original Snapshot", "Page 2: Decision View",
    ]));
    expect(snapshot.sections.find((section) => section.title === "DECISION AT A GLANCE"))
      .toMatchObject({ page: "Page 2: Decision View" });
  });

  it("retains the canonical debt claims needed for the 2L decision", () => {
    const facts = flattenSections(snapshot.sections).find(
      (section): section is Extract<Section, { t: "profile" }> => section.t === "profile" && section.title === "LATEST CREDIT FACTS",
    );
    expect(facts?.rows).toContainEqual(["Debt senior to 2L / 2L claim", "$1,970M / $900M"]);
  });

  it("explains the issuer operating model rather than only listing its products", () => {
    const description = flattenSections(snapshot.sections).find(
      (section): section is Extract<Section, { t: "text" }> => section.t === "text" && section.title === "BUSINESS DESCRIPTION",
    );
    expect(description?.body).toContain("Operating model:");
    expect(description?.body).toContain("original-equipment programs create the installed base");
    expect(description?.body).toContain("working-capital release and aftermarket mix");
  });

  it("applies the supplied recommendation guidance to Snapshot only", () => {
    const recommendation = flattenSections(snapshot.sections).find(
      (section): section is Extract<Section, { t: "profile" }> => section.t === "profile" && section.title === "RECOMMENDATION",
    );
    expect(recommendation?.rows).toContainEqual(["COAS Recommendation", "OVERWEIGHT — 75bps initial → 125bps max (CP-6E)"]);
    expect(recommendation?.rows).toContainEqual(["CLO", "3 — MW"]);
    expect(recommendation?.rows).toContainEqual(["Indexed Loans", "3 — MW"]);
    expect(recommendation?.rows).toContainEqual(["Index HY", "2 — Modest OW"]);
    expect(recommendation?.rows.some(([label]) => label === "Indexed Lev Loan")).toBe(false);

    const methodology = tableIn(snapshot, "RECOMMENDATION METHODOLOGY — FUNDAMENTALS + VALUATION");
    expect(methodology.cols).toEqual(["Scale", "1", "2", "3", "4", "5"]);
    expect(methodology.rows.map((row) => row.cells)).toEqual([
      ["Credit score (fundamentals)", "Strong", "Good", "Fair", "Weak", "Stressed"],
      ["Valuation", "Very attractive", "Attractive", "Fair", "Unattractive", "Very unattractive"],
      ["Recommendation", "Strong OW", "Modest OW", "MW", "Modest UW", "Strong UW"],
    ]);
    expect(methodology.note).toContain("no mechanical combination formula is implied");

    const memoSections = flattenSections(reportById("memo").sections);
    expect(memoSections.some((section) => section.title === methodology.title)).toBe(false);
    const memoRecommendation = memoSections.find(
      (section): section is Extract<Section, { t: "profile" }> => section.t === "profile" && section.title === "RECOMMENDATION",
    );
    expect(memoRecommendation?.rows).toContainEqual(["Recommendation", "OVERWEIGHT — 75bps initial → 125bps max (CP-6E)"]);
  });

  it("separates analyst authorship from the generated COAS thesis", () => {
    const investmentIndex = snapshot.sections.findIndex(
      (section) => section.t === "text" && section.fieldId === "issuer-investment-thesis",
    );
    const summaryColumnsIndex = snapshot.sections.findIndex(
      (section) => section.t === "cols" && flattenSections([section]).some((nested) => nested.title === "CREDIT SUMMARY"),
    );
    const summaryColumns = snapshot.sections[summaryColumnsIndex];
    expect(summaryColumns?.t).toBe("cols");
    if (!summaryColumns || summaryColumns.t !== "cols") throw new Error("Missing Snapshot summary columns");
    const coasIndex = summaryColumns.items[0].findIndex(
      (section) => section.t === "text" && section.title === "COAS THESIS",
    );
    const creditSummaryIndex = summaryColumns.items[0].findIndex(
      (section) => section.t === "list" && section.title === "CREDIT SUMMARY",
    );
    const investmentThesis = snapshot.sections[investmentIndex];
    expect(investmentThesis).toMatchObject({
      t: "text",
      title: "INVESTMENT THESIS",
      body: "",
      placeholder: "Write your investment thesis…",
      label: "Catalysts and near-term events",
    });
    expect(summaryColumnsIndex).toBeGreaterThan(investmentIndex);
    expect(coasIndex).toBe(creditSummaryIndex - 1);
    expect(summaryColumns.items[0][coasIndex]).toMatchObject({
      t: "text",
      title: "COAS THESIS",
      body: expect.stringContaining("Carry plus deleveraging, not convergence"),
    });
  });
});

describe("earnings update analytical contract", () => {
  const earnings = reportById("earnings");

  it("separates quarterly operating data from rolling-LTM credit metrics", () => {
    const operating = tableIn(earnings, "OPERATING PRINT — QUARTER AND LTM");
    expect(operating.cols).toEqual(["Metric", "Q1-26", "QoQ", "YoY", "LTM Mar-26", "LTM YoY"]);
    expect(operating.rows.map((row) => row.cells[0])).toEqual([
      "Revenue ($M)", "Gross profit ($M)", "Gross margin", "Adj. EBITDA ($M)", "EBITDA margin", "FCF ($M)", "FCF margin",
    ]);
    expect(operating.rows.find((row) => row.cells[0] === "Gross margin")?.cells).toContain("+10bps");

    const credit = tableIn(earnings, "CREDIT METRICS — ROLLING-LTM BASIS ONLY");
    expect(credit.rows.map((row) => row.cells[0])).toEqual([
      "Senior leverage", "Total leverage", "Net leverage", "Interest coverage",
    ]);
    expect(credit.note).toContain("No quarterly leverage basis");
  });

  it("shows eight quarters plus LTM and does not synthesize unavailable leverage", () => {
    const dashboard = tableIn(earnings, "KPI DASHBOARD — EIGHT QUARTERS + LTM");
    expect(dashboard.cols).toEqual(["Metric", "Jun-24", "Sep-24", "Dec-24", "Mar-25", "Jun-25", "Sep-25", "Dec-25*", "Mar-26", "LTM Mar-26"]);
    expect(dashboard.rows).toHaveLength(11);
    const netLeverage = dashboard.rows.find((row) => row.cells[0] === "Net leverage")!;
    expect(netLeverage.cells.slice(1, 3)).toEqual(["—", "—"]);
    expect(netLeverage.cells.at(-1)).toBe("5.68x");
  });

  it("uses an LTM analyst comparison rather than a quarterly saved base", () => {
    const variance = tableIn(earnings, "VARIANCE VS SAVED ANALYST MODEL — LTM BASIS");
    expect(variance.cols.slice(1, 3)).toEqual(["Saved analyst LTM · Mar-26", "Actual LTM · Mar-26"]);
    expect(variance.note).toContain("not a single-quarter estimate");
    expect(variance.rows.map((row) => row.cells[0])).toContain("Interest coverage");
  });

  it("uses separate visible-value views for margins, leverage, and coverage", () => {
    const margins = chartIn(earnings, "MARGIN TRAJECTORY — EIGHT QUARTERS");
    expect(margins.showValueLabels).toBe(true);
    expect(margins.equivalentTable).toBe("period-columns");
    expect(margins.spec.data).toHaveLength(24);

    const leverage = chartIn(earnings, "LEVERAGE — ROLLING LTM");
    expect(leverage.showValueLabels).toBe(true);
    expect(leverage.equivalentTable).toBe("period-columns");
    expect(leverage.spec.data).toHaveLength(18);
    expect(leverage.note).toContain("not synthesized");

    const coverage = chartIn(earnings, "INTEREST COVERAGE — ROLLING LTM");
    expect(coverage.spec.data).toHaveLength(6);
    expect(coverage.spec.data.every(
      (datum: unknown) => (datum as { metric?: string }).metric === "Interest coverage",
    )).toBe(true);
  });
});

describe("IC memo consolidated hierarchy", () => {
  const memo = reportById("memo");

  it("puts the decision first and consolidates the decision-relevant Deep-Dive", () => {
    expect(memo.sections[0]).toMatchObject({ t: "profile", title: "DECISION REQUEST", page: "Page 1: Decision" });
    const sections = flattenSections(memo.sections);
    const titles = sections.map((section) => section.title);
    expect(titles).toContain("CHAIR RATIONALE");
    expect(titles).toContain("COMPANY PROFILE");
    expect(titles).toContain("BUSINESS DESCRIPTION");
    expect(titles).toContain("EARNINGS ASSESSMENT");
    expect(titles).toContain("BULL CASE — EVIDENCED");
    expect(titles).toContain("BEAR CASE — EVIDENCED");
    expect(titles).toContain("CONTESTED CLAIMS — CHAIR RESOLUTION");
    expect(titles).toContain("CAPITAL STRUCTURE");
    expect(titles).toContain("RECOVERY ALLOCATION");
    expect(titles).toContain("KEY PROVISIONS");
    expect(titles).toContain("APPROVAL CONDITIONS");
    expect(titles).not.toContain("FULL MODEL");
    expect(new Set(memo.sections.map((section) => section.page))).toEqual(new Set([
      "Page 1: Decision",
      "Page 2: Business & Earnings",
      "Page 3: Risk & Challenge",
      "Page 4: Capital & Documentation",
      "Page 5: Compact Model",
      "Page 6: Committee Controls",
    ]));
  });

  it("uses a short model with historical FY, latest LTM, base and downside cases", () => {
    const compact = tableIn(memo, "COMPACT IC MODEL — HISTORICAL, LATEST LTM, BASE AND DOWNSIDE");
    expect(compact.cols).toEqual([
      "Line", "FY22A", "FY23A", "FY24A", "FY25A", "LTM Mar-26A",
      "FY26e Base", "FY27e Base", "FY28e Base", "FY26e Down", "FY27e Down", "FY28e Down",
    ]);
    expect(compact.columnGroups?.map((group) => group.key)).toEqual(["HIST", "LTM", "BASE", "DOWN"]);
    expect(compact.rows.map((row) => row.cells[0])).toEqual([
      "Revenue", "Gross profit", "Gross margin", "Reported EBITDA", "Add-backs", "Adjusted EBITDA",
      "EBITDA margin", "Cash interest", "Free cash flow", "FCF margin", "Cash", "Total debt", "Net debt",
      "Senior leverage", "Total leverage", "Net leverage", "Interest coverage",
    ]);
    expect(compact.note).toContain("Full calculations, quarterly detail and override history remain in Model Appendix");
  });
});

describe("covenant, monitoring, and new decision papers", () => {
  it("uses visuals only for capacity composition and recovery erosion", () => {
    const covenant = reportById("covenant");
    expect(chartIn(covenant, "DAY-ONE CAPACITY COMPONENTS").spec.data).toHaveLength(3);
    expect(chartIn(covenant, "2L RECOVERY — CAPACITY EROSION").spec.data).toEqual([
      { state: "Before use", recovery: 21 },
      { state: "After use", recovery: 8 },
    ]);
    expect(tableIn(covenant, "CAPACITY BUILD ($M)").rows.at(-1)?.cells[1]).toBe("612");
  });

  it("makes monitoring exceptions-first and explicitly non-live", () => {
    const monitor = reportById("monitor");
    expect(monitor.title).toBe("Monitoring Exceptions — Reference");
    expect(monitor.subtitle).toContain("not a live feed");
    expect(tableIn(monitor, "EXCEPTIONS REQUIRING ACTION").rows).toHaveLength(2);
    expect(monitor.srcs.flatMap((source) => source.ev).length).toBeGreaterThan(0);
    expect(flattenSections(monitor.sections).map((section) => section.title)).not.toContain("ADD / TRIM DISCIPLINE");
  });

  it("adds a scenario pack with model paths and sequential recovery", () => {
    const scenario = reportById("scenario");
    expect(tableIn(scenario, "BASE AND DOWNSIDE PATH").rows).toHaveLength(6);
    const recovery = tableIn(scenario, "RECOVERY ALLOCATION");
    expect(recovery.rows.find((row) => row.cells[0] === "Base distress")?.cells[3]).toBe("21%");
    expect(chartIn(scenario, "NET LEVERAGE PATH — BASE VS DOWNSIDE").spec.data).toHaveLength(6);
  });

  it("adds bounded trade and evidence controls without implying execution or certification", () => {
    const trade = reportById("trade");
    expect(tableIn(trade, "PRE-TRADE GATES").rows.some((row) => row.cells[0] === "Adverse information")).toBe(true);
    expect(flattenSections(trade.sections).some(
      (section) => section.t === "profile" && section.rows.some((row) => row[0] === "Authority boundary"),
    )).toBe(true);

    const evidence = reportById("evidence");
    expect(evidence.watermark).toContain("NOT A QA CERTIFICATE");
    expect(tableIn(evidence, "SOURCE DOCUMENT REGISTER").rows).toHaveLength(7);
    expect(tableIn(evidence, "OPEN QA AND DATA LIMITATIONS").rows.map((row) => row.cells[0])).toContain("Claim-level coverage");
  });
});

describe("model appendix", () => {
  const appendix = reportById("model");
  const table = tableIn(appendix, "FULL MODEL");

  it("adds a control cover while preserving the complete raw model", () => {
    expect(appendix.sections[0]).toMatchObject({ t: "profile", title: "MODEL CONTROL COVER" });
    expect(appendix.sections[1]).toMatchObject({ t: "list", title: "KNOWN REVIEW LIMITATIONS" });
    expect(appendix.sections).toHaveLength(3);
    expect(table.rows).toHaveLength(ROWS.length);
    expect(table.rows.some((row) => row.cells[0] === "MODEL STATUS")).toBe(false);
    expect(table.cols).toContain("YTD Mar-25");
    expect(table.cols).toContain("LTM Mar-26");
    expect(table.cols).toContain("PF Jun-26");
    for (const label of ["Gross Profit", "EBIT", "FFO", "CFO"]) {
      expect(table.rows.find((row) => row.cells[0] === label)?.line).toBe(1);
    }
    for (const label of ["Interest Coverage", "SG&A % of Sales", "DSO", "Tax Rate"]) {
      const row = table.rows.find((candidate) => candidate.cells[0] === label);
      expect(row?.line).toBe(1);
      expect(row?.gap).toBe(1);
    }
    expect(table.rows.some((row) => row.cellColors?.includes("#2f64b7"))).toBe(true);
    expect(table.rows.some((row) => row.cellColors?.includes("var(--caos-critical)"))).toBe(true);
    expect(table.columnGroups?.map((group) => group.key)).toEqual(["Q", "YTD", "HIST", "LTM", "PF", "BASE", "DOWN"]);
    expect(table.columnGroups?.map((group) => group.label)).toEqual(["Quarterly", "YTD", "Historic", "LTM", "Pro forma", "Base", "Downside"]);
    expect(table.columnGroups?.every((group) => group.start > 0)).toBe(true);
  });
});
