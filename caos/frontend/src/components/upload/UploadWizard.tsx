"use client";

// Document intake wizard (CP-0) — CAOS design language: panel chrome, dense
// tabular rows, accent-bordered actions. Flow: select issuer → drop ALL deal
// documents + pick the run mode → batch upload via /api/ingestion. There is
// no per-document type or date entry: ingested documents are already dated,
// and classification is CP-0's job.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TextInput } from "@/components/shared/TextInput";
import { useSearchParams } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { createIssuer, getIssuers, uploadDocument, uploadPricingSheet } from "@/lib/api";
import type { Issuer } from "@/types/issuers";
import { Dot } from "@/components/pipeline/atoms";
import { Panel } from "@/components/shared/Panel";
import { FirstRunHint } from "@/components/shared/FirstRunHint";
import { EdgarImport } from "@/components/upload/EdgarImport";

interface UploadWizardProps {
  initialIssuers?: Issuer[];
}

// Run-mode templates — same keys as the Concept B (Pipeline) CP-X routes.
const RUN_MODES: { k: string; code: string; label: string; desc: string }[] = [
  { k: "full", code: "R-IC", label: "Full IC Committee", desc: "Complete CP-X route — new-issue / full committee review" },
  { k: "earnings", code: "R-ER", label: "Earnings Update", desc: "Delta route — quarterly / annual results refresh" },
  { k: "rv", code: "R-RV", label: "Relative Value", desc: "RV refresh — pricing, comps and positioning" },
  { k: "legal", code: "R-LG", label: "Legal Review", desc: "Covenant & docs deep-dive on the legal stack" },
];

type Step = "issuer" | "file" | "result";
const STEPS: { k: Step; label: string }[] = [
  { k: "issuer", label: "Issuer" },
  { k: "file", label: "Files & run mode" },
  { k: "result", label: "Ingested" },
];

interface UploadResult {
  document_id: string;
  issuer_id: string;
  minio_key: string;
  chunks_created: number;
  message: string;
}

interface FileOutcome {
  name: string;
  result?: UploadResult;
  error?: string;
}

const isSpreadsheet = (name: string) => /\.(xlsx|xls)$/i.test(name);

export function UploadWizard({ initialIssuers = [] }: UploadWizardProps) {
  const [step, setStep] = useState<Step>("issuer");
  const [issuers, setIssuers] = useState<Issuer[]>(initialIssuers);
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

  const stepIdx = STEPS.findIndex((s) => s.k === step);
  const modeMeta = RUN_MODES.find((m) => m.k === runMode);
  const okCount = outcomes.filter((o) => o.result).length;
  const failCount = outcomes.length - okCount;
  const totalChunks = outcomes.reduce((n, o) => n + (o.result?.chunks_created || 0), 0);

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-2">
      <FirstRunHint id="upload-intake">
        Drop <span className="text-white font-medium">all</span> of an issuer&apos;s deal documents at once — CP-0 classifies and dates each on ingest. Pick a run mode and the engine routes the matching modules.
      </FirstRunHint>
      {/* step strip */}
      <div className="h-9 shrink-0 rounded border border-caos-border bg-caos-panel/60 px-3 flex items-center gap-2 overflow-x-auto">
        <span className="tabular text-caos-2xs uppercase tracking-widest text-caos-muted whitespace-nowrap">Intake steps</span>
        {STEPS.map((s, i) => {
          const state = i < stepIdx ? "done" : i === stepIdx ? "active" : "pending";
          return (
            <span key={s.k} className="flex items-center gap-2">
              {i > 0 ? <span className="w-3 h-px bg-caos-border" /> : null}
              <span
                className={
                  "flex items-center gap-1.5 tabular text-caos-sm px-2 py-1 rounded border transition-caos whitespace-nowrap " +
                  (state === "active"
                    ? "border-caos-accent bg-caos-elevated text-caos-text"
                    : state === "done"
                      ? "border-caos-border text-caos-text"
                      : "border-caos-border text-caos-muted")
                }
              >
                {state === "done" ? (
                  <span className="text-caos-xs" style={{ color: "var(--caos-success)" }}>✓</span>
                ) : (
                  <Dot sev={state === "active" ? "running" : "idle"} pulse={state === "active"} />
                )}
                {String(i + 1).padStart(2, "0")} {s.label}
              </span>
            </span>
          );
        })}
        <span className="flex-1" />
        {selectedIssuer ? <span className="tabular text-caos-xs text-caos-accent whitespace-nowrap">{selectedIssuer.name}</span> : null}
        {step !== "issuer" && modeMeta ? <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">· {modeMeta.label}</span> : null}
        {step !== "issuer" && files.length ? <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">· {files.length} file{files.length > 1 ? "s" : ""}</span> : null}
      </div>

      {error ? (
        <div className="rounded border px-3 py-2 flex items-center gap-2" style={{ borderColor: "rgba(239,68,68,0.5)", background: "rgba(239,68,68,0.07)" }}>
          <Dot sev="critical" />
          <span className="text-caos-lg" style={{ color: "var(--caos-critical-bright)" }}>{error}</span>
        </div>
      ) : null}

      {/* Step 1: issuer */}
      {step === "issuer" ? (
        <Panel
          title="Select issuer"
          right={<span className="tabular text-caos-xs text-caos-muted">{issuers.length} registered</span>}
        >
          <div className="text-caos-xl">
            {issuers.map((issuer) => (
              <button
                key={issuer.id}
                onClick={() => { setSelectedIssuer(issuer); setStep("file"); }}
                className={
                  "w-full grid grid-cols-[64px_1fr_110px] items-center gap-x-3 px-3 py-[7px] border-b border-caos-border/50 text-left transition-caos hover:bg-caos-elevated/60 " +
                  (selectedIssuer?.id === issuer.id ? "bg-caos-elevated caos-selected relative z-[5]" : "")
                }
              >
                <span className="tabular text-caos-accent text-caos-lg">{issuer.ticker?.slice(0, 5).toUpperCase() || "—"}</span>
                <span className="text-caos-text truncate">{issuer.name}</span>
                <span className="tabular text-caos-xs text-caos-muted text-right">SELECT →</span>
              </button>
            ))}
          </div>
          <div className="px-3 py-2.5 border-t border-caos-border">
            {!showNewIssuer ? (
              <button
                onClick={() => setShowNewIssuer(true)}
                className="w-full tabular text-caos-md py-1.5 rounded border border-dashed border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50 transition-caos"
              >
                + ADD NEW ISSUER
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <TextInput
                  type="text"
                  value={newIssuerName}
                  onChange={(e) => setNewIssuerName(e.target.value)}
                  placeholder="Issuer name (e.g. Atlas Forge Industrials)"
                  aria-label="Issuer name"
                  className="w-full px-2.5 py-1.5 text-caos-lg"
                />
                <TextInput
                  type="text"
                  value={newIssuerTicker}
                  onChange={(e) => setNewIssuerTicker(e.target.value)}
                  placeholder="Ticker (optional)"
                  aria-label="Ticker (optional)"
                  className="w-full px-2.5 py-1.5 text-caos-lg"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateIssuer}
                    disabled={!newIssuerName.trim()}
                    className="tabular text-caos-md px-3 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos disabled:opacity-40"
                  >
                    CREATE
                  </button>
                  <button
                    onClick={() => setShowNewIssuer(false)}
                    className="tabular text-caos-md px-3 py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}
          </div>
        </Panel>
      ) : null}

      {/* Step 2: files + run mode */}
      {step === "file" ? (
        <Panel
          title={"Files & run mode · " + (selectedIssuer?.name || "")}
          right={
            <button onClick={() => { setStep("issuer"); setFiles([]); }} className="tabular text-caos-xs text-caos-muted hover:text-caos-text transition-caos">
              ← BACK
            </button>
          }
        >
          <div className="p-3 flex flex-col gap-3">
            <div
              {...getRootProps()}
              className="rounded border border-dashed px-4 py-7 text-center cursor-pointer transition-caos"
              style={{
                borderColor: isDragActive ? "var(--caos-accent)" : files.length ? "rgba(34,197,94,0.5)" : "var(--caos-border)",
                background: isDragActive ? "rgba(79,140,255,0.06)" : files.length ? "rgba(34,197,94,0.04)" : "var(--caos-bg)",
              }}
            >
              <input {...getInputProps()} aria-label="Upload deal documents (PDF or XLSX)" />
              <div className="text-caos-lg text-caos-text/85">
                Drop all deal documents here, or click to browse
              </div>
              <div className="tabular text-caos-xs text-caos-muted mt-1">
                PDF / XLSX · multiple files · documents are already dated — CP-0 classifies on ingest
              </div>
            </div>

            {files.length ? (
              <div className="rounded border border-caos-border overflow-hidden">
                {files.map((f) => (
                  <div key={f.name + f.size} className="grid grid-cols-[1fr_90px_60px] items-center gap-x-3 px-3 py-[6px] border-b border-caos-border/50 last:border-b-0">
                    <span className="text-caos-lg text-caos-text truncate">{f.name}</span>
                    <span className="tabular text-caos-xs text-caos-muted text-right">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                    <button
                      onClick={() => setFiles((prev) => prev.filter((x) => x !== f))}
                      className="tabular text-caos-xs text-caos-muted hover:text-caos-text text-right transition-caos"
                    >
                      REMOVE
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div>
              <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1.5">Run mode</div>
              <div className="rounded border border-caos-border overflow-hidden">
                {RUN_MODES.map((m) => (
                  <button
                    key={m.k}
                    onClick={() => setRunMode(m.k)}
                    className={
                      "w-full grid grid-cols-[52px_150px_1fr_70px] items-center gap-x-3 px-3 py-[7px] border-b border-caos-border/50 last:border-b-0 text-left transition-caos hover:bg-caos-elevated/60 " +
                      (runMode === m.k ? "bg-caos-elevated" : "")
                    }
                  >
                    <span className="tabular text-caos-xs text-caos-accent">{m.code}</span>
                    <span className="text-caos-text text-caos-lg">{m.label}</span>
                    <span className="text-caos-muted text-caos-sm truncate">{m.desc}</span>
                    <span className="tabular text-caos-xs text-right" style={{ color: runMode === m.k ? "var(--caos-success)" : "var(--caos-muted)" }}>
                      {runMode === m.k ? "✓ SELECTED" : "SELECT"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleUpload}
              disabled={files.length === 0 || uploading}
              className="h-8 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos tabular text-caos-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Dot sev="running" pulse />
                  UPLOADING & CHUNKING…
                </>
              ) : (
                `UPLOAD ${files.length || ""} FILE${files.length === 1 ? "" : "S"} & PROCESS`
              )}
            </button>
          </div>
        </Panel>
      ) : null}

      {/* Step 2 companion: pull governing docs straight from SEC EDGAR (free) */}
      {step === "file" && selectedIssuer ? (
        <EdgarImport issuer={selectedIssuer} runMode={runMode} />
      ) : null}

      {/* Step 3: result */}
      {step === "result" && outcomes.length ? (
        <Panel
          title="Intake complete · CP-0 ready"
          right={
            <span className="flex items-center gap-1.5">
              <Dot sev={failCount ? "warning" : "ok"} />
              <span className="tabular text-caos-xs text-caos-muted">
                {okCount}/{outcomes.length} vaulted · {totalChunks} chunks
              </span>
            </span>
          }
        >
          <div className="px-3 py-2.5 border-b border-caos-border text-caos-lg text-caos-text leading-snug">
            {okCount} document{okCount === 1 ? "" : "s"} vaulted for {selectedIssuer?.name} ·{" "}
            {modeMeta?.label} ({modeMeta?.code}) run queued
            {failCount ? ` · ${failCount} failed` : ""}
            <span className="text-caos-muted"> — view the module route on the Execution Graph</span>
          </div>
          <div className="text-caos-md">
            {outcomes.map((o) => (
              <div key={o.name} className="grid grid-cols-[14px_1fr_110px] items-center gap-x-2 px-3 py-[6px] border-b border-caos-border/50">
                <Dot sev={o.result ? "ok" : "critical"} />
                <span className="text-caos-text truncate">{o.name}</span>
                <span className="tabular text-caos-xs text-right" style={{ color: o.result ? "var(--caos-muted)" : "var(--caos-critical)" }}>
                  {o.result ? `${o.result.chunks_created} chunks` : o.error}
                </span>
              </div>
            ))}
          </div>
          <div className="p-3 flex gap-2">
            <button
              onClick={reset}
              className="flex-1 tabular text-caos-md py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos"
            >
              UPLOAD ANOTHER
            </button>
            <Link
              href="/deepdive"
              className="flex-1 no-underline text-center tabular text-caos-md py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos"
            >
              OPEN DEEP-DIVE →
            </Link>
            <Link
              href="/pipeline"
              className="flex-1 no-underline text-center tabular text-caos-md py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos"
            >
              VIEW EXECUTION GRAPH →
            </Link>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
