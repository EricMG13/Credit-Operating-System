// Locale-aware number formatting for the cockpit and tear-sheet. Tabular-
// friendly (grouping + fixed decimals) so figures align under `.tabular`, and
// NaN/Infinity-safe (renders an em dash rather than "NaN"). Centralizes the
// ad-hoc toFixed / toLocaleString / "$"+x+"M" calls scattered across the UI.

const nf = (min: number, max: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: min, maximumFractionDigits: max });

/** Plain number with grouping, e.g. 1850 → "1,850". */
export function fmtNum(n: number, dp = 0): string {
  return Number.isFinite(n) ? nf(dp, dp).format(n) : "—";
}

/** USD millions, e.g. 612 → "$612M", 1850 → "$1,850M". */
export function fmtUsdM(n: number, dp = 0): string {
  return Number.isFinite(n) ? "$" + fmtNum(n, dp) + "M" : "—";
}

/** Percent from a 0–1 ratio, e.g. 0.382 → "38%". */
export function fmtPct(ratio: number, dp = 0): string {
  return Number.isFinite(ratio) ? fmtNum(ratio * 100, dp) + "%" : "—";
}

/** Leverage / coverage multiple, e.g. 5.68 → "5.7x". */
export function fmtMult(n: number, dp = 1): string {
  return Number.isFinite(n) ? fmtNum(n, dp) + "x" : "—";
}

/** Analyst initials for the identity badge: "Eric Gub" → "EG", "Eric" → "ER". */
export function initials(name: string): string {
  const w = (name || "").trim().split(/\s+/).filter(Boolean);
  if (w.length === 0) return "?";
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[w.length - 1][0]).toUpperCase();
}
