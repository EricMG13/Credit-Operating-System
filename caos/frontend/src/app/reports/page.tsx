"use client";

// Concept E — The Report Studio: CP-RENDER as a publishing desk. Committee
// deliverables assembled from module outputs + the M-118 model, with lineage,
// section compose toggles, QA watermark gating and print-to-PDF.

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { ConceptNav } from "@/components/shared/ConceptNav";
import { ReportDoc } from "@/components/reports/ReportDoc";
import { EvidenceModal } from "@/components/reports/EvidenceModal";
import { ComposePanel, ExportPanel, LineagePanel, ReportList } from "@/components/reports/panels";
import { buildReports } from "@/lib/reports/builders";

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
}: {
  rep: ReturnType<typeof buildReports>[number];
  omit: Record<number, boolean>;
  showSources: boolean;
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
  return createPortal(<ReportDoc rep={rep} omit={omit} paper="#ffffff" showSources={showSources} />, el);
}

export default function ReportsPage() {
  return (
    <RequireAuth>
      <ReportStudio />
    </RequireAuth>
  );
}

function ReportStudio() {
  const reports = useMemo(() => buildReports(), []);

  const [activeId, setActiveId] = useState("snapshot");
  const [zoom, setZoom] = useState(0.85);
  const [omit, setOmit] = useState<Record<string, Record<number, boolean>>>({});
  const [paper, setPaper] = useState("#f7f5ee");
  const [showSources, setShowSources] = useState(true);
  const [evModal, setEvModal] = useState<string | null>(null);

  // restore persisted workspace state
  useEffect(() => {
    try {
      const a = localStorage.getItem("caos-e-active");
      if (a && reports.some((r) => r.id === a)) setActiveId(a);
      const z = parseFloat(localStorage.getItem("caos-e-zoom") || "");
      if (ZOOMS.includes(z)) setZoom(z);
      const o = JSON.parse(localStorage.getItem("caos-e-omit") || "{}");
      if (o && typeof o === "object") setOmit(o);
    } catch { /* first visit */ }
  }, [reports]);
  useEffect(() => { try { localStorage.setItem("caos-e-active", activeId); } catch {} }, [activeId]);
  useEffect(() => { try { localStorage.setItem("caos-e-zoom", String(zoom)); } catch {} }, [zoom]);
  useEffect(() => { try { localStorage.setItem("caos-e-omit", JSON.stringify(omit)); } catch {} }, [omit]);

  const rep = reports.find((r) => r.id === activeId) || reports[0];
  const repOmit = omit[rep.id] || {};
  const omitCount = Object.keys(repOmit).length;

  const toggleSec = (i: number) => {
    setOmit((o) => {
      const cur = { ...o[rep.id] };
      if (cur[i]) delete cur[i];
      else cur[i] = true;
      return { ...o, [rep.id]: cur };
    });
  };

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
        <span className="tabular text-[10px] text-caos-accent whitespace-nowrap">CP-RENDER</span>
        <span className="text-[11px] text-caos-text font-medium whitespace-nowrap">Report Studio — committee deliverables</span>
        <span className="tabular text-[9.5px] text-caos-muted whitespace-nowrap truncate">
          assembled from RUN #2641 outputs · figures on M-118 model basis
        </span>
        <span className="flex-1" />
        {/* paper tone */}
        <span className="flex items-center gap-1">
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
            "tabular text-[9px] px-1.5 h-6 rounded border transition-caos whitespace-nowrap " +
            (showSources ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
          }
        >
          SOURCES
        </button>
        <span className="h-4 w-px bg-caos-border" />
        {/* zoom */}
        <span className="flex items-center gap-1">
          {ZOOMS.map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={
                "tabular text-[9px] px-1.5 h-6 rounded border transition-caos " +
                (zoom === z ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")
              }
            >
              {Math.round(z * 100)}%
            </button>
          ))}
        </span>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 tabular text-[9px] px-2 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos whitespace-nowrap"
        >
          ⎙ EXPORT PDF
        </button>
        <span
          className="tabular text-[9px] uppercase tracking-wide px-1.5 py-px rounded border whitespace-nowrap"
          style={{ color: "var(--caos-warning)", borderColor: "rgba(245,165,36,0.4)", background: "rgba(245,165,36,0.08)" }}
        >
          CP-5 CONDITIONAL — QA-117
        </span>
      </div>

      {/* workspace */}
      <div className="flex-1 min-h-0 flex gap-2 p-2">
        <ReportList reports={reports} active={rep.id} onSel={setActiveId} />

        <div className="flex-1 min-w-0 rounded border border-caos-border overflow-auto" style={{ background: "#08080c" }}>
          <div className="flex justify-center py-7 px-6">
            <div style={{ zoom }}>
              <ReportDoc rep={rep} omit={repOmit} paper={paper} showSources={showSources} />
            </div>
          </div>
        </div>

        <div className="w-[300px] shrink-0 flex flex-col gap-2 min-h-0">
          <LineagePanel rep={rep} onOpenEvidence={setEvModal} />
          <ComposePanel rep={rep} omit={repOmit} onToggle={toggleSec} />
          <ExportPanel rep={rep} omitCount={omitCount} />
        </div>
      </div>

      {evModal ? <EvidenceModal id={evModal} reports={reports} onClose={() => setEvModal(null)} /> : null}
      <PrintPortal rep={rep} omit={repOmit} showSources={showSources} />
    </div>
  );
}
