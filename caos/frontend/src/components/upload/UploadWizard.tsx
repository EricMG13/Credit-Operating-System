"use client";

// Document intake wizard (CP-0) — CAOS design language: panel chrome, dense
// tabular rows, accent-bordered actions. Flow: select issuer → drop ALL deal
// documents + pick the run mode → batch upload via /api/ingestion. There is
// no per-document type or date entry: ingested documents are already dated,
// and classification is CP-0's job.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDropzone, type FileRejection } from "react-dropzone";
import { appendIngestionContext, createIssuer, createRun, getIssuers, getPortfolios, toErrorMessage, uploadDocument, uploadPricingSheet, type PortfolioSummary } from "@/lib/api";
import type { Issuer } from "@/types/issuers";
import type { RunSummaryDTO } from "@/lib/engine/types";
import { Dot } from "@/components/pipeline/atoms";
import { FirstRunHint } from "@/components/shared/FirstRunHint";
import { SurfaceState } from "@/components/shared/SurfaceState";
import { EdgarImport } from "@/components/upload/EdgarImport";
import type { EdgarVaultResult } from "@/lib/api";
import {
  FileStep, IssuerStep, ResultStep, RUN_MODES, StepStrip, isSpreadsheet,
  type FileOutcome, type RunQueueOutcome, type Step,
} from "@/components/upload/steps";
import { ensureIssuerScope } from "@/components/upload/context";
import { useAnalysisContext } from "@/lib/analysis-workbench";

interface UploadWizardProps {
  initialIssuers?: Issuer[];
}

export function UploadWizard({ initialIssuers = [] }: UploadWizardProps) {
  const analysis = useAnalysisContext({ name: "Document intake" });
  const [step, setStep] = useState<Step>("issuer");
  const [issuers, setIssuers] = useState<Issuer[]>(initialIssuers);
  const [issuerLoadState, setIssuerLoadState] = useState<"loading" | "ready" | "error">(
    initialIssuers.length > 0 ? "ready" : "loading",
  );
  const [issuerLoadError, setIssuerLoadError] = useState("");
  const issuerLoadGenerationRef = useRef(0);
  const [issuerQuery, setIssuerQuery] = useState("");
  const [selectedIssuer, setSelectedIssuer] = useState<Issuer | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [runMode, setRunMode] = useState<string>("full");
  const [origin, setOrigin] = useState<"live" | "reference" | "demo">("live");
  const [method, setMethod] = useState<"reported" | "derived" | "modelled">("reported");
  // Portfolio context for the run CP-3C evaluates against ("" = auto-bind the
  // book holding the issuer). Fetched once; picker only shows if any book exists.
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [portfolioId, setPortfolioId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [outcomes, setOutcomes] = useState<FileOutcome[]>([]);
  const [error, setError] = useState("");
  // Truthful run-queue outcome for the completion panel (FE-1): the analysis
  // run is actually POSTed after a successful batch; the panel reports what
  // happened instead of asserting "run queued" unconditionally.
  const [runOutcome, setRunOutcome] = useState<RunQueueOutcome | null>(null);
  // Guards a failed-file retry from double-queuing (the loop re-runs runUpload).
  const runQueuedRef = useRef(false);
  // Keep one key across ambiguous network failures; clear it only after the
  // server has returned a definite run so a later deliberate run is distinct.
  const runIdempotencyKeyRef = useRef<string | null>(null);

  // Live per-file batch progress: which file (1-based) is in flight and its
  // name, so the primary action reads "UPLOADING 3/12 — filename…" instead of a
  // single opaque spinner across a minutes-long batch.
  const [progress, setProgress] = useState<{ index: number; total: number; name: string } | null>(null);
  // Run-creation (FE-2): the wizard vaults documents but never kicked off an
  // analytical run — POST /api/runs existed as API-client-only, unused by any
  // page. This is the missing trigger: explicit action on the result step, not
  // automatic, so an analyst can stage more documents before spending a run.
  const [runCreating, setRunCreating] = useState(false);
  const [runCreated, setRunCreated] = useState<RunSummaryDTO | null>(null);
  const [runError, setRunError] = useState("");
  // A cancel flag checked between iterations lets an analyst abort a stalled
  // batch. A ref (not state) so the running loop reads the latest value without
  // a stale closure.
  const cancelRef = useRef(false);
  const uploadingRef = useRef(false); // synchronous re-entrancy guard (uploading state lags a render)
  // Files skipped by the dropzone accept filter (.docx side letters, scanned
  // .tif, etc.) — surfaced as a dismissible warning so intake never silently
  // drops a source.
  const [rejected, setRejected] = useState<string[]>([]);

  // New issuer inline form
  const [showNewIssuer, setShowNewIssuer] = useState(false);
  const [newIssuerName, setNewIssuerName] = useState("");
  const [newIssuerTicker, setNewIssuerTicker] = useState("");

  // Optional ?issuer=<id> deep-link from a directory row's UPLOAD action.
  const issuerParam = useSearchParams().get("issuer");

  // Portfolios for the run-context picker (best-effort; the picker is optional).
  useEffect(() => {
    getPortfolios().then(setPortfolios).catch(() => setPortfolios([]));
  }, []);

  const onDrop = useCallback((accepted: File[], rejections: FileRejection[]) => {
    setFiles((prev) => {
      const have = new Set(prev.map((f) => f.name + ":" + f.size));
      return [...prev, ...accepted.filter((f) => !have.has(f.name + ":" + f.size))];
    });
    if (rejections.length) {
      setRejected((prev) => {
        const have = new Set(prev);
        return [...prev, ...rejections.map((r) => r.file.name).filter((n) => !have.has(n))];
      });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
  });

  // Ref guard (not state): synchronous, so a same-tick double-click can't fire two
  // POSTs. The button isn't disabled during the await, and the server now dedups on
  // name (409), which would otherwise surface a confusing "already exists" on the
  // second submit even though the first succeeded.
  const creatingIssuer = useRef(false);
  const handleCreateIssuer = async () => {
    if (creatingIssuer.current) return;
    creatingIssuer.current = true;
    try {
      const created = await createIssuer({ name: newIssuerName, ticker: newIssuerTicker || null });
      setIssuers([...issuers, created]);
      setSelectedIssuer(created);
      setShowNewIssuer(false);
      setNewIssuerName("");
      setNewIssuerTicker("");
    } catch (err) {
      setError(toErrorMessage(err, "Failed to create issuer"));
    } finally {
      creatingIssuer.current = false;
    }
  };

  // Upload a batch of files sequentially. `batch` defaults to the full staged
  // set; a retry passes only the previously-failed files and `keep` carries the
  // outcomes that already succeeded so the result view stays complete.
  const runUpload = async (batch: File[], keep: FileOutcome[] = []) => {
    if (!selectedIssuer || batch.length === 0) return;
    // Re-entrancy guard: a fast double-click fires runUpload twice before React
    // re-renders `uploading`, so the state check can't stop the duplicate — a ref
    // set synchronously here does. Reset in finally so a throw can't wedge uploads.
    if (uploadingRef.current) return;
    uploadingRef.current = true;
    cancelRef.current = false;
    setUploading(true);
    setError("");
    // Show the result step immediately so successful rows stream in live
    // instead of appearing only after the whole batch settles.
    setOutcomes(keep);
    setStep("result");

    let vaultedAny = false;
    try {
      let activeContext = await ensureIssuerScope(
        analysis.context, selectedIssuer.id, analysis.patch,
      );
      for (let i = 0; i < batch.length; i++) {
        if (cancelRef.current) break;
        const file = batch[i];
        setProgress({ index: i + 1, total: batch.length, name: file.name });
        const formData = new FormData();
        formData.append("issuer_id", selectedIssuer.id);
        formData.append("run_mode", runMode);
        formData.append("origin", origin);
        formData.append("method", method);
        appendIngestionContext(formData, activeContext?.id);
        formData.append("file", file);
        let settled: FileOutcome;
        try {
          const res = isSpreadsheet(file.name)
            ? await uploadPricingSheet(formData)
            : await uploadDocument(formData);
          settled = { name: file.name, result: res, file };
          vaultedAny = true;
          if (activeContext) {
            const legacyArtifacts = { ...activeContext.artifacts };
            delete legacyArtifacts.artifact_refs;
            const patchedContext = await analysis.patch({
              issuer_ids: activeContext.issuer_ids,
              artifacts: { ...legacyArtifacts, source_manifest_id: res.source_manifest_id },
              surface_state: {
                ...activeContext.surface_state,
                upload: {
                  ...(activeContext.surface_state.upload ?? {}),
                  active_id: res.source_manifest_id,
                  selected_ids: [selectedIssuer.id],
                  view: "result",
                },
              },
            }).catch(() => {
              setError("Source was ingested, but the analysis context could not be linked.");
              return null;
            });
            if (patchedContext) activeContext = patchedContext;
          }
        } catch (err) {
          settled = { name: file.name, error: toErrorMessage(err, "Upload failed"), file };
        }
        setOutcomes((prev) => [...prev, settled]);
      }

      // Actually queue the analysis run the completion copy promises. The wizard
      // used to SAY "run queued" while no UI path ever called POST /api/runs —
      // the platform's core loop dead-ended and every live surface stayed empty
      // (audit 2026-07-10 FE-1). Truthful outcomes: queued (with the run id),
      // already-active (409 dedup), or failed (message; the panel says how to
      // proceed). runQueuedRef stops a failed-file RETRY from double-posting a
      // run that the first pass already queued.
      if (vaultedAny && !cancelRef.current && !runQueuedRef.current) {
        setRunOutcome({ state: "queuing" });
        try {
          const run = await createRun(
            selectedIssuer.id,
            undefined,
            portfolioId || undefined,
            runIdempotencyKeyRef.current ??= crypto.randomUUID(),
            activeContext?.id,
          );
          runIdempotencyKeyRef.current = null;
          runQueuedRef.current = true;
          setRunOutcome({ state: "queued", runId: run.id });
          if (activeContext) {
            const legacyArtifacts = { ...activeContext.artifacts };
            delete legacyArtifacts.artifact_refs;
            try {
              await analysis.patch({ artifacts: { ...legacyArtifacts, issuer_run_id: run.id } });
            } catch {
              setError("Run queued, but the analysis context could not be linked. Use the exact Execution Graph link below.");
            }
          }
          // Keep the settled intake report in place. The exact Execution Graph
          // link below is deliberate analyst navigation, not an automatic route
          // change that hides per-file outcome and zero-text warnings.
        } catch (err: unknown) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 409) {
            runQueuedRef.current = true;  // one is already active — same end state
            setRunOutcome({ state: "active" });
          } else {
            setRunOutcome({ state: "failed", message: toErrorMessage(err, "Run not started") });
          }
        }
      }
    } finally {
      setProgress(null);
      setUploading(false);
      uploadingRef.current = false;
    }
  };

  const handleUpload = () => runUpload(files);

  // Retry only the files that failed, preserving issuer/mode and the outcomes
  // that already succeeded.
  const handleRetryFailed = () => {
    const ok = outcomes.filter((o) => o.result);
    const failedFiles = outcomes.filter((o) => !o.result && o.file).map((o) => o.file as File);
    runUpload(failedFiles, ok);
  };

  const cancelUpload = () => {
    cancelRef.current = true;
  };

  const handleCreateRun = async () => {
    if (!selectedIssuer) return;
    setRunCreating(true);
    setRunError("");
    try {
      const activeContext = await ensureIssuerScope(
        analysis.context, selectedIssuer.id, analysis.patch,
      );
      const run = await createRun(
        selectedIssuer.id,
        undefined,
        portfolioId || undefined,
        runIdempotencyKeyRef.current ??= crypto.randomUUID(),
        activeContext?.id,
      );
      runIdempotencyKeyRef.current = null;
      setRunCreated(run);
      if (activeContext) {
        const legacyArtifacts = { ...activeContext.artifacts };
        delete legacyArtifacts.artifact_refs;
        try {
          await analysis.patch({ artifacts: { ...legacyArtifacts, issuer_run_id: run.id } });
        } catch {
          setRunError("Run queued, but the analysis context could not be linked. Use the exact Execution Graph link.");
        }
      }
      // ResultStep exposes the exact Execution Graph link after the queue
      // settles; do not navigate away from the completed source report.
    } catch (err) {
      setRunError(toErrorMessage(err, "Could not create the run"));
    } finally {
      setRunCreating(false);
    }
  };

  const reset = () => {
    setStep("issuer");
    setSelectedIssuer(null);
    setFiles([]);
    setRunMode("full");
    setOrigin("live");
    setMethod("reported");
    setOutcomes([]);
    setError("");
    setProgress(null);
    setRejected([]);
    setRunCreating(false);
    setRunCreated(null);
    setRunError("");
    cancelRef.current = false;
    setRunOutcome(null);
    runQueuedRef.current = false;
  };

  const handleEdgarVaulted = (vaulted: EdgarVaultResult) => {
    // EDGAR persists a document but does not return the upload endpoint's
    // source-manifest or malware-verdict fields. Preserve those absences in the
    // shared outcome record instead of manufacturing a "clean" scan or id.
    setOutcomes((prev) => prev.some((outcome) => outcome.result?.document_id === vaulted.document_id)
      ? prev
      : [...prev, {
        name: vaulted.message,
        result: {
          document_id: vaulted.document_id,
          issuer_id: selectedIssuer?.id ?? "",
          minio_key: vaulted.storage_key,
          chunks_created: vaulted.chunks_created,
          message: vaulted.message,
          warning: vaulted.warning,
        },
      }]);
    setStep("result");
  };

  const loadIssuerDirectory = useCallback(async () => {
    const generation = ++issuerLoadGenerationRef.current;
    setIssuerLoadState("loading");
    setIssuerLoadError("");
    try {
      const loaded = await getIssuers();
      if (generation !== issuerLoadGenerationRef.current) return;
      setIssuers(loaded);
      setIssuerLoadState("ready");
    } catch (err) {
      if (generation !== issuerLoadGenerationRef.current) return;
      setIssuerLoadState("error");
      setIssuerLoadError(toErrorMessage(err, "Could not load the issuer directory"));
    }
  }, []);

  useEffect(() => {
    if (initialIssuers.length === 0) void loadIssuerDirectory();
    return () => { issuerLoadGenerationRef.current += 1; };
  }, [initialIssuers.length, loadIssuerDirectory]);

  // Deep-link: arriving with ?issuer=<id> for an issuer that already exists
  // pre-selects it and skips straight to "Files & run mode" (step 02). Only
  // auto-advances from the first step, so it never fights later navigation.
  useEffect(() => {
    if (!issuerParam) return;
    const match = issuers.find((i) => i.id === issuerParam);
    if (match) {
      setSelectedIssuer(match);
      setStep((s) => (s === "issuer" ? "file" : s));
    }
  }, [issuerParam, issuers]);

  const syncContext = analysis.context;
  const patchContext = analysis.patch;
  useEffect(() => {
    if (!selectedIssuer || !syncContext) return;
    const context = syncContext;
    const issuerIds = context.issuer_ids.includes(selectedIssuer.id)
      ? context.issuer_ids
      : [...context.issuer_ids, selectedIssuer.id];
    const current = context.surface_state.upload;
    if (issuerIds === context.issuer_ids && current?.selected_ids?.[0] === selectedIssuer.id && current.view === step) return;
    void patchContext({
      issuer_ids: issuerIds,
      surface_state: {
        upload: { ...(current ?? {}), selected_ids: [selectedIssuer.id], view: step },
      },
    }).catch(() => setError("The selected issuer could not be linked to this analysis context."));
  }, [patchContext, selectedIssuer, step, syncContext]);

  const modeMeta = RUN_MODES.find((m) => m.k === runMode);
  const okCount = outcomes.filter((o) => o.result).length;
  const failCount = outcomes.length - okCount;
  const totalChunks = outcomes.reduce((n, o) => n + (o.result?.chunks_created || 0), 0);

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-2">
      <FirstRunHint id="upload-intake">
        Drop <span className="text-white font-medium">all</span>{" "}of an issuer&apos;s deal documents at once — CP-0 classifies and dates each on ingest. Pick a run mode and the engine routes the matching modules.
      </FirstRunHint>
      <StepStrip step={step} selectedIssuer={selectedIssuer} modeMeta={modeMeta} filesCount={files.length} />

      {error ? (
        <div className="rounded border px-3 py-2 flex items-center gap-2" style={{ borderColor: "color-mix(in srgb, var(--caos-critical) 50%, transparent)", background: "color-mix(in srgb, var(--caos-critical) 7%, transparent)" }}>
          <Dot sev="critical" />
          <span className="text-caos-lg" style={{ color: "var(--caos-critical-bright)" }}>{error}</span>
        </div>
      ) : null}

      {step === "issuer" && issuerLoadState === "loading" ? (
        <SurfaceState kind="loading" title="Loading issuer directory…" compact />
      ) : null}
      {step === "issuer" && issuerLoadState === "error" ? (
        <SurfaceState
          kind="error"
          title={issuerLoadError}
          compact
          primaryAction={
            <button type="button" className="caos-action-secondary focus-ring" onClick={() => void loadIssuerDirectory()}>
              Retry issuer load
            </button>
          }
        />
      ) : null}

      {/* Dropzone-rejected files — surfaced so intake never silently drops a
          source (a .docx side letter, a scanned .tif). Dismissible once seen. */}
      {rejected.length ? (
        <div className="rounded border px-3 py-2 flex items-start gap-2" style={{ borderColor: "color-mix(in srgb, var(--caos-warning) 50%, transparent)", background: "color-mix(in srgb, var(--caos-warning) 7%, transparent)" }}>
          <Dot sev="warning" />
          <span className="text-caos-lg flex-1 min-w-0" style={{ color: "var(--caos-warning)" }}>
            <span className="tabular">{rejected.length}</span> file{rejected.length > 1 ? "s" : ""} skipped — only PDF / XLSX are ingested:{" "}
            <span className="text-caos-text break-words">{rejected.join(", ")}</span>
          </span>
          <button
            onClick={() => setRejected([])}
            aria-label="Dismiss skipped-files warning"
            className="focus-ring shrink-0 tabular text-caos-xs uppercase tracking-wider text-caos-muted hover:text-caos-text transition-caos rounded px-1"
          >
            DISMISS
          </button>
        </div>
      ) : null}

      {/* Step 1: issuer */}
      {step === "issuer" ? (
        <IssuerStep
          issuers={issuers.filter((i) => `${i.name} ${i.ticker ?? ""} ${i.sector ?? i.industry ?? ""} ${i.sub_sector ?? ""}`.toLowerCase().includes(issuerQuery.trim().toLowerCase()))}
          issuerQuery={issuerQuery}
          setIssuerQuery={setIssuerQuery}
          selectedIssuer={selectedIssuer}
          onSelectIssuer={(issuer) => {
            // Staged files belong to the previously-selected issuer; only clear
            // them when the analyst actually switches to a different issuer, so
            // stepping back to confirm the same issuer never wipes the batch.
            if (selectedIssuer && selectedIssuer.id !== issuer.id) { setFiles([]); setRejected([]); }
            setSelectedIssuer(issuer);
            setStep("file");
          }}
          showNewIssuer={showNewIssuer}
          setShowNewIssuer={setShowNewIssuer}
          newIssuerName={newIssuerName}
          setNewIssuerName={setNewIssuerName}
          newIssuerTicker={newIssuerTicker}
          setNewIssuerTicker={setNewIssuerTicker}
          onCreateIssuer={handleCreateIssuer}
        />
      ) : null}

      {/* Step 2: files + run mode */}
      {step === "file" ? (
        <FileStep
          selectedIssuer={selectedIssuer}
          getRootProps={getRootProps}
          getInputProps={getInputProps}
          isDragActive={isDragActive}
          files={files}
          onRemoveFile={(f) => setFiles((prev) => prev.filter((x) => x !== f))}
          runMode={runMode}
          setRunMode={setRunMode}
          origin={origin}
          setOrigin={setOrigin}
          method={method}
          setMethod={setMethod}
          uploading={uploading}
          progress={progress}
          onUpload={handleUpload}
          onCancel={cancelUpload}
          onBack={() => setStep("issuer")}
          portfolios={portfolios}
          portfolioId={portfolioId}
          setPortfolioId={setPortfolioId}
        />
      ) : null}

      {/* Step 2 companion: pull governing docs straight from SEC EDGAR (free) */}
      {step === "file" && selectedIssuer ? (
        <EdgarImport issuer={selectedIssuer} runMode={runMode} onVaulted={handleEdgarVaulted} />
      ) : null}

      {/* Step 3: result — also rendered mid-batch so successful rows stream in
          live under a per-file progress header. */}
      {step === "result" && (outcomes.length || uploading) ? (
        <ResultStep
          outcomes={outcomes}
          selectedIssuer={selectedIssuer}
          modeMeta={modeMeta}
          okCount={okCount}
          failCount={failCount}
          totalChunks={totalChunks}
          uploading={uploading}
          progress={progress}
          runOutcome={runOutcome}
          onReset={reset}
          onRetryFailed={handleRetryFailed}
          runCreating={runCreating}
          runCreated={runCreated}
          runError={runError}
          onCreateRun={handleCreateRun}
          contextId={analysis.context?.id}
        />
      ) : null}
    </div>
  );
}
