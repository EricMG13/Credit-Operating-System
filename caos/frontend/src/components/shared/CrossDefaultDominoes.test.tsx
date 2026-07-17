// @vitest-environment jsdom
// Cross-default dominoes (WP-4 G13) — shared by Issuer Profile and Deep-
// Dive's Covenants tab, so both read the identical live map. Locks: no run →
// nothing rendered; a genuine fetch failure → explicit error (never silent);
// no threshold/tranches → the server's own honest note; a real map →
// tripped tranches labeled distinctly from untripped/non-computable ones,
// never by color alone, with the pulled-in tranches actually listed.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { CrossDefaultDominoes } from "./CrossDefaultDominoes";
import { getCrossDefaultMap } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getCrossDefaultMap: vi.fn(),
}));

const mockGetCrossDefaultMap = vi.mocked(getCrossDefaultMap);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CrossDefaultDominoes", () => {
  it("renders nothing when there is no completed run — never fetches", () => {
    const { container } = render(<CrossDefaultDominoes issuerId="i1" hasRun={false} />);
    expect(container.firstChild).toBeNull();
    expect(mockGetCrossDefaultMap).not.toHaveBeenCalled();
  });

  it("shows an explicit error on a genuine fetch failure, not silent nothing", async () => {
    mockGetCrossDefaultMap.mockRejectedValue(new Error("network error"));
    render(<CrossDefaultDominoes issuerId="i1" hasRun={true} />);
    await waitFor(() => expect(screen.getByText("Couldn’t load cross-default data.")).toBeTruthy());
  });

  it("shows the server's own honest note when no threshold/tranches were extracted — never a guessed map", async () => {
    mockGetCrossDefaultMap.mockResolvedValue({
      issuer_id: "i1", run_id: "r1", threshold_musd: null, dominoes: [],
      note: "No material-indebtedness threshold extracted for this run.",
    });
    render(<CrossDefaultDominoes issuerId="i1" hasRun={true} />);
    await waitFor(() => expect(screen.getByText("No material-indebtedness threshold extracted for this run.")).toBeTruthy());
  });

  it("uses the generic empty-map note when the server supplied none", async () => {
    mockGetCrossDefaultMap.mockResolvedValue({
      issuer_id: "i1", run_id: "r1", threshold_musd: null, dominoes: [], note: null,
    });
    render(<CrossDefaultDominoes issuerId="i1" hasRun />);
    expect(await screen.findByText("No domino map for this run.")).toBeTruthy();
  });

  it("formats billion-scale values and singular pulled-in tranche labels", async () => {
    mockGetCrossDefaultMap.mockResolvedValue({
      issuer_id: "i1", run_id: "r1", threshold_musd: 1500,
      dominoes: [{
        code: "TLB", tranche: "Term Loan B", amount_musd: 2100,
        trips_cross_default: true, pulls_in: ["RCF"],
      }],
      note: null,
    });
    render(<CrossDefaultDominoes issuerId="i1" hasRun />);

    expect(await screen.findByText("trips ≥ $1.5bn")).toBeTruthy();
    expect(screen.getByText("$2.1bn")).toBeTruthy();
    expect(screen.getByText("⚠ pulls in 1 tranche")).toBeTruthy();
  });

  it("renders a computable map: threshold header, tripped tranches with the pulled-in list, untripped and non-computable rows distinct from tripped ones", async () => {
    mockGetCrossDefaultMap.mockResolvedValue({
      issuer_id: "i1", run_id: "r1", threshold_musd: 50,
      dominoes: [
        { code: "RCF", tranche: "$85M Revolver due 2028", amount_musd: 85, trips_cross_default: true, pulls_in: ["2L-A", "2L-B"] },
        { code: "TLB", tranche: "$620M Term Loan B", amount_musd: 620, trips_cross_default: false, pulls_in: [] },
        { code: "SUB", tranche: "Subordinated notes", amount_musd: null, trips_cross_default: null, pulls_in: [] },
      ],
      note: null,
    });
    render(<CrossDefaultDominoes issuerId="i1" hasRun={true} />);

    await waitFor(() => expect(screen.getByText("RCF")).toBeTruthy());
    expect(screen.getByText("trips ≥ $50m")).toBeTruthy();
    expect(screen.getByText("⚠ pulls in 2 tranches")).toBeTruthy();
    expect(screen.getByText("2L-A")).toBeTruthy(); // pulled-in chip, not just the count
    expect(screen.getByText("2L-B")).toBeTruthy();
    expect(screen.getByText("— below threshold")).toBeTruthy();
    expect(screen.getByText("◦ not computable")).toBeTruthy();
    expect(screen.getByText("unsized")).toBeTruthy(); // SUB has no amount_musd
  });
});
