import { describe, it, expect } from "vitest";
import { CHART_HEX, TRANCHE_HEX, TRANCHE_HEX_PAPER } from "./chart-colors";

// Canonical design tokens (globals.css / tailwind.config.js). Canvas charts (g2)
// can't resolve CSS custom properties, so chart-colors.ts hard-codes these hexes;
// this test fails if the two drift apart. When a token changes, update both the
// token and chart-colors.ts (and this contract) together.
const CAOS = {
  accent: "#63a1ff",
  success: "#22c55e",
  warning: "#f5a524",
  critical: "#ef4444",
  muted: "#a1a1b5",
};
const TRANCHE = {
  "1l": "#2dd4bf",
  "2l": "#4f8cff",
  unsec: "#f5a524",
  sub: "#a855f7",
  eq: "#64748b",
};

describe("chart-colors ↔ design-token parity", () => {
  it("CHART_HEX mirrors the caos semantic + tranche tokens", () => {
    expect(CHART_HEX.accent).toBe(CAOS.accent);
    expect(CHART_HEX.success).toBe(CAOS.success);
    expect(CHART_HEX.warning).toBe(CAOS.warning);
    expect(CHART_HEX.critical).toBe(CAOS.critical);
    expect(CHART_HEX.muted).toBe(CAOS.muted);
    expect(CHART_HEX.teal).toBe(TRANCHE["1l"]); // --tranche-1l
    expect(CHART_HEX.eq).toBe(TRANCHE.eq); // --tranche-eq
  });

  it("TRANCHE_HEX (app surface) mirrors the tranche ramp exactly", () => {
    expect(TRANCHE_HEX).toEqual(TRANCHE);
  });

  it("TRANCHE_HEX_PAPER covers the same tranche keys (paper theme)", () => {
    expect(Object.keys(TRANCHE_HEX_PAPER).sort()).toEqual(Object.keys(TRANCHE).sort());
  });
});
