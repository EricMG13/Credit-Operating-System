import { describe, it, expect } from "vitest";
import { fmtNum, fmtUsdM, fmtPct, fmtMult, initials } from "./format";

describe("format helpers", () => {
  it("fmtNum groups thousands and respects decimals", () => {
    expect(fmtNum(1850)).toBe("1,850");
    expect(fmtNum(421)).toBe("421");
    expect(fmtNum(1234567)).toBe("1,234,567");
    expect(fmtNum(5.68, 2)).toBe("5.68");
  });

  it("fmtUsdM prefixes $ and suffixes M", () => {
    expect(fmtUsdM(612)).toBe("$612M");
    expect(fmtUsdM(1850)).toBe("$1,850M");
  });

  it("fmtPct converts a 0–1 ratio to a percentage", () => {
    expect(fmtPct(0.382)).toBe("38%");
    expect(fmtPct(0.5, 1)).toBe("50.0%");
    expect(fmtPct(1)).toBe("100%");
  });

  it("fmtMult appends x", () => {
    expect(fmtMult(5.68)).toBe("5.7x");
    expect(fmtMult(2, 0)).toBe("2x");
  });

  it("is NaN/Infinity-safe — renders an em dash, never 'NaN'", () => {
    expect(fmtNum(NaN)).toBe("—");
    expect(fmtUsdM(Infinity)).toBe("—");
    expect(fmtPct(NaN)).toBe("—");
    expect(fmtMult(0 / 0)).toBe("—");
  });

  it("initials: first+last for multi-word, first two chars for single, upper-cased", () => {
    expect(initials("Eric Gub")).toBe("EG");
    expect(initials("eric gub")).toBe("EG");
    expect(initials("  Mary Jane Watson ")).toBe("MW");
    expect(initials("Eric")).toBe("ER");
    expect(initials("")).toBe("?");
  });
});
