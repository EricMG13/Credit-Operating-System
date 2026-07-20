import { describe, expect, it } from "vitest";
import { DEMO_UNIVERSE } from "./issuer-demo";
import { issuerProfileHref, issuerRating, issuerSearchHref, issuerSector, ratingDistressed } from "./issuers";
import type { Issuer } from "@/types/issuers";

describe("issuer helpers", () => {
  it("prefers sector while retaining legacy industry fallback", () => {
    expect(issuerSector({ sector: "Healthcare", industry: "Industrials" } as Issuer)).toBe("Healthcare");
    expect(issuerSector({ industry: "Industrials" } as Issuer)).toBe("Industrials");
  });

  it("builds profile and directory-search links", () => {
    expect(issuerProfileHref({ id: "iss-1" } as Issuer)).toBe("/issuers/profile?id=iss-1");
    expect(issuerProfileHref({ id: "issuer / one" } as Issuer)).toBe("/issuers/profile?id=issuer%20%2F%20one");
    expect(issuerSearchHref("Atlas Forge")).toBe("/issuers?q=Atlas%20Forge");
  });

  it("rating shows the first agency on file, flagging distress by letter (not color alone)", () => {
    expect(issuerRating({ rating_sp: "B+", rating_moody: "B1" } as Issuer)).toBe("B+");
    expect(issuerRating({ rating_moody: "Caa1" } as Issuer)).toBe("Caa1"); // no S&P → Moody's
    expect(issuerRating({} as Issuer)).toBe("");
    // distressed = the whole CCC/Caa-and-below set: everything starting C or D
    ["CCC+", "CC", "C", "D", "Caa1", "Ca"].forEach((r) => expect(ratingDistressed(r)).toBe(true));
    // healthy: BB/B/Baa/A and up must NOT be flagged (B starts neither C nor D)
    ["BB-", "B", "B3", "Baa2", "BBB", "AA", ""].forEach((r) => expect(ratingDistressed(r)).toBe(false));
  });

  it("demo universe is one row per issuer with unique ids (PORTFOLIO holds tranches)", () => {
    const ids = DEMO_UNIVERSE.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEMO_UNIVERSE.length).toBeGreaterThan(0);
  });
});
