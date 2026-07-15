// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnalysisContext } from "@/lib/analysis-workbench";

const harness = vi.hoisted(() => {
  const context = {
    id: "context-1",
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
    created_at: "2026-07-13T00:00:00Z",
    updated_at: "2026-07-13T00:00:00Z",
  } satisfies AnalysisContext;
  const patch = vi.fn();
  const push = vi.fn();
  return {
    context,
    patch,
    push,
    analysis: { context, patch },
    createRun: vi.fn(),
    uploadDocument: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
  useRouter: () => ({ push: harness.push }),
}));

vi.mock("react-dropzone", () => ({
  useDropzone: ({ onDrop }: { onDrop: (files: File[], rejected: never[]) => void }) => ({
    getRootProps: () => ({}),
    getInputProps: () => ({
      type: "file",
      onChange: (event: { target: { files: FileList | File[] } }) =>
        onDrop(Array.from(event.target.files), []),
    }),
    isDragActive: false,
  }),
}));

vi.mock("@/lib/analysis-workbench", () => ({
  useAnalysisContext: () => harness.analysis,
}));

vi.mock("@/lib/api", () => ({
  appendIngestionContext: vi.fn(),
  createIssuer: vi.fn(),
  createRun: harness.createRun,
  getIssuers: vi.fn().mockResolvedValue([]),
  getPortfolios: vi.fn().mockResolvedValue([]),
  toErrorMessage: (_error: unknown, fallback: string) => fallback,
  uploadDocument: harness.uploadDocument,
  uploadPricingSheet: vi.fn(),
}));

vi.mock("@/components/shared/FirstRunHint", () => ({
  FirstRunHint: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/upload/EdgarImport", () => ({ EdgarImport: () => null }));
vi.mock("@/components/shared/IssuerProfileOverlay", () => ({
  useIssuerProfileOverlay: () => ({ openProfile: vi.fn() }),
}));

import { UploadWizard } from "./UploadWizard";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("UploadWizard manual run context ordering", () => {
  it("does not create the run until the issuer-scope patch resolves", async () => {
    let resolveScope: (context: AnalysisContext) => void = () => undefined;
    let issuerScopeCalls = 0;
    harness.patch.mockImplementation((body: Partial<AnalysisContext>) => {
      // Selection/view synchronization is intentionally fire-and-forget and is
      // unrelated to the manual-run gate. Only the issuer-only scope patch is
      // deferred so this test exercises handleCreateRun's awaited dependency.
      if (body.issuer_ids && !body.surface_state) {
        issuerScopeCalls += 1;
        if (issuerScopeCalls === 1) {
          // The failed batch must first reach the result surface. Its own scope
          // gate resolves normally; the second call is the manual-run gate.
          return Promise.resolve({ ...harness.context, issuer_ids: body.issuer_ids });
        }
        return new Promise<AnalysisContext>((resolve) => { resolveScope = resolve; });
      }
      return Promise.resolve({ ...harness.context, ...body });
    });
    harness.uploadDocument.mockResolvedValue({
      document_id: "document-1",
      issuer_id: "issuer-1",
      minio_key: "vault/document-1",
      chunks_created: 1,
      message: "vaulted",
      source_manifest_id: "manifest-1",
    });
    // A successful batch automatically attempts a run. Fail that attempt so
    // the real ResultStep exposes its manual retry control, then reset the spy
    // to isolate the manual interaction under test.
    harness.createRun.mockRejectedValueOnce(new Error("automatic queue failed"));

    const { container } = render(<UploadWizard initialIssuers={[
      { id: "issuer-1", name: "Acme Credit", ticker: "ACME" },
    ]} />);
    fireEvent.click(screen.getByRole("button", { name: /Acme Credit/i }));

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input!, {
      target: { files: [new File(["pdf"], "failed.pdf", { type: "application/pdf" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: /UPLOAD 1 FILE & PROCESS/i }));

    const manualRun = await screen.findByRole("button", {
      name: /RUN FULL IC COMMITTEE/i,
    });
    expect(harness.createRun).toHaveBeenCalledTimes(1);
    harness.createRun.mockClear();
    harness.createRun.mockResolvedValue({ id: "run-1", status: "queued" });
    fireEvent.click(manualRun);
    await waitFor(() => expect(harness.patch).toHaveBeenCalledWith({
      issuer_ids: ["issuer-1"],
    }));
    expect(harness.createRun).not.toHaveBeenCalled();

    const scoped = { ...harness.context, issuer_ids: ["issuer-1"] };
    await act(async () => { resolveScope(scoped); });

    await waitFor(() => expect(harness.createRun).toHaveBeenCalledTimes(1));
    expect(harness.createRun).toHaveBeenCalledWith(
      "issuer-1", undefined, undefined, undefined, "context-1",
    );
    await waitFor(() => expect(harness.push).toHaveBeenCalledWith(
      "/pipeline?issuer=issuer-1&run=run-1&view=graph&context=context-1",
    ));
  });
});
