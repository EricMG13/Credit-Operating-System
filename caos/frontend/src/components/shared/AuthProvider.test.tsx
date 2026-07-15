// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";

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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  if (ORIGINAL_DISABLE_LOGIN === undefined) delete process.env.NEXT_PUBLIC_CAOS_DISABLE_LOGIN;
  else process.env.NEXT_PUBLIC_CAOS_DISABLE_LOGIN = ORIGINAL_DISABLE_LOGIN;
});

describe("AuthProvider — mid-session identity loss (SEAM4-1)", () => {
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
    expect(mockClearWorkspaceStorage).toHaveBeenCalledTimes(1);
  });

  it("re-resolves on tab refocus (catches the silent SSO principal swap)", async () => {
    mockGetMe.mockResolvedValue(PROFILE);
    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(await screen.findByText("Eric Gub")).toBeTruthy();
    expect(mockGetMe).toHaveBeenCalledTimes(1);

    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(mockGetMe).toHaveBeenCalledTimes(2); // visibilityState defaults to "visible" in jsdom
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

  it("refreshes when another tab changes the principal marker", async () => {
    mockGetMe.mockResolvedValueOnce(PROFILE).mockResolvedValueOnce(PROFILE_B);
    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(await screen.findByText("Eric Gub")).toBeTruthy();

    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: "caos.principal.id",
        oldValue: PROFILE.id,
        newValue: PROFILE_B.id,
      }));
    });

    expect(await screen.findByText("Second Analyst")).toBeTruthy();
    expect(mockClearWorkspaceStorage).toHaveBeenCalledTimes(1);
  });
});
