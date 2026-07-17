// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ASSUMPTIONS, DEFAULT_CASE, type Assumptions } from "@/lib/reports/assumptions";
import { AssumptionsPanel } from "./AssumptionsPanel";

afterEach(cleanup);

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
});
