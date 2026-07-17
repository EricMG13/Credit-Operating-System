// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { FilterHeader, useColumnFilters, type FilterState, type SortState } from "./TableColumnFilter";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type Row = { id: number; sector?: string | null; score?: number };
const rows: Row[] = [
  { id: 1, sector: "Media", score: 10 },
  { id: 2, sector: "Tech", score: 2 },
  { id: 3, sector: null },
];
const getters = {
  sector: (row: Row) => row.sector,
  score: (row: Row) => row.score,
};

function FilterProbe({ filters }: { filters: FilterState }) {
  const result = useColumnFilters(rows, filters, getters);
  return <output>{result.map((row) => row.id).join(",")}</output>;
}

function NumericHeader({ selected, onChange }: { selected?: string[]; onChange: (col: string, values: string[] | undefined) => void }) {
  return (
    <FilterHeader label="Score" col="score" rows={rows} getValue={(row) => row.score} selected={selected} onChange={onChange} iconOnly>
      Score
    </FilterHeader>
  );
}

describe("TableColumnFilter rich behavior", () => {
  it("filters primitives, missing values, undefined filters, and unknown getter columns", () => {
    const { rerender } = render(<FilterProbe filters={{ sector: ["Media"] }} />);
    expect(screen.getByText("1")).toBeTruthy();
    rerender(<FilterProbe filters={{ sector: ["—"] }} />);
    expect(screen.getByText("3")).toBeTruthy();
    rerender(<FilterProbe filters={{ sector: undefined }} />);
    expect(screen.getByText("1,2,3")).toBeTruthy();
    rerender(<FilterProbe filters={{ unknown: ["anything"] }} />);
    expect(screen.getByText("1,2,3")).toBeTruthy();
    rerender(<FilterProbe filters={{ score: [] }} />);
    expect(document.querySelector("output")?.textContent).toBe("");
  });

  it("orders numeric options, searches, removes values, and restores an all-selected set", () => {
    const onChange = vi.fn();
    const { rerender } = render(<NumericHeader selected={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Filter Score" }));
    expect(screen.getAllByRole("checkbox").map((box) => box.parentElement?.textContent)).toEqual(["2", "10", "—"]);

    fireEvent.click(screen.getByRole("checkbox", { name: "2" }));
    expect(onChange).toHaveBeenLastCalledWith("score", ["10", "—"]);

    rerender(<NumericHeader selected={["10", "—"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "2" }));
    expect(onChange).toHaveBeenLastCalledWith("score", undefined);

    fireEvent.change(screen.getByRole("textbox", { name: "Search Score values" }), { target: { value: " 10 " } });
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Close Score filter" }));
    expect(screen.queryByRole("dialog", { name: "Filter Score" })).toBeNull();
  });

  it("supports sortable header semantics and all sort directions", () => {
    const onSort = vi.fn();
    const onChange = vi.fn();
    const renderHeader = (sortState: SortState) => (
      <FilterHeader
        label="Sector"
        col="sector"
        rows={rows}
        getValue={(row) => row.sector}
        selected={[]}
        onChange={onChange}
        sortable
        sortState={sortState}
        onSort={onSort}
        asHeaderCell
        className="custom"
      >
        Sector label
      </FilterHeader>
    );
    const { rerender } = render(renderHeader(null));
    const cell = screen.getByRole("columnheader");
    expect(cell.getAttribute("aria-sort")).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: "Sort Sector ascending" }));
    expect(onSort).toHaveBeenCalledWith("sector");

    rerender(renderHeader({ col: "sector", dir: "asc" }));
    expect(screen.getByRole("columnheader").getAttribute("aria-sort")).toBe("ascending");
    expect(screen.getByRole("button", { name: "Sort Sector descending" }).className).toContain("custom");

    rerender(renderHeader({ col: "sector", dir: "desc" }));
    expect(screen.getByRole("columnheader").getAttribute("aria-sort")).toBe("descending");
    fireEvent.click(screen.getByRole("button", { name: "Sort Sector clear sort on" }));
    expect(onSort).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Filter Sector" }));
    expect(screen.getByRole("dialog", { name: "Filter Sector" })).toBeTruthy();
  });

  it("traps dialog focus, ignores inside pointers, closes on escape, and renders a header-cell trigger", () => {
    const onChange = vi.fn();
    render(
      <FilterHeader label="Sector" col="sector" rows={rows} getValue={(row) => row.sector} onChange={onChange} asHeaderCell>
        Sector
      </FilterHeader>,
    );
    expect(screen.getByRole("columnheader")).toBeTruthy();
    const trigger = screen.getByRole("button", { name: "Filter Sector" });
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({ left: -30, bottom: 900 } as DOMRect);
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Filter Sector" });
    expect(dialog.style.left).toBe("8px");
    fireEvent.pointerDown(dialog);
    expect(screen.getByRole("dialog", { name: "Filter Sector" })).toBeTruthy();

    const close = screen.getByRole("button", { name: "Close Sector filter" });
    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    checkboxes.at(-1)!.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    close.focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(checkboxes.at(-1));

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Filter Sector" })).toBeNull();
  });
});
