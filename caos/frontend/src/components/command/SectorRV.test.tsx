// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { SectorRV } from "./SectorRV";
import { describe, it, expect, beforeAll, afterEach } from "vitest";

afterEach(cleanup);
import {
  buildRVRows,
  crossSectorMatrix,
  invalidationTrigger,
  RV_AS_OF,
  RV_SOURCE,
  rvStaleness,
} from "@/lib/command/rvdata";

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.requestAnimationFrame = (cb) => {
    cb(0);
    return 0;
  };
  global.ResizeObserver = class ResizeObserver {
    private callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe() {
      // Synchronously trigger callback to establish dimensions under test
      this.callback([{
        contentRect: { width: 820, height: 340 }
      } as ResizeObserverEntry], this);
    }
    unobserve() {}
    disconnect() {}
  };
});

describe("SectorRV Scatter Interaction", () => {
  it("renders scatter points as accessible buttons and handles keyboard press", () => {
    render(<SectorRV />);
    
    // Points will be rendered as elements with role="button" and a descriptive name prefix
    const points = screen.getAllByRole("button", { name: /Position/i });
    expect(points.length).toBeGreaterThan(0);
    
    const firstPoint = points[0];
    firstPoint.focus();
    expect(document.activeElement).toBe(firstPoint);

    // Press Enter to select it
    fireEvent.keyDown(firstPoint, { key: "Enter", code: "Enter" });
    expect(firstPoint.getAttribute("aria-pressed")).toBe("true");

    // Press Space to deselect it
    fireEvent.keyDown(firstPoint, { key: " ", code: "Space" });
    expect(firstPoint.getAttribute("aria-pressed")).toBe("false");
  });

  it("applies responsive container query classes to layouts", () => {
    const { container } = render(<SectorRV />);
    const root = container.firstChild as HTMLElement;
    expect(root.classList.contains("@container")).toBe(true);
    
    const topHalfGrid = container.querySelector(".grid") as HTMLElement;
    expect(topHalfGrid.classList.contains("@[60rem]:grid-cols-[1.6fr_1fr]")).toBe(true);
  });
});

describe("Broader Sector RV Calculations & Presentation", () => {
  it("computes dynamic buildRVRows with benchmark provenance and holdings mapping", () => {
    const defaultRows = buildRVRows();
    expect(defaultRows.length).toBeGreaterThan(0);

    // Verify cohort/Axis 1 structure
    const firstRow = defaultRows[0];
    expect(firstRow).toHaveProperty("rvProvenance");
    if (firstRow.rvBp !== null) {
      expect(firstRow.rvProvenance).not.toBeNull();
      expect(firstRow.rvProvenance?.peerSet).toBe("sector×bucket");
      expect(firstRow.rvProvenance?.asOf).toBe(RV_AS_OF);
      expect(firstRow.rvProvenance?.source).toBe(RV_SOURCE);
    }

    // Verify instrument/Axis 2 (LGD insufficient info)
    expect(firstRow.instrumentRv.status).toBe("insufficient");
    expect(firstRow.instrumentRv.reason).toContain("No recovery/LGD data in feed");
    expect(firstRow.instrumentRv).toHaveProperty("liq");
    expect(firstRow.instrumentRv).toHaveProperty("maturity");

    // Verify portfolio/Axis 3 (empty by default)
    expect(firstRow.portfolioRv.held).toBe(false);

    // Test with holdings mapped
    const holdings = new Map<string, { held: boolean; headroomPct?: number }>();
    holdings.set(firstRow.figi, { held: true, headroomPct: 25 });
    
    const customRows = buildRVRows(holdings);
    const matchedRow = customRows.find(r => r.figi === firstRow.figi);
    expect(matchedRow?.portfolioRv.held).toBe(true);
    expect(matchedRow?.portfolioRv.headroomPct).toBe(25);
  });

  it("calculates carryRv based on rvBp and duration-to-maturity", () => {
    const defaultRows = buildRVRows();
    const withMaturity = defaultRows.find(r => r.maturity !== null && r.rvBp !== null);
    if (withMaturity) {
      expect(withMaturity.carryRv).not.toBeNull();
      expect(typeof withMaturity.carryRv).toBe("number");
    }
  });

  it("builds correct crossSectorMatrix medians across the universe", () => {
    const allRows = buildRVRows();
    const matrix = crossSectorMatrix(allRows);
    expect(matrix).toHaveProperty("Energy");
    expect(matrix).toHaveProperty("Industrials");

    // Verify cell structure
    const cell = matrix["Energy"]["Ba2"];
    expect(cell).toHaveProperty("median");
    expect(cell).toHaveProperty("n");
  });

  it("determines deterministic CP-6E invalidation triggers correctly", () => {
    expect(invalidationTrigger(null, 5)).toBe("—");
    expect(invalidationTrigger(180, 5)).toContain("rvBp compresses to < +50bp");
    expect(invalidationTrigger(180, 3)).toContain("peer-set n improves to ≥4");
    expect(invalidationTrigger(80, 3)).toContain("rvBp compresses to < +10bp");
    expect(invalidationTrigger(0, 2)).toBe("baseline change");
  });

  it("derives staleness from the shared RV as-of date", () => {
    expect(rvStaleness(RV_AS_OF, new Date("2026-07-06T12:00:00Z"))).toEqual({
      label: "CURRENT (0–90d)",
      tone: "success",
    });
    expect(rvStaleness(RV_AS_OF, new Date("2026-10-06T12:00:00Z"))).toEqual({
      label: "POTENTIALLY STALE (91–180d)",
      tone: "warning",
    });
    expect(rvStaleness(RV_AS_OF, new Date("2027-02-01T12:00:00Z"))).toEqual({
      label: "STALE (>180d)",
      tone: "critical",
    });
  });

  it("keeps cross-sector matrix cells unbenchmarked until n is credible", () => {
    const benchmarked = buildRVRows().filter((row) => row.rvBp !== null);
    const base = benchmarked[0]!;
    const peer = benchmarked[1]!;
    const matrix = crossSectorMatrix([
      { ...base, sector: "Test Sector", bucket: "B2", rvBp: 100 },
      { ...peer, figi: `${peer.figi}-A`, sector: "Test Sector", bucket: "B3", rvBp: 50 },
      { ...peer, figi: `${peer.figi}-B`, sector: "Test Sector", bucket: "B3", rvBp: 70 },
    ]);

    expect(matrix["Test Sector"].B2.n).toBe(1);
    expect(matrix["Test Sector"].B2.median).toBeNull();
    expect(matrix["Test Sector"].B3.median).toBe(60);
  });

  it("renders caveat honesty headers, posture mapping, and cross-sector heatmap in DOM", () => {
    render(<SectorRV />);

    // Honesty caveat elements
    expect(screen.getByText("SEED-REF")).toBeDefined();
    expect(screen.getByText("posture:")).toBeDefined();
    expect(screen.getByText("CONSTRUCTIVE")).toBeDefined();
    expect(screen.getByText("(derived · not CP-SR)")).toBeDefined();
    expect(screen.getByText("staleness:")).toBeDefined();
    expect(screen.getByText("CURRENT (0–90d)")).toBeDefined();
    expect(screen.getByText(new RegExp(`as-of ${RV_AS_OF}`, "i"))).toBeDefined();

    // Cross-Sector Heatmap element
    expect(screen.getByText("Cross-Sector RV · median rvBp by sector × rating bucket")).toBeDefined();
    expect(screen.getByText("[derived from universe · not per-sector]")).toBeDefined();
    expect(screen.getByText(/sorted \|rvBp\| ↓/)).toBeDefined();
  });

  it("renders keyboard-selectable company cells, labeled deltas, and row-derived evidence ticks", () => {
    render(<SectorRV />);

    expect(screen.getAllByRole("button", { name: /Select .+, rating/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByTitle(/Δ 1M:/).length).toBeGreaterThan(0);
    expect(screen.getAllByTitle(/CP-6E compliance check: market/).length).toBeGreaterThan(0);
    expect(screen.getByTestId("sector-rv-right-rail").classList.contains("max-h-[360px]")).toBe(true);
  });

  it("offers selected-loan exits to profile, Deep-Dive, and ASK", () => {
    let askEvents = 0;
    const onAsk = () => { askEvents += 1; };
    window.addEventListener("caos:ask-toggle", onAsk);

    try {
      render(<SectorRV />);
      fireEvent.click(screen.getAllByRole("button", { name: /Position/i })[0]);

      expect(screen.getByRole("link", { name: "Profile" })).toBeDefined();
      expect(screen.getByRole("link", { name: "Deep-Dive" }).getAttribute("href")).toContain("/deepdive?issuer=");

      fireEvent.click(screen.getByRole("button", { name: /Ask about selected RV/i }));
      expect(askEvents).toBe(1);
    } finally {
      window.removeEventListener("caos:ask-toggle", onAsk);
    }
  });

  it("orders the cross-sector heatmap by median RV across visible buckets", () => {
    const expected = (() => {
      const matrix = crossSectorMatrix(buildRVRows());
      const buckets = ["Ba1", "Ba2", "Ba3", "B1", "B2", "B3"];
      const median = (values: number[]) => {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      };
      const score = (sector: string) => {
        const values = buckets
          .map((bucket) => matrix[sector]?.[bucket]?.median)
          .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
        return values.length ? median(values) : Number.NEGATIVE_INFINITY;
      };
      return Object.keys(matrix).sort((a, b) => score(b) - score(a) || a.localeCompare(b))[0];
    })();

    render(<SectorRV />);
    const heatmap = screen.getByText("Cross-Sector RV · median rvBp by sector × rating bucket").parentElement?.parentElement as HTMLElement;
    const firstSectorCell = within(heatmap).getAllByRole("cell")[0];

    expect(firstSectorCell.textContent).toContain(expected);
  });
});
