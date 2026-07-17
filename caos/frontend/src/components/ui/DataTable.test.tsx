// @vitest-environment jsdom
// Locks the DataTable contract: alignment/tabular by column type, unit-in-header,
// aria-sort wiring, and roving-tabindex row focus (only when onRowActivate is given).
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DataTable, type DataTableColumn } from "./DataTable";

afterEach(cleanup);

interface Row {
  id: string;
  name: string;
  dm: number;
}

const ROWS: Row[] = [
  { id: "a", name: "Acme Holdings", dm: 149 },
  { id: "b", name: "Beta Fiber", dm: 207 },
];

function columns(onSort?: () => void): DataTableColumn<Row>[] {
  return [
    { key: "name", header: "Instrument", rowHeader: true, render: (r) => r.name },
    { key: "dm", header: "DM", align: "numeric", unit: "bp", sortable: Boolean(onSort), render: (r) => String(r.dm) },
  ];
}

describe("DataTable", () => {
  it("renders a units-in-header label and right-aligned tabular numeric cells", () => {
    render(<DataTable columns={columns()} rows={ROWS} getRowId={(r) => r.id} />);
    expect(screen.getByRole("table").className).toContain("caos-data-table");
    expect(screen.getByText("DM (bp)")).toBeTruthy();
    const cell = screen.getByText("149").closest("td");
    expect(cell?.className).toContain("text-right");
    expect(cell?.className).toContain("tabular");
    const nameCell = screen.getByText("Acme Holdings").closest("th");
    expect(nameCell?.className).toContain("text-left");
    expect(nameCell?.getAttribute("scope")).toBe("row");
  });

  it("wires aria-sort and calls onSort from the header button", () => {
    const onSort = vi.fn();
    render(<DataTable columns={columns(onSort)} rows={ROWS} getRowId={(r) => r.id} sort={{ key: "dm", direction: "asc" }} onSort={onSort} />);
    const th = screen.getByText(/DM \(bp\)/).closest("th");
    expect(th?.getAttribute("aria-sort")).toBe("ascending");
    fireEvent.click(screen.getByRole("button", { name: /DM \(bp\)/ }));
    expect(onSort).toHaveBeenCalledWith("dm");
  });

  it("does not advertise a sortable header when no sort callback exists", () => {
    const sortableWithoutHandler: DataTableColumn<Row>[] = [
      { key: "name", header: "Instrument", sortable: true, render: (r) => r.name },
    ];
    render(<DataTable columns={sortableWithoutHandler} rows={ROWS} getRowId={(r) => r.id} />);
    const header = screen.getByText("Instrument").closest("th");
    expect(header?.getAttribute("aria-sort")).toBeNull();
    expect(screen.queryByRole("button", { name: "Instrument" })).toBeNull();
  });

  it("has no row tabIndex/keyboard wiring when onRowActivate is omitted", () => {
    render(<DataTable columns={columns()} rows={ROWS} getRowId={(r) => r.id} />);
    const row = screen.getByText("Acme Holdings").closest("tr");
    expect(row?.getAttribute("tabindex")).toBeNull();
  });

  it("gives the selected row tabIndex 0 and moves focus without activating on ArrowDown", () => {
    const onRowActivate = vi.fn();
    render(
      <DataTable columns={columns()} rows={ROWS} getRowId={(r) => r.id} selectedRowId="a" onRowActivate={onRowActivate} />,
    );
    const rowA = screen.getByText("Acme Holdings").closest("tr") as HTMLElement;
    const rowB = screen.getByText("Beta Fiber").closest("tr") as HTMLElement;
    expect(rowA.getAttribute("tabindex")).toBe("0");
    expect(rowB.getAttribute("tabindex")).toBe("-1");

    rowA.focus();
    fireEvent.keyDown(rowA, { key: "ArrowDown" });
    expect(document.activeElement).toBe(rowB);
    expect(rowB.getAttribute("tabindex")).toBe("0");
    expect(onRowActivate).not.toHaveBeenCalled();
  });

  it("exposes controlled row selection without coupling it to keyboard focus", () => {
    render(<DataTable columns={columns()} rows={ROWS} getRowId={(r) => r.id} selectedRowId="b" onRowActivate={() => undefined} />);
    const rowA = screen.getByText("Acme Holdings").closest("tr")!;
    const rowB = screen.getByText("Beta Fiber").closest("tr")!;
    expect(rowA.getAttribute("aria-selected")).toBe("false");
    expect(rowB.getAttribute("aria-selected")).toBe("true");
  });

  it("fires onRowActivate on click", () => {
    const onRowActivate = vi.fn();
    render(<DataTable columns={columns()} rows={ROWS} getRowId={(r) => r.id} onRowActivate={onRowActivate} />);
    fireEvent.click(screen.getByText("Beta Fiber"));
    expect(onRowActivate).toHaveBeenCalledWith(ROWS[1], 1);
  });

  it("activates a focused row with Enter or Space", () => {
    const onRowActivate = vi.fn();
    render(<DataTable columns={columns()} rows={ROWS} getRowId={(r) => r.id} onRowActivate={onRowActivate} />);
    const row = screen.getByText("Acme Holdings").closest("tr")!;
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });
    expect(onRowActivate).toHaveBeenNthCalledWith(1, ROWS[0], 0);
    expect(onRowActivate).toHaveBeenNthCalledWith(2, ROWS[0], 0);
  });

  it("keeps nested actions out of the default Tab order and isolates their activation", () => {
    const onRowActivate = vi.fn();
    const onAction = vi.fn();
    const actionColumns: DataTableColumn<Row>[] = [
      ...columns(),
      {
        key: "action",
        header: "Action",
        align: "action",
        render: () => <button type="button" onClick={onAction}>Inspect</button>,
      },
    ];
    render(<DataTable columns={actionColumns} rows={ROWS} getRowId={(r) => r.id} onRowActivate={onRowActivate} />);
    const action = screen.getAllByRole("button", { name: "Inspect" })[0];
    expect(action.getAttribute("tabindex")).toBe("-1");
    fireEvent.click(action);
    fireEvent.keyDown(action, { key: "Enter" });
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onRowActivate).not.toHaveBeenCalled();
  });

  it("uses F2 to enter row actions and Escape to restore row focus", () => {
    const actionColumns: DataTableColumn<Row>[] = [
      ...columns(),
      {
        key: "action",
        header: "Action",
        align: "action",
        render: () => <><button type="button" disabled>Unavailable</button><a href="#hidden" tabIndex={-1}>Hidden</a><button type="button">Inspect</button></>,
      },
    ];
    render(<DataTable columns={actionColumns} rows={ROWS} getRowId={(r) => r.id} onRowActivate={() => undefined} caption="Positions" />);
    const row = screen.getByText("Acme Holdings").closest("tr") as HTMLElement;
    const action = screen.getAllByRole("button", { name: "Inspect" })[0];
    expect(screen.getAllByRole("button", { name: "Unavailable" })[0].getAttribute("tabindex")).toBe("-1");
    expect(screen.getAllByRole("link", { name: "Hidden" })[0].getAttribute("tabindex")).toBe("-1");
    row.focus();
    fireEvent.keyDown(row, { key: "F2" });
    expect(action.getAttribute("tabindex")).toBe("0");
    expect(document.activeElement).toBe(action);
    fireEvent.keyDown(action, { key: "Escape" });
    expect(action.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(row);
    const table = screen.getByRole("table", { name: "Positions" });
    expect(table.getAttribute("aria-describedby")).toBe(screen.getByText(/Press Enter to open a row or F2/).id);
  });
});
