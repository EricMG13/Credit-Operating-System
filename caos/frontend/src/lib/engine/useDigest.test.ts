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

  it("marks populated coverage live and tolerates a missing coverage block", async () => {
    vi.mocked(getDigest).mockResolvedValueOnce({ coverage: { issuers: 2 } } as never);
    const populated = renderHook(() => useDigest());
    await waitFor(() => expect(populated.result.current.loading).toBe(false));
    expect(populated.result.current.live).toBe(true);

    vi.mocked(getDigest).mockResolvedValueOnce({} as never);
    const missing = renderHook(() => useDigest());
    await waitFor(() => expect(missing.result.current.loading).toBe(false));
    expect(missing.result.current.live).toBe(false);
  });

  it("ignores a successful response after unmount", async () => {
    let resolve!: (digest: unknown) => void;
    vi.mocked(getDigest).mockReturnValueOnce(new Promise((done) => { resolve = done; }) as never);
    const hook = renderHook(() => useDigest());
    hook.unmount();
    resolve({ coverage: { issuers: 1 } });
    await Promise.resolve();
  });
});
