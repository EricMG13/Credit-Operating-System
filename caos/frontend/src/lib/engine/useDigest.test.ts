// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  getDigest: vi.fn(),
  toErrorMessage: vi.fn((_reason, fallback) => fallback),
}));

import { getDigest } from "@/lib/api";
import { useDigest } from "./useDigest";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("useDigest", () => {
  it("keeps transport failure distinct from a successful empty digest", async () => {
    vi.mocked(getDigest).mockRejectedValueOnce(new Error("offline"));
    const failed = renderHook(() => useDigest());
    await waitFor(() => expect(failed.result.current.loading).toBe(false));
    expect(failed.result.current.error).toBe("Daily digest unavailable.");
    expect(failed.result.current.digest).toBeNull();

    vi.mocked(getDigest).mockResolvedValueOnce({ coverage: { issuers: 0 } } as never);
    const empty = renderHook(() => useDigest());
    await waitFor(() => expect(empty.result.current.loading).toBe(false));
    expect(empty.result.current.error).toBeNull();
    expect(empty.result.current.digest).not.toBeNull();
    expect(empty.result.current.live).toBe(false);
  });
});
