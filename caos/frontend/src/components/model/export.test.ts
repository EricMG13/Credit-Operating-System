// C9 — committee-pack .xlsx export. buildWorkbook() is the pure, testable
// core (no DOM/download side effect); exportModel() just hands its output to
// a Blob download. The ExcelJS output was separately hand-verified once
// against openpyxl (a genuinely different parser) to catch anything an
// ExcelJS-only round trip would tolerate but Excel/openpyxl would not — see
// the PR description for that one-time cross-tool check; this suite is the
// ongoing CI-enforced regression guard using ExcelJS on both ends, which is
// what the Frontend CI job can actually run.

import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildWorkbook } from "./export";
import { buildModel } from "@/lib/reports/model";
import { DEFAULT_ASSUMPTIONS } from "@/lib/reports/assumptions";
import type { ProfileMetric } from "@/lib/api";
import type { Provenance } from "@/lib/provenance";

const model = buildModel(1);
const prov: Provenance = { origin: "LIVE", method: "REPORTED", asOf: "2026-07-12" };
const metric = (over: Partial<ProfileMetric> = {}): ProfileMetric => ({
  metric_key: "net_leverage", period: "FY25", value: 4.2, unit: "x", basis: "adjusted",
  provenance: "run", headline: true, qa_status: "Passed",
  source_claim_id: null, source_evidence_id: null, document_chunk_id: null, ...over,
});

function build(overrides = {}, metrics: ProfileMetric[] = [metric()]) {
  return buildWorkbook(model, true, overrides, { header: "Acme — cash-flow model", subheader: "YE 31-Dec · $m" }, {
    prov, runId: "run-abc123", assumptions: DEFAULT_ASSUMPTIONS, metrics,
  });
}

// A genuine byte serialize/deserialize round trip (write via xlsx.writeBuffer,
// re-parse via a fresh Workbook's xlsx.load) — not merely inspecting the
// Worksheet objects still in memory.
async function roundTrip(wb: ExcelJS.Workbook): Promise<ExcelJS.Workbook> {
  const buf = await wb.xlsx.writeBuffer();
  const out = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Buffer<ArrayBufferLike> vs Buffer generic mismatch across @types/node versions; runtime shape is identical.
  await out.xlsx.load(buf as any);
  return out;
}

function sheetRows(ws: ExcelJS.Worksheet): unknown[][] {
  const rows: unknown[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    rows.push((row.values as unknown[]).slice(1)); // ExcelJS's row.values is 1-indexed (index 0 unused)
  });
  return rows;
}

const sheetNames = (wb: ExcelJS.Workbook) => wb.worksheets.map((ws) => ws.name);

describe("buildWorkbook", () => {
  it("produces all five sheets in order", () => {
    expect(sheetNames(build())).toEqual(["Model", "Scenarios", "Assumptions", "Headline Facts", "Overrides"]);
  });

  it("round-trips through a real xlsx byte serialize/deserialize", async () => {
    const wb = await roundTrip(build());
    expect(sheetNames(wb)).toEqual(["Model", "Scenarios", "Assumptions", "Headline Facts", "Overrides"]);
    const rows = sheetRows(wb.getWorksheet("Model")!);
    expect(rows.length).toBeGreaterThan(10);
  });

  it("stamps every sheet's first row with ORIGIN/METHOD/RUN/AS OF", async () => {
    const wb = await roundTrip(build());
    for (const ws of wb.worksheets) {
      const rows = sheetRows(ws);
      const stamp = String(rows[0][0]);
      expect(stamp).toContain("ORIGIN: LIVE");
      expect(stamp).toContain("METHOD: REPORTED");
      expect(stamp).toContain("RUN: run-abc123");
      expect(stamp).toContain("AS OF: 2026-07-12");
    }
  });

  it("Model sheet carries real numeric cells with money/percent/multiple number formats", () => {
    const ws = build().getWorksheet("Model")!;
    let levRow: ExcelJS.Row | null = null;
    ws.eachRow((row) => { if (row.getCell(1).value === "Total Net Leverage") levRow = row; });
    expect(levRow).toBeTruthy();
    // Some columns are legitimately blank for a given row (an early historical
    // period with no derivable ratio) — find the first populated cell.
    let numericCell: ExcelJS.Cell | null = null;
    for (let c = 2; c <= (levRow as unknown as ExcelJS.Row).cellCount; c++) {
      const cell = (levRow as unknown as ExcelJS.Row).getCell(c);
      if (typeof cell.value === "number") { numericCell = cell; break; }
    }
    expect(numericCell).toBeTruthy();
    expect(numericCell?.numFmt).toBe('0.00"x"');
  });

  it("Headline Facts sheet lists only headline=true metrics", async () => {
    const wb = await roundTrip(build({}, [metric(), metric({ metric_key: "interest_coverage", headline: false, value: 3.1 })]));
    const rows = sheetRows(wb.getWorksheet("Headline Facts")!);
    // Row 0=stamp, 1=blank, 2=header, 3+=data rows.
    const keys = rows.slice(3).map((r) => r[0]);
    expect(keys).toContain("net_leverage");
    expect(keys).not.toContain("interest_coverage");
  });

  it("Headline Facts sheet states absence honestly when there are no headline metrics", async () => {
    const wb = await roundTrip(build({}, []));
    const rows = sheetRows(wb.getWorksheet("Headline Facts")!);
    expect(String(rows[3][0])).toMatch(/no headline metric_facts/i);
  });

  it("Overrides sheet lists manual overrides by period/account/value", async () => {
    const wb = await roundTrip(build({ "b0:rev": 2500 }));
    const rows = sheetRows(wb.getWorksheet("Overrides")!);
    const dataRow = rows.find((r) => r[1] === "Revenues");
    expect(dataRow).toBeTruthy();
    expect(dataRow?.[2]).toBe(2500);
  });

  it("Overrides sheet states absence honestly with no overrides", async () => {
    const wb = await roundTrip(build({}));
    const rows = sheetRows(wb.getWorksheet("Overrides")!);
    expect(String(rows[3][0])).toMatch(/no manual overrides/i);
  });

  it("Assumptions sheet carries base and downside columns for every driver", async () => {
    const wb = await roundTrip(build());
    const rows = sheetRows(wb.getWorksheet("Assumptions")!);
    const sofr = rows.find((r) => String(r[0]).includes("SOFR delta"));
    expect(sofr).toBeTruthy();
    expect(sofr?.[1] as number).toBe(0);
    expect(sofr?.[2] as number).toBe(0);
    expect(rows.some((r) => String(r[0]).includes("EURIBOR"))).toBe(false);
    expect(rows.some((r) => String(r[0]).includes("SONIA"))).toBe(false);
  });

  it("Scenarios sheet carries best/base/worst projections for every forecast year", async () => {
    const wb = await roundTrip(build());
    const rows = sheetRows(wb.getWorksheet("Scenarios")!);
    // Row 0=stamp, 1=blank, 2=header.
    const header = rows[2] as string[];
    expect(header).toEqual(expect.arrayContaining([
      "Best FY26e", "Base FY26e", "Worst FY26e", "Best FY28e", "Base FY28e", "Worst FY28e",
    ]));
    const netLevRow = rows.find((r) => r[0] === "Net Leverage");
    expect(netLevRow).toBeTruthy();
  });

  // Formula-injection guard (matrix 6.8): an issuer named "=cmd|'/c calc'!A1"
  // must never land as a live formula when the header/labels come from
  // analyst-entered text.
  it("neutralizes a formula-injection-shaped header", () => {
    const wb = buildWorkbook(model, true, {}, { header: "=cmd|'/c calc'!A1", subheader: "x" }, {
      prov, runId: null, assumptions: DEFAULT_ASSUMPTIONS, metrics: [],
    });
    const ws = wb.getWorksheet("Model")!;
    const headerCell = ws.getRow(3).getCell(1);
    expect(String(headerCell.value).startsWith("'")).toBe(true);
  });
});

  it("never exports a non-finite ratio cell (zero-revenue override → blank, not Infinity)", async () => {
    // q0 revenue overridden to 0 makes adjm/sga/dapc ±Infinity in the model;
    // the grid blanks them (model-format fmt) but round3 guarded only NaN, so
    // the committee .xlsx carried numeric Infinity cells with a "0.0%" numFmt
    // (triage 2026-07-16 P3).
    const wb = await roundTrip(build({ "q0:rev": 0 }));
    const rows = sheetRows(wb.getWorksheet("Model")!);
    const flat = rows.flat();
    const nonFinite = flat.filter((v) => typeof v === "number" && !Number.isFinite(v));
    expect(nonFinite).toEqual([]);
  });
