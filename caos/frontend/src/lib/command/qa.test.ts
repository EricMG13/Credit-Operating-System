import { describe, it, expect } from "vitest";
import { liveFailedGates, liveQaItems } from "./qa";
import type { PortfolioRowDTO } from "@/lib/api";
import type { LatestQaFindingDTO } from "@/lib/engine/useQaFindings";

const row = (over: Partial<PortfolioRowDTO>): PortfolioRowDTO => ({
  issuer_id: "i1", name: "Atlas Forge", ticker: "ATLF", sector: "Industrials",
  run_id: "abcdef1234567890", qa_status: "Passed", committee_status: "Cleared",
  as_of: "2026-06-30", metrics: {}, rv_recommendation: null, rv_percentile: null,
  downside_fragility: null, gaps: [], ...over,
});

const finding = (over: Partial<LatestQaFindingDTO> = {}): LatestQaFindingDTO => ({
  id: "finding-pk", finding_id: "QA-101", run_id: "abcdef1234567890",
  issuer_id: "i1", issuer: "Atlas Forge", ticker: "ATLF", module_id: "CP-2B",
  severity: "MATERIAL", lane: 4, description: "Coverage basis is incomplete.",
  affected_claim_id: "C-2B-01", required_remediation: "Provide the missing debt schedule.",
  as_of: "2026-06-30", ...over,
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

  it("renders exact findings and suppresses the same run's coarse gate roll-up", () => {
    const items = liveQaItems(
      [row({ qa_status: "Blocked" })],
      [finding({ severity: "CRITICAL" })],
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "QA-101", module: "CP-2B", sev: "HIGH" });
    expect(items[0].text).toContain("Coverage basis is incomplete");
    expect(items[0].text).toContain("Provide the missing debt schedule");
    expect(items[0].text).not.toContain("CP-5 gate Blocked");
  });

  it("retains an explicit gate roll-up when the latest run has no finding rows", () => {
    const items = liveQaItems(
      [row({ qa_status: "Restricted" })],
      [finding({ run_id: "another-run", issuer_id: "i2" })],
    );
    expect(items.some((item) => item.text.includes("CP-5 gate Restricted"))).toBe(true);
  });

  it("does not duplicate a private exact finding with a newer institutional run roll-up", () => {
    const items = liveQaItems(
      [row({ run_id: "newer-shared-run", qa_status: "Blocked" })],
      [finding({ run_id: "older-private-run", issuer_id: "i1" })],
    );
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("QA-101");
  });

  it("falls back safely when an exact finding omits optional display fields", () => {
    const [item] = liveQaItems([], [finding({
      id: "1234567890abcdef",
      finding_id: "",
      ticker: null,
      issuer: "No Ticker Co",
      module_id: "",
      severity: "UNKNOWN",
      as_of: null,
      required_remediation: null,
    })]);

    expect(item).toEqual({
      id: "12345678",
      key: "1234567890abcdef",
      issuer: "No Ticker Co",
      module: "CP-5",
      sev: "LOW",
      age: "—",
      text: "Coverage basis is incomplete.",
    });
  });

  it("falls back to an em dash when a coarse gate row has no as-of date", () => {
    const [item] = liveQaItems([row({ qa_status: "Blocked", as_of: null })]);

    expect(item.age).toBe("—");
  });
});

describe("liveFailedGates", () => {
  it("returns only committee-only failures and sorts medium before low", () => {
    const items = liveFailedGates([
      row({ run_id: "blocked-run", qa_status: "Blocked", committee_status: "Draft Only" }),
      row({ run_id: "cleared-run", qa_status: "Passed", committee_status: "Cleared" }),
      row({
        run_id: "low-run-12345678",
        issuer_id: "low",
        ticker: "LOW",
        qa_status: "Passed",
        committee_status: "Insufficient Information",
      }),
      row({
        run_id: "medium-run-1234",
        issuer_id: "medium",
        ticker: null,
        name: "Medium Co",
        qa_status: "Passed",
        committee_status: "Draft Only",
        as_of: null,
      }),
    ]);

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.sev)).toEqual(["MEDIUM", "LOW"]);
    expect(items[0]).toMatchObject({
      id: "medium-r",
      issuer: "Medium Co",
      module: "CP-5",
      age: "—",
    });
    expect(items[0].text).toContain('committee status is "Draft Only"');
    expect(items[1]).toMatchObject({ id: "low-run-", issuer: "LOW", sev: "LOW" });
  });
});
