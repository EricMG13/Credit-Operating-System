"use client";

// Model Builder sheet grid + formula bar + manifest strip
// (port of design bundle concept-d.jsx Sheet / FormulaBar / Manifest).
// Sourced cash-flow grid: every cell traces to an upstream module; historical
// cells are double-click editable (manual overrides), forecast cells are derived.

import { useMemo } from "react";
import type { Model, ModelCol } from "@/lib/reports/model";
import type { Overrides } from "@/lib/reports/model";
import { EvChip } from "@/components/reports/EvidenceModal";
import { ROWS, SRC } from "./rows";
import { CW, fmt, GROUPS_META, isEditable, LBL, ovField } from "./model-format";
import { cellBackground, cellBoxShadow, cellTextColor } from "./cell-style";

export interface CellRef {
  row: string;
  col: string;
}

interface ColDef {
  key: string;
  group: string;
  ctx: ModelCol;
  w: number;
  gap: boolean;
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
      className="w-full tabular text-caos-xs text-right bg-caos-elevated outline-none px-0.5 rounded-sm"
      style={{ height: 15, border: "1px solid var(--caos-accent)", color: "var(--caos-text)" }}
    />
  );
}

/* ---------- the sheet ---------- */
export function Sheet({
  model, showQ, hl, hlCells, sel, onSel, editing, onEdit, onCommit, collapsedRows, onToggleRow,
}: {
  model: Model;
  showQ: boolean;
  hl: string | null;
  /** "rowId:colKey" cells to flash while an assumption driver is being scrubbed. */
  hlCells?: Set<string> | null;
  sel: CellRef | null;
  onSel: (s: CellRef) => void;
  editing: CellRef | null;
  onEdit: (e: CellRef) => void;
  onCommit: (value: string | null) => void;
  collapsedRows?: Set<string>;
  onToggleRow?: (row: string) => void;
}) {
  const colDefs: ColDef[] = useMemo(() => {
    const list = model.columns.filter((c) => showQ || c.group !== "Q");
    return list.map((c, i) => ({
      ...c, ctx: model.cols[c.key], w: CW[c.group],
      gap: i > 0 && list[i - 1].group !== c.group,
    }));
  }, [model, showQ]);

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
  const collapseChildren: Record<string, string[]> = {
    rev: ["segD", "gsegD", "segF", "gsegF", "segA", "gsegA"],
    adj: ROWS.filter((r) => r.id?.startsWith("ab")).map((r) => r.id!).filter((id) => id !== "ab"),
    secured: ["rcf", "tlb", "ssn"],
    tdebt: ["rcf", "tlb", "ssn", "sub"],
  };
  const hidden = new Set(Object.entries(collapseChildren).flatMap(([parent, kids]) => collapsedRows?.has(parent) ? kids : []));

  const labelColor = (c: ColDef) =>
    c.ctx.derived ? "var(--caos-warning)" : c.group === "BASE" ? "var(--caos-success)" : c.group === "DOWN" ? "var(--caos-warning)" : "var(--caos-muted)";

  const renderCell = (rowId: string, c: ColDef, opts: { bold?: 1; pct?: 1; shade?: 1; line?: 1; isHl?: boolean }) => {
    const isSel = sel != null && sel.row === rowId && sel.col === c.key;
    const colHl = hlGroup === c.group;
    const cellHl = !!hlCells && hlCells.has(rowId + ":" + c.key);
    const isEditing = editing != null && editing.row === rowId && editing.col === c.key;

    const row = ROWS.find((r) => r.id === rowId)!;
    const v = row.g!(c.ctx);
    const field = ovField(rowId);
    const editable = isEditable(rowId, c.key);
    const isOv = editable && !!c.ctx.ov && !!c.ctx.ov[field];
    const display = fmt(v, row.f);
    const color = cellTextColor({ rowId, v, isOv, pct: !!opts.pct, bold: !!opts.bold, rowFmt: row.f });

    return (
      <div
        key={c.key}
        onClick={() => onSel({ row: rowId, col: c.key })}
        onDoubleClick={() => { if (editable) onEdit({ row: rowId, col: c.key }); }}
        title={editable ? "double-click to override" : undefined}
        className="shrink-0 text-right pr-1.5 cursor-cell"
        style={{
          width: c.w, marginLeft: c.gap ? 8 : 0,
          background: cellBackground({ isSel, cellHl, colHl, isHl: !!opts.isHl, shade: !!opts.shade }),
          borderTop: opts.line ? "1px solid var(--caos-border)" : "none",
          boxShadow: cellBoxShadow(isSel, cellHl),
        }}
      >
        {isEditing ? (
          <CellInput
            initial={v == null ? "" : String(Math.round(v * 10) / 10)}
            onCommit={onCommit}
          />
        ) : (
          <span
            className={"tabular text-caos-xs leading-[15px] whitespace-nowrap " + (opts.bold ? "font-semibold" : "")}
            style={{ color, borderBottom: isOv ? "1px dotted var(--caos-warning)" : "none" }}
          >
            {display}
          </span>
        )}
      </div>
    );
  };

  return (
    <div tabIndex={0} aria-label="Model worksheet" className="flex-1 min-h-0 overflow-auto rounded border border-caos-border bg-caos-bg focus-ring">
      <div style={{ width: "max-content", minWidth: "100%" }}>
        {/* group bar */}
        <div className="flex sticky top-0 z-30" style={{ background: "var(--caos-bg)" }}>
          <div className="sticky left-0 z-10 shrink-0 px-2 flex items-center" style={{ width: LBL, background: "var(--caos-bg)" }}>
            <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted whitespace-nowrap overflow-hidden">YE 31-Dec · $m</span>
          </div>
          {groups.map((gr, i) => (
            <div key={i} className="shrink-0 flex items-center justify-center" style={{ width: gr.w, marginLeft: gr.gap ? 8 : 0 }}>
              <div
                className="w-full mx-px h-[18px] my-[3px] flex items-center justify-center rounded-sm overflow-hidden"
                style={{ background: hlGroup === gr.group ? "var(--caos-accent)" : "rgba(79,140,255,0.16)", transition: "background 160ms" }}
              >
                <span className="tabular text-caos-2xs uppercase tracking-wider font-semibold whitespace-nowrap" style={{ color: hlGroup === gr.group ? "var(--caos-bg)" : "var(--caos-text)" }}>
                  {GROUPS_META[gr.group]}
                </span>
              </div>
            </div>
          ))}
        </div>
        {/* period labels */}
        <div className="flex sticky z-30 border-b border-caos-border" style={{ top: 24, background: "var(--caos-bg)" }}>
          <div className="sticky left-0 z-10 shrink-0" style={{ width: LBL, background: "var(--caos-bg)" }}></div>
          {colDefs.map((c) => (
            <div key={c.key} className="shrink-0 flex items-baseline justify-end pl-1 pr-1.5 pb-0.5" style={{ width: c.w, marginLeft: c.gap ? 8 : 0 }}>
              <span
                className="tabular text-caos-xs font-semibold whitespace-nowrap truncate"
                style={{ color: labelColor(c) }}
              >
                {c.ctx.label + (c.ctx.derived ? "*" : "")}
              </span>
            </div>
          ))}
        </div>

        {ROWS.filter((row) => !row.id || !hidden.has(row.id)).map((row, ri) => {
          if (row.sec) {
            return (
              <div key={"s" + ri} className="flex mt-1.5">
                <div className="sticky left-0 z-10 shrink-0 px-2 flex items-center" style={{ width: LBL, background: "var(--caos-bg)" }}>
                  <span className="text-caos-md font-semibold text-caos-text">{row.sec}</span>
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
          const collapsible = !!row.id && !!collapseChildren[row.id];
          const collapsed = !!row.id && !!collapsedRows?.has(row.id);
          return (
            <div
              key={row.id}
              onDoubleClick={() => collapsible && onToggleRow?.(row.id!)}
              className="flex group"
              style={{ background: isHl ? "rgba(79,140,255,0.10)" : "transparent" }}
            >
              <div
                className="sticky left-0 z-10 shrink-0 flex items-baseline gap-1.5 px-2"
                style={{ width: LBL, background: isHl ? "#15202f" : "var(--caos-bg)", borderTop: row.line ? "1px solid var(--caos-border)" : "none" }}
              >
                {collapsible ? (
                  <button
                    onClick={() => onToggleRow?.(row.id!)}
                    title={collapsed ? "Expand account rows" : "Collapse account rows"}
                    className="tabular text-caos-3xs text-caos-accent focus-ring"
                  >
                    {collapsed ? "▸" : "▾"}
                  </button>
                ) : null}
                <span className={"text-caos-sm leading-[15px] whitespace-nowrap " + (row.bold ? "font-semibold text-caos-text" : "text-caos-text/80")} style={{ paddingLeft: row.ind ? 8 : 0 }}>
                  {row.l}
                </span>
                {row.sub ? <span className="tabular text-caos-3xs text-caos-muted ml-auto whitespace-nowrap">{row.sub}</span> : null}
              </div>
              {colDefs.map((c) => renderCell(row.id!, c, { bold: row.bold, pct: row.pct, shade: row.shade, line: row.line, isHl }))}
            </div>
          );
        })}
        <div className="h-2"></div>
      </div>
    </div>
  );
}

/* ---------- formula bar ---------- */
// Flat sequence of conditional readouts (address, value, override badge, case
// note, source chips) — cyclomatic is inflated by display branches, not control
// flow. Extracting would scatter the bar's layout for no real simplification.
// fallow-ignore-next-line complexity
export function FormulaBar({
  model, sel, severity, overrides, onResetCell, onOpenEvidence,
}: {
  model: Model;
  sel: CellRef | null;
  severity: number;
  overrides: Overrides;
  onResetCell: (key: string) => void;
  onOpenEvidence: (id: string) => void;
}) {
  if (!sel) {
    return (
      <div className="h-8 shrink-0 rounded border border-caos-border bg-caos-panel/60 px-3 flex items-center gap-2">
        <span className="tabular text-caos-xl text-caos-muted">ƒ</span>
        <span className="tabular text-caos-sm text-caos-muted">select any cell to trace its formula and source lineage · double-click historical cells to override</span>
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
      <span className="tabular text-caos-xl text-caos-accent">ƒ</span>
      <span className="tabular text-caos-md text-caos-text whitespace-nowrap">{row.l} · {ctx.label}</span>
      <span className="tabular text-caos-md text-caos-accent whitespace-nowrap">{fmt(v, row.f) || "—"}</span>
      <span className="w-px h-4 bg-caos-border shrink-0"></span>
      {isOv ? (
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="tabular text-caos-xs uppercase tracking-wide px-1.5 py-px rounded border whitespace-nowrap" style={{ color: "var(--caos-warning)", borderColor: "rgba(245,165,36,0.4)", background: "rgba(245,165,36,0.08)" }}>
            MANUAL OVERRIDE
          </span>
          <span className="text-caos-sm text-caos-muted whitespace-nowrap">analyst input replaces sourced actual · aggregates recomputed</span>
          <button
            onClick={() => onResetCell(ovKey)}
            className="tabular text-caos-xs px-1.5 py-0.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos whitespace-nowrap"
          >
            RESET CELL
          </button>
        </span>
      ) : (
        <span className="text-caos-sm text-caos-muted truncate">{row.formula || `${row.l} — sourced from ${src ? src.name : "model logic"}`}</span>
      )}
      {!isOv && editable ? <span className="tabular text-caos-xs whitespace-nowrap text-caos-accent">✎ historical input — double-click to override</span> : null}
      {caseNote ? (
        <span className="tabular text-caos-xs whitespace-nowrap" style={{ color: ctx.kind === "d" || ctx.derived ? "var(--caos-warning)" : "var(--caos-success)" }}>
          ▸ {caseNote}
        </span>
      ) : null}
      <span className="flex-1"></span>
      {src ? (
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">{src.chip}</span>
          {src.warn ? (
            <span className="tabular text-caos-xs uppercase tracking-wide px-1.5 py-px rounded border whitespace-nowrap" style={{ color: "var(--caos-warning)", borderColor: "rgba(245,165,36,0.4)", background: "rgba(245,165,36,0.08)" }}>
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
      <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted whitespace-nowrap">Built from</span>
      {Object.entries(SRC).map(([k, s]) => (
        <button
          key={k}
          onClick={() => setHl(hl === k ? null : k)}
          title={s.name + (s.note ? " · " + s.note : "")}
          className={
            "flex items-center gap-1.5 tabular text-caos-xs px-2 py-1 rounded border transition-caos whitespace-nowrap " +
            (hl === k ? "border-caos-accent bg-caos-elevated text-caos-text" : "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50")
          }
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.warn ? "var(--caos-warning)" : "var(--caos-success)" }} />
          {s.chip}
        </button>
      ))}
      <span className="flex-1"></span>
      <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">click a module to trace which rows it feeds</span>
    </div>
  );
}
