import { describe, expect, it } from "vitest";
import { issuerProfileHref, issuerSearchHref, issuerSector } from "./issuers";
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
});
