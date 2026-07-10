// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

// Mock the one API fn (POST /api/auth/logout) and the auth context.
vi.mock("@/lib/api", () => ({ logout: vi.fn() }));
const mockUseAuth = vi.fn();
vi.mock("@/components/shared/AuthProvider", () => ({ useAuth: () => mockUseAuth() }));

import { AnalystBadge } from "./AnalystBadge";
import { logout } from "@/lib/api";

const mockLogout = vi.mocked(logout);
const PROFILE = { user: { source: "profile", full_name: "Eric Gub" }, refresh: vi.fn() };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("AnalystBadge sign-out", () => {
  it("re-enables the button and surfaces an alert when logout fails (SEAM4-5)", async () => {
    mockUseAuth.mockReturnValue(PROFILE);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    mockLogout.mockRejectedValue(new Error("network"));

    render(<AnalystBadge />);
    const btn = screen.getByRole("button", { name: /Sign out/i });
    fireEvent.click(btn);

    // The failed logout must NOT leave the button permanently disabled.
    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    expect(PROFILE.refresh).not.toHaveBeenCalled(); // no pointless re-resolve on failure
  });
});
