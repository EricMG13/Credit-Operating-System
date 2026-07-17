// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveRunState } from "@/lib/engine/useLiveRun";

const controls = vi.hoisted(() => ({
  active: null as string | null,
  askIssuer: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ askIssuer: controls.askIssuer }));
vi.mock("@/lib/evidence-sync", () => ({
  useEvidenceSync: () => ({ active: controls.active, setActive: vi.fn() }),
}));

import { IssuerChat } from "./IssuerChat";

function live(runId: string | null, overrides: Partial<LiveRunState> = {}): LiveRunState {
  return {
    liveOuts: {},
    liveStatus: {},
    liveEvidence: {},
    runId,
    asOf: null,
    committeeStatus: "Restricted",
    council: [],
    loading: false,
    phase: "complete",
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  controls.active = null;
  controls.askIssuer.mockReset();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("IssuerChat interactions", () => {
  it("submits from the composer, blocks duplicate sends, clears the transcript, and closes by keyboard or button", async () => {
    const pending = deferred<string>();
    controls.askIssuer.mockReturnValue(pending.promise);
    const onClose = vi.fn();
    render(<IssuerChat tab="CP-4" onClose={onClose} />);

    const input = screen.getByLabelText("Ask a question about this issuer") as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    expect(screen.getByText(/All figures mock/)).toBeTruthy();
    expect((screen.getByTitle("Send") as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(input, { target: { value: "  What is the covenant risk?  " } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(controls.askIssuer).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText("What is the covenant risk?")).toBeTruthy();
    expect(screen.getByText("querying run outputs…")).toBeTruthy();

    fireEvent.change(input, { target: { value: "duplicate" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(screen.getByTitle("Send"));
    expect(controls.askIssuer).toHaveBeenCalledTimes(1);
    expect(controls.askIssuer.mock.calls[0][0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "user", content: expect.stringContaining("Atlas Forge") }),
      { role: "assistant", content: expect.stringContaining("RUN #2641 outputs for ATLF") },
      { role: "user", content: "What is the covenant risk?" },
    ]));

    await act(async () => pending.resolve("  CP-4 supports the answer.  "));
    expect(await screen.findByText("CP-4 supports the answer.")).toBeTruthy();
    expect(document.activeElement).toBe(input);

    fireEvent.click(screen.getByTitle("Clear conversation"));
    await waitFor(() => expect(screen.queryByText("What is the covenant risk?")).toBeNull());
    expect(screen.getByText("Why is clearance conditional?")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close chat" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("sends a starter with live evidence focus and renders an empty reply fallback", async () => {
    controls.active = "E-44";
    controls.askIssuer.mockResolvedValue(undefined);
    render(<IssuerChat tab="CP-1C" onClose={() => {}} live={live("abcdefgh-1234")} />);

    expect(await screen.findByText("E-44")).toBeTruthy();
    expect(screen.getByRole("dialog").getAttribute("aria-label")).toBe("this issuer · Issuer Q&A");
    expect(screen.getByText(/grounded in run abcdefgh · viewing CP-1C/)).toBeTruthy();
    expect(screen.queryByText(/All figures mock/)).toBeNull();

    fireEvent.click(screen.getByText("Why is clearance conditional?"));
    expect(await screen.findByText("(no response)")).toBeTruthy();
    expect(controls.askIssuer.mock.calls[0][0][0].content).toContain("ANALYST IS POINTING AT EVIDENCE E-44");

    fireEvent.click(screen.getByLabelText("Clear focus context"));
    expect(screen.queryByText("In focus")).toBeNull();
  });

  it.each([
    [{ response: { data: { detail: "backend detail" } } }, "backend detail"],
    [new Error("network down"), "network down"],
    [{}, "rate-limited or offline"],
  ])("renders the most useful chat failure detail for %p", async (failure, detail) => {
    controls.askIssuer.mockRejectedValue(failure);
    render(<IssuerChat tab="" onClose={() => {}} live={live("run-errors", { committeeStatus: null })} issuerName="Error Co" />);

    const input = screen.getByLabelText("Ask a question about this issuer");
    fireEvent.change(input, { target: { value: "Explain" } });
    fireEvent.click(screen.getByTitle("Send"));

    expect(await screen.findByText(`Chat call failed (${detail}). Try again.`)).toBeTruthy();
    expect(screen.getByText("Credit OS")).toBeTruthy();
    expect(document.activeElement).toBe(input);
  });

  it("discards a successful response from a prior run generation", async () => {
    const pending = deferred<string>();
    controls.askIssuer.mockReturnValue(pending.promise);
    const { rerender } = render(
      <IssuerChat tab="CP-1" onClose={() => {}} live={live("run-a")} issuerName="Issuer A" />,
    );
    fireEvent.change(screen.getByLabelText("Ask a question about this issuer"), { target: { value: "Old run question" } });
    fireEvent.click(screen.getByTitle("Send"));

    rerender(<IssuerChat tab="CP-1" onClose={() => {}} live={live("run-b")} issuerName="Issuer B" />);
    await act(async () => pending.resolve("stale answer"));

    await waitFor(() => expect(screen.queryByText("querying run outputs…")).toBeNull());
    expect(screen.queryByText("stale answer")).toBeNull();
    expect(screen.queryByText("Old run question")).toBeNull();
  });

  it("discards a failed response from a prior run generation", async () => {
    const pending = deferred<string>();
    controls.askIssuer.mockReturnValue(pending.promise);
    const { rerender } = render(<IssuerChat tab="CP-1" onClose={() => {}} live={live("run-c")} />);
    fireEvent.change(screen.getByLabelText("Ask a question about this issuer"), { target: { value: "Old failure" } });
    fireEvent.click(screen.getByTitle("Send"));

    rerender(<IssuerChat tab="CP-2" onClose={() => {}} live={live("run-d")} />);
    await act(async () => pending.reject(new Error("stale failure")));

    await waitFor(() => expect(screen.queryByText("querying run outputs…")).toBeNull());
    expect(screen.queryByText(/stale failure/)).toBeNull();
  });

  it("degrades safely when cached JSON or browser storage is unavailable", async () => {
    sessionStorage.setItem("caos-chat-broken", "{");
    const getSpy = vi.spyOn(Storage.prototype, "getItem");
    getSpy.mockImplementationOnce(() => { throw new Error("storage denied"); });
    const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage denied"); });

    expect(() => render(<IssuerChat tab="CP-1" onClose={() => {}} live={live("broken")} />)).not.toThrow();
    expect(await screen.findByText("Why is clearance conditional?")).toBeTruthy();
    expect(setSpy).toHaveBeenCalled();
  });

  it("treats a cached JSON null as an empty transcript", async () => {
    sessionStorage.setItem("caos-chat-null-cache", "null");
    render(<IssuerChat tab="CP-1" onClose={() => {}} live={live("null-cache")} />);
    expect(await screen.findByText("Why is clearance conditional?")).toBeTruthy();
    expect(screen.queryByTitle("Clear conversation")).toBeNull();
  });
});
