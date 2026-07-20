// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type TestPageAction = { label: string; href?: string; onAction?: () => void; unavailableReason?: string | null };

function renderPageAction(action?: TestPageAction) {
  if (!action) return null;
  if (action.href && !action.unavailableReason) return <a href={action.href}>{action.label}</a>;
  return <button type="button" aria-disabled={action.unavailableReason ? "true" : undefined} onClick={action.unavailableReason ? undefined : action.onAction}>{action.label}</button>;
}

vi.mock("next/dynamic", () => ({ default: () => function DynamicStub() { return <div data-testid="dynamic-stub" />; } }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => <a href={href} {...props}>{children}</a>,
}));
const search = { value: "" };
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search.value) }));
vi.mock("@/components/shared/RequireAuth", () => ({ RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/shared/EnterprisePage", () => ({
  EnterprisePage: ({ children, identity, decisionContext, primaryAction, contextualControls, utilityControls }: {
    children: React.ReactNode; identity?: React.ReactNode; decisionContext?: React.ReactNode;
    primaryAction?: TestPageAction; contextualControls?: React.ReactNode; utilityControls?: React.ReactNode;
  }) => <main>{identity}{decisionContext}{renderPageAction(primaryAction)}{contextualControls}{utilityControls}{children}</main>,
}));
vi.mock("@/components/shared/ShellIdentity", () => ({ ShellIdentity: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/shared/DecisionHeader", () => ({ DecisionHeader: () => <div>decision header</div> }));
vi.mock("@/components/shared/PersonaWorkbench", () => ({
  PersonaWorkbench: ({ primary, context, utility }: { primary: React.ReactNode; context?: React.ReactNode; utility?: React.ReactNode }) => <>{primary}{context}{utility}</>,
}));
vi.mock("@/components/shared/AskContext", () => ({ useAsk: () => ({ open: false, setOpen: vi.fn() }) }));
vi.mock("@/components/shared/FirstRunHint", () => ({ FirstRunHint: () => <div>first run hint</div> }));
vi.mock("@/components/shared/CrossDefaultDominoes", () => ({ CrossDefaultDominoes: () => null }));
vi.mock("@/components/shared/StatusGlyph", () => ({ StatusGlyph: () => <span>status</span> }));
vi.mock("@/components/reports/ExportToVaultButton", () => ({ ExportToVaultButton: () => <button>export</button> }));
vi.mock("@/components/pipeline/atoms", () => ({ Dot: () => <span>dot</span>, SimControls: () => <div>sim controls</div> }));
vi.mock("@/components/deepdive/rails", () => ({
  Panel: ({ children, title }: { children: React.ReactNode; title: string }) => <section><h2>{title}</h2>{children}</section>,
  SourceRail: () => <aside>source rail</aside>,
  DecisionRail: () => <aside>decision rail</aside>,
}));
vi.mock("@/components/deepdive/ModuleFinder", () => ({ ModuleFinder: () => null }));
vi.mock("@/components/deepdive/StandingViewStrip", () => ({ StandingViewStrip: () => <div>standing view</div> }));
vi.mock("@/lib/evidence-sync", () => ({ EvidenceSyncProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/pipeline/sim", () => ({
  useSimRun: () => ({ completed: 0, total: 27, sim: { mods: {} } }),
}));
vi.mock("@/lib/engine/useLiveRun", () => ({
  useLiveRun: () => ({
    loading: false, phase: "none", runId: null, asOf: null, committeeStatus: null,
    council: [], liveEvidence: {}, liveOuts: {}, liveStatus: {},
  }),
}));
vi.mock("@/lib/analysis-workbench", () => ({
  useAnalysisContext: () => ({ context: null, patch: vi.fn(), loading: false, error: null }),
  analysisApi: { createFinding: vi.fn() },
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  createThesisVersion: vi.fn(), getIssuerProfile: vi.fn(), updateAnalystWorkspace: vi.fn(),
}));

import DeepDivePage from "./page";

beforeEach(() => {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: false, media: "", onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  search.value = "";
});

describe("Deep-Dive route smoke", () => {
  it("renders the complete reference workspace without a backend run", () => {
    search.value = "mode=reference";
    render(<DeepDivePage />);
    expect(screen.getByRole("heading", { name: "2L TL '31 — new issue review" })).toBeTruthy();
    expect(screen.getByText("decision rail")).toBeTruthy();
  });

  it("requires an issuer in live mode instead of selecting Atlas Forge implicitly", () => {
    search.value = "context=ctx-1&mod=CP-4";
    render(<DeepDivePage />);
    expect(screen.getByText("Select an issuer to begin Deep-Dive")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open reference example" }).getAttribute("href"))
      .toBe("/deepdive?context=ctx-1&mod=CP-4&mode=reference");
    expect(screen.queryByRole("heading", { name: "2L TL '31 — new issue review" })).toBeNull();
    expect(screen.queryByText("decision rail")).toBeNull();
  });
});
