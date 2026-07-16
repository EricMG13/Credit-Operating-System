// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReportsPage from "./page";
import { previewReportVersion, publishReportVersion } from "@/lib/api";

const patchContext = vi.fn().mockResolvedValue(undefined);
const liveOuts = {
  "CP-1": {
    kpis: [{ l: "Net leverage", v: "5.2x" }],
    sections: [{ type: "text" as const, title: "Credit view", body: "Live view" }],
  },
};
const liveStatus = { "CP-1": "Passed" };

vi.mock("next/navigation", () => ({
  usePathname: () => "/reports",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams({ issuer: "issuer-1" }),
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/charts/G2Chart", () => ({ G2Chart: () => null }));
vi.mock("@/lib/analysis-workbench", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analysis-workbench")>()),
  useAnalysisContext: () => ({
    context: {
      id: "context-1", name: "Report", issuer_ids: ["issuer-1"],
      instrument_ids: [], sub_segments: [], sector_id: null, portfolio_scope: null,
      as_of: null, sector_review_run_id: null, rv_snapshot_id: null, rv_run_id: null,
      query_session_id: null,
      artifacts: {
        issuer_run_id: "run-1", model_checkpoint_id: "checkpoint-1",
        source_manifest_id: "manifest-1", report_version_id: null,
        research_job_id: null, alert_event_id: null, sponsor_id: null,
      },
      surface_state: {}, filters: {}, selected: {},
      created_at: "2026-07-14T00:00:00Z", updated_at: "2026-07-14T00:00:00Z",
    },
    loading: false, error: null, patch: patchContext, replace: vi.fn(), refresh: vi.fn(),
  }),
}));
vi.mock("@/lib/engine/useLiveRun", () => ({
  useLiveRun: () => ({
    liveOuts, liveStatus, liveEvidence: {},
    runId: "run-1", asOf: "2026-06-30", committeeStatus: "Committee Ready",
    council: [], loading: false, phase: "complete",
  }),
}));
vi.mock("@/lib/engine/useModelEngine", () => ({
  useModelEngine: () => ({
    anchor: null, downside: null, downsideState: "unavailable", runId: "run-1", committeeStatus: "Committee Ready",
    live: true, loading: false, phase: "complete",
  }),
}));
vi.mock("@/lib/engine/useFreshness", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/engine/useFreshness")>()),
  useIssuerFreshness: () => ({
    issuer: null, run: null, context: null, issuerStatus: "idle", runStatus: "idle",
    contextStatus: "idle", contextRequested: false, loading: false,
    compatibilityUnavailable: false, error: false, unavailable: false,
  }),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  listReportVersions: vi.fn().mockResolvedValue([]),
  getReportDraft: vi.fn().mockResolvedValue(null),
  saveReportDraft: vi.fn().mockResolvedValue({ revision: 1 }),
  previewReportVersion: vi.fn(),
  publishReportVersion: vi.fn(),
}));

const preview = {
  id: `preview-${"a".repeat(64)}`,
  status: "preview" as const,
  context_id: "context-1",
  run_id: "run-1",
  model_checkpoint_id: "checkpoint-1",
  thesis_version_id: null,
  document_sha256: "a".repeat(64),
  preview_sha256: "a".repeat(64),
  authority: { approval_state: "preview", model_origin: "imported" },
  created_at: "2026-07-14T00:00:00Z",
  payload: {
    composition: { reviewed_report: {
      id: "live-committee-pack", title: "Live IC Credit Memo", file: "issuer-1-memo",
      subtitle: "issuer-1 · run run-1", icon: "document", srcs: [],
      sections: [{ t: "profile", title: "FROZEN ANALYSIS ENVELOPE", rows: [["Run", "run-1"]] }],
    } },
    model: {
      engine_version: "2.0.0", source_fingerprint: "source", input_fingerprint: "input",
      calculation_hash: "calculation", draft_revision: 3,
      authority: { origin: "imported", model_input_origins: ["imported"], analyst_override: false },
      calculation: { status: "partial", gaps: ["Debt schedule required"], warnings: [], periods: [{
        period_key: "FY2026", label: "FY26e", adjusted_ebitda: 110, total_debt: null,
        instruments: [],
      }] },
    },
  },
};
const reviewedPreview = {
  ...preview,
  id: `preview-${"b".repeat(64)}`,
  preview_sha256: "b".repeat(64),
  document_sha256: "b".repeat(64),
  payload: {
    ...preview.payload,
    composition: { reviewed_report: {
      ...preview.payload.composition.reviewed_report,
      sections: [],
    } },
  },
};

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe("Report Studio frozen publication preview", () => {
  it("requires the exact server preview before publishing its hash", async () => {
    vi.mocked(previewReportVersion)
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce(reviewedPreview);
    vi.mocked(publishReportVersion).mockResolvedValue({
      ...reviewedPreview, id: "version-1", status: "published", document_sha256: reviewedPreview.preview_sha256,
    });
    localStorage.setItem("caos-e-edits", JSON.stringify({
      [preview.id]: { "s1.r0.v": "TAMPERED MODEL" },
    }));
    localStorage.setItem("caos-e-omit", JSON.stringify({
      [preview.id]: { "2": true },
    }));
    render(<ReportsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Review frozen preview" }));
    await waitFor(() => expect(previewReportVersion).toHaveBeenCalledTimes(1));
    expect((await screen.findAllByText("Debt schedule required")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("IMPORTED")).length).toBeGreaterThan(0);
    expect(screen.queryByText("TAMPERED MODEL")).toBeNull();
    expect(screen.getByRole("button", { name: "Publish reviewed preview" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open Report utilities" }));
    expect((screen.getByRole("button", { name: "Print / save PDF" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "EDIT DOCUMENT" }));
    expect(screen.getByRole("textbox", { name: "Edit report field s0.r0.v" })).not.toBeNull();
    expect(screen.queryByRole("textbox", { name: "Edit report field s1.r0.v" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "SOURCES" }));

    fireEvent.click(screen.getByRole("button", { name: /FROZEN ANALYSIS ENVELOPE/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Review editorial changes" }));
    await waitFor(() => expect(previewReportVersion).toHaveBeenCalledTimes(2));
    expect(vi.mocked(previewReportVersion).mock.calls[1][0].payload).toMatchObject({
      omit: { "0": true },
      show_sources: false,
    });
    expect(screen.queryByRole("button", { name: /FROZEN ANALYSIS ENVELOPE/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Publish reviewed preview" }));
    await waitFor(() => expect(publishReportVersion).toHaveBeenCalledWith(expect.objectContaining({
      context_id: "context-1",
      run_id: "run-1",
      model_checkpoint_id: "checkpoint-1",
      preview_sha256: reviewedPreview.preview_sha256,
    })));
    await waitFor(() => expect(
      (screen.getByRole("button", { name: "Print / save PDF" }) as HTMLButtonElement).disabled,
    ).toBe(false));
  });
});
