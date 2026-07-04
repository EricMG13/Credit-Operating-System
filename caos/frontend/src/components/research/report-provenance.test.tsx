// @vitest-environment jsdom
//
// Regression for matrix 8.2 (no-AI-marker): a LIVE Deep Research report is
// free-form LLM synthesis and must say so — on the panel badge AND on the
// document itself (the footer travels with the print portal, so the exported
// PDF carries it too). Demo reports keep "Illustrative · demo". Also pins the
// /research print path: without a body-level .print-root the global print rule
// hid everything and EXPORT PDF produced blank pages.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ResearchResult } from "@/lib/api";

// Stub the markdown body — it loads via next/dynamic and its async import can
// resolve after environment teardown; the provenance chrome under test does not
// depend on it.
vi.mock("./ReportBody", () => ({ default: ({ report }: { report: string }) => <div>{report}</div> }));

import { ReportPane } from "./ReportPane";

beforeEach(cleanup);

const LIVE: ResearchResult = {
  report: "## Executive summary\nCredit view.",
  sources: [{ title: "10-K", url: "https://example.com/10k" }],
  demo: false,
};

function pane(result: ResearchResult) {
  return render(
    <ReportPane
      running={false}
      error={null}
      result={result}
      progress={null}
      criteria={[]}
      elapsed={0}
      subj="ATLF"
      mode="issuer"
    />,
  );
}

describe("Deep Research provenance (matrix 8.2)", () => {
  it("live report carries the AI-synthesized marker on badge and document footer", () => {
    pane(LIVE);
    // badge chip + on-screen footer + print-portal footer
    expect(screen.getAllByText(/AI-synthesized/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/Illustrative · demo/)).toBeNull();
  });

  it("mounts a body-level print root so EXPORT PDF prints the sheet, not blank pages", () => {
    pane(LIVE);
    const roots = document.querySelectorAll("body > .print-root");
    expect(roots.length).toBe(1);
    expect(roots[0].textContent).toMatch(/AI-synthesized/i);
    expect(roots[0].textContent).toContain("Deep Credit Research");
  });

  it("demo report stays labeled illustrative, never AI-synthesized-live", () => {
    pane({ ...LIVE, demo: true });
    expect(screen.getAllByText(/Illustrative · demo/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("DEMO")).toBeTruthy();
    expect(screen.queryByText(/AI-synthesized ·/)).toBeNull();
  });
});
