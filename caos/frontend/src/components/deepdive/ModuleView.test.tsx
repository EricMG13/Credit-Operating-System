// @vitest-environment jsdom

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SIM_PLAN } from "@/lib/pipeline/data";
import { initSim } from "@/lib/pipeline/sim-engine";
import { ModuleView } from "./tabs";

afterEach(cleanup);

describe("ModuleView", () => {
  it("does not show seeded output for a missing issuer-scoped module", () => {
    render(
      <ModuleView
        id="CP-1"
        sim={initSim(SIM_PLAN)}
        onOpenEvidence={() => {}}
        allowSeededFallback={false}
      />,
    );

    expect(screen.getByText("CP-1 · no analytical output register")).toBeTruthy();
    expect(screen.getByText(/no issuer-specific output/i)).toBeTruthy();
    expect(screen.queryByText(/revenue/i)).toBeNull();
  });

  it("renders CP-2G's seeded reference register with a passed tag, never the unavailable state", () => {
    render(
      <ModuleView
        id="CP-2G"
        sim={initSim(SIM_PLAN)}
        onOpenEvidence={() => {}}
        allowSeededFallback
      />,
    );
    expect(screen.getAllByText(/ESG credit implication register/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/no synthetic reference finding/i)).toBeNull();
    // Outside the replay-sim DAG the identity tag mirrors the launcher: pass, not idle.
    expect(screen.getByText("pass")).toBeTruthy();
  });

  it("summary layout keeps analysis output and summarizes workflow cards", () => {
    render(
      <ModuleView
        id="CP-2"
        sim={initSim(SIM_PLAN)}
        onOpenEvidence={() => {}}
        layout="summary"
      />,
    );

    expect(screen.getByText("Material factors")).toBeTruthy();
    expect(screen.getAllByText(/Overall credit view/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/workflow step summary/i)).toBeTruthy();
    expect(screen.queryByText(/Fundamental Synthesis/i)).toBeNull();
    expect(screen.queryByText(/required outputs/i)).toBeNull();
  });

  it("report layout keeps module outputs and workflow cards", () => {
    render(
      <ModuleView
        id="CP-2"
        sim={initSim(SIM_PLAN)}
        onOpenEvidence={() => {}}
        layout="report"
      />,
    );

    expect(screen.getByText("Material factors")).toBeTruthy();
    expect(screen.getAllByText(/Overall credit view/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/workflow step outputs/i)).toBeTruthy();
  });

  it("summary layout renders live issuer sections in a persisted runtime register without seeded summaries", () => {
    render(
      <ModuleView
        id="CP-2"
        sim={initSim(SIM_PLAN)}
        onOpenEvidence={() => {}}
        layout="summary"
        liveOut={{
          kpis: [{ l: "Live KPI", v: "42" }],
          sections: [{ type: "text", title: "Live view", body: "Issuer-specific live read." }],
        }}
      />,
    );

    expect(screen.getByText("Live KPI")).toBeTruthy();
    expect(screen.getByText(/Issuer-specific live read/i)).toBeTruthy();
    expect(screen.getByText(/runtime output register/i)).toBeTruthy();
    expect(screen.getByText(/Live · persisted engine output/i)).toBeTruthy();
    expect(screen.queryByText(/not yet wired for live runs/i)).toBeNull();
    expect(screen.queryByText(/Fundamental Synthesis/i)).toBeNull();
  });
});
