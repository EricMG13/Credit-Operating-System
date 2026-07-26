import fs from "node:fs";
import { describe, it, expect } from "vitest";
import { CHART_HEX, TRANCHE_HEX, TRANCHE_HEX_PAPER } from "./chart-colors";
import { CAOS_COLOR_TOKENS } from "./color-tokens";

// The sheet colours an analyst can pick for the tear-sheet (reports/page.tsx PAPERS).
const PAPER_SWATCHES = {
  paperWhite: CAOS_COLOR_TOKENS.paperWhite,
  paperWarm: CAOS_COLOR_TOKENS.paperWarm,
  paperCool: CAOS_COLOR_TOKENS.paperCool,
};

function relativeLuminance(hex: string) {
  const channels = hex.match(/[a-f\d]{2}/gi)!.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string) {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

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

  // Report Studio paints value labels in --paper-bg on top of the series fill
  // (ReportVisualization LightweightStack), so the fill itself is the text
  // background and has to clear AA — the dark-surface ramp does not. The sheet
  // colour behind the chart is analyst-selectable (page.tsx PAPERS), so the ramp
  // is held to AA on every reachable background, not just the token default.
  it("TRANCHE_HEX_PAPER mirrors --paper-tranche-* and clears 4.5:1 on every paper surface", () => {
    const css = fs.readFileSync("src/app/globals.css", "utf8");
    const readToken = (name: string) => css.match(new RegExp(`${name}:\\s*(#[a-f\\d]{6})`, "i"))?.[1];
    const paperBg = readToken("--paper-bg");
    expect(paperBg).toBeTruthy();
    const surfaces = { "--paper-bg": paperBg!, ...PAPER_SWATCHES };

    for (const [key, hex] of Object.entries(TRANCHE_HEX_PAPER)) {
      expect(readToken(`--paper-tranche-${key}`), `--paper-tranche-${key}`).toBe(hex);
      for (const [name, surface] of Object.entries(surfaces)) {
        expect(contrastRatio(hex, surface), `${key} on ${name}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
