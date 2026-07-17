// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getRun, listRuns } from "@/lib/api";
import { useLatestRunStatus } from "./useLatestRun";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getRun: vi.fn(),
  listRuns: vi.fn(),
}));

afterEach(() => vi.clearAllMocks());

describe("useLatestRunStatus edge paths", () => {
  it("rejects an exact run owned by another issuer", async () => {
    vi.mocked(getRun).mockResolvedValue({ issuer_id: "other", id: "run-1" } as never);
    const { result } = renderHook(() => useLatestRunStatus("issuer", "initial", "empty", async () => "built", "run-1"));
    await waitFor(() => expect(result.current.phase).toBe("error"));
    expect(result.current.value).toBe("empty");
  });

  it("selects the latest dated in-flight run while tolerating null dates", async () => {
    vi.mocked(listRuns).mockResolvedValue([
      { id: "undated", issuer_id: "issuer", status: "running", created_at: null },
      { id: "latest", issuer_id: "issuer", status: "failed", created_at: "2026-07-17" },
    ] as never);
    const { result } = renderHook(() => useLatestRunStatus("issuer", "initial", "empty", async () => "built"));
    await waitFor(() => expect(result.current.phase).toBe("in_flight"));
    expect(result.current.latest?.id).toBe("latest");
  });

  it("keeps the dated accumulator when a later candidate is undated", async () => {
    vi.mocked(listRuns).mockResolvedValue([
      { id: "dated", issuer_id: "issuer", status: "running", created_at: "2026-07-17" },
      { id: "undated", issuer_id: "issuer", status: "failed", created_at: null },
    ] as never);
    const { result } = renderHook(() => useLatestRunStatus("issuer", "initial", "empty", async () => "built"));
    await waitFor(() => expect(result.current.phase).toBe("in_flight"));
    expect(result.current.latest?.id).toBe("dated");
  });

  it("does not land a completed build after unmount", async () => {
    let resolve!: (value: string) => void;
    vi.mocked(listRuns).mockResolvedValue([
      { id: "complete", issuer_id: "issuer", status: "complete", created_at: null },
    ] as never);
    const build = vi.fn(() => new Promise<string>((done) => { resolve = done; }));
    const hook = renderHook(() => useLatestRunStatus("issuer", "initial", "empty", build));
    await waitFor(() => expect(build).toHaveBeenCalledOnce());
    hook.unmount();
    await act(async () => resolve("late"));
  });
});
