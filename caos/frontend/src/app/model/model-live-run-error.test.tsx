// @vitest-environment jsdom
// M-5: useModelEngine now exposes `phase` ("error" on a genuine backend fetch
// failure) — Model Builder must surface that distinctly from "no run yet"
// instead of silently showing the same empty grid either way.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ModelPage from "./page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/model",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams("issuer=issuer-live-error"), // non-reference issuer
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/engine/useModelEngine", () => ({
  useModelEngine: () => ({
    anchor: null, downside: null, runId: null, committeeStatus: null, live: false,
    loading: false, phase: "error",
  }),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getSavedModel: vi.fn().mockResolvedValue(null),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Model Builder · live-run error phase (M-5)", () => {
  it("surfaces a role=alert LIVE RUN UNAVAILABLE chip when eng.phase is 'error'", async () => {
    render(<ModelPage />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("LIVE RUN UNAVAILABLE");
  });
});
