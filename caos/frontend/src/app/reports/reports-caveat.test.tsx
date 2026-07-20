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
let mockLive: boolean | null = null;
let mockPhase: string | null = null; // overrides the derived phase when set
let mockLoading = false;
let mockIssuer: string | null = null; // ?issuer= param; null -> explicit ATLF Reference mode
// Module-level, not inline in the mock factory: the real hook's anchor is
// reference-stable across renders, and page.tsx's useMemo (line 98) depends on
// that — an inline literal here recreates on every render and infinite-loops it.
const LIVE_ANCHOR = { netLeverage: 4.2 };
const EMPTY_LIVE_OUTS = {};
const EMPTY_LIVE_STATUS = {};

vi.mock("next/navigation", () => ({
  usePathname: () => "/reports",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(mockIssuer ? { issuer: mockIssuer } : { mode: "reference" }),
}));
vi.mock("@/lib/data-mode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data-mode")>()),
  useDataMode: () => mockIssuer ? "live" : "reference",
}));
vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/engine/useLiveRun", () => ({
  useLiveRun: () => ({ liveOuts: EMPTY_LIVE_OUTS, liveStatus: EMPTY_LIVE_STATUS, liveEvidence: {}, runId: null, committeeStatus: null, council: [], loading: false, phase: "none" }),
}));
vi.mock("@/lib/engine/useModelEngine", () => ({
  useModelEngine: () => {
    const live = mockLive ?? !!mockRunId;
    return {
      anchor: live ? LIVE_ANCHOR : null, downside: null, downsideState: "unavailable", runId: mockRunId,
      committeeStatus: mockRunId ? "Draft Only" : null, live, loading: mockLoading,
      phase: mockPhase ?? (mockRunId ? "complete" : "none"),
    };
  },
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
  mockLive = null;
    mockPhase = null;
    mockLoading = false;
  mockIssuer = null;
});

describe("Report Studio · reference caveat (FE-5)", () => {
  it("shows the blanket 'not a live issuer run' message when no run backs the reference issuer", async () => {
    mockRunId = null;
    render(<ReportsPage />);
    // Origin now carried by the shared grammar chip + precise prose beside it.
    expect(await screen.findByText("REFERENCE")).toBeTruthy();
    expect(await screen.findByText(/Atlas Forge fixture, not a live issuer run/)).toBeTruthy();
  });

  it("shows the hybrid message when a live run backs the reference issuer", async () => {
    mockRunId = "run-123";
    render(<ReportsPage />);
    expect(await screen.findByText("REFERENCE")).toBeTruthy();
    expect(await screen.findByText(/bespoke tabs stay fixture, other figures reflect the live run/)).toBeTruthy();
  });

  it("keeps fixture authority when a run exists but CP-1 cannot produce an accepted anchor", async () => {
    mockRunId = "run-without-anchor";
    mockLive = false;
    render(<ReportsPage />);
    expect(await screen.findByText(/Atlas Forge fixture, not a live issuer run/)).toBeTruthy();
    expect(screen.queryByText(/other figures reflect the live run/)).toBeNull();
  });

  it("a backend outage on a real issuer reads 'could not load', not the confident no-run claim", async () => {
    // Committee surface: asserting "no run for this issuer" during an outage is
    // a false claim about coverage — deepdive/model already distinguish these.
    mockIssuer = "ISSX";
    mockRunId = null;
    mockPhase = "error";
    render(<ReportsPage />);
    expect(await screen.findByText(/could not load live run/)).toBeTruthy();
    expect(screen.queryByText(/no run for this issuer/)).toBeNull();
  });

  it("shows a checking state while a real issuer run is loading", async () => {
    mockIssuer = "ISSX";
    mockRunId = null;
    mockPhase = "loading";
    mockLoading = true;
    render(<ReportsPage />);
    expect(await screen.findByText(/checking for live run/)).toBeTruthy();
  });

  it("a real issuer with genuinely no run still gets the honest no-run message (control)", async () => {
    mockIssuer = "ISSX";
    mockRunId = null;
    render(<ReportsPage />);
    expect(await screen.findByText(/no run for this issuer/)).toBeTruthy();
  });
});
