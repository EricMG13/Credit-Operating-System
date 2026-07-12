// @vitest-environment jsdom
//
// Coverage scaffold for the deep-dive Output Register — the previously-untested
// component flagged by `fallow health` (OutputRegister + its StepOutputModal).
// Driven by the real MODULE_STEPS fixtures: we pick the first registered module
// so the test stays valid as the workflow data evolves.

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { OutputRegister, StepOutputGrid, StepOutputModal } from "./OutputRegister";
import { MODULE_STEPS, type StepRow } from "@/lib/deepdive/module-steps";
import { STEP_OUTPUTS } from "@/lib/deepdive/step-outputs";
import { STEP_NOTES } from "@/lib/deepdive/step-notes";

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
const CONSOLIDATED_ID = "__TEST_CONSOLIDATED__";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
  delete MODULE_STEPS[CONSOLIDATED_ID];
  Object.keys(STEP_OUTPUTS).forEach((key) => { if (key.startsWith(CONSOLIDATED_ID + ":")) delete STEP_OUTPUTS[key]; });
  Object.keys(STEP_NOTES).forEach((key) => { if (key.startsWith(CONSOLIDATED_ID + ":")) delete STEP_NOTES[key]; });
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

describe("StepOutputGrid", () => {
  function seedConsolidationFixture(count = 5) {
    MODULE_STEPS[CONSOLIDATED_ID] = Array.from({ length: count }, (_, i) => {
      const name = "Coverage step " + (i + 1);
      STEP_OUTPUTS[CONSOLIDATED_ID + ":" + name] = {
        sections: [{ type: "text", title: "Coverage · fixture " + (i + 1), body: "Fixture body " + (i + 1) }],
      };
      STEP_NOTES[CONSOLIDATED_ID + ":" + name] = { body: "Narrative " + (i + 1) };
      return ["T" + (i + 1), name, "ok"];
    });
  }

  it("consolidates repeated same-prefix report cards", () => {
    seedConsolidationFixture();
    render(<StepOutputGrid id={CONSOLIDATED_ID} mode="report" onOpenEvidence={() => {}} />);

    expect(screen.getByText("5 steps consolidated")).toBeTruthy();
    expect(screen.getByText("Coverage")).toBeTruthy();
  });

  it("summary mode shows narrative summaries without full step output", () => {
    seedConsolidationFixture(2);
    render(<StepOutputGrid id={CONSOLIDATED_ID} mode="summary" onOpenEvidence={() => {}} />);

    expect(screen.getByText(/workflow step summary/i)).toBeTruthy();
    expect(screen.getByText("Narrative 1")).toBeTruthy();
    expect(screen.queryByText("Fixture body 1")).toBeNull();
  });

  it("keeps dense mode unconsolidated", () => {
    seedConsolidationFixture();
    render(<StepOutputGrid id={CONSOLIDATED_ID} mode="dense" onOpenEvidence={() => {}} />);

    expect(screen.queryByText(/steps consolidated/)).toBeNull();
    expect(screen.getByText("Coverage step 1")).toBeTruthy();
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
