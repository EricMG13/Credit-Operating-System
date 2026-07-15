import { describe, expect, it } from "vitest";
import { buildPastePatch, fmt, isEditCol, isEditable, ovField, parseNum } from "./model-format";

describe("fmt", () => {
  it("is blank for null / undefined / NaN / Infinity", () => {
    expect(fmt(null, "m")).toBe("");
    expect(fmt(undefined, "m")).toBe("");
    expect(fmt(NaN, "m")).toBe("");
    // ±Infinity (e.g. intcov when interest = 0) must be blank, not "Infinityx".
    expect(fmt(Infinity, "x")).toBe("");
    expect(fmt(-Infinity, "x")).toBe("");
    expect(fmt(1 / 0, "m")).toBe("");
  });
  it("money: rounds, group-separates, parens for negatives, en-dash for zero", () => {
    expect(fmt(1234.6, "m")).toBe("1,235");
    expect(fmt(-1234.6, "m")).toBe("(1,235)");
    expect(fmt(0.2, "m")).toBe("–");
    expect(fmt(-0.2, "m")).toBe("–"); // rounds to 0
  });
  it("percent (p and r) scales by 100 to one decimal", () => {
    expect(fmt(0.262, "p")).toBe("26.2%");
    expect(fmt(0.05, "r")).toBe("5.0%");
  });
  it("multiple (x) is two decimals", () => {
    expect(fmt(5.678, "x")).toBe("5.68x");
  });
  it("days (d) is a rounded integer string", () => {
    expect(fmt(42.7, "d")).toBe("43");
  });
});

describe("parseNum — analyst override input", () => {
  it("returns null for empty / whitespace / non-numeric", () => {
    expect(parseNum("")).toBeNull();
    expect(parseNum("   ")).toBeNull();
    expect(parseNum("n/a")).toBeNull();
  });
  it("strips commas and dollar signs", () => {
    expect(parseNum("1,234")).toBe(1234);
    expect(parseNum("$1,234.5")).toBe(1234.5);
  });
  it("treats parenthesised values as negative (accounting style)", () => {
    expect(parseNum("(1,234)")).toBe(-1234);
    expect(parseNum("($42)")).toBe(-42);
  });
  it("trims surrounding whitespace", () => {
    expect(parseNum("  42  ")).toBe(42);
  });
  it("rejects non-finite input (an Infinity override would poison aggregates)", () => {
    expect(parseNum("1e999")).toBeNull();
    expect(parseNum("-1e999")).toBeNull();
  });
});

describe("override editability", () => {
  it("ovField aliases the cash-flow Adj. EBITDA row (adj2 → adj)", () => {
    expect(ovField("adj2")).toBe("adj");
    expect(ovField("rev")).toBe("rev");
  });
  it("isEditCol: q-prefixed short keys and f22/f23 are editable", () => {
    expect(isEditCol("q1")).toBe(true);
    expect(isEditCol("f22")).toBe(true);
    expect(isEditCol("f23")).toBe(true);
    expect(isEditCol("q123")).toBe(false); // too long
    expect(isEditCol("rev")).toBe(false);
  });
  it("isEditable requires both an override-signed row and an editable column", () => {
    expect(isEditable("rev", "q1")).toBe(true);
    expect(isEditable("adj2", "f22")).toBe(true); // aliased to adj, which is signed
    expect(isEditable("gpm", "q1")).toBe(false);  // gpm has no OV_SIGN
    expect(isEditable("rev", "h1")).toBe(false);   // not an edit column
  });
});

describe("buildPastePatch — multi-cell paste", () => {
  // A small fixture grid: rev/int are override-signed rows, gpm is not;
  // q1/q2/f22 are editable columns, l1 (LTM, derived) is not.
  const rowIds = ["rev", "int", "gpm", "capex"];
  const colKeys = ["q1", "q2", "f22", "l1"];

  it("single-cell paste (no tabs/newlines) applies one override with the row's sign", () => {
    const r = buildPastePatch(rowIds, colKeys, { row: "rev", col: "q1" }, "1,234");
    expect(r.applied).toBe(1);
    expect(r.patch).toEqual({ "q1:rev": 1234 });
    expect(r.skippedNotEditable).toBe(0);
    expect(r.invalid).toEqual([]);
  });

  it("negates a signed row (int is OV_SIGN -1) on paste, same as a typed override", () => {
    const r = buildPastePatch(rowIds, colKeys, { row: "int", col: "q1" }, "50");
    expect(r.patch).toEqual({ "q1:int": -50 });
  });

  it("walks a horizontal block across columns from the anchor", () => {
    const r = buildPastePatch(rowIds, colKeys, { row: "rev", col: "q1" }, "10\t20\t30");
    expect(r.patch).toEqual({ "q1:rev": 10, "q2:rev": 20, "f22:rev": 30 });
    expect(r.applied).toBe(3);
  });

  it("walks a vertical block across rows from the anchor", () => {
    const r = buildPastePatch(rowIds, colKeys, { row: "rev", col: "q1" }, "10\n50");
    expect(r.patch).toEqual({ "q1:rev": 10, "q1:int": -50 });
  });

  it("skips a pasted cell landing on a non-override-signed row, without erroring the rest", () => {
    const r = buildPastePatch(rowIds, colKeys, { row: "rev", col: "q1" }, "10\n20\n30");
    // row 2 down from rev is gpm — not signed.
    expect(r.patch).toEqual({ "q1:rev": 10, "q1:int": -20 });
    expect(r.skippedNotEditable).toBe(1);
  });

  it("skips a pasted cell landing on a non-editable column (e.g. LTM), without erroring the rest", () => {
    const r = buildPastePatch(rowIds, colKeys, { row: "rev", col: "f22" }, "10\t20");
    // f22 -> l1: l1 is not an edit column.
    expect(r.patch).toEqual({ "f22:rev": 10 });
    expect(r.skippedNotEditable).toBe(1);
  });

  it("records an invalid, non-numeric value on an editable cell without discarding the rest of the block", () => {
    const r = buildPastePatch(rowIds, colKeys, { row: "rev", col: "q1" }, "10\tn/a\t30");
    expect(r.patch).toEqual({ "q1:rev": 10, "f22:rev": 30 });
    expect(r.invalid).toEqual(["rev:q2"]);
  });

  it("leaves a blank pasted cell untouched (not applied, not invalid, not skipped)", () => {
    const r = buildPastePatch(rowIds, colKeys, { row: "rev", col: "q1" }, "10\t\t30");
    expect(r.patch).toEqual({ "q1:rev": 10, "f22:rev": 30 });
    expect(r.applied).toBe(2);
    expect(r.invalid).toEqual([]);
    expect(r.skippedNotEditable).toBe(0);
  });

  it("drops a line whose target row runs past the last grid row, without affecting rows already applied", () => {
    // anchor at "capex" (last row, index 3); the pasted 2nd row targets
    // rowIds[4], which doesn't exist — dropped silently, not counted anywhere.
    const r = buildPastePatch(rowIds, colKeys, { row: "capex", col: "q1" }, "10\n20");
    expect(r.patch).toEqual({ "q1:capex": -10 });
    expect(r.applied).toBe(1);
    expect(r.skippedNotEditable).toBe(0);
  });

  it("drops a cell whose target column runs past the last grid column, silently, while still applying earlier cells in the same row", () => {
    // anchor at "f22" (index 2); the 3rd pasted value targets colKeys[4],
    // which doesn't exist — dropped without incrementing any counter, distinct
    // from l1 (present but genuinely not an edit column, which DOES count).
    const r = buildPastePatch(rowIds, colKeys, { row: "rev", col: "f22" }, "10\t20\t30");
    expect(r.patch).toEqual({ "f22:rev": 10 });
    expect(r.applied).toBe(1);
    expect(r.skippedNotEditable).toBe(1);
    expect(r.invalid).toEqual([]);
  });

  it("drops a trailing newline from a copied range instead of reading it as a phantom blank row", () => {
    const r = buildPastePatch(rowIds, colKeys, { row: "rev", col: "q1" }, "10\n20\n");
    expect(r.patch).toEqual({ "q1:rev": 10, "q1:int": -20 });
  });

  it("returns an empty, harmless result when the anchor isn't in the visible grid", () => {
    const r = buildPastePatch(rowIds, colKeys, { row: "not-a-row", col: "q1" }, "10");
    expect(r).toEqual({ patch: {}, applied: 0, skippedNotEditable: 0, invalid: [] });
  });
});
