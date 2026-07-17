import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/command/data", () => ({
  PORTFOLIO: [{
    code: "FALLBACK",
    borrower: "",
    name: "Fallback Name",
    sector: "Industrials",
  }],
}));

import { DEMO_UNIVERSE, issuerSector } from "@/lib/issuers";

describe("issuer fallback coverage", () => {
  it("falls back from an absent borrower and sector", () => {
    expect(DEMO_UNIVERSE[0]?.name).toBe("Fallback Name");
    expect(issuerSector({ sector: undefined, industry: "Software" })).toBe("Software");
    expect(issuerSector({ sector: undefined, industry: undefined })).toBe("");
  });
});
