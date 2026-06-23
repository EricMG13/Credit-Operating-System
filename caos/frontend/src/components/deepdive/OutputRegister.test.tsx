// @vitest-environment jsdom
//
// Coverage scaffold for the deep-dive Output Register — the previously-untested
// component flagged by `fallow health` (OutputRegister + its StepOutputModal).
// Driven by the real MODULE_STEPS fixtures: we pick the first registered module
// so the test stays valid as the workflow data evolves.

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { OutputRegister, StepOutputModal } from "./OutputRegister";
import { MODULE_STEPS, type StepRow } from "@/lib/deepdive/module-steps";

const [SAMPLE_ID, SAMPLE_STEPS] = Object.entries(MODULE_STEPS)[0];
const FIRST_STEP: StepRow = SAMPLE_STEPS[0];

afterEach(cleanup);

describe("OutputRegister", () => {
  it("renders nothing for a module with no registered steps", () => {
    const { container } = render(<OutputRegister id="NOT-A-MODULE" onOpenEvidence={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the workflow-step summary header when open", () => {
    render(<OutputRegister id={SAMPLE_ID} onOpenEvidence={() => {}} />);
    expect(screen.getByText(/required outputs/)).toBeTruthy();
    expect(screen.getByText(new RegExp(`${SAMPLE_STEPS.length} workflow steps`))).toBeTruthy();
  });

  it("collapses the step grid when the header is toggled", () => {
    render(<OutputRegister id={SAMPLE_ID} defaultOpen onOpenEvidence={() => {}} />);
    const before = screen.getAllByRole("button").length; // header + one per step
    fireEvent.click(screen.getByRole("button", { name: /required outputs/i }));
    expect(screen.getAllByRole("button").length).toBeLessThan(before);
  });

  it("opens the step-output modal when a step is clicked", () => {
    render(<OutputRegister id={SAMPLE_ID} defaultOpen onOpenEvidence={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]); // buttons[0] is the header; [1] is the first step
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("StepOutputModal", () => {
  it("renders the step in a labelled dialog", () => {
    render(<StepOutputModal id={SAMPLE_ID} step={FIRST_STEP} onClose={() => {}} onOpenEvidence={() => {}} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-label")).toBe("Module output register");
    if (FIRST_STEP[1]) expect(screen.getAllByText(FIRST_STEP[1]).length).toBeGreaterThan(0);
  });

  it("calls onClose from the close control", () => {
    const onClose = vi.fn();
    render(<StepOutputModal id={SAMPLE_ID} step={FIRST_STEP} onClose={onClose} onOpenEvidence={() => {}} />);
    fireEvent.click(screen.getByText("✕"));
    expect(onClose).toHaveBeenCalled();
  });
});
