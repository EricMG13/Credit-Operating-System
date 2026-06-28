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

/** Two-decimal multiple, e.g. 5.683 → "5.68x". The Scenario/Model display
 *  precision (`v.toFixed(2) + "x"`), but NaN/Infinity-safe — a non-finite
 *  leverage/coverage (interest 0, adj ≤ 0) renders "—", never "NaNx"/"Infinityx". */
export function fmtMult2(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) + "x" : "—";
}

/** USD millions, accounting style: negatives in parens, no decimals, e.g.
 *  612 → "$612M", -250 → "($250M)". NaN/Infinity-safe (→ "—"), so a degenerate
 *  cash/FCF projection never prints "$InfinityM". */
export function fmtUsdAcct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const s = "$" + fmtNum(Math.abs(Math.round(n))) + "M";
  return n < 0 ? "(" + s + ")" : s;
}

/** Analyst initials for the identity badge: "Eric Gub" → "EG", "Eric" → "ER". */
export function initials(name: string): string {
  const w = (name || "").trim().split(/\s+/).filter(Boolean);
  if (w.length === 0) return "?";
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[w.length - 1][0]).toUpperCase();
}
