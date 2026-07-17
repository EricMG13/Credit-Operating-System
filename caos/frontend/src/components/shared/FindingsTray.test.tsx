// @vitest-environment jsdom
// Locks the tray's unpin contract: archived findings never render, Unpin
// archives (not deletes) and removes the card, and an archive failure is
// surfaced with the card intact.
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AnalysisStateBadge, AuthorityLine, FindingsTray } from "./AnalysisWorkbench";
import { analysisApi, type Finding } from "@/lib/analysis-workbench";

vi.mock("@/lib/analysis-workbench", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analysis-workbench")>()),
  analysisApi: {
    listFindings: vi.fn(),
    archiveFinding: vi.fn(),
  },
}));

const finding = (over: Partial<Finding>): Finding => ({
  id: "f-1",
  context_id: "ctx-1",
  kind: "metric",
  title: "Net leverage deteriorated",
  body: "",
  source_surface: "query",
  source_run_id: null,
  status: "draft",
  evidence: {},
  authority: {
    origin: "live", method: "metric_facts", freshness: "current",
    approval_state: "draft", source_ids: ["d-1"], as_of: null, run_id: null,
  } as Finding["authority"],
  created_at: "2026-07-16T00:00:00Z",
  updated_at: "2026-07-16T00:00:00Z",
  ...over,
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("FindingsTray", () => {
  it("renders all state glyph families and optional authority metadata", () => {
    render(<>
      {['ready', 'error', 'running', 'queued', 'stale'].map((state) => <AnalysisStateBadge key={state} state={state} />)}
      <AuthorityLine authority={{
        origin: "live", method: "metric_facts", freshness: "current", approval_state: "draft",
        source_ids: [], as_of: "2026-07-17T00:00:00Z", run_id: "1234567890",
      } as never} />
      <AuthorityLine authority={{
        origin: "reference", method: "seeded", freshness: "unknown", approval_state: "unratified",
        source_ids: [], as_of: null, run_id: null,
      } as never} />
    </>);
    expect(screen.getByText("12345678", { exact: false })).toBeTruthy();
    expect(screen.getByText("reference")).toBeTruthy();
  });

  it("filters archived findings out of the tray and the count", async () => {
    vi.mocked(analysisApi.listFindings).mockResolvedValue([
      finding({ id: "f-1", title: "Active one" }),
      finding({ id: "f-2", title: "Archived one", status: "archived" }),
    ]);
    render(<FindingsTray contextId="ctx-1" />);
    expect(await screen.findByText("Active one")).toBeTruthy();
    expect(screen.queryByText("Archived one")).toBeNull();
    expect(screen.getByText("1 pinned")).toBeTruthy();
  });

  it("unpin archives the finding and removes the card", async () => {
    vi.mocked(analysisApi.listFindings).mockResolvedValue([finding({ id: "f-1", title: "Pinned card" })]);
    vi.mocked(analysisApi.archiveFinding).mockResolvedValue(finding({ id: "f-1", status: "archived" }));
    render(<FindingsTray contextId="ctx-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Unpin finding: Pinned card" }));
    await waitFor(() => expect(screen.queryByText("Pinned card")).toBeNull());
    expect(analysisApi.archiveFinding).toHaveBeenCalledWith("f-1");
    expect(screen.getByText("0 pinned")).toBeTruthy();
  });

  it("keeps the card and surfaces an alert when archiving fails", async () => {
    vi.mocked(analysisApi.listFindings).mockResolvedValue([finding({ id: "f-1", title: "Sticky card" })]);
    vi.mocked(analysisApi.archiveFinding).mockRejectedValue(new Error("429"));
    render(<FindingsTray contextId="ctx-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Unpin finding: Sticky card" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Unpin failed"));
    expect(screen.getByText("Sticky card")).toBeTruthy();
  });

  it("renders an optional finding body", async () => {
    vi.mocked(analysisApi.listFindings).mockResolvedValue([finding({ body: "Supporting detail" })]);
    render(<FindingsTray contextId="ctx-1" />);
    expect(await screen.findByText("Supporting detail")).toBeTruthy();
  });
});
