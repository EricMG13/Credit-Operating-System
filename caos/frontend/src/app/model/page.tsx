"use client";

// Concept D — The Model Builder: cash-flow model constructed from upstream
// module outputs. Sheet grid with sourced rows, build-manifest tracing,
// formula bar with E-xx lineage, manual overrides with recompute, downside
// severity control, and model export.

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StatusGlyph } from "@/components/shared/StatusGlyph";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { PageSubHeader } from "@/components/shared/PageSubHeader";
import { EvidenceModal } from "@/components/reports/EvidenceModal";
import { FormulaBar, Manifest, Sheet, type CellRef } from "@/components/model/ModelSheet";
import { ScenarioPanel } from "@/components/model/ScenarioPanel";
import { AssumptionsPanel } from "@/components/model/AssumptionsPanel";
import { CollapseButton } from "@/components/shared/CollapseButton";
import { exportModel } from "@/components/model/export";
import { OV_SIGN, ovField, parseNum } from "@/components/model/model-format";
import { ROWS } from "@/components/model/rows";
import { buildModel, type Model, type Overrides } from "@/lib/reports/model";
import {
  type Assumptions, type CaseAssumptions, type FY, ADDBACKS, DEFAULT_ASSUMPTIONS, DEFAULT_CASE, loadAssumptions, saveAssumptions,
} from "@/lib/reports/assumptions";
import { buildReports } from "@/lib/reports/builders";
import { useModelEngine, type ModelEngineState } from "@/lib/engine/useModelEngine";
import { ATLF_REFERENCE_ISSUER_ID } from "@/lib/engine/types";

export default function ModelPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <ModelBuilder />
      </Suspense>
    </RequireAuth>
  );
}

// Which sheet rows each assumption driver feeds — used to flash the affected
// forecast cells while a driver is scrubbed. Keyed by CaseAssumptions field;
// includes the directly-edited line(s) plus every KPI the change recomputes
// (leverage/coverage key off adj-EBITDA & cash; SG&A/tax/capex ratios off their
// own inputs). Cross-year cash roll-forward is not chased — same-column only.
const DRIVER_ROWS: Record<string, string[]> = {
  gDrive: ["segD", "srsec", "totlev", "netlev", "intcov", "fcfd", "sga", "taxr"],
  gFluid: ["segF", "srsec", "totlev", "netlev", "intcov", "fcfd", "sga", "taxr"],
  gAfter: ["segA", "srsec", "totlev", "netlev", "intcov", "fcfd", "sga", "taxr"],
  dGpm: ["gp", "gpm", "sga"],
  dAdjm: ["adj", "adj2", "adjm", "srsec", "totlev", "netlev", "intcov", "fcfd", "sga", "taxr"],
  daPct: ["da", "dapc", "taxr"],
  mInt: ["int", "intcov", "fcfd", "netlev", "srsec", "taxr"],
  mLeases: ["leases", "fcfd", "netlev", "srsec"],
  mTax: ["tax", "fcfd", "netlev", "srsec", "taxr"],
  mWc: ["wc", "fcfd", "netlev", "srsec"],
  mCapex: ["capex", "cpr", "fcfd", "netlev", "srsec"],
  mAcq: ["acq", "netlev", "srsec"],
  mDiss: ["diss", "netlev", "srsec"],
  divDelta: ["div", "netlev", "srsec"],
  // each add-back account moves Adj. EBITDA → leverage & coverage KPIs
  ...Object.fromEntries(ADDBACKS.map((a) => [a.key,
    [a.key, "abunreal", "ab", "adj", "adj2", "adjm", "srsec", "totlev", "netlev", "intcov", "fcfd"]])),
};

// Cash-based KPI rows that roll forward: a year-scoped change to a cash-affecting
// driver moves these in that year AND every later forecast year (cash carries).
const CASCADE_ROWS = new Set(["netlev", "srsec"]);
// Drivers that never touch the cash-flow statement (D&A is non-cash; gross-margin
// only reshapes opex) — their KPI impact stays in the scrubbed year.
const NON_CASH_DRIVERS = new Set(["dGpm", "daPct"]);

function ModelBuilder() {
  const searchParams = useSearchParams();
  const issuerId = searchParams.get("issuer") || ATLF_REFERENCE_ISSUER_ID;
  const isReference = issuerId === ATLF_REFERENCE_ISSUER_ID;
  const [hl, setHl] = useState<string | null>(null);
  const [sel, setSel] = useState<CellRef | null>({ row: "netlev", col: "l1" });
  const [evModal, setEvModal] = useState<string | null>(null);
  const severity = 1; // downside built at CP-2B base pathway (P1); no analyst severity dial
  const [showQuarters, setShowQuarters] = useState(true);
  const [showScenarios, setShowScenarios] = useState(true);
  const [showAssumptions, setShowAssumptions] = useState(true);
  const [editing, setEditing] = useState<CellRef | null>(null);
  const [hlCells, setHlCells] = useState<Set<string> | null>(null);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [hydrated, setHydrated] = useState(false);

  // evidence modal cited-by needs the report set
  const reports = useMemo(() => buildReports(), []);

  useEffect(() => {
    try {
      const o = JSON.parse(localStorage.getItem("caos-d-overrides") || "{}");
      if (o && typeof o === "object") setOverrides(o);
      setAssumptions(loadAssumptions());
    } catch { /* first visit */ }
    setHydrated(true);
  }, []);
  // persist only after restore — writing earlier clobbers stored state with defaults
  useEffect(() => { if (hydrated) try { localStorage.setItem("caos-d-overrides", JSON.stringify(overrides)); } catch {} }, [hydrated, overrides]);
  useEffect(() => { if (hydrated) saveAssumptions(assumptions); }, [hydrated, assumptions]);
  useEffect(() => {
    const onCollapse = () => {
      const next = !(showAssumptions || showScenarios);
      setShowAssumptions(next);
      setShowScenarios(next);
    };
    window.addEventListener("caos:collapse-toggle", onCollapse);
    return () => window.removeEventListener("caos:collapse-toggle", onCollapse);
  }, [showAssumptions, showScenarios]);

  // Prefer a live CP-1 run for the LTM/PF anchor. Only the ATLF reference page
  // may fall back to the seeded demo model.
  const eng = useModelEngine(issuerId);
  const model = useMemo(
    () => buildModel(severity, overrides, eng.anchor ?? undefined, assumptions),
    [severity, overrides, eng.anchor, assumptions],
  );
  const hasIssuerModel = isReference || !!eng.anchor;
  const b1 = model.cols.b1, d0 = model.cols.d0;
  const ovCount = Object.keys(overrides).length;
  const prevModel = useRef<Model | null>(null);

  useEffect(() => {
    const prev = prevModel.current;
    prevModel.current = model;
    if (!prev) return;
    const changed = new Set<string>();
    for (const row of ROWS) {
      if (!row.g) continue;
      for (const col of model.columns) {
        const a = row.g(prev.cols[col.key]);
        const b = row.g(model.cols[col.key]);
        if (a !== b && !(typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b))) changed.add(row.id + ":" + col.key);
      }
    }
    if (!changed.size) return;
    setHlCells(changed);
    const t = window.setTimeout(() => setHlCells((cur) => (cur === changed ? null : cur)), 650);
    return () => window.clearTimeout(t);
  }, [model]);

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

  const yearsKey = (caseKey: "base" | "down"): "baseYears" | "downYears" => (caseKey === "base" ? "baseYears" : "downYears");
  const setAsmp = (caseKey: "base" | "down", field: keyof CaseAssumptions, value: number) =>
    setAssumptions((a) => ({ ...a, [caseKey]: { ...a[caseKey], [field]: value } }));
  const setAsmpYear = (caseKey: "base" | "down", year: FY, field: keyof CaseAssumptions, value: number) =>
    setAssumptions((a) => {
      const yk = yearsKey(caseKey);
      const years = a[yk] ?? {};
      return { ...a, [yk]: { ...years, [year]: { ...years[year], [field]: value } } };
    });
  const resetCase = (caseKey: "base" | "down") =>
    setAssumptions((a) => ({ ...a, [caseKey]: { ...DEFAULT_CASE }, [yearsKey(caseKey)]: {} }));
  // Flash the sheet cells a driver feeds while it is scrubbed: its row(s) ×
  // the case's forecast columns. ALL → all three years. A single year → that
  // column, except cash-based KPIs (net/sr-sec leverage) which roll forward via
  // cash, so a year-scoped change to a cash-affecting driver also moves them in
  // every LATER year — highlight those too.
  const scrubHighlight = (caseKey: "base" | "down", field: keyof CaseAssumptions, scope: "all" | FY) => {
    const rows = DRIVER_ROWS[field] ?? [];
    const pre = caseKey === "base" ? "b" : "d";
    const cascades = !NON_CASH_DRIVERS.has(field as string);
    const set = new Set<string>();
    rows.forEach((r) => {
      const yrs = scope === "all" ? [0, 1, 2]
        : cascades && CASCADE_ROWS.has(r) ? [0, 1, 2].filter((y) => y >= scope)
          : [scope];
      yrs.forEach((y) => set.add(r + ":" + pre + y));
    });
    setHlCells(set);
  };
  // Clear one year's override for a single driver (cell tracks the ALL value again).
  const clearYearDriver = (caseKey: "base" | "down", year: FY, field: keyof CaseAssumptions) =>
    setAssumptions((a) => {
      const yk = yearsKey(caseKey);
      const years = { ...(a[yk] ?? {}) };
      const yo = { ...(years[year] ?? {}) };
      delete yo[field];
      if (Object.keys(yo).length) years[year] = yo; else delete years[year];
      return { ...a, [yk]: years };
    });

  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      {/* sub-header */}
      <PageSubHeader gap="gap-3">
        <span className="tabular text-caos-md text-caos-accent whitespace-nowrap">MODEL M-118</span>
        <span className="text-caos-xl text-caos-text font-medium truncate min-w-0">{isReference ? "Atlas Forge — cash-flow model" : "Model Builder — issuer model"}</span>
        <ModelProvenance eng={eng} model={model} allowSeededFallback={isReference} />
        <span className="tabular text-caos-sm text-caos-muted whitespace-nowrap truncate min-w-0 hidden xl:inline">
          dbl-click historical cells to override
        </span>
        <span className="flex-1"></span>
        {/* Net-lev status chips duplicate the Scenario panel — drop them first on
            narrow screens; the panel toggles + Export stay reachable. */}
        {hasIssuerModel ? <span className="hidden 2xl:flex items-center gap-3 shrink-0">
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
        </span> : null}
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
          disabled={!hasIssuerModel}
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
        {hasIssuerModel ? (
          <>
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
                <AssumptionsPanel
                  assumptions={assumptions}
                  onChange={setAsmp}
                  onChangeYear={setAsmpYear}
                  onResetCase={resetCase}
                  onResetYearCell={clearYearDriver}
                  onScrub={scrubHighlight}
                  onScrubEnd={() => setHlCells(null)}
                  onCollapse={() => setShowAssumptions(false)}
                />
              ) : (
                <CollapsedRail side="left" label="Assumptions" onExpand={() => setShowAssumptions(true)} />
              )}
              <div className="flex-1 min-w-0 min-h-0 flex">
                <Sheet
                  model={model}
                  showQ={showQuarters}
                  hl={hl}
                  hlCells={hlCells}
                  sel={sel}
                  onSel={setSel}
                  editing={editing}
                  onEdit={setEditing}
                  onCommit={commitEdit}
                />
              </div>
              {showScenarios ? (
                <ScenarioPanel model={model} onCollapse={() => setShowScenarios(false)} />
              ) : (
                <CollapsedRail side="right" label="Scenario & Sensitivity" onExpand={() => setShowScenarios(true)} />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 min-h-0 rounded border border-caos-border bg-caos-panel flex flex-col items-center justify-center gap-2 text-center px-6">
            <div className="tabular text-caos-xl text-caos-text">No issuer-specific model output</div>
            <div className="text-caos-md text-caos-muted max-w-[520px] leading-relaxed">
              Model Builder needs a completed run with a usable CP-1 anchor. Run the
              issuer first; the seeded Atlas Forge grid is available only in the reference demo.
            </div>
          </div>
        )}
          {showScenarios ? (
            <ScenarioPanel model={model} downside={eng.downside} onCollapse={() => setShowScenarios(false)} />
          ) : (
            <CollapsedRail side="right" label="Scenario & Sensitivity" onExpand={() => setShowScenarios(true)} />
          )}
        </div>
      </div>

      {evModal ? <EvidenceModal id={evModal} reports={reports} onClose={() => setEvModal(null)} /> : null}
    </div>
  );
}

// Thin expandable rail shown in place of a collapsed side panel: a vertical
// label + chevron that restores the full panel. Keeps the workspace bounds
// stable so the sheet doesn't reflow jarringly on collapse.
function CollapsedRail({ side, label, onExpand }: { side: "left" | "right"; label: string; onExpand: () => void }) {
  return (
    <div className="w-7 shrink-0 bg-caos-panel border border-caos-border rounded-md flex flex-col items-center gap-2 py-2 text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos font-bold">
      <CollapseButton direction={side === "left" ? "right" : "left"} label={`Expand ${label} panel`} onClick={onExpand} />
      <span
        aria-hidden
        className="tabular text-caos-2xs uppercase tracking-wider whitespace-nowrap"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        {label}
      </span>
    </div>
  );
}

// Engine provenance for the sub-header: whether the LTM/PF anchor is grounded in
// a live CP-1 run or the seeded demo model, plus a tie-out reconciling the
// leverage the grid actually DISPLAYS against CP-1's separately-reported figure.
// Status is always glyph-paired (dot / ✓ / ⚠), never carried by color alone.
function ModelProvenance({ eng, model, allowSeededFallback }: { eng: ModelEngineState; model: Model; allowSeededFallback: boolean }) {
  if (eng.loading) {
    return <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">· linking engine…</span>;
  }
  if (!eng.live || !eng.anchor) {
    if (!allowSeededFallback) {
      return (
        <span
          className="flex items-center gap-1.5 tabular text-caos-xs whitespace-nowrap text-caos-muted"
          title="No completed run with usable CP-1 anchor found; seeded model suppressed for issuer-scoped view."
        >
          <span className="w-1.5 h-1.5 rounded-sm" style={{ background: "var(--caos-idle)" }} />
          NO MODEL OUTPUT
        </span>
      );
    }
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
  // CP-1's separately-reported adj. net leverage (net_leverage_adj_ltm).
  const cp1 = eng.anchor.netLeverage;
  // What the grid actually DISPLAYS for the anchored LTM column: net debt / adj
  // EBITDA recomputed from the live anchor (see applyAnchor + deriveCreditKpis).
  // This — not the pre-anchor seeded value — is the number the analyst reads, so
  // it is the number the tie-out must reconcile. (null if a denominator degraded.)
  const shown = model.cols.l1.netlev;
  // Only claim a tie when the DISPLAYED leverage equals CP-1's reported figure
  // within tolerance. CP-1 may report on a different net-debt/EBITDA basis, so a
  // recomputed netDebt/adjEbitda can legitimately differ — never fabricate "ties".
  const drift = shown != null ? Math.abs(shown - cp1) : null;
  const ties = drift != null && drift <= 0.05;
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
          ties
            ? { color: "var(--caos-success)", borderColor: "rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.08)" }
            : { color: "var(--caos-warning)", borderColor: "rgba(245,165,36,0.4)", background: "rgba(245,165,36,0.08)" }
        }
        title={
          shown == null
            ? `Grid LTM net leverage is undefined (degenerate denominator); CP-1 reports ${cp1.toFixed(2)}x.`
            : ties
            ? `Grid LTM net leverage (${shown.toFixed(2)}x = net debt / adj. EBITDA) ties CP-1 reported (${cp1.toFixed(2)}x).`
            : `Grid shows ${shown.toFixed(2)}x (net debt / adj. EBITDA) but CP-1 reports ${cp1.toFixed(2)}x — likely a different net-debt / EBITDA basis. Shown side by side, not reconciled.`
        }
      >
        {ties
          ? <>✓ ties to CP-1 {cp1.toFixed(2)}x</>
          : shown == null
          ? <><StatusGlyph kind="warning" /> CP-1 {cp1.toFixed(2)}x · grid n/a</>
          : <><StatusGlyph kind="warning" /> grid {shown.toFixed(2)}x vs CP-1 {cp1.toFixed(2)}x</>}
      </span>
    </span>
  );
}
