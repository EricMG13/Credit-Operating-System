// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act, waitFor } from "@testing-library/react";
import { useEffect } from "react";

vi.mock("@/lib/api", () => ({
  PRINCIPAL_STORAGE_KEY: "caos.principal.id",
  getMe: vi.fn(),
  bindWorkspacePrincipal: vi.fn(),
  clearWorkspaceStorage: vi.fn(),
}));

import { AuthProvider, useAuth } from "./AuthProvider";
import { clearWorkspaceStorage, getMe } from "@/lib/api";

const mockGetMe = vi.mocked(getMe);
const mockClearWorkspaceStorage = vi.mocked(clearWorkspaceStorage);
const PROFILE = { id: "a1", email: "e@x.co", full_name: "Eric Gub", role: "analyst", is_active: true, source: "profile" };
const PROFILE_B = { ...PROFILE, id: "a2", full_name: "Second Analyst" };
const ORIGINAL_DISABLE_LOGIN = process.env.NEXT_PUBLIC_CAOS_DISABLE_LOGIN;

function Consumer() {
  const { user, needsLogin, loading } = useAuth();
  if (loading) return <div>loading</div>;
  if (needsLogin) return <div>login-landing</div>;
  return <div>{user?.full_name ?? "none"}</div>;
}

function StateProbe() {
  const { user, needsLogin, loading, error, refresh } = useAuth();
  return <div>
    <span>{loading ? "loading" : error ? "api-error" : needsLogin ? "needs-login" : user?.source ?? "none"}</span>
    <button type="button" onClick={() => void refresh()}>refresh auth</button>
  </div>;
}

function DefaultContextProbe() {
  const { refresh } = useAuth();
  return <button type="button" onClick={() => void refresh()}>default refresh</button>;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  if (ORIGINAL_DISABLE_LOGIN === undefined) delete process.env.NEXT_PUBLIC_CAOS_DISABLE_LOGIN;
  else process.env.NEXT_PUBLIC_CAOS_DISABLE_LOGIN = ORIGINAL_DISABLE_LOGIN;
});

describe("AuthProvider — mid-session identity loss (SEAM4-1)", () => {
  it("provides a harmless default refresh outside the provider", () => {
    render(<DefaultContextProbe />);
    expect(() => screen.getByRole("button", { name: "default refresh" }).click()).not.toThrow();
  });

  it.each([
    [{ ...PROFILE, source: "proxy" }, "needs-login"],
    [{ ...PROFILE, source: "local" }, "local"],
  ])("distinguishes non-profile identity source %#", async (identity, expected) => {
    mockGetMe.mockResolvedValue(identity);
    render(<AuthProvider><StateProbe /></AuthProvider>);
    expect(await screen.findByText(expected)).toBeTruthy();
  });

  it("surfaces a non-401 API failure and supports explicit refresh", async () => {
    mockGetMe.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(PROFILE);
    render(<AuthProvider><StateProbe /></AuthProvider>);
    expect(await screen.findByText("api-error")).toBeTruthy();
    screen.getByRole("button", { name: "refresh auth" }).click();
    expect(await screen.findByText("profile")).toBeTruthy();
  });
  it("can bypass login for local preview without calling /me", async () => {
    process.env.NEXT_PUBLIC_CAOS_DISABLE_LOGIN = "1";

    render(<AuthProvider><Consumer /></AuthProvider>);

    expect(await screen.findByText("Local Analyst")).toBeTruthy();
    expect(mockGetMe).not.toHaveBeenCalled();
  });

  it("re-resolves identity and routes to login when caos:auth-lost fires", async () => {
    mockGetMe.mockResolvedValueOnce(PROFILE);
    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(await screen.findByText("Eric Gub")).toBeTruthy();

    // Session lost mid-session: the next /me resolution is a 401.
    mockGetMe.mockRejectedValueOnce({ isAxiosError: true, response: { status: 401 } });
    await act(async () => { window.dispatchEvent(new Event("caos:auth-lost")); });

    expect(await screen.findByText("login-landing")).toBeTruthy();
    expect(mockGetMe).toHaveBeenCalledTimes(2); // mount + event
    expect(mockClearWorkspaceStorage).toHaveBeenCalled();
  });

  it("re-resolves on tab refocus (catches the silent SSO principal swap)", async () => {
    mockGetMe.mockResolvedValue(PROFILE);
    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(await screen.findByText("Eric Gub")).toBeTruthy();
    expect(mockGetMe).toHaveBeenCalledTimes(1);

    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(mockGetMe).toHaveBeenCalledTimes(2); // visibilityState defaults to "visible" in jsdom
  });

  it("unmounts principal A synchronously while a same-tab SSO recheck for B is pending", async () => {
    let resolveSecond!: (value: typeof PROFILE_B) => void;
    const oldWorkspaceUnmounted = vi.fn();
    function Workspace() {
      useEffect(() => () => { oldWorkspaceUnmounted(); }, []);
      return <Consumer />;
    }
    mockGetMe
      .mockResolvedValueOnce(PROFILE)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    render(<AuthProvider><Workspace /></AuthProvider>);
    expect(await screen.findByText("Eric Gub")).toBeTruthy();
    const priorUnmounts = oldWorkspaceUnmounted.mock.calls.length;

    act(() => { document.dispatchEvent(new Event("visibilitychange")); });

    expect(screen.queryByText("Eric Gub")).toBeNull();
    expect(screen.getByText("loading")).toBeTruthy();
    await waitFor(() => expect(oldWorkspaceUnmounted).toHaveBeenCalledTimes(priorUnmounts + 1));
    // An ordinary focus check does not erase caches before identity is known.
    expect(mockClearWorkspaceStorage).not.toHaveBeenCalled();

    await act(async () => { resolveSecond(PROFILE_B); });
    expect(await screen.findByText("Second Analyst")).toBeTruthy();
  });

  it("ignores an older refresh that settles after a newer principal", async () => {
    let resolveFirst!: (value: typeof PROFILE) => void;
    mockGetMe
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(PROFILE_B);

    render(<AuthProvider><Consumer /></AuthProvider>);
    await act(async () => { window.dispatchEvent(new Event("caos:auth-lost")); });
    expect(await screen.findByText("Second Analyst")).toBeTruthy();

    await act(async () => { resolveFirst(PROFILE); await Promise.resolve(); });
    expect(screen.getByText("Second Analyst")).toBeTruthy();
    expect(screen.queryByText("Eric Gub")).toBeNull();
  });

  it("does not remount the login form on a visibilitychange while still unauthenticated", async () => {
    const loginFormUnmounted = vi.fn();
    function LoginFormProbe() {
      useEffect(() => () => { loginFormUnmounted(); }, []);
      const { needsLogin, loading } = useAuth();
      if (loading) return <div>loading</div>;
      if (needsLogin) return <div>login-landing</div>;
      return <div>none</div>;
    }
    mockGetMe.mockRejectedValue({ isAxiosError: true, response: { status: 401 } });
    render(<AuthProvider><LoginFormProbe /></AuthProvider>);
    expect(await screen.findByText("login-landing")).toBeTruthy();
    const callsBeforeVisibility = mockGetMe.mock.calls.length;
    const unmountsBeforeVisibility = loginFormUnmounted.mock.calls.length;

    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });

    // Still resolves via a quiet refresh...
    expect(mockGetMe.mock.calls.length).toBeGreaterThan(callsBeforeVisibility);
    // ...but never tears down the mounted login form (no forced anonymous
    // interstitial in between), which would otherwise wipe any in-progress
    // form fields or a just-set submit error.
    expect(loginFormUnmounted.mock.calls.length).toBe(unmountsBeforeVisibility);
    expect(screen.getByText("login-landing")).toBeTruthy();
  });

  it("refreshes when another tab changes the principal marker", async () => {
    let resolveSecond!: (value: typeof PROFILE_B) => void;
    const oldWorkspaceUnmounted = vi.fn();
    function Workspace() {
      useEffect(() => () => { oldWorkspaceUnmounted(); }, []);
      return <Consumer />;
    }
    mockGetMe
      .mockResolvedValueOnce(PROFILE)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    render(<AuthProvider><Workspace /></AuthProvider>);
    expect(await screen.findByText("Eric Gub")).toBeTruthy();
    const unmountsBeforePrincipalChange = oldWorkspaceUnmounted.mock.calls.length;

    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: "caos.principal.id",
        oldValue: PROFILE.id,
        newValue: PROFILE_B.id,
      }));
    });

    expect(screen.queryByText("Eric Gub")).toBeNull();
    expect(screen.getByText("loading")).toBeTruthy();
    await waitFor(() => expect(oldWorkspaceUnmounted).toHaveBeenCalledTimes(
      unmountsBeforePrincipalChange + 1,
    ));
    await act(async () => { resolveSecond(PROFILE_B); });
    expect(await screen.findByText("Second Analyst")).toBeTruthy();
    expect(mockClearWorkspaceStorage).toHaveBeenCalledTimes(1);
  });

  it("ignores hidden visibility changes and irrelevant or same-principal storage events", async () => {
    mockGetMe.mockResolvedValue(PROFILE);
    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(await screen.findByText("Eric Gub")).toBeTruthy();
    const calls = mockGetMe.mock.calls.length;
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated", newValue: "x" }));
    window.dispatchEvent(new StorageEvent("storage", { key: "caos.principal.id", newValue: PROFILE.id }));
    await act(async () => { await Promise.resolve(); });
    expect(mockGetMe).toHaveBeenCalledTimes(calls);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });
});
