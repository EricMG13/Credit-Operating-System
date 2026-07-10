// @vitest-environment jsdom
// FE-5: the ATLF reference issuer's Report Studio caveat must say precisely
// what's fixture vs live — buildReports incorporates eng.anchor when a real
// run exists, so the blanket "not a live issuer run" claim was misleading for
// that case. Mocking pattern (module-level mutable control var) mirrors
// app/model/model-restore-race.test.tsx.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ReportsPage from "./page";

let mockRunId: string | null = null;

vi.mock("next/navigation", () => ({
  usePathname: () => "/reports",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(), // no ?issuer -> ATLF reference page
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/engine/useLiveRun", () => ({
  useLiveRun: () => ({ liveOuts: {}, liveEvidence: {}, runId: null, committeeStatus: null, council: [], loading: false, phase: "none" }),
}));
vi.mock("@/lib/engine/useModelEngine", () => ({
  useModelEngine: () => ({
    anchor: mockRunId ? { netLeverage: 4.2 } : null, downside: null, runId: mockRunId,
    committeeStatus: mockRunId ? "Draft Only" : null, live: !!mockRunId, loading: false,
    phase: mockRunId ? "complete" : "none",
  }),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getSavedModel: vi.fn().mockResolvedValue(null),
}));
// Report exhibits render G2Chart, which needs a real ResizeObserver (absent in
// jsdom) — irrelevant to this caveat-copy test, so stub it out.
vi.mock("@/components/charts/G2Chart", () => ({ G2Chart: () => null }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockRunId = null;
});

describe("Report Studio · reference caveat (FE-5)", () => {
  it("shows the blanket 'not a live issuer run' message when no run backs the reference issuer", async () => {
    mockRunId = null;
    render(<ReportsPage />);
    expect(await screen.findByText(/REFERENCE TEMPLATE — Atlas Forge fixture, not a live issuer run/)).toBeTruthy();
  });

  it("shows the hybrid message when a live run backs the reference issuer", async () => {
    mockRunId = "run-123";
    render(<ReportsPage />);
    expect(await screen.findByText(/REFERENCE TEMPLATE — bespoke tabs stay fixture, other figures reflect the live run/)).toBeTruthy();
  });
});
