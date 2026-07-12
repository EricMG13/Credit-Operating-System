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
});

describe("RoleViewProvider", () => {
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
});
