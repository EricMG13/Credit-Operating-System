"use client";

// Concept D — The Model Builder: cash-flow model constructed from upstream
// module outputs. Sheet grid with sourced rows, build-manifest tracing,
// formula bar with E-xx lineage, manual overrides with recompute, downside
// severity control, and model export.

import { useEffect, useMemo, useState } from "react";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { PageSubHeader } from "@/components/shared/PageSubHeader";
import { EvidenceModal } from "@/components/reports/EvidenceModal";
import { FormulaBar, Manifest, Sheet, type CellRef } from "@/components/model/ModelSheet";
import { ScenarioPanel } from "@/components/model/ScenarioPanel";
import { AssumptionsPanel } from "@/components/model/AssumptionsPanel";
import { exportModel } from "@/components/model/export";
import { OV_SIGN, ovField, parseNum } from "@/components/model/rows";
import { buildModel, type Model, type Overrides } from "@/lib/reports/model";
import {
  type Assumptions, type CaseAssumptions, DEFAULT_ASSUMPTIONS, DEFAULT_CASE, loadAssumptions, saveAssumptions,
} from "@/lib/reports/assumptions";
import { buildReports } from "@/lib/reports/builders";
import { useModelEngine, type ModelEngineState } from "@/lib/engine/useModelEngine";
import { ATLF_REFERENCE_ISSUER_ID } from "@/lib/engine/types";

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
  const [showScenarios, setShowScenarios] = useState(true);
  const [showAssumptions, setShowAssumptions] = useState(true);
  const [editing, setEditing] = useState<CellRef | null>(null);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [hydrated, setHydrated] = useState(false);

  // evidence modal cited-by needs the report set
  const reports = useMemo(() => buildReports(), []);

  useEffect(() => {
    try {
      const o = JSON.parse(localStorage.getItem("caos-d-overrides") || "{}");
      if (o && typeof o === "object") setOverrides(o);
      const s = parseFloat(localStorage.getItem("caos-d-severity") || "");
      if (s >= 0.5 && s <= 1.5) setSeverity(s);
      setAssumptions(loadAssumptions());
    } catch { /* first visit */ }
    setHydrated(true);
  }, []);
  // persist only after restore — writing earlier clobbers stored state with defaults
  useEffect(() => { if (hydrated) try { localStorage.setItem("caos-d-overrides", JSON.stringify(overrides)); } catch {} }, [hydrated, overrides]);
  useEffect(() => { if (hydrated) try { localStorage.setItem("caos-d-severity", String(severity)); } catch {} }, [hydrated, severity]);
  useEffect(() => { if (hydrated) saveAssumptions(assumptions); }, [hydrated, assumptions]);

  // Prefer a live CP-1 run for the LTM/PF anchor; falls back to the seeded
  // model when no run / no backend (offline demo unaffected).
  const eng = useModelEngine(ATLF_REFERENCE_ISSUER_ID);
  const model = useMemo(
    () => buildModel(severity, overrides, eng.anchor ?? undefined, assumptions),
    [severity, overrides, eng.anchor, assumptions],
  );
  const b1 = model.cols.b1, d0 = model.cols.d0;
  const ovCount = Object.keys(overrides).length;

  const commitEdit = (txt: string | null) => {
    if (!editing) return;
    if (txt != null) {
      const v = parseNum(txt);
      if (v != null) {
        const field = ovField(editing.row);
        const key = editing.col + ":" + field;
        setOverrides((o) => ({ ...o, [key]: v * OV_SIGN[field] }));
        setSel({ row: editing.row, col: editing.col });
      }
    }
    setEditing(null);
  };
  const resetCell = (key: string) => setOverrides((o) => { const n = { ...o }; delete n[key]; return n; });
  const resetAll = () => setOverrides({});

  const setAsmp = (caseKey: "base" | "down", field: keyof CaseAssumptions, value: number) =>
    setAssumptions((a) => ({ ...a, [caseKey]: { ...a[caseKey], [field]: value } }));
  const resetCase = (caseKey: "base" | "down") =>
    setAssumptions((a) => ({ ...a, [caseKey]: { ...DEFAULT_CASE } }));

  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      {/* sub-header */}
      <PageSubHeader gap="gap-3">
        <span className="tabular text-caos-md text-caos-accent whitespace-nowrap">MODEL M-118</span>
        <span className="text-caos-xl text-caos-text font-medium whitespace-nowrap">Atlas Forge — cash-flow model</span>
        <ModelProvenance eng={eng} model={model} />
        <span className="tabular text-caos-sm text-caos-muted whitespace-nowrap truncate min-w-0 hidden xl:inline">
          dbl-click historical cells to override
        </span>
        <span className="flex-1"></span>
        <span className="flex items-center gap-1.5 tabular text-caos-xs whitespace-nowrap">
          <span className="w-2 h-2 rounded-sm" style={{ background: "var(--caos-success)" }}></span>
          <span className="text-caos-muted">BASE · net lev FY27e</span>
          <span style={{ color: "var(--caos-success)" }}>{b1.netlev?.toFixed(2) ?? "—"}x</span>
        </span>
        <span className="flex items-center gap-1.5 tabular text-caos-xs whitespace-nowrap">
          <span className="w-2 h-2 rounded-sm" style={{ background: "var(--caos-warning)" }}></span>
          <span className="text-caos-muted">DOWNSIDE · peak</span>
          <span style={{ color: "var(--caos-warning)" }}>{d0.netlev?.toFixed(2) ?? "—"}x</span>
        </span>
        <span className="h-4 w-px bg-caos-border" />
        {/* downside severity */}
        <span className="flex items-center gap-1.5 tabular text-caos-xs whitespace-nowrap text-caos-muted">
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
            "tabular text-caos-xs px-1.5 h-6 rounded border transition-caos whitespace-nowrap " +
            (showQuarters ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
          }
        >
          QUARTERS
        </button>
        <button
          onClick={() => setShowAssumptions(!showAssumptions)}
          title="Toggle the Assumptions panel — sliders to nudge the agent's base/downside forecast drivers"
          className={
            "tabular text-caos-xs px-1.5 h-6 rounded border transition-caos whitespace-nowrap " +
            (showAssumptions ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
          }
        >
          ASSUMPTIONS
        </button>
        <button
          onClick={() => setShowScenarios(!showScenarios)}
          title="Toggle the forward Scenario & Sensitivity panel (best/base/worst + tornado)"
          className={
            "tabular text-caos-xs px-1.5 h-6 rounded border transition-caos whitespace-nowrap " +
            (showScenarios ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
          }
        >
          SCENARIOS
        </button>
        {ovCount ? (
          <button
            onClick={resetAll}
            title="Clear all manual overrides"
            className="flex items-center gap-1.5 tabular text-caos-xs px-2 py-1 rounded border transition-caos whitespace-nowrap hover:bg-caos-elevated"
            style={{ color: "var(--caos-warning)", borderColor: "rgba(245,165,36,0.5)" }}
          >
            ↶ {ovCount} OVERRIDE{ovCount > 1 ? "S" : ""} · RESET
          </button>
        ) : null}
        <button
          onClick={() => exportModel(model, showQuarters, overrides)}
          title="Export the model grid (CSV — opens in Excel)"
          className="flex items-center gap-1.5 tabular text-caos-xs px-2 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos whitespace-nowrap"
        >
          ▦ EXPORT MODEL
        </button>
        <span
          className="tabular text-caos-xs uppercase tracking-wide px-1.5 py-px rounded border whitespace-nowrap hidden 2xl:inline"
          style={{ color: "var(--caos-warning)", borderColor: "rgba(245,165,36,0.4)", background: "rgba(245,165,36,0.08)" }}
        >
          forecast cells unaudited — CP-5 scope is actuals only
        </span>
      </PageSubHeader>

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
        <div className="flex-1 min-h-0 flex gap-2">
          {showAssumptions ? (
            <AssumptionsPanel assumptions={assumptions} onChange={setAsmp} onResetCase={resetCase} />
          ) : null}
          <div className="flex-1 min-w-0 min-h-0 flex">
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
          {showScenarios ? <ScenarioPanel model={model} /> : null}
        </div>
      </div>

      {evModal ? <EvidenceModal id={evModal} reports={reports} onClose={() => setEvModal(null)} /> : null}
    </div>
  );
}

// Engine provenance for the sub-header: whether the LTM/PF anchor is grounded in
// a live CP-1 run or the seeded demo model, plus a tie-out reconciling the
// model's own LTM net leverage against CP-1's reported figure. Status is always
// glyph-paired (dot / ✓ / ⚠), never carried by color alone.
function ModelProvenance({ eng, model }: { eng: ModelEngineState; model: Model }) {
  if (eng.loading) {
    return <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">· linking engine…</span>;
  }
  if (!eng.live || !eng.anchor) {
    return (
      <span
        className="flex items-center gap-1.5 tabular text-caos-xs whitespace-nowrap text-caos-muted"
        title="No completed run found — grid uses the seeded demo model (offline fallback)."
      >
        <span className="w-1.5 h-1.5 rounded-sm" style={{ background: "var(--caos-idle)" }} />
        SEEDED · demo RUN #2641
      </span>
    );
  }
  const live = eng.anchor.netLeverage;
  const drift = Math.abs(model.provenance.seededLtmNetlev - live);
  const ok = drift <= 0.05;
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span
        className="flex items-center gap-1.5 tabular text-caos-xs"
        style={{ color: "var(--caos-success)" }}
        title={`Anchored to live CP-1 from run ${eng.runId} · committee: ${eng.committeeStatus ?? "—"}`}
      >
        <span className="w-1.5 h-1.5 rounded-sm" style={{ background: "var(--caos-success)" }} />
        CP-1 LIVE · RUN {eng.runId?.slice(0, 8) ?? "—"}
      </span>
      <span
        className="flex items-center gap-1 tabular text-caos-xs px-1.5 py-px rounded border"
        style={
          ok
            ? { color: "var(--caos-success)", borderColor: "rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.08)" }
            : { color: "var(--caos-warning)", borderColor: "rgba(245,165,36,0.4)", background: "rgba(245,165,36,0.08)" }
        }
        title={`Model's independently-built LTM net leverage (${model.provenance.seededLtmNetlev.toFixed(2)}x) vs CP-1 reported (${live.toFixed(2)}x).`}
      >
        {ok ? <>✓ ties to CP-1 {live.toFixed(2)}x</> : <><StatusGlyph kind="warning" /> Δ{drift.toFixed(2)}x vs CP-1 {live.toFixed(2)}x</>}
      </span>
    </span>
  );
}
