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
import type { RunSummaryDTO } from "@/lib/engine/types";
import { useIssuerProfileOverlay } from "@/components/shared/IssuerProfileOverlay";

type Dropzone = ReturnType<typeof useDropzone>;

export type RunMode = { k: string; code: string; label: string; desc: string };

// Run-mode templates for document intake. Keys mirror the Concept B (Pipeline)
// CP-X routes, plus "primary" (intake-only: a full-committee route that warns to
// include the new-loan price/OID/cap table — the Pipeline demo sim doesn't carry it).
export const RUN_MODES: RunMode[] = [
  { k: "full", code: "R-IC", label: "Full IC Committee", desc: "Complete CP-X route — new-issue / full committee review" },
  { k: "primary", code: "R-PT", label: "Primary Transaction", desc: "New-issue primary — full CP-X route; needs new-loan price, OID + cap table" },
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
  source_manifest_id: string;
}

export interface FileOutcome {
  name: string;
  result?: UploadResult;
  error?: string;
  // The original File is kept alongside its outcome so a partial-batch failure
  // can be retried without the analyst re-locating and re-dropping the source.
  file?: File;
}

// What actually happened when the wizard queued the analysis run (FE-1): the
// completion copy reports this instead of asserting "run queued" whether or
// not any run was created.
export type RunQueueOutcome =
  | { state: "queuing" }
  | { state: "queued"; runId: string }
  | { state: "active" }                       // 409 — one already in progress
  | { state: "failed"; message: string };

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
  issuerQuery, setIssuerQuery,
  showNewIssuer, setShowNewIssuer,
  newIssuerName, setNewIssuerName, newIssuerTicker, setNewIssuerTicker,
  onCreateIssuer,
}: {
  issuers: Issuer[];
  selectedIssuer: Issuer | null;
  onSelectIssuer: (issuer: Issuer) => void;
  issuerQuery: string;
  setIssuerQuery: (v: string) => void;
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
      <div className="p-3 border-b border-caos-border">
        <TextInput
          value={issuerQuery}
          onChange={(e) => setIssuerQuery(e.target.value)}
          placeholder="Search issuer · ticker · sector"
          aria-label="Search issuers for document intake"
          className="w-full px-2.5 py-1.5 text-caos-lg"
        />
      </div>
      <div className="text-caos-xl">
        {issuers.map((issuer) => (
          <button
            key={issuer.id}
            onClick={() => onSelectIssuer(issuer)}
            className={
              "focus-ring w-full grid grid-cols-[64px_1fr_110px] items-center gap-x-3 px-3 py-[7px] border-b border-caos-border/50 text-left transition-caos hover:bg-caos-elevated/60 " +
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
            className="focus-ring w-full tabular text-caos-md py-1.5 rounded border border-dashed border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/50 transition-caos"
          >
            + ADD NEW ISSUER
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            {/* maxLength mirrors routes/issuers.py IssuerCreate + the issuers
                DB columns so a length 422/500 is unreachable from typing */}
            <TextInput
              type="text"
              value={newIssuerName}
              onChange={(e) => setNewIssuerName(e.target.value)}
              placeholder="Issuer name (e.g. Atlas Forge Industrials)"
              aria-label="Issuer name"
              maxLength={255}
              className="w-full px-2.5 py-1.5 text-caos-lg"
            />
            <TextInput
              type="text"
              value={newIssuerTicker}
              onChange={(e) => setNewIssuerTicker(e.target.value)}
              placeholder="Ticker (optional)"
              aria-label="Ticker (optional)"
              maxLength={32}
              className="w-full px-2.5 py-1.5 text-caos-lg"
            />
            <div className="flex gap-2">
              <button
                onClick={onCreateIssuer}
                disabled={!newIssuerName.trim()}
                className="focus-ring tabular text-caos-md px-3 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos disabled:opacity-40"
              >
                CREATE
              </button>
              <button
                onClick={() => setShowNewIssuer(false)}
                className="focus-ring tabular text-caos-md px-3 py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text transition-caos"
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
  files, onRemoveFile, runMode, setRunMode, uploading, progress, onUpload, onCancel, onBack,
  origin, setOrigin, method, setMethod,
  portfolios = [], portfolioId = "", setPortfolioId,
}: {
  selectedIssuer: Issuer | null;
  getRootProps: Dropzone["getRootProps"];
  getInputProps: Dropzone["getInputProps"];
  isDragActive: boolean;
  files: File[];
  onRemoveFile: (f: File) => void;
  runMode: string;
  setRunMode: (k: string) => void;
  origin: "live" | "reference" | "demo";
  setOrigin: (value: "live" | "reference" | "demo") => void;
  method: "reported" | "derived" | "modelled";
  setMethod: (value: "reported" | "derived" | "modelled") => void;
  uploading: boolean;
  progress: { index: number; total: number; name: string } | null;
  onUpload: () => void;
  onCancel: () => void;
  onBack: () => void;
  // Portfolio context: which book this issuer's run is evaluated against (CP-3C
  // concentration). Empty = auto-bind the book that holds it. Optional so callers
  // with no portfolios don't render the picker.
  portfolios?: { id: string; name: string }[];
  portfolioId?: string;
  setPortfolioId?: (v: string) => void;
}) {
  return (
    <Panel
      title={"Files & run mode · " + (selectedIssuer?.name || "")}
      right={
        <button onClick={onBack} className="focus-ring rounded px-1 tabular text-caos-xs text-caos-muted hover:text-caos-text transition-caos">
          ← BACK
        </button>
      }
    >
      <div className="p-3 flex flex-col gap-3">
        <div
          {...getRootProps()}
          className="focus-ring rounded border border-dashed px-4 py-7 text-center cursor-pointer transition-caos"
          style={{
            borderColor: isDragActive ? "var(--caos-accent)" : files.length ? "color-mix(in srgb, var(--caos-success) 50%, transparent)" : "var(--caos-border)",
            background: isDragActive ? "color-mix(in srgb, var(--tranche-2l) 6%, transparent)" : files.length ? "color-mix(in srgb, var(--caos-success) 4%, transparent)" : "var(--caos-bg)",
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
                  aria-label={"Remove " + f.name}
                  className="focus-ring rounded tabular text-caos-xs text-caos-muted hover:text-caos-text text-right transition-caos"
                >
                  REMOVE
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div>
          <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1.5">Authority declaration</div>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="grid gap-1 tabular text-caos-xs text-caos-muted">
              Origin
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value as "live" | "reference" | "demo")}
                className="h-8 rounded border border-caos-border bg-caos-bg px-2 text-caos-md text-caos-text focus-ring"
              >
                <option value="live">LIVE · analyst source</option>
                <option value="reference">REFERENCE · template/comparison</option>
                <option value="demo">DEMO · non-decision fixture</option>
              </select>
            </label>
            <label className="grid gap-1 tabular text-caos-xs text-caos-muted">
              Method
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as "reported" | "derived" | "modelled")}
                className="h-8 rounded border border-caos-border bg-caos-bg px-2 text-caos-md text-caos-text focus-ring"
              >
                <option value="reported">REPORTED · source disclosure</option>
                <option value="derived">DERIVED · deterministic transform</option>
                <option value="modelled">MODELLED · analytical estimate</option>
              </select>
            </label>
          </div>
          <p className="mt-1 text-caos-xs text-caos-muted">This declaration is written into the immutable source manifest and follows the evidence downstream.</p>
        </div>

        <div>
          <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1.5">Run mode</div>
          <div className="rounded border border-caos-border overflow-hidden">
            {RUN_MODES.map((m) => (
              <button
                key={m.k}
                onClick={() => setRunMode(m.k)}
                aria-pressed={runMode === m.k}
                className={
                  "focus-ring w-full grid grid-cols-[52px_150px_1fr_70px] items-center gap-x-3 px-3 py-[7px] border-b border-caos-border/50 last:border-b-0 text-left transition-caos hover:bg-caos-elevated/60 " +
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

        {/* Primary Transaction runs the full IC route, but pricing + structure
            only analyse if the deal terms are in the source materials — warn, don't gate. */}
        {runMode === "primary" ? (
          <div
            role="note"
            className="rounded border px-3 py-2 flex items-start gap-2"
            style={{
              borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)",
              background: "color-mix(in srgb, var(--caos-warning) 7%, transparent)",
            }}
          >
            <Dot sev="warning" />
            <span className="text-caos-sm leading-snug" style={{ color: "var(--caos-warning)" }}>
              Primary transaction — include the <span className="font-medium">new-loan price</span>,{" "}
              <span className="font-medium">OID</span> and <span className="font-medium">cap table</span>{" "}
              in your source materials so pricing and structure are analysed.
            </span>
          </div>
        ) : null}

        {portfolios.length && setPortfolioId ? (
          <div>
            <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1.5">
              Portfolio context
            </div>
            <select
              value={portfolioId}
              onChange={(e) => setPortfolioId(e.target.value)}
              aria-label="Portfolio to evaluate this issuer against"
              className="w-full px-2.5 py-1.5 text-caos-lg rounded border border-caos-border bg-caos-bg text-caos-text focus-ring"
            >
              <option value="">Auto — the book holding this issuer</option>
              {portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="tabular text-caos-2xs text-caos-muted mt-1 leading-snug">
              The book CP-3C evaluates the issuer against (concentration + headroom). Auto-binds when the issuer is held.
            </div>
          </div>
        ) : null}

        <div className="flex gap-2">
          <button
            onClick={onUpload}
            disabled={files.length === 0 || uploading}
            className="focus-ring flex-1 min-w-0 h-8 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos tabular text-caos-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 px-3"
          >
            {uploading ? (
              <>
                <Dot sev="running" pulse />
                <span className="whitespace-nowrap">
                  UPLOADING <span className="tabular">{progress?.index ?? 0}/{progress?.total ?? files.length}</span>
                </span>
                {progress?.name ? <span className="text-caos-muted truncate min-w-0">— {progress.name}</span> : null}
              </>
            ) : (
              `UPLOAD ${files.length || ""} FILE${files.length === 1 ? "" : "S"} & PROCESS`
            )}
          </button>
          {uploading ? (
            <button
              onClick={onCancel}
              className="focus-ring shrink-0 h-8 px-3 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-critical/60 transition-caos tabular text-caos-md"
            >
              CANCEL
            </button>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

/* ---------- step 3: result ---------- */
export function ResultStep({
  outcomes, selectedIssuer, modeMeta, okCount, failCount, totalChunks,
  uploading, progress, runOutcome, onReset, onRetryFailed,
  runCreating, runCreated, runError, onCreateRun,
  contextId,
}: {
  outcomes: FileOutcome[];
  selectedIssuer: Issuer | null;
  modeMeta?: RunMode;
  okCount: number;
  failCount: number;
  totalChunks: number;
  uploading: boolean;
  progress: { index: number; total: number; name: string } | null;
  runOutcome: RunQueueOutcome | null;
  onReset: () => void;
  onRetryFailed: () => void;
  // Run-creation (FE-2): explicit action, not automatic — the analyst decides
  // when to spend a run rather than one firing per upload batch.
  runCreating: boolean;
  runCreated: RunSummaryDTO | null;
  runError: string;
  onCreateRun: () => void;
  contextId?: string;
}) {
  const { openProfile } = useIssuerProfileOverlay();
  // A vaulted doc that produced 0 chunks has no extractable text (scanned /
  // encrypted PDF, or an image-only file) — it is stored but NOT searchable or
  // analysed. Surface it as a warning so the analyst isn't silently working from
  // a document the engine never read.
  const zeroCount = outcomes.filter((o) => o.result && o.result.chunks_created === 0).length;
  const noTextTitle = "No extractable text (scanned or encrypted PDF?) — vaulted but not searchable or analysed.";
  return (
    <Panel
      title={uploading ? "Ingesting · CP-0 processing" : "Intake complete · CP-0 ready"}
      right={
        <span className="flex items-center gap-1.5">
          <Dot sev={uploading ? "running" : failCount || zeroCount ? "warning" : "ok"} pulse={uploading} />
          <span className="tabular text-caos-xs text-caos-muted">
            {uploading && progress
              ? `${progress.index}/${progress.total} processing`
              : `${okCount}/${outcomes.length} vaulted · ${totalChunks} chunks`}
          </span>
        </span>
      }
    >
      {uploading && progress ? (
        <div className="px-3 py-2.5 border-b border-caos-border flex items-center gap-2 text-caos-lg leading-snug">
          <Dot sev="running" pulse />
          <span className="tabular text-caos-text whitespace-nowrap">{progress.index}/{progress.total}</span>
          <span className="text-caos-muted truncate min-w-0">— {progress.name}</span>
        </div>
      ) : (
        <div className="px-3 py-2.5 border-b border-caos-border text-caos-lg text-caos-text leading-snug">
          {okCount} document{okCount === 1 ? "" : "s"} vaulted for {selectedIssuer?.name}
          {/* Truthful run status (FE-1): report what POST /api/runs actually
              returned — never assert "run queued" when nothing was queued. */}
          {runOutcome?.state === "queued" ? (
            <> · {modeMeta?.label} ({modeMeta?.code}) run queued · RUN #{runOutcome.runId.slice(0, 8)}</>
          ) : runOutcome?.state === "queuing" ? (
            <> · queuing {modeMeta?.label} ({modeMeta?.code}) run…</>
          ) : runOutcome?.state === "active" ? (
            <> · a run for this issuer is already in progress — new documents are picked up on the next run</>
          ) : runOutcome?.state === "failed" ? (
            <span style={{ color: "var(--caos-warning)" }}> · run not started ({runOutcome.message}) — start one from Pipeline</span>
          ) : null}
          {failCount ? <span style={{ color: "var(--caos-critical)" }}> · {failCount} failed</span> : null}
          {zeroCount ? <span style={{ color: "var(--caos-warning)" }}> · {zeroCount} with no extractable text</span> : null}
        </div>
      )}
      {!uploading && selectedIssuer && runOutcome?.state === "queued" ? (
        <div className="flex items-center gap-2 border-b border-caos-border px-3 py-2">
          <span className="tabular text-caos-xs text-caos-muted">Exact run {runOutcome.runId.slice(0, 8)}</span>
          <Link
            href={`/pipeline?issuer=${encodeURIComponent(selectedIssuer.id)}&run=${encodeURIComponent(runOutcome.runId)}&view=graph${contextId ? `&context=${encodeURIComponent(contextId)}` : ""}`}
            className="caos-action-secondary ml-auto no-underline focus-ring"
          >
            Open Execution Graph
          </Link>
        </div>
      ) : null}
      {/* Vaulting a document never starts a run by itself — this is the explicit
          trigger. modeMeta is descriptive metadata on the vaulted documents
          today (not yet threaded into the engine route), so the run itself is
          always the full CP-X route regardless of the mode picked in step 2. */}
      {/* Gated on !runOutcome / "failed": runUpload's own auto-queue attempt
          (FE-1, above) already fires a run for every vaulted batch — showing
          this manual trigger too, unconditionally, would let the analyst
          double-queue (and double-spend) a second run for the same documents.
          It survives only as the retry path when the automatic attempt never
          ran or failed. */}
      {!uploading && okCount > 0 && selectedIssuer && (!runOutcome || runOutcome.state === "failed") ? (
        <div className="px-3 py-2.5 border-b border-caos-border flex items-center gap-2.5">
          {runCreated ? (
            <>
              <Dot sev={runCreated.status === "failed" ? "critical" : "ok"} />
              <span className="tabular text-caos-md text-caos-text">
                RUN {runCreated.status.toUpperCase()} · {runCreated.id.slice(0, 8)}
              </span>
              <Link
                href={`/pipeline?issuer=${encodeURIComponent(selectedIssuer.id)}&run=${encodeURIComponent(runCreated.id)}&view=graph${contextId ? `&context=${encodeURIComponent(contextId)}` : ""}`}
                className="focus-ring ml-auto no-underline tabular text-caos-md px-2.5 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos"
              >
                VIEW IN PIPELINE →
              </Link>
            </>
          ) : (
            <>
              <button
                onClick={onCreateRun}
                disabled={runCreating}
                className="focus-ring tabular text-caos-md px-3 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos disabled:opacity-40 flex items-center gap-1.5"
              >
                {runCreating ? <Dot sev="running" pulse /> : null}
                {runCreating ? "QUEUING RUN…" : `RUN ${modeMeta?.label.toUpperCase() ?? ""}`}
              </button>
              {runError ? (
                <span role="alert" className="text-caos-md" style={{ color: "var(--caos-critical-bright)" }}>{runError}</span>
              ) : runOutcome?.state === "failed" ? (
                <span className="tabular text-caos-xs text-caos-muted">the automatic run attempt failed — retry above</span>
              ) : (
                <span className="tabular text-caos-xs text-caos-muted">not started yet — vaulting a document doesn&apos;t queue a run</span>
              )}
            </>
          )}
        </div>
      ) : null}
      <div className="text-caos-md">
        {outcomes.map((o) => {
          const noText = !!o.result && o.result.chunks_created === 0;
          return (
            <div key={o.name} className="grid grid-cols-[14px_minmax(0,1fr)_120px_110px] items-center gap-x-2 px-3 py-[6px] border-b border-caos-border/50">
              <Dot sev={o.result ? (noText ? "warning" : "ok") : "critical"} />
              <span className="text-caos-text truncate">{o.name}</span>
              <span className="tabular text-caos-2xs text-caos-muted truncate" title={o.result?.source_manifest_id}>
                {o.result ? `MANIFEST ${o.result.source_manifest_id.slice(0, 8)}` : "—"}
              </span>
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
        {/* Retry only the failed files — issuer, run mode, and the rows that
            already succeeded are all preserved, so a transient 5xx on 2 of 12
            never forces re-selecting the issuer or re-dropping the batch. */}
        {failCount > 0 && !uploading ? (
          <button
            onClick={onRetryFailed}
            className="focus-ring flex-1 tabular text-caos-md py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos flex items-center justify-center gap-1.5"
          >
            <Dot sev="critical" />
            RETRY <span className="tabular">{failCount}</span> FAILED
          </button>
        ) : null}
        <button
          onClick={onReset}
          disabled={uploading}
          className="focus-ring flex-1 tabular text-caos-md py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos disabled:opacity-40 disabled:cursor-not-allowed"
        >
          UPLOAD ANOTHER
        </button>
        {selectedIssuer ? (
          <button
            onClick={() => openProfile(selectedIssuer.id)}
            className="focus-ring flex-1 tabular text-caos-md py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos"
          >
            OPEN ISSUER PROFILE →
          </button>
        ) : (
          <Link
            href="/issuers"
            className="focus-ring flex-1 no-underline text-center tabular text-caos-md py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos"
          >
            OPEN ISSUER PROFILE →
          </Link>
        )}
        <Link
          href="/issuers"
          className="focus-ring flex-1 no-underline text-center tabular text-caos-md py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos"
        >
          ISSUER REGISTER →
        </Link>
      </div>
    </Panel>
  );
}
