// @vitest-environment jsdom
// Finding 8.2 (REVIEW_MATRIX_FRONTEND): a live Deep Research tear-sheet must
// carry an explicit AI-provenance line (house pattern, ReportDoc rd-foot), and
// /research must ship a body-level .print-root so EXPORT PDF (window.print())
// prints the sheet instead of a blank page (globals.css hides every other
// body child under @media print).
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// ReportBody loads react-markdown via next/dynamic; stub it so the pane
// renders synchronously — the footer + print sheet are what's under test.
vi.mock("next/dynamic", () => ({
  default: () => {
    const Stub = ({ report }: { report: string }) => <div>{report}</div>;
    return Stub;
  },
}));

import { ReportPane } from "./ReportPane";
import type { ResearchResult } from "@/lib/api";

afterEach(() => cleanup());

const base = {
  running: false,
  error: null,
  progress: null,
  criteria: [],
  elapsed: 0,
  subj: "Acme Corp",
  mode: "issuer" as const,
};

const live: ResearchResult = {
  report: "## Executive summary\nAcme leverage is 4.2x.",
  sources: [{ url: "https://example.com/10k", title: "Acme 10-K" }],
  demo: false,
};

describe("ReportPane result footer + print path", () => {
  it("renders an AI-synthesized provenance marker on a live report", () => {
    render(<ReportPane {...base} result={live} />);
    expect(screen.getAllByText(/AI-synthesized/i).length).toBeGreaterThan(0);
  });

  it("keeps the Illustrative · demo marker on the demo branch", () => {
    render(<ReportPane {...base} result={{ ...live, demo: true }} />);
    expect(screen.getAllByText(/Illustrative · demo/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/AI-synthesized/i)).toBeNull();
  });

  it("mounts a body-level .print-root print sheet carrying the report", () => {
    render(<ReportPane {...base} result={live} />);
    const roots = document.body.querySelectorAll(":scope > .print-root");
    expect(roots.length).toBe(1);
    const root = roots[0];
    expect(root.querySelector(".research-doc")).toBeTruthy();
    expect(root.textContent).toContain("Acme leverage is 4.2x.");
    expect(root.textContent).toMatch(/AI-synthesized/i);
  });

  it("mounts no print sheet without a result", () => {
    render(<ReportPane {...base} result={null} />);
    expect(document.body.querySelector(".print-root")).toBeNull();
  });

  // H1: a report the server cut off at the output limit must NOT file as a clean
  // committee tear-sheet — the truncation notice has to be on the sheet itself so
  // it survives PDF export, and the foot provenance must record it.
  it("surfaces the truncation notice on the sheet and in the print copy", () => {
    render(<ReportPane {...base} result={{ ...live, truncated: true }} />);
    // On-screen chip beside LIVE + the on-sheet integrity notice.
    expect(screen.getAllByText(/Truncated/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Incomplete/i).length).toBeGreaterThan(0);
    // Print sheet carries the notice + the TRUNCATED provenance tag.
    const root = document.body.querySelector(":scope > .print-root")!;
    expect(root.querySelector(".rdoc-truncated")).toBeTruthy();
    expect(root.textContent).toMatch(/TRUNCATED/);
  });

  it("shows no truncation notice on a complete report", () => {
    render(<ReportPane {...base} result={live} />);
    expect(screen.queryByText(/Incomplete/i)).toBeNull();
    expect(document.querySelector(".rdoc-truncated")).toBeNull();
  });
});
