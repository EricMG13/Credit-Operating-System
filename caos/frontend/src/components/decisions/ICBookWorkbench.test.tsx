// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const state = vi.hoisted(() => ({
  roleView: "analyst" as "analyst" | "pm" | "qa",
  userRole: "analyst" as "analyst" | "qa" | "admin",
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
  requestException: vi.fn(),
  reviewException: vi.fn(),
  revokeException: vi.fn(),
  reopen: vi.fn(),
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
vi.mock("@/components/shared/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "user-1", role: state.userRole } }),
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
    requestException: mocks.requestException,
    reviewException: mocks.reviewException,
    revokeException: mocks.revokeException,
    reopen: mocks.reopen,
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
  state.userRole = "analyst";
  mocks.getIssuers.mockReset().mockResolvedValue([{ id: "issuer-1", name: "Alpha", ticker: "ALPH" }]);
  mocks.getPortfolios.mockReset().mockResolvedValue([{ id: "portfolio-1", name: "Credit Fund I" }]);
  mocks.listRuns.mockReset().mockResolvedValue([{ id: "run-1", committee_status: "Committee Ready" }]);
  mocks.listAgenda.mockReset().mockResolvedValue({ items: [agenda], next_cursor: null, total: 1 });
  mocks.listDecisions.mockReset().mockResolvedValue({ items: [decision], next_cursor: null, total: 1 });
  mocks.createAgenda.mockReset();
  mocks.patchAgenda.mockReset().mockResolvedValue(agenda);
  mocks.finalizeAgenda.mockReset().mockResolvedValue({ agenda: { ...agenda, status: "decided", finalized_decision_id: "decision-1" }, decision });
  mocks.vote.mockReset().mockResolvedValue(decision);
  mocks.requestException.mockReset().mockResolvedValue(agenda);
  mocks.reviewException.mockReset().mockResolvedValue(agenda);
  mocks.revokeException.mockReset().mockResolvedValue(agenda);
  mocks.reopen.mockReset().mockResolvedValue({ ...decision, status: "reopened", reopened_at: "2026-07-14T10:00:00Z", reopen_alert_key: "alert:key" });
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

  it("lets QA review a pending evidence exception with a required note", async () => {
    state.roleView = "qa";
    state.userRole = "qa";
    const pendingException = {
      id: "exception-1",
      agenda_item_id: agenda.id,
      run_id: agenda.run_id,
      basis_sha256: "basis-1",
      failure_codes: ["run_not_committee_ready"],
      finding_ids: [],
      rationale: "Restricted run with sufficient mitigants.",
      mitigants: ["Cap initial position at 50 bps"],
      expires_at: "2026-08-01",
      status: "pending",
      requested_by: "analyst-1",
      requested_at: "2026-07-13T10:00:00Z",
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
      revoked_by: null,
      revoked_at: null,
      revision: 4,
    } as const;
    mocks.listAgenda.mockResolvedValueOnce({
      items: [{ ...agenda, status: "draft", readiness_failures: ["run_not_committee_ready"], evidence_exception: pendingException }],
      next_cursor: null,
      total: 1,
    });

    render(<ICBookWorkbench />);
    await screen.findByText(/2026-07-20/);
    fireEvent.click(tableRow(/2026-07-20/));
    expect(screen.getByText("Cap initial position at 50 bps")).toBeTruthy();
    const note = screen.getByLabelText("QA review note");
    expect((screen.getByRole("button", { name: "Approve exception" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(note, { target: { value: "Evidence gap is bounded." } });
    fireEvent.click(screen.getByRole("button", { name: "Approve exception" }));
    await waitFor(() => expect(mocks.reviewException).toHaveBeenCalledWith("exception-1", {
      expected_revision: 4,
      decision: "approve",
      review_note: "Evidence gap is bounded.",
    }));
  });

  it("edits every preparation field, cancels safely, and saves normalized values", async () => {
    const draft = { ...agenda, status: "draft", conditions: [], conviction: null, expiry: null, revision: 5 };
    mocks.listAgenda.mockResolvedValue({ items: [draft], next_cursor: null, total: 1 });
    render(<ICBookWorkbench />);
    await screen.findByText(/2026-07-20/);
    fireEvent.click(tableRow(/2026-07-20/));
    expect(screen.getByText("No conditions recorded.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit preparation" }));
    let inspector = within(screen.getByRole("article", { name: "Agenda inspector" }));
    fireEvent.change(inspector.getByLabelText("Meeting time"), { target: { value: "2026-07-22T11:30" } });
    fireEvent.change(inspector.getByLabelText("Decision expiry"), { target: { value: "2027-01-31" } });
    fireEvent.change(inspector.getByLabelText("Recommendation"), { target: { value: "revisit" } });
    fireEvent.change(inspector.getByLabelText("Conviction"), { target: { value: "64" } });
    fireEvent.change(inspector.getByLabelText("Conditions · one per line"), { target: { value: " First condition \n\nSecond condition " } });
    fireEvent.click(inspector.getByRole("button", { name: "Cancel edit" }));
    expect(mocks.patchAgenda).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Edit preparation" }));
    inspector = within(screen.getByRole("article", { name: "Agenda inspector" }));
    fireEvent.change(inspector.getByLabelText("Meeting time"), { target: { value: "2026-07-22T11:30" } });
    fireEvent.change(inspector.getByLabelText("Decision expiry"), { target: { value: "2027-01-31" } });
    fireEvent.change(inspector.getByLabelText("Recommendation"), { target: { value: "revisit" } });
    fireEvent.change(inspector.getByLabelText("Conviction"), { target: { value: "64" } });
    fireEvent.change(inspector.getByLabelText("Conditions · one per line"), { target: { value: "First condition\nSecond condition" } });
    fireEvent.click(inspector.getByRole("button", { name: "Save preparation" }));
    await waitFor(() => expect(mocks.patchAgenda).toHaveBeenCalledWith("agenda-1", expect.objectContaining({
      scheduled_for: new Date("2026-07-22T11:30").toISOString(), expiry: "2027-01-31",
      recommendation: "revisit", conviction: 64, conditions: ["First condition", "Second condition"],
    })));
  });

  it("links the current analyst view and moves draft readiness in both directions", async () => {
    const draft = { ...agenda, status: "draft", analyst_opinion_version_id: null, revision: 6 };
    mocks.listAgenda.mockResolvedValue({ items: [draft], next_cursor: null, total: 1 });
    mocks.listOpinions.mockResolvedValue({ current: { id: "opinion-1" }, items: [{ id: "opinion-1", issuer_id: "issuer-1", stance: "long", version: 3, evidence_state: "complete" }] });
    render(<ICBookWorkbench />);
    await screen.findByText(/2026-07-20/);
    fireEvent.click(tableRow(/2026-07-20/));
    fireEvent.click(await screen.findByRole("button", { name: "Link current view · long · v3" }));
    await waitFor(() => expect(mocks.patchAgenda).toHaveBeenCalledWith("agenda-1", expect.objectContaining({ analyst_opinion_version_id: "opinion-1" })));
    fireEvent.click(screen.getByRole("button", { name: "Mark ready" }));
    await waitFor(() => expect(mocks.patchAgenda).toHaveBeenCalledWith("agenda-1", expect.objectContaining({ status: "ready" })));

    cleanup();
    mocks.listAgenda.mockResolvedValue({ items: [agenda], next_cursor: null, total: 1 });
    render(<ICBookWorkbench />);
    await screen.findByText(/2026-07-20/);
    fireEvent.click(tableRow(/2026-07-20/));
    fireEvent.click(screen.getByRole("button", { name: "Return to draft" }));
    await waitFor(() => expect(mocks.patchAgenda).toHaveBeenCalledWith("agenda-1", expect.objectContaining({ status: "draft" })));
    fireEvent.click(screen.getByRole("button", { name: "Review finalization" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText(/Freeze this committee record/i)).toBeNull();
  });

  it("requests an evidence exception with normalized mitigants", async () => {
    mocks.listAgenda.mockResolvedValue({ items: [{ ...agenda, status: "draft", readiness_failures: ["run_not_committee_ready"], evidence_exception: null }], next_cursor: null, total: 1 });
    render(<ICBookWorkbench />);
    await screen.findByText(/2026-07-20/);
    fireEvent.click(tableRow(/2026-07-20/));
    fireEvent.change(screen.getByLabelText("Rationale"), { target: { value: " Bounded evidence gap " } });
    fireEvent.change(screen.getByLabelText("Mitigants · one per line"), { target: { value: "50 bps cap\n\n Weekly review " } });
    fireEvent.change(screen.getByLabelText("Expiry"), { target: { value: "2026-08-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Request QA exception" }));
    await waitFor(() => expect(mocks.requestException).toHaveBeenCalledWith("agenda-1", {
      expected_revision: 2, rationale: "Bounded evidence gap", mitigants: ["50 bps cap", "Weekly review"], expires_at: "2026-08-15",
    }));
  });

  it("lets QA reject and revoke evidence exceptions", async () => {
    state.roleView = "qa";
    state.userRole = "qa";
    const baseException = {
      id: "exception-2", agenda_item_id: agenda.id, run_id: agenda.run_id, basis_sha256: "basis-2",
      failure_codes: ["run_not_committee_ready"], finding_ids: [], rationale: "Bounded gap", mitigants: [],
      expires_at: "2026-08-01", requested_by: "analyst-1", requested_at: agenda.created_at,
      reviewed_by: null, reviewed_at: null, review_note: null, revoked_by: null, revoked_at: null, revision: 7,
    };
    mocks.listAgenda.mockResolvedValueOnce({ items: [{ ...agenda, status: "draft", evidence_exception: { ...baseException, status: "pending" } }], next_cursor: null, total: 1 });
    const first = render(<ICBookWorkbench />);
    await screen.findByText(/2026-07-20/);
    fireEvent.click(tableRow(/2026-07-20/));
    fireEvent.change(screen.getByLabelText("QA review note"), { target: { value: "Not sufficient" } });
    fireEvent.click(screen.getByRole("button", { name: "Reject exception" }));
    await waitFor(() => expect(mocks.reviewException).toHaveBeenCalledWith("exception-2", { expected_revision: 7, decision: "reject", review_note: "Not sufficient" }));
    first.unmount();

    mocks.listAgenda.mockResolvedValueOnce({ items: [{ ...agenda, status: "draft", evidence_exception: { ...baseException, status: "approved", review_note: "Initially approved" } }], next_cursor: null, total: 1 });
    render(<ICBookWorkbench />);
    await screen.findByText(/2026-07-20/);
    fireEvent.click(tableRow(/2026-07-20/));
    fireEvent.change(screen.getByLabelText("Revocation note"), { target: { value: "New critical finding" } });
    fireEvent.click(screen.getByRole("button", { name: "Revoke exception" }));
    await waitFor(() => expect(mocks.revokeException).toHaveBeenCalledWith("exception-2", { expected_revision: 7, review_note: "New critical finding" }));
  });

  it("confirms and cancels votes, records dissent, and reopens an active decision", async () => {
    window.history.replaceState({}, "", "/decisions?dataset=history&context=ctx-1");
    mocks.listDecisions.mockResolvedValue({ items: [decision], next_cursor: null, total: 1 });
    render(<ICBookWorkbench />);
    await screen.findByText(/2026-07-13/);
    fireEvent.click(tableRow(/2026-07-13/));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByText("Confirm approve vote?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Abstain" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm abstain" }));
    await waitFor(() => expect(mocks.vote).toHaveBeenCalledWith("decision-1", "abstain", undefined));

    fireEvent.change(screen.getByLabelText("Dissent rationale"), { target: { value: "Structure is too aggressive" } });
    fireEvent.click(screen.getByRole("button", { name: "Record dissent" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm dissent" }));
    await waitFor(() => expect(mocks.vote).toHaveBeenCalledWith("decision-1", "dissent", "Structure is too aggressive"));
    fireEvent.change(screen.getByLabelText("Trigger alert key"), { target: { value: " alert:issuer-1:material-change " } });
    fireEvent.click(screen.getByRole("button", { name: "Reopen for material change" }));
    await waitFor(() => expect(mocks.reopen).toHaveBeenCalledWith("decision-1", "alert:issuer-1:material-change"));
  });

  it("routes frozen portfolio sources back to the portfolio workbook", async () => {
    window.history.replaceState({}, "", "/decisions?dataset=history&context=ctx-1");
    mocks.listDecisions.mockResolvedValue({ items: [{ ...decision, snapshot: {
      context: { id: "ctx-1" },
      portfolio: { records: { id: "portfolio-snapshot-1", holdings: [{ id: "holding-1" }], constraints: [{ id: "constraint-1" }] } },
      authority: { source_ids: ["portfolio-1", "holding-1", "constraint-1"] },
    } }], next_cursor: null, total: 1 });
    render(<ICBookWorkbench />);
    await screen.findByText(/2026-07-13/);
    fireEvent.click(tableRow(/2026-07-13/));
    for (const id of ["portfolio-1", "holding-1", "constraint-1"]) {
      expect(screen.getByRole("link", { name: id }).getAttribute("href")).toContain(`/portfolios?portfolio=portfolio-1&selected=${id}&context=ctx-1`);
    }
  });

  it("recovers from empty agenda filters and opens the create form", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    window.history.replaceState({}, "", "/decisions?dataset=agenda&status=draft&context=ctx-1");
    mocks.listAgenda.mockResolvedValue({ items: [], next_cursor: null, total: 0 });
    const first = render(<ICBookWorkbench />);
    fireEvent.click(await screen.findByRole("button", { name: "Clear filters" }));
    expect(window.location.search).not.toContain("status=");
    first.unmount();

    window.history.replaceState({}, "", "/decisions?dataset=agenda&context=ctx-1");
    render(<ICBookWorkbench />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Add agenda item" }))[0]);
    expect((document.getElementById("ic-book-create") as HTMLDetailsElement).open).toBe(true);
  });

  it("paginates, filters status, and refreshes the register", async () => {
    mocks.listAgenda.mockResolvedValue({ items: [agenda], next_cursor: "cursor-2", total: 2 });
    render(<ICBookWorkbench />);
    await screen.findByRole("table", { name: "Committee agenda" });
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(window.location.search).toContain("cursor=cursor-2");
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "ready" } });
    expect(window.location.search).toContain("status=ready");
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(mocks.listAgenda.mock.calls.length).toBeGreaterThan(1));
  });

  it("surfaces catalog, run, opinion, and register failures", async () => {
    mocks.getIssuers.mockRejectedValue(new Error("issuer catalog offline"));
    mocks.listRuns.mockRejectedValue(new Error("runs offline"));
    mocks.listOpinions.mockRejectedValue(new Error("opinions offline"));
    mocks.listAgenda.mockRejectedValue(new Error("register offline"));
    render(<ICBookWorkbench />);
    expect(await screen.findByText("IC Book unavailable")).toBeTruthy();
    expect(screen.getAllByText("register offline").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Open Utilities" }));
    expect(await screen.findByText("issuer catalog offline")).toBeTruthy();
    expect(screen.getByText("runs offline")).toBeTruthy();
    expect(mocks.listOpinions).toHaveBeenCalledWith("issuer-1");
  });

  it("captures every create-form decision field and linked analyst view", async () => {
    mocks.listOpinions.mockResolvedValue({ current: null, items: [{ id: "opinion-create", issuer_id: "issuer-1", stance: "neutral", version: 2, evidence_state: "partial" }] });
    mocks.createAgenda.mockResolvedValue({ ...agenda, id: "agenda-created", status: "draft" });
    render(<ICBookWorkbench />);
    const form = await screen.findByRole("form", { name: "Add agenda item" });
    await waitFor(() => expect(within(form).getByRole("option", { name: /neutral · v2/ })).toBeTruthy());
    fireEvent.change(within(form).getByLabelText("Analyst view"), { target: { value: "opinion-create" } });
    fireEvent.change(within(form).getByLabelText("Run"), { target: { value: "" } });
    fireEvent.change(within(form).getByLabelText("Run"), { target: { value: "run-1" } });
    fireEvent.change(within(form).getByLabelText("Meeting time"), { target: { value: "2026-07-25T09:15" } });
    fireEvent.change(within(form).getByLabelText("Decision expiry"), { target: { value: "2027-02-28" } });
    fireEvent.change(within(form).getByLabelText("Recommendation"), { target: { value: "decline" } });
    fireEvent.change(within(form).getByLabelText("Conviction · 0–100%"), { target: { value: "81" } });
    fireEvent.change(within(form).getByLabelText("Thesis"), { target: { value: "Downside is not compensated." } });
    fireEvent.change(within(form).getByLabelText("Conditions · one per line"), { target: { value: "Deleveraging milestone\nSponsor support" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add agenda item" }));
    await waitFor(() => expect(mocks.createAgenda).toHaveBeenCalledWith(expect.objectContaining({
      analyst_opinion_version_id: "opinion-create", run_id: "run-1", expiry: "2027-02-28",
      recommendation: "decline", conviction: 81, conditions: ["Deleveraging milestone", "Sponsor support"],
    })));
  });

  it("summarizes reopened decisions without report links and sorts history", async () => {
    window.history.replaceState({}, "", "/decisions?dataset=history&context=ctx-1");
    const reopened = { ...decision, status: "reopened", report_id: null, report_version_id: null, reopened_at: "2026-07-15T10:00:00Z", reopen_alert_key: "alert:key" };
    mocks.listDecisions.mockResolvedValue({ items: [reopened], next_cursor: null, total: 1 });
    render(<ICBookWorkbench />);
    const table = await screen.findByRole("table", { name: "Decision history" });
    expect(within(table).getByText("reopened")).toBeTruthy();
    fireEvent.click(within(table).getByRole("button", { name: /Decision date/ }));
    expect(window.location.search).toContain("sort=created_at");
  });

  it("summarizes agenda items that lack linked runs", async () => {
    const unlinked = { ...agenda, id: "agenda-unlinked", run_id: null, status: "draft" };
    mocks.listAgenda.mockResolvedValue({ items: [unlinked, { ...unlinked, id: "agenda-unlinked-2" }], next_cursor: null, total: 2 });
    render(<ICBookWorkbench />);
    expect(await screen.findByRole("table", { name: "Committee agenda" })).toBeTruthy();
  });

  it("turns a failed refresh of an empty loaded register into an unavailable decision state", async () => {
    mocks.listAgenda.mockResolvedValueOnce({ items: [], next_cursor: null, total: 0 }).mockRejectedValueOnce(new Error("refresh unavailable"));
    render(<ICBookWorkbench />);
    await screen.findByText("No agenda items yet");
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("refresh unavailable")).toBeTruthy();
  });

  it("surfaces a rejected selected-row mutation and releases the busy state", async () => {
    const draft = { ...agenda, status: "draft", readiness_failures: [] };
    mocks.listAgenda.mockResolvedValue({ items: [draft], next_cursor: null, total: 1 });
    mocks.patchAgenda.mockRejectedValue(new Error("readiness mutation failed"));
    render(<ICBookWorkbench />);
    await screen.findByText(/2026-07-20/);
    fireEvent.click(tableRow(/2026-07-20/));
    fireEvent.click(screen.getByRole("button", { name: "Mark ready" }));
    expect(await screen.findByText("readiness mutation failed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mark ready" }).getAttribute("aria-disabled")).toBeNull();
  });
});
