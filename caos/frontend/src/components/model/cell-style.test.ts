import { describe, expect, it } from "vitest";
import { cellBackground, cellBoxShadow, cellTextColor, kpiDistressColor } from "./cell-style";

describe("kpiDistressColor", () => {
  it("is null for a missing value", () => {
    expect(kpiDistressColor("totlev", null)).toBeNull();
  });
  it("is null below the leverage band (benign)", () => {
    expect(kpiDistressColor("totlev", 5)).toBeNull(); // t = (5-6)/2 < 0
  });
  it("is orange at the bottom of the leverage band (6.0x)", () => {
    expect(kpiDistressColor("totlev", 6)).toBe("rgb(245,165,36)");
  });
  it("clamps to red at/above 8.0x leverage", () => {
    expect(kpiDistressColor("totlev", 9)).toBe("rgb(239,68,68)"); // t clamps to 1
  });
  it("inverts for interest coverage (worsens down)", () => {
    expect(kpiDistressColor("intcov", 2)).toBe("rgb(245,165,36)");
    expect(kpiDistressColor("intcov", 0.5)).toBe("rgb(239,68,68)");
    expect(kpiDistressColor("intcov", 3)).toBeNull(); // t = (2-3)/1.5 < 0
  });
  it("ignores rows outside the KPI set", () => {
    expect(kpiDistressColor("revenue", 100)).toBeNull();
  });
});

describe("cellTextColor — priority order", () => {
  const base = { rowId: "revenue", v: 10, isOv: false, pct: false, bold: false, rowFmt: "m" };
  it("KPI distress shading wins over everything", () => {
    // totlev at 7.0x is mid-band: distress rgb() applies, NOT the override warning.
    const c = cellTextColor({ ...base, rowId: "totlev", v: 7, isOv: true, bold: true });
    expect(c).toMatch(/^rgb\(/);
    expect(c).not.toBe("var(--caos-warning)");
  });
  it("override beats sign/bold", () => {
    expect(cellTextColor({ ...base, isOv: true, bold: true })).toBe("var(--caos-warning)");
  });
  it("pct positive vs negative", () => {
    expect(cellTextColor({ ...base, pct: true, v: 5 })).toBe("var(--caos-accent)");
    expect(cellTextColor({ ...base, pct: true, v: -5 })).toBe("var(--caos-critical)");
  });
  it("negative money is muted", () => {
    expect(cellTextColor({ ...base, v: -5, rowFmt: "m" })).toBe("var(--caos-muted)");
  });
  it("bold otherwise gets full text color", () => {
    expect(cellTextColor({ ...base, bold: true })).toBe("var(--caos-text)");
  });
  it("default cell color", () => {
    expect(cellTextColor(base)).toBe("var(--caos-text)");
  });
});

describe("cellBackground — priority order", () => {
  const off = { isSel: false, cellHl: false, colHl: false, isHl: false, shade: false };
  it("selection wins", () => {
    expect(cellBackground({ ...off, isSel: true, cellHl: true })).toBe("rgba(79,140,255,0.22)");
  });
  it("flashed cell next", () => {
    expect(cellBackground({ ...off, cellHl: true, colHl: true })).toBe("rgba(79,140,255,0.28)");
  });
  it("column or row highlight next", () => {
    expect(cellBackground({ ...off, colHl: true })).toBe("rgba(79,140,255,0.08)");
    expect(cellBackground({ ...off, isHl: true })).toBe("rgba(79,140,255,0.08)");
  });
  it("shade band next, transparent default", () => {
    expect(cellBackground({ ...off, shade: true })).toBe("rgba(255,255,255,0.025)");
    expect(cellBackground(off)).toBe("transparent");
  });
});

describe("cellBoxShadow", () => {
  it("selection ring beats flash ring beats none", () => {
    expect(cellBoxShadow(true, true)).toBe("inset 0 0 0 1px var(--caos-accent)");
    expect(cellBoxShadow(false, true)).toBe("inset 0 0 0 1px rgba(79,140,255,0.6)");
    expect(cellBoxShadow(false, false)).toBe("none");
  });
});
