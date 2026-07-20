import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: mocks }));

import { analystOpinionsApi, type AnalystOpinionHistory, type AnalystOpinionVersion } from "./analyst-opinions";

const version: AnalystOpinionVersion = {
  id: "op-1", issuer_id: "iss-1", analyst_id: "analyst-1", version: 1,
  stance: "OVERWEIGHT", conviction: 4, rationale_md: "Supported thesis",
  evidence_state: "supported", unresolved_items: [], thesis_version_id: null,
  source_run_id: "run-1", context_id: null, analyst_link_ids: [],
  created_at: "2026-07-19T00:00:00Z",
};

describe("analystOpinionsApi", () => {
  it("unwraps list and create responses", async () => {
    const history: AnalystOpinionHistory = { current: version, items: [version] };
    mocks.get.mockResolvedValueOnce({ data: history });
    mocks.post.mockResolvedValueOnce({ data: version });

    await expect(analystOpinionsApi.list("iss-1")).resolves.toBe(history);
    await expect(analystOpinionsApi.create("iss-1", {
      stance: "OVERWEIGHT", conviction: 4, rationale_md: "Supported thesis", evidence_state: "supported",
    })).resolves.toBe(version);
    expect(mocks.get).toHaveBeenCalledWith("/api/issuers/iss-1/analyst-opinions");
    expect(mocks.post).toHaveBeenCalledWith("/api/issuers/iss-1/analyst-opinions", expect.objectContaining({ stance: "OVERWEIGHT" }));
  });
});
