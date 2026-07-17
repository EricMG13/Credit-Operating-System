// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/components/reports/EvidenceModal", () => ({ EvChip: ({ id, onOpen }: { id: string; onOpen: (id: string) => void }) => <button onClick={() => onOpen(id)}>evidence {id}</button> }));
vi.mock("@/components/pipeline/atoms", () => ({ Dot: ({ sev }: { sev: string }) => <span>dot {sev}</span>, Tag: ({ children }: { children: React.ReactNode }) => <span>tag {children}</span> }));
vi.mock("@/components/shared/StatCard", () => ({ StatCard: ({ value, label }: { value: React.ReactNode; label: string }) => <div>{label}: {value}</div> }));
vi.mock("@/components/shared/SectionHeader", () => ({ SectionHeader: ({ title, right }: { title: React.ReactNode; right?: React.ReactNode }) => <header>{title}{right}</header> }));
vi.mock("@/components/charts/SemanticVisualization", () => ({ SemanticVisualization: ({ spec }: { spec: { title: string } }) => <div>chart {spec.title}</div> }));
vi.mock("./OutSections", () => ({ OutSections: ({ sections }: { sections: unknown[] }) => <div>out sections {sections.length}</div> }));
vi.mock("./OutputRegister", () => ({
  LiveOutputRegister: ({ id }: { id: string }) => <div>live register {id}</div>,
  OutputRegister: ({ id }: { id: string }) => <div>output register {id}</div>,
  StepOutputGrid: ({ id, mode }: { id: string; mode: string }) => <div>step grid {id} {mode}</div>,
}));
vi.mock("./ModuleCharts", () => ({ ModuleCharts: ({ id }: { id: string }) => <div>module charts {id}</div> }));

import { MODULE_OUTPUTS } from "@/lib/deepdive/module-outputs";
import { MODULES } from "@/lib/pipeline/data";
import { CovenantsTab, DebateTab, ModuleView, RecoveryTab } from "./tabs";

afterEach(cleanup);

describe("deep-dive bespoke tabs", () => {
  it("renders both debate variants in summary and report layouts", () => {
    const openEvidence = vi.fn();
    const { rerender } = render(<DebateTab onOpenEvidence={openEvidence} />);
    expect(screen.getByText(/Evidence Weighting & Resolution Matrix/)).toBeTruthy();
    const evidence = screen.queryAllByRole("button", { name: /evidence/ })[0];
    if (evidence) fireEvent.click(evidence);
    rerender(<DebateTab onOpenEvidence={openEvidence} variant="CP-6E" layout="summary" />);
    expect(screen.getByText(/CIO ruling/i)).toBeTruthy();
    rerender(<DebateTab onOpenEvidence={openEvidence} variant="CP-6E" />);
    expect(screen.getByText(/Allocation Weighting & Decision Matrix/)).toBeTruthy();
  });

  it("renders recovery and covenant analysis at every density", () => {
    const openEvidence = vi.fn();
    const { rerender } = render(<RecoveryTab onOpenEvidence={openEvidence} />);
    expect(screen.getByText(/Recovery waterfall by tranche and scenario/)).toBeTruthy();
    expect(screen.getByText(/2L TL recovery sensitivity/)).toBeTruthy();
    rerender(<RecoveryTab onOpenEvidence={openEvidence} layout="summary" />);
    expect(screen.getByText(/Instrument preference/)).toBeTruthy();

    rerender(<CovenantsTab onOpenEvidence={openEvidence} />);
    expect(screen.getAllByText(/Covenant aggressiveness/).length).toBeGreaterThan(0);
    const covenantRows = screen.getAllByRole("button").filter((button) => button.hasAttribute("aria-expanded"));
    expect(covenantRows.length).toBeGreaterThan(1);
    fireEvent.click(covenantRows[1]);
    fireEvent.click(covenantRows[1]);
    rerender(<CovenantsTab onOpenEvidence={openEvidence} layout="summary" />);
    expect(screen.getByText(/Covenant aggressiveness.*7.2 \/ 10/)).toBeTruthy();
  });

  it("renders missing, seeded, and live module states across layouts", () => {
    const onOpenEvidence = vi.fn();
    const sim = { mods: {} } as never;
    const seededId = Object.keys(MODULE_OUTPUTS).find((id) => MODULES.some((module) => module.id === id))!;
    const infra = MODULES.find((module) => module.layer === "INFRA" && !MODULE_OUTPUTS[module.id]);
    const analyticalMissing = MODULES.find((module) => module.layer !== "INFRA" && !MODULE_OUTPUTS[module.id]);

    const { rerender } = render(<ModuleView id="UNKNOWN" sim={sim} onOpenEvidence={onOpenEvidence} />);
    expect(screen.getByText(/not part of the CP-X route graph/)).toBeTruthy();

    if (infra) {
      rerender(<ModuleView id={infra.id} sim={sim} onOpenEvidence={onOpenEvidence} />);
      expect(screen.getByRole("link", { name: /OPEN REPORT STUDIO/ }).getAttribute("href")).toBe("/reports");
    }
    if (analyticalMissing) {
      rerender(<ModuleView id={analyticalMissing.id} sim={sim} onOpenEvidence={onOpenEvidence} />);
      expect(screen.getByRole("link", { name: /OPEN PIPELINE/ }).getAttribute("href")).toBe("/pipeline");
    }

    rerender(<ModuleView id={seededId} sim={sim} onOpenEvidence={onOpenEvidence} allowSeededFallback={false} />);
    expect(screen.getByText(/no issuer-specific output available/)).toBeTruthy();
    for (const layout of ["summary", "report", "dense"] as const) {
      rerender(<ModuleView id={seededId} sim={sim} onOpenEvidence={onOpenEvidence} layout={layout} />);
      expect(screen.getByText(`step grid ${seededId} ${layout}`)).toBeTruthy();
    }

    const blankLive = {
      kpis: [{ l: "Leverage", v: "—", sev: "idle" }],
      sections: [{ type: "text", title: "Overall conclusion", body: "No populated figures", ev: [] }],
    } as never;
    rerender(<ModuleView id={seededId} sim={sim} onOpenEvidence={onOpenEvidence} liveOut={blankLive} layout="summary" />);
    expect(screen.getByText(/no populated headline figures/)).toBeTruthy();
    expect(screen.getByText(`live register ${seededId}`)).toBeTruthy();

    const populatedLive = { kpis: [{ l: "Leverage", v: "5.0x", sev: "warning" }], sections: [] } as never;
    rerender(<ModuleView id={seededId} sim={sim} onOpenEvidence={onOpenEvidence} liveOut={populatedLive} layout="report" />);
    expect(screen.getByText("Leverage: 5.0x")).toBeTruthy();
  });
});
