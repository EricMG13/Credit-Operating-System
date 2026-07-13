// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";

vi.mock("@/lib/api", () => ({ getMe: vi.fn(), bindWorkspacePrincipal: vi.fn() }));

import { AuthProvider, useAuth } from "./AuthProvider";
import { getMe } from "@/lib/api";

const mockGetMe = vi.mocked(getMe);
const PROFILE = { id: "a1", email: "e@x.co", full_name: "Eric Gub", role: "analyst", is_active: true, source: "profile" };
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
  });

  it("re-resolves on tab refocus (catches the silent SSO principal swap)", async () => {
    mockGetMe.mockResolvedValue(PROFILE);
    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(await screen.findByText("Eric Gub")).toBeTruthy();
    expect(mockGetMe).toHaveBeenCalledTimes(1);

    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(mockGetMe).toHaveBeenCalledTimes(2); // visibilityState defaults to "visible" in jsdom
  });
});
