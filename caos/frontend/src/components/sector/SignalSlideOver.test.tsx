// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SignalSlideOver } from "./SignalSlideOver";
import type { SectorSignal } from "@/lib/api";

afterEach(cleanup);

vi.mock("@/components/shared/IssuerLink", () => ({
  IssuerLink: ({ children, query, className }: { children: React.ReactNode; query?: string; className?: string }) => (
    <a href={`/issuers/profile?q=${query || ""}`} className={className}>{children}</a>
  ),
}));

const signal: SectorSignal = {
  id: "seed-industrials-2026-07-06-01",
  sector: "Industrials",
  signal_date: "2026-07-06T10:15:00Z",
  category: "earnings",
  severity: "high",
  headline: "Q2 order books soften",
  summary: "Distributor commentary points to slower short-cycle demand.",
  materiality_score: 0.9,
  issuers: [{ name: "Atlas Forge Industrials", ticker: "ATLF", exposure: "held" }],
  sources: [{ source_type: "seed", ref: "seed://x", title: "Seed source", tier: "seed", provenance: "seed" }],
  provenance: "seed",
  staleness_flag: "seed",
  confidence: "fixture",
};

describe("SignalSlideOver", () => {
  it("shows the full detail the old inline card used to render: severity, summary, issuers, sources, provenance", () => {
    render(<SignalSlideOver signal={signal} onClose={() => {}} onAskTopic={() => {}} />);

    expect(screen.getByRole("dialog", { name: "Q2 order books soften" })).toBeTruthy();
    expect(screen.getByText("high")).toBeTruthy();
    expect(screen.getByText("Earnings / Industrials")).toBeTruthy();
    expect(screen.getByText("Distributor commentary points to slower short-cycle demand.")).toBeTruthy();
    expect(screen.getByText("Score 90")).toBeTruthy();
    expect(screen.getByText("ATLF / held")).toBeTruthy();
    // Sources render as a chip using the shared source_type / tier grammar.
    expect(screen.getByText("seed / seed")).toBeTruthy();
    // Seeded provenance renders through the shared grammar chip (DEMO).
    expect(screen.getByText("DEMO")).toBeTruthy();
  });

  it("Ask Topic hands the signal back to the caller", () => {
    const onAskTopic = vi.fn();
    render(<SignalSlideOver signal={signal} onClose={() => {}} onAskTopic={onAskTopic} />);

    fireEvent.click(screen.getByRole("button", { name: "Ask Topic" }));
    expect(onAskTopic).toHaveBeenCalledWith(signal);
  });

  it("closes on the close button and on Escape", () => {
    const onClose = vi.fn();
    render(<SignalSlideOver signal={signal} onClose={onClose} onAskTopic={() => {}} />);

    fireEvent.click(screen.getByTitle("Close (Esc)"));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("renders a fallback when a signal has no issuers or sources", () => {
    const bare: SectorSignal = { ...signal, issuers: [], sources: [] };
    render(<SignalSlideOver signal={bare} onClose={() => {}} onAskTopic={() => {}} />);
    expect(screen.getByText("No linked issuers.")).toBeTruthy();
    expect(screen.getByText("No cited sources.")).toBeTruthy();
  });
});
