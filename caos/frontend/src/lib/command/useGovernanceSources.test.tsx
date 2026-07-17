// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useGovernanceSources } from "./useGovernanceSources";

vi.mock("@/lib/engine/useDigest", () => ({
  useDigest: () => ({ digest: null, loading: false, error: null }),
}));
vi.mock("@/lib/engine/useQaFindings", () => ({
  useQaFindings: () => ({ findings: [], loading: false, error: null }),
}));
vi.mock("./qa", () => ({ liveQaItems: vi.fn(() => []), liveFailedGates: vi.fn(() => []) }));
vi.mock("./gaps", () => ({ liveGaps: vi.fn(() => []) }));
vi.mock("./mixedOrigin", () => ({ liveMixedOrigin: vi.fn(() => []) }));

afterEach(() => vi.clearAllMocks());

describe("useGovernanceSources", () => {
  it("keeps all queues unavailable while a non-live portfolio is unresolved", () => {
    const { result } = renderHook(() => useGovernanceSources({
      live: false, loading: true, error: null, rows: [],
    } as never));

    expect(result.current.liveQa).toBeUndefined();
    expect(result.current.liveFailed).toBeUndefined();
    expect(result.current.liveGapsItems).toBeUndefined();
    expect(result.current.liveMixed).toBeUndefined();
  });

  it("reports observed empty queues once a non-live portfolio read resolves cleanly", () => {
    const { result } = renderHook(() => useGovernanceSources({
      live: false, loading: false, error: null, rows: [],
    } as never));

    expect(result.current.liveQa).toEqual([]);
    expect(result.current.liveFailed).toEqual([]);
    expect(result.current.liveGapsItems).toEqual([]);
    expect(result.current.liveMixed).toEqual([]);
  });
});
