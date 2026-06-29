// Canvas chart palette — single source.
//
// @antv/g2 renders to <canvas>, where CSS custom properties (var(--…)) do NOT
// resolve, so chart series colors must be literal hex rather than design tokens.
// This module mirrors the DOM tokens (src/app/globals.css / tailwind.config.js)
// so the canvas palette stays in lockstep with the rest of the interface — when
// a token changes, change its twin here. Imported by every @antv/g2 spec
// (G2Chart, ModuleCharts, deepdive tabs) so the literals live in exactly one
// place.

// Seniority / tranche ramp on the dark app surfaces — mirrors --tranche-*.
export const TRANCHE_HEX: Record<string, string> = {
  "1l": "#2dd4bf", "2l": "#4f8cff", unsec: "#f5a524", sub: "#a855f7", eq: "#64748b",
};

// Tranche ramp for the light "paper" report theme (Report Studio).
export const TRANCHE_HEX_PAPER: Record<string, string> = {
  "1l": "#0d9488", "2l": "#2563eb", unsec: "#b45309", sub: "#7c3aed", eq: "#94a3b8",
};

// Semantic + neutral series colors for app-surface charts. The semantic colors
// mirror --caos-accent/success/warning/critical/muted and --tranche-1l/eq; the
// slates are chart-only categorical neutrals (no DOM token equivalent).
export const CHART_HEX = {
  accent: "#63a1ff", // --caos-accent / --tranche-2l (but note tranche-2l blue is #4f8cff)
  teal: "#2dd4bf", // --tranche-1l — line/point accent
  tealDeep: "#14b8a6",
  success: "#22c55e", // --caos-success
  warning: "#f5a524", // --caos-warning / --tranche-unsec
  critical: "#ef4444", // --caos-critical
  muted: "#a1a1b5", // --caos-muted
  eq: "#64748b", // --tranche-eq
  slate: "#5b6b85",
  slateDeep: "#46506b",
} as const;
