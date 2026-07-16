// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunSummaryDTO } from "@/lib/engine/types";

const mocks = vi.hoisted(() => ({
  getRun: vi.fn(),
  getModule: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  getRun: mocks.getRun,
  getModule: mocks.getModule,
}));

vi.mock("@/lib/engine/useLatestRun", () => ({
  useLatestRunStatus: () => ({ value: null, phase: "loading", latest: null }),
}));

import { buildPipeline, useLivePipelineStatus } from "./useLivePipeline";

function exactRun(status: string): RunSummaryDTO {
  return {
    id: "run-exact",
    issuer_id: "issuer-exact",
    status,
    qa_status: status === "complete" ? "Passed" : "Not Reviewed",
    committee_status: status === "complete" ? "Committee Ready" : "Draft Only",
    as_of_date: null,
    model_id: null,
    prompt_version: null,
    error: null,
    modules: status === "complete" ? [{
      module_id: "CP-1",
      module_name: "Financial spreading",
      committee_status: "Committee Ready",
      qa_status: "Passed",
      confidence: "High",
      validation_status: "Passed",
    }] : [],
  };
}

describe("useLivePipelineStatus exact-run polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    mocks.getModule.mockResolvedValue({ runtime_output: { execution_sequence: [{ module_id: "CP-1", depends_on: [] }] } });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("keeps polling the exact queued run until its graph is terminal", async () => {
    mocks.getRun
      .mockResolvedValueOnce(exactRun("queued"))
      .mockResolvedValueOnce(exactRun("running"))
      .mockResolvedValueOnce(exactRun("complete"))
      .mockResolvedValueOnce(exactRun("complete"));

    const { result } = renderHook(() => useLivePipelineStatus("issuer-exact", "run-exact"));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.phase).toBe("in_flight");
    expect(result.current.latest?.id).toBe("run-exact");

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current.phase).toBe("in_flight");
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current.phase).toBe("complete");
    expect(result.current.value?.runId).toBe("run-exact");
    expect(mocks.getRun).toHaveBeenCalledTimes(4);

    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(mocks.getRun).toHaveBeenCalledTimes(4);
  });

  it("falls back only for a missing CP-X module and rejects other failures", async () => {
    mocks.getRun.mockResolvedValue(exactRun("complete"));
    mocks.getModule.mockRejectedValueOnce({ isAxiosError: true, response: { status: 404 } });
    await expect(buildPipeline({ id: "run-exact" })).resolves.toMatchObject({
      runId: "run-exact", gateStatus: "Committee Ready",
    });

    mocks.getModule.mockRejectedValueOnce({ isAxiosError: true, response: { status: 500 } });
    await expect(buildPipeline({ id: "run-exact" })).rejects.toMatchObject({
      response: { status: 500 },
    });
  });

  it("never accepts a CP-X transport failure as a complete LIVE surface", async () => {
    mocks.getRun.mockResolvedValue(exactRun("complete"));
    mocks.getModule.mockRejectedValue({ isAxiosError: true, response: { status: 503 } });

    const { result } = renderHook(() => useLivePipelineStatus("issuer-exact", "run-exact"));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(result.current.phase).toBe("error");
    expect(result.current.value).toBeNull();
  });
});
