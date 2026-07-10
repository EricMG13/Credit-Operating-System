import { describe, it, expect } from "vitest";
import { liveQaItems } from "./qa";
import type { PortfolioRowDTO } from "@/lib/api";

const row = (over: Partial<PortfolioRowDTO>): PortfolioRowDTO => ({
  issuer_id: "i1", name: "Atlas Forge", ticker: "ATLF", sector: "Industrials",
  run_id: "abcdef1234567890", qa_status: "Passed", committee_status: "Cleared",
  as_of: "2026-06-30", metrics: {}, rv_recommendation: null, rv_percentile: null,
  downside_fragility: null, ...over,
});

describe("liveQaItems", () => {
  it("keeps only gated runs (Blocked/Restricted), drops cleared ones as CP-5 items", () => {
    const items = liveQaItems([
      row({ qa_status: "Passed" }),
      row({ qa_status: "Not Reviewed" }),
      row({ qa_status: "Restricted" }),
      row({ qa_status: "Blocked" }),
    ]);
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.module === "CP-5")).toBe(true);
  });

  it("maps gate verdict to severity and sorts HIGH (Blocked) before MEDIUM (Restricted)", () => {
    const items = liveQaItems([
      row({ issuer_id: "a", qa_status: "Restricted", ticker: "AAA" }),
      row({ issuer_id: "b", qa_status: "Blocked", ticker: "BBB" }),
    ]);
    expect(items.map((i) => i.sev)).toEqual(["HIGH", "MEDIUM"]);
    expect(items[0].issuer).toBe("BBB");
  });

  it("uses ticker then name; short run id; surfaces the committee verdict in text", () => {
    const [i] = liveQaItems([
      row({ qa_status: "Blocked", ticker: null, name: "No Ticker Co", committee_status: "Draft Only", run_id: "deadbeefcafe" }),
    ]);
    expect(i.issuer).toBe("No Ticker Co");
    expect(i.id).toBe("deadbeef");
    expect(i.text).toContain("CP-5 gate Blocked");
    expect(i.text).toContain("committee Draft Only");
  });

  it("is empty for no rows or an all-cleared portfolio (a real 'queue clear')", () => {
    expect(liveQaItems([])).toEqual([]);
    expect(liveQaItems([row({ qa_status: "Passed" })])).toEqual([]);
  });
});
