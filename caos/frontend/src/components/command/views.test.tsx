// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { IssuerStrip, PortfolioTable } from "./views";
import type { PortfolioRowDTO } from "@/lib/api";
import { afterEach, describe, it, expect, vi } from "vitest";

// RTL auto-cleanup isn't wired in this setup — without it the first render
// leaks into the next test's DOM queries.
afterEach(cleanup);

describe("PortfolioTable Customizer interaction", () => {
  it("opens the column customizer, allows checkbox toggle, and closes on Escape", () => {
    const handleSelect = vi.fn();
    render(<PortfolioTable selected={null} onSelect={handleSelect} />);
    
    // Customizer is closed by default
    expect(screen.queryByRole("dialog", { name: /Customize columns/i })).toBeNull();

    // Click trigger button
    const triggerBtn = screen.getByRole("button", { name: /COLUMNS/i });
    fireEvent.click(triggerBtn);

    // Dialog is visible
    const dialog = screen.getByRole("dialog", { name: /Customize columns/i });
    expect(dialog).not.toBeNull();

    // Press Escape
    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });

    // Dialog is closed
    expect(screen.queryByRole("dialog", { name: /Customize columns/i })).toBeNull();
    // Focus returned to triggerBtn
    expect(document.activeElement).toBe(triggerBtn);
  });
});

// Confidence-audit 2026-07-11 B-1/B-2: a live-coverage selection must render the
// LIVE strip (run metrics + deep-dive evidence link), never the seeded fixture;
// the seeded strip must self-identify as sample data.
describe("IssuerStrip live/seeded seam", () => {
  const liveRow: PortfolioRowDTO = {
    // ticker deliberately equals a seeded row's selection key (id) — the strip
    // must still render the LIVE row, not the seeded ACRISU figures.
    issuer_id: "iss-123", name: "Live Issuer Co", ticker: "BBG01B6UZZ33",
    sector: "Tech", run_id: "run-1", qa_status: "Pass", committee_status: "Ready",
    as_of: "2026-07-10", metrics: { net_leverage: 4.2, interest_coverage: 3.1 },
    rv_recommendation: "NEUTRAL", rv_percentile: 55, downside_fragility: "MODERATE",
    gaps: [],
  };

  it("renders live run metrics + deep-dive link for a live selection, even on a seeded-key collision", () => {
    render(<IssuerStrip code="BBG01B6UZZ33" liveRow={liveRow} onClose={() => {}} />);
    expect(screen.getByText("Live Issuer Co")).not.toBeNull();
    expect(screen.getByText("● LIVE")).not.toBeNull();
    expect(screen.getByText("4.2x")).not.toBeNull(); // live net leverage, not the seeded figure
    const link = screen.getByRole("link", { name: /OPEN DEEP-DIVE/i });
    expect(link.getAttribute("href")).toBe("/deepdive?issuer=iss-123");
    expect(screen.queryByText(/Sample — not live/i)).toBeNull();
  });

  it("marks the seeded strip as sample data", () => {
    // "BBG01B6UZZ33" is the first seeded PORTFOLIO row's selection key (its id).
    render(<IssuerStrip code="BBG01B6UZZ33" liveRow={null} onClose={() => {}} />);
    expect(screen.getByText(/Sample — not live/i)).not.toBeNull();
    expect(screen.queryByText("● LIVE")).toBeNull();
  });
});
