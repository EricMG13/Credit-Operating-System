// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

// Mock the one API fn (POST /api/auth/logout) and the auth context.
vi.mock("@/lib/api", () => ({ logout: vi.fn(), clearWorkspaceStorage: vi.fn() }));
const mockUseAuth = vi.fn();
vi.mock("@/components/shared/AuthProvider", () => ({ useAuth: () => mockUseAuth() }));

import { AnalystBadge } from "./AnalystBadge";
import { clearWorkspaceStorage, logout } from "@/lib/api";

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

  it("does nothing when confirmation is declined", () => {
    mockUseAuth.mockReturnValue(PROFILE);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<AnalystBadge />);
    fireEvent.click(screen.getByRole("button", { name: /Sign out/i }));
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("clears workspace state and refreshes auth after a successful logout", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ ...PROFILE, refresh });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockLogout.mockResolvedValue(undefined as never);
    render(<AnalystBadge />);
    fireEvent.click(screen.getByRole("button", { name: /Sign out/i }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(clearWorkspaceStorage).toHaveBeenCalledOnce();
  });

  it("ignores a second sign-out attempt while the first is busy", async () => {
    let resolve!: () => void;
    mockUseAuth.mockReturnValue(PROFILE);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockLogout.mockReturnValue(new Promise<void>((done) => { resolve = done; }) as never);
    render(<AnalystBadge />);
    const button = screen.getByRole("button", { name: /Sign out/i });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mockLogout).toHaveBeenCalledOnce();
    resolve();
    await waitFor(() => expect(PROFILE.refresh).toHaveBeenCalled());
  });
});
