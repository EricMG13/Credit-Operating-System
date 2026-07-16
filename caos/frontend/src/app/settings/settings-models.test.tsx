// @vitest-environment jsdom
// Locks the Models tab contract: query-model cards carry truthful labels (F2),
// the Custom-model-routing panel is disabled with a "not yet applied" note
// (F4, G1), and an analyst-settings save failure surfaces the server detail
// instead of vanishing (F5, exercised via the Email tab's sender list — the
// routing lanes below are permanently disabled and never save).
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SettingsPage from "./page";
import { getAnalystSettings, patchAnalystSettings } from "@/lib/api";

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
  it("labels the query-model cards truthfully (F2) and shows routing as planned, not dead controls (F4, G1)", async () => {
    render(<SettingsPage />);
    expect(await screen.findByText("Claude Sonnet 4.6")).toBeTruthy();
    expect(screen.queryByText(/Claude 3\.5/)).toBeNull();
    // The roadmap surface is collapsed to a one-line planned note — no dead
    // disabled selects that read as broken chrome.
    expect(screen.getByText(/planned — per-lane routing activates/i)).toBeTruthy();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
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

  it("persists the unsaved-model navigation preference through the analyst workspace patch flow", async () => {
    vi.mocked(getAnalystSettings).mockResolvedValueOnce({
      model_lanes: {},
      email_intelligence: { approved_senders: [] },
      workspace: { model_builder: { warn_on_unsaved_leave: false, density: "desk" } },
      revision: 7,
    });
    vi.mocked(patchAnalystSettings).mockResolvedValueOnce({
      model_lanes: {},
      email_intelligence: { approved_senders: [] },
      workspace: { model_builder: { warn_on_unsaved_leave: true, density: "desk" } },
      revision: 8,
    });

    render(<SettingsPage />);
    const toggle = await screen.findByRole("switch", { name: "Warn before leaving unsaved model edits" });
    expect((toggle as HTMLInputElement).checked).toBe(false);
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(patchAnalystSettings).toHaveBeenCalledWith(7, expect.objectContaining({
        workspace: {
          model_builder: { warn_on_unsaved_leave: true, density: "desk" },
        },
      }));
    });
  });

  it("rebases a 409 on the server revision and replays only the intended field", async () => {
    vi.mocked(getAnalystSettings).mockResolvedValueOnce({
      model_lanes: { heavy: "model-a" },
      email_intelligence: { approved_senders: [] },
      workspace: { model_builder: { warn_on_unsaved_leave: false } },
      revision: 7,
    });
    vi.mocked(patchAnalystSettings).mockReset()
      .mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            detail: {
              message: "Settings changed elsewhere.",
              current: {
                model_lanes: { heavy: "model-b" },
                email_intelligence: { approved_senders: ["remote@desk.test"] },
                workspace: {
                  model_builder: { warn_on_unsaved_leave: false, density: "remote" },
                  concurrent_surface: { preserved: true },
                },
                revision: 8,
              },
            },
          },
        },
      })
      .mockResolvedValueOnce({
        model_lanes: { heavy: "model-b" },
        email_intelligence: { approved_senders: ["remote@desk.test"] },
        workspace: {
          model_builder: { warn_on_unsaved_leave: true, density: "remote" },
          concurrent_surface: { preserved: true },
        },
        revision: 9,
      });

    render(<SettingsPage />);
    const toggle = await screen.findByRole("switch", { name: "Warn before leaving unsaved model edits" });
    fireEvent.click(toggle);

    await waitFor(() => expect(patchAnalystSettings).toHaveBeenCalledTimes(2));
    expect(patchAnalystSettings).toHaveBeenNthCalledWith(1, 7, {
      workspace: { model_builder: { warn_on_unsaved_leave: true } },
    });
    expect(patchAnalystSettings).toHaveBeenNthCalledWith(2, 8, {
      workspace: {
        model_builder: { warn_on_unsaved_leave: true, density: "remote" },
        concurrent_surface: { preserved: true },
      },
    });
  });

  it("serializes rapid settings saves onto the prior response revision", async () => {
    vi.mocked(getAnalystSettings).mockResolvedValueOnce({
      model_lanes: {}, email_intelligence: { approved_senders: [] },
      workspace: { model_builder: { warn_on_unsaved_leave: false } }, revision: 10,
    });
    let resolveFirst!: (value: Awaited<ReturnType<typeof patchAnalystSettings>>) => void;
    vi.mocked(patchAnalystSettings).mockReset()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({
        model_lanes: {}, email_intelligence: { approved_senders: [] },
        workspace: { model_builder: { warn_on_unsaved_leave: false } }, revision: 12,
      });

    render(<SettingsPage />);
    const toggle = await screen.findByRole("switch", { name: "Warn before leaving unsaved model edits" });
    fireEvent.click(toggle);
    await waitFor(() => expect(patchAnalystSettings).toHaveBeenCalledTimes(1));
    fireEvent.click(toggle);
    expect(patchAnalystSettings).toHaveBeenCalledTimes(1);

    resolveFirst({
      model_lanes: {}, email_intelligence: { approved_senders: [] },
      workspace: { model_builder: { warn_on_unsaved_leave: true } }, revision: 11,
    });
    await waitFor(() => expect(patchAnalystSettings).toHaveBeenCalledTimes(2));
    expect(patchAnalystSettings).toHaveBeenNthCalledWith(2, 11, {
      workspace: { model_builder: { warn_on_unsaved_leave: false } },
    });
  });
});
