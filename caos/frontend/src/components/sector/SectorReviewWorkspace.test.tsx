// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SectorReviewWorkspace } from "./SectorReviewWorkspace";

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
  toErrorMessage: vi.fn((_err: unknown, fallback: string) => fallback),
}));

vi.mock("@/lib/api", () => api);

describe("SectorReviewWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getSectorFeeds.mockResolvedValue(feeds);
    api.updateSectorFeeds.mockResolvedValue(feeds);
    api.getSectorReview.mockResolvedValue(review);
    api.getSectorSignals.mockResolvedValue([signal]);
    api.refreshSectorReview.mockResolvedValue(review);
    api.askSectorTopic.mockResolvedValue(askResponse);
  });

  it("renders feed selector, grouped signal cards, chips, and seed provenance", async () => {
    render(<SectorReviewWorkspace />);

    expect(await screen.findByRole("heading", { name: "Industrials" })).toBeTruthy();
    // Signals load in a second effect (one tick after the heading), so await the
    // first signal-card text; the remaining assertions render in the same batch.
    expect(await screen.findByText("Q2 order books soften")).toBeTruthy();
    expect(screen.getByText("Earnings / 1")).toBeTruthy();
    expect(screen.getByText("ATLF / held")).toBeTruthy();
    expect(screen.getAllByText("Seed / demo").length).toBeGreaterThan(0);
    expect(screen.getByText("seed / seed")).toBeTruthy();
  });

  it("opens scoped topic ASK for a signal", async () => {
    render(<SectorReviewWorkspace />);

    fireEvent.click(await screen.findByRole("button", { name: "Ask Topic" }));
    fireEvent.click(screen.getByRole("button", { name: "Run Topic ASK" }));

    await waitFor(() => expect(api.askSectorTopic).toHaveBeenCalledWith(signal.id, expect.stringContaining("Q2 order books soften")));
    expect(await screen.findByText("Seed-context answer.")).toBeTruthy();
    expect(screen.getByText(/Restricted to this sector signal/)).toBeTruthy();
  });
});
