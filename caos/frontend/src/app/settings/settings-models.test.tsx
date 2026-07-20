// @vitest-environment jsdom
// Locks the Models tab contract: query-model cards carry truthful labels (F2),
// the Custom-model-routing panel is disabled with a "not yet applied" note
// (F4, G1), and an analyst-settings save failure surfaces the server detail
// instead of vanishing (F5, exercised via the Email tab's sender list — the
// routing lanes below are permanently disabled and never save).
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SettingsPage, { resolveSettingsTab } from "./page";
import { getAnalystSettings, getSettings, patchAnalystSettings } from "@/lib/api";

let currentTab = "models";
const modeState = vi.hoisted(() => ({ mode: "live" as "live" | "reference" }));
const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings",
  useRouter: () => ({ push: vi.fn(), replace, prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(currentTab ? `tab=${currentTab}` : ""),
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/settings/PortfoliosPanel", () => ({ PortfoliosPanel: () => <div>portfolio settings</div> }));
vi.mock("@/lib/data-mode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data-mode")>()),
  useDataMode: () => modeState.mode,
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getSettings: vi.fn().mockResolvedValue({
    model: "claude-opus-4-8", environment: "test", llm_configured: false,
    gemini_configured: false, openrouter_configured: false,
    governance: { council_enabled: false, council_seats: 0, council_peer_round: false, council_cross_model: false, debate_enabled: false },
    model_tiers: { cheap: "cheap", fast: "fast", strong: "strong", top: "top" },
    engine_cost: { run_token_budget: 0, advisor_enabled: false, synth_executor_model: "synth", advisor_model: "advisor" },
    deep_research: { effort: "high", max_searches: 0, max_tokens: 0 },
    retrieval: { edgar_enabled: false, markitdown_enabled: false },
    workspace: { environment: "test", demo_seed: false, max_upload_mb: 20, run_concurrency: 1 },
  }),
  getAnalystSettings: vi.fn().mockResolvedValue({ model_lanes: {}, email_intelligence: { approved_senders: [] }, revision: 0 }),
  patchAnalystSettings: vi.fn().mockRejectedValue({
    response: { data: { detail: "No analyst profile — settings not saved." } },
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
  currentTab = "models";
  modeState.mode = "live";
});

describe("Settings · primary tabs", () => {
  it("keeps three outcome tabs and resolves every legacy URL through an explicit alias", async () => {
    expect([
      ["models", resolveSettingsTab("models")],
      ["research", resolveSettingsTab("research")],
      ["email", resolveSettingsTab("email")],
      ["portfolios", resolveSettingsTab("portfolios")],
      ["workspace", resolveSettingsTab("workspace")],
    ]).toEqual([
      ["models", "preferences"],
      ["research", "preferences"],
      ["email", "integrations"],
      ["portfolios", "workspace-administration"],
      ["workspace", "workspace-administration"],
    ]);

    render(<SettingsPage />);
    const tabs = screen.getByRole("tablist", { name: "Settings sections" }).querySelectorAll('[role="tab"]');
    expect(tabs).toHaveLength(3);
    expect(Array.from(tabs).map((tab) => tab.textContent)).toEqual(["Preferences", "Integrations", "Workspace administration"]);
    expect((await screen.findByRole("tab", { name: "Preferences" })).getAttribute("aria-selected")).toBe("true");
  });

  it("labels the query-model cards truthfully (F2) and shows routing as planned, not dead controls (F4, G1)", async () => {
    render(<SettingsPage />);
    expect(await screen.findByText("Balanced institutional answers")).toBeTruthy();
    expect(screen.queryByText(/Claude 3\.5/)).toBeNull();
    // The roadmap surface is collapsed to a one-line planned note — no dead
    // disabled selects that read as broken chrome.
    expect(screen.getByText(/planned — task-specific preferences/i)).toBeTruthy();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  });

  it("keeps implementation vocabulary inside collapsed deployment diagnostics", async () => {
    render(<SettingsPage />);
    await screen.findByText("Analysis depth and speed");
    const ordinaryWorkspace = document.querySelector("#settings-panel-preferences")?.textContent ?? "";
    expect(ordinaryWorkspace).not.toContain("Model mode");
    expect(ordinaryWorkspace).not.toContain("Query Model");
    expect(ordinaryWorkspace).not.toContain("analysis provider");
    expect(ordinaryWorkspace).not.toContain("Custom model routing");
  });

  it("surfaces an analyst-settings save failure with the server detail (F5)", async () => {
    currentTab = "email";
    render(<SettingsPage />);
    const senders = await screen.findByLabelText(/Approved sender emails\/domains/i);
    expect(screen.getByText("Not connected")).toBeTruthy();
    fireEvent.change(senders, { target: { value: "alerts@ratingsagency.com" } });
    fireEvent.blur(senders);
    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("No analyst profile — settings not saved.");
    });
  });

  it("reports Reference feed only from explicit Reference mode and Status unavailable on profile read failure", async () => {
    currentTab = "email";
    modeState.mode = "reference";
    render(<SettingsPage />);
    expect(await screen.findByText("Reference feed")).toBeTruthy();
    cleanup();

    modeState.mode = "live";
    vi.mocked(getAnalystSettings).mockRejectedValueOnce(new Error("offline"));
    render(<SettingsPage />);
    expect(await screen.findByText("Status unavailable")).toBeTruthy();
  });

  it("guards the global save while persistence is in flight and clears dirty state only after success", async () => {
    let resolveSave!: (value: Awaited<ReturnType<typeof patchAnalystSettings>>) => void;
    vi.mocked(patchAnalystSettings).mockReset()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));

    render(<SettingsPage />);
    const save = await screen.findByRole("button", { name: "Save changes" });
    await waitFor(() => expect(save.getAttribute("title")).toBe("No unsaved changes"));
    const modelMax = screen.getByRole("group", { name: "Analysis depth and speed" }).querySelectorAll("button")[3];
    fireEvent.click(modelMax);
    await waitFor(() => expect(save.getAttribute("aria-disabled")).toBeNull());

    fireEvent.click(save);
    await waitFor(() => {
      expect(patchAnalystSettings).toHaveBeenCalledTimes(1);
      expect(save.getAttribute("aria-disabled")).toBe("true");
      expect(save.getAttribute("title")).toBe("Saving…");
    });
    fireEvent.click(save);
    expect(patchAnalystSettings).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSave({
        model_lanes: {},
        email_intelligence: { approved_senders: [] },
        workspace: { model_mode: "max" },
        revision: 1,
      });
    });
    await waitFor(() => expect(save.getAttribute("title")).toBe("No unsaved changes"));
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

  it("supports tab clicks and the complete roving-tab keyboard contract", async () => {
    render(<SettingsPage />);
    const preferences = await screen.findByRole("tab", { name: "Preferences" });
    fireEvent.click(screen.getByRole("tab", { name: "Integrations" }));
    expect(replace).toHaveBeenCalledWith("?tab=integrations", { scroll: false });
    for (const [key, expected] of [["ArrowRight", "integrations"], ["ArrowDown", "integrations"], ["ArrowLeft", "workspace-administration"], ["ArrowUp", "workspace-administration"], ["Home", "preferences"], ["End", "workspace-administration"]]) {
      fireEvent.keyDown(preferences, { key });
      expect(replace).toHaveBeenLastCalledWith(`?tab=${expected}`, { scroll: false });
    }
    const priorCalls = replace.mock.calls.length;
    fireEvent.keyDown(preferences, { key: "Tab" });
    expect(replace).toHaveBeenCalledTimes(priorCalls);
  });

  it("edits, saves, and resets the browser-local research defaults", async () => {
    currentTab = "research";
    render(<SettingsPage />);
    const audience = await screen.findByLabelText("Audience");
    fireEvent.change(audience, { target: { value: "Credit committee" } });
    fireEvent.change(screen.getByLabelText("Decision to inform"), { target: { value: "Sizing" } });
    fireEvent.change(screen.getByLabelText("Timeframe"), { target: { value: "Next year" } });
    fireEvent.change(screen.getByLabelText(/Investigation criteria/), { target: { value: "Liquidity" } });
    fireEvent.click(screen.getByRole("group", { name: "AI mode" }).querySelectorAll("button")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Saved")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect((screen.getByLabelText("Audience") as HTMLInputElement).value).not.toBe("Credit committee");
  });

  it("renders connected email state and persists a normalized sender list", async () => {
    currentTab = "email";
    vi.mocked(getAnalystSettings).mockResolvedValueOnce({
      model_lanes: {}, email_intelligence: { outlook_connected: true, approved_senders: ["old@desk.test"] }, revision: 3,
    });
    vi.mocked(patchAnalystSettings).mockResolvedValueOnce({
      model_lanes: {}, email_intelligence: { outlook_connected: true, approved_senders: ["one@test", "two@test"] }, revision: 4,
    });
    render(<SettingsPage />);
    expect(await screen.findByText("Connected")).toBeTruthy();
    expect(screen.queryByText(/feed built near production/i)).toBeNull();
    const senders = screen.getByLabelText(/Approved sender/);
    fireEvent.change(senders, { target: { value: " one@test, two@test\n " } });
    fireEvent.blur(senders);
    await waitFor(() => expect(patchAnalystSettings).toHaveBeenCalledWith(3, {
      email_intelligence: { outlook_connected: true, approved_senders: ["one@test", "two@test"] },
    }));
  });

  it("renders every workspace configuration value and recovers from an offline read", async () => {
    currentTab = "workspace";
    const cfg = {
      model: "opus", llm_configured: false, gemini_configured: true, openrouter_configured: false,
      governance: { council_enabled: true, council_seats: 4, council_peer_round: false, council_cross_model: true, debate_enabled: false },
      model_tiers: { cheap: "cheap", fast: "fast", strong: "strong", top: "top" },
      engine_cost: { run_token_budget: 0, advisor_enabled: true, synth_executor_model: "synth", advisor_model: "advisor" },
      deep_research: { effort: "high", max_searches: 12, max_tokens: 4000 },
      retrieval: { edgar_enabled: true, markitdown_enabled: false },
      workspace: { environment: "test", demo_seed: false, max_upload_mb: 20, run_concurrency: 3 },
      features: { lineage_v2_enabled: true, market_xlsx_v2_enabled: true, model_engine_v2_enabled: true },
    };
    vi.mocked(getSettings).mockResolvedValueOnce(cfg);
    render(<SettingsPage />);
    expect(await screen.findByRole("heading", { name: "Workspace administration" })).toBeTruthy();
    expect(screen.getByText("Deployment diagnostics").closest("details")?.hasAttribute("open")).toBe(false);
    expect(screen.getByText("Governance & QA")).toBeTruthy();
    expect(screen.getAllByText("On").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Off").length).toBeGreaterThan(0);
    cleanup();

    vi.mocked(getSettings).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(cfg);
    render(<SettingsPage />);
    expect(await screen.findByText("Workspace configuration unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Governance & QA")).toBeTruthy();
  });

  it("renders the portfolio tab and retries an analyst profile that initially fails", async () => {
    currentTab = "portfolios";
    render(<SettingsPage />);
    expect(await screen.findByText("portfolio settings")).toBeTruthy();
    cleanup();

    currentTab = "models";
    vi.mocked(getAnalystSettings).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({
      model_lanes: {}, email_intelligence: { approved_senders: [] }, revision: 1,
    });
    render(<SettingsPage />);
    const [retry] = await screen.findAllByRole("button", { name: "Retry" });
    fireEvent.click(retry);
    await waitFor(() => expect((screen.getByRole("switch", { name: "Warn before leaving unsaved model edits" }) as HTMLInputElement).disabled).toBe(false));
  });

  it("hydrates server research defaults and normalized profile mode, then changes query model and research scope", async () => {
    vi.mocked(getAnalystSettings).mockResolvedValueOnce({
      model_lanes: {}, email_intelligence: { approved_senders: [] },
      workspace: {
        research_prefs: { audience: "Private credit committee", mode: "sector" },
        model_mode: " max ",
        query_model: "gemini-1.5-pro",
      },
      revision: 4,
    });
    render(<SettingsPage />);
    await screen.findByText("Analysis depth and speed");
    const max = screen.getByRole("group", { name: "Analysis depth and speed" }).querySelectorAll("button")[3];
    expect(max.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Citation-led research answers/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /Cost-aware structured answers/ }));
    expect(screen.getByRole("button", { name: /Cost-aware structured answers/ }).getAttribute("aria-pressed")).toBe("true");

    cleanup();
    currentTab = "research";
    vi.mocked(getAnalystSettings).mockResolvedValueOnce({
      model_lanes: {}, email_intelligence: { approved_senders: [] },
      workspace: { research_prefs: { audience: "Private credit committee", mode: "sector" }, model_mode: "invalid-mode" },
      revision: 5,
    });
    render(<SettingsPage />);
    expect((await screen.findByLabelText("Audience") as HTMLInputElement).value).toBe("Private credit committee");
    fireEvent.click(screen.getByRole("button", { name: "issuer" }));
    expect(screen.getByRole("button", { name: "issuer" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("surfaces an object-shaped save detail and retries the retained optimistic patch", async () => {
    currentTab = "email";
    vi.mocked(getAnalystSettings).mockResolvedValueOnce({
      model_lanes: {}, email_intelligence: { approved_senders: [] }, revision: 2,
    });
    vi.mocked(patchAnalystSettings).mockReset()
      .mockRejectedValueOnce({ response: { data: { detail: { message: "Profile write conflicted." } } } })
      .mockResolvedValueOnce({
        model_lanes: {}, email_intelligence: { approved_senders: ["desk@test"] }, revision: 3,
      });
    render(<SettingsPage />);
    const senders = await screen.findByLabelText(/Approved sender emails\/domains/i);
    fireEvent.change(senders, { target: { value: "desk@test" } });
    fireEvent.blur(senders);
    expect(await screen.findByText(/Profile write conflicted/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    await waitFor(() => expect(patchAnalystSettings).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Saved")).toBeTruthy();
  });

  it("uses the generic save error when the backend supplies no detail", async () => {
    currentTab = "email";
    vi.mocked(getAnalystSettings).mockResolvedValueOnce({
      model_lanes: {}, email_intelligence: { approved_senders: [] }, revision: 1,
    });
    vi.mocked(patchAnalystSettings).mockReset().mockRejectedValueOnce(new Error("offline"));
    render(<SettingsPage />);
    const senders = await screen.findByLabelText(/Approved sender emails\/domains/i);
    fireEvent.change(senders, { target: { value: "desk@test" } });
    fireEvent.blur(senders);
    expect(await screen.findByText(/Save failed — not stored/)).toBeTruthy();
  });

  it("cancels the analyst-saved reset timer when the page unmounts", async () => {
    currentTab = "email";
    vi.mocked(getAnalystSettings).mockResolvedValueOnce({
      model_lanes: {}, email_intelligence: { approved_senders: [] }, revision: 1,
    });
    vi.mocked(patchAnalystSettings).mockResolvedValueOnce({
      model_lanes: {}, email_intelligence: { approved_senders: ["desk@test"] }, revision: 2,
    });
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const view = render(<SettingsPage />);
    const senders = await screen.findByLabelText(/Approved sender emails\/domains/i);
    fireEvent.change(senders, { target: { value: "desk@test" } });
    fireEvent.blur(senders);
    expect(await screen.findByText("Saved")).toBeTruthy();

    const resetCallIndex = setTimeoutSpy.mock.calls.findIndex(([, delay]) => delay === 2000);
    expect(resetCallIndex).toBeGreaterThanOrEqual(0);
    const resetTimer = setTimeoutSpy.mock.results[resetCallIndex]?.value;
    view.unmount();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(resetTimer);
    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it("defaults an unsupported tab and reports unavailable answer-source status without writing", async () => {
    currentTab = "unsupported";
    vi.mocked(getSettings).mockRejectedValueOnce(new Error("configuration offline"));

    render(<SettingsPage />);

    expect(await screen.findByText("Analysis depth and speed")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Preferences" }).getAttribute("aria-selected")).toBe("true");
    expect(await screen.findAllByText("status unavailable")).toHaveLength(3);
    expect(screen.queryByText("Workspace status available")).toBeNull();
    expect(patchAnalystSettings).not.toHaveBeenCalled();
  });

  it("loads each settings authority once and keeps fixed control inventories bounded", async () => {
    render(<SettingsPage />);

    await screen.findByText("Analysis depth and speed");
    await waitFor(() => {
      expect(getSettings).toHaveBeenCalledTimes(1);
      expect(getAnalystSettings).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole("tablist", { name: "Settings sections" }).querySelectorAll('[role="tab"]')).toHaveLength(3);
    expect(screen.getByRole("button", { name: /Balanced institutional answers/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Citation-led research answers/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Cost-aware structured answers/ })).toBeTruthy();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(patchAnalystSettings).not.toHaveBeenCalled();
  });
});
