// Model Builder cell formatting, override-editing, and input-parsing logic,
// plus column layout constants. Split out of rows.ts so the pure money/parse
// logic is unit-testable and separate from the (large) ROWS/SRC data schema.

export type RowFormat = "m" | "p" | "x" | "d" | "r";

/* ---------- value formatting ---------- */
export function fmt(v: number | null | undefined, f?: RowFormat): string {
  // Reject every non-finite value (NaN *and* ±Infinity): a divide-by-zero KPI
  // (e.g. interest 0 → intcov Infinity) must render blank, not "Infinityx".
  if (v == null || !Number.isFinite(v)) return "";
  if (f === "m") {
    const r = Math.round(v);
    if (r === 0) return "–";
    const s = Math.abs(r).toLocaleString("en-US");
    return r < 0 ? `(${s})` : s;
  }
  if (f === "p" || f === "r") return (v * 100).toFixed(1) + "%";
  if (f === "x") return v.toFixed(2) + "x";
  if (f === "d") return Math.round(v).toString();
  return String(v);
}

/* ---------- column layout + group labels ---------- */
export const GROUPS_META: Record<string, string> = {
  Q: "Quarterly", YTD: "YTD", HIST: "Historic", LTM: "LTM", PF: "PF", BASE: "Base Forecast", DOWN: "Downside Forecast", CUSTOM: "Analyst",
};
export const CW: Record<string, number> = { Q: 56, YTD: 60, HIST: 62, LTM: 62, PF: 62, BASE: 68, DOWN: 68 };
export const LBL = 196;

/* ---------- manual overrides: editable historical inputs ---------- */
export const OV_SIGN: Record<string, number> = { rev: 1, adj: 1, ab: 1, int: -1, tax: -1, wc: 1, capex: -1, diss: 1, div: 1 };
export const ovField = (rowId: string): string => (rowId === "adj2" ? "adj" : rowId);
export const isEditCol = (key: string): boolean => (key.charAt(0) === "q" && key.length <= 2) || key === "f22" || key === "f23";
export const isEditable = (rowId: string, colKey: string): boolean => OV_SIGN[ovField(rowId)] != null && isEditCol(colKey);

export function parseNum(input: string): number | null {
  let s = String(input).trim().replace(/,/g, "").replace(/\$/g, "");
  if (!s) return null;
  let neg = false;
  const m = s.match(/^\((.*)\)$/);
  if (m) { neg = true; s = m[1]; }
  const v = neg ? -parseFloat(s) : parseFloat(s);
  // Reject every non-finite result (NaN *and* ±Infinity): "1e999" parses to
  // Infinity, which would slip past a NaN-only guard and poison aggregates.
  if (!Number.isFinite(v)) return null;
  return v;
}
