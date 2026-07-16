// @vitest-environment jsdom
// Rollout authority regression: a disabled V2 flag must never expose the
// synthetic legacy calculator for a live issuer, even when its legacy engine
// hook would otherwise report an error state.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ModelPage from "./page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/model",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams("issuer=issuer-live-error"),
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/engine/useModelEngine", () => ({
  useModelEngine: () => ({
    anchor: null, downside: null, downsideState: "unavailable", runId: null, committeeStatus: null, live: false,
    loading: false, phase: "error",
  }),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getSettings: vi.fn().mockResolvedValue({ features: { model_engine_v2_enabled: false } }),
  getSavedModel: vi.fn().mockResolvedValue(null),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Model Builder · flag-off live issuer", () => {
  it("fails closed without mounting the fixture calculator", async () => {
    render(<ModelPage />);
    expect((await screen.findByRole("alert")).textContent).toContain("Model authority unavailable");
    expect(screen.queryByText(/cash-flow model/i)).toBeNull();
  });
});
