import { describe, expect, it } from "vitest";
import { DEMO_UNIVERSE, issuerProfileHref, issuerSearchHref, issuerSector } from "./issuers";
import type { Issuer } from "@/types/issuers";

describe("issuer helpers", () => {
  it("prefers sector while retaining legacy industry fallback", () => {
    expect(issuerSector({ sector: "Healthcare", industry: "Industrials" } as Issuer)).toBe("Healthcare");
    expect(issuerSector({ industry: "Industrials" } as Issuer)).toBe("Industrials");
  });

  it("builds profile and directory-search links", () => {
    expect(issuerProfileHref({ id: "iss-1" } as Issuer)).toBe("/issuers/profile?id=iss-1");
    expect(issuerSearchHref("Atlas Forge")).toBe("/issuers?q=Atlas%20Forge");
  });

  it("demo universe is one row per issuer with unique ids (PORTFOLIO holds tranches)", () => {
    const ids = DEMO_UNIVERSE.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEMO_UNIVERSE.length).toBeGreaterThan(0);
  });
});
