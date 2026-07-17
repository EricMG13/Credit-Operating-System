// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const sync = vi.hoisted(() => ({ active: null as string | null, setActive: vi.fn() }));
vi.mock("@/components/pipeline/atoms", () => ({
  Bar: ({ pct }: { pct: number }) => <span>bar {pct}</span>,
  Dot: ({ sev }: { sev: string }) => <span>dot {sev}</span>,
  Tag: ({ sev, children }: { sev: string; children: React.ReactNode }) => <span data-sev={sev}>{children}</span>,
}));
vi.mock("@/components/shared/Panel", () => ({ Panel: ({ title, children }: { title: string; children: React.ReactNode }) => <section><h2>{title}</h2>{children}</section> }));
vi.mock("@/components/shared/CollapseButton", () => ({ CollapseButton: ({ label, onClick }: { label: string; onClick: () => void }) => <button onClick={onClick}>{label}</button> }));
vi.mock("@/components/shared/RailShell", () => ({ RailShell: ({ collapsed, children, onToggle, expandTitle }: { collapsed: React.ReactNode; children: React.ReactNode; onToggle: () => void; expandTitle: string }) => <aside>{collapsed}<button onClick={onToggle}>{expandTitle}</button>{children}</aside> }));
vi.mock("@/lib/evidence-sync", () => ({ useEvidenceSync: () => sync }));

import { DRIVERS } from "@/lib/pipeline/data";
import { DEBATE } from "@/lib/reports/deal";
import { DecisionRail, SourceRail } from "./rails";

afterEach(() => {
  cleanup();
  sync.active = null;
  sync.setActive.mockReset();
});

describe("deep-dive rails", () => {
  it("renders the reference source register and synchronizes every driver interaction", () => {
    sync.active = DRIVERS[0]?.evs[0] ?? null;
    const toggle = vi.fn();
    render(<SourceRail ev={DRIVERS[1]?.evs[0] ?? null} open onToggle={toggle} />);
    expect(screen.getByText("Source Register · CP-0")).toBeTruthy();
    expect(screen.getByText("Evidence Trace · CP-5B drivers")).toBeTruthy();
    const driver = screen.getByLabelText(new RegExp(`Evidence for driver ${DRIVERS[0].n}`));
    fireEvent.mouseEnter(driver);
    fireEvent.mouseLeave(driver);
    fireEvent.focus(driver);
    fireEvent.blur(driver);
    expect(sync.setActive).toHaveBeenCalledWith(DRIVERS[0].evs[0]);
    expect(sync.setActive).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByRole("button", { name: "Collapse source rail" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand source rail" }));
    expect(toggle).toHaveBeenCalledTimes(2);
  });

  it("hides the seeded rail for non-reference issuers with and without an identifying code", () => {
    const { rerender } = render(<SourceRail ev={null} open onToggle={vi.fn()} isReference={false} issuerCode="LIVE" issuerName="Live Issuer" />);
    expect(screen.getByText(/not wired for LIVE/)).toBeTruthy();
    expect(screen.queryByText("Source Register · CP-0")).toBeNull();
    rerender(<SourceRail ev={null} open onToggle={vi.fn()} isReference={false} issuerCode="—" />);
    expect(screen.getByText(/not wired for this issuer/)).toBeTruthy();
  });

  it("renders and orders live committee findings while preserving the reference decision stack", () => {
    const council = [
      { finding_id: "b", lane: null, severity: "UNKNOWN", description: "Unknown lane", module_id: null, affected_claim_id: null, required_remediation: null },
      { finding_id: "a", lane: 2, severity: "CRITICAL", description: "Numerical issue", module_id: "CP-1", affected_claim_id: "claim-1", required_remediation: "Recalculate" },
      { finding_id: "c", lane: 3, severity: "MATERIAL", description: "Covenant issue", module_id: "CP-4", affected_claim_id: null, required_remediation: null },
      { finding_id: "d", lane: 4, severity: "MINOR", description: "Evidence issue", module_id: null, affected_claim_id: null, required_remediation: null },
      { finding_id: "e", lane: 5, severity: "MINOR", description: "Devil issue", module_id: null, affected_claim_id: null, required_remediation: null },
    ] as never;
    render(<DecisionRail open onToggle={vi.fn()} council={council} />);
    expect(screen.getByText("Numerical Consistency")).toBeTruthy();
    expect(screen.getByText("Covenant Construction")).toBeTruthy();
    expect(screen.getByText("Evidence Sufficiency")).toBeTruthy();
    expect(screen.getByText("Devil's Advocate")).toBeTruthy();
    expect(screen.getByText("Lane —")).toBeTruthy();
    expect(screen.getByText("claim claim-1")).toBeTruthy();
    expect(screen.getByText("→ Recalculate")).toBeTruthy();
    expect(screen.getByText("Sizing & Posture · CP-6E")).toBeTruthy();
    expect(screen.getByText("Triggers Armed → CP-MON")).toBeTruthy();
  });

  it("distinguishes committee loading, error, unavailable, and observed-empty states", () => {
    const { rerender } = render(<DecisionRail open onToggle={vi.fn()} councilState="loading" />);
    expect(screen.getByRole("status").textContent).toContain("Checking CP-5C");
    rerender(<DecisionRail open onToggle={vi.fn()} councilState="error" />);
    expect(screen.getByRole("alert").textContent).toContain("do not infer an all-clear");
    rerender(<DecisionRail open onToggle={vi.fn()} councilState="unavailable" />);
    expect(screen.getByRole("status").textContent).toContain("completed run is required");
    rerender(<DecisionRail open onToggle={vi.fn()} council={[]} councilState="ready" />);
    expect(screen.getByText(/No live committee findings/)).toBeTruthy();
  });

  it("renders the non-reference decision rail and a verdict without a qualifier", () => {
    const prior = DEBATE.bias;
    try {
      DEBATE.bias = "POSITIVE";
      const { rerender } = render(<DecisionRail open onToggle={vi.fn()} isReference={false} issuerCode="LIVE" />);
      expect(screen.getByText(/not wired for LIVE/)).toBeTruthy();
      expect(screen.queryByText("IC Verdict · CP-6A")).toBeNull();
      rerender(<DecisionRail open onToggle={vi.fn()} />);
      expect(screen.getByText("POSITIVE")).toBeTruthy();
      expect(screen.queryByText(/^—/)).toBeNull();
    } finally {
      DEBATE.bias = prior;
    }
  });
});
