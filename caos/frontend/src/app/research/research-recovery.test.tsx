// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getResearchStatus: vi.fn(),
  resumeResearch: vi.fn(),
  patchContext: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/components/shared/RequireAuth", () => ({ RequireAuth: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/shared/AuthProvider", () => ({ useAuth: () => ({ user: { id: "analyst-1" } }) }));
vi.mock("@/components/shared/EnterprisePage", () => ({ EnterprisePage: ({ identity, primaryAction, children }: { identity: React.ReactNode; primaryAction: React.ReactNode; children: React.ReactNode }) => <div>{identity}{primaryAction}{children}</div> }));
vi.mock("@/components/shared/PersonaWorkbench", () => ({ PersonaWorkbench: ({ context, primary }: { context: React.ReactNode; primary: React.ReactNode }) => <>{context}{primary}</> }));
vi.mock("@/components/shared/ShellIdentity", () => ({ ShellIdentity: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/shared/Panel", () => ({ Panel: ({ title, children }: { title: string; children: React.ReactNode }) => <section aria-label={title}>{children}</section> }));
vi.mock("@/components/shared/Notifications", () => ({ useNotify: () => vi.fn() }));
vi.mock("@/components/research/ReportPane", () => ({ ReportPane: ({ result }: { result?: { report?: string } | null }) => <div>{result?.report ?? "No research result"}</div> }));
vi.mock("@/lib/analysis-workbench", () => ({
  useAnalysisContext: () => ({
    context: { id: "context-1", issuer_ids: [], artifacts: {}, surface_state: {} },
    patch: mocks.patchContext,
  }),
  contextHref: (path: string, id: string) => `${path}?context=${id}`,
  analysisApi: { createInsight: vi.fn() },
}));
vi.mock("@/lib/api", () => ({
  deepResearch: vi.fn(),
  resumeResearch: mocks.resumeResearch,
  getResearchStatus: mocks.getResearchStatus,
  getSettings: mocks.getSettings,
  isResearchAborted: () => false,
  isResearchGone: () => false,
  toErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
}));

import ResearchPage from "./page";

const jobKey = "caos.research.job.analyst-1.context-1";
const completed = { state: "complete", result: { report: "Recovered paid report", sources: [], demo: false } };

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
  mocks.getSettings.mockReset();
  mocks.getResearchStatus.mockReset();
  mocks.resumeResearch.mockReset();
  mocks.patchContext.mockReset().mockResolvedValue(undefined);
});

describe("Deep Research recovery boundaries", () => {
  it("blocks unknown provenance and retries configuration explicitly", async () => {
    mocks.getSettings.mockRejectedValueOnce(new Error("configuration offline")).mockResolvedValueOnce({ llm_configured: true });
    render(<ResearchPage />);

    expect((await screen.findByRole("alert")).textContent).toContain("Research configuration unavailable");
    expect((screen.getAllByRole("button", { name: "Research configuration unavailable" })[1] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry configuration" }));

    await waitFor(() => expect(screen.getAllByRole("button", { name: "Run deep research" }).length).toBeGreaterThan(0));
  });

  it.each(["server returned 500", "request timed out"])("preserves the durable job after %s and allows retry", async (message) => {
    sessionStorage.setItem(jobKey, "job-1");
    mocks.getSettings.mockResolvedValue({ llm_configured: true });
    mocks.getResearchStatus.mockRejectedValueOnce(new Error(message)).mockResolvedValueOnce(completed);
    render(<ResearchPage />);

    expect((await screen.findByRole("alert")).textContent).toContain(message);
    expect(sessionStorage.getItem(jobKey)).toBe("job-1");
    fireEvent.click(screen.getByRole("button", { name: "Retry reattachment" }));

    expect(await screen.findByText("Recovered paid report")).toBeTruthy();
    expect(sessionStorage.getItem(jobKey)).toBe("job-1");
  });

  it("deletes the pointer only after an authoritative terminal result", async () => {
    sessionStorage.setItem(jobKey, "job-1");
    mocks.getSettings.mockResolvedValue({ llm_configured: false });
    mocks.getResearchStatus.mockResolvedValue({ state: "gone" });
    render(<ResearchPage />);

    await waitFor(() => expect(sessionStorage.getItem(jobKey)).toBeNull());
    expect(screen.queryByRole("button", { name: "Retry reattachment" })).toBeNull();
  });
});
