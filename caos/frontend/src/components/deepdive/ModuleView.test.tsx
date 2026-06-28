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
});
