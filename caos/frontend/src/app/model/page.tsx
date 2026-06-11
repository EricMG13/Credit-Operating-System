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

  // evidence modal cited-by needs the report set
  const reports = useMemo(() => buildReports(), []);

  useEffect(() => {
    try {
      const o = JSON.parse(localStorage.getItem("caos-d-overrides") || "{}");
      if (o && typeof o === "object") setOverrides(o);
      const s = parseFloat(localStorage.getItem("caos-d-severity") || "");
      if (s >= 0.5 && s <= 1.5) setSeverity(s);
    } catch { /* first visit */ }
  }, []);
  useEffect(() => { try { localStorage.setItem("caos-d-overrides", JSON.stringify(overrides)); } catch {} }, [overrides]);
  useEffect(() => { try { localStorage.setItem("caos-d-severity", String(severity)); } catch {} }, [severity]);

  const model = useMemo(() => buildModel(severity, overrides), [severity, overrides]);
  const b1 = model.cols.b1, d0 = model.cols.d0;
  const ovCount = Object.keys(overrides).length;

  const commitEdit = (txt: string | null) => {
    if (!editing) return;
    if (txt != null) {
      const v = parseNum(txt);
      if (v != null) {
        const field = ovField(editing.row);
        const key = editing.col + ":" + field;
        const modelVal = v * OV_SIGN[field];
        setOverrides((o) => ({ ...o, [key]: modelVal }));
        setSel({ row: editing.row, col: editing.col });
      }
    }
    setEditing(null);
  };
  const resetCell = (key: string) => setOverrides((o) => { const n = { ...o }; delete n[key]; return n; });
  const resetAll = () => setOverrides({});

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
          onClick={() => exportModel(model, showQuarters, overrides)}
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
          sel={sel}
          severity={severity}
          overrides={overrides}
          onResetCell={resetCell}
          onOpenEvidence={setEvModal}
        />
        <Sheet
          model={model}
          showQ={showQuarters}
          hl={hl}
          sel={sel}
          onSel={setSel}
          editing={editing}
          onEdit={setEditing}
          onCommit={commitEdit}
        />
      </div>

      {evModal ? <EvidenceModal id={evModal} reports={reports} onClose={() => setEvModal(null)} /> : null}
    </div>
  );
}
