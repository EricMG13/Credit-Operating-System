// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AuthorityBlock } from "./AuthorityBlock";

afterEach(cleanup);

describe("AuthorityBlock", () => {
  it("reference (fixture only): ORIGIN REFERENCE, METHOD MODELLED", () => {
    render(<AuthorityBlock caveatKind="reference" liveRunBacked={false} />);
    expect(screen.getByText(/ORIGIN: REFERENCE/)).toBeTruthy();
    expect(screen.getByText(/METHOD: MODELLED/)).toBeTruthy();
  });

  it("reference + live-run-backed (FE-5): still ORIGIN REFERENCE — bespoke tabs stay fixture", () => {
    render(<AuthorityBlock caveatKind="reference" liveRunBacked={true} runId="r-4821abcd" />);
    expect(screen.getByText(/ORIGIN: REFERENCE/)).toBeTruthy();
    expect(screen.getByText(/RUN: r-4821ab/)).toBeTruthy();
  });

  it("live: ORIGIN LIVE, METHOD DERIVED — never the blanket 'not live' claim", () => {
    render(<AuthorityBlock caveatKind="live" liveRunBacked={true} runId="r-99990000" qaNote="COMMITTEE: conditional" />);
    expect(screen.getByText(/ORIGIN: LIVE/)).toBeTruthy();
    expect(screen.getByText(/METHOD: DERIVED/)).toBeTruthy();
    expect(screen.getByText(/COMMITTEE: conditional/)).toBeTruthy();
    expect(screen.queryByText(/not a live issuer run/i)).toBeNull();
  });

  it("loading/error/noRun: honest ORIGIN UNKNOWN — never a fabricated origin", () => {
    const { rerender } = render(<AuthorityBlock caveatKind="loading" liveRunBacked={false} />);
    expect(screen.getByText(/ORIGIN: UNKNOWN — checking/)).toBeTruthy();

    rerender(<AuthorityBlock caveatKind="error" liveRunBacked={false} />);
    expect(screen.getByText(/ORIGIN: UNKNOWN — could not confirm/)).toBeTruthy();

    rerender(<AuthorityBlock caveatKind="noRun" liveRunBacked={false} />);
    expect(screen.getByText(/ORIGIN: UNKNOWN — no completed run/)).toBeTruthy();
  });

  it.each(["DUE", "STALE", "UNKNOWN"] as const)("prints %s freshness without losing reference limitations", (freshness) => {
    render(<AuthorityBlock caveatKind="reference" liveRunBacked freshness={freshness} freshnessDetail="central run policy" />);
    const block = screen.getByRole("note");
    expect(block.textContent).toContain(`FRESHNESS: ${freshness}`);
    expect(block.getAttribute("title")).toContain("Reference template");
    expect(block.getAttribute("title")).toContain("central run policy");
  });
});
