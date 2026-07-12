// @vitest-environment jsdom
// G6: Monitor swaps its whole workspace body for PhoneTriage at the mobile
// breakpoint — the dense EmailIntel/AlertInbox/Governance layout never
// renders below 768px, and PhoneTriage never renders above it.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import MonitorPage from "./page";

let mockBreakpoint: "wide" | "desktop" | "tablet" | "mobile" = "wide";

vi.mock("next/navigation", () => ({
  usePathname: () => "/monitor",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/useBreakpoint", () => ({
  useBreakpoint: () => ({ breakpoint: mockBreakpoint, hydrated: true }),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getAutonomyDraft: vi.fn().mockRejectedValue(new Error("network error")),
  getAlertStates: vi.fn().mockRejectedValue(new Error("network error")),
  getPortfolio: vi.fn().mockRejectedValue(new Error("network error")),
  getDigest: vi.fn().mockRejectedValue(new Error("network error")),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockBreakpoint = "wide";
});

describe("Monitor · phone triage breakpoint gate (G6)", () => {
  it("mounts PhoneTriage instead of the desktop workspace at the mobile breakpoint", async () => {
    mockBreakpoint = "mobile";
    render(<MonitorPage />);
    await waitFor(() => expect(screen.getByText("Watchtower unreachable")).toBeTruthy()); // PhoneTriage's offline state
    expect(screen.queryByText("Email Intelligence · CP-MON intake")).toBeNull();
    expect(screen.queryByText("Governance · CP-5 / CP-0 / Staleness")).toBeNull();
  });

  it("mounts the desktop workspace, never PhoneTriage, at wider breakpoints", async () => {
    mockBreakpoint = "desktop";
    render(<MonitorPage />);
    await waitFor(() => expect(screen.getByText("Email Intelligence · CP-MON intake")).toBeTruthy());
    expect(screen.getByText("Governance · CP-5 / CP-0 / Staleness")).toBeTruthy();
  });
});
