import { beforeEach, describe, expect, it, vi } from "vitest";

const { downloadCsv, get, post } = vi.hoisted(() => ({
  downloadCsv: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: { get, post } }));
vi.mock("@/lib/csv", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/csv")>(),
  downloadCsv,
}));

import { portfolioLabApi } from "@/lib/portfolio-lab";
import { downloadQueryCsv } from "@/lib/query/export";
import type { GraphResult } from "@/lib/query/graph";

describe("API coverage edges", () => {
  beforeEach(() => {
    downloadCsv.mockReset();
    get.mockReset().mockResolvedValue({ data: { ok: true } });
    post.mockReset();
  });

  it("loads the command snapshot and analytics without an as-of filter", async () => {
    await expect(portfolioLabApi.getCommandSnapshot("book-1")).resolves.toEqual({ ok: true });
    await expect(portfolioLabApi.getAnalytics("book-1")).resolves.toEqual({ ok: true });
    expect(get).toHaveBeenNthCalledWith(1, "/api/portfolios/book-1/command");
    expect(get).toHaveBeenNthCalledWith(2, "/api/portfolios/book-1/analytics", { params: {} });
  });

  it("downloads a sanitized query CSV filename", () => {
    const graph: GraphResult = {
      capability_id: "trace",
      mode: "trace",
      title: "Issuer / source trace",
      nodes: [],
      edges: [],
      meta: [],
      caveats: [],
    };
    downloadQueryCsv(graph);
    expect(downloadCsv).toHaveBeenCalledWith(
      "CAOS Query - Issuer_source_trace.csv",
      expect.stringContaining("CAOS Query"),
    );
  });
});
