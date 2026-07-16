// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { LiveRunState } from "@/lib/engine/useLiveRun";

vi.mock("@/lib/api", () => ({ askIssuer: vi.fn() }));

import { IssuerChat } from "./IssuerChat";

afterEach(() => { cleanup(); sessionStorage.clear(); vi.clearAllMocks(); });

function live(runId: string): LiveRunState {
  return {
    liveOuts: {}, liveStatus: {}, liveEvidence: {}, runId, asOf: null,
    committeeStatus: "Restricted", council: [], loading: false, phase: "complete",
  };
}

describe("IssuerChat transcript boundaries", () => {
  it("loads the new run transcript without writing the prior run into its cache", async () => {
    sessionStorage.setItem("caos-chat-run-a", JSON.stringify([{ role: "user", content: "A only" }]));
    sessionStorage.setItem("caos-chat-run-b", JSON.stringify([{ role: "user", content: "B only" }]));
    const { rerender } = render(<IssuerChat tab="CP-1" onClose={() => {}} live={live("run-a")} issuerName="Issuer A" />);
    expect(await screen.findByText("A only")).toBeTruthy();

    rerender(<IssuerChat tab="CP-1" onClose={() => {}} live={live("run-b")} issuerName="Issuer B" />);
    expect(await screen.findByText("B only")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("A only")).toBeNull());
    expect(JSON.parse(sessionStorage.getItem("caos-chat-run-b") || "[]")).toEqual([
      { role: "user", content: "B only" },
    ]);
  });
});
