import { describe, expect, it } from "vitest";
import { buildModel } from "@/lib/reports/model";
import { buildGrid, colLetter, fmtVal, type SheetState } from "./sheet";

const model = buildModel();

const sheet = (cells: Record<string, string>, extra?: Partial<SheetState>): SheetState => ({
  rows: [{ id: "r1", label: "Analyst row 1" }, { id: "r2", label: "Analyst row 2" }],
  cols: [{ key: "c1", label: "Custom 1" }],
  cells,
  ...extra,
});

// Address geometry: data columns start at B (A is the label column);
// f22 is the 12th data column → letter M. Row 5 is "Revenues" (rev).
const FY22_REV = model.cols.f22.rev; // 2295 by default

describe("colLetter", () => {
  it("maps indexes to spreadsheet letters", () => {
    expect(colLetter(0)).toBe("A");
    expect(colLetter(25)).toBe("Z");
    expect(colLetter(26)).toBe("AA");
    expect(colLetter(27)).toBe("AB");
  });
});

describe("grid addressing", () => {
  it("assigns letters to model columns and numbers to model rows", () => {
    const g = buildGrid(model, sheet({}));
    expect(g.colAddr.f22).toBe("M");
    expect(g.rowAddr.rev).toBe(5);
  });

  it("addresses custom rows after the analyst section line", () => {
    const g = buildGrid(model, sheet({}));
    expect(g.rowAddr.r1).toBe(g.rowIds.length - 1);
    expect(g.rowAddr.r2).toBe(g.rowIds.length);
  });

  it("resolves built-in cells through row getters", () => {
    const g = buildGrid(model, sheet({}));
    expect(g.get("f22", "rev").v).toBe(FY22_REV);
  });
});

describe("formula evaluation", () => {
  const get = (cells: Record<string, string>, col = "f22", row = "r1") =>
    buildGrid(model, sheet(cells)).get(col, row);

  it("accepts plain numbers, commas, parens-negatives and $", () => {
    expect(get({ "f22:r1": "450" }).v).toBe(450);
    expect(get({ "f22:r1": "1,250.5" }).v).toBe(1250.5);
    expect(get({ "f22:r1": "(35)" }).v).toBe(-35);
    expect(get({ "f22:r1": "$90" }).v).toBe(90);
  });

  it("evaluates arithmetic with precedence and parentheses", () => {
    expect(get({ "f22:r1": "=1+2*3" }).v).toBe(7);
    expect(get({ "f22:r1": "=(1+2)*3" }).v).toBe(9);
    expect(get({ "f22:r1": "=10/4" }).v).toBe(2.5);
    expect(get({ "f22:r1": "=-5+3" }).v).toBe(-2);
  });

  it("supports the % suffix", () => {
    expect(get({ "f22:r1": "=50%" }).v).toBe(0.5);
    expect(get({ "f22:r1": "=200*10%" }).v).toBe(20);
  });

  it("resolves cell references against the model", () => {
    expect(get({ "f22:r1": "=M5" }).v).toBe(FY22_REV);
    expect(get({ "f22:r1": "=M5*0.1" }).v).toBeCloseTo(FY22_REV * 0.1);
  });

  it("resolves references to other custom cells (chained formulas)", () => {
    const g = buildGrid(model, sheet({ "f22:r1": "=M5*0.1", "f22:r2": "100" }));
    const r1 = g.rowAddr.r1, r2 = g.rowAddr.r2;
    const v = g.get("c1", "r1");
    // not set yet → empty
    expect(v.v).toBeNull();
    const g2 = buildGrid(model, sheet({
      "f22:r1": "=M5*0.1",
      "f22:r2": "100",
      "c1:r1": `=(M${r1}+M${r2})*2`,
    }));
    expect(g2.get("c1", "r1").v).toBeCloseTo((FY22_REV * 0.1 + 100) * 2);
  });

  it("treats empty referenced cells as 0", () => {
    expect(get({ "f22:r1": "=M5+Z99" }).err).toBe("#REF"); // out of range
    const g = buildGrid(model, sheet({ "c1:r1": "=M5" })); // r2's c1 cell is empty
    const r2 = g.rowAddr.r2;
    const g2 = buildGrid(model, sheet({ "c1:r1": `=5+Z${r2}` }));
    expect(g2.get("c1", "r1").v).toBe(5); // Z = custom col c1 (25th data col), empty cell on r2
  });

  it("flags errors: parse, bad ref, division by zero, cycles", () => {
    expect(get({ "f22:r1": "=1+" }).err).toBe("#ERR");
    expect(get({ "f22:r1": "=XX999" }).err).toBe("#REF");
    expect(get({ "f22:r1": "=1/0" }).err).toBe("#DIV/0");
    const g = buildGrid(model, sheet({ "f22:r1": "=M5*", "c1:r1": "abc def" }));
    expect(g.get("c1", "r1").err).toBe("#ERR");
  });

  it("detects reference cycles instead of recursing forever", () => {
    const g = buildGrid(model, sheet({}));
    const r1 = g.rowAddr.r1, r2 = g.rowAddr.r2;
    const g2 = buildGrid(model, sheet({
      "f22:r1": `=M${r2}+1`,
      "f22:r2": `=M${r1}+1`,
    }));
    expect(g2.get("f22", "r1").err).toBe("#CYCLE");
    // self-reference too
    const g3 = buildGrid(model, sheet({ "f22:r1": `=M${r1}` }));
    expect(g3.get("f22", "r1").err).toBe("#CYCLE");
  });

  it("propagates errors through references", () => {
    const g = buildGrid(model, sheet({}));
    const r1 = g.rowAddr.r1;
    const g2 = buildGrid(model, sheet({ "f22:r1": "=1/0", "c1:r1": `=M${r1}+5` }));
    expect(g2.get("c1", "r1").err).toBe("#DIV/0");
  });
});

describe("fmtVal", () => {
  it("formats values in the model's display style", () => {
    expect(fmtVal({ v: 1234.6 })).toBe("1,235");
    expect(fmtVal({ v: -1234.6 })).toBe("(1,235)");
    expect(fmtVal({ v: 12.345 })).toBe("12.35");
    expect(fmtVal({ v: null })).toBe("");
    expect(fmtVal({ v: null, err: "#CYCLE" })).toBe("#CYCLE");
  });
});
