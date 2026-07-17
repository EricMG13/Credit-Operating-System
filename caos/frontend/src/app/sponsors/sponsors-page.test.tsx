// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { analysis, getSponsorTrackRecord, getSponsors, openProfile } = vi.hoisted(() => ({
  analysis: {
    context: {
      id: "ctx-1", artifacts: {}, surface_state: {}, issuer_ids: [],
    },
    patch: vi.fn().mockResolvedValue(undefined),
  },
  getSponsorTrackRecord: vi.fn(),
  getSponsors: vi.fn(),
  openProfile: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("@/components/shared/RequireAuth", () => ({ RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/shared/Panel", () => ({ Panel: ({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) => <section><h2>{title}</h2>{right}{children}</section> }));
vi.mock("@/components/shared/EnterprisePage", () => ({ EnterprisePage: ({ identity, primaryAction, status, contextualControls, children }: { identity?: React.ReactNode; primaryAction?: React.ReactNode; status?: React.ReactNode; contextualControls?: React.ReactNode; children: React.ReactNode }) => <main>{identity}{primaryAction}{status}{contextualControls}{children}</main> }));
vi.mock("@/components/shared/ShellIdentity", () => ({ ShellIdentity: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/shared/StatusGlyph", () => ({ StatusGlyph: () => <span>warning</span> }));
vi.mock("@/components/shared/WorkbenchToolbar", () => ({ WorkbenchToolbar: ({ title, count }: { title: string; count: string }) => <header>{title} {count}</header> }));
vi.mock("@/components/shared/PersonaWorkbench", () => ({ PersonaWorkbench: ({ primary }: { primary: React.ReactNode }) => <>{primary}</> }));
vi.mock("@/components/shared/DominantTableRegion", () => ({ DominantTableRegion: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/shared/SurfaceState", () => ({ SurfaceState: ({ title, detail, primaryAction, secondaryAction, supporting }: { title: string; detail?: string; primaryAction?: React.ReactNode; secondaryAction?: React.ReactNode; supporting?: React.ReactNode }) => <div><strong>{title}</strong>{detail}<>{supporting}{primaryAction}{secondaryAction}</></div> }));
vi.mock("@/components/shared/AnalysisContextSaveState", () => ({ AnalysisContextSaveState: () => null }));
vi.mock("@/components/shared/IssuerProfileOverlay", () => ({ useIssuerProfileOverlay: () => ({ openProfile }) }));
vi.mock("@/lib/api", () => ({ getSponsors, getSponsorTrackRecord }));
vi.mock("@/lib/analysis-workbench", () => ({
  useAnalysisContext: () => analysis,
  contextHref: (path: string, id: string) => `${path}?context=${id}`,
}));

import SponsorsPage from "./page";

const record = {
  sponsor: "Alpha Capital",
  issuer_count: 2,
  avg_governance_risk_score: 4,
  flag_counts: { "Aggressive add-backs": 2, "Dividend recap": 1 },
  issuers: [
    { issuer_id: "issuer-1", name: "AlphaCo", ticker: "abc", run_id: "run-1", qa_status: "Blocked", governance_risk_score: 5, flags: ["Aggressive"], net_leverage: 5.44 },
    { issuer_id: "issuer-2", name: "BetaCo", ticker: null, run_id: null, qa_status: null, governance_risk_score: null, flags: [], net_leverage: null },
  ],
};

beforeEach(() => {
  analysis.context = { id: "ctx-1", artifacts: {}, surface_state: {}, issuer_ids: [] };
  analysis.patch.mockResolvedValue(undefined);
  getSponsors.mockResolvedValue([{ sponsor: "Alpha Capital", issuer_count: 1 }, { sponsor: "Beta Partners", issuer_count: 2 }]);
  getSponsorTrackRecord.mockResolvedValue(record);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SponsorsPage", () => {
  it("loads the sponsor register, renders a rich record, and opens issuer profiles", async () => {
    render(<SponsorsPage />);
    expect(screen.getByText("Loading sponsor register")).toBeTruthy();
    expect(await screen.findByText("Aggressive add-backs · 2 of 2")).toBeTruthy();
    expect(screen.getByText("1 name")).toBeTruthy();
    expect(screen.getByText("2 names")).toBeTruthy();
    expect(screen.getByText("5.4×")).toBeTruthy();
    expect(screen.getByText("no run")).toBeTruthy();
    expect(screen.getByText("none")).toBeTruthy();
    expect(screen.getByText("1/2 names have a completed CP-2D run · 1 blocked")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Open AlphaCo profile"));
    expect(openProfile).toHaveBeenCalledWith("issuer-1");
    await waitFor(() => expect(analysis.patch).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Review selected sponsor" }));
    fireEvent.click(screen.getByRole("button", { name: /Beta Partners/ }));
    await waitFor(() => expect(getSponsorTrackRecord).toHaveBeenCalledWith("Beta Partners"));
  });

  it("distinguishes an unavailable register from an observed empty register and retries", async () => {
    getSponsors.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([]);
    render(<SponsorsPage />);
    expect(await screen.findByText("Sponsor register unavailable")).toBeTruthy();
    expect(screen.getByText("Register unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No sponsors on file")).toBeTruthy();
    expect(screen.getByText("Add sponsors first")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open issuer directory" }).getAttribute("href")).toBe("/issuers?context=ctx-1");
  });

  it("preserves a selected sponsor while its record fails and recovers on retry", async () => {
    getSponsorTrackRecord.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ...record, flag_counts: {}, avg_governance_risk_score: null });
    render(<SponsorsPage />);
    expect(await screen.findByText("Sponsor record unavailable")).toBeTruthy();
    expect(screen.getByText("Preserved: Alpha Capital")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No CP-2D red flags across covered names.")).toBeTruthy();
  });
});
