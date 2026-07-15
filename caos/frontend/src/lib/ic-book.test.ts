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
});
