// Concept D spreadsheet layer — analyst-added rows and columns over the M-118
// model grid, with Excel-style cell addresses (column letters / row numbers)
// and basic arithmetic formulas: =M4*1.05, =(B5+C5)/2, =R5-R6, 12%.
//
// Shared by the Model Builder (/model) and the Report Studio builders
// (/reports) so analyst sheet edits flow into the committee deliverables.

import type { Model } from "@/lib/reports/model";
import { parseNum, ROWS } from "@/components/model/rows";

export interface CustomRow { id: string; label: string }
export interface CustomColumn { key: string; label: string }

export interface SheetState {
  rows: CustomRow[];
  cols: CustomColumn[];
  cells: Record<string, string>; // "colKey:rowId" -> raw input ("450" or "=M4+N4")
}

export const EMPTY_SHEET: SheetState = { rows: [], cols: [], cells: {} };

export function loadSheet(): SheetState {
  try {
    const s = JSON.parse(localStorage.getItem("caos-d-sheet") || "null");
    if (s && Array.isArray(s.rows) && Array.isArray(s.cols) && s.cells && typeof s.cells === "object") return s;
  } catch { /* first visit */ }
  return EMPTY_SHEET;
}

export const cellKey = (colKey: string, rowId: string): string => colKey + ":" + rowId;
export const newRowId = (): string => "cr" + Math.random().toString(36).slice(2, 8);
export const newColKey = (): string => "cc" + Math.random().toString(36).slice(2, 8);

/* ---------- addresses ---------- */
export function colLetter(i: number): string { // 0 -> A, 25 -> Z, 26 -> AA
  let s = "";
  let n = i;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}
function letterIndex(s: string): number {
  let n = 0;
  for (const ch of s.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/* ---------- formula evaluation ---------- */
class FormulaError extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}

// expr := term (('+'|'-') term)* · term := factor (('*'|'/') factor)*
// factor := ('-'|'+') factor | number | cellRef | '(' expr ')' — each with optional '%'
function evalExpr(src: string, ref: (addr: string) => number): number {
  let i = 0;
  const ws = () => { while (i < src.length && src[i] === " ") i++; };
  const pct = (v: number): number => {
    ws();
    if (src[i] === "%") { i++; return v / 100; }
    return v;
  };
  function factor(): number {
    ws();
    if (src[i] === "-") { i++; return -factor(); }
    if (src[i] === "+") { i++; return factor(); }
    if (src[i] === "(") {
      i++;
      const v = expr();
      ws();
      if (src[i] !== ")") throw new FormulaError("#ERR");
      i++;
      return pct(v);
    }
    const num = src.slice(i).match(/^[0-9]*\.?[0-9]+/);
    if (num) { i += num[0].length; return pct(parseFloat(num[0])); }
    const cell = src.slice(i).match(/^[A-Za-z]+[0-9]+/);
    if (cell) { i += cell[0].length; return pct(ref(cell[0])); }
    throw new FormulaError("#ERR");
  }
  function term(): number {
    let v = factor();
    ws();
    while (src[i] === "*" || src[i] === "/") {
      const op = src[i++];
      const r = factor();
      v = op === "*" ? v * r : v / r;
      ws();
    }
    return v;
  }
  function expr(): number {
    let v = term();
    ws();
    while (src[i] === "+" || src[i] === "-") {
      const op = src[i++];
      const r = term();
      v = op === "+" ? v + r : v - r;
      ws();
    }
    return v;
  }
  const v = expr();
  ws();
  if (i < src.length) throw new FormulaError("#ERR");
  return v;
}

/* ---------- the addressable grid ---------- */
export interface CellVal { v: number | null; err?: string }

export interface Grid {
  colKeys: string[];           // data columns in address order (letter B onward; A is the label column)
  rowIds: (string | null)[];   // address order from row 1 (null = section line)
  colAddr: Record<string, string>;
  rowAddr: Record<string, number>;
  get: (colKey: string, rowId: string) => CellVal;
}

const ROW_DEF: Record<string, (typeof ROWS)[number]> = {};
ROWS.forEach((r) => { if (r.id) ROW_DEF[r.id] = r; });

export function buildGrid(model: Model, sheet: SheetState): Grid {
  const colKeys = [...model.columns.map((c) => c.key), ...sheet.cols.map((c) => c.key)];
  // ROWS order, then the always-present Analyst Rows section line, then custom rows
  const rowIds: (string | null)[] = [...ROWS.map((r) => r.id || null), null, ...sheet.rows.map((r) => r.id)];
  const colAddr: Record<string, string> = {};
  colKeys.forEach((k, i) => { colAddr[k] = colLetter(i + 1); });
  const rowAddr: Record<string, number> = {};
  rowIds.forEach((id, i) => { if (id) rowAddr[id] = i + 1; });
  const customCol = new Set(sheet.cols.map((c) => c.key));
  const customRow = new Set(sheet.rows.map((r) => r.id));

  const get = (colKey: string, rowId: string, stack: Set<string>): CellVal => {
    if (!customCol.has(colKey) && !customRow.has(rowId)) {
      const def = ROW_DEF[rowId];
      const ctx = model.cols[colKey];
      if (!def || !def.g || !ctx) return { v: null, err: "#REF" };
      const v = def.g(ctx);
      return { v: v == null || Number.isNaN(v) ? null : v };
    }
    const key = cellKey(colKey, rowId);
    const raw = sheet.cells[key];
    if (raw == null || raw.trim() === "") return { v: null };
    const t = raw.trim();
    if (t.charAt(0) !== "=") {
      const n = parseNum(t);
      return n == null ? { v: null, err: "#ERR" } : { v: n };
    }
    if (stack.has(key)) return { v: null, err: "#CYCLE" };
    stack.add(key);
    try {
      const v = evalExpr(t.slice(1), (addr) => {
        const m = addr.match(/^([A-Za-z]+)([0-9]+)$/)!;
        const ci = letterIndex(m[1]) - 1; // data columns start at letter B
        const ri = parseInt(m[2], 10) - 1;
        const ck = ci >= 0 ? colKeys[ci] : undefined;
        const rid = ri >= 0 ? rowIds[ri] : undefined;
        if (!ck || !rid) throw new FormulaError("#REF");
        const r = get(ck, rid, stack);
        if (r.err) throw new FormulaError(r.err);
        return r.v == null ? 0 : r.v; // empty referenced cells count as 0
      });
      stack.delete(key);
      return Number.isFinite(v) ? { v } : { v: null, err: "#DIV/0" };
    } catch (e) {
      stack.delete(key);
      return { v: null, err: e instanceof FormulaError ? e.code : "#ERR" };
    }
  };

  return { colKeys, rowIds, colAddr, rowAddr, get: (c, r) => get(c, r, new Set()) };
}

/* ---------- display ---------- */
export function fmtVal(c: CellVal | null | undefined): string {
  if (!c) return "";
  if (c.err) return c.err;
  const v = c.v;
  if (v == null || Number.isNaN(v)) return "";
  const a = Math.abs(v);
  const s = a >= 100
    ? Math.round(a).toLocaleString("en-US")
    : a.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return v < 0 ? "(" + s + ")" : s;
}
