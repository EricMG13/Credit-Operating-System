// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StandingViewStrip } from "./StandingViewStrip";
import { DEBATE, SIZING } from "@/lib/reports/deal";

const updateAnalystWorkspace = vi.fn();

vi.mock("@/lib/api", () => ({
  updateAnalystWorkspace: (...a: unknown[]) => updateAnalystWorkspace(...a),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  updateAnalystWorkspace.mockResolvedValue({});
});

describe("StandingViewStrip", () => {
  it("a real (non-reference) issuer with no CP-6 verdict shows an honest empty state — never a fixture", () => {
    render(<StandingViewStrip isReference={false} issuerId="iss-1" runId="run-1" onRevise={() => {}} />);
    expect(screen.getByText("No standing view — run CP-6 to establish one.")).toBeTruthy();
    expect(screen.queryByText("Note agreement")).toBeNull();
    expect(screen.queryByText(DEBATE.bias.split(" — ")[0])).toBeNull();
  });

  it("the reference issuer shows the DEBATE/SIZING fixture tagged DEMO, never LIVE", () => {
    render(<StandingViewStrip isReference issuerId="atlas-forge" runId={null} onRevise={() => {}} />);
    expect(screen.getByText(SIZING.decision, { exact: false })).toBeTruthy();
    expect(screen.getByText("DEMO")).toBeTruthy();
    expect(screen.getByTitle(/Atlas Forge reference fixture/)).toBeTruthy();
  });

  it("Affirm writes a workspace annotation and flips to an Affirmed state", async () => {
    render(<StandingViewStrip isReference issuerId="atlas-forge" runId={null} onRevise={() => {}} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Note agreement" }));
    });
    expect(updateAnalystWorkspace).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "Noted" })).toBeTruthy();
  });

  it("Affirm caps the stored list at 20 entries, dropping the oldest", async () => {
    const prior = Array.from({ length: 20 }, (_, i) => ({
      issuerId: "atlas-forge",
      runId: null,
      stance: `stance-${i}`,
      ts: "2026-01-01T00:00:00Z",
    }));
    let captured: unknown[] = [];
    updateAnalystWorkspace.mockImplementation(async (patch: (ws: Record<string, unknown>) => Record<string, unknown>) => {
      const next = patch({ affirmations: prior });
      captured = next.affirmations as unknown[];
      return {};
    });
    render(<StandingViewStrip isReference issuerId="atlas-forge" runId={null} onRevise={() => {}} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Note agreement" }));
    });
    expect(captured).toHaveLength(20);
    expect(captured[0]).toMatchObject({ issuerId: "atlas-forge" });
    expect(captured[19]).toMatchObject({ stance: "stance-18" });
  });

  it("returns a failed personal annotation to a retryable idle state", async () => {
    updateAnalystWorkspace.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({});
    render(<StandingViewStrip isReference issuerId="atlas-forge" runId={null} onRevise={() => {}} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Note agreement" }));
    });
    expect(screen.getByRole("button", { name: "Note agreement" }).getAttribute("aria-disabled")).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Note agreement" }));
    });
    expect(await screen.findByRole("button", { name: "Noted" })).toBeTruthy();
    expect(updateAnalystWorkspace).toHaveBeenCalledTimes(2);
  });

  it("Revise deep-links to CP-6A", () => {
    const onRevise = vi.fn();
    render(<StandingViewStrip isReference issuerId="atlas-forge" runId={null} onRevise={onRevise} />);
    fireEvent.click(screen.getByRole("button", { name: "Revise" }));
    expect(onRevise).toHaveBeenCalledWith("CP-6A");
  });
});
