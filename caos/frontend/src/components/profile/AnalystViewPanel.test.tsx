// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn() }));

vi.mock("@/lib/analyst-opinions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analyst-opinions")>();
  return { ...actual, analystOpinionsApi: { list: mocks.list, create: mocks.create } };
});

vi.mock("@/lib/api", () => ({
  toErrorMessage: (reason: unknown, fallback: string) => reason instanceof Error ? reason.message : fallback,
}));

import { AnalystViewPanel } from "./AnalystViewPanel";
import type { AnalystOpinionVersion } from "@/lib/analyst-opinions";

const current: AnalystOpinionVersion = {
  id: "opinion-1",
  issuer_id: "issuer-1",
  analyst_id: "analyst-1",
  version: 1,
  stance: "UNDERWEIGHT",
  conviction: 70,
  rationale_md: "Liquidity pressure remains unresolved.",
  evidence_state: "supported",
  unresolved_items: [],
  thesis_version_id: null,
  source_run_id: "run-1",
  context_id: "context-1",
  analyst_link_ids: [],
  created_at: "2026-07-18T10:00:00Z",
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue({ current, items: [current] });
  mocks.create.mockResolvedValue({ ...current, id: "opinion-2", version: 2, conviction: 85, evidence_state: "provisional", unresolved_items: ["Confirm liquidity"] });
});

describe("AnalystViewPanel", () => {
  it("hydrates, validates, gates provisional evidence, and publishes an append-only version", async () => {
    render(<AnalystViewPanel issuerId="issuer-1" systemStance="OVERWEIGHT" sourceRunId="run-2" contextId="context-2" />);

    expect(await screen.findByText("Underweight · 70%")).toBeTruthy();
    expect(screen.getByText("Differs from system")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Conviction · 0–100%"), { target: { value: "101" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish new version" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Conviction must be a finite percentage");
    expect(mocks.create).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Conviction · 0–100%"), { target: { value: "85" } });
    fireEvent.change(screen.getByLabelText("Evidence state"), { target: { value: "provisional" } });
    expect((screen.getByRole("button", { name: "Publish new version" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Unresolved items/), { target: { value: " Confirm liquidity \n" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish new version" }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith("issuer-1", expect.objectContaining({
      conviction: 85,
      evidence_state: "provisional",
      unresolved_items: ["Confirm liquidity"],
      source_run_id: "run-2",
      context_id: "context-2",
    })));
    expect(await screen.findByText("v2 · append-only")).toBeTruthy();
  });
});
