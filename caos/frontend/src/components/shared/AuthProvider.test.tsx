// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";

vi.mock("@/lib/api", () => ({ getMe: vi.fn() }));

import { AuthProvider, useAuth } from "./AuthProvider";
import { getMe } from "@/lib/api";

const mockGetMe = vi.mocked(getMe);
const PROFILE = { id: "a1", email: "e@x.co", full_name: "Eric Gub", role: "analyst", is_active: true, source: "profile" };

function Consumer() {
  const { user, needsLogin, loading } = useAuth();
  if (loading) return <div>loading</div>;
  if (needsLogin) return <div>login-landing</div>;
  return <div>{user?.full_name ?? "none"}</div>;
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("AuthProvider — mid-session identity loss (SEAM4-1)", () => {
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
