"use client";

// Document intake wizard (CP-0) — CAOS design language: panel chrome, dense
// tabular rows, accent-bordered actions. Behavior unchanged: select issuer →
// document type → file + metadata → upload via /api/ingestion.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import { createIssuer, getIssuers, uploadDocument, uploadPricingSheet } from "@/lib/api";
import type { Issuer } from "@/types/issuers";
import { Dot } from "@/components/pipeline/atoms";
import { Panel } from "@/components/shared/Panel";

type DocType = "OM" | "CreditAgreement" | "LBOModel" | "InterimReport" | "PricingSheet";

interface UploadWizardProps {
  initialIssuers?: Issuer[];
}

const DOC_TYPES: { value: DocType; code: string; label: string; desc: string }[] = [
  { value: "OM", code: "D-OM", label: "Offering Memorandum", desc: "Primary OM / CIM for new transactions" },
  { value: "CreditAgreement", code: "D-CA", label: "Credit Agreement", desc: "Signed CA with covenants and terms" },
  { value: "LBOModel", code: "D-LBO", label: "LBO Model", desc: "Sponsor or sell-side LBO model" },
  { value: "InterimReport", code: "D-IR", label: "Interim Report", desc: "Quarterly/semi-annual financials (triggers Delta Run)" },
  { value: "PricingSheet", code: "D-PX", label: "Pricing Sheet", desc: "Master pricing run or broker sheet (XLSX)" },
];

type Step = "issuer" | "doctype" | "file" | "result";
const STEPS: { k: Step; label: string }[] = [
  { k: "issuer", label: "Issuer" },
  { k: "doctype", label: "Document type" },
  { k: "file", label: "File & metadata" },
  { k: "result", label: "Ingested" },
];

interface UploadResult {
  document_id: string;
  issuer_id: string;
  minio_key: string;
  chunks_created: number;
  message: string;
}


export function UploadWizard({ initialIssuers = [] }: UploadWizardProps) {
  const [step, setStep] = useState<Step>("issuer");
  const [issuers, setIssuers] = useState<Issuer[]>(initialIssuers);
  const [selectedIssuer, setSelectedIssuer] = useState<Issuer | null>(null);
  const [docType, setDocType] = useState<DocType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fiscalPeriod, setFiscalPeriod] = useState("");
  const [mnpiFlag, setMnpiFlag] = useState(false);
  const [runDate, setRunDate] = useState(new Date().toISOString().split("T")[0]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");

  // New issuer inline form
  const [showNewIssuer, setShowNewIssuer] = useState(false);
  const [newIssuerName, setNewIssuerName] = useState("");
  const [newIssuerTicker, setNewIssuerTicker] = useState("");

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: docType === "PricingSheet"
      ? { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] }
      : { "application/pdf": [".pdf"] },
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
    if (!selectedIssuer || !docType || !file) return;
    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("issuer_id", selectedIssuer.id);
      formData.append("file", file);

      let res;
      if (docType === "PricingSheet") {
        formData.append("run_date", runDate);
        res = await uploadPricingSheet(formData);
      } else {
        formData.append("doc_type", docType);
        if (fiscalPeriod) formData.append("fiscal_period", fiscalPeriod);
        formData.append("mnpi_flag", String(mnpiFlag));
        res = await uploadDocument(formData);
      }

      setResult(res);
      setStep("result");
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setStep("issuer");
    setSelectedIssuer(null);
    setDocType(null);
    setFile(null);
    setResult(null);
    setError("");
    setFiscalPeriod("");
    setMnpiFlag(false);
  };

  useEffect(() => {
    if (issuers.length === 0) {
      getIssuers().then(setIssuers).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stepIdx = STEPS.findIndex((s) => s.k === step);
  const docMeta = DOC_TYPES.find((d) => d.value === docType);

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-2">
      {/* step strip */}
      <div className="h-9 shrink-0 rounded border border-caos-border bg-caos-panel/60 px-3 flex items-center gap-2 overflow-x-auto">
        <span className="tabular text-[8.5px] uppercase tracking-widest text-caos-muted whitespace-nowrap">Intake steps</span>
        {STEPS.map((s, i) => {
          const state = i < stepIdx ? "done" : i === stepIdx ? "active" : "pending";
          return (
            <span key={s.k} className="flex items-center gap-2">
              {i > 0 ? <span className="w-3 h-px bg-caos-border" /> : null}
              <span
                className={
                  "flex items-center gap-1.5 tabular text-[9.5px] px-2 py-1 rounded border transition-caos whitespace-nowrap " +
                  (state === "active"
                    ? "border-caos-accent bg-caos-elevated text-caos-text"
                    : state === "done"
                      ? "border-caos-border text-caos-text"
                      : "border-caos-border text-caos-muted opacity-60")
                }
              >
                {state === "done" ? (
                  <span className="text-[9px]" style={{ color: "var(--caos-success)" }}>✓</span>
                ) : (
                  <Dot sev={state === "active" ? "running" : "idle"} pulse={state === "active"} />
                )}
                {String(i + 1).padStart(2, "0")} {s.label}
              </span>
            </span>
          );
        })}
        <span className="flex-1" />
        {selectedIssuer ? <span className="tabular text-[9px] text-caos-accent whitespace-nowrap">{selectedIssuer.name}</span> : null}
        {docMeta ? <span className="tabular text-[9px] text-caos-muted whitespace-nowrap">· {docMeta.label}</span> : null}
      </div>

      {error ? (
        <div className="rounded border px-3 py-2 flex items-center gap-2" style={{ borderColor: "rgba(239,68,68,0.5)", background: "rgba(239,68,68,0.07)" }}>
          <Dot sev="critical" />
          <span className="text-[10.5px]" style={{ color: "var(--caos-critical)" }}>{error}</span>
        </div>
      ) : null}

      {/* Step 1: issuer */}
      {step === "issuer" ? (
        <Panel
          title="Select issuer"
          right={<span className="tabular text-[9px] text-caos-muted">{issuers.length} registered</span>}
        >
          <div className="text-[11px]">
            {issuers.map((issuer) => (
              <button
                key={issuer.id}
                onClick={() => { setSelectedIssuer(issuer); setStep("doctype"); }}
                className={
                  "w-full grid grid-cols-[64px_1fr_110px] items-center gap-x-3 px-3 py-[7px] border-b border-caos-border/50 text-left transition-caos hover:bg-caos-elevated/60 " +
                  (selectedIssuer?.id === issuer.id ? "bg-caos-elevated caos-selected relative z-[5]" : "")
                }
              >
                <span className="tabular text-caos-accent text-[10.5px]">{issuer.ticker?.slice(0, 5).toUpperCase() || "—"}</span>
                <span className="text-caos-text truncate">{issuer.name}</span>
                <span className="tabular text-[9px] text-caos-muted text-right">SELECT →</span>
              </button>
            ))}
          </div>
          <div className="px-3 py-2.5 border-t border-caos-border">
            {!showNewIssuer ? (
              <button
                onClick={() => setShowNewIssuer(true)}
                className="w-full tabular text-[10px] py-1.5 rounded border border-dashed border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50 transition-caos"
              >
                + ADD NEW ISSUER
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={newIssuerName}
                  onChange={(e) => setNewIssuerName(e.target.value)}
                  placeholder="Issuer name (e.g. Atlas Forge Industrials)"
                  className="w-full bg-caos-bg border border-caos-border rounded px-2.5 py-1.5 text-[10.5px] text-caos-text placeholder:text-caos-muted/50 outline-none focus:border-caos-accent/70 transition-caos"
                />
                <input
                  type="text"
                  value={newIssuerTicker}
                  onChange={(e) => setNewIssuerTicker(e.target.value)}
                  placeholder="Ticker (optional)"
                  className="w-full bg-caos-bg border border-caos-border rounded px-2.5 py-1.5 text-[10.5px] text-caos-text placeholder:text-caos-muted/50 outline-none focus:border-caos-accent/70 transition-caos"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateIssuer}
                    disabled={!newIssuerName.trim()}
                    className="tabular text-[10px] px-3 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos disabled:opacity-40"
                  >
                    CREATE
                  </button>
                  <button
                    onClick={() => setShowNewIssuer(false)}
                    className="tabular text-[10px] px-3 py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}
          </div>
        </Panel>
      ) : null}

      {/* Step 2: document type */}
      {step === "doctype" ? (
        <Panel
          title={"Document type · " + (selectedIssuer?.name || "")}
          right={
            <button onClick={() => setStep("issuer")} className="tabular text-[9px] text-caos-muted hover:text-caos-text transition-caos">
              ← BACK
            </button>
          }
        >
          <div className="text-[11px]">
            {DOC_TYPES.map((dt) => (
              <button
                key={dt.value}
                onClick={() => { setDocType(dt.value); setStep("file"); }}
                className="w-full grid grid-cols-[52px_180px_1fr_90px] items-center gap-x-3 px-3 py-[8px] border-b border-caos-border/50 text-left transition-caos hover:bg-caos-elevated/60"
              >
                <span className="tabular text-[9px] text-caos-accent">{dt.code}</span>
                <span className="text-caos-text text-[10.5px]">{dt.label}</span>
                <span className="text-caos-muted text-[9.5px] truncate">{dt.desc}</span>
                <span className="tabular text-[9px] text-caos-muted text-right">SELECT →</span>
              </button>
            ))}
          </div>
        </Panel>
      ) : null}

      {/* Step 3: file + metadata */}
      {step === "file" && docMeta ? (
        <Panel
          title={"Upload " + docMeta.label + " · " + (selectedIssuer?.name || "")}
          right={
            <button onClick={() => { setStep("doctype"); setFile(null); }} className="tabular text-[9px] text-caos-muted hover:text-caos-text transition-caos">
              ← BACK
            </button>
          }
        >
          <div className="p-3 flex flex-col gap-3">
            <div
              {...getRootProps()}
              className="rounded border border-dashed px-4 py-7 text-center cursor-pointer transition-caos"
              style={{
                borderColor: isDragActive ? "var(--caos-accent)" : file ? "rgba(34,197,94,0.5)" : "var(--caos-border)",
                background: isDragActive ? "rgba(79,140,255,0.06)" : file ? "rgba(34,197,94,0.04)" : "var(--caos-bg)",
              }}
            >
              <input {...getInputProps()} />
              {file ? (
                <div>
                  <div className="tabular text-[10.5px]" style={{ color: "var(--caos-success)" }}>✓ {file.name}</div>
                  <div className="tabular text-[9px] text-caos-muted mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB — click or drop to replace
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[10.5px] text-caos-text/85">
                    Drop the {docType === "PricingSheet" ? ".xlsx" : ".pdf"} here, or click to browse
                  </div>
                  <div className="tabular text-[9px] text-caos-muted mt-1">single file · stored to the MinIO vault under {selectedIssuer?.name}</div>
                </div>
              )}
            </div>

            {docType === "PricingSheet" ? (
              <div>
                <label className="block tabular text-[8.5px] uppercase tracking-wider text-caos-muted mb-1">Run date</label>
                <input
                  type="date"
                  value={runDate}
                  onChange={(e) => setRunDate(e.target.value)}
                  className="w-full bg-caos-bg border border-caos-border rounded px-2.5 py-1.5 text-[10.5px] text-caos-text outline-none focus:border-caos-accent/70 transition-caos"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block tabular text-[8.5px] uppercase tracking-wider text-caos-muted mb-1">Fiscal period</label>
                  <input
                    type="text"
                    value={fiscalPeriod}
                    onChange={(e) => setFiscalPeriod(e.target.value)}
                    placeholder="e.g. Q1-2026"
                    className="w-full bg-caos-bg border border-caos-border rounded px-2.5 py-1.5 text-[10.5px] text-caos-text placeholder:text-caos-muted/50 outline-none focus:border-caos-accent/70 transition-caos"
                  />
                </div>
                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mnpiFlag}
                      onChange={(e) => setMnpiFlag(e.target.checked)}
                      className="w-3.5 h-3.5 rounded-sm border-caos-border bg-caos-bg accent-[#f5a524]"
                    />
                    <span className="tabular text-[9.5px] uppercase tracking-wide" style={{ color: mnpiFlag ? "var(--caos-warning)" : "var(--caos-muted)" }}>
                      MNPI — restricted handling
                    </span>
                  </label>
                </div>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="h-8 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos tabular text-[10px] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Dot sev="running" pulse />
                  UPLOADING & CHUNKING…
                </>
              ) : (
                "UPLOAD & PROCESS"
              )}
            </button>
          </div>
        </Panel>
      ) : null}

      {/* Step 4: result */}
      {step === "result" && result ? (
        <Panel
          title="Intake complete · CP-0 ready"
          right={
            <span className="flex items-center gap-1.5">
              <Dot sev="ok" />
              <span className="tabular text-[9px] text-caos-muted">vaulted & chunked</span>
            </span>
          }
        >
          <div className="px-3 py-2.5 border-b border-caos-border text-[10.5px] text-caos-text leading-snug">{result.message}</div>
          <div className="px-3 py-2.5 border-b border-caos-border">
            <div className="tabular text-[9px] uppercase tracking-wider text-caos-muted mb-1.5">Vault record</div>
            <div className="text-[10px] text-caos-text leading-relaxed">
              <div className="flex justify-between gap-2"><span className="text-caos-muted">Document ID</span><span className="tabular truncate max-w-[260px]">{result.document_id}</span></div>
              <div className="flex justify-between gap-2"><span className="text-caos-muted">MinIO key</span><span className="tabular truncate max-w-[260px]">{result.minio_key}</span></div>
              <div className="flex justify-between gap-2"><span className="text-caos-muted">Chunks created</span><span className="tabular">{result.chunks_created}</span></div>
              <div className="flex justify-between gap-2"><span className="text-caos-muted">Issuer</span><span className="tabular text-caos-accent">{selectedIssuer?.name}</span></div>
            </div>
          </div>
          <div className="p-3 flex gap-2">
            <button
              onClick={reset}
              className="flex-1 tabular text-[10px] py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos"
            >
              UPLOAD ANOTHER
            </button>
            <Link
              href={`/issuers/${selectedIssuer?.id}`}
              className="flex-1 no-underline text-center tabular text-[10px] py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos"
            >
              OPEN COCKPIT →
            </Link>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
