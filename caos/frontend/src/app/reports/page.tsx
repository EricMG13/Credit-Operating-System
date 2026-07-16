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
  getReportVersion,
  getSavedModel,
  exportReportVersionBinary,
  listReportVersions,
  previewReportVersion,
  publishReportVersion,
  saveReportDraft,
  type ReportVersionDTO,
  type ReportVersionPreviewDTO,
} from "@/lib/api";
import { EnterprisePage, type NarrowContract } from "@/components/shared/EnterprisePage";
import { PersonaWorkbench } from "@/components/shared/PersonaWorkbench";
import { DecisionRoomDrawer } from "@/components/decisions/DecisionRoomDrawer";
import { useAnalysisContext } from "@/lib/analysis-workbench";
import { buildLiveReports, reportFromVersion } from "@/lib/reports/live-builder";
import { FreshnessIndicator } from "@/components/shared/FreshnessIndicator";
import { AnalysisContextSaveState } from "@/components/shared/AnalysisContextSaveState";
import { derivedFreshness, useIssuerFreshness } from "@/lib/engine/useFreshness";
import { freshnessDetail, resolveReportFreshnessTarget, toProvFreshness } from "@/lib/freshness";

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
  editableSectionCount,
  hideAddbacks,
  authority,
}: {
  rep: ReturnType<typeof buildReports>[number];
  omit: Record<number, boolean>;
  showSources: boolean;
  edits: Record<string, string>;
  editableSectionCount?: number;
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
    <ReportDoc rep={rep} omit={omit} paper="#ffffff" showSources={showSources} edits={edits} editableSectionCount={editableSectionCount} hideAddbacks={hideAddbacks} authority={authority} />,
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
  const exactRunId = searchParams.get("run");
  const requestedContextId = searchParams.get("context");
  const isReference = issuerId === ATLF_REFERENCE_ISSUER_ID;
  const analysis = useAnalysisContext({
    name: "Committee report workspace",
    context_id: requestedContextId,
  });

  // Report Studio reads only the DB-saved Model Builder state. Unsaved browser
  // edits in /model do not affect committee output.
  const [modelInputs, setModelInputs] = useState<ModelInputs>({});
  const [modelLoadError, setModelLoadError] = useState(false);
  const [modelReloadKey, setModelReloadKey] = useState(0);
  useEffect(() => {
    // The browser calculator is a reference-fixture renderer only. Live issuer
    // reports consume the server-frozen Model Engine v2 checkpoint attached to
    // an immutable report version; never hydrate legacy SavedModel inputs here.
    if (!isReference) {
      setModelInputs({});
      setModelLoadError(false);
      return;
    }
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
  }, [isReference, issuerId, modelReloadKey]);
  const eng = useModelEngine(issuerId);
  const live = useLiveRun(issuerId, exactRunId);
  const [versions, setVersions] = useState<ReportVersionDTO[]>([]);
  const [serverPreview, setServerPreview] = useState<ReportVersionPreviewDTO | null>(null);
  const [previewIntent, setPreviewIntent] = useState<Record<string, unknown> | null>(null);
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
      return [
        ...liveReports,
        ...(serverPreview ? [reportFromVersion(serverPreview)] : []),
        ...versions.map(reportFromVersion),
      ];
    },
    [eng.anchor, isReference, issuerId, live.asOf, live.committeeStatus, live.liveOuts, live.liveStatus, live.runId, modelInputs, serverPreview, versions],
  );

  const [activeId, setActiveId] = useState("snapshot");
  const [zoom, setZoom] = useState(0.85);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [omit, setOmit] = useState<Record<string, Record<number, boolean>>>({});
  const [paper, setPaper] = useState("#f7f5ee");
  const [showSources, setShowSources] = useState(true);
  const [evModal, setEvModal] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  // The committee sheet is the point of this surface — below ~1600px both
  // rails plus the 980px sheet don't fit, so start the left list collapsed and
  // let the analyst reopen it. User toggles win after mount.
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1600) setLeftOpen(false);
  }, []);
  const [hideAddbacks, setHideAddbacks] = useState(false);
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [hydrated, setHydrated] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [draftRevision, setDraftRevision] = useState<number | null>(null);
  const [serverDraftReady, setServerDraftReady] = useState(false);
  const [publishState, setPublishState] = useState<"idle" | "publishing" | "published" | "error">("idle");
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const versionPayloadRequests = useRef(new Set<string>());
  const workspaceScope = `${analysis.context?.id ?? "loading"}:${issuerId}:${exactRunId ?? "latest"}`;
  const targetRunId = exactRunId ?? live.runId;

  useEffect(() => {
    setActiveId("snapshot");
    setOmit({});
    setEdits({});
    setServerPreview(null);
    setPreviewIntent(null);
    setDraftRevision(null);
    setServerDraftReady(false);
    setPublishState("idle");
    setPublishMessage(null);
    versionPayloadRequests.current.clear();
  }, [workspaceScope]);

  useEffect(() => {
    const contextId = analysis.context?.id;
    if (!contextId || isReference || !targetRunId) { setVersions([]); return; }
    let cancelled = false;
    listReportVersions(contextId)
      .then((rows) => {
        if (!cancelled) setVersions(rows.filter((version) => version.run_id === targetRunId));
      })
      .catch(() => { if (!cancelled) setPublishMessage("Published versions unavailable; the live draft remains open."); });
    return () => { cancelled = true; };
  }, [analysis.context?.id, isReference, targetRunId]);

  useEffect(() => {
    const summary = versions.find((version) => version.id === activeId);
    if (!summary || Object.keys(summary.payload).length || versionPayloadRequests.current.has(summary.id)) return;
    versionPayloadRequests.current.add(summary.id);
    void getReportVersion(summary.id)
      .then((full) => setVersions((current) => current.map((item) => item.id === full.id ? full : item)))
      .catch(() => setPublishMessage("The immutable report payload could not be loaded."))
      .finally(() => versionPayloadRequests.current.delete(summary.id));
  }, [activeId, versions]);

  // Persist only display preference. Report selection, omissions, and analyst
  // edits are sensitive, context-bound draft state and belong on the server.
  const reportParam = searchParams.get("report");
  const deepLinkedVersionId = reportParam && versions.some((version) => version.id === reportParam)
    ? reportParam
    : null;
  // fallow-ignore-next-line complexity
  useEffect(() => {
    try {
      const z = parseFloat(localStorage.getItem("caos-e-zoom") || "");
      if (ZOOMS.includes(z)) setZoom(z);
    } catch { /* first visit */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (reportParam && reports.some((report) => report.id === reportParam)) {
      setActiveId(reportParam);
    }
  }, [reportParam, reports]);

  // Consolidate persisted settings into a single effect block
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("caos-e-zoom", String(zoom));
    } catch {}
  }, [hydrated, zoom]);

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
        if (payload.issuer_id !== issuerId) return;
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
  }, [analysis.context?.id, deepLinkedVersionId, issuerId, workspaceScope]);

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
  const selectedPublishedVersion = versions.find((version) => version.id === rep?.id) ?? null;
  const isFrozenPreview = Boolean(serverPreview && serverPreview.id === rep?.id);
  const { artifactId: reportArtifactId, runId: reportRunId } = resolveReportFreshnessTarget(
    selectedPublishedVersion,
    eng.runId,
  );
  const freshnessRead = useIssuerFreshness({
    contextId: analysis.context?.id,
    runId: reportRunId,
    artifactRevision: `${analysis.context?.updated_at ?? ""}:${reportArtifactId ?? "draft"}`,
  });
  const exactReportFreshness = reportArtifactId
    ? freshnessRead.context?.artifacts.find((item) =>
      item.evaluation.source_kind === "derived_artifact" && item.artifact.id === reportArtifactId)?.evaluation ?? null
    : null;
  const reportFreshness = selectedPublishedVersion
    ? exactReportFreshness
    : derivedFreshness(freshnessRead, reportArtifactId);

  // Auto-fit the sheet on first render, per report, AND whenever the preview
  // column resizes (window resize, rail toggles) — a mount-only fit left the
  // 980px paper clipped under the lineage rail after any reflow. Only when the
  // analyst has no remembered manual zoom (reports_flow asserts persistence).
  useEffect(() => {
    if (!hydrated) return;
    const refit = () => {
      let stored = "";
      try { stored = localStorage.getItem("caos-e-zoom") || ""; } catch {}
      if (stored) return; // respect a remembered manual zoom
      const el = scrollRef.current;
      if (el && el.scrollWidth > el.clientWidth) fitToWidth();
    };
    refit();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(refit);
    observer.observe(el);
    return () => observer.disconnect();
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
  const frozenReviewedSectionCount = isFrozenPreview
    ? (
        (
          serverPreview?.payload.composition as
            | { reviewed_report?: { sections?: unknown[] } }
            | undefined
        )?.reviewed_report?.sections?.length ?? 0
      )
    : null;
  const rawRepOmit = rep ? omit[rep.id] || {} : {};
  const repOmit = frozenReviewedSectionCount === null
    ? rawRepOmit
    : Object.fromEntries(Object.entries(rawRepOmit).filter(([index, hidden]) => (
        hidden && Number(index) < frozenReviewedSectionCount
      )));
  const omitCount = Object.keys(repOmit).length;
  const rawRepEdits = rep ? edits[rep.id] || {} : {};
  const repEdits = frozenReviewedSectionCount === null
    ? rawRepEdits
    : Object.fromEntries(Object.entries(rawRepEdits).filter(([path]) => {
        const match = /^s(\d+)(?:\.|$)/.exec(path);
        return !match || Number(match[1]) < frozenReviewedSectionCount;
      }));
  const editCount = Object.keys(repEdits).length;
  const previewHasMaterializedEditorial = Boolean(
    previewIntent
    && (
      Object.keys((previewIntent.edits as Record<string, unknown> | undefined) ?? {}).length
      || Object.values((previewIntent.omit as Record<string, boolean> | undefined) ?? {}).some(Boolean)
      || previewIntent.show_sources === false
      || previewIntent.hide_addbacks === true
    ),
  );
  const canEditComposition = Boolean(
    rep
    && !selectedPublishedVersion
    && (isReference || (isFrozenPreview && !previewHasMaterializedEditorial)),
  );
  const hasPendingPreviewEditorial = Boolean(
    isFrozenPreview
    && (
      editCount
      || omitCount
      || (previewIntent && previewIntent.show_sources !== showSources)
    ),
  );
  // Model identity, gaps, calculations, and debt are immutable appendices in a
  // frozen preview. Keep them visible in the document, but expose only the
  // server-owned reviewed-report section paths to the editorial compose rail.
  const composeRep = rep && frozenReviewedSectionCount !== null
    ? { ...rep, sections: rep.sections.slice(0, frozenReviewedSectionCount) }
    : rep;

  const reportsContext = analysis.context;
  const patchReportsContext = analysis.patch;
  useEffect(() => {
    const context = reportsContext;
    if (!context || !live.runId || context.artifacts.issuer_run_id === live.runId) return;
    void patchReportsContext({
      issuer_ids: isReference ? context.issuer_ids : Array.from(new Set([...context.issuer_ids, issuerId])),
      artifacts: { issuer_run_id: live.runId },
      surface_state: {
        ...context.surface_state,
        reports: { ...context.surface_state.reports, active_id: activeId, view: editMode ? "edit" : "preview" },
      },
    }).catch(() => undefined);
  }, [activeId, editMode, isReference, issuerId, live.runId, patchReportsContext, reportsContext]);

  const toggleSec = (i: number) => {
    if (!rep || !canEditComposition) return;
    setOmit((o) => {
      const cur = { ...o[rep.id] };
      if (cur[i]) delete cur[i];
      else cur[i] = true;
      return { ...o, [rep.id]: cur };
    });
  };

  const applyEdit = (path: string, text: string) => {
    if (!rep || !canEditComposition) return;
    const sectionMatch = /^s(\d+)(?:\.|$)/.exec(path);
    if (
      isFrozenPreview
      && sectionMatch
      && frozenReviewedSectionCount !== null
      && Number(sectionMatch[1]) >= frozenReviewedSectionCount
    ) return;
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
    if (!context || !live.runId || !checkpointId || !rep || selectedPublishedVersion) return;
    setPublishState("publishing");
    setPublishMessage(null);
    try {
      const isActiveFrozenPreview = serverPreview?.id === rep.id && previewIntent;
      if (isActiveFrozenPreview) {
        if (hasPendingPreviewEditorial) {
          const reviewedIntent = {
            ...previewIntent,
            omit: Object.fromEntries(Object.entries(repOmit).map(([key, value]) => [String(key), value])),
            edits: repEdits,
            show_sources: showSources,
          };
          const reviewedPreview = await previewReportVersion({
            context_id: context.id,
            run_id: live.runId,
            model_checkpoint_id: checkpointId,
            payload: reviewedIntent,
          });
          setServerPreview(reviewedPreview);
          setPreviewIntent(reviewedIntent);
          setActiveId(reviewedPreview.id);
          setEditMode(false);
          setPublishState("idle");
          setPublishMessage("Editorial changes are now materialized in the frozen preview. Review once more, then publish.");
          return;
        }
        const version = await publishReportVersion({
          context_id: context.id,
          run_id: live.runId,
          model_checkpoint_id: checkpointId,
          payload: previewIntent,
          preview_sha256: serverPreview.preview_sha256,
        });
        await analysis.patch({ artifacts: { report_version_id: version.id } });
        setVersions((current) => [version, ...current.filter((item) => item.id !== version.id)]);
        setServerPreview(null);
        setPreviewIntent(null);
        setActiveId(version.id);
        setPublishState("published");
        setPublishMessage(`Published ${version.id.slice(0, 8)} · immutable`);
        return;
      }
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
      // Live-run layouts are browser adapters, while publication is a
      // server-owned exact-run projection. Editorial paths are therefore
      // created only after this first frozen preview is visible; carrying
      // positional paths from the browser layout could edit the wrong module.
      const intent = {
        deliverable_id: "live-committee-pack",
        source_run_id: live.runId,
        omit: {},
        edits: {},
        show_sources: showSources,
        hide_addbacks: false,
      };
      const preview = await previewReportVersion({
        context_id: context.id,
        run_id: live.runId,
        model_checkpoint_id: checkpointId,
        payload: intent,
      });
      setServerPreview(preview);
      setPreviewIntent(intent);
      setActiveId(preview.id);
      setEditMode(false);
      setPublishState("idle");
      setPublishMessage("Frozen preview ready. Apply editorial changes here, then review its exact run, model identity, gaps, and debt appendix before publishing.");
    } catch (reason) {
      setPublishState("error");
      setPublishMessage(reason instanceof Error ? reason.message : "Publish blocked by readiness or version conflict.");
    }
  };

  const activeVersionId = selectedPublishedVersion?.id ?? null;
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
  const authorityCaveatKind = selectedPublishedVersion ? "live" : caveatKind;
  const selectedApprovalState = typeof selectedPublishedVersion?.authority.approval_state === "string"
    ? selectedPublishedVersion.authority.approval_state
    : "published";
  const activeFrozenAuthority = selectedPublishedVersion?.authority ?? serverPreview?.authority ?? null;
  const frozenModelNote = activeFrozenAuthority && typeof activeFrozenAuthority.model_origin === "string"
    ? ` · MODEL ${activeFrozenAuthority.model_origin.toUpperCase()}${activeFrozenAuthority.model_analyst_override ? " · OVERRIDDEN" : ""}`
    : "";

  // Printed authority block (P2-WP-8) — same caveat state and FE-5
  // live-run-backed distinction the on-screen header already uses (266-311
  // below), so the deliverable's own masthead never overstates or
  // understates what actually backs it.
  const authority = {
    caveatKind: authorityCaveatKind,
    liveRunBacked: selectedPublishedVersion ? true : caveatKind === "reference" && !!eng.runId,
    runId: reportRunId,
    qaNote: selectedPublishedVersion
      ? `IMMUTABLE: ${selectedApprovalState.toUpperCase()}${frozenModelNote}`
      : isFrozenPreview
        ? `SERVER-FROZEN PREVIEW${frozenModelNote}`
      : caveatKind === "reference" ? "QA: CP-5 CONDITIONAL — QA-117" : eng.committeeStatus ? `COMMITTEE: ${eng.committeeStatus}` : null,
    ...((reportRunId || reportArtifactId) ? {
      freshness: toProvFreshness(reportFreshness),
      freshnessDetail: reportFreshness ? freshnessDetail(reportFreshness) : "Central report freshness unavailable.",
    } : {}),
  };

  const narrowContract: NarrowContract = {
    essentialControls: (
      <span className="flex items-center gap-2">
        <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">
          ZOOM {Math.round(zoom * 100)}% · {editCount ? `${editCount} edit${editCount === 1 ? "" : "s"}` : "clean draft"}
        </span>
        {/* An editor's primary mode switch must never hide only in the drawer. */}
        <button type="button" onClick={() => setEditMode(!editMode)} disabled={!canEditComposition} className="caos-action-secondary focus-ring disabled:opacity-40">{editMode ? "Finish editing" : "Edit report"}</button>
      </span>
    ),
  };
  const canPublish = Boolean(
    !isReference
    && rep
    && !selectedPublishedVersion
    && live.runId
    && live.committeeStatus === "Committee Ready"
    && analysis.context?.artifacts.model_checkpoint_id,
  );
  const publishBlockReason = isReference
    ? "Reference output can be previewed and exported, but cannot be published as a live committee version."
    : selectedPublishedVersion
      ? "This is already an immutable published version. Select the live draft to create a new version."
    : !live.runId
      ? "A completed issuer run is required."
      : live.committeeStatus !== "Committee Ready"
        ? `Run is ${live.committeeStatus ?? "not committee ready"}.`
        : !analysis.context?.artifacts.model_checkpoint_id
          ? "Save an immutable Model checkpoint before publishing."
          : !rep
            ? "No issuer-specific report composition is available."
            : isFrozenPreview
              ? "Publish this exact server-frozen preview."
              : "Create a server-frozen preview for review before publication.";

  return (
    <EnterprisePage kind="editor"
      identity={
        <ShellIdentity tag="CP-RENDER" title="Report Studio — committee deliverables">
          {selectedPublishedVersion ? (
            <span
              className="tabular text-caos-xs whitespace-nowrap text-caos-accent"
              title={`Immutable report ${selectedPublishedVersion.id} bound to run ${selectedPublishedVersion.run_id}`}
            >
              published {selectedPublishedVersion.id.slice(0, 8)} · run {selectedPublishedVersion.run_id.slice(0, 8)}
            </span>
          ) : caveatKind === "reference" && eng.runId ? (
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
          {(reportRunId || reportArtifactId) ? <FreshnessIndicator evaluation={reportFreshness} /> : null}
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
          {publishState === "publishing"
            ? "Publishing…"
            : isFrozenPreview
              ? hasPendingPreviewEditorial ? "Review editorial changes" : "Publish reviewed preview"
              : "Review frozen preview"}
        </button>
      }
      status={<AnalysisContextSaveState analysis={analysis} />}
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
                disabled={!canEditComposition}
                aria-pressed={editMode}
                className={"focus-ring tabular text-caos-xs px-2 h-7 rounded border transition-caos disabled:opacity-40 " + (editMode ? "border-caos-accent text-caos-text bg-caos-elevated" : "border-caos-border text-caos-muted hover:text-caos-text")}
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
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!selectedPublishedVersion}
              title={selectedPublishedVersion ? "Print immutable published version" : "Publish an immutable committee version before printing"}
              className="caos-action-secondary focus-ring disabled:opacity-40"
            >Print / save PDF</button>
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
        <span className="flex items-center gap-2">
          <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">
            {editMode ? "EDITING" : "PREVIEW"} · {showSources ? "SOURCES ON" : "SOURCES OFF"} · ZOOM {Math.round(zoom * 100)}%
          </span>
          <button type="button" onClick={() => setEditMode(!editMode)} disabled={!canEditComposition} className="caos-action-secondary focus-ring disabled:opacity-40">{editMode ? "Finish editing" : "Edit report"}</button>
          {live.runId ? <button type="button" onClick={() => setDecisionOpen(true)} disabled={live.committeeStatus !== "Committee Ready"} className="caos-action-secondary focus-ring disabled:opacity-40">Open IC decision</button> : null}
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
            {/* visibility gates until the stored/auto-fit zoom has applied —
                first paint at the 0.85 default then a reflow to the fitted
                zoom read as a broken intermediate render. */}
            {rep ? <div style={{ zoom, "--rd-zoom": zoom, visibility: hydrated ? "visible" : "hidden" } as React.CSSProperties}>
              <ReportDoc
                rep={rep}
                omit={repOmit}
                paper={paper}
                showSources={showSources}
                edits={repEdits}
                onEdit={editMode && canEditComposition ? applyEdit : undefined}
                editableSectionCount={isFrozenPreview ? frozenReviewedSectionCount ?? undefined : undefined}
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
          {canEditComposition && composeRep ? <ComposePanel rep={composeRep} omit={repOmit} onToggle={toggleSec} /> : null}
          <ExportPanel rep={rep} omitCount={omitCount} editCount={editCount} runId={live.runId ?? undefined} />
        </div> : rep ? <ReportRail label="Panels" onExpand={() => setRightOpen(true)} /> : null}
      </div>} />
      </div>

      {evModal ? <EvidenceModal id={evModal} reports={reports} live={live.liveEvidence} isLiveRun={!isReference && !!live.runId} onClose={() => setEvModal(null)} /> : null}
      {decisionOpen && live.runId ? <DecisionRoomDrawer issuerId={issuerId} runId={live.runId} reportId={rep?.id ?? activeId} onClose={() => setDecisionOpen(false)} /> : null}
      {rep && selectedPublishedVersion ? <PrintPortal rep={rep} omit={repOmit} showSources={showSources} edits={repEdits} hideAddbacks={false} authority={authority} /> : null}
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
