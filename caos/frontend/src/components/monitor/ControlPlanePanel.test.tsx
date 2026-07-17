// @vitest-environment jsdom
// Coverage Control Plane (WP-4 G14) — ingestion-side health, live over the
// same Document/DocumentChunk rows GET /api/digest/ingestion-gaps reads.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { ControlPlanePanel } from "./ControlPlanePanel";
import { getIngestionGaps } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getIngestionGaps: vi.fn(),
}));

const mockGetIngestionGaps = vi.mocked(getIngestionGaps);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ControlPlanePanel", () => {
  it("shows an honest all-clear in both categories when there are no gaps", async () => {
    mockGetIngestionGaps.mockResolvedValue({ as_of: "2026-07-12T00:00:00Z", truncated: false, zero_chunk: [], ocr_lane: [], coverage: [] });
    render(<ControlPlanePanel />);
    await waitFor(() => expect(screen.getByText(/every vaulted source produced usable text/)).toBeTruthy());
    expect(screen.getByText(/every extraction used a native text layer/)).toBeTruthy();
  });

  it("shows an explicit error on a genuine fetch failure, not silent nothing", async () => {
    mockGetIngestionGaps.mockRejectedValue(new Error("network error"));
    render(<ControlPlanePanel />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  });

  it("renders zero-chunk and OCR-lane rows in their own distinctly labeled categories", async () => {
    mockGetIngestionGaps.mockResolvedValue({
      as_of: "2026-07-12T00:00:00Z",
      truncated: false,
      zero_chunk: [{
        document_id: "d1", issuer_id: "i1", issuer_name: "Gap Co", file_name: "scanned.pdf",
        doc_type: "10-K", uploaded_at: "2026-07-01T00:00:00Z",
        detail: "No text extracted — vaulted but unusable by any module.",
      }],
      ocr_lane: [{
        document_id: "d2", issuer_id: "i2", issuer_name: "OCR Co", file_name: "faxed.pdf",
        doc_type: "credit-agreement", uploaded_at: "2026-07-02T00:00:00Z",
        detail: "Extracted via OCR — lower-fidelity than a native text layer.",
      }],
      coverage: [{
        issuer_id: "i2", issuer_name: "OCR Co", analyst_owner: "a.lee",
        origins: ["NATIVE", "OCR"], document_count: 2,
      }],
    });
    render(<ControlPlanePanel />);

    await waitFor(() => expect(screen.getByText("Gap Co")).toBeTruthy());
    expect(screen.getByText("scanned.pdf")).toBeTruthy();
    expect(screen.getByText("NO TEXT")).toBeTruthy();
    expect(screen.getAllByText("OCR Co")).toHaveLength(2);
    expect(screen.getByText("faxed.pdf")).toBeTruthy();
    expect(screen.getAllByText("OCR")).toHaveLength(2);
    expect(screen.getByText("NATIVE")).toBeTruthy();
    expect(screen.getByText(/a\.lee · 2 docs/)).toBeTruthy();
  });

  it("labels truncated coverage and falls back to an unassigned owner", async () => {
    mockGetIngestionGaps.mockResolvedValue({
      as_of: "2026-07-17T00:00:00Z", truncated: true, zero_chunk: [], ocr_lane: [],
      coverage: [{
        issuer_id: "i1", issuer_name: "Ownerless Co", analyst_owner: null,
        origins: [], document_count: 1,
      }],
    });
    render(<ControlPlanePanel />);
    expect(await screen.findByText("PARTIAL · newest 2,000 documents only")).toBeTruthy();
    expect(screen.getByText("UNASSIGNED · 1 docs")).toBeTruthy();
  });
});

// Regression lock for the 2026-07-16 critique P1: a col-span-N class on any
// child of the single-column ingestion grid forces an implicit second column
// (computed `grid-template-columns: 0px <rest>`) and the cards render on top
// of each other. jsdom can't measure layout, so lock the class contract.
it("keeps the single-column ingestion grid free of col-span children", async () => {
  mockGetIngestionGaps.mockResolvedValue({ zero_chunk: [], ocr_lane: [], coverage: [], truncated: false, as_of: "2026-07-16T00:00:00Z" });
  const { container } = render(<ControlPlanePanel />);
  await waitFor(() => expect(container.querySelector(".grid.grid-cols-1")).toBeTruthy());
  const grid = container.querySelector(".grid.grid-cols-1")!;
  for (const child of Array.from(grid.children)) {
    expect(child.className).not.toMatch(/col-span/);
  }
});
