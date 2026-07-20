/**
 * Literal values needed before, or independently of, the CSS pipeline.
 * Keep ordinary UI styles on CSS custom properties; this module is reserved
 * for browser metadata, native color controls, and the root error boundary.
 */
export const CAOS_COLOR_TOKENS = {
  bg: "#0a0a0f",
  panel: "#11131d",
  border: "#34384a",
  text: "#e6e6ef",
  muted: "#a1a1b5",
  accent: "#63a1ff",
  critical: "#ef4444",
  paperWhite: "#ffffff",
  paperWarm: "#f7f5ee",
  paperCool: "#eef0f3",
} as const;
