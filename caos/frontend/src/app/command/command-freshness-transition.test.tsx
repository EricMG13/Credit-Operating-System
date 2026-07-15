// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import CommandPage from "./page";

const state = vi.hoisted(() => ({
  counts: { current: 2, due: 0, stale: 0, unknown: 0 },
}));

vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/shared/EnterprisePage", () => ({
  EnterprisePage: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/shared/PersonaWorkbench", () => ({
  PersonaWorkbench: ({ decision }: { decision: React.ReactNode }) => <>{decision}</>,
}));
vi.mock("@/components/shared/DecisionHeader", () => ({
  DecisionHeader: ({ state: decision }: { state: { evidenceHealth: { kind: string; value?: React.ReactNode; message?: string } } }) => (
    <div data-testid="evidence-health" data-kind={decision.evidenceHealth.kind}>
      {decision.evidenceHealth.value ?? decision.evidenceHealth.message}
    </div>
  ),
}));
vi.mock("@/components/shared/WorkbenchToolbar", () => ({ WorkbenchToolbar: () => null }));
vi.mock("@/components/shared/RoleViewProvider", () => ({
  useRoleView: () => ({ roleView: "analyst", setRoleView: vi.fn() }),
}));
vi.mock("@/lib/typed-url-state", () => ({
  useTypedUrlState: () => ({ values: { dataset: null, selected: null }, update: vi.fn() }),
}));
vi.mock("@/lib/analysis-workbench", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analysis-workbench")>()),
  useAnalysisContext: () => ({
    context: null, loading: false, error: null,
    patch: vi.fn(), replace: vi.fn(), refresh: vi.fn(),
  }),
}));
vi.mock("@/lib/pipeline/sim", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pipeline/sim")>()),
  useSharedDayRun: () => ({
    sim: { tick: 1, done: true }, playing: false, clock: "09:30",
    pause: vi.fn(), play: vi.fn(), restart: vi.fn(), step: vi.fn(), speed: 1,
  }),
}));
vi.mock("@/lib/engine/usePortfolio", () => ({
  usePortfolio: () => ({
    rows: [], live: true, loading: false, error: null,
    fetchedAt: new Date("2026-07-14T00:00:00Z"),
    coveredCount: 0, issuerCount: 0,
  }),
}));
vi.mock("@/lib/engine/useDigest", () => ({
  useDigest: () => ({
    live: true, loading: false,
    digest: {
      as_of: "2026-07-14T00:00:00Z",
      activity_24h: {}, warf: 3000, warf_band: "B", ccc_watch: [], stale: [],
      freshness: {
        policy_version: "caos-freshness-v1",
        counts: { ...state.counts }, rows: [],
      },
    },
  }),
}));

afterEach(() => {
  cleanup();
  state.counts = { current: 2, due: 0, stale: 0, unknown: 0 };
  vi.clearAllMocks();
});

describe("Command freshness roll-up", () => {
  it("renders CURRENT only when every centrally evaluated latest run is current", async () => {
    const view = render(<CommandPage />);
    const evidence = await screen.findByTestId("evidence-health");
    expect(evidence.getAttribute("data-kind")).toBe("ready");
    expect(evidence.textContent).toContain("2 current");

    state.counts = { current: 1, due: 0, stale: 0, unknown: 1 };
    view.rerender(<CommandPage />);
    await waitFor(() => {
      expect(screen.getByTestId("evidence-health").getAttribute("data-kind")).toBe("partial");
      expect(screen.getByTestId("evidence-health").textContent).toContain("1 unknown");
    });
  });
});
