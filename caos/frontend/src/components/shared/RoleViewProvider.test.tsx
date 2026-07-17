// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { RoleViewProvider, useRoleView } from "./RoleViewProvider";

const getAnalystSettings = vi.fn();
const saveAnalystSettings = vi.fn();

vi.mock("@/lib/api", () => ({
  getAnalystSettings: (...a: unknown[]) => getAnalystSettings(...a),
  saveAnalystSettings: (...a: unknown[]) => saveAnalystSettings(...a),
}));

function Probe() {
  const { roleView, setRoleView } = useRoleView();
  return (
    <div>
      <span data-testid="role">{roleView}</span>
      <button onClick={() => setRoleView("pm")}>pm</button>
      <button onClick={() => setRoleView("qa")}>qa</button>
      <button onClick={() => setRoleView("analyst")}>analyst</button>
    </div>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  getAnalystSettings.mockReset();
  saveAnalystSettings.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("RoleViewProvider", () => {
  it("paints a valid cache immediately and tolerates a failed reconcile", async () => {
    window.localStorage.setItem("caos_role_view", "qa");
    getAnalystSettings.mockRejectedValue(new Error("offline"));
    render(<RoleViewProvider><Probe /></RoleViewProvider>);
    expect(screen.getByTestId("role").textContent).toBe("qa");
    await act(async () => {});
  });
  it("reconciles the server value on mount and persists it locally", async () => {
    getAnalystSettings.mockResolvedValue({ model_lanes: {}, email_intelligence: {}, role_view: "pm" });
    render(
      <RoleViewProvider>
        <Probe />
      </RoleViewProvider>,
    );
    await act(async () => {});
    expect(screen.getByTestId("role").textContent).toBe("pm");
    expect(window.localStorage.getItem("caos_role_view")).toBe("pm");
  });

  it("collapses rapid toggles into ONE read-modify-write PUT preserving sibling maps", async () => {
    const blob = { model_lanes: { module_synthesis: "m" }, email_intelligence: { approved_senders: ["a@b.c"] }, role_view: "analyst" };
    getAnalystSettings.mockResolvedValue(blob);
    saveAnalystSettings.mockImplementation(async (b: unknown) => b);
    render(
      <RoleViewProvider>
        <Probe />
      </RoleViewProvider>,
    );
    await act(async () => {});
    act(() => {
      screen.getByText("pm").click();
      screen.getByText("qa").click();
      screen.getByText("pm").click();
    });
    expect(screen.getByTestId("role").textContent).toBe("pm"); // optimistic
    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    expect(saveAnalystSettings).toHaveBeenCalledTimes(1);
    expect(saveAnalystSettings).toHaveBeenCalledWith({ ...blob, role_view: "pm" });
  });

  it("falls back to localStorage-only after a 404 (no analyst profile row)", async () => {
    getAnalystSettings.mockResolvedValue({ model_lanes: {}, email_intelligence: {}, role_view: "analyst" });
    const err = Object.assign(new Error("404"), { isAxiosError: true, response: { status: 404 } });
    saveAnalystSettings.mockRejectedValue(err);
    render(
      <RoleViewProvider>
        <Probe />
      </RoleViewProvider>,
    );
    await act(async () => {});
    act(() => {
      screen.getByText("qa").click();
    });
    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    expect(saveAnalystSettings).toHaveBeenCalledTimes(1);
    // Preference survives locally; a further toggle does NOT retry the server.
    expect(screen.getByTestId("role").textContent).toBe("qa");
    expect(window.localStorage.getItem("caos_role_view")).toBe("qa");
    act(() => {
      screen.getByText("pm").click();
    });
    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    expect(saveAnalystSettings).toHaveBeenCalledTimes(1);
  });

  it("a session toggle beats a slower server reconcile (no snap-back)", async () => {
    let resolveGet: (v: unknown) => void = () => {};
    getAnalystSettings.mockReturnValue(new Promise((r) => (resolveGet = r)));
    saveAnalystSettings.mockImplementation(async (b: unknown) => b);
    render(
      <RoleViewProvider>
        <Probe />
      </RoleViewProvider>,
    );
    act(() => {
      screen.getByText("qa").click(); // user toggles before GET resolves
    });
    await act(async () => {
      resolveGet({ model_lanes: {}, email_intelligence: {}, role_view: "pm" });
    });
    expect(screen.getByTestId("role").textContent).toBe("qa");
  });

  it("reads a fresh base at save time if initial reconciliation has not completed", async () => {
    let resolveInitial!: (value: unknown) => void;
    getAnalystSettings
      .mockReturnValueOnce(new Promise((done) => { resolveInitial = done; }))
      .mockResolvedValueOnce({ model_lanes: { a: "b" }, email_intelligence: {}, role_view: "analyst" });
    saveAnalystSettings.mockImplementation(async (value: unknown) => value);
    render(<RoleViewProvider><Probe /></RoleViewProvider>);
    act(() => screen.getByText("pm").click());
    await act(async () => { vi.advanceTimersByTime(900); });
    expect(saveAnalystSettings).toHaveBeenCalledWith(expect.objectContaining({ role_view: "pm", model_lanes: { a: "b" } }));
    resolveInitial({ model_lanes: {}, email_intelligence: {}, role_view: "qa" });
    await act(async () => {});
  });

  it("keeps optimistic state on non-404 save failures and storage write errors", async () => {
    getAnalystSettings.mockResolvedValue({ model_lanes: {}, email_intelligence: {}, role_view: "analyst" });
    saveAnalystSettings.mockRejectedValue(new Error("500"));
    render(<RoleViewProvider><Probe /></RoleViewProvider>);
    await act(async () => {});
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    act(() => screen.getByText("qa").click());
    await act(async () => { vi.advanceTimersByTime(900); });
    expect(screen.getByTestId("role").textContent).toBe("qa");
  });

  it("cancels a pending save and ignores a late reconciliation after unmount", async () => {
    let resolve!: (value: unknown) => void;
    getAnalystSettings.mockReturnValue(new Promise((done) => { resolve = done; }));
    const view = render(<RoleViewProvider><Probe /></RoleViewProvider>);
    act(() => screen.getByText("pm").click());
    view.unmount();
    await act(async () => resolve({ model_lanes: {}, email_intelligence: {}, role_view: "pm" }));
    vi.advanceTimersByTime(900);
    expect(saveAnalystSettings).not.toHaveBeenCalled();
  });
});
