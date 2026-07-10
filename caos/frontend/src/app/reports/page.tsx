"use client";

// Concept E — The Report Studio: CP-RENDER as a publishing desk. Committee
// deliverables assembled from module outputs + the M-118 model, with lineage,
// section compose toggles, QA watermark gating and print-to-PDF.

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { ReportDoc } from "@/components/reports/ReportDoc";
import { EvidenceModal } from "@/components/reports/EvidenceModal";
import { ComposePanel, ExportPanel, LineagePanel, ReportList } from "@/components/reports/panels";
import { buildReports, type ModelInputs } from "@/lib/reports/builders";
import { useModelEngine } from "@/lib/engine/useModelEngine";
import { useLiveRun } from "@/lib/engine/useLiveRun";
import { ATLF_REFERENCE_ISSUER_ID } from "@/lib/engine/types";
import { deepDiveCaveatKind } from "@/lib/deepdive/caveat";
import { getSavedModel } from "@/lib/api";
import { ResponsiveShell, type NarrowContract } from "@/components/shared/ResponsiveShell";

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
  const [modelLoadError, setModelLoadError] = useState(false);
  const [modelReloadKey, setModelReloadKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setModelLoadError(false);
    getSavedModel(issuerId).then((saved) => {
      if (cancelled) return;
      const p = saved?.payload || {};
      setModelInputs({
        overrides: p.overrides && typeof p.overrides === "object" ? p.overrides : {},
        assumptions: p.assumptions && typeof p.assumptions === "object" ? p.assumptions : undefined,
        severity: 1,
      } as ModelInputs);
    }).catch(() => {
      if (cancelled) return;
      setModelInputs({});
      setModelLoadError(true);
    });
    return () => { cancelled = true; };
  }, [issuerId, modelReloadKey]);
  const eng = useModelEngine(issuerId);
  const live = useLiveRun(issuerId);
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

  // Consolidate persisted settings into a single effect block
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("caos-e-active", activeId);
      localStorage.setItem("caos-e-zoom", String(zoom));
      localStorage.setItem("caos-e-omit", JSON.stringify(omit));
      localStorage.setItem("caos-e-edits", JSON.stringify(edits));
    } catch {}
  }, [hydrated, activeId, zoom, omit, edits]);

  const rep = reports.find((r) => r.id === activeId) || reports[0];

  // Auto-fit the sheet on first render (and per report) when it overflows the
  // scroller — the common 1280px laptop otherwise opens to a clipped page. Only
  // when the analyst has no remembered manual zoom.
  useEffect(() => {
    if (!hydrated) return;
    let stored = "";
    try { stored = localStorage.getItem("caos-e-zoom") || ""; } catch {}
    if (stored) return; // respect a remembered manual zoom
    const el = scrollRef.current;
    if (el && el.scrollWidth > el.clientWidth) fitToWidth();
  }, [hydrated, rep?.id]);

  // Keyboard shortcuts for power users: +/- step zoom, f fits, 1..9 pick a report.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const k = e.key;
      if (k === "+" || k === "=") {
        const next = ZOOMS.find((z) => z > zoom);
        if (next != null) setZoom(next);
      } else if (k === "-" || k === "_") {
        const below = ZOOMS.filter((z) => z < zoom);
        if (below.length) setZoom(below[below.length - 1]);
      } else if (k === "f") {
        fitToWidth();
      } else if (k >= "1" && k <= "9") {
        const d = Number(k);
        if (reports.length && reports[d - 1]) setActiveId(reports[d - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reports, zoom]);
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
    setEdits((e) => {
      const cur = { ...e[rep.id] };
      if (text == null) delete cur[path]; else cur[path] = text;
      return { ...e, [rep.id]: cur };
    });
  };
  const resetEdits = () => {
    if (!rep) return;
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

  const narrowContract: NarrowContract = {
    essentialControls: (
      <>
        {ZOOMS.map((z) => (
          <button
            key={z}
            onClick={() => setZoom(z)}
            aria-pressed={zoom === z}
            aria-label={"Zoom " + Math.round(z * 100) + " percent"}
            className={
              "focus-ring tabular text-caos-xs px-1.5 h-6 rounded border transition-caos " +
              (zoom === z ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
            }
          >
            {Math.round(z * 100)}%
          </button>
        ))}
        <button
          onClick={fitToWidth}
          title="Fit the page to the available width"
          className="focus-ring tabular text-caos-xs px-1.5 h-6 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos"
        >
          FIT
        </button>
      </>
    ),
  };

  return (
    <ResponsiveShell
      identity={
        <>
          <span className="tabular text-caos-md text-caos-accent whitespace-nowrap">CP-RENDER</span>
          <span className="text-caos-xl text-caos-text font-medium shrink-0 whitespace-nowrap">Report Studio — committee deliverables</span>
          {caveatKind === "reference" && eng.runId ? (
            // FE-5: buildReports incorporates eng.anchor when a live run exists on
            // the reference issuer, but the debate/recovery/covenant tabs and the
            // DEAL narrative stay ATLF fixtures regardless (same rationale as
            // lib/deepdive/caveat.ts) — say both halves precisely instead of the
            // blanket "not a live issuer run" claim.
            <span
              className="tabular text-caos-xs whitespace-nowrap truncate text-caos-muted"
              role="note"
              title="A live run backs this issuer's figures, but the bespoke debate/recovery/covenant tabs still render the Atlas Forge reference fixture."
            >
              REFERENCE TEMPLATE — bespoke tabs stay fixture, other figures reflect the live run
            </span>
          ) : caveatKind === "reference" ? (
            <span
              className="tabular text-caos-xs whitespace-nowrap truncate text-caos-muted"
              role="note"
              title="Report Studio renders the Atlas Forge reference deal as a committee-ready template — not wired to a live issuer run."
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
          {modelLoadError ? (
            <span
              role="alert"
              className="tabular text-caos-xs flex items-center gap-1.5 shrink-0 px-1.5 h-6 rounded border whitespace-nowrap"
              style={{ color: "var(--caos-warning)", borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)", background: "color-mix(in srgb, var(--caos-warning) 8%, transparent)" }}
              title="Could not load this analyst's saved Model Builder overrides. The deliverable is showing base fixture figures."
            >
              <span aria-hidden="true">⚠</span>
              saved model unavailable — base figures shown
              <button
                type="button"
                onClick={() => setModelReloadKey((k) => k + 1)}
                className="focus-ring underline underline-offset-2 hover:no-underline"
                style={{ color: "var(--caos-warning)" }}
              >
                retry
              </button>
            </span>
          ) : null}
        </>
      }
      primaryAction={
        <button
          onClick={() => window.print()}
          disabled={!rep}
          className="focus-ring flex items-center gap-1.5 tabular text-caos-xs px-2 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos whitespace-nowrap focus-ring disabled:opacity-40 disabled:pointer-events-none"
        >
          ⎙ EXPORT PDF
        </button>
      }
      contextualControls={
        <>
          {/* paper tone — decorative, in MoreDrawer at narrow */}
          <span className="flex items-center gap-1 shrink-0">
            {PAPERS.map((p) => (
              <button
                key={p.v}
                onClick={() => setPaper(p.v)}
                aria-pressed={paper === p.v}
                aria-label={"Paper tone " + p.label}
                title={"Paper tone — " + p.label + " · preview only"}
                className={"focus-ring w-6 h-6 rounded-sm border transition-caos " + (paper === p.v ? "border-caos-accent" : "border-caos-border")}
                style={{ background: p.v }}
              />
            ))}
          </span>
          <button
            onClick={() => setShowSources(!showSources)}
            aria-pressed={showSources}
            className={
              "focus-ring tabular text-caos-xs px-1.5 h-6 rounded border transition-caos whitespace-nowrap " +
              (showSources ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
            }
          >
            SOURCES
          </button>
          <button
            onClick={() => setEditMode(!editMode)}
            aria-pressed={editMode}
            title="Edit the deliverable inline"
            className={
              "focus-ring tabular text-caos-xs px-1.5 h-6 rounded border transition-caos whitespace-nowrap " +
              (editMode ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
            }
          >
            {editMode ? "✎ EDITING" : "✎ EDIT"}
          </button>
          {editCount > 0 ? (
            <button
              onClick={resetEdits}
              title={"Discard " + editCount + " analyst edit" + (editCount === 1 ? "" : "s") + " on this deliverable"}
              className="focus-ring tabular text-caos-xs px-1.5 h-6 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos whitespace-nowrap"
            >
              ↺ {editCount}
            </button>
          ) : null}
          <span className="h-4 w-px bg-caos-border shrink-0" />
          {/* zoom */}
          {ZOOMS.map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              aria-pressed={zoom === z}
              aria-label={"Zoom " + Math.round(z * 100) + " percent"}
              className={
                "focus-ring tabular text-caos-xs px-1.5 h-6 rounded border transition-caos " +
                (zoom === z ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
              }
            >
              {Math.round(z * 100)}%
            </button>
          ))}
          <button
            onClick={fitToWidth}
            title="Fit the page to the available width"
            className="focus-ring tabular text-caos-xs px-1.5 h-6 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos"
          >
            FIT
          </button>
          {/* QA-117 / evidence E-44 is a finding on the ATLF reference deal only. */}
          {isReference ? (
            <button
              type="button"
              onClick={() => setEvModal("E-44")}
              title="Open QA-117 finding (evidence E-44)"
              aria-label="Open QA-117 finding (evidence E-44)"
              className="focus-ring tabular text-caos-xs uppercase tracking-wide px-1.5 py-px rounded border whitespace-nowrap"
              style={{ color: "var(--caos-warning)", borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)", background: "color-mix(in srgb, var(--caos-warning) 8%, transparent)" }}
            >
              CP-5 CONDITIONAL — QA-117
            </button>
          ) : null}
        </>
      }
      narrowContract={narrowContract}
    >
      {/* workspace */}
      <div className="flex-1 min-h-0 flex gap-2 p-2">
        {rep && leftOpen ? <ReportList reports={reports} active={rep.id} onSel={setActiveId} onCollapse={() => setLeftOpen(false)} /> : rep ? <ReportRail label="Deliverables" onExpand={() => setLeftOpen(true)} /> : null}

        <div ref={scrollRef} tabIndex={0} aria-label="Report preview" className="flex-1 min-w-0 rounded border border-caos-border overflow-auto focus-ring" style={{ background: "#08080c" }}>
          <div className="flex py-7 px-6" style={{ justifyContent: "safe center" }}>
            {rep ? <div style={{ zoom, "--rd-zoom": zoom } as React.CSSProperties}>
              <ReportDoc
                rep={rep}
                omit={repOmit}
                paper={paper}
                showSources={showSources}
                edits={repEdits}
                onEdit={editMode ? applyEdit : undefined}
                onOpenEvidence={setEvModal}
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

        {rep && rightOpen ? <div className="w-[300px] shrink-0 flex flex-col gap-2 min-h-0 overflow-y-auto pb-12">
          <button onClick={() => setRightOpen(false)} className="tabular text-caos-xs text-caos-muted hover:text-caos-text self-end focus-ring">COLLAPSE</button>
          <LineagePanel rep={rep} onOpenEvidence={setEvModal} />
          {rep.id === "model" ? (
            <button
              onClick={() => setHideAddbacks((v) => !v)}
              aria-pressed={hideAddbacks}
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

      {evModal ? <EvidenceModal id={evModal} reports={reports} live={live.liveEvidence} isLiveRun={!isReference && !!live.runId} onClose={() => setEvModal(null)} /> : null}
      {rep ? <PrintPortal rep={rep} omit={repOmit} showSources={showSources} edits={repEdits} hideAddbacks={hideAddbacks && rep.id === "model"} /> : null}
    </ResponsiveShell>
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