"use client";

// Document intake wizard (CP-0) — CAOS design language: panel chrome, dense
// tabular rows, accent-bordered actions. Flow: select issuer → drop ALL deal
// documents + pick the run mode → batch upload via /api/ingestion. There is
// no per-document type or date entry: ingested documents are already dated,
// and classification is CP-0's job.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDropzone, type FileRejection } from "react-dropzone";
import { createIssuer, getIssuers, getPortfolios, toErrorMessage, uploadDocument, uploadPricingSheet, type PortfolioSummary } from "@/lib/api";
import type { Issuer } from "@/types/issuers";
import { Dot } from "@/components/pipeline/atoms";
import { FirstRunHint } from "@/components/shared/FirstRunHint";
import { EdgarImport } from "@/components/upload/EdgarImport";
import {
  FileStep, IssuerStep, ResultStep, RUN_MODES, StepStrip, isSpreadsheet,
  type FileOutcome, type Step,
} from "@/components/upload/steps";

interface UploadWizardProps {
  initialIssuers?: Issuer[];
}

export function UploadWizard({ initialIssuers = [] }: UploadWizardProps) {
  const [step, setStep] = useState<Step>("issuer");
  const [issuers, setIssuers] = useState<Issuer[]>(initialIssuers);
  const [issuerQuery, setIssuerQuery] = useState("");
  const [selectedIssuer, setSelectedIssuer] = useState<Issuer | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [runMode, setRunMode] = useState<string>("full");
  // Portfolio context for the run CP-3C evaluates against ("" = auto-bind the
  // book holding the issuer). Fetched once; picker only shows if any book exists.
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [portfolioId, setPortfolioId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [outcomes, setOutcomes] = useState<FileOutcome[]>([]);
  const [error, setError] = useState("");

  // Live per-file batch progress: which file (1-based) is in flight and its
  // name, so the primary action reads "UPLOADING 3/12 — filename…" instead of a
  // single opaque spinner across a minutes-long batch.
  const [progress, setProgress] = useState<{ index: number; total: number; name: string } | null>(null);
  // A cancel flag checked between iterations lets an analyst abort a stalled
  // batch. A ref (not state) so the running loop reads the latest value without
  // a stale closure.
  const cancelRef = useRef(false);
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
      "application/vnd.ms-excel": [".xls"],
    },
  });

  const handleCreateIssuer = async () => {
    try {
      const created = await createIssuer({ name: newIssuerName, ticker: newIssuerTicker || null });
      setIssuers([...issuers, created]);
      setSelectedIssuer(created);
      setShowNewIssuer(false);
      setNewIssuerName("");
      setNewIssuerTicker("");
    } catch (err) {
      setError(toErrorMessage(err, "Failed to create issuer"));
    }
  };

  // Upload a batch of files sequentially. `batch` defaults to the full staged
  // set; a retry passes only the previously-failed files and `keep` carries the
  // outcomes that already succeeded so the result view stays complete.
  const runUpload = async (batch: File[], keep: FileOutcome[] = []) => {
    if (!selectedIssuer || batch.length === 0) return;
    cancelRef.current = false;
    setUploading(true);
    setError("");
    // Show the result step immediately so successful rows stream in live
    // instead of appearing only after the whole batch settles.
    setOutcomes(keep);
    setStep("result");

    for (let i = 0; i < batch.length; i++) {
      if (cancelRef.current) break;
      const file = batch[i];
      setProgress({ index: i + 1, total: batch.length, name: file.name });
      const formData = new FormData();
      formData.append("issuer_id", selectedIssuer.id);
      formData.append("run_mode", runMode);
      formData.append("file", file);
      let settled: FileOutcome;
      try {
        const res = isSpreadsheet(file.name)
          ? await uploadPricingSheet(formData)
          : await uploadDocument(formData);
        settled = { name: file.name, result: res, file };
      } catch (err) {
        settled = { name: file.name, error: toErrorMessage(err, "Upload failed"), file };
      }
      setOutcomes((prev) => [...prev, settled]);
    }

    setProgress(null);
    setUploading(false);
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

  const reset = () => {
    setStep("issuer");
    setSelectedIssuer(null);
    setFiles([]);
    setRunMode("full");
    setOutcomes([]);
    setError("");
    setProgress(null);
    setRejected([]);
    cancelRef.current = false;
  };

  useEffect(() => {
    if (issuers.length === 0) {
      getIssuers().then(setIssuers).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const modeMeta = RUN_MODES.find((m) => m.k === runMode);
  const okCount = outcomes.filter((o) => o.result).length;
  const failCount = outcomes.length - okCount;
  const totalChunks = outcomes.reduce((n, o) => n + (o.result?.chunks_created || 0), 0);

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-2">
      <FirstRunHint id="upload-intake">
        Drop <span className="text-white font-medium">all</span> of an issuer&apos;s deal documents at once — CP-0 classifies and dates each on ingest. Pick a run mode and the engine routes the matching modules.
      </FirstRunHint>
      <StepStrip step={step} selectedIssuer={selectedIssuer} modeMeta={modeMeta} filesCount={files.length} />

      {error ? (
        <div className="rounded border px-3 py-2 flex items-center gap-2" style={{ borderColor: "color-mix(in srgb, var(--caos-critical) 50%, transparent)", background: "color-mix(in srgb, var(--caos-critical) 7%, transparent)" }}>
          <Dot sev="critical" />
          <span className="text-caos-lg" style={{ color: "var(--caos-critical-bright)" }}>{error}</span>
        </div>
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
        <EdgarImport issuer={selectedIssuer} runMode={runMode} />
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
          onReset={reset}
          onRetryFailed={handleRetryFailed}
        />
      ) : null}
    </div>
  );
}
