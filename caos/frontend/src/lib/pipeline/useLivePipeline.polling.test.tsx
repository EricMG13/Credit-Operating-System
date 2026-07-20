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
    expect(result.current.value?.status).toBe("queued");

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current.phase).toBe("in_flight");
    expect(result.current.value?.status).toBe("running");
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current.phase).toBe("complete");
    expect(result.current.value?.runId).toBe("run-exact");
    expect(mocks.getRun).toHaveBeenCalledTimes(3);

    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(mocks.getRun).toHaveBeenCalledTimes(3);
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

  it("returns the latest-run status when no exact run is selected", () => {
    const { result } = renderHook(() => useLivePipelineStatus("issuer-exact", null));
    expect(result.current).toEqual({ value: null, phase: "loading", latest: null });
    expect(mocks.getRun).not.toHaveBeenCalled();
  });

  it("pauses an armed poll while hidden and reloads immediately when visible", async () => {
    mocks.getRun
      .mockResolvedValueOnce(exactRun("queued"))
      .mockResolvedValueOnce(exactRun("queued"))
      .mockResolvedValueOnce(exactRun("complete"));
    const { result } = renderHook(() => useLivePipelineStatus("issuer-exact", "run-exact"));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.phase).toBe("in_flight");

    document.dispatchEvent(new Event("visibilitychange"));
    await act(async () => { await Promise.resolve(); });
    expect(mocks.getRun).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(mocks.getRun).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.phase).toBe("complete");
    expect(mocks.getRun).toHaveBeenCalledTimes(3);
  });

  it("suppresses a visibility reload while the current read is still loading", async () => {
    let resolveRun!: (run: RunSummaryDTO) => void;
    mocks.getRun.mockImplementationOnce(() => new Promise<RunSummaryDTO>((resolve) => { resolveRun = resolve; }));
    const { result } = renderHook(() => useLivePipelineStatus("issuer-exact", "run-exact"));
    await act(async () => { await Promise.resolve(); });

    document.dispatchEvent(new Event("visibilitychange"));
    expect(mocks.getRun).toHaveBeenCalledTimes(1);
    await act(async () => { resolveRun(exactRun("complete")); await Promise.resolve(); });
    expect(result.current.phase).toBe("complete");
  });

  it("clears an armed poll timer when the exact-run observer unmounts", async () => {
    mocks.getRun.mockResolvedValue(exactRun("queued"));
    const { unmount } = renderHook(() => useLivePipelineStatus("issuer-exact", "run-exact"));
    await act(async () => { await Promise.resolve(); });
    expect(mocks.getRun).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(mocks.getRun).toHaveBeenCalledTimes(1);
  });
});
