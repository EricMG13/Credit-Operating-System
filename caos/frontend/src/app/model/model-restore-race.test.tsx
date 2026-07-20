// @vitest-environment jsdom
// SEC-H1 regression: a fast issuer A->B switch must not let A's late-arriving
// getSavedModel response land on B's state (durable, team-visible model
// corruption under B's saved-model key). The hydrate effect guards this with a
// `stale` flag set on cleanup — this test proves the guard actually works.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ModelPage from "./page";
import { getSavedModel } from "@/lib/api";
import type { SavedModelDTO } from "@/lib/api";

const REFERENCE_ISSUER = "a71f0000-0000-0000-0000-000000000001";
let currentIssuer = REFERENCE_ISSUER;
vi.mock("next/navigation", () => ({
  usePathname: () => "/model",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => ({ get: (k: string) => (k === "issuer" ? currentIssuer : null) }),
}));
vi.mock("@/lib/data-mode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data-mode")>()),
  useDataMode: () => currentIssuer === REFERENCE_ISSUER ? "reference" : "live",
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/engine/useModelEngine", () => ({
  useModelEngine: () => ({ anchor: null, downside: null, loading: false, run: null }),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getSettings: vi.fn().mockResolvedValue({ features: { model_engine_v2_enabled: false } }),
  getSavedModel: vi.fn(),
  saveModel: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

afterEach(() => {
  cleanup();
  currentIssuer = REFERENCE_ISSUER;
  vi.clearAllMocks();
});

describe("Model Builder · restore race (SEC-H1)", () => {
  it("a late reference restore cannot land after routing switches to a live issuer", async () => {
    const referenceRestore = deferred<SavedModelDTO | null>();
    vi.mocked(getSavedModel).mockImplementation(() => referenceRestore.promise);

    currentIssuer = REFERENCE_ISSUER;
    const { rerender } = render(<ModelPage />);
    await screen.findByText(/Atlas Forge Industrials — cash-flow model/i);

    // Live issuers cannot enter the fixture calculator when V2 is disabled.
    currentIssuer = "issuer-b";
    rerender(<ModelPage />);
    expect((await screen.findByRole("alert")).textContent).toContain("Model authority unavailable");

    referenceRestore.resolve({
      issuer_id: REFERENCE_ISSUER, analyst_id: "an", payload: { overrides: {}, collapsedRows: [] },
      updated_at: "1999-01-01T00:00:00Z",
    });
    await referenceRestore.promise;
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByRole("alert").textContent).toContain("Model authority unavailable");
    expect(screen.queryByText(/SAVED/)).toBeNull();
  });

  it("a RETRY left in-flight across an issuer switch never lands on the new issuer", async () => {
    // The retry path must carry the same stale guard as the initial hydrate: a
    // bespoke un-guarded refetch re-opened the H-1 race exactly when the backend
    // is degraded (the only time RETRY exists).
    const retryA = deferred<SavedModelDTO | null>();
    let aCalls = 0;
    vi.mocked(getSavedModel).mockImplementation((id: string) => {
      if (id === REFERENCE_ISSUER) {
        aCalls += 1;
        return aCalls === 1 ? Promise.reject(new Error("offline")) : retryA.promise;
      }
      return Promise.resolve(null);
    });

    currentIssuer = REFERENCE_ISSUER;
    const { rerender } = render(<ModelPage />);
    const retry = await screen.findByRole("button", { name: /retry/i });
    expect(retry.closest('[role="alert"]')?.textContent).toContain("RETRY");
    fireEvent.click(retry); // retry A — response deliberately left in-flight

    // Analyst switches issuers while A's retry is still pending.
    currentIssuer = "issuer-b";
    rerender(<ModelPage />);
    const unavailable = await screen.findByText(/Model authority unavailable/i);
    expect(unavailable.closest('[role="alert"]')?.textContent).toContain("Model authority unavailable");

    // A's stale retry resolves — must be a no-op on B's state.
    retryA.resolve({
      issuer_id: REFERENCE_ISSUER, analyst_id: "an", payload: { overrides: {}, collapsedRows: [] },
      updated_at: "1999-01-01T00:00:00Z",
    });
    await retryA.promise;
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText(/Model authority unavailable/i).closest('[role="alert"]')?.textContent).toContain("Model authority unavailable");
    expect(screen.queryByText(/SAVED/)).toBeNull();
  });
});
