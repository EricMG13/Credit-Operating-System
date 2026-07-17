// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommandPortfolioPosition } from "@/lib/portfolio-lab";
import type { DailyDigest, PortfolioRowDTO } from "@/lib/api";

const mocks = vi.hoisted(() => ({
  getAutonomyDraft: vi.fn(),
  getAlertStates: vi.fn(),
  setAlertState: vi.fn(),
  openProfile: vi.fn(),
  openProfileByQuery: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getAutonomyDraft: (...args: unknown[]) => mocks.getAutonomyDraft(...args),
    getAlertStates: (...args: unknown[]) => mocks.getAlertStates(...args),
    setAlertState: (...args: unknown[]) => mocks.setAlertState(...args),
  };
});

vi.mock("@/components/shared/IssuerProfileOverlay", () => ({
  useIssuerProfileOverlay: () => ({
    openProfile: mocks.openProfile,
    openProfileByQuery: mocks.openProfileByQuery,
  }),
}));

import {
  CommandPortfolioPosture,
  CommandPortfolioTable,
  CommandPositionStrip,
} from "./CommandPortfolio";
import { DailyDigestPanel } from "./DailyDigestPanel";
import { GovernancePanel } from "./GovernancePanel";
import { LiveCoverage } from "./LiveCoverage";
import { RankedChanges } from "./RankedChanges";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const position: CommandPortfolioPosition = {
  id: "position-1",
  portfolio_id: "portfolio-1",
  issuer_id: "issuer-1",
  borrower_name: "Atlas Forge",
  ticker: "ATLF",
  figi: "BBG000000001",
  loan_name: "First Lien Term Loan B 2031",
  sector: "Industrials",
  sub_sector: "Machinery",
  ranking: "1L",
  rating_moody: "B2",
  rating_sp: "B",
  par_usd: 100_000_000,
  facility_musd: 500,
  margin_bps: 475,
  maturity: "2031-06-30",
  price: 98.5,
  ytm: 8.2,
  dm: 510,
  market_value: 98_500_000,
  created_at: "2026-07-15T00:00:00Z",
  posture: "OVERWEIGHT",
  run_id: "run-1",
  qa_status: "Passed",
  committee_status: "Committee Ready",
};

const liveRow = (overrides: Partial<PortfolioRowDTO> = {}): PortfolioRowDTO => ({
  issuer_id: "issuer-1",
  name: "Atlas Forge",
  ticker: "ATLF",
  sector: "Industrials",
  run_id: "run-1",
  qa_status: "Passed",
  committee_status: "Committee Ready",
  as_of: "2026-07-15",
  metrics: { net_leverage: 5.7, interest_coverage: 2.1 },
  rv_recommendation: "OVERWEIGHT",
  rv_percentile: 64,
  downside_fragility: "MODERATE",
  gaps: [],
  ...overrides,
});

describe("Current Command Center component contracts", () => {
  it("command-01 command-02 command-03 command-04 command-05 command-09 renders the persisted-position grid and posture semantics", () => {
    const onSelect = vi.fn();
    const posture = render(
      <CommandPortfolioPosture
        counts={{ OVERWEIGHT: 1, NEUTRAL: 0, UNDERWEIGHT: 0, UNKNOWN: 0 }}
        total={1}
        portfolioName="Credit Opportunities I"
      />,
    );
    expect(screen.getByRole("img", { name: "OVERWEIGHT 1, NEUTRAL 0, UNDERWEIGHT 0, UNKNOWN 0" })).toBeTruthy();
    expect(screen.getByText(/completed runs explicitly bound to this portfolio/i)).toBeTruthy();
    posture.unmount();

    render(<CommandPortfolioTable positions={[position]} selected={null} onSelect={onSelect} />);
    const grid = screen.getByRole("grid", { name: "Persisted portfolio positions" });
    expect(within(grid).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Ticker", "Company", "Instrument", "Size", "Price", "Margin", "Maturity", "Ratings", "Posture", "QA",
    ]);
    expect(within(grid).getByText("$100M")).toBeTruthy();
    expect(within(grid).getByText("475bp")).toBeTruthy();
    expect(within(grid).getByText("B2 / B")).toBeTruthy();
    expect(within(grid).getByText("OVERWEIGHT")).toBeTruthy();
    expect(within(grid).getByText("Passed")).toBeTruthy();

    const row = within(grid).getByRole("row", { name: /Atlas Forge position details/i });
    fireEvent.click(row);
    fireEvent.keyDown(row, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenLastCalledWith("position-1");

    onSelect.mockClear();
    fireEvent.click(within(grid).getByRole("link", { name: "ATLF" }));
    expect(mocks.openProfile).toHaveBeenCalledWith("issuer-1");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("command-06 command-07 command-08 exposes the selected-position strip, deep-dive handoff, and close action", () => {
    const onClose = vi.fn();
    render(<CommandPositionStrip position={position} onClose={onClose} />);

    expect(screen.getByText("First Lien Term Loan B 2031")).toBeTruthy();
    expect(screen.getByText("$100M")).toBeTruthy();
    expect(screen.getByText("98.5")).toBeTruthy();
    expect(screen.getByText("475bp")).toBeTruthy();
    expect(screen.getByText("OVERWEIGHT")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Deep-Dive" }).getAttribute("href"))
      .toBe("/deepdive?issuer=issuer-1&run=run-1");

    const close = screen.getByRole("button", { name: "Close" });
    expect(close.getAttribute("title")).toBe("Close (Esc)");
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("command-23 command-24 renders, selects, and filters the virtualized live-coverage worklist", async () => {
    const onSelect = vi.fn();
    render(
      <LiveCoverage
        rows={[
          liveRow(),
          liveRow({ issuer_id: "issuer-2", name: "Borealis Metals", ticker: "BRM", sector: "Materials" }),
        ]}
        onSelect={onSelect}
      />,
    );

    expect(screen.getAllByText("5.7x")).toHaveLength(2);
    expect(screen.getAllByText("2.1x")).toHaveLength(2);
    expect(screen.getAllByText(/OVERWEIGHT · p64/)).toHaveLength(2);
    expect(screen.getAllByText(/■ MODERATE/)).toHaveLength(2);

    const row = screen.getByRole("row", { name: /ATLF Atlas Forge details/i });
    fireEvent.keyDown(row, { key: " " });
    expect(onSelect).toHaveBeenCalledWith("issuer-1");

    fireEvent.click(screen.getByRole("button", { name: "Filter Sector" }));
    const dialog = screen.getByRole("dialog", { name: "Filter Sector" });
    fireEvent.click(within(dialog).getByLabelText("Industrials"));
    await waitFor(() => expect(screen.queryByText("Atlas Forge")).toBeNull());
    expect(screen.getByText("Borealis Metals")).toBeTruthy();
  });

  it("command-32 command-33 command-34 command-35 command-36 keeps six governance categories honest", () => {
    const { rerender } = render(
      <GovernancePanel
        liveQa={[{ id: "QA-1", issuer: "ATLF", module: "CP-5", sev: "HIGH", age: "1h", text: "gate failed" }]}
        liveFailedGates={[]}
        liveGaps={[{ issuer: "BRM", doc: "Audited financials", impact: "degraded", sev: "high", requested: "Jul 01" }]}
        liveMixedOrigin={[{ issuer_id: "issuer-3", name: "Cedar Telecom", detail: "reference tabs remain" }]}
        staleRows={[
          { issuer_id: "issuer-4", name: "Delta Paper", detail: "last run 14d ago" },
          { issuer_id: "issuer-5", name: "Elm Energy", detail: "never run" },
        ]}
      />,
    );
    for (const title of [
      "QA Queue · CP-5 open findings",
      "Failed Gates · committee gate",
      "Source Gaps · CP-0 gap log",
      "Mixed Origin · reference + live run",
      "Stale Sources · digest watch",
      "Overdue Refresh · never run",
    ]) expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText("Delta Paper")).toBeTruthy();
    expect(screen.getByText("Elm Energy")).toBeTruthy();

    rerender(
      <GovernancePanel
        findingStatus="loading"
        qaStatus="error"
        digestStatus="error"
        staleRows={[]}
      />,
    );
    expect(screen.queryByText(/No failed gates/)).toBeNull();
    expect(screen.queryByText(/No stale sources/)).toBeNull();
    expect(screen.getAllByText(/cannot be marked clear/)).toHaveLength(6);
  });

  it("command-37 command-38 command-39 command-40 distinguishes autonomy-draft states and converges alert acknowledgement", async () => {
    mocks.getAutonomyDraft.mockResolvedValue({
      status: "draft",
      ai_generated: true,
      ratified: false,
      export_allowed: false,
      marking: "AI-GENERATED, UNRATIFIED",
      generated_at: "2026-07-12T09:00:00Z",
      refreshing: false,
      summary: { n_sections: 1, n_claims: 1, n_deterministic_bullets: 0, n_anomalies: 1 },
      sections: [{
        issuer_id: "issuer-1",
        issuer_name: "Atlas Forge",
        max_severity: 0.9,
        claims: [{
          text: "EBITDA margin compressed sharply vs peers",
          claim_type: "anomaly",
          anomaly_kind: "peer-outlier",
          anomaly_severity: 0.9,
          chunk_ids: [],
          fact_ids: [],
          model: "test-model",
        }],
        deterministic_bullets: [],
        exhibit: [],
      }],
    });
    mocks.getAlertStates.mockResolvedValue([]);
    mocks.setAlertState.mockResolvedValue({
      id: "state-1",
      alert_key: "2026-07-12T09:00:00Z:issuer-1:peer-outlier:claim",
      state: "ack",
      assignee: null,
      note: null,
      analyst_id: "analyst-1",
      created_at: "2026-07-12T09:05:00Z",
      resolved_at: null,
      resolution_note: null,
    });

    render(<RankedChanges />);
    expect(await screen.findByText("EBITDA margin compressed sharply vs peers")).toBeTruthy();
    expect(screen.getByText("Ranked by severity — holdings not loaded")).toBeTruthy();
    expect(screen.getByText("0.9σ")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open →" }).getAttribute("href"))
      .toBe("/deepdive?issuer=issuer-1");

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ack" })));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Acked" }).getAttribute("aria-disabled")).toBe("true");
    });
  });

  it("command-52 command-53 renders live digest KPIs and opens both freshness watchlists by issuer id", () => {
    const digest: DailyDigest = {
      as_of: "2026-07-16T09:30:00Z",
      coverage: { issuers: 5, rated: 4, with_complete_run: 3 },
      stale_threshold_days: 7,
      stale: [{ issuer_id: "issuer-stale", name: "Stale Telecom", detail: "last run 14d ago" }],
      warf: 3210,
      warf_band: "B2",
      ccc_watch: [{ issuer_id: "issuer-ccc", name: "CCC Retail", detail: "Caa1 / CCC+" }],
      qa: {},
      activity_24h: { runs_completed: 3, runs_failed: 1 },
      freshness: {
        policy_version: "caos-freshness-v1",
        source_kind: "run",
        counts: { current: 3, due: 0, stale: 1, unknown: 1 },
        rows: [],
      },
    };
    render(<DailyDigestPanel digest={digest} />);

    expect(screen.getByText("3,210 · B2")).toBeTruthy();
    // Self-describing twin cells — "N of M" alone let two different facts read identically.
    expect(screen.getByText("4 rated · of 5")).toBeTruthy();
    expect(screen.getByText("3 runs · of 5")).toBeTruthy();
    expect(screen.getByText("3 done · 1 failed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Stale Telecom/i }));
    fireEvent.click(screen.getByRole("button", { name: /CCC Retail/i }));
    expect(mocks.openProfile).toHaveBeenNthCalledWith(1, "issuer-stale");
    expect(mocks.openProfile).toHaveBeenNthCalledWith(2, "issuer-ccc");
  });
});
