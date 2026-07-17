// @vitest-environment jsdom
// Finding 8.2 (REVIEW_MATRIX_FRONTEND): a live Deep Research tear-sheet must
// carry an explicit AI-provenance line (house pattern, ReportDoc rd-foot), and
// /research must ship a body-level .print-root so EXPORT PDF (window.print())
// prints the sheet instead of a blank page (globals.css hides every other
// body child under @media print).
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";

// ReportBody loads react-markdown via next/dynamic; stub it so the pane
// renders synchronously — the footer + print sheet are what's under test.
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<unknown>) => {
    void loader();
    const Stub = ({ report }: { report: string }) => <div>{report}</div>;
    return Stub;
  },
}));

import { ReportPane } from "./ReportPane";
import type { ResearchResult } from "@/lib/api";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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
    // research-17: demo output is visibly distinguished from live research.
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

  it("exports a sector report, falls back to source URLs, handles no-source results, and removes the print portal", () => {
    // research-14: cited links use title-or-URL fallback and the no-source boundary
    // omits the source section without compromising export cleanup.
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const result: ResearchResult = {
      ...live,
      sources: [
        { url: "https://example.com/blank-title", title: "" },
        { url: "https://example.com/rating", title: "Rating action" },
      ],
    };
    const { rerender, unmount } = render(<ReportPane {...base} mode="sector" result={result} />);

    expect(screen.getAllByText(/Sector ·/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "https://example.com/blank-title" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/AI-synthesized · 2 sources/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "EXPORT PDF" }));
    expect(print).toHaveBeenCalledTimes(1);

    rerender(<ReportPane {...base} result={{ ...live, sources: [] }} />);
    expect(screen.queryByText(/Sources \(/)).toBeNull();
    expect(screen.getAllByText(/AI-synthesized · 0 sources/).length).toBeGreaterThan(0);

    unmount();
    expect(document.body.querySelector(".print-root")).toBeNull();
  });
});

describe("ReportPane running, error, and empty states", () => {
  it("shows real running progress, criteria, phase, elapsed time, and detach", () => {
    // research-28: the running view exposes server-supplied source/search counts
    // and the analyst's criteria without fabricating per-criterion completion.
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    const onDetach = vi.fn();
    const { rerender } = render(
      <ReportPane
        {...base}
        running
        result={null}
        elapsed={80}
        progress={{ sources: 1, searches: 1 } as never}
        criteria={["Check leverage", "Review maturities"]}
        onDetach={onDetach}
      />,
    );

    expect(screen.getByText("1:20")).toBeTruthy();
    expect(screen.getByText(/Synthesizing the credit view/)).toBeTruthy();
    expect(screen.getByText("“Acme Corp”")).toBeTruthy();
    expect(screen.getByText("source")).toBeTruthy();
    expect(screen.getByText("search")).toBeTruthy();
    expect(screen.getByText("Check leverage")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Detach" }));
    expect(onDetach).toHaveBeenCalledTimes(1);

    rerender(
      <ReportPane
        {...base}
        running
        result={null}
        subj=""
        elapsed={0}
        progress={null}
        criteria={[]}
      />,
    );
    expect(screen.getByText("0:00")).toBeTruthy();
    expect(screen.getByText("Reattached run")).toBeTruthy();
    expect(screen.getByText(/Searching sources/)).toBeTruthy();
    expect(screen.getByText("sources")).toBeTruthy();
    expect(screen.getByText("searches")).toBeTruthy();
    expect(screen.getByText(/standard credit criteria/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Detach" })).toBeNull();
  });

  it("animates count increases without exceeding server progress and cancels in-flight frames on unmount", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    vi.spyOn(performance, "now").mockReturnValue(0);
    let id = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    const request = vi.fn((callback: FrameRequestCallback) => {
      callbacks.set(++id, callback);
      return id;
    });
    const cancel = vi.fn((frameId: number) => callbacks.delete(frameId));
    vi.stubGlobal("requestAnimationFrame", request);
    vi.stubGlobal("cancelAnimationFrame", cancel);

    const { container, rerender, unmount } = render(
      <ReportPane {...base} running result={null} progress={{ sources: 1, searches: 1 } as never} />,
    );
    rerender(<ReportPane {...base} running result={null} progress={{ sources: 3, searches: 2 } as never} />);

    act(() => {
      const first = [...callbacks.values()];
      callbacks.clear();
      first.forEach((callback) => callback(350));
    });
    const mid = [...container.querySelectorAll(".tabular-nums")].map((node) => Number(node.textContent));
    expect(mid[0]).toBeGreaterThanOrEqual(1);
    expect(mid[0]).toBeLessThanOrEqual(3);
    expect(mid[1]).toBeGreaterThanOrEqual(1);
    expect(mid[1]).toBeLessThanOrEqual(2);

    act(() => {
      const last = [...callbacks.values()];
      callbacks.clear();
      last.forEach((callback) => callback(700));
    });
    expect([...container.querySelectorAll(".tabular-nums")].map((node) => node.textContent)).toEqual(["3", "2"]);

    rerender(<ReportPane {...base} running result={null} progress={{ sources: 4, searches: 3 } as never} />);
    expect(callbacks.size).toBe(2);
    unmount();
    expect(cancel).toHaveBeenCalled();
  });

  it("restores a previous report after failure and omits the action without one", () => {
    const onRestorePrev = vi.fn();
    const { rerender } = render(
      <ReportPane {...base} result={null} error="Timed out." prevResult={live} onRestorePrev={onRestorePrev} />,
    );
    expect(screen.getByText("Research failed")).toBeTruthy();
    expect(screen.getByText(/Timed out\. Adjust the brief and run again\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View previous report" }));
    expect(onRestorePrev).toHaveBeenCalledTimes(1);

    rerender(<ReportPane {...base} result={null} error="Still unavailable." prevResult={null} onRestorePrev={onRestorePrev} />);
    expect(screen.queryByRole("button", { name: "View previous report" })).toBeNull();
  });

  it("previews the complete deliverable manifest before a run", () => {
    render(<ReportPane {...base} result={null} />);
    expect(screen.getByText("No report yet")).toBeTruthy();
    expect(screen.getByText("Executive summary")).toBeTruthy();
    expect(screen.getByText("Detailed findings")).toBeTruthy();
    expect(screen.getByText("Summary tables")).toBeTruthy();
    expect(screen.getByText("Recommendations")).toBeTruthy();
    expect(screen.getByText("04")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "EXPORT PDF" })).toBeNull();
  });
});
