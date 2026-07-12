// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SectorReviewWorkspace } from "./SectorReviewWorkspace";

afterEach(cleanup);

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock next/navigation (not the shared ConceptNav component) so ConceptNav
// renders for real — a vi.mock keyed on a shared component's module path
// leaked across worker-shared test files once before (see vitest.config.ts's
// react-dom/server comment); ShellIdentity now imports ConceptNav too, so the
// same path-mock started intermittently breaking unrelated full-suite runs
// with "ShellIdentity is not defined".
vi.mock("next/navigation", () => ({
  usePathname: () => "/command",
}));

vi.mock("@/components/shared/IssuerLink", () => ({
  IssuerLink: ({ children, query, className }: { children: React.ReactNode; query?: string; className?: string }) => (
    <a href={`/issuers/profile?q=${query || ""}`} className={className}>{children}</a>
  ),
}));

// jsdom has no URL.createObjectURL — downloadCsv's real anchor-click download
// path throws there. csvCell stays real (importOriginal) so CSV-cell escaping
// is still exercised; only the DOM side-effect is stubbed.
vi.mock("@/lib/csv", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/csv")>()),
  downloadCsv: vi.fn(),
}));

const feeds = [
  { sector: "Industrials", enabled: true, notify_pref: "in_app", provenance: "seed" },
  { sector: "Telecom", enabled: true, notify_pref: "in_app", provenance: "seed" },
];

const signal = {
  id: "seed-industrials-2026-07-06-01",
  sector: "Industrials",
  signal_date: "2026-07-06T10:15:00Z",
  category: "earnings",
  severity: "high",
  headline: "Q2 order books soften",
  summary: "Distributor commentary points to slower short-cycle demand.",
  materiality_score: 0.9,
  issuers: [{ name: "Atlas Forge Industrials", ticker: "ATLF", exposure: "held" }],
  sources: [{ source_type: "seed", ref: "seed://x", title: "Seed source", tier: "seed", provenance: "seed" }],
  provenance: "seed",
  staleness_flag: "seed",
  confidence: "fixture",
};

const signal2 = {
  id: "seed-industrials-2026-07-06-02",
  sector: "Industrials",
  signal_date: "2026-07-06T11:00:00Z",
  category: "liquidity",
  severity: "critical",
  headline: "Revolver draw flagged by agent bank",
  summary: "Agent bank flagged a partial revolver draw ahead of quarter close.",
  materiality_score: 0.75,
  issuers: [{ name: "Atlas Forge Industrials", ticker: "ATLF", exposure: "held" }],
  sources: [{ source_type: "seed", ref: "seed://y", title: "Seed source 2", tier: "seed", provenance: "seed" }],
  provenance: "seed",
  staleness_flag: "seed",
  confidence: "fixture",
};

const review = {
  sector: "Industrials",
  timeframe: "today",
  as_of: "2026-07-06T12:00:00Z",
  posture: "Watch",
  confidence: "fixture",
  staleness_flag: "seed",
  provenance: "seed",
  module_status: "CP-SR pending",
  refresh_trigger: "read",
  sections: [{
    id: "fundamental",
    title: "Fundamental Direction",
    posture: "watch",
    summary: "One seed-backed signal currently frames the Industrials daily brief.",
    signal_ids: [signal.id],
  }],
  signals: [signal],
};

const askResponse = {
  signal_id: signal.id,
  answer: "Seed-context answer.",
  financial_impact_summary: "Focus on EBITDA bridge.",
  affected_issuers: signal.issuers,
  recommended_actions: ["Confirm source."],
  sources: signal.sources,
  provenance: "seed",
  retrieval_scope: "Restricted to this sector signal's cited sources plus existing issuer run objects.",
};

const api = vi.hoisted(() => ({
  getSectorFeeds: vi.fn(),
  updateSectorFeeds: vi.fn(),
  getSectorReview: vi.fn(),
  getSectorSignals: vi.fn(),
  refreshSectorReview: vi.fn(),
  askSectorTopic: vi.fn(),
  createQaFlag: vi.fn(),
  toErrorMessage: vi.fn((_err: unknown, fallback: string) => fallback),
}));

vi.mock("@/lib/api", () => api);

const csv = vi.hoisted(() => ({ downloadSignalsCsv: vi.fn() }));
vi.mock("./signalsCsv", () => csv);

describe("SectorReviewWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getSectorFeeds.mockResolvedValue(feeds);
    api.updateSectorFeeds.mockResolvedValue(feeds);
    api.getSectorReview.mockResolvedValue(review);
    api.getSectorSignals.mockResolvedValue([signal, signal2]);
    api.refreshSectorReview.mockResolvedValue(review);
    api.askSectorTopic.mockResolvedValue(askResponse);
    api.createQaFlag.mockResolvedValue({ id: "flag-1" });
  });

  it("renders feed selector and grouped signal ROWS (severity/headline/issuer/materiality/date) with detail kept out of the row", async () => {
    render(<SectorReviewWorkspace />);

    expect(await screen.findByRole("heading", { name: "Industrials" })).toBeTruthy();
    expect(await screen.findByText("Q2 order books soften")).toBeTruthy();
    expect(screen.getByText("Earnings / 1")).toBeTruthy();
    expect(screen.getByText("Liquidity / 1")).toBeTruthy();
    // Row shows the issuer ticker (dense), not the old card's full "TICKER / exposure" chip.
    expect(screen.getAllByText("ATLF").length).toBeGreaterThan(0);
    // Full detail (summary, source chips) only lives in the slide-over, not the row.
    expect(screen.queryByText("Distributor commentary points to slower short-cycle demand.")).toBeNull();
    expect(screen.queryByText("seed / seed")).toBeNull();
    // Seeded provenance still renders through the shared grammar chip (the
    // top-of-page badge), even though the row itself no longer carries one.
    expect(screen.getAllByText("DEMO").length).toBeGreaterThan(0);
  });

  it("the row is a single click target (besides its checkbox) that opens SignalSlideOver with full detail", async () => {
    render(<SectorReviewWorkspace />);

    fireEvent.click(await screen.findByText("Q2 order books soften"));

    expect(await screen.findByRole("dialog", { name: "Q2 order books soften" })).toBeTruthy();
    expect(screen.getByText("Distributor commentary points to slower short-cycle demand.")).toBeTruthy();
    expect(screen.getByText("seed / seed")).toBeTruthy();
    expect(screen.getByText("ATLF / held")).toBeTruthy();
  });

  it("Ask Topic from the slide-over closes it and opens the scoped Topic ASK dialog", async () => {
    render(<SectorReviewWorkspace />);

    fireEvent.click(await screen.findByText("Q2 order books soften"));
    fireEvent.click(await screen.findByRole("button", { name: "Ask Topic" }));

    expect(screen.queryByRole("dialog", { name: "Q2 order books soften" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Run Topic ASK" }));

    await waitFor(() => expect(api.askSectorTopic).toHaveBeenCalledWith(signal.id, expect.stringContaining("Q2 order books soften")));
    expect(await screen.findByText("Seed-context answer.")).toBeTruthy();
    expect(screen.getByText(/Restricted to this sector signal/)).toBeTruthy();
  });

  it("refreshes the briefing through the refresh API and re-renders", async () => {
    render(<SectorReviewWorkspace />);

    const [refreshButton] = await screen.findAllByRole("button", { name: "Refresh" });
    fireEvent.click(refreshButton);

    await waitFor(() =>
      expect(api.refreshSectorReview).toHaveBeenCalledWith(
        expect.objectContaining({ sector: "Industrials", timeframe: "today" }),
      ),
    );
    expect((await screen.findAllByText("Q2 order books soften")).length).toBeGreaterThan(0);
  });

  it("shows bounded date controls only when Custom timeframe is selected", async () => {
    render(<SectorReviewWorkspace />);
    await screen.findAllByRole("heading", { name: "Industrials" });

    expect(screen.queryByLabelText("Sector Review start date")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Custom" })[0]);
    expect(await screen.findByLabelText("Sector Review start date")).toBeTruthy();
    expect(screen.getByLabelText("Sector Review end date")).toBeTruthy();
  });

  describe("batch selection", () => {
    it("selecting rows reveals BatchBar and discloses the cap + QA rate limit", async () => {
      render(<SectorReviewWorkspace />);
      await screen.findByText("Q2 order books soften");

      expect(screen.queryByRole("toolbar", { name: "Batch actions" })).toBeNull();
      fireEvent.click(screen.getByLabelText("Select Q2 order books soften"));

      expect(screen.getByRole("toolbar", { name: "Batch actions" })).toBeTruthy();
      expect(screen.getByText("1 signal selected")).toBeTruthy();
      expect(screen.getByText("Batch capped at 20 signals · QA flags rate-limited to 30/min")).toBeTruthy();
    });

    it("Flag to QA calls createQaFlag once per selected signal and reports PER-ITEM outcomes on partial failure", async () => {
      api.createQaFlag.mockImplementation(async ({ step_ref }: { step_ref: string }) => {
        if (step_ref === signal2.id) throw new Error("Flag rate limit reached — try again in a minute.");
        return { id: "flag-1" };
      });

      render(<SectorReviewWorkspace />);
      await screen.findByText("Q2 order books soften");
      fireEvent.click(screen.getByLabelText("Select Q2 order books soften"));
      fireEvent.click(screen.getByLabelText("Select Revolver draw flagged by agent bank"));
      expect(screen.getByText("2 signals selected")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Flag to QA (2)" }));

      await waitFor(() => expect(api.createQaFlag).toHaveBeenCalledTimes(2));
      expect(api.createQaFlag).toHaveBeenCalledWith({ module_id: "SECTOR", step_ref: signal.id, issuer_id: undefined });
      expect(api.createQaFlag).toHaveBeenCalledWith({ module_id: "SECTOR", step_ref: signal2.id, issuer_id: undefined });
      await waitFor(() => expect(screen.getByText("1/2 succeeded")).toBeTruthy());
    });

    it("caps selection at 20 — disables further checkboxes once the cap is reached", async () => {
      const many = Array.from({ length: 21 }, (_, i) => ({
        ...signal,
        id: `seed-cap-${i}`,
        headline: `Cap signal ${i}`,
      }));
      api.getSectorSignals.mockResolvedValue(many);

      render(<SectorReviewWorkspace />);
      await screen.findByText("Cap signal 0");

      for (let i = 0; i < 20; i++) {
        fireEvent.click(screen.getByLabelText(`Select Cap signal ${i}`));
      }
      expect(screen.getByText("20 signals selected")).toBeTruthy();
      expect((screen.getByLabelText("Select Cap signal 20") as HTMLInputElement).disabled).toBe(true);
    });

    it("Export CSV is a pure client-side action — no server call — and only exports the selected rows", async () => {
      render(<SectorReviewWorkspace />);
      await screen.findByText("Q2 order books soften");
      fireEvent.click(screen.getByLabelText("Select Q2 order books soften"));

      fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));

      expect(csv.downloadSignalsCsv).toHaveBeenCalledWith("Industrials", [signal]);
      expect(api.createQaFlag).not.toHaveBeenCalled();
    });

    it("does NOT ship a Batch Ask action", async () => {
      render(<SectorReviewWorkspace />);
      await screen.findByText("Q2 order books soften");
      fireEvent.click(screen.getByLabelText("Select Q2 order books soften"));

      expect(screen.queryByRole("button", { name: /batch ask/i })).toBeNull();
    });
  });
});
