"use client";

// Presentational steps for the CP-0 document-intake wizard, lifted out of
// UploadWizard so the wizard component holds state + handlers and these render.
// All four are pure: they own no state; every interaction is a prop callback.
// Markup is byte-identical to the former inline JSX.

import Link from "next/link";
import { useDropzone } from "react-dropzone";
import { ActionReason } from "@/components/shared/ActionReason";
import { CompletionStateSummary } from "@/components/shared/CompletionStateSummary";
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
  // EDGAR vault responses do not expose a source-manifest id. Keep that fact
  // explicit instead of inventing an identifier just to fit the drag/drop row.
  source_manifest_id?: string;
  warning?: string | null;
  // The intake response currently does not return a persisted ClamAV verdict.
  // This optional field is reserved for that response contract; absence renders
  // as unavailable rather than a fabricated "clean" status.
  malware_scan?: string | null;
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
    <div
      role="region"
      aria-label="Document intake steps"
      tabIndex={0}
      className="h-9 shrink-0 rounded border border-caos-border bg-caos-panel/60 px-3 flex items-center gap-2 overflow-x-auto focus-ring"
    >
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
          name="upload-issuer-search"
          autoComplete="off"
          value={issuerQuery}
          onChange={(e) => setIssuerQuery(e.target.value)}
          placeholder="Search issuer · ticker · sector…"
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
              name="new-issuer-name"
              autoComplete="off"
              value={newIssuerName}
              onChange={(e) => setNewIssuerName(e.target.value)}
              placeholder="Issuer name (e.g. Atlas Forge Industrials)…"
              aria-label="Issuer name"
              maxLength={255}
              className="w-full px-2.5 py-1.5 text-caos-lg"
            />
            <TextInput
              type="text"
              name="new-issuer-ticker"
              autoComplete="off"
              spellCheck={false}
              value={newIssuerTicker}
              onChange={(e) => setNewIssuerTicker(e.target.value)}
              placeholder="Ticker (optional)…"
              aria-label="Ticker (optional)"
              maxLength={32}
              className="w-full px-2.5 py-1.5 text-caos-lg"
            />
            <div className="flex gap-2">
              <ActionReason
                onClick={onCreateIssuer}
                reason={!newIssuerName.trim() ? "Enter an issuer name first" : null}
                className="focus-ring tabular text-caos-md px-3 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos aria-disabled:opacity-40"
              >
                CREATE
              </ActionReason>
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
interface FileStepProps {
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
}

function dropzoneStyle(props: FileStepProps) {
  if (props.isDragActive) return { borderColor: "var(--caos-accent)", background: "color-mix(in srgb, var(--tranche-2l) 6%, transparent)" };
  if (props.files.length) return { borderColor: "color-mix(in srgb, var(--caos-success) 50%, transparent)", background: "color-mix(in srgb, var(--caos-success) 4%, transparent)" };
  return { borderColor: "var(--caos-border)", background: "var(--caos-bg)" };
}

function FileDropzone({ props }: { props: FileStepProps }) {
  return <div {...props.getRootProps()} className="focus-ring rounded border border-dashed px-4 py-7 text-center cursor-pointer transition-caos" style={dropzoneStyle(props)}>
    <input {...props.getInputProps()} aria-label="Upload deal documents (PDF or XLSX)" />
    <div className="text-caos-lg text-caos-text/85">Drop all deal documents here, or click to browse</div>
    <div className="tabular text-caos-xs text-caos-muted mt-1">PDF / XLSX · multiple files · documents are already dated — CP-0 classifies on ingest</div>
  </div>;
}

function StagedFileRow({ file, onRemove }: { file: File; onRemove: (file: File) => void }) {
  return <div className="grid grid-cols-[1fr_90px_60px] items-center gap-x-3 px-3 py-[6px] border-b border-caos-border/50 last:border-b-0">
    <span className="text-caos-lg text-caos-text truncate">{file.name}</span>
    <span className="tabular text-caos-xs text-caos-muted text-right">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
    <button onClick={() => onRemove(file)} aria-label={`Remove ${file.name}`} className="focus-ring rounded tabular text-caos-xs text-caos-muted hover:text-caos-text text-right transition-caos">REMOVE</button>
  </div>;
}

function StagedFiles({ props }: { props: FileStepProps }) {
  if (!props.files.length) return null;
  return <div className="rounded border border-caos-border overflow-hidden">
    {props.files.map((file) => <StagedFileRow key={file.name + file.size} file={file} onRemove={props.onRemoveFile} />)}
  </div>;
}

function AuthorityDeclaration({ props }: { props: FileStepProps }) {
  return <div>
    <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1.5">Authority declaration</div>
    <div className="grid gap-2 md:grid-cols-2">
      <label className="grid gap-1 tabular text-caos-xs text-caos-muted">Origin
        <select value={props.origin} onChange={(event) => props.setOrigin(event.target.value as FileStepProps["origin"])} className="h-8 rounded border border-caos-border bg-caos-bg px-2 text-caos-md text-caos-text focus-ring">
          <option value="live">LIVE · analyst source</option><option value="reference">REFERENCE · template/comparison</option><option value="demo">DEMO · non-decision fixture</option>
        </select>
      </label>
      <label className="grid gap-1 tabular text-caos-xs text-caos-muted">Method
        <select value={props.method} onChange={(event) => props.setMethod(event.target.value as FileStepProps["method"])} className="h-8 rounded border border-caos-border bg-caos-bg px-2 text-caos-md text-caos-text focus-ring">
          <option value="reported">REPORTED · source disclosure</option><option value="derived">DERIVED · deterministic transform</option><option value="modelled">MODELLED · analytical estimate</option>
        </select>
      </label>
    </div>
    <p className="mt-1 text-caos-xs text-caos-muted">This declaration is written into the immutable source manifest and follows the evidence downstream.</p>
    <p className="mt-1 text-caos-xs text-caos-muted">Declared by analyst; system validation and approval are separate.</p>
  </div>;
}

function RunModePicker({ props }: { props: FileStepProps }) {
  const selected = RUN_MODES.find((mode) => mode.k === props.runMode) ?? RUN_MODES[0];
  return <label className="grid gap-1.5">
    <span className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted">Run mode</span>
    <select
      aria-label="Run mode"
      value={props.runMode}
      onChange={(event) => props.setRunMode(event.target.value)}
      className="h-9 w-full rounded border border-caos-border bg-caos-bg px-2.5 text-caos-md text-caos-text focus-ring"
    >
      {RUN_MODES.map((mode) => <option key={mode.k} value={mode.k}>{mode.code} · {mode.label}</option>)}
    </select>
    <span className="rounded border border-caos-border/70 bg-caos-elevated/35 px-2.5 py-2">
      <span className="tabular text-caos-xs text-caos-accent">{selected.code} · {selected.label}</span>
      <span className="mt-0.5 block text-caos-sm text-caos-muted">{selected.desc}</span>
    </span>
  </label>;
}

function PrimaryModeWarning({ runMode }: { runMode: string }) {
  if (runMode !== "primary") return null;
  return <div role="note" className="rounded border px-3 py-2 flex items-start gap-2" style={{ borderColor: "color-mix(in srgb, var(--caos-warning) 40%, transparent)", background: "color-mix(in srgb, var(--caos-warning) 7%, transparent)" }}>
    <Dot sev="warning" />
    <span className="text-caos-sm leading-snug" style={{ color: "var(--caos-warning)" }}>Primary transaction — include the <span className="font-medium">new-loan price</span>,{" "}<span className="font-medium">OID</span> and <span className="font-medium">cap table</span>{" "}in your source materials so pricing and structure are analysed.</span>
  </div>;
}

function PortfolioPicker({ props }: { props: FileStepProps }) {
  const portfolios = props.portfolios ?? [];
  const setPortfolioId = props.setPortfolioId;
  if (!portfolios.length || !setPortfolioId) return null;
  return <div>
    <div className="tabular text-caos-2xs uppercase tracking-wider text-caos-muted mb-1.5">Portfolio context</div>
    <select value={props.portfolioId ?? ""} onChange={(event) => setPortfolioId(event.target.value)} aria-label="Portfolio to evaluate this issuer against" className="w-full px-2.5 py-1.5 text-caos-lg rounded border border-caos-border bg-caos-bg text-caos-text focus-ring">
      <option value="">Auto — the book holding this issuer</option>
      {portfolios.map((portfolio) => <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>)}
    </select>
    <div className="tabular text-caos-2xs text-caos-muted mt-1 leading-snug">The book CP-3C evaluates the issuer against (concentration + headroom). Auto-binds when the issuer is held.</div>
  </div>;
}

function uploadReason(props: FileStepProps) {
  if (!props.files.length) return "Add at least one file first";
  return props.uploading ? "Upload in progress…" : null;
}

function UploadActionLabel({ props }: { props: FileStepProps }) {
  if (!props.uploading) {
    const count = props.files.length || "";
    const suffix = props.files.length === 1 ? "" : "S";
    return <>UPLOAD {count} FILE{suffix} &amp; PROCESS</>;
  }
  return <><Dot sev="running" pulse /><span className="whitespace-nowrap">UPLOADING <span className="tabular">{props.progress?.index ?? 0}/{props.progress?.total ?? props.files.length}</span></span>{props.progress?.name ? <span className="text-caos-muted truncate min-w-0">— {props.progress.name}</span> : null}</>;
}

function UploadControls({ props }: { props: FileStepProps }) {
  return <div className="flex gap-2">
    <ActionReason onClick={props.onUpload} reason={uploadReason(props)} className="focus-ring flex-1 min-w-0 h-8 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos tabular text-caos-md aria-disabled:opacity-40 aria-disabled:cursor-not-allowed flex items-center justify-center gap-2 px-3">
      <UploadActionLabel props={props} />
    </ActionReason>
    {props.uploading ? <button onClick={props.onCancel} className="focus-ring shrink-0 h-8 px-3 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-critical/60 transition-caos tabular text-caos-md">CANCEL</button> : null}
  </div>;
}

export function FileStep(props: FileStepProps) {
  const issuerName = props.selectedIssuer?.name || "";
  return <Panel
    title={`Files & run mode · ${issuerName}`}
    right={<button onClick={props.onBack} className="focus-ring rounded px-1 tabular text-caos-xs text-caos-muted hover:text-caos-text transition-caos">← BACK</button>}
  >
    <div className="p-3 flex flex-col gap-3">
      <FileDropzone props={props} />
      <StagedFiles props={props} />
      <AuthorityDeclaration props={props} />
      <RunModePicker props={props} />
      <PrimaryModeWarning runMode={props.runMode} />
      <PortfolioPicker props={props} />
      <UploadControls props={props} />
    </div>
  </Panel>;
}

/* ---------- step 3: result ---------- */
interface ResultStepProps {
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
}

const NO_TEXT_TITLE = "No extractable text (scanned or encrypted PDF?) — vaulted but not searchable or analysed.";

function zeroChunkCount(outcomes: FileOutcome[]) {
  return outcomes.filter((outcome) => outcome.result?.chunks_created === 0).length;
}

function pipelineRunHref(issuerId: string, runId: string, contextId?: string) {
  const context = contextId ? `&context=${encodeURIComponent(contextId)}` : "";
  return `/pipeline?issuer=${encodeURIComponent(issuerId)}&run=${encodeURIComponent(runId)}&view=graph${context}`;
}

function resultSeverity(uploading: boolean, failCount: number, zeroCount: number) {
  if (uploading) return "running" as const;
  return failCount || zeroCount ? "warning" as const : "ok" as const;
}

function ResultPanelStatus({ props, zeroCount }: { props: ResultStepProps; zeroCount: number }) {
  const text = props.uploading && props.progress
    ? `${props.progress.index}/${props.progress.total} processing`
    : `${props.okCount}/${props.outcomes.length} vaulted · ${props.totalChunks} chunks`;
  return <span className="flex items-center gap-1.5">
    <Dot sev={resultSeverity(props.uploading, props.failCount, zeroCount)} pulse={props.uploading} />
    <span className="tabular text-caos-xs text-caos-muted">{text}</span>
  </span>;
}

function RunOutcomeStatus({ outcome }: { outcome: RunQueueOutcome | null }) {
  if (outcome?.state === "queued") return <> · run queued (full CP-X route) · RUN #{outcome.runId.slice(0, 8)}</>;
  if (outcome?.state === "queuing") return <> · queuing run…</>;
  if (outcome?.state === "active") return <> · a run for this issuer is already in progress — new documents are picked up on the next run</>;
  if (outcome?.state === "failed") return <span style={{ color: "var(--caos-warning)" }}> · run not started ({outcome.message}) — start one from Pipeline</span>;
  return null;
}

function ResultSummary({ props, zeroCount }: { props: ResultStepProps; zeroCount: number }) {
  if (props.uploading && props.progress) return <div className="px-3 py-2.5 border-b border-caos-border flex items-center gap-2 text-caos-lg leading-snug">
    <Dot sev="running" pulse />
    <span className="tabular text-caos-text whitespace-nowrap">{props.progress.index}/{props.progress.total}</span>
    <span className="text-caos-muted truncate min-w-0">— {props.progress.name}</span>
  </div>;
  const documentSuffix = props.okCount === 1 ? "" : "s";
  return <div className="px-3 py-2.5 border-b border-caos-border text-caos-lg text-caos-text leading-snug">
    {props.okCount} document{documentSuffix} vaulted for {props.selectedIssuer?.name}
    {props.modeMeta ? <span className="text-caos-muted"> · {props.modeMeta.label} is intake metadata; runs use the full analysis route</span> : null}
    <RunOutcomeStatus outcome={props.runOutcome} />
    {props.failCount ? <span style={{ color: "var(--caos-critical)" }}> · {props.failCount} failed</span> : null}
    {zeroCount ? <span style={{ color: "var(--caos-warning)" }}> · {zeroCount} with no extractable text</span> : null}
  </div>;
}

function QueuedRunLink({ props }: { props: ResultStepProps }) {
  const outcome = props.runOutcome;
  if (props.uploading || !props.selectedIssuer || outcome?.state !== "queued") return null;
  return <div className="flex items-center gap-2 border-b border-caos-border px-3 py-2">
    <span className="tabular text-caos-xs text-caos-muted">Exact run {outcome.runId.slice(0, 8)}</span>
    <Link href={pipelineRunHref(props.selectedIssuer.id, outcome.runId, props.contextId)} className="caos-action-secondary ml-auto no-underline focus-ring">Open dependency map</Link>
  </div>;
}

function CreatedRun({ props }: { props: ResultStepProps }) {
  const run = props.runCreated;
  const issuer = props.selectedIssuer;
  if (!run || !issuer) return null;
  return <>
    <Dot sev={run.status === "failed" ? "critical" : "ok"} />
    <span className="tabular text-caos-md text-caos-text">RUN {run.status.toUpperCase()} · {run.id.slice(0, 8)}</span>
    <Link href={pipelineRunHref(issuer.id, run.id, props.contextId)} className="focus-ring ml-auto no-underline tabular text-caos-md px-2.5 py-1 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos">VIEW IN PIPELINE →</Link>
  </>;
}

function ManualRunMessage({ props }: { props: ResultStepProps }) {
  if (props.runError) return <span role="alert" className="text-caos-md" style={{ color: "var(--caos-critical-bright)" }}>{props.runError}</span>;
  if (props.runOutcome?.state === "failed") return <span className="tabular text-caos-xs text-caos-muted">the automatic run attempt failed — retry above</span>;
  return <span className="tabular text-caos-xs text-caos-muted">not started yet — vaulting a document doesn&apos;t queue a run</span>;
}

function PendingRun({ props }: { props: ResultStepProps }) {
  return <>
    <ActionReason
      onClick={props.onCreateRun}
      reason={props.runCreating ? "Queuing run…" : null}
      className="focus-ring tabular text-caos-md px-3 py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos aria-disabled:opacity-40 flex items-center gap-1.5"
    >
      {props.runCreating ? <Dot sev="running" pulse /> : null}
      {props.runCreating ? "QUEUING RUN…" : "START FULL ANALYSIS RUN"}
    </ActionReason>
    <ManualRunMessage props={props} />
  </>;
}

function ManualRunGate({ props }: { props: ResultStepProps }) {
  if (props.uploading || props.okCount <= 0 || !props.selectedIssuer) return null;
  if (props.runOutcome && props.runOutcome.state !== "failed") return null;
  return <div className="px-3 py-2.5 border-b border-caos-border flex items-center gap-2.5">
    {props.runCreated ? <CreatedRun props={props} /> : <PendingRun props={props} />}
  </div>;
}

function outcomeManifestLabel(result: UploadResult | undefined) {
  if (!result) return "—";
  return result.source_manifest_id ? `MANIFEST ${result.source_manifest_id.slice(0, 8)}` : "EDGAR VAULT";
}

function OutcomeScan({ result }: { result: UploadResult | undefined }) {
  if (!result) return null;
  const title = result.malware_scan ? "Persisted scanner verdict from intake" : "This intake response did not return a persisted scanner verdict.";
  return <span className="tabular text-caos-3xs text-caos-muted" title={title}>{result.malware_scan ? `scan ${result.malware_scan}` : "scan verdict unavailable"}</span>;
}

function OutcomeStatus({ outcome, noText }: { outcome: FileOutcome; noText: boolean }) {
  const color = outcome.result ? (noText ? "var(--caos-warning)" : "var(--caos-muted)") : "var(--caos-critical)";
  const text = outcome.result ? (noText ? "0 chunks — no text" : `${outcome.result.chunks_created} chunks`) : outcome.error;
  return <span className="flex min-w-0 flex-col items-end text-right">
    <span className="tabular text-caos-xs" title={noText ? NO_TEXT_TITLE : undefined} style={{ color }}>{text}</span>
    <OutcomeScan result={outcome.result} />
  </span>;
}

function ResultOutcomeRow({ outcome }: { outcome: FileOutcome }) {
  const noText = outcome.result?.chunks_created === 0;
  const severity = outcome.result ? (noText ? "warning" : "ok") : "critical";
  return <div className="grid grid-cols-[14px_minmax(0,1fr)_120px_110px] items-center gap-x-2 px-3 py-[6px] border-b border-caos-border/50">
    <Dot sev={severity} />
    <span className="text-caos-text truncate">{outcome.name}</span>
    <span className="tabular text-caos-2xs text-caos-muted truncate" title={outcome.result?.source_manifest_id}>{outcomeManifestLabel(outcome.result)}</span>
    <OutcomeStatus outcome={outcome} noText={noText} />
  </div>;
}

function RetryFailedAction({ props }: { props: ResultStepProps }) {
  if (props.failCount <= 0 || props.uploading) return null;
  return <button onClick={props.onRetryFailed} className="focus-ring flex-1 tabular text-caos-md py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos flex items-center justify-center gap-1.5">
    <Dot sev="critical" />RETRY <span className="tabular">{props.failCount}</span> FAILED
  </button>;
}

function IssuerProfileAction({ issuer }: { issuer: Issuer | null }) {
  const { openProfile } = useIssuerProfileOverlay();
  if (!issuer) return <Link href="/issuers" className="focus-ring flex-1 no-underline text-center tabular text-caos-md py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos">OPEN ISSUER PROFILE →</Link>;
  return <button onClick={() => openProfile(issuer.id)} className="focus-ring flex-1 tabular text-caos-md py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos">OPEN ISSUER PROFILE →</button>;
}

// The run the analyst just spent, if any — auto-queued (FE-1) or manually
// started (FE-2). Present ⇒ "watch it" is the next step, not another intake.
function watchRunHref(props: ResultStepProps): string | null {
  const runId = props.runCreated?.id
    ?? (props.runOutcome?.state === "queued" ? props.runOutcome.runId : null);
  if (!runId || !props.selectedIssuer) return null;
  return pipelineRunHref(props.selectedIssuer.id, runId, props.contextId);
}

function ResultActions({ props }: { props: ResultStepProps }) {
  // Intake→watch is a push, not a hunt: once a run exists, the primary action
  // is following it in Pipeline; the register link demotes to neutral.
  const watchHref = watchRunHref(props);
  const registerCls = watchHref
    ? "border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60"
    : "border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg";
  return <div className="p-3 flex gap-2">
    <RetryFailedAction props={props} />
    <ActionReason
      onClick={props.onReset}
      reason={props.uploading ? "Upload in progress…" : null}
      className="focus-ring flex-1 tabular text-caos-md py-1.5 rounded border border-caos-border text-caos-muted hover:text-caos-text hover:border-caos-accent/60 transition-caos aria-disabled:opacity-40 aria-disabled:cursor-not-allowed"
    >UPLOAD ANOTHER</ActionReason>
    <IssuerProfileAction issuer={props.selectedIssuer} />
    {watchHref ? (
      <Link href={watchHref} className="focus-ring flex-1 no-underline text-center tabular text-caos-md py-1.5 rounded border border-caos-accent text-caos-accent hover:bg-caos-accent hover:text-caos-bg transition-caos">WATCH RUN IN PIPELINE →</Link>
    ) : null}
    <Link href="/issuers" className={`focus-ring flex-1 no-underline text-center tabular text-caos-md py-1.5 rounded border transition-caos ${registerCls}`}>ISSUER REGISTER →</Link>
  </div>;
}

export function ResultStep(props: ResultStepProps) {
  const zeroCount = zeroChunkCount(props.outcomes);
  const headline = props.uploading
    ? "Ingesting · CP-0 processing."
    : props.okCount === 0
      ? "Intake failed · no documents vaulted."
      : props.failCount > 0
        ? `Intake partially complete · ${props.okCount}/${props.outcomes.length} vaulted.`
        : "Vaulted · CP-0 not ready.";
  return <Panel
    title={headline}
    right={<ResultPanelStatus props={props} zeroCount={zeroCount} />}
  >
    <CompletionStateSummary
      label="CP-0 intake completion"
      execution={props.uploading ? "running" : props.okCount > 0 ? "complete" : "failed"}
      persistence={props.okCount === 0 ? "unsaved" : props.uploading || props.failCount > 0 ? "partial" : "saved"}
      approval="not-applicable"
      freshness="unknown"
      className="m-3 mb-0"
    />
    <ResultSummary props={props} zeroCount={zeroCount} />
    <QueuedRunLink props={props} />
    <ManualRunGate props={props} />
    <div className="text-caos-md">{props.outcomes.map((outcome) => <ResultOutcomeRow key={outcome.name} outcome={outcome} />)}</div>
    <ResultActions props={props} />
  </Panel>;
}
