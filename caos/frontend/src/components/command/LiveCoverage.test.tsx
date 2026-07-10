// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { PortfolioRowDTO } from "@/lib/api";
import { LiveCoverage } from "./LiveCoverage";

afterEach(cleanup);

const row = (over: Partial<PortfolioRowDTO> = {}): PortfolioRowDTO => ({
  issuer_id: "i1", name: "Aurora Cables", ticker: "AURC", sector: "Telecom",
  run_id: "r1", qa_status: "Pass", committee_status: "Committee Ready", as_of: null,
  metrics: { net_leverage: 5.7, interest_coverage: 2.1 },
  rv_recommendation: "OVERWEIGHT", rv_percentile: 64, downside_fragility: "MODERATE",
  ...over,
});

describe("LiveCoverage", () => {
  it("renders engine-derived fundamentals for a covered issuer", () => {
    render(<LiveCoverage rows={[row()]} />);
    expect(screen.getByText("AURC")).toBeTruthy();
    expect(screen.getByText("Aurora Cables")).toBeTruthy();
    expect(screen.getByText("5.7x")).toBeTruthy();      // net leverage
    expect(screen.getByText("2.1x")).toBeTruthy();      // interest coverage
    expect(screen.getByText(/OVERWEIGHT · p64/)).toBeTruthy();
    expect(screen.getByText(/MODERATE/)).toBeTruthy();  // fragility band word travels with the colour
    expect(screen.getByText("Pass")).toBeTruthy();
  });

  it("degrades missing metrics / RV / fragility to em-dash, never crashes", () => {
    render(<LiveCoverage rows={[row({
      metrics: {}, rv_recommendation: null, rv_percentile: null, downside_fragility: null,
    })]} />);
    // net lev, int cov, RV, fragility all absent → four em-dashes in the row
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
  });

  it("supports selection via click and keyboard (Enter/Space)", () => {
    const handleSelect = vi.fn();
    const rows = [row({ issuer_id: "i1", ticker: "AURC", name: "Aurora Cables" })];
    
    render(
      <LiveCoverage rows={rows} selected={null} onSelect={handleSelect} />
    );

    // The row is a role="row" with tabIndex={0} for keyboard operability,
    // not a role="button". Accessible name comes from aria-label.
    const rowEl = screen.getByRole("row", { name: /AURC/i });
    expect(rowEl).toBeTruthy();

    // Click to select
    fireEvent.click(rowEl);
    expect(handleSelect).toHaveBeenCalledWith("AURC");

    handleSelect.mockClear();

    // Press Enter to select
    fireEvent.keyDown(rowEl, { key: "Enter", code: "Enter" });
    expect(handleSelect).toHaveBeenCalledWith("AURC");

    handleSelect.mockClear();

    // Press Space to select
    fireEvent.keyDown(rowEl, { key: " ", code: "Space" });
    expect(handleSelect).toHaveBeenCalledWith("AURC");
  });
});
