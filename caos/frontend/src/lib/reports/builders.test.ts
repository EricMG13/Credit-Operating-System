import { describe, expect, it } from "vitest";
import { buildReferenceReport, buildReports } from "./builders";
import { ROWS } from "@/components/model/rows";

// review run-2 #F2/#F1: the Credit Snapshot capital-structure table must tie to the
// canonical CP-3B structure (total debt 3,270), and each subtotal's Multiple must be
// its own outstanding / EBITDA — not total leverage copied onto the sub-layer row.
describe("creditSnapshot capital structure", () => {
  const snapshot = buildReports().find((r) => r.id === "snapshot")!;
  const capTable = snapshot.sections.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: any) => s.t === "table" && s.title === "CAPITAL STRUCTURE",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rowFor = (label: string) => capTable.rows.find((r: any) => r.cells?.[0] === label);

  it("ties total debt to the canonical 3,270, not the ad-hoc seed (2,575)", () => {
    const total = rowFor("Total debt");
    expect(Number(total.cells[6].replace(/,/g, ""))).toBe(3270); // 120 + 1850 + 900 + 400
  });

  it("subordinated subtotal shows its OWN multiple, strictly below total leverage", () => {
    const sub = rowFor("Unsecured / subordinated");
    const total = rowFor("Total debt");
    const mult = (c: string) => Number(c.replace("x", ""));
    expect(mult(sub.cells[7])).toBeLessThan(mult(total.cells[7]));
    expect(sub.cells[7]).not.toBe(total.cells[7]);
  });
});

describe("reference report dispatch", () => {
  it("returns the exact canonical report for every deliverable id", () => {
    const reports = buildReports();
    for (const report of reports) {
      expect(JSON.stringify(buildReferenceReport(report.id))).toBe(JSON.stringify(report));
    }
  });

  it("falls back to the snapshot for an unknown or absent id", () => {
    const snapshot = buildReports()[0];
    expect(JSON.stringify(buildReferenceReport(undefined))).toBe(JSON.stringify(snapshot));
    expect(JSON.stringify(buildReferenceReport("unknown"))).toBe(JSON.stringify(snapshot));
  });
});

describe("model appendix", () => {
  const appendix = buildReports().find((r) => r.id === "model")!;
  const table = appendix.sections[0];

  it("renders the full model as the only appendix section", () => {
    expect(appendix.sections).toHaveLength(1);
    if (table.t !== "table") throw new Error("model appendix must render as a table");
    expect(table.rows).toHaveLength(ROWS.length);
    expect(table.rows.some((r) => r.cells[0] === "MODEL STATUS")).toBe(false);
    expect(table.cols).toContain("YTD Mar-25");
    expect(table.cols).toContain("LTM Mar-26");
    expect(table.cols).toContain("PF Jun-26");
    for (const label of ["Gross Profit", "EBIT", "FFO", "CFO"]) {
      expect(table.rows.find((r) => r.cells[0] === label)?.line).toBe(1);
    }
    for (const label of ["Interest Coverage", "SG&A % of Sales", "DSO", "Tax Rate"]) {
      const row = table.rows.find((r) => r.cells[0] === label);
      expect(row?.line).toBe(1);
      expect(row?.gap).toBe(1);
    }
    expect(table.rows.some((r) => r.cellColors?.includes("#2f64b7"))).toBe(true);
    expect(table.rows.some((r) => r.cellColors?.includes("var(--caos-critical)"))).toBe(true);
    expect(table.columnGroups?.map((group) => group.key)).toEqual(["Q", "YTD", "HIST", "LTM", "PF", "BASE", "DOWN"]);
    expect(table.columnGroups?.map((group) => group.label)).toEqual(["Quarterly", "YTD", "Historic", "LTM", "Pro forma", "Base", "Downside"]);
    expect(table.columnGroups?.every((group) => group.start > 0)).toBe(true);
  });
});
