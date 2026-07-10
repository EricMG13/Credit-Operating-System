// @vitest-environment jsdom
// SEC-H1 regression: a fast issuer A->B switch must not let A's late-arriving
// getSavedModel response land on B's state (durable, team-visible model
// corruption under B's saved-model key). The hydrate effect guards this with a
// `stale` flag set on cleanup — this test proves the guard actually works.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import ModelPage from "./page";
import { getSavedModel } from "@/lib/api";
import type { SavedModelDTO } from "@/lib/api";

let currentIssuer = "issuer-a";
vi.mock("next/navigation", () => ({
  usePathname: () => "/model",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => ({ get: (k: string) => (k === "issuer" ? currentIssuer : null) }),
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/engine/useModelEngine", () => ({
  useModelEngine: () => ({ anchor: null, downside: null, loading: false, run: null }),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
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
  vi.clearAllMocks();
});

describe("Model Builder · restore race (SEC-H1)", () => {
  it("a stale issuer's late restore never overwrites the current issuer's saved state", async () => {
    const defA = deferred<SavedModelDTO | null>();
    const defB = deferred<SavedModelDTO | null>();
    const pending: Record<string, Promise<SavedModelDTO | null>> = {
      "issuer-a": defA.promise,
      "issuer-b": defB.promise,
    };
    vi.mocked(getSavedModel).mockImplementation((id: string) => pending[id]);

    currentIssuer = "issuer-a";
    const { rerender } = render(<ModelPage />);
    await screen.findByText(/issuer-a — cash-flow model/i);

    // Analyst switches issuers before A's fetch resolves.
    currentIssuer = "issuer-b";
    rerender(<ModelPage />);
    await screen.findByText(/issuer-b — cash-flow model/i);

    // B's own fetch resolves — this is the legitimate, current-issuer restore.
    defB.resolve({
      issuer_id: "issuer-b", analyst_id: "an", payload: { overrides: {}, collapsedRows: [] },
      updated_at: "2020-06-01T00:00:00Z",
    });
    await waitFor(() => {
      expect(screen.getByText(/SAVED/).textContent).toContain(new Date("2020-06-01T00:00:00Z").toLocaleString());
    });

    // A's stale fetch finally resolves — must be a no-op (the effect cleanup
    // set `stale=true` for A when the issuer switched to B).
    defA.resolve({
      issuer_id: "issuer-a", analyst_id: "an", payload: { overrides: {}, collapsedRows: [] },
      updated_at: "1999-01-01T00:00:00Z",
    });
    await defA.promise;
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText(/SAVED/).textContent).toContain(new Date("2020-06-01T00:00:00Z").toLocaleString());
    expect(screen.getByText(/SAVED/).textContent).not.toContain(new Date("1999-01-01T00:00:00Z").toLocaleString());
  });
});
