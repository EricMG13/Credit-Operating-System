import { describe, expect, it } from "vitest";
import { fmt, isEditCol, isEditable, ovField, parseNum } from "./model-format";

describe("fmt", () => {
  it("is blank for null / undefined / NaN", () => {
    expect(fmt(null, "m")).toBe("");
    expect(fmt(undefined, "m")).toBe("");
    expect(fmt(NaN, "m")).toBe("");
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
