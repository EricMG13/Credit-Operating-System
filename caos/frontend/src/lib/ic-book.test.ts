import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post, patch } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ api: { get, post, patch } }));

import { icBookApi } from "./ic-book";

describe("icBookApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps agenda filters and cursor in the request", async () => {
    get.mockResolvedValue({ data: { items: [], next_cursor: null, total: 0 } });
    await icBookApi.listAgenda({ status: "ready", cursor: "next", direction: "asc" });
    expect(get).toHaveBeenCalledWith("/api/committee/agenda", {
      params: { status: "ready", cursor: "next", direction: "asc" },
    });
  });

  it("sends optimistic revision when patching and finalizes through the atomic endpoint", async () => {
    patch.mockResolvedValue({ data: { id: "agenda-1" } });
    post.mockResolvedValue({ data: { agenda: { id: "agenda-1" }, decision: { id: "decision-1" } } });
    await icBookApi.patchAgenda("agenda-1", { expected_revision: 4, thesis: "Updated" });
    await icBookApi.finalizeAgenda("agenda-1", 5);
    expect(patch).toHaveBeenCalledWith("/api/committee/agenda/agenda-1", { expected_revision: 4, thesis: "Updated" });
    expect(post).toHaveBeenCalledWith("/api/committee/agenda/agenda-1/finalize", { expected_revision: 5 });
  });

  it("opts into the paginated IC Book decision contract without changing legacy clients", async () => {
    get.mockResolvedValue({ data: { items: [], next_cursor: null, total: 0 } });
    await icBookApi.listDecisions({ status: "active", limit: 25 });
    expect(get).toHaveBeenCalledWith("/api/decisions", {
      params: { book: true, status: "active", limit: 25 },
    });
  });

  it("covers agenda detail, creation, and the full evidence-exception lifecycle", async () => {
    get.mockResolvedValue({ data: { id: "agenda-1" } });
    post.mockImplementation((url: string) => Promise.resolve({ data: { id: url.includes("exceptions/") ? "exception-1" : "agenda-1" } }));

    await expect(icBookApi.getAgenda("agenda-1")).resolves.toEqual({ id: "agenda-1" });
    await icBookApi.createAgenda({
      issuer_id: "issuer-1",
      scheduled_for: "2026-07-20T10:00:00Z",
      recommendation: "approve",
      thesis: "Defensible downside.",
    });
    await icBookApi.requestException("agenda-1", {
      expected_revision: 2,
      rationale: "Source pending after committee cutoff.",
      mitigants: ["Size at half risk"],
      expires_at: "2026-07-21T10:00:00Z",
    });
    await icBookApi.reviewException("exception-1", { expected_revision: 3, decision: "approve", review_note: "Accepted" });
    await icBookApi.revokeException("exception-1", { expected_revision: 4, review_note: "Source arrived" });

    expect(post).toHaveBeenCalledWith("/api/committee/agenda", expect.objectContaining({ issuer_id: "issuer-1" }));
    expect(post).toHaveBeenCalledWith("/api/committee/agenda/agenda-1/exceptions", expect.objectContaining({ expected_revision: 2 }));
    expect(post).toHaveBeenCalledWith("/api/committee/exceptions/exception-1/review", expect.objectContaining({ decision: "approve" }));
    expect(post).toHaveBeenCalledWith("/api/committee/exceptions/exception-1/revoke", expect.objectContaining({ expected_revision: 4 }));
  });

  it("covers decision detail, voting, reopening, and default list filters", async () => {
    get.mockResolvedValue({ data: { id: "decision-1" } });
    post.mockResolvedValue({ data: { id: "decision-1" } });

    await icBookApi.listAgenda();
    await icBookApi.listDecisions();
    await expect(icBookApi.getDecision("decision-1")).resolves.toEqual({ id: "decision-1" });
    await icBookApi.vote("decision-1", "dissent", "Leverage is understated.");
    await icBookApi.vote("decision-1", "approve");
    await icBookApi.reopen("decision-1", "alert-99");

    expect(get).toHaveBeenCalledWith("/api/committee/agenda", { params: {} });
    expect(get).toHaveBeenCalledWith("/api/decisions", { params: { book: true } });
    expect(post).toHaveBeenCalledWith("/api/decisions/decision-1/votes", { vote: "dissent", dissent_note: "Leverage is understated." });
    expect(post).toHaveBeenCalledWith("/api/decisions/decision-1/votes", { vote: "approve", dissent_note: undefined });
    expect(post).toHaveBeenCalledWith("/api/decisions/decision-1/reopen", { trigger_alert_key: "alert-99" });
  });
});
