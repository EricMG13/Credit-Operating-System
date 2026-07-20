// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ASSUMPTIONS, DEFAULT_CASE, type Assumptions } from "@/lib/reports/assumptions";
import { AssumptionsPanel } from "./AssumptionsPanel";

afterEach(() => { cleanup(); vi.useRealTimers(); });

const callbacks = () => ({
  onChange: vi.fn(),
  onChangeYear: vi.fn(),
  onResetCase: vi.fn(),
  onResetYearCell: vi.fn(),
  onScrub: vi.fn(),
  onScrubEnd: vi.fn(),
  onCollapse: vi.fn(),
});

function renderPanel(assumptions: Assumptions = DEFAULT_ASSUMPTIONS) {
  const props = callbacks();
  render(<AssumptionsPanel assumptions={assumptions} {...props} />);
  return props;
}

describe("Model Builder assumption feature contracts", () => {
  it("model-09 switches between independent base and downside case controls", () => {
    const props = renderPanel();
    const base = screen.getByRole("button", { name: "Base" });
    const downside = screen.getByRole("button", { name: "Downside" });
    expect(base.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(downside);
    expect(downside.getAttribute("aria-pressed")).toBe("true");
    fireEvent.change(screen.getByRole("spinbutton", { name: "Drivetrain — all years" }), { target: { value: "-2.5" } });
    expect(props.onChange).toHaveBeenCalledWith("down", "gDrive", -0.025);
  });

  it("model-10 model-11 applies bounded typed edits and emits the scrub lifecycle for live recomputation", () => {
    const props = renderPanel();
    const input = screen.getByRole("spinbutton", { name: "Drivetrain — all years" }) as HTMLInputElement & {
      setPointerCapture: (id: number) => void;
      releasePointerCapture: (id: number) => void;
    };

    fireEvent.change(input, { target: { value: "99" } });
    expect(props.onChange).toHaveBeenLastCalledWith("base", "gDrive", 0.1);

    input.setPointerCapture = vi.fn();
    input.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(input, { button: 0, clientX: 10, pointerId: 7 });
    fireEvent.pointerMove(input, { clientX: 18, pointerId: 7 });
    fireEvent.pointerUp(input, { clientX: 18, pointerId: 7 });
    expect(props.onScrub).toHaveBeenCalledWith("base", "gDrive", "all");
    expect(props.onScrubEnd).toHaveBeenCalledTimes(1);
  });

  it("model-12 model-14 writes a single-year override and exposes its keyboard-operable clear action", () => {
    const assumptions: Assumptions = {
      ...DEFAULT_ASSUMPTIONS,
      baseYears: { 1: { gDrive: 0.04 } },
    };
    const props = renderPanel(assumptions);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Drivetrain — FY27e" }), { target: { value: "3" } });
    expect(props.onChangeYear).toHaveBeenCalledWith("base", 1, "gDrive", 0.03);

    fireEvent.click(screen.getByRole("button", { name: "Clear Drivetrain FY27e override" }));
    expect(props.onResetYearCell).toHaveBeenCalledWith("base", 1, "gDrive");
  });

  it("model-13 requires an explicit second activation before resetting a modified case", () => {
    const assumptions: Assumptions = {
      ...DEFAULT_ASSUMPTIONS,
      base: { ...DEFAULT_CASE, gDrive: 0.03 },
    };
    const props = renderPanel(assumptions);
    fireEvent.click(screen.getByRole("button", { name: /Reset 1 base change/ }));
    expect(props.onResetCase).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm reset base case" }));
    expect(props.onResetCase).toHaveBeenCalledWith("base");
  });

  it("model-15 exposes a named panel-collapse action without mutating assumptions", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Collapse Assumptions panel" }));
    expect(props.onCollapse).toHaveBeenCalledTimes(1);
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("collapses and re-expands driver groups and supports a panel without collapse chrome", () => {
    const props = callbacks();
    const { onCollapse: _onCollapse, ...required } = props;
    render(<AssumptionsPanel assumptions={DEFAULT_ASSUMPTIONS} {...required} />);

    expect(screen.queryByRole("button", { name: "Collapse Assumptions panel" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Base" }));
    fireEvent.click(screen.getByRole("button", { name: "Collapse Revenue growth (Δ / yr) drivers" }));
    expect(screen.queryByRole("spinbutton", { name: "Drivetrain — all years" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand Revenue growth (Δ / yr) drivers" }));
    expect(screen.getByRole("spinbutton", { name: "Drivetrain — all years" })).toBeTruthy();
  });

  it("handles scrub thresholds, cancellation, release errors, invalid typing, and double-click reset", () => {
    const props = renderPanel();
    const allYears = screen.getByRole("spinbutton", { name: "Drivetrain — all years" }) as HTMLInputElement & {
      setPointerCapture: (id: number) => void;
      releasePointerCapture: (id: number) => void;
    };
    allYears.setPointerCapture = vi.fn();
    allYears.releasePointerCapture = vi.fn();

    fireEvent.pointerDown(allYears, { button: 1, clientX: 10, pointerId: 1 });
    fireEvent.pointerMove(allYears, { clientX: 20, pointerId: 1 });
    fireEvent.pointerDown(allYears, { button: 0, clientX: 10, pointerId: 2 });
    fireEvent.pointerMove(allYears, { clientX: 11, pointerId: 2 });
    fireEvent.pointerCancel(allYears, { pointerId: 2 });
    expect(props.onScrub).not.toHaveBeenCalled();

    fireEvent.pointerDown(allYears, { button: 0, clientX: 10, pointerId: 3 });
    fireEvent.pointerMove(allYears, { clientX: 18, pointerId: 3 });
    fireEvent.pointerCancel(allYears, { pointerId: 3 });
    expect(props.onScrub).toHaveBeenCalledWith("base", "gDrive", "all");
    expect(props.onScrubEnd).toHaveBeenCalledTimes(1);

    const year = screen.getByRole("spinbutton", { name: "Drivetrain — FY26e" }) as HTMLInputElement & {
      setPointerCapture: (id: number) => void;
      releasePointerCapture: (id: number) => void;
    };
    year.setPointerCapture = vi.fn();
    year.releasePointerCapture = vi.fn(() => { throw new Error("capture already lost"); });
    fireEvent.pointerDown(year, { button: 0, clientX: 10, pointerId: 4 });
    fireEvent.pointerMove(year, { clientX: 18, pointerId: 4 });
    fireEvent.pointerUp(year, { clientX: 18, pointerId: 4 });
    expect(props.onScrub).toHaveBeenCalledWith("base", "gDrive", 0);

    const beforeInvalid = props.onChange.mock.calls.length;
    fireEvent.change(allYears, { target: { value: "" } });
    expect(props.onChange).toHaveBeenCalledTimes(beforeInvalid);
    fireEvent.change(allYears, { target: { value: "-99" } });
    expect(props.onChange).toHaveBeenLastCalledWith("base", "gDrive", -0.1);
    fireEvent.doubleClick(allYears);
    expect(props.onChange).toHaveBeenLastCalledWith("base", "gDrive", DEFAULT_CASE.gDrive);
  });

  it("keeps scrubbing functional when lifecycle callbacks are omitted", () => {
    const props = callbacks();
    render(<AssumptionsPanel
      assumptions={DEFAULT_ASSUMPTIONS}
      onChange={props.onChange}
      onChangeYear={props.onChangeYear}
      onResetCase={props.onResetCase}
      onResetYearCell={props.onResetYearCell}
    />);
    const input = screen.getByRole("spinbutton", { name: "Drivetrain — all years" }) as HTMLInputElement & {
      setPointerCapture: (id: number) => void;
      releasePointerCapture: (id: number) => void;
    };
    input.setPointerCapture = vi.fn();
    input.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(input, { button: 0, clientX: 10, pointerId: 5 });
    fireEvent.pointerMove(input, { clientX: 18, pointerId: 5 });
    fireEvent.pointerCancel(input, { pointerId: 5 });
    expect(props.onChange).toHaveBeenCalled();
  });

  it("disarms a plural case reset on blur and on timeout", () => {
    vi.useFakeTimers();
    const assumptions: Assumptions = {
      ...DEFAULT_ASSUMPTIONS,
      base: { ...DEFAULT_CASE, gDrive: 0.03, gFluid: 0.02 },
      baseYears: { 1: { gDrive: 0.04 } },
    };
    const props = renderPanel(assumptions);
    fireEvent.click(screen.getByRole("button", { name: /Reset 3 base changes/ }));
    fireEvent.blur(screen.getByRole("button", { name: "Confirm reset base case" }));
    expect(screen.getByRole("button", { name: /Reset 3 base changes/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Reset 3 base changes/ }));
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByRole("button", { name: /Reset 3 base changes/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Reset 3 base changes/ }));
    expect(screen.getByRole("button", { name: "Confirm reset base case" })).toBeTruthy();
    expect(props.onResetCase).not.toHaveBeenCalled();
  });

  it("treats missing year-override maps as empty for both cases", () => {
    const assumptions: Assumptions = {
      ...DEFAULT_ASSUMPTIONS,
      baseYears: undefined as unknown as Assumptions["baseYears"],
      downYears: undefined as unknown as Assumptions["downYears"],
    };
    const props = renderPanel(assumptions);
    expect(screen.getByRole("spinbutton", { name: "Drivetrain — FY26e" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Downside" }));
    expect(screen.getByRole("spinbutton", { name: "Drivetrain — FY26e" })).toBeTruthy();
    expect(props.onResetCase).not.toHaveBeenCalled();
  });
});
