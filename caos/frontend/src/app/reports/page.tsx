"use client";

// Concept E — The Report Studio: CP-RENDER as a publishing desk. Committee
// deliverables assembled from module outputs + the M-118 model, with lineage,
// section compose toggles, QA watermark gating and print-to-PDF.

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { ShellIdentity } from "@/components/shared/ShellIdentity";
import { ProvenanceChip } from "@/components/shared/ProvenanceChip";
import { fromReportCaveat } from "@/lib/provenance";
import { ReportDoc } from "@/components/reports/ReportDoc";
import { EvidenceModal } from "@/components/reports/EvidenceModal";
import { ComposePanel, ExportPanel, LineagePanel, ReportList } from "@/components/reports/panels";
import { buildReports, type ModelInputs } from "@/lib/reports/builders";
import { useModelEngine } from "@/lib/engine/useModelEngine";
import { useLiveRun } from "@/lib/engine/useLiveRun";
import { ATLF_REFERENCE_ISSUER_ID } from "@/lib/engine/types";
import { deepDiveCaveatKind } from "@/lib/deepdive/caveat";
import {
  getReportDraft,
  getSavedModel,
  exportReportVersionBinary,
  listReportVersions,
  publishReportVersion,
  saveReportDraft,
  type ReportVersionDTO,
} from "@/lib/api";
import { EnterprisePage, type NarrowContract } from "@/components/shared/EnterprisePage";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { DecisionRoomDrawer } from "@/components/decisions/DecisionRoomDrawer";
import { useAnalysisContext } from "@/lib/analysis-workbench";
import { buildLiveReports, reportFromVersion } from "@/lib/reports/live-builder";

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
  authority,
}: {
  rep: ReturnType<typeof buildReports>[number];
  omit: Record<number, boolean>;
  showSources: boolean;
  edits: Record<string, string>;
  hideAddbacks?: boolean;
  authority?: Parameters<typeof ReportDoc>[0]["authority"];
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
  return createPortal(
    <ReportDoc rep={rep} omit={omit} paper="#ffffff" showSources={showSources} edits={edits} hideAddbacks={hideAddbacks} authority={authority} />,
    el,
  );
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
  const analysis = useAnalysisContext({ name: "Committee report workspace" });

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
  const [versions, setVersions] = useState<ReportVersionDTO[]>([]);
  const reports = useMemo(
    () => {
      if (isReference) return buildReports({ ...modelInputs, anchor: eng.anchor ?? undefined });
      const liveReports = live.runId ? buildLiveReports({
        issuerId,
        runId: live.runId,
        asOf: live.asOf,
        committeeStatus: live.committeeStatus,
        liveOuts: live.liveOuts,
        liveStatus: live.liveStatus,
      }) : [];
      return [...liveReports, ...versions.map(reportFromVersion)];
    },
    [eng.anchor, isReference, issuerId, live.asOf, live.committeeStatus, live.liveOuts, live.liveStatus, live.runId, modelInputs, versions],
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
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [draftRevision, setDraftRevision] = useState<number | null>(null);
  const [serverDraftReady, setServerDraftReady] = useState(false);
  const [publishState, setPublishState] = useState<"idle" | "publishing" | "published" | "error">("idle");
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  useEffect(() => {
    const contextId = analysis.context?.id;
    if (!contextId || isReference) { setVersions([]); return; }
    let cancelled = false;
    listReportVersions(contextId)
      .then((rows) => { if (!cancelled) setVersions(rows); })
      .catch(() => { if (!cancelled) setPublishMessage("Published versions unavailable; the live draft remains open."); });
    return () => { cancelled = true; };
  }, [analysis.context?.id, isReference]);

  // restore persisted workspace state
  const reportParam = searchParams.get("report");
  const deepLinkedVersionId = reportParam && versions.some((version) => version.id === reportParam)
    ? reportParam
    : null;
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

  useEffect(() => {
    const contextId = analysis.context?.id;
    if (!contextId) return;
    let cancelled = false;
    setServerDraftReady(false);
    getReportDraft(contextId)
      .then((draft) => {
        if (cancelled) return;
        setDraftRevision(draft?.revision ?? null);
        const payload = draft?.payload ?? {};
        // A frozen-version deep link is an explicit navigation instruction.
        // Never let a slower mutable-draft response replace it.
        if (!deepLinkedVersionId && typeof payload.active_id === "string") setActiveId(payload.active_id);
        if (payload.omit && typeof payload.omit === "object") setOmit(payload.omit as Record<string, Record<number, boolean>>);
        if (payload.edits && typeof payload.edits === "object") setEdits(payload.edits as Record<string, Record<string, string>>);
        if (typeof payload.paper === "string") setPaper(payload.paper);
        if (typeof payload.show_sources === "boolean") setShowSources(payload.show_sources);
        if (typeof payload.hide_addbacks === "boolean") setHideAddbacks(payload.hide_addbacks);
      })
      .catch(() => setPublishMessage("Server draft unavailable; local edits remain intact."))
      .finally(() => { if (!cancelled) setServerDraftReady(true); });
    return () => { cancelled = true; };
  }, [analysis.context?.id, deepLinkedVersionId]);

  useEffect(() => {
    const contextId = analysis.context?.id;
    if (!contextId || !hydrated || !serverDraftReady) return;
    const timer = window.setTimeout(() => {
      void saveReportDraft(contextId, {
        issuer_id: issuerId,
        active_id: activeId,
        omit,
        edits,
        paper,
        show_sources: showSources,
        hide_addbacks: hideAddbacks,
      }, draftRevision ?? undefined)
        .then((draft) => {
          setDraftRevision(draft.revision);
          setPublishMessage("Draft autosaved");
        })
        .catch(() => setPublishMessage("Draft conflict — reload before publishing."));
    }, 850);
    return () => window.clearTimeout(timer);
    // draftRevision is intentionally excluded: a successful autosave updating
    // the revision must not immediately schedule an identical second write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, analysis.context?.id, edits, hideAddbacks, hydrated, issuerId, omit, paper, serverDraftReady, showSources]);

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

  useEffect(() => {
    const context = analysis.context;
    if (!context || !live.runId || context.artifacts.issuer_run_id === live.runId) return;
    void analysis.patch({
      issuer_ids: isReference ? context.issuer_ids : Array.from(new Set([...context.issuer_ids, issuerId])),
      artifacts: { ...context.artifacts, issuer_run_id: live.runId },
      surface_state: {
        ...context.surface_state,
        reports: { ...context.surface_state.reports, active_id: activeId, view: editMode ? "edit" : "preview" },
      },
    });
  }, [activeId, analysis, editMode, isReference, issuerId, live.runId]);

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

  const publishCommitteeVersion = async () => {
    const context = analysis.context;
    const checkpointId = context?.artifacts.model_checkpoint_id;
    if (!context || !live.runId || !checkpointId || !rep) return;
    setPublishState("publishing");
    setPublishMessage(null);
    try {
      const draft = await saveReportDraft(context.id, {
        issuer_id: issuerId,
        active_id: activeId,
        omit,
        edits,
        paper,
        show_sources: showSources,
        hide_addbacks: hideAddbacks,
      }, draftRevision ?? undefined);
      setDraftRevision(draft.revision);
      const version = await publishReportVersion({
        context_id: context.id,
        run_id: live.runId,
        model_checkpoint_id: checkpointId,
        payload: {
          issuer_id: issuerId,
          deliverable_id: rep.id,
          omit: repOmit,
          edits: repEdits,
          show_sources: showSources,
          hide_addbacks: hideAddbacks && rep.id === "model",
          rendered_report: rep,
        },
      });
      await analysis.patch({ artifacts: { ...context.artifacts, report_version_id: version.id } });
      setVersions((current) => [version, ...current.filter((item) => item.id !== version.id)]);
      setActiveId(version.id);
      setPublishState("published");
      setPublishMessage(`Published ${version.id.slice(0, 8)} · immutable`);
    } catch (reason) {
      setPublishState("error");
      setPublishMessage(reason instanceof Error ? reason.message : "Publish blocked by readiness or version conflict.");
    }
  };

  const activeVersionId = versions.some((version) => version.id === rep?.id)
    ? rep?.id ?? null
    : analysis.context?.artifacts.report_version_id ?? null;
  const downloadVersion = async (format: "pdf" | "xlsx") => {
    if (!activeVersionId) {
      setPublishMessage("Publish an immutable committee version before downloading a binary file.");
      return;
    }
    setPublishMessage(`Preparing ${format.toUpperCase()}…`);
    try {
      const file = await exportReportVersionBinary(activeVersionId, format);
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setPublishMessage(`Downloaded ${file.filename}`);
    } catch (reason) {
      setPublishMessage(reason instanceof Error ? reason.message : `${format.toUpperCase()} export failed.`);
    }
  };

  // phase included so a backend outage reads "could not load", not the confident
  // "no run for this issuer" — this surface produces committee documents.
  const caveatKind = deepDiveCaveatKind({ isReference, loading: eng.loading, runId: eng.runId, phase: eng.phase });

  // Printed authority block (P2-WP-8) — same caveat state and FE-5
  // live-run-backed distinction the on-screen header already uses (266-311
  // below), so the deliverable's own masthead never overstates or
  // understates what actually backs it.
  const authority = {
    caveatKind,
    liveRunBacked: caveatKind === "reference" && !!eng.runId,
    runId: eng.runId,
    qaNote: caveatKind === "reference" ? "QA: CP-5 CONDITIONAL — QA-117" : eng.committeeStatus ? `COMMITTEE: ${eng.committeeStatus}` : null,
  };

  const narrowContract: NarrowContract = {
    essentialControls: (
      <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">
        {Math.round(zoom * 100)}% · {editCount ? `${editCount} edit${editCount === 1 ? "" : "s"}` : "clean draft"}
      </span>
    ),
  };
  const canPublish = Boolean(
    !isReference
    && rep
    && live.runId
    && live.committeeStatus === "Committee Ready"
    && analysis.context?.artifacts.model_checkpoint_id,
  );
  const publishBlockReason = isReference
    ? "Reference output can be previewed and exported, but cannot be published as a live committee version."
    : !live.runId
      ? "A completed issuer run is required."
      : live.committeeStatus !== "Committee Ready"
        ? `Run is ${live.committeeStatus ?? "not committee ready"}.`
        : !analysis.context?.artifacts.model_checkpoint_id
          ? "Save an immutable Model checkpoint before publishing."
          : !rep
            ? "No issuer-specific report composition is available."
            : "Publish an immutable committee version.";

  return (
    <EnterprisePage kind="editor"
      identity={
        <ShellIdentity tag="CP-RENDER" title="Report Studio — committee deliverables">
          {caveatKind === "reference" && eng.runId ? (
            // FE-5: buildReports incorporates eng.anchor when a live run exists on
            // the reference issuer, but the debate/recovery/covenant tabs and the
            // DEAL narrative stay ATLF fixtures regardless (same rationale as
            // lib/deepdive/caveat.ts) — say both halves precisely instead of the
            // blanket "not a live issuer run" claim.
            <span
              className="flex items-center gap-1.5 min-w-0"
              role="note"
              title="A live run backs this issuer's figures, but the bespoke debate/recovery/covenant tabs still render the Atlas Forge reference fixture."
            >
              <ProvenanceChip prov={fromReportCaveat("reference", true)!} />
              <span className="tabular text-caos-xs whitespace-nowrap truncate text-caos-muted">
                bespoke tabs stay fixture, other figures reflect the live run
              </span>
            </span>
          ) : caveatKind === "reference" ? (
            <span
              className="flex items-center gap-1.5 min-w-0"
              role="note"
              title="Report Studio renders the Atlas Forge reference deal as a committee-ready template — not wired to a live issuer run."
            >
              <ProvenanceChip prov={fromReportCaveat("reference", false)!} />
              <span className="tabular text-caos-xs whitespace-nowrap truncate text-caos-muted">
                Atlas Forge fixture, not a live issuer run
              </span>
            </span>
          ) : caveatKind === "loading" ? (
            <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">
              checking for live run…
            </span>
          ) : caveatKind === "error" ? (
            <span
              className="tabular text-caos-xs whitespace-nowrap"
              style={{ color: "var(--caos-critical)" }}
              role="note"
              title="Could not load this issuer's live run — report state is unknown, not a confirmed no-run."
            >
              could not load live run
            </span>
          ) : caveatKind === "live" ? (
            <span
              className="flex items-center gap-1.5 min-w-0"
              title="Live engine modules are composed into this issuer-specific committee document."
            >
              <ProvenanceChip prov={fromReportCaveat("live", true)!} />
              <span className="tabular text-caos-xs whitespace-nowrap truncate" style={{ color: "var(--caos-warning)" }}>
                live module report · {live.runId?.slice(0, 8)}
              </span>
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
        </ShellIdentity>
      }
      primaryAction={
        <button
          type="button"
          onClick={() => void publishCommitteeVersion()}
          disabled={!canPublish || publishState === "publishing"}
          title={publishBlockReason}
          className="caos-primary-action focus-ring disabled:opacity-40"
        >
          {publishState === "publishing" ? "Publishing…" : "Publish committee version"}
        </button>
      }
      utilityLabel="Report utilities"
      utilityControls={
        <div className="grid gap-3 min-w-[17rem]">
          <fieldset className="grid gap-1.5">
            <legend className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted">Document display</legend>
            <div className="flex flex-wrap items-center gap-1.5">
              {PAPERS.map((p) => (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => setPaper(p.v)}
                  aria-pressed={paper === p.v}
                  aria-label={"Paper tone " + p.label}
                  title={"Paper tone — " + p.label + " · preview only"}
                  className={"focus-ring w-7 h-7 rounded-sm border transition-caos " + (paper === p.v ? "border-caos-accent" : "border-caos-border")}
                  style={{ background: p.v }}
                />
              ))}
              <button
                type="button"
                onClick={() => setShowSources(!showSources)}
                aria-pressed={showSources}
                className={"focus-ring tabular text-caos-xs px-2 h-7 rounded border transition-caos " + (showSources ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")}
              >
                SOURCES
              </button>
            </div>
          </fieldset>
          <fieldset className="grid gap-1.5">
            <legend className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted">Editorial controls</legend>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setEditMode(!editMode)}
                aria-pressed={editMode}
                className={"focus-ring tabular text-caos-xs px-2 h-7 rounded border transition-caos " + (editMode ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")}
              >
                {editMode ? "EDITING" : "EDIT DOCUMENT"}
              </button>
              {editCount > 0 ? (
                <button type="button" onClick={resetEdits} className="caos-action-secondary focus-ring">
                  RESET {editCount} EDIT{editCount === 1 ? "" : "S"}
                </button>
              ) : null}
            </div>
          </fieldset>
          <fieldset className="grid gap-1.5">
            <legend className="tabular text-caos-3xs uppercase tracking-wider text-caos-muted">Zoom</legend>
            <div className="flex flex-wrap items-center gap-1.5">
              {ZOOMS.map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoom(z)}
                  aria-pressed={zoom === z}
                  aria-label={"Zoom " + Math.round(z * 100) + " percent"}
                  className={"focus-ring tabular text-caos-xs px-2 h-7 rounded border transition-caos " + (zoom === z ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")}
                >
                  {Math.round(z * 100)}%
                </button>
              ))}
              <button type="button" onClick={fitToWidth} className="caos-action-secondary focus-ring">FIT</button>
            </div>
          </fieldset>
          {isReference ? (
            <button
              type="button"
              onClick={() => setEvModal("E-44")}
              className="caos-action-secondary focus-ring text-left"
              style={{ color: "var(--caos-warning)" }}
            >
              OPEN CP-5 CONDITIONAL · QA-117
            </button>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => window.print()} disabled={!rep} className="caos-action-secondary focus-ring disabled:opacity-40">Print / save PDF</button>
            <button type="button" onClick={() => void downloadVersion("pdf")} disabled={!activeVersionId} title={activeVersionId ? "Download the immutable PDF" : "Publish a committee version first"} className="caos-action-secondary focus-ring disabled:opacity-40">Download PDF</button>
            <button type="button" onClick={() => void downloadVersion("xlsx")} disabled={!activeVersionId} title={activeVersionId ? "Download the immutable XLSX" : "Publish a committee version first"} className="caos-action-secondary focus-ring disabled:opacity-40">Download XLSX</button>
          {live.runId ? (
            <button
              type="button"
              onClick={() => setDecisionOpen(true)}
              disabled={live.committeeStatus !== "Committee Ready"}
              title={live.committeeStatus === "Committee Ready" ? "Capture immutable IC decision" : `Run is ${live.committeeStatus ?? "not committee ready"}`}
              className="caos-action-secondary focus-ring disabled:opacity-40"
            >
              Submit to IC
            </button>
          ) : null}
          </div>
          <span role={publishState === "error" ? "alert" : "status"} className="tabular text-caos-xs text-caos-muted">{publishMessage || "Draft autosaves to the active analysis context."}</span>
        </div>
      }
      contextualControls={
        <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">
          {editMode ? "EDITING" : "PREVIEW"} · {showSources ? "SOURCES ON" : "SOURCES OFF"} · {Math.round(zoom * 100)}%
        </span>
      }
      narrowContract={narrowContract}
    >
      {/* workspace */}
      <div className="caos-persona-route reports-workbench flex-1 min-h-0">
      <PersonaWorkbench surface="reports" primary={<div className="report-studio-layout h-full min-h-0 flex gap-2 p-2">
        {rep && leftOpen ? <div className="report-studio-deliverables"><ReportList reports={reports} active={rep.id} onSel={setActiveId} onCollapse={() => setLeftOpen(false)} /></div> : rep ? <ReportRail label="Deliverables" onExpand={() => setLeftOpen(true)} /> : null}

        <div ref={scrollRef} tabIndex={0} aria-label="Report preview" className="report-studio-preview flex-1 min-w-0 rounded border border-caos-border overflow-auto focus-ring" style={{ background: "#08080c" }}>
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
                authority={authority}
              />
            </div> : (
              <div className="min-h-[420px] flex flex-col items-center justify-center gap-2 text-center px-6">
                <div className="tabular text-caos-xl text-caos-text">No issuer-specific report output</div>
                <div className="text-caos-md text-caos-muted max-w-[520px] leading-relaxed">
                  No completed live module output is available for this issuer. Run the
                  analysis pipeline, then return here to compose and publish the report.
                </div>
              </div>
            )}
          </div>
        </div>

        {rep && rightOpen ? <div className="report-studio-panels w-[300px] shrink-0 flex flex-col gap-2 min-h-0 overflow-y-auto pb-12">
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
          <ExportPanel rep={rep} omitCount={omitCount} editCount={editCount} runId={live.runId ?? undefined} />
        </div> : rep ? <ReportRail label="Panels" onExpand={() => setRightOpen(true)} /> : null}
      </div>} />
      </div>

      {evModal ? <EvidenceModal id={evModal} reports={reports} live={live.liveEvidence} isLiveRun={!isReference && !!live.runId} onClose={() => setEvModal(null)} /> : null}
      {decisionOpen && live.runId ? <DecisionRoomDrawer issuerId={issuerId} runId={live.runId} reportId={rep?.id ?? activeId} onClose={() => setDecisionOpen(false)} /> : null}
      {rep ? <PrintPortal rep={rep} omit={repOmit} showSources={showSources} edits={repEdits} hideAddbacks={hideAddbacks && rep.id === "model"} authority={authority} /> : null}
    </EnterprisePage>
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
