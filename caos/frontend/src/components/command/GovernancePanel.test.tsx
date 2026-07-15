// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { GovernancePanel } from "./GovernancePanel";

afterEach(cleanup);

describe("GovernancePanel", () => {
  it("renders all three categories: QA queue, source gaps, and the NEW stale-sources column", () => {
    render(
      <GovernancePanel
        liveQa={[{ id: "QA-1", issuer: "ATLF", module: "CP-5", sev: "HIGH", age: "1h", text: "gate failed" }]}
        liveGaps={[{ issuer: "QLMH", doc: "Financials", impact: "degraded", sev: "high", requested: "Jul 01" }]}
        staleRows={[{ issuer_id: "eg", name: "EG Group", detail: "last run 14d ago" }]}
      />,
    );
    expect(screen.getByText("QA Queue · CP-5 open findings")).toBeTruthy();
    expect(screen.getByText("Source Gaps · CP-0 gap log")).toBeTruthy();
    expect(screen.getByText("Stale Sources · digest watch")).toBeTruthy();
    expect(screen.getByText("gate failed")).toBeTruthy();
    expect(screen.getByText("Financials")).toBeTruthy();
    expect(screen.getByText("EG Group")).toBeTruthy();
    expect(screen.getByText("last run 14d ago")).toBeTruthy();
  });

  it("stale-sources column shows an honest all-clear when empty", () => {
    render(<GovernancePanel liveQa={[]} liveGaps={[]} staleRows={[]} />);
    expect(screen.getByText(/No stale sources/)).toBeTruthy();
  });
});
