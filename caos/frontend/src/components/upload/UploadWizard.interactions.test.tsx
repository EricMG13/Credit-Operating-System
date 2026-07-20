// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { FileRejection } from "react-dropzone";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisContext } from "@/lib/analysis-workbench";
import type { EdgarVaultResult } from "@/lib/api";
import type { Issuer } from "@/types/issuers";

type StepStripProps = ComponentProps<(typeof import("@/components/upload/steps"))["StepStrip"]>;
type IssuerStepProps = ComponentProps<(typeof import("@/components/upload/steps"))["IssuerStep"]>;
type FileStepProps = ComponentProps<(typeof import("@/components/upload/steps"))["FileStep"]>;
type ResultStepProps = ComponentProps<(typeof import("@/components/upload/steps"))["ResultStep"]>;

const harness = vi.hoisted(() => {
  const context: AnalysisContext = {
    id: "context-upload",
    revision: 1,
    name: "Document intake",
    sector_id: null,
    sub_segments: [],
    issuer_ids: [],
    instrument_ids: [],
    portfolio_scope: null,
    as_of: null,
    sector_review_run_id: null,
    rv_snapshot_id: null,
    rv_run_id: null,
    query_session_id: null,
    artifacts: {
      issuer_run_id: null,
      source_manifest_id: null,
      research_job_id: null,
      model_checkpoint_id: null,
      report_version_id: null,
      alert_event_id: null,
      sponsor_id: null,
    },
    surface_state: {},
    filters: {},
    selected: {},
    created_at: "2026-07-14T00:00:00Z",
    updated_at: "2026-07-14T00:00:00Z",
  };
  return {
    context,
    issuerParam: null as string | null,
    analysisContext: context as AnalysisContext | null,
    drop: null as null | ((accepted: File[], rejected: FileRejection[]) => void),
    edgarVaulted: null as null | ((vaulted: EdgarVaultResult) => void),
    fileProps: null as FileStepProps | null,
    resultProps: null as ResultStepProps | null,
    patch: vi.fn(),
    push: vi.fn(),
    createIssuer: vi.fn(),
    createRun: vi.fn(),
    getIssuers: vi.fn(),
    getPortfolios: vi.fn(),
    uploadDocument: vi.fn(),
    uploadPricingSheet: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => harness.issuerParam }),
  useRouter: () => ({ push: harness.push }),
}));

vi.mock("react-dropzone", () => ({
  useDropzone: ({ onDrop }: { onDrop: (accepted: File[], rejected: FileRejection[]) => void }) => {
    harness.drop = onDrop;
    return { getRootProps: () => ({}), getInputProps: () => ({}), isDragActive: false };
  },
}));

vi.mock("@/lib/analysis-workbench", () => ({
  useAnalysisContext: () => ({ context: harness.analysisContext, patch: harness.patch }),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  appendIngestionContext: vi.fn(),
  createIssuer: harness.createIssuer,
  createRun: harness.createRun,
  getIssuers: harness.getIssuers,
  getPortfolios: harness.getPortfolios,
  toErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
  uploadDocument: harness.uploadDocument,
  uploadPricingSheet: harness.uploadPricingSheet,
}));

vi.mock("@/components/shared/FirstRunHint", () => ({
  FirstRunHint: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/pipeline/atoms", () => ({ Dot: () => <span>dot</span> }));
vi.mock("@/components/upload/EdgarImport", () => ({
  EdgarImport: ({ onVaulted }: { onVaulted: (vaulted: EdgarVaultResult) => void }) => {
    harness.edgarVaulted = onVaulted;
    return <div>EDGAR import</div>;
  },
}));

vi.mock("@/components/upload/steps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/upload/steps")>();
  return {
    ...actual,
    StepStrip: ({ step }: StepStripProps) => <div>STEP {step}</div>,
    IssuerStep: (props: IssuerStepProps) => (
      <div>
        <input aria-label="Issuer search" value={props.issuerQuery} onChange={(event) => props.setIssuerQuery(event.target.value)} />
        {props.issuers.map((issuer) => <button key={issuer.id} onClick={() => props.onSelectIssuer(issuer)}>Pick {issuer.name}</button>)}
        <button onClick={() => props.setShowNewIssuer(!props.showNewIssuer)}>Toggle new issuer</button>
        {props.showNewIssuer ? <>
          <input aria-label="New issuer name" value={props.newIssuerName} onChange={(event) => props.setNewIssuerName(event.target.value)} />
          <input aria-label="New issuer ticker" value={props.newIssuerTicker} onChange={(event) => props.setNewIssuerTicker(event.target.value)} />
          <button onClick={props.onCreateIssuer}>Create issuer</button>
        </> : null}
      </div>
    ),
    FileStep: (props: FileStepProps) => {
      harness.fileProps = props;
      return (
        <div>
          {props.files.map((file: File) => <button key={`${file.name}-${file.size}`} onClick={() => props.onRemoveFile(file)}>Remove {file.name}</button>)}
          <select aria-label="Run mode" value={props.runMode} onChange={(event) => props.setRunMode(event.target.value)}><option value="full">Full</option><option value="rapid">Rapid</option></select>
          <select aria-label="Origin" value={props.origin} onChange={(event) => {
            const value = event.target.value;
            if (value === "live" || value === "reference" || value === "demo") props.setOrigin(value);
          }}><option value="live">Live</option><option value="reference">Reference</option></select>
          <select aria-label="Method" value={props.method} onChange={(event) => {
            const value = event.target.value;
            if (value === "reported" || value === "derived" || value === "modelled") props.setMethod(value);
          }}><option value="reported">Reported</option><option value="derived">Derived</option></select>
          <select aria-label="Portfolio" value={props.portfolioId} onChange={(event) => props.setPortfolioId?.(event.target.value)}><option value="">Auto</option>{props.portfolios?.map((portfolio) => <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>)}</select>
          <button onClick={props.onUpload}>Upload staged files</button>
          <button onClick={props.onCancel}>Cancel upload</button>
          <button onClick={props.onBack}>Back to issuers</button>
          {props.progress ? <span>{props.progress.index}/{props.progress.total} {props.progress.name}</span> : null}
        </div>
      );
    },
    ResultStep: (props: ResultStepProps) => {
      harness.resultProps = props;
      return <div>
        <span>RESULT {props.okCount} OK {props.failCount} FAIL {props.totalChunks} CHUNKS</span>
        {props.outcomes.map((outcome) => <div key={outcome.name}>{outcome.name}: {outcome.result ? "vaulted" : outcome.error}</div>)}
        <span>{props.runOutcome?.state ?? "no run outcome"}</span>
        <span>{props.runError}</span>
        <span>{props.runCreated?.id ?? "no manual run"}</span>
        <button onClick={props.onRetryFailed}>Retry failed</button>
        <button onClick={props.onReset}>Reset wizard</button>
        <button onClick={props.onCreateRun}>Create manual run</button>
      </div>;
    },
  };
});

import { UploadWizard } from "./UploadWizard";

const issuerA = { id: "issuer-a", name: "Alpha Credit", ticker: "ALFA" };
const issuerB = { id: "issuer-b", name: "Beta Credit", ticker: "BETA" };
const uploadResult = (name: string, chunks = 2) => ({
  document_id: `document-${name}`,
  issuer_id: "issuer-a",
  minio_key: `vault/${name}`,
  chunks_created: chunks,
  message: "vaulted",
  source_manifest_id: `manifest-${name}`,
});

function scopedContext(body: Partial<AnalysisContext> = {}): AnalysisContext {
  return {
    ...harness.context,
    ...body,
    artifacts: { ...harness.context.artifacts, ...(body.artifacts ?? {}) },
    surface_state: { ...harness.context.surface_state, ...(body.surface_state ?? {}) },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  harness.issuerParam = null;
  harness.analysisContext = harness.context;
  harness.drop = null;
  harness.edgarVaulted = null;
  harness.fileProps = null;
  harness.resultProps = null;
  harness.context.issuer_ids = [];
  harness.context.surface_state = {};
  harness.patch.mockImplementation(async (body: Partial<AnalysisContext>) => scopedContext(body));
  harness.getIssuers.mockResolvedValue([]);
  harness.getPortfolios.mockResolvedValue([{ id: "portfolio-1", name: "Credit Fund", kind: "fund" }]);
  harness.createRun.mockResolvedValue({ id: "run-auto", status: "queued" });
  harness.uploadDocument.mockResolvedValue(uploadResult("pdf"));
  harness.uploadPricingSheet.mockResolvedValue(uploadResult("xlsx"));
  Object.defineProperty(globalThis.crypto, "randomUUID", { configurable: true, value: vi.fn(() => "upload-idempotency-key") });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("UploadWizard interactions", () => {
  it("deduplicates staged files and rejected warnings, supports removal/back, and clears intake only when the issuer changes", async () => {
    harness.getPortfolios.mockRejectedValueOnce(new Error("portfolio directory offline"));
    render(<UploadWizard initialIssuers={[issuerA, issuerB]} />);
    fireEvent.click(screen.getByRole("button", { name: "Pick Alpha Credit" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload staged files" }));
    expect(screen.getByText("STEP file")).toBeTruthy();
    const pdf = new File(["pdf"], "terms.pdf", { type: "application/pdf" });
    const rejected: FileRejection = { file: new File(["docx"], "side-letter.docx"), errors: [] };
    const rejectedTwo: FileRejection = { file: new File(["tif"], "scan.tif"), errors: [] };

    act(() => harness.drop?.([pdf], [rejected, rejectedTwo]));
    act(() => harness.drop?.([pdf], [rejected, rejectedTwo]));
    expect(screen.getAllByRole("button", { name: "Remove terms.pdf" })).toHaveLength(1);
    const dismiss = screen.getByRole("button", { name: "Dismiss skipped-files warning" });
    expect(dismiss.parentElement?.textContent).toContain("2 files skipped");
    expect(dismiss.parentElement?.textContent).toContain("side-letter.docx");
    expect(dismiss.parentElement?.textContent).toContain("scan.tif");
    fireEvent.click(dismiss);
    expect(screen.queryByText(/file skipped/)).toBeNull();
    act(() => harness.drop?.([], [rejected]));
    expect(screen.getByRole("button", { name: "Dismiss skipped-files warning" }).parentElement?.textContent)
      .toContain("1 file skipped");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss skipped-files warning" }));

    fireEvent.click(screen.getByRole("button", { name: "Back to issuers" }));
    fireEvent.click(screen.getByRole("button", { name: "Pick Alpha Credit" }));
    expect(screen.getByRole("button", { name: "Remove terms.pdf" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove terms.pdf" }));
    expect(screen.queryByRole("button", { name: "Remove terms.pdf" })).toBeNull();
    act(() => harness.drop?.([pdf], []));
    fireEvent.click(screen.getByRole("button", { name: "Back to issuers" }));
    fireEvent.click(screen.getByRole("button", { name: "Pick Beta Credit" }));
    expect(screen.queryByRole("button", { name: "Remove terms.pdf" })).toBeNull();
  });

  it("guards issuer creation against a same-tick duplicate and reports creation failures", async () => {
    const pending = deferred<Issuer>();
    harness.createIssuer.mockReturnValueOnce(pending.promise).mockRejectedValueOnce(new Error("issuer create offline"));
    const first = render(<UploadWizard initialIssuers={[issuerA]} />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle new issuer" }));
    fireEvent.change(screen.getByLabelText("New issuer name"), { target: { value: "New Credit" } });
    const create = screen.getByRole("button", { name: "Create issuer" });
    fireEvent.click(create);
    fireEvent.click(create);
    expect(harness.createIssuer).toHaveBeenCalledTimes(1);
    expect(harness.createIssuer).toHaveBeenCalledWith({ name: "New Credit", ticker: null });
    await act(async () => pending.resolve({ id: "issuer-new", name: "New Credit", ticker: null }));
    expect(await screen.findByRole("button", { name: "Pick New Credit" })).toBeTruthy();
    expect(screen.queryByLabelText("New issuer name")).toBeNull();
    first.unmount();

    render(<UploadWizard initialIssuers={[issuerA]} />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle new issuer" }));
    fireEvent.change(screen.getByLabelText("New issuer name"), { target: { value: "Broken Credit" } });
    fireEvent.change(screen.getByLabelText("New issuer ticker"), { target: { value: "BRK" } });
    fireEvent.click(screen.getByRole("button", { name: "Create issuer" }));
    expect(await screen.findByText("issuer create offline")).toBeTruthy();
  });

  it("uploads PDF and XLSX sequentially, retries only failures, queues one exact run, and resets", async () => {
    harness.uploadPricingSheet.mockRejectedValueOnce(new Error("pricing upload failed")).mockResolvedValueOnce(uploadResult("xlsx", 3));
    render(<UploadWizard initialIssuers={[issuerA]} />);
    fireEvent.click(screen.getByRole("button", { name: "Pick Alpha Credit" }));
    await screen.findByRole("option", { name: "Credit Fund" });
    fireEvent.change(screen.getByLabelText("Run mode"), { target: { value: "rapid" } });
    fireEvent.change(screen.getByLabelText("Origin"), { target: { value: "reference" } });
    fireEvent.change(screen.getByLabelText("Method"), { target: { value: "derived" } });
    fireEvent.change(screen.getByLabelText("Portfolio"), { target: { value: "portfolio-1" } });
    const pdf = new File(["pdf"], "memo.pdf", { type: "application/pdf" });
    const xlsx = new File(["xlsx"], "pricing.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    act(() => harness.drop?.([pdf, xlsx], []));

    fireEvent.click(screen.getByRole("button", { name: "Upload staged files" }));
    await waitFor(() => expect(harness.createRun).toHaveBeenCalledWith(
      "issuer-a", undefined, "portfolio-1", "upload-idempotency-key", "context-upload",
    ));
    expect(await screen.findByText("memo.pdf: vaulted")).toBeTruthy();
    expect(screen.getByText("pricing.xlsx: pricing upload failed")).toBeTruthy();
    expect(screen.getByText("RESULT 1 OK 1 FAIL 2 CHUNKS")).toBeTruthy();
    expect(harness.push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Retry failed" }));
    expect(await screen.findByText("RESULT 2 OK 0 FAIL 5 CHUNKS")).toBeTruthy();
    expect(harness.uploadDocument).toHaveBeenCalledTimes(1);
    expect(harness.uploadPricingSheet).toHaveBeenCalledTimes(2);
    expect(harness.createRun).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Reset wizard" }));
    expect(screen.getByText("STEP issuer")).toBeTruthy();
    expect(screen.queryByText("memo.pdf: vaulted")).toBeNull();
  });

  it("reports already-active runs and keeps the idempotency key across ambiguous failures", async () => {
    harness.createRun.mockRejectedValueOnce({ response: { status: 409 } });
    render(<UploadWizard initialIssuers={[issuerA]} />);
    fireEvent.click(screen.getByRole("button", { name: "Pick Alpha Credit" }));
    act(() => harness.drop?.([new File(["pdf"], "active.pdf", { type: "application/pdf" })], []));
    fireEvent.click(screen.getByRole("button", { name: "Upload staged files" }));
    expect(await screen.findByText("active")).toBeTruthy();
    expect(harness.push).not.toHaveBeenCalled();
  });

  it("keeps exact execution links when source or run context linking fails", async () => {
    harness.patch.mockImplementation(async (body: Partial<AnalysisContext>) => {
      if (body.artifacts?.source_manifest_id) throw new Error("source context offline");
      if (body.artifacts?.issuer_run_id) throw new Error("run context offline");
      return scopedContext(body);
    });
    render(<UploadWizard initialIssuers={[issuerA]} />);
    fireEvent.click(screen.getByRole("button", { name: "Pick Alpha Credit" }));
    act(() => harness.drop?.([new File(["pdf"], "linked.pdf", { type: "application/pdf" })], []));
    fireEvent.click(screen.getByRole("button", { name: "Upload staged files" }));

    expect(await screen.findByText(/Run queued, but the analysis context could not be linked/)).toBeTruthy();
    expect(harness.push).not.toHaveBeenCalled();
    expect(screen.getByText("linked.pdf: vaulted")).toBeTruthy();
  });

  it("cancels between files and blocks a re-entrant batch", async () => {
    const pending = deferred<ReturnType<typeof uploadResult>>();
    harness.uploadDocument.mockReturnValueOnce(pending.promise);
    render(<UploadWizard initialIssuers={[issuerA]} />);
    fireEvent.click(screen.getByRole("button", { name: "Pick Alpha Credit" }));
    act(() => harness.drop?.([
      new File(["pdf"], "first.pdf", { type: "application/pdf" }),
      new File(["pdf"], "second.pdf", { type: "application/pdf" }),
    ], []));

    act(() => {
      harness.fileProps?.onUpload();
      harness.fileProps?.onUpload();
    });
    await waitFor(() => expect(harness.uploadDocument).toHaveBeenCalledTimes(1));
    act(() => harness.fileProps?.onCancel());
    await act(async () => pending.resolve(uploadResult("first")));

    await waitFor(() => expect(screen.getByText("first.pdf: vaulted")).toBeTruthy());
    expect(harness.uploadDocument).toHaveBeenCalledTimes(1);
    expect(harness.createRun).not.toHaveBeenCalled();
  });

  it("deep-links an existing issuer and surfaces selection-context and manual-run failures", async () => {
    harness.issuerParam = "issuer-b";
    harness.patch
      .mockRejectedValueOnce(new Error("selection context offline"))
      .mockImplementation(async (body: Partial<AnalysisContext>) => {
        if (body.artifacts?.issuer_run_id) throw new Error("manual run context offline");
        return scopedContext(body);
      });
    render(<UploadWizard initialIssuers={[issuerA, issuerB]} />);
    expect(await screen.findByText("STEP file")).toBeTruthy();
    expect(await screen.findByText(/selected issuer could not be linked/)).toBeTruthy();

    act(() => harness.drop?.([new File(["pdf"], "manual.pdf", { type: "application/pdf" })], []));
    harness.createRun
      .mockRejectedValueOnce(new Error("automatic run offline"))
      .mockRejectedValueOnce(new Error("manual run offline"))
      .mockResolvedValueOnce({ id: "run-manual", status: "queued" });
    fireEvent.click(screen.getByRole("button", { name: "Upload staged files" }));
    expect(await screen.findByText("failed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create manual run" }));
    expect(await screen.findByText("manual run offline")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create manual run" }));
    expect(await screen.findByText(/Run queued, but the analysis context could not be linked/)).toBeTruthy();
    expect(harness.push).not.toHaveBeenCalled();
  });

  it("reuses an already-scoped issuer context without duplicating the issuer id", async () => {
    harness.context.issuer_ids = ["issuer-a"];
    harness.context.surface_state = { upload: { selected_ids: ["issuer-a"], view: "file" } };
    render(<UploadWizard initialIssuers={[issuerA]} />);
    fireEvent.click(screen.getByRole("button", { name: "Pick Alpha Credit" }));
    expect(await screen.findByText("STEP file")).toBeTruthy();
    expect(harness.patch).not.toHaveBeenCalled();
  });

  it("adopts each EDGAR vault once and preserves a captured result after reset", async () => {
    render(<UploadWizard initialIssuers={[issuerA]} />);
    fireEvent.click(screen.getByRole("button", { name: "Pick Alpha Credit" }));
    const firstVault = {
      document_id: "edgar-1",
      storage_key: "edgar/one",
      doc_type: "10-K",
      run_mode: "legal",
      chunks_created: 4,
      provenance: "SEC EDGAR",
      message: "10-K vaulted",
      warning: null,
    } satisfies EdgarVaultResult;

    act(() => {
      harness.edgarVaulted?.(firstVault);
      harness.edgarVaulted?.(firstVault);
    });
    expect(screen.getByText("RESULT 1 OK 0 FAIL 4 CHUNKS")).toBeTruthy();
    expect(screen.getAllByText("10-K vaulted: vaulted")).toHaveLength(1);

    const captured = harness.edgarVaulted;
    fireEvent.click(screen.getByRole("button", { name: "Reset wizard" }));
    act(() => captured?.({
      ...firstVault,
      document_id: "edgar-2",
      storage_key: "edgar/two",
      chunks_created: 1,
      message: "8-K vaulted",
    }));
    expect(screen.getByText("8-K vaulted: vaulted")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create manual run" }));
    expect(harness.createRun).not.toHaveBeenCalled();
  });

  it("uploads and queues without an analysis context and ignores a stale manual-run callback", async () => {
    harness.analysisContext = null;
    render(<UploadWizard initialIssuers={[issuerA]} />);
    fireEvent.click(screen.getByRole("button", { name: "Pick Alpha Credit" }));
    act(() => harness.drop?.([new File(["pdf"], "contextless.pdf", { type: "application/pdf" })], []));
    fireEvent.click(screen.getByRole("button", { name: "Upload staged files" }));

    expect(await screen.findByText("contextless.pdf: vaulted")).toBeTruthy();
    expect(harness.createRun).toHaveBeenCalledWith(
      "issuer-a", undefined, undefined, "upload-idempotency-key", undefined,
    );
    const staleCreateRun = harness.resultProps?.onCreateRun;
    fireEvent.click(screen.getByRole("button", { name: "Reset wizard" }));
    act(() => staleCreateRun?.());
    expect(harness.createRun).toHaveBeenCalledTimes(1);
  });

  it("ignores missing deep links and does not rewind an already-open file stage", async () => {
    harness.issuerParam = "missing-issuer";
    const view = render(<UploadWizard initialIssuers={[issuerA, issuerB]} />);
    expect(screen.getByText("STEP issuer")).toBeTruthy();

    harness.issuerParam = null;
    view.rerender(<UploadWizard initialIssuers={[issuerA, issuerB]} />);
    fireEvent.click(screen.getByRole("button", { name: "Pick Alpha Credit" }));
    expect(screen.getByText("STEP file")).toBeTruthy();

    harness.issuerParam = "issuer-b";
    view.rerender(<UploadWizard initialIssuers={[issuerA, issuerB]} />);
    await waitFor(() => expect(harness.fileProps?.selectedIssuer?.id).toBe("issuer-b"));
    expect(screen.getByText("STEP file")).toBeTruthy();
  });

  it("ignores issuer directory work that settles after unmount", async () => {
    const loaded = deferred<Issuer[]>();
    harness.getIssuers.mockReturnValueOnce(loaded.promise);
    const first = render(<UploadWizard />);
    first.unmount();
    await act(async () => loaded.resolve([issuerA]));

    const failed = deferred<Issuer[]>();
    harness.getIssuers.mockReturnValueOnce(failed.promise);
    const second = render(<UploadWizard />);
    second.unmount();
    await act(async () => {
      failed.resolve(Promise.reject(new Error("stale directory failure")) as never);
      await failed.promise.catch(() => undefined);
    });
  });
});
