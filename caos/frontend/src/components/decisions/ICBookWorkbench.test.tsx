// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const state = vi.hoisted(() => ({
  roleView: "analyst" as "analyst" | "pm" | "qa",
  context: { id: "ctx-1", issuer_ids: ["issuer-1"], portfolio_scope: "portfolio-1", artifacts: { issuer_run_id: "run-1", report_version_id: "report-1", portfolio_id: "portfolio-1" } },
}));
const mocks = vi.hoisted(() => ({
  getIssuers: vi.fn(),
  getPortfolios: vi.fn(),
  listRuns: vi.fn(),
  listAgenda: vi.fn(),
  listDecisions: vi.fn(),
  createAgenda: vi.fn(),
  patchAgenda: vi.fn(),
  finalizeAgenda: vi.fn(),
  vote: vi.fn(),
  listOpinions: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/decisions",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/shared/ConceptNav", () => ({ ConceptNav: () => <nav>Concepts</nav> }));
vi.mock("@/components/shared/AnalysisContextStrip", () => ({ AnalysisContextStrip: () => null }));
vi.mock("@/components/shared/RoleViewProvider", () => ({
  useRoleView: () => ({ roleView: state.roleView, setRoleView: vi.fn(), ready: true }),
}));
vi.mock("@/lib/api", () => ({
  getIssuers: mocks.getIssuers,
  getPortfolios: mocks.getPortfolios,
  listRuns: mocks.listRuns,
  toErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
}));
vi.mock("@/lib/analyst-opinions", () => ({
  analystOpinionsApi: { list: mocks.listOpinions },
}));
vi.mock("@/lib/ic-book", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ic-book")>();
  return { ...actual, icBookApi: {
    listAgenda: mocks.listAgenda,
    listDecisions: mocks.listDecisions,
    createAgenda: mocks.createAgenda,
    patchAgenda: mocks.patchAgenda,
    finalizeAgenda: mocks.finalizeAgenda,
    vote: mocks.vote,
  } };
});
vi.mock("@/lib/analysis-workbench", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analysis-workbench")>();
  return { ...actual, useAnalysisContext: () => ({ context: state.context, loading: false, error: null, patch: vi.fn() }) };
});

import { ICBookWorkbench } from "./ICBookWorkbench";

function tableRow(label: RegExp): HTMLTableRowElement {
  return screen.getAllByText(label).map((element) => element.closest("tr")).find((row): row is HTMLTableRowElement => row != null)!;
}

const agenda = {
  id: "agenda-1", issuer_id: "issuer-1", portfolio_id: "portfolio-1", owner_id: "analyst-1",
  scheduled_for: "2026-07-20T09:00:00Z", expiry: "2026-12-31", recommendation: "approve", conviction: 72,
  thesis: "FCF conversion supports a staged position.", conditions: ["Re-test leverage after Q3"],
  run_id: "run-1", report_version_id: "report-1", context_id: "ctx-1", status: "ready",
  revision: 2, readiness_failures: [], finalized_decision_id: null, snapshot_sha256: null,
  frozen_authority: null, created_at: "2026-07-13T10:00:00Z", updated_at: "2026-07-13T10:00:00Z", finalized_at: null,
};
const decision = {
  id: "decision-1", issuer_id: "issuer-1", portfolio_id: "portfolio-1", agenda_item_id: "agenda-1",
  run_id: "run-1", report_id: "report-1", report_version_id: "report-1", action: "approve", status: "active",
  conditions: ["Re-test leverage after Q3"], expiry: null, snapshot: { agenda: { thesis: agenda.thesis } },
  snapshot_sha256: "abc123", created_by: "analyst-1", reopened_at: null, reopen_alert_key: null,
  created_at: "2026-07-13T10:00:00Z", votes: [],
};

afterEach(cleanup);

beforeEach(() => {
  window.history.replaceState({}, "", "/decisions?dataset=agenda&context=ctx-1");
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) });
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as typeof ResizeObserver;
  state.roleView = "analyst";
  mocks.getIssuers.mockReset().mockResolvedValue([{ id: "issuer-1", name: "Alpha", ticker: "ALPH" }]);
  mocks.getPortfolios.mockReset().mockResolvedValue([{ id: "portfolio-1", name: "Credit Fund I" }]);
  mocks.listRuns.mockReset().mockResolvedValue([{ id: "run-1", committee_status: "Committee Ready" }]);
  mocks.listAgenda.mockReset().mockResolvedValue({ items: [agenda], next_cursor: null, total: 1 });
  mocks.listDecisions.mockReset().mockResolvedValue({ items: [decision], next_cursor: null, total: 1 });
  mocks.createAgenda.mockReset();
  mocks.patchAgenda.mockReset().mockResolvedValue(agenda);
  mocks.finalizeAgenda.mockReset().mockResolvedValue({ agenda: { ...agenda, status: "decided", finalized_decision_id: "decision-1" }, decision });
  mocks.vote.mockReset().mockResolvedValue(decision);
  mocks.listOpinions.mockReset().mockResolvedValue({ current: null, items: [] });
});

describe("IC Book workbench", () => {
  it("shows one table owner and replaces agenda with decision history", async () => {
    render(<ICBookWorkbench />);
    const agendaTable = await screen.findByRole("table", { name: "Committee agenda" });
    expect(agendaTable).toBeTruthy();
    expect(screen.getByText("72").closest("td")?.className).toContain("text-right");
    expect(screen.getByText("Conviction (%)")).toBeTruthy();
    expect(tableRow(/2026-07-20/).getAttribute("tabindex")).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: /Meeting/ }));
    expect(window.location.search).toContain("direction=desc");
    expect(document.querySelectorAll("[data-caos-dominant-table-owner]")).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: "Decision history" }));
    expect(await screen.findByRole("table", { name: "Decision history" })).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Committee agenda" })).toBeNull();
    expect(document.querySelectorAll("[data-caos-dominant-table-owner]")).toHaveLength(1);
  });

  it("previews immutable finalization before calling the endpoint", async () => {
    render(<ICBookWorkbench />);
    await screen.findByText(/2026-07-20/);
    fireEvent.click(tableRow(/2026-07-20/));
    fireEvent.click(await screen.findByRole("button", { name: "Review finalization" }));
    expect(screen.getByText(/Freeze this committee record/i)).toBeTruthy();
    expect(mocks.finalizeAgenda).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm finalization" }));
    await waitFor(() => expect(mocks.finalizeAgenda).toHaveBeenCalledWith("agenda-1", 2));
  });

  it("edits mutable preparation with optimistic revision", async () => {
    const draft = { ...agenda, status: "draft", revision: 3 };
    mocks.listAgenda.mockResolvedValueOnce({ items: [draft], next_cursor: null, total: 1 });
    mocks.patchAgenda.mockResolvedValueOnce({ ...draft, thesis: "Updated thesis", revision: 4 });
    render(<ICBookWorkbench />);
    await screen.findByText(/2026-07-20/);
    fireEvent.click(tableRow(/2026-07-20/));
    fireEvent.click(screen.getByRole("button", { name: "Edit preparation" }));
    const inspector = screen.getByRole("article", { name: "Agenda inspector" });
    fireEvent.change(within(inspector).getByLabelText("Thesis"), { target: { value: "Updated thesis" } });
    fireEvent.click(within(inspector).getByRole("button", { name: "Save preparation" }));
    await waitFor(() => expect(mocks.patchAgenda).toHaveBeenCalledWith("agenda-1", expect.objectContaining({
      expected_revision: 3,
      thesis: "Updated thesis",
    })));
  });

  it("preserves URL state when the presentation lens changes", async () => {
    const view = render(<ICBookWorkbench />);
    await screen.findByRole("table", { name: "Committee agenda" });
    const before = window.location.search;
    state.roleView = "qa";
    view.rerender(<ICBookWorkbench />);
    expect(screen.getByText(/Validate readiness/i)).toBeTruthy();
    expect(window.location.search).toBe(before);
  });

  it("prefills the exact context run and report instead of choosing an arbitrary run", async () => {
    mocks.createAgenda.mockResolvedValueOnce({ ...agenda, id: "agenda-2", status: "draft" });
    render(<ICBookWorkbench />);
    await screen.findByRole("table", { name: "Committee agenda" });
    const form = screen.getByRole("form", { name: "Add agenda item" });
    expect(form).toBeTruthy();
    fireEvent.change(within(form!).getByLabelText("Meeting time"), { target: { value: "2026-07-21T10:00" } });
    fireEvent.change(within(form!).getByLabelText("Thesis"), { target: { value: "Committee thesis" } });
    fireEvent.click(within(form!).getByRole("button", { name: "Add agenda item" }));
    await waitFor(() => expect(mocks.createAgenda).toHaveBeenCalledWith(expect.objectContaining({
      run_id: "run-1",
      report_version_id: "report-1",
      context_id: "ctx-1",
    })));
  });

  it("keeps the context linkage atomic and clears it when the issuer is overridden", async () => {
    mocks.getIssuers.mockResolvedValueOnce([
      { id: "issuer-1", name: "Alpha", ticker: "ALPH" },
      { id: "issuer-2", name: "Beta", ticker: "BETA" },
    ]);
    mocks.listRuns.mockImplementation(async (issuerId: string) => issuerId === "issuer-1"
      ? [{ id: "run-1", committee_status: "Committee Ready" }]
      : [{ id: "run-2", committee_status: "Committee Ready" }]);
    mocks.createAgenda.mockResolvedValueOnce({ ...agenda, id: "agenda-2", issuer_id: "issuer-2", status: "draft" });
    render(<ICBookWorkbench />);
    const form = await screen.findByRole("form", { name: "Add agenda item" });
    await waitFor(() => expect((within(form).getByLabelText("Run") as HTMLSelectElement).value).toBe("run-1"));
    fireEvent.change(within(form).getByLabelText("Issuer"), { target: { value: "issuer-2" } });
    await waitFor(() => expect((within(form).getByLabelText("Run") as HTMLSelectElement).value).toBe(""));
    expect((within(form).getByLabelText("Report version") as HTMLInputElement).value).toBe("");
    expect(within(form).queryByText(/Linked context/)).toBeNull();
    fireEvent.change(within(form).getByLabelText("Meeting time"), { target: { value: "2026-07-21T10:00" } });
    fireEvent.change(within(form).getByLabelText("Thesis"), { target: { value: "Independent committee thesis" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add agenda item" }));
    await waitFor(() => expect(mocks.createAgenda).toHaveBeenCalledWith(expect.objectContaining({
      issuer_id: "issuer-2",
      report_version_id: null,
      context_id: null,
    })));
  });

  it("clears every context-bound artifact when the portfolio is overridden", async () => {
    mocks.getPortfolios.mockResolvedValueOnce([
      { id: "portfolio-1", name: "Credit Fund I" },
      { id: "portfolio-2", name: "Credit Fund II" },
    ]);
    render(<ICBookWorkbench />);
    const form = await screen.findByRole("form", { name: "Add agenda item" });
    await waitFor(() => expect((within(form).getByLabelText("Run") as HTMLSelectElement).value).toBe("run-1"));
    fireEvent.change(within(form).getByLabelText("Portfolio"), { target: { value: "portfolio-2" } });
    expect((within(form).getByLabelText("Run") as HTMLSelectElement).value).toBe("");
    expect((within(form).getByLabelText("Report version") as HTMLInputElement).value).toBe("");
    expect(within(form).queryByText(/Linked context/)).toBeNull();
  });

  it("preserves an unchanged repeated-hour meeting instant and renders expiry as a calendar date", async () => {
    const repeatedHour = { ...agenda, scheduled_for: "2026-10-25T01:30:00Z", status: "draft", revision: 4 };
    mocks.listAgenda.mockResolvedValueOnce({ items: [repeatedHour], next_cursor: null, total: 1 });
    render(<ICBookWorkbench />);
    await screen.findByText(/2026-10-25/);
    fireEvent.click(tableRow(/2026-10-25/));
    fireEvent.click(screen.getByRole("button", { name: "Edit preparation" }));
    fireEvent.click(within(screen.getByRole("article", { name: "Agenda inspector" })).getByRole("button", { name: "Save preparation" }));
    await waitFor(() => expect(mocks.patchAgenda).toHaveBeenCalledWith("agenda-1", expect.objectContaining({
      scheduled_for: "2026-10-25T01:30:00Z",
    })));

    cleanup();
    window.history.replaceState({}, "", "/decisions?dataset=history&context=ctx-1");
    mocks.listDecisions.mockResolvedValueOnce({ items: [{ ...decision, expiry: "2026-12-31" }], next_cursor: null, total: 1 });
    render(<ICBookWorkbench />);
    expect(await screen.findByText("2026-12-31")).toBeTruthy();
  });

  it("makes every frozen source navigable with exact report and context state", async () => {
    window.history.replaceState({}, "", "/decisions?dataset=history&context=ctx-1");
    mocks.listDecisions.mockResolvedValueOnce({ items: [{ ...decision, snapshot: {
      agenda: { thesis: agenda.thesis },
      context: { id: "ctx-1" },
      evidence_manifest: { records: {
        modules: [{ id: "module-db-1" }],
        claims: [{ id: "claim-db-1", module_output_id: "module-db-1" }],
        evidence: [{ id: "evidence-db-1", claim_pk: "claim-db-1", evidence_id: "E-44", chunk: { id: "chunk-db-1", document_id: "document-db-1" } }],
        documents: [{ id: "document-db-1" }],
      } },
      authority: { approval_state: "ratified", as_of: "2026-07-13", source_ids: ["run-1", "report-1", "module-db-1", "claim-db-1", "evidence-db-1", "chunk-db-1", "document-db-1"] },
    } }], next_cursor: null, total: 1 });
    render(<ICBookWorkbench />);
    await screen.findByText(/2026-07-13/);
    fireEvent.click(tableRow(/2026-07-13/));
    expect(screen.getByRole("link", { name: "report-1" }).getAttribute("href")).toContain("/reports?issuer=issuer-1&report=report-1&context=ctx-1");
    for (const sourceId of ["module-db-1", "claim-db-1", "evidence-db-1", "chunk-db-1", "document-db-1"]) {
      expect(screen.getByRole("link", { name: sourceId }).getAttribute("href")).toContain("evidence=E-44");
    }
  });

  it("moves keyboard focus with arrow-key tab selection", async () => {
    render(<ICBookWorkbench />);
    await screen.findByRole("table", { name: "Committee agenda" });
    const agendaTab = screen.getByRole("tab", { name: "Agenda" });
    agendaTab.focus();
    fireEvent.keyDown(agendaTab.closest('[role="tablist"]')!, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Decision history" })).toBe(document.activeElement);
    expect(await screen.findByRole("table", { name: "Decision history" })).toBeTruthy();
  });

  it("does not carry a drafted dissent across decision selection", async () => {
    const second = { ...decision, id: "decision-2", created_at: "2026-07-14T10:00:00Z" };
    window.history.replaceState({}, "", "/decisions?dataset=history&context=ctx-1");
    mocks.listDecisions.mockResolvedValueOnce({ items: [decision, second], next_cursor: null, total: 2 });
    render(<ICBookWorkbench />);
    await screen.findByText(/2026-07-13/);
    fireEvent.click(tableRow(/2026-07-13/));
    fireEvent.change(screen.getByLabelText("Dissent rationale"), { target: { value: "Issuer-specific objection" } });
    fireEvent.click(tableRow(/2026-07-14/));
    expect((screen.getByLabelText("Dissent rationale") as HTMLTextAreaElement).value).toBe("");
    expect(mocks.listDecisions).toHaveBeenCalledTimes(1);
  });
});
