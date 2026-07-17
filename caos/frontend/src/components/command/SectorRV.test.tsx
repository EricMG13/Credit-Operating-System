// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { SectorRV } from "./SectorRV";
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";

afterEach(cleanup);
import {
  buildRVRows,
  crossSectorMatrix,
  derivePosture,
  invalidationTrigger,
  RV_AS_OF,
  RV_SOURCE,
  rvStaleness,
  rows as seedRows,
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
    
    const chart = screen.getByRole("group", { name: /Three-year discount margin by rating/i });
    expect(chart.tagName.toLowerCase()).toBe("svg");
    expect(screen.queryByRole("img", { name: /Three-year discount margin/i })).toBeNull();

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

  it("scatter points use roving tabindex (G7) — only one is a real tab stop, arrow keys move it and carry focus", () => {
    render(<SectorRV />);
    const points = screen.getAllByRole("button", { name: /Position/i });
    expect(points.length).toBeGreaterThan(1);

    // Exactly one point is in the natural tab order at rest.
    expect(points.filter((p) => p.tabIndex === 0)).toHaveLength(1);

    const first = points[0];
    first.focus();
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(document.activeElement).toBe(points[1]);
    expect(points[1].tabIndex).toBe(0);
    expect(first.tabIndex).toBe(-1);

    fireEvent.keyDown(points[1], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(first);
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
    const expectedPosture = derivePosture(buildRVRows()).label;

    // Honesty caveat elements
    expect(screen.getByText("SEED-REF")).toBeDefined();
    expect(screen.getByText("posture:")).toBeDefined();
    expect(screen.getByText(expectedPosture)).toBeDefined();
    expect(screen.getByText("(derived · not CP-SR)")).toBeDefined();
    expect(screen.getByText("staleness:")).toBeDefined();
    expect(screen.getByText("CURRENT (0–90d)")).toBeDefined();
    expect(screen.getByText(new RegExp(`as-of ${RV_AS_OF}`, "i"))).toBeDefined();

    // Cross-Sector Heatmap element
    expect(screen.getByText("Cross-Sector RV · median rvBp by sector × rating bucket")).toBeDefined();
    expect(screen.getByText("[derived from universe · not per-sector]")).toBeDefined();
    expect(screen.getByText(/sorted \|rvBp\| ↓/)).toBeDefined();
  });

  it("renders on-surface RV, chip, and evidence legends", () => {
    render(<SectorRV />);

    expect(screen.getByText("Legend")).toBeDefined();
    for (const label of ["Cheap", "Wide", "Inline", "Tight", "Rich"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/cohort · .*instrument · .*portfolio/)).toBeDefined();
    expect(screen.getByText(/m market · p peer · r recovery/)).toBeDefined();
    expect(screen.getByText("Method")).toBeDefined();
  });

  it("renders keyboard-selectable company cells, labeled deltas, and row-derived evidence ticks", () => {
    render(<SectorRV />);

    expect(screen.getAllByRole("button", { name: /Select .+, rating/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByTitle(/Δ 1M:/).length).toBeGreaterThan(0);
    expect(screen.getAllByTitle(/CP-6E compliance check: market/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/CP-6E compliance check: market/).length).toBeGreaterThan(0);
    expect(screen.getByTestId("sector-rv-right-rail").classList.contains("max-h-[360px]")).toBe(true);
  });

  it("shows peer-table empty state and a warning heatmap caption when filters empty the table", () => {
    render(<SectorRV />);

    fireEvent.click(screen.getByLabelText("Filter Company"));
    const dialog = screen.getByRole("dialog", { name: "Filter Company" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Clear" }));

    expect(screen.getByText("No loans match the current column filters — clear a filter to repopulate the peer table.")).toBeDefined();
    const warning = screen.getByText("[reference universe · 1 column filters NOT applied]");
    expect(warning.className).toContain("text-caos-warning");
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
    const heatmap = screen.getByText("Cross-Sector RV · median rvBp by sector × rating bucket").closest(".bg-caos-panel") as HTMLElement;
    const firstSectorCell = within(within(heatmap).getByRole("table")).getAllByRole("cell")[0];

    expect(firstSectorCell.textContent).toContain(expected);
  });

  it("covers every chart measure and aggregate mode, including linked hover and selection", () => {
    const { container } = render(<SectorRV />);
    const xControls = screen.getByRole("group", { name: "Chart X measure" });
    const chartControls = screen.getByRole("group", { name: "Chart type" });

    fireEvent.click(within(chartControls).getByRole("button", { name: "Bar" }));
    expect(screen.getByRole("group", { name: /Average three-year discount margin per rating/i })).toBeDefined();
    expect(screen.getByText("Point selection is available in the Scatter view and the peer table.")).toBeDefined();

    fireEvent.click(within(chartControls).getByRole("button", { name: "Box" }));
    expect(screen.getByRole("group", { name: /distribution per rating/i })).toBeDefined();
    fireEvent.click(within(xControls).getByRole("button", { name: "Sub-sector" }));
    expect(screen.getByRole("group", { name: /distribution per sub-sector/i })).toBeDefined();
    fireEvent.click(within(chartControls).getByRole("button", { name: "Bar" }));
    expect(screen.getByRole("group", { name: /Average three-year discount margin per sub-sector/i })).toBeDefined();

    fireEvent.click(within(xControls).getByRole("button", { name: "Size" }));
    expect(within(chartControls).getByRole("button", { name: "Bar" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("group", { name: /against size/i })).toBeDefined();
    let point = screen.getAllByRole("button", { name: /Position/i })[0];
    fireEvent.mouseEnter(point);
    fireEvent.mouseLeave(point);
    fireEvent.focus(point);
    fireEvent.blur(point);
    fireEvent.click(point);
    expect(screen.getByRole("button", { name: "Clear" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    fireEvent.click(within(xControls).getByRole("button", { name: "Price" }));
    expect(screen.getByRole("group", { name: /against price/i })).toBeDefined();
    point = screen.getAllByRole("button", { name: /Position/i })[0];
    fireEvent.click(point);
    fireEvent.keyDown(container.firstElementChild!, { key: "Escape" });
    expect(point.getAttribute("aria-pressed")).toBe("false");
  });

  it("covers full and market table lenses, filter projections, row events, sorts, and statistics tabs", () => {
    render(<SectorRV />);
    const lens = screen.getByRole("group", { name: "Loans table lens" });
    fireEvent.click(within(lens).getByRole("button", { name: "Full" }));
    const peers = screen.getByRole("table", { name: "Sector relative value" });

    for (const label of ["Company", "RV comp.", "Cohort RV", "Instrument", "Portf. Held", "Carry RV (bp/yr)", "Δ 1M"]) {
      const sort = within(peers).getByTitle(`Sort by ${label}`);
      fireEvent.click(sort);
      fireEvent.click(sort);
    }

    const companyButton = within(peers).getAllByRole("button", { name: /Select .+, rating/i })[0];
    const row = companyButton.closest("tr")!;
    fireEvent.mouseEnter(row);
    fireEvent.mouseLeave(row);
    fireEvent.focus(companyButton);
    fireEvent.blur(companyButton);
    fireEvent.click(row);
    fireEvent.click(companyButton);

    fireEvent.click(within(lens).getByRole("button", { name: "Market" }));
    expect(peers.className).toContain("min-w-[1100px]");
    fireEvent.click(within(lens).getByRole("button", { name: "RV" }));

    fireEvent.click(within(peers).getByRole("button", { name: "Filter Company" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Filter Company" })).getByRole("button", { name: "Clear" }));
    fireEvent.click(screen.getByRole("button", { name: "Close Company filter" }));
    fireEvent.click(screen.getByRole("button", { name: /Clear 1 column filter/ }));

    const stats = screen.getByRole("group", { name: "Statistics view type" });
    fireEvent.click(within(stats).getByRole("button", { name: "Sub-Sectors" }));
    const subsectors = screen.getByRole("table", { name: "Sub-sector market average" });
    fireEvent.click(within(subsectors).getByTitle("Sort by Sub-Sector"));
    fireEvent.click(within(subsectors).getByTitle("Sort by Δ 1M"));
    fireEvent.click(within(subsectors).getByTitle("Sort by Loans"));

    fireEvent.click(within(stats).getByRole("button", { name: "Indexes" }));
    const indexes = screen.getByRole("table", { name: "Index statistics" });
    fireEvent.click(within(indexes).getByTitle("Sort by Index"));
    fireEvent.click(within(indexes).getByTitle("Sort by Δ 1M"));
    fireEvent.click(within(indexes).getByTitle("Sort by Loans"));

    fireEvent.click(within(stats).getByRole("button", { name: "Ratings" }));
    const ratings = screen.getByRole("table", { name: "Sector ratings average" });
    fireEvent.click(within(ratings).getByTitle("Sort by Rating"));
    fireEvent.click(within(ratings).getByTitle("Sort by Δ 1M"));
    fireEvent.click(within(ratings).getByTitle("Sort by Loans"));
  });

  it("rebuilds from holdings, exercises top-of-book events, and clears selection on sector change", () => {
    const rebuilt = buildRVRows();
    const initialSector = rebuilt[0]!.sector;
    const first = rebuilt
      .filter((row) => row.sector === initialSector && row.rvBp !== null)
      .sort((a, b) => Math.abs(b.rvBp!) - Math.abs(a.rvBp!))[0]!;
    const holdings = new Map([[first.figi, { held: true, headroomPct: 17 }]]);
    render(<SectorRV holdings={holdings} />);

    expect(screen.getAllByText(/^held/).length).toBeGreaterThan(0);
    const cheapSection = screen.queryByText("Cheap · add")?.parentElement;
    const richSection = screen.queryByText("Rich · fade")?.parentElement;
    const pick = (cheapSection ?? richSection)?.querySelector("button") as HTMLButtonElement;
    expect(pick).toBeDefined();
    fireEvent.mouseEnter(pick);
    fireEvent.mouseLeave(pick);
    fireEvent.focus(pick);
    fireEvent.blur(pick);
    fireEvent.click(pick);
    fireEvent.click(pick);

    const point = screen.getAllByRole("button", { name: /Position/i })[0];
    fireEvent.click(point);
    const sectorSelect = screen.getByLabelText("Sector tables") as HTMLSelectElement;
    expect(sectorSelect.options.length).toBeGreaterThan(1);
    fireEvent.change(sectorSelect, { target: { value: "1" } });
    expect(sectorSelect.value).toBe("1");
    expect(screen.getByText("Click a point or a peer-table row — selection links both ways · Esc clears.")).toBeDefined();
  });

  it("renders warning and critical staleness caveats from the clock", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
      render(<SectorRV />);
      expect(screen.getByText("POTENTIALLY STALE (91–180d)").className).toContain("text-caos-warning");
      cleanup();

      vi.setSystemTime(new Date("2027-02-01T12:00:00Z"));
      render(<SectorRV />);
      expect(screen.getByText("STALE (>180d)").className).toContain("text-caos-critical");
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders cautious, neutral, thin-benchmark, and no-cheap-tail reads", () => {
    const original = seedRows.map((row) => row.rvBp);
    try {
      seedRows.forEach((row, index) => { row.rvBp = index + 1; });
      render(<SectorRV />);
      expect(screen.getByText("CONSTRUCTIVE")).toBeDefined();
      cleanup();

      seedRows.forEach((row, index) => { row.rvBp = -(index + 1); });
      render(<SectorRV />);
      expect(screen.getByText("CAUTIOUS")).toBeDefined();
      expect(screen.getByText("No loan screens wide of its bucket median in the current selection.")).toBeDefined();
      cleanup();

      seedRows.forEach((row) => { row.rvBp = null; });
      render(<SectorRV />);
      expect(screen.getByText("NEUTRAL")).toBeDefined();
      expect(screen.getByText(/0 of .* loans carry a sector×rating benchmark/)).toBeDefined();
      expect(screen.getByText(/No benchmarked loans in scope/)).toBeDefined();
    } finally {
      seedRows.forEach((row, index) => { row.rvBp = original[index]; });
    }
  });
});
