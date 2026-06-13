"use client";

// Model Builder sheet grid + formula bar + manifest strip
// (port of design bundle concept-d.jsx Sheet / FormulaBar / Manifest),
// extended with an analyst spreadsheet layer: custom rows/columns with
// Excel-style addresses and basic arithmetic formulas (=M4*1.05).

import { useMemo, useState } from "react";
import type { Model, ModelCol } from "@/lib/reports/model";
import type { Overrides } from "@/lib/reports/model";
import { cellKey, fmtVal, type Grid, type SheetState } from "@/lib/model/sheet";
import { EvChip } from "@/components/reports/EvidenceModal";
import { CW, fmt, GROUPS_META, isEditable, LBL, ovField, ROWS, SRC } from "./rows";

export interface CellRef {
  row: string;
  col: string;
}

interface ColDef {
  key: string;
  group: string;
  ctx?: ModelCol;
  label?: string; // custom columns
  w: number;
  gap: boolean;
}

const CUSTOM_W = 76;

/* ---------- inline label rename ---------- */
function LabelInput({ value, onCommit }: { value: string; onCommit: (v: string | null) => void }) {
  return (
    <input
      autoFocus
      defaultValue={value}
      onFocus={(e) => e.target.select()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        const t = e.target as HTMLInputElement;
        if (e.key === "Enter") { t.dataset.done = "1"; onCommit(t.value); }
        else if (e.key === "Escape") { t.dataset.done = "1"; onCommit(null); }
      }}
      onBlur={(e) => { if (!e.target.dataset.done) onCommit(e.target.value); }}
      className="tabular text-[9px] bg-caos-elevated outline-none px-1 rounded-sm w-full"
      style={{ height: 15, border: "1px solid var(--caos-accent)", color: "var(--caos-text)" }}
    />
  );
}

/* ---------- cell editor ---------- */
function CellInput({ initial, onCommit }: { initial: string; onCommit: (v: string | null) => void }) {
  return (
    <input
      autoFocus
      defaultValue={initial}
      onFocus={(e) => e.target.select()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        const t = e.target as HTMLInputElement;
        if (e.key === "Enter") { t.dataset.done = "1"; onCommit(t.value); }
        else if (e.key === "Escape") { t.dataset.done = "1"; onCommit(null); }
      }}
      onBlur={(e) => { if (!e.target.dataset.done) onCommit(e.target.value); }}
      className="w-full tabular text-[9px] text-right bg-caos-elevated outline-none px-0.5 rounded-sm"
      style={{ height: 15, border: "1px solid var(--caos-accent)", color: "var(--caos-text)" }}
    />
  );
}

/* ---------- the sheet ---------- */
export function Sheet({
  model, sheet, grid, showQ, hl, sel, onSel, editing, onEdit, onCommit,
  onAddRow, onRenameRow, onDeleteRow, onRenameCol, onDeleteCol,
}: {
  model: Model;
  sheet: SheetState;
  grid: Grid;
  showQ: boolean;
  hl: string | null;
  sel: CellRef | null;
  onSel: (s: CellRef) => void;
  editing: CellRef | null;
  onEdit: (e: CellRef) => void;
  onCommit: (value: string | null) => void;
  onAddRow: () => void;
  onRenameRow: (id: string, label: string) => void;
  onDeleteRow: (id: string) => void;
  onRenameCol: (key: string, label: string) => void;
  onDeleteCol: (key: string) => void;
}) {
  const [renaming, setRenaming] = useState<{ kind: "row" | "col"; id: string } | null>(null);

  const colDefs: ColDef[] = useMemo(() => {
    const list = model.columns.filter((c) => showQ || c.group !== "Q");
    const defs: ColDef[] = list.map((c, i) => ({
      ...c, ctx: model.cols[c.key], w: CW[c.group],
      gap: i > 0 && list[i - 1].group !== c.group,
    }));
    sheet.cols.forEach((cc, j) => defs.push({ key: cc.key, group: "CUSTOM", label: cc.label, w: CUSTOM_W, gap: j === 0 }));
    return defs;
  }, [model, showQ, sheet.cols]);

  const groups = useMemo(() => {
    const out: { group: string; w: number; n: number; gap: boolean }[] = [];
    colDefs.forEach((c) => {
      const last = out[out.length - 1];
      if (last && last.group === c.group) { last.w += c.w; last.n++; }
      else out.push({ group: c.group, w: c.w, n: 1, gap: c.gap });
    });
    return out;
  }, [colDefs]);

  const hlGroup = hl && SRC[hl] ? SRC[hl].colGroup : undefined;

  const labelColor = (c: ColDef) =>
    c.ctx?.derived ? "var(--caos-warning)" : c.group === "BASE" ? "var(--caos-success)" : c.group === "DOWN" ? "var(--caos-warning)" : c.group === "CUSTOM" ? "var(--caos-accent)" : "var(--caos-muted)";

  // a cell belongs to the analyst layer when its row or column is custom
  const isCustomCell = (rowId: string, colKey: string) =>
    colKey.startsWith("cc") || sheet.rows.some((r) => r.id === rowId);

  const renderCell = (rowId: string, c: ColDef, opts: { bold?: 1; pct?: 1; shade?: 1; line?: 1; f?: string; isHl?: boolean }) => {
    const custom = isCustomCell(rowId, c.key);
    const isSel = sel != null && sel.row === rowId && sel.col === c.key;
    const colHl = hlGroup === c.group;
    const isEditing = editing != null && editing.row === rowId && editing.col === c.key;
    const key = cellKey(c.key, rowId);
    const raw = sheet.cells[key];

    let display: string;
    let color: string;
    let editable: boolean;
    let isOv = false;
    if (custom) {
      const cv = grid.get(c.key, rowId);
      display = fmtVal(cv);
      color = cv.err ? "var(--caos-critical)" : raw && raw.trim().charAt(0) === "=" ? "var(--caos-accent)" : "rgba(230,230,239,0.82)";
      editable = true;
    } else {
      const row = ROWS.find((r) => r.id === rowId)!;
      const v = row.g!(c.ctx!);
      const field = ovField(rowId);
      editable = isEditable(rowId, c.key);
      isOv = editable && !!c.ctx!.ov && !!c.ctx!.ov[field];
      display = fmt(v, row.f);
      color = isOv ? "var(--caos-warning)" : opts.pct ? "rgba(79,140,255,0.9)" : v != null && v < 0 && row.f === "m" ? "var(--caos-muted)" : opts.bold ? "var(--caos-text)" : "rgba(230,230,239,0.82)";
    }

    return (
      <div
        key={c.key}
        onClick={() => onSel({ row: rowId, col: c.key })}
        onDoubleClick={() => { if (editable) onEdit({ row: rowId, col: c.key }); }}
        title={custom ? (raw && raw.trim().charAt(0) === "=" ? raw : "double-click to enter a value or =formula") : editable ? "double-click to override" : undefined}
        className="shrink-0 text-right pr-1.5 cursor-cell"
        style={{
          width: c.w, marginLeft: c.gap ? 8 : 0,
          background: isSel ? "rgba(79,140,255,0.22)" : colHl || opts.isHl ? "rgba(79,140,255,0.08)" : opts.shade ? "rgba(255,255,255,0.025)" : "transparent",
          borderTop: opts.line ? "1px solid var(--caos-border)" : "none",
          boxShadow: isSel ? "inset 0 0 0 1px var(--caos-accent)" : "none",
        }}
      >
        {isEditing ? (
          <CellInput
            initial={custom ? (raw || "") : (() => { const row = ROWS.find((r) => r.id === rowId)!; const v = row.g!(c.ctx!); return v == null ? "" : String(Math.round(v * 10) / 10); })()}
            onCommit={onCommit}
          />
        ) : (
          <span
            className={"tabular text-[9px] leading-[15px] whitespace-nowrap " + (opts.bold ? "font-semibold" : "")}
            style={{ color, borderBottom: isOv ? "1px dotted var(--caos-warning)" : "none" }}
          >
            {display}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto rounded border border-caos-border bg-caos-bg">
      <div style={{ width: "max-content", minWidth: "100%" }}>
        {/* group bar */}
        <div className="flex sticky top-0 z-30" style={{ background: "var(--caos-bg)" }}>
          <div className="sticky left-0 z-10 shrink-0 px-2 flex items-center" style={{ width: LBL, background: "var(--caos-bg)" }}>
            <span className="tabular text-[8.5px] uppercase tracking-widest text-caos-muted whitespace-nowrap overflow-hidden">YE 31-Dec · $m</span>
          </div>
          {groups.map((gr, i) => (
            <div key={i} className="shrink-0 flex items-center justify-center" style={{ width: gr.w, marginLeft: gr.gap ? 8 : 0 }}>
              <div
                className="w-full mx-px h-[18px] my-[3px] flex items-center justify-center rounded-sm overflow-hidden"
                style={{ background: hlGroup === gr.group ? "var(--caos-accent)" : "rgba(79,140,255,0.16)", transition: "background 160ms" }}
              >
                <span className="tabular text-[8.5px] uppercase tracking-wider font-semibold whitespace-nowrap" style={{ color: hlGroup === gr.group ? "#0a0a0f" : "var(--caos-text)" }}>
                  {GROUPS_META[gr.group]}
                </span>
              </div>
            </div>
          ))}
        </div>
        {/* period labels + column letters */}
        <div className="flex sticky z-30 border-b border-caos-border" style={{ top: 24, background: "var(--caos-bg)" }}>
          <div className="sticky left-0 z-10 shrink-0" style={{ width: LBL, background: "var(--caos-bg)" }}></div>
          {colDefs.map((c) => {
            const custom = c.group === "CUSTOM";
            return (
              <div key={c.key} className="shrink-0 flex items-baseline justify-between pl-1 pr-1.5 pb-0.5 group/col" style={{ width: c.w, marginLeft: c.gap ? 8 : 0 }}>
                <span className="tabular text-[8px] text-caos-muted whitespace-nowrap">{grid.colAddr[c.key]}</span>
                {custom && renaming?.kind === "col" && renaming.id === c.key ? (
                  <LabelInput value={c.label || ""} onCommit={(v) => { if (v != null && v.trim()) onRenameCol(c.key, v.trim()); setRenaming(null); }} />
                ) : (
                  <span className="flex items-baseline gap-1 min-w-0">
                    {custom ? (
                      <button
                        onClick={() => onDeleteCol(c.key)}
                        title="Delete column"
                        className="tabular text-[8px] text-caos-muted/0 group-hover/col:text-caos-muted hover:!text-caos-critical transition-caos"
                      >
                        ✕
                      </button>
                    ) : null}
                    <span
                      onDoubleClick={custom ? () => setRenaming({ kind: "col", id: c.key }) : undefined}
                      title={custom ? "double-click to rename" : undefined}
                      className="tabular text-[9px] font-semibold whitespace-nowrap truncate"
                      style={{ color: labelColor(c) }}
                    >
                      {custom ? c.label : c.ctx!.label + (c.ctx!.derived ? "*" : "")}
                    </span>
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {ROWS.map((row, ri) => {
          if (row.sec) {
            return (
              <div key={"s" + ri} className="flex mt-1.5">
                <div className="sticky left-0 z-10 shrink-0 px-2 flex items-center" style={{ width: LBL, background: "var(--caos-bg)" }}>
                  <span className="text-[10px] font-semibold text-caos-text">{row.sec}</span>
                </div>
                {groups.map((gr, i) => (
                  <div key={i} className="shrink-0 flex items-center" style={{ width: gr.w, marginLeft: gr.gap ? 8 : 0 }}>
                    <div className="w-full mx-px h-[13px] rounded-sm" style={{ background: "rgba(79,140,255,0.16)" }}></div>
                  </div>
                ))}
              </div>
            );
          }
          const isHl = hl != null && row.src === hl;
          return (
            <div key={row.id} className="flex group" style={{ background: isHl ? "rgba(79,140,255,0.10)" : "transparent" }}>
              <div
                className="sticky left-0 z-10 shrink-0 flex items-baseline gap-1.5 px-2"
                style={{ width: LBL, background: isHl ? "#15202f" : "var(--caos-bg)", borderTop: row.line ? "1px solid var(--caos-border)" : "none" }}
              >
                <span className="tabular text-[8px] leading-[15px] text-caos-muted w-3.5 text-right shrink-0">{grid.rowAddr[row.id!]}</span>
                <span className={"text-[9.5px] leading-[15px] whitespace-nowrap " + (row.bold ? "font-semibold text-caos-text" : "text-caos-text/80")} style={{ paddingLeft: row.ind ? 8 : 0 }}>
                  {row.l}
                </span>
                {row.sub ? <span className="tabular text-[8px] text-caos-muted ml-auto whitespace-nowrap">{row.sub}</span> : null}
              </div>
              {colDefs.map((c) => renderCell(row.id!, c, { bold: row.bold, pct: row.pct, shade: row.shade, line: row.line, isHl }))}
            </div>
          );
        })}

        {/* analyst rows */}
        <div className="flex mt-1.5">
          <div className="sticky left-0 z-10 shrink-0 px-2 flex items-center gap-2" style={{ width: LBL, background: "var(--caos-bg)" }}>
            <span className="text-[10px] font-semibold text-caos-text">Analyst Rows</span>
            <button
              onClick={onAddRow}
              title="Add an analyst row — cells accept numbers or =formulas"
              className="tabular text-[8.5px] px-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos whitespace-nowrap"
            >
              + ROW
            </button>
          </div>
          {groups.map((gr, i) => (
            <div key={i} className="shrink-0 flex items-center" style={{ width: gr.w, marginLeft: gr.gap ? 8 : 0 }}>
              <div className="w-full mx-px h-[13px] rounded-sm" style={{ background: "rgba(79,140,255,0.16)" }}></div>
            </div>
          ))}
        </div>
        {sheet.rows.map((r) => (
          <div key={r.id} className="flex group">
            <div className="sticky left-0 z-10 shrink-0 flex items-baseline gap-1.5 px-2" style={{ width: LBL, background: "var(--caos-bg)" }}>
              <span className="tabular text-[8px] leading-[15px] text-caos-muted w-3.5 text-right shrink-0">{grid.rowAddr[r.id]}</span>
              {renaming?.kind === "row" && renaming.id === r.id ? (
                <LabelInput value={r.label} onCommit={(v) => { if (v != null && v.trim()) onRenameRow(r.id, v.trim()); setRenaming(null); }} />
              ) : (
                <>
                  <span
                    onDoubleClick={() => setRenaming({ kind: "row", id: r.id })}
                    title="double-click to rename"
                    className="text-[9.5px] leading-[15px] whitespace-nowrap truncate text-caos-text/80"
                  >
                    {r.label}
                  </span>
                  <button
                    onClick={() => onDeleteRow(r.id)}
                    title="Delete row"
                    className="tabular text-[8px] ml-auto text-caos-muted/0 group-hover:text-caos-muted hover:!text-caos-critical transition-caos"
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
            {colDefs.map((c) => renderCell(r.id, c, {}))}
          </div>
        ))}
        <div className="h-2"></div>
      </div>
    </div>
  );
}

/* ---------- formula bar ---------- */
export function FormulaBar({
  model, sheet, grid, sel, severity, overrides, onResetCell, onClearCell, onOpenEvidence,
}: {
  model: Model;
  sheet: SheetState;
  grid: Grid;
  sel: CellRef | null;
  severity: number;
  overrides: Overrides;
  onResetCell: (key: string) => void;
  onClearCell: (key: string) => void;
  onOpenEvidence: (id: string) => void;
}) {
  if (!sel) {
    return (
      <div className="h-8 shrink-0 rounded border border-caos-border bg-caos-panel/60 px-3 flex items-center gap-2">
        <span className="tabular text-[11px] text-caos-muted">ƒ</span>
        <span className="tabular text-[9.5px] text-caos-muted">select any cell to trace its formula and source lineage · double-click historical cells to override · analyst cells accept =formulas (=M4*1.05)</span>
      </div>
    );
  }
  const addr = (grid.colAddr[sel.col] || "?") + (grid.rowAddr[sel.row] || "?");
  const customCol = sheet.cols.find((c) => c.key === sel.col);
  const customRow = sheet.rows.find((r) => r.id === sel.row);

  if (customCol || customRow) {
    const key = cellKey(sel.col, sel.row);
    const raw = sheet.cells[key];
    const cv = grid.get(sel.col, sel.row);
    const rowLabel = customRow ? customRow.label : ROWS.find((r) => r.id === sel.row)?.l || sel.row;
    const colLabel = customCol ? customCol.label : model.cols[sel.col]?.label || sel.col;
    return (
      <div className="h-8 shrink-0 rounded border border-caos-accent/40 bg-caos-panel/60 px-3 flex items-center gap-2.5 overflow-hidden">
        <span className="tabular text-[11px] text-caos-accent">ƒ</span>
        <span className="tabular text-[9.5px] text-caos-muted whitespace-nowrap">{addr}</span>
        <span className="tabular text-[10px] text-caos-text whitespace-nowrap">{rowLabel} · {colLabel}</span>
        <span className="tabular text-[10px] whitespace-nowrap" style={{ color: cv.err ? "var(--caos-critical)" : "var(--caos-accent)" }}>{fmtVal(cv) || "—"}</span>
        <span className="w-px h-4 bg-caos-border shrink-0"></span>
        {raw != null && raw.trim() !== "" ? (
          <>
            <span className="tabular text-[9.5px] text-caos-text whitespace-nowrap">{raw}</span>
            <button
              onClick={() => onClearCell(key)}
              className="tabular text-[9px] px-1.5 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos whitespace-nowrap"
            >
              CLEAR CELL
            </button>
          </>
        ) : (
          <span className="text-[9.5px] text-caos-muted truncate">empty analyst cell — double-click to enter a number or =formula</span>
        )}
        <span className="tabular text-[9px] whitespace-nowrap text-caos-accent">✎ basic arithmetic — cell refs + − × ÷ ( ) %, e.g. =R5-R6 or =M4*1.05</span>
        <span className="flex-1"></span>
      </div>
    );
  }

  const row = ROWS.find((r) => r.id === sel.row)!;
  const ctx = model.cols[sel.col];
  const src = row.src ? SRC[row.src] : null;
  const v = row.g!(ctx);
  const editable = isEditable(sel.row, sel.col);
  const ovKey = sel.col + ":" + ovField(sel.row);
  const isOv = editable && overrides && overrides[ovKey] != null;
  const caseNote = ctx.kind === "b" ? "base case = sponsor model − CP-6A chair haircut ($35M) − CP-1B phasing"
    : ctx.kind === "d" ? `downside = CP-2B pathway P1 (OEM destocking) at severity ×${severity.toFixed(2)}`
    : ctx.derived ? "derived period — Q4-25 management accounts missing (gap G-02)" : null;
  return (
    <div className="h-8 shrink-0 rounded border border-caos-accent/40 bg-caos-panel/60 px-3 flex items-center gap-2.5 overflow-hidden">
      <span className="tabular text-[11px] text-caos-accent">ƒ</span>
      <span className="tabular text-[9.5px] text-caos-muted whitespace-nowrap">{addr}</span>
      <span className="tabular text-[10px] text-caos-text whitespace-nowrap">{row.l} · {ctx.label}</span>
      <span className="tabular text-[10px] text-caos-accent whitespace-nowrap">{fmt(v, row.f) || "—"}</span>
      <span className="w-px h-4 bg-caos-border shrink-0"></span>
      {isOv ? (
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="tabular text-[9px] uppercase tracking-wide px-1.5 py-px rounded border whitespace-nowrap" style={{ color: "var(--caos-warning)", borderColor: "rgba(245,165,36,0.4)", background: "rgba(245,165,36,0.08)" }}>
            MANUAL OVERRIDE
          </span>
          <span className="text-[9.5px] text-caos-muted whitespace-nowrap">analyst input replaces sourced actual · aggregates recomputed</span>
          <button
            onClick={() => onResetCell(ovKey)}
            className="tabular text-[9px] px-1.5 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos whitespace-nowrap"
          >
            RESET CELL
          </button>
        </span>
      ) : (
        <span className="text-[9.5px] text-caos-muted truncate">{row.formula || `${row.l} — sourced from ${src ? src.name : "model logic"}`}</span>
      )}
      {!isOv && editable ? <span className="tabular text-[9px] whitespace-nowrap text-caos-accent">✎ historical input — double-click to override</span> : null}
      {caseNote ? (
        <span className="tabular text-[9px] whitespace-nowrap" style={{ color: ctx.kind === "d" || ctx.derived ? "var(--caos-warning)" : "var(--caos-success)" }}>
          ▸ {caseNote}
        </span>
      ) : null}
      <span className="flex-1"></span>
      {src ? (
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="tabular text-[9px] text-caos-muted whitespace-nowrap">{src.chip}</span>
          {src.warn ? (
            <span className="tabular text-[9px] uppercase tracking-wide px-1.5 py-px rounded border whitespace-nowrap" style={{ color: "var(--caos-warning)", borderColor: "rgba(245,165,36,0.4)", background: "rgba(245,165,36,0.08)" }}>
              {src.warn}
            </span>
          ) : null}
          {src.ev.map((e) => <EvChip key={e} id={e} onOpen={onOpenEvidence} />)}
        </span>
      ) : null}
    </div>
  );
}

/* ---------- build manifest strip ---------- */
export function Manifest({ hl, setHl }: { hl: string | null; setHl: (k: string | null) => void }) {
  return (
    <div className="h-9 shrink-0 rounded border border-caos-border bg-caos-panel/60 px-3 flex items-center gap-2 overflow-x-auto">
      <span className="tabular text-[8.5px] uppercase tracking-widest text-caos-muted whitespace-nowrap">Built from</span>
      {Object.entries(SRC).map(([k, s]) => (
        <button
          key={k}
          onClick={() => setHl(hl === k ? null : k)}
          title={s.name + (s.note ? " · " + s.note : "")}
          className={
            "flex items-center gap-1.5 tabular text-[9px] px-2 py-1 rounded border transition-caos whitespace-nowrap " +
            (hl === k ? "border-caos-accent bg-caos-elevated text-caos-text" : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50")
          }
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.warn ? "var(--caos-warning)" : "var(--caos-success)" }} />
          {s.chip}
        </button>
      ))}
      <span className="flex-1"></span>
      <span className="tabular text-[9px] text-caos-muted whitespace-nowrap">click a module to trace which rows it feeds</span>
    </div>
  );
}
