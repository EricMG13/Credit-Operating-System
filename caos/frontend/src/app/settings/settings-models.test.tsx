// @vitest-environment jsdom
// Locks the Models tab contract: query-model cards carry truthful labels (F2),
// the Custom-model-routing panel is disabled with a "not yet applied" note
// (F4, G1), and an analyst-settings save failure surfaces the server detail
// instead of vanishing (F5, exercised via the Email tab's sender list — the
// routing lanes below are permanently disabled and never save).
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SettingsPage from "./page";

let currentTab = "models";
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(currentTab ? `tab=${currentTab}` : ""),
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getSettings: vi.fn().mockResolvedValue({
    model: "claude-opus-4-8", environment: "test", llm_configured: false,
    gemini_configured: false, openrouter_configured: false,
    governance: {}, engine: {}, deep_research: {}, retrieval: {}, workspace: {},
  }),
  getAnalystSettings: vi.fn().mockResolvedValue({ model_lanes: {}, email_intelligence: { approved_senders: [] }, revision: 0 }),
  patchAnalystSettings: vi.fn().mockRejectedValue({
    response: { data: { detail: "No analyst profile — settings not saved." } },
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  currentTab = "models";
});

describe("Settings · Models tab", () => {
  it("labels the query-model cards truthfully (F2) and disables routing as not yet applied (F4, G1)", async () => {
    render(<SettingsPage />);
    expect(await screen.findByText("Claude Sonnet 4.6")).toBeTruthy();
    expect(screen.queryByText(/Claude 3\.5/)).toBeNull();
    expect(screen.getByText(/not yet applied/i)).toBeTruthy();
    for (const lane of await screen.findAllByRole("combobox")) {
      expect((lane as HTMLSelectElement).disabled).toBe(true);
    }
  });

  it("surfaces an analyst-settings save failure with the server detail (F5)", async () => {
    currentTab = "email";
    render(<SettingsPage />);
    const senders = await screen.findByLabelText(/Approved sender emails\/domains/i);
    fireEvent.change(senders, { target: { value: "alerts@ratingsagency.com" } });
    fireEvent.blur(senders);
    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("No analyst profile — settings not saved.");
    });
  });
});
