// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { SectorReviewV2 } from "@/lib/analysis-workbench";
import { SectorReviewContent } from "./SectorReviewPanels";

afterEach(cleanup);

function reviewFixture(): SectorReviewV2 {
  return {
    id: "review-1",
    context_id: "ctx-1",
    sector_id: "media",
    sector_label: "Media",
    timeframe: "LTM",
    version: 2,
    status: "ready",
    as_of: "2026-07-17",
    posture: "watch",
    what_changed: "Spreads widened",
    why_it_matters: "Refinancing pressure",
    required_action: "Review",
    evidence_health: "partial",
    dimension_scores: [
      { id: "quality", label: "Business quality", score: 72, confidence: 0.84, freshness: "current", source_ids: ["E-1"], missing_dependency: null },
      { id: "coverage", label: "Coverage", score: null, confidence: 0.4, freshness: "stale", source_ids: [], missing_dependency: "FY26 model" },
    ],
    sections: [
      { id: "thesis", title: "Sector thesis", posture: "watch", summary: "Pricing remains rational.", confidence: 0.8, freshness: "current", signal_ids: ["sig-1"] },
      { id: "capital", title: "Capital access", posture: "risk", summary: "Maturities approach.", confidence: 0.6, freshness: "aging", signal_ids: [] },
    ],
    ratifications: { thesis: "ratified" },
    early_warning: [
      { id: "sig-1", indicator: "Defaults", threshold: "3%", current_state: "4%", status: "breached", source_ids: ["E-1"] },
      { id: "sig-2", indicator: "Downgrades", threshold: "2", current_state: "2", status: "watch", source_ids: [] },
      { id: "sig-3", indicator: "Liquidity", threshold: "1.5x", current_state: "2.0x", status: "clear", source_ids: [] },
    ],
    comparables: [
      { issuer_id: "issuer-1", issuer_name: "Linked Media", posture: "watch", metrics: {}, missing_dependencies: ["FY26", "Covenants"] },
      { issuer_id: null, issuer_name: "Private Peer", posture: "stable", metrics: {}, missing_dependencies: [] },
    ],
    risks: [{ id: "risk-1", title: "Cord cutting", likelihood: "high", severity: "critical", mitigants: [], residual_risk: "elevated", source_ids: ["E-1"] }],
    source_register: [{ id: "E-1", title: "Sector tape", origin: "Market", method: "API", freshness: "current", as_of: "2026-07-17", url: null }],
    uncertainties: [{ id: "u-1", statement: "Subscriber floor uncertain", impact: "Downside EBITDA", route_to_qa: true, source_ids: ["E-1"] }],
    downstream_readiness: { ready: false, consumers: [], blocked_by: ["FY26 model"] },
    missing_dependencies: ["FY26 model"],
    authority: {} as SectorReviewV2["authority"],
    created_at: "2026-07-17T00:00:00Z",
  } as unknown as SectorReviewV2;
}

describe("SectorReviewContent", () => {
  it("renders the honest empty state when no versioned review exists", () => {
    render(<SectorReviewContent review={null} tab="overview" selectedSection={null} onSelectSection={() => {}} />);

    expect(screen.getByText("No versioned dossier")).toBeTruthy();
    expect(screen.getByText(/Request a refresh to create a draft/)).toBeTruthy();
  });

  it("renders a live-announced loading state, distinct from the empty state, while loading", () => {
    render(<SectorReviewContent review={null} tab="overview" selectedSection={null} onSelectSection={() => {}} loading />);

    expect(screen.getByText("Loading sector review")).toBeTruthy();
    expect(screen.queryByText("No versioned dossier")).toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("renders overview evidence and delegates section selection", () => {
    const onSelectSection = vi.fn();
    render(
      <SectorReviewContent
        review={reviewFixture()}
        tab="overview"
        selectedSection={null}
        onSelectSection={onSelectSection}
      />,
    );

    expect(screen.getByText("Business quality")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Sector thesis/ }));
    expect(onSelectSection).toHaveBeenCalledWith("thesis");
  });

  it("renders every specialized dossier tab and its evidence states", () => {
    const review = reviewFixture();
    const props = { review, selectedSection: "thesis", onSelectSection: vi.fn(), contextId: "ctx-1" };
    const { rerender } = render(<SectorReviewContent {...props} tab="overview" />);
    expect(screen.getByText("ratified")).toBeTruthy();
    expect(screen.getByText("FY26 model")).toBeTruthy();

    rerender(<SectorReviewContent {...props} tab="signals" />);
    expect(screen.getByText("Defaults")).toBeTruthy();
    expect(screen.getByText("Downgrades")).toBeTruthy();
    expect(screen.getByText("Liquidity")).toBeTruthy();

    rerender(<SectorReviewContent {...props} tab="comparables" />);
    expect(screen.getByRole("link", { name: "Linked Media" })).toBeTruthy();
    expect(screen.getByText("Private Peer")).toBeTruthy();
    expect(screen.getByText("FY26 · Covenants")).toBeTruthy();

    rerender(<SectorReviewContent {...props} tab="early-warning" />);
    expect(screen.getByText("breached · 4%")).toBeTruthy();

    rerender(<SectorReviewContent {...props} tab="risks" />);
    expect(screen.getByText("Cord cutting")).toBeTruthy();
    expect(screen.getByText("Residual risk · elevated")).toBeTruthy();

    rerender(<SectorReviewContent {...props} tab="sources" />);
    expect(screen.getByText("Sector tape")).toBeTruthy();
    expect(screen.getByText(/Subscriber floor uncertain/)).toBeTruthy();
    const route = screen.getByRole("link", { name: "Route gaps to QA" });
    expect(route.getAttribute("href")).toContain("context=ctx-1");

    rerender(<SectorReviewContent {...props} contextId={undefined} tab="sources" />);
    expect(screen.queryByRole("link", { name: "Route gaps to QA" })).toBeNull();
  });
});
