import { describe, expect, it } from "vitest";

import { appendIngestionContext, buildRunCreatePayload } from "@/lib/api";

describe("lineage producer request contracts", () => {
  it("adds an active context to ingestion multipart data only when present", () => {
    const linked = appendIngestionContext(new FormData(), "context-1");
    const omitted = appendIngestionContext(new FormData());

    expect(linked.get("context_id")).toBe("context-1");
    expect(omitted.has("context_id")).toBe(false);
  });

  it("keeps run context optional while preserving the existing request shape", () => {
    expect(buildRunCreatePayload("issuer-1", "2026-07-13", "portfolio-1", "context-1"))
      .toEqual({
        issuer_id: "issuer-1",
        as_of_date: "2026-07-13",
        portfolio_id: "portfolio-1",
        context_id: "context-1",
      });
    expect(buildRunCreatePayload("issuer-1")).toEqual({
      issuer_id: "issuer-1",
      as_of_date: undefined,
      portfolio_id: undefined,
      context_id: undefined,
    });
  });
});
