"use client";

// Presentational steps for the CP-0 document-intake wizard, lifted out of
// UploadWizard so the wizard component holds state + handlers and these render.
// All four are pure: they own no state; every interaction is a prop callback.
// Markup is byte-identical to the former inline JSX.

import Link from "next/link";
import { useDropzone } from "react-dropzone";
import { TextInput } from "@/components/shared/TextInput";
import { Dot } from "@/components/pipeline/atoms";
import { Panel } from "@/components/shared/Panel";
import type { Issuer } from "@/types/issuers";

type Dropzone = ReturnType<typeof useDropzone>;

export type RunMode = { k: string; code: string; label: string; desc: string };

// Run-mode templates — same keys as the Concept B (Pipeline) CP-X routes.
export const RUN_MODES: RunMode[] = [
  { k: "full", code: "R-IC", label: "Full IC Committee", desc: "Complete CP-X route — new-issue / full committee review" },
  { k: "earnings", code: "R-ER", label: "Earnings Update", desc: "Delta route — quarterly / annual results refresh" },
  { k: "rv", code: "R-RV", label: "Relative Value", desc: "RV refresh — pricing, comps and positioning" },
  { k: "legal", code: "R-LG", label: "Legal Review", desc: "Covenant & docs deep-dive on the legal stack" },
];

export type Step = "issuer" | "file" | "result";
export const STEPS: { k: Step; label: string }[] = [
  { k: "issuer", label: "Issuer" },
  { k: "file", label: "Files & run mode" },
  { k: "result", label: "Ingested" },
];

export interface UploadResult {
  document_id: string;
  issuer_id: string;
  minio_key: string;
  chunks_created: number;
  message: string;
}

export interface FileOutcome {
  name: string;
  result?: UploadResult;
  error?: string;
}

export const isSpreadsheet = (name: string) => /\.(xlsx|xls)$/i.test(name);

/* ---------- step progress strip ---------- */
export function StepStrip({
  step, selectedIssuer, modeMeta, filesCount,
}: {
  step: Step;
  selectedIssuer: Issuer | null;
  modeMeta?: RunMode;
  filesCount: number;
}) {
  const stepIdx = STEPS.findIndex((s) => s.k === step);
  return (
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
      {step !== "issuer" && filesCount ? <span className="tabular text-caos-xs text-caos-muted whitespace-nowrap">· {filesCount} file{filesCount > 1 ? "s" : ""}</span> : null}
    </div>
  );
}

/* ---------- step 1: issuer select ---------- */
export function IssuerStep({
  issuers, selectedIssuer, onSelectIssuer,
  showNewIssuer, setShowNewIssuer,
  newIssuerName, setNewIssuerName, newIssuerTicker, setNewIssuerTicker,
  onCreateIssuer,
}: {
  issuers: Issuer[];
  selectedIssuer: Issuer | null;
  onSelectIssuer: (issuer: Issuer) => void;
  showNewIssuer: boolean;
  setShowNewIssuer: (v: boolean) => void;
  newIssuerName: string;
  setNewIssuerName: (v: string) => void;
  newIssuerTicker: string;
  setNewIssuerTicker: (v: string) => void;
  onCreateIssuer: () => void;
}) {
  return (
    <Panel
      title="Select issuer"
      right={<span className="tabular text-caos-xs text-caos-muted">{issuers.length} registered</span>}
    >
      <div className="text-caos-xl">
        {issuers.map((issuer) => (
          <button
            key={issuer.id}
            onClick={() => onSelectIssuer(issuer)}
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
                onClick={onCreateIssuer}
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
  );
}

/* ---------- step 2: files + run mode ---------- */
export function FileStep({
  selectedIssuer, getRootProps, getInputProps, isDragActive,
  files, onRemoveFile, runMode, setRunMode, uploading, onUpload, onBack,
}: {
  selectedIssuer: Issuer | null;
  getRootProps: Dropzone["getRootProps"];
  getInputProps: Dropzone["getInputProps"];
  isDragActive: boolean;
  files: File[];
  onRemoveFile: (f: File) => void;
  runMode: string;
  setRunMode: (k: string) => void;
  uploading: boolean;
  onUpload: () => void;
  onBack: () => void;
}) {
  return (
    <Panel
      title={"Files & run mode · " + (selectedIssuer?.name || "")}
      right={
        <button onClick={onBack} className="tabular text-caos-xs text-caos-muted hover:text-caos-text transition-caos">
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
                  onClick={() => onRemoveFile(f)}
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
          onClick={onUpload}
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
  );
}

/* ---------- step 3: result ---------- */
export function ResultStep({
  outcomes, selectedIssuer, modeMeta, okCount, failCount, totalChunks, onReset,
}: {
  outcomes: FileOutcome[];
  selectedIssuer: Issuer | null;
  modeMeta?: RunMode;
  okCount: number;
  failCount: number;
  totalChunks: number;
  onReset: () => void;
}) {
  // A vaulted doc that produced 0 chunks has no extractable text (scanned /
  // encrypted PDF, or an image-only file) — it is stored but NOT searchable or
  // analysed. Surface it as a warning so the analyst isn't silently working from
  // a document the engine never read.
  const zeroCount = outcomes.filter((o) => o.result && o.result.chunks_created === 0).length;
  const noTextTitle = "No extractable text (scanned or encrypted PDF?) — vaulted but not searchable or analysed.";
  return (
    <Panel
      title="Intake complete · CP-0 ready"
      right={
        <span className="flex items-center gap-1.5">
          <Dot sev={failCount || zeroCount ? "warning" : "ok"} />
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
        {zeroCount ? <span style={{ color: "var(--caos-warning)" }}> · {zeroCount} with no extractable text</span> : null}
        <span className="text-caos-muted"> — view the module route on the Execution Graph</span>
      </div>
      <div className="text-caos-md">
        {outcomes.map((o) => {
          const noText = !!o.result && o.result.chunks_created === 0;
          return (
            <div key={o.name} className="grid grid-cols-[14px_1fr_110px] items-center gap-x-2 px-3 py-[6px] border-b border-caos-border/50">
              <Dot sev={o.result ? (noText ? "warning" : "ok") : "critical"} />
              <span className="text-caos-text truncate">{o.name}</span>
              <span
                className="tabular text-caos-xs text-right"
                title={noText ? noTextTitle : undefined}
                style={{ color: o.result ? (noText ? "var(--caos-warning)" : "var(--caos-muted)") : "var(--caos-critical)" }}
              >
                {o.result ? (noText ? "0 chunks — no text" : `${o.result.chunks_created} chunks`) : o.error}
              </span>
            </div>
          );
        })}
      </div>
      <div className="p-3 flex gap-2">
        <button
          onClick={onReset}
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
  );
}
