// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Report } from "@/lib/reports/builders";
import { STEP_OUTPUTS } from "@/lib/deepdive/step-outputs";
import { StepOutputModal } from "@/components/deepdive/OutputRegister";
import { LineagePanel } from "@/components/reports/panels";

const TEST_MODULE = "__TASK_2C_EVIDENCE__";

afterEach(() => {
  cleanup();
  delete STEP_OUTPUTS[`${TEST_MODULE}:Evidence step`];
});

describe("evidence selection integrations", () => {
  it("uses one shared opener for a Deep-Dive output-register evidence inventory", () => {
    const onOpen = vi.fn();
    STEP_OUTPUTS[`${TEST_MODULE}:Evidence step`] = {
      sections: [{ type: "text", title: "Finding", body: "Registered finding", ev: ["E-1", "E-2"] }],
    };
    render(<StepOutputModal id={TEST_MODULE} step={["T1", "Evidence step", "ok"]} onClose={vi.fn()} onOpenEvidence={onOpen} />);

    expect(screen.getByRole("listbox", { name: "Evidence cited" })).toBeTruthy();
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Open source E-1 — Registered evidence" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("option", { name: /E-2/ }));
    fireEvent.click(screen.getByRole("button", { name: "Open source E-2 — Registered evidence" }));
    expect(onOpen).toHaveBeenCalledWith("E-2");
  });

  it("uses row selection and one shared opener in Report Lineage", () => {
    const onOpen = vi.fn();
    const report = {
      id: "memo", title: "Memo", file: "memo.pdf", subtitle: "Committee", icon: "gavel", sections: [],
      srcs: [{ chip: "CP-1", ev: ["E-1", "E-2"] }, { chip: "MKT", ev: ["E-2"] }],
    } as Report;
    const { container } = render(<LineagePanel rep={report} onOpenEvidence={onOpen} />);

    expect(screen.getByRole("listbox", { name: "Report lineage evidence" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Open source E-1 —/ })).toHaveLength(1);
    expect(container.querySelectorAll('[role="option"] button, [role="option"] a')).toHaveLength(0);
    fireEvent.click(screen.getByRole("option", { name: /E-2/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Open source E-2 —/ }));
    expect(onOpen).toHaveBeenCalledWith("E-2");
  });
});
