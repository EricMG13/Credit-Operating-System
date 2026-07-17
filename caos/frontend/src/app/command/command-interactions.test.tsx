// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { MouseEventHandler, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPortfolios, type PortfolioRowDTO, type PortfolioSummary } from "@/lib/api";
import { analysisApi, type InsightArtifact, type InsightPage } from "@/lib/analysis-workbench";
import {
  portfolioLabApi,
  type CommandPortfolioPosition,
  type CommandPortfolioSnapshot,
} from "@/lib/portfolio-lab";
import CommandPage from "./page";

type GovernanceDigestFixture = {
  as_of: string;
  activity_24h: { completed_runs?: number; qa_events?: number };
  warf: number | null;
  warf_band: string;
  ccc_watch: string[];
  stale: unknown[];
  freshness: {
    policy_version: string;
    counts: { current: number; due: number; stale: number; unknown: number };
    rows: unknown[];
  };
};

type EnterprisePageMockProps = {
  identity?: ReactNode;
  primaryAction?: ReactNode;
  status?: ReactNode;
  contextualControls?: ReactNode;
  utilityControls?: ReactNode;
  narrowContract?: { essentialControls?: ReactNode };
  children?: ReactNode;
};

type DecisionEntry = {
  kind: string;
  value?: string | number | null;
  message?: string;
  lastKnown?: string;
};

type DecisionHeaderMockProps = {
  state: {
    whatChanged: DecisionEntry;
    whyItMatters: DecisionEntry;
    requiredAction: DecisionEntry;
    evidenceHealth: DecisionEntry;
  };
};

const controls = vi.hoisted(() => ({
  role: "analyst",
  initialUrl: {} as Record<string, string | null>,
  update: vi.fn(),
  patch: vi.fn().mockResolvedValue(undefined),
  rankedCount: 2,
  portfolio: {
    rows: [{
      issuer_id: "issuer-live", name: "Live Issuer", ticker: "LIVE", sector: "Tech",
      run_id: "run-live", qa_status: "Pass", committee_status: "Ready", as_of: "2026-07-14",
      metrics: { net_leverage: 4.2, interest_coverage: 3.1 }, gaps: [],
    }],
    live: true, loading: false, error: null as Error | null,
    fetchedAt: new Date("2026-07-14T00:00:00Z"), coveredCount: 1, issuerCount: 1,
  },
  governance: {
    digest: {
      as_of: "2026-07-14T00:00:00Z",
      activity_24h: { completed_runs: 2, qa_events: 1 },
      warf: 3000, warf_band: "B", ccc_watch: ["issuer-live"], stale: [],
      freshness: {
        policy_version: "caos-freshness-v1",
        counts: { current: 1, due: 0, stale: 0, unknown: 0 }, rows: [],
      },
    } as GovernanceDigestFixture,
    live: true, loading: false, error: false,
    liveQa: [{ id: "qa-1" }], liveFailed: [{ id: "failed-1" }], liveGapsItems: [{ id: "gap-1" }], liveMixed: [],
    qaFindingsLoading: false, qaFindingsError: false,
  },
  autonomy: { draft: { refreshing: false }, loading: false, offline: false },
}));

vi.mock("@/components/shared/RequireAuth", () => ({
  RequireAuth: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/shared/EnterprisePage", () => ({
  EnterprisePage: ({ identity, primaryAction, status, contextualControls, utilityControls, narrowContract, children }: EnterprisePageMockProps) => (
    <div><header>{identity}{primaryAction}{status}{contextualControls}{narrowContract?.essentialControls}</header><aside>{utilityControls}</aside><main>{children}</main></div>
  ),
}));

vi.mock("@/components/shared/PersonaWorkbench", () => ({
  PersonaWorkbench: ({ decision, primary, context, inspector }: { decision?: ReactNode; primary?: ReactNode; context?: ReactNode; inspector?: ReactNode }) => <div>{decision}{primary}{context}{inspector}</div>,
}));

vi.mock("@/components/shared/Panel", () => ({
  Panel: ({ title, right, children }: { title: string; right?: ReactNode; children?: ReactNode }) => <section aria-label={title}><h2>{title}</h2>{right}{children}</section>,
}));

vi.mock("@/components/shared/DecisionHeader", () => ({
  DecisionHeader: ({ state }: DecisionHeaderMockProps) => (
    <div aria-label="Decision header">
      <span>{state.whatChanged.kind}:{state.whatChanged.value ?? state.whatChanged.message}</span>
      <span>{state.whyItMatters.kind}:{state.whyItMatters.value ?? state.whyItMatters.message}</span>
      <span>{state.requiredAction.kind}:{state.requiredAction.value ?? state.requiredAction.message ?? state.requiredAction.lastKnown}</span>
      <span>{state.evidenceHealth.kind}:{state.evidenceHealth.value ?? state.evidenceHealth.message}</span>
    </div>
  ),
}));

vi.mock("@/components/shared/WorkbenchToolbar", () => ({
  WorkbenchToolbar: ({ title, count, viewLabel, filters }: { title: string; count: number; viewLabel: string; filters?: ReactNode }) => <div>{title} · {count} · {viewLabel}{filters}</div>,
}));

vi.mock("@/components/shared/DominantTableRegion", () => ({
  DominantTableRegion: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/shared/SurfaceState", () => ({
  SurfaceState: ({ title, detail, primaryAction }: { title: string; detail: string; primaryAction?: ReactNode }) => <section><h3>{title}</h3><p>{detail}</p>{primaryAction}</section>,
}));

vi.mock("@/components/shared/ActionReason", () => ({
  ActionReason: ({ reason, onClick, children }: { reason?: string | null; onClick?: MouseEventHandler<HTMLButtonElement>; children?: ReactNode }) => <button disabled={Boolean(reason)} title={reason ?? undefined} onClick={onClick}>{children}</button>,
}));

vi.mock("@/components/shared/ShellIdentity", () => ({
  ShellIdentity: ({ title, badges }: { title: string; badges?: ReactNode }) => <div>{title}{badges}</div>,
}));

vi.mock("@/components/shared/AnalysisContextSaveState", () => ({ AnalysisContextSaveState: () => <span>Saved</span> }));

vi.mock("@/components/shared/RoleViewProvider", () => ({
  useRoleView: () => ({ roleView: controls.role, setRoleView: vi.fn() }),
}));

vi.mock("@/lib/typed-url-state", async () => {
  const React = await import("react");
  return {
    useTypedUrlState: () => {
      const [values, setValues] = React.useState(() => ({ ...controls.initialUrl }));
      const update = React.useCallback((patch: Record<string, string | null>, mode?: string) => {
        controls.update(patch, mode);
        setValues((current) => ({ ...current, ...patch }));
      }, []);
      return { values, update };
    },
  };
});

vi.mock("@/lib/analysis-workbench", () => ({
  useAnalysisContext: () => ({
    context: {
      id: "context-command", name: "Portfolio command", issuer_ids: [], instrument_ids: [],
      sub_segments: [], sector_id: null, portfolio_scope: "portfolio-1", as_of: null,
      sector_review_run_id: null, rv_snapshot_id: null, rv_run_id: null, query_session_id: null,
      artifacts: { issuer_run_id: null, model_checkpoint_id: null, source_manifest_id: null, report_version_id: null, research_job_id: null, alert_event_id: null, sponsor_id: null },
      surface_state: {}, filters: {}, selected: {},
      created_at: "2026-07-14T00:00:00Z", updated_at: "2026-07-14T00:00:00Z",
    },
    loading: false, error: null, patch: controls.patch, replace: vi.fn(), refresh: vi.fn(),
  }),
  contextHref: (path: string, id: string) => `${path}?context=${id}`,
  analysisApi: { listInsights: vi.fn(), createInsight: vi.fn() },
}));

vi.mock("@/lib/engine/usePortfolio", () => ({ usePortfolio: () => controls.portfolio }));
vi.mock("@/lib/command/useGovernanceSources", () => ({ useGovernanceSources: () => controls.governance }));
vi.mock("@/lib/engine/useAutonomyDraft", () => ({ useAutonomyDraft: () => controls.autonomy }));
vi.mock("@/lib/alerts/inbox", () => ({ draftToAlertRows: () => Array.from({ length: controls.rankedCount }, (_, id) => ({ id })) }));

vi.mock("@/components/command/RankedChanges", () => ({ RankedChangesView: () => <div>Ranked changes body</div> }));
vi.mock("@/components/command/GovernancePanel", () => ({ GovernancePanel: () => <div>Governance body</div> }));
vi.mock("@/components/command/DailyDigestPanel", () => ({ DailyDigestPanel: () => <div>Digest body</div> }));
vi.mock("@/components/command/LiveCoverage", () => ({
  LiveCoverage: ({ rows, onSelect }: { rows: PortfolioRowDTO[]; onSelect: (issuerId: string) => void }) => <button onClick={() => onSelect(rows[0].issuer_id)}>Select live coverage issuer</button>,
}));
vi.mock("@/components/command/views", () => ({
  IssuerStrip: ({ liveRow, onClose }: { liveRow: PortfolioRowDTO; onClose: () => void }) => <div>Issuer strip {liveRow.name}<button onClick={onClose}>Close issuer strip</button></div>,
}));
vi.mock("@/components/command/CommandPortfolio", () => ({
  CommandPortfolioPosture: ({ total }: { total: number }) => <div>Posture total {total}</div>,
  CommandPortfolioTable: ({ positions, onSelect }: { positions: CommandPortfolioPosition[]; onSelect: (positionId: string) => void }) => <button onClick={() => onSelect(positions[0].id)}>Select held position</button>,
  CommandPositionStrip: ({ position, onClose }: { position: CommandPortfolioPosition; onClose: () => void }) => <div>Position strip {position.borrower_name}<button onClick={onClose}>Close position strip</button></div>,
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getPortfolios: vi.fn(),
}));
vi.mock("@/lib/portfolio-lab", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/portfolio-lab")>()),
  portfolioLabApi: { getCommandSnapshot: vi.fn() },
}));

const portfolioSummary = (id: string, name: string, kind: string): PortfolioSummary => ({
  id,
  name,
  kind,
  as_of_date: "2026-07-14",
  n_positions: 1,
  total_nav: 100,
  total_par: 100,
  breaches: 0,
  watches: 0,
  created_at: "2026-07-14T00:00:00Z",
});

const directory: PortfolioSummary[] = [
  portfolioSummary("portfolio-1", "Credit Opportunities", "fund"),
  portfolioSummary("portfolio-2", "Special Situations", "sleeve"),
];

const authority = {
  origin: "portfolio_command",
  method: "computed",
  freshness: "current",
  as_of: "2026-07-14",
  source_ids: ["portfolio-1"],
  run_id: "run-live",
  version_id: null,
  confidence: 0.95,
  approval_state: "draft" as const,
  analyst_override: null,
};

const heldPosition: CommandPortfolioPosition = {
  id: "position-1",
  portfolio_id: "portfolio-1",
  issuer_id: "issuer-held",
  borrower_name: "Held Issuer",
  ticker: "HELD",
  figi: null,
  loan_name: "Held Issuer TLB",
  sector: "Industrials",
  sub_sector: null,
  ranking: "1L",
  rating_moody: "B2",
  rating_sp: "B",
  par_usd: 100,
  facility_musd: 200,
  margin_bps: 450,
  maturity: "2030-07-14",
  price: 99,
  ytm: 8,
  dm: 500,
  market_value: 99,
  created_at: "2026-07-14T00:00:00Z",
  posture: "OVERWEIGHT",
  run_id: "run-live",
  qa_status: "Passed",
  committee_status: "Ready",
};

const snapshot: CommandPortfolioSnapshot = {
  portfolio: { id: "portfolio-1", name: "Credit Opportunities", kind: "fund", as_of_date: "2026-07-14" },
  as_of: "2026-07-14", position_count: 1,
  posture_counts: { OVERWEIGHT: 1, NEUTRAL: 0, UNDERWEIGHT: 0, UNKNOWN: 0 },
  positions: [heldPosition],
  authority,
};

const readyInsight: InsightArtifact = {
  id: "insight-1",
  context_id: "context-command",
  surface: "command",
  kind: "decision_brief",
  status: "ready",
  subject_refs: {
    issuer_run_id: null,
    source_manifest_id: null,
    research_job_id: null,
    model_checkpoint_id: null,
    report_version_id: null,
    alert_event_id: null,
    sponsor_id: null,
  },
  summary: "Cited summary",
  claims: [{ id: "claim-1", statement: "Leverage improved", evidence_ids: ["E-1"], numeric_facts: [] }],
  recommended_actions: [],
  missing_dependencies: [],
  authority,
  source_fingerprint: "fingerprint-1",
  version: 1,
  model: "test-model",
  generated_at: "2026-07-14T00:00:00Z",
  ratified_at: null,
  rejected_at: null,
  lease_owner: null,
  lease_expires_at: null,
};

beforeEach(() => {
  controls.role = "analyst";
  controls.initialUrl = {};
  controls.rankedCount = 2;
  controls.patch.mockResolvedValue(undefined);
  controls.portfolio.loading = false;
  controls.portfolio.error = null;
  controls.portfolio.rows = [{
    issuer_id: "issuer-live", name: "Live Issuer", ticker: "LIVE", sector: "Tech",
    run_id: "run-live", qa_status: "Pass", committee_status: "Ready", as_of: "2026-07-14",
    metrics: { net_leverage: 4.2, interest_coverage: 3.1 }, gaps: [],
  }];
  controls.governance.digest = {
    as_of: "2026-07-14T00:00:00Z",
    activity_24h: { completed_runs: 2, qa_events: 1 },
    warf: 3000, warf_band: "B", ccc_watch: ["issuer-live"], stale: [],
    freshness: {
      policy_version: "caos-freshness-v1",
      counts: { current: 1, due: 0, stale: 0, unknown: 0 }, rows: [],
    },
  };
  vi.mocked(getPortfolios).mockResolvedValue(directory);
  vi.mocked(portfolioLabApi.getCommandSnapshot).mockResolvedValue(snapshot);
  vi.mocked(analysisApi.listInsights).mockResolvedValue({ items: [], current: null, next_cursor: null } satisfies InsightPage);
  vi.mocked(analysisApi.createInsight).mockResolvedValue(readyInsight);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("Command Center interactions", () => {
  it("switches every dataset, selects live and held issuers, refreshes snapshots, and generates cited insight", async () => {
    render(<CommandPage />);
    expect((await screen.findAllByText("Credit Opportunities")).length).toBeGreaterThan(0);
    await waitFor(() => expect(portfolioLabApi.getCommandSnapshot).toHaveBeenCalledWith("portfolio-1"));
    expect(screen.getByText(/ready:2 completed runs · 1 qa events in 24h/)).toBeTruthy();
    expect(screen.getByText(/ready:WARF 3000 \(B\) · CCC watch 1/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Select live coverage issuer" }));
    expect(screen.getByText(/Issuer strip Live Issuer/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close issuer strip" }));

    fireEvent.click(screen.getByRole("tab", { name: "Positions" }));
    expect(screen.getByRole("button", { name: "Select held position" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Select held position" }));
    expect(screen.getByText(/Position strip Held Issuer/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close position strip" }));

    fireEvent.click(screen.getByRole("tab", { name: "Changes" }));
    expect(screen.getByText("Ranked changes body")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open top change" }));
    expect(controls.update).toHaveBeenCalledWith({ dataset: "changes", selected: null }, undefined);

    fireEvent.click(screen.getByRole("button", { name: "Open governance queue" }));
    expect(screen.getByText("Governance body")).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox", { name: "Selected portfolio" }), {
      target: { value: "portfolio-2" },
    });
    expect(controls.update).toHaveBeenCalledWith({ portfolio: "portfolio-2", selected: null }, "replace");

    fireEvent.click(screen.getByRole("button", { name: "Generate cited brief" }));
    expect(await screen.findByText("Cited summary")).toBeTruthy();
    expect(screen.getByText(/Leverage improved · sources E-1/)).toBeTruthy();

    const refreshCount = vi.mocked(portfolioLabApi.getCommandSnapshot).mock.calls.length;
    window.dispatchEvent(new Event("focus"));
    await waitFor(() => expect(portfolioLabApi.getCommandSnapshot).toHaveBeenCalledTimes(refreshCount + 1));
  });

  it("recovers a failed holdings snapshot through the focus refresh and exposes the empty state", async () => {
    controls.initialUrl = { dataset: "positions", portfolio: "portfolio-1", selected: null };
    vi.mocked(portfolioLabApi.getCommandSnapshot)
      .mockRejectedValueOnce(new Error("snapshot offline"))
      .mockResolvedValue({ ...snapshot, position_count: 0, positions: [] });
    render(<CommandPage />);

    expect(await screen.findByText("Holdings unavailable")).toBeTruthy();
    window.dispatchEvent(new Event("focus"));
    expect(await screen.findByText("No positions held")).toBeTruthy();
  });

  it("handles an invalid requested portfolio and opens the default selection", async () => {
    controls.initialUrl = { dataset: "positions", portfolio: "missing", selected: null };
    render(<CommandPage />);
    expect(await screen.findByText("Portfolio unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open default portfolio" }));
    expect(controls.update).toHaveBeenCalledWith({ portfolio: null, selected: null }, "replace");
  });

  it("renders honest empty and offline portfolio-directory states", async () => {
    controls.initialUrl = { dataset: "positions", portfolio: null, selected: null };
    vi.mocked(getPortfolios).mockResolvedValueOnce([]);
    const empty = render(<CommandPage />);
    expect(await screen.findByText("No portfolio configured")).toBeTruthy();
    empty.unmount();

    vi.mocked(getPortfolios).mockRejectedValueOnce(new Error("directory offline"));
    render(<CommandPage />);
    expect(await screen.findByText("Portfolio directory unavailable")).toBeTruthy();
  });

  it("shows observed-empty and degraded decision states and insight generation failures", async () => {
    controls.portfolio.error = new Error("coverage offline");
    controls.portfolio.rows = [];
    controls.governance.digest = {
      ...controls.governance.digest,
      activity_24h: {}, warf: null,
      freshness: { ...controls.governance.digest.freshness, counts: { current: 0, due: 1, stale: 0, unknown: 1 } },
    };
    vi.mocked(analysisApi.listInsights).mockRejectedValue(new Error("brief offline"));
    vi.mocked(analysisApi.createInsight)
      .mockResolvedValueOnce({ ...readyInsight, status: "queued", summary: "", claims: [] })
      .mockRejectedValueOnce("offline");
    render(<CommandPage />);

    expect(await screen.findByText(/observed-empty:No engine activity observed/)).toBeTruthy();
    expect(screen.getByText(/observed-empty:No rated names yet/)).toBeTruthy();
    expect(screen.getByText(/offline:Governance queues unavailable/)).toBeTruthy();
    expect(screen.getByText(/partial:0 stale · 1 due · 1 unknown/)).toBeTruthy();
    expect(await screen.findByText("No cited decision brief is available.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Generate cited brief" }));
    expect(await screen.findByText("Brief is queued.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Generate cited brief" }));
    expect(await screen.findByText("Cited decision brief is unavailable.")).toBeTruthy();
  });
});
