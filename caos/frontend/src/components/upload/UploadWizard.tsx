"use client";

// Document intake wizard (CP-0) — CAOS design language: panel chrome, dense
// tabular rows, accent-bordered actions. Flow: select issuer → drop ALL deal
// documents + pick the run mode → batch upload via /api/ingestion. There is
// no per-document type or date entry: ingested documents are already dated,
// and classification is CP-0's job.

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { createIssuer, getIssuers, uploadDocument, uploadPricingSheet } from "@/lib/api";
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
  const [uploading, setUploading] = useState(false);
  const [outcomes, setOutcomes] = useState<FileOutcome[]>([]);
  const [error, setError] = useState("");

  // New issuer inline form
  const [showNewIssuer, setShowNewIssuer] = useState(false);
  const [newIssuerName, setNewIssuerName] = useState("");
  const [newIssuerTicker, setNewIssuerTicker] = useState("");

  // Optional ?issuer=<id> deep-link from a directory row's UPLOAD action.
  const issuerParam = useSearchParams().get("issuer");

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => {
      const have = new Set(prev.map((f) => f.name + ":" + f.size));
      return [...prev, ...accepted.filter((f) => !have.has(f.name + ":" + f.size))];
    });
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
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "Failed to create issuer");
    }
  };

  const handleUpload = async () => {
    if (!selectedIssuer || files.length === 0) return;
    setUploading(true);
    setError("");

    const results: FileOutcome[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append("issuer_id", selectedIssuer.id);
      formData.append("run_mode", runMode);
      formData.append("file", file);
      try {
        const res = isSpreadsheet(file.name)
          ? await uploadPricingSheet(formData)
          : await uploadDocument(formData);
        results.push({ name: file.name, result: res });
      } catch (err) {
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        results.push({ name: file.name, error: detail || "Upload failed" });
      }
    }

    setOutcomes(results);
    setUploading(false);
    setStep("result");
  };

  const reset = () => {
    setStep("issuer");
    setSelectedIssuer(null);
    setFiles([]);
    setRunMode("full");
    setOutcomes([]);
    setError("");
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

      {/* Step 1: issuer */}
      {step === "issuer" ? (
        <IssuerStep
          issuers={issuers.filter((i) => `${i.name} ${i.ticker ?? ""} ${i.sector ?? i.industry ?? ""} ${i.sub_sector ?? ""}`.toLowerCase().includes(issuerQuery.trim().toLowerCase()))}
          issuerQuery={issuerQuery}
          setIssuerQuery={setIssuerQuery}
          selectedIssuer={selectedIssuer}
          onSelectIssuer={(issuer) => { setSelectedIssuer(issuer); setStep("file"); }}
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
          onUpload={handleUpload}
          onBack={() => { setStep("issuer"); setFiles([]); }}
        />
      ) : null}

      {/* Step 2 companion: pull governing docs straight from SEC EDGAR (free) */}
      {step === "file" && selectedIssuer ? (
        <EdgarImport issuer={selectedIssuer} runMode={runMode} />
      ) : null}

      {/* Step 3: result */}
      {step === "result" && outcomes.length ? (
        <ResultStep
          outcomes={outcomes}
          selectedIssuer={selectedIssuer}
          modeMeta={modeMeta}
          okCount={okCount}
          failCount={failCount}
          totalChunks={totalChunks}
          onReset={reset}
        />
      ) : null}
    </div>
  );
}
