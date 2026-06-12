"use client";

// Concept D — The Model Builder: cash-flow model constructed from upstream
// module outputs. Sheet grid with sourced rows, build-manifest tracing,
// formula bar with E-xx lineage, manual overrides with recompute, downside
// severity control, and model export.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { EvidenceModal } from "@/components/reports/EvidenceModal";
import { FormulaBar, Manifest, Sheet, type CellRef } from "@/components/model/ModelSheet";
import { exportModel } from "@/components/model/export";
import { OV_SIGN, ovField, parseNum } from "@/components/model/rows";
import { buildModel, type Overrides } from "@/lib/reports/model";
import { buildReports } from "@/lib/reports/builders";
import {
  buildGrid, cellKey, EMPTY_SHEET, loadSheet, newColKey, newRowId, type SheetState,
} from "@/lib/model/sheet";

export default function ModelPage() {
  return (
    <RequireAuth>
      <ModelBuilder />
    </RequireAuth>
  );
}

function ModelBuilder() {
  const [hl, setHl] = useState<string | null>(null);
  const [sel, setSel] = useState<CellRef | null>({ row: "netlev", col: "l1" });
  const [evModal, setEvModal] = useState<string | null>(null);
  const [severity, setSeverity] = useState(1);
  const [showQuarters, setShowQuarters] = useState(true);
  const [editing, setEditing] = useState<CellRef | null>(null);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [sheet, setSheet] = useState<SheetState>(EMPTY_SHEET);
  const [hydrated, setHydrated] = useState(false);

  // evidence modal cited-by needs the report set
  const reports = useMemo(() => buildReports(), []);

  useEffect(() => {
    try {
      const o = JSON.parse(localStorage.getItem("caos-d-overrides") || "{}");
      if (o && typeof o === "object") setOverrides(o);
      const s = parseFloat(localStorage.getItem("caos-d-severity") || "");
      if (s >= 0.5 && s <= 1.5) setSeverity(s);
      setSheet(loadSheet());
    } catch { /* first visit */ }
    setHydrated(true);
  }, []);
  // persist only after restore — writing earlier clobbers stored state with defaults
  useEffect(() => { if (hydrated) try { localStorage.setItem("caos-d-overrides", JSON.stringify(overrides)); } catch {} }, [hydrated, overrides]);
  useEffect(() => { if (hydrated) try { localStorage.setItem("caos-d-severity", String(severity)); } catch {} }, [hydrated, severity]);
  useEffect(() => { if (hydrated) try { localStorage.setItem("caos-d-sheet", JSON.stringify(sheet)); } catch {} }, [hydrated, sheet]);

  const model = useMemo(() => buildModel(severity, overrides), [severity, overrides]);
  const grid = useMemo(() => buildGrid(model, sheet), [model, sheet]);
  const b1 = model.cols.b1, d0 = model.cols.d0;
  const ovCount = Object.keys(overrides).length;

  const isCustomCell = (ref: CellRef) =>
    sheet.cols.some((c) => c.key === ref.col) || sheet.rows.some((r) => r.id === ref.row);

  const commitEdit = (txt: string | null) => {
    if (!editing) return;
    if (txt != null) {
      if (isCustomCell(editing)) {
        const key = cellKey(editing.col, editing.row);
        const t = txt.trim();
        setSheet((s) => {
          const cells = { ...s.cells };
          if (t === "") delete cells[key];
          else cells[key] = t;
          return { ...s, cells };
        });
        setSel({ row: editing.row, col: editing.col });
      } else {
        const v = parseNum(txt);
        if (v != null) {
          const field = ovField(editing.row);
          const key = editing.col + ":" + field;
          const modelVal = v * OV_SIGN[field];
          setOverrides((o) => ({ ...o, [key]: modelVal }));
          setSel({ row: editing.row, col: editing.col });
        }
      }
    }
    setEditing(null);
  };
  const resetCell = (key: string) => setOverrides((o) => { const n = { ...o }; delete n[key]; return n; });
  const resetAll = () => setOverrides({});
  const clearCell = (key: string) => setSheet((s) => { const cells = { ...s.cells }; delete cells[key]; return { ...s, cells }; });

  const addRow = () => setSheet((s) => ({ ...s, rows: [...s.rows, { id: newRowId(), label: "Analyst row " + (s.rows.length + 1) }] }));
  const addCol = () => setSheet((s) => ({ ...s, cols: [...s.cols, { key: newColKey(), label: "Custom " + (s.cols.length + 1) }] }));
  const renameRow = (id: string, label: string) => setSheet((s) => ({ ...s, rows: s.rows.map((r) => (r.id === id ? { ...r, label } : r)) }));
  const renameCol = (key: string, label: string) => setSheet((s) => ({ ...s, cols: s.cols.map((c) => (c.key === key ? { ...c, label } : c)) }));
  const deleteRow = (id: string) => setSheet((s) => {
    const cells = Object.fromEntries(Object.entries(s.cells).filter(([k]) => k.split(":")[1] !== id));
    return { ...s, rows: s.rows.filter((r) => r.id !== id), cells };
  });
  const deleteCol = (key: string) => setSheet((s) => {
    const cells = Object.fromEntries(Object.entries(s.cells).filter(([k]) => k.split(":")[0] !== key));
    return { ...s, cols: s.cols.filter((c) => c.key !== key), cells };
  });

  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      {/* sub-header */}
      <div className="h-10 shrink-0 border-b border-caos-border bg-caos-panel/60 flex items-center gap-3 px-4">
        <Link href="/issuers" className="text-caos-muted hover:text-caos-text text-[11px] transition-caos whitespace-nowrap">
          ← Directory
        </Link>
        <div className="h-4 w-px bg-caos-border" />
        <ConceptNav compact />
        <div className="h-4 w-px bg-caos-border" />
        <span className="tabular text-[10px] text-caos-accent whitespace-nowrap">MODEL M-118</span>
        <span className="text-[11px] text-caos-text font-medium whitespace-nowrap">Atlas Forge — cash-flow model</span>
        <span className="tabular text-[9.5px] text-caos-muted whitespace-nowrap truncate min-w-0">
          constructed from RUN #2641 module outputs · dbl-click historical cells to override
        </span>
        <span className="flex-1"></span>
        <span className="flex items-center gap-1.5 tabular text-[9px] whitespace-nowrap">
          <span className="w-2 h-2 rounded-sm" style={{ background: "var(--caos-success)" }}></span>
          <span className="text-caos-muted">BASE · net lev FY27e</span>
          <span style={{ color: "var(--caos-success)" }}>{b1.netlev!.toFixed(2)}x</span>
        </span>
        <span className="flex items-center gap-1.5 tabular text-[9px] whitespace-nowrap">
          <span className="w-2 h-2 rounded-sm" style={{ background: "var(--caos-warning)" }}></span>
          <span className="text-caos-muted">DOWNSIDE · peak</span>
          <span style={{ color: "var(--caos-warning)" }}>{d0.netlev!.toFixed(2)}x</span>
        </span>
        <span className="h-4 w-px bg-caos-border" />
        {/* downside severity */}
        <span className="flex items-center gap-1.5 tabular text-[9px] whitespace-nowrap text-caos-muted">
          SEVERITY
          <input
            type="range" min={0.5} max={1.5} step={0.05} value={severity}
            onChange={(e) => setSeverity(parseFloat(e.target.value))}
            className="w-20 accent-[var(--caos-accent)]"
            title="Downside severity multiplier (CP-2B pathway P1)"
          />
          <span className="text-caos-text w-9">×{severity.toFixed(2)}</span>
        </span>
        <button
          onClick={() => setShowQuarters(!showQuarters)}
          className={
            "tabular text-[9px] px-1.5 h-6 rounded border transition-caos whitespace-nowrap " +
            (showQuarters ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
          }
        >
          QUARTERS
        </button>
        <button
          onClick={addRow}
          title="Add an analyst row at the bottom of the sheet — cells accept numbers or =formulas"
          className="tabular text-[9px] px-1.5 h-6 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos whitespace-nowrap"
        >
          + ROW
        </button>
        <button
          onClick={addCol}
          title="Add an analyst column at the right of the sheet — cells accept numbers or =formulas"
          className="tabular text-[9px] px-1.5 h-6 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos whitespace-nowrap"
        >
          + COL
        </button>
        {ovCount ? (
          <button
            onClick={resetAll}
            title="Clear all manual overrides"
            className="flex items-center gap-1.5 tabular text-[9px] px-2 py-1 rounded border transition-caos whitespace-nowrap hover:bg-caos-elevated"
            style={{ color: "var(--caos-warning)", borderColor: "rgba(245,165,36,0.5)" }}
          >
            ↶ {ovCount} OVERRIDE{ovCount > 1 ? "S" : ""} · RESET
          </button>
        ) : null}
        <button
          onClick={() => exportModel(model, showQuarters, overrides, sheet, grid)}
          title="Export the model grid (CSV — opens in Excel)"
          className="flex items-center gap-1.5 tabular text-[9px] px-2 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos whitespace-nowrap"
        >
          ▦ EXPORT MODEL
        </button>
        <span
          className="tabular text-[9px] uppercase tracking-wide px-1.5 py-px rounded border whitespace-nowrap hidden 2xl:inline"
          style={{ color: "var(--caos-warning)", borderColor: "rgba(245,165,36,0.4)", background: "rgba(245,165,36,0.08)" }}
        >
          forecast cells unaudited — CP-5 scope is actuals only
        </span>
      </div>

      {/* workspace */}
      <div className="flex-1 min-h-0 flex flex-col gap-2 p-2">
        <Manifest hl={hl} setHl={setHl} />
        <FormulaBar
          model={model}
          sheet={sheet}
          grid={grid}
          sel={sel}
          severity={severity}
          overrides={overrides}
          onResetCell={resetCell}
          onClearCell={clearCell}
          onOpenEvidence={setEvModal}
        />
        <Sheet
          model={model}
          sheet={sheet}
          grid={grid}
          showQ={showQuarters}
          hl={hl}
          sel={sel}
          onSel={setSel}
          editing={editing}
          onEdit={setEditing}
          onCommit={commitEdit}
          onAddRow={addRow}
          onRenameRow={renameRow}
          onDeleteRow={deleteRow}
          onRenameCol={renameCol}
          onDeleteCol={deleteCol}
        />
      </div>

      {evModal ? <EvidenceModal id={evModal} reports={reports} onClose={() => setEvModal(null)} /> : null}
    </div>
  );
}
