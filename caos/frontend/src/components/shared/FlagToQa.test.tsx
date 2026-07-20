// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createQaFlag, listQaFlags } from "@/lib/api";
import { FlagToQa } from "./FlagToQa";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  createQaFlag: vi.fn(),
  listQaFlags: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FlagToQa edge states", () => {
  it("can cancel composition and renders a singular existing flag count", async () => {
    vi.mocked(listQaFlags).mockResolvedValue([{}] as never);
    render(<FlagToQa issuerId="issuer-live" moduleId="CP-1" stepRef="step-1" />);
    expect(await screen.findByText("1 flag on file for this step")).toBeTruthy();
    expect(listQaFlags).toHaveBeenCalledWith({ module_id: "CP-1", step_ref: "step-1", issuer_id: "issuer-live" });
    fireEvent.click(screen.getByRole("button", { name: "FLAG TO QA · CP-5" }));
    fireEvent.click(screen.getByRole("button", { name: "CANCEL" }));
    expect(screen.getByRole("button", { name: "FLAG TO QA · CP-5" })).toBeTruthy();
  });

  it("increments an existing count and discloses multiple flags after submit", async () => {
    vi.mocked(listQaFlags).mockResolvedValue([{}] as never);
    vi.mocked(createQaFlag).mockResolvedValue({} as never);
    render(<FlagToQa issuerId="issuer-live" moduleId="CP-1" stepRef="step-1" />);
    await screen.findByText("1 flag on file for this step");
    fireEvent.click(screen.getByRole("button", { name: "FLAG TO QA · CP-5" }));
    fireEvent.change(screen.getByLabelText("Reason for QA (optional)"), { target: { value: "Check source" } });
    fireEvent.click(screen.getByRole("button", { name: "CONFIRM FLAG" }));
    expect(await screen.findByText(/2 on file/)).toBeTruthy();
    expect(createQaFlag).toHaveBeenCalledWith({ module_id: "CP-1", step_ref: "step-1", note: "Check source", issuer_id: "issuer-live" });
  });
});
