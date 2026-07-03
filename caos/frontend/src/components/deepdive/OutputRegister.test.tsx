// @vitest-environment jsdom
//
// Coverage scaffold for the deep-dive Output Register — the previously-untested
// component flagged by `fallow health` (OutputRegister + its StepOutputModal).
// Driven by the real MODULE_STEPS fixtures: we pick the first registered module
// so the test stays valid as the workflow data evolves.

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { OutputRegister, StepOutputModal } from "./OutputRegister";
import { MODULE_STEPS, type StepRow } from "@/lib/deepdive/module-steps";

// The step modal's QA-flag lane talks to the server; keep the suite offline.
vi.mock("@/lib/api", () => ({
  listQaFlags: vi.fn(() => Promise.resolve([])),
  createQaFlag: vi.fn(() =>
    Promise.resolve({
      id: "f1", issuer_id: null, run_id: null, module_id: "CP-X",
      step_ref: null, note: null, analyst_id: "a1", created_at: null,
    }),
  ),
}));
import { createQaFlag, listQaFlags } from "@/lib/api";

const [SAMPLE_ID, SAMPLE_STEPS] = Object.entries(MODULE_STEPS)[0];
const FIRST_STEP: StepRow = SAMPLE_STEPS[0];

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

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

  it("links module export to the mapped Report Studio exhibit", () => {
    render(<StepOutputModal id="CP-4C" step={FIRST_STEP} onClose={() => {}} onOpenEvidence={() => {}} />);
    const link = screen.getByRole("link", { name: /open in module export/i });
    expect(link.getAttribute("href")).toBe("/reports?report=covenant");
  });

  it("falls back to the snapshot exhibit for unmapped modules", () => {
    render(<StepOutputModal id={SAMPLE_ID} step={FIRST_STEP} onClose={() => {}} onOpenEvidence={() => {}} />);
    const link = screen.getByRole("link", { name: /open in module export/i });
    expect(link.getAttribute("href")).toMatch(/^\/reports\?report=/);
  });

  it("records a QA flag through compose → confirm and confirms it", async () => {
    render(<StepOutputModal id={SAMPLE_ID} step={FIRST_STEP} onClose={() => {}} onOpenEvidence={() => {}} />);
    await waitFor(() => expect(listQaFlags).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /flag to qa/i }));
    fireEvent.change(screen.getByPlaceholderText(/what should cp-5 review/i), {
      target: { value: "Numbers disagree with the hero card." },
    });
    fireEvent.click(screen.getByRole("button", { name: /confirm flag/i }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/FLAGGED TO QA/));
    expect(createQaFlag).toHaveBeenCalledWith(
      expect.objectContaining({
        module_id: SAMPLE_ID,
        note: "Numbers disagree with the hero card.",
      }),
    );
  });

  it("surfaces a retryable error when the flag write fails", async () => {
    vi.mocked(createQaFlag).mockRejectedValueOnce(new Error("boom"));
    render(<StepOutputModal id={SAMPLE_ID} step={FIRST_STEP} onClose={() => {}} onOpenEvidence={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /flag to qa/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm flag/i }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/flag failed/i));
    // the action is still available for retry
    expect(screen.getByRole("button", { name: /flag to qa/i })).toBeTruthy();
  });
});
