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

function useWizardNavigation() {
  const [step, setStep] = useState<Step>("issuer");
  return { setStep, step };
}

function useIssuerDirectory(initialIssuers: Issuer[]) {
  const [issuers, setIssuers] = useState<Issuer[]>(initialIssuers);
  const [issuerLoadState, setIssuerLoadState] = useState<"loading" | "ready" | "error">(
    initialIssuers.length > 0 ? "ready" : "loading",
  );
  const [issuerLoadError, setIssuerLoadError] = useState("");
  const issuerLoadGenerationRef = useRef(0);
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
  return { issuerLoadError, issuerLoadState, issuers, loadIssuerDirectory, setIssuers };
}

function useIssuerSelection() {
  const [issuerQuery, setIssuerQuery] = useState("");
  const [selectedIssuer, setSelectedIssuer] = useState<Issuer | null>(null);
  return { issuerQuery, selectedIssuer, setIssuerQuery, setSelectedIssuer };
}

function useNewIssuerForm() {
  const [showNewIssuer, setShowNewIssuer] = useState(false);
  const [newIssuerName, setNewIssuerName] = useState("");
  const [newIssuerTicker, setNewIssuerTicker] = useState("");
  const creatingIssuer = useRef(false);
  return { creatingIssuer, newIssuerName, newIssuerTicker, setNewIssuerName, setNewIssuerTicker, setShowNewIssuer, showNewIssuer };
}

function mergeAcceptedFiles(current: File[], accepted: File[]) {
  const have = new Set(current.map((file) => `${file.name}:${file.size}`));
  return [...current, ...accepted.filter((file) => !have.has(`${file.name}:${file.size}`))];
}

function mergeRejectedFiles(current: string[], rejections: FileRejection[]) {
  const have = new Set(current);
  return [...current, ...rejections.map((rejection) => rejection.file.name).filter((name) => !have.has(name))];
}

function useIntakeSetup() {
  const [files, setFiles] = useState<File[]>([]);
  const [runMode, setRunMode] = useState<string>("full");
  const [origin, setOrigin] = useState<"live" | "reference" | "demo">("live");
  const [method, setMethod] = useState<"reported" | "derived" | "modelled">("reported");
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [portfolioId, setPortfolioId] = useState<string>("");
  const [rejected, setRejected] = useState<string[]>([]);
  useEffect(() => {
    getPortfolios().then(setPortfolios).catch(() => setPortfolios([]));
  }, []);
  return {
    files, method, origin, portfolioId, portfolios, rejected, runMode, setFiles, setMethod,
    setOrigin, setPortfolioId, setRejected, setRunMode,
  };
}

function useUploadProcess() {
  const [uploading, setUploading] = useState(false);
  const [outcomes, setOutcomes] = useState<FileOutcome[]>([]);
  const [error, setError] = useState("");
  const [runOutcome, setRunOutcome] = useState<RunQueueOutcome | null>(null);
  const runQueuedRef = useRef(false);
  const runIdempotencyKeyRef = useRef<string | null>(null);
  const [progress, setProgress] = useState<{ index: number; total: number; name: string } | null>(null);
  const cancelRef = useRef(false);
  const uploadingRef = useRef(false);
  return {
    cancelRef, error, outcomes, progress, runIdempotencyKeyRef, runOutcome, runQueuedRef,
    setError, setOutcomes, setProgress, setRunOutcome, setUploading, uploading, uploadingRef,
  };
}

function useManualRunState() {
  const [runCreating, setRunCreating] = useState(false);
  const [runCreated, setRunCreated] = useState<RunSummaryDTO | null>(null);
  const [runError, setRunError] = useState("");
  return { runCreated, runCreating, runError, setRunCreated, setRunCreating, setRunError };
}

type IntakeSetup = ReturnType<typeof useIntakeSetup>;

function useWizardDropzone(intake: IntakeSetup) {
  const { setFiles, setRejected } = intake;
  const onDrop = useCallback((accepted: File[], rejections: FileRejection[]) => {
    setFiles((current) => mergeAcceptedFiles(current, accepted));
    if (rejections.length) setRejected((current) => mergeRejectedFiles(current, rejections));
  }, [setFiles, setRejected]);
  return useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
  });
}

type WizardAnalysis = ReturnType<typeof useAnalysisContext>;
type WizardNavigation = ReturnType<typeof useWizardNavigation>;
type IssuerDirectory = ReturnType<typeof useIssuerDirectory>;
type IssuerSelection = ReturnType<typeof useIssuerSelection>;
type NewIssuerForm = ReturnType<typeof useNewIssuerForm>;
type UploadProcess = ReturnType<typeof useUploadProcess>;
type ManualRunState = ReturnType<typeof useManualRunState>;
type ActiveContext = Awaited<ReturnType<typeof ensureIssuerScope>>;

interface WizardState {
  analysis: WizardAnalysis;
  directory: IssuerDirectory;
  intake: IntakeSetup;
  manual: ManualRunState;
  navigation: WizardNavigation;
  newIssuer: NewIssuerForm;
  process: UploadProcess;
  selection: IssuerSelection;
}

async function handleCreateIssuer(state: WizardState) {
  if (state.newIssuer.creatingIssuer.current) return;
  state.newIssuer.creatingIssuer.current = true;
  try {
    const created = await createIssuer({ name: state.newIssuer.newIssuerName, ticker: state.newIssuer.newIssuerTicker || null });
    state.directory.setIssuers((current) => [...current, created]);
    state.selection.setSelectedIssuer(created);
    state.newIssuer.setShowNewIssuer(false);
    state.newIssuer.setNewIssuerName("");
    state.newIssuer.setNewIssuerTicker("");
  } catch (err) {
    state.process.setError(toErrorMessage(err, "Failed to create issuer"));
  } finally {
    state.newIssuer.creatingIssuer.current = false;
  }
}

function ingestionForm(state: WizardState, issuer: Issuer, file: File, context: ActiveContext) {
  const formData = new FormData();
  formData.append("issuer_id", issuer.id);
  formData.append("run_mode", state.intake.runMode);
  formData.append("origin", state.intake.origin);
  formData.append("method", state.intake.method);
  appendIngestionContext(formData, context?.id);
  formData.append("file", file);
  return formData;
}

async function linkIngestedSource(state: WizardState, issuer: Issuer, context: ActiveContext, result: NonNullable<FileOutcome["result"]>) {
  if (!context) return context;
  const legacyArtifacts = { ...context.artifacts };
  delete legacyArtifacts.artifact_refs;
  const patched = await state.analysis.patch({
    issuer_ids: context.issuer_ids,
    artifacts: { ...legacyArtifacts, source_manifest_id: result.source_manifest_id },
    surface_state: {
      ...context.surface_state,
      upload: { ...(context.surface_state.upload ?? {}), active_id: result.source_manifest_id, selected_ids: [issuer.id], view: "result" },
    },
  }).catch(() => {
    state.process.setError("Source was ingested, but the analysis context could not be linked.");
    return null;
  });
  return patched ?? context;
}

interface SettledUpload {
  context: ActiveContext;
  outcome: FileOutcome;
  vaulted: boolean;
}

async function settleUploadFile(state: WizardState, issuer: Issuer, file: File, context: ActiveContext): Promise<SettledUpload> {
  try {
    const formData = ingestionForm(state, issuer, file, context);
    const result = isSpreadsheet(file.name) ? await uploadPricingSheet(formData) : await uploadDocument(formData);
    return { context: await linkIngestedSource(state, issuer, context, result), outcome: { name: file.name, result, file }, vaulted: true };
  } catch (err) {
    return { context, outcome: { name: file.name, error: toErrorMessage(err, "Upload failed"), file }, vaulted: false };
  }
}

async function processUploadFiles(state: WizardState, issuer: Issuer, batch: File[], initialContext: ActiveContext) {
  let context = initialContext;
  let vaultedAny = false;
  let index = 0;
  for (; index < batch.length; index += 1) {
    if (state.process.cancelRef.current) break;
    const file = batch[index];
    state.process.setProgress({ index: index + 1, total: batch.length, name: file.name });
    const settled = await settleUploadFile(state, issuer, file, context);
    context = settled.context;
    vaultedAny ||= settled.vaulted;
    state.process.setOutcomes((current) => [...current, settled.outcome]);
  }
  if (state.process.cancelRef.current && index < batch.length) {
    const canceled = batch.slice(index).map((file) => ({
      name: file.name,
      error: "Not processed — intake canceled.",
      file,
    } satisfies FileOutcome));
    state.process.setOutcomes((current) => [...current, ...canceled]);
  }
  return { context, vaultedAny };
}

async function linkRunToContext(state: WizardState, context: ActiveContext, runId: string, setError: (message: string) => void, message: string) {
  if (!context) return;
  const legacyArtifacts = { ...context.artifacts };
  delete legacyArtifacts.artifact_refs;
  try {
    await state.analysis.patch({ artifacts: { ...legacyArtifacts, issuer_run_id: runId } });
  } catch {
    setError(message);
  }
}

async function linkQueuedRun(state: WizardState, context: ActiveContext, runId: string) {
  await linkRunToContext(state, context, runId, state.process.setError, "Run queued, but the analysis context could not be linked. Use the exact dependency-map link below.");
}

async function createIssuerRun(state: WizardState, issuer: Issuer, context: ActiveContext) {
  const run = await createRun(
    issuer.id, undefined, state.intake.portfolioId || undefined,
    state.process.runIdempotencyKeyRef.current ??= crypto.randomUUID(), context?.id,
  );
  state.process.runIdempotencyKeyRef.current = null;
  return run;
}

async function queueUploadedRun(state: WizardState, issuer: Issuer, context: ActiveContext) {
  state.process.setRunOutcome({ state: "queuing" });
  try {
    const run = await createIssuerRun(state, issuer, context);
    state.process.runQueuedRef.current = true;
    state.process.setRunOutcome({ state: "queued", runId: run.id });
    await linkQueuedRun(state, context, run.id);
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 409) {
      state.process.runQueuedRef.current = true;
      state.process.setRunOutcome({ state: "active" });
    } else {
      state.process.setRunOutcome({ state: "failed", message: toErrorMessage(err, "Run not started") });
    }
  }
}

async function runUpload(state: WizardState, batch: File[], keep: FileOutcome[] = []) {
  const issuer = state.selection.selectedIssuer;
  if (!issuer || !batch.length || state.process.uploadingRef.current) return;
  state.process.uploadingRef.current = true;
  state.process.cancelRef.current = false;
  state.process.setUploading(true);
  state.process.setError("");
  state.process.setOutcomes(keep);
  state.navigation.setStep("result");
  try {
    const context = await ensureIssuerScope(state.analysis.context, issuer.id, state.analysis.patch);
    const settled = await processUploadFiles(state, issuer, batch, context);
    if (settled.vaultedAny && !state.process.cancelRef.current && !state.process.runQueuedRef.current) {
      await queueUploadedRun(state, issuer, settled.context);
    }
  } finally {
    state.process.setProgress(null);
    state.process.setUploading(false);
    state.process.uploadingRef.current = false;
  }
}

function retryFailedUpload(state: WizardState) {
  const completed = state.process.outcomes.filter((outcome) => outcome.result);
  const failed = state.process.outcomes.filter((outcome) => !outcome.result && outcome.file).map((outcome) => outcome.file as File);
  return runUpload(state, failed, completed);
}

async function linkManualRun(state: WizardState, context: ActiveContext, runId: string) {
  await linkRunToContext(state, context, runId, state.manual.setRunError, "Run queued, but the analysis context could not be linked. Use the exact dependency-map link.");
}

async function handleCreateRun(state: WizardState) {
  const issuer = state.selection.selectedIssuer;
  if (!issuer) return;
  state.manual.setRunCreating(true);
  state.manual.setRunError("");
  try {
    const context = await ensureIssuerScope(state.analysis.context, issuer.id, state.analysis.patch);
    const run = await createIssuerRun(state, issuer, context);
    state.manual.setRunCreated(run);
    await linkManualRun(state, context, run.id);
  } catch (err) {
    state.manual.setRunError(toErrorMessage(err, "Could not create the run"));
  } finally {
    state.manual.setRunCreating(false);
  }
}

function reset(state: WizardState) {
  state.navigation.setStep("issuer");
  state.selection.setSelectedIssuer(null);
  state.intake.setFiles([]);
  state.intake.setRunMode("full");
  state.intake.setOrigin("live");
  state.intake.setMethod("reported");
  state.process.setOutcomes([]);
  state.process.setError("");
  state.process.setProgress(null);
  state.intake.setRejected([]);
  state.manual.setRunCreating(false);
  state.manual.setRunCreated(null);
  state.manual.setRunError("");
  state.process.cancelRef.current = false;
  state.process.setRunOutcome(null);
  state.process.runQueuedRef.current = false;
}

function handleEdgarVaulted(state: WizardState, vaulted: EdgarVaultResult) {
  state.process.setOutcomes((current) => current.some((outcome) => outcome.result?.document_id === vaulted.document_id)
    ? current
    : [...current, {
      name: vaulted.message,
      result: {
        document_id: vaulted.document_id,
        issuer_id: state.selection.selectedIssuer!.id,
        minio_key: vaulted.storage_key,
        chunks_created: vaulted.chunks_created,
        message: vaulted.message,
        warning: vaulted.warning,
      },
    }]);
  state.navigation.setStep("result");
}

function selectIssuer(state: WizardState, issuer: Issuer) {
  const selected = state.selection.selectedIssuer;
  if (selected && selected.id !== issuer.id) {
    state.intake.setFiles([]);
    state.intake.setRejected([]);
  }
  state.selection.setSelectedIssuer(issuer);
  state.navigation.setStep("file");
}

function useIssuerDeepLink(issuerParam: string | null, directory: IssuerDirectory, selection: IssuerSelection, navigation: WizardNavigation) {
  const { issuers } = directory;
  const { setSelectedIssuer } = selection;
  const { setStep } = navigation;
  useEffect(() => {
    if (!issuerParam) return;
    const match = issuers.find((issuer) => issuer.id === issuerParam);
    if (!match) return;
    setSelectedIssuer(match);
    setStep((current) => current === "issuer" ? "file" : current);
  }, [issuerParam, issuers, setSelectedIssuer, setStep]);
}

function useUploadContextSync(state: WizardState) {
  const context = state.analysis.context;
  const patch = state.analysis.patch;
  const selected = state.selection.selectedIssuer;
  const step = state.navigation.step;
  const setError = state.process.setError;
  useEffect(() => {
    if (!selected || !context) return;
    const issuerIds = context.issuer_ids.includes(selected.id) ? context.issuer_ids : [...context.issuer_ids, selected.id];
    const current = context.surface_state.upload;
    if (issuerIds === context.issuer_ids && current?.selected_ids?.[0] === selected.id && current.view === step) return;
    void patch({ issuer_ids: issuerIds, surface_state: { upload: { ...(current ?? {}), selected_ids: [selected.id], view: step } } })
      .catch(() => setError("The selected issuer could not be linked to this analysis context."));
  }, [context, patch, selected, setError, step]);
}

function useUploadWizardController(initialIssuers: Issuer[]) {
  const analysis = useAnalysisContext({ name: "Document intake" });
  const navigation = useWizardNavigation();
  const directory = useIssuerDirectory(initialIssuers);
  const selection = useIssuerSelection();
  const newIssuer = useNewIssuerForm();
  const intake = useIntakeSetup();
  const process = useUploadProcess();
  const manual = useManualRunState();
  const dropzone = useWizardDropzone(intake);
  const issuerParam = useSearchParams().get("issuer");
  const state: WizardState = { analysis, directory, intake, manual, navigation, newIssuer, process, selection };
  useIssuerDeepLink(issuerParam, directory, selection, navigation);
  useUploadContextSync(state);
  const modeMeta = RUN_MODES.find((mode) => mode.k === intake.runMode);
  const okCount = process.outcomes.filter((outcome) => outcome.result).length;
  return {
    dropzone, failCount: process.outcomes.length - okCount, modeMeta, okCount, state,
    totalChunks: process.outcomes.reduce((total, outcome) => total + (outcome.result?.chunks_created || 0), 0),
  };
}

type UploadWizardController = ReturnType<typeof useUploadWizardController>;

function filteredIssuers(state: WizardState) {
  const query = state.selection.issuerQuery.trim().toLowerCase();
  return state.directory.issuers.filter((issuer) => `${issuer.name} ${issuer.ticker ?? ""} ${issuer.sector ?? issuer.industry ?? ""} ${issuer.sub_sector ?? ""}`.toLowerCase().includes(query));
}

function WizardError({ message }: { message: string }) {
  if (!message) return null;
  return <div className="rounded border px-3 py-2 flex items-center gap-2" style={{ borderColor: "color-mix(in srgb, var(--caos-critical) 50%, transparent)", background: "color-mix(in srgb, var(--caos-critical) 7%, transparent)" }}>
    <Dot sev="critical" /><span className="text-caos-lg" style={{ color: "var(--caos-critical-bright)" }}>{message}</span>
  </div>;
}

function IssuerLoadStatus({ state }: { state: WizardState }) {
  if (state.navigation.step !== "issuer") return null;
  if (state.directory.issuerLoadState === "loading") return <SurfaceState kind="loading" title="Loading issuer directory…" headingLevel={2} compact />;
  if (state.directory.issuerLoadState !== "error") return null;
  return <SurfaceState
    kind="error"
    title={state.directory.issuerLoadError}
    headingLevel={2}
    compact
    primaryAction={<button type="button" className="caos-action-secondary focus-ring" onClick={() => void state.directory.loadIssuerDirectory()}>Retry issuer load</button>}
  />;
}

function RejectedFilesWarning({ state }: { state: WizardState }) {
  const rejected = state.intake.rejected;
  if (!rejected.length) return null;
  const suffix = rejected.length > 1 ? "s" : "";
  return <div className="rounded border px-3 py-2 flex items-start gap-2" style={{ borderColor: "color-mix(in srgb, var(--caos-warning) 50%, transparent)", background: "color-mix(in srgb, var(--caos-warning) 7%, transparent)" }}>
    <Dot sev="warning" />
    <span className="text-caos-lg flex-1 min-w-0" style={{ color: "var(--caos-warning)" }}><span className="tabular">{rejected.length}</span> file{suffix} skipped — only PDF / XLSX are ingested:{" "}<span className="text-caos-text break-words">{rejected.join(", ")}</span></span>
    <button onClick={() => state.intake.setRejected([])} aria-label="Dismiss skipped-files warning" className="focus-ring shrink-0 tabular text-caos-xs uppercase tracking-wider text-caos-muted hover:text-caos-text transition-caos rounded px-1">DISMISS</button>
  </div>;
}

function IssuerStage({ state }: { state: WizardState }) {
  if (state.navigation.step !== "issuer") return null;
  return <IssuerStep
    issuers={filteredIssuers(state)}
    issuerQuery={state.selection.issuerQuery}
    setIssuerQuery={state.selection.setIssuerQuery}
    selectedIssuer={state.selection.selectedIssuer}
    onSelectIssuer={(issuer) => selectIssuer(state, issuer)}
    showNewIssuer={state.newIssuer.showNewIssuer}
    setShowNewIssuer={state.newIssuer.setShowNewIssuer}
    newIssuerName={state.newIssuer.newIssuerName}
    setNewIssuerName={state.newIssuer.setNewIssuerName}
    newIssuerTicker={state.newIssuer.newIssuerTicker}
    setNewIssuerTicker={state.newIssuer.setNewIssuerTicker}
    onCreateIssuer={() => void handleCreateIssuer(state)}
  />;
}

function FileStage({ controller }: { controller: UploadWizardController }) {
  const { dropzone, state } = controller;
  if (state.navigation.step !== "file") return null;
  return <>
    <FileStep
      selectedIssuer={state.selection.selectedIssuer}
      getRootProps={dropzone.getRootProps}
      getInputProps={dropzone.getInputProps}
      isDragActive={dropzone.isDragActive}
      files={state.intake.files}
      onRemoveFile={(file) => state.intake.setFiles((current) => current.filter((candidate) => candidate !== file))}
      runMode={state.intake.runMode}
      setRunMode={state.intake.setRunMode}
      origin={state.intake.origin}
      setOrigin={state.intake.setOrigin}
      method={state.intake.method}
      setMethod={state.intake.setMethod}
      uploading={state.process.uploading}
      progress={state.process.progress}
      onUpload={() => void runUpload(state, state.intake.files)}
      onCancel={() => { state.process.cancelRef.current = true; }}
      onBack={() => state.navigation.setStep("issuer")}
      portfolios={state.intake.portfolios}
      portfolioId={state.intake.portfolioId}
      setPortfolioId={state.intake.setPortfolioId}
    />
    <EdgarImport issuer={state.selection.selectedIssuer!} runMode={state.intake.runMode} onVaulted={(vaulted) => handleEdgarVaulted(state, vaulted)} />
  </>;
}

function ResultStage({ controller }: { controller: UploadWizardController }) {
  const { failCount, modeMeta, okCount, state, totalChunks } = controller;
  if (state.navigation.step !== "result" || (!state.process.outcomes.length && !state.process.uploading)) return null;
  return <ResultStep
    outcomes={state.process.outcomes}
    selectedIssuer={state.selection.selectedIssuer}
    modeMeta={modeMeta}
    okCount={okCount}
    failCount={failCount}
    totalChunks={totalChunks}
    uploading={state.process.uploading}
    progress={state.process.progress}
    runOutcome={state.process.runOutcome}
    onReset={() => reset(state)}
    onRetryFailed={() => void retryFailedUpload(state)}
    runCreating={state.manual.runCreating}
    runCreated={state.manual.runCreated}
    runError={state.manual.runError}
    onCreateRun={() => void handleCreateRun(state)}
    contextId={state.analysis.context?.id}
  />;
}

function UploadWizardView({ controller }: { controller: UploadWizardController }) {
  const { modeMeta, state } = controller;
  return <div className="max-w-3xl mx-auto flex flex-col gap-2">
    <FirstRunHint id="upload-intake">Drop <span className="text-white font-medium">all</span>{" "}of an issuer&apos;s deal documents at once — CP-0 classifies and dates each on ingest. Pick a run mode and the engine routes the matching modules.</FirstRunHint>
    <StepStrip step={state.navigation.step} selectedIssuer={state.selection.selectedIssuer} modeMeta={modeMeta} filesCount={state.intake.files.length} />
    <WizardError message={state.process.error} />
    <IssuerLoadStatus state={state} />
    <RejectedFilesWarning state={state} />
    <IssuerStage state={state} />
    <FileStage controller={controller} />
    <ResultStage controller={controller} />
  </div>;
}

export function UploadWizard({ initialIssuers = [] }: UploadWizardProps) {
  return <UploadWizardView controller={useUploadWizardController(initialIssuers)} />;
}
