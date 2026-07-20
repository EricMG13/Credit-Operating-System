// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildModel } from "@/lib/reports/model";
import { FormulaBar, Manifest, Sheet, type CellRef } from "./ModelSheet";

afterEach(cleanup);

const noop = vi.fn();
const model = buildModel();

function renderSheet(overrides: Partial<{
  model: ReturnType<typeof buildModel>;
  showQ: boolean;
  hl: string | null;
  hlCells: Set<string> | null;
  sel: CellRef | null;
  onSel: (cell: CellRef) => void;
  editing: CellRef | null;
  onEdit: (cell: CellRef) => void;
  onCommit: (value: string | null) => void;
  collapsedRows: Set<string>;
  onToggleRow: (row: string) => void;
  onPasteCells: (result: unknown) => void;
}> = {}) {
  return render(
    <Sheet
      model={overrides.model ?? model}
      showQ={overrides.showQ ?? true}
      hl={overrides.hl ?? null}
      hlCells={overrides.hlCells ?? null}
      sel={overrides.sel ?? null}
      onSel={overrides.onSel ?? noop}
      editing={overrides.editing ?? null}
      onEdit={overrides.onEdit ?? noop}
      onCommit={overrides.onCommit ?? noop}
      collapsedRows={overrides.collapsedRows ?? new Set()}
      onToggleRow={overrides.onToggleRow ?? noop}
      onPasteCells={overrides.onPasteCells}
    />,
  );
}

describe("Model Builder worksheet feature contracts", () => {
  it("model-01 model-33 model-34 renders the cash-flow grid, period groups, labels, and instrument sub-labels", () => {
    renderSheet();

    expect(screen.getByRole("grid", { name: "Model worksheet" })).toBeTruthy();
    const headers = screen.getAllByRole("columnheader").map((header) => header.textContent ?? "");
    for (const label of ["Quarterly", "Historic", "LTM", "PF", "Base Forecast", "Downside Forecast"]) {
      expect(headers.some((header) => header.includes(label))).toBe(true);
    }
    expect(screen.getByRole("rowheader", { name: /Total revenue/ })).toBeTruthy();
    expect(screen.getByText("S+350")).toBeTruthy();
    expect(screen.getByText("* derived period")).toBeTruthy();
  });

  it("model-02 model-36 traces the selected cell and supports arrow, Tab, and Enter keyboard commands", () => {
    const onSel = vi.fn();
    const onEdit = vi.fn();
    renderSheet({ sel: { row: "rev", col: "q0" }, onSel, onEdit });
    const grid = screen.getByRole("grid", { name: "Model worksheet" });

    fireEvent.keyDown(grid, { key: "ArrowRight" });
    expect(onSel).toHaveBeenLastCalledWith({ row: "rev", col: "q1" });
    fireEvent.keyDown(grid, { key: "Tab" });
    expect(onSel).toHaveBeenLastCalledWith({ row: "rev", col: "q1" });
    fireEvent.keyDown(grid, { key: "Enter" });
    expect(onEdit).toHaveBeenCalledWith({ row: "rev", col: "q0" });

    cleanup();
    render(
      <FormulaBar
        model={model}
        sel={{ row: "rev", col: "q0" }}
        overrides={{}}
        onResetCell={noop}
        onOpenEvidence={noop}
        showQ
        collapsedRows={new Set()}
        isReference
      />,
    );
    expect(screen.getByText("A8")).toBeTruthy();
    expect(screen.getByText("Total revenue · Mar-24")).toBeTruthy();
  });

  it("model-03 commits changed historical inputs while Escape and unchanged blur remain cancellations", () => {
    const onCommit = vi.fn();
    renderSheet({ editing: { row: "rev", col: "q0" }, onCommit });
    const edited = screen.getByRole("textbox", { name: "Edit Total revenue, Mar-24" });
    fireEvent.change(edited, { target: { value: "123.4" } });
    fireEvent.keyDown(edited, { key: "Enter" });
    expect(onCommit).toHaveBeenLastCalledWith("123.4");

    cleanup();
    onCommit.mockClear();
    renderSheet({ editing: { row: "rev", col: "q0" }, onCommit });
    const escapeInput = screen.getByRole("textbox", { name: "Edit Total revenue, Mar-24" });
    fireEvent.click(escapeInput);
    fireEvent.keyDown(escapeInput, { key: "Escape" });
    expect(onCommit).toHaveBeenLastCalledWith(null);

    cleanup();
    onCommit.mockClear();
    renderSheet({ editing: { row: "rev", col: "q0" }, onCommit });
    fireEvent.blur(screen.getByRole("textbox", { name: "Edit Total revenue, Mar-24" }));
    expect(onCommit).toHaveBeenLastCalledWith(null);
  });

  it("model-04 model-30 exposes the manual-override indicator and resets the exact selected cell", () => {
    const overrides = { "q0:rev": 123 };
    const onResetCell = vi.fn();
    render(
      <FormulaBar
        model={buildModel(1, overrides)}
        sel={{ row: "rev", col: "q0" }}
        overrides={overrides}
        onResetCell={onResetCell}
        onOpenEvidence={noop}
        showQ
        collapsedRows={new Set()}
        isReference
      />,
    );

    expect(screen.getByText("MANUAL OVERRIDE")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "RESET CELL" }));
    expect(onResetCell).toHaveBeenCalledWith("q0:rev");
  });

  it("model-07 hides the seeded source manifest for live issuers and makes reference chips operable", () => {
    const setHl = vi.fn();
    const view = render(<Manifest hl={null} setHl={setHl} isReference={false} />);
    expect(screen.queryByText("Built from")).toBeNull();

    view.rerender(<Manifest hl={null} setHl={setHl} isReference />);
    expect(screen.getByText("Built from")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "CP-1 T4.7" }));
    expect(setHl).toHaveBeenCalledWith("cp1");

    view.rerender(<Manifest hl="cp1" setHl={setHl} isReference />);
    fireEvent.click(screen.getByRole("button", { name: "CP-1 T4.7" }));
    expect(setHl).toHaveBeenLastCalledWith(null);
  });

  it("model-08 model-28 opens the selected source and discloses the reference derived-period gap", () => {
    const onOpenEvidence = vi.fn();
    render(
      <FormulaBar
        model={model}
        sel={{ row: "rev", col: "q7" }}
        overrides={{}}
        onResetCell={noop}
        onOpenEvidence={onOpenEvidence}
        showQ
        collapsedRows={new Set()}
        isReference
      />,
    );

    expect(screen.getByText(/Q4-25 management accounts missing \(gap G-02\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open source for E-103" }));
    expect(onOpenEvidence).toHaveBeenCalledWith("E-103");
  });

  it("model-39 gives an explicit trace instruction when no worksheet cell is selected", () => {
    render(
      <FormulaBar
        model={model}
        sel={null}
        overrides={{}}
        onResetCell={noop}
        onOpenEvidence={noop}
        showQ
        collapsedRows={new Set()}
      />,
    );
    expect(screen.getByText(/select any cell to trace its formula and source lineage/)).toBeTruthy();
  });

  it("covers grid clicks, editable double-clicks, row collapse, paste, and terminal keyboard keys", () => {
    const onSel = vi.fn();
    const onEdit = vi.fn();
    const onToggleRow = vi.fn();
    const onPasteCells = vi.fn();
    renderSheet({ sel: { row: "rev", col: "q0" }, onSel, onEdit, onToggleRow, onPasteCells });
    const grid = screen.getByRole("grid", { name: "Model worksheet" });
    const editable = document.getElementById("cell-rev-q0")!;
    const forecast = document.getElementById("cell-rev-b0")!;
    fireEvent.click(editable);
    fireEvent.doubleClick(editable);
    fireEvent.doubleClick(forecast);
    expect(onSel).toHaveBeenCalledWith({ row: "rev", col: "q0" });
    expect(onEdit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Collapse Total revenue rows" }));
    expect(onToggleRow).toHaveBeenCalledWith("rev");
    fireEvent.paste(grid, { clipboardData: { getData: () => "100\t200" } });
    expect(onPasteCells).toHaveBeenCalledOnce();
    fireEvent.keyDown(grid, { key: "Home" });

    cleanup();
    onSel.mockClear();
    renderSheet({ sel: { row: "sofr", col: model.columns.at(-1)!.key }, onSel });
    fireEvent.keyDown(screen.getByRole("grid", { name: "Model worksheet" }), { key: "Tab" });
    expect(onSel).not.toHaveBeenCalled();
  });

  it("renders base, downside, live-derived, formula/ref-note, warning, and hidden coordinates", () => {
    const props = {
      model,
      overrides: {},
      onResetCell: noop,
      onOpenEvidence: noop,
      showQ: true,
      collapsedRows: new Set<string>(),
    };
    const view = render(<FormulaBar {...props} sel={{ row: "rev", col: "b0" }} isReference />);
    expect(screen.getByText(/base case = sponsor model/)).toBeTruthy();

    view.rerender(<FormulaBar {...props} sel={{ row: "rev", col: "b0" }} />);
    expect(screen.getByText(/base case = agent forecast/)).toBeTruthy();
    view.rerender(<FormulaBar {...props} sel={{ row: "rev", col: "d0" }} isReference />);
    expect(screen.getByText(/downside = CP-2B pathway P1/)).toBeTruthy();
    view.rerender(<FormulaBar {...props} sel={{ row: "rev", col: "d0" }} />);
    expect(screen.getByText(/downside = CP-2B first-order/)).toBeTruthy();
    view.rerender(<FormulaBar {...props} sel={{ row: "rev", col: "q7" }} />);
    expect(screen.getByText("▸ derived period")).toBeTruthy();

    view.rerender(<FormulaBar {...props} sel={{ row: "int", col: "q0" }} isReference />);
    expect(screen.getByText("L-04")).toBeTruthy();
    expect(screen.getByText(/Cash interest = .*CP-2F T2F.2/)).toBeTruthy();

    view.rerender(<FormulaBar {...props} sel={{ row: "segD", col: "q0" }} isReference collapsedRows={new Set(["rev"])} />);
    expect(screen.getByText(/Drivetrain — sourced from Operating model — segments/)).toBeTruthy();
    expect(screen.queryByText(/^A\d+$/)).toBeNull();

    view.rerender(<FormulaBar {...props} sel={{ row: "rev", col: "q0" }} />);
    expect(screen.getByText(/Total revenue — sourced from model logic/)).toBeTruthy();
  });
});
