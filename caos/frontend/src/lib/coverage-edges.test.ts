import { afterEach, describe, expect, it, vi } from "vitest";

import type { PortfolioRowDTO, FreshnessEvaluation } from "@/lib/api";
import { liveGaps } from "@/lib/command/gaps";
import { liveMixedOrigin } from "@/lib/command/mixedOrigin";
import { cp2bToDownside } from "@/lib/engine/downsidePathway";
import { cp1ToAnchor } from "@/lib/engine/modelAnchor";
import type { ModuleDetailDTO } from "@/lib/engine/types";
import {
  freshnessDetail,
  worstFreshness,
} from "@/lib/freshness";
import { writeWarnOnUnsavedLeave } from "@/lib/model-builder-preferences";
import { DEFAULT_MODE, loadMode, saveMode } from "@/lib/model-mode";
import {
  MODEL_ENGINE_V2_SCHEMA_VERSION,
  MODEL_ENGINE_V2_VERSION,
} from "@/lib/engine/modelV2";
import { staticRows } from "@/lib/palette";
import type { PlanStep } from "@/lib/pipeline/data";
import { initSim, stepSim } from "@/lib/pipeline/sim-engine";
import { fromModelEngine } from "@/lib/provenance";
import type { Capability } from "@/lib/query/graph";
import { rankQueryCapabilities } from "@/lib/query/routing";
import {
  DEFAULT_PREFS,
  hasStoredPrefs,
  loadPrefs,
  savePrefs,
} from "@/lib/research-prefs";

const moduleDetail = (
  moduleId: string,
  runtimeOutput: Record<string, unknown>,
  overrides: Partial<ModuleDetailDTO> = {},
): ModuleDetailDTO => ({
  module_id: moduleId,
  module_name: moduleId,
  owned_object: null,
  schema_family: "test",
  runtime_output: runtimeOutput,
  confidence: "High",
  qa_status: "Pass",
  committee_status: "Cleared",
  validation_status: "Pass",
  limitation_flags: [],
  downstream_consumers: [],
  claims: [],
  ...overrides,
});

const portfolioRow = (overrides: Partial<PortfolioRowDTO> = {}): PortfolioRowDTO => ({
  issuer_id: "issuer-1",
  name: "Issuer One",
  ticker: "ONE",
  sector: "Industrials",
  run_id: "run-1",
  qa_status: "Pass",
  committee_status: "Cleared",
  as_of: "2026-07-01T00:00:00Z",
  metrics: {},
  rv_recommendation: null,
  rv_percentile: null,
  downside_fragility: null,
  gaps: [],
  ...overrides,
});

const freshness = (
  overrides: Partial<FreshnessEvaluation> = {},
): FreshnessEvaluation => ({
  state: "current",
  source_kind: "run",
  observed_at: null,
  effective_period_end: null,
  expected_next_at: null,
  due_at: null,
  age_days: null,
  reason: "within_policy",
  policy_version: "v1",
  ...overrides,
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as { window?: unknown }).window;
  localStorage.clear();
});

describe("coverage edge contracts", () => {
  it("preserves nested preferences when present and initializes invalid nests", () => {
    expect(writeWarnOnUnsavedLeave({ model_builder: null }, false)).toEqual({
      model_builder: { warn_on_unsaved_leave: false },
    });
  });

  it("ranks matching global actions and capabilities without aliases", () => {
    expect(staticRows("role view").some((row) => row.kind === "action")).toBe(true);
    const capabilities: Capability[] = [
      { id: "custom", label: "Custom Signal", mode: "custom", enabled: true, reason: null },
    ];
    expect(rankQueryCapabilities("custom", capabilities)).toEqual([
      { c: capabilities[0], s: 1 },
    ]);
  });

  it("describes a live model anchor even when no run id is supplied", () => {
    expect(fromModelEngine({ live: true, anchor: { revenue: 1 } })).toMatchObject({
      origin: "LIVE",
      detail: "Anchored to live CP-1.",
    });
  });

  it("degrades invalid source-gap dates and absent gap arrays", () => {
    expect(liveGaps([
      portfolioRow({ as_of: "not-a-date", ticker: null, gaps: [{ doc: "SFA", sev: "other" }] }),
      portfolioRow({ gaps: undefined as unknown as PortfolioRowDTO["gaps"] }),
    ])).toEqual([
      expect.objectContaining({ issuer: "Issuer One", requested: "—", sev: "low" }),
    ]);
  });

  it("emits the governed mixed-origin row for the reference issuer", () => {
    expect(liveMixedOrigin([
      portfolioRow({
        issuer_id: "a71f0000-0000-0000-0000-000000000001",
        ticker: null,
      }),
    ])).toEqual([
      expect.objectContaining({ name: "Issuer One", issuer_id: "a71f0000-0000-0000-0000-000000000001" }),
    ]);
  });

  it("handles malformed downside scenarios without treating them as live", () => {
    expect(cp2bToDownside(moduleDetail("CP-2B", {
      current_net_leverage: 5,
      breach_threshold_x: 7,
      fragility: "LOW",
      scenarios: { unexpected: true },
    }))).toBeNull();
  });

  it("selects a first freshness item and formats every timestamp fallback", () => {
    const current = freshness();
    expect(worstFreshness([current])).toBe(current);
    const stale = freshness({ state: "stale" });
    expect(worstFreshness([stale, current])).toBe(stale);
    expect(freshnessDetail(freshness({ effective_period_end: "2026-06-30" })))
      .toContain("effective 2026-06-30");
    expect(freshnessDetail(freshness({ observed_at: "2026-07-01" })))
      .toContain("observed 2026-07-01");
    expect(freshnessDetail(freshness())).toContain("as-of unavailable");
  });

  it("rejects CP-1 anchors with absent series and parses two- and four-digit periods", () => {
    expect(cp1ToAnchor(moduleDetail("CP-1", {
      normalized_financials: {
        net_debt_ltm: 100,
        net_leverage_adj_ltm: 5,
      },
    }))).toBeNull();

    expect(cp1ToAnchor(moduleDetail("CP-1", {
      normalized_financials: {
        revenue: {},
        adj_ebitda: {},
        net_debt_ltm: 100,
        net_leverage_adj_ltm: 5,
      },
    }))).toBeNull();

    expect(cp1ToAnchor(moduleDetail("CP-1", {
      normalized_financials: {
        revenue: { FY25: 90, FY2024: 80 },
        adj_ebitda: { FY25: 18, FY2024: 16 },
        net_debt_ltm: 100,
        net_leverage_adj_ltm: 5,
      },
    }))).toMatchObject({ ltmRevenue: 90, ltmAdjEbitda: 18 });
  });

  it("advances partial, idle-outcome, and unknown-module simulation states", () => {
    const partial: PlanStep[] = [{ id: "X", deps: [], dur: 4, outcome: "pass", event: "" }];
    const partialSim = initSim(partial);
    partialSim.mods.X = { state: "running", prog: 0.1 };
    expect(stepSim(partialSim, partial, null).mods.X).toEqual({ state: "running", prog: 0.35 });

    const idle: PlanStep[] = [{ id: "Y", deps: [], dur: 1, outcome: "idle", event: "" }];
    const idleSim = initSim(idle);
    idleSim.mods.Y = { state: "running", prog: 0 };
    expect(stepSim(idleSim, idle, null).mods.Y).toEqual({ state: "idle", prog: 1 });

    const unknown: PlanStep[] = [{ id: "UNKNOWN", deps: [], dur: 1, outcome: "pass", event: "" }];
    expect(stepSim(initSim(unknown), unknown, null).events[0]?.text).toBe("UNKNOWN started — ");

    const known: PlanStep[] = [{ id: "CP-0", deps: [], dur: 1, outcome: "pass", event: "" }];
    expect(stepSim(initSim(known), known, null).events[0]?.text).toContain("Source Readiness");
  });

  it("pins runtime schema constants and verifies type-only modules erase cleanly", async () => {
    expect(MODEL_ENGINE_V2_VERSION).toBe("2.0.0");
    expect(MODEL_ENGINE_V2_SCHEMA_VERSION).toBe(2);
    expect(Object.keys(await import("@/lib/query/types"))).toEqual([]);
    expect(Object.keys(await import("@/types/issuers"))).toEqual([]);
  });

  it("degrades storage helpers in SSR and blocked-storage environments", () => {
    expect(loadMode()).toBe(DEFAULT_MODE);
    expect(hasStoredPrefs()).toBe(false);
    expect(loadPrefs()).toBe(DEFAULT_PREFS);

    saveMode("MAX");
    expect(localStorage.getItem("caos.model.mode")).toBe("MAX");

    Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(hasStoredPrefs()).toBe(false);
    expect(loadPrefs()).toBe(DEFAULT_PREFS);

    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => saveMode("LITE")).not.toThrow();
    expect(() => savePrefs(DEFAULT_PREFS)).not.toThrow();
  });
});
