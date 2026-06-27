import { describe, it, expect } from "vitest";
import { fmtNum, fmtUsdM, fmtPct, fmtMult, fmtMult2, fmtUsdAcct, initials } from "./format";

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

  it("fmtMult2 is two-decimal multiple, NaN/Infinity-safe", () => {
    expect(fmtMult2(5.683)).toBe("5.68x");
    expect(fmtMult2(-2.5)).toBe("-2.50x");
    expect(fmtMult2(NaN)).toBe("—");
    expect(fmtMult2(Infinity)).toBe("—");
    expect(fmtMult2(1 / 0)).toBe("—");
  });

  it("fmtUsdAcct is accounting-style USD millions, NaN/Infinity-safe", () => {
    expect(fmtUsdAcct(612)).toBe("$612M");
    expect(fmtUsdAcct(1850)).toBe("$1,850M");
    expect(fmtUsdAcct(-250)).toBe("($250M)");
    expect(fmtUsdAcct(NaN)).toBe("—");
    expect(fmtUsdAcct(Infinity)).toBe("—");
    expect(fmtUsdAcct(-Infinity)).toBe("—");
  });

  it("initials: first+last for multi-word, first two chars for single, upper-cased", () => {
    expect(initials("Eric Gub")).toBe("EG");
    expect(initials("eric gub")).toBe("EG");
    expect(initials("  Mary Jane Watson ")).toBe("MW");
    expect(initials("Eric")).toBe("ER");
    expect(initials("")).toBe("?");
  });
});
