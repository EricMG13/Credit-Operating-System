// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { WatchRuleWriteDTO } from "@/lib/api";
import { WatchRuleEditor } from "./WatchRuleEditor";
import { usePersistedWatchRuleController } from "./usePersistedMonitorController";

const getWatchRulePage = vi.fn();
const getWatchRule = vi.fn();
const createWatchRule = vi.fn();
const updateWatchRule = vi.fn();
const getSettings = vi.fn().mockResolvedValue({ features: { alert_rules_v1_enabled: true } });

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getSettings: (...args: unknown[]) => getSettings(...args),
  getWatchRulePage: (...args: unknown[]) => getWatchRulePage(...args),
  getWatchRule: (...args: unknown[]) => getWatchRule(...args),
  createWatchRule: (...args: unknown[]) => createWatchRule(...args),
  updateWatchRule: (...args: unknown[]) => updateWatchRule(...args),
}));

const rule = (overrides: Record<string, unknown> = {}) => ({
  id: "cba66159-10ca-487e-905f-357f52146195",
  name: "QA gate watch",
  signal_type: "qa_gate",
  enabled: true,
  paused: false,
  issuer_id: "issuer-17",
  portfolio_id: null,
  current_version: 3,
  schedule_kind: "event_driven",
  schedule_interval_seconds: null,
  next_evaluation_at: null,
  last_evaluated_at: "2026-07-20T10:00:00Z",
  config: {
    operator: "present",
    threshold: null,
    kind: "qa_change",
    title: "QA gate changed",
    impact: "Review governed evidence.",
  },
  created_at: "2026-07-19T10:00:00Z",
  updated_at: "2026-07-20T10:00:00Z",
  ...overrides,
});

function Harness() {
  const controller = usePersistedWatchRuleController();
  return <WatchRuleEditor controller={controller} />;
}

function AvailabilityHarness() {
  const controller = usePersistedWatchRuleController();
  const write: WatchRuleWriteDTO = {
    name: "Guard probe", signal_type: "qa_gate", enabled: true, paused: false,
    issuer_id: null, portfolio_id: null, schedule_kind: "event_driven",
    schedule_interval_seconds: null, next_evaluation_at: null,
    config: { operator: "present", threshold: null, kind: "qa_change", title: "QA changed", impact: "Review." },
  };
  return <><output data-testid="rule-availability">{controller.availability}</output><button type="button" onClick={() => void controller.retryActivation()}>Probe activation again</button><button type="button" onClick={() => void controller.refresh().catch(() => undefined)}>Probe guarded list refresh</button><button type="button" onClick={() => void controller.reloadOne(rule().id).catch(() => undefined)}>Probe guarded item read</button><button type="button" onClick={() => void controller.create(write).catch(() => undefined)}>Probe guarded create</button><button type="button" onClick={() => void controller.update(rule().id, 3, write).catch(() => undefined)}>Probe guarded update</button><WatchRuleEditor controller={controller} /></>;
}

function RuleFenceHarness() {
  const controller = usePersistedWatchRuleController();
  const write = (name: string): WatchRuleWriteDTO => ({
    name, signal_type: "qa_gate", enabled: true, paused: false,
    issuer_id: null, portfolio_id: null, schedule_kind: "event_driven" as const,
    schedule_interval_seconds: null, next_evaluation_at: null,
    config: { operator: "present", threshold: null, kind: "qa_change", title: "QA changed", impact: "Review." },
  });
  return <><output data-testid="rule-status">{controller.status}</output><output data-testid="rule-names">{controller.rules.map((item) => item.name).join("|")}</output><button type="button" onClick={() => void controller.refresh()}>Reload rules</button><button type="button" onClick={() => void controller.create({
    name: "Created while loading", signal_type: "qa_gate", enabled: true, paused: false,
    issuer_id: null, portfolio_id: null, schedule_kind: "event_driven",
    schedule_interval_seconds: null, next_evaluation_at: null,
    config: { operator: "present", threshold: null, kind: "qa_change", title: "QA changed", impact: "Review." },
  }).catch(() => undefined)}>Create during load</button><button type="button" onClick={() => void controller.update(rule().id, 3, write("Updated while loading")).catch(() => undefined)}>Update during load</button></>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get: () => document.body,
  });
});

beforeEach(() => {
  getSettings.mockReset().mockResolvedValue({ features: { alert_rules_v1_enabled: true } });
  getWatchRulePage.mockReset();
  getWatchRule.mockReset();
  createWatchRule.mockReset();
  updateWatchRule.mockReset();
  getWatchRulePage.mockResolvedValue({ items: [rule()], nextCursor: null });
  getWatchRule.mockResolvedValue(rule({ current_version: 4, name: "Reloaded QA watch" }));
  createWatchRule.mockImplementation(async (payload) => rule({ ...payload, current_version: 1 }));
  updateWatchRule.mockImplementation(async (_id, _version, patch) => rule({ ...patch, current_version: 4 }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WatchRuleEditor", () => {
  it("lists rules, restores opener focus on Escape, and states the exact delivery boundary with glyph plus text", async () => {
    render(<Harness />);
    const opener = await screen.findByRole("button", { name: "Manage watch rules" });
    expect(screen.getByText("QA gate watch")).toBeTruthy();
    opener.focus();
    fireEvent.click(opener);
    expect(await screen.findByRole("dialog", { name: "Create watch rule" })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Rule name")));
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getAllByText("NOT SENT").length).toBeGreaterThanOrEqual(2);
    expect(document.body.textContent).toContain("In-app · persisted");
    expect(document.body.textContent).toContain("Email · rendered intent only · NOT SENT");
    const copyOutsideBoundary = (document.body.textContent ?? "").replace(/NOT SENT/g, "");
    expect(copyOutsideBoundary).not.toMatch(/\b(sent|delivered|connected|accepted)\b/i);

    const close = screen.getByRole("button", { name: "Close watch rule editor" });
    const save = screen.getByRole("button", { name: "Save rule" });
    close.focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(save);
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    expect(close.className).toContain("min-w-11");
    expect(screen.getByLabelText("Rule name").className).toContain("caos-target");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("creates a scoped rule without forging authority, version, destinations, or delivery state", async () => {
    render(<Harness />);
    fireEvent.click(await screen.findByRole("button", { name: "Manage watch rules" }));
    fireEvent.change(screen.getByLabelText("Rule name"), { target: { value: "Unavailable market rule" } });
    fireEvent.change(screen.getByLabelText("Rule name"), { target: { value: "Covenant headroom" } });
    fireEvent.change(screen.getByLabelText("Signal"), { target: { value: "covenant" } });
    fireEvent.change(screen.getByLabelText("Operator"), { target: { value: "lt" } });
    fireEvent.change(screen.getByLabelText("Threshold"), { target: { value: "1.5" } });
    fireEvent.change(screen.getByLabelText("Issuer scope"), { target: { value: "issuer-17" } });
    fireEvent.change(screen.getByLabelText("Alert kind"), { target: { value: "covenant_headroom" } });
    fireEvent.change(screen.getByLabelText("Alert title"), { target: { value: "Headroom below threshold" } });
    fireEvent.change(screen.getByLabelText("Alert impact"), { target: { value: "Review liquidity and waiver options." } });
    fireEvent.click(screen.getByRole("button", { name: "Save rule" }));

    await waitFor(() => expect(createWatchRule).toHaveBeenCalledOnce());
    const payload = createWatchRule.mock.calls[0]![0];
    expect(payload).toMatchObject({
      name: "Covenant headroom",
      signal_type: "covenant",
      issuer_id: "issuer-17",
      enabled: true,
      config: { operator: "lt", threshold: 1.5, kind: "covenant_headroom" },
    });
    expect(payload).not.toHaveProperty("owner_user_id");
    expect(payload).not.toHaveProperty("team_id_snapshot");
    expect(payload).not.toHaveProperty("tenant_id");
    expect(payload).not.toHaveProperty("current_version");
    expect(payload).not.toHaveProperty("destination_ref");
    expect(payload).not.toHaveProperty("delivery_state");
  });

  it("forces source-unavailable signals disabled and validates schedule fields", async () => {
    render(<Harness />);
    fireEvent.click(await screen.findByRole("button", { name: "Manage watch rules" }));
    fireEvent.change(screen.getByLabelText("Rule name"), { target: { value: "Unavailable market rule" } });
    fireEvent.change(screen.getByLabelText("Signal"), { target: { value: "market_move" } });
    const enabled = screen.getByLabelText("Enabled") as HTMLInputElement;
    expect(enabled.disabled).toBe(true);
    expect(enabled.checked).toBe(false);
    expect(screen.getByText("Source unavailable · rule must remain disabled")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Schedule"), { target: { value: "interval" } });
    fireEvent.change(screen.getByLabelText("Interval seconds"), { target: { value: "59" } });
    fireEvent.click(screen.getByRole("button", { name: "Save rule" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Interval must be between 60 and 86400 seconds");
    expect(document.activeElement).toBe(screen.getByLabelText("Interval seconds"));
    expect(createWatchRule).not.toHaveBeenCalled();
  });

  it("updates with expected_version and recovers deterministically from a version conflict", async () => {
    updateWatchRule
      .mockRejectedValueOnce({ response: { status: 409, data: { detail: "watch_rule_version_conflict" } } })
      .mockImplementationOnce(async (_id, _version, patch) => rule({ ...patch, current_version: 5 }));
    render(<Harness />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit QA gate watch" }));
    fireEvent.change(screen.getByLabelText("Rule name"), { target: { value: "Edited QA watch" } });
    fireEvent.click(screen.getByRole("button", { name: "Save rule" }));
    expect(await screen.findByText(/Rule changed in another session/)).toBeTruthy();
    expect(updateWatchRule).toHaveBeenNthCalledWith(1, rule().id, 3, expect.objectContaining({ name: "Edited QA watch" }));

    fireEvent.click(screen.getByRole("button", { name: "Reload latest rule" }));
    await waitFor(() => expect(getWatchRule).toHaveBeenCalledWith(rule().id));
    expect((screen.getByLabelText("Rule name") as HTMLInputElement).value).toBe("Reloaded QA watch");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Save rule" }));
    fireEvent.click(screen.getByRole("button", { name: "Save rule" }));
    await waitFor(() => expect(updateWatchRule).toHaveBeenNthCalledWith(2, rule().id, 4, expect.any(Object)));
  });

  it("mirrors signal/operator validation and focuses an ordinary save failure", async () => {
    createWatchRule.mockRejectedValueOnce(new Error("write service unavailable"));
    render(<Harness />);
    fireEvent.click(await screen.findByRole("button", { name: "Manage watch rules" }));
    fireEvent.change(screen.getByLabelText("Rule name"), { target: { value: "QA comparison" } });
    fireEvent.change(screen.getByLabelText("Operator"), { target: { value: "gt" } });
    fireEvent.change(screen.getByLabelText("Threshold"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save rule" }));
    expect((await screen.findByRole("alert")).textContent).toContain("categorical signal supports only present or eq");
    expect(document.activeElement).toBe(screen.getByLabelText("Operator"));

    fireEvent.change(screen.getByLabelText("Operator"), { target: { value: "present" } });
    fireEvent.click(screen.getByRole("button", { name: "Save rule" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("write service unavailable");
    await waitFor(() => expect(document.activeElement).toBe(alert));
  });

  it("drains every rule page and rejects a repeated cursor without looping", async () => {
    getWatchRulePage
      .mockResolvedValueOnce({ items: [rule()], nextCursor: "rules-2" })
      .mockResolvedValueOnce({ items: [rule({ id: "9be42b26-53ba-47c4-a5dd-233488c59763", name: "Second page rule" })], nextCursor: null });
    const first = render(<Harness />);
    expect(await screen.findByText("Second page rule")).toBeTruthy();
    expect(getWatchRulePage).toHaveBeenNthCalledWith(1, expect.objectContaining({ cursor: undefined, limit: 100 }));
    expect(getWatchRulePage).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: "rules-2", limit: 100 }));
    first.unmount();

    getWatchRulePage.mockReset();
    getWatchRulePage
      .mockResolvedValueOnce({ items: [rule()], nextCursor: "repeat" })
      .mockResolvedValueOnce({ items: [], nextCursor: "repeat" });
    render(<Harness />);
    expect(await screen.findByText(/Persisted watch-rule pagination repeated a cursor/)).toBeTruthy();
    expect(getWatchRulePage).toHaveBeenCalledTimes(2);
  });

  it("fences a rule-list snapshot that began before a successful create", async () => {
    const create = deferred<ReturnType<typeof rule>>();
    const stale = deferred<{ items: ReturnType<typeof rule>[]; nextCursor: null }>();
    getWatchRulePage
      .mockResolvedValueOnce({ items: [rule()], nextCursor: null })
      .mockReturnValueOnce(stale.promise);
    createWatchRule.mockReturnValueOnce(create.promise);
    render(<RuleFenceHarness />);
    await waitFor(() => expect(screen.getByTestId("rule-names").textContent).toBe("QA gate watch"));
    fireEvent.click(screen.getByRole("button", { name: "Create during load" }));
    fireEvent.click(screen.getByRole("button", { name: "Reload rules" }));
    create.resolve(rule({ id: "abef8d12-66ed-4664-a919-4b1468ceaf18", name: "Created while loading" }));
    await create.promise;
    await waitFor(() => expect(screen.getByTestId("rule-names").textContent).toContain("Created while loading"));
    stale.resolve({ items: [rule()], nextCursor: null });
    await stale.promise;
    expect(screen.getByTestId("rule-names").textContent).toContain("Created while loading");
  });

  it("fences a rule-list snapshot started after a mutation begins", async () => {
    const update = deferred<ReturnType<typeof rule>>();
    const stale = deferred<{ items: ReturnType<typeof rule>[]; nextCursor: null }>();
    getWatchRulePage
      .mockResolvedValueOnce({ items: [rule()], nextCursor: null })
      .mockReturnValueOnce(stale.promise);
    updateWatchRule.mockReturnValueOnce(update.promise);
    render(<RuleFenceHarness />);
    await waitFor(() => expect(screen.getByTestId("rule-names").textContent).toBe("QA gate watch"));

    fireEvent.click(screen.getByRole("button", { name: "Update during load" }));
    fireEvent.click(screen.getByRole("button", { name: "Reload rules" }));
    update.resolve(rule({ current_version: 4, name: "Updated while loading" }));
    await update.promise;
    await waitFor(() => expect(screen.getByTestId("rule-names").textContent).toBe("Updated while loading"));

    stale.resolve({ items: [rule({ current_version: 3 })], nextCursor: null });
    await stale.promise;
    expect(screen.getByTestId("rule-names").textContent).toBe("Updated while loading");
  });

  it("does not upgrade an incomplete or failed rule list by attempting a hidden mutation", async () => {
    const reload = deferred<{ items: never[]; nextCursor: null }>();
    getWatchRulePage
      .mockResolvedValueOnce({ items: [rule()], nextCursor: null })
      .mockReturnValueOnce(reload.promise);
    render(<RuleFenceHarness />);
    await waitFor(() => expect(screen.getByTestId("rule-status").textContent).toBe("ready"));
    fireEvent.click(screen.getByRole("button", { name: "Reload rules" }));
    fireEvent.click(screen.getByRole("button", { name: "Create during load" }));
    expect(createWatchRule).not.toHaveBeenCalled();

    reload.reject(new Error("rule list unavailable"));
    await reload.promise.catch(() => undefined);
    await waitFor(() => expect(screen.getByTestId("rule-status").textContent).toBe("error"));
    fireEvent.click(screen.getByRole("button", { name: "Update during load" }));
    expect(updateWatchRule).not.toHaveBeenCalled();
    expect(screen.getByTestId("rule-status").textContent).toBe("error");
  });

  it("enables rule reads only from one exact-true workspace-settings snapshot", async () => {
    getSettings.mockReset().mockResolvedValue({ features: { alert_rules_v1_enabled: true } });

    render(<AvailabilityHarness />);

    await waitFor(() => expect(screen.getByTestId("rule-availability").textContent).toBe("enabled"));
    expect(await screen.findByText("QA gate watch")).toBeTruthy();
    expect(getSettings).toHaveBeenCalledOnce();
    expect(getWatchRulePage).toHaveBeenCalledOnce();
  });

  it("fails closed before every rule read or write when activation is off or cannot be verified", async () => {
    const cases: Array<{
      label: string;
      settings: unknown;
      rejects?: boolean;
      availability: "disabled" | "unavailable";
    }> = [
      {
        label: "explicit default-off flag",
        settings: { features: { alert_rules_v1_enabled: false } },
        availability: "disabled",
      },
      {
        label: "settings read failure",
        settings: new Error("workspace configuration offline"),
        rejects: true,
        availability: "unavailable",
      },
      {
        label: "missing feature field",
        settings: { features: {} },
        availability: "unavailable",
      },
      {
        label: "malformed feature field",
        settings: { features: { alert_rules_v1_enabled: "true" } },
        availability: "unavailable",
      },
    ];

    for (const scenario of cases) {
      cleanup();
      vi.clearAllMocks();
      getSettings.mockReset();
      if (scenario.rejects) getSettings.mockRejectedValue(scenario.settings);
      else getSettings.mockResolvedValue(scenario.settings);

      render(<AvailabilityHarness />);

      await waitFor(() => expect(screen.getByTestId("rule-availability").textContent, scenario.label).toBe(scenario.availability));
      const copy = document.body.textContent ?? "";
      if (scenario.availability === "disabled") {
        expect(copy, scenario.label).toMatch(/watch rules?.*disabled|disabled.*watch rules?|default-off/i);
        expect(copy, scenario.label).toMatch(/deployment|activation flag|default-off/i);
      } else {
        expect(copy, scenario.label).toMatch(/watch rules?.*unavailable|activation.*unavailable|could not verify/i);
      }
      expect(screen.queryByRole("button", { name: "Manage watch rules" }), scenario.label).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Probe guarded list refresh" }));
      fireEvent.click(screen.getByRole("button", { name: "Probe guarded item read" }));
      fireEvent.click(screen.getByRole("button", { name: "Probe guarded create" }));
      fireEvent.click(screen.getByRole("button", { name: "Probe guarded update" }));
      expect(getSettings, scenario.label).toHaveBeenCalledOnce();
      expect(getWatchRulePage, scenario.label).not.toHaveBeenCalled();
      expect(getWatchRule, scenario.label).not.toHaveBeenCalled();
      expect(createWatchRule, scenario.label).not.toHaveBeenCalled();
      expect(updateWatchRule, scenario.label).not.toHaveBeenCalled();
    }
  });

  it("rechecks only workspace settings and transitions from disabled or unavailable to enabled", async () => {
    const initialSnapshots: unknown[] = [
      { features: { alert_rules_v1_enabled: false } },
      new Error("workspace configuration offline"),
    ];

    for (const initial of initialSnapshots) {
      cleanup();
      vi.clearAllMocks();
      getSettings.mockReset();
      if (initial instanceof Error) getSettings.mockRejectedValueOnce(initial);
      else getSettings.mockResolvedValueOnce(initial);
      getSettings.mockResolvedValueOnce({ features: { alert_rules_v1_enabled: true } });
      getWatchRulePage.mockResolvedValue({ items: [rule()], nextCursor: null });

      render(<AvailabilityHarness />);

      const activationButton = await screen.findByRole("button", { name: /watch-rule activation/i });
      expect(getWatchRulePage).not.toHaveBeenCalled();
      fireEvent.click(activationButton);
      await waitFor(() => expect(screen.getByTestId("rule-availability").textContent).toBe("enabled"));
      expect(await screen.findByText("QA gate watch")).toBeTruthy();
      expect(getSettings).toHaveBeenCalledTimes(2);
      expect(getWatchRulePage).toHaveBeenCalledOnce();
    }
  });

  it("fences stale settings and rule-list responses and ignores activation completion after unmount", async () => {
    const staleSettings = deferred<{ features: { alert_rules_v1_enabled: true } }>();
    getSettings.mockReset()
      .mockReturnValueOnce(staleSettings.promise)
      .mockResolvedValueOnce({ features: { alert_rules_v1_enabled: false } });
    const first = render(<AvailabilityHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Probe activation again" }));
    await waitFor(() => expect(screen.getByTestId("rule-availability").textContent).toBe("disabled"));
    staleSettings.resolve({ features: { alert_rules_v1_enabled: true } });
    await staleSettings.promise;
    expect(screen.getByTestId("rule-availability").textContent).toBe("disabled");
    expect(getWatchRulePage).not.toHaveBeenCalled();
    first.unmount();

    const staleRules = deferred<{ items: ReturnType<typeof rule>[]; nextCursor: null }>();
    getSettings.mockReset()
      .mockResolvedValueOnce({ features: { alert_rules_v1_enabled: true } })
      .mockResolvedValueOnce({ features: { alert_rules_v1_enabled: false } });
    getWatchRulePage.mockReset().mockReturnValueOnce(staleRules.promise);
    render(<AvailabilityHarness />);
    await waitFor(() => expect(getWatchRulePage).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Probe activation again" }));
    await waitFor(() => expect(screen.getByTestId("rule-availability").textContent).toBe("disabled"));
    staleRules.resolve({ items: [rule({ name: "Stale enabled rule" })], nextCursor: null });
    await staleRules.promise;
    expect(screen.queryByText("Stale enabled rule")).toBeNull();

    cleanup();
    const afterUnmount = deferred<{ features: { alert_rules_v1_enabled: true } }>();
    getSettings.mockReset().mockReturnValueOnce(afterUnmount.promise);
    getWatchRulePage.mockReset();
    const unmounted = render(<AvailabilityHarness />);
    unmounted.unmount();
    afterUnmount.resolve({ features: { alert_rules_v1_enabled: true } });
    await afterUnmount.promise;
    expect(getWatchRulePage).not.toHaveBeenCalled();
  });
});
