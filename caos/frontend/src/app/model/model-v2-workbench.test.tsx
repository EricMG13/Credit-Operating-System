// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateModelV2,
  commitModelV2Workbook,
  createModelV2Checkpoint,
  exportModelV2Workbook,
  getAnalystSettings,
  getModelV2,
  getModelV2Checkpoints,
  getModelV2History,
  mutateModelV2OverridesBatch,
  previewModelV2Workbook,
  replayModelV2Override,
  restoreModelV2Checkpoint,
  saveModelV2,
} from "@/lib/api";
import { NavigationGuardProvider } from "@/components/shared/NavigationGuardProvider";
import type {
  ModelV2Calculation,
  ModelV2Checkpoint,
  ModelV2DraftPayload,
  ModelV2DraftRecord,
  ModelV2LegacyWorkbookMapping,
  ModelV2ReadResponse,
  ModelV2OverrideEvent,
  ModelV2WorkbookPreview,
} from "@/lib/engine/modelV2";
import { ModelV2Workbench } from "./ModelV2Workbench";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/model",
  useRouter: () => navigation,
  useSearchParams: () => new URLSearchParams("issuer=issuer-1&context=context-1"),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  calculateModelV2: vi.fn(),
  commitModelV2Workbook: vi.fn(),
  createModelV2Checkpoint: vi.fn(),
  exportModelV2Workbook: vi.fn(),
  getAnalystSettings: vi.fn(),
  getModelV2: vi.fn(),
  getModelV2Checkpoints: vi.fn(),
  getModelV2History: vi.fn(),
  mutateModelV2OverridesBatch: vi.fn(),
  previewModelV2Workbook: vi.fn(),
  replayModelV2Override: vi.fn(),
  restoreModelV2Checkpoint: vi.fn(),
  saveModelV2: vi.fn(),
}));

const authority = {
  origin: "live" as const,
  method: "CP-1 normalized financials",
  source_ids: ["run-exact", "cp1-exact"],
  as_of: "2026-07-14T00:00:00Z",
};

const basePayload: ModelV2DraftPayload = {
  schema_version: 2,
  reporting_currency: "USD",
  reporting_unit: "millions",
  periods: [{
    period_key: "FY2026",
    label: "FY26",
    kind: "forecast",
    months: 12,
    revenue: 100,
    reported_ebitda: 20,
    adjustments: 0,
    adjusted_ebitda: 20,
    cash: 10,
    total_debt: 80,
    net_debt: 70,
    cash_interest: 5,
    taxes: 2,
    capex: 4,
    working_capital_change: 0,
    other_cash_flow: 0,
    authority,
  }],
  debt_instruments: [],
  overrides: [],
  ui_preferences: {
    show_quarters: true,
    show_assumptions: true,
    show_scenarios: true,
    warn_on_unsaved_leave: true,
    collapsed_rows: [],
  },
  source_ids: ["run-exact", "cp1-exact"],
};

function calculation(overridden = false): ModelV2Calculation {
  return {
    engine_version: "2.0.0",
    schema_version: 2,
    status: "ready",
    source_fingerprint: "a".repeat(64),
    input_fingerprint: "b".repeat(64),
    calculation_hash: "c".repeat(64),
    periods: [{
      period_key: "FY2026",
      label: "FY26",
      kind: "forecast",
      revenue: overridden ? 110 : 100,
      reported_ebitda: 20,
      adjustments: 0,
      adjusted_ebitda: 20,
      cash_interest: 5,
      total_debt: 80,
      cash: 10,
      net_debt: 70,
      gross_leverage: 4,
      net_leverage: 3.5,
      interest_coverage: 4,
      free_cash_flow: 9,
      instruments: [],
      nodes: [{
        node_id: "input:FY2026:revenue",
        value: overridden ? 110 : 100,
        original_value: 100,
        formula: null,
        overridden,
        override_reason: overridden ? "Analyst source correction" : null,
      }, {
        node_id: "input:FY2026:adjusted_ebitda",
        value: 20,
        original_value: 20,
        formula: null,
        overridden: false,
        override_reason: null,
      }, {
        node_id: "calc:FY2026:net_leverage",
        value: 3.5,
        original_value: 3.5,
        formula: "net_debt / adjusted_ebitda",
        overridden: false,
        override_reason: null,
      }],
    }],
    gaps: [],
    warnings: [],
  };
}

function sensitivityCalculation(): ModelV2Calculation {
  const result = calculation();
  const period = result.periods[0];
  return {
    ...result,
    calculation_hash: "e".repeat(64),
    periods: [{
      ...period,
      adjusted_ebitda: 15,
      gross_leverage: 80 / 15,
      net_leverage: 70 / 15,
      interest_coverage: 3,
      free_cash_flow: 4,
      nodes: period.nodes.map((node) => {
        if (node.node_id === "input:FY2026:adjusted_ebitda") {
          return { ...node, value: 15, overridden: true, override_reason: "Transient sensitivity preview" };
        }
        if (node.node_id === "calc:FY2026:net_leverage") {
          return { ...node, value: 70 / 15 };
        }
        return node;
      }),
    }],
  };
}

function currentRecalculation(): ModelV2Calculation {
  const result = calculation();
  const period = result.periods[0];
  return {
    ...result,
    calculation_hash: "d".repeat(64),
    periods: [{
      ...period,
      revenue: 95,
      nodes: period.nodes.map((node) => node.node_id === "input:FY2026:revenue"
        ? { ...node, value: 95 }
        : node),
    }],
  };
}

function makeRecord(overridden = false, revision = 2): ModelV2DraftRecord {
  const activeOverride = {
    node_id: "input:FY2026:revenue",
    value_type: "number" as const,
    value: 110,
    reason: "Analyst source correction",
    scope: "draft",
    source: "analyst-ui",
    expires_at: null,
  };
  const payload = {
    ...basePayload,
    overrides: overridden ? [activeOverride] : [],
  };
  const result = calculation(overridden);
  return {
    id: "draft-1",
    issuer_id: "issuer-1",
    analyst_id: "analyst-1",
    context_id: "context-1",
    source_run_id: "run-exact",
    payload,
    calculation: result,
    source_fingerprint: result.source_fingerprint,
    input_fingerprint: result.input_fingerprint,
    engine_version: result.engine_version,
    calculation_hash: result.calculation_hash,
    revision,
    created_at: "2026-07-14T00:00:00Z",
    updated_at: "2026-07-14T00:00:00Z",
  };
}

function response(record: ModelV2DraftRecord | null = makeRecord()): ModelV2ReadResponse {
  return {
    authority: "model-engine-v2",
    record,
    suggested_payload: record ? null : basePayload,
    suggested_calculation: record ? null : calculation(),
    suggested_source_run_id: record ? null : "run-exact",
    current_calculation: null,
    requires_recalculation: false,
    availability: record ? "saved" : "suggested",
    detail: null,
  };
}

function historyEvent(
  action: ModelV2OverrideEvent["action"],
  revision: number,
  inverseEventId: string | null = null,
  options: { id?: string; nodeId?: string } = {},
): ModelV2OverrideEvent {
  const nodeId = options.nodeId ?? "input:FY2026:revenue";
  return {
    id: options.id ?? `event-${action}-${revision}`,
    draft_id: "draft-1",
    action,
    node_id: nodeId,
    value_type: "number",
    before_value: null,
    after_value: {
      node_id: nodeId,
      value_type: "number",
      value: 110,
      reason: "Analyst source correction",
      scope: "draft",
      source: "analyst-ui",
      expires_at: null,
    },
    original_formula: null,
    original_value: { value: 100 },
    reason: "Analyst source correction",
    scope: "draft",
    source: "analyst-ui",
    actor_id: "analyst-1",
    expires_at: null,
    revision,
    inverse_event_id: inverseEventId,
    created_at: "2026-07-14T00:00:00Z",
  };
}

function checkpoint(): ModelV2Checkpoint {
  return {
    id: "checkpoint-1",
    issuer_id: "issuer-1",
    context_id: "context-1",
    issuer_run_id: "run-exact",
    parent_checkpoint_id: null,
    label: "Committee base",
    payload_hash: "e".repeat(64),
    engine_version: "2.0.0",
    source_fingerprint: "a".repeat(64),
    input_fingerprint: "b".repeat(64),
    calculation_hash: "c".repeat(64),
    draft_revision: 2,
    created_at: "2026-07-14T00:00:00Z",
  };
}

function workbookPreview(
  overrides: Partial<ModelV2WorkbookPreview> = {},
): ModelV2WorkbookPreview {
  return {
    mode: "strict_v1",
    workbook_sha256: "d".repeat(64),
    sheet_names: ["Cover", "Model", "Assumptions", "Debt Schedule", "Overrides", "Sources - Audit"],
    mapping: null,
    draft_payload: basePayload,
    calculation: calculation(),
    identity: { issuer_id: "issuer-1", draft_revision: 2, exported_by: "analyst-1", exported_at: "2026-07-14T00:00:00Z" },
    embedded_hashes: { engine_version: "2.0.0", source_fingerprint: "a".repeat(64), input_fingerprint: "b".repeat(64), calculation_hash: "c".repeat(64) },
    formula_audit: [],
    ambiguities: [],
    issues: [],
    blocking_count: 0,
    warning_count: 0,
    preview_token: "signed-preview",
    expected_revision: 2,
    ...overrides,
  };
}

const closeFormatMapping: ModelV2LegacyWorkbookMapping = {
  mode: "mapped_legacy",
  assumptions: {
    layout: "records",
    sheet: "Model",
    header_row: 1,
    columns: {
      period_key: "Period Key",
      label: "Label",
      kind: "Kind",
      revenue: "Revenue",
    },
  },
  debt_schedule: null,
  overrides: null,
  reporting_currency: "USD",
  reporting_unit: "millions",
  source_ids: ["document-1"],
  authority_as_of: "2026-07-14T00:00:00Z",
};

const matrixMapping: ModelV2LegacyWorkbookMapping = {
  mode: "mapped_legacy",
  assumptions: {
    layout: "account_period_matrix",
    sheet: "Model",
    header_row: 1,
    account_column: "Account",
    account_rows: { revenue: "Revenue" },
    period_columns: { FY2026: "FY26" },
    period_kinds: { FY2026: "forecast" },
  },
  debt_schedule: null,
  overrides: null,
  reporting_currency: "USD",
  reporting_unit: "millions",
  source_ids: ["document-1"],
  authority_as_of: "2026-07-14T00:00:00Z",
};

function renderWorkbench(initialResponse = response()) {
  return render(
    <NavigationGuardProvider>
      <ModelV2Workbench issuerId="issuer-1" contextId="context-1" initialResponse={initialResponse} />
    </NavigationGuardProvider>,
  );
}

function editNode(nodeId: string, value: string, reason = "") {
  fireEvent.click(screen.getByRole("button", { name: `Edit ${nodeId}` }));
  fireEvent.change(screen.getByLabelText("Numeric value"), { target: { value } });
  if (reason) fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: reason } });
  fireEvent.click(screen.getByRole("button", { name: "Queue override" }));
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

beforeEach(() => {
  window.history.replaceState({}, "", "/model?issuer=issuer-1&context=context-1");
  vi.mocked(getAnalystSettings).mockResolvedValue({
    model_lanes: {},
    email_intelligence: { approved_senders: [] },
    workspace: {},
    revision: 1,
  });
  vi.mocked(getModelV2History).mockResolvedValue([]);
  vi.mocked(getModelV2Checkpoints).mockResolvedValue([]);
  vi.mocked(calculateModelV2).mockResolvedValue(calculation());
  vi.mocked(mutateModelV2OverridesBatch).mockResolvedValue(makeRecord(false, 3));
  vi.mocked(saveModelV2).mockResolvedValue(makeRecord(false, 1));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("Model Engine v2 workbench", () => {
  it("renders a stale saved revision against the current calculation and requires an explicit save before checkpoint or export", async () => {
    const staleRecord = makeRecord(false, 2);
    const current = currentRecalculation();
    const refreshedRecord: ModelV2DraftRecord = {
      ...staleRecord,
      calculation: current,
      calculation_hash: current.calculation_hash,
      revision: 3,
    };
    vi.mocked(saveModelV2).mockResolvedValue(refreshedRecord);
    renderWorkbench({
      ...response(staleRecord),
      current_calculation: current,
      requires_recalculation: true,
      detail: "An override expired; recalculate and save before checkpoint or export.",
    });

    expect(await screen.findByText("Recalculation required")).toBeTruthy();
    const revenueRow = screen.getByRole("row", { name: /input:FY2026:revenue/ });
    expect(revenueRow.textContent).toContain("95");
    expect(screen.getByText(/ready · rev 2/i).textContent).toContain("REV 2");
    expect((screen.getByRole("button", { name: "Create checkpoint" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Open Model v2 tools" }));
    expect((screen.getByRole("button", { name: "Export workbook" }) as HTMLButtonElement).disabled).toBe(true);
    expect(saveModelV2).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Recalculate & save" }));
    await waitFor(() => expect(saveModelV2).toHaveBeenCalledWith("issuer-1", {
      payload: staleRecord.payload,
      expected_revision: 2,
      context_id: "context-1",
      source_run_id: "run-exact",
    }));
    expect(await screen.findByText("Current server calculation saved as revision 3.")).toBeTruthy();
    expect(screen.queryByText("Recalculation required")).toBeNull();
  });

  it("keeps input and derived edits local, previews on the server, and commits one atomic batch", async () => {
    renderWorkbench();
    await screen.findByText("input:FY2026:revenue");
    expect(screen.getByText(/USD · millions · ready · rev 2/i)).toBeTruthy();

    editNode("input:FY2026:revenue", "125");
    fireEvent.click(screen.getByRole("button", { name: "Edit calc:FY2026:net_leverage" }));
    fireEvent.click(screen.getByLabelText("Set unavailable (null)"));
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "Committee downside case" } });
    expect(new Date((screen.getByLabelText("Override expiry") as HTMLInputElement).value).getTime())
      .toBeGreaterThan(Date.now());
    fireEvent.click(screen.getByRole("button", { name: "Queue override" }));

    fireEvent.click(screen.getByRole("button", { name: "Preview pending" }));
    await waitFor(() => expect(calculateModelV2).toHaveBeenCalledOnce());
    const previewRequest = vi.mocked(calculateModelV2).mock.calls[0][1];
    expect(previewRequest.source_run_id).toBe("run-exact");
    expect(previewRequest.payload.overrides).toEqual(expect.arrayContaining([
      expect.objectContaining({ node_id: "input:FY2026:revenue", value: 125, value_type: "number" }),
      expect.objectContaining({ node_id: "calc:FY2026:net_leverage", value: null, value_type: "null", reason: "Committee downside case" }),
    ]));
    const derivedOverride = previewRequest.payload.overrides.find(
      (override) => override.node_id === "calc:FY2026:net_leverage",
    );
    expect(derivedOverride?.source).toBe("analyst-ui");
    expect(derivedOverride?.expires_at).toBeTruthy();
    expect(Date.parse(derivedOverride?.expires_at ?? "")).toBeGreaterThan(Date.now());

    fireEvent.click(await screen.findByRole("button", { name: "Commit 2 pending" }));
    await waitFor(() => expect(mutateModelV2OverridesBatch).toHaveBeenCalledWith(
      "issuer-1",
      expect.objectContaining({
        expected_revision: 2,
        mutations: expect.arrayContaining([
          expect.objectContaining({ action: "set", override: expect.objectContaining({ node_id: "input:FY2026:revenue" }) }),
          expect.objectContaining({ action: "set", override: expect.objectContaining({ node_id: "calc:FY2026:net_leverage" }) }),
        ]),
      }),
    ));
  });

  it("resets a transient server sensitivity without erasing or committing manual overrides", async () => {
    vi.mocked(calculateModelV2)
      .mockResolvedValueOnce(calculation())
      .mockResolvedValueOnce(sensitivityCalculation())
      .mockResolvedValueOnce(calculation());
    renderWorkbench();
    await screen.findByText("input:FY2026:revenue");

    editNode("input:FY2026:revenue", "125");
    fireEvent.change(screen.getByLabelText("Scenario node"), {
      target: { value: "input:FY2026:adjusted_ebitda" },
    });
    fireEvent.change(screen.getByLabelText("Scenario value"), {
      target: { value: "15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview sensitivity" }));

    await waitFor(() => expect(calculateModelV2).toHaveBeenCalledTimes(2));
    const baselineRequest = vi.mocked(calculateModelV2).mock.calls[0][1];
    expect(baselineRequest.payload.overrides).toEqual([
      expect.objectContaining({
        node_id: "input:FY2026:revenue",
        value: 125,
        scope: "draft",
      }),
    ]);
    const scenarioRequest = vi.mocked(calculateModelV2).mock.calls[1][1];
    expect(scenarioRequest.payload.overrides).toEqual([
      expect.objectContaining({
        node_id: "input:FY2026:adjusted_ebitda",
        value: 15,
        scope: "scenario",
        source: "analyst-ui-scenario",
        expires_at: expect.any(String),
      }),
      expect.objectContaining({
        node_id: "input:FY2026:revenue",
        value: 125,
        scope: "draft",
      }),
    ]);
    const scenarioOverride = scenarioRequest.payload.overrides.find(
      (override) => override.scope === "scenario",
    );
    expect(Date.parse(scenarioOverride?.expires_at ?? "")).toBeGreaterThan(Date.now());
    expect(await screen.findByText(/Transient sensitivity calculated on the server/)).toBeTruthy();
    const netLeverage = screen.getByRole("row", { name: /Net leverage/ });
    expect(netLeverage.textContent).toContain("3.5");
    expect(netLeverage.textContent).toContain("4.6667");
    expect(netLeverage.textContent).toContain("+1.1667");

    fireEvent.click(screen.getByRole("button", { name: "Reset sensitivity" }));
    expect((screen.getByLabelText("Scenario node") as HTMLSelectElement).value).toBe("");
    expect((screen.getByLabelText("Scenario value") as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("row", { name: /input:FY2026:revenue/ }).textContent).toContain("125 PENDING");
    expect(screen.getByRole("button", { name: "Commit 1 pending" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Preview pending" }));
    await waitFor(() => expect(calculateModelV2).toHaveBeenCalledTimes(3));
    expect(vi.mocked(calculateModelV2).mock.calls[2][1].payload.overrides).toEqual([
      expect.objectContaining({
        node_id: "input:FY2026:revenue",
        value: 125,
        scope: "draft",
      }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Commit 1 pending" }));
    await waitFor(() => expect(mutateModelV2OverridesBatch).toHaveBeenCalledWith(
      "issuer-1",
      {
        expected_revision: 2,
        mutations: [expect.objectContaining({
          action: "set",
          override: expect.objectContaining({
            node_id: "input:FY2026:revenue",
            value: 125,
            scope: "draft",
          }),
        })],
      },
    ));
    expect(JSON.stringify(vi.mocked(mutateModelV2OverridesBatch).mock.calls[0][1]))
      .not.toContain("input:FY2026:adjusted_ebitda");
  });

  it("honors the saved scenario-visibility preference", async () => {
    const hidden = makeRecord();
    hidden.payload = {
      ...hidden.payload,
      ui_preferences: {
        ...hidden.payload.ui_preferences,
        show_scenarios: false,
      },
    };
    renderWorkbench(response(hidden));
    await screen.findByText("input:FY2026:revenue");
    expect(screen.queryByText("Transient sensitivity")).toBeNull();
    expect(screen.queryByLabelText("Scenario node")).toBeNull();
  });

  it("bounds large calculation graphs and keeps every node reachable by paging or filtering", async () => {
    const large = makeRecord();
    large.calculation = {
      ...large.calculation,
      periods: [{
        ...large.calculation.periods[0],
        nodes: Array.from({ length: 350 }, (_, index) => ({
          node_id: `calc:FY2026:node-${String(index).padStart(3, "0")}`,
          value: index,
          original_value: index,
          formula: "bounded graph fixture",
          overridden: false,
          override_reason: null,
        })),
      }],
    };
    renderWorkbench(response(large));

    await screen.findByText("calc:FY2026:node-000");
    expect(screen.getAllByRole("button", { name: /^Edit calc:FY2026:node-/ })).toHaveLength(100);
    expect(screen.queryByRole("row", { name: /calc:FY2026:node-349/ })).toBeNull();
    expect((screen.getByLabelText("Scenario node") as HTMLSelectElement).options).toHaveLength(201);

    fireEvent.click(screen.getByRole("button", { name: "Next nodes" }));
    expect(screen.getByRole("row", { name: /calc:FY2026:node-100/ })).toBeTruthy();
    expect(screen.queryByRole("row", { name: /calc:FY2026:node-000/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Previous nodes" }));
    expect(screen.getByRole("row", { name: /calc:FY2026:node-000/ })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Filter calculation nodes"), {
      target: { value: "node-349" },
    });
    expect(screen.getByRole("row", { name: /calc:FY2026:node-349/ })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Edit calc:FY2026:node-/ })).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("Filter scenario nodes"), {
      target: { value: "node-349" },
    });
    expect(screen.getByRole("option", { name: /node-349/ })).toBeTruthy();
    expect((screen.getByLabelText("Scenario node") as HTMLSelectElement).options).toHaveLength(2);

    fireEvent.change(screen.getByLabelText("Scenario node"), {
      target: { value: "calc:FY2026:node-349" },
    });
    fireEvent.change(screen.getByLabelText("Filter scenario nodes"), {
      target: { value: "" },
    });
    expect((screen.getByLabelText("Scenario node") as HTMLSelectElement).options[1].value).toBe("calc:FY2026:node-349");
  });

  it("discards an in-flight sensitivity when its node or value changes", async () => {
    const baseline = deferred<ModelV2Calculation>();
    const stressed = deferred<ModelV2Calculation>();
    vi.mocked(calculateModelV2)
      .mockReturnValueOnce(baseline.promise)
      .mockReturnValueOnce(stressed.promise);
    renderWorkbench();
    await screen.findByText("input:FY2026:adjusted_ebitda");

    fireEvent.change(screen.getByLabelText("Scenario node"), {
      target: { value: "input:FY2026:adjusted_ebitda" },
    });
    fireEvent.change(screen.getByLabelText("Scenario value"), {
      target: { value: "15" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview sensitivity" }));
    await waitFor(() => expect(calculateModelV2).toHaveBeenCalledTimes(2));

    fireEvent.change(screen.getByLabelText("Scenario value"), {
      target: { value: "16" },
    });
    await act(async () => {
      baseline.resolve(calculation());
      stressed.resolve(sensitivityCalculation());
      await Promise.all([baseline.promise, stressed.promise]);
    });

    expect(await screen.findByText(/Working inputs changed while the sensitivity was running/)).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Sensitivity decision deltas" })).toBeNull();
    expect((screen.getByLabelText("Scenario value") as HTMLInputElement).value).toBe("16");
  });

  it("requires a fresh preview when another override is queued while a preview is in flight", async () => {
    const previewA = deferred<ModelV2Calculation>();
    vi.mocked(calculateModelV2)
      .mockReturnValueOnce(previewA.promise)
      .mockResolvedValueOnce(calculation());
    renderWorkbench();
    await screen.findByText("input:FY2026:revenue");

    editNode("input:FY2026:revenue", "125");
    fireEvent.click(screen.getByRole("button", { name: "Edit calc:FY2026:net_leverage" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview pending" }));
    await waitFor(() => expect(calculateModelV2).toHaveBeenCalledOnce());

    fireEvent.change(screen.getByLabelText("Numeric value"), { target: { value: "4.25" } });
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "Updated downside case" } });
    fireEvent.click(screen.getByRole("button", { name: "Queue override" }));
    const commitTwo = screen.getByRole("button", { name: "Commit 2 pending" }) as HTMLButtonElement;
    expect(commitTwo.disabled).toBe(true);

    await act(async () => {
      previewA.resolve(calculation());
      await previewA.promise;
    });
    expect(await screen.findByText(/Pending edits changed while the server preview was running/)).toBeTruthy();
    expect(commitTwo.disabled).toBe(true);
    fireEvent.click(commitTwo);
    expect(mutateModelV2OverridesBatch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Preview pending" }));
    await waitFor(() => expect(calculateModelV2).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(commitTwo.disabled).toBe(false));
    const firstPreview = vi.mocked(calculateModelV2).mock.calls[0][1];
    const secondPreview = vi.mocked(calculateModelV2).mock.calls[1][1];
    expect(firstPreview.payload.overrides.map((override) => override.node_id)).toEqual([
      "input:FY2026:revenue",
    ]);
    expect(secondPreview.payload.overrides.map((override) => override.node_id)).toEqual([
      "calc:FY2026:net_leverage",
      "input:FY2026:revenue",
    ]);

    fireEvent.click(commitTwo);
    await waitFor(() => expect(mutateModelV2OverridesBatch).toHaveBeenCalledOnce());
  });

  it("preserves a dirty editor by blocking edit-switch and restore row actions", async () => {
    renderWorkbench(response(makeRecord(true)));
    await screen.findByText("calc:FY2026:net_leverage");

    fireEvent.click(screen.getByRole("button", { name: "Edit calc:FY2026:net_leverage" }));
    fireEvent.change(screen.getByLabelText("Numeric value"), { target: { value: "4.25" } });
    const editRevenue = screen.getByRole("button", { name: "Edit input:FY2026:revenue" }) as HTMLButtonElement;
    const restoreRevenue = screen.getByRole("button", { name: "Restore input:FY2026:revenue" }) as HTMLButtonElement;

    expect(editRevenue.disabled).toBe(true);
    expect(restoreRevenue.disabled).toBe(true);
    fireEvent.click(editRevenue);
    fireEvent.click(restoreRevenue);
    expect((screen.getByLabelText("Numeric value") as HTMLInputElement).value).toBe("4.25");
    expect(screen.getByText("editor change · not queued", { exact: false })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Commit 0 pending" })).toBeTruthy();
  });

  it("walks committed revision groups through consecutive undo and redo actions", async () => {
    const eventA = historyEvent("set", 2, null, {
      id: "event-a",
      nodeId: "input:FY2026:revenue",
    });
    const eventB = historyEvent("set", 3, null, {
      id: "event-b",
      nodeId: "calc:FY2026:net_leverage",
    });
    const undoB = historyEvent("undo", 4, eventB.id, { id: "undo-b", nodeId: eventB.node_id });
    const undoA = historyEvent("undo", 5, eventA.id, { id: "undo-a", nodeId: eventA.node_id });
    const redoA = historyEvent("redo", 6, eventA.id, { id: "redo-a", nodeId: eventA.node_id });
    const redoB = historyEvent("redo", 7, eventB.id, { id: "redo-b", nodeId: eventB.node_id });
    vi.mocked(getModelV2History)
      .mockResolvedValueOnce([eventB, eventA])
      .mockResolvedValueOnce([undoB, eventB, eventA])
      .mockResolvedValueOnce([undoA, undoB, eventB, eventA])
      .mockResolvedValueOnce([redoA, undoA, undoB, eventB, eventA])
      .mockResolvedValue([redoB, redoA, undoA, undoB, eventB, eventA]);
    vi.mocked(replayModelV2Override)
      .mockResolvedValueOnce(makeRecord(false, 4))
      .mockResolvedValueOnce(makeRecord(false, 5))
      .mockResolvedValueOnce(makeRecord(false, 6))
      .mockResolvedValueOnce(makeRecord(true, 7));
    renderWorkbench(response(makeRecord(false, 3)));

    const undo = screen.getByRole("button", { name: "Undo" });
    const redo = screen.getByRole("button", { name: "Redo" });
    await waitFor(() => expect((undo as HTMLButtonElement).disabled).toBe(false));
    expect((redo as HTMLButtonElement).disabled).toBe(true);
    const audit = screen.getByRole("article", {
      name: "Override event calc:FY2026:net_leverage revision 3",
    });
    expect(audit.textContent).toContain("ACTOR analyst-1");
    expect(audit.textContent).toContain("BEFORE — → AFTER 110");
    expect(audit.textContent).toContain("ORIGINAL 100 · FORMULA INPUT");
    expect(audit.textContent).toContain("REASON Analyst source correction");
    expect(audit.textContent).toContain("SCOPE draft · SOURCE analyst-ui");
    expect(audit.textContent).toContain("EXPIRY None");

    fireEvent.click(undo);
    await waitFor(() => expect(replayModelV2Override).toHaveBeenNthCalledWith(1, "issuer-1", eventB.id, {
      expected_revision: 3,
      mode: "undo",
    }));
    await waitFor(() => {
      expect((undo as HTMLButtonElement).disabled).toBe(false);
      expect((redo as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(undo);
    await waitFor(() => expect(replayModelV2Override).toHaveBeenNthCalledWith(2, "issuer-1", eventA.id, {
      expected_revision: 4,
      mode: "undo",
    }));
    await waitFor(() => {
      expect((undo as HTMLButtonElement).disabled).toBe(true);
      expect((redo as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(redo);
    await waitFor(() => expect(replayModelV2Override).toHaveBeenNthCalledWith(3, "issuer-1", eventA.id, {
      expected_revision: 5,
      mode: "redo",
    }));
    await waitFor(() => {
      expect((undo as HTMLButtonElement).disabled).toBe(false);
      expect((redo as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(redo);
    await waitFor(() => expect(replayModelV2Override).toHaveBeenNthCalledWith(4, "issuer-1", eventB.id, {
      expected_revision: 6,
      mode: "redo",
    }));
    await waitFor(() => {
      expect((undo as HTMLButtonElement).disabled).toBe(false);
      expect((redo as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it("creates and restores immutable server checkpoints with revision guards", async () => {
    const savedCheckpoint = checkpoint();
    vi.mocked(createModelV2Checkpoint).mockResolvedValue(savedCheckpoint);
    vi.mocked(restoreModelV2Checkpoint).mockResolvedValue(makeRecord(false, 3));
    renderWorkbench();

    fireEvent.change(await screen.findByLabelText("Checkpoint label"), {
      target: { value: "IC downside" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create checkpoint" }));
    await waitFor(() => expect(createModelV2Checkpoint).toHaveBeenCalledWith("issuer-1", {
      context_id: "context-1",
      label: "IC downside",
      issuer_run_id: "run-exact",
      expected_revision: 2,
      calculation_hash: "c".repeat(64),
    }));

    fireEvent.click(await screen.findByRole("button", { name: "Restore" }));
    await waitFor(() => expect(restoreModelV2Checkpoint).toHaveBeenCalledWith("issuer-1", "checkpoint-1", {
      expected_revision: 2,
    }));
  });

  it("requires a non-empty reason before a derived override can be queued", async () => {
    renderWorkbench();
    await screen.findByText("calc:FY2026:net_leverage");

    editNode("calc:FY2026:net_leverage", "5.0");

    expect(screen.getByText("A derived-cell override requires a non-empty reason.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Commit 0 pending" })).toBeTruthy();
    expect(calculateModelV2).not.toHaveBeenCalled();
    expect(mutateModelV2OverridesBatch).not.toHaveBeenCalled();
  });

  it("requires a reason for derived debt-schedule cells as well as calc nodes", async () => {
    const draft = makeRecord();
    const debtNode = {
      node_id: "debt:term-loan:FY2026:closing_balance",
      value: 80,
      original_value: 80,
      formula: "opening_balance + draws - repayments - scheduled_amortization + pik_interest",
      overridden: false,
      override_reason: null,
    };
    draft.calculation = {
      ...draft.calculation,
      periods: draft.calculation.periods.map((period) => ({
        ...period,
        nodes: [...period.nodes, debtNode],
      })),
    };
    renderWorkbench(response(draft));
    await screen.findByText(debtNode.node_id);

    editNode(debtNode.node_id, "75");

    expect(screen.getByText("A derived-cell override requires a non-empty reason.")).toBeTruthy();
    expect(mutateModelV2OverridesBatch).not.toHaveBeenCalled();
  });

  it("queues restoration to the canonical original value and commits it as a reset", async () => {
    renderWorkbench(response(makeRecord(true)));
    await screen.findByText("OVERRIDDEN · Analyst source correction");
    expect(screen.getAllByText("100").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Restore input:FY2026:revenue" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview pending" }));
    await waitFor(() => expect(calculateModelV2).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Commit 1 pending" }));

    await waitFor(() => expect(mutateModelV2OverridesBatch).toHaveBeenCalledWith("issuer-1", {
      expected_revision: 2,
      mutations: [{ action: "reset", node_id: "input:FY2026:revenue" }],
    }));
  });

  it("requires upload, stateless preview, explicit confirmation, then commit for workbook import", async () => {
    const preview = workbookPreview();
    vi.mocked(previewModelV2Workbook).mockResolvedValue(preview);
    vi.mocked(commitModelV2Workbook).mockResolvedValue({
      existing: false,
      import_id: "import-1",
      document_id: "document-1",
      source_manifest_id: "manifest-1",
      workbook_sha256: preview.workbook_sha256,
      import_fingerprint: "e".repeat(64),
      committed_revision: 3,
      calculation_hash: "c".repeat(64),
      record: makeRecord(false, 3),
    });
    renderWorkbench();
    const file = new File(["xlsx"], "model.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    fireEvent.change(await screen.findByLabelText("Model workbook"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Preview workbook" }));
    await screen.findByText(/strict_v1/);
    expect(commitModelV2Workbook).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox", { name: /I reviewed this preview/ }));
    fireEvent.click(screen.getByRole("button", { name: "Commit workbook import" }));

    await waitFor(() => expect(commitModelV2Workbook).toHaveBeenCalledWith({
      issuerId: "issuer-1",
      file,
      preview,
    }));
    expect((await screen.findByText(/workbook import committed/)).textContent).toContain("workbook import committed");
  });

  it("imports a canonical workbook as revision 1 when no saved or suggested model exists", async () => {
    const preview = workbookPreview({
      identity: null,
      expected_revision: 0,
    });
    vi.mocked(previewModelV2Workbook).mockResolvedValue(preview);
    vi.mocked(commitModelV2Workbook).mockResolvedValue({
      existing: false,
      import_id: "import-new",
      document_id: "document-new",
      source_manifest_id: "manifest-new",
      workbook_sha256: preview.workbook_sha256,
      import_fingerprint: "f".repeat(64),
      committed_revision: 1,
      calculation_hash: "c".repeat(64),
      record: makeRecord(false, 1),
    });
    renderWorkbench({
      authority: "model-engine-v2",
      record: null,
      suggested_payload: null,
      suggested_calculation: null,
      suggested_source_run_id: null,
      current_calculation: null,
      requires_recalculation: false,
      availability: "unavailable",
      detail: "No live CP-1 source is available.",
    });
    expect(await screen.findByText("Canonical model unavailable")).toBeTruthy();
    const file = new File(["xlsx"], "new-model.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    fireEvent.change(screen.getByLabelText("Model workbook"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Preview workbook" }));
    await waitFor(() => expect(previewModelV2Workbook).toHaveBeenCalledWith({
      issuerId: "issuer-1",
      file,
      expectedRevision: 0,
    }));
    fireEvent.click(screen.getByRole("checkbox", { name: /I reviewed this preview/ }));
    fireEvent.click(screen.getByRole("button", { name: "Commit workbook import" }));

    await waitFor(() => expect(commitModelV2Workbook).toHaveBeenCalledWith({
      issuerId: "issuer-1",
      file,
      preview,
    }));
    expect(await screen.findByText("input:FY2026:revenue")).toBeTruthy();
  });

  it("binds close-format JSON and reviewed duplicate columns to the exact preview and commit", async () => {
    const ambiguous = workbookPreview({
      mode: "mapped_legacy",
      mapping: closeFormatMapping,
      identity: null,
      draft_payload: null,
      calculation: null,
      ambiguities: [{
        table: "assumptions",
        field: "revenue",
        selector: "column",
        candidates: ["Revenue (2)", "Revenue (5)"],
        message: "Mapped header appears more than once; select a unique source column.",
      }],
      issues: [{
        severity: "blocking",
        code: "ambiguous_mapping",
        message: "Mapped header appears more than once.",
        sheet: "Model",
        cell: null,
        field: "revenue",
      }],
      blocking_count: 1,
      warning_count: 1,
      preview_token: null,
    });
    const resolvedMapping: ModelV2LegacyWorkbookMapping = {
      ...closeFormatMapping,
      assumptions: {
        layout: "records",
        sheet: "Model",
        header_row: 1,
        columns: {
          period_key: "Period Key",
          label: "Label",
          kind: "Kind",
          revenue: "Revenue",
        },
        column_indices: { revenue: 5 },
      },
    };
    const resolved = workbookPreview({
      mode: "mapped_legacy",
      mapping: resolvedMapping,
      identity: null,
      warning_count: 1,
    });
    vi.mocked(previewModelV2Workbook)
      .mockResolvedValueOnce(ambiguous)
      .mockResolvedValueOnce(resolved);
    vi.mocked(commitModelV2Workbook).mockResolvedValue({
      existing: false,
      import_id: "import-mapped",
      document_id: "document-mapped",
      source_manifest_id: "manifest-mapped",
      workbook_sha256: resolved.workbook_sha256,
      import_fingerprint: "e".repeat(64),
      committed_revision: 3,
      calculation_hash: resolved.calculation!.calculation_hash,
      record: makeRecord(false, 3),
    });
    renderWorkbench();
    const file = new File(["xlsx"], "close-format.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    fireEvent.change(await screen.findByLabelText("Model workbook"), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText(/Close-format mapping JSON/), {
      target: { value: JSON.stringify(closeFormatMapping) },
    });

    fireEvent.click(screen.getByRole("button", { name: "Preview workbook" }));
    await screen.findByText(/Duplicate rows or columns/);
    fireEvent.change(screen.getByLabelText("Source column for assumptions revenue"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview workbook" }));
    await waitFor(() => expect(previewModelV2Workbook).toHaveBeenNthCalledWith(2, {
      issuerId: "issuer-1",
      file,
      expectedRevision: 2,
      mapping: resolvedMapping,
    }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /I reviewed this preview/ }));
    fireEvent.click(screen.getByRole("button", { name: "Commit workbook import" }));
    await waitFor(() => expect(commitModelV2Workbook).toHaveBeenCalledWith({
      issuerId: "issuer-1",
      file,
      preview: resolved,
      mapping: resolvedMapping,
    }));
  });

  it("binds reviewed account rows, the account column, and period columns in a matrix workbook", async () => {
    const ambiguous = workbookPreview({
      mode: "mapped_legacy",
      mapping: matrixMapping,
      draft_payload: null,
      calculation: null,
      ambiguities: [{
        table: "assumptions", field: "revenue", selector: "row",
        candidates: ["Revenue", "Revenue (4)", "Invalid candidate", "Invalid (0)"], message: "Choose revenue row.",
      }, {
        table: "assumptions", field: "account_column", selector: "column",
        candidates: ["Account (1)", "Account (3)"], message: "Choose account column.",
      }, {
        table: "assumptions", field: "FY2026", selector: "column",
        candidates: ["FY26 (2)", "FY26 (5)"], message: "Choose period column.",
      }],
      blocking_count: 3,
      preview_token: null,
    });
    vi.mocked(previewModelV2Workbook).mockResolvedValue(ambiguous);
    renderWorkbench();
    const file = new File(["xlsx"], "matrix.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    fireEvent.change(await screen.findByLabelText("Model workbook"), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText(/Close-format mapping JSON/), {
      target: { value: JSON.stringify(matrixMapping) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview workbook" }));

    await screen.findByLabelText("Source row for assumptions revenue");
    expect(screen.queryByRole("option", { name: "Invalid candidate" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Invalid (0)" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Source row for assumptions revenue"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Source column for assumptions account_column"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Source column for assumptions FY2026"), { target: { value: "5" } });

    const reviewed = JSON.parse((screen.getByLabelText(/Close-format mapping JSON/) as HTMLTextAreaElement).value) as ModelV2LegacyWorkbookMapping;
    const assumptions = reviewed.assumptions;
    if (assumptions.layout !== "account_period_matrix") throw new Error("matrix mapping expected");
    expect(assumptions.account_row_indices).toEqual({ revenue: 4 });
    expect(assumptions.account_column_index).toBe(1);
    expect(assumptions.period_column_indices).toEqual({ FY2026: 5 });
    expect(screen.getByText(/Duplicate header selection recorded locally/)).toBeTruthy();
  });

  it("surfaces invalid mapping, preview, and commit failures without mutating the draft", async () => {
    vi.mocked(previewModelV2Workbook)
      .mockRejectedValueOnce(new Error("preview offline"))
      .mockResolvedValueOnce(workbookPreview());
    vi.mocked(commitModelV2Workbook).mockRejectedValueOnce(new Error("commit offline"));
    renderWorkbench();
    const file = new File(["xlsx"], "errors.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    fireEvent.change(await screen.findByLabelText("Model workbook"), { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText(/Close-format mapping JSON/), {
      target: { value: JSON.stringify({ mode: "wrong" }) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview workbook" }));
    expect(await screen.findByText(/must be a JSON object with mode "mapped_legacy"/)).toBeTruthy();
    expect(previewModelV2Workbook).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Close-format mapping JSON/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview workbook" }));
    expect(await screen.findByText("preview offline")).toBeTruthy();
    expect(screen.queryByText(/strict_v1/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Preview workbook" }));
    await screen.findByText(/strict_v1/);
    fireEvent.click(screen.getByRole("checkbox", { name: /I reviewed this preview/ }));
    fireEvent.click(screen.getByRole("button", { name: "Commit workbook import" }));
    expect(await screen.findByText("commit offline")).toBeTruthy();
    expect(screen.getByText("input:FY2026:revenue")).toBeTruthy();
  });

  it("never preselects USD or millions for a close-format workbook", async () => {
    renderWorkbench();
    const file = new File(["xlsx"], "close-format.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    fireEvent.change(await screen.findByLabelText("Model workbook"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Use row-record template" }));
    const mappingInput = screen.getByLabelText(/Close-format mapping JSON/) as HTMLTextAreaElement;
    const template = JSON.parse(mappingInput.value) as ModelV2LegacyWorkbookMapping;
    expect(template.reporting_currency).toBe("");
    expect(template.reporting_unit).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Preview workbook" }));

    expect(await screen.findByText(/requires an explicit reporting_currency and reporting_unit/i)).toBeTruthy();
    expect(previewModelV2Workbook).not.toHaveBeenCalled();
  });

  it("loads the account-matrix mapping template without inferring reporting units", async () => {
    renderWorkbench();
    await screen.findByText("input:FY2026:revenue");

    fireEvent.click(screen.getByRole("button", { name: "Use account matrix template" }));

    const mappingInput = screen.getByLabelText(/Close-format mapping JSON/) as HTMLTextAreaElement;
    const template = JSON.parse(mappingInput.value) as ModelV2LegacyWorkbookMapping;
    expect(template.reporting_currency).toBe("");
    expect(template.reporting_unit).toBe("");
    expect(template.assumptions?.layout).toBe("account_period_matrix");
    expect(screen.getByText(/Account-row matrix template loaded/)).toBeTruthy();
  });

  it("exports the persisted workbook through a temporary download and reports failures", async () => {
    const blob = new Blob(["xlsx"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    vi.mocked(exportModelV2Workbook)
      .mockResolvedValueOnce({ blob, filename: "issuer-model.xlsx", revision: 2 })
      .mockRejectedValueOnce(new Error("export offline"));
    const createObjectURL = vi.fn(() => "blob:model-export");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    renderWorkbench();
    await screen.findByText("input:FY2026:revenue");

    fireEvent.click(screen.getByRole("button", { name: "Open Model v2 tools" }));
    fireEvent.click(screen.getByRole("button", { name: "Export workbook" }));
    expect(await screen.findByText("Workbook exported from revision 2.")).toBeTruthy();
    expect(exportModelV2Workbook).toHaveBeenCalledWith("issuer-1");
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:model-export");

    fireEvent.click(screen.getByRole("button", { name: "Export workbook" }));
    expect(await screen.findByText("export offline")).toBeTruthy();
  });

  it("validates finite values and future expiry before queuing a derived override", async () => {
    renderWorkbench();
    await screen.findByText("calc:FY2026:net_leverage");

    fireEvent.click(screen.getByRole("button", { name: "Edit calc:FY2026:net_leverage" }));
    fireEvent.change(screen.getByLabelText("Numeric value"), { target: { value: "not-a-number" } });
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "Committee case" } });
    fireEvent.click(screen.getByRole("button", { name: "Queue override" }));
    expect(screen.getByText("Enter a finite number or select Set unavailable (null).")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Numeric value"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Override expiry"), { target: { value: "2000-01-01T00:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Queue override" }));
    expect(screen.getByText("A derived-cell override requires a future expiry.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Commit 0 pending" })).toBeTruthy();
  });

  it("filters periods and empty node results and switches between scenario modes", async () => {
    const draft = makeRecord();
    const secondPeriod = {
      ...draft.calculation.periods[0],
      period_key: "FY2027",
      label: "FY27",
      nodes: draft.calculation.periods[0].nodes.map((node) => ({
        ...node,
        node_id: node.node_id.replace("FY2026", "FY2027"),
      })),
    };
    draft.calculation = {
      ...draft.calculation,
      periods: [...draft.calculation.periods, secondPeriod],
    };
    renderWorkbench(response(draft));
    await screen.findByText("input:FY2027:revenue");

    fireEvent.change(screen.getByLabelText("Filter calculation period"), {
      target: { value: "FY2027" },
    });
    expect(screen.queryByText("input:FY2026:revenue")).toBeNull();
    expect(screen.getByText("input:FY2027:revenue")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Filter calculation nodes"), {
      target: { value: "does-not-exist" },
    });
    expect(screen.getByText("No calculation nodes match the current filters.")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Cross-module propagation" }));
    expect(screen.getByText(/Propagates EBITDA and rate shocks/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Model scenario" }));
    expect(screen.getByLabelText("Scenario node")).toBeTruthy();
  });

  it.each([
    ["partial", ["Missing debt schedule"], [], "Missing debt schedule", "None."],
    ["insufficient_inputs", [], ["Coverage invariant unavailable"], "Coverage invariant unavailable", "None."],
  ] as const)("renders %s calculation gaps and warnings honestly", async (status, gaps, warnings, expected, none) => {
    const draft = makeRecord();
    draft.calculation = { ...draft.calculation, status, gaps: [...gaps], warnings: [...warnings] };
    renderWorkbench(response(draft));
    expect(await screen.findByText(expected)).toBeTruthy();
    expect(screen.getByText(new RegExp(`${status.replace("_", " ")} · rev 2`, "i"))).toBeTruthy();
    expect(screen.getByText(none)).toBeTruthy();
    expect(screen.getByText(/Named gaps/)).toBeTruthy();
    expect(screen.getByText(/Invariant warnings/)).toBeTruthy();
  });

  it("discards all local model state only after explicit navigation confirmation", async () => {
    renderWorkbench();
    await screen.findByText("input:FY2026:revenue");
    editNode("input:FY2026:revenue", "125");
    fireEvent.change(screen.getByLabelText("Scenario node"), { target: { value: "input:FY2026:adjusted_ebitda" } });
    fireEvent.change(screen.getByLabelText("Scenario value"), { target: { value: "15" } });

    const link = document.createElement("a");
    link.href = "/reports";
    link.textContent = "Leave model";
    document.body.appendChild(link);
    fireEvent.click(link);
    fireEvent.click(await screen.findByRole("button", { name: "Discard & leave" }));

    expect(navigation.push).toHaveBeenCalledWith("/reports");
    expect(screen.getByRole("button", { name: "Commit 0 pending" })).toBeTruthy();
    expect((screen.getByLabelText("Scenario node") as HTMLSelectElement).value).toBe("");
    expect((screen.getByLabelText("Scenario value") as HTMLInputElement).value).toBe("");
    link.remove();
  });

  it.each(["2000-01-01T00:00:00Z", "not-a-timestamp"])(
    "treats an expired or invalid persisted override (%s) as inactive in the editor",
    async (expiresAt) => {
      const draft = makeRecord(false);
      draft.payload = {
        ...draft.payload,
        overrides: [{
          node_id: "input:FY2026:revenue",
          value_type: "number",
          value: 110,
          reason: "Expired correction",
          scope: "draft",
          source: "analyst-ui",
          expires_at: expiresAt,
        }],
      };
      renderWorkbench(response(draft));

      const row = await screen.findByRole("row", { name: /input:FY2026:revenue/ });
      expect(row.textContent).toContain("CANONICAL");
      expect((screen.getByRole("button", { name: "Restore input:FY2026:revenue" }) as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "Edit input:FY2026:revenue" }));
      expect((screen.getByLabelText("Numeric value") as HTMLInputElement).value).toBe("100");
      expect((screen.getByLabelText(/Reason/) as HTMLInputElement).value).toBe("");
    },
  );

  it("refreshes the server calculation when an active override expires while open", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T00:00:00Z"));
    const active = makeRecord(true);
    active.payload.overrides[0].expires_at = "2026-07-14T00:00:01Z";
    const current = calculation(false);
    vi.mocked(getModelV2).mockResolvedValue({
      ...response(active),
      current_calculation: current,
      requires_recalculation: true,
      detail: "An override expired; recalculate and save before checkpoint or export.",
    });
    renderWorkbench(response(active));
    expect(screen.getByRole("row", { name: /input:FY2026:revenue/ }).textContent).toContain("OVERRIDDEN");

    editNode("input:FY2026:adjusted_ebitda", "15");
    fireEvent.click(screen.getByRole("button", { name: "Preview pending" }));
    await act(async () => { await Promise.resolve(); });
    expect((screen.getByRole("button", { name: "Commit 1 pending" }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.change(screen.getByLabelText("Scenario node"), {
      target: { value: "calc:FY2026:net_leverage" },
    });
    fireEvent.change(screen.getByLabelText("Scenario value"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview sensitivity" }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(/SCENARIO calc:FY2026:net_leverage = 5/)).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_050);
    });

    expect(getModelV2).toHaveBeenCalledWith("issuer-1");
    const row = screen.getByRole("row", { name: /input:FY2026:revenue/ });
    expect(row.textContent).toContain("100");
    expect(row.textContent).toContain("CANONICAL");
    expect(screen.queryByText(/SCENARIO calc:FY2026:net_leverage/)).toBeNull();
    expect(screen.getByText(/1 local · not saved/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Preview pending" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Commit 1 pending" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Filter scenario nodes") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Scenario node") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText("Scenario value") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Preview sensitivity" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Create checkpoint" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("invalidates a reviewed preview at local expiry even when refresh fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T00:00:00Z"));
    const active = makeRecord(true);
    active.payload.overrides[0].expires_at = "2026-07-14T00:00:01Z";
    vi.mocked(getModelV2).mockRejectedValue(new Error("offline"));
    renderWorkbench(response(active));

    editNode("input:FY2026:adjusted_ebitda", "15");
    fireEvent.click(screen.getByRole("button", { name: "Preview pending" }));
    await act(async () => { await Promise.resolve(); });
    expect((screen.getByRole("button", { name: "Commit 1 pending" }) as HTMLButtonElement).disabled).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_050);
    });

    expect(getModelV2).toHaveBeenCalledWith("issuer-1");
    expect(screen.getByText(/current server calculation could not be refreshed/i)).toBeTruthy();
    expect(screen.getByText(/1 local · not saved/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Preview pending" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Commit 1 pending" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Preview sensitivity" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Create checkpoint" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps a suggested server calculation read-only until it is explicitly saved with the exact run ID", async () => {
    renderWorkbench(response(null));
    const edit = await screen.findByRole("button", { name: "Edit input:FY2026:revenue" });
    expect((edit as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Save suggested draft" }));
    await waitFor(() => expect(saveModelV2).toHaveBeenCalledWith("issuer-1", expect.objectContaining({
      expected_revision: 0,
      source_run_id: "run-exact",
      context_id: "context-1",
    })));
    await waitFor(() => expect((screen.getByRole("button", { name: "Edit input:FY2026:revenue" }) as HTMLButtonElement).disabled).toBe(false));
  });

  it.each([
    [false, "off", 0],
    [true, "on", 1],
  ])("honors persisted unsaved-leave preference %s", async (enabled, label, expectedListeners) => {
    vi.mocked(getAnalystSettings).mockResolvedValue({
      model_lanes: {},
      email_intelligence: { approved_senders: [] },
      workspace: { model_builder: { warn_on_unsaved_leave: enabled } },
      revision: 1,
    });
    const add = vi.spyOn(window, "addEventListener");
    renderWorkbench();
    await screen.findByText(new RegExp(`leave warning ${label}`, "i"));

    editNode("input:FY2026:revenue", "125");
    await waitFor(() => expect(screen.getByText(/1 local · not saved/)).toBeTruthy());
    expect(add.mock.calls.filter(([event]) => event === "beforeunload")).toHaveLength(expectedListeners);
  });

  it("guards a typed editor change before it is queued", async () => {
    vi.mocked(getAnalystSettings).mockResolvedValue({
      model_lanes: {},
      email_intelligence: { approved_senders: [] },
      workspace: { model_builder: { warn_on_unsaved_leave: true } },
      revision: 1,
    });
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    renderWorkbench();

    fireEvent.click(await screen.findByRole("button", {
      name: "Edit input:FY2026:revenue",
    }));
    fireEvent.change(screen.getByLabelText("Numeric value"), {
      target: { value: "125" },
    });

    await screen.findByText(/editor change · not queued/i);
    expect(add.mock.calls.filter(([event]) => event === "beforeunload")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(
      remove.mock.calls.filter(([event]) => event === "beforeunload"),
    ).toHaveLength(1));
  });
});
