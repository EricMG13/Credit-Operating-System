// C9 — committee-pack .xlsx export. buildWorkbook() is the pure, testable
// core (no DOM/download side effect); exportModel() just hands its output to
// XLSX.writeFile. The SheetJS output was separately hand-verified once
// against openpyxl (a genuinely different parser) to catch anything a
// SheetJS-only round trip would tolerate but Excel/openpyxl would not — see
// the PR description for that one-time cross-tool check; this suite is the
// ongoing CI-enforced regression guard using SheetJS on both ends, which is
// what the Frontend CI job can actually run.

import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
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

// SheetJS reads its own write output back in-memory — a genuine byte
// serialize/deserialize round trip (write via XLSX.write, re-parse via
// XLSX.read), not merely inspecting the WorkSheet objects still in memory.
function roundTrip(wb: XLSX.WorkBook): XLSX.WorkBook {
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return XLSX.read(buf, { type: "buffer" });
}

describe("buildWorkbook", () => {
  it("produces all five sheets in order", () => {
    const wb = build();
    expect(wb.SheetNames).toEqual(["Model", "Scenarios", "Assumptions", "Headline Facts", "Overrides"]);
  });

  it("round-trips through a real xlsx byte serialize/deserialize", () => {
    const wb = roundTrip(build());
    expect(wb.SheetNames).toEqual(["Model", "Scenarios", "Assumptions", "Headline Facts", "Overrides"]);
    const model = XLSX.utils.sheet_to_json(wb.Sheets["Model"], { header: 1 }) as unknown[][];
    expect(model.length).toBeGreaterThan(10);
  });

  it("stamps every sheet's first row with ORIGIN/METHOD/RUN/AS OF", () => {
    const wb = roundTrip(build());
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 }) as unknown[][];
      const stamp = String(rows[0][0]);
      expect(stamp).toContain("ORIGIN: LIVE");
      expect(stamp).toContain("METHOD: REPORTED");
      expect(stamp).toContain("RUN: run-abc123");
      expect(stamp).toContain("AS OF: 2026-07-12");
    }
  });

  it("Model sheet carries real numeric cells with money/percent/multiple number formats", () => {
    const wb = build();
    const ws = wb.Sheets["Model"];
    const range = XLSX.utils.decode_range(ws["!ref"] as string);
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
    const levRow = rows.findIndex((r) => String(r[0]).includes("Total Net Leverage"));
    expect(levRow).toBeGreaterThan(0);
    // Some columns are legitimately blank for a given row (an early historical
    // period with no derivable ratio) — find the first populated cell in the
    // row rather than assuming column 1 is non-empty.
    const numericCell = Array.from({ length: range.e.c }, (_, i) => i + 1)
      .map((c) => ws[XLSX.utils.encode_cell({ r: levRow, c })])
      .find((cell) => typeof cell?.v === "number");
    expect(numericCell).toBeTruthy();
    expect(numericCell?.z).toBe('0.00"x"');
  });

  it("Headline Facts sheet lists only headline=true metrics", () => {
    const wb = roundTrip(build({}, [metric(), metric({ metric_key: "interest_coverage", headline: false, value: 3.1 })]));
    const rows = XLSX.utils.sheet_to_json(wb.Sheets["Headline Facts"], { header: 1 }) as unknown[][];
    // Row 0=stamp, 1=blank, 2=header, 3+=data rows.
    const keys = rows.slice(3).map((r) => r[0]);
    expect(keys).toContain("net_leverage");
    expect(keys).not.toContain("interest_coverage");
  });

  it("Headline Facts sheet states absence honestly when there are no headline metrics", () => {
    const wb = roundTrip(build({}, []));
    const rows = XLSX.utils.sheet_to_json(wb.Sheets["Headline Facts"], { header: 1 }) as unknown[][];
    // Row 0=stamp, 1=blank, 2=header, 3=the absence message.
    expect(String(rows[3][0])).toMatch(/no headline metric_facts/i);
  });

  it("Overrides sheet lists manual overrides by period/account/value", () => {
    const wb = roundTrip(build({ "b0:rev": 2500 }));
    const rows = XLSX.utils.sheet_to_json(wb.Sheets["Overrides"], { header: 1 }) as unknown[][];
    const dataRow = rows.find((r) => r[1] === "Revenues");
    expect(dataRow).toBeTruthy();
    expect(dataRow?.[2]).toBe(2500);
  });

  it("Overrides sheet states absence honestly with no overrides", () => {
    const wb = roundTrip(build({}));
    const rows = XLSX.utils.sheet_to_json(wb.Sheets["Overrides"], { header: 1 }) as unknown[][];
    // Row 0=stamp, 1=blank, 2=header, 3=the absence message.
    expect(String(rows[3][0])).toMatch(/no manual overrides/i);
  });

  it("Assumptions sheet carries base and downside columns for every driver", () => {
    const wb = roundTrip(build());
    const rows = XLSX.utils.sheet_to_json(wb.Sheets["Assumptions"], { header: 1 }) as unknown[][];
    const sofr = rows.find((r) => String(r[0]).includes("SOFR"));
    expect(sofr).toBeTruthy();
    expect(sofr?.[1]).toBeCloseTo(0.043, 5);
    expect(sofr?.[2]).toBeCloseTo(0.043, 5);
  });

  it("Scenarios sheet carries best/base/worst projections for every forecast year", () => {
    const wb = roundTrip(build());
    const rows = XLSX.utils.sheet_to_json(wb.Sheets["Scenarios"], { header: 1 }) as unknown[][];
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
    const ws = wb.Sheets["Model"];
    const headerCell = ws[XLSX.utils.encode_cell({ r: 2, c: 0 })];
    expect(String(headerCell.v).startsWith("'")).toBe(true);
  });
});
