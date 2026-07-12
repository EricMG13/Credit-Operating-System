// @vitest-environment jsdom
// M-6 regression: a fetch failure in usePortfolio must be distinguishable from
// genuine "no coverage yet" — both fall back to the same empty rows/covered=0
// shape (fail-open to the static demo board), but a caller that cares must be
// able to read `error: true` off a failed load instead of it being silently
// swallowed into indistinguishable EMPTY.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { usePortfolio } from "./usePortfolio";
import { getPortfolio } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getPortfolio: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("usePortfolio · error phase (M-6)", () => {
  it("flags error:true (not clean-empty) when the fetch rejects", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(getPortfolio).mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => usePortfolio());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe(true);
    expect(result.current.rows).toEqual([]);
    expect(result.current.issuerCount).toBe(0);
    expect(result.current.coveredCount).toBe(0);
    expect(result.current.live).toBe(false);
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });

  it("leaves error:false on a genuinely empty (but reachable) backend", async () => {
    vi.mocked(getPortfolio).mockResolvedValue({ rows: [], issuer_count: 0, covered_count: 0 });

    const { result } = renderHook(() => usePortfolio());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe(false);
    expect(result.current.rows).toEqual([]);
  });
});
