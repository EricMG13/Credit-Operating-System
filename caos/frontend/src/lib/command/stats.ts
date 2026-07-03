import { PORTFOLIO } from "./data";

// Tukey-fenced trimmed mean (bps). The raw mean of the sample book's 3Y DM is
// poisoned by a handful of junk marks (negative/zero DMs and ±20000bps ticks
// that no performing loan carries), which drag a naive average to a nonsensical
// negative. So the header's "Avg 3Y DM" drops points outside
// [Q1 - 1.5·IQR, Q3 + 1.5·IQR] before averaging — a robust average that reflects
// the real loan spreads, not the bad ticks. Non-finite inputs are filtered first
// (never divide an empty/NaN set); returns null when nothing credible remains so
// the caller degrades to an em-dash rather than showing a wrong number.
export function trimmedMeanBps(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const q = (p: number) => v[Math.floor(p * (v.length - 1))];
  const q1 = q(0.25), q3 = q(0.75), iqr = q3 - q1;
  const kept = v.filter((x) => x >= q1 - 1.5 * iqr && x <= q3 + 1.5 * iqr);
  if (!kept.length) return null;
  return kept.reduce((a, b) => a + b, 0) / kept.length;
}

// Computed once at module load (PORTFOLIO is static sample data).
export const PORTFOLIO_AVG_DM = trimmedMeanBps(PORTFOLIO.map((p) => p.dm));

// Head-stat string: signed integer bps, or an em-dash when undefined.
export const PORTFOLIO_AVG_DM_LABEL =
  PORTFOLIO_AVG_DM == null ? "—" : (PORTFOLIO_AVG_DM > 0 ? "+" : "") + Math.round(PORTFOLIO_AVG_DM) + "bps";
