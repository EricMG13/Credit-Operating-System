// @vitest-environment jsdom
// G6: Monitor swaps its whole workspace body for PhoneTriage at the mobile
// breakpoint — the dense EmailIntel/AlertInbox/Governance layout never
// renders below 768px, and PhoneTriage never renders above it.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MonitorPage from "./page";

let mockBreakpoint: "wide" | "desktop" | "tablet" | "mobile" = "wide";
const analysisState = vi.hoisted(() => ({ loading: false, patch: vi.fn() }));

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
vi.mock("@/lib/analysis-workbench", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analysis-workbench")>()),
  useAnalysisContext: () => ({
    context: null,
    setContext: vi.fn(),
    patch: analysisState.patch,
    loading: analysisState.loading,
    error: null,
    mutationState: "idle",
    mutationError: null,
    retryLastPatch: vi.fn(),
  }),
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
  analysisState.loading = false;
  window.history.replaceState({}, "", "/monitor");
});

describe("Monitor · phone triage breakpoint gate (G6)", () => {
  it("keeps phone triage primary while context and governance remain available as drawers", async () => {
    mockBreakpoint = "mobile";
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: true,
      media: "(max-width: 899px)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    render(<MonitorPage />);
    await waitFor(() => expect(screen.getByText("Autonomy engine unreachable")).toBeTruthy()); // PhoneTriage's offline state
    expect(screen.queryByText("Email Intelligence · CP-MON intake")).toBeNull();
    expect(screen.queryByText("Governance summary")).toBeNull();
    expect(screen.getByRole("tab", { name: "Email intake" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open context drawer" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open evidence inspector drawer" }));
    expect(await screen.findByText("Governance summary")).toBeTruthy();
  });

  it("mounts the desktop workspace, never PhoneTriage, at wider breakpoints", async () => {
    mockBreakpoint = "desktop";
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: "(max-width: 899px)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    render(<MonitorPage />);
    await waitFor(() => expect(screen.getByRole("tab", { name: "Email intake" })).toBeTruthy());
    expect(screen.getByText("Governance summary")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Email intake" }));
    expect(screen.getByText("Email Intelligence · CP-MON intake")).toBeTruthy();
  });

  it("keeps dataset tabs inert until analysis-context bootstrap settles", () => {
    window.history.replaceState({}, "", "/monitor");
    analysisState.loading = true;
    const { rerender } = render(<MonitorPage />);

    const email = screen.getByRole("tab", { name: "Email intake" });
    expect(email.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(email);
    expect(screen.getByRole("tab", { name: "Alerts" }).getAttribute("aria-selected")).toBe("true");

    analysisState.loading = false;
    rerender(<MonitorPage />);
    expect(screen.getByRole("tab", { name: "Email intake" }).getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Email intake" }));
    expect(screen.getByText("Email Intelligence · CP-MON intake")).toBeTruthy();
  });
});
