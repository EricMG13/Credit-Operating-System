// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const getRVScreen = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ usePathname: () => "/sector-rv" }));
vi.mock("@/components/shared/RequireAuth", () => ({ RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/analysis-workbench", () => ({
  useAnalysisContext: () => ({
    context: { id: "context-rv", name: "Telecom RV", sector_id: "telecom", rv_run_id: "rv-1", filters: {}, selected: {} },
    setContext: vi.fn(), patch: vi.fn(), loading: false, error: null,
  }),
  contextHref: (path: string, id: string) => `${path}?context=${id}`,
  analysisApi: { getRVScreen, listFindings: vi.fn().mockResolvedValue([]), createRVScreen: vi.fn(), createFinding: vi.fn(), ratifyRVCandidate: vi.fn() },
}));

import SectorRvPage from "./page";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Sector RV gated decision header", () => {
  it("shows the selected exact instrument and reference authority without an actionable label", async () => {
    getRVScreen.mockResolvedValue({
      id: "rv-1", context_id: "context-rv", snapshot_id: "snapshot-1", status: "ready", filters: {},
      authority: { origin: "reference", method: "CP-6E gated-screen-v2", freshness: "current", as_of: "2026-07-06T00:00:00Z", source_ids: ["snapshot-1"], run_id: "rv-1", version_id: null, confidence: null, approval_state: "draft", analyst_override: null },
      candidates: [{ id: "candidate-1", instrument_id: "instrument-1", instrument_key: "FIGI-1:0", figi: "FIGI-1", borrower: "Reference Telecom", rank: 1, classification: "screen-only", recommendation: "Screen only", missing_gates: ["live market origin", "recovery evidence"], market: { dm: 655, bid: 97, ask: 98, ranking: "1L", maturity: "2028" }, pitch: { market_relative_value: { dm_pickup_bps: 38 }, instrument_mispricing: { recovery: null }, portfolio_implementation: { held: false } }, evidence: {}, portfolio_impact: {}, ratified_at: null }],
      counts: { actionable: 0, "screen-only": 1, unavailable: 0 }, missing_dependencies: [], created_at: "2026-07-13T09:00:00Z", updated_at: "2026-07-13T09:00:00Z",
    });
    render(<SectorRvPage />);
    const header = await screen.findByLabelText("Decision header");
    expect(header.textContent).toContain("Reference Telecom");
    expect(header.textContent).toContain("REFERENCE");
    expect(header.textContent).toContain("DERIVED");
    expect(header.textContent).toContain("Resolve missing gates");
    expect(header.textContent).not.toContain("Add");
  });
});
