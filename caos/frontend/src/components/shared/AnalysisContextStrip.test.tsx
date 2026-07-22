// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getContext, listFindings } = vi.hoisted(() => ({
  getContext: vi.fn(),
  listFindings: vi.fn(),
}));

vi.mock("@/lib/analysis-workbench", () => ({
  activeFindings: (findings: unknown[]) => findings,
  analysisApi: { getContext, listFindings },
}));

import { AnalysisContextStrip } from "./AnalysisContextStrip";

const CONTEXT = {
  id: "context-12345678",
  name: "Special Situations",
  sector_id: "industrials",
  issuer_ids: ["issuer-1"],
  instrument_ids: ["instrument-1"],
  as_of: "2026-07-18",
};

describe("AnalysisContextStrip", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/command");
    getContext.mockReset();
    listFindings.mockReset();
  });

  afterEach(() => cleanup());

  it("reserves the collapsed strip geometry before context resolves", () => {
    render(<AnalysisContextStrip />);

    const pending = screen.getByRole("status");
    expect(pending.textContent).toContain("Analysis context · resolving");
    expect(pending.className).toContain("min-h-12");
    expect(pending.className).toContain("md:min-h-8");
    expect(pending.getAttribute("aria-busy")).toBe("true");
  });

  it("settles the context-free Settings utility strip without a busy state", () => {
    window.history.replaceState({}, "", "/settings");
    render(<AnalysisContextStrip />);

    const settled = screen.getByRole("status");
    expect(settled.textContent).toContain("Workspace configuration · no analysis context");
    expect(settled.className).toContain("min-h-12");
    expect(settled.className).toContain("md:min-h-8");
    expect(settled.getAttribute("aria-busy")).toBeNull();
    expect(getContext).not.toHaveBeenCalled();
    expect(listFindings).not.toHaveBeenCalled();
  });

  it("replaces the reserved row in place after independently rechecking context", async () => {
    getContext.mockResolvedValue(CONTEXT);
    listFindings.mockResolvedValue([{ id: "finding-1", title: "Leverage increased", status: "active" }]);
    render(<AnalysisContextStrip />);

    act(() => {
      window.dispatchEvent(new CustomEvent("caos:analysis-context", { detail: CONTEXT }));
    });

    await waitFor(() => expect(screen.queryByText("Special Situations")).not.toBeNull());
    const summary = screen.getByText("Special Situations").closest("summary");
    expect(summary?.className).toContain("min-h-12");
    expect(summary?.className).toContain("md:min-h-8");
    expect(summary?.getAttribute("title")).toBe("Active analysis · Special Situations · industrials · 1 findings");
    expect(getContext).toHaveBeenCalledWith("context-12345678");
    expect(listFindings).toHaveBeenCalledWith("context-12345678");
  });

  it("shows an honest throttled state instead of silently retrying", () => {
    render(<AnalysisContextStrip />);

    act(() => window.dispatchEvent(new Event("caos:analysis-context-throttled")));

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Workspace throttled — retrying");
    expect(status.getAttribute("aria-busy")).toBe("true");
  });

  it("clears the throttled banner once the retried load succeeds", async () => {
    getContext.mockResolvedValue(CONTEXT);
    listFindings.mockResolvedValue([]);
    render(<AnalysisContextStrip />);

    act(() => window.dispatchEvent(new Event("caos:analysis-context-throttled")));
    expect(screen.getByRole("status").textContent).toContain("Workspace throttled — retrying");

    act(() => window.dispatchEvent(new CustomEvent("caos:analysis-context", { detail: CONTEXT })));
    await waitFor(() => expect(screen.queryByText("Special Situations")).not.toBeNull());
    expect(screen.queryByText("Workspace throttled — retrying")).toBeNull();
  });

  it("replaces the reserved row with the existing unavailable state", () => {
    render(<AnalysisContextStrip />);

    act(() => window.dispatchEvent(new Event("caos:analysis-context-error")));

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Analysis context unavailable or not owned by this analyst.");
    expect(alert.className).toContain("min-h-12");
    expect(alert.className).toContain("md:min-h-8");
  });
});
