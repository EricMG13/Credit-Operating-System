"use client";

// Concept E — The Report Studio: CP-RENDER as a publishing desk. Committee
// deliverables assembled from module outputs + the M-118 model, with lineage,
// section compose toggles, QA watermark gating and print-to-PDF.

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { PageSubHeader } from "@/components/shared/PageSubHeader";
import { ReportDoc } from "@/components/reports/ReportDoc";
import { EvidenceModal } from "@/components/reports/EvidenceModal";
import { ComposePanel, ExportPanel, LineagePanel, ReportList } from "@/components/reports/panels";
import { buildReports, type ModelInputs } from "@/lib/reports/builders";
import { useModelEngine } from "@/lib/engine/useModelEngine";
import { ATLF_REFERENCE_ISSUER_ID } from "@/lib/engine/types";
import { deepDiveCaveatKind } from "@/lib/deepdive/caveat";
import { getSavedModel } from "@/lib/api";

const ZOOMS = [0.7, 0.85, 1, 1.15];
const PAPERS = [
  { v: "#ffffff", label: "White" },
  { v: "#f7f5ee", label: "Warm" },
  { v: "#eef0f3", label: "Cool" },
];

/* ---------- print portal (document only, un-scaled) ---------- */
function PrintPortal({
  rep,
  omit,
  showSources,
  edits,
  hideAddbacks,
}: {
  rep: ReturnType<typeof buildReports>[number];
  omit: Record<number, boolean>;
  showSources: boolean;
  edits: Record<string, string>;
  hideAddbacks?: boolean;
}) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const d = document.createElement("div");
    d.className = "print-root";
    document.body.appendChild(d);
    setEl(d);
    return () => d.remove();
  }, []);
  if (!el) return null;
  return createPortal(<ReportDoc rep={rep} omit={omit} paper="#ffffff" showSources={showSources} edits={edits} hideAddbacks={hideAddbacks} />, el);
}

export default function ReportsPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <ReportStudio />
      </Suspense>
    </RequireAuth>
  );
}

// fallow-ignore-next-line complexity
function ReportStudio() {
  const searchParams = useSearchParams();
  const issuerId = searchParams.get("issuer") || ATLF_REFERENCE_ISSUER_ID;
  const isReference = issuerId === ATLF_REFERENCE_ISSUER_ID;

  // Report Studio reads only the DB-saved Model Builder state. Unsaved browser
  // edits in /model do not affect committee output.
  const [modelInputs, setModelInputs] = useState<ModelInputs>({});
  // fallow-ignore-next-line complexity
  useEffect(() => {
    getSavedModel(issuerId).then((saved) => {
      const p = saved?.payload || {};
      setModelInputs({
        overrides: p.overrides && typeof p.overrides === "object" ? p.overrides : {},
        assumptions: p.assumptions && typeof p.assumptions === "object" ? p.assumptions : undefined,
        severity: 1,
      } as ModelInputs);
    }).catch(() => setModelInputs({}));
  }, [issuerId]);
  // Prefer a live CP-1 run for the LTM/PF anchor (same hook the Model Builder
  // uses). Only the ATLF reference page may build seeded report templates; real
  // issuers show no-output until CP-RENDER is wired to live module payloads.
  const eng = useModelEngine(issuerId);
  const reports = useMemo(
    () => isReference ? buildReports({ ...modelInputs, anchor: eng.anchor ?? undefined }) : [],
    [isReference, modelInputs, eng.anchor],
  );

  const [activeId, setActiveId] = useState("snapshot");
  const [zoom, setZoom] = useState(0.85);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [omit, setOmit] = useState<Record<string, Record<number, boolean>>>({});
  const [paper, setPaper] = useState("#f7f5ee");
  const [showSources, setShowSources] = useState(true);
  const [evModal, setEvModal] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [hideAddbacks, setHideAddbacks] = useState(false);
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [hydrated, setHydrated] = useState(false);

  // restore persisted workspace state
  const reportParam = searchParams.get("report");
  // fallow-ignore-next-line complexity
  useEffect(() => {
    try {
      const a = localStorage.getItem("caos-e-active");
      if (a && reports.some((r) => r.id === a)) setActiveId(a);
      const z = parseFloat(localStorage.getItem("caos-e-zoom") || "");
      if (ZOOMS.includes(z)) setZoom(z);
      const o = JSON.parse(localStorage.getItem("caos-e-omit") || "{}");
      if (o && typeof o === "object") setOmit(o);
      const e = JSON.parse(localStorage.getItem("caos-e-edits") || "{}");
      if (e && typeof e === "object") setEdits(e);
    } catch { /* first visit */ }
    // Deep link (?report=) beats the remembered workspace tab — a module-export
    // jump from Deep-Dive must land on its exhibit, not last session's.
    if (reportParam && reports.some((r) => r.id === reportParam)) setActiveId(reportParam);
    setHydrated(true);
  }, [reports, reportParam]);
  // persist only after restore has run — writing earlier clobbers stored
  // state with the initial defaults
  useEffect(() => { if (hydrated) try { localStorage.setItem("caos-e-active", activeId); } catch {} }, [hydrated, activeId]);
  useEffect(() => { if (hydrated) try { localStorage.setItem("caos-e-zoom", String(zoom)); } catch {} }, [hydrated, zoom]);
  useEffect(() => { if (hydrated) try { localStorage.setItem("caos-e-omit", JSON.stringify(omit)); } catch {} }, [hydrated, omit]);
  useEffect(() => { if (hydrated) try { localStorage.setItem("caos-e-edits", JSON.stringify(edits)); } catch {} }, [hydrated, edits]);

  const rep = reports.find((r) => r.id === activeId) || reports[0];
  const repOmit = rep ? omit[rep.id] || {} : {};
  const omitCount = Object.keys(repOmit).length;
  const repEdits = rep ? edits[rep.id] || {} : {};
  const editCount = Object.keys(repEdits).length;

  const toggleSec = (i: number) => {
    if (!rep) return;
    setOmit((o) => {
      const cur = { ...o[rep.id] };
      if (cur[i]) delete cur[i];
      else cur[i] = true;
      return { ...o, [rep.id]: cur };
    });
  };

  const applyEdit = (path: string, text: string) => {
    if (!rep) return;
    setEdits((e) => ({ ...e, [rep.id]: { ...e[rep.id], [path]: text } }));
  };
  const resetEdits = () => {
    if (!rep) return;
    // Irreversible: drops every analyst edit on this deliverable (and the
    // localStorage mirror with it). Confirm before discarding manual committee work.
    const plural = editCount === 1 ? "" : "s";
    if (!window.confirm(`Discard ${editCount} analyst edit${plural} on this deliverable? This can't be undone.`)) return;
    setEdits((e) => {
      const next = { ...e };
      delete next[rep.id];
      return next;
    });
  };
  // Fit the 980px paper to the available preview width (px-6 padding both sides),
  // clamped to a sane zoom band. On-demand so it never fights manual zoom.
  const fitToWidth = () => {
    const el = scrollRef.current;
    if (!el) return;
    setZoom(Math.max(0.4, Math.min(1.15, (el.clientWidth - 48) / 980)));
  };

  const caveatKind = deepDiveCaveatKind({ isReference, loading: eng.loading, runId: eng.runId });

  return (
    <div className="h-screen flex flex-col bg-caos-bg">
      {/* sub-header */}
      <PageSubHeader gap="gap-3">
        <span className="tabular text-caos-md text-caos-accent whitespace-nowrap">CP-RENDER</span>
        <span className="text-caos-xl text-caos-text font-medium truncate min-w-0">Report Studio — committee deliverables</span>
        {caveatKind === "reference" ? (
          <span
            className="tabular text-caos-xs whitespace-nowrap truncate text-caos-muted"
            role="note"
            title="Report Studio renders the Atlas Forge reference deal as a committee-ready template — not wired to a live issuer run. Every figure is the ATLF fixture."
          >
            REFERENCE TEMPLATE — Atlas Forge fixture, not a live issuer run
          </span>
        ) : caveatKind === "loading" ? (
          <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">
            checking for live run…
          </span>
        ) : caveatKind === "live" ? (
          <span
            className="tabular text-caos-xs whitespace-nowrap"
            style={{ color: "var(--caos-warning)" }}
            title="Live engine modules reflect this issuer; CP-RENDER is not wired to produce issuer-specific report pages yet."
          >
            live engine output · report renderer not wired
          </span>
        ) : (
          <span
            className="tabular text-caos-xs whitespace-nowrap"
            style={{ color: "var(--caos-warning)" }}
            role="note"
            title="No completed run for this issuer. Report Studio will not show the ATLF reference template for a real issuer."
          >
            no run for this issuer · report unavailable
          </span>
        )}
        <span className="flex-1" />
        {/* paper tone — decorative, drops first on narrow screens */}
        <span className="hidden 2xl:flex items-center gap-1 shrink-0">
          {PAPERS.map((p) => (
            <button
              key={p.v}
              onClick={() => setPaper(p.v)}
              title={"Paper tone — " + p.label}
              className={"w-4 h-4 rounded-sm border transition-caos " + (paper === p.v ? "border-caos-accent" : "border-caos-border")}
              style={{ background: p.v }}
            />
          ))}
        </span>
        <button
          onClick={() => setShowSources(!showSources)}
          className={
            "tabular text-caos-xs px-1.5 h-6 rounded border transition-caos whitespace-nowrap " +
            (showSources ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
          }
        >
          SOURCES
        </button>
        <button
          onClick={() => setEditMode(!editMode)}
          title="Edit the deliverable inline — every figure, label and paragraph is editable; edits persist locally and carry into the PDF export"
          className={
            "tabular text-caos-xs px-1.5 h-6 rounded border transition-caos whitespace-nowrap " +
            (editMode ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
          }
        >
          ✎ EDIT
        </button>
        {editCount > 0 ? (
          <button
            onClick={resetEdits}
            title={"Discard " + editCount + " analyst edit" + (editCount === 1 ? "" : "s") + " on this deliverable"}
            className="tabular text-caos-xs px-1.5 h-6 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos whitespace-nowrap"
          >
            ↺ {editCount}
          </button>
        ) : null}
        <span className="h-4 w-px bg-caos-border" />
        {/* zoom */}
        <span className="flex items-center gap-1">
          {ZOOMS.map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={
                "tabular text-caos-xs px-1.5 h-6 rounded border transition-caos " +
                (zoom === z ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
              }
            >
              {Math.round(z * 100)}%
            </button>
          ))}
          <button
            onClick={fitToWidth}
            title="Fit the page to the available width"
            className="tabular text-caos-xs px-1.5 h-6 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos"
          >
            FIT
          </button>
        </span>
        <button
          onClick={() => window.print()}
          disabled={!rep}
          className="flex items-center gap-1.5 tabular text-caos-xs px-2 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos whitespace-nowrap"
        >
          ⎙ EXPORT PDF
        </button>
        <span
          className="tabular text-caos-xs uppercase tracking-wide px-1.5 py-px rounded border whitespace-nowrap"
          style={{ color: "var(--caos-warning)", borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)", background: "color-mix(in srgb, var(--caos-warning) 8%, transparent)" }}
        >
          CP-5 CONDITIONAL — QA-117
        </span>
      </PageSubHeader>

      {/* workspace */}
      <div className="flex-1 min-h-0 flex gap-2 p-2">
        {rep && leftOpen ? <ReportList reports={reports} active={rep.id} onSel={setActiveId} onCollapse={() => setLeftOpen(false)} /> : rep ? <ReportRail label="Deliverables" onExpand={() => setLeftOpen(true)} /> : null}

        <div ref={scrollRef} tabIndex={0} aria-label="Report preview" className="flex-1 min-w-0 rounded border border-caos-border overflow-auto focus-ring" style={{ background: "#08080c" }}>
          <div className="flex justify-center py-7 px-6">
            {rep ? <div style={{ zoom }}>
              <ReportDoc
                rep={rep}
                omit={repOmit}
                paper={paper}
                showSources={showSources}
                edits={repEdits}
                onEdit={editMode ? applyEdit : undefined}
                hideAddbacks={hideAddbacks && rep.id === "model"}
              />
            </div> : (
              <div className="min-h-[420px] flex flex-col items-center justify-center gap-2 text-center px-6">
                <div className="tabular text-caos-xl text-caos-text">No issuer-specific report output</div>
                <div className="text-caos-md text-caos-muted max-w-[520px] leading-relaxed">
                  CP-RENDER is not wired to live module payloads yet. Run the issuer,
                  then use Deep-Dive or Model Builder until Report Studio has live output.
                </div>
              </div>
            )}
          </div>
        </div>

        {rep && rightOpen ? <div className="w-[300px] shrink-0 flex flex-col gap-2 min-h-0">
          <button onClick={() => setRightOpen(false)} className="tabular text-caos-xs text-caos-muted hover:text-caos-text self-end focus-ring">COLLAPSE</button>
          <LineagePanel rep={rep} onOpenEvidence={setEvModal} />
          {rep.id === "model" ? (
            <button
              onClick={() => setHideAddbacks((v) => !v)}
              className={
                "tabular text-caos-xs px-2 py-1.5 rounded border transition-caos focus-ring " +
                (hideAddbacks ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
              }
            >
              {hideAddbacks ? "SHOW EBITDA ADD-BACKS" : "HIDE EBITDA ADD-BACKS"}
            </button>
          ) : null}
          <ComposePanel rep={rep} omit={repOmit} onToggle={toggleSec} />
          <ExportPanel rep={rep} omitCount={omitCount} editCount={editCount} />
        </div> : rep ? <ReportRail label="Panels" onExpand={() => setRightOpen(true)} /> : null}
      </div>

      {evModal ? <EvidenceModal id={evModal} reports={reports} onClose={() => setEvModal(null)} /> : null}
      {rep ? <PrintPortal rep={rep} omit={repOmit} showSources={showSources} edits={repEdits} hideAddbacks={hideAddbacks && rep.id === "model"} /> : null}
    </div>
  );
}

function ReportRail({ label, onExpand }: { label: string; onExpand: () => void }) {
  return (
    <button
      onClick={onExpand}
      className="w-7 shrink-0 bg-caos-panel border border-caos-border rounded-md flex items-center justify-center text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos focus-ring"
      title={`Expand ${label}`}
    >
      <span className="tabular text-caos-2xs uppercase tracking-wider" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{label}</span>
    </button>
  );
}
