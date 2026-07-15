import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/lib/api", () => ({ api: { get, post } }));

import { portfolioLabApi } from "./portfolio-lab";

describe("Portfolio Lab API", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  it("uses allow-listed position params and carries the opaque cursor", async () => {
    get.mockResolvedValue({ data: { items: [], total: 0, next_cursor: null } });
    await portfolioLabApi.getPositions("book-1", {
      limit: 100,
      cursor: "opaque",
      sort: "par_usd",
      direction: "desc",
      text: "alpha",
      sector: "Software",
      rating: "B2",
      ranking: "1L",
    });
    expect(get).toHaveBeenCalledWith("/api/portfolios/book-1/positions", {
      params: expect.objectContaining({ cursor: "opaque", sort: "par_usd", direction: "desc" }),
    });
  });

  it("loads deterministic analytics and stress history", async () => {
    get.mockResolvedValue({ data: {} });
    await portfolioLabApi.getAnalytics("book-1", "2026-06-30");
    await portfolioLabApi.listStressRuns("book-1", 25);
    expect(get).toHaveBeenNthCalledWith(1, "/api/portfolios/book-1/analytics", { params: { as_of: "2026-06-30" } });
    expect(get).toHaveBeenNthCalledWith(2, "/api/portfolios/book-1/stress-runs", { params: { limit: 25 } });
  });

  it("persists only confirmed stress inputs", async () => {
    const input = { label: "Base downside", book_price_shock_pct: -8, sector_shock_pcts: { Software: -12 } };
    post.mockResolvedValue({ data: { id: "stress-1" } });
    await portfolioLabApi.createStressRun("book-1", input);
    expect(post).toHaveBeenCalledWith("/api/portfolios/book-1/stress-runs", input);
  });
});
